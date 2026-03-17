// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC1155/IERC1155Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC1155/utils/ERC1155HolderUpgradeable.sol";
import "../interfaces/ICarbonAMM.sol";
import "../access/TerraQuraAccessControl.sol";

/**
 * @title CarbonAMM
 * @author TerraQura
 * @notice Automated Market Maker for AETH / CarbonCredit trading pairs
 * @dev Implements constant product (x*y=k) AMM with UUPS upgradeability.
 *      LP token accounting is internal (not separate ERC-20 tokens).
 *      Swap fees are split 80% to LPs, 20% to protocol treasury.
 */
contract CarbonAMM is
    Initializable,
    ReentrancyGuardUpgradeable,
    PausableUpgradeable,
    UUPSUpgradeable,
    ERC1155HolderUpgradeable,
    ICarbonAMM
{
    // ============================================
    // STATE
    // ============================================

    TerraQuraAccessControl public accessControl;
    IERC1155Upgradeable public carbonCredit;
    address public treasury;

    uint256 public nextPoolId;

    /// @notice Minimum liquidity locked on first deposit to prevent manipulation
    uint256 public constant MINIMUM_LIQUIDITY = 1000;

    /// @notice Basis-point denominator
    uint256 public constant BPS = 10000;

    /// @notice Default fee rate in basis points (30 bps = 0.30%)
    uint256 public constant DEFAULT_FEE_RATE = 30;

    /// @notice Fee split: 80% to LPs, 20% to protocol
    uint256 public constant LP_FEE_SHARE = 8000; // 80% in bps

    struct Pool {
        uint256 creditId;
        uint256 aethReserve;
        uint256 creditReserve;
        uint256 totalLpSupply;
        uint256 feeRate;
        address creator;
    }

    /// @notice Pool storage
    mapping(uint256 => Pool) public pools;

    /// @notice LP balances: poolId => user => balance
    mapping(uint256 => mapping(address => uint256)) public lpBalances;

    /// @notice creditId => poolId mapping (one pool per creditId)
    mapping(uint256 => uint256) public creditIdToPoolId;

    /// @notice Track whether a creditId already has a pool
    mapping(uint256 => bool) public poolExists;

    /// @notice Accumulated protocol fees (AETH) ready for withdrawal
    uint256 public protocolFees;

    // ============================================
    // ERRORS
    // ============================================

    error PoolAlreadyExists(uint256 creditId);
    error PoolNotFound(uint256 poolId);
    error InsufficientLiquidity();
    error SlippageExceeded();
    error ZeroAmount();
    error EmptyPool();
    error InsufficientLpTokens();
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
        address _carbonCredit,
        address _treasury
    ) public initializer {
        __ReentrancyGuard_init();
        __Pausable_init();
        __UUPSUpgradeable_init();
        __ERC1155Holder_init();

        accessControl = TerraQuraAccessControl(_accessControl);
        carbonCredit = IERC1155Upgradeable(_carbonCredit);
        treasury = _treasury;
        nextPoolId = 1;
    }

    // ============================================
    // POOL MANAGEMENT
    // ============================================

    /**
     * @inheritdoc ICarbonAMM
     */
    function createPool(uint256 creditId) external whenNotPaused returns (uint256 poolId) {
        if (poolExists[creditId]) revert PoolAlreadyExists(creditId);

        poolId = nextPoolId++;

        pools[poolId] = Pool({
            creditId: creditId,
            aethReserve: 0,
            creditReserve: 0,
            totalLpSupply: 0,
            feeRate: DEFAULT_FEE_RATE,
            creator: msg.sender
        });

        creditIdToPoolId[creditId] = poolId;
        poolExists[creditId] = true;

        emit PoolCreated(poolId, creditId, msg.sender);
    }

    // ============================================
    // LIQUIDITY
    // ============================================

    /**
     * @inheritdoc ICarbonAMM
     */
    function addLiquidity(
        uint256 poolId,
        uint256 creditAmount,
        uint256 minLpTokens
    ) external payable whenNotPaused nonReentrant returns (uint256 lpTokens) {
        Pool storage pool = pools[poolId];
        if (pool.creator == address(0)) revert PoolNotFound(poolId);
        if (msg.value == 0 || creditAmount == 0) revert ZeroAmount();

        uint256 aethAmount = msg.value;

        if (pool.totalLpSupply == 0) {
            // First liquidity deposit — use geometric mean minus minimum lock
            lpTokens = _sqrt(aethAmount * creditAmount);
            if (lpTokens <= MINIMUM_LIQUIDITY) revert InsufficientLiquidity();
            lpTokens -= MINIMUM_LIQUIDITY;
            // Lock MINIMUM_LIQUIDITY to address(0) (dead address)
            pool.totalLpSupply = MINIMUM_LIQUIDITY;
        } else {
            // Proportional deposit
            uint256 lpFromAeth = (aethAmount * pool.totalLpSupply) / pool.aethReserve;
            uint256 lpFromCredit = (creditAmount * pool.totalLpSupply) / pool.creditReserve;
            lpTokens = lpFromAeth < lpFromCredit ? lpFromAeth : lpFromCredit;
        }

        if (lpTokens < minLpTokens) revert SlippageExceeded();

        // Transfer credits from user
        carbonCredit.safeTransferFrom(msg.sender, address(this), pool.creditId, creditAmount, "");

        // Update state
        pool.aethReserve += aethAmount;
        pool.creditReserve += creditAmount;
        pool.totalLpSupply += lpTokens;
        lpBalances[poolId][msg.sender] += lpTokens;

        emit LiquidityAdded(poolId, msg.sender, aethAmount, creditAmount, lpTokens);
    }

    /**
     * @inheritdoc ICarbonAMM
     */
    function removeLiquidity(
        uint256 poolId,
        uint256 lpTokens,
        uint256 minAeth,
        uint256 minCredits
    ) external whenNotPaused nonReentrant {
        Pool storage pool = pools[poolId];
        if (pool.creator == address(0)) revert PoolNotFound(poolId);
        if (lpTokens == 0) revert ZeroAmount();
        if (lpBalances[poolId][msg.sender] < lpTokens) revert InsufficientLpTokens();

        uint256 aethAmount = (lpTokens * pool.aethReserve) / pool.totalLpSupply;
        uint256 creditAmount = (lpTokens * pool.creditReserve) / pool.totalLpSupply;

        if (aethAmount < minAeth || creditAmount < minCredits) revert SlippageExceeded();

        // Update state before transfers (CEI)
        pool.aethReserve -= aethAmount;
        pool.creditReserve -= creditAmount;
        pool.totalLpSupply -= lpTokens;
        lpBalances[poolId][msg.sender] -= lpTokens;

        // Transfer assets
        carbonCredit.safeTransferFrom(address(this), msg.sender, pool.creditId, creditAmount, "");
        (bool success, ) = msg.sender.call{value: aethAmount}("");
        if (!success) revert TransferFailed();

        emit LiquidityRemoved(poolId, msg.sender, aethAmount, creditAmount, lpTokens);
    }

    // ============================================
    // SWAPS
    // ============================================

    /**
     * @inheritdoc ICarbonAMM
     */
    function swapAethForCredits(
        uint256 poolId,
        uint256 minCreditsOut
    ) external payable whenNotPaused nonReentrant returns (uint256 creditsOut) {
        Pool storage pool = pools[poolId];
        if (pool.creator == address(0)) revert PoolNotFound(poolId);
        if (pool.aethReserve == 0 || pool.creditReserve == 0) revert EmptyPool();
        if (msg.value == 0) revert ZeroAmount();

        uint256 amountIn = msg.value;
        uint256 fee = (amountIn * pool.feeRate) / BPS;
        uint256 amountInAfterFee = amountIn - fee;

        // Constant product: creditsOut = (creditReserve * amountInAfterFee) / (aethReserve + amountInAfterFee)
        creditsOut = (pool.creditReserve * amountInAfterFee) / (pool.aethReserve + amountInAfterFee);

        if (creditsOut < minCreditsOut) revert SlippageExceeded();
        if (creditsOut == 0) revert ZeroAmount();

        // Fee split: 80% stays in pool (for LPs), 20% to protocol
        uint256 lpFee = (fee * LP_FEE_SHARE) / BPS;
        uint256 protocolFee = fee - lpFee;
        protocolFees += protocolFee;

        // Update reserves (LP fee portion is added to AETH reserve)
        pool.aethReserve += amountIn - protocolFee;
        pool.creditReserve -= creditsOut;

        // Transfer credits out
        carbonCredit.safeTransferFrom(address(this), msg.sender, pool.creditId, creditsOut, "");

        emit Swap(poolId, msg.sender, true, amountIn, creditsOut);
        emit FeesCollected(poolId, lpFee, protocolFee);
    }

    /**
     * @inheritdoc ICarbonAMM
     */
    function swapCreditsForAeth(
        uint256 poolId,
        uint256 creditAmount,
        uint256 minAethOut
    ) external whenNotPaused nonReentrant returns (uint256 aethOut) {
        Pool storage pool = pools[poolId];
        if (pool.creator == address(0)) revert PoolNotFound(poolId);
        if (pool.aethReserve == 0 || pool.creditReserve == 0) revert EmptyPool();
        if (creditAmount == 0) revert ZeroAmount();

        // Transfer credits in first
        carbonCredit.safeTransferFrom(msg.sender, address(this), pool.creditId, creditAmount, "");

        uint256 fee = (creditAmount * pool.feeRate) / BPS;
        uint256 amountInAfterFee = creditAmount - fee;

        // Constant product: aethOut = (aethReserve * amountInAfterFee) / (creditReserve + amountInAfterFee)
        aethOut = (pool.aethReserve * amountInAfterFee) / (pool.creditReserve + amountInAfterFee);

        if (aethOut < minAethOut) revert SlippageExceeded();
        if (aethOut == 0) revert ZeroAmount();

        // Fee: credits fee stays in pool for LPs (proportional), protocol fee in credit terms
        // For simplicity, credit fee stays entirely in pool; protocol fee tracked separately
        // The credit fee effectively increases creditReserve, benefiting LPs
        uint256 lpFee = (fee * LP_FEE_SHARE) / BPS;
        uint256 protocolFeeCredits = fee - lpFee;

        // Update reserves
        pool.creditReserve += creditAmount - protocolFeeCredits;
        pool.aethReserve -= aethOut;

        // Transfer AETH out
        (bool success, ) = msg.sender.call{value: aethOut}("");
        if (!success) revert TransferFailed();

        emit Swap(poolId, msg.sender, false, creditAmount, aethOut);
        emit FeesCollected(poolId, lpFee, protocolFeeCredits);
    }

    // ============================================
    // VIEW FUNCTIONS
    // ============================================

    /**
     * @inheritdoc ICarbonAMM
     */
    function getQuote(
        uint256 poolId,
        uint256 amountIn,
        bool aethToCredit
    ) external view returns (uint256 amountOut) {
        Pool storage pool = pools[poolId];
        if (pool.aethReserve == 0 || pool.creditReserve == 0) return 0;

        uint256 fee = (amountIn * pool.feeRate) / BPS;
        uint256 amountInAfterFee = amountIn - fee;

        if (aethToCredit) {
            amountOut = (pool.creditReserve * amountInAfterFee) / (pool.aethReserve + amountInAfterFee);
        } else {
            amountOut = (pool.aethReserve * amountInAfterFee) / (pool.creditReserve + amountInAfterFee);
        }
    }

    /**
     * @inheritdoc ICarbonAMM
     */
    function getPoolInfo(uint256 poolId) external view returns (PoolInfo memory) {
        Pool storage pool = pools[poolId];
        return PoolInfo({
            creditId: pool.creditId,
            aethReserve: pool.aethReserve,
            creditReserve: pool.creditReserve,
            totalLpSupply: pool.totalLpSupply,
            feeRate: pool.feeRate,
            creator: pool.creator
        });
    }

    /**
     * @inheritdoc ICarbonAMM
     * @dev Returns price in AETH per credit with 1e18 precision
     */
    function getSpotPrice(uint256 poolId) external view returns (uint256) {
        Pool storage pool = pools[poolId];
        if (pool.creditReserve == 0) return 0;
        return (pool.aethReserve * 1e18) / pool.creditReserve;
    }

    // ============================================
    // ADMIN
    // ============================================

    /**
     * @notice Withdraw accumulated protocol fees
     */
    function withdrawProtocolFees() external nonReentrant {
        if (!accessControl.hasRole(accessControl.TREASURY_ROLE(), msg.sender)) revert Unauthorized();
        uint256 amount = protocolFees;
        protocolFees = 0;
        (bool success, ) = treasury.call{value: amount}("");
        if (!success) revert TransferFailed();
    }

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

    function _authorizeUpgrade(address) internal view override {
        if (!accessControl.hasRole(accessControl.UPGRADER_ROLE(), msg.sender)) revert Unauthorized();
    }

    /**
     * @dev Integer square root (Babylonian method)
     */
    function _sqrt(uint256 y) internal pure returns (uint256 z) {
        if (y > 3) {
            z = y;
            uint256 x = y / 2 + 1;
            while (x < z) {
                z = x;
                x = (y / x + x) / 2;
            }
        } else if (y != 0) {
            z = 1;
        }
    }

    /**
     * @dev Required to receive AETH
     */
    receive() external payable {}
}
