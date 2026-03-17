// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/cryptography/MerkleProofUpgradeable.sol";
import "../access/TerraQuraAccessControl.sol";
import "../interfaces/IRewardDistributor.sol";

/**
 * @title RewardDistributor
 * @author TerraQura
 * @notice Distributes AETH rewards to verifiers, stakers, and early adopters
 *         with linear vesting and optional Merkle-proof-based airdrops.
 * @dev UUPS upgradeable, uses TerraQuraAccessControl for RBAC.
 */
contract RewardDistributor is
    Initializable,
    ReentrancyGuardUpgradeable,
    UUPSUpgradeable,
    IRewardDistributor
{
    // ============ State ============

    TerraQuraAccessControl public accessControl;

    uint256 private _nextCampaignId;

    mapping(uint256 => Campaign) public campaigns;

    // campaignId => recipient => share
    mapping(uint256 => mapping(address => uint256)) public recipientShares;

    // campaignId => recipient => claimed amount
    mapping(uint256 => mapping(address => uint256)) public claimedAmounts;

    // campaignId => recipient => merkle claimed
    mapping(uint256 => mapping(address => bool)) public merkleClaimed;

    // ============ Errors ============

    error Unauthorized();
    error InvalidTimePeriod();
    error InsufficientFunding();
    error CampaignNotActive();
    error CampaignNotStarted();
    error NothingToClaim();
    error InvalidProof();
    error AlreadyClaimed();
    error LengthMismatch();
    error ZeroAddress();
    error ZeroAmount();
    error ZeroShare();
    error MerkleRootNotSet();

    // ============ Modifiers ============

    modifier onlyAdmin() {
        if (!accessControl.hasRole(accessControl.ADMIN_ROLE(), msg.sender)) revert Unauthorized();
        _;
    }

    // ============ Initializer ============

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address _accessControl) public initializer {
        __ReentrancyGuard_init();
        __UUPSUpgradeable_init();

        accessControl = TerraQuraAccessControl(_accessControl);
        _nextCampaignId = 1;
    }

    // ============ Campaign Management ============

    /**
     * @inheritdoc IRewardDistributor
     */
    function createCampaign(
        string calldata name,
        uint256 totalReward,
        uint256 startTime,
        uint256 endTime,
        RewardType rewardType
    ) external payable override onlyAdmin returns (uint256 campaignId) {
        if (startTime >= endTime) revert InvalidTimePeriod();
        if (msg.value < totalReward) revert InsufficientFunding();
        if (totalReward == 0) revert ZeroAmount();

        campaignId = _nextCampaignId++;

        campaigns[campaignId] = Campaign({
            id: campaignId,
            name: name,
            totalReward: totalReward,
            claimed: 0,
            startTime: startTime,
            endTime: endTime,
            rewardType: rewardType,
            totalShares: 0,
            merkleRoot: bytes32(0),
            active: true
        });

        // Refund excess
        if (msg.value > totalReward) {
            (bool success, ) = msg.sender.call{value: msg.value - totalReward}("");
            require(success, "Refund failed");
        }

        emit CampaignCreated(campaignId, name, totalReward, rewardType);
    }

    /**
     * @inheritdoc IRewardDistributor
     */
    function addRecipient(
        uint256 campaignId,
        address recipient,
        uint256 share
    ) external override onlyAdmin {
        if (recipient == address(0)) revert ZeroAddress();
        if (share == 0) revert ZeroShare();
        if (!campaigns[campaignId].active) revert CampaignNotActive();

        recipientShares[campaignId][recipient] += share;
        campaigns[campaignId].totalShares += share;

        emit RecipientAdded(campaignId, recipient, share);
    }

    /**
     * @inheritdoc IRewardDistributor
     */
    function addRecipientBatch(
        uint256 campaignId,
        address[] calldata recipients,
        uint256[] calldata shares
    ) external override onlyAdmin {
        if (recipients.length != shares.length) revert LengthMismatch();
        if (!campaigns[campaignId].active) revert CampaignNotActive();

        Campaign storage campaign = campaigns[campaignId];

        for (uint256 i = 0; i < recipients.length; i++) {
            if (recipients[i] == address(0)) revert ZeroAddress();
            if (shares[i] == 0) revert ZeroShare();

            recipientShares[campaignId][recipients[i]] += shares[i];
            campaign.totalShares += shares[i];

            emit RecipientAdded(campaignId, recipients[i], shares[i]);
        }
    }

    // ============ Claiming ============

    /**
     * @inheritdoc IRewardDistributor
     */
    function claim(uint256 campaignId) external override nonReentrant returns (uint256 amount) {
        amount = getClaimable(campaignId, msg.sender);
        if (amount == 0) revert NothingToClaim();

        Campaign storage campaign = campaigns[campaignId];
        claimedAmounts[campaignId][msg.sender] += amount;
        campaign.claimed += amount;

        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "Transfer failed");

        emit RewardClaimed(campaignId, msg.sender, amount);
    }

    /**
     * @inheritdoc IRewardDistributor
     */
    function getClaimable(
        uint256 campaignId,
        address recipient
    ) public view override returns (uint256) {
        Campaign memory campaign = campaigns[campaignId];
        if (!campaign.active) return 0;
        if (block.timestamp < campaign.startTime) return 0;
        if (campaign.totalShares == 0) return 0;

        uint256 share = recipientShares[campaignId][recipient];
        if (share == 0) return 0;

        // Total allocation for this recipient
        uint256 totalAllocation = (campaign.totalReward * share) / campaign.totalShares;

        // Linear vesting: calculate vested amount based on elapsed time
        uint256 vested;
        if (block.timestamp >= campaign.endTime) {
            vested = totalAllocation;
        } else {
            uint256 elapsed = block.timestamp - campaign.startTime;
            uint256 duration = campaign.endTime - campaign.startTime;
            vested = (totalAllocation * elapsed) / duration;
        }

        // Subtract already claimed
        uint256 alreadyClaimed = claimedAmounts[campaignId][recipient];
        if (vested <= alreadyClaimed) return 0;

        return vested - alreadyClaimed;
    }

    // ============ Merkle Distribution ============

    /**
     * @inheritdoc IRewardDistributor
     */
    function setMerkleRoot(
        uint256 campaignId,
        bytes32 root
    ) external override onlyAdmin {
        if (!campaigns[campaignId].active) revert CampaignNotActive();
        campaigns[campaignId].merkleRoot = root;

        emit MerkleRootSet(campaignId, root);
    }

    /**
     * @inheritdoc IRewardDistributor
     */
    function claimMerkle(
        uint256 campaignId,
        uint256 amount,
        bytes32[] calldata proof
    ) external override nonReentrant {
        Campaign storage campaign = campaigns[campaignId];
        if (!campaign.active) revert CampaignNotActive();
        if (campaign.merkleRoot == bytes32(0)) revert MerkleRootNotSet();
        if (merkleClaimed[campaignId][msg.sender]) revert AlreadyClaimed();

        // Verify merkle proof
        bytes32 leaf = keccak256(bytes.concat(keccak256(abi.encode(msg.sender, amount))));
        if (!MerkleProofUpgradeable.verify(proof, campaign.merkleRoot, leaf)) {
            revert InvalidProof();
        }

        merkleClaimed[campaignId][msg.sender] = true;
        campaign.claimed += amount;

        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "Transfer failed");

        emit RewardClaimed(campaignId, msg.sender, amount);
    }

    // ============ Admin ============

    /**
     * @notice Deactivate a campaign
     */
    function deactivateCampaign(uint256 campaignId) external onlyAdmin {
        campaigns[campaignId].active = false;
    }

    // ============ View ============

    function getCampaign(uint256 campaignId) external view returns (Campaign memory) {
        return campaigns[campaignId];
    }

    // ============ Upgrade ============

    function _authorizeUpgrade(address) internal override onlyAdmin {}
}
