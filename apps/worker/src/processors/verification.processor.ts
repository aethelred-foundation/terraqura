// TerraQura Verification Processor
// Three-phase Proof-of-Physics verification

import { Job, Processor } from "bullmq";
import CryptoJS from "crypto-js";
import type { VerificationJobData } from "@terraqura/queue";

import { createScopedLogger, serializeError } from "../lib/logger.js";

// Efficiency bounds (kWh per tonne CO2)
const MIN_EFFICIENCY = 200;
const MAX_EFFICIENCY = 600;
const MIN_DATA_INTEGRITY = 0.95;
const MIN_QUALITY_SCORE = 0.9;
const MAX_ANOMALY_RATE = 0.05;
const DEFAULT_REGISTERED_SENSORS = 8;
const EXPECTED_READINGS_PER_MINUTE = 12;

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
    anomalyRate?: number;
    qualityScore?: number;
    expectedDataPoints?: number;
    receivedDataPoints?: number;
    dataHash?: string;
  };
  nextPhase?: string;
  error?: string;
}

interface CaptureWindow {
  startMs: number;
  endMs: number;
  durationMinutes: number;
  durationHours: number;
}

interface SourceValidationEvidence {
  registeredSensors: number;
  activeSensors: number;
  dataPointsReceived: number;
  expectedDataPoints: number;
  signatureValid: boolean;
  timestampSequenceValid: boolean;
  noGapsDetected: boolean;
}

interface TelemetrySnapshot {
  totalCO2CapturedTonnes: number;
  totalEnergyKwh: number;
  dataPointCount: number;
  anomalyCount: number;
  avgQualityScore: number;
}

interface MintValidationEvidence {
  previouslyMinted: boolean;
  lastMintTime: string | null;
  overlappingBatches: string[];
  operatorKycStatus: "VERIFIED" | "PENDING" | "REJECTED" | "EXPIRED";
  operatorKycExpiresAt: string | null;
  sanctionsCleared: boolean;
}

export const verificationProcessor: Processor<VerificationJobData, VerificationResult> = async (
  job: Job<VerificationJobData>
) => {
  const { batchId, dacUnitId, periodStart, periodEnd, phase } = job.data;
  const logger = createScopedLogger("verification.processor", {
    jobId: job.id,
    batchId,
    dacUnitId,
    phase,
  });

  logger.info("Starting verification phase", { periodStart, periodEnd });

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
    logger.error("Verification phase failed", {
      err: serializeError(error),
    });
    throw error;
  }
};

/**
 * Phase 1: Source Check
 * Validates source completeness, signing evidence, and timestamp integrity.
 */
async function processSourceCheck(
  job: Job<VerificationJobData>
): Promise<VerificationResult> {
  const { batchId, dacUnitId, periodStart, periodEnd } = job.data;
  const logger = createScopedLogger("verification.source-check", {
    jobId: job.id,
    batchId,
    dacUnitId,
  });

  await job.updateProgress(10);
  logger.info("Validating sensor data authenticity", { periodStart, periodEnd });

  const sensorValidation = resolveSourceValidation(job.data);

  await job.updateProgress(50);

  const dataIntegrity = safeRatio(
    sensorValidation.dataPointsReceived,
    sensorValidation.expectedDataPoints
  );

  const passed =
    sensorValidation.activeSensors === sensorValidation.registeredSensors &&
    dataIntegrity >= MIN_DATA_INTEGRITY &&
    sensorValidation.signatureValid &&
    sensorValidation.timestampSequenceValid &&
    sensorValidation.noGapsDetected;

  const dataHash = hashCanonical({
    phase: "source",
    batchId,
    dacUnitId,
    periodStart,
    periodEnd,
    sensorValidation,
  });

  await job.updateProgress(100);
  logger.info("Source check completed", {
    passed,
    dataIntegrity,
    expectedDataPoints: sensorValidation.expectedDataPoints,
    receivedDataPoints: sensorValidation.dataPointsReceived,
  });

  return {
    success: true,
    phase: "source",
    passed,
    details: {
      dataIntegrity,
      expectedDataPoints: sensorValidation.expectedDataPoints,
      receivedDataPoints: sensorValidation.dataPointsReceived,
      dataHash,
    },
    nextPhase: passed ? "logic" : undefined,
  };
}

/**
 * Phase 2: Logic Check
 * Validates efficiency within acceptable bounds (Proof-of-Physics).
 */
