// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

/**
 * @title ICarbonFutures
 * @notice Interface for the TerraQura Carbon Credit Forward Contracts
 */
interface ICarbonFutures {
    enum FutureStatus {
        Open,
        Filled,
        Settled,
        Defaulted,
        Cancelled
    }

    struct Future {
        uint256 id;
        uint256 creditId;
        uint256 amount;
        uint256 pricePerUnit;
        address seller;
        address buyer;
        uint256 maturityTimestamp;
        uint256 collateral;
        FutureStatus status;
    }

    event FutureCreated(uint256 indexed futureId, uint256 indexed creditId, address indexed seller, uint256 amount, uint256 pricePerUnit, uint256 maturityTimestamp);
    event FutureFilled(uint256 indexed futureId, address indexed buyer);
    event FutureSettled(uint256 indexed futureId);
    event FutureDefaulted(uint256 indexed futureId, uint256 collateralSlashed);
    event FutureCancelled(uint256 indexed futureId);

    function createFuture(uint256 creditId, uint256 amount, uint256 pricePerUnit, uint256 maturityTimestamp, uint256 collateralBps) external payable returns (uint256 futureId);
    function buyFuture(uint256 futureId) external payable;
    function settleFuture(uint256 futureId) external;
    function defaultFuture(uint256 futureId) external;
    function cancelFuture(uint256 futureId) external;
}
