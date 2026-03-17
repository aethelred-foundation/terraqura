use serde_json::Value;
use sha3::{Digest, Keccak256};

/// Compute the Keccak-256 hash of arbitrary data (matching Solidity's `keccak256`).
pub fn keccak256(data: &[u8]) -> [u8; 32] {
    let mut hasher = Keccak256::new();
    hasher.update(data);
    hasher.finalize().into()
}

/// Sorted-pair hash used in OpenZeppelin-compatible Merkle trees.
///
/// If `a <= b` (lexicographic on bytes), computes `keccak256(a ++ b)`;
/// otherwise `keccak256(b ++ a)`. This ensures the same result regardless
/// of argument order, matching `MerkleProof.sol`.
pub fn hash_pair(a: &[u8; 32], b: &[u8; 32]) -> [u8; 32] {
    let mut combined = Vec::with_capacity(64);
    if a <= b {
        combined.extend_from_slice(a);
        combined.extend_from_slice(b);
    } else {
        combined.extend_from_slice(b);
        combined.extend_from_slice(a);
    }
    keccak256(&combined)
}

/// Deterministic JSON hashing.
///
/// Keys are sorted recursively so that semantically equal JSON values
/// always produce the same hash regardless of serialisation order.
pub fn compute_data_hash(data: &Value) -> [u8; 32] {
    let canonical = canonical_json(data);
    keccak256(canonical.as_bytes())
}

/// Verify an Ethereum `personal_sign` (EIP-191) signature.
///
/// * `message`  — the raw message bytes (will be prefixed with `\x19Ethereum Signed Message:\n{len}`)
/// * `signature` — 65-byte RSV signature
/// * `expected_signer` — 20-byte Ethereum address
///
/// Returns `true` when the recovered address matches `expected_signer`.
pub fn verify_eth_signature(
    message: &[u8],
    signature: &[u8; 65],
    expected_signer: &[u8; 20],
) -> bool {
    use k256::ecdsa::{RecoveryId, Signature, VerifyingKey};

    // Build EIP-191 prefixed hash
    let prefix = format!("\x19Ethereum Signed Message:\n{}", message.len());
    let mut prefixed = Vec::with_capacity(prefix.len() + message.len());
    prefixed.extend_from_slice(prefix.as_bytes());
    prefixed.extend_from_slice(message);
    let msg_hash = keccak256(&prefixed);

    // Parse signature components
    let sig_bytes = &signature[..64];
    let v = signature[64];
    // Normalise v: Ethereum uses 27/28, RecoveryId expects 0/1
    let recovery_id = match v {
        0 | 1 => v,
        27 => 0,
        28 => 1,
        _ => return false,
    };

    let Ok(sig) = Signature::from_slice(sig_bytes) else {
        return false;
    };
    let Ok(rid) = RecoveryId::try_from(recovery_id) else {
        return false;
    };

    let Ok(recovered_key) = VerifyingKey::recover_from_prehash(&msg_hash, &sig, rid) else {
        return false;
    };

    // Derive the Ethereum address from the uncompressed public key
    let pubkey_bytes = recovered_key.to_encoded_point(false);
    let pubkey_uncompressed = &pubkey_bytes.as_bytes()[1..]; // strip the 0x04 prefix
    let address_hash = keccak256(pubkey_uncompressed);
    let recovered_address = &address_hash[12..]; // last 20 bytes

    recovered_address == expected_signer
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/// Produce a canonical (sorted-key) JSON string for deterministic hashing.
fn canonical_json(value: &Value) -> String {
    match value {
        Value::Object(map) => {
            let mut keys: Vec<&String> = map.keys().collect();
            keys.sort();
            let entries: Vec<String> = keys
                .iter()
                .map(|k| {
                    format!(
                        "{}:{}",
                        canonical_json(&Value::String((*k).clone())),
                        canonical_json(&map[*k])
                    )
                })
                .collect();
            format!("{{{}}}", entries.join(","))
        }
        Value::Array(arr) => {
            let items: Vec<String> = arr.iter().map(canonical_json).collect();
            format!("[{}]", items.join(","))
        }
        Value::String(s) => {
            format!("\"{}\"", s.replace('\\', "\\\\").replace('"', "\\\""))
        }
        Value::Number(n) => n.to_string(),
        Value::Bool(b) => b.to_string(),
        Value::Null => "null".into(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn keccak256_empty() {
        let hash = keccak256(b"");
        assert_eq!(
            hex::encode(hash),
            "c5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470"
        );
    }

    #[test]
    fn keccak256_hello_world() {
        let hash = keccak256(b"hello world");
        assert_eq!(
            hex::encode(hash),
            "47173285a8d7341e5e972fc677286384f802f8ef42a5ec5f03bbfa254cb01fad"
        );
    }

    #[test]
    fn hash_pair_is_commutative() {
        let a = keccak256(b"leaf_a");
        let b = keccak256(b"leaf_b");
        assert_eq!(hash_pair(&a, &b), hash_pair(&b, &a));
    }

    #[test]
    fn hash_pair_equal_inputs() {
        let a = keccak256(b"same");
        assert_eq!(hash_pair(&a, &a), hash_pair(&a, &a));
    }

    #[test]
    fn deterministic_json_hash_ignores_key_order() {
        let json_a: Value = serde_json::from_str(r#"{"b":2,"a":1}"#).unwrap();
        let json_b: Value = serde_json::from_str(r#"{"a":1,"b":2}"#).unwrap();
        assert_eq!(compute_data_hash(&json_a), compute_data_hash(&json_b));
    }

    #[test]
    fn deterministic_json_hash_nested() {
        let json: Value =
            serde_json::from_str(r#"{"z":{"b":2,"a":1},"y":[3,2,1]}"#).unwrap();
        let hash = compute_data_hash(&json);
        assert_eq!(hash, compute_data_hash(&json));
    }

    #[test]
    fn canonical_json_sorts_keys() {
        let val: Value = serde_json::from_str(r#"{"c":3,"a":1,"b":2}"#).unwrap();
        let s = canonical_json(&val);
        assert_eq!(s, r#"{"a":1,"b":2,"c":3}"#);
    }

    #[test]
    fn verify_eth_signature_rejects_garbage() {
        let msg = b"hello";
        let sig = [0u8; 65];
        let addr = [0u8; 20];
        assert!(!verify_eth_signature(msg, &sig, &addr));
    }
}
