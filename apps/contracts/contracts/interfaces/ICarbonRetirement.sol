// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.28;

/**
 * @title ICarbonRetirement
 * @notice Interface for the TerraQura Carbon Retirement Manager
 * @dev Manages permanent carbon credit retirement with full audit trail
 */
interface ICarbonRetirement {
    /**
     * @notice Retirement record structure
     */
    struct RetirementRecord {
        uint256 id;
        uint256 creditId;
        uint256 amount;
        address retiree;
        string beneficiary;
        string reason;
        uint256 timestamp;
        uint256 certificateId;
    }

    /**
     * @notice Emitted when carbon credits are permanently retired
     */
    event CreditRetired(
        uint256 indexed retirementId,
        uint256 indexed creditId,
        address indexed retiree,
        uint256 amount,
        string beneficiary
    );

    /**
     * @notice Retire carbon credits permanently
     * @param creditId The ERC-1155 token ID of the carbon credit
     * @param amount Number of credits to retire
     * @param beneficiary Entity on whose behalf the retirement is made
     * @param reason Reason for retirement
     * @return retirementId The unique retirement record ID
     */
    function retire(
        uint256 creditId,
        uint256 amount,
        string calldata beneficiary,
        string calldata reason
    ) external returns (uint256 retirementId);

    /**
     * @notice Retire multiple carbon credits in a single transaction
     * @param creditIds Array of ERC-1155 token IDs
     * @param amounts Array of amounts to retire
     * @param beneficiary Entity on whose behalf the retirement is made
     * @param reason Reason for retirement
     * @return retirementIds Array of retirement record IDs
     */
    function retireBatch(
        uint256[] calldata creditIds,
        uint256[] calldata amounts,
        string calldata beneficiary,
        string calldata reason
    ) external returns (uint256[] memory retirementIds);

    /**
     * @notice Get a retirement record by ID
     * @param retirementId The retirement record ID
     * @return record The retirement record
     */
    function getRetirement(uint256 retirementId) external view returns (RetirementRecord memory record);

    /**
     * @notice Get all retirement IDs for a beneficiary
     * @param beneficiary The beneficiary name
     * @return retirementIds Array of retirement record IDs
     */
    function getRetirementsByBeneficiary(string calldata beneficiary) external view returns (uint256[] memory);

    /**
     * @notice Get all retirement IDs for a retiree address
     * @param retiree The retiree address
     * @return retirementIds Array of retirement record IDs
     */
    function getRetirementsByRetiree(address retiree) external view returns (uint256[] memory);

    /**
     * @notice Get total number of credits retired globally
     * @return Total retired credit count
     */
    function totalRetired() external view returns (uint256);

    /**
     * @notice Get total credits retired for a specific credit type
     * @param creditId The ERC-1155 token ID
     * @return Total retired for that credit
     */
    function totalRetiredByCredit(uint256 creditId) external view returns (uint256);
}
