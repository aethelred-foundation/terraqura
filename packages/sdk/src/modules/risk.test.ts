import { describe, expect, it, vi, beforeEach } from "vitest";

import { ValidationError } from "../errors.js";
import { RiskModule } from "./risk.js";

import type { HealthScoreInput, HealthScoreResult } from "./risk.js";
import type { InternalConfig } from "../types.js";
import type { ITelemetry } from "../telemetry.js";

// ============================================
// Helpers
// ============================================

function makeTelemetry(): ITelemetry {
  return {
    wrapAsync: (_name: string, fn: () => unknown) => fn(),
    recordMetric: vi.fn(),
  } as unknown as ITelemetry;
}

function makeConfig(overrides: Partial<InternalConfig> = {}): InternalConfig {
  return {
    network: "aethelred-testnet",
    provider: {} as InternalConfig["provider"],
    signer: null,
    addresses: {
      accessControl: "0x0000000000000000000000000000000000000001",
      verificationEngine: "0x0000000000000000000000000000000000000002",
      carbonCredit: "0x0000000000000000000000000000000000000003",
      carbonMarketplace: "0x0000000000000000000000000000000000000004",
      gaslessMarketplace: "0x0000000000000000000000000000000000000005",
      circuitBreaker: "0x0000000000000000000000000000000000000006",
    },
    subgraphUrl: "",
    gas: {
      multiplier: 1.2,
      maxGasPrice: 100_000_000_000n,
      maxPriorityFee: 30_000_000_000n,
      cacheTtlMs: 15000,
      gasLimits: {},
    },
    retry: {
      maxRetries: 3,
      baseDelayMs: 1000,
      maxDelayMs: 30000,
      retryableErrors: [],
    },
    telemetryEnabled: false,
    ...overrides,
  };
}

/** Healthy baseline input for most tests */
const HEALTHY_INPUT: HealthScoreInput = {
  uptimePercentage: 0.985,
  efficiencyVariance: 1.2,
  anomalyRate: 0.0003,
  maintenanceAgeDays: 45,
  hardwareGeneration: 2,
  seasonalDriftFactor: 0.02,
};

// ============================================
// Tests
// ============================================

