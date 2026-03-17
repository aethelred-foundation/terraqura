// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

/**
 * @title IRewardDistributor
 * @notice Interface for the TerraQura Reward Distributor
 */
interface IRewardDistributor {
    enum RewardType { Verification, Staking, Retirement, Referral, EarlyAdopter }

    struct Campaign {
        uint256 id;
        string name;
        uint256 totalReward;
        uint256 claimed;
        uint256 startTime;
        uint256 endTime;
        RewardType rewardType;
        uint256 totalShares;
        bytes32 merkleRoot;
        bool active;
    }

    event CampaignCreated(uint256 indexed campaignId, string name, uint256 totalReward, RewardType rewardType);
    event RecipientAdded(uint256 indexed campaignId, address indexed recipient, uint256 share);
    event RewardClaimed(uint256 indexed campaignId, address indexed recipient, uint256 amount);
    event MerkleRootSet(uint256 indexed campaignId, bytes32 merkleRoot);

    function createCampaign(string calldata name, uint256 totalReward, uint256 startTime, uint256 endTime, RewardType rewardType) external payable returns (uint256 campaignId);
    function addRecipient(uint256 campaignId, address recipient, uint256 share) external;
    function addRecipientBatch(uint256 campaignId, address[] calldata recipients, uint256[] calldata shares) external;
    function claim(uint256 campaignId) external returns (uint256 amount);
    function getClaimable(uint256 campaignId, address recipient) external view returns (uint256);
    function setMerkleRoot(uint256 campaignId, bytes32 root) external;
    function claimMerkle(uint256 campaignId, uint256 amount, bytes32[] calldata proof) external;
}
