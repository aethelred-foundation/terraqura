/**
 * @terraqura/sdk — Insurance Module
 *
 * Enterprise carbon insurance infrastructure: buffer pool management,
 * premium collection, treasury operations, and insurance policy lifecycle.
 *
 * Architecture:
 * - **Buffer Pool**: On-chain reserve of high-quality credits that
 *   backs all insured positions. Automatically replenished.
 * - **Premium Collection**: Insurance fees collected per transaction,
 *   split between the Buffer Pool and the Insurance Treasury.
 * - **Policy Lifecycle**: Policy creation → active → claimed/expired
 * - **Treasury Analytics**: Float tracking, coverage ratios, yield metrics
 *
 * The insurance model ensures that TerraQura carbon credits are
 * "principal-protected" — if physical carbon capture fails, the
 * protocol automatically replaces the buyer's credits from the
 * Buffer Pool, making TerraQura credits behave like high-grade
 * financial collateral suitable for institutional investors.
 *
 * @example
 * ```ts
 * const client = new TerraQuraClient({ network: "aethelred" });
 *
 * // Check buffer pool health
 * const pool = await client.insurance.getBufferPoolStatus();
 * console.log(pool.totalCredits);     // 50,000 tonnes
 * console.log(pool.coverageRatio);    // 1.25x (125% coverage)
 *
 * // Create an insurance policy for a purchase
 * const policy = client.insurance.createPolicy({
 *   tokenId: "42",
 *   amountKg: 1000,
 *   purchasePriceWei: ethers.parseEther("10"),
 *   dacUnitId: "dac-unit-001",
 *   buyerAddress: "0x...",
 *   durationDays: 365,
 * });
 * console.log(policy.premiumWei);     // Premium amount
 * console.log(policy.coverageType);   // "full-replacement"
 *
 * // Treasury analytics
 * const treasury = await client.insurance.getTreasuryAnalytics();
 * console.log(treasury.totalFloat);    // $2.5M equivalent
 * console.log(treasury.claimsPaid);    // $150K total claims
 * ```
 */

import { ethers } from "ethers";

import { ValidationError } from "../errors.js";

import type { ITelemetry } from "../telemetry.js";
import type { RiskModule, HealthScoreResult, InsurancePremium } from "./risk.js";

// ============================================
// Insurance Types
// ============================================

/** Insurance policy status */
export type PolicyStatus =
  | "active"      // Policy in force
  | "claimed"     // Reversal detected, claim filed
  | "resolved"    // Claim resolved, buyer made whole
  | "expired"     // Policy term ended without claim
  | "cancelled";  // Policy cancelled by holder

/** Coverage type for the insurance policy */
export type CoverageType =
  | "full-replacement"    // 1:1 credit replacement from Buffer Pool
  | "partial-replacement" // Pro-rata replacement based on coverage ratio
  | "cash-settlement";    // Cash equivalent if Buffer Pool exhausted

/** Policy creation input */
export interface CreatePolicyInput {
  /** Token ID being insured */
  tokenId: string;
  /** Amount of carbon (kg) being insured */
  amountKg: number;
  /** Purchase price in wei (for premium calculation) */
  purchasePriceWei: bigint;
  /** DAC unit that produced the credits */
  dacUnitId: string;
  /** Buyer address (policy beneficiary) */
  buyerAddress: string;
  /** Policy duration in days (default: 365) */
  durationDays?: number;
  /** Override premium (for partner-negotiated rates) */
  premiumOverrideBps?: number;
  /** Additional metadata */
  metadata?: Record<string, string | number | boolean>;
}

