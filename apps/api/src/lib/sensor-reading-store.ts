import { ensureDatabaseSchema } from "./database-schema.js";
import { databasePool } from "./database.js";

export interface SensorEvidenceReading {
  time: string;
  dacUnitId: string;
  sensorId: string;
  co2CaptureRateKgHour: number;
  energyConsumptionKwh: number;
  measurementDurationSeconds: number;
  co2PurityPercentage: number;
  ambientTemperatureC: number | null;
  ambientHumidityPercent: number | null;
  atmosphericCo2Ppm: number | null;
  dataHash: string;
  rawData?: Record<string, unknown> | null;
  isAnomaly: boolean;
  anomalyReason: string | null;
}

export interface SensorEvidenceSummary {
  totalCo2CapturedKg: number;
  totalEnergyConsumedKwh: number;
  avgCo2CaptureRateKgHour: number;
  avgPurityPercentage: number;
  readingCount: number;
  anomalyCount: number;
}

const INSERT_COLUMN_COUNT = 14;
const MAX_VERIFICATION_READINGS = 100_000;

function insertValues(reading: SensorEvidenceReading): unknown[] {
  return [
    reading.time,
    reading.dacUnitId,
    reading.sensorId,
    reading.co2CaptureRateKgHour,
    reading.energyConsumptionKwh,
    reading.measurementDurationSeconds,
    reading.co2PurityPercentage,
    reading.ambientTemperatureC,
    reading.ambientHumidityPercent,
    reading.atmosphericCo2Ppm,
    reading.dataHash,
    reading.rawData ? JSON.stringify(reading.rawData) : null,
    reading.isAnomaly,
    reading.anomalyReason,
  ];
}

