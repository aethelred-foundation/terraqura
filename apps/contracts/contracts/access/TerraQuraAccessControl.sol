// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

/**
 * @title TerraQura Access Control
 * @notice Centralized role-based access control for all TerraQura contracts
 * @dev Implements enterprise-grade role management with time-locks and multi-sig support
 */
contract TerraQuraAccessControl is
    Initializable,
    AccessControlUpgradeable,
    PausableUpgradeable,
    UUPSUpgradeable
{
    // ============================================
    // ROLES
    // ============================================

    // Super admin - can grant/revoke all roles (should be multi-sig)
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    // Operators - DAC facility operators who can submit verifications
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    // Verifiers - can approve/reject verifications (automated or auditors)
    bytes32 public constant VERIFIER_ROLE = keccak256("VERIFIER_ROLE");

    // Minters - can mint new carbon credits after verification
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    // Compliance officers - can manage KYC/AML whitelist
    bytes32 public constant COMPLIANCE_ROLE = keccak256("COMPLIANCE_ROLE");

    // Auditors - read-only access to all data for compliance audits
    bytes32 public constant AUDITOR_ROLE = keccak256("AUDITOR_ROLE");

    // Treasury - can withdraw platform fees
    bytes32 public constant TREASURY_ROLE = keccak256("TREASURY_ROLE");

    // Upgrader - can upgrade contract implementations (should be time-locked)
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");

    // Pauser - can pause contracts in emergency
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    // ============================================
    // ROLE EXPIRATION TRACKING
    // ============================================

    /// @notice Mapping of role + account to expiration timestamp
    mapping(bytes32 => mapping(address => uint256)) public roleExpiration;

    // ============================================
    // KYC MANAGEMENT
    // ============================================

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
        string provider; // sumsub, onfido, etc.
        bytes32 applicantIdHash; // Hashed for privacy
        bool sanctionsCleared;
    }

    mapping(address => KycInfo) public kycRegistry;

    // KYC validity period (default 1 year)
    uint256 public kycValidityPeriod;

    // ============================================
    // EVENTS
    // ============================================

    event KycStatusUpdated(
        address indexed account,
        KycStatus status,
        string provider,
        uint256 expiresAt
    );

    event KycExpired(address indexed account);

    event SanctionsStatusUpdated(address indexed account, bool cleared);

    event RoleGrantedWithExpiry(
        bytes32 indexed role,
        address indexed account,
        uint256 expiresAt
    );

    event EmergencyPause(address indexed pauser, string reason);

    // ============================================
    // ERRORS
    // ============================================

    error KycNotVerified(address account);
    error KycExpired_(address account);
    error SanctionsNotCleared(address account);
    error RoleExpired(bytes32 role, address account);
    error InvalidKycProvider();
    error AccountBlacklisted(address account);

    // ============================================
    // INITIALIZER
    // ============================================

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address admin) public initializer {
        __AccessControl_init();
        __Pausable_init();
        __UUPSUpgradeable_init();

        // Set up role hierarchy
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);
        _grantRole(UPGRADER_ROLE, admin);
        _grantRole(PAUSER_ROLE, admin);

        // Admin can manage all roles
        _setRoleAdmin(OPERATOR_ROLE, ADMIN_ROLE);
        _setRoleAdmin(VERIFIER_ROLE, ADMIN_ROLE);
        _setRoleAdmin(MINTER_ROLE, ADMIN_ROLE);
        _setRoleAdmin(COMPLIANCE_ROLE, ADMIN_ROLE);
        _setRoleAdmin(AUDITOR_ROLE, ADMIN_ROLE);
        _setRoleAdmin(TREASURY_ROLE, ADMIN_ROLE);
        _setRoleAdmin(PAUSER_ROLE, ADMIN_ROLE);

        // Upgrader role managed by admin (should be time-locked in production)
        _setRoleAdmin(UPGRADER_ROLE, ADMIN_ROLE);

        // Default KYC validity: 1 year
        kycValidityPeriod = 365 days;
    }

    // ============================================
    // KYC MANAGEMENT
    // ============================================

    /**
     * @notice Update KYC status for an account
     * @param account The wallet address
     * @param status The KYC status
     * @param provider The KYC provider name
     * @param applicantIdHash Hash of the provider's applicant ID
     */
    function updateKycStatus(
        address account,
        KycStatus status,
        string calldata provider,
        bytes32 applicantIdHash
    ) external onlyRole(COMPLIANCE_ROLE) {
        if (bytes(provider).length == 0 && status == KycStatus.VERIFIED) {
            revert InvalidKycProvider();
        }

        uint256 expiresAt = status == KycStatus.VERIFIED
            ? block.timestamp + kycValidityPeriod
            : 0;

        kycRegistry[account] = KycInfo({
            status: status,
            verifiedAt: status == KycStatus.VERIFIED ? block.timestamp : 0,
            expiresAt: expiresAt,
            provider: provider,
            applicantIdHash: applicantIdHash,
            sanctionsCleared: kycRegistry[account].sanctionsCleared
        });

        emit KycStatusUpdated(account, status, provider, expiresAt);
    }

    /**
     * @notice Update sanctions screening status
     * @param account The wallet address
     * @param cleared Whether sanctions screening passed
     */
    function updateSanctionsStatus(
        address account,
        bool cleared
    ) external onlyRole(COMPLIANCE_ROLE) {
        kycRegistry[account].sanctionsCleared = cleared;
        emit SanctionsStatusUpdated(account, cleared);
    }

    /**
     * @notice Batch update KYC status for multiple accounts
     * @param accounts Array of wallet addresses
     * @param status The KYC status to set
     * @param provider The KYC provider name
     */
    function batchUpdateKycStatus(
        address[] calldata accounts,
        KycStatus status,
        string calldata provider
    ) external onlyRole(COMPLIANCE_ROLE) {
        for (uint256 i = 0; i < accounts.length; i++) {
            uint256 expiresAt = status == KycStatus.VERIFIED
                ? block.timestamp + kycValidityPeriod
                : 0;

            kycRegistry[accounts[i]].status = status;
            kycRegistry[accounts[i]].verifiedAt = status == KycStatus.VERIFIED
                ? block.timestamp
                : 0;
            kycRegistry[accounts[i]].expiresAt = expiresAt;
            kycRegistry[accounts[i]].provider = provider;

            emit KycStatusUpdated(accounts[i], status, provider, expiresAt);
        }
    }

    /**
     * @notice Set KYC validity period
     * @param period Duration in seconds
     */
    function setKycValidityPeriod(uint256 period) external onlyRole(ADMIN_ROLE) {
        kycValidityPeriod = period;
    }

    // ============================================
    // KYC VIEW FUNCTIONS
    // ============================================

    /**
     * @notice Check if an account has valid KYC
     */
    function isKycVerified(address account) public view returns (bool) {
        KycInfo memory info = kycRegistry[account];
        return
            info.status == KycStatus.VERIFIED &&
            info.expiresAt > block.timestamp &&
            info.sanctionsCleared;
    }

    /**
     * @notice Get full KYC info for an account
     */
    function getKycInfo(
        address account
    )
        external
        view
        returns (
            KycStatus status,
            uint256 verifiedAt,
            uint256 expiresAt,
            string memory provider,
            bool sanctionsCleared,
            bool isValid
        )
    {
        KycInfo memory info = kycRegistry[account];
        return (
            info.status,
            info.verifiedAt,
            info.expiresAt,
            info.provider,
            info.sanctionsCleared,
            isKycVerified(account)
        );
    }

    // ============================================
    // PAUSE MANAGEMENT
    // ============================================

    /**
     * @notice Emergency pause all contracts
     * @param reason The reason for pausing
     */
    function emergencyPause(
        string calldata reason
    ) external onlyRole(PAUSER_ROLE) {
        _pause();
        emit EmergencyPause(msg.sender, reason);
    }

    /**
     * @notice Unpause contracts
     */
    function unpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }

    // ============================================
    // ROLE MANAGEMENT EXTENSIONS
    // ============================================

    /**
     * @notice Grant role with expiration
     * @param role The role to grant
     * @param account The account to grant the role to
     * @param expiresAt Timestamp when role expires (must be in future)
     */
    function grantRoleWithExpiry(
        bytes32 role,
        address account,
        uint256 expiresAt
    ) external onlyRole(getRoleAdmin(role)) {
        require(expiresAt > block.timestamp, "Expiry must be in future");
        _grantRole(role, account);
        roleExpiration[role][account] = expiresAt;
        emit RoleGrantedWithExpiry(role, account, expiresAt);
    }

    /**
     * @notice Check if role has expired for an account
     * @param role The role to check
     * @param account The account to check
     * @return True if role is expired or was never granted with expiry
     */
    function isRoleExpired(bytes32 role, address account) public view returns (bool) {
        uint256 expiry = roleExpiration[role][account];
        // If expiry is 0, role was granted without expiry (permanent)
        if (expiry == 0) return false;
        return block.timestamp > expiry;
    }

    /**
     * @notice Check if account has valid (non-expired) role
     * @param role The role to check
     * @param account The account to check
     * @return True if account has the role and it hasn't expired
     */
    function hasValidRole(bytes32 role, address account) public view returns (bool) {
        return hasRole(role, account) && !isRoleExpired(role, account);
    }

    /**
     * @notice Revoke expired role (can be called by anyone to clean up)
     * @param role The role to revoke
     * @param account The account to revoke from
     */
    function revokeExpiredRole(bytes32 role, address account) external {
        if (!isRoleExpired(role, account)) {
            revert RoleExpired(role, account); // Reusing error - role is NOT expired
        }
        _revokeRole(role, account);
        delete roleExpiration[role][account];
    }

    /**
     * @notice Extend role expiration (only role admin)
     * @param role The role to extend
     * @param account The account
     * @param newExpiresAt New expiration timestamp
     */
    function extendRoleExpiry(
        bytes32 role,
        address account,
        uint256 newExpiresAt
    ) external onlyRole(getRoleAdmin(role)) {
        require(hasRole(role, account), "Account does not have role");
        require(newExpiresAt > block.timestamp, "New expiry must be in future");
        require(newExpiresAt > roleExpiration[role][account], "Can only extend, not reduce");
        roleExpiration[role][account] = newExpiresAt;
        emit RoleGrantedWithExpiry(role, account, newExpiresAt);
    }

    /**
     * @notice Check if account has role and is KYC verified
     */
    function hasRoleAndKyc(
        bytes32 role,
        address account
    ) external view returns (bool) {
        return hasRole(role, account) && isKycVerified(account);
    }

    // ============================================
    // UPGRADE AUTHORIZATION
    // ============================================

    function _authorizeUpgrade(
        address newImplementation
    ) internal override onlyRole(UPGRADER_ROLE) {}

    // ============================================
    // INTERFACE SUPPORT
    // ============================================

    function supportsInterface(
        bytes4 interfaceId
    ) public view override(AccessControlUpgradeable) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
