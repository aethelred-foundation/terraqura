// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../interfaces/IKycRegistry.sol";

/**
 * @title MockKycRegistry
 * @notice Settable IKycRegistry for testing marketplace registry delegation.
 */
contract MockKycRegistry is IKycRegistry {
    mapping(address => bool) public verified;

    function setVerified(address account, bool status) external {
        verified[account] = status;
    }

    function isKycVerified(address account) external view override returns (bool) {
        return verified[account];
    }
}
