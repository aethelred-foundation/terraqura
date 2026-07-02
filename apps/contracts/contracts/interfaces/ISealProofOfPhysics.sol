// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title ISealProofOfPhysics
 * @notice Interface for the consensus-anchored MRV registry (top assurance
 *         tier): claims anchored to Aethelred Digital Seals via the ISeal
 *         precompile. See core/SealProofOfPhysics.sol.
 */
interface ISealProofOfPhysics {
    /**
     * @notice True iff (dacUnitId, sourceDataHash) carries a live consensus
     *         anchor: recorded, not locally revoked, and its backing Digital
     *         Seal is still ACTIVE on-chain.
     */
    function isAnchored(bytes32 dacUnitId, bytes32 sourceDataHash) external view returns (bool);

    /// @notice Reverting variant for integrators that want a hard gate.
    function requireAnchored(bytes32 dacUnitId, bytes32 sourceDataHash) external view;
}
