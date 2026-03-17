// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";

/**
 * @title MintRejector
 * @notice A "saboteur" contract that rejects all ERC1155 token transfers
 * @dev Used for fault injection testing to hit the mint failure path
 *      in CarbonCredit when verification passes but minting fails.
 *
 * AUDIT NOTE: This contract is ONLY used for testing and should NEVER
 * be deployed to production. It exists solely to achieve 100% code coverage
 * on the token minting failure paths.
 */
contract MintRejector is IERC1155Receiver {
    /**
     * @notice Reject single token transfers
     * @dev Always reverts to simulate a broken receiver
     */
    function onERC1155Received(
        address,
        address,
        uint256,
        uint256,
        bytes memory
    ) public pure override returns (bytes4) {
        revert("MintRejector: I reject this mint");
    }

    /**
     * @notice Reject batch token transfers
     * @dev Always reverts to simulate a broken receiver
     */
    function onERC1155BatchReceived(
        address,
        address,
        uint256[] memory,
        uint256[] memory,
        bytes memory
    ) public pure override returns (bytes4) {
        revert("MintRejector: I reject batch mints");
    }

    /**
     * @notice Indicate that we "support" the interface (but will revert anyway)
     * @dev Returns true so the safeMint call attempts the transfer
     */
    function supportsInterface(bytes4 interfaceId) public pure override returns (bool) {
        return interfaceId == type(IERC1155Receiver).interfaceId;
    }
}

/**
 * @title HashPoisoner
 * @notice A contract to poison data hashes in VerificationEngine
 * @dev Used to create a scenario where VerificationEngine's _processedHashes
 *      contains a hash but CarbonCredit's usedDataHashes does not.
 */
contract HashPoisoner {
    // This contract doesn't need any logic - it's just used as a caller
    // to trigger verification directly on VerificationEngine
}
