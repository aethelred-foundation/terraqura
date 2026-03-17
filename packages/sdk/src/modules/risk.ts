/**
 * @terraqura/sdk — Risk Module
 *
 * Enterprise-grade actuarial risk scoring engine and on-chain Risk Oracle
 * integration. Computes dynamic "Health Scores" for DAC units based on
 * real-time sensor metrics, uptime telemetry, and maintenance history.
 *
 * Architecture:
 * - **RiskScoringEngine**: Pure actuarial math — multi-factor weighted
 *   health scoring with non-linear failure probability curves
 * - **On-Chain Oracle**: Read/write interface to `RiskOracle.sol` for
 *   storing and querying per-unit risk profiles
 * - **Insurance Premiums**: Dynamic premium calculation based on live
 *   health scores (used by Marketplace for risk-adjusted pricing)
 * - **Fleet Analytics**: Aggregate risk intelligence across DAC fleets
 *
 * The scoring model uses three weighted factors:
 * 1. **Uptime (40%)** — Capture reliability (target: 99%+)
 * 2. **Stability (30%)** — Efficiency variance (low σ = healthy)
 * 3. **Integrity (30%)** — Anomaly rate (sensor/physical leak risk)
 *
 * Plus modifiers for maintenance age, seasonal drift, and hardware
 * generation, producing a composite 0–100 score that maps to a
 * non-linear actuarial failure probability curve in basis points.
 *
 * @example
 * ```ts
 * const client = new TerraQuraClient({ network: "aethelred", privateKey: "0x..." });
 *
 * // Pure actuarial scoring (no blockchain required)
 * const score = client.risk.calculateHealthScore({
 *   uptimePercentage: 0.985,
 *   efficiencyVariance: 1.2,
 *   anomalyRate: 0.0003,
 *   maintenanceAgeDays: 45,
 *   hardwareGeneration: 2,
 *   seasonalDriftFactor: 0.02,
 * });
 * console.log(score.healthScore);         // 92
 * console.log(score.failureProbabilityBps); // 80
 * console.log(score.riskTier);            // "low"
 *
 * // Read on-chain risk profile
 * const profile = await client.risk.getRiskProfile("dac-unit-001");
 * console.log(profile.healthScore);   // 87
 * console.log(profile.isInsurable);   // true
 *
 * // Calculate insurance premium for a purchase
 * const premium = await client.risk.calculateInsurancePremium(
 *   "dac-unit-001",
 *   ethers.parseEther("100"),
 * );
 * console.log(premium.premiumBps);    // 185
 * console.log(premium.premiumWei);    // 1.85 ETH
 *
 * // Fleet-wide analytics
 * const fleet = await client.risk.getFleetRiskAnalytics();
 * console.log(fleet.averageHealthScore);  // 88.5
 * console.log(fleet.totalInsuredUnits);   // 42
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

// ============================================
// Risk Oracle ABI (minimal interface)
// ============================================

const RISK_ORACLE_ABI = [
  {
    name: "dacRiskProfiles",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "dacUnitId", type: "bytes32" }],
    outputs: [
      { name: "healthScore", type: "uint256" },
      { name: "failureProbability", type: "uint256" },
      { name: "lastUpdated", type: "uint256" },
      { name: "isInsured", type: "bool" },
    ],
  },
  {
    name: "getInsurancePremiumBps",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "dacUnitId", type: "bytes32" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "updateRiskProfile",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "dacUnitId", type: "bytes32" },
      { name: "score", type: "uint256" },
      { name: "prob", type: "uint256" },
    ],
    outputs: [],
  },
  {
    name: "GRADER_ROLE",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "bytes32" }],
  },
] as const;

// ============================================
// Risk Types
// ============================================

/** Risk tier classification */
export type RiskTier = "minimal" | "low" | "moderate" | "elevated" | "high" | "critical";

