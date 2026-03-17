// TerraQura TimescaleDB Client
// High-performance time-series data operations

import { Pool } from "pg";

export interface SensorReading {
  time: Date;
  sensorId: string;
  dacUnitId: string;
  sensorType: string;
  value: number;
  unit: string;
  qualityScore?: number;
  isAnomaly?: boolean;
  anomalyType?: string;
  rawDataHash?: string;
  firmwareVersion?: string;
  signalStrength?: number;
}

export interface VerificationSnapshot {
  totalCo2Captured: number;
  totalEnergyUsed: number;
  efficiencyFactor: number;
  dataPointCount: number;
  avgQualityScore: number;
  anomalyCount: number;
  dataHash: string;
}

export interface HourlyAggregate {
  bucket: Date;
  dacUnitId: string;
  sensorId: string;
  sensorType: string;
  avgValue: number;
  minValue: number;
  maxValue: number;
  stddevValue: number;
  readingCount: number;
  avgQuality: number;
  anomalyCount: number;
}

export interface DailyAggregate {
  bucket: Date;
  dacUnitId: string;
  sensorType: string;
  totalValue: number;
  avgValue: number;
  minValue: number;
  maxValue: number;
  readingCount: number;
  avgQuality: number;
  anomalyCount: number;
  dataIntegrityRatio: number;
}

export interface EfficiencyMetric {
  time: Date;
  dacUnitId: string;
  co2Captured24h: number;
  energyUsed24h: number;
  efficiency24h: number;
  isWithinRange: boolean;
  efficiencyScore: number;
  alertTriggered: boolean;
  alertType?: string;
}

export class TimescaleClient {
  private pool: Pool;

  constructor(connectionString?: string) {
    this.pool = new Pool({
      connectionString:
        connectionString || process.env.TIMESCALE_URL || process.env.DATABASE_URL,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });

    // Handle pool errors
    this.pool.on("error", (err) => {
      console.error("Unexpected TimescaleDB pool error:", err);
    });
  }

  /**
   * Insert a single sensor reading
   */
  async insertReading(reading: SensorReading): Promise<void> {
    const query = `
      INSERT INTO sensor_readings (
        time, sensor_id, dac_unit_id, sensor_type, value, unit,
        quality_score, is_anomaly, anomaly_type, raw_data_hash,
        firmware_version, signal_strength
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    `;

    await this.pool.query(query, [
      reading.time,
      reading.sensorId,
      reading.dacUnitId,
      reading.sensorType,
      reading.value,
      reading.unit,
      reading.qualityScore ?? 1.0,
      reading.isAnomaly ?? false,
      reading.anomalyType,
      reading.rawDataHash,
      reading.firmwareVersion,
      reading.signalStrength,
    ]);
  }

