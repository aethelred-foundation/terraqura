use std::time::{SystemTime, UNIX_EPOCH};
use terraqura_verifier::provenance::{build_test_chain, EventType};
use terraqura_verifier::sensor::build_test_reading;
use terraqura_verifier::verification::*;

fn now_secs() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs()
}

fn valid_request() -> VerificationRequest {
    let ts = now_secs() - 120;
    let mut chain = build_test_chain("CREDIT-001", 2);
    // Second event should not be Retired for mint check to pass
    chain.events[1].event_type = EventType::Verified;

    let mut r1 = build_test_reading("DEV-001", ts);
    let mut r2 = build_test_reading("DEV-001", ts + 60);
    // Vary readings to avoid triggering tampering detection
    r1.co2_captured_kg = 48.0;
    r1.energy_kwh = 96.0;
    r1.temperature = 21.5;
    r2.co2_captured_kg = 52.0;
    r2.energy_kwh = 104.0;
    r2.temperature = 22.5;

    VerificationRequest {
        credit_id: "CREDIT-001".into(),
        sensor_data: vec![r1, r2],
        provenance: chain,
        methodology: "terraqura-dac-v1".into(),
    }
}

#[test]
fn full_verification_passes() {
    let result = verify(&valid_request()).unwrap();
    assert!(result.passed, "phases: {:?}", result.phase_results);
    assert!(result.score > 80);
    assert!(result.timestamp > 0);
}

#[test]
fn all_three_phases_present() {
    let result = verify(&valid_request()).unwrap();
    assert_eq!(result.phase_results.len(), 3);
    assert_eq!(result.phase_results[0].phase, 1);
    assert_eq!(result.phase_results[1].phase, 2);
    assert_eq!(result.phase_results[2].phase, 3);
}

#[test]
fn source_check_failure_empty_sensor_data() {
    let mut req = valid_request();
    req.sensor_data.clear();
    let result = verify(&req).unwrap();
    assert!(!result.passed);
    assert!(!result.phase_results[0].passed);
    assert!(result.phase_results[0].details.contains("no sensor data"));
}

#[test]
fn source_check_failure_credit_id_mismatch() {
    let mut req = valid_request();
    req.credit_id = "CREDIT-WRONG".into();
    let result = verify(&req).unwrap();
    assert!(!result.passed);
    assert!(!result.phase_results[0].passed);
}

#[test]
fn source_check_failure_empty_device_id() {
    let mut req = valid_request();
    req.sensor_data[0].device_id = String::new();
    let result = verify(&req).unwrap();
    assert!(!result.passed);
    assert!(!result.phase_results[0].passed);
}

#[test]
fn source_check_failure_mixed_devices() {
    let mut req = valid_request();
    req.sensor_data[1].device_id = "DEV-OTHER".into();
    let result = verify(&req).unwrap();
    assert!(!result.phase_results[0].passed);
}

#[test]
fn logic_check_failure_unknown_methodology() {
    let mut req = valid_request();
    req.methodology = "bogus-method-42".into();
    let result = verify(&req).unwrap();
    assert!(!result.phase_results[1].passed);
}

#[test]
fn logic_check_failure_invalid_sensor_data() {
    let mut req = valid_request();
    req.sensor_data[0].co2_captured_kg = -100.0;
    let result = verify(&req).unwrap();
    assert!(!result.phase_results[1].passed);
}

#[test]
fn mint_check_failure_retired_credit() {
    let mut req = valid_request();
    req.provenance.events[1].event_type = EventType::Retired;
    let result = verify(&req).unwrap();
    assert!(!result.phase_results[2].passed);
    assert!(result.phase_results[2].details.contains("retired"));
}

#[test]
fn mint_check_failure_broken_provenance() {
    let mut req = valid_request();
    req.provenance.events[0].event_type = EventType::Transferred;
    let result = verify(&req).unwrap();
    assert!(!result.phase_results[2].passed);
}

#[test]
fn score_is_average_of_phase_scores() {
    let result = verify(&valid_request()).unwrap();
    let expected = (result.phase_results[0].score as u16
        + result.phase_results[1].score as u16
        + result.phase_results[2].score as u16)
        / 3;
    assert_eq!(result.score, expected as u8);
}

#[test]
fn phase_names_are_correct() {
    let result = verify(&valid_request()).unwrap();
    assert_eq!(result.phase_results[0].name, "Source Check");
    assert_eq!(result.phase_results[1].name, "Logic Check");
    assert_eq!(result.phase_results[2].name, "Mint Check");
}

#[test]
fn timestamp_is_recent() {
    let result = verify(&valid_request()).unwrap();
    let now = now_secs();
    assert!(result.timestamp <= now + 2);
    assert!(result.timestamp >= now - 5);
}
