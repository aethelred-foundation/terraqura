// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "../access/TerraQuraAccessControl.sol";
import "../interfaces/ICarbonBatchAuction.sol";

/**
 * @title CarbonBatchAuction
 * @author TerraQura
 * @notice Dutch auction and sealed-bid auction mechanism for carbon credits.
 * @dev UUPS upgradeable, uses TerraQuraAccessControl for RBAC.
 */
contract CarbonBatchAuction is
    Initializable,
    ReentrancyGuardUpgradeable,
    UUPSUpgradeable,
    ICarbonBatchAuction
{
    // ============ State ============

    TerraQuraAccessControl public accessControl;

    uint256 private _nextAuctionId;

    mapping(uint256 => Auction) public auctions;

    // Sealed bid tracking: auctionId => bidder => SealedBid
    mapping(uint256 => mapping(address => SealedBid)) public sealedBids;

    // Track all bidders for finalization
    mapping(uint256 => address[]) private _auctionBidders;
    mapping(uint256 => mapping(address => bool)) private _hasBid;

    // Dutch auction purchase tracking
    mapping(uint256 => uint256) public dutchTotalSold;

    // ============ Errors ============

    error Unauthorized();
    error InvalidPrice();
    error InvalidDuration();
    error InvalidAmount();
    error AuctionNotActive();
    error AuctionEnded();
    error AuctionNotEnded();
    error InsufficientPayment();
    error AmountExceedsAvailable();
    error NotInBiddingPhase();
    error NotInRevealPhase();
    error AlreadyRevealed();
    error CommitmentMismatch();
    error AlreadyBid();
    error NoBidsToFinalize();
    error OnlySeller();
    error AuctionAlreadyFinalized();
    error NothingToRefund();
    error BidBelowReserve();

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
        _nextAuctionId = 1;
    }

    // ============ Dutch Auction ============

    /**
     * @inheritdoc ICarbonBatchAuction
     */
    function createDutchAuction(
        uint256 creditId,
        uint256 amount,
        uint256 startPrice,
        uint256 endPrice,
        uint256 duration
    ) external override returns (uint256 auctionId) {
        if (startPrice <= endPrice) revert InvalidPrice();
        if (amount == 0) revert InvalidAmount();
        if (duration == 0) revert InvalidDuration();

        auctionId = _nextAuctionId++;

        auctions[auctionId] = Auction({
            id: auctionId,
            seller: msg.sender,
            creditId: creditId,
            amount: amount,
            auctionType: AuctionType.Dutch,
            status: AuctionStatus.Active,
            startTime: block.timestamp,
            endTime: block.timestamp + duration,
            startPrice: startPrice,
            endPrice: endPrice,
            reservePrice: 0,
            revealEndTime: 0,
            amountSold: 0
        });

        emit AuctionCreated(auctionId, msg.sender, creditId, AuctionType.Dutch);
    }

    /**
     * @notice Get current Dutch auction price
     */
    function getDutchPrice(uint256 auctionId) public view returns (uint256) {
        Auction memory a = auctions[auctionId];
        if (block.timestamp >= a.endTime) return a.endPrice;

        uint256 elapsed = block.timestamp - a.startTime;
        uint256 duration = a.endTime - a.startTime;
        uint256 priceDrop = ((a.startPrice - a.endPrice) * elapsed) / duration;

        return a.startPrice - priceDrop;
    }

    /**
     * @inheritdoc ICarbonBatchAuction
     */
    function bidDutch(
        uint256 auctionId,
        uint256 amount
    ) external payable override nonReentrant {
        Auction storage a = auctions[auctionId];
        if (a.status != AuctionStatus.Active) revert AuctionNotActive();
        if (a.auctionType != AuctionType.Dutch) revert AuctionNotActive();
        if (block.timestamp > a.endTime) revert AuctionEnded();
        if (amount == 0) revert InvalidAmount();

        uint256 available = a.amount - a.amountSold;
        if (amount > available) revert AmountExceedsAvailable();

        uint256 currentPrice = getDutchPrice(auctionId);
        uint256 totalCost = currentPrice * amount;
        if (msg.value < totalCost) revert InsufficientPayment();

        a.amountSold += amount;

        // Refund excess
        if (msg.value > totalCost) {
            (bool success, ) = msg.sender.call{value: msg.value - totalCost}("");
            require(success, "Refund failed");
        }

        // Pay seller
        (bool sent, ) = a.seller.call{value: totalCost}("");
        require(sent, "Payment to seller failed");

        // Auto-finalize if all sold
        if (a.amountSold == a.amount) {
            a.status = AuctionStatus.Finalized;
        }

        emit BidPlaced(auctionId, msg.sender, amount);
    }

    // ============ Sealed Bid Auction ============

    /**
     * @inheritdoc ICarbonBatchAuction
     */
    function createSealedBidAuction(
        uint256 creditId,
        uint256 amount,
        uint256 reservePrice,
        uint256 biddingDuration,
        uint256 revealDuration
    ) external override returns (uint256 auctionId) {
        if (amount == 0) revert InvalidAmount();
        if (biddingDuration == 0 || revealDuration == 0) revert InvalidDuration();

        auctionId = _nextAuctionId++;

        uint256 biddingEnd = block.timestamp + biddingDuration;

        auctions[auctionId] = Auction({
            id: auctionId,
            seller: msg.sender,
            creditId: creditId,
            amount: amount,
            auctionType: AuctionType.SealedBid,
            status: AuctionStatus.Active,
            startTime: block.timestamp,
            endTime: biddingEnd,
            startPrice: 0,
            endPrice: 0,
            reservePrice: reservePrice,
            revealEndTime: biddingEnd + revealDuration,
            amountSold: 0
        });

        emit AuctionCreated(auctionId, msg.sender, creditId, AuctionType.SealedBid);
    }

    /**
     * @inheritdoc ICarbonBatchAuction
     */
    function submitSealedBid(
        uint256 auctionId,
        bytes32 commitment
    ) external payable override {
        Auction memory a = auctions[auctionId];
        if (a.status != AuctionStatus.Active) revert AuctionNotActive();
        if (a.auctionType != AuctionType.SealedBid) revert AuctionNotActive();
        if (block.timestamp > a.endTime) revert NotInBiddingPhase();
        if (_hasBid[auctionId][msg.sender]) revert AlreadyBid();

        sealedBids[auctionId][msg.sender] = SealedBid({
            commitment: commitment,
            deposit: msg.value,
            revealedAmount: 0,
            revealed: false,
            refunded: false
        });

        _hasBid[auctionId][msg.sender] = true;
        _auctionBidders[auctionId].push(msg.sender);

        emit BidPlaced(auctionId, msg.sender, msg.value);
    }

    /**
     * @inheritdoc ICarbonBatchAuction
     */
    function revealBid(
        uint256 auctionId,
        uint256 bidAmount,
        bytes32 salt
    ) external override {
        Auction memory a = auctions[auctionId];
        if (a.status != AuctionStatus.Active) revert AuctionNotActive();
        if (block.timestamp <= a.endTime) revert NotInRevealPhase();
        if (block.timestamp > a.revealEndTime) revert NotInRevealPhase();

        SealedBid storage bid = sealedBids[auctionId][msg.sender];
        if (bid.revealed) revert AlreadyRevealed();

        // Verify commitment
        bytes32 expectedCommitment = keccak256(abi.encodePacked(bidAmount, salt));
        if (bid.commitment != expectedCommitment) revert CommitmentMismatch();

        bid.revealed = true;
        bid.revealedAmount = bidAmount;

        emit BidRevealed(auctionId, msg.sender, bidAmount);
    }

    /**
     * @inheritdoc ICarbonBatchAuction
     */
    function finalizeAuction(uint256 auctionId) external override nonReentrant {
        Auction storage a = auctions[auctionId];
        if (a.status != AuctionStatus.Active) revert AuctionAlreadyFinalized();
        if (a.auctionType != AuctionType.SealedBid) revert AuctionNotActive();
        if (block.timestamp <= a.revealEndTime) revert AuctionNotEnded();

        address[] memory bidders = _auctionBidders[auctionId];
        if (bidders.length == 0) {
            a.status = AuctionStatus.Cancelled;
            emit AuctionCancelled(auctionId);
            return;
        }

        // Find highest valid bidder
        address highestBidder;
        uint256 highestBid;

        for (uint256 i = 0; i < bidders.length; i++) {
            SealedBid memory bid = sealedBids[auctionId][bidders[i]];
            if (bid.revealed &&
                bid.revealedAmount >= a.reservePrice &&
                bid.deposit >= bid.revealedAmount &&
                bid.revealedAmount > highestBid) {
                highestBid = bid.revealedAmount;
                highestBidder = bidders[i];
            }
        }

        if (highestBidder == address(0)) {
            // No valid bids above reserve
            a.status = AuctionStatus.Cancelled;

            // Refund all deposits
            for (uint256 i = 0; i < bidders.length; i++) {
                SealedBid storage bid = sealedBids[auctionId][bidders[i]];
                if (!bid.refunded && bid.deposit > 0) {
                    bid.refunded = true;
                    (bool success, ) = bidders[i].call{value: bid.deposit}("");
                    require(success, "Refund failed");
                }
            }

            emit AuctionCancelled(auctionId);
            return;
        }

        a.status = AuctionStatus.Finalized;
        a.amountSold = a.amount;

        // Pay seller the winning bid
        (bool sellerPaid, ) = a.seller.call{value: highestBid}("");
        require(sellerPaid, "Seller payment failed");

        // Refund winner's excess deposit
        SealedBid storage winnerBid = sealedBids[auctionId][highestBidder];
        winnerBid.refunded = true;
        if (winnerBid.deposit > highestBid) {
            (bool refundSuccess, ) = highestBidder.call{value: winnerBid.deposit - highestBid}("");
            require(refundSuccess, "Winner refund failed");
        }

        // Refund all other bidders
        for (uint256 i = 0; i < bidders.length; i++) {
            if (bidders[i] != highestBidder) {
                SealedBid storage bid = sealedBids[auctionId][bidders[i]];
                if (!bid.refunded && bid.deposit > 0) {
                    bid.refunded = true;
                    (bool success, ) = bidders[i].call{value: bid.deposit}("");
                    require(success, "Refund failed");
                }
            }
        }

        emit AuctionFinalized(auctionId, highestBidder, highestBid);
    }

    /**
     * @inheritdoc ICarbonBatchAuction
     */
    function cancelAuction(uint256 auctionId) external override nonReentrant {
        Auction storage a = auctions[auctionId];
        if (a.seller != msg.sender && !accessControl.hasRole(accessControl.ADMIN_ROLE(), msg.sender)) {
            revert OnlySeller();
        }
        if (a.status != AuctionStatus.Active) revert AuctionAlreadyFinalized();

        // For Dutch auctions with partial sales, don't allow cancel
        if (a.auctionType == AuctionType.Dutch && a.amountSold > 0) revert AuctionAlreadyFinalized();

        a.status = AuctionStatus.Cancelled;

        // Refund sealed bid deposits
        if (a.auctionType == AuctionType.SealedBid) {
            address[] memory bidders = _auctionBidders[auctionId];
            for (uint256 i = 0; i < bidders.length; i++) {
                SealedBid storage bid = sealedBids[auctionId][bidders[i]];
                if (!bid.refunded && bid.deposit > 0) {
                    bid.refunded = true;
                    (bool success, ) = bidders[i].call{value: bid.deposit}("");
                    require(success, "Refund failed");
                }
            }
        }

        emit AuctionCancelled(auctionId);
    }

    // ============ View ============

    function getAuction(uint256 auctionId) external view returns (Auction memory) {
        return auctions[auctionId];
    }

    function getBidders(uint256 auctionId) external view returns (address[] memory) {
        return _auctionBidders[auctionId];
    }

    // ============ Upgrade ============

    function _authorizeUpgrade(address) internal override onlyAdmin {}
}
