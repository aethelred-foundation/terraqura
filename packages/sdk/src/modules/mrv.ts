/**
 * @terraqura/sdk — MRV Module
 *
 * Monitoring, Reporting, and Verification operations for DAC operators.
 * Submit capture data for on-chain verification and credit minting.
 */

import { ethers } from "ethers";

import {
  CarbonCreditABI,
  VerificationEngineABI,
  SUBGRAPH_URLS,
} from "../constants.js";
import {
  AuthenticationError,
  TerraQuraError,
  SubgraphError,
} from "../errors.js";
import { CaptureSubmissionSchema } from "../types.js";
import {
  withRetry,
  toBytes32,
  createIdempotencyKey,
  parseEventFromReceipt,
} from "../utils.js";

import type { GasManager } from "../gas.js";
import type { ITelemetry } from "../telemetry.js";
import type {
  InternalConfig,
  TransactionResult,
  VerificationPreview,
  DACUnitInfo,
  CaptureSubmissionInput,
} from "../types.js";
import type { IdempotencyStore } from "../utils.js";

// ============================================
// MRV Module
// ============================================

/**
 * MRV (Monitoring, Reporting, Verification) operations.
 *
 * Enables DAC operators to submit capture data for on-chain
 * Proof-of-Physics verification and credit minting.
 *
 * @example
 * ```ts
 * const client = new TerraQuraClient({ network: "aethelred-testnet", privateKey: "0x..." });
 *
 * // Preview verification before submitting
 * const preview = await client.mrv.previewVerification({
 *   co2AmountKg: 1000,
 *   energyConsumedKwh: 350,
 *   purityPercentage: 95,
 *   gridIntensityGCO2PerKwh: 50,
 * });
 *
 * if (preview.isValid) {
 *   console.log(`Net credits: ${preview.netCreditsKg} kg`);
 *
 *   // Submit for real minting
 *   const result = await client.mrv.submitCapture({
 *     recipient: myAddress,
 *     dacUnitId: "DAC-001",
 *     sourceDataHash: "0x...",
 *     captureTimestamp: Math.floor(Date.now() / 1000),
 *     co2AmountKg: 1000,
 *     energyConsumedKwh: 350,
 *     purityPercentage: 95,
 *     gridIntensityGCO2PerKwh: 50,
 *     latitude: 24500000,
 *     longitude: 54700000,
 *   });
 *   console.log("Token ID:", result.data.tokenId);
 * }
 * ```
 */
export class MRVModule {
  private readonly config: InternalConfig;
  private readonly telemetry: ITelemetry;
  private readonly gasManager: GasManager;
  private readonly idempotency: IdempotencyStore;
  private carbonCredit: ethers.Contract | null = null;
  private verificationEngine: ethers.Contract | null = null;
  private carbonCreditInterface: ethers.Interface | null = null;

  constructor(
    config: InternalConfig,
    telemetry: ITelemetry,
    gasManager: GasManager,
    idempotency: IdempotencyStore,
  ) {
    this.config = config;
    this.telemetry = telemetry;
    this.gasManager = gasManager;
    this.idempotency = idempotency;
  }

  // ============================================
  // Write Operations
  // ============================================

