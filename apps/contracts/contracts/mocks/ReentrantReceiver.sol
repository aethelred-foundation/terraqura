// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";

interface ICarbonCreditAttack {
    function retireCredits(uint256 tokenId, uint256 amount, string calldata reason) external;

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
    ) external returns (uint256);
}

/**
 * @title ReentrantReceiver
 * @notice Attack fixture proving CarbonCredit's ReentrancyGuard actually
 *         guards: ERC-1155 minting invokes onERC1155Received on contract
 *         recipients, giving this receiver execution control MID-MINT. When
 *         armed, it re-enters the target (retireCredits) from inside the
 *         mint callback — a real cross-function reentrancy attempt that must
 *         revert with "ReentrancyGuard: reentrant call".
 */
contract ReentrantReceiver is IERC1155Receiver {
    // Named `victim` (not `target`) to avoid colliding with ethers v6
    // BaseContract.target in the generated typechain bindings.
    ICarbonCreditAttack public victim;
    bool public armed;

    function arm(address _victim) external {
        victim = ICarbonCreditAttack(_victim);
        armed = true;
    }

    function onERC1155Received(
        address,
        address,
        uint256 id,
        uint256,
        bytes calldata
    ) external returns (bytes4) {
        if (armed) {
            armed = false; // single attempt; avoid infinite loops
            // Cross-function reentrancy: retire mid-mint. Must be rejected by
            // the guard; bubble the revert so the test can assert on it.
            victim.retireCredits(id, 1, "reenter");
        }
        return this.onERC1155Received.selector;
    }

    function onERC1155BatchReceived(
        address,
        address,
        uint256[] calldata,
        uint256[] calldata,
        bytes calldata
    ) external pure returns (bytes4) {
        return this.onERC1155BatchReceived.selector;
    }

    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        return
            interfaceId == type(IERC1155Receiver).interfaceId ||
            interfaceId == 0x01ffc9a7; // ERC165
    }
}