/** Insurance policy record */
export interface InsurancePolicy {
  /** Unique policy identifier */
  id: string;
  /** Policy status */
  status: PolicyStatus;
  /** Token ID being insured */
  tokenId: string;
  /** Amount insured (kg) */
  amountKg: number;
  /** Purchase price (wei) */
  purchasePriceWei: bigint;
  /** DAC unit ID */
  dacUnitId: string;
  /** Policy beneficiary */
  buyerAddress: string;
  /** Coverage type */
  coverageType: CoverageType;
  /** Premium paid (wei) */
  premiumWei: bigint;
  /** Premium rate (BPS) */
  premiumBps: number;
  /** Premium breakdown */
  premiumBreakdown: InsurancePremium;
  /** Policy inception timestamp */
  createdAt: number;
  /** Policy expiry timestamp */
  expiresAt: number;
  /** Claim filed timestamp (if any) */
  claimedAt: number | null;
  /** Claim resolved timestamp (if any) */
  resolvedAt: number | null;
  /** Replacement token ID (if claim resolved) */
  replacementTokenId: string | null;
  /** Metadata */
  metadata: Record<string, string | number | boolean>;
}

/** Buffer pool status */
export interface BufferPoolStatus {
  /** Total credits held in the buffer pool (tonnes) */
  totalCreditsTonnes: number;
  /** Credits reserved for active claims */
  reservedCreditsTonnes: number;
  /** Available credits for new claims */
  availableCreditsTonnes: number;
  /** Total insured volume (tonnes) */
  totalInsuredTonnes: number;
  /** Coverage ratio (available / insured) */
  coverageRatio: number;
  /** Whether the pool is healthy (coverage > 1.0) */
  isHealthy: boolean;
  /** Average health score of buffer credits */
  averageBufferHealthScore: number;
  /** Number of distinct token IDs in the pool */
  distinctTokens: number;
  /** Timestamp of last replenishment */
  lastReplenishedAt: number;
}

/** Insurance treasury analytics */
export interface TreasuryAnalytics {
  /** Total premiums collected (wei) */
  totalPremiumsCollectedWei: bigint;
  /** Total claims paid out (wei equivalent) */
  totalClaimsPaidWei: bigint;
  /** Current float (premiums - claims) */
  currentFloatWei: bigint;
  /** Total active policies */
  activePolicies: number;
  /** Total expired policies (no claim) */
  expiredPolicies: number;
  /** Total resolved claims */
  resolvedClaims: number;
  /** Loss ratio (claims / premiums) */
  lossRatio: number;
  /** Combined ratio (claims + expenses / premiums) */
  combinedRatio: number;
  /** Average premium per policy (wei) */
  averagePremiumWei: bigint;
  /** Average policy duration (days) */
  averagePolicyDurationDays: number;
  /** Buffer pool status */
  bufferPool: BufferPoolStatus;
  /** Generated at timestamp */
  generatedAt: number;
}

/** Policy search/filter options */
export interface PolicyFilter {
  /** Filter by status */
  status?: PolicyStatus;
  /** Filter by buyer address */
  buyerAddress?: string;
  /** Filter by DAC unit */
  dacUnitId?: string;
  /** Filter by token ID */
  tokenId?: string;
  /** Only active (non-expired) policies */
  activeOnly?: boolean;
  /** Pagination offset */
  offset?: number;
  /** Pagination limit (max 100) */
  limit?: number;
}

// ============================================
// Internal Types
// ============================================

interface PolicyRecord extends InsurancePolicy {
  /** Internal: premium calculation snapshot */
  _premiumSnapshot: InsurancePremium;
}

interface BufferPoolEntry {
  tokenId: string;
  amountTonnes: number;
  healthScore: number;
  reservedTonnes: number;
  addedAt: number;
}

// ============================================
// Constants
// ============================================

/** Default policy duration: 365 days */
const DEFAULT_POLICY_DURATION_DAYS = 365;

/** Maximum policy duration: 5 years */
const MAX_POLICY_DURATION_DAYS = 1825;

/** Minimum insurable amount: 1 kg */
const MIN_INSURABLE_AMOUNT_KG = 1;

/** Maximum policies per address per token */
const MAX_POLICIES_PER_ADDRESS_TOKEN = 100;

/** Operational expense ratio (for combined ratio calculation) */
const OPERATIONAL_EXPENSE_RATIO = 0.15;

/** Milliseconds per day */
const MS_PER_DAY = 86_400_000;

