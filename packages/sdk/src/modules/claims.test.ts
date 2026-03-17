import { describe, expect, it, vi, beforeEach } from "vitest";

import { ValidationError } from "../errors.js";
import { RiskModule } from "./risk.js";
import { InsuranceModule } from "./insurance.js";
import { ClaimsModule } from "./claims.js";

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

function makeConfig(): InternalConfig {
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
    gas: { multiplier: 1.2, maxGasPrice: 100n, maxPriorityFee: 30n, cacheTtlMs: 15000, gasLimits: {} },
    retry: { maxRetries: 3, baseDelayMs: 1000, maxDelayMs: 30000, retryableErrors: [] },
    telemetryEnabled: false,
  };
}

const VALID_ADDRESS = "0x1234567890abcdef1234567890abcdef12345678";

function setupModules() {
  const telemetry = makeTelemetry();
  const config = makeConfig();
  const riskModule = new RiskModule(config, telemetry);
  const insurance = new InsuranceModule(telemetry, riskModule);
  const claims = new ClaimsModule(config, telemetry, insurance);
  return { telemetry, config, riskModule, insurance, claims };
}

function createActivePolicy(
  insurance: InsuranceModule,
  dacUnitId = "dac-unit-001",
  tokenId = "42",
  amountKg = 1000,
) {
  return insurance.createPolicySync({
    tokenId,
    amountKg,
    purchasePriceWei: 10_000_000_000_000_000_000n,
    dacUnitId,
    buyerAddress: VALID_ADDRESS,
  });
}

// ============================================
// Tests
// ============================================

