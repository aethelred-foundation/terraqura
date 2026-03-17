// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "../access/TerraQuraAccessControl.sol";
import "../interfaces/IInsurancePool.sol";

/**
 * @title InsurancePool
 * @author TerraQura
 * @notice Carbon reversal insurance pool — covers credit reversals such as
 *         forest fires destroying sequestered carbon or DAC storage leaks.
 * @dev UUPS upgradeable, uses TerraQuraAccessControl for RBAC.
 */
contract InsurancePool is
    Initializable,
    ReentrancyGuardUpgradeable,
    UUPSUpgradeable,
    IInsurancePool
{
    // ============ State ============

    TerraQuraAccessControl public accessControl;

    uint256 private _nextPolicyId;
    uint256 private _nextClaimId;

    mapping(uint256 => Policy) public policies;
    mapping(uint256 => Claim) public claims;

    // Risk factors in basis points (100 = 1%)
    mapping(Methodology => uint256) public riskFactorBps;

    // Pool accounting
    uint256 public totalDeposited;
    uint256 public totalActiveCoverage;

    // Depositor tracking
    mapping(address => uint256) public deposits;
    mapping(address => uint256) public depositTimestamp;

    // Minimum coverage ratio in basis points (15000 = 150%)
    uint256 public minCoverageRatioBps;

    // Withdrawal timelock in seconds
    uint256 public withdrawTimelock;

    // ============ Constants ============

    uint256 public constant BPS = 10000;
    uint256 public constant DAYS_PER_YEAR = 365;

    // ============ Errors ============

    error Unauthorized();
    error InvalidCoverageAmount();
    error InvalidDuration();
    error InsufficientPremium();
    error InsufficientPoolCapacity();
    error PolicyNotActive();
    error PolicyExpired();
    error PolicyNotExpired();
    error ClaimNotFiled();
    error ClaimNotApproved();
    error ClaimAlreadyProcessed();
    error InsufficientDeposit();
    error WithdrawTimelockNotMet();
    error InsufficientPoolBalance();
    error ZeroAmount();

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

        _nextPolicyId = 1;
        _nextClaimId = 1;

        // Default risk factors: DAC 2%, Biochar 5%, Forestry 10%, BECCS 4%
        riskFactorBps[Methodology.DAC] = 200;
        riskFactorBps[Methodology.Biochar] = 500;
        riskFactorBps[Methodology.Forestry] = 1000;
        riskFactorBps[Methodology.BECCS] = 400;

        // 150% minimum coverage ratio
        minCoverageRatioBps = 15000;

        // 7 day withdrawal timelock
        withdrawTimelock = 7 days;
    }

    // ============ Policy Management ============

    /**
     * @inheritdoc IInsurancePool
     */
    function createPolicy(
        uint256 creditId,
        uint256 coverageAmount,
        uint256 durationDays,
        Methodology methodology
    ) external payable override nonReentrant returns (uint256 policyId) {
        if (coverageAmount == 0) revert InvalidCoverageAmount();
        if (durationDays == 0) revert InvalidDuration();

        uint256 premium = calculatePremium(coverageAmount, durationDays, methodology);
        if (msg.value < premium) revert InsufficientPremium();

        // Check pool capacity
        uint256 newTotalCoverage = totalActiveCoverage + coverageAmount;
        uint256 poolBalance = address(this).balance; // includes the premium just sent
        if (poolBalance * BPS < newTotalCoverage * minCoverageRatioBps) {
            revert InsufficientPoolCapacity();
        }

        policyId = _nextPolicyId++;

        policies[policyId] = Policy({
            id: policyId,
            creditId: creditId,
            holder: msg.sender,
            coverageAmount: coverageAmount,
            premium: premium,
            startTime: block.timestamp,
            endTime: block.timestamp + (durationDays * 1 days),
            status: PolicyStatus.Active
        });

        totalActiveCoverage += coverageAmount;

        // Refund excess
        if (msg.value > premium) {
            (bool success, ) = msg.sender.call{value: msg.value - premium}("");
            require(success, "Refund failed");
        }

        emit PolicyCreated(policyId, creditId, msg.sender, coverageAmount, premium, policies[policyId].endTime);
    }

    /**
     * @notice Calculate premium for a policy
     * @param coverageAmount Amount of coverage in wei
     * @param durationDays Duration in days
     * @param methodology The carbon capture methodology
     * @return premium The premium amount in wei
     */
    function calculatePremium(
        uint256 coverageAmount,
        uint256 durationDays,
        Methodology methodology
    ) public view returns (uint256 premium) {
        uint256 riskFactor = riskFactorBps[methodology];
        premium = (coverageAmount * riskFactor * durationDays) / (BPS * DAYS_PER_YEAR);
    }

    // ============ Claims ============

    /**
     * @inheritdoc IInsurancePool
     */
    function fileClaim(
        uint256 policyId,
        bytes calldata evidence
    ) external override nonReentrant returns (uint256 claimId) {
        Policy storage policy = policies[policyId];
        if (policy.holder != msg.sender) revert Unauthorized();
        if (policy.status != PolicyStatus.Active) revert PolicyNotActive();
        if (block.timestamp > policy.endTime) {
            policy.status = PolicyStatus.Expired;
            totalActiveCoverage -= policy.coverageAmount;
            revert PolicyExpired();
        }

        policy.status = PolicyStatus.Claimed;
        claimId = _nextClaimId++;

        claims[claimId] = Claim({
            id: claimId,
            policyId: policyId,
            claimant: msg.sender,
            evidence: evidence,
            status: ClaimStatus.Filed,
            timestamp: block.timestamp
        });

        emit ClaimFiled(claimId, policyId, msg.sender);
    }

    /**
     * @inheritdoc IInsurancePool
     */
    function processClaim(uint256 claimId, bool approved) external override onlyAdmin {
        Claim storage c = claims[claimId];
        if (c.status != ClaimStatus.Filed) revert ClaimAlreadyProcessed();

        c.status = approved ? ClaimStatus.Approved : ClaimStatus.Rejected;

        if (!approved) {
            // Re-activate or expire policy
            Policy storage policy = policies[c.policyId];
            if (block.timestamp <= policy.endTime) {
                policy.status = PolicyStatus.Active;
            } else {
                policy.status = PolicyStatus.Expired;
                totalActiveCoverage -= policy.coverageAmount;
            }
        }

        emit ClaimProcessed(claimId, approved);
    }

    /**
     * @inheritdoc IInsurancePool
     */
    function payout(uint256 claimId) external override nonReentrant {
        Claim storage c = claims[claimId];
        if (c.status != ClaimStatus.Approved) revert ClaimNotApproved();

        Policy storage policy = policies[c.policyId];
        uint256 amount = policy.coverageAmount;

        if (address(this).balance < amount) revert InsufficientPoolBalance();

        c.status = ClaimStatus.PaidOut;
        policy.status = PolicyStatus.PaidOut;
        totalActiveCoverage -= policy.coverageAmount;

        (bool success, ) = c.claimant.call{value: amount}("");
        require(success, "Payout failed");

        emit Payout(claimId, c.claimant, amount);
    }

    // ============ Pool Management ============

    /**
     * @inheritdoc IInsurancePool
     */
    function depositToPool() external payable override {
        if (msg.value == 0) revert ZeroAmount();

        deposits[msg.sender] += msg.value;
        depositTimestamp[msg.sender] = block.timestamp;
        totalDeposited += msg.value;

        emit PoolDeposit(msg.sender, msg.value);
    }

    /**
     * @inheritdoc IInsurancePool
     */
    function withdrawFromPool(uint256 amount) external override nonReentrant {
        if (amount == 0) revert ZeroAmount();
        if (deposits[msg.sender] < amount) revert InsufficientDeposit();
        if (block.timestamp < depositTimestamp[msg.sender] + withdrawTimelock) {
            revert WithdrawTimelockNotMet();
        }

        // Ensure pool maintains coverage ratio after withdrawal
        uint256 poolBalanceAfter = address(this).balance - amount;
        if (totalActiveCoverage > 0 && poolBalanceAfter * BPS < totalActiveCoverage * minCoverageRatioBps) {
            revert InsufficientPoolCapacity();
        }

        deposits[msg.sender] -= amount;
        totalDeposited -= amount;

        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "Withdraw failed");

        emit PoolWithdraw(msg.sender, amount);
    }

    // ============ Admin ============

    /**
     * @notice Set the risk factor for a methodology
     */
    function setRiskFactor(Methodology methodology, uint256 bps) external onlyAdmin {
        riskFactorBps[methodology] = bps;
    }

    /**
     * @notice Set the minimum coverage ratio
     */
    function setMinCoverageRatio(uint256 bps) external onlyAdmin {
        minCoverageRatioBps = bps;
    }

    /**
     * @notice Set the withdrawal timelock
     */
    function setWithdrawTimelock(uint256 timelock) external onlyAdmin {
        withdrawTimelock = timelock;
    }

    // ============ View ============

    function availableCapacity() external view returns (uint256) {
        uint256 poolBalance = address(this).balance;
        uint256 requiredForCoverage = (totalActiveCoverage * minCoverageRatioBps) / BPS;
        if (poolBalance <= requiredForCoverage) return 0;
        return poolBalance - requiredForCoverage;
    }

    function getPolicy(uint256 policyId) external view returns (Policy memory) {
        return policies[policyId];
    }

    function getClaim(uint256 claimId) external view returns (Claim memory) {
        return claims[claimId];
    }

    // ============ Upgrade ============

    function _authorizeUpgrade(address) internal override onlyAdmin {}
}
