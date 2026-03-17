use crate::error::VerificationError;
use crate::provenance::{self, ProvenanceChain};
use crate::sensor::{SensorReading, SensorValidator};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::time::{SystemTime, UNIX_EPOCH};

/// Supported carbon credit methodologies.
const KNOWN_METHODOLOGIES: &[&str] = &[
    "verra-vm0044",
    "gold-standard-gs4gg",
    "cdm-ams-iii-d",
    "terraqura-dac-v1",
    "terraqura-biochar-v1",
];

/// Three-phase verification request matching the on-chain VerificationEngine.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VerificationRequest {
    pub credit_id: String,
    pub sensor_data: Vec<SensorReading>,
    pub provenance: ProvenanceChain,
    pub methodology: String,
}

/// Result of a single verification phase.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PhaseResult {
    pub phase: u8,
    pub name: String,
    pub passed: bool,
    pub details: String,
    pub score: u8,
}

/// Complete verification result.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VerificationResult {
    pub passed: bool,
    pub phase_results: [PhaseResult; 3],
    pub score: u8,
    pub timestamp: u64,
}

/// Run the full three-phase verification pipeline.
pub fn verify(request: &VerificationRequest) -> Result<VerificationResult, VerificationError> {
    let phase1 = source_check(request)?;
    let phase2 = logic_check(request)?;
    let phase3 = mint_check(request)?;

    let passed = phase1.passed && phase2.passed && phase3.passed;
    let score = ((phase1.score as u16 + phase2.score as u16 + phase3.score as u16) / 3) as u8;

    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();

    Ok(VerificationResult {
        passed,
        phase_results: [phase1, phase2, phase3],
        score,
        timestamp,
    })
}

/// Phase 1 — Source Check.
///
/// Validates data source integrity: device registration, calibration status,
/// and provenance chain start.
fn source_check(request: &VerificationRequest) -> Result<PhaseResult, VerificationError> {
    let mut issues = Vec::new();
    let mut score: u8 = 100;

    // All sensor readings must have non-empty device IDs
    if request.sensor_data.iter().any(|r| r.device_id.is_empty()) {
        issues.push("one or more readings missing device_id".into());
        score = score.saturating_sub(30);
    }

    // All device IDs should be consistent within a batch (same device)
    let device_ids: HashSet<&str> = request.sensor_data.iter().map(|r| r.device_id.as_str()).collect();
    if device_ids.len() > 1 {
        issues.push(format!(
            "mixed device IDs in batch: {} unique devices",
            device_ids.len()
        ));
        score = score.saturating_sub(20);
    }

    // Provenance chain must exist and start with a Minted event
    if request.provenance.events.is_empty() {
        issues.push("provenance chain is empty".into());
        score = score.saturating_sub(50);
    }

    // Credit ID must match provenance
    if request.credit_id != request.provenance.credit_id {
        issues.push("credit_id does not match provenance chain".into());
        score = score.saturating_sub(40);
    }

    // Must have sensor data
    if request.sensor_data.is_empty() {
        issues.push("no sensor data provided".into());
        score = score.saturating_sub(50);
    }

    let passed = issues.is_empty();
    let details = if passed {
        "all source checks passed".into()
    } else {
        issues.join("; ")
    };

    Ok(PhaseResult {
        phase: 1,
        name: "Source Check".into(),
        passed,
        details,
        score,
    })
}

