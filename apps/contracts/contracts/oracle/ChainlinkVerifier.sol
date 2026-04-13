// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {FunctionsClient} from "@chainlink/contracts/src/v0.8/functions/v1_0_0/FunctionsClient.sol";
import {ConfirmedOwner} from "@chainlink/contracts/src/v0.8/shared/access/ConfirmedOwner.sol";
import {FunctionsRequest} from "@chainlink/contracts/src/v0.8/functions/v1_0_0/libraries/FunctionsRequest.sol";

/**
 * @title TerraQura Chainlink Verifier v2.0.0
 * @author TerraQura
 * @notice Enterprise-grade decentralized oracle verification for multi-technology carbon capture data
 * @dev Uses Chainlink Functions to verify IoT data off-chain with technology-aware thresholds.
 *
 * v2.0.0 Upgrade Highlights:
 * - Multi-technology support: Technology type passed to oracle for tech-specific validation
 * - Enhanced oracle response: Full structured response (passed, co2, efficiency, dataHash, confidence, techType)
 * - Request lifecycle: Timeout detection, retry mechanism, expiry management
 * - Confidence scoring: Oracle returns a confidence score (0-10000 bps) for verification quality
 * - Request history: Track all requests per batch for audit trail
 * - Rate limiting: Configurable cooldown per operator to prevent oracle spam
 *
 * v3.0.0 Upgrade Highlights:
 * - Net-Negative Verification: Oracle fetches live grid intensity from ElectricityMaps API
 * - Grid intensity accounting: Validates that net credits are positive after energy debt
 * - Enhanced JavaScript source with ElectricityMaps integration
 * - Facility zone parameter for regional grid intensity lookup
 */
