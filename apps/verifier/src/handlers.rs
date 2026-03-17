use axum::Json;

use crate::error::VerificationError;
use crate::merkle::{self, MerkleTree};
use crate::provenance;
use crate::sensor::SensorValidator;
use crate::types::*;
use crate::verification;

/// GET /health
pub async fn health() -> Json<HealthResponse> {
    Json(HealthResponse {
        status: "ok".into(),
        version: env!("CARGO_PKG_VERSION").into(),
    })
}

/// POST /verify — Full three-phase verification.
pub async fn verify(
    Json(payload): Json<VerificationApiRequest>,
) -> Result<Json<VerificationApiResponse>, VerificationError> {
    let request = verification::VerificationRequest {
        credit_id: payload.credit_id,
        sensor_data: payload.sensor_data,
        provenance: payload.provenance,
        methodology: payload.methodology,
    };

    let result = verification::verify(&request)?;

    let phase_results = result
        .phase_results
        .iter()
        .map(|p| PhaseResultResponse {
            phase: p.phase,
            name: p.name.clone(),
            passed: p.passed,
            details: p.details.clone(),
            score: p.score,
        })
        .collect();

    Ok(Json(VerificationApiResponse {
        passed: result.passed,
        score: result.score,
        phase_results,
        timestamp: result.timestamp,
    }))
}

/// POST /merkle/build — Build a Merkle tree from hex-encoded leaves.
pub async fn merkle_build(
    Json(payload): Json<BuildMerkleRequest>,
) -> Result<Json<BuildMerkleResponse>, VerificationError> {
    let leaves: Vec<Vec<u8>> = payload
        .leaves
        .iter()
        .map(|h| {
            hex::decode(h.strip_prefix("0x").unwrap_or(h))
                .map_err(|e| VerificationError::InvalidInput(format!("bad hex leaf: {e}")))
        })
        .collect::<Result<_, _>>()?;

    let tree = MerkleTree::build(&leaves);

    Ok(Json(BuildMerkleResponse {
        root: format!("0x{}", hex::encode(tree.root())),
        leaf_count: tree.leaf_count(),
    }))
}

/// POST /merkle/verify — Verify a Merkle proof.
pub async fn merkle_verify(
    Json(payload): Json<VerifyMerkleRequest>,
) -> Result<Json<VerifyMerkleResponse>, VerificationError> {
    let leaf = parse_hash32(&payload.leaf, "leaf")?;
    let root = parse_hash32(&payload.root, "root")?;
    let proof: Vec<[u8; 32]> = payload
        .proof
        .iter()
        .enumerate()
        .map(|(i, h)| parse_hash32(h, &format!("proof[{i}]")))
        .collect::<Result<_, _>>()?;

    let mp = merkle::MerkleProof { leaf, proof, root };
    let valid = merkle::verify_proof(&mp);

    Ok(Json(VerifyMerkleResponse { valid }))
}

/// POST /provenance/verify — Verify a provenance chain.
pub async fn provenance_verify(
    Json(payload): Json<VerifyProvenanceRequest>,
) -> Json<VerifyProvenanceResponse> {
    let result = provenance::verify_chain(&payload.chain);

    Json(VerifyProvenanceResponse {
        valid: result.valid,
        chain_hash: format!("0x{}", hex::encode(result.chain_hash)),
        event_count: result.event_count,
        errors: result.errors,
    })
}

/// POST /sensor/validate — Validate a single sensor reading.
pub async fn sensor_validate(
    Json(payload): Json<ValidateSensorRequest>,
) -> Json<ValidateSensorResponse> {
    let validator = SensorValidator::new();
    let result = validator.validate_reading(&payload.reading);

    Json(ValidateSensorResponse {
        valid: result.valid,
        errors: result.errors,
    })
}

/// POST /sensor/batch-validate — Batch-validate sensor readings.
pub async fn sensor_batch_validate(
    Json(payload): Json<BatchValidateSensorRequest>,
) -> Json<BatchValidateSensorResponse> {
    let validator = SensorValidator::new();
    let result = validator.validate_batch(&payload.readings);

    Json(BatchValidateSensorResponse {
        total: result.total,
        valid_count: result.valid_count,
        invalid_count: result.invalid_count,
        results: result
            .results
            .into_iter()
            .map(|r| ValidateSensorResponse {
                valid: r.valid,
                errors: r.errors,
            })
            .collect(),
    })
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

fn parse_hash32(hex_str: &str, label: &str) -> Result<[u8; 32], VerificationError> {
    let stripped = hex_str.strip_prefix("0x").unwrap_or(hex_str);
    let bytes = hex::decode(stripped)
        .map_err(|e| VerificationError::InvalidInput(format!("bad hex for {label}: {e}")))?;
    if bytes.len() != 32 {
        return Err(VerificationError::InvalidInput(format!(
            "{label} must be 32 bytes, got {}",
            bytes.len()
        )));
    }
    let mut arr = [0u8; 32];
    arr.copy_from_slice(&bytes);
    Ok(arr)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_hash32_valid() {
        let hex_str = format!("0x{}", hex::encode([0xabu8; 32]));
        let result = parse_hash32(&hex_str, "test").unwrap();
        assert_eq!(result, [0xab; 32]);
    }

    #[test]
    fn parse_hash32_no_prefix() {
        let hex_str = hex::encode([0xcd; 32]);
        let result = parse_hash32(&hex_str, "test").unwrap();
        assert_eq!(result, [0xcd; 32]);
    }

    #[test]
    fn parse_hash32_wrong_length() {
        let hex_str = "0xabcd";
        assert!(parse_hash32(hex_str, "test").is_err());
    }

    #[test]
    fn parse_hash32_bad_hex() {
        assert!(parse_hash32("0xZZZZ", "test").is_err());
    }
}