export async function insertSensorReadings(
  readings: SensorEvidenceReading[],
): Promise<boolean> {
  if (readings.length === 0) {
    return true;
  }

  await ensureDatabaseSchema();
  const client = await databasePool.connect();

  try {
    await client.query("BEGIN");
    const values: unknown[] = [];
    const placeholders = readings.map((reading, readingIndex) => {
      values.push(...insertValues(reading));
      const start = readingIndex * INSERT_COLUMN_COUNT;
      return `(${Array.from(
        { length: INSERT_COLUMN_COUNT },
        (_, columnIndex) => `$${start + columnIndex + 1}`,
      ).join(", ")})`;
    });

    const result = await client.query<{ data_hash: string }>(
      `
        INSERT INTO sensor_readings (
          captured_at,
          dac_unit_id,
          sensor_id,
          co2_capture_rate_kg_hour,
          energy_consumption_kwh,
          measurement_duration_seconds,
          co2_purity_percentage,
          ambient_temperature_c,
          ambient_humidity_percent,
          atmospheric_co2_ppm,
          data_hash,
          raw_data,
          is_anomaly,
          anomaly_reason
        )
        VALUES ${placeholders.join(", ")}
        ON CONFLICT (data_hash) DO NOTHING
        RETURNING data_hash
      `,
      values,
    );

    if (result.rowCount !== readings.length) {
      await client.query("ROLLBACK");
      return false;
    }

    await client.query("COMMIT");
    return true;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function listSensorReadings(
  dacUnitId: string,
  startTime: Date,
  endTime: Date,
): Promise<SensorEvidenceReading[]> {
  await ensureDatabaseSchema();
  const result = await databasePool.query<{
    captured_at: Date;
    dac_unit_id: string;
    sensor_id: string;
    co2_capture_rate_kg_hour: number;
    energy_consumption_kwh: number;
    measurement_duration_seconds: number;
    co2_purity_percentage: number;
    ambient_temperature_c: number | null;
    ambient_humidity_percent: number | null;
    atmospheric_co2_ppm: number | null;
    data_hash: string;
    raw_data: Record<string, unknown> | null;
    is_anomaly: boolean;
    anomaly_reason: string | null;
  }>(
    `
      SELECT
        captured_at,
        dac_unit_id,
        sensor_id,
        co2_capture_rate_kg_hour,
        energy_consumption_kwh,
        measurement_duration_seconds,
        co2_purity_percentage,
        ambient_temperature_c,
        ambient_humidity_percent,
        atmospheric_co2_ppm,
        data_hash,
        raw_data,
        is_anomaly,
        anomaly_reason
      FROM sensor_readings
      WHERE dac_unit_id = $1
        AND captured_at >= $2
        AND captured_at <= $3
      ORDER BY captured_at, sensor_id, data_hash
      LIMIT $4
    `,
    [
      dacUnitId,
      startTime.toISOString(),
      endTime.toISOString(),
      MAX_VERIFICATION_READINGS + 1,
    ],
  );

  if (result.rows.length > MAX_VERIFICATION_READINGS) {
    throw new Error(
      `Verification period exceeds the ${MAX_VERIFICATION_READINGS.toLocaleString()} reading safety limit`,
    );
  }

  return result.rows.map((row) => ({
    time: new Date(row.captured_at).toISOString(),
    dacUnitId: row.dac_unit_id,
    sensorId: row.sensor_id,
    co2CaptureRateKgHour: Number(row.co2_capture_rate_kg_hour),
    energyConsumptionKwh: Number(row.energy_consumption_kwh),
    measurementDurationSeconds: Number(row.measurement_duration_seconds),
    co2PurityPercentage: Number(row.co2_purity_percentage),
    ambientTemperatureC:
      row.ambient_temperature_c === null
        ? null
        : Number(row.ambient_temperature_c),
    ambientHumidityPercent:
      row.ambient_humidity_percent === null
        ? null
        : Number(row.ambient_humidity_percent),
    atmosphericCo2Ppm:
      row.atmospheric_co2_ppm === null ? null : Number(row.atmospheric_co2_ppm),
    dataHash: row.data_hash,
    rawData: row.raw_data,
    isAnomaly: row.is_anomaly,
    anomalyReason: row.anomaly_reason,
  }));
}

export async function summarizeSensorReadings(
  dacUnitId: string,
  startTime: Date,
  endTime: Date,
): Promise<SensorEvidenceSummary> {
  await ensureDatabaseSchema();
  const result = await databasePool.query<{
    total_co2_captured_kg: string;
    total_energy_consumed_kwh: string;
    avg_co2_capture_rate_kg_hour: string;
    avg_purity_percentage: string;
    reading_count: string;
    anomaly_count: string;
  }>(
    `
      SELECT
        COALESCE(
          SUM(
            co2_capture_rate_kg_hour
            * measurement_duration_seconds
            / 3600.0
          ),
          0
        ) AS total_co2_captured_kg,
        COALESCE(SUM(energy_consumption_kwh), 0)
          AS total_energy_consumed_kwh,
        COALESCE(AVG(co2_capture_rate_kg_hour), 0)
          AS avg_co2_capture_rate_kg_hour,
        COALESCE(AVG(co2_purity_percentage), 0)
          AS avg_purity_percentage,
        COUNT(*) AS reading_count,
        COUNT(*) FILTER (WHERE is_anomaly = TRUE) AS anomaly_count
      FROM sensor_readings
      WHERE dac_unit_id = $1
        AND captured_at >= $2
        AND captured_at <= $3
    `,
    [dacUnitId, startTime.toISOString(), endTime.toISOString()],
  );
  const row = result.rows[0];

  return {
    totalCo2CapturedKg: Number(row?.total_co2_captured_kg ?? 0),
    totalEnergyConsumedKwh: Number(row?.total_energy_consumed_kwh ?? 0),
    avgCo2CaptureRateKgHour: Number(row?.avg_co2_capture_rate_kg_hour ?? 0),
    avgPurityPercentage: Number(row?.avg_purity_percentage ?? 0),
    readingCount: Number(row?.reading_count ?? 0),
    anomalyCount: Number(row?.anomaly_count ?? 0),
  };
}
