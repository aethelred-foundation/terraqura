// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/metatx/MinimalForwarder.sol";

/**
 * @title TerraQuraForwarder
 * @dev Trusted Forwarder for Gasless Meta-Transactions (OpenZeppelin v4 Standard)
 */
contract TerraQuraForwarder is MinimalForwarder {
    constructor() MinimalForwarder() {}
}
