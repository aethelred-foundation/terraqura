/**
 * Sovereign module tests.
 *
 * Tests national inventory management, strategic reserves,
 * CBAM report generation, carbon repo terminal operations,
 * and Aethelred chain-specific features.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ethers } from "ethers";

import { SovereignModule } from "./sovereign.js";
import { ValidationError } from "../errors.js";
import {
  mockTelemetry,
  buildTestConfig,
  buildMockProvenance,
  mockFetch,
  TEST_ADDRESSES,
  TEST_DAC_UNIT_ID,
} from "../__test__/helpers.js";

import type { AssetsModule } from "./assets.js";
import type { ComplianceModule } from "./compliance.js";
import type { InsuranceModule } from "./insurance.js";
import type { RiskModule } from "./risk.js";
import type { MRVModule } from "./mrv.js";

// ============================================
// Mock Dependencies
// ============================================

function createMockAssets(): AssetsModule {
  return {
    getProvenance: vi.fn().mockResolvedValue(buildMockProvenance("42")),
    getTotalMinted: vi.fn().mockResolvedValue(500000n),
    getTotalRetired: vi.fn().mockResolvedValue(200000n),
  } as unknown as AssetsModule;
}

function createMockCompliance(): ComplianceModule {
  return {
    getProvenanceProof: vi.fn().mockResolvedValue({
      tokenId: "42",
      provenance: buildMockProvenance("42"),
      integrityHash: "0x" + "aa".repeat(32),
      verificationSummary: {
        sourceVerified: true,
        logicVerified: true,
        mintVerified: true,
        allPhasesPassed: true,
      },
    }),
  } as unknown as ComplianceModule;
}

function createMockInsurance(): InsuranceModule {
  return {
    getBufferPoolStatus: vi.fn().mockReturnValue({
      totalCreditsTonnes: 10000,
      reservedCreditsTonnes: 2000,
      availableCreditsTonnes: 8000,
      totalInsuredTonnes: 5000,
      coverageRatio: 1.6,
      activePolicies: 25,
    }),
    getTreasuryAnalytics: vi.fn().mockReturnValue({
      currentFloatWei: ethers.parseEther("100"),
      activePolicies: 25,
      totalPremiumsCollectedWei: ethers.parseEther("50"),
      totalClaimsPaidWei: ethers.parseEther("10"),
      lossRatio: 0.2,
      combinedRatio: 0.35,
      averagePolicyDurationDays: 90,
      bufferPool: {
        totalCreditsTonnes: 10000,
        reservedCreditsTonnes: 2000,
        availableCreditsTonnes: 8000,
        totalInsuredTonnes: 5000,
        coverageRatio: 1.6,
        activePolicies: 25,
      },
      generatedAt: Date.now(),
    }),
  } as unknown as InsuranceModule;
}

function createMockRisk(): RiskModule {
  return {
    getRiskProfile: vi.fn().mockResolvedValue({
      healthScore: 85,
      riskTier: "low",
      failureProbabilityBps: 100,
      isInsured: true,
    }),
    generateFleetAnalytics: vi.fn().mockReturnValue({
      totalUnits: 5,
      insuredUnits: 4,
      averageHealthScore: 85,
      medianHealthScore: 87,
      riskDistribution: { low: 3, medium: 1, high: 0, critical: 1 },
      totalFailureProbability: 500,
      highestRiskUnit: { dacUnitId: TEST_DAC_UNIT_ID, healthScore: 25 },
      lowestRiskUnit: { dacUnitId: "dac-002", healthScore: 95 },
    }),
    calculateHealthScore: vi.fn().mockReturnValue({
      healthScore: 85,
      failureProbabilityBps: 100,
      riskTier: "low",
      isInsurable: true,
      factors: {
        uptimeScore: 90,
        stabilityScore: 85,
        integrityScore: 88,
        maintenanceAgePenalty: 5,
        hardwareGenerationBonus: 3,
        seasonalDriftPenalty: 2,
      },
      confidence: 0.9,
    }),
  } as unknown as RiskModule;
}

function createMockMRV(): MRVModule {
  return {
    getWhitelistedUnits: vi.fn().mockResolvedValue([
      { dacUnitId: TEST_DAC_UNIT_ID, operator: TEST_ADDRESSES.operator, isWhitelisted: true },
      { dacUnitId: "0xbbbb", operator: TEST_ADDRESSES.user, isWhitelisted: true },
    ]),
  } as unknown as MRVModule;
}

describe("SovereignModule", () => {
  let sovereign: SovereignModule;
  let telemetry: ReturnType<typeof mockTelemetry>;
  let assets: ReturnType<typeof createMockAssets>;
  let compliance: ReturnType<typeof createMockCompliance>;
  let insurance: ReturnType<typeof createMockInsurance>;
  let risk: ReturnType<typeof createMockRisk>;
  let mrv: ReturnType<typeof createMockMRV>;

  beforeEach(() => {
    vi.clearAllMocks();
    telemetry = mockTelemetry();
    assets = createMockAssets();
    compliance = createMockCompliance();
    insurance = createMockInsurance();
    risk = createMockRisk();
    mrv = createMockMRV();

    const config = buildTestConfig();
    sovereign = new SovereignModule(
      config,
      telemetry,
      assets as unknown as AssetsModule,
      compliance as unknown as ComplianceModule,
      insurance as unknown as InsuranceModule,
      risk as unknown as RiskModule,
      mrv as unknown as MRVModule,
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ============================================
  // getNationalInventory
  // ============================================

  describe("getNationalInventory", () => {
    const validInput = {
      country: "AE",
      reportingPeriod: { start: "2026-01-01", end: "2026-06-30" },
    };

    it("generates national inventory with minted/retired totals", async () => {
      const inventory = await sovereign.getNationalInventory(validInput);

      expect(inventory.country).toBe("AE");
      expect(inventory.totalCreditsMinted).toBe(500000);
      expect(inventory.totalCreditsRetired).toBe(200000);
      expect(inventory.activeCredits).toBe(300000);
      expect(inventory.totalCO2RemovedKg).toBe(500000);
      expect(inventory.totalCO2RemovedTonnes).toBeCloseTo(500);
      expect(inventory.reportHash).toMatch(/^0x[a-fA-F0-9]{64}$/);
    });

    it("includes DAC fleet health data", async () => {
      const inventory = await sovereign.getNationalInventory(validInput);

      expect(inventory.activeDACUnits).toBe(2);
      expect(inventory.averageFleetHealth).toBeGreaterThan(0);
    });

    it("calculates Paris Agreement NDC progress", async () => {
      const inventory = await sovereign.getNationalInventory({
        ...validInput,
        ndcTargetTonnesPerYear: 1000,
      });

      expect(inventory.parisAgreementProgress).not.toBeNull();
      expect(inventory.ndcTargetTonnesPerYear).toBe(1000);
    });

    it("returns null NDC progress when no target set", async () => {
      const inventory = await sovereign.getNationalInventory(validInput);

      expect(inventory.parisAgreementProgress).toBeNull();
      expect(inventory.ndcTargetTonnesPerYear).toBeNull();
    });

    it("includes sector breakdown when requested", async () => {
      const inventory = await sovereign.getNationalInventory({
        ...validInput,
        includeSectorBreakdown: true,
      });

      expect(inventory.sectorBreakdown).not.toBeNull();
      expect(inventory.sectorBreakdown!.length).toBeGreaterThan(0);
    });

    it("includes operator breakdown when requested", async () => {
      const inventory = await sovereign.getNationalInventory({
        ...validInput,
        includeOperatorBreakdown: true,
      });

      expect(inventory.operatorBreakdown).not.toBeNull();
      expect(inventory.operatorBreakdown!.length).toBeGreaterThan(0);
    });

    it("filters by operator addresses", async () => {
      const inventory = await sovereign.getNationalInventory({
        ...validInput,
        operatorAddresses: [TEST_ADDRESSES.operator],
      });

      // Only one unit matches the operator filter
      expect(inventory.activeDACUnits).toBe(1);
    });

    it("throws ValidationError for invalid country code", async () => {
      await expect(
        sovereign.getNationalInventory({
          ...validInput,
          country: "INVALID",
        }),
      ).rejects.toThrow(ValidationError);
    });

    it("throws ValidationError for invalid reporting period", async () => {
      await expect(
        sovereign.getNationalInventory({
          ...validInput,
          reportingPeriod: { start: "2026-06-30", end: "2026-01-01" },
        }),
      ).rejects.toThrow(ValidationError);
    });

    it("throws ValidationError for negative NDC target", async () => {
      await expect(
        sovereign.getNationalInventory({
          ...validInput,
          ndcTargetTonnesPerYear: -100,
        }),
      ).rejects.toThrow(ValidationError);
    });

    it("handles subgraph unavailability gracefully", async () => {
      (mrv.getWhitelistedUnits as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("Subgraph unavailable"),
      );

      const inventory = await sovereign.getNationalInventory(validInput);

      // Should still return data, just with zero DAC units
      expect(inventory.activeDACUnits).toBe(0);
      expect(inventory.averageFleetHealth).toBe(0);
    });
  });

  // ============================================
  // getStrategicReserve
  // ============================================

  describe("getStrategicReserve", () => {
    it("returns strategic reserve assessment", async () => {
      const reserve = await sovereign.getStrategicReserve();

      expect(reserve.bufferPool).toBeDefined();
      expect(reserve.reserveAdequacy).toBeDefined();
      expect(["SOVEREIGN", "SECURE", "ADEQUATE", "LOW_RESERVE", "CRITICAL"]).toContain(
        reserve.reserveAdequacy,
      );
      expect(reserve.insuranceMetrics.activePolicies).toBe(25);
      expect(reserve.insuranceFloatWei).toBe(ethers.parseEther("100"));
    });

    it("calculates CBAM exposure when provided", async () => {
      const reserve = await sovereign.getStrategicReserve(45_000_000);

      expect(reserve.cbamExposureUSD).toBe(45_000_000);
      expect(reserve.reserveToExposureRatio).toBeGreaterThan(0);
    });

    it("handles zero CBAM exposure", async () => {
      const reserve = await sovereign.getStrategicReserve(0);

      expect(reserve.cbamExposureUSD).toBe(0);
      expect(reserve.reserveToExposureRatio).toBe(0);
    });

    it("includes security assessment", async () => {
      const reserve = await sovereign.getStrategicReserve();

      expect(reserve.securityAssessment).toBeDefined();
      expect(typeof reserve.securityAssessment.cbamReady).toBe("boolean");
      expect(typeof reserve.securityAssessment.singleFailureProtected).toBe("boolean");
      expect(typeof reserve.securityAssessment.twelveMonthRunway).toBe("boolean");
    });

    it("calculates coverage days remaining", async () => {
      const reserve = await sovereign.getStrategicReserve();

      expect(reserve.coverageDaysRemaining).toBeGreaterThan(0);
    });
  });

  // ============================================
  // getIndustrialHealth
  // ============================================

  describe("getIndustrialHealth", () => {
    it("returns fleet health dashboard", async () => {
      const health = await sovereign.getIndustrialHealth();

      expect(health.totalUnits).toBe(2);
      expect(health.overallReadiness).toBeDefined();
      expect(health.unitSummaries.length).toBeGreaterThan(0);
    });

    it("sorts unit summaries worst-first", async () => {
      // Two units with different health scores
      (risk.getRiskProfile as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({
          healthScore: 20,
          riskTier: "critical",
          failureProbabilityBps: 500,
          isInsured: false,
        })
        .mockResolvedValueOnce({
          healthScore: 90,
          riskTier: "low",
          failureProbabilityBps: 50,
          isInsured: true,
        });

      const health = await sovereign.getIndustrialHealth();

      expect(health.unitSummaries[0].healthScore).toBeLessThanOrEqual(
        health.unitSummaries[1].healthScore!,
      );
    });

    it("classifies units into operational/degraded/critical", async () => {
      (risk.getRiskProfile as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({
          healthScore: 85,
          riskTier: "low",
          failureProbabilityBps: 100,
          isInsured: true,
        })
        .mockResolvedValueOnce({
          healthScore: 20,
          riskTier: "critical",
          failureProbabilityBps: 800,
          isInsured: false,
        });

      const health = await sovereign.getIndustrialHealth();

      expect(health.operationalUnits).toBe(1);
      expect(health.criticalUnits).toBe(1);
      expect(health.criticalAlerts).toBe(1);
    });

    it("handles empty fleet (no DAC units)", async () => {
      (mrv.getWhitelistedUnits as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const health = await sovereign.getIndustrialHealth();

      expect(health.totalUnits).toBe(0);
      expect(health.fleetAnalytics).toBeNull();
    });

    it("handles Risk Oracle failures gracefully", async () => {
      (risk.getRiskProfile as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("Oracle not deployed"),
      );

      const health = await sovereign.getIndustrialHealth();

      // Should fallback to synthetic estimates for whitelisted units
      expect(health.totalUnits).toBe(2);
      expect(health.unitSummaries[0].healthScore).toBe(85); // Synthetic
    });
  });

  // ============================================
  // generateCBAMReport
  // ============================================

  describe("generateCBAMReport", () => {
    const validCBAMInput = {
      exporterName: "ADNOC Refining",
      exporterCountry: "AE",
      importerCountry: "DE",
      goods: [
        { hsCode: "7206", description: "Iron & Steel", volumeTonnes: 50000 },
      ],
      reportingPeriod: { start: "2026-01-01", end: "2026-03-31" },
    };

    it("generates a CBAM compliance report", async () => {
      const report = await sovereign.generateCBAMReport(validCBAMInput);

      expect(report.reportId).toMatch(/^tqcbam_/);
      expect(report.exporter.name).toBe("ADNOC Refining");
      expect(report.exporter.country).toBe("AE");
      expect(report.importerCountry).toBe("DE");
      expect(report.goods).toHaveLength(1);
      expect(report.goods[0].totalEmbeddedEmissionsTCO2).toBeGreaterThan(0);
      expect(report.summary.totalGoodsVolumeTonnes).toBe(50000);
    });

    it("uses EU default emissions factors for known HS codes", async () => {
      const report = await sovereign.generateCBAMReport(validCBAMInput);

      // 7206 = Iron & Steel, default factor = 1.85 tCO2/tonne
      expect(report.goods[0].totalEmbeddedEmissionsTCO2).toBeCloseTo(50000 * 1.85, 0);
    });

    it("applies offset tokens to reduce emissions", async () => {
      const report = await sovereign.generateCBAMReport({
        ...validCBAMInput,
        offsetTokenIds: ["42", "43"],
      });

      expect(report.offsetVerification.tokenIds).toHaveLength(2);
      expect(report.offsetVerification.totalOffsetCO2Tonnes).toBeGreaterThan(0);
      expect(report.summary.totalOffsetTCO2).toBeGreaterThan(0);
      expect(report.summary.netEmissionsTCO2).toBeLessThan(
        report.summary.totalEmbeddedEmissionsTCO2,
      );
    });

    it("calculates CBAM liability in EUR", async () => {
      const report = await sovereign.generateCBAMReport(validCBAMInput);

      expect(report.summary.estimatedCBAMLiabilityEUR).toBeGreaterThan(0);
      expect(report.summary.netCBAMLiabilityEUR).toBeGreaterThanOrEqual(0);
    });

    it("credits domestic carbon price when provided", async () => {
      const report = await sovereign.generateCBAMReport({
        ...validCBAMInput,
        domesticCarbonPriceUSD: 20,
      });

      expect(report.summary.domesticCarbonCreditEUR).toBeGreaterThan(0);
      expect(report.summary.netCBAMLiabilityEUR).toBeLessThan(
        report.summary.estimatedCBAMLiabilityEUR,
      );
    });

    it("throws for missing exporter name", async () => {
      await expect(
        sovereign.generateCBAMReport({
          ...validCBAMInput,
          exporterName: "",
        }),
      ).rejects.toThrow(ValidationError);
    });

    it("throws for empty goods array", async () => {
      await expect(
        sovereign.generateCBAMReport({
          ...validCBAMInput,
          goods: [],
        }),
      ).rejects.toThrow(ValidationError);
    });

    it("throws for zero volume in goods", async () => {
      await expect(
        sovereign.generateCBAMReport({
          ...validCBAMInput,
          goods: [{ hsCode: "7206", description: "Steel", volumeTonnes: 0 }],
        }),
      ).rejects.toThrow(ValidationError);
    });

    it("throws for invalid country codes", async () => {
      await expect(
        sovereign.generateCBAMReport({
          ...validCBAMInput,
          exporterCountry: "INVALID",
        }),
      ).rejects.toThrow(ValidationError);
    });
  });

  // ============================================
  // valuateCollateral (Carbon Repo Terminal)
  // ============================================

  describe("valuateCollateral", () => {
    const validCollateralInput = {
      tokenIds: ["42", "43", "44"],
      totalCO2Tonnes: 5000,
      averageHealthScore: 92,
      insuranceCoverage: "full-replacement" as const,
      currentMarketPriceUSD: 120,
    };

    it("returns collateral valuation with haircut", () => {
      const valuation = sovereign.valuateCollateral(validCollateralInput);

      expect(valuation.grossValueUSD).toBe(5000 * 120);
      expect(valuation.haircutPercentage).toBeGreaterThan(0);
      expect(valuation.haircutPercentage).toBeLessThan(100);
      expect(valuation.collateralValueUSD).toBeLessThan(valuation.grossValueUSD);
      expect(valuation.collateralValueUSD).toBeGreaterThan(0);
      expect(valuation.eligibleForRepo).toBe(true);
    });

    it("reduces haircut for full insurance coverage", () => {
      const fullInsurance = sovereign.valuateCollateral(validCollateralInput);
      const noInsurance = sovereign.valuateCollateral({
        ...validCollateralInput,
        insuranceCoverage: "none",
      });

      expect(fullInsurance.haircutPercentage).toBeLessThan(
        noInsurance.haircutPercentage,
      );
    });

    it("increases haircut for low health scores", () => {
      const highHealth = sovereign.valuateCollateral(validCollateralInput);
      const lowHealth = sovereign.valuateCollateral({
        ...validCollateralInput,
        averageHealthScore: 65,
      });

      expect(lowHealth.haircutPercentage).toBeGreaterThan(
        highHealth.haircutPercentage,
      );
    });

    it("marks collateral ineligible when health score is below threshold", () => {
      const valuation = sovereign.valuateCollateral({
        ...validCollateralInput,
        averageHealthScore: 50,
      });

      expect(valuation.eligibleForRepo).toBe(false);
      expect(valuation.ineligibilityReasons.length).toBeGreaterThan(0);
    });

    it("includes haircut breakdown components", () => {
      const valuation = sovereign.valuateCollateral(validCollateralInput);

      expect(valuation.haircutBreakdown).toBeDefined();
      expect(typeof valuation.haircutBreakdown.marketRiskPct).toBe("number");
      expect(typeof valuation.haircutBreakdown.healthAdjustmentPct).toBe("number");
      expect(typeof valuation.haircutBreakdown.insuranceCreditPct).toBe("number");
    });

    it("adjusts for loan tenor", () => {
      const shortTenor = sovereign.valuateCollateral({
        ...validCollateralInput,
        loanTenorDays: 30,
      });
      const longTenor = sovereign.valuateCollateral({
        ...validCollateralInput,
        loanTenorDays: 365,
      });

      expect(longTenor.haircutPercentage).toBeGreaterThanOrEqual(
        shortTenor.haircutPercentage,
      );
    });

    it("includes valuation metadata", () => {
      const valuation = sovereign.valuateCollateral(validCollateralInput);

      expect(valuation.metadata.tokenCount).toBe(3);
      expect(valuation.metadata.totalCO2Tonnes).toBe(5000);
      expect(valuation.metadata.marketPriceUSD).toBe(120);
      expect(valuation.metadata.valuedAt).toBeGreaterThan(0);
    });
  });
});
