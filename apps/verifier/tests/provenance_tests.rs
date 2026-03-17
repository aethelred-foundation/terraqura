use terraqura_verifier::provenance::*;

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
    assert!(result.errors.iter().any(|e| e.contains("empty")));
}

#[test]
fn single_event_chain() {
    let chain = build_test_chain("CREDIT-001", 1);
    let result = verify_chain(&chain);
    assert!(result.valid, "errors: {:?}", result.errors);
    assert_eq!(result.event_count, 1);
}

#[test]
fn first_event_must_be_minted() {
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
    let mut chain = build_test_chain("CREDIT-001", 4);
    // Make event 3 earlier than event 2
    chain.events[3].timestamp = chain.events[1].timestamp - 1;
    let result = verify_chain(&chain);
    assert!(!result.valid);
    assert!(result.errors.iter().any(|e| e.contains("timestamp")));
}

#[test]
fn duplicate_events_detected() {
    let mut chain = build_test_chain("CREDIT-001", 3);
    // Clone event 1 entirely (same hash) — but adjust timestamp to be monotonic
    let mut dup = chain.events[1].clone();
    dup.timestamp = chain.events[2].timestamp + 1;
    // Since the hash depends on timestamp, we need truly identical hashes.
    // Instead, insert event[1] again at the same timestamp.
    chain.events.push(chain.events[1].clone());
    // Sort by timestamp to avoid the timestamp-ordering error
    chain.events.sort_by_key(|e| e.timestamp);
    let result = verify_chain(&chain);
    assert!(!result.valid);
    assert!(result.errors.iter().any(|e| e.contains("duplicate")));
}

#[test]
fn chain_hash_is_deterministic() {
    let chain = build_test_chain("CREDIT-001", 5);
    let h1 = compute_chain_hash(&chain.events);
    let h2 = compute_chain_hash(&chain.events);
    assert_eq!(h1, h2);
}

#[test]
fn chain_hash_changes_with_different_events() {
    let chain1 = build_test_chain("CREDIT-001", 3);
    let chain2 = build_test_chain("CREDIT-002", 3);
    assert_ne!(
        compute_chain_hash(&chain1.events),
        compute_chain_hash(&chain2.events)
    );
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

#[test]
fn verify_event_valid() {
    let event = build_test_chain("CREDIT-001", 1).events.remove(0);
    assert!(verify_event(&event));
}

#[test]
fn large_chain_verifies() {
    let chain = build_test_chain("CREDIT-BIG", 50);
    let result = verify_chain(&chain);
    assert!(result.valid, "errors: {:?}", result.errors);
    assert_eq!(result.event_count, 50);
}
