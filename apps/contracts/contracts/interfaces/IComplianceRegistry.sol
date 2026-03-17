// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

/**
 * @title IComplianceRegistry
 * @notice Interface for the TerraQura Compliance Registry
 */
interface IComplianceRegistry {
    enum ComplianceStatus { Pending, Compliant, NonCompliant, Suspended, Expired }

    struct Jurisdiction {
        bytes2 countryCode;
        string name;
        bool article6Eligible;
        uint256 taxRate;
        bool active;
    }

    struct EntityCompliance {
        ComplianceStatus status;
        uint256 updatedAt;
        uint256 expiryTimestamp;
        address updatedBy;
    }

    struct CreditCompliance {
        bool compliant;
        string standard;
        uint256 updatedAt;
        address updatedBy;
    }

    struct ComplianceReport {
        address entity;
        bytes2[] jurisdictions;
        ComplianceStatus[] statuses;
        uint256[] expiries;
    }

    event JurisdictionRegistered(bytes2 indexed countryCode, string name, bool article6Eligible, uint256 taxRate);
    event ComplianceUpdated(address indexed entity, bytes2 indexed jurisdiction, ComplianceStatus status, uint256 expiryTimestamp, address updatedBy);
    event CreditComplianceSet(uint256 indexed creditId, bytes2 indexed jurisdiction, bool compliant, string standard, address updatedBy);
    event ComplianceExpired(address indexed entity, bytes2 indexed jurisdiction);

    function registerJurisdiction(bytes2 countryCode, string calldata name, bool article6Eligible, uint256 taxRate) external;
    function setEntityCompliance(address entity, bytes2 jurisdiction, ComplianceStatus status, uint256 expiryTimestamp) external;
    function setCreditCompliance(uint256 creditId, bytes2 jurisdiction, bool compliant, string calldata standard) external;
    function isCompliant(address entity, bytes2 jurisdiction) external view returns (bool);
    function isCreditCompliant(uint256 creditId, bytes2 jurisdiction) external view returns (bool);
    function getComplianceReport(address entity) external view returns (ComplianceReport memory);
}
