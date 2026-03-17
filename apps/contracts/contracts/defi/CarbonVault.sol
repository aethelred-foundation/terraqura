// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC1155/IERC1155Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC1155/utils/ERC1155HolderUpgradeable.sol";
import "../interfaces/ICarbonVault.sol";
import "../access/TerraQuraAccessControl.sol";

/**
 * @title CarbonVault
 * @author TerraQura
 * @notice Staking vault for carbon credits to earn AETH rewards
 * @dev Uses Synthetix StakingRewards pattern: rewardPerTokenStored / userRewardPerTokenPaid.
 *      UUPS upgradeable with TerraQuraAccessControl RBAC.
 */
contract CarbonVault is
    Initializable,
    ReentrancyGuardUpgradeable,
    PausableUpgradeable,
    UUPSUpgradeable,
    ERC1155HolderUpgradeable,
    ICarbonVault
{
    // ============================================
    // STATE
    // ============================================

    TerraQuraAccessControl public accessControl;
    IERC1155Upgradeable public carbonCredit;

    uint256 public nextVaultId;

    struct Vault {
        uint256 creditId;
        uint256 totalStaked;
        uint256 rewardRate; // AETH wei per second
        uint256 lockPeriod; // seconds
        uint256 lastUpdateTime;
        uint256 rewardPerTokenStored; // scaled by 1e18
    }

    struct StakeInfo {
        uint256 amount;
        uint256 startTime;
        uint256 rewardDebt; // userRewardPerTokenPaid (scaled by 1e18)
        uint256 pendingReward; // accumulated but unclaimed
    }

    /// @notice Vault storage
    mapping(uint256 => Vault) public vaults;

    /// @notice User stakes: vaultId => user => StakeInfo
    mapping(uint256 => mapping(address => StakeInfo)) public userStakes;

    // ============================================
    // ERRORS
    // ============================================

    error VaultNotFound(uint256 vaultId);
    error ZeroAmount();
    error LockPeriodActive(uint256 unlockTime);
    error InsufficientStake();
    error NoRewards();
    error TransferFailed();
    error Unauthorized();

    // ============================================
    // INITIALIZER
    // ============================================

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address _accessControl,
        address _carbonCredit
    ) public initializer {
        __ReentrancyGuard_init();
        __Pausable_init();
        __UUPSUpgradeable_init();
        __ERC1155Holder_init();

        accessControl = TerraQuraAccessControl(_accessControl);
        carbonCredit = IERC1155Upgradeable(_carbonCredit);
        nextVaultId = 1;
    }

    // ============================================
    // MODIFIERS
    // ============================================

    modifier vaultExists(uint256 vaultId) {
        if (vaults[vaultId].rewardRate == 0 && vaults[vaultId].lastUpdateTime == 0) revert VaultNotFound(vaultId);
        _;
    }

    modifier updateReward(uint256 vaultId, address account) {
        Vault storage vault = vaults[vaultId];
        vault.rewardPerTokenStored = _rewardPerToken(vaultId);
        vault.lastUpdateTime = block.timestamp;

        if (account != address(0)) {
            StakeInfo storage info = userStakes[vaultId][account];
            info.pendingReward = _earned(vaultId, account);
            info.rewardDebt = vault.rewardPerTokenStored;
        }
        _;
    }

    // ============================================
    // VAULT MANAGEMENT
    // ============================================

    /**
     * @inheritdoc ICarbonVault
     */
    function createVault(
        uint256 creditId,
        uint256 rewardRate,
        uint256 lockPeriod
    ) external {
        if (!accessControl.hasRole(accessControl.ADMIN_ROLE(), msg.sender)) revert Unauthorized();

        uint256 vaultId = nextVaultId++;

        vaults[vaultId] = Vault({
            creditId: creditId,
            totalStaked: 0,
            rewardRate: rewardRate,
            lockPeriod: lockPeriod,
            lastUpdateTime: block.timestamp,
            rewardPerTokenStored: 0
        });

        emit VaultCreated(vaultId, creditId, rewardRate, lockPeriod);
    }

    // ============================================
    // STAKING
    // ============================================

    /**
     * @inheritdoc ICarbonVault
     */
    function stake(
        uint256 vaultId,
        uint256 amount
    ) external whenNotPaused nonReentrant vaultExists(vaultId) updateReward(vaultId, msg.sender) {
        Vault storage vault = vaults[vaultId];
        if (amount == 0) revert ZeroAmount();

        // Transfer credits from user
        carbonCredit.safeTransferFrom(msg.sender, address(this), vault.creditId, amount, "");

        StakeInfo storage info = userStakes[vaultId][msg.sender];
        info.amount += amount;
        info.startTime = block.timestamp;
        vault.totalStaked += amount;

        emit Staked(vaultId, msg.sender, amount);
    }

    /**
     * @inheritdoc ICarbonVault
     */
    function unstake(
        uint256 vaultId,
        uint256 amount
    ) external whenNotPaused nonReentrant vaultExists(vaultId) updateReward(vaultId, msg.sender) {
        Vault storage vault = vaults[vaultId];
        if (amount == 0) revert ZeroAmount();

        StakeInfo storage info = userStakes[vaultId][msg.sender];
        if (info.amount < amount) revert InsufficientStake();

        // Enforce lock period
        uint256 unlockTime = info.startTime + vault.lockPeriod;
        if (block.timestamp < unlockTime) revert LockPeriodActive(unlockTime);

        info.amount -= amount;
        vault.totalStaked -= amount;

        // Transfer credits back
        carbonCredit.safeTransferFrom(address(this), msg.sender, vault.creditId, amount, "");

        emit Unstaked(vaultId, msg.sender, amount);
    }

    /**
     * @notice Emergency withdraw — forfeits all pending rewards
     * @param vaultId The vault to withdraw from
     */
    function emergencyWithdraw(uint256 vaultId) external nonReentrant {
        Vault storage vault = vaults[vaultId];
        StakeInfo storage info = userStakes[vaultId][msg.sender];

        uint256 amount = info.amount;
        if (amount == 0) revert ZeroAmount();

        // Reset user state (forfeit rewards)
        info.amount = 0;
        info.pendingReward = 0;
        info.rewardDebt = 0;
        vault.totalStaked -= amount;

        // Transfer credits back
        carbonCredit.safeTransferFrom(address(this), msg.sender, vault.creditId, amount, "");

        emit Unstaked(vaultId, msg.sender, amount);
    }

    // ============================================
    // REWARDS
    // ============================================

    /**
     * @inheritdoc ICarbonVault
     */
    function claimRewards(
        uint256 vaultId
    ) external whenNotPaused nonReentrant updateReward(vaultId, msg.sender) returns (uint256 rewards) {
        StakeInfo storage info = userStakes[vaultId][msg.sender];
        rewards = info.pendingReward;
        if (rewards == 0) revert NoRewards();

        info.pendingReward = 0;

        (bool success, ) = msg.sender.call{value: rewards}("");
        if (!success) revert TransferFailed();

        emit RewardsClaimed(vaultId, msg.sender, rewards);
    }

    /**
     * @inheritdoc ICarbonVault
     */
    function pendingRewards(uint256 vaultId, address user) external view returns (uint256) {
        return _earned(vaultId, user);
    }

    // ============================================
    // VIEW HELPERS
    // ============================================

    function getVaultInfo(uint256 vaultId) external view returns (VaultInfo memory) {
        Vault storage v = vaults[vaultId];
        return VaultInfo({
            creditId: v.creditId,
            totalStaked: v.totalStaked,
            rewardRate: v.rewardRate,
            lockPeriod: v.lockPeriod,
            lastUpdateTime: v.lastUpdateTime,
            rewardPerTokenStored: v.rewardPerTokenStored
        });
    }

    function getUserStake(uint256 vaultId, address user) external view returns (uint256 amount, uint256 startTime) {
        StakeInfo storage info = userStakes[vaultId][user];
        return (info.amount, info.startTime);
    }

    // ============================================
    // ADMIN
    // ============================================

    /**
     * @notice Fund the vault with AETH for rewards
     */
    function fundRewards() external payable {}

    function pause() external {
        if (!accessControl.hasRole(accessControl.PAUSER_ROLE(), msg.sender)) revert Unauthorized();
        _pause();
    }

    function unpause() external {
        if (!accessControl.hasRole(accessControl.ADMIN_ROLE(), msg.sender)) revert Unauthorized();
        _unpause();
    }

    // ============================================
    // INTERNAL
    // ============================================

    function _rewardPerToken(uint256 vaultId) internal view returns (uint256) {
        Vault storage vault = vaults[vaultId];
        if (vault.totalStaked == 0) {
            return vault.rewardPerTokenStored;
        }
        uint256 elapsed = block.timestamp - vault.lastUpdateTime;
        return vault.rewardPerTokenStored + ((elapsed * vault.rewardRate * 1e18) / vault.totalStaked);
    }

    function _earned(uint256 vaultId, address account) internal view returns (uint256) {
        StakeInfo storage info = userStakes[vaultId][account];
        uint256 currentRewardPerToken = _rewardPerToken(vaultId);
        return ((info.amount * (currentRewardPerToken - info.rewardDebt)) / 1e18) + info.pendingReward;
    }

    function _authorizeUpgrade(address) internal view override {
        if (!accessControl.hasRole(accessControl.UPGRADER_ROLE(), msg.sender)) revert Unauthorized();
    }

    /**
     * @dev Required to receive AETH for reward funding
     */
    receive() external payable {}
}
