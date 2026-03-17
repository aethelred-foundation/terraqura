// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/governance/TimelockController.sol";

/**
 * @title TerraQuraTimelock
 * @author TerraQura
 * @notice Timelock controller for governance operations
 * @dev Enforces a delay on all critical admin operations
 *
 * This contract wraps OpenZeppelin's TimelockController to provide
 * enterprise-grade governance with:
 * - Configurable delay (minimum 2 days for production)
 * - Multi-sig proposer support
 * - Emergency cancellation capability
 * - Full audit trail via events
 *
 * Critical operations that must go through timelock:
 * - Contract upgrades
 * - Fee changes
 * - Role management
 * - Parameter updates
 */
contract TerraQuraTimelock is TimelockController {
    /// @notice Minimum delay for production (2 days)
    uint256 public constant MIN_DELAY_PRODUCTION = 2 days;

    /// @notice Minimum delay for testnet (1 hour for testing)
    uint256 public constant MIN_DELAY_TESTNET = 1 hours;

    /// @notice Whether this is a production deployment
    bool public immutable isProduction;

    /// @notice Event emitted when an emergency action is taken
    event EmergencyAction(address indexed executor, string reason);

    /**
     * @notice Initialize the timelock
     * @param minDelay Minimum delay for operations (in seconds)
     * @param proposers Addresses that can propose operations (should be multisig)
     * @param executors Addresses that can execute operations (can be zero address for anyone)
     * @param admin Admin address (should be set to address(0) after setup for decentralization)
     * @param _isProduction Whether this is a production deployment
     */
    constructor(
        uint256 minDelay,
        address[] memory proposers,
        address[] memory executors,
        address admin,
        bool _isProduction
    ) TimelockController(minDelay, proposers, executors, admin) {
        isProduction = _isProduction;

        // Enforce minimum delays
        if (_isProduction) {
            require(minDelay >= MIN_DELAY_PRODUCTION, "Production delay must be >= 2 days");
        } else {
            require(minDelay >= MIN_DELAY_TESTNET, "Testnet delay must be >= 1 hour");
        }
    }

    /**
     * @notice Get recommended delay based on operation type
     * @param operationType Type of operation (0=standard, 1=critical, 2=emergency)
     * @return Recommended delay in seconds
     */
    function getRecommendedDelay(uint8 operationType) external view returns (uint256) {
        if (operationType == 2) {
            // Emergency - use minimum
            return getMinDelay();
        } else if (operationType == 1) {
            // Critical - use 2x minimum
            return getMinDelay() * 2;
        }
        // Standard
        return getMinDelay();
    }

    /**
     * @notice Check if an operation is ready for execution
     * @param id Operation ID
     * @return ready Whether the operation can be executed
     * @return timeRemaining Seconds until execution is possible (0 if ready)
     */
    function getOperationStatus(bytes32 id) external view returns (bool ready, uint256 timeRemaining) {
        if (!isOperation(id)) {
            return (false, 0);
        }

        // Note: timestamp is guaranteed > 0 here because isOperation(id) returns true
        // only when getTimestamp(id) > 0 (OpenZeppelin's TimelockController definition).
        // The redundant timestamp == 0 check was removed as dead code.
        uint256 timestamp = getTimestamp(id);

        if (block.timestamp >= timestamp) {
            return (true, 0);
        }

        return (false, timestamp - block.timestamp);
    }
}