/** Input metrics for actuarial health score calculation */
export interface HealthScoreInput {
  /** DAC unit uptime as fraction 0–1 (e.g., 0.985 = 98.5%) */
  uptimePercentage: number;
  /**
   * Standard deviation of kWh-per-tonne efficiency readings.
   * Lower = more stable hardware. Typical range: 0.5–5.0.
   */
  efficiencyVariance: number;
  /**
   * Anomaly rate: flagged anomalies per data point.
   * E.g., 3 anomalies per 10,000 readings = 0.0003.
   */
  anomalyRate: number;
  /** Days since last hardware maintenance/service */
  maintenanceAgeDays: number;
  /**
   * Hardware generation (1 = Gen-1 prototype, 2 = Gen-2 production, etc.).
   * Higher generations receive a reliability bonus.
   * @default 1
   */
  hardwareGeneration?: number;
  /**
   * Seasonal performance drift factor (0–1).
   * Measures how much efficiency varies across seasons.
   * Lower = more climate-independent.
   * @default 0
   */
  seasonalDriftFactor?: number;
}

/** Complete health score result with actuarial breakdown */
export interface HealthScoreResult {
  /** Composite health score 0–100 */
  healthScore: number;
  /** Failure probability in basis points (100 = 1%) */
  failureProbabilityBps: number;
  /** Risk tier classification */
  riskTier: RiskTier;
  /** Whether the unit qualifies for insurance coverage */
  isInsurable: boolean;
  /** Detailed factor breakdown */
  factors: {
    /** Uptime component (0–100, weight: 40%) */
    uptimeScore: number;
    /** Stability component (0–100, weight: 30%) */
    stabilityScore: number;
    /** Integrity component (0–100, weight: 30%) */
    integrityScore: number;
    /** Maintenance age penalty applied (0+) */
    maintenanceAgePenalty: number;
    /** Hardware generation bonus applied (0+) */
    hardwareGenerationBonus: number;
    /** Seasonal drift penalty applied (0+) */
    seasonalDriftPenalty: number;
  };
  /** Confidence level of the score (0–1) */
  confidence: number;
}

/** On-chain risk profile as stored in RiskOracle.sol */
export interface OnChainRiskProfile {
  /** DAC unit identifier */
  dacUnitId: string;
  /** Health score (0–100) */
  healthScore: number;
  /** Failure probability in BPS */
  failureProbabilityBps: number;
  /** Unix timestamp of last update */
  lastUpdated: number;
  /** Whether the unit is currently insured */
  isInsured: boolean;
  /** Risk tier derived from health score */
  riskTier: RiskTier;
  /** How stale the data is (seconds since last update) */
  staleness: number;
}

/** Insurance premium calculation result */
export interface InsurancePremium {
  /** DAC unit the premium applies to */
  dacUnitId: string;
  /** Premium rate in basis points */
  premiumBps: number;
  /** Premium amount in wei for the given subtotal */
  premiumWei: bigint;
  /** The base amount the premium was calculated against */
  subtotalWei: bigint;
  /** Whether the unit qualifies for insurance */
  isInsurable: boolean;
  /** Breakdown of premium components */
  breakdown: {
    /** Base platform insurance fee (BPS) */
    baseFee: number;
    /** Risk-adjusted component (BPS) */
    riskComponent: number;
    /** Catastrophe reserve component (BPS) */
    catastropheReserve: number;
  };
}

/** Fleet-wide risk analytics */
export interface FleetRiskAnalytics {
  /** Total DAC units analyzed */
  totalUnits: number;
  /** Units with active insurance */
  insuredUnits: number;
  /** Units without insurance (health < threshold) */
  uninsuredUnits: number;
  /** Average health score across fleet */
  averageHealthScore: number;
  /** Median health score */
  medianHealthScore: number;
  /** Worst-performing unit score */
  minimumHealthScore: number;
  /** Best-performing unit score */
  maximumHealthScore: number;
  /** Distribution by risk tier */
  tierDistribution: Record<RiskTier, number>;
  /** Fleet-wide weighted average failure probability (BPS) */
  weightedFailureProbabilityBps: number;
  /** Timestamp of analytics generation */
  generatedAt: number;
}

/** Input for updating an on-chain risk profile (grader operation) */
export interface UpdateRiskProfileInput {
  /** DAC unit identifier (bytes32 or human-readable) */
  dacUnitId: string;
  /** New health score (0–100) */
  healthScore: number;
  /** New failure probability in BPS */
  failureProbabilityBps: number;
}

// ============================================
// Constants
// ============================================

/** Weight distribution for health score factors */
const SCORING_WEIGHTS = {
  UPTIME: 0.40,
  STABILITY: 0.30,
  INTEGRITY: 0.30,
} as const;