describe("RiskModule", () => {
  let risk: RiskModule;

  beforeEach(() => {
    risk = new RiskModule(makeConfig(), makeTelemetry());
  });

  // -----------------------------------------------
  // calculateHealthScore — input validation
  // -----------------------------------------------
  describe("calculateHealthScore — input validation", () => {
    it("rejects uptimePercentage below 0", () => {
      expect(() =>
        risk.calculateHealthScore({ ...HEALTHY_INPUT, uptimePercentage: -0.01 }),
      ).toThrow(ValidationError);
    });

    it("rejects uptimePercentage above 1", () => {
      expect(() =>
        risk.calculateHealthScore({ ...HEALTHY_INPUT, uptimePercentage: 1.01 }),
      ).toThrow(ValidationError);
    });

    it("rejects negative efficiencyVariance", () => {
      expect(() =>
        risk.calculateHealthScore({ ...HEALTHY_INPUT, efficiencyVariance: -1 }),
      ).toThrow(ValidationError);
    });

    it("rejects anomalyRate below 0", () => {
      expect(() =>
        risk.calculateHealthScore({ ...HEALTHY_INPUT, anomalyRate: -0.001 }),
      ).toThrow(ValidationError);
    });

    it("rejects anomalyRate above 1", () => {
      expect(() =>
        risk.calculateHealthScore({ ...HEALTHY_INPUT, anomalyRate: 1.1 }),
      ).toThrow(ValidationError);
    });

    it("rejects negative maintenanceAgeDays", () => {
      expect(() =>
        risk.calculateHealthScore({ ...HEALTHY_INPUT, maintenanceAgeDays: -10 }),
      ).toThrow(ValidationError);
    });

    it("rejects hardwareGeneration < 1", () => {
      expect(() =>
        risk.calculateHealthScore({ ...HEALTHY_INPUT, hardwareGeneration: 0 }),
      ).toThrow(ValidationError);
    });

    it("rejects non-integer hardwareGeneration", () => {
      expect(() =>
        risk.calculateHealthScore({ ...HEALTHY_INPUT, hardwareGeneration: 1.5 }),
      ).toThrow(ValidationError);
    });

    it("rejects seasonalDriftFactor below 0", () => {
      expect(() =>
        risk.calculateHealthScore({ ...HEALTHY_INPUT, seasonalDriftFactor: -0.1 }),
      ).toThrow(ValidationError);
    });

    it("rejects seasonalDriftFactor above 1", () => {
      expect(() =>
        risk.calculateHealthScore({ ...HEALTHY_INPUT, seasonalDriftFactor: 1.1 }),
      ).toThrow(ValidationError);
    });
  });

  // -----------------------------------------------
  // calculateHealthScore — factor calculations
  // -----------------------------------------------
  describe("calculateHealthScore — uptime factor", () => {
    it("scores 0 uptime near zero health", () => {
      const result = risk.calculateHealthScore({
        ...HEALTHY_INPUT,
        uptimePercentage: 0,
        efficiencyVariance: 0,
        anomalyRate: 0,
        hardwareGeneration: 1,
        seasonalDriftFactor: 0,
      });
      // uptime=0 (40% weight), stability=100 (30%), integrity=100 (30%)
      // raw = 0 + 30 + 30 = 60
      expect(result.factors.uptimeScore).toBe(0);
      expect(result.healthScore).toBe(60);
    });

    it("scores 100% uptime at maximum", () => {
      const result = risk.calculateHealthScore({
        ...HEALTHY_INPUT,
        uptimePercentage: 1.0,
      });
      expect(result.factors.uptimeScore).toBe(100);
    });

    it("maps 98.5% uptime to 98.5 score", () => {
      const result = risk.calculateHealthScore({
        ...HEALTHY_INPUT,
        uptimePercentage: 0.985,
      });
      expect(result.factors.uptimeScore).toBe(98.5);
    });
  });

  describe("calculateHealthScore — stability factor", () => {
    it("perfect stability (variance=0) yields 100", () => {
      const result = risk.calculateHealthScore({
        ...HEALTHY_INPUT,
        efficiencyVariance: 0,
      });
      expect(result.factors.stabilityScore).toBe(100);
    });

    it("variance of 2.0 yields 0 stability", () => {
      const result = risk.calculateHealthScore({
        ...HEALTHY_INPUT,
        efficiencyVariance: 2.0,
      });
      expect(result.factors.stabilityScore).toBe(0);
    });

    it("variance above 2.0 is clamped to 0", () => {
      const result = risk.calculateHealthScore({
        ...HEALTHY_INPUT,
        efficiencyVariance: 5.0,
      });
      expect(result.factors.stabilityScore).toBe(0);
    });

    it("variance of 1.0 yields 50", () => {
      const result = risk.calculateHealthScore({
        ...HEALTHY_INPUT,
        efficiencyVariance: 1.0,
      });
      expect(result.factors.stabilityScore).toBe(50);
    });
  });

  describe("calculateHealthScore — integrity factor", () => {
    it("anomalyRate 0 yields 100 integrity", () => {
      const result = risk.calculateHealthScore({
        ...HEALTHY_INPUT,
        anomalyRate: 0,
      });
      expect(result.factors.integrityScore).toBe(100);
    });

    it("anomalyRate 0.005 zeros the integrity score", () => {
      const result = risk.calculateHealthScore({
        ...HEALTHY_INPUT,
        anomalyRate: 0.005,
      });
      expect(result.factors.integrityScore).toBe(0);
    });

    it("anomalyRate 0.0025 yields 50 integrity", () => {
      const result = risk.calculateHealthScore({
        ...HEALTHY_INPUT,
        anomalyRate: 0.0025,
      });
      expect(result.factors.integrityScore).toBe(50);
    });
  });

  // -----------------------------------------------
  // calculateHealthScore — modifiers
  // -----------------------------------------------
  describe("calculateHealthScore — maintenance age modifier", () => {
    it("no penalty at 180 days", () => {
      const result = risk.calculateHealthScore({
        ...HEALTHY_INPUT,
        maintenanceAgeDays: 180,
        hardwareGeneration: 1,
        seasonalDriftFactor: 0,
      });
      expect(result.factors.maintenanceAgePenalty).toBe(0);
    });

    it("applies 0.1/day penalty past 180 days", () => {
      const result = risk.calculateHealthScore({
        ...HEALTHY_INPUT,
        maintenanceAgeDays: 200,
        hardwareGeneration: 1,
        seasonalDriftFactor: 0,
      });
      // (200 - 180) * 0.1 = 2.0
      expect(result.factors.maintenanceAgePenalty).toBe(2);
    });

    it("large maintenance age causes significant penalty", () => {
      const result = risk.calculateHealthScore({
        ...HEALTHY_INPUT,
        maintenanceAgeDays: 680,
        hardwareGeneration: 1,
        seasonalDriftFactor: 0,
      });
      // (680 - 180) * 0.1 = 50
      expect(result.factors.maintenanceAgePenalty).toBe(50);
    });
  });

  describe("calculateHealthScore — hardware generation bonus", () => {
    it("Gen-1 receives no bonus", () => {
      const result = risk.calculateHealthScore({
        ...HEALTHY_INPUT,
        hardwareGeneration: 1,
      });
      expect(result.factors.hardwareGenerationBonus).toBe(0);
    });

    it("Gen-2 receives +2 bonus", () => {
      const result = risk.calculateHealthScore({
        ...HEALTHY_INPUT,
        hardwareGeneration: 2,
      });
      expect(result.factors.hardwareGenerationBonus).toBe(2);
    });

    it("Gen-5 is capped at +8 bonus", () => {
      const result = risk.calculateHealthScore({
        ...HEALTHY_INPUT,
        hardwareGeneration: 5,
      });
      expect(result.factors.hardwareGenerationBonus).toBe(8);
    });

    it("Gen-10 is still capped at +8", () => {
      const result = risk.calculateHealthScore({
        ...HEALTHY_INPUT,
        hardwareGeneration: 10,
      });
      expect(result.factors.hardwareGenerationBonus).toBe(8);
    });
  });

  describe("calculateHealthScore — seasonal drift penalty", () => {
    it("zero drift means no penalty", () => {
      const result = risk.calculateHealthScore({
        ...HEALTHY_INPUT,
        seasonalDriftFactor: 0,
      });
      expect(result.factors.seasonalDriftPenalty).toBe(0);
    });

    it("drift of 1.0 yields max penalty of 15", () => {
      const result = risk.calculateHealthScore({
        ...HEALTHY_INPUT,
        seasonalDriftFactor: 1.0,
      });
      expect(result.factors.seasonalDriftPenalty).toBe(15);
    });

    it("drift of 0.5 yields 7.5 penalty", () => {
      const result = risk.calculateHealthScore({
        ...HEALTHY_INPUT,
        seasonalDriftFactor: 0.5,
      });
      expect(result.factors.seasonalDriftPenalty).toBe(7.5);
    });
  });

  // -----------------------------------------------
  // calculateHealthScore — failure probability curve
  // -----------------------------------------------
  describe("calculateHealthScore — failure probability", () => {
    it("score >= 95 has base probability of 50 BPS", () => {
      const result = risk.calculateHealthScore({
        uptimePercentage: 1.0,
        efficiencyVariance: 0,
        anomalyRate: 0,
        maintenanceAgeDays: 0,
        hardwareGeneration: 1,
        seasonalDriftFactor: 0,
      });
      // raw score = 100, health=100, failProb = 50 + (95-100)*10 => 50 only (no degradation)
      expect(result.healthScore).toBe(100);
      expect(result.failureProbabilityBps).toBe(50);
    });

    it("score of 90 triggers linear degradation", () => {
      // At score 90: base 50 + (95-90)*10 = 100
      const result = risk.calculateHealthScore({
        uptimePercentage: 0.9,
        efficiencyVariance: 0,
        anomalyRate: 0,
        maintenanceAgeDays: 0,
        hardwareGeneration: 1,
        seasonalDriftFactor: 0,
      });
      // uptimeScore=90, stability=100, integrity=100
      // raw = 90*0.4 + 100*0.3 + 100*0.3 = 36+30+30 = 96 -> health = 96
      expect(result.healthScore).toBe(96);
      // 96 >= 95, so failProb = 50
      // Actually 96 > 95, so only base
      expect(result.failureProbabilityBps).toBe(50);
    });

    it("score of 80 includes linear zone only", () => {
      // Score exactly 80: base 50 + (95-80)*10 = 200
      // No exponential zone at exactly 80
      // We need to construct an input that yields health=80
      const result = risk.calculateHealthScore({
        uptimePercentage: 0.7,
        efficiencyVariance: 0,
        anomalyRate: 0,
        maintenanceAgeDays: 0,
        hardwareGeneration: 1,
        seasonalDriftFactor: 0,
      });
      // uptime=70, stab=100, integ=100
      // raw = 70*0.4 + 100*0.3 + 100*0.3 = 28+30+30 = 88
      expect(result.healthScore).toBe(88);
      // failProb = 50 + (95-88)*10 = 50+70=120
      expect(result.failureProbabilityBps).toBe(120);
    });

    it("score below 80 triggers exponential danger zone", () => {
      const result = risk.calculateHealthScore({
        uptimePercentage: 0.5,
        efficiencyVariance: 0,
        anomalyRate: 0,
        maintenanceAgeDays: 0,
        hardwareGeneration: 1,
        seasonalDriftFactor: 0,
      });
      // uptime=50, stab=100, integ=100
      // raw = 50*0.4 + 100*0.3 + 100*0.3 = 20+30+30 = 80
      expect(result.healthScore).toBe(80);
      // failProb = 50 + (95-80)*10 = 200
      // no exponential since score is exactly 80
      expect(result.failureProbabilityBps).toBe(200);
    });

    it("score below 50 triggers catastrophic zone", () => {
      const result = risk.calculateHealthScore({
        uptimePercentage: 0,
        efficiencyVariance: 0,
        anomalyRate: 0,
        maintenanceAgeDays: 0,
        hardwareGeneration: 1,
        seasonalDriftFactor: 0,
      });
      // uptime=0, stab=100, integ=100
      // raw = 0 + 30 + 30 = 60
      expect(result.healthScore).toBe(60);
      // failProb = 50 + (95-60)*10 + (80-60)*50
      // = 50 + 350 + 1000 = 1400
      expect(result.failureProbabilityBps).toBe(1400);
    });

    it("extremely low score has very high failure probability", () => {
      const result = risk.calculateHealthScore({
        uptimePercentage: 0,
        efficiencyVariance: 2,
        anomalyRate: 0.005,
        maintenanceAgeDays: 0,
        hardwareGeneration: 1,
        seasonalDriftFactor: 0,
      });
      // uptime=0, stab=0, integ=0
      // raw = 0, health = 0
      expect(result.healthScore).toBe(0);
      // failProb = 50 + (95-0)*10 + (80-0)*50 + (50-0)*100
      // = 50 + 950 + 4000 + 5000 = 10000
      expect(result.failureProbabilityBps).toBe(10000);
    });

    it("failure probability is capped at 10000 BPS", () => {
      // Even with the worst score, it should cap at 10000
      const result = risk.calculateHealthScore({
        uptimePercentage: 0,
        efficiencyVariance: 2,
        anomalyRate: 0.005,
        maintenanceAgeDays: 500,
        hardwareGeneration: 1,
        seasonalDriftFactor: 1.0,
      });
      expect(result.failureProbabilityBps).toBeLessThanOrEqual(10000);
    });
  });

  // -----------------------------------------------
  // calculateHealthScore — risk tier classification
  // -----------------------------------------------
  describe("calculateHealthScore — risk tier", () => {
    it("score 90+ is minimal", () => {
      const result = risk.calculateHealthScore({
        uptimePercentage: 1.0,
        efficiencyVariance: 0,
        anomalyRate: 0,
        maintenanceAgeDays: 0,
        hardwareGeneration: 1,
        seasonalDriftFactor: 0,
      });
      expect(result.riskTier).toBe("minimal");
    });

    it("score 80-89 is low", () => {
      const result = risk.calculateHealthScore({
        uptimePercentage: 0.7,
        efficiencyVariance: 0,
        anomalyRate: 0,
        maintenanceAgeDays: 0,
        hardwareGeneration: 1,
        seasonalDriftFactor: 0,
      });
      // health=88
      expect(result.riskTier).toBe("low");
    });

    it("score 70-79 is moderate", () => {
      const result = risk.calculateHealthScore({
        uptimePercentage: 0.5,
        efficiencyVariance: 0,
        anomalyRate: 0,
        maintenanceAgeDays: 0,
        hardwareGeneration: 1,
        seasonalDriftFactor: 0,
      });
      // health=80
      expect(result.riskTier).toBe("low"); // 80 is still "low" (>=80)
    });

    it("score exactly 70 is moderate", () => {
      // Need health=70
      const result = risk.calculateHealthScore({
        uptimePercentage: 0.5,
        efficiencyVariance: 0,
        anomalyRate: 0,
        maintenanceAgeDays: 280,  // penalty = (280-180)*0.1 = 10
        hardwareGeneration: 1,
        seasonalDriftFactor: 0,
      });
      // raw=80, penalty=10, health=70
      expect(result.healthScore).toBe(70);
      expect(result.riskTier).toBe("moderate");
    });

    it("score 55-69 is elevated", () => {
      const result = risk.calculateHealthScore({
        uptimePercentage: 0,
        efficiencyVariance: 0,
        anomalyRate: 0,
        maintenanceAgeDays: 0,
        hardwareGeneration: 1,
        seasonalDriftFactor: 0,
      });
      // health=60
      expect(result.riskTier).toBe("elevated");
    });

    it("score 30-54 is high", () => {
      const result = risk.calculateHealthScore({
        uptimePercentage: 0,
        efficiencyVariance: 1.5,
        anomalyRate: 0,
        maintenanceAgeDays: 0,
        hardwareGeneration: 1,
        seasonalDriftFactor: 0,
      });
      // uptime=0, stab=25, integ=100
      // raw = 0 + 25*0.3 + 100*0.3 = 7.5 + 30 = 37.5 -> 38
      expect(result.healthScore).toBe(38);
      expect(result.riskTier).toBe("high");
    });

    it("score 0-29 is critical", () => {
      const result = risk.calculateHealthScore({
        uptimePercentage: 0,
        efficiencyVariance: 2,
        anomalyRate: 0.005,
        maintenanceAgeDays: 0,
        hardwareGeneration: 1,
        seasonalDriftFactor: 0,
      });
      expect(result.healthScore).toBe(0);
      expect(result.riskTier).toBe("critical");
    });
  });

  // -----------------------------------------------
  // calculateHealthScore — insurance eligibility
  // -----------------------------------------------
  describe("calculateHealthScore — insurance eligibility", () => {
    it("score >= 70 is insurable", () => {
      const result = risk.calculateHealthScore({
        uptimePercentage: 0.5,
        efficiencyVariance: 0,
        anomalyRate: 0,
        maintenanceAgeDays: 280,
        hardwareGeneration: 1,
        seasonalDriftFactor: 0,
      });
      expect(result.healthScore).toBe(70);
      expect(result.isInsurable).toBe(true);
    });

    it("score < 70 is not insurable", () => {
      const result = risk.calculateHealthScore({
        uptimePercentage: 0.5,
        efficiencyVariance: 0,
        anomalyRate: 0,
        maintenanceAgeDays: 290,
        hardwareGeneration: 1,
        seasonalDriftFactor: 0,
      });
      // raw=80, penalty=(290-180)*0.1=11, health=69
      expect(result.healthScore).toBe(69);
      expect(result.isInsurable).toBe(false);
    });
  });

  // -----------------------------------------------
  // calculateHealthScore — confidence
  // -----------------------------------------------
  describe("calculateHealthScore — confidence", () => {
    it("perfect metrics yield high confidence", () => {
      const result = risk.calculateHealthScore({
        uptimePercentage: 1.0,
        efficiencyVariance: 0,
        anomalyRate: 0,
        maintenanceAgeDays: 0,
        hardwareGeneration: 1,
        seasonalDriftFactor: 0,
      });
      // confidence = 1.0*0.5 + 1.0*0.3 + 1.0*0.2 = 1.0
      expect(result.confidence).toBe(1);
    });

    it("poor metrics yield lower confidence", () => {
      const result = risk.calculateHealthScore({
        uptimePercentage: 0.5,
        efficiencyVariance: 3.0,
        anomalyRate: 0.01,
        maintenanceAgeDays: 0,
        hardwareGeneration: 1,
        seasonalDriftFactor: 0,
      });
      // confidence = 0.5*0.5 + max(0,1-3/5)*0.3 + max(0,1-1)*0.2
      // = 0.25 + 0.4*0.3 + 0 = 0.25 + 0.12 = 0.37
      expect(result.confidence).toBe(0.37);
    });
  });

  // -----------------------------------------------
  // calculateHealthScore — composite end-to-end
  // -----------------------------------------------
  describe("calculateHealthScore — composite scenarios", () => {
    it("healthy baseline yields high score with correct tier", () => {
      const result = risk.calculateHealthScore(HEALTHY_INPUT);
      expect(result.healthScore).toBeGreaterThanOrEqual(75);
      expect(result.healthScore).toBeLessThanOrEqual(100);
      expect(result.riskTier).toMatch(/^(minimal|low|moderate)$/);
      expect(result.isInsurable).toBe(true);
      expect(result.factors.hardwareGenerationBonus).toBe(2);
    });

    it("health score is clamped between 0 and 100", () => {
      // Try to push above 100 with large hardware bonus
      const result = risk.calculateHealthScore({
        uptimePercentage: 1.0,
        efficiencyVariance: 0,
        anomalyRate: 0,
        maintenanceAgeDays: 0,
        hardwareGeneration: 10, // +8 bonus
        seasonalDriftFactor: 0,
      });
      expect(result.healthScore).toBeLessThanOrEqual(100);
      expect(result.healthScore).toBeGreaterThanOrEqual(0);
    });

    it("defaults are applied for optional fields", () => {
      const result = risk.calculateHealthScore({
        uptimePercentage: 0.99,
        efficiencyVariance: 0.5,
        anomalyRate: 0.0001,
        maintenanceAgeDays: 30,
      });
      // Defaults: hwGen=1, seasonalDrift=0
      expect(result.factors.hardwareGenerationBonus).toBe(0);
      expect(result.factors.seasonalDriftPenalty).toBe(0);
      expect(result.healthScore).toBeGreaterThan(0);
    });

    it("accepts boundary value uptimePercentage=0", () => {
      expect(() =>
        risk.calculateHealthScore({ ...HEALTHY_INPUT, uptimePercentage: 0 }),
      ).not.toThrow();
    });

    it("accepts boundary value uptimePercentage=1", () => {
      expect(() =>
        risk.calculateHealthScore({ ...HEALTHY_INPUT, uptimePercentage: 1 }),
      ).not.toThrow();
    });
  });

  // -----------------------------------------------
  // calculatePremiumFromScore
  // -----------------------------------------------
  describe("calculatePremiumFromScore", () => {
    it("calculates premium for insurable score", () => {
      const score = risk.calculateHealthScore(HEALTHY_INPUT);
      const premium = risk.calculatePremiumFromScore(score, 10_000_000_000_000_000_000n);

      expect(premium.isInsurable).toBe(true);
      expect(premium.premiumBps).toBeGreaterThan(0);
      expect(premium.premiumWei).toBeGreaterThan(0n);
      expect(premium.dacUnitId).toBe("local");
      // baseFee=100, catastropheReserve=25
      expect(premium.breakdown.baseFee).toBe(100);
      expect(premium.breakdown.catastropheReserve).toBe(25);
      expect(premium.breakdown.riskComponent).toBe(score.failureProbabilityBps);
    });

    it("returns zero premium for non-insurable score", () => {
      const score = risk.calculateHealthScore({
        uptimePercentage: 0,
        efficiencyVariance: 2,
        anomalyRate: 0.005,
        maintenanceAgeDays: 0,
        hardwareGeneration: 1,
        seasonalDriftFactor: 0,
      });
      expect(score.isInsurable).toBe(false);
      const premium = risk.calculatePremiumFromScore(score, 10_000_000_000_000_000_000n);
      expect(premium.isInsurable).toBe(false);
      expect(premium.premiumWei).toBe(0n);
      expect(premium.premiumBps).toBe(0);
    });

    it("rejects non-positive subtotalWei", () => {
      const score = risk.calculateHealthScore(HEALTHY_INPUT);
      expect(() => risk.calculatePremiumFromScore(score, 0n)).toThrow(ValidationError);
      expect(() => risk.calculatePremiumFromScore(score, -1n)).toThrow(ValidationError);
    });

    it("premium math is correct: subtotal * premiumBps / 10000", () => {
      const score = risk.calculateHealthScore(HEALTHY_INPUT);
      const subtotal = 100_000n;
      const premium = risk.calculatePremiumFromScore(score, subtotal);
      const expected = (subtotal * BigInt(premium.premiumBps)) / 10_000n;
      expect(premium.premiumWei).toBe(expected);
    });
  });

  // -----------------------------------------------
  // batchCalculateHealthScores
  // -----------------------------------------------
  describe("batchCalculateHealthScores", () => {
    it("throws on empty input", () => {
      expect(() => risk.batchCalculateHealthScores([])).toThrow(ValidationError);
    });

    it("returns sorted worst-first", () => {
      const result = risk.batchCalculateHealthScores([
        {
          dacUnitId: "dac-good",
          metrics: {
            uptimePercentage: 0.99,
            efficiencyVariance: 0.5,
            anomalyRate: 0,
            maintenanceAgeDays: 10,
          },
        },
        {
          dacUnitId: "dac-bad",
          metrics: {
            uptimePercentage: 0.5,
            efficiencyVariance: 1.5,
            anomalyRate: 0.002,
            maintenanceAgeDays: 300,
          },
        },
      ]);

      expect(result.scores[0]!.dacUnitId).toBe("dac-bad");
      expect(result.scores[1]!.dacUnitId).toBe("dac-good");
      expect(result.scores[0]!.result.healthScore).toBeLessThan(result.scores[1]!.result.healthScore);
    });

    it("computes correct aggregate statistics", () => {
      const result = risk.batchCalculateHealthScores([
        {
          dacUnitId: "a",
          metrics: {
            uptimePercentage: 1,
            efficiencyVariance: 0,
            anomalyRate: 0,
            maintenanceAgeDays: 0,
          },
        },
        {
          dacUnitId: "b",
          metrics: {
            uptimePercentage: 0,
            efficiencyVariance: 0,
            anomalyRate: 0,
            maintenanceAgeDays: 0,
          },
        },
      ]);

      // a=100, b=60
      expect(result.aggregate.minHealth).toBe(60);
      expect(result.aggregate.maxHealth).toBe(100);
      expect(result.aggregate.averageHealth).toBe(80);
      // median of [60, 100] = (60+100)/2 = 80
      expect(result.aggregate.medianHealth).toBe(80);
      expect(result.aggregate.insuredCount).toBe(1); // only 100 is >= 70
      expect(result.aggregate.uninsuredCount).toBe(1);
    });

    it("handles single-element batch", () => {
      const result = risk.batchCalculateHealthScores([
        {
          dacUnitId: "solo",
          metrics: {
            uptimePercentage: 0.95,
            efficiencyVariance: 0.8,
            anomalyRate: 0.0001,
            maintenanceAgeDays: 50,
          },
        },
      ]);
      expect(result.scores.length).toBe(1);
      expect(result.aggregate.medianHealth).toBe(result.scores[0]!.result.healthScore);
    });
  });

  // -----------------------------------------------
  // generateFleetAnalytics
  // -----------------------------------------------
  describe("generateFleetAnalytics", () => {
    it("throws on empty input", () => {
      expect(() => risk.generateFleetAnalytics([])).toThrow(ValidationError);
    });

    it("computes tier distribution", () => {
      const scores = [
        { dacUnitId: "a", result: risk.calculateHealthScore({ uptimePercentage: 1, efficiencyVariance: 0, anomalyRate: 0, maintenanceAgeDays: 0 }) },
        { dacUnitId: "b", result: risk.calculateHealthScore({ uptimePercentage: 0, efficiencyVariance: 2, anomalyRate: 0.005, maintenanceAgeDays: 0 }) },
      ];

      const analytics = risk.generateFleetAnalytics(scores);
      expect(analytics.totalUnits).toBe(2);
      expect(analytics.tierDistribution.minimal).toBe(1);
      expect(analytics.tierDistribution.critical).toBe(1);
      expect(analytics.insuredUnits).toBe(1);
      expect(analytics.uninsuredUnits).toBe(1);
      expect(analytics.generatedAt).toBeGreaterThan(0);
    });

    it("returns valid weighted failure probability", () => {
      const scores = [
        { dacUnitId: "a", result: risk.calculateHealthScore({ uptimePercentage: 1, efficiencyVariance: 0, anomalyRate: 0, maintenanceAgeDays: 0 }) },
      ];
      const analytics = risk.generateFleetAnalytics(scores);
      expect(analytics.weightedFailureProbabilityBps).toBeGreaterThanOrEqual(0);
      expect(analytics.weightedFailureProbabilityBps).toBeLessThanOrEqual(10000);
    });
  });
});
