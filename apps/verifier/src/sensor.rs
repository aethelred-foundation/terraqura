use serde::{Deserialize, Serialize};
use std::time::{SystemTime, UNIX_EPOCH};

/// Configurable thresholds for sensor validation.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SensorValidator {
    /// Maximum CO2 capture rate in kg per reading period.
    pub max_capture_rate_kg: f64,
    /// Maximum allowed energy consumption in kWh per reading.
    pub max_energy_kwh: f64,
    /// Minimum acceptable flow rate (device-specific).
    pub min_flow_rate: f64,
    /// Maximum acceptable flow rate (device-specific).
    pub max_flow_rate: f64,
    /// Minimum operating temperature in Celsius.
    pub min_temperature_c: f64,
    /// Maximum operating temperature in Celsius.
    pub max_temperature_c: f64,
    /// Maximum allowed efficiency ratio (CO2 kg / energy kWh).
    pub max_efficiency_ratio: f64,
    /// Minimum allowed efficiency ratio.
    pub min_efficiency_ratio: f64,
    /// Maximum age of a reading in seconds before it is considered too old.
    pub max_reading_age_secs: u64,
}

impl Default for SensorValidator {
    fn default() -> Self {
        Self {
            max_capture_rate_kg: 1000.0,
            max_energy_kwh: 5000.0,
            min_flow_rate: 0.0,
            max_flow_rate: 500.0,
            min_temperature_c: -40.0,
            max_temperature_c: 85.0,
            max_efficiency_ratio: 2.0,
            min_efficiency_ratio: 0.01,
            max_reading_age_secs: 86400 * 30, // 30 days
        }
    }
}

/// A single sensor reading from a carbon capture device.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SensorReading {
    pub device_id: String,
    /// Unix timestamp (seconds).
    pub timestamp: u64,
    /// Kilograms of CO2 captured in this reading period.
    pub co2_captured_kg: f64,
    /// Energy consumed during this period in kWh.
    pub energy_kwh: f64,
    /// Volumetric flow rate (device-specific units).
    pub flow_rate: f64,
    /// Ambient/process temperature in Celsius.
    pub temperature: f64,
}

/// Result of validating a single sensor reading.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValidationResult {
    pub valid: bool,
    pub errors: Vec<String>,
}

/// Result of validating a batch of readings.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BatchValidationResult {
    pub total: usize,
    pub valid_count: usize,
    pub invalid_count: usize,
    pub results: Vec<ValidationResult>,
}

/// Result of tamper-detection analysis.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TamperingResult {
    pub suspicious: bool,
    pub reasons: Vec<String>,
    pub confidence: f64,
}

impl SensorValidator {
    /// Create a new validator with default thresholds.
    pub fn new() -> Self {
        Self::default()
    }

    /// Validate a single sensor reading.
    pub fn validate_reading(&self, reading: &SensorReading) -> ValidationResult {
        validate_reading(self, reading)
    }

    /// Validate a batch of sensor readings.
    pub fn validate_batch(&self, readings: &[SensorReading]) -> BatchValidationResult {
        validate_batch(self, readings)
    }

    /// Detect signs of tampering across a set of readings.
    pub fn detect_tampering(&self, readings: &[SensorReading]) -> TamperingResult {
        detect_tampering(readings)
    }
}

