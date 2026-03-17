// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

/**
 * @title ICarbonAMM
 * @notice Interface for the TerraQura Carbon Credit Automated Market Maker
 */
interface ICarbonAMM {
    struct PoolInfo {
        uint256 creditId;
        uint256 aethReserve;
        uint256 creditReserve;
        uint256 totalLpSupply;
        uint256 feeRate;
        address creator;
    }

    event PoolCreated(uint256 indexed poolId, uint256 indexed creditId, address indexed creator);
    event LiquidityAdded(uint256 indexed poolId, address indexed provider, uint256 aethAmount, uint256 creditAmount, uint256 lpTokens);
    event LiquidityRemoved(uint256 indexed poolId, address indexed provider, uint256 aethAmount, uint256 creditAmount, uint256 lpTokens);
    event Swap(uint256 indexed poolId, address indexed trader, bool aethToCredit, uint256 amountIn, uint256 amountOut);
    event FeesCollected(uint256 indexed poolId, uint256 lpFee, uint256 protocolFee);

    function createPool(uint256 creditId) external returns (uint256 poolId);
    function addLiquidity(uint256 poolId, uint256 creditAmount, uint256 minLpTokens) external payable returns (uint256 lpTokens);
    function removeLiquidity(uint256 poolId, uint256 lpTokens, uint256 minAeth, uint256 minCredits) external;
    function swapAethForCredits(uint256 poolId, uint256 minCreditsOut) external payable returns (uint256 creditsOut);
    function swapCreditsForAeth(uint256 poolId, uint256 creditAmount, uint256 minAethOut) external returns (uint256 aethOut);
    function getQuote(uint256 poolId, uint256 amountIn, bool aethToCredit) external view returns (uint256 amountOut);
    function getPoolInfo(uint256 poolId) external view returns (PoolInfo memory);
    function getSpotPrice(uint256 poolId) external view returns (uint256);
}