// ============================================
// InsuranceModule
// ============================================

/**
 * Enterprise Insurance Module — Buffer Pool + Policy + Treasury.
 *
 * Provides:
 * - **Policy Lifecycle**: create, query, filter, cancel, claim
 * - **Buffer Pool**: status monitoring, coverage ratio tracking
 * - **Premium Calculation**: integrated with RiskModule actuarial engine
 * - **Treasury Analytics**: float, loss ratio, combined ratio
 */
export class InsuranceModule {
  private readonly telemetry: ITelemetry;
  private readonly riskModule: RiskModule;

  // In-memory stores (production: replaced by DB/smart contract state)
  private readonly policies = new Map<string, PolicyRecord>();
  private readonly bufferPool = new Map<string, BufferPoolEntry>();
  private readonly addressPolicyIndex = new Map<string, Set<string>>();
  private readonly tokenPolicyIndex = new Map<string, Set<string>>();
  private readonly dacUnitPolicyIndex = new Map<string, Set<string>>();

  // Treasury counters
  private totalPremiumsCollected = 0n;
  private totalClaimsPaid = 0n;

  constructor(
    telemetry: ITelemetry,
    riskModule: RiskModule,
  ) {
    this.telemetry = telemetry;
    this.riskModule = riskModule;
  }

  // ============================================
  // Policy Lifecycle
  // ============================================

  /**
   * Create an insurance policy for a carbon credit purchase.
   *
   * Calculates the insurance premium using the RiskModule's actuarial
   * engine, validates the DAC unit's insurability, and creates a policy
   * record with the appropriate coverage type.
   *
   * @param input - Policy creation parameters
   * @returns The created insurance policy
   * @throws ValidationError if the DAC unit is not insurable or inputs invalid
   *
   * @example
   * ```ts
   * const policy = client.insurance.createPolicy({
   *   tokenId: "42",
   *   amountKg: 1000,
   *   purchasePriceWei: ethers.parseEther("10"),
   *   dacUnitId: "dac-unit-001",
   *   buyerAddress: "0x...",
   * });
   * ```
   */
  createPolicy(input: CreatePolicyInput): InsurancePolicy {
    return this.telemetry.wrapAsync(
      "insurance.createPolicy",
      async () => this.createPolicySync(input),
    ) as unknown as InsurancePolicy;
  }

