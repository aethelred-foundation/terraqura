/**
 * @terraqura/sdk — Assets Module
 *
 * Carbon credit asset operations: provenance, balances, metadata,
 * verification results, and credit history.
 */

import { ethers } from "ethers";

import {
  CarbonCreditABI,
  VerificationEngineABI,
  SUBGRAPH_URLS,
} from "../constants.js";
import { SubgraphError } from "../errors.js";
import { PaginationSchema } from "../types.js";
import {
  withRetry,
  validateAddress,
} from "../utils.js";

import type { ITelemetry } from "../telemetry.js";
import type {
  InternalConfig,
  Provenance,
  OnChainMetadata,
  OnChainVerification,
  NetNegativeBreakdown,
  DACUnitInfo,
  TransferRecord,
  CreditSummary,
  PaginatedResult,
  PaginationInput,
} from "../types.js";

interface SubgraphCreditBalanceNode {
  tokenId?: string;
  balance?: string;
  credit?: {
    co2AmountKg?: string | number;
    isRetired?: boolean;
    mintedAt?: string | number;
  } | null;
}

interface SubgraphTransferNode {
  from?: string;
  to?: string;
  amount?: string;
  transactionHash?: string;
  blockNumber?: string | number;
  timestamp?: string | number;
}

interface SubgraphResponse<TData extends Record<string, unknown>> {
  data?: TData;
  errors?: unknown[];
}

// ============================================
// Assets Module
// ============================================

/**
 * Carbon credit asset operations.
 *
 * Provides read-only access to carbon credit data including
 * provenance chains, balances, metadata, and verification results.
 *
 * @example
 * ```ts
 * const client = new TerraQuraClient({ network: "aethelred-testnet" });
 *
 * // Get full provenance chain (Trust Object)
 * const provenance = await client.assets.getProvenance("42");
 *
 * // Check balance
 * const balance = await client.assets.getBalance(myAddress, "42");
 *
 * // Get platform stats
 * const minted = await client.assets.getTotalMinted();
 * const retired = await client.assets.getTotalRetired();
 * ```
 */
export class AssetsModule {
  private readonly config: InternalConfig;
  private readonly telemetry: ITelemetry;
  private carbonCredit: ethers.Contract | null = null;
  private verificationEngine: ethers.Contract | null = null;

  constructor(config: InternalConfig, telemetry: ITelemetry) {
    this.config = config;
    this.telemetry = telemetry;
  }

  // ============================================
  // Public API
  // ============================================

  /**
   * Get the full provenance chain for a carbon credit (Trust Object).
   *
   * Combines on-chain metadata, verification result, and subgraph
   * transfer history into a single comprehensive object.
   *
   * @param tokenId - ERC-1155 token ID
   * @returns Complete provenance data
   */
  async getProvenance(tokenId: string): Promise<Provenance> {
    return this.telemetry.wrapAsync(
      "assets.getProvenance",
      async () => {
        const cc = this.getCarbonCredit();
        const fn = cc.getFunction("getCreditProvenance");

        // Fetch provenance data (metadata + verification in one call)
        const [provenanceResult, transferHistory] = await Promise.all([
          withRetry(
            () => fn(BigInt(tokenId)),
            this.config.retry,
          ),
          this.fetchTransferHistory(tokenId),
        ]);

        const rawMetadata = provenanceResult.metadata || provenanceResult[0];
        const rawVerification = provenanceResult.verification || provenanceResult[1];

        const metadata = this.parseMetadata(rawMetadata);
        const verification = this.parseVerification(rawVerification);

        // Build Net-Negative breakdown
        const netNegativeBreakdown = this.computeNetNegativeBreakdown(metadata);

        // Get DAC unit info
        const dacUnit = await this.fetchDACUnitInfo(metadata.dacUnitId);

        return {
          tokenId,
          metadata,
          verification,
          gps: {
            lat: metadata.latitude,
            lng: metadata.longitude,
          },
          efficiencyFactor: Number(verification.efficiencyFactor) / 100,
          gridIntensity: metadata.gridIntensityGCO2PerKwh,
          netNegativeBreakdown,
          dacUnit,
          transferHistory,
        };
      },
      { tokenId },
    );
  }

  /**
   * Get the carbon credit balance for an address.
   *
   * @param address - Ethereum address
   * @param tokenId - ERC-1155 token ID
   * @returns Balance as bigint
   */
  async getBalance(address: string, tokenId: string): Promise<bigint> {
    return this.telemetry.wrapAsync(
      "assets.getBalance",
      async () => {
        const validAddress = validateAddress(address);
        const cc = this.getCarbonCredit();
        const fn = cc.getFunction("balanceOf");
        return withRetry(
          () => fn(validAddress, BigInt(tokenId)),
          this.config.retry,
        );
      },
      { tokenId },
    );
  }