/// Validate a single sensor reading against the configured thresholds.
pub fn validate_reading(validator: &SensorValidator, reading: &SensorReading) -> ValidationResult {
    let mut errors = Vec::new();

    // CO2 bounds
    if reading.co2_captured_kg < 0.0 {
        errors.push("co2_captured_kg must be non-negative".into());
    } else if reading.co2_captured_kg > validator.max_capture_rate_kg {
        errors.push(format!(
            "co2_captured_kg ({}) exceeds max_capture_rate ({})",
            reading.co2_captured_kg, validator.max_capture_rate_kg
        ));
    }

    // Energy must be positive
    if reading.energy_kwh <= 0.0 {
        errors.push("energy_kwh must be positive".into());
    }

    // Flow rate within device spec
    if reading.flow_rate < validator.min_flow_rate || reading.flow_rate > validator.max_flow_rate {
        errors.push(format!(
            "flow_rate ({}) outside bounds [{}, {}]",
            reading.flow_rate, validator.min_flow_rate, validator.max_flow_rate
        ));
    }

    // Temperature within operating range
    if reading.temperature < validator.min_temperature_c
        || reading.temperature > validator.max_temperature_c
    {
        errors.push(format!(
            "temperature ({}) outside operating range [{}, {}]",
            reading.temperature, validator.min_temperature_c, validator.max_temperature_c
        ));
    }

    // Timestamp not in the future
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    if reading.timestamp > now + 60 {
        errors.push("timestamp is in the future".into());
    }

    // Timestamp not too old
    if now.saturating_sub(reading.timestamp) > validator.max_reading_age_secs {
        errors.push("reading is too old".into());
    }

    // Efficiency ratio (CO2/energy)
    if reading.energy_kwh > 0.0 && reading.co2_captured_kg >= 0.0 {
        let ratio = reading.co2_captured_kg / reading.energy_kwh;
        if ratio > validator.max_efficiency_ratio {
            errors.push(format!(
                "efficiency ratio ({ratio:.4}) exceeds max ({})",
                validator.max_efficiency_ratio
            ));
        }
        if ratio < validator.min_efficiency_ratio && reading.co2_captured_kg > 0.0 {
            errors.push(format!(
                "efficiency ratio ({ratio:.4}) below min ({})",
                validator.min_efficiency_ratio
            ));
        }
    }

    ValidationResult {
        valid: errors.is_empty(),
        errors,
    }
}

/// Validate a batch of sensor readings.
pub fn validate_batch(
    validator: &SensorValidator,
    readings: &[SensorReading],
) -> BatchValidationResult {
    let results: Vec<ValidationResult> = readings
        .iter()
        .map(|r| validate_reading(validator, r))
        .collect();

    let valid_count = results.iter().filter(|r| r.valid).count();

    BatchValidationResult {
        total: readings.len(),
        valid_count,
        invalid_count: readings.len() - valid_count,
        results,
    }
}

/// Perform statistical analysis to detect potential data tampering.
///
/// Heuristics:
/// 1. All readings with identical CO2 values (constant output is suspicious).
/// 2. Zero variance in any measured dimension.
/// 3. Suspiciously regular spacing of values.
pub fn detect_tampering(readings: &[SensorReading]) -> TamperingResult {
    let mut reasons = Vec::new();
    let mut confidence: f64 = 0.0;

    if readings.len() < 2 {
        return TamperingResult {
            suspicious: false,
            reasons,
            confidence: 0.0,
        };
    }

    let co2_values: Vec<f64> = readings.iter().map(|r| r.co2_captured_kg).collect();
    let energy_values: Vec<f64> = readings.iter().map(|r| r.energy_kwh).collect();
    let temp_values: Vec<f64> = readings.iter().map(|r| r.temperature).collect();

    // Check for constant CO2
    if co2_values.windows(2).all(|w| (w[0] - w[1]).abs() < f64::EPSILON) {
        reasons.push("all CO2 readings are identical".into());
        confidence += 0.4;
    }

    // Check for constant energy
    if energy_values
        .windows(2)
        .all(|w| (w[0] - w[1]).abs() < f64::EPSILON)
    {
        reasons.push("all energy readings are identical".into());
        confidence += 0.3;
    }

    // Check for constant temperature (highly unlikely in real sensors)
    if temp_values
        .windows(2)
        .all(|w| (w[0] - w[1]).abs() < f64::EPSILON)
    {
        reasons.push("all temperature readings are identical".into());
        confidence += 0.3;
    }

    // Check for zero variance in CO2
    let mean = co2_values.iter().sum::<f64>() / co2_values.len() as f64;
    let variance =
        co2_values.iter().map(|v| (v - mean).powi(2)).sum::<f64>() / co2_values.len() as f64;
    if variance < 1e-10 && readings.len() > 5 {
        reasons.push("near-zero variance in CO2 readings".into());
        confidence += 0.2;
    }

    // Check for perfectly linear progression (manufactured data)
    if readings.len() >= 3 {
        let diffs: Vec<f64> = co2_values.windows(2).map(|w| w[1] - w[0]).collect();
        if diffs.len() >= 2
            && diffs
                .windows(2)
                .all(|w| (w[0] - w[1]).abs() < 1e-10)
        {
            reasons.push("CO2 values follow a perfectly linear pattern".into());
            confidence += 0.3;
        }
    }

    confidence = confidence.min(1.0);

    TamperingResult {
        suspicious: !reasons.is_empty(),
        reasons,
        confidence,
    }
}