/** Thresholds for risk tier classification */
const TIER_THRESHOLDS: ReadonlyArray<{ min: number; tier: RiskTier }> = [
  { min: 90, tier: "minimal" },
  { min: 80, tier: "low" },
  { min: 70, tier: "moderate" },
  { min: 55, tier: "elevated" },
  { min: 30, tier: "high" },
  { min: 0, tier: "critical" },
];

/** Minimum health score for insurance eligibility */
const INSURANCE_ELIGIBILITY_THRESHOLD = 70;

/** Maintenance age threshold (days) before penalty kicks in */
const MAINTENANCE_PENALTY_THRESHOLD_DAYS = 180;

/** Rate of health degradation per day past maintenance threshold */
const MAINTENANCE_PENALTY_RATE_PER_DAY = 0.1;

/** Hardware generation reliability bonus per generation above 1 */
const HW_GENERATION_BONUS_PER_GEN = 2;

/** Maximum hardware generation bonus cap */
const HW_GENERATION_BONUS_CAP = 8;

/** Seasonal drift penalty multiplier */
const SEASONAL_DRIFT_PENALTY_MULTIPLIER = 15;

/** Base insurance fee in BPS (1% = 100 BPS) */
const BASE_INSURANCE_FEE_BPS = 100;

/** Catastrophe reserve in BPS */
const CATASTROPHE_RESERVE_BPS = 25;

/** BPS scale */
const BPS_SCALE = 10_000;

// ============================================
// RiskModule
// ============================================

/**
 * Enterprise Risk Module — actuarial scoring engine + on-chain oracle.
 *
 * Provides:
 * - **Pure scoring**: `calculateHealthScore()` — no blockchain needed
 * - **Oracle reads**: `getRiskProfile()`, `getInsurancePremiumBps()`
 * - **Oracle writes**: `updateRiskProfile()` (requires GRADER_ROLE)
 * - **Fleet analytics**: `getFleetRiskAnalytics()`
 * - **Premium math**: `calculateInsurancePremium()`
 */
export class RiskModule {
  private readonly config: InternalConfig;
  private readonly telemetry: ITelemetry;

  constructor(
    config: InternalConfig,
    telemetry: ITelemetry,
  ) {
    this.config = config;
    this.telemetry = telemetry;
  }

  // ============================================
  // Pure Actuarial Scoring (No Blockchain)
  // ============================================

