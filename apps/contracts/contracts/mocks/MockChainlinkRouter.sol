// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IFunctionsRouter} from "@chainlink/contracts/src/v0.8/functions/v1_0_0/interfaces/IFunctionsRouter.sol";
import {IFunctionsClient} from "@chainlink/contracts/src/v0.8/functions/v1_0_0/interfaces/IFunctionsClient.sol";

/**
 * @title MockChainlinkRouter
 * @notice Mock Chainlink Functions Router for testing
 * @dev Simulates Chainlink Functions behavior for unit tests
 */
contract MockChainlinkRouter {
    uint256 private _requestCounter;

    // Store pending requests
    struct PendingRequest {
        address caller;
        bytes data;
        uint64 subscriptionId;
        uint32 callbackGasLimit;
        bytes32 donId;
    }

    mapping(bytes32 => PendingRequest) public pendingRequests;
    bytes32[] public requestIds;

    // Events
    event RequestSent(
        bytes32 indexed requestId,
        address indexed caller,
        uint64 subscriptionId
    );

    event RequestFulfilled(
        bytes32 indexed requestId,
        bool success
    );

    /**
     * @notice Simulates sending a request (matching IFunctionsRouter interface)
     */
    function sendRequest(
        uint64 subscriptionId,
        bytes calldata data,
        uint16 /* dataVersion */,
        uint32 callbackGasLimit,
        bytes32 donId
    ) external returns (bytes32) {
        _requestCounter++;
        bytes32 requestId = keccak256(abi.encodePacked(msg.sender, _requestCounter, block.timestamp));

        pendingRequests[requestId] = PendingRequest({
            caller: msg.sender,
            data: data,
            subscriptionId: subscriptionId,
            callbackGasLimit: callbackGasLimit,
            donId: donId
        });

        requestIds.push(requestId);

        emit RequestSent(requestId, msg.sender, subscriptionId);

        return requestId;
    }

    /**
     * @notice Fulfill a request with success response (for testing)
     * @param requestId The request to fulfill
     * @param response The response data
     */
    function fulfillRequestWithResponse(
        bytes32 requestId,
        bytes calldata response
    ) external {
        PendingRequest memory request = pendingRequests[requestId];
        require(request.caller != address(0), "Request not found");

        // Call handleOracleFulfillment on the original caller
        IFunctionsClient(request.caller).handleOracleFulfillment(
            requestId,
            response,
            ""
        );

        emit RequestFulfilled(requestId, true);
        delete pendingRequests[requestId];
    }

    /**
     * @notice Fulfill a request with error (for testing)
     * @param requestId The request to fulfill
     * @param errorBytes The error data
     */
    function fulfillRequestWithError(
        bytes32 requestId,
        bytes calldata errorBytes
    ) external {
        PendingRequest memory request = pendingRequests[requestId];
        require(request.caller != address(0), "Request not found");

        // Call handleOracleFulfillment on the original caller with error
        IFunctionsClient(request.caller).handleOracleFulfillment(
            requestId,
            "",
            errorBytes
        );

        emit RequestFulfilled(requestId, false);
        delete pendingRequests[requestId];
    }

    /**
     * @notice Get the number of pending requests
     */
    function getPendingRequestCount() external view returns (uint256) {
        uint256 count = 0;
        for (uint256 i = 0; i < requestIds.length; i++) {
            if (pendingRequests[requestIds[i]].caller != address(0)) {
                count++;
            }
        }
        return count;
    }

    /**
     * @notice Get all request IDs
     */
    function getAllRequestIds() external view returns (bytes32[] memory) {
        return requestIds;
    }

    /**
     * @notice Get the latest request ID
     */
    function getLatestRequestId() external view returns (bytes32) {
        require(requestIds.length > 0, "No requests");
        return requestIds[requestIds.length - 1];
    }

    /**
     * @notice Get request details
     */
    function getRequest(bytes32 requestId) external view returns (
        address caller,
        uint64 subscriptionId,
        uint32 callbackGasLimit,
        bytes32 donId
    ) {
        PendingRequest memory request = pendingRequests[requestId];
        return (
            request.caller,
            request.subscriptionId,
            request.callbackGasLimit,
            request.donId
        );
    }

    /**
     * @notice Directly call handleOracleFulfillment on a target contract
     * @dev Used for fault injection testing to trigger error paths like
     *      RequestNotFound and RequestAlreadyFulfilled
     * @param target The contract to call
     * @param requestId The request ID to fulfill
     * @param response The response data
     * @param err The error data
     */
    function directFulfillment(
        address target,
        bytes32 requestId,
        bytes calldata response,
        bytes calldata err
    ) external {
        IFunctionsClient(target).handleOracleFulfillment(requestId, response, err);
    }

    /**
     * @notice Fulfill a request twice to test RequestAlreadyFulfilled error
     * @param requestId The request to fulfill twice
     * @param response The response data
     */
    function fulfillRequestTwice(
        bytes32 requestId,
        bytes calldata response
    ) external {
        PendingRequest memory request = pendingRequests[requestId];
        require(request.caller != address(0), "Request not found");

        // First fulfillment
        IFunctionsClient(request.caller).handleOracleFulfillment(
            requestId,
            response,
            ""
        );

        // Second fulfillment - should trigger RequestAlreadyFulfilled
        IFunctionsClient(request.caller).handleOracleFulfillment(
            requestId,
            response,
            ""
        );
    }
}
