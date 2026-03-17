-- TerraQura TimescaleDB Schema
-- High-frequency IoT time-series data storage
-- ADGM Compliant: Data stored off-chain, hashes on-chain

-- Enable TimescaleDB extension
CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;

-- ============================================
-- SENSOR READINGS (Hypertable)
-- ============================================
-- High-frequency IoT data from DAC facilities
-- Partitioned by time for optimal query performance

CREATE TABLE IF NOT EXISTS sensor_readings (
    -- Time (partition key)
    time                TIMESTAMPTZ         NOT NULL,

    -- Identification
    sensor_id           TEXT                NOT NULL,
    dac_unit_id         TEXT                NOT NULL,

    -- Sensor Type
    sensor_type         TEXT                NOT NULL, -- co2_flow, energy_meter, temperature, etc.

    -- Reading Values
    value               DOUBLE PRECISION    NOT NULL,
    unit                TEXT                NOT NULL, -- kg/hr, kWh, celsius, etc.

    -- Quality Indicators
    quality_score       DOUBLE PRECISION    DEFAULT 1.0, -- 0-1, lower = potential anomaly
    is_anomaly          BOOLEAN             DEFAULT FALSE,
    anomaly_type        TEXT,               -- spike, dropout, drift, out_of_range

    -- Raw Data Hash (for verification)
    raw_data_hash       TEXT,               -- SHA-256 of raw sensor packet

    -- Metadata
    firmware_version    TEXT,
    signal_strength     INTEGER,            -- RSSI for wireless sensors

    -- Ingestion tracking
    ingested_at         TIMESTAMPTZ         DEFAULT NOW()
);

-- Convert to hypertable (time-series optimized)
SELECT create_hypertable(
    'sensor_readings',
    'time',
    chunk_time_interval => INTERVAL '1 day',
    if_not_exists => TRUE
);

-- Compression policy (compress chunks older than 7 days)
ALTER TABLE sensor_readings SET (
    timescaledb.compress,
    timescaledb.compress_segmentby = 'dac_unit_id, sensor_id',
    timescaledb.compress_orderby = 'time DESC'
);

SELECT add_compression_policy('sensor_readings', INTERVAL '7 days', if_not_exists => TRUE);

-- Retention policy (keep raw data for 2 years, then aggregate)
SELECT add_retention_policy('sensor_readings', INTERVAL '730 days', if_not_exists => TRUE);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_sensor_readings_sensor
    ON sensor_readings (sensor_id, time DESC);

CREATE INDEX IF NOT EXISTS idx_sensor_readings_dac_unit
    ON sensor_readings (dac_unit_id, time DESC);

CREATE INDEX IF NOT EXISTS idx_sensor_readings_type
    ON sensor_readings (sensor_type, time DESC);

CREATE INDEX IF NOT EXISTS idx_sensor_readings_anomaly
    ON sensor_readings (is_anomaly, time DESC)
    WHERE is_anomaly = TRUE;


-- ============================================
-- HOURLY AGGREGATES (Continuous Aggregate)
-- ============================================
-- Pre-computed hourly statistics for dashboard queries

CREATE MATERIALIZED VIEW IF NOT EXISTS sensor_readings_hourly
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('1 hour', time) AS bucket,
    dac_unit_id,
    sensor_id,
    sensor_type,

    -- Aggregations
    AVG(value) AS avg_value,
    MIN(value) AS min_value,
    MAX(value) AS max_value,
    STDDEV(value) AS stddev_value,
    COUNT(*) AS reading_count,

    -- Quality metrics
    AVG(quality_score) AS avg_quality,
    COUNT(*) FILTER (WHERE is_anomaly = TRUE) AS anomaly_count,

    -- For verification
    MIN(time) AS first_reading,
    MAX(time) AS last_reading

FROM sensor_readings
GROUP BY bucket, dac_unit_id, sensor_id, sensor_type
WITH NO DATA;

-- Refresh policy (refresh every hour)
SELECT add_continuous_aggregate_policy('sensor_readings_hourly',
    start_offset => INTERVAL '3 hours',
    end_offset => INTERVAL '1 hour',
    schedule_interval => INTERVAL '1 hour',
    if_not_exists => TRUE
);


-- ============================================
-- DAILY AGGREGATES (For Verification Batches)
-- ============================================
-- Daily summaries used for carbon credit verification