  /**
   * Get on-chain metadata for a credit.
   * Note: Uses the simpler getMetadata (without provenance strings).
   */
  async getMetadata(tokenId: string): Promise<OnChainMetadata> {
    return this.telemetry.wrapAsync(
      "assets.getMetadata",
      async () => {
        const cc = this.getCarbonCredit();
        const fn = cc.getFunction("getCreditProvenance");
        const result = await withRetry(
          () => fn(BigInt(tokenId)),
          this.config.retry,
        );
        return this.parseMetadata(result.metadata || result[0]);
      },
      { tokenId },
    );
  }

  /**
   * Get on-chain verification result for a credit.
   */
  async getVerification(tokenId: string): Promise<OnChainVerification> {
    return this.telemetry.wrapAsync(
      "assets.getVerification",
      async () => {
        const cc = this.getCarbonCredit();
        const fn = cc.getFunction("getVerificationResult");
        const result = await withRetry(
          () => fn(BigInt(tokenId)),
          this.config.retry,
        );
        return this.parseVerification(result);
      },
      { tokenId },
    );
  }

  /**
   * Get the total number of credits ever minted.
   */
  async getTotalMinted(): Promise<bigint> {
    return this.telemetry.wrapAsync("assets.getTotalMinted", async () => {
      const cc = this.getCarbonCredit();
      const fn = cc.getFunction("totalCreditsMinted");
      return withRetry(() => fn(), this.config.retry);
    });
  }

  /**
   * Get the total number of credits retired.
   */
  async getTotalRetired(): Promise<bigint> {
    return this.telemetry.wrapAsync("assets.getTotalRetired", async () => {
      const cc = this.getCarbonCredit();
      const fn = cc.getFunction("totalCreditsRetired");
      return withRetry(() => fn(), this.config.retry);
    });
  }

  /**
   * Check if a token ID exists.
   */
  async exists(tokenId: string): Promise<boolean> {
    return this.telemetry.wrapAsync("assets.exists", async () => {
      const cc = this.getCarbonCredit();
      const fn = cc.getFunction("exists");
      return withRetry(() => fn(BigInt(tokenId)), this.config.retry);
    });
  }

  /**
   * Get the total supply for a specific token ID.
   */
  async getTotalSupply(tokenId: string): Promise<bigint> {
    return this.telemetry.wrapAsync("assets.getTotalSupply", async () => {
      const cc = this.getCarbonCredit();
      const fn = cc.getFunction("totalSupply");
      return withRetry(
        () => fn(BigInt(tokenId)),
        this.config.retry,
      );
    });
  }

  /**
   * List all credits owned by an address (from subgraph).
   */
  async listCredits(
    address: string,
    options?: Partial<PaginationInput>,
  ): Promise<PaginatedResult<CreditSummary>> {
    return this.telemetry.wrapAsync(
      "assets.listCredits",
      async () => {
        const validAddress = validateAddress(address).toLowerCase();
        const pagination = PaginationSchema.parse(options || {});

        const query = `{
          creditBalances(
            where: { owner: "${validAddress}", balance_gt: "0" }
            first: ${pagination.limit}
            skip: ${pagination.offset}
            orderBy: mintedAt
            orderDirection: desc
          ) {
            id
            tokenId
            owner
            balance
            credit {
              co2AmountKg
              isRetired
              mintedAt
            }
          }
        }`;

        const data = await this.querySubgraph<{
          creditBalances?: SubgraphCreditBalanceNode[];
        }>(query);
        const balances = data.creditBalances ?? [];

        return {
          items: balances.map((balanceNode) => {
            const credit = balanceNode.credit;
            return {
              tokenId: balanceNode.tokenId || "",
              co2AmountKg: Number(credit?.co2AmountKg || 0),
              balance: BigInt(balanceNode.balance || "0"),
              isRetired: credit?.isRetired === true,
              mintedAt: Number(credit?.mintedAt || 0),
            };
          }),
          total: balances.length,
          offset: pagination.offset,
          limit: pagination.limit,
          hasMore: balances.length === pagination.limit,
        };
      },
      { address },
    );
  }