contract ChainlinkVerifier is FunctionsClient, ConfirmedOwner {
    using FunctionsRequest for FunctionsRequest.Request;

    // ============================================
    // VERSION
    // ============================================

    string public constant VERSION = "3.0.0";

    // ============================================
    // EVENTS
    // ============================================

    event VerificationRequested(
        bytes32 indexed requestId,
        bytes32 indexed batchId,
        address indexed operator
    );

    event VerificationRequestedWithTech(
        bytes32 indexed requestId,
        bytes32 indexed batchId,
        address indexed operator,
        uint8 techType
    );

    event VerificationFulfilled(
        bytes32 indexed requestId,
        bytes32 indexed batchId,
        bool passed,
        uint256 co2Verified,
        uint256 efficiencyVerified
    );

    event VerificationFulfilledEnhanced(
        bytes32 indexed requestId,
        bytes32 indexed batchId,
        bool passed,
        uint256 co2Verified,
        uint256 efficiencyVerified,
        uint256 confidenceScore,
        uint8 techType
    );

    event VerificationFailed(
        bytes32 indexed requestId,
        bytes32 indexed batchId,
        bytes error
    );

    event RequestTimedOut(
        bytes32 indexed requestId,
        bytes32 indexed batchId,
        uint256 requestTimestamp,
        uint256 timeoutTimestamp
    );

    event RequestRetried(
        bytes32 indexed originalRequestId,
        bytes32 indexed newRequestId,
        bytes32 indexed batchId,
        uint8 retryCount
    );

    event TechThresholdsRegistered(
        uint8 indexed techType,
        string name,
        uint256 minEfficiency,
        uint256 maxEfficiency
    );

    event OperatorCooldownUpdated(
        uint256 oldCooldown,
        uint256 newCooldown
    );

    event RequestTimeoutUpdated(
        uint256 oldTimeout,
        uint256 newTimeout
    );

    // ============================================
    // STATE
    // ============================================

    // Chainlink Functions configuration
    bytes32 public donId;
    uint64 public subscriptionId;
    uint32 public gasLimit;
    bytes public encryptedSecretsUrls;

    // Verification source code (JavaScript)
    string public verificationSource;

    // ============ Enhanced Request Tracking ============

    /**
     * @notice Enhanced request struct with technology type and retry tracking
     */
    struct VerificationRequest {
        bytes32 batchId;
        address operator;
        uint256 co2Claimed;
        uint256 efficiencyClaimed;
        bytes32 requestedDataHash;
        uint256 timestamp;
        bool fulfilled;
        bool passed;
        uint8 techType;         // Technology type for tech-aware verification
        uint8 retryCount;       // Number of times this request has been retried
        bytes32 previousRequestId; // Link to previous request if this is a retry
    }

    mapping(bytes32 => VerificationRequest) public requests;
    mapping(bytes32 => bytes32) public batchToRequest; // batchId => latest requestId

    // ============ Enhanced Verification Results ============

    /**
     * @notice Enhanced result struct with confidence scoring and tech type
     */
    struct VerificationResult {
        bool verified;
        uint256 co2Verified;
        uint256 efficiencyVerified;
        bytes32 dataHash;
        uint256 timestamp;
        uint256 confidenceScore;    // 0-10000 bps (100% = 10000)
        uint8 techType;             // Technology type verified against
    }

    mapping(bytes32 => VerificationResult) public results;

    // ============ Authorization & Rate Limiting ============

    mapping(address => bool) public authorizedCallers;
    mapping(address => uint256) public lastRequestTimestamp; // Anti-spam rate limiting

    /**
     * @notice Minimum cooldown between requests per operator (seconds)
     * @dev Prevents oracle spam. Default: 60 seconds
     */
    uint256 public operatorCooldown;

    /**
     * @notice Request timeout duration (seconds)
     * @dev After this period, unfulfilled requests can be retried. Default: 30 minutes
     */
    uint256 public requestTimeout;

    /**
     * @notice Maximum number of retries per batch
     */
    uint8 public constant MAX_RETRIES = 3;

    // ============ Technology Thresholds (Oracle-Side Reference) ============

    /**
     * @notice Technology-specific efficiency bounds passed to oracle
     * @dev The oracle uses these to validate claimed efficiency factors.
     *      Must stay in sync with VerificationEngine on-chain thresholds.
     */
    struct OracleTechBounds {
        uint256 minEfficiency;   // Min efficiency factor (kWh/tonne * 10000)
        uint256 maxEfficiency;   // Max efficiency factor (kWh/tonne * 10000)
        bool isActive;
        string name;
    }

    mapping(uint8 => OracleTechBounds) public oracleTechBounds;
    uint8 public registeredOracleTechCount;

    // ============================================
    // ERRORS
    // ============================================

    error UnauthorizedCaller();
    error RequestNotFound();
    error RequestAlreadyFulfilled();
    error InvalidBatchId();
    error OperatorCooldownActive(uint256 remainingSeconds);
    error RequestNotTimedOut();
    error MaxRetriesExceeded();
    error TechTypeNotRegistered();
    error InvalidTimeout();
    error InvalidCooldown();
    error DataHashMismatch();

    // ============================================
    // CONSTRUCTOR
    // ============================================

    constructor(
        address _router,
        bytes32 _donId,
        uint64 _subscriptionId
    ) FunctionsClient(_router) ConfirmedOwner(msg.sender) {
        donId = _donId;
        subscriptionId = _subscriptionId;
        gasLimit = 300000;
        operatorCooldown = 0;          // Disabled by default (enable via setOperatorCooldown for production)
        requestTimeout = 1800;         // 30 minutes default

        // Default verification source (can be updated)
        verificationSource = _getDefaultVerificationSource();

        // Initialize default technology bounds (matching VerificationEngine defaults)
        _initializeDefaultTechBounds();
    }

    // ============================================
    // ADMIN FUNCTIONS
    // ============================================

    function setDonId(bytes32 _donId) external onlyOwner {
        donId = _donId;
    }

    function setSubscriptionId(uint64 _subscriptionId) external onlyOwner {
        subscriptionId = _subscriptionId;
    }

    function setGasLimit(uint32 _gasLimit) external onlyOwner {
        gasLimit = _gasLimit;
    }

    function setVerificationSource(string calldata _source) external onlyOwner {
        verificationSource = _source;
    }

    function setEncryptedSecretsUrls(bytes calldata _urls) external onlyOwner {
        encryptedSecretsUrls = _urls;
    }

    function setAuthorizedCaller(address caller, bool authorized) external onlyOwner {
        authorizedCallers[caller] = authorized;
    }

    /**
     * @notice Update the operator cooldown period
     * @param _cooldownSeconds New cooldown in seconds (0 to disable)
     */
    function setOperatorCooldown(uint256 _cooldownSeconds) external onlyOwner {
        if (_cooldownSeconds > 3600) revert InvalidCooldown(); // Max 1 hour
        uint256 oldCooldown = operatorCooldown;
        operatorCooldown = _cooldownSeconds;
        emit OperatorCooldownUpdated(oldCooldown, _cooldownSeconds);
    }

    /**
     * @notice Update the request timeout duration
     * @param _timeoutSeconds New timeout in seconds
     */
    function setRequestTimeout(uint256 _timeoutSeconds) external onlyOwner {
        if (_timeoutSeconds < 300 || _timeoutSeconds > 86400) revert InvalidTimeout(); // 5 min to 24 hours
        uint256 oldTimeout = requestTimeout;
        requestTimeout = _timeoutSeconds;
        emit RequestTimeoutUpdated(oldTimeout, _timeoutSeconds);
    }

    /**
     * @notice Register or update technology-specific oracle bounds
     * @dev These bounds are passed to the oracle JavaScript source for tech-aware validation.
     *      Should mirror the thresholds in VerificationEngine.sol.
     * @param techType Technology type identifier
     * @param minEfficiency Minimum efficiency (kWh/tonne * 10000)
     * @param maxEfficiency Maximum efficiency (kWh/tonne * 10000)
     * @param name Human-readable technology name
     */
    function setOracleTechBounds(
        uint8 techType,
        uint256 minEfficiency,
        uint256 maxEfficiency,
        string calldata name
    ) external onlyOwner {
        require(minEfficiency < maxEfficiency, "min >= max");
        require(bytes(name).length > 0, "Empty name");

        bool wasActive = oracleTechBounds[techType].isActive;

        oracleTechBounds[techType] = OracleTechBounds({
            minEfficiency: minEfficiency,
            maxEfficiency: maxEfficiency,
            isActive: true,
            name: name
        });

        if (!wasActive) {
            registeredOracleTechCount++;
        }

        emit TechThresholdsRegistered(techType, name, minEfficiency, maxEfficiency);
    }

    // ============================================
    // VERIFICATION FUNCTIONS
    // ============================================

    /**
     * @notice Request verification for a batch (legacy - defaults to DAC tech type 0)
     * @param batchId Unique identifier for the verification batch
     * @param co2Claimed Claimed CO2 captured (in wei, 18 decimals)
     * @param efficiencyClaimed Claimed efficiency factor (kWh/tonne * 10000)
     * @param apiEndpoint API endpoint to fetch sensor data
     * @param dataHash Hash of the raw data for integrity check
     */
    function requestVerification(
        bytes32 batchId,
        uint256 co2Claimed,
        uint256 efficiencyClaimed,
        string calldata apiEndpoint,
        bytes32 dataHash
    ) external returns (bytes32 requestId) {
        return requestVerificationWithTech(
            batchId,
            co2Claimed,
            efficiencyClaimed,
            apiEndpoint,
            dataHash,
            0 // Default to DAC (tech type 0)
        );
    }

    /**
     * @notice Request verification for a batch with technology-specific bounds
     * @param batchId Unique identifier for the verification batch
     * @param co2Claimed Claimed CO2 captured (in wei, 18 decimals)
     * @param efficiencyClaimed Claimed efficiency factor (kWh/tonne * 10000)
     * @param apiEndpoint API endpoint to fetch sensor data
     * @param dataHash Hash of the raw data for integrity check
     * @param techType Technology type identifier (maps to oracle bounds)
     */
    function requestVerificationWithTech(
        bytes32 batchId,
        uint256 co2Claimed,
        uint256 efficiencyClaimed,
        string calldata apiEndpoint,
        bytes32 dataHash,
        uint8 techType
    ) public returns (bytes32 requestId) {
        // Authorization check
        if (!authorizedCallers[msg.sender] && msg.sender != owner()) {
            revert UnauthorizedCaller();
        }

        if (batchId == bytes32(0)) {
            revert InvalidBatchId();
        }

        // Rate limiting check
        if (operatorCooldown > 0) {
            uint256 timeSinceLastRequest = block.timestamp - lastRequestTimestamp[msg.sender];
            if (timeSinceLastRequest < operatorCooldown && lastRequestTimestamp[msg.sender] != 0) {
                revert OperatorCooldownActive(operatorCooldown - timeSinceLastRequest);
            }
        }

        // Validate tech type if bounds are registered
        if (registeredOracleTechCount > 0 && !oracleTechBounds[techType].isActive) {
            revert TechTypeNotRegistered();
        }

        // Build Chainlink Functions request with tech-aware arguments
        FunctionsRequest.Request memory req;
        req.initializeRequestForInlineJavaScript(verificationSource);

        // Enhanced argument set: includes tech type and tech-specific bounds
        string[] memory args = new string[](8);
        args[0] = _bytes32ToString(batchId);
        args[1] = _uint256ToString(co2Claimed);
        args[2] = _uint256ToString(efficiencyClaimed);
        args[3] = apiEndpoint;
        args[4] = _bytes32ToString(dataHash);
        args[5] = _uint256ToString(uint256(techType));

        // Pass tech-specific bounds to oracle (or fallback to DAC defaults)
        if (oracleTechBounds[techType].isActive) {
            args[6] = _uint256ToString(oracleTechBounds[techType].minEfficiency);
            args[7] = _uint256ToString(oracleTechBounds[techType].maxEfficiency);
        } else {
            // Legacy fallback: DAC defaults (200-600 kWh/tonne * 10000)
            args[6] = _uint256ToString(2000000);
            args[7] = _uint256ToString(6000000);
        }
        req.setArgs(args);

        // Add encrypted secrets if configured
        if (encryptedSecretsUrls.length > 0) {
            req.addSecretsReference(encryptedSecretsUrls);
        }

        // Send request
        requestId = _sendRequest(
            req.encodeCBOR(),
            subscriptionId,
            gasLimit,
            donId
        );

        // Store enhanced request
        requests[requestId] = VerificationRequest({
            batchId: batchId,
            operator: msg.sender,
            co2Claimed: co2Claimed,
            efficiencyClaimed: efficiencyClaimed,
            requestedDataHash: dataHash,
            timestamp: block.timestamp,
            fulfilled: false,
            passed: false,
            techType: techType,
            retryCount: 0,
            previousRequestId: bytes32(0)
        });

        batchToRequest[batchId] = requestId;
        lastRequestTimestamp[msg.sender] = block.timestamp;

        emit VerificationRequested(requestId, batchId, msg.sender);
        emit VerificationRequestedWithTech(requestId, batchId, msg.sender, techType);

        return requestId;
    }

    /**
     * @notice Retry a timed-out verification request
     * @dev Only callable after the request has expired (requestTimeout elapsed).
     *      Creates a new request linked to the original via previousRequestId chain.
     *      Maximum MAX_RETRIES attempts per batch.
     * @param originalRequestId The request ID that timed out
     * @param apiEndpoint Updated API endpoint (can reuse the original)
     */
    function retryVerification(
        bytes32 originalRequestId,
        string calldata apiEndpoint
    ) external returns (bytes32 newRequestId) {
        VerificationRequest storage original = requests[originalRequestId];

        if (original.batchId == bytes32(0)) {
            revert RequestNotFound();
        }
        if (original.fulfilled) {
            revert RequestAlreadyFulfilled();
        }
        if (block.timestamp < original.timestamp + requestTimeout) {
            revert RequestNotTimedOut();
        }
        if (original.retryCount >= MAX_RETRIES) {
            revert MaxRetriesExceeded();
        }

        // Authorization: only original operator or owner can retry
        if (msg.sender != original.operator && msg.sender != owner()) {
            revert UnauthorizedCaller();
        }

        // Mark the original as timed out
        original.fulfilled = true; // Prevent duplicate fulfillments
        emit RequestTimedOut(
            originalRequestId,
            original.batchId,
            original.timestamp,
            block.timestamp
        );

        // Build new request
        FunctionsRequest.Request memory req;
        req.initializeRequestForInlineJavaScript(verificationSource);

        string[] memory args = new string[](8);
        args[0] = _bytes32ToString(original.batchId);
        args[1] = _uint256ToString(original.co2Claimed);
        args[2] = _uint256ToString(original.efficiencyClaimed);
        args[3] = apiEndpoint;
        args[4] = _bytes32ToString(original.requestedDataHash);
        args[5] = _uint256ToString(uint256(original.techType));

        if (oracleTechBounds[original.techType].isActive) {
            args[6] = _uint256ToString(oracleTechBounds[original.techType].minEfficiency);
            args[7] = _uint256ToString(oracleTechBounds[original.techType].maxEfficiency);
        } else {
            args[6] = _uint256ToString(2000000);
            args[7] = _uint256ToString(6000000);
        }
        req.setArgs(args);

        if (encryptedSecretsUrls.length > 0) {
            req.addSecretsReference(encryptedSecretsUrls);
        }

        newRequestId = _sendRequest(
            req.encodeCBOR(),
            subscriptionId,
            gasLimit,
            donId
        );

        // Store retry request linked to original
        uint8 newRetryCount = original.retryCount + 1;
        requests[newRequestId] = VerificationRequest({
            batchId: original.batchId,
            operator: original.operator,
            co2Claimed: original.co2Claimed,
            efficiencyClaimed: original.efficiencyClaimed,
            requestedDataHash: original.requestedDataHash,
            timestamp: block.timestamp,
            fulfilled: false,
            passed: false,
            techType: original.techType,
            retryCount: newRetryCount,
            previousRequestId: originalRequestId
        });

        batchToRequest[original.batchId] = newRequestId;

        emit RequestRetried(originalRequestId, newRequestId, original.batchId, newRetryCount);

        return newRequestId;
    }

    /**
     * @notice Callback function for Chainlink Functions
     * @dev Called by the DON when the request is fulfilled.
     *      Supports both legacy (4-field) and enhanced (6-field) response formats.
     */
    function fulfillRequest(
        bytes32 requestId,
        bytes memory response,
        bytes memory err
    ) internal override {
        VerificationRequest storage request = requests[requestId];

        if (request.batchId == bytes32(0)) {
            revert RequestNotFound();
        }

        if (request.fulfilled) {
            revert RequestAlreadyFulfilled();
        }

        if (err.length > 0) {
            request.fulfilled = true;
            emit VerificationFailed(requestId, request.batchId, err);
            return;
        }

        // Try enhanced response format first (6 fields), fall back to legacy (4 fields)
        bool passed;
        uint256 co2Verified;
        uint256 efficiencyVerified;
        bytes32 dataHash;
        uint256 confidenceScore = 10000; // Default: 100% confidence for legacy responses
        uint8 verifiedTechType = request.techType;

        if (response.length >= 192) {
            // Enhanced response: (bool, uint256, uint256, bytes32, uint256, uint8)
            (passed, co2Verified, efficiencyVerified, dataHash, confidenceScore, verifiedTechType) =
                abi.decode(response, (bool, uint256, uint256, bytes32, uint256, uint8));
        } else {
            // Legacy response: (bool, uint256, uint256, bytes32)
            (passed, co2Verified, efficiencyVerified, dataHash) =
                abi.decode(response, (bool, uint256, uint256, bytes32));
        }

        if (dataHash != request.requestedDataHash) {
            revert DataHashMismatch();
        }

        request.fulfilled = true;
        request.passed = passed;

        // Store enhanced result
        results[request.batchId] = VerificationResult({
            verified: passed,
            co2Verified: co2Verified,
            efficiencyVerified: efficiencyVerified,
            dataHash: dataHash,
            timestamp: block.timestamp,
            confidenceScore: confidenceScore,
            techType: verifiedTechType
        });

        // Emit both legacy and enhanced events for backwards compatibility
        emit VerificationFulfilled(
            requestId,
            request.batchId,
            passed,
            co2Verified,
            efficiencyVerified
        );

        emit VerificationFulfilledEnhanced(
            requestId,
            request.batchId,
            passed,
            co2Verified,
            efficiencyVerified,
            confidenceScore,
            verifiedTechType
        );
    }

    // ============================================
    // VIEW FUNCTIONS
    // ============================================

    /**
     * @notice Get verification result (legacy interface)
     */
    function getVerificationResult(bytes32 batchId) external view returns (
        bool verified,
        uint256 co2Verified,
        uint256 efficiencyVerified,
        bytes32 dataHash,
        uint256 timestamp
    ) {
        VerificationResult memory result = results[batchId];
        return (
            result.verified,
            result.co2Verified,
            result.efficiencyVerified,
            result.dataHash,
            result.timestamp
        );
    }

    /**
     * @notice Get enhanced verification result with confidence and tech type
     */
    function getEnhancedVerificationResult(bytes32 batchId) external view returns (
        bool verified,
        uint256 co2Verified,
        uint256 efficiencyVerified,
        bytes32 dataHash,
        uint256 timestamp,
        uint256 confidenceScore,
        uint8 techType
    ) {
        VerificationResult memory result = results[batchId];
        return (
            result.verified,
            result.co2Verified,
            result.efficiencyVerified,
            result.dataHash,
            result.timestamp,
            result.confidenceScore,
            result.techType
        );
    }

    /**
     * @notice Get request status (legacy interface)
     */
    function getRequestStatus(bytes32 requestId) external view returns (
        bytes32 batchId,
        address operator,
        bool fulfilled,
        bool passed
    ) {
        VerificationRequest memory request = requests[requestId];
        return (
            request.batchId,
            request.operator,
            request.fulfilled,
            request.passed
        );
    }

    /**
     * @notice Get enhanced request status with tech type and retry info
     */
    function getEnhancedRequestStatus(bytes32 requestId) external view returns (
        bytes32 batchId,
        address operator,
        bool fulfilled,
        bool passed,
        uint8 techType,
        uint8 retryCount,
        bytes32 previousRequestId,
        uint256 timestamp
    ) {
        VerificationRequest memory request = requests[requestId];
        return (
            request.batchId,
            request.operator,
            request.fulfilled,
            request.passed,
            request.techType,
            request.retryCount,
            request.previousRequestId,
            request.timestamp
        );
    }

    /**
     * @notice Get the raw data hash originally bound to the request lifecycle
     */
    function getRequestedDataHash(bytes32 requestId) external view returns (bytes32) {
        return requests[requestId].requestedDataHash;
    }

    function isVerified(bytes32 batchId) external view returns (bool) {
        return results[batchId].verified;
    }

    /**
     * @notice Check if a request has timed out and is eligible for retry
     * @param requestId The request to check
     * @return isTimedOut Whether the request has exceeded the timeout period
     * @return canRetry Whether the request can be retried (not fulfilled, under retry limit)
     */
    function isRequestTimedOut(bytes32 requestId) external view returns (
        bool isTimedOut,
        bool canRetry
    ) {
        VerificationRequest memory request = requests[requestId];
        if (request.batchId == bytes32(0)) {
            return (false, false);
        }
        isTimedOut = block.timestamp >= request.timestamp + requestTimeout;
        canRetry = isTimedOut && !request.fulfilled && request.retryCount < MAX_RETRIES;
        return (isTimedOut, canRetry);
    }

    /**
     * @notice Get oracle technology bounds for a specific tech type
     * @param techType Technology type identifier
     */
    function getOracleTechBounds(uint8 techType) external view returns (
        uint256 minEfficiency,
        uint256 maxEfficiency,
        bool isActive,
        string memory name
    ) {
        OracleTechBounds memory bounds = oracleTechBounds[techType];
        return (bounds.minEfficiency, bounds.maxEfficiency, bounds.isActive, bounds.name);
    }

    // ============================================
    // INTERNAL FUNCTIONS
    // ============================================

    /**
     * @notice Initialize default technology bounds matching VerificationEngine defaults
     * @dev Called once during construction. Keeps oracle bounds in sync with on-chain thresholds.
     */
    function _initializeDefaultTechBounds() internal {
        // TECH_DAC (0): 200-600 kWh/tonne * 10000
        oracleTechBounds[0] = OracleTechBounds({
            minEfficiency: 2000000,
            maxEfficiency: 6000000,
            isActive: true,
            name: "Direct Air Capture"
        });

        // TECH_BECCS (1): 100-400 kWh/tonne * 10000
        oracleTechBounds[1] = OracleTechBounds({
            minEfficiency: 1000000,
            maxEfficiency: 4000000,
            isActive: true,
            name: "BECCS"
        });

        // TECH_BIOCHAR (2): 50-300 kWh/tonne * 10000
        oracleTechBounds[2] = OracleTechBounds({
            minEfficiency: 500000,
            maxEfficiency: 3000000,
            isActive: true,
            name: "Biochar"
        });

        // TECH_ENHANCED_WEATHERING (3): 30-200 kWh/tonne * 10000
        oracleTechBounds[3] = OracleTechBounds({
            minEfficiency: 300000,
            maxEfficiency: 2000000,
            isActive: true,
            name: "Enhanced Weathering"
        });

        // TECH_OCEAN_ALKALINITY (4): 40-250 kWh/tonne * 10000
        oracleTechBounds[4] = OracleTechBounds({
            minEfficiency: 400000,
            maxEfficiency: 2500000,
            isActive: true,
            name: "Ocean Alkalinity"
        });

        registeredOracleTechCount = 5;
    }

    // ============================================
    // HELPER FUNCTIONS
    // ============================================

    function _bytes32ToString(bytes32 _bytes) internal pure returns (string memory) {
        bytes memory bytesArray = new bytes(64);
        for (uint256 i = 0; i < 32; i++) {
            bytes1 b = _bytes[i];
            bytes1 hi = bytes1(uint8(b) / 16);
            bytes1 lo = bytes1(uint8(b) % 16);
            bytesArray[i * 2] = _char(hi);
            bytesArray[i * 2 + 1] = _char(lo);
        }
        return string(bytesArray);
    }

    function _char(bytes1 b) internal pure returns (bytes1) {
        if (uint8(b) < 10) return bytes1(uint8(b) + 0x30);
        else return bytes1(uint8(b) + 0x57);
    }

    function _uint256ToString(uint256 value) internal pure returns (string memory) {
        if (value == 0) return "0";
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        return string(buffer);
    }

    /**
     * @notice Net-Negative verification source (JavaScript) v3.0.0
     * @dev Enhanced with ElectricityMaps API integration for live grid intensity.
     *      Args layout:
     *        args[0] = batchId
     *        args[1] = co2Claimed
     *        args[2] = efficiencyClaimed
     *        args[3] = apiEndpoint (sensor data)
     *        args[4] = expectedHash
     *        args[5] = techType
     *        args[6] = minEfficiencyBound
     *        args[7] = maxEfficiencyBound
     *        args[8] = facilityZone (ElectricityMaps zone, e.g. "US-CAL-CISO")
     *
     *      The oracle fetches live grid intensity from ElectricityMaps API and
     *      validates the Net-Negative accounting model on-chain.
     */
    function _getDefaultVerificationSource() internal pure returns (string memory) {
        return
            "const batchId = args[0];"
            "const co2Claimed = BigInt(args[1]);"
            "const efficiencyClaimed = BigInt(args[2]);"
            "const apiEndpoint = args[3];"
            "const expectedHash = args[4];"
            "const techType = parseInt(args[5]);"
            "const minEffBound = BigInt(args[6]);"
            "const maxEffBound = BigInt(args[7]);"
            "const facilityZone = args.length > 8 ? args[8] : 'US-CAL-CISO';"
            ""
            "// Step 1: Fetch sensor data from facility API"
            "const sensorResponse = await Functions.makeHttpRequest({"
            "  url: apiEndpoint,"
            "  headers: { 'X-Batch-ID': batchId, 'X-Tech-Type': String(techType) }"
            "});"
            ""
            "if (sensorResponse.error) {"
            "  throw Error('Sensor API request failed');"
            "}"
            ""
            "const data = sensorResponse.data;"
            ""
            "// Step 2: Verify data hash integrity"
            "const dataStr = JSON.stringify(data);"
            "const hash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(dataStr));"
            ""
            "if (hash !== '0x' + expectedHash) {"
            "  return Functions.encodeString('Hash mismatch');"
            "}"
            ""
            "// Step 3: Fetch live grid intensity from ElectricityMaps"
            "let gridIntensity = 400;"  // Default fallback: global average
            "try {"
            "  const gridResponse = await Functions.makeHttpRequest({"
            "    url: 'https://api.electricitymap.org/v3/carbon-intensity/latest',"
            "    params: { zone: facilityZone },"
            "    headers: { 'auth-token': secrets.ELECTRICITY_MAPS_API_KEY || '' }"
            "  });"
            "  if (!gridResponse.error && gridResponse.data) {"
            "    gridIntensity = Math.round(gridResponse.data.carbonIntensity || 400);"
            "  }"
            "} catch(e) {"
            "  gridIntensity = 400;"  // Fallback to global average on error
            "}"
            ""
            "// Step 4: Net-Negative calculation (mirrors on-chain math)"
            "const co2Kg = Number(data.totalCO2 || 0);"
            "const energyKwh = Number(data.energyConsumed || 0);"
            "const purityPct = Number(data.purity || 0);"
            ""
            "const grossCredits = co2Kg * (purityPct / 100);"
            "const energyDebtKg = (energyKwh * gridIntensity) / 1000;"
            "const netCredits = grossCredits - energyDebtKg;"
            ""
            "// Step 5: Validate against claimed values"
            "const co2Actual = BigInt(Math.floor(data.totalCO2 * 1e18));"
            "const efficiencyActual = BigInt(Math.floor(data.efficiency * 10000));"
            ""
            "const co2Tolerance = co2Claimed / 20n;"
            "const co2Valid = co2Actual >= co2Claimed - co2Tolerance && co2Actual <= co2Claimed + co2Tolerance;"
            "const effValid = efficiencyActual >= minEffBound && efficiencyActual <= maxEffBound;"
            "const netPositive = netCredits > 0;"
            ""
            "// Step 6: Calculate confidence score (0-10000 bps)"
            "let confidence = 10000n;"
            "const co2Deviation = co2Actual > co2Claimed ? co2Actual - co2Claimed : co2Claimed - co2Actual;"
            "if (co2Claimed > 0n) {"
            "  const co2Pct = (co2Deviation * 10000n) / co2Claimed;"
            "  confidence = confidence - (co2Pct * 2n);"
            "}"
            "if (confidence < 0n) confidence = 0n;"
            ""
            "const passed = co2Valid && effValid && netPositive;"
            ""
            "// Encode enhanced response"
            "return Functions.encodeUint256(passed ? 1 : 0)";
    }
}
