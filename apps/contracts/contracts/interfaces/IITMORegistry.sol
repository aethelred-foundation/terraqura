// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

/**
 * @title IITMORegistry
 * @notice Interface for the TerraQura ITMO (Internationally Transferred Mitigation Outcomes) Registry
 * @dev Paris Agreement Article 6.2 compliance
 */
interface IITMORegistry {
    enum TransferStatus { Pending, Authorized, Confirmed, Rejected }

    struct Transfer {
        uint256 id;
        uint256 creditId;
        bytes2 fromCountry;
        bytes2 toCountry;
        uint256 amount;
        uint256 vintage;
        TransferStatus status;
        bool correspondingAdjustment;
    }

    struct CountryBalance {
        uint256 totalOriginated;
        uint256 totalTransferredOut;
        uint256 totalTransferredIn;
        int256 netBalance;
    }

    event TransferRegistered(uint256 indexed transferId, uint256 indexed creditId, bytes2 fromCountry, bytes2 toCountry, uint256 amount, uint256 vintage);
    event TransferAuthorized(uint256 indexed transferId, bytes2 indexed fromCountry);
    event TransferConfirmed(uint256 indexed transferId, bytes2 indexed toCountry);
    event TransferRejected(uint256 indexed transferId);

    function registerTransfer(uint256 creditId, bytes2 fromCountry, bytes2 toCountry, uint256 amount, uint256 vintage) external returns (uint256 transferId);
    function authorizeTransfer(uint256 transferId) external;
    function confirmTransfer(uint256 transferId) external;
    function rejectTransfer(uint256 transferId) external;
    function getCountryBalance(bytes2 countryCode) external view returns (CountryBalance memory);
    function getTransferHistory(bytes2 countryCode) external view returns (uint256[] memory);
}
