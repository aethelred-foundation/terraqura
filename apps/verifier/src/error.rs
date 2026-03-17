use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use serde::Serialize;

/// Domain errors for the verification engine.
#[derive(Debug, Clone, thiserror::Error)]
pub enum VerificationError {
    #[error("invalid proof: {0}")]
    InvalidProof(String),

    #[error("invalid merkle root: expected {expected}, got {actual}")]
    InvalidMerkleRoot { expected: String, actual: String },

    #[error("invalid signature: {0}")]
    InvalidSignature(String),

    #[error("data integrity error: {0}")]
    DataIntegrityError(String),

    #[error("sensor validation failed: {0}")]
    SensorValidationFailed(String),

    #[error("provenance chain broken: {0}")]
    ProvenanceChainBroken(String),

    #[error("phase {phase} failed: {reason}")]
    PhaseFailure { phase: u8, reason: String },

    #[error("invalid input: {0}")]
    InvalidInput(String),

    #[error("internal error: {0}")]
    Internal(String),
}

/// JSON body returned on error responses.
#[derive(Debug, Serialize)]
struct ErrorBody {
    error: String,
    code: &'static str,
}

impl VerificationError {
    fn status_code(&self) -> StatusCode {
        match self {
            Self::InvalidProof(_)
            | Self::InvalidMerkleRoot { .. }
            | Self::InvalidSignature(_)
            | Self::DataIntegrityError(_)
            | Self::SensorValidationFailed(_)
            | Self::ProvenanceChainBroken(_)
            | Self::PhaseFailure { .. }
            | Self::InvalidInput(_) => StatusCode::BAD_REQUEST,
            Self::Internal(_) => StatusCode::INTERNAL_SERVER_ERROR,
        }
    }

    fn error_code(&self) -> &'static str {
        match self {
            Self::InvalidProof(_) => "INVALID_PROOF",
            Self::InvalidMerkleRoot { .. } => "INVALID_MERKLE_ROOT",
            Self::InvalidSignature(_) => "INVALID_SIGNATURE",
            Self::DataIntegrityError(_) => "DATA_INTEGRITY_ERROR",
            Self::SensorValidationFailed(_) => "SENSOR_VALIDATION_FAILED",
            Self::ProvenanceChainBroken(_) => "PROVENANCE_CHAIN_BROKEN",
            Self::PhaseFailure { .. } => "PHASE_FAILURE",
            Self::InvalidInput(_) => "INVALID_INPUT",
            Self::Internal(_) => "INTERNAL_ERROR",
        }
    }
}

impl IntoResponse for VerificationError {
    fn into_response(self) -> Response {
        let status = self.status_code();
        let body = ErrorBody {
            error: self.to_string(),
            code: self.error_code(),
        };
        (status, axum::Json(body)).into_response()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn invalid_proof_is_400() {
        let err = VerificationError::InvalidProof("bad".into());
        assert_eq!(err.status_code(), StatusCode::BAD_REQUEST);
        assert_eq!(err.error_code(), "INVALID_PROOF");
    }

    #[test]
    fn internal_is_500() {
        let err = VerificationError::Internal("oops".into());
        assert_eq!(err.status_code(), StatusCode::INTERNAL_SERVER_ERROR);
    }

    #[test]
    fn error_display() {
        let err = VerificationError::InvalidMerkleRoot {
            expected: "aaa".into(),
            actual: "bbb".into(),
        };
        assert!(err.to_string().contains("aaa"));
        assert!(err.to_string().contains("bbb"));
    }

    #[test]
    fn phase_failure_display() {
        let err = VerificationError::PhaseFailure {
            phase: 2,
            reason: "efficiency out of bounds".into(),
        };
        assert!(err.to_string().contains("phase 2"));
    }
}
