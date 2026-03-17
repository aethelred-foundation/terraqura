use terraqura_verifier::crypto::{hash_pair, keccak256};
use terraqura_verifier::merkle::{build_tree, verify_proof, MerkleProof, MerkleTree};

fn sample_leaves() -> Vec<Vec<u8>> {
    vec![
        b"credit_001".to_vec(),
        b"credit_002".to_vec(),
        b"credit_003".to_vec(),
        b"credit_004".to_vec(),
    ]
}

#[test]
fn build_tree_and_verify_root() {
    let tree = MerkleTree::build(&sample_leaves());
    assert_ne!(tree.root(), [0u8; 32]);
    assert_eq!(tree.leaf_count(), 4);
}

#[test]
fn verify_valid_proof_leaf_0() {
    let tree = MerkleTree::build(&sample_leaves());
    let proof = tree.get_proof(0).unwrap();
    assert!(verify_proof(&proof));
}

#[test]
fn verify_valid_proof_leaf_1() {
    let tree = MerkleTree::build(&sample_leaves());
    let proof = tree.get_proof(1).unwrap();
    assert!(verify_proof(&proof));
}

#[test]
fn verify_valid_proof_leaf_2() {
    let tree = MerkleTree::build(&sample_leaves());
    let proof = tree.get_proof(2).unwrap();
    assert!(verify_proof(&proof));
}

#[test]
fn verify_valid_proof_leaf_3() {
    let tree = MerkleTree::build(&sample_leaves());
    let proof = tree.get_proof(3).unwrap();
    assert!(verify_proof(&proof));
}

#[test]
fn invalid_proof_tampered_leaf() {
    let tree = MerkleTree::build(&sample_leaves());
    let mut proof = tree.get_proof(0).unwrap();
    proof.leaf = keccak256(b"tampered_data");
    assert!(!verify_proof(&proof));
}

#[test]
fn invalid_proof_tampered_sibling() {
    let tree = MerkleTree::build(&sample_leaves());
    let mut proof = tree.get_proof(0).unwrap();
    if !proof.proof.is_empty() {
        proof.proof[0] = [0xffu8; 32];
    }
    assert!(!verify_proof(&proof));
}

#[test]
fn invalid_proof_wrong_root() {
    let tree = MerkleTree::build(&sample_leaves());
    let mut proof = tree.get_proof(0).unwrap();
    proof.root = [0u8; 32];
    assert!(!verify_proof(&proof));
}

#[test]
fn single_leaf_tree_proof() {
    let tree = MerkleTree::build(&[b"only_leaf".to_vec()]);
    assert_eq!(tree.leaf_count(), 1);
    let proof = tree.get_proof(0).unwrap();
    assert!(proof.proof.is_empty());
    assert!(verify_proof(&proof));
    assert_eq!(proof.root, keccak256(b"only_leaf"));
}

#[test]
fn empty_tree_returns_zero_root() {
    let tree = build_tree(&[]);
    assert_eq!(tree.root(), [0u8; 32]);
    assert_eq!(tree.leaf_count(), 0);
}

#[test]
fn empty_tree_get_proof_returns_none() {
    let tree = build_tree(&[]);
    assert!(tree.get_proof(0).is_none());
}

#[test]
fn large_tree_1000_leaves() {
    let leaves: Vec<Vec<u8>> = (0..1000).map(|i| format!("leaf_{i}").into_bytes()).collect();
    let tree = MerkleTree::build(&leaves);
    assert_eq!(tree.leaf_count(), 1000);

    // Spot-check a few proofs
    for &idx in &[0, 1, 499, 500, 998, 999] {
        let proof = tree.get_proof(idx).unwrap();
        assert!(verify_proof(&proof), "proof failed for index {idx}");
    }
}

#[test]
fn odd_number_of_leaves() {
    let leaves = vec![b"a".to_vec(), b"b".to_vec(), b"c".to_vec()];
    let tree = MerkleTree::build(&leaves);
    for i in 0..3 {
        let proof = tree.get_proof(i).unwrap();
        assert!(verify_proof(&proof));
    }
}

#[test]
fn sorted_pair_hashing_matches_openzeppelin() {
    // OpenZeppelin's MerkleProof.sol sorts pairs before hashing.
    // hash_pair(a, b) == hash_pair(b, a) by definition.
    let a = keccak256(b"leaf_a");
    let b = keccak256(b"leaf_b");
    assert_eq!(hash_pair(&a, &b), hash_pair(&b, &a));
}

#[test]
fn two_leaf_tree_root_equals_hash_pair() {
    let leaves = vec![b"x".to_vec(), b"y".to_vec()];
    let tree = MerkleTree::build(&leaves);
    let expected = hash_pair(&keccak256(b"x"), &keccak256(b"y"));
    assert_eq!(tree.root(), expected);
}

#[test]
fn deterministic_root() {
    let t1 = MerkleTree::build(&sample_leaves());
    let t2 = MerkleTree::build(&sample_leaves());
    assert_eq!(t1.root(), t2.root());
}

#[test]
fn different_leaves_produce_different_roots() {
    let t1 = MerkleTree::build(&[b"a".to_vec(), b"b".to_vec()]);
    let t2 = MerkleTree::build(&[b"c".to_vec(), b"d".to_vec()]);
    assert_ne!(t1.root(), t2.root());
}

#[test]
fn out_of_bounds_index_returns_none() {
    let tree = MerkleTree::build(&sample_leaves());
    assert!(tree.get_proof(999).is_none());
}

#[test]
fn manually_constructed_proof_verifies() {
    // Build a 2-leaf tree and manually construct the proof for leaf 0
    let leaf_a = keccak256(b"alpha");
    let leaf_b = keccak256(b"beta");
    let root = hash_pair(&leaf_a, &leaf_b);

    let proof = MerkleProof {
        leaf: leaf_a,
        proof: vec![leaf_b],
        root,
    };
    assert!(verify_proof(&proof));
}