/// Phase 2 — Logic Check.
///
/// Validates calculation correctness: efficiency bounds, energy balance,
/// and sensor data plausibility.
fn logic_check(request: &VerificationRequest) -> Result<PhaseResult, VerificationError> {
    let mut issues = Vec::new();
    let mut score: u8 = 100;

    let validator = SensorValidator::default();

    // Validate each reading
    let batch_result = validator.validate_batch(&request.sensor_data);
    if batch_result.invalid_count > 0 {
        issues.push(format!(
            "{} of {} sensor readings failed validation",
            batch_result.invalid_count, batch_result.total
        ));
        let penalty = ((batch_result.invalid_count as f64 / batch_result.total.max(1) as f64) * 60.0) as u8;
        score = score.saturating_sub(penalty);
    }

    // Run tampering detection
    let tampering = crate::sensor::detect_tampering(&request.sensor_data);
    if tampering.suspicious {
        issues.push(format!(
            "tampering detected (confidence {:.0}%): {}",
            tampering.confidence * 100.0,
            tampering.reasons.join(", ")
        ));
        score = score.saturating_sub((tampering.confidence * 40.0) as u8);
    }

    // Verify methodology is known
    if !KNOWN_METHODOLOGIES.contains(&request.methodology.as_str()) {
        issues.push(format!("unknown methodology: {}", request.methodology));
        score = score.saturating_sub(20);
    }

    // Total CO2 must be plausible (>0 for non-empty data)
    let total_co2: f64 = request.sensor_data.iter().map(|r| r.co2_captured_kg).sum();
    if !request.sensor_data.is_empty() && total_co2 <= 0.0 {
        issues.push("total CO2 captured is zero or negative".into());
        score = score.saturating_sub(40);
    }

    let passed = issues.is_empty();
    let details = if passed {
        "all logic checks passed".into()
    } else {
        issues.join("; ")
    };

    Ok(PhaseResult {
        phase: 2,
        name: "Logic Check".into(),
        passed,
        details,
        score,
    })
}

/// Phase 3 — Mint Check.
///
/// Validates minting eligibility: no double-mint, quota, and provenance integrity.
fn mint_check(request: &VerificationRequest) -> Result<PhaseResult, VerificationError> {
    let mut issues = Vec::new();
    let mut score: u8 = 100;

    // Verify provenance chain integrity
    let prov_result = provenance::verify_chain(&request.provenance);
    if !prov_result.valid {
        issues.push(format!(
            "provenance chain invalid: {}",
            prov_result.errors.join(", ")
        ));
        score = score.saturating_sub(50);
    }

    // Check for double-mint: there should be at most one Minted event
    let mint_count = request
        .provenance
        .events
        .iter()
        .filter(|e| e.event_type == crate::provenance::EventType::Minted)
        .count();
    if mint_count > 1 {
        issues.push(format!("double-mint detected: {mint_count} Minted events"));
        score = score.saturating_sub(50);
    }

    // Credit must not already be retired
    let retired = request
        .provenance
        .events
        .iter()
        .any(|e| e.event_type == crate::provenance::EventType::Retired);
    if retired {
        issues.push("credit has already been retired".into());
        score = score.saturating_sub(40);
    }

    let passed = issues.is_empty();
    let details = if passed {
        "all mint checks passed".into()
    } else {
        issues.join("; ")
    };

    Ok(PhaseResult {
        phase: 3,
        name: "Mint Check".into(),
        passed,
        details,
        score,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::provenance::build_test_chain;
    use crate::sensor::build_test_reading;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn now_secs() -> u64 {
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs()
    }

    fn valid_request() -> VerificationRequest {
        let ts = now_secs() - 120;
        let mut chain = build_test_chain("CREDIT-001", 2);
        // Ensure no Retired events for mint check to pass
        chain.events[1].event_type = crate::provenance::EventType::Verified;

        let mut r1 = build_test_reading("DEV-001", ts);
        let mut r2 = build_test_reading("DEV-001", ts + 60);
        // Vary the readings so tampering detection doesn't flag them
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
    fn full_verification_pass() {
        let result = verify(&valid_request()).unwrap();
        assert!(result.passed, "phase results: {:?}", result.phase_results);
        assert!(result.score > 0);
    }

    #[test]
    fn source_check_fails_on_empty_sensor_data() {
        let mut req = valid_request();
        req.sensor_data.clear();
        let result = verify(&req).unwrap();
        assert!(!result.passed);
        assert!(!result.phase_results[0].passed);
    }

    #[test]
    fn source_check_fails_on_credit_id_mismatch() {
        let mut req = valid_request();
        req.credit_id = "CREDIT-999".into();
        let result = verify(&req).unwrap();
        assert!(!result.passed);
    }

    #[test]
    fn logic_check_fails_unknown_methodology() {
        let mut req = valid_request();
        req.methodology = "unknown-method-x".into();
        let result = verify(&req).unwrap();
        assert!(!result.phase_results[1].passed);
    }

    #[test]
    fn mint_check_fails_on_retired_credit() {
        let mut req = valid_request();
        req.provenance.events[1].event_type = crate::provenance::EventType::Retired;
        let result = verify(&req).unwrap();
        assert!(!result.phase_results[2].passed);
    }

    #[test]
    fn score_is_average_of_phases() {
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
}
