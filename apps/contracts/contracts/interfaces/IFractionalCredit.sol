// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

/**
 * @title IFractionalCredit
 * @notice Interface for the TerraQura Fractional Carbon Credit ERC-20 Wrapper
 */
interface IFractionalCredit {
    event Wrapped(address indexed user, uint256 indexed creditId, uint256 amount, uint256 erc20Amount);
    event Unwrapped(address indexed user, uint256 indexed creditId, uint256 amount, uint256 erc20Amount);

    function wrap(uint256 creditId, uint256 amount) external returns (uint256 erc20Amount);
    function unwrap(uint256 amount) external;
    function getWrappedCreditId() external view returns (uint256);
    function totalWrapped() external view returns (uint256);
}