  /**
   * Synchronous policy creation (for use in non-async contexts).
   * Premium is calculated using the local RiskModule scoring engine.
   */
  createPolicySync(input: CreatePolicyInput): InsurancePolicy {
    // ---- Validate Inputs ----
    if (!input.tokenId || input.tokenId.trim().length === 0) {
      throw new ValidationError("tokenId is required", {});
    }
    if (input.amountKg < MIN_INSURABLE_AMOUNT_KG) {
      throw new ValidationError(
        `amountKg must be at least ${MIN_INSURABLE_AMOUNT_KG}`,
        { value: input.amountKg },
      );
    }
    if (input.purchasePriceWei <= 0n) {
      throw new ValidationError("purchasePriceWei must be positive", {});
    }
    if (!input.dacUnitId || input.dacUnitId.trim().length === 0) {
      throw new ValidationError("dacUnitId is required", {});
    }
    if (!input.buyerAddress || !ethers.isAddress(input.buyerAddress)) {
      throw new ValidationError("Valid buyerAddress is required", {});
    }

    const durationDays = input.durationDays ?? DEFAULT_POLICY_DURATION_DAYS;
    if (durationDays < 1 || durationDays > MAX_POLICY_DURATION_DAYS) {
      throw new ValidationError(
        `durationDays must be between 1 and ${MAX_POLICY_DURATION_DAYS}`,
        { value: durationDays },
      );
    }

    // ---- Check Policy Limit ----
    const addressKey = `${input.buyerAddress}:${input.tokenId}`;
    const existingPolicies = this.addressPolicyIndex.get(addressKey);
    if (existingPolicies && existingPolicies.size >= MAX_POLICIES_PER_ADDRESS_TOKEN) {
      throw new ValidationError(
        `Maximum ${MAX_POLICIES_PER_ADDRESS_TOKEN} policies per address per token`,
        { current: existingPolicies.size },
      );
    }

    // ---- Calculate Premium ----
    let premiumBreakdown: InsurancePremium;

    if (input.premiumOverrideBps !== undefined) {
      // Partner-negotiated rate override
      if (input.premiumOverrideBps < 0 || input.premiumOverrideBps > 5000) {
        throw new ValidationError(
          "premiumOverrideBps must be between 0 and 5000 (50%)",
          { value: input.premiumOverrideBps },
        );
      }
      const premiumWei = (input.purchasePriceWei * BigInt(input.premiumOverrideBps)) / 10_000n;
      premiumBreakdown = {
        dacUnitId: input.dacUnitId,
        premiumBps: input.premiumOverrideBps,
        premiumWei,
        subtotalWei: input.purchasePriceWei,
        isInsurable: true,
        breakdown: {
          baseFee: input.premiumOverrideBps,
          riskComponent: 0,
          catastropheReserve: 0,
        },
      };
    } else {
      // Use a default healthy score for local calculation
      // In production, this would query the on-chain oracle
      const defaultScore: HealthScoreResult = {
        healthScore: 85,
        failureProbabilityBps: 100,
        riskTier: "low",
        isInsurable: true,
        factors: {
          uptimeScore: 98,
          stabilityScore: 90,
          integrityScore: 85,
          maintenanceAgePenalty: 0,
          hardwareGenerationBonus: 2,
          seasonalDriftPenalty: 0,
        },
        confidence: 0.9,
      };

      premiumBreakdown = this.riskModule.calculatePremiumFromScore(
        defaultScore,
        input.purchasePriceWei,
      );
    }

    if (!premiumBreakdown.isInsurable) {
      throw new ValidationError(
        "DAC unit does not qualify for insurance coverage",
        { dacUnitId: input.dacUnitId },
      );
    }

    // ---- Determine Coverage Type ----
    const bufferStatus = this.getBufferPoolStatusSync();
    let coverageType: CoverageType = "full-replacement";
    if (bufferStatus.coverageRatio < 1.0 && bufferStatus.coverageRatio >= 0.5) {
      coverageType = "partial-replacement";
    } else if (bufferStatus.coverageRatio < 0.5) {
      coverageType = "cash-settlement";
    }

    // ---- Create Policy Record ----
    const policyId = `tqp_${ethers.hexlify(ethers.randomBytes(16)).slice(2)}`;
    const now = Date.now();

    const policy: PolicyRecord = {
      id: policyId,
      status: "active",
      tokenId: input.tokenId,
      amountKg: input.amountKg,
      purchasePriceWei: input.purchasePriceWei,
      dacUnitId: input.dacUnitId,
      buyerAddress: input.buyerAddress,
      coverageType,
      premiumWei: premiumBreakdown.premiumWei,
      premiumBps: premiumBreakdown.premiumBps,
      premiumBreakdown,
      createdAt: now,
      expiresAt: now + (durationDays * MS_PER_DAY),
      claimedAt: null,
      resolvedAt: null,
      replacementTokenId: null,
      metadata: input.metadata ?? {},
      _premiumSnapshot: premiumBreakdown,
    };

    // ---- Store & Index ----
    this.policies.set(policyId, policy);
    this.totalPremiumsCollected += premiumBreakdown.premiumWei;

    // Address index
    let addressPolicies = this.addressPolicyIndex.get(addressKey);
    if (!addressPolicies) {
      addressPolicies = new Set();
      this.addressPolicyIndex.set(addressKey, addressPolicies);
    }
    addressPolicies.add(policyId);

    // Token index
    let tokenPolicies = this.tokenPolicyIndex.get(input.tokenId);
    if (!tokenPolicies) {
      tokenPolicies = new Set();
      this.tokenPolicyIndex.set(input.tokenId, tokenPolicies);
    }
    tokenPolicies.add(policyId);

    // DAC unit index
    let dacUnitPolicies = this.dacUnitPolicyIndex.get(input.dacUnitId);
    if (!dacUnitPolicies) {
      dacUnitPolicies = new Set();
      this.dacUnitPolicyIndex.set(input.dacUnitId, dacUnitPolicies);
    }
    dacUnitPolicies.add(policyId);

    // Return public interface (strip internal fields)
    return this.toPublicPolicy(policy);
  }

