// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.28;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC1155/utils/ERC1155HolderUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC1155/IERC1155Upgradeable.sol";
import "../interfaces/ICarbonRetirement.sol";
import "../interfaces/IRetirementCertificate.sol";

/**
 * @title CarbonRetirement
 * @author TerraQura
 * @notice Permanent carbon credit retirement manager with full audit trail
 * @dev Uses UUPS proxy pattern for upgradeability. Burns ERC-1155 carbon credits
 *      from the CarbonCredit contract and creates immutable retirement records.
 *      Optionally mints ERC-721 retirement certificate NFTs.
 */
contract CarbonRetirement is
    Initializable,
    OwnableUpgradeable,
    PausableUpgradeable,
    ReentrancyGuardUpgradeable,
    UUPSUpgradeable,
    ERC1155HolderUpgradeable,
    ICarbonRetirement
{
    // ============ State Variables ============

    /// @notice Reference to the CarbonCredit ERC-1155 contract
    IERC1155Upgradeable public carbonCredit;

    /// @notice Reference to the RetirementCertificate ERC-721 contract
    IRetirementCertificate public certificate;

    /// @notice Whether certificate minting is enabled
    bool public certificateMintingEnabled;

    /// @notice Auto-incrementing retirement ID counter
    uint256 private _nextRetirementId;

    /// @notice Total credits retired across all credit types
    uint256 private _totalRetired;

    /// @notice Mapping of retirement ID to retirement record
    mapping(uint256 => RetirementRecord) private _retirements;

    /// @notice Mapping of beneficiary name hash to retirement IDs
    mapping(bytes32 => uint256[]) private _beneficiaryRetirements;

    /// @notice Mapping of retiree address to retirement IDs
    mapping(address => uint256[]) private _retireeRetirements;

    /// @notice Mapping of credit ID to total retired amount
    mapping(uint256 => uint256) private _retiredByCredit;

    /// @notice Contract version for upgrade tracking
    string public constant VERSION = "1.0.0";

    // ============ Errors ============

    error ZeroAmount();
    error ArrayLengthMismatch();
    error EmptyBeneficiary();
    error InvalidCarbonCreditAddress();
    error InvalidCertificateAddress();
    error BatchTooLarge();

    // ============ Initialization ============

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Initialize the contract
     * @param _carbonCredit Address of the CarbonCredit ERC-1155 contract
     * @param _owner Address of the contract owner
     */
    function initialize(
        address _carbonCredit,
        address _owner
    ) public initializer {
        if (_carbonCredit == address(0)) revert InvalidCarbonCreditAddress();

        __Ownable_init();
        if (_owner != msg.sender) {
            _transferOwnership(_owner);
        }
        __Pausable_init();
        __ReentrancyGuard_init();
        __UUPSUpgradeable_init();
        __ERC1155Holder_init();

        carbonCredit = IERC1155Upgradeable(_carbonCredit);
        _nextRetirementId = 1;
    }

    // ============ External Functions ============

    /**
     * @inheritdoc ICarbonRetirement
     */
    function retire(
        uint256 creditId,
        uint256 amount,
        string calldata beneficiary,
        string calldata reason
    ) external override whenNotPaused nonReentrant returns (uint256 retirementId) {
        if (amount == 0) revert ZeroAmount();
        if (bytes(beneficiary).length == 0) revert EmptyBeneficiary();

        retirementId = _executeRetirement(creditId, amount, beneficiary, reason);
    }

    /**
     * @inheritdoc ICarbonRetirement
     */
    function retireBatch(
        uint256[] calldata creditIds,
        uint256[] calldata amounts,
        string calldata beneficiary,
        string calldata reason
    ) external override whenNotPaused nonReentrant returns (uint256[] memory retirementIds) {
        uint256 len = creditIds.length;
        if (len != amounts.length) revert ArrayLengthMismatch();
        if (len == 0 || len > 100) revert BatchTooLarge();
        if (bytes(beneficiary).length == 0) revert EmptyBeneficiary();

        retirementIds = new uint256[](len);
        for (uint256 i = 0; i < len; ) {
            if (amounts[i] == 0) revert ZeroAmount();
            retirementIds[i] = _executeRetirement(creditIds[i], amounts[i], beneficiary, reason);
            unchecked { ++i; }
        }
    }

    /**
     * @inheritdoc ICarbonRetirement
     */
    function getRetirement(uint256 retirementId) external view override returns (RetirementRecord memory) {
        return _retirements[retirementId];
    }

    /**
     * @inheritdoc ICarbonRetirement
     */
    function getRetirementsByBeneficiary(string calldata beneficiary) external view override returns (uint256[] memory) {
        bytes32 key = keccak256(abi.encodePacked(beneficiary));
        return _beneficiaryRetirements[key];
    }

    /**
     * @inheritdoc ICarbonRetirement
     */
    function getRetirementsByRetiree(address retiree) external view override returns (uint256[] memory) {
        return _retireeRetirements[retiree];
    }

    /**
     * @inheritdoc ICarbonRetirement
     */
    function totalRetired() external view override returns (uint256) {
        return _totalRetired;
    }

    /**
     * @inheritdoc ICarbonRetirement
     */
    function totalRetiredByCredit(uint256 creditId) external view override returns (uint256) {
        return _retiredByCredit[creditId];
    }

    // ============ Admin Functions ============

    /**
     * @notice Set the RetirementCertificate contract address
     * @param _certificate Address of the RetirementCertificate contract
     */
    function setCertificateContract(address _certificate) external onlyOwner {
        if (_certificate == address(0)) revert InvalidCertificateAddress();
        certificate = IRetirementCertificate(_certificate);
        certificateMintingEnabled = true;
    }

    /**
     * @notice Enable or disable certificate minting
     * @param enabled Whether certificate minting should be enabled
     */
    function setCertificateMintingEnabled(bool enabled) external onlyOwner {
        certificateMintingEnabled = enabled;
    }

    /**
     * @notice Pause the contract
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @notice Unpause the contract
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    // ============ Internal Functions ============

    /**
     * @notice Execute a single retirement
     * @param creditId The credit token ID
     * @param amount Amount to retire
     * @param beneficiary Beneficiary name
     * @param reason Retirement reason
     * @return retirementId The created retirement record ID
     */
    function _executeRetirement(
        uint256 creditId,
        uint256 amount,
        string calldata beneficiary,
        string calldata reason
    ) internal returns (uint256 retirementId) {
        // Transfer credits from sender to this contract, then burn is implicit
        // (we hold the credits as "retired" — the credits are effectively removed from circulation)
        carbonCredit.safeTransferFrom(msg.sender, address(this), creditId, amount, "");

        retirementId = _nextRetirementId++;

        // Mint certificate if enabled
        uint256 certificateId = 0;
        if (certificateMintingEnabled && address(certificate) != address(0)) {
            IRetirementCertificate.CertificateData memory certData = IRetirementCertificate.CertificateData({
                retirementId: retirementId,
                creditId: creditId,
                amount: amount,
                beneficiary: beneficiary,
                reason: reason,
                timestamp: block.timestamp,
                methodology: "DAC",
                vintage: ""
            });
            certificateId = certificate.mint(msg.sender, retirementId, certData);
        }

        // Create retirement record
        _retirements[retirementId] = RetirementRecord({
            id: retirementId,
            creditId: creditId,
            amount: amount,
            retiree: msg.sender,
            beneficiary: beneficiary,
            reason: reason,
            timestamp: block.timestamp,
            certificateId: certificateId
        });

        // Update indexes
        bytes32 beneficiaryKey = keccak256(abi.encodePacked(beneficiary));
        _beneficiaryRetirements[beneficiaryKey].push(retirementId);
        _retireeRetirements[msg.sender].push(retirementId);

        // Update counters
        _totalRetired += amount;
        _retiredByCredit[creditId] += amount;

        emit CreditRetired(retirementId, creditId, msg.sender, amount, beneficiary);
    }

    /**
     * @notice Authorize upgrade (UUPS pattern)
     * @param newImplementation Address of new implementation
     */
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
