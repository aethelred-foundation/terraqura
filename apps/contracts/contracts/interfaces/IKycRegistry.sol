// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IKycRegistry
 * @notice Minimal consumer interface for the platform KYC authority
 *         (implemented by TerraQuraAccessControl).
 * @dev Consumers (e.g. CarbonMarketplace) delegate KYC decisions here so the
 *      platform has ONE KYC authority with expiry and sanctions semantics,
 *      instead of duplicated per-contract boolean mappings (audit finding).
 */
interface IKycRegistry {
    /**
     * @notice True iff `account` is KYC-verified, unexpired, and
     *         sanctions-cleared.
     */
    function isKycVerified(address account) external view returns (bool);
}