  /**
   * Submit DAC capture data for on-chain verification and credit minting.
   *
   * This triggers the full Proof-of-Physics verification pipeline:
   * 1. SOURCE verification (DAC unit whitelist check)
   * 2. LOGIC verification (thermodynamic bounds, purity, Net-Negative)
   * 3. MINT verification (double-mint prevention)
   *
   * If all phases pass, credits are minted to the recipient.
   *
   * @param params - Capture data to submit
   * @returns Transaction result with minted token ID and credit amount
   */
  async submitCapture(
    params: CaptureSubmissionInput,
  ): Promise<TransactionResult<{ tokenId: bigint; creditsAmount: bigint }>> {
    return this.telemetry.wrapAsync("mrv.submitCapture", async () => {
      this.requireSigner();
      const input = CaptureSubmissionSchema.parse(params);

      // Convert DAC unit ID to bytes32 if needed
      const dacUnitId = toBytes32(input.dacUnitId);

      const key = createIdempotencyKey("mrv", "submitCapture", {
        dacUnitId,
        sourceDataHash: input.sourceDataHash,
      });
      await this.idempotency.acquire(key);

      try {
        const contract = this.getCarbonCredit();
        const overrides = await this.gasManager.buildGasOverrides("mint");

        const mintVerifiedCreditsFn = contract.getFunction("mintVerifiedCredits");
        const tx = await mintVerifiedCreditsFn(
          input.recipient,
          dacUnitId,
          input.sourceDataHash,
          input.captureTimestamp,
          input.co2AmountKg,
          input.energyConsumedKwh,
          input.latitude,
          input.longitude,
          input.purityPercentage,
          input.gridIntensityGCO2PerKwh,
          input.ipfsMetadataUri,
          input.arweaveBackupTxId,
          overrides,
        );

        const receipt = await tx.wait();

        // Parse CreditMinted event for tokenId and amount
        const event = parseEventFromReceipt(
          receipt,
          this.getCarbonCreditInterface(),
          "CreditMinted",
        );

        const result: TransactionResult<{ tokenId: bigint; creditsAmount: bigint }> = {
          txHash: receipt.hash,
          blockNumber: receipt.blockNumber,
          gasUsed: receipt.gasUsed,
          data: {
            tokenId: BigInt((event?.tokenId as bigint | string) || 0),
            creditsAmount: BigInt((event?.creditsAmount as bigint | string) || 0),
          },
          receipt,
        };

        await this.idempotency.release(key, result);
        return result;
      } catch (error) {
        await this.idempotency.remove(key);
        throw this.wrapError(error);
      }
    });
  }

  // ============================================
  // Read Operations (View Functions)
  // ============================================

  /**
   * Preview the Net-Negative verification result without minting.
   *
   * This is a read-only (pure) function — no gas cost, no signer required.
   *
   * @param params - Capture parameters to preview
   * @returns Verification preview with net credits and efficiency factor
   */
  async previewVerification(params: {
    co2AmountKg: number;
    energyConsumedKwh: number;
    purityPercentage: number;
    gridIntensityGCO2PerKwh: number;
  }): Promise<VerificationPreview> {
    return this.telemetry.wrapAsync(
      "mrv.previewVerification",
      async () => {
        const ve = this.getVerificationEngine();
        const fn = ve.getFunction("previewNetNegativeCredits");

        const result = await withRetry(
          () =>
            fn(
              params.co2AmountKg,
              params.energyConsumedKwh,
              params.purityPercentage,
              params.gridIntensityGCO2PerKwh,
            ),
          this.config.retry,
        );

        return {
          isValid: Boolean(result[0] || result.isValid),
          netCreditsKg: Number(result[1] || result.netCreditsKg || 0),
          efficiencyFactor: Number(result[2] || result.efficiencyFactor || 0),
          grossCreditsScaled: BigInt(result[3] || result.grossCreditsScaled || 0),
          energyDebtScaled: BigInt(result[4] || result.energyDebtScaled || 0),
        };
      },
    );
  }

  /**
   * Preview the legacy efficiency factor (without Net-Negative grid adjustment).
   *
   * Uses default grid intensity of 400 gCO2/kWh (global average).
   */
  async previewEfficiency(
    co2AmountKg: number,
    energyConsumedKwh: number,
    purityPercentage: number,
  ): Promise<{ isValid: boolean; efficiencyFactor: bigint }> {
    return this.telemetry.wrapAsync(
      "mrv.previewEfficiency",
      async () => {
        const ve = this.getVerificationEngine();
        const fn = ve.getFunction("previewEfficiencyFactor");

        const result = await withRetry(
          () =>
            fn(
              co2AmountKg,
              energyConsumedKwh,
              purityPercentage,
            ),
          this.config.retry,
        );

        return {
          isValid: Boolean(result[0] || result.isValid),
          efficiencyFactor: BigInt(result[1] || result.efficiencyFactor || 0),
        };
      },
    );
  }

