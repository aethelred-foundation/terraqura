// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title ICarbonCredit
 * @notice Interface for the TerraQura Carbon Credit NFT
 *
 * v3.0.0: Net-Negative Verification — adds gridIntensity to CreditMetadata
 * and mintVerifiedCredits signature for energy source carbon accounting.
 */
interface ICarbonCredit {
    /**
     * @notice Credit metadata structure
     */
    struct CreditMetadata {
        bytes32 dacUnitId;          // Whitelisted DAC facility ID
        bytes32 sourceDataHash;     // Hash of off-chain sensor data
        uint256 captureTimestamp;   // When CO2 was captured
        uint256 co2AmountKg;        // Amount of CO2 in kilograms
        uint256 energyConsumedKwh;  // Energy used for capture
        int256 latitude;            // GPS latitude (scaled by 1e6)
        int256 longitude;           // GPS longitude (scaled by 1e6)
        uint8 purityPercentage;     // CO2 purity (0-100)
        uint256 gridIntensityGCO2PerKwh; // Grid carbon intensity (gCO2/kWh)
        bool isRetired;             // Has credit been used for offset
        string ipfsMetadataUri;     // IPFS CID for full metadata
        string arweaveBackupTxId;   // Arweave transaction ID
    }

    /**
     * @notice Verification result structure
     */
    struct VerificationResult {
        bool sourceVerified;        // DAC unit is whitelisted
        bool logicVerified;         // Energy/CO2 ratio is valid
        bool mintVerified;          // No duplicate, hash matches
        uint256 efficiencyFactor;   // Calculated efficiency (scaled by 1e4)
        uint256 verifiedAt;         // Timestamp of verification
    }

    /**
     * @notice Emitted when credits are minted
     */
    event CreditMinted(
        uint256 indexed tokenId,
        bytes32 indexed dacUnitId,
        address indexed operator,
        uint256 co2AmountKg,
        bytes32 sourceDataHash
    );

    /**
     * @notice Emitted when credits are retired
     */
    event CreditRetired(
        uint256 indexed tokenId,
        address indexed retiredBy,
        uint256 amount,
        string retirementReason
    );

    /**
     * @notice Emitted when verification is completed
     */
    event VerificationCompleted(
        uint256 indexed tokenId,
        bool sourceVerified,
        bool logicVerified,
        bool mintVerified,
        uint256 efficiencyFactor
    );

    /**
     * @notice Mint verified carbon credits
     * @param gridIntensityGCO2PerKwh Grid carbon intensity in gCO2/kWh (e.g., 400 for coal, 50 for solar)
     */
    function mintVerifiedCredits(
        address to,
        bytes32 dacUnitId,
        bytes32 sourceDataHash,
        uint256 captureTimestamp,
        uint256 co2AmountKg,
        uint256 energyConsumedKwh,
        int256 latitude,
        int256 longitude,
        uint8 purityPercentage,
        uint256 gridIntensityGCO2PerKwh,
        string calldata ipfsMetadataUri,
        string calldata arweaveBackupTxId
    ) external returns (uint256 tokenId);

    /**
     * @notice Retire carbon credits
     */
    function retireCredits(
        uint256 tokenId,
        uint256 amount,
        string calldata reason
    ) external;

    /**
     * @notice Get credit provenance
     */
    function getCreditProvenance(uint256 tokenId) external view returns (
        CreditMetadata memory metadata,
        VerificationResult memory verification
    );

    /**
     * @notice Get total credits minted
     */
    function totalCreditsMinted() external view returns (uint256);

    /**
     * @notice Get total credits retired
     */
    function totalCreditsRetired() external view returns (uint256);
}