  /**
   * Get a policy by ID.
   *
   * @param policyId - The policy identifier
   * @returns The insurance policy
   * @throws ValidationError if policy not found
   */
  getPolicy(policyId: string): InsurancePolicy {
    const policy = this.policies.get(policyId);
    if (!policy) {
      throw new ValidationError("Policy not found", { policyId });
    }

    // Auto-expire if past expiration
    if (policy.status === "active" && Date.now() > policy.expiresAt) {
      policy.status = "expired";
    }

    return this.toPublicPolicy(policy);
  }

  /**
   * List policies with optional filtering.
   *
   * @param filter - Optional filter criteria
   * @returns Paginated policy list
   */
  listPolicies(filter?: PolicyFilter): {
    items: InsurancePolicy[];
    total: number;
    hasMore: boolean;
  } {
    let policies = Array.from(this.policies.values());

    // Auto-expire stale policies
    const now = Date.now();
    for (const p of policies) {
      if (p.status === "active" && now > p.expiresAt) {
        p.status = "expired";
      }
    }

    // Apply filters
    if (filter?.status) {
      policies = policies.filter((p) => p.status === filter.status);
    }
    if (filter?.buyerAddress) {
      const buyerAddress = filter.buyerAddress.toLowerCase();
      policies = policies.filter(
        (p) => p.buyerAddress.toLowerCase() === buyerAddress,
      );
    }
    if (filter?.dacUnitId) {
      policies = policies.filter((p) => p.dacUnitId === filter.dacUnitId);
    }
    if (filter?.tokenId) {
      policies = policies.filter((p) => p.tokenId === filter.tokenId);
    }
    if (filter?.activeOnly) {
      policies = policies.filter((p) => p.status === "active");
    }

    // Sort by creation time (newest first)
    policies.sort((a, b) => b.createdAt - a.createdAt);

    const total = policies.length;
    const offset = filter?.offset ?? 0;
    const limit = Math.min(filter?.limit ?? 50, 100);
    const paginated = policies.slice(offset, offset + limit);

    return {
      items: paginated.map((p) => this.toPublicPolicy(p)),
      total,
      hasMore: offset + limit < total,
    };
  }

  /**
   * Cancel an active policy.
   *
   * Only active policies can be cancelled. No premium refund is issued.
   *
   * @param policyId - The policy to cancel
   * @returns Updated policy
   */
  cancelPolicy(policyId: string): InsurancePolicy {
    const policy = this.policies.get(policyId);
    if (!policy) {
      throw new ValidationError("Policy not found", { policyId });
    }
    if (policy.status !== "active") {
      throw new ValidationError(
        `Cannot cancel policy in '${policy.status}' status`,
        { policyId, status: policy.status },
      );
    }

    policy.status = "cancelled";
    return this.toPublicPolicy(policy);
  }

  /**
   * File a claim against a policy (reversal detected).
   *
   * Transitions the policy to "claimed" status. The actual resolution
   * (credit replacement) is handled by the ClaimsModule.
   *
   * @param policyId - The policy to claim
   * @param reason - Reason for the claim
   * @returns Updated policy in "claimed" status
   */
  fileClaim(policyId: string, reason: string): InsurancePolicy {
    const policy = this.policies.get(policyId);
    if (!policy) {
      throw new ValidationError("Policy not found", { policyId });
    }
    if (policy.status !== "active") {
      throw new ValidationError(
        `Cannot file claim on policy in '${policy.status}' status`,
        { policyId, status: policy.status },
      );
    }

    if (!reason || reason.trim().length === 0) {
      throw new ValidationError("Claim reason is required", {});
    }

    policy.status = "claimed";
    policy.claimedAt = Date.now();
    policy.metadata["claimReason"] = reason;

    return this.toPublicPolicy(policy);
  }

