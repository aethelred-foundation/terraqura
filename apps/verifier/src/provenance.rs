use crate::crypto::keccak256;
use serde::{Deserialize, Serialize};

/// Types of events in a carbon credit's lifecycle.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum EventType {
    Minted,
    Transferred,
    Retired,
    Verified,
    Split,
    Merged,
}

/// A single event in the provenance chain of a carbon credit.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProvenanceEvent {
    /// Type of lifecycle event.
    pub event_type: EventType,
    /// Unique identifier of the carbon credit.
    pub credit_id: String,
    /// Ethereum address of the actor (hex-encoded with 0x prefix).
    pub actor: String,
    /// Unix timestamp (seconds) of the event.
    pub timestamp: u64,
    /// Keccak-256 hash of the associated data payload.
    pub data_hash: [u8; 32],
    /// 65-byte ECDSA signature over the event hash (hex-encoded).
    pub signature: String,
}

/// An ordered chain of provenance events for a credit.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProvenanceChain {
    pub credit_id: String,
    pub events: Vec<ProvenanceEvent>,
}

/// Result of a full provenance chain verification.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProvenanceResult {
    pub valid: bool,
    pub chain_hash: [u8; 32],
    pub event_count: usize,
    pub errors: Vec<String>,
}

impl ProvenanceEvent {
    /// Compute the canonical hash of this event (excluding the signature field).
    pub fn compute_hash(&self) -> [u8; 32] {
        let mut buf = Vec::new();
        buf.extend_from_slice(self.credit_id.as_bytes());
        buf.push(self.event_type as u8);
        buf.extend_from_slice(self.actor.as_bytes());
        buf.extend_from_slice(&self.timestamp.to_be_bytes());
        buf.extend_from_slice(&self.data_hash);
        keccak256(&buf)
    }
}

/// Verify the integrity of an individual event.
///
/// Currently checks that the event hash is non-trivial and the signature
/// field is non-empty. Full ECDSA recovery is delegated to the crypto module
/// when on-chain verification is required.
pub fn verify_event(event: &ProvenanceEvent) -> bool {
    let hash = event.compute_hash();
    // The hash must not be trivially zero
    if hash == [0u8; 32] {
        return false;
    }
    // Signature field must be present
    if event.signature.is_empty() {
        return false;
    }
    // credit_id must match
    !event.credit_id.is_empty()
}

/// Validate the entire provenance chain.
///
/// Checks performed:
/// 1. Chain is non-empty.
/// 2. All events reference the same credit_id.
/// 3. Timestamps are monotonically non-decreasing.
/// 4. No duplicate events (by event hash).
/// 5. The first event must be `Minted`.
/// 6. Each individual event passes `verify_event`.
pub fn verify_chain(chain: &ProvenanceChain) -> ProvenanceResult {
    let mut errors = Vec::new();

    if chain.events.is_empty() {
        errors.push("chain is empty".into());
        return ProvenanceResult {
            valid: false,
            chain_hash: [0u8; 32],
            event_count: 0,
            errors,
        };
    }

    // First event must be Minted
    if chain.events[0].event_type != EventType::Minted {
        errors.push("first event must be Minted".into());
    }

    let mut seen_hashes = std::collections::HashSet::new();
    let mut prev_timestamp = 0u64;

    for (i, event) in chain.events.iter().enumerate() {
        // Credit ID consistency
        if event.credit_id != chain.credit_id {
            errors.push(format!(
                "event {i}: credit_id mismatch (expected {}, got {})",
                chain.credit_id, event.credit_id
            ));
        }

        // Individual event validity
        if !verify_event(event) {
            errors.push(format!("event {i}: failed individual verification"));
        }

        // Monotonic timestamps
        if event.timestamp < prev_timestamp {
            errors.push(format!(
                "event {i}: timestamp {} < previous {}",
                event.timestamp, prev_timestamp
            ));
        }
        prev_timestamp = event.timestamp;

        // Duplicate detection
        let hash = event.compute_hash();
        if !seen_hashes.insert(hash) {
            errors.push(format!("event {i}: duplicate event detected"));
        }
    }

    let chain_hash = compute_chain_hash(&chain.events);

    ProvenanceResult {
        valid: errors.is_empty(),
        chain_hash,
        event_count: chain.events.len(),
        errors,
    }
}