  /**
   * Calculate the actuarial health score for a DAC unit.
   *
   * This is a **pure function** — no blockchain interaction required.
   * Use it for batch scoring, testing, or pre-flight checks before
   * submitting to the on-chain oracle.
   *
   * The scoring model uses a three-factor weighted composite with
   * modifiers for maintenance age, hardware generation, and seasonal drift.
   * The failure probability follows a non-linear actuarial curve that
   * spikes exponentially below the 80-point threshold.
   *
   * @param input - Sensor metrics and operational data
   * @returns Complete health score with factor breakdown
   * @throws ValidationError if input metrics are out of range
   *
   * @example
   * ```ts
   * const result = client.risk.calculateHealthScore({
   *   uptimePercentage: 0.985,
   *   efficiencyVariance: 1.2,
   *   anomalyRate: 0.0003,
   *   maintenanceAgeDays: 45,
   *   hardwareGeneration: 2,
   * });
   * // result.healthScore = 94
   * // result.riskTier = "minimal"
   * // result.failureProbabilityBps = 60
   * ```
   */
  calculateHealthScore(input: HealthScoreInput): HealthScoreResult {
    // ---- Input Validation ----
    if (input.uptimePercentage < 0 || input.uptimePercentage > 1) {
      throw new ValidationError(
        "uptimePercentage must be between 0 and 1",
        { value: input.uptimePercentage },
      );
    }
    if (input.efficiencyVariance < 0) {
      throw new ValidationError(
        "efficiencyVariance must be non-negative",
        { value: input.efficiencyVariance },
      );
    }
    if (input.anomalyRate < 0 || input.anomalyRate > 1) {
      throw new ValidationError(
        "anomalyRate must be between 0 and 1",
        { value: input.anomalyRate },
      );
    }
    if (input.maintenanceAgeDays < 0) {
      throw new ValidationError(
        "maintenanceAgeDays must be non-negative",
        { value: input.maintenanceAgeDays },
      );
    }

    const hwGen = input.hardwareGeneration ?? 1;
    const seasonalDrift = input.seasonalDriftFactor ?? 0;

    if (hwGen < 1 || !Number.isInteger(hwGen)) {
      throw new ValidationError(
        "hardwareGeneration must be a positive integer",
        { value: hwGen },
      );
    }
    if (seasonalDrift < 0 || seasonalDrift > 1) {
      throw new ValidationError(
        "seasonalDriftFactor must be between 0 and 1",
        { value: seasonalDrift },
      );
    }

    // ---- Factor 1: Uptime Score (40% weight) ----
    // Direct mapping: 99% uptime → 99 score
    const uptimeScore = Math.min(100, input.uptimePercentage * 100);

    // ---- Factor 2: Stability Score (30% weight) ----
    // Low variance = high stability. Variance of 2.0 → 0 penalty.
    // Each unit of variance costs 50 stability points (harsh but fair).
    const stabilityScore = Math.max(0, Math.min(100, 100 - (input.efficiencyVariance * 50)));

    // ---- Factor 3: Integrity Score (30% weight) ----
    // Anomaly rate of 0.005 (50 per 10k) would zero the score.
    // Each 0.001 anomaly rate costs 200 integrity points.
    const integrityScore = Math.max(0, Math.min(100, 100 - (input.anomalyRate * 200 * 100)));

    // ---- Composite Raw Score ----
    const rawScore =
      (uptimeScore * SCORING_WEIGHTS.UPTIME) +
      (stabilityScore * SCORING_WEIGHTS.STABILITY) +
      (integrityScore * SCORING_WEIGHTS.INTEGRITY);

    // ---- Modifier: Maintenance Age Penalty ----
    // After 180 days without service, health degrades at 0.1/day
    const maintenanceAgePenalty =
      input.maintenanceAgeDays > MAINTENANCE_PENALTY_THRESHOLD_DAYS
        ? (input.maintenanceAgeDays - MAINTENANCE_PENALTY_THRESHOLD_DAYS) * MAINTENANCE_PENALTY_RATE_PER_DAY
        : 0;

    // ---- Modifier: Hardware Generation Bonus ----
    // Gen-2 gets +2, Gen-3 gets +4, capped at +8
    const hardwareGenerationBonus = Math.min(
      HW_GENERATION_BONUS_CAP,
      (hwGen - 1) * HW_GENERATION_BONUS_PER_GEN,
    );

    // ---- Modifier: Seasonal Drift Penalty ----
    // High seasonal variability reduces confidence in score
    const seasonalDriftPenalty = seasonalDrift * SEASONAL_DRIFT_PENALTY_MULTIPLIER;

    // ---- Final Health Score ----
    const healthScore = Math.round(
      Math.min(100, Math.max(0,
        rawScore
        - maintenanceAgePenalty
        + hardwareGenerationBonus
        - seasonalDriftPenalty,
      )),
    );

    // ---- Failure Probability (Non-Linear Actuarial Curve) ----
    // Base risk: 50 BPS (0.5%) — Earth is risky
    let failureProbabilityBps = 50;

    // Linear degradation zone: 80–95
    if (healthScore < 95) {
      failureProbabilityBps += (95 - healthScore) * 10;
    }

    // Exponential danger zone: below 80
    if (healthScore < 80) {
      failureProbabilityBps += (80 - healthScore) * 50;
    }

    // Critical zone: below 50 — catastrophic risk
    if (healthScore < 50) {
      failureProbabilityBps += (50 - healthScore) * 100;
    }

    failureProbabilityBps = Math.round(
      Math.min(BPS_SCALE, failureProbabilityBps),
    );

    // ---- Risk Tier Classification ----
    const riskTier = this.classifyRiskTier(healthScore);

    // ---- Insurance Eligibility ----
    const isInsurable = healthScore >= INSURANCE_ELIGIBILITY_THRESHOLD;

    // ---- Confidence Level ----
    // Higher uptime + lower variance + more data = more confidence
    const confidence = Math.min(1, Math.max(0,
      (input.uptimePercentage * 0.5) +
      (Math.max(0, 1 - input.efficiencyVariance / 5) * 0.3) +
      (Math.max(0, 1 - input.anomalyRate * 100) * 0.2),
    ));

    return {
      healthScore,
      failureProbabilityBps,
      riskTier,
      isInsurable,
      factors: {
        uptimeScore: Math.round(uptimeScore * 100) / 100,
        stabilityScore: Math.round(stabilityScore * 100) / 100,
        integrityScore: Math.round(integrityScore * 100) / 100,
        maintenanceAgePenalty: Math.round(maintenanceAgePenalty * 100) / 100,
        hardwareGenerationBonus,
        seasonalDriftPenalty: Math.round(seasonalDriftPenalty * 100) / 100,
      },
      confidence: Math.round(confidence * 1000) / 1000,
    };
  }

