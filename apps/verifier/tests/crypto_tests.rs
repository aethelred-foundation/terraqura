use serde_json::Value;
use terraqura_verifier::crypto::*;

#[test]
fn keccak256_empty_known_vector() {
    let hash = keccak256(b"");
    assert_eq!(
        hex::encode(hash),
        "c5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470"
    );
}

#[test]
fn keccak256_hello_world_known_vector() {
    let hash = keccak256(b"hello world");
    assert_eq!(
        hex::encode(hash),
        "47173285a8d7341e5e972fc677286384f802f8ef42a5ec5f03bbfa254cb01fad"
    );
}

#[test]
fn keccak256_single_byte() {
    let hash = keccak256(&[0x00]);
    // Known: keccak256(0x00) = bc36789e...
    assert_eq!(
        hex::encode(hash),
        "bc36789e7a1e281436464229828f817d6612f7b477d66591ff96a9e064bcc98a"
    );
}

#[test]
fn keccak256_is_deterministic() {
    let data = b"terraqura carbon credit";
    assert_eq!(keccak256(data), keccak256(data));
}

#[test]
fn hash_pair_commutative() {
    let a = keccak256(b"leaf_alpha");
    let b = keccak256(b"leaf_beta");
    assert_eq!(hash_pair(&a, &b), hash_pair(&b, &a));
}

#[test]
fn hash_pair_same_inputs() {
    let a = keccak256(b"same");
    // hash_pair(a, a) should still be deterministic
    let h = hash_pair(&a, &a);
    assert_eq!(h, hash_pair(&a, &a));
}

#[test]
fn hash_pair_different_from_individual() {
    let a = keccak256(b"x");
    let b = keccak256(b"y");
    let paired = hash_pair(&a, &b);
    assert_ne!(paired, a);
    assert_ne!(paired, b);
}

#[test]
fn deterministic_json_hash_key_order() {
    let a: Value = serde_json::from_str(r#"{"b":2,"a":1}"#).unwrap();
    let b: Value = serde_json::from_str(r#"{"a":1,"b":2}"#).unwrap();
    assert_eq!(compute_data_hash(&a), compute_data_hash(&b));
}

#[test]
fn deterministic_json_hash_nested_objects() {
    let a: Value =
        serde_json::from_str(r#"{"outer":{"z":3,"a":1},"inner":[1,2]}"#).unwrap();
    let b: Value =
        serde_json::from_str(r#"{"inner":[1,2],"outer":{"a":1,"z":3}}"#).unwrap();
    assert_eq!(compute_data_hash(&a), compute_data_hash(&b));
}

#[test]
fn deterministic_json_hash_different_values() {
    let a: Value = serde_json::from_str(r#"{"x":1}"#).unwrap();
    let b: Value = serde_json::from_str(r#"{"x":2}"#).unwrap();
    assert_ne!(compute_data_hash(&a), compute_data_hash(&b));
}

#[test]
fn eth_signature_rejects_zero_signature() {
    let msg = b"test message";
    let sig = [0u8; 65];
    let addr = [0u8; 20];
    assert!(!verify_eth_signature(msg, &sig, &addr));
}

#[test]
fn eth_signature_rejects_random_bytes() {
    let msg = b"verify me";
    let mut sig = [0xffu8; 65];
    sig[64] = 27; // valid v
    let addr = [0x42u8; 20];
    // Random signature should not match any specific address
    assert!(!verify_eth_signature(msg, &sig, &addr));
}

#[test]
fn deterministic_json_hash_with_array() {
    let val: Value = serde_json::from_str(r#"[1, "two", null, true]"#).unwrap();
    let h1 = compute_data_hash(&val);
    let h2 = compute_data_hash(&val);
    assert_eq!(h1, h2);
}
