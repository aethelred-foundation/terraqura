import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { MintingJobData } from "@terraqura/queue";
import {
  createMockJob,
  setupMockRuntimeEnv,
  cleanupMockRuntimeEnv,
} from "../../test/helpers.js";

// Mock ethers before importing the processor
const mockGetVerificationStatus = vi.fn();
const mockEstimateGas = vi.fn();
const mockMintFromVerification = vi.fn() as any;
mockMintFromVerification.estimateGas = mockEstimateGas;

const mockGetFeeData = vi.fn();
const mockParseLog = vi.fn();

vi.mock("ethers", () => {
  const actualEthers = {
    id: (value: string) => `0x${Buffer.from(value).toString("hex").padEnd(64, "0")}`,
    parseUnits: (value: string, _decimals: number | string) => BigInt(Math.round(parseFloat(value) * 1e18)),
  };

  class MockJsonRpcProvider {
    getFeeData = mockGetFeeData;
  }

  class MockWallet {
    constructor(_key: string, _provider: any) {}
    address = "0xMinterAddress";
  }

  class MockContract {
    interface: any;
    constructor(_address: string, _abi: any[], _signer: any) {
      this.mintFromVerification = mockMintFromVerification;
      this.getVerificationStatus = mockGetVerificationStatus;
      this.interface = { parseLog: mockParseLog };
    }
    mintFromVerification: any;
    getVerificationStatus: any;
  }

  return {
    ethers: {
      JsonRpcProvider: MockJsonRpcProvider,
      Wallet: MockWallet,
      Contract: MockContract,
      id: actualEthers.id,
      parseUnits: actualEthers.parseUnits,
    },
  };
});

import { mintingProcessor } from "./minting.processor.js";

function baseJobData(overrides?: Partial<MintingJobData>): MintingJobData {
  return {
    verificationBatchId: "batch-001",
    dacUnitId: "dac-unit-001",
    operatorAddress: "0xOperatorAddress123456789012345678901234",
    co2Captured: 12.5,
    efficiencyFactor: 360,
    dataHash: "abc123hash",
    merkleRoot: "0xmerkleroot",
    ipfsCid: "QmTestCid123",
    ...overrides,
  };
}