CREATE MATERIALIZED VIEW IF NOT EXISTS sensor_readings_daily
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('1 day', time) AS bucket,
    dac_unit_id,
    sensor_type,

    -- Totals for verification
    SUM(value) AS total_value,
    AVG(value) AS avg_value,
    MIN(value) AS min_value,
    MAX(value) AS max_value,
    COUNT(*) AS reading_count,

    -- Data quality
    AVG(quality_score) AS avg_quality,
    COUNT(*) FILTER (WHERE is_anomaly = TRUE) AS anomaly_count,
    (COUNT(*) FILTER (WHERE quality_score >= 0.8)::FLOAT / NULLIF(COUNT(*), 0)) AS data_integrity_ratio

FROM sensor_readings
GROUP BY bucket, dac_unit_id, sensor_type
WITH NO DATA;

-- Refresh policy (refresh every day at midnight)
SELECT add_continuous_aggregate_policy('sensor_readings_daily',
    start_offset => INTERVAL '2 days',
    end_offset => INTERVAL '1 day',
    schedule_interval => INTERVAL '1 day',
    if_not_exists => TRUE
);


-- ============================================
-- VERIFICATION SNAPSHOTS
-- ============================================
-- Stores cryptographic snapshots for verification batches

CREATE TABLE IF NOT EXISTS verification_snapshots (
    id                  TEXT                PRIMARY KEY,
    verification_batch_id TEXT             NOT NULL,

    -- Time Range
    period_start        TIMESTAMPTZ         NOT NULL,
    period_end          TIMESTAMPTZ         NOT NULL,

    -- Computed Metrics
    total_co2_captured  DOUBLE PRECISION    NOT NULL, -- tonnes
    total_energy_used   DOUBLE PRECISION    NOT NULL, -- kWh
    efficiency_factor   DOUBLE PRECISION    NOT NULL, -- kWh/tonne
    data_point_count    INTEGER             NOT NULL,

    -- Data Quality
    avg_quality_score   DOUBLE PRECISION,
    anomaly_count       INTEGER,
    data_integrity_ratio DOUBLE PRECISION,

    -- Cryptographic Proofs
    data_hash           TEXT                NOT NULL, -- SHA-256 of all readings
    merkle_root         TEXT,
    raw_data_cid        TEXT,               -- IPFS CID of raw data bundle

    -- Verification Status
    is_verified         BOOLEAN             DEFAULT FALSE,
    verified_at         TIMESTAMPTZ,
    verifier_address    TEXT,               -- Chainlink oracle or auditor

    created_at          TIMESTAMPTZ         DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_verification_snapshots_batch
    ON verification_snapshots (verification_batch_id);

CREATE INDEX IF NOT EXISTS idx_verification_snapshots_period
    ON verification_snapshots (period_start, period_end);


-- ============================================
-- ENERGY EFFICIENCY METRICS
-- ============================================
-- Real-time efficiency tracking for Proof-of-Physics validation

CREATE TABLE IF NOT EXISTS efficiency_metrics (
    time                TIMESTAMPTZ         NOT NULL,
    dac_unit_id         TEXT                NOT NULL,

    -- Window metrics (rolling 24h)
    co2_captured_24h    DOUBLE PRECISION,   -- tonnes
    energy_used_24h     DOUBLE PRECISION,   -- kWh
    efficiency_24h      DOUBLE PRECISION,   -- kWh/tonne

    -- Validation
    is_within_range     BOOLEAN,            -- 200-600 kWh/tonne
    efficiency_score    DOUBLE PRECISION,   -- 0-1, normalized score

    -- Alerts
    alert_triggered     BOOLEAN             DEFAULT FALSE,
    alert_type          TEXT                -- efficiency_low, efficiency_high, data_gap
);

-- Convert to hypertable
SELECT create_hypertable(
    'efficiency_metrics',
    'time',
    chunk_time_interval => INTERVAL '1 day',
    if_not_exists => TRUE
);

CREATE INDEX IF NOT EXISTS idx_efficiency_metrics_dac
    ON efficiency_metrics (dac_unit_id, time DESC);


-- ============================================
-- FUNCTIONS
-- ============================================

-- Function to calculate verification snapshot
CREATE OR REPLACE FUNCTION calculate_verification_snapshot(
    p_dac_unit_id TEXT,
    p_start TIMESTAMPTZ,
    p_end TIMESTAMPTZ
) RETURNS TABLE (
    total_co2_captured DOUBLE PRECISION,
    total_energy_used DOUBLE PRECISION,
    efficiency_factor DOUBLE PRECISION,
    data_point_count BIGINT,
    avg_quality_score DOUBLE PRECISION,
    anomaly_count BIGINT,
    data_hash TEXT
) AS $$
DECLARE
    v_raw_data TEXT;
BEGIN
    RETURN QUERY
    WITH co2_data AS (
        SELECT COALESCE(SUM(value), 0) AS total
        FROM sensor_readings
        WHERE dac_unit_id = p_dac_unit_id
          AND sensor_type = 'co2_flow'
          AND time >= p_start
          AND time < p_end
    ),
    energy_data AS (
        SELECT COALESCE(SUM(value), 0) AS total
        FROM sensor_readings
        WHERE dac_unit_id = p_dac_unit_id
          AND sensor_type = 'energy_meter'
          AND time >= p_start
          AND time < p_end
    ),
    quality_data AS (
        SELECT
            COUNT(*) AS cnt,
            AVG(quality_score) AS avg_q,
            COUNT(*) FILTER (WHERE is_anomaly = TRUE) AS anomalies
        FROM sensor_readings
        WHERE dac_unit_id = p_dac_unit_id
          AND time >= p_start
          AND time < p_end
    ),
    hash_data AS (
        SELECT encode(
            sha256(
                string_agg(
                    raw_data_hash || '|' || time::TEXT,
                    ',' ORDER BY time
                )::bytea
            ),
            'hex'
        ) AS combined_hash
        FROM sensor_readings
        WHERE dac_unit_id = p_dac_unit_id
          AND time >= p_start
          AND time < p_end
    )
    SELECT
        co2_data.total / 1000.0 AS total_co2_captured, -- Convert kg to tonnes
        energy_data.total AS total_energy_used,
        CASE
            WHEN co2_data.total > 0 THEN energy_data.total / (co2_data.total / 1000.0)
            ELSE 0
        END AS efficiency_factor,
        quality_data.cnt AS data_point_count,
        quality_data.avg_q AS avg_quality_score,
        quality_data.anomalies AS anomaly_count,
        hash_data.combined_hash AS data_hash
    FROM co2_data, energy_data, quality_data, hash_data;
END;
$$ LANGUAGE plpgsql;


-- Function to detect anomalies (called on insert)
CREATE OR REPLACE FUNCTION detect_anomaly()
RETURNS TRIGGER AS $$
DECLARE
    v_avg DOUBLE PRECISION;
    v_stddev DOUBLE PRECISION;
    v_min_expected DOUBLE PRECISION;
    v_max_expected DOUBLE PRECISION;
BEGIN
    -- Get recent statistics for this sensor
    SELECT AVG(value), STDDEV(value)
    INTO v_avg, v_stddev
    FROM sensor_readings
    WHERE sensor_id = NEW.sensor_id
      AND sensor_type = NEW.sensor_type
      AND time > NEW.time - INTERVAL '24 hours'
      AND time < NEW.time;

    -- Skip if not enough data
    IF v_stddev IS NULL OR v_stddev = 0 THEN
        RETURN NEW;
    END IF;

    -- Z-score based anomaly detection (3 sigma)
    v_min_expected := v_avg - (3 * v_stddev);
    v_max_expected := v_avg + (3 * v_stddev);

    IF NEW.value < v_min_expected OR NEW.value > v_max_expected THEN
        NEW.is_anomaly := TRUE;
        NEW.anomaly_type := CASE
            WHEN NEW.value < v_min_expected THEN 'low_outlier'
            ELSE 'high_outlier'
        END;
        NEW.quality_score := GREATEST(0, 1 - ABS(NEW.value - v_avg) / (3 * v_stddev));
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for anomaly detection
DROP TRIGGER IF EXISTS trigger_detect_anomaly ON sensor_readings;
CREATE TRIGGER trigger_detect_anomaly
    BEFORE INSERT ON sensor_readings
    FOR EACH ROW
    EXECUTE FUNCTION detect_anomaly();


-- ============================================
-- GRANTS (for application user)
-- ============================================

-- Create application role if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'terraqura_app') THEN
        CREATE ROLE terraqura_app LOGIN PASSWORD 'change_me_in_production';
    END IF;
END
$$;

GRANT SELECT, INSERT ON sensor_readings TO terraqura_app;
GRANT SELECT ON sensor_readings_hourly TO terraqura_app;
GRANT SELECT ON sensor_readings_daily TO terraqura_app;
GRANT SELECT, INSERT ON verification_snapshots TO terraqura_app;
GRANT SELECT, INSERT ON efficiency_metrics TO terraqura_app;