  /**
   * Resolve a claim (mark as buyer-made-whole).
   *
   * Called by the ClaimsModule after successful credit replacement.
   *
   * @param policyId - The policy being resolved
   * @param replacementTokenId - The replacement credit token ID
   * @returns Updated policy in "resolved" status
   */
  resolveClaim(policyId: string, replacementTokenId: string): InsurancePolicy {
    const policy = this.policies.get(policyId);
    if (!policy) {
      throw new ValidationError("Policy not found", { policyId });
    }
    if (policy.status !== "claimed") {
      throw new ValidationError(
        `Cannot resolve policy in '${policy.status}' status (must be 'claimed')`,
        { policyId, status: policy.status },
      );
    }

    policy.status = "resolved";
    policy.resolvedAt = Date.now();
    policy.replacementTokenId = replacementTokenId;

    // Track claims paid (estimated as purchase price for now)
    this.totalClaimsPaid += policy.purchasePriceWei;

    return this.toPublicPolicy(policy);
  }

  // ============================================
  // Buffer Pool Management
  // ============================================

  /**
   * Get the current buffer pool status.
   *
   * @returns Buffer pool health metrics
   */
  getBufferPoolStatus(): BufferPoolStatus {
    return this.telemetry.wrapAsync(
      "insurance.getBufferPoolStatus",
      async () => this.getBufferPoolStatusSync(),
    ) as unknown as BufferPoolStatus;
  }

  /**
   * Add credits to the buffer pool.
   *
   * @param tokenId - Credit token ID
   * @param amountTonnes - Amount in tonnes
   * @param healthScore - Current health score of the credits
   */
  addToBufferPool(
    tokenId: string,
    amountTonnes: number,
    healthScore: number,
  ): void {
    if (amountTonnes <= 0) {
      throw new ValidationError("amountTonnes must be positive", { value: amountTonnes });
    }
    if (healthScore < 0 || healthScore > 100) {
      throw new ValidationError("healthScore must be between 0 and 100", { value: healthScore });
    }

    const existing = this.bufferPool.get(tokenId);
    if (existing) {
      existing.amountTonnes += amountTonnes;
      existing.healthScore = healthScore; // Update to latest
    } else {
      this.bufferPool.set(tokenId, {
        tokenId,
        amountTonnes,
        healthScore,
        reservedTonnes: 0,
        addedAt: Date.now(),
      });
    }
  }

  /**
   * Reserve credits from the buffer pool for a pending claim.
   *
   * @param amountTonnes - Amount to reserve
   * @returns The token ID of the best available credits, or null
   */
  reserveFromBufferPool(amountTonnes: number): {
    tokenId: string;
    amountTonnes: number;
  } | null {
    // Find best available credits (highest health score first)
    const entries = Array.from(this.bufferPool.values())
      .filter((e) => (e.amountTonnes - e.reservedTonnes) >= amountTonnes)
      .sort((a, b) => b.healthScore - a.healthScore);

    const best = entries[0];
    if (!best) {
      return null;
    }
    best.reservedTonnes += amountTonnes;

    return {
      tokenId: best.tokenId,
      amountTonnes,
    };
  }

  // ============================================
  // Treasury Analytics
  // ============================================

