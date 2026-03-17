/**
 * @terraqura/sdk — Claims Module
 *
 * Automated carbon reversal detection and restitution engine.
 * Integrates the Risk Oracle, Insurance Module, and on-chain
 * ClaimsManager contract to provide "principal-protected" carbon credits.
 *
 * Architecture:
 * - **Reversal Detection**: Monitors health scores for critical drops
 *   (score = 0 → total failure; score < threshold → partial failure)
 * - **Claim Filing**: Creates claim records with full audit trail
 * - **Automated Restitution**: Replaces failed credits with healthy
 *   credits from the Buffer Pool via ClaimsManager.sol
 * - **Notification Pipeline**: Dispatches webhook notifications to
 *   affected buyers and partners
 *
 * The claims flow:
 * 1. ActuarialWorker detects health score drop → calls `detectReversal()`
 * 2. SDK files claim on affected policies → transitions to "claimed"
 * 3. `resolveReversal()` calls ClaimsManager.sol for atomic replacement
 * 4. SDK marks policies as "resolved" → dispatches buyer webhooks
 *
 * This converts TerraQura credits from "speculative removals" into
 * "Guaranteed Sequestration Units" — bankable by pension funds.
 *
 * @example
 * ```ts
 * const client = new TerraQuraClient({ network: "aethelred", privateKey: "0x..." });
 *
 * // Detect reversal for a DAC unit
 * const detection = await client.claims.detectReversal({
 *   dacUnitId: "dac-unit-001",
 *   currentHealthScore: 0,
 *   previousHealthScore: 75,
 *   reason: "Total hardware failure — sorbent degradation",
 * });
 * console.log(detection.affectedPolicies);   // 12 policies
 * console.log(detection.totalAffectedKg);     // 15,000 kg
 *
 * // Auto-resolve all affected claims
 * const resolution = await client.claims.resolveAllClaims(detection.claimIds);
 * console.log(resolution.successCount);  // 12
 * console.log(resolution.totalReplaced); // 15,000 kg
 *
 * // Manual claim filing (for custom scenarios)
 * const claim = client.claims.fileClaim({
 *   policyId: "tqp_abc123...",
 *   reason: "Partial sorbent degradation detected",
 *   severity: "partial",
 *   estimatedLossPercentage: 30,
 * });
 *
 * // Audit trail
 * const trail = client.claims.getClaimAuditTrail(claim.id);
 * ```
 */

import { ethers } from "ethers";

import {
  ValidationError,
  TerraQuraError,
} from "../errors.js";
import { withRetry } from "../utils.js";

import type { ITelemetry } from "../telemetry.js";
import type { InternalConfig } from "../types.js";
import type { InsuranceModule, InsurancePolicy } from "./insurance.js";


// ============================================
// ClaimsManager ABI (minimal interface)
// ============================================

