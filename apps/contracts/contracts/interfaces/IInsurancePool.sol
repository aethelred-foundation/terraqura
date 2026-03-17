// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

/**
 * @title IInsurancePool
 * @notice Interface for the TerraQura Carbon Reversal Insurance Pool
 */
interface IInsurancePool {
    enum PolicyStatus { Active, Expired, Claimed, PaidOut }
    enum ClaimStatus { Filed, Approved, Rejected, PaidOut }
    enum Methodology { DAC, Biochar, Forestry, BECCS }

    struct Policy {
        uint256 id;
        uint256 creditId;
        address holder;
        uint256 coverageAmount;
        uint256 premium;
        uint256 startTime;
        uint256 endTime;
        PolicyStatus status;
    }

    struct Claim {
        uint256 id;
        uint256 policyId;
        address claimant;
        bytes evidence;
        ClaimStatus status;
        uint256 timestamp;
    }

    event PolicyCreated(uint256 indexed policyId, uint256 indexed creditId, address indexed holder, uint256 coverageAmount, uint256 premium, uint256 endTime);
    event ClaimFiled(uint256 indexed claimId, uint256 indexed policyId, address indexed claimant);
    event ClaimProcessed(uint256 indexed claimId, bool approved);
    event Payout(uint256 indexed claimId, address indexed recipient, uint256 amount);
    event PoolDeposit(address indexed depositor, uint256 amount);
    event PoolWithdraw(address indexed depositor, uint256 amount);

    function createPolicy(uint256 creditId, uint256 coverageAmount, uint256 durationDays, Methodology methodology) external payable returns (uint256 policyId);
    function fileClaim(uint256 policyId, bytes calldata evidence) external returns (uint256 claimId);
    function processClaim(uint256 claimId, bool approved) external;
    function payout(uint256 claimId) external;
    function depositToPool() external payable;
    function withdrawFromPool(uint256 amount) external;
}