async function processLogicCheck(
  job: Job<VerificationJobData>
): Promise<VerificationResult> {
  const { batchId, dacUnitId, periodStart, periodEnd } = job.data;
  const logger = createScopedLogger("verification.logic-check", {
    jobId: job.id,
    batchId,
    dacUnitId,
  });

  await job.updateProgress(10);
  logger.info("Calculating efficiency metrics", { periodStart, periodEnd });

  const metrics = resolveTelemetrySnapshot(job.data);

  await job.updateProgress(40);

  const efficiency = safeRatio(
    metrics.totalEnergyKwh,
    metrics.totalCO2CapturedTonnes
  );

  logger.info("Calculated efficiency metrics", {
    efficiency,
    minEfficiency: MIN_EFFICIENCY,
    maxEfficiency: MAX_EFFICIENCY,
  });

  await job.updateProgress(70);

  const anomalyRate = safeRatio(metrics.anomalyCount, metrics.dataPointCount);
  const passed =
    efficiency >= MIN_EFFICIENCY &&
    efficiency <= MAX_EFFICIENCY &&
    anomalyRate < MAX_ANOMALY_RATE &&
    metrics.avgQualityScore >= MIN_QUALITY_SCORE;

  const dataHash = hashCanonical({
    phase: "logic",
    batchId,
    dacUnitId,
    periodStart,
    periodEnd,
    totalCO2: metrics.totalCO2CapturedTonnes,
    totalEnergy: metrics.totalEnergyKwh,
    efficiency,
    dataPoints: metrics.dataPointCount,
    anomalyCount: metrics.anomalyCount,
    qualityScore: metrics.avgQualityScore,
  });

  await job.updateProgress(100);
  logger.info("Logic check completed", {
    passed,
    efficiency,
    anomalyRate,
    qualityScore: metrics.avgQualityScore,
  });

  return {
    success: true,
    phase: "logic",
    passed,
    details: {
      totalCO2: metrics.totalCO2CapturedTonnes,
      totalEnergy: metrics.totalEnergyKwh,
      efficiency,
      dataIntegrity: metrics.avgQualityScore,
      qualityScore: metrics.avgQualityScore,
      anomalyCount: metrics.anomalyCount,
      anomalyRate,
      dataHash,
    },
    nextPhase: passed ? "mint" : undefined,
  };
}

/**
 * Phase 3: Mint Check
 * Final validation before on-chain verification submission.
 */
async function processMintCheck(
  job: Job<VerificationJobData>
): Promise<VerificationResult> {
  const { batchId, dacUnitId, periodStart, periodEnd } = job.data;
  const logger = createScopedLogger("verification.mint-check", {
    jobId: job.id,
    batchId,
    dacUnitId,
  });

  await job.updateProgress(10);
  logger.info("Performing final mint validation", { periodStart, periodEnd });

  const mintValidation = resolveMintValidation(job.data);

  await job.updateProgress(30);

  if (
    mintValidation.previouslyMinted ||
    mintValidation.overlappingBatches.length > 0
  ) {
    return {
      success: true,
      phase: "mint",
      passed: false,
      details: {},
      error: "Batch already minted or overlaps an existing mint",
    };
  }

  await job.updateProgress(60);

  const kycExpired =
    mintValidation.operatorKycExpiresAt !== null &&
    Date.parse(mintValidation.operatorKycExpiresAt) <= Date.now();

  if (
    mintValidation.operatorKycStatus !== "VERIFIED" ||
    !mintValidation.sanctionsCleared ||
    kycExpired
  ) {
    return {
      success: true,
      phase: "mint",
      passed: false,
      details: {},
      error: "Operator KYC not verified or sanctions check failed",
    };
  }

  await job.updateProgress(90);

  logger.info("Mint validations passed, batch ready for minting");

  await job.updateProgress(100);

  return {
    success: true,
    phase: "mint",
    passed: true,
    details: {},
  };
}

function resolveSourceValidation(data: VerificationJobData): SourceValidationEvidence {
  const evidence = data.sourceValidation;
  const expectedDataPoints =
    evidence?.expectedDataPoints ?? deriveExpectedDataPoints(data);

  if (!evidence && !allowDerivedEvidence()) {
    throw new Error(
      "Verification job missing sourceValidation evidence; attach source evidence or set VERIFICATION_ALLOW_DERIVED_SNAPSHOT=true for local drills"
    );
  }

  return {
    registeredSensors: positiveInteger(
      evidence?.registeredSensors ?? DEFAULT_REGISTERED_SENSORS,
      "registeredSensors"
    ),
    activeSensors: positiveInteger(
      evidence?.activeSensors ?? DEFAULT_REGISTERED_SENSORS,
      "activeSensors"
    ),
    dataPointsReceived: nonNegativeInteger(
      evidence?.dataPointsReceived ?? expectedDataPoints,
      "dataPointsReceived"
    ),
    expectedDataPoints: positiveInteger(expectedDataPoints, "expectedDataPoints"),
    signatureValid: evidence?.signatureValid ?? true,
    timestampSequenceValid: evidence?.timestampSequenceValid ?? true,
    noGapsDetected: evidence?.noGapsDetected ?? true,
  };
}

function resolveTelemetrySnapshot(data: VerificationJobData): TelemetrySnapshot {
  if (data.telemetrySnapshot) {
    return normalizeTelemetrySnapshot(data.telemetrySnapshot);
  }

  if (!allowDerivedEvidence()) {
    throw new Error(
      "Verification job missing telemetrySnapshot evidence; attach telemetry aggregate evidence or set VERIFICATION_ALLOW_DERIVED_SNAPSHOT=true for local drills"
    );
  }

  return deriveTelemetrySnapshot(data);
}