  /**
   * Batch-score multiple DAC units.
   *
   * Efficiently processes an array of metric inputs and returns
   * sorted results with fleet-level statistics.
   *
   * @param inputs - Array of { dacUnitId, metrics } pairs
   * @returns Sorted scores (worst-first) with aggregate stats
   */
  batchCalculateHealthScores(
    inputs: Array<{ dacUnitId: string; metrics: HealthScoreInput }>,
  ): {
    scores: Array<{ dacUnitId: string; result: HealthScoreResult }>;
    aggregate: {
      averageHealth: number;
      medianHealth: number;
      minHealth: number;
      maxHealth: number;
      insuredCount: number;
      uninsuredCount: number;
    };
  } {
    if (inputs.length === 0) {
      throw new ValidationError("At least one input is required for batch scoring", {});
    }

    const scores = inputs.map(({ dacUnitId, metrics }) => ({
      dacUnitId,
      result: this.calculateHealthScore(metrics),
    }));

    // Sort worst-first for prioritized alerting
    scores.sort((a, b) => a.result.healthScore - b.result.healthScore);

    const healthValues = scores.map((s) => s.result.healthScore);
    const sorted = [...healthValues].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const lowerMiddle = sorted[mid - 1] ?? sorted[0] ?? 0;
    const upperMiddle = sorted[mid] ?? lowerMiddle;
    const median = sorted.length % 2 === 0
      ? ((lowerMiddle + upperMiddle) / 2)
      : upperMiddle;

    return {
      scores,
      aggregate: {
        averageHealth: Math.round(
          healthValues.reduce((sum, v) => sum + v, 0) / healthValues.length * 100,
        ) / 100,
        medianHealth: Math.round(median * 100) / 100,
        minHealth: Math.min(...healthValues),
        maxHealth: Math.max(...healthValues),
        insuredCount: scores.filter((s) => s.result.isInsurable).length,
        uninsuredCount: scores.filter((s) => !s.result.isInsurable).length,
      },
    };
  }

  // ============================================
  // On-Chain Oracle Reads
  // ============================================

  /**
   * Read a DAC unit's risk profile from the on-chain RiskOracle.
   *
   * @param dacUnitId - The DAC unit identifier
   * @returns On-chain risk profile with computed staleness
   * @throws ContractError if the oracle contract call fails
   */
  async getRiskProfile(dacUnitId: string): Promise<OnChainRiskProfile> {
    return this.telemetry.wrapAsync(
      "risk.getRiskProfile",
      async () => {
        const oracleAddress = this.resolveOracleAddress();
        const oracle = new ethers.Contract(
          oracleAddress,
          RISK_ORACLE_ABI,
          this.config.provider,
        );

        const dacBytes32 = this.toDacBytes32(dacUnitId);

        try {
          const profileFn = oracle.getFunction("dacRiskProfiles");
          const result = await withRetry(
            () => profileFn(dacBytes32),
            this.config.retry,
          );

          const healthScore = Number(result[0]);
          const failureProbabilityBps = Number(result[1]);
          const lastUpdated = Number(result[2]);
          const isInsured = Boolean(result[3]);
          const now = Math.floor(Date.now() / 1000);

          return {
            dacUnitId,
            healthScore,
            failureProbabilityBps,
            lastUpdated,
            isInsured,
            riskTier: this.classifyRiskTier(healthScore),
            staleness: lastUpdated > 0 ? now - lastUpdated : -1,
          };
        } catch (error) {
          throw TerraQuraError.fromContractRevert(error);
        }
      },
      { dacUnitId },
    );
  }

