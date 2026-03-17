use serde::{Deserialize, Serialize};

// ---------------------------------------------------------------------------
// Merkle API types
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BuildMerkleRequest {
    /// Hex-encoded leaf data entries.
    pub leaves: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BuildMerkleResponse {
    /// Hex-encoded Merkle root.
    pub root: String,
    /// Number of leaves in the tree.
    pub leaf_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VerifyMerkleRequest {
    /// Hex-encoded leaf hash.
    pub leaf: String,
    /// Hex-encoded sibling hashes (bottom to top).
    pub proof: Vec<String>,
    /// Hex-encoded expected Merkle root.
    pub root: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VerifyMerkleResponse {
    pub valid: bool,
}

// ---------------------------------------------------------------------------
// Provenance API types
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VerifyProvenanceRequest {
    pub chain: crate::provenance::ProvenanceChain,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VerifyProvenanceResponse {
    pub valid: bool,
    pub chain_hash: String,
    pub event_count: usize,
    pub errors: Vec<String>,
}

// ---------------------------------------------------------------------------
// Sensor API types
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValidateSensorRequest {
    pub reading: crate::sensor::SensorReading,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValidateSensorResponse {
    pub valid: bool,
    pub errors: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BatchValidateSensorRequest {
    pub readings: Vec<crate::sensor::SensorReading>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BatchValidateSensorResponse {
    pub total: usize,
    pub valid_count: usize,
    pub invalid_count: usize,
    pub results: Vec<ValidateSensorResponse>,
}

// ---------------------------------------------------------------------------
// Verification API types
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VerificationApiRequest {
    pub credit_id: String,
    pub sensor_data: Vec<crate::sensor::SensorReading>,
    pub provenance: crate::provenance::ProvenanceChain,
    pub methodology: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VerificationApiResponse {
    pub passed: bool,
    pub score: u8,
    pub phase_results: Vec<PhaseResultResponse>,
    pub timestamp: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PhaseResultResponse {
    pub phase: u8,
    pub name: String,
    pub passed: bool,
    pub details: String,
    pub score: u8,
}

// ---------------------------------------------------------------------------
// Health check
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HealthResponse {
    pub status: String,
    pub version: String,
}