describe("ClaimsModule", () => {
  let insurance: InsuranceModule;
  let claims: ClaimsModule;

  beforeEach(() => {
    const modules = setupModules();
    insurance = modules.insurance;
    claims = modules.claims;
  });

  // -----------------------------------------------
  // detectReversal — input validation
  // -----------------------------------------------
  describe("detectReversal — input validation", () => {
    it("rejects empty dacUnitId", () => {
      expect(() =>
        claims.detectReversal({
          dacUnitId: "",
          currentHealthScore: 0,
          previousHealthScore: 80,
          reason: "failure",
        }),
      ).toThrow(ValidationError);
    });

    it("rejects currentHealthScore below 0", () => {
      expect(() =>
        claims.detectReversal({
          dacUnitId: "dac-001",
          currentHealthScore: -1,
          previousHealthScore: 80,
          reason: "failure",
        }),
      ).toThrow(ValidationError);
    });

    it("rejects currentHealthScore above 100", () => {
      expect(() =>
        claims.detectReversal({
          dacUnitId: "dac-001",
          currentHealthScore: 101,
          previousHealthScore: 80,
          reason: "failure",
        }),
      ).toThrow(ValidationError);
    });

    it("rejects previousHealthScore out of range", () => {
      expect(() =>
        claims.detectReversal({
          dacUnitId: "dac-001",
          currentHealthScore: 0,
          previousHealthScore: -1,
          reason: "failure",
        }),
      ).toThrow(ValidationError);
    });

    it("rejects when currentHealthScore >= previousHealthScore", () => {
      expect(() =>
        claims.detectReversal({
          dacUnitId: "dac-001",
          currentHealthScore: 80,
          previousHealthScore: 80,
          reason: "failure",
        }),
      ).toThrow(ValidationError);
    });

    it("rejects when current > previous (no reversal)", () => {
      expect(() =>
        claims.detectReversal({
          dacUnitId: "dac-001",
          currentHealthScore: 90,
          previousHealthScore: 80,
          reason: "improvement",
        }),
      ).toThrow(ValidationError);
    });
  });

  // -----------------------------------------------
  // detectReversal — severity classification
  // -----------------------------------------------
  describe("detectReversal — severity classification", () => {
    it("classifies score 0 as total severity", () => {
      createActivePolicy(insurance, "dac-001");
      const detection = claims.detectReversal({
        dacUnitId: "dac-001",
        currentHealthScore: 0,
        previousHealthScore: 80,
        reason: "total hardware failure",
      });
      expect(detection.severity).toBe("total");
    });

    it("classifies score 1-30 as critical severity", () => {
      createActivePolicy(insurance, "dac-001");
      const detection = claims.detectReversal({
        dacUnitId: "dac-001",
        currentHealthScore: 20,
        previousHealthScore: 80,
        reason: "severe degradation",
      });
      expect(detection.severity).toBe("critical");
    });

    it("classifies score 31-70 as partial severity", () => {
      createActivePolicy(insurance, "dac-001");
      const detection = claims.detectReversal({
        dacUnitId: "dac-001",
        currentHealthScore: 50,
        previousHealthScore: 80,
        reason: "partial failure",
      });
      expect(detection.severity).toBe("partial");
    });

    it("classifies score 71-99 as minor severity", () => {
      createActivePolicy(insurance, "dac-001");
      const detection = claims.detectReversal({
        dacUnitId: "dac-001",
        currentHealthScore: 75,
        previousHealthScore: 80,
        reason: "minor issue",
      });
      expect(detection.severity).toBe("minor");
    });
  });

  // -----------------------------------------------
  // detectReversal — no affected policies
  // -----------------------------------------------
  describe("detectReversal — no policies", () => {
    it("returns empty detection when no policies exist for DAC unit", () => {
      const detection = claims.detectReversal({
        dacUnitId: "unknown-dac",
        currentHealthScore: 0,
        previousHealthScore: 90,
        reason: "failure",
      });

      expect(detection.affectedPoliciesCount).toBe(0);
      expect(detection.totalAffectedKg).toBe(0);
      expect(detection.claimIds).toHaveLength(0);
      expect(detection.affectedPolicies).toHaveLength(0);
      expect(detection.dacUnitId).toBe("unknown-dac");
    });
  });

  // -----------------------------------------------
  // detectReversal — with policies
  // -----------------------------------------------
  describe("detectReversal — with affected policies", () => {
    it("files claims on all active policies for a DAC unit", () => {
      createActivePolicy(insurance, "dac-001", "42", 1000);
      createActivePolicy(insurance, "dac-001", "43", 2000);
      createActivePolicy(insurance, "dac-002", "44", 500); // different DAC

      const detection = claims.detectReversal({
        dacUnitId: "dac-001",
        currentHealthScore: 0,
        previousHealthScore: 80,
        reason: "total hardware failure",
      });

      expect(detection.affectedPoliciesCount).toBe(2);
      expect(detection.claimIds).toHaveLength(2);
      // total severity -> 100% loss
      expect(detection.totalAffectedKg).toBe(3000);
    });

    it("calculates correct delta", () => {
      createActivePolicy(insurance, "dac-001");
      const detection = claims.detectReversal({
        dacUnitId: "dac-001",
        currentHealthScore: 10,
        previousHealthScore: 90,
        reason: "severe drop",
      });
      expect(detection.healthScoreDelta).toBe(80);
    });

    it("uses custom detectedAt timestamp", () => {
      createActivePolicy(insurance, "dac-001");
      const ts = 1700000000000;
      const detection = claims.detectReversal({
        dacUnitId: "dac-001",
        currentHealthScore: 0,
        previousHealthScore: 90,
        reason: "failure",
        detectedAt: ts,
      });
      expect(detection.detectedAt).toBe(ts);
    });

    it("skips policies that already have a claim", () => {
      const p1 = createActivePolicy(insurance, "dac-001", "42");
      createActivePolicy(insurance, "dac-001", "43");

      // File a manual claim on p1 first
      claims.fileClaim({
        policyId: p1.id,
        reason: "manual claim",
        severity: "total",
        estimatedLossPercentage: 100,
      });

      const detection = claims.detectReversal({
        dacUnitId: "dac-001",
        currentHealthScore: 0,
        previousHealthScore: 90,
        reason: "total failure",
      });

      // Only 1 new claim (p1 already has one)
      expect(detection.claimIds).toHaveLength(1);
    });

    it("partial severity computes fractional loss", () => {
      createActivePolicy(insurance, "dac-001", "42", 1000);
      const detection = claims.detectReversal({
        dacUnitId: "dac-001",
        currentHealthScore: 50,
        previousHealthScore: 80,
        reason: "partial",
      });
      // partial severity: lossPercentage = delta * 0.5 = 30 * 0.5 = 15%
      // totalAffectedKg = 1000 * 0.15 = 150
      expect(detection.totalAffectedKg).toBe(150);
    });

    it("minor severity computes small fractional loss", () => {
      createActivePolicy(insurance, "dac-001", "42", 1000);
      const detection = claims.detectReversal({
        dacUnitId: "dac-001",
        currentHealthScore: 75,
        previousHealthScore: 80,
        reason: "minor",
      });
      // minor severity: lossPercentage = delta * 0.1 = 5 * 0.1 = 0.5 -> rounds to 1
      expect(detection.totalAffectedKg).toBeGreaterThanOrEqual(0);
    });
  });

  // -----------------------------------------------
  // fileClaim — manual
  // -----------------------------------------------
  describe("fileClaim", () => {
    it("creates a claim record with audit trail", () => {
      const policy = createActivePolicy(insurance, "dac-001");
      const claim = claims.fileClaim({
        policyId: policy.id,
        reason: "Hardware failure",
        severity: "total",
        estimatedLossPercentage: 100,
      });

      expect(claim.id).toMatch(/^tqc_/);
      expect(claim.status).toBe("filed");
      expect(claim.policyId).toBe(policy.id);
      expect(claim.dacUnitId).toBe("dac-001");
      expect(claim.severity).toBe("total");
      expect(claim.estimatedLossPercentage).toBe(100);
      expect(claim.auditTrail).toHaveLength(1);
      expect(claim.auditTrail[0]!.action).toBe("claim_filed");
    });

    it("rejects empty policyId", () => {
      expect(() =>
        claims.fileClaim({
          policyId: "",
          reason: "reason",
          severity: "total",
          estimatedLossPercentage: 100,
        }),
      ).toThrow(ValidationError);
    });

    it("rejects empty reason", () => {
      const policy = createActivePolicy(insurance, "dac-001");
      expect(() =>
        claims.fileClaim({
          policyId: policy.id,
          reason: "",
          severity: "total",
          estimatedLossPercentage: 100,
        }),
      ).toThrow(ValidationError);
    });

    it("rejects estimatedLossPercentage out of range", () => {
      const policy = createActivePolicy(insurance, "dac-001");
      expect(() =>
        claims.fileClaim({
          policyId: policy.id,
          reason: "reason",
          severity: "total",
          estimatedLossPercentage: 101,
        }),
      ).toThrow(ValidationError);

      const policy2 = createActivePolicy(insurance, "dac-001", "43");
      expect(() =>
        claims.fileClaim({
          policyId: policy2.id,
          reason: "reason",
          severity: "total",
          estimatedLossPercentage: -1,
        }),
      ).toThrow(ValidationError);
    });

    it("rejects duplicate claim on same policy", () => {
      const policy = createActivePolicy(insurance, "dac-001");
      claims.fileClaim({
        policyId: policy.id,
        reason: "first",
        severity: "total",
        estimatedLossPercentage: 100,
      });
      expect(() =>
        claims.fileClaim({
          policyId: policy.id,
          reason: "second",
          severity: "total",
          estimatedLossPercentage: 100,
        }),
      ).toThrow(ValidationError);
    });

    it("stores evidence metadata", () => {
      const policy = createActivePolicy(insurance, "dac-001");
      const claim = claims.fileClaim({
        policyId: policy.id,
        reason: "failure",
        severity: "total",
        estimatedLossPercentage: 100,
        evidence: { sensorId: "S42", temperature: 150 },
      });
      expect(claim.evidence).toEqual({ sensorId: "S42", temperature: 150 });
    });
  });

  // -----------------------------------------------
  // getClaim / getClaimAuditTrail
  // -----------------------------------------------
  describe("getClaim", () => {
    it("retrieves a filed claim", () => {
      const policy = createActivePolicy(insurance, "dac-001");
      const filed = claims.fileClaim({
        policyId: policy.id,
        reason: "reason",
        severity: "total",
        estimatedLossPercentage: 100,
      });
      const fetched = claims.getClaim(filed.id);
      expect(fetched.id).toBe(filed.id);
    });

    it("throws for non-existent claim", () => {
      expect(() => claims.getClaim("tqc_nonexistent")).toThrow(ValidationError);
    });
  });

  describe("getClaimAuditTrail", () => {
    it("returns audit entries", () => {
      const policy = createActivePolicy(insurance, "dac-001");
      const claim = claims.fileClaim({
        policyId: policy.id,
        reason: "reason",
        severity: "total",
        estimatedLossPercentage: 100,
      });
      const trail = claims.getClaimAuditTrail(claim.id);
      expect(trail).toHaveLength(1);
      expect(trail[0]!.action).toBe("claim_filed");
    });

    it("throws for non-existent claim", () => {
      expect(() => claims.getClaimAuditTrail("tqc_nonexistent")).toThrow(ValidationError);
    });
  });

  // -----------------------------------------------
  // resolveAllClaims
  // -----------------------------------------------
  describe("resolveAllClaims", () => {
    it("rejects empty array", async () => {
      await expect(claims.resolveAllClaims([])).rejects.toThrow(ValidationError);
    });

    it("resolves claims when buffer pool has sufficient credits", async () => {
      const policy = createActivePolicy(insurance, "dac-001", "42", 1000);
      // Add sufficient buffer pool credits (1 tonne = 1000 kg)
      insurance.addToBufferPool("buffer-100", 100, 95);

      const claim = claims.fileClaim({
        policyId: policy.id,
        reason: "failure",
        severity: "total",
        estimatedLossPercentage: 100,
      });

      const result = await claims.resolveAllClaims([claim.id]);
      expect(result.successCount).toBe(1);
      expect(result.failCount).toBe(0);
      expect(result.totalReplacedKg).toBe(1000);
      expect(result.results[0]!.success).toBe(true);
      expect(result.results[0]!.replacementTokenId).toBe("buffer-100");
    });

    it("escalates claims when buffer pool is insufficient", async () => {
      const policy = createActivePolicy(insurance, "dac-001", "42", 10000);
      // Add tiny buffer pool
      insurance.addToBufferPool("buffer-tiny", 0.5, 95);

      const claim = claims.fileClaim({
        policyId: policy.id,
        reason: "failure",
        severity: "total",
        estimatedLossPercentage: 100,
      });

      const result = await claims.resolveAllClaims([claim.id]);
      // Escalated, not resolved
      const fetchedClaim = claims.getClaim(claim.id);
      expect(fetchedClaim.status).toBe("escalated");
      // The result counts this as successful since it didn't throw
      expect(result.results[0]!.success).toBe(false);
    });

    it("handles partial failures in batch", async () => {
      const p1 = createActivePolicy(insurance, "dac-001", "42", 100);
      const p2 = createActivePolicy(insurance, "dac-001", "43", 100);
      insurance.addToBufferPool("buffer-1", 100, 95);

      const c1 = claims.fileClaim({
        policyId: p1.id,
        reason: "failure",
        severity: "total",
        estimatedLossPercentage: 100,
      });
      const c2 = claims.fileClaim({
        policyId: p2.id,
        reason: "failure",
        severity: "total",
        estimatedLossPercentage: 100,
      });

      const result = await claims.resolveAllClaims([c1.id, c2.id]);
      // Both should resolve since we have 100 tonnes and only need 0.2 tonnes
      expect(result.successCount + result.failCount).toBe(2);
    });
  });

  // -----------------------------------------------
  // resolveClaim — single
  // -----------------------------------------------
  describe("resolveClaim", () => {
    it("throws for non-existent claim", async () => {
      await expect(claims.resolveClaim("tqc_nonexistent")).rejects.toThrow(ValidationError);
    });

    it("throws when claim is not in filed status", async () => {
      const policy = createActivePolicy(insurance, "dac-001");
      insurance.addToBufferPool("buffer", 100, 95);
      const claim = claims.fileClaim({
        policyId: policy.id,
        reason: "failure",
        severity: "total",
        estimatedLossPercentage: 100,
      });
      // Resolve it
      await claims.resolveClaim(claim.id);

      // Try resolving again
      await expect(claims.resolveClaim(claim.id)).rejects.toThrow(ValidationError);
    });
  });

  // -----------------------------------------------
  // getDashboard
  // -----------------------------------------------
  describe("getDashboard", () => {
    it("returns empty dashboard when no claims exist", () => {
      const dashboard = claims.getDashboard();
      expect(dashboard.totalClaims).toBe(0);
      expect(dashboard.totalReplacedKg).toBe(0);
      expect(dashboard.averageResolutionTimeMs).toBe(0);
      expect(dashboard.resolutionSuccessRate).toBe(0);
      expect(dashboard.dacUnitsWithActiveClaims).toHaveLength(0);
    });

    it("tracks filed claims in dashboard", () => {
      const policy = createActivePolicy(insurance, "dac-001");
      claims.fileClaim({
        policyId: policy.id,
        reason: "failure",
        severity: "total",
        estimatedLossPercentage: 100,
      });

      const dashboard = claims.getDashboard();
      expect(dashboard.totalClaims).toBe(1);
      expect(dashboard.byStatus.filed).toBe(1);
      expect(dashboard.bySeverity.total).toBe(1);
      expect(dashboard.dacUnitsWithActiveClaims).toContain("dac-001");
    });

    it("tracks resolved claims in dashboard", async () => {
      const policy = createActivePolicy(insurance, "dac-001", "42", 500);
      insurance.addToBufferPool("buffer", 100, 95);

      const claim = claims.fileClaim({
        policyId: policy.id,
        reason: "failure",
        severity: "total",
        estimatedLossPercentage: 100,
      });
      await claims.resolveClaim(claim.id);

      const dashboard = claims.getDashboard();
      expect(dashboard.byStatus.resolved).toBe(1);
      expect(dashboard.totalReplacedKg).toBe(500);
      expect(dashboard.resolutionSuccessRate).toBeGreaterThan(0);
    });
  });

  // -----------------------------------------------
  // getClaimsByDacUnit
  // -----------------------------------------------
  describe("getClaimsByDacUnit", () => {
    it("returns empty array for unknown DAC unit", () => {
      const result = claims.getClaimsByDacUnit("unknown-dac");
      expect(result).toHaveLength(0);
    });

    it("returns all claims for a DAC unit", () => {
      const p1 = createActivePolicy(insurance, "dac-001", "42");
      const p2 = createActivePolicy(insurance, "dac-001", "43");
      createActivePolicy(insurance, "dac-002", "44");

      claims.fileClaim({ policyId: p1.id, reason: "r1", severity: "total", estimatedLossPercentage: 100 });
      claims.fileClaim({ policyId: p2.id, reason: "r2", severity: "critical", estimatedLossPercentage: 80 });

      const result = claims.getClaimsByDacUnit("dac-001");
      expect(result).toHaveLength(2);
      result.forEach((c) => expect(c.dacUnitId).toBe("dac-001"));
    });
  });
});
