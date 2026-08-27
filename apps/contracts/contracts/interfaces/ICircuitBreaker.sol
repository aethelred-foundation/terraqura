// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface ICircuitBreaker {
    function checkRateLimit(address contractAddr) external returns (bool allowed);

    function checkVolumeLimit(address contractAddr, uint256 volume) external returns (bool allowed);

    function isOperationAllowed(address contractAddr) external view returns (bool);

    function isContractRegistered(address contractAddr) external view returns (bool);
}