/// Compute a rolling hash over the entire chain of events.
///
/// `H_0 = hash(event_0)`, `H_n = keccak256(H_{n-1} ++ hash(event_n))`.
pub fn compute_chain_hash(events: &[ProvenanceEvent]) -> [u8; 32] {
    events.iter().fold([0u8; 32], |acc, event| {
        let event_hash = event.compute_hash();
        if acc == [0u8; 32] {
            event_hash
        } else {
            let mut combined = Vec::with_capacity(64);
            combined.extend_from_slice(&acc);
            combined.extend_from_slice(&event_hash);
            keccak256(&combined)
        }
    })
}

// ---------------------------------------------------------------------------
// Helpers for tests
// ---------------------------------------------------------------------------

/// Build a simple valid provenance chain for testing.
pub fn build_test_chain(credit_id: &str, event_count: usize) -> ProvenanceChain {
    let event_types = [
        EventType::Minted,
        EventType::Verified,
        EventType::Transferred,
        EventType::Retired,
        EventType::Split,
        EventType::Merged,
    ];

    let events: Vec<ProvenanceEvent> = (0..event_count)
        .map(|i| {
            let etype = if i == 0 {
                EventType::Minted
            } else {
                event_types[i % event_types.len()]
            };
            ProvenanceEvent {
                event_type: etype,
                credit_id: credit_id.to_string(),
                actor: format!("0x{:040x}", i + 1),
                timestamp: 1_700_000_000 + (i as u64) * 3600,
                data_hash: keccak256(format!("data_{i}").as_bytes()),
                signature: format!("sig_{i}"),
            }
        })
        .collect();

    ProvenanceChain {
        credit_id: credit_id.to_string(),
        events,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn valid_chain_verifies() {
        let chain = build_test_chain("CREDIT-001", 5);
        let result = verify_chain(&chain);
        assert!(result.valid, "errors: {:?}", result.errors);
        assert_eq!(result.event_count, 5);
    }

    #[test]
    fn empty_chain_fails() {
        let chain = ProvenanceChain {
            credit_id: "CREDIT-001".into(),
            events: Vec::new(),
        };
        let result = verify_chain(&chain);
        assert!(!result.valid);
    }

    #[test]
    fn non_minted_first_event_fails() {
        let mut chain = build_test_chain("CREDIT-001", 3);
        chain.events[0].event_type = EventType::Transferred;
        let result = verify_chain(&chain);
        assert!(!result.valid);
        assert!(result.errors.iter().any(|e| e.contains("Minted")));
    }

    #[test]
    fn credit_id_mismatch_detected() {
        let mut chain = build_test_chain("CREDIT-001", 3);
        chain.events[1].credit_id = "CREDIT-999".into();
        let result = verify_chain(&chain);
        assert!(!result.valid);
        assert!(result.errors.iter().any(|e| e.contains("credit_id mismatch")));
    }

    #[test]
    fn out_of_order_timestamps_detected() {
        let mut chain = build_test_chain("CREDIT-001", 3);
        chain.events[2].timestamp = chain.events[0].timestamp - 1;
        let result = verify_chain(&chain);
        assert!(!result.valid);
        assert!(result.errors.iter().any(|e| e.contains("timestamp")));
    }

    #[test]
    fn chain_hash_is_deterministic() {
        let chain = build_test_chain("CREDIT-001", 4);
        let h1 = compute_chain_hash(&chain.events);
        let h2 = compute_chain_hash(&chain.events);
        assert_eq!(h1, h2);
    }

    #[test]
    fn single_event_chain() {
        let chain = build_test_chain("CREDIT-001", 1);
        let result = verify_chain(&chain);
        assert!(result.valid);
        assert_eq!(result.event_count, 1);
    }

    #[test]
    fn verify_event_requires_signature() {
        let mut event = build_test_chain("C", 1).events.remove(0);
        event.signature = String::new();
        assert!(!verify_event(&event));
    }

    #[test]
    fn verify_event_requires_credit_id() {
        let mut event = build_test_chain("C", 1).events.remove(0);
        event.credit_id = String::new();
        assert!(!verify_event(&event));
    }
}
