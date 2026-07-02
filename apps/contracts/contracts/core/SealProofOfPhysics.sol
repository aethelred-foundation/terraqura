// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

import "../interfaces/ISeal.sol";

/**
 * @title SealProofOfPhysics — consensus-anchored MRV for carbon claims
 * @author TerraQura
 * @notice The top assurance tier of TerraQura's Proof-of-Physics stack, and the
 *         reason TerraQura is the default RWA/carbon platform for sovereign and
 *         regulated clients: a capture claim of the highest tier is not an
 *         oracle's signature — it is anchored to a **Digital Seal** minted by
 *         the Aethelred validator quorum when a PoUW MRV job (the attested
 *         physics computation over the DAC unit's sensor data, run under a CEAP
 *         confidentiality policy) completed. The anchor is verified by the
 *         ISeal precompile (0x0900), i.e. by the SAME consensus logic that
 *         minted the seal. No oracle multisig, no off-chain verifier service
 *         sits in the trust path at verification time.
 *
 *         Flow:
 *           1. A PoUW MRV job runs over the sensor stream for a capture claim
 *              with purpose `terraqura:0x<dacUnitId>:0x<sourceDataHash>` and a
 *              CEAP policy (jurisdiction, backend, vendor-root); the validator
 *              quorum mints the Digital Seal binding purpose + attestation.
 *           2. Anyone (operator, relayer, keeper bot) calls {anchor} with the
 *              job id — the seal is self-authorizing because its purpose binds
 *              the exact claim, so anchoring is permissionless by design.
 *           3. Mint/settlement paths call {isAnchored} / {requireAnchored};
 *              the registry re-checks the seal's live ACTIVE status through
 *              ISeal, so a seal revoked on-chain invalidates the claim's
 *              anchor instantly — no TerraQura transaction required.
 *
 * @dev Complements {VerificationEngine} (three-phase Source/Logic/Mint checks):
 *      the engine validates physics parameters in-EVM; this registry anchors
 *      the claim to attested, confidential, quorum-verified compute. It is
 *      deliberately NOT upgradeable — the consensus anchor of record must not
 *      be admin-mutable. Governed parameters are limited to the CEAP policy,
 *      pause (issuance only), and local revocation.
 */
