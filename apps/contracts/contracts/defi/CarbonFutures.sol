// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC1155/IERC1155Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC1155/utils/ERC1155HolderUpgradeable.sol";
import "../interfaces/ICarbonFutures.sol";
import "../access/TerraQuraAccessControl.sol";

/**
 * @title CarbonFutures
 * @author TerraQura
 * @notice Forward contracts for future carbon credit delivery
 * @dev Sellers post collateral in AETH. Buyers lock AETH at the agreed price.
 *      At maturity the seller delivers ERC-1155 credits and receives payment.
 *      UUPS upgradeable with TerraQuraAccessControl RBAC.
 */
contract CarbonFutures is
    Initializable,
    ReentrancyGuardUpgradeable,
    PausableUpgradeable,
    UUPSUpgradeable,
    ERC1155HolderUpgradeable,
    ICarbonFutures
{
    // ============================================
    // STATE
    // ============================================

    TerraQuraAccessControl public accessControl;
    IERC1155Upgradeable public carbonCredit;

    uint256 public nextFutureId;

    /// @notice Default collateral requirement in basis points (2000 = 20%)
    uint256 public constant DEFAULT_COLLATERAL_BPS = 2000;

    /// @notice Basis-point denominator
    uint256 public constant BPS = 10000;

    /// @notice Grace period after maturity for settlement (7 days)
    uint256 public constant GRACE_PERIOD = 7 days;

    /// @notice Minimum collateral in basis points
    uint256 public constant MIN_COLLATERAL_BPS = 500; // 5%

    struct FutureData {
        uint256 id;
        uint256 creditId;
        uint256 amount;
        uint256 pricePerUnit; // AETH per credit unit
        address seller;
        address buyer;
        uint256 maturityTimestamp;
        uint256 collateral; // seller's AETH collateral
        uint256 buyerDeposit; // buyer's locked AETH (amount * pricePerUnit)
        FutureStatus status;
    }

    /// @notice Future storage
    mapping(uint256 => FutureData) public futures;

    // ============================================
    // ERRORS
    // ============================================

    error FutureNotFound(uint256 futureId);
    error InvalidStatus(FutureStatus expected, FutureStatus actual);
    error MaturityInPast();
    error NotSeller();
    error NotParty();
    error CannotBuyOwnFuture();
    error InsufficientCollateral();
    error InsufficientPayment();
    error NotYetMature();
    error GracePeriodNotExpired();
    error GracePeriodExpired();
    error TransferFailed();
    error ZeroAmount();
    error InvalidCollateralBps();
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
        nextFutureId = 1;
    }

    // ============================================
    // FUTURE LIFECYCLE
    // ============================================

    /**
     * @inheritdoc ICarbonFutures
     * @dev Seller creates a future and posts collateral in AETH.
     *      collateralBps determines the collateral as a % of notional (amount * pricePerUnit).
     *      If collateralBps is 0, DEFAULT_COLLATERAL_BPS (20%) is used.
     */
    function createFuture(
        uint256 creditId,
        uint256 amount,
        uint256 pricePerUnit,
        uint256 maturityTimestamp,
        uint256 collateralBps
    ) external payable whenNotPaused nonReentrant returns (uint256 futureId) {
        if (amount == 0 || pricePerUnit == 0) revert ZeroAmount();
        if (maturityTimestamp <= block.timestamp) revert MaturityInPast();

        uint256 effectiveBps = collateralBps == 0 ? DEFAULT_COLLATERAL_BPS : collateralBps;
        if (effectiveBps < MIN_COLLATERAL_BPS) revert InvalidCollateralBps();

        uint256 notional = amount * pricePerUnit;
        uint256 requiredCollateral = (notional * effectiveBps) / BPS;
        if (msg.value < requiredCollateral) revert InsufficientCollateral();

        futureId = nextFutureId++;

        futures[futureId] = FutureData({
            id: futureId,
            creditId: creditId,
            amount: amount,
            pricePerUnit: pricePerUnit,
            seller: msg.sender,
            buyer: address(0),
            maturityTimestamp: maturityTimestamp,
            collateral: msg.value,
            buyerDeposit: 0,
            status: FutureStatus.Open
        });

        emit FutureCreated(futureId, creditId, msg.sender, amount, pricePerUnit, maturityTimestamp);
    }

    /**
     * @inheritdoc ICarbonFutures
     * @dev Buyer locks AETH equal to the total price (amount * pricePerUnit).
     */
    function buyFuture(uint256 futureId) external payable whenNotPaused nonReentrant {
        FutureData storage f = futures[futureId];
        if (f.seller == address(0)) revert FutureNotFound(futureId);
        if (f.status != FutureStatus.Open) revert InvalidStatus(FutureStatus.Open, f.status);
        if (msg.sender == f.seller) revert CannotBuyOwnFuture();

        uint256 totalPrice = f.amount * f.pricePerUnit;
        if (msg.value < totalPrice) revert InsufficientPayment();

        f.buyer = msg.sender;
        f.buyerDeposit = msg.value;
        f.status = FutureStatus.Filled;

        emit FutureFilled(futureId, msg.sender);
    }

    /**
     * @inheritdoc ICarbonFutures
     * @dev At or after maturity (within grace period), seller delivers credits.
     *      Seller receives buyer's payment + their collateral.
     *      Buyer receives the carbon credits.
     */
    function settleFuture(uint256 futureId) external whenNotPaused nonReentrant {
        FutureData storage f = futures[futureId];
        if (f.seller == address(0)) revert FutureNotFound(futureId);
        if (f.status != FutureStatus.Filled) revert InvalidStatus(FutureStatus.Filled, f.status);
        if (block.timestamp < f.maturityTimestamp) revert NotYetMature();
        if (block.timestamp > f.maturityTimestamp + GRACE_PERIOD) revert GracePeriodExpired();

        // Only seller can settle (they deliver the credits)
        if (msg.sender != f.seller) revert NotSeller();

        f.status = FutureStatus.Settled;

        // Seller delivers credits to buyer
        carbonCredit.safeTransferFrom(f.seller, f.buyer, f.creditId, f.amount, "");

        // Seller receives: buyer payment + their own collateral
        uint256 sellerPayout = f.buyerDeposit + f.collateral;
        (bool success, ) = f.seller.call{value: sellerPayout}("");
        if (!success) revert TransferFailed();

        emit FutureSettled(futureId);
    }

    /**
     * @inheritdoc ICarbonFutures
     * @dev After grace period expires, anyone can trigger default.
     *      Buyer receives their payment back + seller's collateral as compensation.
     */
    function defaultFuture(uint256 futureId) external whenNotPaused nonReentrant {
        FutureData storage f = futures[futureId];
        if (f.seller == address(0)) revert FutureNotFound(futureId);
        if (f.status != FutureStatus.Filled) revert InvalidStatus(FutureStatus.Filled, f.status);
        if (block.timestamp <= f.maturityTimestamp + GRACE_PERIOD) revert GracePeriodNotExpired();

        f.status = FutureStatus.Defaulted;

        // Buyer gets their payment back + seller's collateral (slashed)
        uint256 buyerPayout = f.buyerDeposit + f.collateral;
        (bool success, ) = f.buyer.call{value: buyerPayout}("");
        if (!success) revert TransferFailed();

        emit FutureDefaulted(futureId, f.collateral);
    }

    /**
     * @inheritdoc ICarbonFutures
     * @dev Only seller can cancel, and only if no buyer yet.
     */
    function cancelFuture(uint256 futureId) external nonReentrant {
        FutureData storage f = futures[futureId];
        if (f.seller == address(0)) revert FutureNotFound(futureId);
        if (f.status != FutureStatus.Open) revert InvalidStatus(FutureStatus.Open, f.status);
        if (msg.sender != f.seller) revert NotSeller();

        f.status = FutureStatus.Cancelled;

        // Return collateral to seller
        (bool success, ) = f.seller.call{value: f.collateral}("");
        if (!success) revert TransferFailed();

        emit FutureCancelled(futureId);
    }

    // ============================================
    // VIEW FUNCTIONS
    // ============================================

    function getFuture(uint256 futureId) external view returns (
        uint256 id,
        uint256 creditId,
        uint256 amount,
        uint256 pricePerUnit,
        address seller,
        address buyer,
        uint256 maturityTimestamp,
        uint256 collateral,
        FutureStatus status
    ) {
        FutureData storage f = futures[futureId];
        return (f.id, f.creditId, f.amount, f.pricePerUnit, f.seller, f.buyer, f.maturityTimestamp, f.collateral, f.status);
    }

    // ============================================
    // ADMIN
    // ============================================

    function pause() external {
        if (!accessControl.hasRole(accessControl.PAUSER_ROLE(), msg.sender)) revert Unauthorized();
        _pause();
    }

    function unpause() external {
        if (!accessControl.hasRole(accessControl.ADMIN_ROLE(), msg.sender)) revert Unauthorized();
        _unpause();
    }

    function _authorizeUpgrade(address) internal view override {
        if (!accessControl.hasRole(accessControl.UPGRADER_ROLE(), msg.sender)) revert Unauthorized();
    }

    /**
     * @dev Required to receive AETH
     */
    receive() external payable {}
}
