// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title ModifierTestContract
 * @notice Test contract that uses AccessControl modifiers directly
 * @dev For testing the onlyKycVerified and onlySanctionsCleared modifiers
 */
contract ModifierTestContract {
    // Simplified KYC registry matching AccessControl
    enum KycStatus {
        NONE,
        PENDING,
        VERIFIED,
        REJECTED,
        EXPIRED
    }

    struct KycInfo {
        KycStatus status;
        uint256 verifiedAt;
        uint256 expiresAt;
        string provider;
        bytes32 applicantIdHash;
        bool sanctionsCleared;
    }

    mapping(address => KycInfo) public kycRegistry;

    // Errors
    error KycNotVerified(address account);
    error SanctionsNotCleared(address account);

    // Modifiers matching TerraQuraAccessControl
    modifier onlyKycVerified(address account) {
        if (!isKycVerified(account)) {
            revert KycNotVerified(account);
        }
        _;
    }

    modifier onlySanctionsCleared(address account) {
        if (!kycRegistry[account].sanctionsCleared) {
            revert SanctionsNotCleared(account);
        }
        _;
    }

    // Check if KYC is verified
    function isKycVerified(address account) public view returns (bool) {
        KycInfo memory info = kycRegistry[account];
        return
            info.status == KycStatus.VERIFIED &&
            info.expiresAt > block.timestamp &&
            info.sanctionsCleared;
    }

    // Set up test account
    function setupVerifiedAccount(address account) external {
        kycRegistry[account] = KycInfo({
            status: KycStatus.VERIFIED,
            verifiedAt: block.timestamp,
            expiresAt: block.timestamp + 365 days,
            provider: "test",
            applicantIdHash: keccak256("test"),
            sanctionsCleared: true
        });
    }

    function setupUnverifiedAccount(address account) external {
        kycRegistry[account] = KycInfo({
            status: KycStatus.NONE,
            verifiedAt: 0,
            expiresAt: 0,
            provider: "",
            applicantIdHash: bytes32(0),
            sanctionsCleared: false
        });
    }

    function setupAccountWithoutSanctions(address account) external {
        kycRegistry[account] = KycInfo({
            status: KycStatus.VERIFIED,
            verifiedAt: block.timestamp,
            expiresAt: block.timestamp + 365 days,
            provider: "test",
            applicantIdHash: keccak256("test"),
            sanctionsCleared: false // Sanctions NOT cleared
        });
    }

    function setSanctionsCleared(address account, bool cleared) external {
        kycRegistry[account].sanctionsCleared = cleared;
    }

    // Test functions using the modifiers
    function protectedByKyc(address account) external view onlyKycVerified(account) returns (bool) {
        return true;
    }

    function protectedBySanctions(address account) external view onlySanctionsCleared(account) returns (bool) {
        return true;
    }

    function protectedByBoth(address account) external view onlyKycVerified(account) onlySanctionsCleared(account) returns (bool) {
        return true;
    }
}
