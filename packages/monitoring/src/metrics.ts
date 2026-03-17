// TerraQura Metrics Collection
// Prometheus-compatible metrics for enterprise monitoring

import { Registry, Counter, Gauge, Histogram, Summary } from "prom-client";

// Create a custom registry
export const metricsRegistry = new Registry();

// Add default metrics (CPU, memory, etc.)
import { collectDefaultMetrics } from "prom-client";
collectDefaultMetrics({ register: metricsRegistry });

// ============================================
// BUSINESS METRICS
// ============================================

// Carbon Credits
export const carbonCreditsMinted = new Counter({
  name: "terraqura_carbon_credits_minted_total",
  help: "Total number of carbon credits minted",
  labelNames: ["operator", "vintage"],
  registers: [metricsRegistry],
});

export const carbonCreditsRetired = new Counter({
  name: "terraqura_carbon_credits_retired_total",
  help: "Total number of carbon credits retired",
  labelNames: ["retiree"],
  registers: [metricsRegistry],
});

export const carbonCreditsBalance = new Gauge({
  name: "terraqura_carbon_credits_balance",
  help: "Current carbon credit balance by owner",
  labelNames: ["owner"],
  registers: [metricsRegistry],
});

export const co2CapturedTotal = new Gauge({
  name: "terraqura_co2_captured_tonnes_total",
  help: "Total CO2 captured in tonnes",
  registers: [metricsRegistry],
});

export const co2RetiredTotal = new Gauge({
  name: "terraqura_co2_retired_tonnes_total",
  help: "Total CO2 retired in tonnes",
  registers: [metricsRegistry],
});

// Marketplace
export const marketplaceListingsActive = new Gauge({
  name: "terraqura_marketplace_listings_active",
  help: "Number of active marketplace listings",
  registers: [metricsRegistry],
});

export const marketplaceVolumeTotal = new Counter({
  name: "terraqura_marketplace_volume_usdc_total",
  help: "Total trading volume in USDC",
  registers: [metricsRegistry],
});

export const marketplaceTransactions = new Counter({
  name: "terraqura_marketplace_transactions_total",
  help: "Total number of marketplace transactions",
  labelNames: ["type"], // purchase, listing, offer
  registers: [metricsRegistry],
});

export const marketplacePricePerTonne = new Gauge({
  name: "terraqura_marketplace_price_per_tonne_usdc",
  help: "Current average price per tonne of CO2",
  registers: [metricsRegistry],
});

// Verification
export const verificationSubmissions = new Counter({
  name: "terraqura_verification_submissions_total",
  help: "Total verification submissions",
  labelNames: ["operator"],
  registers: [metricsRegistry],
});

export const verificationResults = new Counter({
  name: "terraqura_verification_results_total",
  help: "Verification results by outcome",
  labelNames: ["result"], // passed, failed
  registers: [metricsRegistry],
});

export const verificationEfficiency = new Histogram({
  name: "terraqura_verification_efficiency_kwh_per_tonne",
  help: "Distribution of efficiency factors",
  buckets: [100, 200, 300, 400, 500, 600, 700, 800],
  registers: [metricsRegistry],
});

// Buffer Pool & Reversals
export const bufferPoolCreditsTotal = new Gauge({
  name: "terraqura_buffer_pool_credits_total",
  help: "Total credits currently held in buffer pool reserve",
  registers: [metricsRegistry],
});

export const bufferPoolPercentage = new Gauge({
  name: "terraqura_buffer_pool_percentage_bps",
  help: "Current buffer pool withholding percentage in basis points",
  registers: [metricsRegistry],
});

export const bufferPoolAllocations = new Counter({
  name: "terraqura_buffer_pool_allocations_total",
  help: "Total buffer pool allocation events",
  labelNames: ["token_id"],
  registers: [metricsRegistry],
});

