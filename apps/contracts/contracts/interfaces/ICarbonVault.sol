// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

/**
 * @title ICarbonVault
 * @notice Interface for the TerraQura Carbon Credit Staking Vault
 */
interface ICarbonVault {
    struct VaultInfo {
        uint256 creditId;
        uint256 totalStaked;
        uint256 rewardRate;
        uint256 lockPeriod;
        uint256 lastUpdateTime;
        uint256 rewardPerTokenStored;
    }

    struct UserStake {
        uint256 amount;
        uint256 startTime;
        uint256 rewardDebt;
    }

    event VaultCreated(uint256 indexed vaultId, uint256 indexed creditId, uint256 rewardRate, uint256 lockPeriod);
    event Staked(uint256 indexed vaultId, address indexed user, uint256 amount);
    event Unstaked(uint256 indexed vaultId, address indexed user, uint256 amount);
    event RewardsClaimed(uint256 indexed vaultId, address indexed user, uint256 rewards);

    function createVault(uint256 creditId, uint256 rewardRate, uint256 lockPeriod) external;
    function stake(uint256 vaultId, uint256 amount) external;
    function unstake(uint256 vaultId, uint256 amount) external;
    function claimRewards(uint256 vaultId) external returns (uint256 rewards);
    function pendingRewards(uint256 vaultId, address user) external view returns (uint256);
}