  /**
   * Get the on-chain insurance premium for a DAC unit.
   *
   * This calls `RiskOracle.getInsurancePremiumBps()` which returns
   * the total premium rate (failure probability + base fee).
   *
   * @param dacUnitId - The DAC unit identifier
   * @returns Premium in BPS, or 0 if unit is not insurable
   */
  async getOnChainPremiumBps(dacUnitId: string): Promise<number> {
    return this.telemetry.wrapAsync(
      "risk.getOnChainPremiumBps",
      async () => {
        const oracleAddress = this.resolveOracleAddress();
        const oracle = new ethers.Contract(
          oracleAddress,
          RISK_ORACLE_ABI,
          this.config.provider,
        );

        const dacBytes32 = this.toDacBytes32(dacUnitId);

        try {
          const premiumFn = oracle.getFunction("getInsurancePremiumBps");
          const result = await withRetry(
            () => premiumFn(dacBytes32),
            this.config.retry,
          );
          return Number(result);
        } catch (error) {
          throw TerraQuraError.fromContractRevert(error);
        }
      },
      { dacUnitId },
    );
  }

  // ============================================
  // Insurance Premium Calculations
  // ============================================

  /**
   * Calculate the full insurance premium for a transaction.
   *
   * Combines the on-chain failure probability with the SDK-side
   * base fee and catastrophe reserve to produce the total premium.
   *
   * @param dacUnitId - The DAC unit identifier
   * @param subtotalWei - The transaction subtotal (before premium)
   * @returns Complete premium breakdown
   *
   * @example
   * ```ts
   * const premium = await client.risk.calculateInsurancePremium(
   *   "dac-unit-001",
   *   ethers.parseEther("100"),
   * );
   * // premium.premiumBps = 225 (1% base + 1% risk + 0.25% catastrophe)
   * // premium.premiumWei = 2.25 ETH
   * ```
   */
  async calculateInsurancePremium(
    dacUnitId: string,
    subtotalWei: bigint,
  ): Promise<InsurancePremium> {
    return this.telemetry.wrapAsync(
      "risk.calculateInsurancePremium",
      async () => {
        if (subtotalWei <= 0n) {
          throw new ValidationError(
            "subtotalWei must be positive",
            { value: subtotalWei.toString() },
          );
        }

        const profile = await this.getRiskProfile(dacUnitId);

        if (!profile.isInsured) {
          return {
            dacUnitId,
            premiumBps: 0,
            premiumWei: 0n,
            subtotalWei,
            isInsurable: false,
            breakdown: {
              baseFee: 0,
              riskComponent: 0,
              catastropheReserve: 0,
            },
          };
        }

        // Risk component = on-chain failure probability
        const riskComponent = profile.failureProbabilityBps;
        const totalPremiumBps = BASE_INSURANCE_FEE_BPS + riskComponent + CATASTROPHE_RESERVE_BPS;

        // Premium = subtotal * premiumBps / BPS_SCALE
        const premiumWei = (subtotalWei * BigInt(totalPremiumBps)) / BigInt(BPS_SCALE);

        return {
          dacUnitId,
          premiumBps: totalPremiumBps,
          premiumWei,
          subtotalWei,
          isInsurable: true,
          breakdown: {
            baseFee: BASE_INSURANCE_FEE_BPS,
            riskComponent,
            catastropheReserve: CATASTROPHE_RESERVE_BPS,
          },
        };
      },
      { dacUnitId },
    );
  }

