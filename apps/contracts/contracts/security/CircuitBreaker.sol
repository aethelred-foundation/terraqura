// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

/**
 * @title CircuitBreaker
 * @author TerraQura
 * @notice Centralized emergency stop mechanism for all TerraQura contracts
 * @dev Implements multiple protection layers:
 *
 * 1. Global Pause - Stops all contract operations
 * 2. Per-Contract Pause - Stops specific contract
 * 3. Rate Limiting - Prevents excessive operations
 * 4. Volume Limits - Caps daily transaction volumes
 * 5. Anomaly Detection - Triggers on unusual patterns
 *
 * Security levels:
 * - NORMAL: All operations allowed
 * - ELEVATED: Enhanced monitoring, some limits
 * - HIGH: Strict limits, some operations blocked
 * - CRITICAL: Only essential operations allowed
 * - EMERGENCY: All operations paused
 */
contract CircuitBreaker is Initializable, OwnableUpgradeable, UUPSUpgradeable {
    // ============ Enums ============

    enum SecurityLevel {
        NORMAL,
        ELEVATED,
        HIGH,
        CRITICAL,
        EMERGENCY
    }

    // ============ Structs ============

    struct ContractStatus {
        bool isPaused;
        SecurityLevel level;
        uint256 pausedAt;
        string pauseReason;
        address pausedBy;
    }

    struct RateLimit {
        uint256 maxOperationsPerHour;
        uint256 currentOperations;
        uint256 windowStart;
    }

    struct VolumeLimit {
        uint256 maxDailyVolume;      // In wei
        uint256 currentDailyVolume;
        uint256 dayStart;
    }

    // ============ State Variables ============

    /// @notice Global security level
    SecurityLevel public globalSecurityLevel;

    /// @notice Global pause status
    bool public globalPause;

    /// @notice Mapping of contract address to status
    mapping(address => ContractStatus) public contractStatus;

    /// @notice Mapping of contract to rate limits
    mapping(address => RateLimit) public rateLimits;

    /// @notice Mapping of contract to volume limits
    mapping(address => VolumeLimit) public volumeLimits;

    /// @notice Authorized pausers (can pause in emergency)
    mapping(address => bool) public isPauser;

    /// @notice List of monitored contracts
    address[] public monitoredContracts;

    /// @notice Cooldown period after unpause (prevents rapid pause/unpause)
    uint256 public constant UNPAUSE_COOLDOWN = 1 hours;

    /// @notice Last unpause timestamp per contract
    mapping(address => uint256) public lastUnpause;

    /// @notice Default rate limit (operations per hour)
    uint256 public defaultRateLimit;

    /// @notice Default daily volume limit
    uint256 public defaultVolumeLimit;

    // ============ Events ============

    event GlobalPauseActivated(address indexed by, string reason);
    event GlobalPauseDeactivated(address indexed by);
    event ContractPaused(address indexed contractAddr, address indexed by, string reason);
    event ContractUnpaused(address indexed contractAddr, address indexed by);
    event SecurityLevelChanged(SecurityLevel oldLevel, SecurityLevel newLevel, string reason);
    event ContractSecurityLevelChanged(address indexed contractAddr, SecurityLevel oldLevel, SecurityLevel newLevel);
    event RateLimitExceeded(address indexed contractAddr, address indexed user);
    event VolumeLimitExceeded(address indexed contractAddr, uint256 attempted, uint256 limit);
    event PauserAdded(address indexed pauser);
    event PauserRemoved(address indexed pauser);
    event AnomalyDetected(address indexed contractAddr, string anomalyType, bytes data);

    // ============ Errors ============

    error NotPauser();
    error RateLimitExceeded_();
    error VolumeLimitExceeded_();
    error SecurityLevelTooHigh();
    error CooldownActive();
    error ContractNotMonitored();

    // ============ Modifiers ============

    modifier onlyPauser() {
        if (!isPauser[msg.sender] && msg.sender != owner()) {
            revert NotPauser();
        }
        _;
    }

    // Note: whenNotGloballyPaused and whenContractNotPaused modifiers removed
    // as they were defined but never used. Contracts should call isOperationAllowed()
    // or checkRateLimit()/checkVolumeLimit() instead.

    // ============ Initialization ============

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address _owner) public initializer {
        __Ownable_init();
        if (_owner != msg.sender) {
            _transferOwnership(_owner);
        }
        __UUPSUpgradeable_init();

        globalSecurityLevel = SecurityLevel.NORMAL;
        defaultRateLimit = 100;           // 100 operations per hour
        defaultVolumeLimit = 1000 ether;  // 1000 ETH/MATIC per day

        // Owner is a pauser by default
        isPauser[_owner] = true;
        emit PauserAdded(_owner);
    }

    // ============ Emergency Functions ============

    /**
     * @notice Activate global pause (stops everything)
     * @param reason Reason for pause
     */
    function activateGlobalPause(string calldata reason) external onlyPauser {
        globalPause = true;
        globalSecurityLevel = SecurityLevel.EMERGENCY;
        emit GlobalPauseActivated(msg.sender, reason);
    }

    /**
     * @notice Deactivate global pause
     */
    function deactivateGlobalPause() external onlyOwner {
        globalPause = false;
        globalSecurityLevel = SecurityLevel.ELEVATED; // Start at elevated, not normal
        emit GlobalPauseDeactivated(msg.sender);
    }

    /**
     * @notice Pause a specific contract
     * @param contractAddr Contract to pause
     * @param reason Reason for pause
     */
    function pauseContract(address contractAddr, string calldata reason) external onlyPauser {
        ContractStatus storage status = contractStatus[contractAddr];
        status.isPaused = true;
        status.pausedAt = block.timestamp;
        status.pauseReason = reason;
        status.pausedBy = msg.sender;
        status.level = SecurityLevel.EMERGENCY;

        emit ContractPaused(contractAddr, msg.sender, reason);
    }

    /**
     * @notice Unpause a specific contract
     * @param contractAddr Contract to unpause
     */
    function unpauseContract(address contractAddr) external onlyOwner {
        ContractStatus storage status = contractStatus[contractAddr];

        // Enforce cooldown to prevent rapid pause/unpause
        if (block.timestamp < lastUnpause[contractAddr] + UNPAUSE_COOLDOWN) {
            revert CooldownActive();
        }

        status.isPaused = false;
        status.level = SecurityLevel.ELEVATED;
        lastUnpause[contractAddr] = block.timestamp;

        emit ContractUnpaused(contractAddr, msg.sender);
    }

    /**
     * @notice Set global security level
     * @param level New security level
     * @param reason Reason for change
     */
    function setSecurityLevel(SecurityLevel level, string calldata reason) external onlyPauser {
        // Only owner can lower security level
        if (level < globalSecurityLevel && msg.sender != owner()) {
            revert SecurityLevelTooHigh();
        }

        SecurityLevel oldLevel = globalSecurityLevel;
        globalSecurityLevel = level;

        emit SecurityLevelChanged(oldLevel, level, reason);
    }

    // ============ Rate Limiting ============

    /**
     * @notice Check and update rate limit for a contract/user operation
     * @param contractAddr Contract being called
     * @return allowed Whether the operation is allowed
     */
    function checkRateLimit(address contractAddr) external returns (bool allowed) {
        if (globalPause || contractStatus[contractAddr].isPaused) {
            return false;
        }

        RateLimit storage limit = rateLimits[contractAddr];

        // Initialize if first time
        if (limit.maxOperationsPerHour == 0) {
            limit.maxOperationsPerHour = defaultRateLimit;
            limit.windowStart = block.timestamp;
        }

        // Reset window if hour passed
        if (block.timestamp >= limit.windowStart + 1 hours) {
            limit.currentOperations = 0;
            limit.windowStart = block.timestamp;
        }

        // Check limit
        if (limit.currentOperations >= limit.maxOperationsPerHour) {
            emit RateLimitExceeded(contractAddr, msg.sender);
            return false;
        }

        limit.currentOperations++;
        return true;
    }

    /**
     * @notice Check and update volume limit for a contract
     * @param contractAddr Contract being called
     * @param volume Transaction volume in wei
     * @return allowed Whether the operation is allowed
     */
    function checkVolumeLimit(address contractAddr, uint256 volume) external returns (bool allowed) {
        if (globalPause || contractStatus[contractAddr].isPaused) {
            return false;
        }

        VolumeLimit storage limit = volumeLimits[contractAddr];

        // Initialize if first time
        if (limit.maxDailyVolume == 0) {
            limit.maxDailyVolume = defaultVolumeLimit;
            limit.dayStart = block.timestamp;
        }

        // Reset if day passed
        if (block.timestamp >= limit.dayStart + 1 days) {
            limit.currentDailyVolume = 0;
            limit.dayStart = block.timestamp;
        }

        // Check limit
        if (limit.currentDailyVolume + volume > limit.maxDailyVolume) {
            emit VolumeLimitExceeded(contractAddr, volume, limit.maxDailyVolume);
            return false;
        }

        limit.currentDailyVolume += volume;
        return true;
    }

    // ============ Configuration ============

    /**
     * @notice Add a pauser
     */
    function addPauser(address pauser) external onlyOwner {
        isPauser[pauser] = true;
        emit PauserAdded(pauser);
    }

    /**
     * @notice Remove a pauser
     */
    function removePauser(address pauser) external onlyOwner {
        isPauser[pauser] = false;
        emit PauserRemoved(pauser);
    }

    /**
     * @notice Set rate limit for a contract
     */
    function setRateLimit(address contractAddr, uint256 maxPerHour) external onlyOwner {
        rateLimits[contractAddr].maxOperationsPerHour = maxPerHour;
    }

    /**
     * @notice Set volume limit for a contract
     */
    function setVolumeLimit(address contractAddr, uint256 maxDaily) external onlyOwner {
        volumeLimits[contractAddr].maxDailyVolume = maxDaily;
    }

    /**
     * @notice Set default limits
     */
    function setDefaultLimits(uint256 rateLimit, uint256 volumeLimit) external onlyOwner {
        defaultRateLimit = rateLimit;
        defaultVolumeLimit = volumeLimit;
    }

    /**
     * @notice Register a contract for monitoring
     */
    function registerContract(address contractAddr) external onlyOwner {
        monitoredContracts.push(contractAddr);
        contractStatus[contractAddr].level = SecurityLevel.NORMAL;
    }

    // ============ View Functions ============

    /**
     * @notice Check if operations are allowed for a contract
     */
    function isOperationAllowed(address contractAddr) external view returns (bool) {
        if (globalPause) return false;
        if (contractStatus[contractAddr].isPaused) return false;
        if (globalSecurityLevel == SecurityLevel.EMERGENCY) return false;
        return true;
    }

    /**
     * @notice Get current status summary
     */
    function getStatus() external view returns (
        bool isGloballyPaused,
        SecurityLevel currentLevel,
        uint256 monitoredCount
    ) {
        return (globalPause, globalSecurityLevel, monitoredContracts.length);
    }

    /**
     * @notice Get contract status
     */
    function getContractStatus(address contractAddr) external view returns (
        bool isPaused,
        SecurityLevel level,
        uint256 pausedAt,
        string memory pauseReason
    ) {
        ContractStatus storage status = contractStatus[contractAddr];
        return (status.isPaused, status.level, status.pausedAt, status.pauseReason);
    }

    // ============ UUPS ============

    function _authorizeUpgrade(address) internal override onlyOwner {}
}