describe("mintingProcessor", () => {
  beforeEach(() => {
    setupMockRuntimeEnv();

    // Default: verification passed
    mockGetVerificationStatus.mockResolvedValue([1n, true]);

    // Default: gas estimate
    mockEstimateGas.mockResolvedValue(150000n);

    // Default: fee data
    mockGetFeeData.mockResolvedValue({
      maxFeePerGas: 50000000000n,
      maxPriorityFeePerGas: 2000000000n,
      gasPrice: 50000000000n,
    });

    // Default: successful tx
    const mockReceipt = {
      status: 1,
      gasUsed: 145000n,
      logs: [
        {
          topics: ["0xCreditMintedTopic"],
          data: "0x",
          address: "0x1234567890123456789012345678901234567890",
        },
      ],
    };
    mockMintFromVerification.mockResolvedValue({
      hash: "0xtxhash_abc123",
      wait: vi.fn().mockResolvedValue(mockReceipt),
    });

    // Default: parse log returns CreditMinted event
    mockParseLog.mockReturnValue({
      name: "CreditMinted",
      args: [42n, "0xOperator", 12500000000000000000n, "0xdatahash"],
    });
  });

  afterEach(() => {
    cleanupMockRuntimeEnv();
  });

  // -------------------------------------------------------
  // Verification pass/fail check
  // -------------------------------------------------------
  describe("verification status check", () => {
    it("throws when verification has not passed", async () => {
      mockGetVerificationStatus.mockResolvedValue([0n, false]);

      const job = createMockJob(baseJobData());
      await expect(mintingProcessor(job)).rejects.toThrow(
        "Verification not passed for batch batch-001"
      );
    });

    it("proceeds when verification has passed", async () => {
      mockGetVerificationStatus.mockResolvedValue([2n, true]);

      const job = createMockJob(baseJobData());
      const result = await mintingProcessor(job);

      expect(result.success).toBe(true);
    });
  });

  // -------------------------------------------------------
  // Gas estimation
  // -------------------------------------------------------
  describe("gas estimation", () => {
    it("calls estimateGas with correct parameters", async () => {
      const job = createMockJob(baseJobData());
      await mintingProcessor(job);

      expect(mockEstimateGas).toHaveBeenCalledTimes(1);
      // The first arg should be the operator address
      expect(mockEstimateGas.mock.calls[0]![0]).toBe(
        "0xOperatorAddress123456789012345678901234"
      );
    });

    it("adds 20% buffer to gas estimate in the tx call", async () => {
      mockEstimateGas.mockResolvedValue(100000n);

      const job = createMockJob(baseJobData());
      await mintingProcessor(job);

      // The last argument to mintFromVerification is the overrides object
      const txCall = mockMintFromVerification.mock.calls[0]!;
      const overrides = txCall[txCall.length - 1];
      expect(overrides.gasLimit).toBe(120000n); // 100000 * 120 / 100
    });

    it("uses fallback gas price when feeData fields are null", async () => {
      mockGetFeeData.mockResolvedValue({
        maxFeePerGas: null,
        maxPriorityFeePerGas: null,
        gasPrice: null,
      });

      const job = createMockJob(baseJobData());
      const result = await mintingProcessor(job);

      expect(result.success).toBe(true);
      // Processor should use fallback values from ethers.parseUnits
      const txCall = mockMintFromVerification.mock.calls[0]!;
      const overrides = txCall[txCall.length - 1];
      expect(overrides.maxFeePerGas).toBeDefined();
      expect(overrides.maxPriorityFeePerGas).toBeDefined();
    });
  });

  // -------------------------------------------------------
  // Transaction sending and receipt parsing
  // -------------------------------------------------------
  describe("transaction lifecycle", () => {
    it("returns success with txHash and gasUsed on successful mint", async () => {
      const job = createMockJob(baseJobData());
      const result = await mintingProcessor(job);

      expect(result.success).toBe(true);
      expect(result.txHash).toBe("0xtxhash_abc123");
      expect(result.gasUsed).toBe("145000");
    });

    it("throws when transaction receipt status is not 1", async () => {
      mockMintFromVerification.mockResolvedValue({
        hash: "0xtxhash_reverted",
        wait: vi.fn().mockResolvedValue({
          status: 0,
          gasUsed: 50000n,
          logs: [],
        }),
      });

      const job = createMockJob(baseJobData());
      await expect(mintingProcessor(job)).rejects.toThrow(
        "Transaction reverted: 0xtxhash_reverted"
      );
    });

    it("throws when receipt is null", async () => {
      mockMintFromVerification.mockResolvedValue({
        hash: "0xtxhash_null_receipt",
        wait: vi.fn().mockResolvedValue(null),
      });

      const job = createMockJob(baseJobData());
      await expect(mintingProcessor(job)).rejects.toThrow(
        "Transaction reverted"
      );
    });

    it("waits for 2 block confirmations", async () => {
      const mockWait = vi.fn().mockResolvedValue({
        status: 1,
        gasUsed: 145000n,
        logs: [],
      });
      mockMintFromVerification.mockResolvedValue({
        hash: "0xtxhash_confirmations",
        wait: mockWait,
      });

      const job = createMockJob(baseJobData());
      await mintingProcessor(job);

      expect(mockWait).toHaveBeenCalledWith(2);
    });
  });

  // -------------------------------------------------------
  // CreditMinted event extraction
  // -------------------------------------------------------
  describe("CreditMinted event parsing", () => {
    it("extracts tokenId from CreditMinted event", async () => {
      mockParseLog.mockReturnValue({
        name: "CreditMinted",
        args: [99n, "0xOperator", 12500000000000000000n, "0xdatahash"],
      });

      const job = createMockJob(baseJobData());
      const result = await mintingProcessor(job);

      expect(result.tokenId).toBe("99");
    });

    it('returns "unknown" when CreditMinted event is not found in logs', async () => {
      mockParseLog.mockReturnValue({
        name: "Transfer",
        args: ["0x0", "0xOperator", 99n],
      });

      const job = createMockJob(baseJobData());
      const result = await mintingProcessor(job);

      expect(result.tokenId).toBe("unknown");
    });

    it("handles parseLog throwing for non-matching logs", async () => {
      mockParseLog
        .mockImplementationOnce(() => {
          throw new Error("Cannot parse log");
        })
        .mockReturnValueOnce({
          name: "CreditMinted",
          args: [77n],
        });

      const mockReceipt = {
        status: 1,
        gasUsed: 145000n,
        logs: [
          { topics: ["0xOtherTopic"], data: "0x" },
          { topics: ["0xCreditMintedTopic"], data: "0x" },
        ],
      };
      mockMintFromVerification.mockResolvedValue({
        hash: "0xtxhash_multilog",
        wait: vi.fn().mockResolvedValue(mockReceipt),
      });

      const job = createMockJob(baseJobData());
      const result = await mintingProcessor(job);

      expect(result.tokenId).toBe("77");
    });
  });

  // -------------------------------------------------------
  // Retryable vs non-retryable errors
  // -------------------------------------------------------
  describe("error classification", () => {
    it("rethrows retryable nonce error as-is", async () => {
      mockGetVerificationStatus.mockRejectedValue(
        new Error("nonce too low")
      );

      const job = createMockJob(baseJobData());
      await expect(mintingProcessor(job)).rejects.toThrow("nonce too low");
      // Should NOT be wrapped with "Non-retryable"
      await expect(mintingProcessor(job)).rejects.not.toThrow("Non-retryable");
    });

    it("rethrows retryable timeout error as-is", async () => {
      mockGetVerificationStatus.mockRejectedValue(
        new Error("request timeout exceeded")
      );

      const job = createMockJob(baseJobData());
      await expect(mintingProcessor(job)).rejects.toThrow("timeout");
    });

    it("rethrows retryable network error as-is", async () => {
      mockGetVerificationStatus.mockRejectedValue(
        new Error("network connection failed")
      );

      const job = createMockJob(baseJobData());
      await expect(mintingProcessor(job)).rejects.toThrow("network");
    });

    it("rethrows retryable rate limit error as-is", async () => {
      mockGetVerificationStatus.mockRejectedValue(
        new Error("rate limit exceeded")
      );

      const job = createMockJob(baseJobData());
      await expect(mintingProcessor(job)).rejects.toThrow("rate limit");
    });

    it("wraps non-retryable errors with Non-retryable prefix", async () => {
      mockGetVerificationStatus.mockResolvedValue([1n, true]);
      mockEstimateGas.mockRejectedValue(
        new Error("execution reverted: Insufficient balance")
      );

      const job = createMockJob(baseJobData());
      await expect(mintingProcessor(job)).rejects.toThrow(
        "Non-retryable error: execution reverted: Insufficient balance"
      );
    });

    it("wraps verification-not-passed as non-retryable", async () => {
      mockGetVerificationStatus.mockResolvedValue([0n, false]);

      const job = createMockJob(baseJobData());
      await expect(mintingProcessor(job)).rejects.toThrow("Non-retryable");
    });
  });

  // -------------------------------------------------------
  // Progress updates
  // -------------------------------------------------------
  describe("progress updates", () => {
    it("updates progress at key milestones", async () => {
      const job = createMockJob(baseJobData());
      await mintingProcessor(job);

      const progressCalls = vi.mocked(job.updateProgress).mock.calls.map(
        (c: unknown[]) => c[0]
      );
      expect(progressCalls).toEqual([10, 30, 50, 70, 85, 100]);
    });
  });

  // -------------------------------------------------------
  // Edge cases
  // -------------------------------------------------------
  describe("edge cases", () => {
    it("handles missing ipfsCid by passing empty string", async () => {
      const job = createMockJob(baseJobData({ ipfsCid: undefined }));
      await mintingProcessor(job);

      // ipfsCid arg (5th positional) should be ""
      const txCall = mockMintFromVerification.mock.calls[0]!;
      expect(txCall[4]).toBe("");
    });

    it("handles missing merkleRoot gracefully", async () => {
      const job = createMockJob(baseJobData({ merkleRoot: undefined }));
      const result = await mintingProcessor(job);

      expect(result.success).toBe(true);
    });

    it("correctly converts co2Captured and efficiencyFactor to wei", async () => {
      const job = createMockJob(
        baseJobData({ co2Captured: 5.0, efficiencyFactor: 400 })
      );
      await mintingProcessor(job);

      // co2AmountWei = parseUnits("5", 18)
      // energyUsedWei = parseUnits("2000", 18) (5.0 * 400)
      const estimateCall = mockEstimateGas.mock.calls[0]!;
      expect(estimateCall[1]).toBe(BigInt(5e18)); // co2AmountWei
      expect(estimateCall[2]).toBe(BigInt(2000e18)); // energyUsedWei
    });
  });
});