  /**
   * Get all whitelisted DAC units from the subgraph.
   */
  async getWhitelistedUnits(): Promise<DACUnitInfo[]> {
    return this.telemetry.wrapAsync(
      "mrv.getWhitelistedUnits",
      async () => {
        const url =
          this.config.subgraphUrl ||
          SUBGRAPH_URLS[this.config.network] ||
          "";

        if (!url) {
          throw new SubgraphError("No subgraph URL configured");
        }

        const query = `{
          dacUnits(where: { isWhitelisted: true }, first: 100) {
            dacUnitId
            operator
            isWhitelisted
          }
        }`;

        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query }),
        });

        const json = (await response.json()) as {
          data?: { dacUnits?: Array<Record<string, unknown>> };
        };

        const units = json.data?.dacUnits || [];

        return units.map((u) => ({
          dacUnitId: (u.dacUnitId as string) || "",
          operator: (u.operator as string) || "",
          isWhitelisted: Boolean(u.isWhitelisted),
        }));
      },
    );
  }

  /**
   * Get DAC unit info from on-chain (real-time, not cached).
   */
  async getDACUnit(
    dacId: string,
  ): Promise<{ isWhitelisted: boolean; operator: string }> {
    return this.telemetry.wrapAsync("mrv.getDACUnit", async () => {
      const ve = this.getVerificationEngine();
      const dacUnitId = toBytes32(dacId);

      const isWhitelistedFn = ve.getFunction("isWhitelisted");
      const getOperatorFn = ve.getFunction("getOperator");

      const [isWhitelisted, operator] = await Promise.all([
        withRetry(() => isWhitelistedFn(dacUnitId), this.config.retry),
        withRetry(
          () => getOperatorFn(dacUnitId).catch(() => ethers.ZeroAddress),
          this.config.retry,
        ),
      ]);

      return {
        isWhitelisted: Boolean(isWhitelisted),
        operator: operator as string,
      };
    });
  }

  /**
   * Get the current verification thresholds from the contract.
   */
  async getVerificationThresholds(): Promise<{
    minKwh: bigint;
    maxKwh: bigint;
    optimalKwh: bigint;
    minPurity: number;
  }> {
    return this.telemetry.wrapAsync(
      "mrv.getVerificationThresholds",
      async () => {
        const ve = this.getVerificationEngine();
        const fn = ve.getFunction("getVerificationThresholds");

        const result = await withRetry(
          () => fn(),
          this.config.retry,
        );

        return {
          minKwh: BigInt(result[0] || result.minKwh || 0),
          maxKwh: BigInt(result[1] || result.maxKwh || 0),
          optimalKwh: BigInt(result[2] || result.optimalKwh || 0),
          minPurity: Number(result[3] || result.minPurity || 0),
        };
      },
    );
  }

  /**
   * Check if a source data hash has already been processed (anti-double-mint).
   */
  async isHashProcessed(sourceDataHash: string): Promise<boolean> {
    return this.telemetry.wrapAsync(
      "mrv.isHashProcessed",
      async () => {
        const ve = this.getVerificationEngine();
        const fn = ve.getFunction("isHashProcessed");
        return withRetry(
          () => fn(sourceDataHash),
          this.config.retry,
        );
      },
    );
  }

  // ============================================
  // Private Helpers
  // ============================================

  private getCarbonCredit(): ethers.Contract {
    if (!this.carbonCredit) {
      this.carbonCredit = new ethers.Contract(
        this.config.addresses.carbonCredit,
        CarbonCreditABI,
        this.config.signer || this.config.provider,
      );
    }
    return this.carbonCredit;
  }

  private getCarbonCreditInterface(): ethers.Interface {
    if (!this.carbonCreditInterface) {
      this.carbonCreditInterface = new ethers.Interface(CarbonCreditABI);
    }
    return this.carbonCreditInterface;
  }

  private getVerificationEngine(): ethers.Contract {
    if (!this.verificationEngine) {
      this.verificationEngine = new ethers.Contract(
        this.config.addresses.verificationEngine,
        VerificationEngineABI,
        this.config.provider,
      );
    }
    return this.verificationEngine;
  }

  private requireSigner(): void {
    if (!this.config.signer) {
      throw new AuthenticationError();
    }
  }

  private wrapError(error: unknown): TerraQuraError {
    if (error instanceof TerraQuraError) return error;
    return TerraQuraError.fromContractRevert(error);
  }
}