  /**
   * Get the complete transfer/retirement history for a credit.
   */
  async getCreditHistory(
    tokenId: string,
  ): Promise<TransferRecord[]> {
    return this.telemetry.wrapAsync(
      "assets.getCreditHistory",
      async () => this.fetchTransferHistory(tokenId),
      { tokenId },
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

  private parseMetadata(raw: Record<string, unknown>): OnChainMetadata {
    return {
      dacUnitId: (raw.dacUnitId as string) || "",
      sourceDataHash: (raw.sourceDataHash as string) || "",
      captureTimestamp: Number(raw.captureTimestamp || 0),
      co2AmountKg: Number(raw.co2AmountKg || 0),
      energyConsumedKwh: Number(raw.energyConsumedKwh || 0),
      latitude: Number(raw.latitude || 0) / 1e6, // int256 scaled by 1e6 → decimal
      longitude: Number(raw.longitude || 0) / 1e6,
      purityPercentage: Number(raw.purityPercentage || 0),
      gridIntensityGCO2PerKwh: Number(raw.gridIntensityGCO2PerKwh || 0),
      isRetired: Boolean(raw.isRetired),
      ipfsMetadataUri: (raw.ipfsMetadataUri as string) || "",
      arweaveBackupTxId: (raw.arweaveBackupTxId as string) || "",
    };
  }

  private parseVerification(raw: Record<string, unknown>): OnChainVerification {
    return {
      sourceVerified: Boolean(raw.sourceVerified),
      logicVerified: Boolean(raw.logicVerified),
      mintVerified: Boolean(raw.mintVerified),
      efficiencyFactor: BigInt(
        (raw.efficiencyFactor as bigint | number | string) || 0,
      ),
      verifiedAt: Number(raw.verifiedAt || 0),
    };
  }

  private computeNetNegativeBreakdown(
    metadata: OnChainMetadata,
  ): NetNegativeBreakdown {
    const { co2AmountKg, energyConsumedKwh, purityPercentage, gridIntensityGCO2PerKwh } = metadata;

    // Replicate the Net-Negative formula:
    // grossCredits = co2AmountKg * purityFactor
    // energyDebt = energyConsumedKwh * gridIntensity / 1000
    // netCredits = grossCredits - energyDebt
    const purityFactor = purityPercentage / 100;
    const grossCreditsKg = co2AmountKg * purityFactor;
    const energyDebtKg =
      (energyConsumedKwh * gridIntensityGCO2PerKwh) / 1000;
    const netCreditsKg = Math.max(0, grossCreditsKg - energyDebtKg);

    return {
      grossCreditsKg,
      energyDebtKg,
      netCreditsKg,
      co2AmountKg,
      energyConsumedKwh,
      purityPercentage,
      gridIntensityGCO2PerKwh,
    };
  }

  private async fetchDACUnitInfo(
    dacUnitId: string,
  ): Promise<DACUnitInfo> {
    try {
      const ve = this.getVerificationEngine();
      const isWhitelistedFn = ve.getFunction("isWhitelisted");
      const getOperatorFn = ve.getFunction("getOperator");
      const [isWhitelisted, operator] = await Promise.all([
        isWhitelistedFn(dacUnitId),
        getOperatorFn(dacUnitId).catch(() => ethers.ZeroAddress),
      ]);

      return {
        dacUnitId,
        operator: operator as string,
        isWhitelisted: isWhitelisted as boolean,
      };
    } catch {
      return {
        dacUnitId,
        operator: ethers.ZeroAddress,
        isWhitelisted: false,
      };
    }
  }

  private async fetchTransferHistory(
    tokenId: string,
  ): Promise<TransferRecord[]> {
    try {
      const query = `{
        transfers(
          where: { tokenId: "${tokenId}" }
          orderBy: blockNumber
          orderDirection: desc
          first: 100
        ) {
          from
          to
          amount
          transactionHash
          blockNumber
          timestamp
        }
      }`;

      const data = await this.querySubgraph<{ transfers?: SubgraphTransferNode[] }>(query);
      const transfers = data.transfers ?? [];

      return transfers.map((transfer) => ({
        from: transfer.from || "",
        to: transfer.to || "",
        amount: BigInt(transfer.amount || "0"),
        txHash: transfer.transactionHash || "",
        blockNumber: Number(transfer.blockNumber || 0),
        timestamp: Number(transfer.timestamp || 0),
      }));
    } catch {
      return [];
    }
  }

  private async querySubgraph<TData extends Record<string, unknown> = Record<string, unknown>>(
    query: string,
  ): Promise<TData> {
    const url =
      this.config.subgraphUrl ||
      SUBGRAPH_URLS[this.config.network] ||
      "";

    if (!url) {
      throw new SubgraphError("No subgraph URL configured for this network");
    }

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });

      if (!response.ok) {
        throw new SubgraphError(
          `HTTP ${response.status}: ${response.statusText}`,
          { url, status: response.status },
        );
      }

      const json = (await response.json()) as SubgraphResponse<TData>;

      if (json.errors && (json.errors as unknown[]).length > 0) {
        throw new SubgraphError("GraphQL query error", {
          errors: json.errors,
        });
      }

      return json.data || ({} as TData);
    } catch (error) {
      if (error instanceof SubgraphError) throw error;
      throw new SubgraphError(
        (error as Error).message || "Unknown subgraph error",
        { originalError: error },
      );
    }
  }
}
