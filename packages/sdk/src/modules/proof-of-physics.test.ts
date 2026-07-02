/**
 * Proof-of-Physics module tests.
 *
 * Covers the consensus-anchored MRV SDK surface: anchor status reads, full
 * anchor records, the canonical PoUW purpose, permissionless anchoring, and
 * every failure path (no signer, empty jobId, undeployed registry, contract
 * revert). ethers.Contract is mocked at the boundary; the module logic under
 * test is real.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

import { ProofOfPhysicsModule } from "./proof-of-physics.js";
import {
  mockTelemetry,
  mockGasManager,
  buildTestConfig,
  buildReadOnlyTestConfig,
  buildMockReceipt,
  TEST_ADDRESSES,
  TEST_DAC_UNIT_ID,
  TEST_SOURCE_DATA_HASH,
  TEST_TX_HASH,
} from "../__test__/helpers.js";
import { AuthenticationError, TerraQuraError } from "../errors.js";

// ============================================
// Mock ethers.Contract
// ============================================

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

const ethersMock = (await import("ethers")) as unknown as {
  ethers: { __contractFunctions: Record<string, ReturnType<typeof vi.fn>> };
};
const contractFunctions = ethersMock.ethers.__contractFunctions;

function makeModule(readOnly = false) {
  const config = readOnly ? buildReadOnlyTestConfig() : buildTestConfig();
  return new ProofOfPhysicsModule(config, mockTelemetry(), mockGasManager());
}

describe("ProofOfPhysicsModule", () => {
  beforeEach(() => {
    for (const key of Object.keys(contractFunctions))
      delete contractFunctions[key];
  });

  describe("isAnchored", () => {
    it("returns the on-chain anchor status", async () => {
      const mod = makeModule();
      contractFunctions.isAnchored = vi.fn().mockResolvedValue(true);

      const result = await mod.isAnchored("DAC-001", TEST_SOURCE_DATA_HASH);
      expect(result).to.equal(true);
      // sourceDataHash passes through as-is; dacUnitId is normalized to bytes32.
      expect(contractFunctions.isAnchored).toHaveBeenCalledWith(
        expect.stringMatching(/^0x[0-9a-f]{64}$/),
        TEST_SOURCE_DATA_HASH,
      );
    });

    it("reflects a false (unanchored) claim", async () => {
      const mod = makeModule();
      contractFunctions.isAnchored = vi.fn().mockResolvedValue(false);
      expect(
        await mod.isAnchored(TEST_DAC_UNIT_ID, TEST_SOURCE_DATA_HASH),
      ).to.equal(false);
    });
  });

  describe("getAnchor", () => {
    it("maps the tuple to a typed AnchorRecord", async () => {
      const mod = makeModule();
      contractFunctions.getAnchor = vi.fn().mockResolvedValue({
        sealId: "a".repeat(64),
        anchoredAt: 1_700_000_000n,
        exists: true,
        revoked: false,
      });

      const record = await mod.getAnchor(
        TEST_DAC_UNIT_ID,
        TEST_SOURCE_DATA_HASH,
      );
      expect(record).to.deep.equal({
        sealId: "a".repeat(64),
        anchoredAt: 1_700_000_000n,
        exists: true,
        revoked: false,
      });
    });

    it("returns an empty record for an unknown claim", async () => {
      const mod = makeModule();
      contractFunctions.getAnchor = vi.fn().mockResolvedValue({
        sealId: "",
        anchoredAt: 0n,
        exists: false,
        revoked: false,
      });
      const record = await mod.getAnchor(
        TEST_DAC_UNIT_ID,
        TEST_SOURCE_DATA_HASH,
      );
      expect(record.exists).to.equal(false);
      expect(record.anchoredAt).to.equal(0n);
    });
  });

  describe("expectedPurpose", () => {
    it("returns the canonical purpose string from the contract", async () => {
      const mod = makeModule();
      const purpose = `terraqura:${TEST_DAC_UNIT_ID}:${TEST_SOURCE_DATA_HASH}`;
      contractFunctions.expectedPurpose = vi.fn().mockResolvedValue(purpose);
      expect(
        await mod.expectedPurpose(TEST_DAC_UNIT_ID, TEST_SOURCE_DATA_HASH),
      ).to.equal(purpose);
    });
  });

  describe("anchorClaim", () => {
    it("anchors a claim and returns a transaction result", async () => {
      const mod = makeModule();
      const receipt = buildMockReceipt();
      contractFunctions.anchor = vi.fn().mockResolvedValue({
        wait: vi.fn().mockResolvedValue(receipt),
      });

      const result = await mod.anchorClaim({
        dacUnitId: "DAC-001",
        sourceDataHash: TEST_SOURCE_DATA_HASH,
        jobId: "job-mrv-001",
      });

      expect(result.txHash).to.equal(TEST_TX_HASH);
      expect(result.data.sourceDataHash).to.equal(TEST_SOURCE_DATA_HASH);
      expect(contractFunctions.anchor).toHaveBeenCalledWith(
        expect.stringMatching(/^0x[0-9a-f]{64}$/),
        TEST_SOURCE_DATA_HASH,
        "job-mrv-001",
        expect.anything(), // gas overrides
      );
    });

    it("throws AuthenticationError without a signer", async () => {
      const mod = makeModule(true);
      await expect(
        mod.anchorClaim({
          dacUnitId: "DAC-001",
          sourceDataHash: TEST_SOURCE_DATA_HASH,
          jobId: "job-mrv-001",
        }),
      ).rejects.toBeInstanceOf(AuthenticationError);
    });

    it("rejects an empty jobId (validation)", async () => {
      const mod = makeModule();
      await expect(
        mod.anchorClaim({
          dacUnitId: "DAC-001",
          sourceDataHash: TEST_SOURCE_DATA_HASH,
          jobId: "",
        }),
      ).rejects.toBeInstanceOf(TerraQuraError);
    });

    it("wraps a contract revert as a TerraQuraError", async () => {
      const mod = makeModule();
      contractFunctions.anchor = vi.fn().mockResolvedValue({
        wait: vi
          .fn()
          .mockRejectedValue({
            code: "CALL_EXCEPTION",
            reason: "SealNotBoundToClaim",
          }),
      });

      await expect(
        mod.anchorClaim({
          dacUnitId: "DAC-001",
          sourceDataHash: TEST_SOURCE_DATA_HASH,
          jobId: "job-mrv-001",
        }),
      ).rejects.toBeInstanceOf(TerraQuraError);
    });
  });

  describe("undeployed registry", () => {
    it("throws when sealProofOfPhysics address is the zero address", async () => {
      const config = buildTestConfig({
        addresses: {
          ...buildTestConfig().addresses,
          sealProofOfPhysics: "0x0000000000000000000000000000000000000000",
        },
      });
      const mod = new ProofOfPhysicsModule(
        config,
        mockTelemetry(),
        mockGasManager(),
      );
      await expect(
        mod.isAnchored("DAC-001", TEST_SOURCE_DATA_HASH),
      ).rejects.toBeInstanceOf(TerraQuraError);
    });

    it("uses the configured registry address when deployed", async () => {
      // Sanity: the default test config carries a non-zero address.
      expect(TEST_ADDRESSES.sealProofOfPhysics).to.not.equal(
        "0x0000000000000000000000000000000000000000",
      );
    });
  });
});