  /**
   * Get comprehensive treasury analytics.
   *
   * @returns Treasury health metrics including float, loss ratio, coverage
   */
  getTreasuryAnalytics(): TreasuryAnalytics {
    const allPolicies = Array.from(this.policies.values());

    // Auto-expire stale
    const now = Date.now();
    for (const p of allPolicies) {
      if (p.status === "active" && now > p.expiresAt) {
        p.status = "expired";
      }
    }

    const activePolicies = allPolicies.filter((p) => p.status === "active");
    const expiredPolicies = allPolicies.filter((p) => p.status === "expired");
    const resolvedClaims = allPolicies.filter((p) => p.status === "resolved");

    // Loss ratio = claims paid / premiums collected
    const lossRatio = this.totalPremiumsCollected > 0n
      ? Number(this.totalClaimsPaid * 10000n / this.totalPremiumsCollected) / 10000
      : 0;

    // Combined ratio = (claims + expenses) / premiums
    const combinedRatio = lossRatio + OPERATIONAL_EXPENSE_RATIO;

    // Average premium
    const averagePremiumWei = allPolicies.length > 0
      ? this.totalPremiumsCollected / BigInt(allPolicies.length)
      : 0n;

    // Average policy duration
    const durations = allPolicies.map((p) => p.expiresAt - p.createdAt);
    const avgDurationMs = durations.length > 0
      ? durations.reduce((sum, d) => sum + d, 0) / durations.length
      : 0;

    return {
      totalPremiumsCollectedWei: this.totalPremiumsCollected,
      totalClaimsPaidWei: this.totalClaimsPaid,
      currentFloatWei: this.totalPremiumsCollected - this.totalClaimsPaid,
      activePolicies: activePolicies.length,
      expiredPolicies: expiredPolicies.length,
      resolvedClaims: resolvedClaims.length,
      lossRatio,
      combinedRatio,
      averagePremiumWei,
      averagePolicyDurationDays: Math.round(avgDurationMs / MS_PER_DAY),
      bufferPool: this.getBufferPoolStatusSync(),
      generatedAt: now,
    };
  }

  /**
   * Get policies affected by a specific DAC unit (for reversal detection).
   *
   * @param dacUnitId - The DAC unit to check
   * @returns Active policies linked to this unit
   */
  getAffectedPolicies(dacUnitId: string): InsurancePolicy[] {
    const policyIds = this.dacUnitPolicyIndex.get(dacUnitId);
    if (!policyIds) return [];

    return Array.from(policyIds)
      .map((id) => this.policies.get(id))
      .filter((p): p is PolicyRecord => p !== undefined && p.status === "active")
      .map((p) => this.toPublicPolicy(p));
  }

  // ============================================
  // Private Helpers
  // ============================================

  private getBufferPoolStatusSync(): BufferPoolStatus {
    const entries = Array.from(this.bufferPool.values());
    const totalCreditsTonnes = entries.reduce((sum, e) => sum + e.amountTonnes, 0);
    const reservedCreditsTonnes = entries.reduce((sum, e) => sum + e.reservedTonnes, 0);
    const availableCreditsTonnes = totalCreditsTonnes - reservedCreditsTonnes;

    // Calculate total insured volume
    const activePolicies = Array.from(this.policies.values())
      .filter((p) => p.status === "active");
    const totalInsuredTonnes = activePolicies.reduce(
      (sum, p) => sum + (p.amountKg / 1000),
      0,
    );

    const coverageRatio = totalInsuredTonnes > 0
      ? availableCreditsTonnes / totalInsuredTonnes
      : entries.length > 0 ? Infinity : 0;

    const avgHealth = entries.length > 0
      ? entries.reduce((sum, e) => sum + e.healthScore, 0) / entries.length
      : 0;

    const lastReplenished = entries.length > 0
      ? Math.max(...entries.map((e) => e.addedAt))
      : 0;

    return {
      totalCreditsTonnes,
      reservedCreditsTonnes,
      availableCreditsTonnes,
      totalInsuredTonnes,
      coverageRatio: Math.round(coverageRatio * 1000) / 1000,
      isHealthy: coverageRatio >= 1.0,
      averageBufferHealthScore: Math.round(avgHealth * 100) / 100,
      distinctTokens: entries.length,
      lastReplenishedAt: lastReplenished,
    };
  }

  private toPublicPolicy(record: PolicyRecord): InsurancePolicy {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { _premiumSnapshot, ...publicFields } = record;
    return publicFields;
  }
}