export const carbonReversalsTotal = new Counter({
  name: "terraqura_carbon_reversals_total",
  help: "Total carbon reversal events handled",
  labelNames: ["token_id"],
  registers: [metricsRegistry],
});

export const carbonReversalsBurnedTotal = new Gauge({
  name: "terraqura_carbon_reversals_burned_total",
  help: "Total credits burned due to carbon reversals",
  registers: [metricsRegistry],
});

export const bufferPoolHealthRatio = new Gauge({
  name: "terraqura_buffer_pool_health_ratio",
  help: "Buffer pool health ratio (buffer credits / total active credits)",
  registers: [metricsRegistry],
});

// Multi-Technology Verification
export const verificationByTechType = new Counter({
  name: "terraqura_verification_by_tech_type_total",
  help: "Verification submissions by technology type",
  labelNames: ["tech_type", "result"],
  registers: [metricsRegistry],
});

// KYC
export const kycVerifications = new Counter({
  name: "terraqura_kyc_verifications_total",
  help: "Total KYC verifications",
  labelNames: ["provider", "result"], // sumsub/onfido, verified/rejected
  registers: [metricsRegistry],
});

export const kycActiveUsers = new Gauge({
  name: "terraqura_kyc_verified_users",
  help: "Number of KYC-verified users",
  registers: [metricsRegistry],
});

// ============================================
// INFRASTRUCTURE METRICS
// ============================================

// API
export const apiRequestsTotal = new Counter({
  name: "terraqura_api_requests_total",
  help: "Total API requests",
  labelNames: ["method", "route", "status"],
  registers: [metricsRegistry],
});

export const apiRequestDuration = new Histogram({
  name: "terraqura_api_request_duration_seconds",
  help: "API request duration in seconds",
  labelNames: ["method", "route"],
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [metricsRegistry],
});

export const apiActiveConnections = new Gauge({
  name: "terraqura_api_active_connections",
  help: "Number of active API connections",
  registers: [metricsRegistry],
});

// Job Queue
export const queueJobsTotal = new Counter({
  name: "terraqura_queue_jobs_total",
  help: "Total jobs processed",
  labelNames: ["queue", "status"], // completed, failed
  registers: [metricsRegistry],
});

export const queueJobDuration = new Histogram({
  name: "terraqura_queue_job_duration_seconds",
  help: "Job processing duration",
  labelNames: ["queue"],
  buckets: [0.1, 0.5, 1, 5, 10, 30, 60, 120],
  registers: [metricsRegistry],
});

export const queueWaitingJobs = new Gauge({
  name: "terraqura_queue_waiting_jobs",
  help: "Number of jobs waiting in queue",
  labelNames: ["queue"],
  registers: [metricsRegistry],
});

export const queueActiveJobs = new Gauge({
  name: "terraqura_queue_active_jobs",
  help: "Number of jobs currently being processed",
  labelNames: ["queue"],
  registers: [metricsRegistry],
});

// Database
export const dbQueryDuration = new Histogram({
  name: "terraqura_db_query_duration_seconds",
  help: "Database query duration",
  labelNames: ["operation", "table"],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
  registers: [metricsRegistry],
});

export const dbConnectionsActive = new Gauge({
  name: "terraqura_db_connections_active",
  help: "Active database connections",
  labelNames: ["database"], // postgres, timescale
  registers: [metricsRegistry],
});

// Blockchain
export const blockchainTransactions = new Counter({
  name: "terraqura_blockchain_transactions_total",
  help: "Total blockchain transactions",
  labelNames: ["contract", "function", "status"],
  registers: [metricsRegistry],
});

export const blockchainGasUsed = new Summary({
  name: "terraqura_blockchain_gas_used",
  help: "Gas used per transaction",
  labelNames: ["contract", "function"],
  percentiles: [0.5, 0.9, 0.99],
  registers: [metricsRegistry],
});

export const blockchainLatestBlock = new Gauge({
  name: "terraqura_blockchain_latest_block",
  help: "Latest indexed block number",
  registers: [metricsRegistry],
});

