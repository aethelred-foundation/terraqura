// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "../access/TerraQuraAccessControl.sol";
import "../interfaces/IITMORegistry.sol";

/**
 * @title ITMORegistry
 * @author TerraQura
 * @notice Paris Agreement Article 6.2 compliance for sovereign carbon accounting.
 *         Tracks Internationally Transferred Mitigation Outcomes (ITMOs) with
 *         corresponding adjustment tracking to prevent double counting.
 * @dev UUPS upgradeable, uses TerraQuraAccessControl for RBAC.
 */
contract ITMORegistry is
    Initializable,
    UUPSUpgradeable,
    IITMORegistry
{
    // ============ State ============

    TerraQuraAccessControl public accessControl;

    uint256 private _nextTransferId;

    mapping(uint256 => Transfer) public transfers;

    // Country balances
    mapping(bytes2 => CountryBalance) public countryBalances;

    // Country transfer history
    mapping(bytes2 => uint256[]) private _countryTransfers;

    // Track unique credit+country pairs to prevent double counting
    mapping(uint256 => mapping(bytes2 => mapping(bytes2 => bool))) public transferExists;

    // ============ Errors ============

    error Unauthorized();
    error InvalidCountryCode();
    error SameCountry();
    error InvalidAmount();
    error TransferNotPending();
    error TransferNotAuthorized();
    error TransferAlreadyExists();
    error TransferAlreadyProcessed();

    // ============ Modifiers ============

    modifier onlyCompliance() {
        if (!accessControl.hasRole(accessControl.COMPLIANCE_ROLE(), msg.sender) &&
            !accessControl.hasRole(accessControl.ADMIN_ROLE(), msg.sender)) {
            revert Unauthorized();
        }
        _;
    }

    modifier onlyAdmin() {
        if (!accessControl.hasRole(accessControl.ADMIN_ROLE(), msg.sender)) revert Unauthorized();
        _;
    }

    // ============ Initializer ============

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address _accessControl) public initializer {
        __UUPSUpgradeable_init();
        accessControl = TerraQuraAccessControl(_accessControl);
        _nextTransferId = 1;
    }

    // ============ Transfer Management ============

    /**
     * @inheritdoc IITMORegistry
     */
    function registerTransfer(
        uint256 creditId,
        bytes2 fromCountry,
        bytes2 toCountry,
        uint256 amount,
        uint256 vintage
    ) external override onlyCompliance returns (uint256 transferId) {
        if (fromCountry == bytes2(0) || toCountry == bytes2(0)) revert InvalidCountryCode();
        if (fromCountry == toCountry) revert SameCountry();
        if (amount == 0) revert InvalidAmount();

        // Prevent double counting: same credit, same from/to pair
        if (transferExists[creditId][fromCountry][toCountry]) revert TransferAlreadyExists();

        transferId = _nextTransferId++;

        transfers[transferId] = Transfer({
            id: transferId,
            creditId: creditId,
            fromCountry: fromCountry,
            toCountry: toCountry,
            amount: amount,
            vintage: vintage,
            status: TransferStatus.Pending,
            correspondingAdjustment: false
        });

        transferExists[creditId][fromCountry][toCountry] = true;

        _countryTransfers[fromCountry].push(transferId);
        _countryTransfers[toCountry].push(transferId);

        emit TransferRegistered(transferId, creditId, fromCountry, toCountry, amount, vintage);
    }

    /**
     * @inheritdoc IITMORegistry
     * @dev Origin country authorizes and applies corresponding adjustment
     */
    function authorizeTransfer(uint256 transferId) external override onlyCompliance {
        Transfer storage t = transfers[transferId];
        if (t.status != TransferStatus.Pending) revert TransferNotPending();

        t.status = TransferStatus.Authorized;
        t.correspondingAdjustment = true;

        // Apply corresponding adjustment to origin country
        countryBalances[t.fromCountry].totalTransferredOut += t.amount;
        countryBalances[t.fromCountry].netBalance -= int256(t.amount);

        emit TransferAuthorized(transferId, t.fromCountry);
    }

    /**
     * @inheritdoc IITMORegistry
     * @dev Destination country confirms receipt
     */
    function confirmTransfer(uint256 transferId) external override onlyCompliance {
        Transfer storage t = transfers[transferId];
        if (t.status != TransferStatus.Authorized) revert TransferNotAuthorized();

        t.status = TransferStatus.Confirmed;

        // Credit destination country
        countryBalances[t.toCountry].totalTransferredIn += t.amount;
        countryBalances[t.toCountry].netBalance += int256(t.amount);

        emit TransferConfirmed(transferId, t.toCountry);
    }

    /**
     * @inheritdoc IITMORegistry
     */
    function rejectTransfer(uint256 transferId) external override onlyCompliance {
        Transfer storage t = transfers[transferId];
        if (t.status == TransferStatus.Confirmed || t.status == TransferStatus.Rejected) {
            revert TransferAlreadyProcessed();
        }

        // If it was authorized, reverse the corresponding adjustment
        if (t.status == TransferStatus.Authorized) {
            countryBalances[t.fromCountry].totalTransferredOut -= t.amount;
            countryBalances[t.fromCountry].netBalance += int256(t.amount);
            t.correspondingAdjustment = false;
        }

        t.status = TransferStatus.Rejected;

        // Allow re-registration of this credit+country pair
        transferExists[t.creditId][t.fromCountry][t.toCountry] = false;

        emit TransferRejected(transferId);
    }

    // ============ Country Origination ============

    /**
     * @notice Register carbon credits originated in a country
     * @param countryCode The country that originated the credits
     * @param amount Amount of credits originated
     */
    function registerOrigination(
        bytes2 countryCode,
        uint256 amount
    ) external onlyCompliance {
        if (countryCode == bytes2(0)) revert InvalidCountryCode();
        if (amount == 0) revert InvalidAmount();

        countryBalances[countryCode].totalOriginated += amount;
        countryBalances[countryCode].netBalance += int256(amount);
    }

    // ============ View Functions ============

    /**
     * @inheritdoc IITMORegistry
     */
    function getCountryBalance(
        bytes2 countryCode
    ) external view override returns (CountryBalance memory) {
        return countryBalances[countryCode];
    }

    /**
     * @inheritdoc IITMORegistry
     */
    function getTransferHistory(
        bytes2 countryCode
    ) external view override returns (uint256[] memory) {
        return _countryTransfers[countryCode];
    }

    function getTransfer(uint256 transferId) external view returns (Transfer memory) {
        return transfers[transferId];
    }

    // ============ Upgrade ============

    function _authorizeUpgrade(address) internal override onlyAdmin {}
}
