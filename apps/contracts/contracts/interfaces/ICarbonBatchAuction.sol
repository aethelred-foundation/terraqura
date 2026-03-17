// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

/**
 * @title ICarbonBatchAuction
 * @notice Interface for the TerraQura Carbon Batch Auction
 */
interface ICarbonBatchAuction {
    enum AuctionType { Dutch, SealedBid }
    enum AuctionStatus { Active, Finalized, Cancelled }

    struct Auction {
        uint256 id;
        address seller;
        uint256 creditId;
        uint256 amount;
        AuctionType auctionType;
        AuctionStatus status;
        uint256 startTime;
        uint256 endTime;
        // Dutch auction fields
        uint256 startPrice;
        uint256 endPrice;
        // Sealed bid fields
        uint256 reservePrice;
        uint256 revealEndTime;
        uint256 amountSold;
    }

    struct SealedBid {
        bytes32 commitment;
        uint256 deposit;
        uint256 revealedAmount;
        bool revealed;
        bool refunded;
    }

    event AuctionCreated(uint256 indexed auctionId, address indexed seller, uint256 indexed creditId, AuctionType auctionType);
    event BidPlaced(uint256 indexed auctionId, address indexed bidder, uint256 amount);
    event BidRevealed(uint256 indexed auctionId, address indexed bidder, uint256 bidAmount);
    event AuctionFinalized(uint256 indexed auctionId, address indexed winner, uint256 winningBid);
    event AuctionCancelled(uint256 indexed auctionId);

    function createDutchAuction(uint256 creditId, uint256 amount, uint256 startPrice, uint256 endPrice, uint256 duration) external returns (uint256 auctionId);
    function bidDutch(uint256 auctionId, uint256 amount) external payable;
    function createSealedBidAuction(uint256 creditId, uint256 amount, uint256 reservePrice, uint256 biddingDuration, uint256 revealDuration) external returns (uint256 auctionId);
    function submitSealedBid(uint256 auctionId, bytes32 commitment) external payable;
    function revealBid(uint256 auctionId, uint256 bidAmount, bytes32 salt) external;
    function finalizeAuction(uint256 auctionId) external;
    function cancelAuction(uint256 auctionId) external;
}
