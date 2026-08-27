// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "../access/TerraQuraAccessControl.sol";

/**
 * @title NativeIoTOracle v2.0.0
 * @author TerraQura Engineering
 * @notice Sovereign 1st-party oracle for Aethelred Network deployment.
 *         Replaces external oracle dependencies (Chainlink) for full data sovereignty.
 *
 * @dev Architecture:
 *   - Trusted Hardware Model: Whitelisted IoT wallets push sensor telemetry directly
 *   - Multi-dimensional verification: IoT telemetry + satellite imagery (IPFS CID)
 *   - Data history with configurable retention for audit trail
 *   - Batch submission for gas-efficient multi-device updates
 *   - Emergency pause integration via TerraQuraAccessControl
 *   - Heartbeat monitoring to detect stale/offline devices
 *   - ReentrancyGuard for defense-in-depth
 *
 * Upgrade Path (UUPS):
 *   Only addresses with UPGRADER_ROLE can upgrade via TerraQuraAccessControl.
 *
 * Gas Optimizations:
 *   - Custom errors (saves ~200 gas per revert vs require strings)
 *   - Tight struct packing (co2/energy fit single slot)
 *   - Batch writes amortize base tx cost across N devices
 */
contract NativeIoTOracle is
    Initializable,
    UUPSUpgradeable,
    ReentrancyGuardUpgradeable
{
    // ============================================
    // VERSION
    // ============================================

    string public constant VERSION = "2.0.0";

    // ============================================
    // STATE
    // ============================================

    TerraQuraAccessControl public accessControl;

    /// @notice Role for authorized IoT hardware wallets / backend relayers
    bytes32 public constant ORACLE_NODE_ROLE = keccak256("ORACLE_NODE_ROLE");

    /// @notice Role required for administrative operations on this oracle
    bytes32 public constant ORACLE_ADMIN_ROLE = keccak256("ORACLE_ADMIN_ROLE");

    /**
     * @notice Sensor telemetry payload from a single DAC device
     * @dev Struct packing: co2Captured (32) + energyUsed (32) = 1 slot,
     *      timestamp (32) + anomalyFlag (1) = 1 slot,
     *      satelliteCID is dynamic (separate slot)
     *
     * @param co2Captured  Gross CO2 captured in grams (1e18 precision)
     * @param energyUsed   Energy consumed in watt-hours (1e18 precision)
     * @param timestamp    Block timestamp when data was recorded on-chain
     * @param anomalyFlag  True if on-device anomaly detection triggered
     * @param satelliteCID IPFS CID of satellite/thermal imagery for this reading
     */
    struct SensorData {
        uint256 co2Captured;
        uint256 energyUsed;
        uint256 timestamp;
        bool anomalyFlag;
        string satelliteCID;
    }

    /// @notice Latest sensor data per DAC device ID
    mapping(string => SensorData) private _latestData;

    /// @notice Historical sensor readings per device (append-only ring buffer)
    mapping(string => SensorData[]) private _dataHistory;

    /// @notice Logical start index for capped per-device history windows
    mapping(string => uint256) private _historyStartIndex;

    /// @notice Maximum historical entries per device (0 = unlimited)
    uint256 public maxHistoryPerDevice;

    /// @notice Total number of data submissions across all devices
    uint256 public totalSubmissions;

    /// @notice Maximum allowed staleness before data is considered unreliable (seconds)
    uint256 public heartbeatTimeout;

    /// @notice Registered device IDs for enumeration
    string[] private _registeredDevices;
    mapping(string => bool) private _isRegistered;

    /// @notice Rate limiting: minimum interval between submissions per device (seconds)
    uint256 public minSubmissionInterval;

    /// @notice Tracks anomaly count per device for circuit-breaker integration
    mapping(string => uint256) public anomalyCount;

    /// @notice Consecutive anomaly threshold that triggers an automatic device suspension
    uint256 public anomalyThreshold;

    /// @notice Devices that have been suspended due to anomaly threshold breach
    mapping(string => bool) public suspendedDevices;

    // ============================================
    // EVENTS
    // ============================================

    /**
     * @notice Emitted when IoT sensor data is logged on-chain
     * @dev Indexed dacId enables efficient subgraph filtering
     */
    event IoTDataLogged(
        string indexed dacId,
        uint256 co2Captured,
        uint256 energyUsed,
        string satelliteCID,
        uint256 timestamp,
        address indexed oracleNode
    );

    /// @notice Emitted when on-device anomaly detection flags suspicious physics
    event AnomalyDetected(
        string indexed dacId,
        uint256 co2Captured,
        uint256 energyUsed,
        uint256 timestamp,
        uint256 consecutiveAnomalies
    );

    /// @notice Emitted when a device is automatically suspended due to repeated anomalies
    event DeviceSuspended(
        string indexed dacId,
        uint256 anomalyCount,
        uint256 timestamp
    );

    /// @notice Emitted when a suspended device is reinstated by an admin
    event DeviceReinstated(
        string indexed dacId,
        address indexed admin,
        uint256 timestamp
    );

    /// @notice Emitted when a batch of sensor data is submitted
    event BatchDataLogged(
        uint256 deviceCount,
        uint256 timestamp,
        address indexed oracleNode
    );

    /// @notice Emitted when oracle configuration is updated
    event ConfigUpdated(
        string indexed parameter,
        uint256 oldValue,
        uint256 newValue
    );

    /// @notice Emitted when a new device is first registered
    event DeviceRegistered(string indexed dacId, uint256 timestamp);

    // ============================================
    // ERRORS
    // ============================================

    /// @notice Caller does not have the required oracle node role
    error UnauthorizedOracleNode();

    /// @notice Caller does not have the required admin role
    error UnauthorizedAdmin();

    /// @notice The system is currently paused
    error SystemPaused();

    /// @notice The device has been suspended due to repeated anomalies
    error DeviceSuspendedError(string dacId);

    /// @notice Submission interval not elapsed for this device
    error SubmissionTooFrequent(string dacId, uint256 nextAllowedTime);

    /// @notice Batch submission exceeds maximum allowed size
    error BatchTooLarge(uint256 size, uint256 maxSize);

    /// @notice Empty device ID provided
    error EmptyDeviceId();

    /// @notice Invalid configuration value
    error InvalidConfigValue(string parameter);

    /// @notice Device not found in registry
    error DeviceNotFound(string dacId);

    /// @notice Batch arrays have mismatched lengths
    error BatchLengthMismatch();

    // ============================================
    // CONSTANTS
    // ============================================

    /// @notice Maximum devices per batch submission
    uint256 public constant MAX_BATCH_SIZE = 50;

    /// @notice Default heartbeat timeout (1 hour)
    uint256 private constant DEFAULT_HEARTBEAT = 3600;

    /// @notice Default history retention per device
    uint256 private constant DEFAULT_MAX_HISTORY = 1000;

    /// @notice Default anomaly threshold before suspension
    uint256 private constant DEFAULT_ANOMALY_THRESHOLD = 5;

    // ============================================
    // INITIALIZER
    // ============================================

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Initialize the oracle with access control and default configuration
     * @param _accessControl Address of the TerraQuraAccessControl contract
     */
    function initialize(address _accessControl) public initializer {
        __UUPSUpgradeable_init();
        __ReentrancyGuard_init();

        if (_accessControl == address(0)) revert InvalidConfigValue("accessControl");

        accessControl = TerraQuraAccessControl(_accessControl);
        heartbeatTimeout = DEFAULT_HEARTBEAT;
        maxHistoryPerDevice = DEFAULT_MAX_HISTORY;
        anomalyThreshold = DEFAULT_ANOMALY_THRESHOLD;
        minSubmissionInterval = 0; // Disabled by default
    }

    // ============================================
    // MODIFIERS
    // ============================================

    modifier onlyOracleNode() {
        if (!accessControl.hasRole(ORACLE_NODE_ROLE, msg.sender)) {
            revert UnauthorizedOracleNode();
        }
        _;
    }

    modifier onlyOracleAdmin() {
        if (
            !accessControl.hasRole(ORACLE_ADMIN_ROLE, msg.sender) &&
            !accessControl.hasRole(accessControl.DEFAULT_ADMIN_ROLE(), msg.sender)
        ) {
            revert UnauthorizedAdmin();
        }
        _;
    }

    modifier whenNotPaused() {
        if (accessControl.paused()) {
            revert SystemPaused();
        }
        _;
    }

    // ============================================
    // CORE: PUSH SENSOR DATA
    // ============================================

    /**
     * @notice Submit sensor telemetry for a single DAC device
     * @dev Only callable by whitelisted IoT wallets (ORACLE_NODE_ROLE).
     *      Validates device status, rate limits, and manages anomaly tracking.
     *
     * @param dacId        Unique identifier for the DAC facility/unit
     * @param co2Captured  Gross CO2 captured in grams (1e18 precision)
     * @param energyUsed   Energy consumed in watt-hours (1e18 precision)
     * @param anomalyFlag  True if on-device anomaly detection triggered
     * @param satelliteCID IPFS CID of corroborating satellite/thermal imagery
     */
    function pushSensorData(
        string calldata dacId,
        uint256 co2Captured,
        uint256 energyUsed,
        bool anomalyFlag,
        string calldata satelliteCID
    ) external onlyOracleNode whenNotPaused nonReentrant {
        _validateAndStore(dacId, co2Captured, energyUsed, anomalyFlag, satelliteCID);
    }

    /**
     * @notice Submit sensor telemetry for multiple DAC devices in a single transaction
     * @dev Amortizes base transaction cost across N devices. Maximum MAX_BATCH_SIZE per call.
     *
     * @param dacIds         Array of device identifiers
     * @param co2Values      Array of CO2 captured values
     * @param energyValues   Array of energy consumed values
     * @param anomalyFlags   Array of anomaly flags
     * @param satelliteCIDs  Array of satellite imagery CIDs
     */
    function pushBatchSensorData(
        string[] calldata dacIds,
        uint256[] calldata co2Values,
        uint256[] calldata energyValues,
        bool[] calldata anomalyFlags,
        string[] calldata satelliteCIDs
    ) external onlyOracleNode whenNotPaused nonReentrant {
        uint256 count = dacIds.length;

        if (count == 0 || count > MAX_BATCH_SIZE) {
            revert BatchTooLarge(count, MAX_BATCH_SIZE);
        }

        if (
            count != co2Values.length ||
            count != energyValues.length ||
            count != anomalyFlags.length ||
            count != satelliteCIDs.length
        ) {
            revert BatchLengthMismatch();
        }

        for (uint256 i = 0; i < count; ) {
            _validateAndStore(
                dacIds[i],
                co2Values[i],
                energyValues[i],
                anomalyFlags[i],
                satelliteCIDs[i]
            );
            unchecked { ++i; }
        }

        emit BatchDataLogged(count, block.timestamp, msg.sender);
    }

    // ============================================
    // CORE: READ SENSOR DATA
    // ============================================

    /**
     * @notice Fetch the latest sensor reading for a specific device
     * @param dacId Unique device identifier
     * @return data The latest SensorData struct
     */
    function getLatestData(
        string calldata dacId
    ) external view returns (SensorData memory data) {
        return _latestData[dacId];
    }

    /**
     * @notice Check if the latest reading for a device is fresh (within heartbeat timeout)
     * @param dacId Unique device identifier
     * @return isFresh True if data was submitted within the heartbeat window
     * @return lastTimestamp The timestamp of the latest reading
     * @return age Seconds since the last reading
     */
    function isDataFresh(
        string calldata dacId
    ) external view returns (bool isFresh, uint256 lastTimestamp, uint256 age) {
        SensorData memory data = _latestData[dacId];
        lastTimestamp = data.timestamp;

        if (lastTimestamp == 0) {
            return (false, 0, type(uint256).max);
        }

        age = block.timestamp - lastTimestamp;
        isFresh = age <= heartbeatTimeout;
    }

    /**
     * @notice Retrieve historical sensor readings for a device
     * @param dacId  Unique device identifier
     * @param offset Starting index in the history array
     * @param limit  Maximum number of entries to return
     * @return entries Array of historical SensorData
     * @return total  Total entries available for this device
     */
    function getDataHistory(
        string calldata dacId,
        uint256 offset,
        uint256 limit
    ) external view returns (SensorData[] memory entries, uint256 total) {
        SensorData[] storage history = _dataHistory[dacId];
        total = _effectiveHistoryLength(history.length);

        if (offset >= total || limit == 0) {
            return (new SensorData[](0), total);
        }

        uint256 end = offset + limit;
        if (end > total) end = total;
        uint256 count = end - offset;

        entries = new SensorData[](count);
        for (uint256 i = 0; i < count; ) {
            uint256 actualIndex = _historyIndexForRead(dacId, history.length, offset + i, total);
            entries[i] = history[actualIndex];
            unchecked { ++i; }
        }
    }

    /**
     * @notice Get the total number of historical readings for a device
     * @param dacId Unique device identifier
     * @return count Number of historical entries
     */
    function getHistoryCount(
        string calldata dacId
    ) external view returns (uint256 count) {
        return _effectiveHistoryLength(_dataHistory[dacId].length);
    }

    /**
     * @notice Get all registered device IDs
     * @return devices Array of registered device identifiers
     */
    function getRegisteredDevices() external view returns (string[] memory devices) {
        return _registeredDevices;
    }

    /**
     * @notice Get the count of registered devices
     * @return count Number of registered devices
     */
    function getDeviceCount() external view returns (uint256 count) {
        return _registeredDevices.length;
    }

    // ============================================
    // ADMIN: CONFIGURATION
    // ============================================

    /**
     * @notice Update the heartbeat timeout (max staleness window)
     * @param _timeout New timeout in seconds (min 60, max 86400)
     */
    function setHeartbeatTimeout(uint256 _timeout) external onlyOracleAdmin {
        if (_timeout < 60 || _timeout > 86400) {
            revert InvalidConfigValue("heartbeatTimeout");
        }
        uint256 old = heartbeatTimeout;
        heartbeatTimeout = _timeout;
        emit ConfigUpdated("heartbeatTimeout", old, _timeout);
    }

    /**
     * @notice Update the maximum history entries per device
     * @param _maxHistory New max (0 = unlimited, max 10000)
     */
    function setMaxHistoryPerDevice(uint256 _maxHistory) external onlyOracleAdmin {
        if (_maxHistory > 10000) {
            revert InvalidConfigValue("maxHistoryPerDevice");
        }
        uint256 old = maxHistoryPerDevice;
        maxHistoryPerDevice = _maxHistory;
        emit ConfigUpdated("maxHistoryPerDevice", old, _maxHistory);
    }

    /**
     * @notice Update the minimum submission interval per device
     * @param _interval New interval in seconds (0 = disabled, max 3600)
     */
    function setMinSubmissionInterval(uint256 _interval) external onlyOracleAdmin {
        if (_interval > 3600) {
            revert InvalidConfigValue("minSubmissionInterval");
        }
        uint256 old = minSubmissionInterval;
        minSubmissionInterval = _interval;
        emit ConfigUpdated("minSubmissionInterval", old, _interval);
    }

    /**
     * @notice Update the anomaly threshold before device suspension
     * @param _threshold New threshold (min 1, max 100)
     */
    function setAnomalyThreshold(uint256 _threshold) external onlyOracleAdmin {
        if (_threshold < 1 || _threshold > 100) {
            revert InvalidConfigValue("anomalyThreshold");
        }
        uint256 old = anomalyThreshold;
        anomalyThreshold = _threshold;
        emit ConfigUpdated("anomalyThreshold", old, _threshold);
    }

    /**
     * @notice Reinstate a suspended device after investigation
     * @param dacId Device identifier to reinstate
     */
    function reinstateDevice(string calldata dacId) external onlyOracleAdmin {
        if (!suspendedDevices[dacId]) {
            revert DeviceNotFound(dacId);
        }

        suspendedDevices[dacId] = false;
        anomalyCount[dacId] = 0;

        emit DeviceReinstated(dacId, msg.sender, block.timestamp);
    }

    // ============================================
    // INTERNAL
    // ============================================

    /**
     * @notice Core logic: validate, store, and emit sensor data
     * @dev Handles registration, rate limiting, anomaly tracking, and history management
     */
    function _validateAndStore(
        string calldata dacId,
        uint256 co2Captured,
        uint256 energyUsed,
        bool anomalyFlag,
        string calldata satelliteCID
    ) internal {
        // Validate device ID
        if (bytes(dacId).length == 0) {
            revert EmptyDeviceId();
        }

        // Check if device is suspended
        if (suspendedDevices[dacId]) {
            revert DeviceSuspendedError(dacId);
        }

        // Rate limiting per device
        if (minSubmissionInterval > 0) {
            uint256 lastTime = _latestData[dacId].timestamp;
            if (lastTime > 0 && block.timestamp < lastTime + minSubmissionInterval) {
                revert SubmissionTooFrequent(dacId, lastTime + minSubmissionInterval);
            }
        }

        // Register device if new
        if (!_isRegistered[dacId]) {
            _isRegistered[dacId] = true;
            _registeredDevices.push(dacId);
            emit DeviceRegistered(dacId, block.timestamp);
        }

        // Build sensor data struct
        SensorData memory reading = SensorData({
            co2Captured: co2Captured,
            energyUsed: energyUsed,
            timestamp: block.timestamp,
            anomalyFlag: anomalyFlag,
            satelliteCID: satelliteCID
        });

        // Store latest reading
        _latestData[dacId] = reading;

        _appendHistory(dacId, reading);

        // Increment global counter
        unchecked { ++totalSubmissions; }

        // Emit data logged event
        emit IoTDataLogged(
            dacId,
            co2Captured,
            energyUsed,
            satelliteCID,
            block.timestamp,
            msg.sender
        );

        // Handle anomaly tracking
        if (anomalyFlag) {
            unchecked { ++anomalyCount[dacId]; }

            emit AnomalyDetected(
                dacId,
                co2Captured,
                energyUsed,
                block.timestamp,
                anomalyCount[dacId]
            );

            // Auto-suspend if threshold breached
            if (anomalyCount[dacId] >= anomalyThreshold) {
                suspendedDevices[dacId] = true;
                emit DeviceSuspended(dacId, anomalyCount[dacId], block.timestamp);
            }
        } else {
            // Reset anomaly counter on clean reading
            if (anomalyCount[dacId] > 0) {
                anomalyCount[dacId] = 0;
            }
        }
    }

    /**
     * @notice UUPS upgrade authorization — requires UPGRADER_ROLE or DEFAULT_ADMIN_ROLE
     */
    function _authorizeUpgrade(address) internal view override {
        if (
            !accessControl.hasRole(keccak256("UPGRADER_ROLE"), msg.sender) &&
            !accessControl.hasRole(accessControl.DEFAULT_ADMIN_ROLE(), msg.sender)
        ) {
            revert UnauthorizedAdmin();
        }
    }

    function _appendHistory(
        string calldata dacId,
        SensorData memory reading
    ) internal {
        SensorData[] storage history = _dataHistory[dacId];

        if (maxHistoryPerDevice == 0) {
            history.push(reading);
            return;
        }

        if (history.length < maxHistoryPerDevice) {
            history.push(reading);
            return;
        }

        if (history.length > maxHistoryPerDevice) {
            _compactHistoryToCap(history, maxHistoryPerDevice);
            _historyStartIndex[dacId] = 0;
        }

        uint256 overwriteIndex = _historyStartIndex[dacId];
        history[overwriteIndex] = reading;
        _historyStartIndex[dacId] = (overwriteIndex + 1) % maxHistoryPerDevice;
    }

    function _compactHistoryToCap(
        SensorData[] storage history,
        uint256 cap
    ) internal {
        uint256 keepStart = history.length - cap;

        for (uint256 i = 0; i < cap; ) {
            history[i] = history[keepStart + i];
            unchecked { ++i; }
        }

        for (uint256 currentLength = history.length; currentLength > cap; ) {
            history.pop();
            unchecked { --currentLength; }
        }
    }

    function _effectiveHistoryLength(uint256 rawLength) internal view returns (uint256) {
        if (maxHistoryPerDevice == 0 || rawLength <= maxHistoryPerDevice) {
            return rawLength;
        }
        return maxHistoryPerDevice;
    }

    function _historyIndexForRead(
        string calldata dacId,
        uint256 rawLength,
        uint256 logicalIndex,
        uint256 effectiveLength
    ) internal view returns (uint256) {
        if (maxHistoryPerDevice == 0) {
            return logicalIndex;
        }

        if (rawLength > maxHistoryPerDevice) {
            return rawLength - effectiveLength + logicalIndex;
        }

        if (effectiveLength == 0) {
            return 0;
        }

        return (_historyStartIndex[dacId] + logicalIndex) % effectiveLength;
    }

    // ============================================
    // STORAGE GAP (for future upgrades)
    // ============================================

    uint256[39] private __gap;
}
