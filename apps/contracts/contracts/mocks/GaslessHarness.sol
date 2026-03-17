// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {GaslessMarketplace} from "../gasless/GaslessMarketplace.sol";

/**
 * @title GaslessHarness
 * @notice Test harness for GaslessMarketplace to expose internal functions
 * @dev This contract inherits from GaslessMarketplace and exposes the
 *      internal _msgData() function for coverage testing purposes.
 *
 * AUDIT NOTE: This contract is ONLY used for testing and should NEVER
 * be deployed to production. It exists solely to achieve 100% code coverage
 * on the ERC-2771 meta-transaction implementation.
 */
contract GaslessHarness is GaslessMarketplace {
    /**
     * @notice Expose _msgData() for testing
     * @dev Allows direct testing of the ERC-2771 calldata truncation logic
     * @return The processed message data (truncated if from trusted forwarder)
     */
    function exposed_msgData() external view returns (bytes calldata) {
        return _msgData();
    }

    /**
     * @notice Expose _msgSender() for testing
     * @dev Allows direct testing of the ERC-2771 sender extraction logic
     * @return The extracted sender address
     */
    function exposed_msgSender() external view returns (address) {
        return _msgSender();
    }

    /**
     * @notice Test function that uses _msgData internally
     * @dev This function demonstrates that _msgData() works correctly
     *      by returning both the selector and parameters
     * @param value A test value to include in calldata
     * @return dataLength The length of _msgData()
     * @return firstFourBytes The function selector from _msgData()
     */
    function testMsgDataProcessing(uint256 value) external view returns (uint256 dataLength, bytes4 firstFourBytes) {
        bytes calldata data = _msgData();
        dataLength = data.length;
        if (data.length >= 4) {
            firstFourBytes = bytes4(data[:4]);
        }
        // Use value to avoid unused parameter warning
        if (value > 0) {
            dataLength = data.length;
        }
    }
}
