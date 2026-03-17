/**
 * Solidity Coverage Configuration
 *
 * @notice Configuration for enterprise-grade coverage reporting
 *
 * AUDIT DOCUMENTATION:
 * ====================
 *
 * 1. MOCKS (Excluded from coverage):
 *    - Mock contracts are test utilities, not production code
 *    - They simulate external dependencies for testing
 *    - Coverage of mocks is not meaningful for security audits
 *
 * 2. KNOWN UNCOVERED BRANCHES (Documented Waivers):
 *
 *    a) GaslessMarketplace._msgData() [lines 153-158]:
 *       - Standard OpenZeppelin ERC-2771 boilerplate
 *       - Function exists for ERC-2771 compliance but is not called
 *         by any function in this contract (only _msgSender is used)
 *       - The logic is identical to OpenZeppelin's ERC2771Context
 *       - Waiver Reason: Library code, not custom logic
 *
 *    b) EfficiencyCalculator [lines 73, 119]:
 *       - Defensive programming branches that are mathematically
 *         unreachable with valid uint8 inputs and standard scale values
 *       - Kept for safety in case parameters change in future
 *       - Waiver Reason: Defensive code, mathematically proven unreachable
 *
 *    c) TerraQuraMultisig.executeTransaction [line 307]:
 *       - Fallback revert when external call fails without error data
 *       - Difficult to trigger in tests as most contracts return error data
 *       - Waiver Reason: Edge case in error handling
 */
module.exports = {
  skipFiles: [
    // Test utilities - not production code
    'mocks/AccessControlTestHelper.sol',
    'mocks/MockChainlinkRouter.sol',
    'mocks/MockERC1155.sol',
    'mocks/MockFunctionsRouter.sol',
    'mocks/ModifierTestContract.sol',
    'mocks/GaslessHarness.sol',
    'mocks/SilentReverter.sol',
    'mocks/MintRejector.sol',
    // Keep EfficiencyCalculatorTest as it's used for testing the library
  ],
  mocha: {
    timeout: 200000,
  },
  // Optimize for large contracts
  configureYulOptimizer: true,
};
