use std::time::{SystemTime, UNIX_EPOCH};
use terraqura_verifier::sensor::*;

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
fn co2_negative_fails() {
    let v = SensorValidator::new();
    let mut r = valid_reading();
    r.co2_captured_kg = -5.0;
    let result = v.validate_reading(&r);
    assert!(!result.valid);
    assert!(result.errors.iter().any(|e| e.contains("non-negative")));
}

#[test]
fn co2_exceeds_max_fails() {
    let v = SensorValidator::new();
    let mut r = valid_reading();
    r.co2_captured_kg = 99_999.0;
    let result = v.validate_reading(&r);
    assert!(!result.valid);
    assert!(result.errors.iter().any(|e| e.contains("exceeds")));
}

#[test]
fn zero_energy_fails() {
    let v = SensorValidator::new();
    let mut r = valid_reading();
    r.energy_kwh = 0.0;
    let result = v.validate_reading(&r);
    assert!(!result.valid);
    assert!(result.errors.iter().any(|e| e.contains("energy_kwh")));
}

#[test]
fn negative_energy_fails() {
    let v = SensorValidator::new();
    let mut r = valid_reading();
    r.energy_kwh = -10.0;
    let result = v.validate_reading(&r);
    assert!(!result.valid);
}

#[test]
fn temperature_below_min_fails() {
    let v = SensorValidator::new();
    let mut r = valid_reading();
    r.temperature = -50.0;
    let result = v.validate_reading(&r);
    assert!(!result.valid);
    assert!(result.errors.iter().any(|e| e.contains("temperature")));
}

#[test]
fn temperature_above_max_fails() {
    let v = SensorValidator::new();
    let mut r = valid_reading();
    r.temperature = 100.0;
    let result = v.validate_reading(&r);
    assert!(!result.valid);
    assert!(result.errors.iter().any(|e| e.contains("temperature")));
}

#[test]
fn temperature_at_boundaries_passes() {
    let v = SensorValidator::new();
    let mut r = valid_reading();
    r.temperature = -40.0;
    assert!(v.validate_reading(&r).valid);
    r.temperature = 85.0;
    assert!(v.validate_reading(&r).valid);
}

#[test]
fn future_timestamp_rejected() {
    let v = SensorValidator::new();
    let mut r = valid_reading();
    r.timestamp = now_secs() + 7200;
    let result = v.validate_reading(&r);
    assert!(!result.valid);
    assert!(result.errors.iter().any(|e| e.contains("future")));
}

#[test]
fn very_old_timestamp_rejected() {
    let v = SensorValidator::new();
    let mut r = valid_reading();
    r.timestamp = 1_000_000; // ~2001
    let result = v.validate_reading(&r);
    assert!(!result.valid);
    assert!(result.errors.iter().any(|e| e.contains("old")));
}

#[test]
fn flow_rate_below_min_fails() {
    let v = SensorValidator::new();
    let mut r = valid_reading();
    r.flow_rate = -1.0;
    let result = v.validate_reading(&r);
    assert!(!result.valid);
    assert!(result.errors.iter().any(|e| e.contains("flow_rate")));
}

#[test]
fn flow_rate_above_max_fails() {
    let v = SensorValidator::new();
    let mut r = valid_reading();
    r.flow_rate = 9999.0;
    let result = v.validate_reading(&r);
    assert!(!result.valid);
}

#[test]
fn batch_mixed_valid_invalid() {
    let v = SensorValidator::new();
    let good = valid_reading();
    let mut bad = valid_reading();
    bad.co2_captured_kg = -1.0;
    let result = v.validate_batch(&[good.clone(), bad, good]);
    assert_eq!(result.total, 3);
    assert_eq!(result.valid_count, 2);
    assert_eq!(result.invalid_count, 1);
}

#[test]
fn batch_all_valid() {
    let v = SensorValidator::new();
    let readings: Vec<_> = (0..5)
        .map(|i| build_test_reading("DEV-001", now_secs() - 300 + i * 60))
        .collect();
    let result = v.validate_batch(&readings);
    assert_eq!(result.valid_count, 5);
    assert_eq!(result.invalid_count, 0);
}

#[test]
fn tampering_identical_readings() {
    let readings: Vec<SensorReading> = (0..10)
        .map(|i| build_test_reading("DEV-001", now_secs() - 600 + i * 60))
        .collect();
    let result = detect_tampering(&readings);
    assert!(result.suspicious);
    assert!(result.confidence > 0.3);
    assert!(!result.reasons.is_empty());
}

#[test]
fn tampering_single_reading_not_suspicious() {
    let result = detect_tampering(&[valid_reading()]);
    assert!(!result.suspicious);
}

#[test]
fn efficiency_ratio_too_high_fails() {
    let v = SensorValidator::new();
    let mut r = valid_reading();
    r.co2_captured_kg = 500.0;
    r.energy_kwh = 1.0; // ratio = 500, way above max
    let result = v.validate_reading(&r);
    assert!(!result.valid);
    assert!(result.errors.iter().any(|e| e.contains("efficiency")));
}

#[test]
fn tampering_linear_pattern() {
    let mut readings: Vec<SensorReading> = (0..10)
        .map(|i| {
            let mut r = build_test_reading("DEV-001", now_secs() - 600 + i * 60);
            r.co2_captured_kg = 10.0 + i as f64 * 5.0;
            r.energy_kwh = 20.0 + i as f64 * 10.0;
            r.temperature = 20.0 + i as f64 * 0.5;
            r
        })
        .collect();
    // Make energy/temperature vary to avoid those flags — focus on CO2 linearity
    for r in &mut readings {
        r.energy_kwh = 100.0; // constant is fine, we want CO2 linear
    }
    let result = detect_tampering(&readings);
    assert!(result.suspicious);
    assert!(result.reasons.iter().any(|r| r.contains("linear")));
}