function resolveMintValidation(data: VerificationJobData): MintValidationEvidence {
  const evidence = data.mintValidation;

  if (!evidence && !allowDerivedEvidence()) {
    throw new Error(
      "Verification job missing mintValidation evidence; attach duplicate/KYC evidence or set VERIFICATION_ALLOW_DERIVED_SNAPSHOT=true for local drills"
    );
  }

  const expiresAt = evidence?.operatorKycExpiresAt ?? null;
  if (expiresAt !== null && Number.isNaN(Date.parse(expiresAt))) {
    throw new Error("operatorKycExpiresAt must be a valid ISO timestamp");
  }

  return {
    previouslyMinted: evidence?.previouslyMinted ?? false,
    lastMintTime: evidence?.lastMintTime ?? null,
    overlappingBatches: evidence?.overlappingBatches ?? [],
    operatorKycStatus: evidence?.operatorKycStatus ?? "VERIFIED",
    operatorKycExpiresAt: expiresAt,
    sanctionsCleared: evidence?.sanctionsCleared ?? true,
  };
}

function normalizeTelemetrySnapshot(
  snapshot: VerificationJobData["telemetrySnapshot"]
): TelemetrySnapshot {
  if (!snapshot) {
    throw new Error("telemetrySnapshot is required");
  }

  return {
    totalCO2CapturedTonnes: positiveNumber(
      snapshot.totalCO2CapturedTonnes,
      "totalCO2CapturedTonnes"
    ),
    totalEnergyKwh: positiveNumber(snapshot.totalEnergyKwh, "totalEnergyKwh"),
    dataPointCount: positiveInteger(snapshot.dataPointCount, "dataPointCount"),
    anomalyCount: nonNegativeInteger(snapshot.anomalyCount ?? 0, "anomalyCount"),
    avgQualityScore: boundedNumber(
      snapshot.avgQualityScore ?? 1,
      "avgQualityScore",
      0,
      1
    ),
  };
}

function deriveTelemetrySnapshot(data: VerificationJobData): TelemetrySnapshot {
  const window = parseCaptureWindow(data);
  const expectedDataPoints = deriveExpectedDataPoints(data);
  const seed = unitIntervalFromHash(
    `${data.batchId}:${data.dacUnitId}:${data.periodStart}:${data.periodEnd}`
  );
  const captureRateTonnesPerHour = 0.48 + seed * 0.1;
  const totalCO2CapturedTonnes = round(
    Math.max(window.durationHours * captureRateTonnesPerHour, 0.001),
    6
  );
  const targetEfficiency = 320 + seed * 140;
  const totalEnergyKwh = round(totalCO2CapturedTonnes * targetEfficiency, 6);
  const anomalyRate = 0.001 + seed * 0.004;

  return {
    totalCO2CapturedTonnes,
    totalEnergyKwh,
    dataPointCount: expectedDataPoints,
    anomalyCount: Math.floor(expectedDataPoints * anomalyRate),
    avgQualityScore: round(0.94 + seed * 0.04, 4),
  };
}

function deriveExpectedDataPoints(data: VerificationJobData): number {
  const window = parseCaptureWindow(data);
  return Math.max(
    1,
    Math.ceil(window.durationMinutes * EXPECTED_READINGS_PER_MINUTE)
  );
}

function parseCaptureWindow(data: VerificationJobData): CaptureWindow {
  const startMs = Date.parse(data.periodStart);
  const endMs = Date.parse(data.periodEnd);

  if (Number.isNaN(startMs) || Number.isNaN(endMs)) {
    throw new Error("Verification periodStart and periodEnd must be valid ISO timestamps");
  }

  if (endMs <= startMs) {
    throw new Error("Verification periodEnd must be after periodStart");
  }

  const durationMinutes = (endMs - startMs) / 60_000;
  return {
    startMs,
    endMs,
    durationMinutes,
    durationHours: durationMinutes / 60,
  };
}

function allowDerivedEvidence(): boolean {
  return (
    process.env.NODE_ENV === "test" ||
    process.env.VERIFICATION_ALLOW_DERIVED_SNAPSHOT === "true"
  );
}

function safeRatio(numerator: number, denominator: number): number {
  if (denominator <= 0) {
    return 0;
  }
  return numerator / denominator;
}

function positiveNumber(value: number, field: string): number {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${field} must be a positive finite number`);
  }
  return value;
}

function boundedNumber(
  value: number,
  field: string,
  min: number,
  max: number
): number {
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new Error(`${field} must be between ${min} and ${max}`);
  }
  return value;
}

function positiveInteger(value: number, field: string): number {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${field} must be a positive safe integer`);
  }
  return value;
}

function nonNegativeInteger(value: number, field: string): number {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${field} must be a non-negative safe integer`);
  }
  return value;
}

function unitIntervalFromHash(value: string): number {
  const hex = CryptoJS.SHA256(value).toString().slice(0, 12);
  return Number.parseInt(hex, 16) / 0xffffffffffff;
}

function hashCanonical(value: unknown): string {
  return CryptoJS.SHA256(JSON.stringify(canonicalize(value))).toString();
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return Object.keys(record)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = canonicalize(record[key]);
        return acc;
      }, {});
  }

  return value;
}

function round(value: number, precision: number): number {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

export default verificationProcessor;
