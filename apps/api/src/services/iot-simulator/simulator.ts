/**
 * TerraQura IoT Simulator
 *
 * Simulates sensor data from a Direct Air Capture (DAC) facility
 * for testing the Proof-of-Physics verification engine.
 *
 * Parameters based on real DAC industry benchmarks:
 * - CO2 capture rate: 1-10 kg/hour per unit
 * - Energy consumption: 200-600 kWh per tonne CO2
 * - CO2 purity: 90-100%
 */

import { createHash, randomBytes } from "crypto";

import {
  SimulatorConfig,
  SensorReadingInput,
  AnomalyReason,
} from "@terraqura/types";

// Default Abu Dhabi location
const DEFAULT_LATITUDE = 24.453884;
const DEFAULT_LONGITUDE = 54.377344;

// DAC efficiency constants (matching smart contract)
const MIN_KWH_PER_TONNE = 200;
const MAX_KWH_PER_TONNE = 600;
const OPTIMAL_KWH_PER_TONNE = 350;

export interface SimulatorOutput {
  reading: SensorReadingInput;
  dataHash: string;
  isAnomaly: boolean;
  anomalyType: AnomalyReason | null;
}

/**
 * Generate a random number within a range with Gaussian distribution
 */
function gaussianRandom(mean: number, stdDev: number): number {
  const u1 = Math.random();
  const u2 = Math.random();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + z * stdDev;
}

/**
 * Apply variance to a base value
 */
function applyVariance(base: number, variancePercent: number): number {
  const variance = base * (variancePercent / 100);
  return gaussianRandom(base, variance);
}

/**
 * Generate a SHA-256 hash of the sensor data
 */
function hashSensorData(data: Record<string, unknown>): string {
  const sortedData = JSON.stringify(data, Object.keys(data).sort());
  return createHash("sha256").update(sortedData).digest("hex");
}

/**
 * Create default simulator configuration
 */
export function createDefaultConfig(
  dacUnitId: string,
  sensorId: string
): SimulatorConfig {
  return {
    dacUnitId,
    sensorId,

    // Abu Dhabi location
    latitude: DEFAULT_LATITUDE,
    longitude: DEFAULT_LONGITUDE,

    // Capture parameters (optimal efficiency)
    baseCaptureRateKgHour: 5.0, // 5 kg CO2 per hour
    captureRateVariance: 10, // ±10%

    // Energy parameters (optimal = 350 kWh/tonne)
    baseEnergyKwhPerTonne: OPTIMAL_KWH_PER_TONNE,
    energyVariance: 15, // ±15%

    // Purity
    basePurityPercentage: 97,
    purityVariance: 2, // ±2%

    // Environmental
    baseTemperatureC: 35, // Abu Dhabi average
    temperatureVariance: 5,

    // Simulation behavior
    intervalSeconds: 60, // Every minute
    injectAnomalies: false,
    anomalyProbability: 0.05, // 5% chance if enabled
  };
}

/**
 * Generate a single sensor reading
 */
export function generateReading(
  config: SimulatorConfig,
  timestampOverride?: Date
): SimulatorOutput {
  const timestamp = timestampOverride ? new Date(timestampOverride) : new Date();

  // Calculate capture rate with variance
  const co2CaptureRateKgHour = Math.max(
    0.1,
    applyVariance(config.baseCaptureRateKgHour, config.captureRateVariance)
  );

  // Calculate energy consumption based on CO2 captured
  const co2Tonnes = co2CaptureRateKgHour / 1000; // Convert to tonnes
  const baseEnergy = co2Tonnes * config.baseEnergyKwhPerTonne;
  let energyConsumptionKwh = Math.max(
    0.01,
    applyVariance(baseEnergy, config.energyVariance)
  );

  // Calculate purity with variance
  let co2PurityPercentage = Math.min(
    100,
    Math.max(85, applyVariance(config.basePurityPercentage, config.purityVariance))
  );

  // Environmental data
  const ambientTemperatureC = applyVariance(
    config.baseTemperatureC,
    config.temperatureVariance
  );
  const ambientHumidityPercent = applyVariance(45, 20); // 45% ± 20%
  const atmosphericCo2Ppm = applyVariance(420, 5); // Current global average

  // Anomaly injection
  let isAnomaly = false;
  let anomalyType: AnomalyReason | null = null;

  if (config.injectAnomalies && Math.random() < config.anomalyProbability) {
    const anomalyTypes = [
      AnomalyReason.SUSPICIOUS_EFFICIENCY,
      AnomalyReason.EXCESSIVE_ENERGY,
      AnomalyReason.LOW_PURITY,
      AnomalyReason.SUDDEN_SPIKE,
      AnomalyReason.FLATLINE,
    ];

    anomalyType = anomalyTypes[Math.floor(Math.random() * anomalyTypes.length)] ?? AnomalyReason.SUSPICIOUS_EFFICIENCY;
    isAnomaly = true;

    switch (anomalyType) {
      case AnomalyReason.SUSPICIOUS_EFFICIENCY:
        // Make it look like fraud - too efficient
        energyConsumptionKwh = co2Tonnes * (MIN_KWH_PER_TONNE - 50);
        break;

      case AnomalyReason.EXCESSIVE_ENERGY:
        // Too much energy for CO2 captured
        energyConsumptionKwh = co2Tonnes * (MAX_KWH_PER_TONNE + 100);
        break;

      case AnomalyReason.LOW_PURITY:
        // Purity below acceptable threshold
        co2PurityPercentage = 85;
        break;

      case AnomalyReason.SUDDEN_SPIKE:
        // Unrealistic spike in capture rate
        // co2CaptureRateKgHour *= 10; // Already captured, just mark as anomaly
        break;

      case AnomalyReason.FLATLINE:
        // Suspiciously constant readings (potential fake data)
        // Will be detected by pattern analysis
        break;
    }
  }

  // Build raw data for hashing
  const rawData = {
    sensorId: config.sensorId,
    dacUnitId: config.dacUnitId,
    timestamp: timestamp.toISOString(),
    co2CaptureRateKgHour,
    energyConsumptionKwh,
    co2PurityPercentage,
    ambientTemperatureC,
    ambientHumidityPercent,
    atmosphericCo2Ppm,
    latitude: config.latitude,
    longitude: config.longitude,
    nonce: randomBytes(16).toString("hex"), // Add randomness for unique hash
  };

  const dataHash = hashSensorData(rawData);

  const reading: SensorReadingInput = {
    sensorId: config.sensorId,
    timestamp,
    co2CaptureRateKgHour,
    energyConsumptionKwh,
    co2PurityPercentage,
    ambientTemperatureC,
    ambientHumidityPercent,
    atmosphericCo2Ppm,
    rawData,
  };

  return {
    reading,
    dataHash: `0x${dataHash}`,
    isAnomaly,
    anomalyType,
  };
}

