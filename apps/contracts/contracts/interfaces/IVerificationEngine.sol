// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IVerificationEngine
 * @notice Interface for the Proof-of-Physics verification engine
 * @dev Implements three-phase verification: Source, Logic, Mint
 *
 * v3.0.0: Net-Negative Verification — adds gridIntensity parameter for
 * energy source carbon accounting. The verify() function now computes
 * net credits using the formula:
 *   Net Credits = (CO2_gross × F_purity) − (Energy_consumed × Grid_Intensity)
 */
interface IVerificationEngine {
    /**
     * @notice Verify carbon capture data before minting
     * @param dacUnitId The DAC facility identifier
     * @param sourceDataHash Hash of the off-chain sensor data
     * @param co2AmountKg Amount of CO2 captured in kilograms
     * @param energyConsumedKwh Energy consumed in kilowatt-hours
     * @param purityPercentage CO2 purity percentage (0-100)
     * @param gridIntensityGCO2PerKwh Grid carbon intensity in gCO2/kWh (e.g., 400 for coal, 50 for solar)
     * @return sourceVerified Whether the source check passed
     * @return logicVerified Whether the logic check passed
     * @return mintVerified Whether the mint check passed
     * @return efficiencyFactor Calculated efficiency factor (scaled by 1e4, legacy compatibility)
     */
    function verify(
        bytes32 dacUnitId,
        bytes32 sourceDataHash,
        uint256 co2AmountKg,
        uint256 energyConsumedKwh,
        uint8 purityPercentage,
        uint256 gridIntensityGCO2PerKwh
    ) external returns (
        bool sourceVerified,
        bool logicVerified,
        bool mintVerified,
        uint256 efficiencyFactor
    );

    /**
     * @notice Check if a DAC unit is whitelisted
     * @param dacUnitId The DAC facility identifier
     * @return Whether the DAC unit is whitelisted
     */
    function isWhitelisted(bytes32 dacUnitId) external view returns (bool);

    /**
     * @notice Get the operator address for a DAC unit
     * @param dacUnitId The DAC facility identifier
     * @return The operator's address
     */
    function getOperator(bytes32 dacUnitId) external view returns (address);

    /**
     * @notice Check if a data hash has already been processed
     * @param sourceDataHash The hash to check
     * @return Whether the hash has been used
     */
    function isHashProcessed(bytes32 sourceDataHash) external view returns (bool);
}
