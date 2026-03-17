/**
 * Assets module tests.
 *
 * Tests provenance retrieval, balance queries, metadata parsing,
 * aggregation stats, credit listing via subgraph, and error handling.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ethers } from "ethers";

import { AssetsModule } from "./assets.js";
import { SubgraphError } from "../errors.js";
import { ValidationError } from "../errors.js";
import {
  mockTelemetry,
  buildTestConfig,
  buildReadOnlyTestConfig,
  buildMockRawMetadata,
  buildMockRawVerification,
  mockFetch,
  mockFetchError,
  mockFetchGraphQLError,
  TEST_ADDRESSES,
  TEST_DAC_UNIT_ID,
} from "../__test__/helpers.js";

// ============================================
// Module-level mocks
// ============================================

// Mock ethers.Contract to intercept constructor calls
vi.mock("ethers", async () => {
  const actual = await vi.importActual<typeof import("ethers")>("ethers");

  const contractFunctions: Record<string, ReturnType<typeof vi.fn>> = {};

  class MockContract {
    getFunction(name: string) {
      if (!contractFunctions[name]) {
        contractFunctions[name] = vi.fn();
      }
      return contractFunctions[name];
    }
  }

  return {
    ...actual,
    ethers: {
      ...actual.ethers,
      Contract: MockContract,
      __contractFunctions: contractFunctions,
    },
  };
});

function getContractFn(name: string): ReturnType<typeof vi.fn> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fns = (ethers as any).__contractFunctions as Record<string, ReturnType<typeof vi.fn>>;
  if (!fns[name]) {
    fns[name] = vi.fn();
  }
  return fns[name];
}

describe("AssetsModule", () => {
  let assets: AssetsModule;
  let telemetry: ReturnType<typeof mockTelemetry>;

  beforeEach(() => {
    vi.clearAllMocks();
    telemetry = mockTelemetry();
    const config = buildTestConfig();
    assets = new AssetsModule(config, telemetry);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ============================================
  // getProvenance
  // ============================================

  describe("getProvenance", () => {
    it("returns full provenance timeline for a valid token", async () => {
      const rawMeta = buildMockRawMetadata();
      const rawVerif = buildMockRawVerification();

      getContractFn("getCreditProvenance").mockResolvedValue({
        metadata: rawMeta,
        verification: rawVerif,
      });
      getContractFn("isWhitelisted").mockResolvedValue(true);
      getContractFn("getOperator").mockResolvedValue(TEST_ADDRESSES.operator);

      mockFetch({ transfers: [] });

      const result = await assets.getProvenance("42");

      expect(result.tokenId).toBe("42");
      expect(result.metadata.co2AmountKg).toBe(1000);
      expect(result.metadata.purityPercentage).toBe(95);
      expect(result.metadata.latitude).toBeCloseTo(24.5, 1);
      expect(result.metadata.longitude).toBeCloseTo(54.7, 1);
      expect(result.verification.sourceVerified).toBe(true);
      expect(result.verification.logicVerified).toBe(true);
      expect(result.verification.mintVerified).toBe(true);
      expect(result.gps.lat).toBeCloseTo(24.5, 1);
      expect(result.gps.lng).toBeCloseTo(54.7, 1);
      expect(result.dacUnit.isWhitelisted).toBe(true);
      expect(result.dacUnit.operator).toBe(TEST_ADDRESSES.operator);
    });

    it("computes Net-Negative breakdown correctly", async () => {
      const rawMeta = buildMockRawMetadata({
        co2AmountKg: 2000,
        energyConsumedKwh: 500,
        purityPercentage: 90,
        gridIntensityGCO2PerKwh: 100,
      });
      const rawVerif = buildMockRawVerification();

      getContractFn("getCreditProvenance").mockResolvedValue({
        metadata: rawMeta,
        verification: rawVerif,
      });
      getContractFn("isWhitelisted").mockResolvedValue(true);
      getContractFn("getOperator").mockResolvedValue(TEST_ADDRESSES.operator);
      mockFetch({ transfers: [] });

      const result = await assets.getProvenance("43");

      // grossCredits = 2000 * 0.9 = 1800
      // energyDebt = 500 * 100 / 1000 = 50
      // netCredits = 1800 - 50 = 1750
      expect(result.netNegativeBreakdown.grossCreditsKg).toBe(1800);
      expect(result.netNegativeBreakdown.energyDebtKg).toBe(50);
      expect(result.netNegativeBreakdown.netCreditsKg).toBe(1750);
    });

    it("clamps net credits to zero when energy debt exceeds gross", async () => {
      const rawMeta = buildMockRawMetadata({
        co2AmountKg: 100,
        energyConsumedKwh: 5000,
        purityPercentage: 50,
        gridIntensityGCO2PerKwh: 800,
      });
      const rawVerif = buildMockRawVerification();

      getContractFn("getCreditProvenance").mockResolvedValue({
        metadata: rawMeta,
        verification: rawVerif,
      });
      getContractFn("isWhitelisted").mockResolvedValue(false);
      getContractFn("getOperator").mockRejectedValue(new Error("not found"));
      mockFetch({ transfers: [] });

      const result = await assets.getProvenance("44");

      // grossCredits = 100 * 0.5 = 50
      // energyDebt = 5000 * 800 / 1000 = 4000
      // netCredits = max(0, 50 - 4000) = 0
      expect(result.netNegativeBreakdown.netCreditsKg).toBe(0);
    });

    it("includes transfer history from subgraph", async () => {
      const rawMeta = buildMockRawMetadata();
      const rawVerif = buildMockRawVerification();

      getContractFn("getCreditProvenance").mockResolvedValue({
        metadata: rawMeta,
        verification: rawVerif,
      });
      getContractFn("isWhitelisted").mockResolvedValue(true);
      getContractFn("getOperator").mockResolvedValue(TEST_ADDRESSES.operator);

      mockFetch({
        transfers: [
          {
            from: ethers.ZeroAddress,
            to: TEST_ADDRESSES.user,
            amount: "1000",
            transactionHash: "0xabc",
            blockNumber: "100",
            timestamp: "1700000000",
          },
        ],
      });

      const result = await assets.getProvenance("42");

      expect(result.transferHistory).toHaveLength(1);
      expect(result.transferHistory[0].from).toBe(ethers.ZeroAddress);
      expect(result.transferHistory[0].to).toBe(TEST_ADDRESSES.user);
      expect(result.transferHistory[0].amount).toBe(1000n);
    });

    it("handles tuple-indexed provenance result (positional access)", async () => {
      const rawMeta = buildMockRawMetadata();
      const rawVerif = buildMockRawVerification();

      // Simulate contract returning positional tuple
      const result = [rawMeta, rawVerif];
      Object.defineProperty(result, "metadata", { value: undefined });
      Object.defineProperty(result, "verification", { value: undefined });

      getContractFn("getCreditProvenance").mockResolvedValue(result);
      getContractFn("isWhitelisted").mockResolvedValue(true);
      getContractFn("getOperator").mockResolvedValue(TEST_ADDRESSES.operator);
      mockFetch({ transfers: [] });

      const provenance = await assets.getProvenance("42");
      expect(provenance.metadata.co2AmountKg).toBe(1000);
    });
  });

  // ============================================
  // getBalance
  // ============================================

  describe("getBalance", () => {
    it("returns balance for a valid address and token ID", async () => {
      getContractFn("balanceOf").mockResolvedValue(500n);

      const balance = await assets.getBalance(TEST_ADDRESSES.user, "42");

      expect(balance).toBe(500n);
    });

    it("throws ValidationError for invalid address", async () => {
      await expect(assets.getBalance("not-an-address", "42")).rejects.toThrow(
        ValidationError,
      );
    });

    it("returns zero for address with no balance", async () => {
      getContractFn("balanceOf").mockResolvedValue(0n);

      const balance = await assets.getBalance(TEST_ADDRESSES.user, "999");
      expect(balance).toBe(0n);
    });
  });

  // ============================================
  // getMetadata
  // ============================================

  describe("getMetadata", () => {
    it("parses on-chain metadata correctly", async () => {
      const rawMeta = buildMockRawMetadata();
      getContractFn("getCreditProvenance").mockResolvedValue({
        metadata: rawMeta,
        verification: buildMockRawVerification(),
      });

      const metadata = await assets.getMetadata("42");

      expect(metadata.dacUnitId).toBe(TEST_DAC_UNIT_ID);
      expect(metadata.co2AmountKg).toBe(1000);
      expect(metadata.energyConsumedKwh).toBe(350);
      expect(metadata.purityPercentage).toBe(95);
      expect(metadata.gridIntensityGCO2PerKwh).toBe(50);
      expect(metadata.isRetired).toBe(false);
      expect(metadata.ipfsMetadataUri).toBe("ipfs://QmTest123");
    });

    it("handles missing optional fields gracefully", async () => {
      getContractFn("getCreditProvenance").mockResolvedValue({
        metadata: {
          dacUnitId: "",
          captureTimestamp: 0,
          co2AmountKg: 0,
        },
        verification: buildMockRawVerification(),
      });

      const metadata = await assets.getMetadata("1");

      expect(metadata.dacUnitId).toBe("");
      expect(metadata.co2AmountKg).toBe(0);
      expect(metadata.ipfsMetadataUri).toBe("");
    });
  });

  // ============================================
  // getTotalMinted / getTotalRetired
  // ============================================

  describe("getTotalMinted", () => {
    it("returns aggregated minted total", async () => {
      getContractFn("totalCreditsMinted").mockResolvedValue(1000000n);

      const total = await assets.getTotalMinted();
      expect(total).toBe(1000000n);
    });
  });

  describe("getTotalRetired", () => {
    it("returns aggregated retired total", async () => {
      getContractFn("totalCreditsRetired").mockResolvedValue(250000n);

      const total = await assets.getTotalRetired();
      expect(total).toBe(250000n);
    });
  });

  // ============================================
  // exists / getTotalSupply
  // ============================================

  describe("exists", () => {
    it("returns true for existing token", async () => {
      getContractFn("exists").mockResolvedValue(true);

      const result = await assets.exists("42");
      expect(result).toBe(true);
    });

    it("returns false for non-existing token", async () => {
      getContractFn("exists").mockResolvedValue(false);

      const result = await assets.exists("99999");
      expect(result).toBe(false);
    });
  });

  describe("getTotalSupply", () => {
    it("returns supply for a specific token", async () => {
      getContractFn("totalSupply").mockResolvedValue(500n);

      const supply = await assets.getTotalSupply("42");
      expect(supply).toBe(500n);
    });
  });

  // ============================================
  // listCredits (subgraph)
  // ============================================

  describe("listCredits", () => {
    it("returns paginated credit list from subgraph", async () => {
      mockFetch({
        creditBalances: [
          {
            tokenId: "1",
            balance: "100",
            credit: { co2AmountKg: "500", isRetired: false, mintedAt: "1700000000" },
          },
          {
            tokenId: "2",
            balance: "200",
            credit: { co2AmountKg: "1000", isRetired: true, mintedAt: "1700001000" },
          },
        ],
      });

      const result = await assets.listCredits(TEST_ADDRESSES.user);

      expect(result.items).toHaveLength(2);
      expect(result.items[0].tokenId).toBe("1");
      expect(result.items[0].balance).toBe(100n);
      expect(result.items[0].co2AmountKg).toBe(500);
      expect(result.items[1].isRetired).toBe(true);
      expect(result.offset).toBe(0);
      expect(result.limit).toBe(20);
    });

    it("respects custom pagination parameters", async () => {
      mockFetch({ creditBalances: [] });

      const result = await assets.listCredits(TEST_ADDRESSES.user, {
        offset: 10,
        limit: 5,
      });

      expect(result.offset).toBe(10);
      expect(result.limit).toBe(5);
      expect(result.hasMore).toBe(false);
    });

    it("sets hasMore when results equal limit", async () => {
      const items = Array.from({ length: 20 }, (_, i) => ({
        tokenId: String(i + 1),
        balance: "100",
        credit: { co2AmountKg: "500", isRetired: false, mintedAt: "1700000000" },
      }));

      mockFetch({ creditBalances: items });

      const result = await assets.listCredits(TEST_ADDRESSES.user);
      expect(result.hasMore).toBe(true);
    });

    it("throws SubgraphError when subgraph returns HTTP error", async () => {
      mockFetchError(500);

      await expect(
        assets.listCredits(TEST_ADDRESSES.user),
      ).rejects.toThrow(SubgraphError);
    });

    it("handles GraphQL errors in subgraph response", async () => {
      mockFetchGraphQLError([{ message: "field not found: balance" }]);

      await expect(
        assets.listCredits(TEST_ADDRESSES.user),
      ).rejects.toThrow(SubgraphError);
    });
  });

  // ============================================
  // getCreditHistory
  // ============================================

  describe("getCreditHistory", () => {
    it("returns transfer history for a token", async () => {
      mockFetch({
        transfers: [
          {
            from: ethers.ZeroAddress,
            to: TEST_ADDRESSES.user,
            amount: "1000",
            transactionHash: "0xabc",
            blockNumber: "100",
            timestamp: "1700000000",
          },
          {
            from: TEST_ADDRESSES.user,
            to: TEST_ADDRESSES.operator,
            amount: "500",
            transactionHash: "0xdef",
            blockNumber: "200",
            timestamp: "1700001000",
          },
        ],
      });

      const history = await assets.getCreditHistory("42");

      expect(history).toHaveLength(2);
      expect(history[0].from).toBe(ethers.ZeroAddress);
      expect(history[1].amount).toBe(500n);
    });

    it("returns empty array when subgraph query fails", async () => {
      mockFetchError(500);

      const history = await assets.getCreditHistory("42");
      expect(history).toEqual([]);
    });
  });

  // ============================================
  // DAC Unit Info
  // ============================================

  describe("getProvenance — DAC unit fallback", () => {
    it("returns default DAC info when verification engine call fails", async () => {
      const rawMeta = buildMockRawMetadata();
      const rawVerif = buildMockRawVerification();

      getContractFn("getCreditProvenance").mockResolvedValue({
        metadata: rawMeta,
        verification: rawVerif,
      });
      getContractFn("isWhitelisted").mockRejectedValue(new Error("RPC error"));
      getContractFn("getOperator").mockRejectedValue(new Error("RPC error"));
      mockFetch({ transfers: [] });

      const result = await assets.getProvenance("42");

      expect(result.dacUnit.isWhitelisted).toBe(false);
      expect(result.dacUnit.operator).toBe(ethers.ZeroAddress);
    });
  });
});
