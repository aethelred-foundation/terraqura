/**
 * IoT Sensor types for TerraQura platform
 */

export interface WhitelistedSensor {
  id: string;
  sensorId: string;
  dacUnitId: string;

  sensorType: SensorType;
  manufacturer: string | null;
  model: string | null;
  calibrationDate: Date | null;

  isActive: boolean;
  createdAt: Date;
}

export enum SensorType {
  CO2_CAPTURE = "co2_capture",
  ENERGY_METER = "energy_meter",
  PURITY_ANALYZER = "purity_analyzer",
  ENVIRONMENTAL = "environmental",
}

/**
 * Raw sensor reading from IoT device
 */
export interface SensorReading {
  time: Date;
  dacUnitId: string;
  sensorId: string;

  // Capture metrics
  co2CaptureRateKgHour: number;
  energyConsumptionKwh: number;
  co2PurityPercentage: number | null;

  // Environmental conditions
  ambientTemperatureC: number | null;
  ambientHumidityPercent: number | null;
  atmosphericCo2Ppm: number | null;

  // Data integrity
  dataHash: string; // SHA-256 of raw data

  // Validation
  isAnomaly: boolean;
  anomalyReason: string | null;
  validatedAt: Date | null;
}

export interface SensorReadingInput {
  sensorId: string;
  timestamp: Date;

  // Capture metrics
  co2CaptureRateKgHour: number;
  energyConsumptionKwh: number;
  co2PurityPercentage?: number;

  // Environmental conditions (optional)
  ambientTemperatureC?: number;
  ambientHumidityPercent?: number;
  atmosphericCo2Ppm?: number;

  // Raw data for hashing
  rawData?: Record<string, unknown>;
}

/**
 * Anomaly detection result
 */
export interface AnomalyDetectionResult {
  isAnomaly: boolean;
  reason: AnomalyReason | null;
  severity: "LOW" | "MEDIUM" | "HIGH" | null;
  details: string | null;
}

export enum AnomalyReason {
  // Efficiency anomalies
  SUSPICIOUS_EFFICIENCY = "SUSPICIOUS_EFFICIENCY", // Too efficient (< 200 kWh/tonne)
  EXCESSIVE_ENERGY = "EXCESSIVE_ENERGY", // Too inefficient (> 600 kWh/tonne)

  // Purity anomalies
  LOW_PURITY = "LOW_PURITY", // Below 90% purity

  // Data anomalies
  MISSING_DATA = "MISSING_DATA",
  INVALID_RANGE = "INVALID_RANGE",
  TIMESTAMP_ANOMALY = "TIMESTAMP_ANOMALY",

  // Pattern anomalies
  SUDDEN_SPIKE = "SUDDEN_SPIKE",
  SUDDEN_DROP = "SUDDEN_DROP",
  FLATLINE = "FLATLINE", // No variation (possibly fake data)
}

/**
 * Aggregated sensor summary
 */
export interface SensorSummary {
  dacUnitId: string;
  startTime: Date;
  endTime: Date;

  // Aggregated metrics
  totalCo2CapturedKg: number;
  totalEnergyConsumedKwh: number;
  avgCo2CaptureRateKgHour: number;
  avgPurityPercentage: number;

  // Efficiency
  kwhPerTonne: number;
  efficiencyRating: "EXCELLENT" | "GOOD" | "ACCEPTABLE" | "POOR";

  // Data quality
  readingCount: number;
  anomalyCount: number;
  dataCompleteness: number; // 0-100%
}

/**
 * IoT Simulator configuration
 */
export interface SimulatorConfig {
  dacUnitId: string;
  sensorId: string;

  // Location (Abu Dhabi default)
  latitude: number;
  longitude: number;

  // Capture parameters
  baseCaptureRateKgHour: number;
  captureRateVariance: number; // Percentage variance

  // Energy parameters
  baseEnergyKwhPerTonne: number; // Optimal around 350
  energyVariance: number;

  // Purity
  basePurityPercentage: number;
  purityVariance: number;

  // Environmental
  baseTemperatureC: number;
  temperatureVariance: number;

  // Simulation behavior
  intervalSeconds: number;
  injectAnomalies: boolean;
  anomalyProbability: number; // 0-1
}