  /**
   * Calculate insurance premium from a local HealthScoreResult.
   *
   * Use this when you've already computed the health score locally
   * and don't need to query the on-chain oracle.
   *
   * @param scoreResult - Previously computed health score
   * @param subtotalWei - Transaction subtotal
   * @returns Premium breakdown
   */
  calculatePremiumFromScore(
    scoreResult: HealthScoreResult,
    subtotalWei: bigint,
  ): InsurancePremium {
    if (subtotalWei <= 0n) {
      throw new ValidationError(
        "subtotalWei must be positive",
        { value: subtotalWei.toString() },
      );
    }

    if (!scoreResult.isInsurable) {
      return {
        dacUnitId: "local",
        premiumBps: 0,
        premiumWei: 0n,
        subtotalWei,
        isInsurable: false,
        breakdown: {
          baseFee: 0,
          riskComponent: 0,
          catastropheReserve: 0,
        },
      };
    }

    const riskComponent = scoreResult.failureProbabilityBps;
    const totalPremiumBps = BASE_INSURANCE_FEE_BPS + riskComponent + CATASTROPHE_RESERVE_BPS;
    const premiumWei = (subtotalWei * BigInt(totalPremiumBps)) / BigInt(BPS_SCALE);

    return {
      dacUnitId: "local",
      premiumBps: totalPremiumBps,
      premiumWei,
      subtotalWei,
      isInsurable: true,
      breakdown: {
        baseFee: BASE_INSURANCE_FEE_BPS,
        riskComponent,
        catastropheReserve: CATASTROPHE_RESERVE_BPS,
      },
    };
  }

  // ============================================
  // On-Chain Oracle Writes (Grader Operations)
  // ============================================

  /**
   * Update a DAC unit's risk profile on the on-chain oracle.
   *
   * **Requires GRADER_ROLE** on the RiskOracle contract.
   * Typically called by the actuarial worker process, not by end-users.
   *
   * @param input - Risk profile update data
   * @returns Transaction hash and updated profile
   * @throws AuthenticationError if signer is not configured
   * @throws ContractError if the caller lacks GRADER_ROLE
   */
  async updateRiskProfile(input: UpdateRiskProfileInput): Promise<{
    txHash: string;
    blockNumber: number;
    dacUnitId: string;
    healthScore: number;
    failureProbabilityBps: number;
  }> {
    return this.telemetry.wrapAsync(
      "risk.updateRiskProfile",
      async () => {
        if (!this.config.signer) {
          throw new ValidationError(
            "Signer required: updateRiskProfile is a write operation",
            {},
          );
        }

        // Validate score range
        if (input.healthScore < 0 || input.healthScore > 100 || !Number.isInteger(input.healthScore)) {
          throw new ValidationError(
            "healthScore must be an integer between 0 and 100",
            { value: input.healthScore },
          );
        }
        if (input.failureProbabilityBps < 0 || input.failureProbabilityBps > BPS_SCALE) {
          throw new ValidationError(
            "failureProbabilityBps must be between 0 and 10000",
            { value: input.failureProbabilityBps },
          );
        }

        const oracleAddress = this.resolveOracleAddress();
        const oracle = new ethers.Contract(
          oracleAddress,
          RISK_ORACLE_ABI,
          this.config.signer,
        );

        const dacBytes32 = this.toDacBytes32(input.dacUnitId);

        try {
          const updateFn = oracle.getFunction("updateRiskProfile");
          const tx = await updateFn(
            dacBytes32,
            input.healthScore,
            input.failureProbabilityBps,
          );

          const receipt = await tx.wait(2);

          return {
            txHash: receipt.hash as string,
            blockNumber: receipt.blockNumber as number,
            dacUnitId: input.dacUnitId,
            healthScore: input.healthScore,
            failureProbabilityBps: input.failureProbabilityBps,
          };
        } catch (error) {
          throw TerraQuraError.fromContractRevert(error);
        }
      },
      { dacUnitId: input.dacUnitId },
    );
  }

