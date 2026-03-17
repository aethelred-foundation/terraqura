use crate::crypto::{hash_pair, keccak256};
use serde::{Deserialize, Serialize};

/// A Merkle proof that can be verified against a known root.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MerkleProof {
    /// Keccak-256 hash of the leaf data.
    pub leaf: [u8; 32],
    /// Sibling hashes from leaf to root.
    pub proof: Vec<[u8; 32]>,
    /// Expected Merkle root.
    pub root: [u8; 32],
}

/// In-memory Merkle tree built from a set of leaves.
#[derive(Debug, Clone)]
pub struct MerkleTree {
    /// All layers of the tree. `layers[0]` contains the leaf hashes.
    layers: Vec<Vec<[u8; 32]>>,
}

impl MerkleTree {
    /// Build a new Merkle tree from raw leaf data.
    ///
    /// Each leaf is hashed with `keccak256` before insertion. The tree uses
    /// sorted-pair hashing to match OpenZeppelin's `MerkleProof.sol`.
    pub fn build(leaves: &[Vec<u8>]) -> Self {
        build_tree(leaves)
    }

    /// Root hash of the tree. Returns the zero hash for an empty tree.
    pub fn root(&self) -> [u8; 32] {
        self.layers
            .last()
            .and_then(|layer| layer.first().copied())
            .unwrap_or([0u8; 32])
    }

    /// Number of leaves in the tree.
    pub fn leaf_count(&self) -> usize {
        self.layers.first().map_or(0, |l| l.len())
    }

    /// Generate a proof for the leaf at `index`.
    ///
    /// Returns `None` if the index is out of bounds.
    pub fn get_proof(&self, index: usize) -> Option<MerkleProof> {
        if self.layers.is_empty() || index >= self.layers[0].len() {
            return None;
        }

        let leaf = self.layers[0][index];
        let mut proof_nodes = Vec::new();
        let mut idx = index;

        for layer in &self.layers[..self.layers.len().saturating_sub(1)] {
            let sibling_idx = if idx % 2 == 0 { idx + 1 } else { idx - 1 };
            if sibling_idx < layer.len() {
                proof_nodes.push(layer[sibling_idx]);
            }
            idx /= 2;
        }

        Some(MerkleProof {
            leaf,
            proof: proof_nodes,
            root: self.root(),
        })
    }
}

/// Build a Merkle tree from raw leaf byte slices.
pub fn build_tree(leaves: &[Vec<u8>]) -> MerkleTree {
    if leaves.is_empty() {
        return MerkleTree {
            layers: Vec::new(),
        };
    }

    let leaf_hashes: Vec<[u8; 32]> = leaves.iter().map(|l| keccak256(l)).collect();
    let mut layers: Vec<Vec<[u8; 32]>> = vec![leaf_hashes];

    while layers.last().unwrap().len() > 1 {
        let current = layers.last().unwrap();
        let mut next = Vec::with_capacity((current.len() + 1) / 2);

        for chunk in current.chunks(2) {
            if chunk.len() == 2 {
                next.push(hash_pair(&chunk[0], &chunk[1]));
            } else {
                // Odd element is promoted as-is
                next.push(chunk[0]);
            }
        }

        layers.push(next);
    }

    MerkleTree { layers }
}

/// Verify a Merkle proof against its embedded root.
///
/// Walks from the leaf up to the root using sorted-pair hashing.
pub fn verify_proof(proof: &MerkleProof) -> bool {
    let mut computed = proof.leaf;

    for sibling in &proof.proof {
        computed = hash_pair(&computed, sibling);
    }

    computed == proof.root
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_leaves() -> Vec<Vec<u8>> {
        vec![
            b"credit_001".to_vec(),
            b"credit_002".to_vec(),
            b"credit_003".to_vec(),
            b"credit_004".to_vec(),
        ]
    }

    #[test]
    fn build_and_verify_root() {
        let tree = MerkleTree::build(&sample_leaves());
        assert_ne!(tree.root(), [0u8; 32]);
        assert_eq!(tree.leaf_count(), 4);
    }

    #[test]
    fn proof_for_each_leaf_is_valid() {
        let tree = MerkleTree::build(&sample_leaves());
        for i in 0..tree.leaf_count() {
            let proof = tree.get_proof(i).unwrap();
            assert!(verify_proof(&proof), "proof failed for leaf {i}");
        }
    }

    #[test]
    fn tampered_proof_fails() {
        let tree = MerkleTree::build(&sample_leaves());
        let mut proof = tree.get_proof(0).unwrap();
        proof.leaf = keccak256(b"tampered");
        assert!(!verify_proof(&proof));
    }

    #[test]
    fn single_leaf_tree() {
        let tree = MerkleTree::build(&[b"only_one".to_vec()]);
        assert_eq!(tree.leaf_count(), 1);
        let proof = tree.get_proof(0).unwrap();
        assert!(verify_proof(&proof));
        assert!(proof.proof.is_empty());
    }

    #[test]
    fn empty_tree() {
        let tree = MerkleTree::build(&[]);
        assert_eq!(tree.root(), [0u8; 32]);
        assert_eq!(tree.leaf_count(), 0);
        assert!(tree.get_proof(0).is_none());
    }

    #[test]
    fn odd_number_of_leaves() {
        let leaves = vec![
            b"a".to_vec(),
            b"b".to_vec(),
            b"c".to_vec(),
        ];
        let tree = MerkleTree::build(&leaves);
        for i in 0..3 {
            let proof = tree.get_proof(i).unwrap();
            assert!(verify_proof(&proof), "proof failed for leaf {i}");
        }
    }

    #[test]
    fn root_is_deterministic() {
        let tree1 = MerkleTree::build(&sample_leaves());
        let tree2 = MerkleTree::build(&sample_leaves());
        assert_eq!(tree1.root(), tree2.root());
    }

    #[test]
    fn different_leaves_different_root() {
        let tree1 = MerkleTree::build(&[b"a".to_vec(), b"b".to_vec()]);
        let tree2 = MerkleTree::build(&[b"c".to_vec(), b"d".to_vec()]);
        assert_ne!(tree1.root(), tree2.root());
    }

    #[test]
    fn out_of_bounds_proof_returns_none() {
        let tree = MerkleTree::build(&sample_leaves());
        assert!(tree.get_proof(100).is_none());
    }
}
