import { describe, expect, it, vi, beforeEach } from "vitest";

import { ValidationError } from "../errors.js";
import { RiskModule } from "./risk.js";
import { InsuranceModule } from "./insurance.js";

import type { InternalConfig } from "../types.js";
import type { ITelemetry } from "../telemetry.js";
import type { CreatePolicyInput } from "./insurance.js";

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

function validPolicyInput(overrides: Partial<CreatePolicyInput> = {}): CreatePolicyInput {
  return {
    tokenId: "42",
    amountKg: 1000,
    purchasePriceWei: 10_000_000_000_000_000_000n, // 10 ETH
    dacUnitId: "dac-unit-001",
    buyerAddress: VALID_ADDRESS,
    ...overrides,
  };
}

// ============================================
// Tests
// ============================================

describe("InsuranceModule", () => {
  let riskModule: RiskModule;
  let insurance: InsuranceModule;

  beforeEach(() => {
    const telemetry = makeTelemetry();
    riskModule = new RiskModule(makeConfig(), telemetry);
    insurance = new InsuranceModule(telemetry, riskModule);
  });

  // -----------------------------------------------
  // createPolicySync — input validation
  // -----------------------------------------------
  describe("createPolicySync — input validation", () => {
    it("rejects empty tokenId", () => {
      expect(() => insurance.createPolicySync(validPolicyInput({ tokenId: "" }))).toThrow(
        ValidationError,
      );
    });

    it("rejects whitespace-only tokenId", () => {
      expect(() => insurance.createPolicySync(validPolicyInput({ tokenId: "   " }))).toThrow(
        ValidationError,
      );
    });

    it("rejects amountKg below 1", () => {
      expect(() => insurance.createPolicySync(validPolicyInput({ amountKg: 0 }))).toThrow(
        ValidationError,
      );
    });

    it("rejects purchasePriceWei of 0", () => {
      expect(() =>
        insurance.createPolicySync(validPolicyInput({ purchasePriceWei: 0n })),
      ).toThrow(ValidationError);
    });

    it("rejects negative purchasePriceWei", () => {
      expect(() =>
        insurance.createPolicySync(validPolicyInput({ purchasePriceWei: -1n })),
      ).toThrow(ValidationError);
    });

    it("rejects empty dacUnitId", () => {
      expect(() =>
        insurance.createPolicySync(validPolicyInput({ dacUnitId: "" })),
      ).toThrow(ValidationError);
    });

    it("rejects invalid buyerAddress", () => {
      expect(() =>
        insurance.createPolicySync(validPolicyInput({ buyerAddress: "not-an-address" })),
      ).toThrow(ValidationError);
    });

    it("rejects durationDays < 1", () => {
      expect(() =>
        insurance.createPolicySync(validPolicyInput({ durationDays: 0 })),
      ).toThrow(ValidationError);
    });

    it("rejects durationDays > 1825", () => {
      expect(() =>
        insurance.createPolicySync(validPolicyInput({ durationDays: 2000 })),
      ).toThrow(ValidationError);
    });

    it("rejects premiumOverrideBps > 5000", () => {
      expect(() =>
        insurance.createPolicySync(validPolicyInput({ premiumOverrideBps: 5001 })),
      ).toThrow(ValidationError);
    });

    it("rejects negative premiumOverrideBps", () => {
      expect(() =>
        insurance.createPolicySync(validPolicyInput({ premiumOverrideBps: -1 })),
      ).toThrow(ValidationError);
    });
  });

  // -----------------------------------------------
  // createPolicySync — happy path
  // -----------------------------------------------
  describe("createPolicySync — policy creation", () => {
    it("creates a valid policy with default duration", () => {
      // Add sufficient buffer pool to get full-replacement coverage
      insurance.addToBufferPool("buffer-full", 10, 95);

      const policy = insurance.createPolicySync(validPolicyInput());

      expect(policy.id).toMatch(/^tqp_/);
      expect(policy.status).toBe("active");
      expect(policy.tokenId).toBe("42");
      expect(policy.amountKg).toBe(1000);
      expect(policy.dacUnitId).toBe("dac-unit-001");
      expect(policy.buyerAddress).toBe(VALID_ADDRESS);
      expect(policy.premiumWei).toBeGreaterThan(0n);
      expect(policy.premiumBps).toBeGreaterThan(0);
      expect(policy.coverageType).toBe("full-replacement");
      expect(policy.claimedAt).toBeNull();
      expect(policy.resolvedAt).toBeNull();
      expect(policy.replacementTokenId).toBeNull();
    });

    it("defaults to 365 days duration", () => {
      const policy = insurance.createPolicySync(validPolicyInput());
      const durationMs = policy.expiresAt - policy.createdAt;
      expect(durationMs).toBe(365 * 86_400_000);
    });

    it("respects custom duration", () => {
      const policy = insurance.createPolicySync(validPolicyInput({ durationDays: 30 }));
      const durationMs = policy.expiresAt - policy.createdAt;
      expect(durationMs).toBe(30 * 86_400_000);
    });

    it("uses premiumOverrideBps when provided", () => {
      const policy = insurance.createPolicySync(
        validPolicyInput({ premiumOverrideBps: 500 }),
      );
      expect(policy.premiumBps).toBe(500);
      // premium = 10ETH * 500 / 10000 = 0.5 ETH
      const expectedWei = (10_000_000_000_000_000_000n * 500n) / 10_000n;
      expect(policy.premiumWei).toBe(expectedWei);
    });

    it("stores metadata", () => {
      const policy = insurance.createPolicySync(
        validPolicyInput({ metadata: { orderId: "X123", priority: true } }),
      );
      expect(policy.metadata).toEqual({ orderId: "X123", priority: true });
    });
  });

  // -----------------------------------------------
  // Premium splitting math
  // -----------------------------------------------
  describe("premium calculation", () => {
    it("default premium includes base + risk + catastrophe reserve", () => {
      const policy = insurance.createPolicySync(validPolicyInput());
      // Default score: healthScore=85, failProb=100
      // totalBps = 100(base) + 100(risk) + 25(catastrophe) = 225
      expect(policy.premiumBreakdown.breakdown.baseFee).toBe(100);
      expect(policy.premiumBreakdown.breakdown.catastropheReserve).toBe(25);
      expect(policy.premiumBreakdown.breakdown.riskComponent).toBe(100);
      expect(policy.premiumBps).toBe(225);
    });

    it("premium wei math matches BPS calculation", () => {
      const price = 10_000_000_000_000_000_000n;
      const policy = insurance.createPolicySync(validPolicyInput({ purchasePriceWei: price }));
      const expected = (price * BigInt(policy.premiumBps)) / 10_000n;
      expect(policy.premiumWei).toBe(expected);
    });
  });

  // -----------------------------------------------
  // Policy retrieval
  // -----------------------------------------------
  describe("getPolicy", () => {
    it("retrieves a created policy by ID", () => {
      const created = insurance.createPolicySync(validPolicyInput());
      const fetched = insurance.getPolicy(created.id);
      expect(fetched.id).toBe(created.id);
      expect(fetched.status).toBe("active");
    });

    it("throws for non-existent policy", () => {
      expect(() => insurance.getPolicy("tqp_nonexistent")).toThrow(ValidationError);
    });

    it("auto-expires policies past their expiration", () => {
      const policy = insurance.createPolicySync(validPolicyInput({ durationDays: 1 }));
      // Simulate time passing: directly modify internal state
      const internalPolicies = (insurance as unknown as { policies: Map<string, { expiresAt: number }> }).policies;
      const record = internalPolicies.get(policy.id)!;
      record.expiresAt = Date.now() - 1000;

      const fetched = insurance.getPolicy(policy.id);
      expect(fetched.status).toBe("expired");
    });
  });

  // -----------------------------------------------
  // listPolicies
  // -----------------------------------------------
  describe("listPolicies", () => {
    it("returns empty list when no policies exist", () => {
      const result = insurance.listPolicies();
      expect(result.items).toHaveLength(0);
      expect(result.total).toBe(0);
      expect(result.hasMore).toBe(false);
    });

    it("lists created policies", () => {
      insurance.createPolicySync(validPolicyInput());
      insurance.createPolicySync(validPolicyInput({ tokenId: "43" }));
      const result = insurance.listPolicies();
      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it("filters by status", () => {
      const p1 = insurance.createPolicySync(validPolicyInput());
      insurance.createPolicySync(validPolicyInput({ tokenId: "43" }));
      insurance.cancelPolicy(p1.id);

      const active = insurance.listPolicies({ status: "active" });
      expect(active.items).toHaveLength(1);

      const cancelled = insurance.listPolicies({ status: "cancelled" });
      expect(cancelled.items).toHaveLength(1);
    });

    it("filters by dacUnitId", () => {
      insurance.createPolicySync(validPolicyInput({ dacUnitId: "dac-A" }));
      insurance.createPolicySync(validPolicyInput({ dacUnitId: "dac-B", tokenId: "43" }));
      const result = insurance.listPolicies({ dacUnitId: "dac-A" });
      expect(result.items).toHaveLength(1);
      expect(result.items[0]!.dacUnitId).toBe("dac-A");
    });

    it("respects pagination offset and limit", () => {
      for (let i = 0; i < 5; i++) {
        insurance.createPolicySync(validPolicyInput({ tokenId: String(i) }));
      }
      const result = insurance.listPolicies({ offset: 2, limit: 2 });
      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(5);
      expect(result.hasMore).toBe(true);
    });
  });

  // -----------------------------------------------
  // cancelPolicy
  // -----------------------------------------------
  describe("cancelPolicy", () => {
    it("cancels an active policy", () => {
      const policy = insurance.createPolicySync(validPolicyInput());
      const cancelled = insurance.cancelPolicy(policy.id);
      expect(cancelled.status).toBe("cancelled");
    });

    it("throws when cancelling a non-active policy", () => {
      const policy = insurance.createPolicySync(validPolicyInput());
      insurance.cancelPolicy(policy.id);
      expect(() => insurance.cancelPolicy(policy.id)).toThrow(ValidationError);
    });

    it("throws for non-existent policy", () => {
      expect(() => insurance.cancelPolicy("nonexistent")).toThrow(ValidationError);
    });
  });

  // -----------------------------------------------
  // fileClaim / resolveClaim
  // -----------------------------------------------
  describe("fileClaim", () => {
    it("transitions active policy to claimed", () => {
      const policy = insurance.createPolicySync(validPolicyInput());
      const claimed = insurance.fileClaim(policy.id, "Hardware failure detected");
      expect(claimed.status).toBe("claimed");
      expect(claimed.claimedAt).not.toBeNull();
      expect(claimed.metadata["claimReason"]).toBe("Hardware failure detected");
    });

    it("rejects claim on non-active policy", () => {
      const policy = insurance.createPolicySync(validPolicyInput());
      insurance.cancelPolicy(policy.id);
      expect(() => insurance.fileClaim(policy.id, "reason")).toThrow(ValidationError);
    });

    it("rejects empty reason", () => {
      const policy = insurance.createPolicySync(validPolicyInput());
      expect(() => insurance.fileClaim(policy.id, "")).toThrow(ValidationError);
    });
  });

  describe("resolveClaim", () => {
    it("transitions claimed policy to resolved", () => {
      const policy = insurance.createPolicySync(validPolicyInput());
      insurance.fileClaim(policy.id, "failure");
      const resolved = insurance.resolveClaim(policy.id, "replacement-token-99");
      expect(resolved.status).toBe("resolved");
      expect(resolved.resolvedAt).not.toBeNull();
      expect(resolved.replacementTokenId).toBe("replacement-token-99");
    });

    it("rejects resolving a non-claimed policy", () => {
      const policy = insurance.createPolicySync(validPolicyInput());
      expect(() => insurance.resolveClaim(policy.id, "token")).toThrow(ValidationError);
    });
  });

  // -----------------------------------------------
  // Buffer pool management
  // -----------------------------------------------
  describe("buffer pool", () => {
    it("starts with an empty buffer pool", () => {
      const status = (insurance as unknown as { getBufferPoolStatusSync: () => ReturnType<typeof insurance.getBufferPoolStatus> }).getBufferPoolStatusSync();
      expect(status.totalCreditsTonnes).toBe(0);
      expect(status.distinctTokens).toBe(0);
    });

    it("adds credits to the buffer pool", () => {
      insurance.addToBufferPool("token-1", 100, 90);
      const status = (insurance as unknown as { getBufferPoolStatusSync: () => ReturnType<typeof insurance.getBufferPoolStatus> }).getBufferPoolStatusSync();
      expect(status.totalCreditsTonnes).toBe(100);
      expect(status.distinctTokens).toBe(1);
      expect(status.averageBufferHealthScore).toBe(90);
    });

    it("accumulates credits for same tokenId", () => {
      insurance.addToBufferPool("token-1", 50, 90);
      insurance.addToBufferPool("token-1", 30, 85);
      const status = (insurance as unknown as { getBufferPoolStatusSync: () => ReturnType<typeof insurance.getBufferPoolStatus> }).getBufferPoolStatusSync();
      expect(status.totalCreditsTonnes).toBe(80);
      expect(status.distinctTokens).toBe(1);
      // healthScore is updated to latest
      expect(status.averageBufferHealthScore).toBe(85);
    });

    it("rejects non-positive amountTonnes", () => {
      expect(() => insurance.addToBufferPool("token-1", 0, 90)).toThrow(ValidationError);
      expect(() => insurance.addToBufferPool("token-1", -10, 90)).toThrow(ValidationError);
    });

    it("rejects healthScore out of range", () => {
      expect(() => insurance.addToBufferPool("token-1", 10, -1)).toThrow(ValidationError);
      expect(() => insurance.addToBufferPool("token-1", 10, 101)).toThrow(ValidationError);
    });

    it("reserves credits from buffer pool (highest health first)", () => {
      insurance.addToBufferPool("token-low", 100, 70);
      insurance.addToBufferPool("token-high", 100, 95);

      const reserved = insurance.reserveFromBufferPool(50);
      expect(reserved).not.toBeNull();
      expect(reserved!.tokenId).toBe("token-high");
      expect(reserved!.amountTonnes).toBe(50);
    });

    it("returns null when buffer pool has insufficient credits", () => {
      insurance.addToBufferPool("token-1", 10, 90);
      const result = insurance.reserveFromBufferPool(20);
      expect(result).toBeNull();
    });
  });

  // -----------------------------------------------
  // Coverage ratio & coverage type
  // -----------------------------------------------
  describe("coverage ratio and type", () => {
    it("coverage ratio is Infinity when no active policies but pool has credits", () => {
      insurance.addToBufferPool("token-1", 100, 90);
      const status = (insurance as unknown as { getBufferPoolStatusSync: () => ReturnType<typeof insurance.getBufferPoolStatus> }).getBufferPoolStatusSync();
      expect(status.coverageRatio).toBe(Infinity);
      expect(status.isHealthy).toBe(true);
    });

    it("coverage ratio is 0 when pool and policies are both empty", () => {
      const status = (insurance as unknown as { getBufferPoolStatusSync: () => ReturnType<typeof insurance.getBufferPoolStatus> }).getBufferPoolStatusSync();
      expect(status.coverageRatio).toBe(0);
    });

    it("assigns partial-replacement when 0.5 <= coverage < 1.0", () => {
      // Coverage ratio is calculated from existing active policies at creation time.
      // First create an existing policy to establish insured volume (1 tonne = 1000 kg).
      insurance.addToBufferPool("buffer-1", 0.75, 90);
      insurance.createPolicySync(validPolicyInput({ amountKg: 1000, tokenId: "existing-1" }));
      // Now buffer = 0.75, insured = 1 tonne, ratio = 0.75 -> partial-replacement
      const policy = insurance.createPolicySync(validPolicyInput({ amountKg: 1000, tokenId: "43" }));
      expect(policy.coverageType).toBe("partial-replacement");
    });

    it("assigns cash-settlement when coverage < 0.5", () => {
      // First create an existing policy to establish insured volume.
      insurance.addToBufferPool("buffer-1", 0.3, 90);
      insurance.createPolicySync(validPolicyInput({ amountKg: 1000, tokenId: "existing-1" }));
      // Now buffer = 0.3, insured = 1 tonne, ratio = 0.3 -> cash-settlement
      const policy = insurance.createPolicySync(validPolicyInput({ amountKg: 1000, tokenId: "44" }));
      expect(policy.coverageType).toBe("cash-settlement");
    });
  });

  // -----------------------------------------------
  // Treasury analytics
  // -----------------------------------------------
  describe("getTreasuryAnalytics", () => {
    it("starts with zero treasury counters", () => {
      const analytics = insurance.getTreasuryAnalytics();
      expect(analytics.totalPremiumsCollectedWei).toBe(0n);
      expect(analytics.totalClaimsPaidWei).toBe(0n);
      expect(analytics.currentFloatWei).toBe(0n);
      expect(analytics.activePolicies).toBe(0);
      expect(analytics.lossRatio).toBe(0);
    });

    it("tracks premiums after policy creation", () => {
      insurance.createPolicySync(validPolicyInput());
      const analytics = insurance.getTreasuryAnalytics();
      expect(analytics.totalPremiumsCollectedWei).toBeGreaterThan(0n);
      expect(analytics.activePolicies).toBe(1);
    });

    it("tracks claims after resolution", () => {
      const policy = insurance.createPolicySync(validPolicyInput());
      insurance.fileClaim(policy.id, "failure");
      insurance.resolveClaim(policy.id, "replacement-42");

      const analytics = insurance.getTreasuryAnalytics();
      expect(analytics.totalClaimsPaidWei).toBeGreaterThan(0n);
      expect(analytics.resolvedClaims).toBe(1);
    });

    it("calculates loss ratio correctly", () => {
      const policy = insurance.createPolicySync(validPolicyInput());
      insurance.fileClaim(policy.id, "failure");
      insurance.resolveClaim(policy.id, "replacement-42");

      const analytics = insurance.getTreasuryAnalytics();
      // lossRatio = claimsPaid / premiumsCollected
      // claimsPaid = purchasePrice = 10 ETH, premiums = 10 ETH * 225/10000 = 0.225 ETH
      // lossRatio = 10 / 0.225 >> 1
      expect(analytics.lossRatio).toBeGreaterThan(1);
    });

    it("combined ratio includes operational expense", () => {
      const analytics = insurance.getTreasuryAnalytics();
      // combinedRatio = lossRatio(0) + 0.15
      expect(analytics.combinedRatio).toBe(0.15);
    });

    it("includes buffer pool status", () => {
      insurance.addToBufferPool("token-1", 50, 88);
      const analytics = insurance.getTreasuryAnalytics();
      expect(analytics.bufferPool.totalCreditsTonnes).toBe(50);
    });
  });

  // -----------------------------------------------
  // getAffectedPolicies
  // -----------------------------------------------
  describe("getAffectedPolicies", () => {
    it("returns empty array for unknown DAC unit", () => {
      const affected = insurance.getAffectedPolicies("unknown-dac");
      expect(affected).toHaveLength(0);
    });

    it("returns active policies for a given DAC unit", () => {
      insurance.createPolicySync(validPolicyInput({ dacUnitId: "dac-001" }));
      insurance.createPolicySync(validPolicyInput({ dacUnitId: "dac-001", tokenId: "43" }));
      insurance.createPolicySync(validPolicyInput({ dacUnitId: "dac-002", tokenId: "44" }));

      const affected = insurance.getAffectedPolicies("dac-001");
      expect(affected).toHaveLength(2);
      affected.forEach((p) => expect(p.dacUnitId).toBe("dac-001"));
    });

    it("excludes cancelled policies", () => {
      const p1 = insurance.createPolicySync(validPolicyInput({ dacUnitId: "dac-001" }));
      insurance.createPolicySync(validPolicyInput({ dacUnitId: "dac-001", tokenId: "43" }));
      insurance.cancelPolicy(p1.id);

      const affected = insurance.getAffectedPolicies("dac-001");
      expect(affected).toHaveLength(1);
    });
  });

  // -----------------------------------------------
  // Policy lifecycle state transitions
  // -----------------------------------------------
  describe("policy lifecycle", () => {
    it("active -> claimed -> resolved is valid path", () => {
      const p = insurance.createPolicySync(validPolicyInput());
      expect(p.status).toBe("active");

      const claimed = insurance.fileClaim(p.id, "reason");
      expect(claimed.status).toBe("claimed");

      const resolved = insurance.resolveClaim(p.id, "repl-token");
      expect(resolved.status).toBe("resolved");
    });

    it("active -> cancelled is valid", () => {
      const p = insurance.createPolicySync(validPolicyInput());
      const cancelled = insurance.cancelPolicy(p.id);
      expect(cancelled.status).toBe("cancelled");
    });

    it("cannot cancel a claimed policy", () => {
      const p = insurance.createPolicySync(validPolicyInput());
      insurance.fileClaim(p.id, "reason");
      expect(() => insurance.cancelPolicy(p.id)).toThrow(ValidationError);
    });

    it("cannot file claim on expired policy", () => {
      const p = insurance.createPolicySync(validPolicyInput({ durationDays: 1 }));
      const internalPolicies = (insurance as unknown as { policies: Map<string, { expiresAt: number; status: string }> }).policies;
      const record = internalPolicies.get(p.id)!;
      record.expiresAt = Date.now() - 1000;
      // Trigger auto-expire via getPolicy
      insurance.getPolicy(p.id);
      expect(() => insurance.fileClaim(p.id, "reason")).toThrow(ValidationError);
    });
  });
});