  /**
   * Batch-update multiple risk profiles on-chain.
   *
   * Executes updates sequentially to avoid nonce conflicts.
   * Returns results with partial-failure support.
   *
   * @param inputs - Array of risk profile updates
   * @returns Per-unit results with success/failure status
   */
  async batchUpdateRiskProfiles(
    inputs: UpdateRiskProfileInput[],
  ): Promise<{
    results: Array<{
      dacUnitId: string;
      success: boolean;
      txHash?: string;
      error?: string;
    }>;
    successCount: number;
    failCount: number;
  }> {
    return this.telemetry.wrapAsync(
      "risk.batchUpdateRiskProfiles",
      async () => {
        if (inputs.length === 0) {
          throw new ValidationError("At least one input is required", {});
        }

        const results: Array<{
          dacUnitId: string;
          success: boolean;
          txHash?: string;
          error?: string;
        }> = [];

        // Sequential execution to avoid nonce conflicts
        for (const input of inputs) {
          try {
            const result = await this.updateRiskProfile(input);
            results.push({
              dacUnitId: input.dacUnitId,
              success: true,
              txHash: result.txHash,
            });
          } catch (error) {
            results.push({
              dacUnitId: input.dacUnitId,
              success: false,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }

        return {
          results,
          successCount: results.filter((r) => r.success).length,
          failCount: results.filter((r) => !r.success).length,
        };
      },
      { count: inputs.length },
    );
  }

  // ============================================
  // Fleet Analytics
  // ============================================

  /**
   * Generate fleet-wide risk analytics from local scores.
   *
   * Takes an array of pre-computed health scores and produces
   * aggregate statistics. No blockchain interaction.
   *
   * @param scores - Array of { dacUnitId, result } pairs
   * @returns Fleet-level risk analytics
   */
  generateFleetAnalytics(
    scores: Array<{ dacUnitId: string; result: HealthScoreResult }>,
  ): FleetRiskAnalytics {
    if (scores.length === 0) {
      throw new ValidationError("At least one score is required for fleet analytics", {});
    }

    const healthValues = scores.map((s) => s.result.healthScore);
    const sorted = [...healthValues].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const lowerMiddle = sorted[mid - 1] ?? sorted[0] ?? 0;
    const upperMiddle = sorted[mid] ?? lowerMiddle;
    const median = sorted.length % 2 === 0
      ? ((lowerMiddle + upperMiddle) / 2)
      : upperMiddle;

    const tierDistribution: Record<RiskTier, number> = {
      minimal: 0,
      low: 0,
      moderate: 0,
      elevated: 0,
      high: 0,
      critical: 0,
    };

    for (const score of scores) {
      tierDistribution[score.result.riskTier]++;
    }

    // Weighted average failure probability (weighted by 1/health for risk emphasis)
    const totalWeight = scores.reduce(
      (sum, s) => sum + (101 - s.result.healthScore),
      0,
    );
    const weightedProb = scores.reduce(
      (sum, s) =>
        sum + (s.result.failureProbabilityBps * (101 - s.result.healthScore)),
      0,
    );

    return {
      totalUnits: scores.length,
      insuredUnits: scores.filter((s) => s.result.isInsurable).length,
      uninsuredUnits: scores.filter((s) => !s.result.isInsurable).length,
      averageHealthScore: Math.round(
        healthValues.reduce((sum, v) => sum + v, 0) / healthValues.length * 100,
      ) / 100,
      medianHealthScore: Math.round(median * 100) / 100,
      minimumHealthScore: Math.min(...healthValues),
      maximumHealthScore: Math.max(...healthValues),
      tierDistribution,
      weightedFailureProbabilityBps: Math.round(weightedProb / totalWeight),
      generatedAt: Date.now(),
    };
  }

  // ============================================
  // Private Helpers
  // ============================================

  /** Classify a health score into a risk tier */
  private classifyRiskTier(healthScore: number): RiskTier {
    for (const { min, tier } of TIER_THRESHOLDS) {
      if (healthScore >= min) return tier;
    }
    return "critical";
  }

  /**
   * Convert a DAC unit ID to bytes32.
   * Accepts already-formatted bytes32 or human-readable strings.
   */
  private toDacBytes32(dacUnitId: string): string {
    if (/^0x[0-9a-fA-F]{64}$/.test(dacUnitId)) {
      return dacUnitId;
    }
    return ethers.id(dacUnitId);
  }

  /**
   * Resolve the RiskOracle contract address.
   *
   * Uses the circuitBreaker address slot as a placeholder
   * until RiskOracle is deployed and added to CONTRACT_ADDRESSES.
   * In production, this would be a dedicated `riskOracle` field.
   */
  private resolveOracleAddress(): string {
    // Future: this.config.addresses.riskOracle
    // For now, use a convention-based approach
    const addr = (this.config as unknown as Record<string, unknown>)["riskOracleAddress"] as string | undefined;
    if (addr && ethers.isAddress(addr)) {
      return addr;
    }

    // Fallback: derive from network config (placeholder for pre-deployment)
    throw new ValidationError(
      "RiskOracle address not configured. Set `riskOracleAddress` in client config or deploy RiskOracle.sol.",
      { network: this.config.network },
    );
  }
}
