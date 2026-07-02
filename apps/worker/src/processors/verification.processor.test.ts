import { afterEach, describe, it, expect, vi, beforeEach } from "vitest";
import type { VerificationJobData } from "@terraqura/queue";
import { createMockJob } from "../../test/helpers.js";

// CryptoJS is used for SHA256 hashing in the logic phase.
// We allow the real implementation to run since it is deterministic.
import { verificationProcessor } from "./verification.processor.js";

function baseJobData(
  overrides?: Partial<VerificationJobData>
): VerificationJobData {
  return {
    batchId: "batch-001",
    dacUnitId: "dac-unit-001",
    periodStart: "2026-03-01T00:00:00Z",
    periodEnd: "2026-03-02T00:00:00Z",
    phase: "source",
    ...overrides,
  };
}

const GOOD_TELEMETRY: NonNullable<VerificationJobData["telemetrySnapshot"]> = {
  totalCO2CapturedTonnes: 12.5,
  totalEnergyKwh: 4500,
  dataPointCount: 17280,
  anomalyCount: 23,
  avgQualityScore: 0.97,
};

describe("verificationProcessor", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  // -------------------------------------------------------
  // Phase routing
  // -------------------------------------------------------
  describe("phase routing", () => {
    it("routes to source check for phase=source", async () => {
      const job = createMockJob(baseJobData({ phase: "source" }));
      const result = await verificationProcessor(job);

      expect(result.phase).toBe("source");
    });

    it("routes to logic check for phase=logic", async () => {
      const job = createMockJob(baseJobData({ phase: "logic" }));
      const result = await verificationProcessor(job);

      expect(result.phase).toBe("logic");
    });

    it("routes to mint check for phase=mint", async () => {
      const job = createMockJob(baseJobData({ phase: "mint" }));
      const result = await verificationProcessor(job);

      expect(result.phase).toBe("mint");
    });

    it("throws for unknown phase", async () => {
      const job = createMockJob(
        baseJobData({ phase: "unknown" as VerificationJobData["phase"] })
      );
      await expect(verificationProcessor(job)).rejects.toThrow(
        "Unknown verification phase: unknown"
      );
    });
  });

  // -------------------------------------------------------
  // Source check
  // -------------------------------------------------------
  describe("source check", () => {
    it("returns success=true and passed=true for valid sensor data", async () => {
      const job = createMockJob(baseJobData({ phase: "source" }));
      const result = await verificationProcessor(job);

      expect(result.success).toBe(true);
      expect(result.passed).toBe(true);
      expect(result.phase).toBe("source");
    });

    it("sets nextPhase to logic when source check passes", async () => {
      const job = createMockJob(baseJobData({ phase: "source" }));
      const result = await verificationProcessor(job);

      expect(result.nextPhase).toBe("logic");
    });

    it("includes dataIntegrity score in details", async () => {
      const job = createMockJob(baseJobData({ phase: "source" }));
      const result = await verificationProcessor(job);

      expect(result.details.dataIntegrity).toBeDefined();
      expect(result.details.dataIntegrity).toBe(1.0);
      expect(result.details.expectedDataPoints).toBe(17280);
      expect(result.details.receivedDataPoints).toBe(17280);
    });

    it("updates progress at 10, 50, and 100", async () => {
      const job = createMockJob(baseJobData({ phase: "source" }));
      await verificationProcessor(job);

      const progressCalls = vi.mocked(job.updateProgress).mock.calls.map(
        (c: unknown[]) => c[0]
      );
      expect(progressCalls).toEqual([10, 50, 100]);
    });

    it("reports dataIntegrity as ratio of received to expected data points", async () => {
      const job = createMockJob(baseJobData({ phase: "source" }));
      const result = await verificationProcessor(job);

      expect(result.details.dataIntegrity).toBeCloseTo(1.0, 5);
    });

    it("fails source check when attached evidence shows low integrity", async () => {
      const job = createMockJob(
        baseJobData({
          phase: "source",
          sourceValidation: {
            registeredSensors: 8,
            activeSensors: 8,
            dataPointsReceived: 900,
            expectedDataPoints: 1000,
            signatureValid: true,
            timestampSequenceValid: true,
            noGapsDetected: true,
          },
        })
      );

      const result = await verificationProcessor(job);

      expect(result.passed).toBe(false);
      expect(result.nextPhase).toBeUndefined();
      expect(result.details.dataIntegrity).toBe(0.9);
    });

    it("fails fast in production when source evidence is missing", async () => {
      vi.stubEnv("NODE_ENV", "production");

      const job = createMockJob(baseJobData({ phase: "source" }));

      await expect(verificationProcessor(job)).rejects.toThrow(
        /missing sourceValidation evidence/
      );
    });
  });

  // -------------------------------------------------------
  // Logic check
  // -------------------------------------------------------
  describe("logic check", () => {
    it("returns passed=true for efficiency within bounds (200-600 kWh/tonne)", async () => {
      const job = createMockJob(
        baseJobData({ phase: "logic", telemetrySnapshot: GOOD_TELEMETRY })
      );
      const result = await verificationProcessor(job);

      expect(result.passed).toBe(true);
      expect(result.details.efficiency).toBe(360);
    });

    it("includes totalCO2 and totalEnergy in details", async () => {
      const job = createMockJob(
        baseJobData({ phase: "logic", telemetrySnapshot: GOOD_TELEMETRY })
      );
      const result = await verificationProcessor(job);

      expect(result.details.totalCO2).toBe(12.5);
      expect(result.details.totalEnergy).toBe(4500);
    });

    it("includes anomalyCount in details", async () => {
      const job = createMockJob(
        baseJobData({ phase: "logic", telemetrySnapshot: GOOD_TELEMETRY })
      );
      const result = await verificationProcessor(job);

      expect(result.details.anomalyCount).toBe(23);
      expect(result.details.anomalyRate).toBeCloseTo(23 / 17280, 8);
    });

    it("generates a SHA256 dataHash from batch metadata", async () => {
      const job = createMockJob(baseJobData({ phase: "logic" }));
      const result = await verificationProcessor(job);

      expect(result.details.dataHash).toBeDefined();
      expect(typeof result.details.dataHash).toBe("string");
      // SHA256 hex is 64 chars
      expect(result.details.dataHash!.length).toBe(64);
    });

    it("produces deterministic dataHash for same input", async () => {
      const job1 = createMockJob(
        baseJobData({ phase: "logic", telemetrySnapshot: GOOD_TELEMETRY })
      );
      const job2 = createMockJob(
        baseJobData({ phase: "logic", telemetrySnapshot: GOOD_TELEMETRY })
      );

      const result1 = await verificationProcessor(job1);
      const result2 = await verificationProcessor(job2);

      expect(result1.details.dataHash).toBe(result2.details.dataHash);
    });

    it("produces different dataHash for different batchId", async () => {
      const job1 = createMockJob(
        baseJobData({
          phase: "logic",
          batchId: "batch-001",
          telemetrySnapshot: GOOD_TELEMETRY,
        })
      );
      const job2 = createMockJob(
        baseJobData({
          phase: "logic",
          batchId: "batch-002",
          telemetrySnapshot: GOOD_TELEMETRY,
        })
      );

      const result1 = await verificationProcessor(job1);
      const result2 = await verificationProcessor(job2);

      expect(result1.details.dataHash).not.toBe(result2.details.dataHash);
    });

    it("sets nextPhase to mint when logic check passes", async () => {
      const job = createMockJob(
        baseJobData({ phase: "logic", telemetrySnapshot: GOOD_TELEMETRY })
      );
      const result = await verificationProcessor(job);

      expect(result.nextPhase).toBe("mint");
    });

    it("includes dataIntegrity (avgQualityScore) in details", async () => {
      const job = createMockJob(
        baseJobData({ phase: "logic", telemetrySnapshot: GOOD_TELEMETRY })
      );
      const result = await verificationProcessor(job);

      expect(result.details.dataIntegrity).toBe(0.97);
      expect(result.details.qualityScore).toBe(0.97);
    });

    it("updates progress at 10, 40, 70, and 100", async () => {
      const job = createMockJob(baseJobData({ phase: "logic" }));
      await verificationProcessor(job);

      const progressCalls = vi.mocked(job.updateProgress).mock.calls.map(
        (c: unknown[]) => c[0]
      );
      expect(progressCalls).toEqual([10, 40, 70, 100]);
    });

    it("computes efficiency as totalEnergy / totalCO2", async () => {
      const job = createMockJob(
        baseJobData({ phase: "logic", telemetrySnapshot: GOOD_TELEMETRY })
      );
      const result = await verificationProcessor(job);

      expect(result.details.efficiency).toBe(4500 / 12.5);
    });

    it("fails logic check when telemetry evidence is outside physics bounds", async () => {
      const job = createMockJob(
        baseJobData({
          phase: "logic",
          telemetrySnapshot: {
            ...GOOD_TELEMETRY,
            totalCO2CapturedTonnes: 10,
            totalEnergyKwh: 7000,
          },
        })
      );

      const result = await verificationProcessor(job);

      expect(result.passed).toBe(false);
      expect(result.nextPhase).toBeUndefined();
      expect(result.details.efficiency).toBe(700);
    });

    it("fails fast in production when telemetry evidence is missing", async () => {
      vi.stubEnv("NODE_ENV", "production");

      const job = createMockJob(baseJobData({ phase: "logic" }));

      await expect(verificationProcessor(job)).rejects.toThrow(
        /missing telemetrySnapshot evidence/
      );
    });
  });

  // -------------------------------------------------------
  // Mint check
  // -------------------------------------------------------
  describe("mint check", () => {
    it("returns passed=true when no duplicates and KYC verified", async () => {
      const job = createMockJob(baseJobData({ phase: "mint" }));
      const result = await verificationProcessor(job);

      expect(result.success).toBe(true);
      expect(result.passed).toBe(true);
      expect(result.phase).toBe("mint");
    });

    it("does not set nextPhase after mint check", async () => {
      const job = createMockJob(baseJobData({ phase: "mint" }));
      const result = await verificationProcessor(job);

      // mint is the final phase; nextPhase should be undefined
      expect(result.nextPhase).toBeUndefined();
    });

    it("updates progress at 10, 30, 60, 90, and 100", async () => {
      const job = createMockJob(baseJobData({ phase: "mint" }));
      await verificationProcessor(job);

      const progressCalls = vi.mocked(job.updateProgress).mock.calls.map(
        (c: unknown[]) => c[0]
      );
      expect(progressCalls).toEqual([10, 30, 60, 90, 100]);
    });

    it("returns success=true with passed=false and error when batch already minted", async () => {
      const job = createMockJob(
        baseJobData({
          phase: "mint",
          mintValidation: {
            previouslyMinted: true,
            overlappingBatches: [],
            operatorKycStatus: "VERIFIED",
            sanctionsCleared: true,
          },
        })
      );
      const result = await verificationProcessor(job);

      expect(result.passed).toBe(false);
      expect(result.error).toMatch(/already minted/i);
    });

    it("returns passed=false when KYC evidence is rejected", async () => {
      const job = createMockJob(
        baseJobData({
          phase: "mint",
          mintValidation: {
            previouslyMinted: false,
            overlappingBatches: [],
            operatorKycStatus: "REJECTED",
            sanctionsCleared: true,
          },
        })
      );

      const result = await verificationProcessor(job);

      expect(result.passed).toBe(false);
      expect(result.error).toMatch(/KYC/i);
    });

    it("fails fast in production when mint evidence is missing", async () => {
      vi.stubEnv("NODE_ENV", "production");

      const job = createMockJob(baseJobData({ phase: "mint" }));

      await expect(verificationProcessor(job)).rejects.toThrow(
        /missing mintValidation evidence/
      );
    });

    it("returns details as empty object in mint phase", async () => {
      const job = createMockJob(baseJobData({ phase: "mint" }));
      const result = await verificationProcessor(job);

      expect(result.details).toEqual({});
    });
  });

  // -------------------------------------------------------
  // Error handling
  // -------------------------------------------------------
  describe("error handling", () => {
    it("rethrows errors from phase processors", async () => {
      const job = createMockJob(
        baseJobData({ phase: "invalid_phase" as VerificationJobData["phase"] })
      );
      await expect(verificationProcessor(job)).rejects.toThrow(
        "Unknown verification phase: invalid_phase"
      );
    });

    it("preserves the original error message", async () => {
      const job = createMockJob(
        baseJobData({ phase: "garbage" as VerificationJobData["phase"] })
      );
      await expect(verificationProcessor(job)).rejects.toThrow(
        "Unknown verification phase: garbage"
      );
    });
  });

  // -------------------------------------------------------
  // Cross-phase consistency
  // -------------------------------------------------------
  describe("cross-phase consistency", () => {
    it("all phases return success=true on normal execution", async () => {
      for (const phase of ["source", "logic", "mint"] as const) {
        const job = createMockJob(baseJobData({ phase }));
        const result = await verificationProcessor(job);
        expect(result.success).toBe(true);
      }
    });

    it("all phases include the correct phase name in result", async () => {
      for (const phase of ["source", "logic", "mint"] as const) {
        const job = createMockJob(baseJobData({ phase }));
        const result = await verificationProcessor(job);
        expect(result.phase).toBe(phase);
      }
    });

    it("source and logic set nextPhase; mint does not", async () => {
      const sourceJob = createMockJob(baseJobData({ phase: "source" }));
      const sourceResult = await verificationProcessor(sourceJob);
      expect(sourceResult.nextPhase).toBe("logic");

      const logicJob = createMockJob(baseJobData({ phase: "logic" }));
      const logicResult = await verificationProcessor(logicJob);
      expect(logicResult.nextPhase).toBe("mint");

      const mintJob = createMockJob(baseJobData({ phase: "mint" }));
      const mintResult = await verificationProcessor(mintJob);
      expect(mintResult.nextPhase).toBeUndefined();
    });
  });
});
