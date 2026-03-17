// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "../access/TerraQuraAccessControl.sol";
import "../interfaces/IComplianceRegistry.sol";

/**
 * @title ComplianceRegistry
 * @author TerraQura
 * @notice On-chain regulatory compliance tracking for participants and carbon credits.
 * @dev UUPS upgradeable, uses TerraQuraAccessControl for RBAC.
 */
contract ComplianceRegistry is
    Initializable,
    UUPSUpgradeable,
    IComplianceRegistry
{
    // ============ State ============

    TerraQuraAccessControl public accessControl;

    // Jurisdictions
    mapping(bytes2 => Jurisdiction) public jurisdictions;
    bytes2[] public jurisdictionCodes;

    // Entity compliance: entity => jurisdiction => compliance
    mapping(address => mapping(bytes2 => EntityCompliance)) public entityCompliance;

    // Track which jurisdictions an entity has compliance records for
    mapping(address => bytes2[]) private _entityJurisdictions;
    mapping(address => mapping(bytes2 => bool)) private _entityHasJurisdiction;

    // Credit compliance: creditId => jurisdiction => compliance
    mapping(uint256 => mapping(bytes2 => CreditCompliance)) public creditCompliance;

    // Supported standards
    string[] public supportedStandards;

    // ============ Errors ============

    error Unauthorized();
    error JurisdictionAlreadyRegistered();
    error JurisdictionNotRegistered();
    error InvalidCountryCode();
    error InvalidExpiry();

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

        // Register supported standards
        supportedStandards.push("Verra VCS");
        supportedStandards.push("Gold Standard");
        supportedStandards.push("CDM");
        supportedStandards.push("ACR");
        supportedStandards.push("CAR");
        supportedStandards.push("CORSIA");
        supportedStandards.push("EU-ETS");
    }

    // ============ Jurisdiction Management ============

    /**
     * @inheritdoc IComplianceRegistry
     */
    function registerJurisdiction(
        bytes2 countryCode,
        string calldata name,
        bool article6Eligible,
        uint256 taxRate
    ) external override onlyAdmin {
        if (countryCode == bytes2(0)) revert InvalidCountryCode();
        if (jurisdictions[countryCode].active) revert JurisdictionAlreadyRegistered();

        jurisdictions[countryCode] = Jurisdiction({
            countryCode: countryCode,
            name: name,
            article6Eligible: article6Eligible,
            taxRate: taxRate,
            active: true
        });

        jurisdictionCodes.push(countryCode);

        emit JurisdictionRegistered(countryCode, name, article6Eligible, taxRate);
    }

    // ============ Entity Compliance ============

    /**
     * @inheritdoc IComplianceRegistry
     */
    function setEntityCompliance(
        address entity,
        bytes2 jurisdiction,
        ComplianceStatus status,
        uint256 expiryTimestamp
    ) external override onlyCompliance {
        if (!jurisdictions[jurisdiction].active) revert JurisdictionNotRegistered();
        if (status == ComplianceStatus.Compliant && expiryTimestamp <= block.timestamp) {
            revert InvalidExpiry();
        }

        entityCompliance[entity][jurisdiction] = EntityCompliance({
            status: status,
            updatedAt: block.timestamp,
            expiryTimestamp: expiryTimestamp,
            updatedBy: msg.sender
        });

        if (!_entityHasJurisdiction[entity][jurisdiction]) {
            _entityJurisdictions[entity].push(jurisdiction);
            _entityHasJurisdiction[entity][jurisdiction] = true;
        }

        emit ComplianceUpdated(entity, jurisdiction, status, expiryTimestamp, msg.sender);
    }

    // ============ Credit Compliance ============

    /**
     * @inheritdoc IComplianceRegistry
     */
    function setCreditCompliance(
        uint256 creditId,
        bytes2 jurisdiction,
        bool compliant,
        string calldata standard
    ) external override onlyCompliance {
        if (!jurisdictions[jurisdiction].active) revert JurisdictionNotRegistered();

        creditCompliance[creditId][jurisdiction] = CreditCompliance({
            compliant: compliant,
            standard: standard,
            updatedAt: block.timestamp,
            updatedBy: msg.sender
        });

        emit CreditComplianceSet(creditId, jurisdiction, compliant, standard, msg.sender);
    }

    // ============ View Functions ============

    /**
     * @inheritdoc IComplianceRegistry
     */
    function isCompliant(
        address entity,
        bytes2 jurisdiction
    ) external view override returns (bool) {
        EntityCompliance memory ec = entityCompliance[entity][jurisdiction];
        if (ec.status != ComplianceStatus.Compliant) return false;
        if (ec.expiryTimestamp != 0 && ec.expiryTimestamp <= block.timestamp) return false;
        return true;
    }

    /**
     * @inheritdoc IComplianceRegistry
     */
    function isCreditCompliant(
        uint256 creditId,
        bytes2 jurisdiction
    ) external view override returns (bool) {
        return creditCompliance[creditId][jurisdiction].compliant;
    }

    /**
     * @inheritdoc IComplianceRegistry
     */
    function getComplianceReport(
        address entity
    ) external view override returns (ComplianceReport memory report) {
        bytes2[] memory jurs = _entityJurisdictions[entity];
        uint256 len = jurs.length;

        ComplianceStatus[] memory statuses = new ComplianceStatus[](len);
        uint256[] memory expiries = new uint256[](len);

        for (uint256 i = 0; i < len; i++) {
            EntityCompliance memory ec = entityCompliance[entity][jurs[i]];
            statuses[i] = ec.status;
            expiries[i] = ec.expiryTimestamp;
        }

        report = ComplianceReport({
            entity: entity,
            jurisdictions: jurs,
            statuses: statuses,
            expiries: expiries
        });
    }

    function getJurisdiction(bytes2 countryCode) external view returns (Jurisdiction memory) {
        return jurisdictions[countryCode];
    }

    function getJurisdictionCount() external view returns (uint256) {
        return jurisdictionCodes.length;
    }

    function getSupportedStandards() external view returns (string[] memory) {
        return supportedStandards;
    }

    // ============ Upgrade ============

    function _authorizeUpgrade(address) internal override onlyAdmin {}
}