// IoT / Sensors
export const sensorReadingsTotal = new Counter({
  name: "terraqura_sensor_readings_total",
  help: "Total sensor readings ingested",
  labelNames: ["dac_unit", "sensor_type"],
  registers: [metricsRegistry],
});

export const sensorAnomaliesTotal = new Counter({
  name: "terraqura_sensor_anomalies_total",
  help: "Total sensor anomalies detected",
  labelNames: ["dac_unit", "sensor_type", "anomaly_type"],
  registers: [metricsRegistry],
});

export const sensorLastSeen = new Gauge({
  name: "terraqura_sensor_last_seen_timestamp",
  help: "Last reading timestamp per sensor",
  labelNames: ["sensor_id"],
  registers: [metricsRegistry],
});

// ============================================
// HELPER FUNCTIONS
// ============================================

export function recordApiRequest(
  method: string,
  route: string,
  status: number,
  duration: number
): void {
  apiRequestsTotal.inc({ method, route, status: status.toString() });
  apiRequestDuration.observe({ method, route }, duration);
}

export function recordQueueJob(
  queue: string,
  status: "completed" | "failed",
  duration: number
): void {
  queueJobsTotal.inc({ queue, status });
  queueJobDuration.observe({ queue }, duration);
}

export function recordBlockchainTx(
  contract: string,
  func: string,
  status: "success" | "failed",
  gasUsed?: number
): void {
  blockchainTransactions.inc({ contract, function: func, status });
  if (gasUsed) {
    blockchainGasUsed.observe({ contract, function: func }, gasUsed);
  }
}

export function recordVerification(
  operator: string,
  passed: boolean,
  efficiency: number
): void {
  verificationSubmissions.inc({ operator });
  verificationResults.inc({ result: passed ? "passed" : "failed" });
  verificationEfficiency.observe(efficiency);
}

export function recordSensorReading(
  dacUnit: string,
  sensorType: string,
  isAnomaly: boolean,
  anomalyType?: string
): void {
  sensorReadingsTotal.inc({ dac_unit: dacUnit, sensor_type: sensorType });
  if (isAnomaly && anomalyType) {
    sensorAnomaliesTotal.inc({
      dac_unit: dacUnit,
      sensor_type: sensorType,
      anomaly_type: anomalyType,
    });
  }
}

export function recordBufferPoolAllocation(
  tokenId: string,
  bufferAmount: number,
  totalBufferCredits: number,
  totalActiveCredits: number
): void {
  void bufferAmount;
  bufferPoolAllocations.inc({ token_id: tokenId });
  bufferPoolCreditsTotal.set(totalBufferCredits);
  if (totalActiveCredits > 0) {
    bufferPoolHealthRatio.set(totalBufferCredits / totalActiveCredits);
  }
}

export function recordCarbonReversal(
  tokenId: string,
  amountBurned: number,
  totalReversalsBurned: number
): void {
  void amountBurned;
  carbonReversalsTotal.inc({ token_id: tokenId });
  carbonReversalsBurnedTotal.set(totalReversalsBurned);
}

export function recordTechVerification(
  techType: string,
  passed: boolean
): void {
  verificationByTechType.inc({ tech_type: techType, result: passed ? "passed" : "failed" });
}

// Get all metrics for Prometheus scraping
export async function getMetrics(): Promise<string> {
  return metricsRegistry.metrics();
}

// Get metrics as JSON
export async function getMetricsJson(): Promise<object[]> {
  return metricsRegistry.getMetricsAsJSON();
}

export default {
  metricsRegistry,
  getMetrics,
  getMetricsJson,
  recordApiRequest,
  recordQueueJob,
  recordBlockchainTx,
  recordVerification,
  recordSensorReading,
  recordBufferPoolAllocation,
  recordCarbonReversal,
  recordTechVerification,
};