/// Create a valid sensor reading at the given timestamp for testing.
pub fn build_test_reading(device_id: &str, timestamp: u64) -> SensorReading {
    SensorReading {
        device_id: device_id.to_string(),
        timestamp,
        co2_captured_kg: 50.0,
        energy_kwh: 100.0,
        flow_rate: 25.0,
        temperature: 22.0,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn now_secs() -> u64 {
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs()
    }

    fn valid_reading() -> SensorReading {
        build_test_reading("DEV-001", now_secs() - 60)
    }

    #[test]
    fn valid_reading_passes() {
        let v = SensorValidator::new();
        let result = v.validate_reading(&valid_reading());
        assert!(result.valid, "errors: {:?}", result.errors);
    }

    #[test]
    fn negative_co2_fails() {
        let v = SensorValidator::new();
        let mut r = valid_reading();
        r.co2_captured_kg = -1.0;
        assert!(!v.validate_reading(&r).valid);
    }

    #[test]
    fn excessive_co2_fails() {
        let v = SensorValidator::new();
        let mut r = valid_reading();
        r.co2_captured_kg = 99999.0;
        assert!(!v.validate_reading(&r).valid);
    }

    #[test]
    fn zero_energy_fails() {
        let v = SensorValidator::new();
        let mut r = valid_reading();
        r.energy_kwh = 0.0;
        assert!(!v.validate_reading(&r).valid);
    }

    #[test]
    fn negative_energy_fails() {
        let v = SensorValidator::new();
        let mut r = valid_reading();
        r.energy_kwh = -10.0;
        assert!(!v.validate_reading(&r).valid);
    }

    #[test]
    fn temperature_below_range_fails() {
        let v = SensorValidator::new();
        let mut r = valid_reading();
        r.temperature = -50.0;
        assert!(!v.validate_reading(&r).valid);
    }

    #[test]
    fn temperature_above_range_fails() {
        let v = SensorValidator::new();
        let mut r = valid_reading();
        r.temperature = 100.0;
        assert!(!v.validate_reading(&r).valid);
    }

    #[test]
    fn future_timestamp_fails() {
        let v = SensorValidator::new();
        let mut r = valid_reading();
        r.timestamp = now_secs() + 3600;
        assert!(!v.validate_reading(&r).valid);
    }

    #[test]
    fn old_timestamp_fails() {
        let v = SensorValidator::new();
        let mut r = valid_reading();
        r.timestamp = 1_000_000; // year ~2001
        assert!(!v.validate_reading(&r).valid);
    }

    #[test]
    fn batch_with_mixed_results() {
        let v = SensorValidator::new();
        let mut bad = valid_reading();
        bad.co2_captured_kg = -1.0;
        let result = v.validate_batch(&[valid_reading(), bad]);
        assert_eq!(result.total, 2);
        assert_eq!(result.valid_count, 1);
        assert_eq!(result.invalid_count, 1);
    }

    #[test]
    fn tamper_detection_identical_readings() {
        let readings: Vec<SensorReading> = (0..10)
            .map(|i| {
                let mut r = valid_reading();
                r.timestamp = now_secs() - 600 + i * 60;
                r
            })
            .collect();
        let result = detect_tampering(&readings);
        assert!(result.suspicious);
        assert!(result.confidence > 0.0);
    }

    #[test]
    fn tamper_detection_single_reading_not_suspicious() {
        let result = detect_tampering(&[valid_reading()]);
        assert!(!result.suspicious);
    }

    #[test]
    fn flow_rate_out_of_bounds() {
        let v = SensorValidator::new();
        let mut r = valid_reading();
        r.flow_rate = 9999.0;
        assert!(!v.validate_reading(&r).valid);
    }

    #[test]
    fn efficiency_ratio_too_high() {
        let v = SensorValidator::new();
        let mut r = valid_reading();
        r.co2_captured_kg = 900.0;
        r.energy_kwh = 1.0;
        assert!(!v.validate_reading(&r).valid);
    }
}
