// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title ICircuitBreaker
 * @notice Minimal consumer interface for the platform CircuitBreaker.
 * @dev Core contracts call {isOperationAllowed} from their state-changing
 *      paths so a global pause, per-contract pause, or EMERGENCY security
 *      level actually halts the platform (see security/CircuitBreaker.sol).
 */
interface ICircuitBreaker {
    /**
     * @notice True iff operations are currently allowed for `contractAddr`
     *         (no global pause, no per-contract pause, not EMERGENCY level).
     */
    function isOperationAllowed(address contractAddr) external view returns (bool);
}
