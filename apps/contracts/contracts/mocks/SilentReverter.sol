// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title SilentReverter
 * @notice A mock contract that reverts without returning any error data
 * @dev Used for fault injection testing in TerraQuraMultisig to achieve
 *      100% code coverage on the ExecutionFailed() error path.
 *
 * When TerraQuraMultisig.executeTransaction() calls an external contract:
 * - If the call fails WITH error data: the assembly block bubbles up the error
 * - If the call fails WITHOUT error data: `revert ExecutionFailed()` is triggered
 *
 * This contract simulates the second case (silent revert) which is difficult
 * to trigger with normal Solidity contracts.
 *
 * AUDIT NOTE: This contract is ONLY used for testing and should NEVER
 * be deployed to production.
 */
contract SilentReverter {
    /**
     * @notice A function that silently reverts (no error data)
     * @dev Uses inline assembly to revert with empty return data
     */
    function silentRevert() external pure {
        assembly {
            revert(0, 0)  // Revert with zero-length return data
        }
    }

    /**
     * @notice A function that reverts with custom error data
     * @dev This is the normal Solidity revert behavior for comparison
     */
    function normalRevert() external pure {
        revert("This is a normal revert with error data");
    }

    /**
     * @notice A function that succeeds
     * @dev For testing successful execution paths
     */
    function succeed() external pure returns (bool) {
        return true;
    }

    /**
     * @notice Receive function that silently reverts
     * @dev Tests ETH transfers that fail silently
     */
    receive() external payable {
        assembly {
            revert(0, 0)
        }
    }

    /**
     * @notice Fallback that silently reverts for any unknown function call
     * @dev Catches any call and reverts without data
     */
    fallback() external payable {
        assembly {
            revert(0, 0)
        }
    }
}