const CLAIMS_MANAGER_ABI = [
  {
    name: "resolveReversal",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "tokenId", type: "uint256" },
      { name: "replacementTokenId", type: "uint256" },
      { name: "amount", type: "uint256" },
      { name: "recipient", type: "address" },
      { name: "reason", type: "string" },
    ],
    outputs: [],
  },
  {
    name: "claims",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "claimId", type: "uint256" }],
    outputs: [
      { name: "dacUnitId", type: "bytes32" },
      { name: "originalTokenId", type: "uint256" },
      { name: "amount", type: "uint256" },
      { name: "claimant", type: "address" },
      { name: "reason", type: "string" },
      { name: "timestamp", type: "uint256" },
      { name: "resolved", type: "bool" },
    ],
  },
  {
    name: "nextClaimId",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

// ============================================
// Claims Types
// ============================================

/** Claim status */
export type ClaimStatus =
  | "filed"         // Claim submitted, pending resolution
  | "resolving"     // On-chain resolution in progress
  | "resolved"      // Buyer made whole
  | "rejected"      // Claim rejected (insufficient evidence)
  | "partial"       // Partially resolved (buffer pool insufficient)
  | "escalated";    // Escalated to manual review

/** Claim severity level */
export type ClaimSeverity =
  | "total"     // Complete hardware failure (health = 0)
  | "critical"  // Severe degradation (health < 30)
  | "partial"   // Partial failure (health < 70)
  | "minor";    // Minor issue (cosmetic, no material loss)

/** Input for manual claim filing */
export interface FileClaimInput {
  /** Policy ID to file claim against */
  policyId: string;
  /** Reason for the claim */
  reason: string;
  /** Severity classification */
  severity: ClaimSeverity;
  /**
   * Estimated percentage of carbon loss (0–100).
   * 100 = total reversal, 30 = 30% of captured carbon released.
   */
  estimatedLossPercentage: number;
  /** Supporting evidence metadata */
  evidence?: Record<string, string | number | boolean>;
}

/** Input for automated reversal detection */
export interface DetectReversalInput {
  /** DAC unit experiencing the reversal */
  dacUnitId: string;
  /** Current health score (usually 0 for total failure) */
  currentHealthScore: number;
  /** Previous health score (for delta calculation) */
  previousHealthScore: number;
  /** Human-readable reason for the reversal */
  reason: string;
  /** Sensor data timestamp (for audit trail) */
  detectedAt?: number;
}

/** Claim record */
export interface Claim {
  /** Unique claim identifier */
  id: string;
  /** Associated policy ID */
  policyId: string;
  /** DAC unit that failed */
  dacUnitId: string;
  /** Claim status */
  status: ClaimStatus;
  /** Severity classification */
  severity: ClaimSeverity;
  /** Estimated carbon loss percentage */
  estimatedLossPercentage: number;
  /** Actual carbon replaced (kg) */
  replacedKg: number;
  /** Original token ID */
  originalTokenId: string;
  /** Replacement token ID (if resolved) */
  replacementTokenId: string | null;
  /** Buyer address (beneficiary) */
  buyerAddress: string;
  /** Claim reason */
  reason: string;
  /** On-chain transaction hash (if resolved on-chain) */
  txHash: string | null;
  /** On-chain claim ID */
  onChainClaimId: number | null;
  /** Claim filed timestamp */
  filedAt: number;
  /** Resolution timestamp */
  resolvedAt: number | null;
  /** Supporting evidence */
  evidence: Record<string, string | number | boolean>;
  /** Audit trail entries */
  auditTrail: ClaimAuditEntry[];
}

/** Audit trail entry for a claim */
export interface ClaimAuditEntry {
  /** Timestamp */
  timestamp: number;
  /** Action performed */
  action: string;
  /** Actor (system, address, etc.) */
  actor: string;
  /** Details */
  details: Record<string, unknown>;
}

/** Reversal detection result */
export interface ReversalDetection {
  /** DAC unit that triggered the detection */
  dacUnitId: string;
  /** Severity classification */
  severity: ClaimSeverity;
  /** Health score drop (previous → current) */
  healthScoreDelta: number;
  /** Number of affected policies */
  affectedPoliciesCount: number;
  /** Total carbon affected (kg) */
  totalAffectedKg: number;
  /** Claim IDs filed */
  claimIds: string[];
  /** Affected policies detail */
  affectedPolicies: InsurancePolicy[];
  /** Detection timestamp */
  detectedAt: number;
}

/** Batch resolution result */
export interface BatchResolutionResult {
  /** Per-claim results */
  results: Array<{
    claimId: string;
    success: boolean;
    txHash?: string;
    replacementTokenId?: string;
    error?: string;
  }>;
  /** Number of successfully resolved claims */
  successCount: number;
  /** Number of failed resolutions */
  failCount: number;
  /** Total carbon replaced (kg) */
  totalReplacedKg: number;
}

/** Claims dashboard analytics */
export interface ClaimsDashboard {
  /** Total claims filed */
  totalClaims: number;
  /** Claims by status */
  byStatus: Record<ClaimStatus, number>;
  /** Claims by severity */
  bySeverity: Record<ClaimSeverity, number>;
  /** Total carbon replaced (kg) */
  totalReplacedKg: number;
  /** Average resolution time (milliseconds) */
  averageResolutionTimeMs: number;
  /** Resolution success rate (0–1) */
  resolutionSuccessRate: number;
  /** DAC units with active claims */
  dacUnitsWithActiveClaims: string[];
  /** Generated at timestamp */
  generatedAt: number;
}

// ============================================
// Constants
// ============================================

/** Health score thresholds for automatic severity classification */
const SEVERITY_THRESHOLDS: ReadonlyArray<{ maxScore: number; severity: ClaimSeverity }> = [
  { maxScore: 0, severity: "total" },
  { maxScore: 30, severity: "critical" },
  { maxScore: 70, severity: "partial" },
  { maxScore: 100, severity: "minor" },
];

// ============================================
// ClaimsModule
// ============================================

/**
 * Enterprise Claims Module — Automated Restitution Engine.
 *
 * Provides:
 * - **Reversal Detection**: `detectReversal()` — identifies affected policies
 * - **Claim Filing**: `fileClaim()` — manual or automated claim creation
 * - **Resolution**: `resolveClaim()` / `resolveAllClaims()` — on-chain replacement
 * - **Audit Trail**: `getClaimAuditTrail()` — complete claim history
 * - **Dashboard**: `getDashboard()` — claims analytics
 */
export class ClaimsModule {
  private readonly config: InternalConfig;
  private readonly telemetry: ITelemetry;
  private readonly insurance: InsuranceModule;

  // In-memory claim store (production: replaced by DB)
  private readonly claims = new Map<string, Claim>();
  private readonly policyClaimIndex = new Map<string, string>(); // policyId → claimId
  private readonly dacUnitClaimIndex = new Map<string, Set<string>>(); // dacUnitId → claimIds

  constructor(
    config: InternalConfig,
    telemetry: ITelemetry,
    insurance: InsuranceModule,
  ) {
    this.config = config;
    this.telemetry = telemetry;
    this.insurance = insurance;
  }

  // ============================================
  // Reversal Detection
  // ============================================

  /**
   * Detect a carbon reversal and automatically file claims
   * on all affected insurance policies.
   *
   * This is the primary entry point for the actuarial worker.
   * When a DAC unit's health score drops critically, this method:
   * 1. Determines severity based on score delta
   * 2. Finds all active policies linked to the DAC unit
   * 3. Files claims on each affected policy
   * 4. Returns a detection report for the notification pipeline
   *
   * @param input - Reversal detection parameters
   * @returns Detection report with filed claim IDs
   *
   * @example
   * ```ts
   * // Called by ActuarialWorker when health drops to 0
   * const detection = await client.claims.detectReversal({
   *   dacUnitId: "dac-unit-001",
   *   currentHealthScore: 0,
   *   previousHealthScore: 75,
   *   reason: "Total hardware failure detected via PoP Oracle",
   * });
   * ```
   */
  detectReversal(input: DetectReversalInput): ReversalDetection {
    // ---- Validate ----
    if (!input.dacUnitId || input.dacUnitId.trim().length === 0) {
      throw new ValidationError("dacUnitId is required", {});
    }
    if (input.currentHealthScore < 0 || input.currentHealthScore > 100) {
      throw new ValidationError(
        "currentHealthScore must be between 0 and 100",
        { value: input.currentHealthScore },
      );
    }
    if (input.previousHealthScore < 0 || input.previousHealthScore > 100) {
      throw new ValidationError(
        "previousHealthScore must be between 0 and 100",
        { value: input.previousHealthScore },
      );
    }
    if (input.currentHealthScore >= input.previousHealthScore) {
      throw new ValidationError(
        "currentHealthScore must be less than previousHealthScore for reversal detection",
        {
          current: input.currentHealthScore,
          previous: input.previousHealthScore,
        },
      );
    }

    // ---- Determine Severity ----
    const severity = this.classifySeverity(input.currentHealthScore);
    const delta = input.previousHealthScore - input.currentHealthScore;
    const detectedAt = input.detectedAt ?? Date.now();

    // ---- Find Affected Policies ----
    const affectedPolicies = this.insurance.getAffectedPolicies(input.dacUnitId);

    if (affectedPolicies.length === 0) {
      return {
        dacUnitId: input.dacUnitId,
        severity,
        healthScoreDelta: delta,
        affectedPoliciesCount: 0,
        totalAffectedKg: 0,
        claimIds: [],
        affectedPolicies: [],
        detectedAt,
      };
    }

    // ---- Calculate Loss Percentage ----
    let lossPercentage: number;
    if (severity === "total") {
      lossPercentage = 100;
    } else if (severity === "critical") {
      lossPercentage = Math.min(100, Math.round((1 - input.currentHealthScore / 100) * 100));
    } else if (severity === "partial") {
      lossPercentage = Math.min(100, Math.round(delta * 0.5));
    } else {
      lossPercentage = Math.min(100, Math.round(delta * 0.1));
    }

    // ---- File Claims on Each Policy ----
    const claimIds: string[] = [];
    let totalAffectedKg = 0;

    for (const policy of affectedPolicies) {
      // Skip if already has an active claim
      if (this.policyClaimIndex.has(policy.id)) continue;

      try {
        const claim = this.fileClaimInternal({
          policyId: policy.id,
          reason: input.reason,
          severity,
          estimatedLossPercentage: lossPercentage,
          evidence: {
            previousHealthScore: input.previousHealthScore,
            currentHealthScore: input.currentHealthScore,
            detectedAt,
            delta,
            detectionSource: "actuarial-worker",
          },
        });

        claimIds.push(claim.id);
        totalAffectedKg += policy.amountKg * (lossPercentage / 100);
      } catch {
        // Policy may have been cancelled between detection and filing
        continue;
      }
    }

    return {
      dacUnitId: input.dacUnitId,
      severity,
      healthScoreDelta: delta,
      affectedPoliciesCount: affectedPolicies.length,
      totalAffectedKg: Math.round(totalAffectedKg),
      claimIds,
      affectedPolicies,
      detectedAt,
    };
  }

  // ============================================
  // Claim Filing
  // ============================================

  /**
   * Manually file a claim against an insurance policy.
   *
   * @param input - Claim filing parameters
   * @returns The created claim record
   */
  fileClaim(input: FileClaimInput): Claim {
    return this.fileClaimInternal(input);
  }

  /**
   * Get a claim by ID.
   *
   * @param claimId - The claim identifier
   * @returns The claim record with full audit trail
   */
  getClaim(claimId: string): Claim {
    const claim = this.claims.get(claimId);
    if (!claim) {
      throw new ValidationError("Claim not found", { claimId });
    }
    return { ...claim, auditTrail: [...claim.auditTrail] };
  }

  /**
   * Get the audit trail for a claim.
   *
   * @param claimId - The claim identifier
   * @returns Ordered list of audit entries
   */
  getClaimAuditTrail(claimId: string): ClaimAuditEntry[] {
    const claim = this.claims.get(claimId);
    if (!claim) {
      throw new ValidationError("Claim not found", { claimId });
    }
    return [...claim.auditTrail];
  }

  // ============================================
  // Claim Resolution
  // ============================================

  /**
   * Resolve a single claim by replacing credits from the Buffer Pool.
   *
   * If the client has a signer and the ClaimsManager address is configured,
   * this will execute an on-chain transaction for atomic restitution.
   * Otherwise, it performs an off-chain resolution (policy update only).
   *
   * @param claimId - The claim to resolve
   * @returns Updated claim with resolution details
   */
  async resolveClaim(claimId: string): Promise<Claim> {
    return this.telemetry.wrapAsync(
      "claims.resolveClaim",
      async () => {
        const claim = this.claims.get(claimId);
        if (!claim) {
          throw new ValidationError("Claim not found", { claimId });
        }
        if (claim.status !== "filed") {
          throw new ValidationError(
            `Cannot resolve claim in '${claim.status}' status`,
            { claimId, status: claim.status },
          );
        }

        // Transition to resolving
        claim.status = "resolving";
        this.addAuditEntry(claim, "resolution_started", "system", {});

        // Calculate replacement amount
        const replacementKg = Math.round(
          claim.estimatedLossPercentage / 100 * this.getOriginalAmountKg(claim),
        );

        // Reserve from buffer pool
        const reservation = this.insurance.reserveFromBufferPool(replacementKg / 1000);

        if (!reservation) {
          // Buffer pool insufficient — escalate
          claim.status = "escalated";
          this.addAuditEntry(claim, "escalated_buffer_insufficient", "system", {
            requiredTonnes: replacementKg / 1000,
          });
          return { ...claim, auditTrail: [...claim.auditTrail] };
        }

        // Try on-chain resolution if signer available
        let txHash: string | null = null;
        let onChainClaimId: number | null = null;

        if (this.config.signer) {
          try {
            const result = await this.executeOnChainResolution(
              claim,
              reservation.tokenId,
              BigInt(replacementKg),
            );
            txHash = result.txHash;
            onChainClaimId = result.onChainClaimId;
          } catch (error) {
            // On-chain failed — fall back to off-chain resolution
            this.addAuditEntry(claim, "on_chain_failed", "system", {
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }

        // Mark resolved
        claim.status = "resolved";
        claim.resolvedAt = Date.now();
        claim.replacementTokenId = reservation.tokenId;
        claim.replacedKg = replacementKg;
        claim.txHash = txHash;
        claim.onChainClaimId = onChainClaimId;

        this.addAuditEntry(claim, "resolved", "system", {
          replacementTokenId: reservation.tokenId,
          replacedKg: replacementKg,
          txHash,
          onChainClaimId,
        });

        // Update insurance policy
        try {
          this.insurance.resolveClaim(claim.policyId, reservation.tokenId);
        } catch {
          // Policy may have been modified
        }

        return { ...claim, auditTrail: [...claim.auditTrail] };
      },
      { claimId },
    );
  }

  /**
   * Resolve all pending claims in a batch.
   *
   * Executes sequentially to avoid nonce conflicts on-chain.
   *
   * @param claimIds - Array of claim IDs to resolve
   * @returns Batch resolution results
   */
  async resolveAllClaims(claimIds: string[]): Promise<BatchResolutionResult> {
    return this.telemetry.wrapAsync(
      "claims.resolveAllClaims",
      async () => {
        if (claimIds.length === 0) {
          throw new ValidationError("At least one claim ID is required", {});
        }

        const results: BatchResolutionResult["results"] = [];
        let totalReplacedKg = 0;

        // Sequential to avoid nonce conflicts
        for (const claimId of claimIds) {
          try {
            const resolved = await this.resolveClaim(claimId);
            results.push({
              claimId,
              success: resolved.status === "resolved",
              txHash: resolved.txHash ?? undefined,
              replacementTokenId: resolved.replacementTokenId ?? undefined,
            });
            totalReplacedKg += resolved.replacedKg;
          } catch (error) {
            results.push({
              claimId,
              success: false,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }

        return {
          results,
          successCount: results.filter((r) => r.success).length,
          failCount: results.filter((r) => !r.success).length,
          totalReplacedKg,
        };
      },
      { count: claimIds.length },
    );
  }

  // ============================================
  // Dashboard & Analytics
  // ============================================

  /**
   * Get claims dashboard analytics.
   *
   * @returns Comprehensive claims statistics
   */
  getDashboard(): ClaimsDashboard {
    const allClaims = Array.from(this.claims.values());

    // Status distribution
    const byStatus: Record<ClaimStatus, number> = {
      filed: 0,
      resolving: 0,
      resolved: 0,
      rejected: 0,
      partial: 0,
      escalated: 0,
    };
    for (const claim of allClaims) {
      byStatus[claim.status]++;
    }

    // Severity distribution
    const bySeverity: Record<ClaimSeverity, number> = {
      total: 0,
      critical: 0,
      partial: 0,
      minor: 0,
    };
    for (const claim of allClaims) {
      bySeverity[claim.severity]++;
    }

    // Total replaced
    const totalReplacedKg = allClaims
      .filter((c) => c.status === "resolved")
      .reduce((sum, c) => sum + c.replacedKg, 0);

    // Average resolution time
    const resolvedClaims = allClaims.filter(
      (c): c is Claim & { resolvedAt: number } =>
        c.status === "resolved" && typeof c.resolvedAt === "number",
    );
    const avgResolutionTime = resolvedClaims.length > 0
      ? resolvedClaims.reduce(
          (sum, c) => sum + (c.resolvedAt - c.filedAt),
          0,
        ) / resolvedClaims.length
      : 0;

    // Resolution success rate
    const attemptedResolutions = allClaims.filter(
      (c) => c.status === "resolved" || c.status === "escalated" || c.status === "partial",
    );
    const successRate = attemptedResolutions.length > 0
      ? resolvedClaims.length / attemptedResolutions.length
      : 0;

    // DAC units with active claims
    const activeClaimDacUnits = new Set<string>();
    for (const claim of allClaims) {
      if (claim.status === "filed" || claim.status === "resolving") {
        activeClaimDacUnits.add(claim.dacUnitId);
      }
    }

    return {
      totalClaims: allClaims.length,
      byStatus,
      bySeverity,
      totalReplacedKg,
      averageResolutionTimeMs: Math.round(avgResolutionTime),
      resolutionSuccessRate: Math.round(successRate * 1000) / 1000,
      dacUnitsWithActiveClaims: Array.from(activeClaimDacUnits),
      generatedAt: Date.now(),
    };
  }

  /**
   * List all claims for a specific DAC unit.
   *
   * @param dacUnitId - The DAC unit to query
   * @returns All claims associated with the unit
   */
  getClaimsByDacUnit(dacUnitId: string): Claim[] {
    const claimIds = this.dacUnitClaimIndex.get(dacUnitId);
    if (!claimIds) return [];

    return Array.from(claimIds)
      .map((id) => this.claims.get(id))
      .filter((c): c is Claim => c !== undefined)
      .map((c) => ({ ...c, auditTrail: [...c.auditTrail] }));
  }

  // ============================================
  // Private Helpers
  // ============================================

  private fileClaimInternal(input: FileClaimInput): Claim {
    // ---- Validate ----
    if (!input.policyId || input.policyId.trim().length === 0) {
      throw new ValidationError("policyId is required", {});
    }
    if (!input.reason || input.reason.trim().length === 0) {
      throw new ValidationError("reason is required", {});
    }
    if (input.estimatedLossPercentage < 0 || input.estimatedLossPercentage > 100) {
      throw new ValidationError(
        "estimatedLossPercentage must be between 0 and 100",
        { value: input.estimatedLossPercentage },
      );
    }

    // Check for existing claim on this policy
    if (this.policyClaimIndex.has(input.policyId)) {
      throw new ValidationError(
        "A claim already exists for this policy",
        { policyId: input.policyId, existingClaimId: this.policyClaimIndex.get(input.policyId) },
      );
    }

    // ---- Get Policy (validates it exists and is claimable) ----
    const policy = this.insurance.fileClaim(input.policyId, input.reason);

    // ---- Create Claim Record ----
    const claimId = `tqc_${ethers.hexlify(ethers.randomBytes(16)).slice(2)}`;
    const now = Date.now();

    const claim: Claim = {
      id: claimId,
      policyId: input.policyId,
      dacUnitId: policy.dacUnitId,
      status: "filed",
      severity: input.severity,
      estimatedLossPercentage: input.estimatedLossPercentage,
      replacedKg: 0,
      originalTokenId: policy.tokenId,
      replacementTokenId: null,
      buyerAddress: policy.buyerAddress,
      reason: input.reason,
      txHash: null,
      onChainClaimId: null,
      filedAt: now,
      resolvedAt: null,
      evidence: input.evidence ?? {},
      auditTrail: [
        {
          timestamp: now,
          action: "claim_filed",
          actor: "system",
          details: {
            severity: input.severity,
            estimatedLossPercentage: input.estimatedLossPercentage,
            reason: input.reason,
          },
        },
      ],
    };

    // ---- Store & Index ----
    this.claims.set(claimId, claim);
    this.policyClaimIndex.set(input.policyId, claimId);

    if (!this.dacUnitClaimIndex.has(policy.dacUnitId)) {
      this.dacUnitClaimIndex.set(policy.dacUnitId, new Set());
    }
    const claimIds = this.dacUnitClaimIndex.get(policy.dacUnitId);
    if (claimIds) {
      claimIds.add(claimId);
    }

    return { ...claim, auditTrail: [...claim.auditTrail] };
  }

  private classifySeverity(healthScore: number): ClaimSeverity {
    for (const { maxScore, severity } of SEVERITY_THRESHOLDS) {
      if (healthScore <= maxScore) return severity;
    }
    return "minor";
  }

  private getOriginalAmountKg(claim: Claim): number {
    try {
      const policy = this.insurance.getPolicy(claim.policyId);
      return policy.amountKg;
    } catch {
      return 0;
    }
  }

  private addAuditEntry(
    claim: Claim,
    action: string,
    actor: string,
    details: Record<string, unknown>,
  ): void {
    claim.auditTrail.push({
      timestamp: Date.now(),
      action,
      actor,
      details,
    });
  }

  /**
   * Execute an on-chain resolution via ClaimsManager.sol.
   *
   * @param claim - The claim being resolved
   * @param replacementTokenId - Token ID from buffer pool
   * @param amountKg - Amount to replace (as bigint for contract)
   * @returns Transaction hash and on-chain claim ID
   */
  private async executeOnChainResolution(
    claim: Claim,
    replacementTokenId: string,
    amountKg: bigint,
  ): Promise<{ txHash: string; onChainClaimId: number }> {
    const signer = this.config.signer;
    if (!signer) {
      throw new ValidationError("Signer is required for on-chain claim resolution", {});
    }

    const claimsAddress = this.resolveClaimsManagerAddress();
    const claimsManager = new ethers.Contract(
      claimsAddress,
      CLAIMS_MANAGER_ABI,
      signer,
    );

    try {
      const resolveFn = claimsManager.getFunction("resolveReversal");
      const tx = await resolveFn(
        BigInt(claim.originalTokenId),
        BigInt(replacementTokenId),
        amountKg,
        claim.buyerAddress,
        `Automated Restitution: ${claim.reason}`,
      );

      const receipt = await tx.wait(2);

      // Get the new claim ID from the contract
      const nextClaimIdFn = claimsManager.getFunction("nextClaimId");
      const nextClaimId = await withRetry(
        () => nextClaimIdFn(),
        this.config.retry,
      );

      return {
        txHash: receipt.hash as string,
        onChainClaimId: Number(nextClaimId) - 1,
      };
    } catch (error) {
      throw TerraQuraError.fromContractRevert(error);
    }
  }

  /**
   * Resolve the ClaimsManager contract address.
   */
  private resolveClaimsManagerAddress(): string {
    const addr = (this.config as unknown as Record<string, unknown>)["claimsManagerAddress"] as string | undefined;
    if (addr && ethers.isAddress(addr)) {
      return addr;
    }

    throw new ValidationError(
      "ClaimsManager address not configured. Set `claimsManagerAddress` in client config or deploy ClaimsManager.sol.",
      { network: this.config.network },
    );
  }
}
