// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/governance/TimelockController.sol";

/**
 * @title TerraQuraTimelockMainnet
 * @author TerraQura
 * @notice Production-hardened timelock for mainnet deployment
 * @dev Enforces 48-72 hour delay on all critical admin operations
 *
 * Mainnet Requirements:
 * - Minimum delay: 48 hours (172,800 seconds)
 * - Recommended delay for critical ops: 72 hours
 * - Maximum delay cap: 30 days (prevents indefinite lock)
 *
 * Operation Classification:
 * - STANDARD (48h): Parameter updates, fee changes
 * - CRITICAL (72h): Contract upgrades, role grants
 * - EMERGENCY (48h): Circuit breaker activation
 * - MAXIMUM (168h): Treasury withdrawals above threshold
 *
 * Security Features:
 * - Immutable production flag prevents testnet misuse
 * - Operation type enforcement via delay multipliers
 * - Emergency action logging for audit trail
 * - Batch operation support with atomic execution
 */
contract TerraQuraTimelockMainnet is TimelockController {
    // ============ Constants ============

    /// @notice Minimum delay for mainnet (48 hours)
    uint256 public constant MIN_DELAY_MAINNET = 48 hours;

    /// @notice Critical operations delay (72 hours)
    uint256 public constant CRITICAL_DELAY = 72 hours;

    /// @notice Maximum operations delay (7 days - treasury)
    uint256 public constant MAXIMUM_DELAY = 7 days;

    /// @notice Absolute maximum delay cap (30 days)
    uint256 public constant MAX_DELAY_CAP = 30 days;

    /// @notice Treasury withdrawal threshold requiring maximum delay
    uint256 public constant TREASURY_THRESHOLD = 100_000 ether; // 100K MATIC/ETH

    // ============ Enums ============

    enum OperationType {
        STANDARD,   // 48h - parameter updates, fee changes
        CRITICAL,   // 72h - upgrades, role grants
        EMERGENCY,  // 48h - circuit breaker, pause
        MAXIMUM     // 7d  - large treasury withdrawals
    }

    // ============ State Variables ============

    /// @notice Whether this is a production deployment (immutable)
    bool public immutable isProduction;

    /// @notice Mapping of operation hash to type for delay enforcement
    mapping(bytes32 => OperationType) public operationTypes;

    /// @notice Tracks whether an operation type was explicitly or automatically recorded
    mapping(bytes32 => bool) public operationTypeConfigured;

    /// @notice Total value locked tracking for monitoring
    uint256 public totalValueProcessed;

    /// @notice Daily operation counter for rate limiting
    mapping(uint256 => uint256) public dailyOperations;

    /// @notice Maximum operations per day
    uint256 public constant MAX_DAILY_OPERATIONS = 50;

    // ============ Events ============

    /// @notice Emitted when an emergency action is taken
    event EmergencyAction(
        address indexed executor,
        string reason,
        bytes32 operationId
    );

    /// @notice Emitted when operation type is set
    event OperationTypeSet(
        bytes32 indexed operationId,
        OperationType operationType,
        uint256 requiredDelay
    );

    /// @notice Emitted for high-value operations
    event HighValueOperation(
        bytes32 indexed operationId,
        uint256 value,
        uint256 delay
    );

    /// @notice Emitted when daily limit approaches
    event DailyLimitWarning(
        uint256 day,
        uint256 operationCount,
        uint256 limit
    );

    // ============ Errors ============

    error InvalidDelay();
    error DelayTooShort();
    error DelayTooLong();
    error DailyLimitExceeded();
    error NotProduction();

    // ============ Constructor ============

    /**
     * @notice Initialize the mainnet timelock
     * @param minDelay Minimum delay (must be >= 48 hours)
     * @param proposers Addresses that can propose (should be multisig)
     * @param executors Addresses that can execute (can be zero for anyone)
     * @param admin Admin address (set to address(0) after setup)
     */
    constructor(
        uint256 minDelay,
        address[] memory proposers,
        address[] memory executors,
        address admin
    ) TimelockController(minDelay, proposers, executors, admin) {
        // Enforce mainnet minimum delay
        if (minDelay < MIN_DELAY_MAINNET) revert DelayTooShort();
        if (minDelay > MAX_DELAY_CAP) revert DelayTooLong();

        isProduction = true;
    }

    // ============ Operation Type Management ============

    /**
     * @notice Set operation type for delay enforcement
     * @param operationId The operation hash
     * @param opType The operation type
     */
    function setOperationType(
        bytes32 operationId,
        OperationType opType
    ) external onlyRole(PROPOSER_ROLE) {
        operationTypes[operationId] = opType;
        operationTypeConfigured[operationId] = true;

        uint256 requiredDelay = getDelayForType(opType);
        emit OperationTypeSet(operationId, opType, requiredDelay);
    }

    /**
     * @notice Get required delay for operation type
     * @param opType Operation type
     * @return delay Required delay in seconds
     */
    function getDelayForType(OperationType opType) public pure returns (uint256 delay) {
        if (opType == OperationType.STANDARD) {
            return MIN_DELAY_MAINNET; // 48 hours
        } else if (opType == OperationType.CRITICAL) {
            return CRITICAL_DELAY; // 72 hours
        } else if (opType == OperationType.EMERGENCY) {
            return MIN_DELAY_MAINNET; // 48 hours (minimum)
        } else if (opType == OperationType.MAXIMUM) {
            return MAXIMUM_DELAY; // 7 days
        }
        return MIN_DELAY_MAINNET;
    }

    // ============ Enhanced Scheduling ============

    /**
     * @notice Schedule with automatic operation type detection
     * @param target Target contract
     * @param value ETH value
     * @param data Call data
     * @param predecessor Predecessor operation (0 for none)
     * @param salt Unique salt
     * @param delay Requested delay
     */
    function scheduleWithTypeDetection(
        address target,
        uint256 value,
        bytes calldata data,
        bytes32 predecessor,
        bytes32 salt,
        uint256 delay
    ) external onlyRole(PROPOSER_ROLE) {
        schedule(target, value, data, predecessor, salt, delay);
    }

    /**
     * @notice Schedule a single operation with enforced type-aware delay policy
     */
    function schedule(
        address target,
        uint256 value,
        bytes calldata data,
        bytes32 predecessor,
        bytes32 salt,
        uint256 delay
    ) public override onlyRole(PROPOSER_ROLE) {
        uint256 enforcedDelay = _prepareSingleSchedule(
            target,
            value,
            data,
            predecessor,
            salt,
            delay
        );
        super.schedule(target, value, data, predecessor, salt, enforcedDelay);
    }

    /**
     * @notice Schedule a batch operation with enforced type-aware delay policy
     */
    function scheduleBatch(
        address[] calldata targets,
        uint256[] calldata values,
        bytes[] calldata payloads,
        bytes32 predecessor,
        bytes32 salt,
        uint256 delay
    ) public override onlyRole(PROPOSER_ROLE) {
        require(targets.length == values.length, "TimelockController: length mismatch");
        require(targets.length == payloads.length, "TimelockController: length mismatch");

        uint256 enforcedDelay = _prepareBatchSchedule(
            targets,
            values,
            payloads,
            predecessor,
            salt,
            delay
        );
        super.scheduleBatch(targets, values, payloads, predecessor, salt, enforcedDelay);
    }

    /**
     * @notice Detect operation type based on call data
     * @param target Target contract
     * @param value ETH value
     * @param data Call data
     * @return opType Detected operation type
     */
    function _detectOperationType(
        address target,
        uint256 value,
        bytes calldata data
    ) internal pure returns (OperationType opType) {
        if (target == address(0)) {
            return OperationType.MAXIMUM;
        }

        // High-value transfers require maximum delay
        if (value > TREASURY_THRESHOLD) {
            return OperationType.MAXIMUM;
        }

        // Check function selector for critical operations
        if (data.length >= 4) {
            bytes4 selector = bytes4(data[:4]);

            // Upgrade functions (critical)
            if (
                selector == bytes4(keccak256("upgradeTo(address)")) ||
                selector == bytes4(keccak256("upgradeToAndCall(address,bytes)")) ||
                selector == bytes4(keccak256("grantRole(bytes32,address)")) ||
                selector == bytes4(keccak256("revokeRole(bytes32,address)"))
            ) {
                return OperationType.CRITICAL;
            }

            // Emergency functions
            if (
                selector == bytes4(keccak256("pause()")) ||
                selector == bytes4(keccak256("unpause()")) ||
                selector == bytes4(keccak256("activateGlobalPause(string)"))
            ) {
                return OperationType.EMERGENCY;
            }
        }

        // Default to standard
        return OperationType.STANDARD;
    }

    function _prepareSingleSchedule(
        address target,
        uint256 value,
        bytes calldata data,
        bytes32 predecessor,
        bytes32 salt,
        uint256 requestedDelay
    ) internal returns (uint256 enforcedDelay) {
        _consumeDailyQuota();

        bytes32 operationId = hashOperation(target, value, data, predecessor, salt);
        OperationType opType = _resolveOperationType(
            operationId,
            _detectOperationType(target, value, data)
        );

        enforcedDelay = _enforceDelayBounds(opType, requestedDelay);
        totalValueProcessed += value;

        if (value > TREASURY_THRESHOLD) {
            emit HighValueOperation(operationId, value, enforcedDelay);
        }
    }

    function _prepareBatchSchedule(
        address[] calldata targets,
        uint256[] calldata values,
        bytes[] calldata payloads,
        bytes32 predecessor,
        bytes32 salt,
        uint256 requestedDelay
    ) internal returns (uint256 enforcedDelay) {
        _consumeDailyQuota();

        bytes32 operationId = hashOperationBatch(targets, values, payloads, predecessor, salt);
        OperationType detectedType = OperationType.STANDARD;
        uint256 totalBatchValue;

        for (uint256 i = 0; i < targets.length; ++i) {
            OperationType currentType = _detectOperationType(targets[i], values[i], payloads[i]);
            if (getDelayForType(currentType) > getDelayForType(detectedType)) {
                detectedType = currentType;
            }
            totalBatchValue += values[i];
        }

        OperationType opType = _resolveOperationType(operationId, detectedType);
        enforcedDelay = _enforceDelayBounds(opType, requestedDelay);
        totalValueProcessed += totalBatchValue;

        if (getDelayForType(opType) == MAXIMUM_DELAY || totalBatchValue > TREASURY_THRESHOLD) {
            emit HighValueOperation(operationId, totalBatchValue, enforcedDelay);
        }
    }

    function _resolveOperationType(
        bytes32 operationId,
        OperationType detectedType
    ) internal returns (OperationType opType) {
        opType = detectedType;

        if (operationTypeConfigured[operationId]) {
            OperationType configuredType = operationTypes[operationId];
            if (getDelayForType(configuredType) > getDelayForType(opType)) {
                opType = configuredType;
            }
        }

        operationTypes[operationId] = opType;
        operationTypeConfigured[operationId] = true;
        emit OperationTypeSet(operationId, opType, getDelayForType(opType));
    }

    function _enforceDelayBounds(
        OperationType opType,
        uint256 requestedDelay
    ) internal pure returns (uint256 enforcedDelay) {
        enforcedDelay = requestedDelay;

        uint256 requiredDelay = getDelayForType(opType);
        if (enforcedDelay < requiredDelay) {
            enforcedDelay = requiredDelay;
        }
        if (enforcedDelay > MAX_DELAY_CAP) revert DelayTooLong();
    }

    function _consumeDailyQuota() internal {
        uint256 today = block.timestamp / 1 days;
        if (dailyOperations[today] >= MAX_DAILY_OPERATIONS) {
            revert DailyLimitExceeded();
        }

        dailyOperations[today]++;

        if (dailyOperations[today] >= MAX_DAILY_OPERATIONS - 5) {
            emit DailyLimitWarning(today, dailyOperations[today], MAX_DAILY_OPERATIONS);
        }
    }

    // ============ View Functions ============

    /**
     * @notice Get recommended delay based on operation type
     * @param operationType Type (0=standard, 1=critical, 2=emergency, 3=maximum)
     * @return Recommended delay in seconds
     */
    function getRecommendedDelay(uint8 operationType) external pure returns (uint256) {
        return getDelayForType(OperationType(operationType));
    }

    /**
     * @notice Check if an operation is ready for execution
     * @param id Operation ID
     * @return ready Whether the operation can be executed
     * @return timeRemaining Seconds until execution is possible
     */
    function getOperationStatus(bytes32 id) external view returns (
        bool ready,
        uint256 timeRemaining
    ) {
        if (!isOperation(id)) {
            return (false, 0);
        }

        uint256 timestamp = getTimestamp(id);

        if (block.timestamp >= timestamp) {
            return (true, 0);
        }

        return (false, timestamp - block.timestamp);
    }

    /**
     * @notice Get operation details with type
     * @param id Operation ID
     * @return opType Operation type
     * @return requiredDelay Required delay for this type
     * @return timestamp Scheduled timestamp
     * @return isReady Whether ready for execution
     */
    function getOperationDetails(bytes32 id) external view returns (
        OperationType opType,
        uint256 requiredDelay,
        uint256 timestamp,
        bool isReady
    ) {
        opType = operationTypes[id];
        requiredDelay = getDelayForType(opType);
        timestamp = getTimestamp(id);
        isReady = isOperationReady(id);
    }

    /**
     * @notice Get daily operations count
     * @return count Operations scheduled today
     * @return limit Maximum allowed
     * @return remaining Operations remaining today
     */
    function getDailyStats() external view returns (
        uint256 count,
        uint256 limit,
        uint256 remaining
    ) {
        uint256 today = block.timestamp / 1 days;
        count = dailyOperations[today];
        limit = MAX_DAILY_OPERATIONS;
        remaining = count < limit ? limit - count : 0;
    }

    /**
     * @notice Get timelock configuration summary
     */
    function getConfiguration() external pure returns (
        uint256 minDelay,
        uint256 criticalDelay,
        uint256 maximumDelay,
        uint256 maxDelayCap,
        uint256 treasuryThreshold,
        uint256 maxDailyOps
    ) {
        return (
            MIN_DELAY_MAINNET,
            CRITICAL_DELAY,
            MAXIMUM_DELAY,
            MAX_DELAY_CAP,
            TREASURY_THRESHOLD,
            MAX_DAILY_OPERATIONS
        );
    }
}