/**
 * Generate multiple readings over a time period
 */
export function generateReadingsBatch(
  config: SimulatorConfig,
  count: number,
  startTime?: Date
): SimulatorOutput[] {
  const readings: SimulatorOutput[] = [];
  const start = startTime || new Date();

  for (let i = 0; i < count; i++) {
    const timestamp = new Date(start.getTime() + i * config.intervalSeconds * 1000);
    const output = generateReading(config, timestamp);

    readings.push(output);
  }

  return readings;
}

/**
 * Calculate aggregate metrics from readings
 */
export function calculateAggregates(readings: SimulatorOutput[]): {
  totalCo2Kg: number;
  totalEnergyKwh: number;
  avgPurity: number;
  kwhPerTonne: number;
  efficiencyRating: string;
  anomalyCount: number;
} {
  if (readings.length === 0) {
    return {
      totalCo2Kg: 0,
      totalEnergyKwh: 0,
      avgPurity: 0,
      kwhPerTonne: 0,
      efficiencyRating: "N/A",
      anomalyCount: 0,
    };
  }

  const totalCo2Kg = readings.reduce(
    (sum, r) => sum + r.reading.co2CaptureRateKgHour,
    0
  );

  const totalEnergyKwh = readings.reduce(
    (sum, r) => sum + r.reading.energyConsumptionKwh,
    0
  );

  const avgPurity =
    readings.reduce((sum, r) => sum + (r.reading.co2PurityPercentage || 0), 0) /
    readings.length;

  const co2Tonnes = totalCo2Kg / 1000;
  const kwhPerTonne = co2Tonnes > 0 ? totalEnergyKwh / co2Tonnes : 0;

  let efficiencyRating: string;
  if (kwhPerTonne <= 0) {
    efficiencyRating = "N/A";
  } else if (kwhPerTonne <= 300) {
    efficiencyRating = "EXCELLENT";
  } else if (kwhPerTonne <= 400) {
    efficiencyRating = "GOOD";
  } else if (kwhPerTonne <= 500) {
    efficiencyRating = "ACCEPTABLE";
  } else {
    efficiencyRating = "POOR";
  }

  const anomalyCount = readings.filter((r) => r.isAnomaly).length;

  return {
    totalCo2Kg,
    totalEnergyKwh,
    avgPurity,
    kwhPerTonne,
    efficiencyRating,
    anomalyCount,
  };
}

/**
 * Start continuous simulation (returns cleanup function)
 */
export function startContinuousSimulation(
  config: SimulatorConfig,
  onReading: (output: SimulatorOutput) => void | Promise<void>
): () => void {
  const intervalMs = config.intervalSeconds * 1000;

  const intervalId = setInterval(async () => {
    const output = generateReading(config);
    await onReading(output);
  }, intervalMs);

  // Return cleanup function
  return () => {
    clearInterval(intervalId);
  };
}

// Export default for direct module usage
export default {
  createDefaultConfig,
  generateReading,
  generateReadingsBatch,
  calculateAggregates,
  startContinuousSimulation,
};
