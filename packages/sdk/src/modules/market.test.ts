import { describe, expect, it, vi, beforeEach } from "vitest";

import { AuthenticationError } from "../errors.js";
import { MarketModule } from "./market.js";

import type { InternalConfig } from "../types.js";
import type { ITelemetry } from "../telemetry.js";
import type { GasManager } from "../gas.js";
import type { IdempotencyStore } from "../utils.js";

// ============================================
// Helpers
// ============================================

function makeTelemetry(): ITelemetry {
  return {
    wrapAsync: (_name: string, fn: () => unknown) => fn(),
    recordMetric: vi.fn(),
  } as unknown as ITelemetry;
}

function makeConfig(hasSigner = false): InternalConfig {
  return {
    network: "aethelred-testnet",
    provider: {} as InternalConfig["provider"],
    signer: hasSigner ? ({} as InternalConfig["signer"]) : null,
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

function makeGasManager(): GasManager {
  return {
    buildGasOverrides: vi.fn().mockResolvedValue({}),
    invalidateCache: vi.fn(),
  } as unknown as GasManager;
}

function makeIdempotency(): IdempotencyStore {
  return {
    acquire: vi.fn().mockResolvedValue(undefined),
    release: vi.fn().mockResolvedValue(undefined),
    remove: vi.fn().mockResolvedValue(undefined),
    destroy: vi.fn().mockResolvedValue(undefined),
  } as unknown as IdempotencyStore;
}

// ============================================
// Tests
// ============================================

describe("MarketModule", () => {
  // -----------------------------------------------
  // calculatePrice — pure math (no mocks needed)
  // -----------------------------------------------
  describe("calculatePrice", () => {
    let market: MarketModule;

    beforeEach(() => {
      market = new MarketModule(
        makeConfig(),
        makeTelemetry(),
        makeGasManager(),
        makeIdempotency(),
      );
    });

    it("calculates correct subtotal", () => {
      const result = market.calculatePrice(100n, 10n);
      expect(result.subtotal).toBe(1000n);
    });

    it("calculates platform fee at 250 BPS (2.5%)", () => {
      const result = market.calculatePrice(10000n, 1n);
      // subtotal = 10000, fee = 10000 * 250 / 10000 = 250
      expect(result.platformFee).toBe(250n);
      expect(result.feeBps).toBe(250);
    });

    it("calculates total as subtotal + platformFee", () => {
      const result = market.calculatePrice(10000n, 1n);
      expect(result.total).toBe(result.subtotal + result.platformFee);
    });

    it("handles large values without overflow", () => {
      const oneEth = 1_000_000_000_000_000_000n; // 1e18
      const result = market.calculatePrice(oneEth, 1000n);
      expect(result.subtotal).toBe(oneEth * 1000n);
      expect(result.platformFee).toBe((oneEth * 1000n * 250n) / 10_000n);
      expect(result.total).toBe(result.subtotal + result.platformFee);
    });

    it("returns 0 for zero price", () => {
      const result = market.calculatePrice(0n, 10n);
      expect(result.subtotal).toBe(0n);
      expect(result.platformFee).toBe(0n);
      expect(result.total).toBe(0n);
    });

    it("returns 0 for zero amount", () => {
      const result = market.calculatePrice(1000n, 0n);
      expect(result.subtotal).toBe(0n);
      expect(result.platformFee).toBe(0n);
      expect(result.total).toBe(0n);
    });

    it("handles 1 wei price correctly", () => {
      const result = market.calculatePrice(1n, 1n);
      expect(result.subtotal).toBe(1n);
      // 1 * 250 / 10000 = 0 (integer division)
      expect(result.platformFee).toBe(0n);
      expect(result.total).toBe(1n);
    });

    it("handles small amounts where fee rounds down", () => {
      // subtotal = 39, fee = 39 * 250 / 10000 = 0 (integer truncation)
      const result = market.calculatePrice(39n, 1n);
      expect(result.platformFee).toBe(0n);
    });

    it("fee kicks in at threshold (subtotal = 40)", () => {
      // subtotal = 40, fee = 40 * 250 / 10000 = 1
      const result = market.calculatePrice(40n, 1n);
      expect(result.platformFee).toBe(1n);
    });

    it("calculates correctly for realistic carbon credit price", () => {
      // 0.1 ETH per credit, buying 50 credits
      const pricePerUnit = 100_000_000_000_000_000n; // 0.1 ETH
      const amount = 50n;
      const result = market.calculatePrice(pricePerUnit, amount);

      // subtotal = 5 ETH
      expect(result.subtotal).toBe(5_000_000_000_000_000_000n);
      // fee = 5 ETH * 250/10000 = 0.125 ETH
      expect(result.platformFee).toBe(125_000_000_000_000_000n);
      // total = 5.125 ETH
      expect(result.total).toBe(5_125_000_000_000_000_000n);
    });

    it("returns correct feeBps value", () => {
      const result = market.calculatePrice(1000n, 1n);
      expect(result.feeBps).toBe(250);
    });

    it("PriceBreakdown satisfies total = subtotal + platformFee invariant", () => {
      const testCases = [
        { price: 1n, amount: 1n },
        { price: 100n, amount: 50n },
        { price: 1_000_000n, amount: 1_000n },
        { price: 10_000_000_000_000_000_000n, amount: 100n },
      ];
      for (const { price, amount } of testCases) {
        const result = market.calculatePrice(price, amount);
        expect(result.total).toBe(result.subtotal + result.platformFee);
      }
    });
  });

  // -----------------------------------------------
  // requireSigner — AuthenticationError
  // -----------------------------------------------
  describe("requireSigner", () => {
    it("throws AuthenticationError on createListing without signer", async () => {
      const market = new MarketModule(
        makeConfig(false),
        makeTelemetry(),
        makeGasManager(),
        makeIdempotency(),
      );

      await expect(
        market.createListing({
          tokenId: 1n,
          amount: 10n,
          pricePerUnit: 100n,
        }),
      ).rejects.toThrow(AuthenticationError);
    });

    it("throws AuthenticationError on purchase without signer", async () => {
      const market = new MarketModule(
        makeConfig(false),
        makeTelemetry(),
        makeGasManager(),
        makeIdempotency(),
      );

      await expect(market.purchase(1n, 10n)).rejects.toThrow(AuthenticationError);
    });

    it("throws AuthenticationError on createOffer without signer", async () => {
      const market = new MarketModule(
        makeConfig(false),
        makeTelemetry(),
        makeGasManager(),
        makeIdempotency(),
      );

      await expect(
        market.createOffer({
          tokenId: 1n,
          amount: 10n,
          pricePerUnit: 100n,
        }),
      ).rejects.toThrow(AuthenticationError);
    });

    it("throws AuthenticationError on acceptOffer without signer", async () => {
      const market = new MarketModule(
        makeConfig(false),
        makeTelemetry(),
        makeGasManager(),
        makeIdempotency(),
      );

      await expect(market.acceptOffer(1n)).rejects.toThrow(AuthenticationError);
    });

    it("throws AuthenticationError on cancelOffer without signer", async () => {
      const market = new MarketModule(
        makeConfig(false),
        makeTelemetry(),
        makeGasManager(),
        makeIdempotency(),
      );

      await expect(market.cancelOffer(1n)).rejects.toThrow(AuthenticationError);
    });

    it("throws AuthenticationError on cancelListing without signer", async () => {
      const market = new MarketModule(
        makeConfig(false),
        makeTelemetry(),
        makeGasManager(),
        makeIdempotency(),
      );

      await expect(market.cancelListing(1n)).rejects.toThrow(AuthenticationError);
    });

    it("throws AuthenticationError on batchPurchase without signer", async () => {
      const market = new MarketModule(
        makeConfig(false),
        makeTelemetry(),
        makeGasManager(),
        makeIdempotency(),
      );

      await expect(
        market.batchPurchase([{ listingId: 1n, amount: 10n }]),
      ).rejects.toThrow(AuthenticationError);
    });
  });

  // -----------------------------------------------
  // batchPurchase — empty input
  // -----------------------------------------------
  describe("batchPurchase — edge cases", () => {
    it("returns empty results for empty purchases array", async () => {
      const market = new MarketModule(
        makeConfig(true),
        makeTelemetry(),
        makeGasManager(),
        makeIdempotency(),
      );

      const result = await market.batchPurchase([]);
      expect(result.results).toHaveLength(0);
      expect(result.successCount).toBe(0);
      expect(result.failCount).toBe(0);
      expect(result.totalPaid).toBe(0n);
    });
  });
});
