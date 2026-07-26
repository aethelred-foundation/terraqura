import { databasePool } from "./database.js";

let initializationPromise: Promise<void> | null = null;

async function applySchema(): Promise<void> {
  const client = await databasePool.connect();

  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock($1, $2)", [7332, 4000]);

    await client.query(`
      CREATE TABLE IF NOT EXISTS api_state_store (
        store_key TEXT PRIMARY KEY,
        payload JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS siwe_nonces (
        nonce TEXT PRIMARY KEY,
        expires_at TIMESTAMPTZ NOT NULL
      )
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_siwe_nonces_expires_at
      ON siwe_nonces (expires_at)
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS sensor_readings (
        id BIGSERIAL PRIMARY KEY,
        captured_at TIMESTAMPTZ NOT NULL,
        dac_unit_id TEXT NOT NULL,
        sensor_id TEXT NOT NULL,
        co2_capture_rate_kg_hour DOUBLE PRECISION NOT NULL
          CHECK (co2_capture_rate_kg_hour >= 0),
        energy_consumption_kwh DOUBLE PRECISION NOT NULL
          CHECK (energy_consumption_kwh >= 0),
        measurement_duration_seconds DOUBLE PRECISION NOT NULL
          CHECK (
            measurement_duration_seconds > 0
            AND measurement_duration_seconds <= 86400
          ),
        co2_purity_percentage DOUBLE PRECISION NOT NULL
          CHECK (
            co2_purity_percentage >= 0
            AND co2_purity_percentage <= 100
          ),
        ambient_temperature_c DOUBLE PRECISION,
        ambient_humidity_percent DOUBLE PRECISION
          CHECK (
            ambient_humidity_percent IS NULL
            OR (
              ambient_humidity_percent >= 0
              AND ambient_humidity_percent <= 100
            )
          ),
        atmospheric_co2_ppm DOUBLE PRECISION
          CHECK (
            atmospheric_co2_ppm IS NULL
            OR atmospheric_co2_ppm >= 0
          ),
        data_hash CHAR(64) NOT NULL UNIQUE,
        raw_data JSONB,
        is_anomaly BOOLEAN NOT NULL DEFAULT FALSE,
        anomaly_reason TEXT,
        ingested_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_sensor_readings_dac_captured
      ON sensor_readings (dac_unit_id, captured_at, sensor_id)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_sensor_readings_anomaly
      ON sensor_readings (dac_unit_id, captured_at)
      WHERE is_anomaly = TRUE
    `);

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function ensureDatabaseSchema(): Promise<void> {
  if (!initializationPromise) {
    initializationPromise = applySchema().catch((error) => {
      initializationPromise = null;
      throw error;
    });
  }

  await initializationPromise;
}
