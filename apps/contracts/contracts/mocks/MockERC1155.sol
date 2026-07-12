// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "../interfaces/ICarbonCredit.sol";

/**
 * @title MockERC1155
 * @notice Mock ERC1155 token for testing purposes. Implements the
 *         ICarbonCredit surfaces the marketplace and retirement contracts
 *         consume (isCreditActive, retireCreditsFrom, getCreditProvenance,
 *         methodology) so fixtures can exercise both happy and revoked paths.
 */
contract MockERC1155 is ERC1155 {
    /// @notice Per-token inactive flag consumed by isCreditActive (default active).
    mapping(uint256 => bool) public creditInactive;

    /// @notice Per-token capture timestamp for provenance-derived vintages.
    mapping(uint256 => uint256) public captureTimestampOf;

    /// @notice Retirer contracts approved to call retireCreditsFrom.
    mapping(address => bool) public approvedRetirers;

    error UnauthorizedRetirer();
    error RetirerNotApprovedOperator();
    error InvalidRetirementAmount();
    error CreditNotActive(uint256 tokenId);

    constructor() ERC1155("") {}

    function mint(address to, uint256 id, uint256 amount, bytes memory data) external {
        _mint(to, id, amount, data);
        if (captureTimestampOf[id] == 0) {
            captureTimestampOf[id] = block.timestamp;
        }
    }

    function burn(address from, uint256 id, uint256 amount) external {
        _burn(from, id, amount);
    }

    // ============ Test Controls ============

    function setCreditActive(uint256 id, bool active) external {
        creditInactive[id] = !active;
    }

    function setCaptureTimestamp(uint256 id, uint256 timestamp) external {
        captureTimestampOf[id] = timestamp;
    }

    function setApprovedRetirer(address retirer, bool approved) external {
        approvedRetirers[retirer] = approved;
    }

    // ============ ICarbonCredit Surfaces ============

    function isCreditActive(uint256 tokenId) external view returns (bool) {
        return !creditInactive[tokenId];
    }

    function methodology() external pure returns (string memory) {
        return "DAC";
    }

    /**
     * @notice Mirrors CarbonCredit.retireCreditsFrom semantics: approved
     *         retirer + operator approval + nonzero amount + live credit.
     */
    function retireCreditsFrom(
        address account,
        uint256 tokenId,
        uint256 amount,
        string calldata /* reason */
    ) external {
        if (!approvedRetirers[msg.sender]) revert UnauthorizedRetirer();
        if (!isApprovedForAll(account, msg.sender)) revert RetirerNotApprovedOperator();
        if (amount == 0) revert InvalidRetirementAmount();
        if (creditInactive[tokenId]) revert CreditNotActive(tokenId);
        _burn(account, tokenId, amount);
    }

    function getCreditProvenance(uint256 tokenId)
        external
        view
        returns (
            ICarbonCredit.CreditMetadata memory metadata,
            ICarbonCredit.VerificationResult memory verification
        )
    {
        metadata = ICarbonCredit.CreditMetadata({
            dacUnitId: bytes32(tokenId),
            sourceDataHash: keccak256(abi.encode(tokenId)),
            captureTimestamp: captureTimestampOf[tokenId],
            co2AmountKg: 0,
            energyConsumedKwh: 0,
            latitude: 0,
            longitude: 0,
            purityPercentage: 0,
            gridIntensityGCO2PerKwh: 0,
            isRetired: false,
            ipfsMetadataUri: "",
            arweaveBackupTxId: ""
        });
        verification = ICarbonCredit.VerificationResult({
            sourceVerified: true,
            logicVerified: true,
            mintVerified: true,
            efficiencyFactor: 0,
            verifiedAt: 0
        });
    }
}
