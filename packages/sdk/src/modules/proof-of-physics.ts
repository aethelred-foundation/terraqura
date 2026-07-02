/**
 * @terraqura/sdk — Proof-of-Physics Module
 *
 * Consensus-anchored MRV: read and write the top assurance tier where a carbon
 * capture claim is anchored to an Aethelred Digital Seal (minted by the
 * validator quorum, verified via the ISeal precompile). This is the SDK surface
 * for SealProofOfPhysics.sol.
 */

import { ethers } from "ethers";

import { SealProofOfPhysicsABI } from "../constants.js";
import {
  AuthenticationError,
  SDKErrorCode,
  TerraQuraError,
} from "../errors.js";
import { withRetry, toBytes32 } from "../utils.js";

import type { GasManager } from "../gas.js";
import type { ITelemetry } from "../telemetry.js";
import type { InternalConfig, TransactionResult } from "../types.js";

/** A consensus anchor record for a (dacUnitId, sourceDataHash) claim. */
export interface AnchorRecord {
  /** The backing Digital Seal id (empty when no record exists). */
  sealId: string;
  /** Block timestamp of anchoring (0 when no record exists). */
  anchoredAt: bigint;
  /** Whether an anchor record exists for this claim. */
  exists: boolean;
  /** Whether the anchor was locally revoked by governance. */
  revoked: boolean;
}

/**
 * Proof-of-Physics (consensus-anchored MRV) operations.
 *
 * @example
 * ```ts
 * const client = new TerraQuraClient({ network: "aethelred-testnet", privateKey: "0x..." });
 *
 * // Check whether a claim carries a LIVE consensus anchor before minting.
 * const anchored = await client.proofOfPhysics.isAnchored("DAC-001", "0xdead...beef");
 *
 * // The exact PoUW job purpose a seal must carry to anchor this claim.
 * const purpose = await client.proofOfPhysics.expectedPurpose("DAC-001", "0xdead...beef");
 *
 * // Anchor the claim once the quorum has minted the seal for `jobId`.
 * const result = await client.proofOfPhysics.anchorClaim({
 *   dacUnitId: "DAC-001",
 *   sourceDataHash: "0xdead...beef",
 *   jobId: "job-mrv-001",
 * });
 * ```
 */
export class ProofOfPhysicsModule {
  private readonly config: InternalConfig;
  private readonly telemetry: ITelemetry;
  private readonly gasManager: GasManager;
  private registry: ethers.Contract | null = null;

  constructor(
    config: InternalConfig,
    telemetry: ITelemetry,
    gasManager: GasManager,
  ) {
    this.config = config;
    this.telemetry = telemetry;
    this.gasManager = gasManager;
  }

  // ============================================
  // Read Operations
  // ============================================

  /**
   * True iff the claim carries a LIVE consensus anchor: recorded, not locally
   * revoked, and its backing Digital Seal is still ACTIVE on-chain (revocation
   * propagates from consensus instantly, with no TerraQura transaction).
   */
  async isAnchored(
    dacUnitId: string,
    sourceDataHash: string,
  ): Promise<boolean> {
    return this.telemetry.wrapAsync("proofOfPhysics.isAnchored", async () => {
      const registry = this.getRegistry();
      const fn = registry.getFunction("isAnchored");
      return withRetry(
        () => fn(toBytes32(dacUnitId), sourceDataHash) as Promise<boolean>,
        this.config.retry,
      );
    });
  }

  /** Full anchor record for a claim (sealId, anchoredAt, exists, revoked). */
  async getAnchor(
    dacUnitId: string,
    sourceDataHash: string,
  ): Promise<AnchorRecord> {
    return this.telemetry.wrapAsync("proofOfPhysics.getAnchor", async () => {
      const registry = this.getRegistry();
      const fn = registry.getFunction("getAnchor");
      const raw = await withRetry(
        () => fn(toBytes32(dacUnitId), sourceDataHash),
        this.config.retry,
      );
      return {
        sealId: raw.sealId as string,
        anchoredAt: BigInt(raw.anchoredAt as bigint | number),
        exists: raw.exists as boolean,
        revoked: raw.revoked as boolean,
      };
    });
  }

  /**
   * The exact PoUW job purpose a seal must carry to anchor this claim:
   * `terraqura:0x<dacUnitId>:0x<sourceDataHash>`. Read from the contract so the
   * SDK never diverges from the on-chain canonical format.
   */
  async expectedPurpose(
    dacUnitId: string,
    sourceDataHash: string,
  ): Promise<string> {
    return this.telemetry.wrapAsync(
      "proofOfPhysics.expectedPurpose",
      async () => {
        const registry = this.getRegistry();
        const fn = registry.getFunction("expectedPurpose");
        return withRetry(
          () => fn(toBytes32(dacUnitId), sourceDataHash) as Promise<string>,
          this.config.retry,
        );
      },
    );
  }

  // ============================================
  // Write Operations
  // ============================================

  /**
   * Anchor a claim to the Digital Seal minted for `jobId`. Permissionless: the
   * seal's purpose binds the exact claim, so the caller identity carries no
   * authority. Reverts if no seal exists for the job, the seal is not ACTIVE,
   * its purpose does not bind this claim, its CEAP attestation fails the
   * registry policy, or the claim is already anchored.
   */
  async anchorClaim(params: {
    dacUnitId: string;
    sourceDataHash: string;
    jobId: string;
  }): Promise<
    TransactionResult<{ dacUnitId: string; sourceDataHash: string }>
  > {
    return this.telemetry.wrapAsync("proofOfPhysics.anchorClaim", async () => {
      this.requireSigner();
      if (!params.jobId || params.jobId.length === 0) {
        throw new TerraQuraError(
          "jobId is required to anchor a claim",
          SDKErrorCode.VALIDATION_ERROR,
        );
      }

      const registry = this.getRegistry();
      const dacUnitId = toBytes32(params.dacUnitId);
      // No dedicated gas limit for anchoring; estimator + defaults apply.
      const overrides = await this.gasManager.buildGasOverrides();

      try {
        const anchorFn = registry.getFunction("anchor");
        const tx = await anchorFn(
          dacUnitId,
          params.sourceDataHash,
          params.jobId,
          overrides,
        );
        const receipt = await tx.wait();
        return {
          txHash: receipt.hash,
          blockNumber: receipt.blockNumber,
          gasUsed: receipt.gasUsed,
          data: { dacUnitId, sourceDataHash: params.sourceDataHash },
          receipt,
        };
      } catch (error) {
        throw this.wrapError(error);
      }
    });
  }

  // ============================================
  // Internals
  // ============================================

  private getRegistry(): ethers.Contract {
    if (!this.registry) {
      const address = this.config.addresses.sealProofOfPhysics;
      if (!address || address === ethers.ZeroAddress) {
        throw new TerraQuraError(
          "SealProofOfPhysics is not deployed on this network yet",
          SDKErrorCode.VALIDATION_ERROR,
        );
      }
      this.registry = new ethers.Contract(
        address,
        SealProofOfPhysicsABI,
        this.config.signer || this.config.provider,
      );
    }
    return this.registry;
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
