// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title MockFunctionsRouter
 * @notice Mock Chainlink Functions Router for testing
 * @dev Simulates Chainlink Functions behavior for unit tests
 */
contract MockFunctionsRouter {
    uint256 private _requestCounter;

    // Store pending requests
    struct PendingRequest {
        address caller;
        bytes data;
        uint64 subscriptionId;
        uint32 gasLimit;
        bytes32 donId;
    }

    mapping(bytes32 => PendingRequest) public pendingRequests;
    bytes32[] public requestIds;

    event RequestSent(
        bytes32 indexed requestId,
        address indexed caller,
        uint64 subscriptionId
    );

    /**
     * @notice Simulates sending a request
     */
    function sendRequest(
        uint64 subscriptionId,
        bytes calldata data,
        uint16 /* dataVersion */,
        uint32 gasLimit,
        bytes32 donId
    ) external returns (bytes32) {
        _requestCounter++;
        bytes32 requestId = keccak256(abi.encodePacked(msg.sender, _requestCounter, block.timestamp));

        pendingRequests[requestId] = PendingRequest({
            caller: msg.sender,
            data: data,
            subscriptionId: subscriptionId,
            gasLimit: gasLimit,
            donId: donId
        });

        requestIds.push(requestId);

        emit RequestSent(requestId, msg.sender, subscriptionId);

        return requestId;
    }

    /**
     * @notice Fulfill a request (for testing)
     * @param requestId The request to fulfill
     * @param response The response data
     * @param err Any error bytes
     */
    function fulfillRequest(
        bytes32 requestId,
        bytes calldata response,
        bytes calldata err
    ) external {
        PendingRequest memory request = pendingRequests[requestId];
        require(request.caller != address(0), "Request not found");

        // Call fulfillRequest on the original caller
        (bool success, ) = request.caller.call(
            abi.encodeWithSignature(
                "handleOracleFulfillment(bytes32,bytes,bytes)",
                requestId,
                response,
                err
            )
        );
        require(success, "Fulfillment failed");

        delete pendingRequests[requestId];
    }

    /**
     * @notice Get the number of pending requests
     */
    function getPendingRequestCount() external view returns (uint256) {
        return requestIds.length;
    }

    /**
     * @notice Get a request ID by index
     */
    function getRequestId(uint256 index) external view returns (bytes32) {
        require(index < requestIds.length, "Index out of bounds");
        return requestIds[index];
    }
}