  /**
   * Batch insert sensor readings (high performance)
   */
  async insertReadingsBatch(readings: SensorReading[]): Promise<void> {
    if (readings.length === 0) return;

    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");

      const queryValues: unknown[] = [];
      const placeholders = readings
        .map((reading, index) => {
          const start = index * 12;
          queryValues.push(
            reading.time,
            reading.sensorId,
            reading.dacUnitId,
            reading.sensorType,
            reading.value,
            reading.unit,
            reading.qualityScore ?? 1.0,
            reading.isAnomaly ?? false,
            reading.anomalyType ?? null,
            reading.rawDataHash ?? null,
            reading.firmwareVersion ?? null,
            reading.signalStrength ?? null
          );

          return `($${start + 1}, $${start + 2}, $${start + 3}, $${start + 4}, $${start + 5}, $${start + 6}, $${start + 7}, $${start + 8}, $${start + 9}, $${start + 10}, $${start + 11}, $${start + 12})`;
        })
        .join(", ");

      await client.query(
        `
        INSERT INTO sensor_readings (
          time, sensor_id, dac_unit_id, sensor_type, value, unit,
          quality_score, is_anomaly, anomaly_type, raw_data_hash,
          firmware_version, signal_strength
        ) VALUES ${placeholders}
      `,
        queryValues
      );

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get readings for a specific sensor within a time range
   */
  async getReadings(
    sensorId: string,
    startTime: Date,
    endTime: Date,
    limit = 1000
  ): Promise<SensorReading[]> {
    const query = `
      SELECT
        time, sensor_id, dac_unit_id, sensor_type, value, unit,
        quality_score, is_anomaly, anomaly_type, raw_data_hash
      FROM sensor_readings
      WHERE sensor_id = $1
        AND time >= $2
        AND time < $3
      ORDER BY time DESC
      LIMIT $4
    `;

    const result = await this.pool.query(query, [sensorId, startTime, endTime, limit]);

    return result.rows.map((row) => ({
      time: row.time,
      sensorId: row.sensor_id,
      dacUnitId: row.dac_unit_id,
      sensorType: row.sensor_type,
      value: parseFloat(row.value),
      unit: row.unit,
      qualityScore: parseFloat(row.quality_score),
      isAnomaly: row.is_anomaly,
      anomalyType: row.anomaly_type,
      rawDataHash: row.raw_data_hash,
    }));
  }

  /**
   * Get hourly aggregates for dashboard
   */
  async getHourlyAggregates(
    dacUnitId: string,
    startTime: Date,
    endTime: Date
  ): Promise<HourlyAggregate[]> {
    const query = `
      SELECT
        bucket, dac_unit_id, sensor_id, sensor_type,
        avg_value, min_value, max_value, stddev_value,
        reading_count, avg_quality, anomaly_count
      FROM sensor_readings_hourly
      WHERE dac_unit_id = $1
        AND bucket >= $2
        AND bucket < $3
      ORDER BY bucket DESC
    `;

    const result = await this.pool.query(query, [dacUnitId, startTime, endTime]);

    return result.rows.map((row) => ({
      bucket: row.bucket,
      dacUnitId: row.dac_unit_id,
      sensorId: row.sensor_id,
      sensorType: row.sensor_type,
      avgValue: parseFloat(row.avg_value),
      minValue: parseFloat(row.min_value),
      maxValue: parseFloat(row.max_value),
      stddevValue: parseFloat(row.stddev_value),
      readingCount: parseInt(row.reading_count),
      avgQuality: parseFloat(row.avg_quality),
      anomalyCount: parseInt(row.anomaly_count),
    }));
  }

  /**
   * Get daily aggregates for verification
   */
  async getDailyAggregates(
    dacUnitId: string,
    startTime: Date,
    endTime: Date
  ): Promise<DailyAggregate[]> {
    const query = `
      SELECT
        bucket, dac_unit_id, sensor_type,
        total_value, avg_value, min_value, max_value,
        reading_count, avg_quality, anomaly_count, data_integrity_ratio
      FROM sensor_readings_daily
      WHERE dac_unit_id = $1
        AND bucket >= $2
        AND bucket < $3
      ORDER BY bucket DESC, sensor_type
    `;

    const result = await this.pool.query(query, [dacUnitId, startTime, endTime]);

    return result.rows.map((row) => ({
      bucket: row.bucket,
      dacUnitId: row.dac_unit_id,
      sensorType: row.sensor_type,
      totalValue: parseFloat(row.total_value),
      avgValue: parseFloat(row.avg_value),
      minValue: parseFloat(row.min_value),
      maxValue: parseFloat(row.max_value),
      readingCount: parseInt(row.reading_count),
      avgQuality: parseFloat(row.avg_quality),
      anomalyCount: parseInt(row.anomaly_count),
      dataIntegrityRatio: parseFloat(row.data_integrity_ratio),
    }));
  }

  /**
   * Calculate verification snapshot for a period
   */
  async calculateVerificationSnapshot(
    dacUnitId: string,
    startTime: Date,
    endTime: Date
  ): Promise<VerificationSnapshot> {
    const query = `
      SELECT * FROM calculate_verification_snapshot($1, $2, $3)
    `;

    const result = await this.pool.query(query, [dacUnitId, startTime, endTime]);

    if (result.rows.length === 0) {
      throw new Error("No data found for verification period");
    }

    const row = result.rows[0];
    return {
      totalCo2Captured: parseFloat(row.total_co2_captured),
      totalEnergyUsed: parseFloat(row.total_energy_used),
      efficiencyFactor: parseFloat(row.efficiency_factor),
      dataPointCount: parseInt(row.data_point_count),
      avgQualityScore: parseFloat(row.avg_quality_score),
      anomalyCount: parseInt(row.anomaly_count),
      dataHash: row.data_hash,
    };
  }

  /**
   * Get latest efficiency metrics for a DAC unit
   */
  async getEfficiencyMetrics(
    dacUnitId: string,
    hours = 24
  ): Promise<EfficiencyMetric[]> {
    const query = `
      SELECT
        time, dac_unit_id, co2_captured_24h, energy_used_24h,
        efficiency_24h, is_within_range, efficiency_score,
        alert_triggered, alert_type
      FROM efficiency_metrics
      WHERE dac_unit_id = $1
        AND time >= NOW() - INTERVAL '${hours} hours'
      ORDER BY time DESC
    `;

    const result = await this.pool.query(query, [dacUnitId]);

    return result.rows.map((row) => ({
      time: row.time,
      dacUnitId: row.dac_unit_id,
      co2Captured24h: parseFloat(row.co2_captured_24h),
      energyUsed24h: parseFloat(row.energy_used_24h),
      efficiency24h: parseFloat(row.efficiency_24h),
      isWithinRange: row.is_within_range,
      efficiencyScore: parseFloat(row.efficiency_score),
      alertTriggered: row.alert_triggered,
      alertType: row.alert_type,
    }));
  }

  /**
   * Get anomalies for a DAC unit
   */
  async getAnomalies(
    dacUnitId: string,
    startTime: Date,
    endTime: Date
  ): Promise<SensorReading[]> {
    const query = `
      SELECT
        time, sensor_id, dac_unit_id, sensor_type, value, unit,
        quality_score, is_anomaly, anomaly_type
      FROM sensor_readings
      WHERE dac_unit_id = $1
        AND time >= $2
        AND time < $3
        AND is_anomaly = TRUE
      ORDER BY time DESC
    `;

    const result = await this.pool.query(query, [dacUnitId, startTime, endTime]);

    return result.rows.map((row) => ({
      time: row.time,
      sensorId: row.sensor_id,
      dacUnitId: row.dac_unit_id,
      sensorType: row.sensor_type,
      value: parseFloat(row.value),
      unit: row.unit,
      qualityScore: parseFloat(row.quality_score),
      isAnomaly: row.is_anomaly,
      anomalyType: row.anomaly_type,
    }));
  }

  /**
   * Get real-time statistics for dashboard
   */
  async getRealTimeStats(dacUnitId: string): Promise<{
    lastReading: Date | null;
    readingsLast24h: number;
    anomaliesLast24h: number;
    avgEfficiency24h: number;
    totalCo2Last24h: number;
  }> {
    const query = `
      WITH stats AS (
        SELECT
          MAX(time) AS last_reading,
          COUNT(*) AS readings_count,
          COUNT(*) FILTER (WHERE is_anomaly = TRUE) AS anomaly_count
        FROM sensor_readings
        WHERE dac_unit_id = $1
          AND time >= NOW() - INTERVAL '24 hours'
      ),
      co2_stats AS (
        SELECT COALESCE(SUM(value), 0) / 1000.0 AS total_co2
        FROM sensor_readings
        WHERE dac_unit_id = $1
          AND sensor_type = 'co2_flow'
          AND time >= NOW() - INTERVAL '24 hours'
      ),
      efficiency_stats AS (
        SELECT COALESCE(AVG(efficiency_24h), 0) AS avg_efficiency
        FROM efficiency_metrics
        WHERE dac_unit_id = $1
          AND time >= NOW() - INTERVAL '24 hours'
      )
      SELECT
        stats.last_reading,
        stats.readings_count,
        stats.anomaly_count,
        efficiency_stats.avg_efficiency,
        co2_stats.total_co2
      FROM stats, co2_stats, efficiency_stats
    `;

    const result = await this.pool.query(query, [dacUnitId]);
    const row = result.rows[0];

    return {
      lastReading: row.last_reading,
      readingsLast24h: parseInt(row.readings_count),
      anomaliesLast24h: parseInt(row.anomaly_count),
      avgEfficiency24h: parseFloat(row.avg_efficiency),
      totalCo2Last24h: parseFloat(row.total_co2),
    };
  }

  /**
   * Close the connection pool
   */
  async close(): Promise<void> {
    await this.pool.end();
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.pool.query("SELECT 1");
      return true;
    } catch {
      return false;
    }
  }
}

// Singleton instance
let timescaleClient: TimescaleClient | null = null;

export function getTimescaleClient(): TimescaleClient {
  if (!timescaleClient) {
    timescaleClient = new TimescaleClient();
  }
  return timescaleClient;
}

export default TimescaleClient;
