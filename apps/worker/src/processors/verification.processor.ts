// TerraQura Verification Processor
// Three-phase Proof-of-Physics verification

import { Job, Processor } from "bullmq";
import CryptoJS from "crypto-js";
import type { VerificationJobData } from "@terraqura/queue";

// Efficiency bounds (kWh per tonne CO2)
const MIN_EFFICIENCY = 200;
const MAX_EFFICIENCY = 600;

interface VerificationResult {
  success: boolean;
  phase: string;
  passed: boolean;
  details: {
    totalCO2?: number;
    totalEnergy?: number;
    efficiency?: number;
    dataIntegrity?: number;
    anomalyCount?: number;
    dataHash?: string;
  };
  nextPhase?: string;
  error?: string;
}

export const verificationProcessor: Processor<VerificationJobData, VerificationResult> = async (
  job: Job<VerificationJobData>
) => {
  const logger = console;
  const { batchId, dacUnitId, periodStart, periodEnd, phase } = job.data;

  logger.log(
    `[Verification] Starting ${phase} check for batch ${batchId} (unit=${dacUnitId}, range=${periodStart}..${periodEnd})`
  );

  try {
    switch (phase) {
      case "source":
        return await processSourceCheck(job);
      case "logic":
        return await processLogicCheck(job);
      case "mint":
        return await processMintCheck(job);
      default:
        throw new Error(`Unknown verification phase: ${phase}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    logger.error(`[Verification] ${phase} check failed: ${errorMessage}`);
    throw error;
  }
};

/**
 * Phase 1: Source Check
 * Validates data authenticity and sensor integrity
 */
async function processSourceCheck(
  job: Job<VerificationJobData>
): Promise<VerificationResult> {
  const { batchId, dacUnitId, periodStart, periodEnd } = job.data;
  const logger = console;

  await job.updateProgress(10);
  logger.log(
    `[Source Check] Validating sensor data authenticity for batch ${batchId}, unit ${dacUnitId} (${periodStart}..${periodEnd})`
  );

  // In production, this would:
  // 1. Verify sensor API key signatures
  // 2. Check data continuity (no gaps)
  // 3. Validate timestamp sequences
  // 4. Cross-reference with registered sensors

  // Simulated checks for now
  const sensorValidation = {
    registeredSensors: 8,
    activeSensors: 8,
    dataPointsReceived: 17280, // 24h * 60min * 12 readings/min
    expectedDataPoints: 17280,
    signatureValid: true,
    timestampSequenceValid: true,
    noGapsDetected: true,
  };

  await job.updateProgress(50);

  // Calculate data integrity score
  const dataIntegrity =
    sensorValidation.dataPointsReceived / sensorValidation.expectedDataPoints;

  // Source check passes if:
  // - All registered sensors are active
  // - Data integrity > 95%
  // - All signatures valid
  // - No timestamp anomalies
  const passed =
    sensorValidation.activeSensors === sensorValidation.registeredSensors &&
    dataIntegrity >= 0.95 &&
    sensorValidation.signatureValid &&
    sensorValidation.timestampSequenceValid;

  await job.updateProgress(100);
  logger.log(`[Source Check] Completed: ${passed ? "PASSED" : "FAILED"}`);

  return {
    success: true,
    phase: "source",
    passed,
    details: {
      dataIntegrity,
    },
    nextPhase: passed ? "logic" : undefined,
  };
}

/**
 * Phase 2: Logic Check
 * Validates efficiency within acceptable bounds (Proof-of-Physics)
 */
async function processLogicCheck(
  job: Job<VerificationJobData>
): Promise<VerificationResult> {
  const { batchId, dacUnitId, periodStart, periodEnd } = job.data;
  const logger = console;

  await job.updateProgress(10);
  logger.log(
    `[Logic Check] Calculating efficiency metrics for unit ${dacUnitId} (${periodStart}..${periodEnd})`
  );

  // In production, this would query TimescaleDB for aggregated data
  // Simulated metrics for demonstration
  const metrics = {
    totalCO2Captured: 12.5, // tonnes
    totalEnergyUsed: 4500, // kWh
    dataPointCount: 17280,
    anomalyCount: 23,
    avgQualityScore: 0.97,
  };

  await job.updateProgress(40);

  // Calculate efficiency factor
  const efficiency = metrics.totalEnergyUsed / metrics.totalCO2Captured;

  logger.log(
    `[Logic Check] Efficiency: ${efficiency.toFixed(2)} kWh/tonne (bounds: ${MIN_EFFICIENCY}-${MAX_EFFICIENCY})`
  );

  await job.updateProgress(70);

  // Logic check passes if:
  // - Efficiency within bounds (200-600 kWh/tonne)
  // - Anomaly rate < 5%
  // - Quality score > 90%
  const anomalyRate = metrics.anomalyCount / metrics.dataPointCount;
  const passed =
    efficiency >= MIN_EFFICIENCY &&
    efficiency <= MAX_EFFICIENCY &&
    anomalyRate < 0.05 &&
    metrics.avgQualityScore >= 0.9;

  // Generate data hash for on-chain verification
  const dataToHash = JSON.stringify({
    batchId,
    dacUnitId,
    periodStart,
    periodEnd,
    totalCO2: metrics.totalCO2Captured,
    totalEnergy: metrics.totalEnergyUsed,
    efficiency,
    dataPoints: metrics.dataPointCount,
  });
  const dataHash = CryptoJS.SHA256(dataToHash).toString();

  await job.updateProgress(100);
  logger.log(`[Logic Check] Completed: ${passed ? "PASSED" : "FAILED"}`);

  return {
    success: true,
    phase: "logic",
    passed,
    details: {
      totalCO2: metrics.totalCO2Captured,
      totalEnergy: metrics.totalEnergyUsed,
      efficiency,
      dataIntegrity: metrics.avgQualityScore,
      anomalyCount: metrics.anomalyCount,
      dataHash,
    },
    nextPhase: passed ? "mint" : undefined,
  };
}

/**
 * Phase 3: Mint Check
 * Final validation and on-chain verification submission
 */
async function processMintCheck(
  job: Job<VerificationJobData>
): Promise<VerificationResult> {
  const { batchId, dacUnitId, periodStart, periodEnd } = job.data;
  const logger = console;

  await job.updateProgress(10);
  logger.log(
    `[Mint Check] Performing final validation for batch ${batchId} (unit=${dacUnitId}, range=${periodStart}..${periodEnd})`
  );

  // In production, this would:
  // 1. Re-verify all previous checks
  // 2. Check for duplicate minting attempts
  // 3. Verify operator KYC status
  // 4. Submit verification to smart contract
  // 5. Optionally trigger Chainlink verification

  await job.updateProgress(30);

  // Check for duplicate minting
  const duplicateCheck = {
    previouslyMinted: false,
    lastMintTime: null,
    overlappingBatches: [],
  };

  if (duplicateCheck.previouslyMinted) {
    return {
      success: true,
      phase: "mint",
      passed: false,
      details: {},
      error: "Batch already minted",
    };
  }

  await job.updateProgress(60);

  // Verify operator KYC status
  const operatorKyc = {
    status: "VERIFIED",
    expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    sanctionsCleared: true,
  };

  if (operatorKyc.status !== "VERIFIED" || !operatorKyc.sanctionsCleared) {
    return {
      success: true,
      phase: "mint",
      passed: false,
      details: {},
      error: "Operator KYC not verified or sanctions check failed",
    };
  }

  await job.updateProgress(90);

  // All checks passed - ready for minting
  logger.log(`[Mint Check] All validations passed, batch ready for minting`);

  await job.updateProgress(100);

  return {
    success: true,
    phase: "mint",
    passed: true,
    details: {},
  };
}

export default verificationProcessor;