contract SealProofOfPhysics is Ownable2Step, Pausable, ReentrancyGuard {
    // ============================================
    // Constants
    // ============================================

    /// @dev The ISeal precompile (see aethelred repo precompiles/seal). Only
    ///      real on Aethelred (EVM chain id 7332 / its production successor).
    ISeal internal constant SEAL = ISeal(0x0000000000000000000000000000000000000900);

    // ============================================
    // Types
    // ============================================

    /// @notice A consensus-anchored MRV record for (dacUnitId, sourceDataHash).
    struct Anchor {
        string sealId; // the backing Digital Seal
        uint64 anchoredAt; // block time of anchoring
        bool exists; // record present
        bool revoked; // locally revoked by governance
    }

    // ============================================
    // State
    // ============================================

    // dacUnitId => sourceDataHash => anchor
    mapping(bytes32 => mapping(bytes32 => Anchor)) private _anchors;
    // a seal admits exactly one anchor (replay protection)
    mapping(string => bool) public sealUsed;

    // CEAP policy every backing seal must satisfy (empty arrays = any).
    string[] private _allowedBackends;
    string private _minVerification;
    string[] private _allowedPlatforms;
    bool private _requireVendorRoot;
    string[] private _dataResidency;

    // ============================================
    // Events
    // ============================================

    event ClaimAnchored(
        bytes32 indexed dacUnitId, bytes32 indexed sourceDataHash, string sealId, string jobId
    );
    event AnchorRevoked(bytes32 indexed dacUnitId, bytes32 indexed sourceDataHash, address indexed by);
    event CompliancePolicySet(
        string[] allowedBackends,
        string minVerification,
        string[] allowedPlatforms,
        bool requireVendorRoot,
        string[] dataResidency
    );

    // ============================================
    // Errors
    // ============================================

    error ZeroClaim();
    error SealAlreadyUsed(string sealId);
    error SealNotActive(string sealId);
    error SealNotBoundToClaim(string expectedPurpose);
    error PolicyNotSatisfied(string reason);
    error NoSuchAnchor();

    constructor(address governance) {
        _transferOwnership(governance);
    }

    // ============================================
    // Anchoring (consensus-anchored issuance)
    // ============================================

    /**
     * @notice Anchor the MRV claim (dacUnitId, sourceDataHash) to the Digital
     *         Seal minted for `jobId`. Permissionless: the seal's purpose binds
     *         the exact claim, so no caller can mis-attribute an anchor to a
     *         claim the quorum did not verify. Each seal admits one anchor.
     */
    function anchor(bytes32 dacUnitId, bytes32 sourceDataHash, string calldata jobId)
        external
        whenNotPaused
        nonReentrant
    {
        if (dacUnitId == bytes32(0) || sourceDataHash == bytes32(0)) revert ZeroClaim();

        // Resolve the seal for the PoUW job (reverts if the job is unsealed).
        string memory sealId = SEAL.getSealIdByJob(jobId);
        if (sealUsed[sealId]) revert SealAlreadyUsed(sealId);
        if (!SEAL.verifySeal(sealId)) revert SealNotActive(sealId);

        // The seal must have been minted FOR this exact claim: the PoUW job
        // purpose binds DAC unit AND sensor-data hash, so an anchor cannot be
        // replayed onto a different unit or a different data window.
        (, , , , , , string memory purpose, , ) = SEAL.getSeal(sealId);
        string memory expected = string.concat(
            "terraqura:", _toHexBytes32(dacUnitId), ":", _toHexBytes32(sourceDataHash)
        );
        if (keccak256(bytes(purpose)) != keccak256(bytes(expected))) {
            revert SealNotBoundToClaim(expected);
        }

        // CEAP policy — consensus-parity Satisfies via the precompile.
        (bool ok, string memory reason) = SEAL.requireConfidentiality(
            sealId,
            _allowedBackends,
            _minVerification,
            _allowedPlatforms,
            _requireVendorRoot,
            _dataResidency
        );
        if (!ok) revert PolicyNotSatisfied(reason);

        sealUsed[sealId] = true;
        _anchors[dacUnitId][sourceDataHash] = Anchor({
            sealId: sealId,
            anchoredAt: uint64(block.timestamp),
            exists: true,
            revoked: false
        });
        emit ClaimAnchored(dacUnitId, sourceDataHash, sealId, jobId);
    }

    // ============================================
    // Verification (what mint/settlement paths call)
    // ============================================

    /**
     * @notice True iff the claim carries a live consensus anchor: recorded, not
     *         locally revoked, AND its backing seal is still ACTIVE on-chain
     *         (seal revocation propagates from consensus instantly).
     */
    function isAnchored(bytes32 dacUnitId, bytes32 sourceDataHash) public view returns (bool) {
        Anchor storage a = _anchors[dacUnitId][sourceDataHash];
        if (!a.exists || a.revoked) return false;
        return SEAL.verifySeal(a.sealId);
    }

    /// @notice Reverting variant for integrators that want a hard gate.
    function requireAnchored(bytes32 dacUnitId, bytes32 sourceDataHash) external view {
        if (!isAnchored(dacUnitId, sourceDataHash)) revert NoSuchAnchor();
    }

    /// @notice Full anchor record (sealId, anchoredAt, flags).
    function getAnchor(bytes32 dacUnitId, bytes32 sourceDataHash)
        external
        view
        returns (Anchor memory)
    {
        return _anchors[dacUnitId][sourceDataHash];
    }

    // ============================================
    // Revocation (withdrawal of trust)
    // ============================================

    /**
     * @notice Locally revoke an anchor (governance only). Note: revoking the
     *         underlying Digital Seal on-chain already invalidates the anchor
     *         via the live ISeal check in {isAnchored}; this is the local,
     *         claim-scoped control for issues outside the seal's scope.
     */
    function revoke(bytes32 dacUnitId, bytes32 sourceDataHash) external onlyOwner {
        Anchor storage a = _anchors[dacUnitId][sourceDataHash];
        if (!a.exists) revert NoSuchAnchor();
        a.revoked = true;
        emit AnchorRevoked(dacUnitId, sourceDataHash, msg.sender);
    }

    // ============================================
    // Governance
    // ============================================

    /// @notice Set the CEAP policy every backing seal must satisfy.
    function setCompliancePolicy(
        string[] calldata allowedBackends,
        string calldata minVerification,
        string[] calldata allowedPlatforms,
        bool requireVendorRoot,
        string[] calldata dataResidency
    ) external onlyOwner {
        _allowedBackends = allowedBackends;
        _minVerification = minVerification;
        _allowedPlatforms = allowedPlatforms;
        _requireVendorRoot = requireVendorRoot;
        _dataResidency = dataResidency;
        emit CompliancePolicySet(
            allowedBackends, minVerification, allowedPlatforms, requireVendorRoot, dataResidency
        );
    }

    /// @notice Current CEAP policy (for transparency / UIs).
    function compliancePolicy()
        external
        view
        returns (string[] memory, string memory, string[] memory, bool, string[] memory)
    {
        return (_allowedBackends, _minVerification, _allowedPlatforms, _requireVendorRoot, _dataResidency);
    }

    /// @notice Pause anchoring (verification reads stay live).
    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    // ============================================
    // Helpers
    // ============================================

    /**
     * @notice The exact PoUW job purpose a seal must carry to anchor
     *         (dacUnitId, sourceDataHash) — helper for operators and UIs.
     */
    function expectedPurpose(bytes32 dacUnitId, bytes32 sourceDataHash)
        external
        pure
        returns (string memory)
    {
        return string.concat(
            "terraqura:", _toHexBytes32(dacUnitId), ":", _toHexBytes32(sourceDataHash)
        );
    }

    // hex helpers (lowercase — purpose strings are canonical)

    function _toHexBytes32(bytes32 value) private pure returns (string memory) {
        bytes16 alphabet = "0123456789abcdef";
        bytes memory out = new bytes(66);
        out[0] = "0";
        out[1] = "x";
        for (uint256 i = 0; i < 32; i++) {
            out[2 + i * 2] = alphabet[uint8(value[i]) >> 4];
            out[3 + i * 2] = alphabet[uint8(value[i]) & 0x0f];
        }
        return string(out);
    }
}
