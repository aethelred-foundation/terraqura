// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";

/**
 * @title CarbonMarketplace
 * @author TerraQura
 * @notice Peer-to-peer marketplace for trading carbon credits
 * @dev Supports fixed-price listings and offers for ERC-1155 carbon credits
 *
 * IMPORTANT: This contract uses _msgSender() instead of msg.sender to support
 * ERC-2771 meta-transactions (gasless transactions). When inherited by
 * GaslessMarketplace, the _msgSender() will return the actual user address
 * instead of the relayer address.
 *
 * Features:
 * - List credits for sale at fixed price
 * - Make offers on any credit (listed or not)
 * - Accept/reject offers
 * - Cancel listings
 * - Platform fee collection (configurable)
 * - KYC requirement enforcement
 * - ERC-2771 gasless transaction support
 */
contract CarbonMarketplace is
    Initializable,
    ContextUpgradeable,
    OwnableUpgradeable,
    PausableUpgradeable,
    ReentrancyGuardUpgradeable,
    UUPSUpgradeable,
    ERC1155Holder
{
    // ============ Structs ============

    struct Listing {
        uint256 listingId;
        address seller;
        uint256 tokenId;
        uint256 amount;
        uint256 pricePerUnit;      // Price in wei per credit
        uint256 minPurchaseAmount; // Minimum credits per purchase
        bool isActive;
        uint256 createdAt;
        uint256 expiresAt;         // 0 = no expiry
    }

    struct Offer {
        uint256 offerId;
        address buyer;
        uint256 tokenId;
        uint256 amount;
        uint256 pricePerUnit;      // Offered price per credit
        uint256 depositAmount;     // ETH/MATIC deposited
        bool isActive;
        uint256 createdAt;
        uint256 expiresAt;
    }

    // ============ State Variables ============

    /// @notice The carbon credit token contract
    IERC1155 public carbonCredit;

    /// @notice Platform fee in basis points (100 = 1%)
    uint256 public platformFeeBps;

    /// @notice Maximum platform fee (5%)
    uint256 public constant MAX_FEE_BPS = 500;

    /// @notice Fee recipient address
    address public feeRecipient;

    /// @notice Listing counter
    uint256 public nextListingId;

    /// @notice Offer counter
    uint256 public nextOfferId;

    /// @notice Mapping of listing ID to Listing
    mapping(uint256 => Listing) public listings;

    /// @notice Mapping of offer ID to Offer
    mapping(uint256 => Offer) public offers;

    /// @notice Mapping of seller address to their active listing IDs
    mapping(address => uint256[]) public sellerListings;

    /// @notice Mapping of buyer address to their active offer IDs
    mapping(address => uint256[]) public buyerOffers;

    /// @notice Mapping of token ID to active listing IDs
    mapping(uint256 => uint256[]) public tokenListings;

    /// @notice KYC registry contract (optional)
    address public kycRegistry;

    /// @notice Whether KYC is required for trading
    bool public kycRequired;

    /// @notice Mapping of KYC-verified addresses
    mapping(address => bool) public isKycVerified;

    // ============ Events ============

    event ListingCreated(
        uint256 indexed listingId,
        address indexed seller,
        uint256 indexed tokenId,
        uint256 amount,
        uint256 pricePerUnit
    );

    event ListingCancelled(
        uint256 indexed listingId,
        address indexed seller
    );

    event ListingUpdated(
        uint256 indexed listingId,
        uint256 newPrice,
        uint256 newAmount
    );

    event Purchase(
        uint256 indexed listingId,
        address indexed buyer,
        address indexed seller,
        uint256 tokenId,
        uint256 amount,
        uint256 totalPrice,
        uint256 platformFee
    );

    event OfferCreated(
        uint256 indexed offerId,
        address indexed buyer,
        uint256 indexed tokenId,
        uint256 amount,
        uint256 pricePerUnit
    );

    event OfferAccepted(
        uint256 indexed offerId,
        address indexed seller,
        address indexed buyer,
        uint256 tokenId,
        uint256 amount,
        uint256 totalPrice
    );

    event OfferCancelled(
        uint256 indexed offerId,
        address indexed buyer
    );

    event OfferRejected(
        uint256 indexed offerId,
        address indexed seller
    );

    event KycStatusUpdated(
        address indexed user,
        bool verified
    );

    event PlatformFeeUpdated(
        uint256 oldFee,
        uint256 newFee
    );

    // ============ Errors ============

    error InvalidCarbonCreditContract();
    error InvalidFeeRecipient();
    error FeeTooHigh();
    error InvalidPrice();
    error InvalidAmount();
    error ListingNotFound();
    error ListingNotActive();
    error ListingExpired();
    error NotListingSeller();
    error InsufficientPayment();
    error InsufficientBalance();
    error BelowMinPurchase();
    error OfferNotFound();
    error OfferNotActive();
    error OfferExpired();
    error NotOfferBuyer();
    error KycNotVerified();
    error TransferFailed();
    error CannotBuyOwnListing();
    error CannotOfferOnOwnCredits();
    error NotAuthorizedToReject();

    // ============ Modifiers ============

    modifier onlyKycVerified() {
        address sender = _msgSender();
        if (kycRequired && !isKycVerified[sender]) {
            revert KycNotVerified();
        }
        _;
    }

    // ============ Initialization ============

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Initialize the marketplace
     * @param _carbonCredit Address of the CarbonCredit contract
     * @param _feeRecipient Address to receive platform fees
     * @param _platformFeeBps Platform fee in basis points
     * @param _owner Contract owner (multi-sig)
     */
    function initialize(
        address _carbonCredit,
        address _feeRecipient,
        uint256 _platformFeeBps,
        address _owner
    ) public initializer {
        if (_carbonCredit == address(0)) revert InvalidCarbonCreditContract();
        if (_feeRecipient == address(0)) revert InvalidFeeRecipient();
        if (_platformFeeBps > MAX_FEE_BPS) revert FeeTooHigh();

        __Ownable_init();
if (_owner != msg.sender) {
    _transferOwnership(_owner);
}
        __Pausable_init();
        __ReentrancyGuard_init();
        __UUPSUpgradeable_init();

        carbonCredit = IERC1155(_carbonCredit);
        feeRecipient = _feeRecipient;
        platformFeeBps = _platformFeeBps;
        nextListingId = 1;
        nextOfferId = 1;
    }

    // ============ Listing Functions ============

    /**
     * @notice Create a new listing to sell carbon credits
     * @param tokenId The token ID to sell
     * @param amount Number of credits to sell
     * @param pricePerUnit Price per credit in wei
     * @param minPurchaseAmount Minimum credits per purchase (0 = no minimum)
     * @param duration Listing duration in seconds (0 = no expiry)
     */
    function createListing(
        uint256 tokenId,
        uint256 amount,
        uint256 pricePerUnit,
        uint256 minPurchaseAmount,
        uint256 duration
    ) external whenNotPaused onlyKycVerified nonReentrant returns (uint256 listingId) {
        address sender = _msgSender();

        if (pricePerUnit == 0) revert InvalidPrice();
        if (amount == 0) revert InvalidAmount();
        if (carbonCredit.balanceOf(sender, tokenId) < amount) {
            revert InsufficientBalance();
        }

        listingId = nextListingId++;

        uint256 expiresAt = duration > 0 ? block.timestamp + duration : 0;

        listings[listingId] = Listing({
            listingId: listingId,
            seller: sender,
            tokenId: tokenId,
            amount: amount,
            pricePerUnit: pricePerUnit,
            minPurchaseAmount: minPurchaseAmount,
            isActive: true,
            createdAt: block.timestamp,
            expiresAt: expiresAt
        });

        sellerListings[sender].push(listingId);
        tokenListings[tokenId].push(listingId);

        // Transfer credits to marketplace for escrow
        carbonCredit.safeTransferFrom(sender, address(this), tokenId, amount, "");

        emit ListingCreated(listingId, sender, tokenId, amount, pricePerUnit);

        return listingId;
    }

    /**
     * @notice Cancel a listing and return credits to seller
     * @param listingId The listing to cancel
     */
    function cancelListing(uint256 listingId) external nonReentrant {
        address sender = _msgSender();
        Listing storage listing = listings[listingId];

        if (listing.listingId == 0) revert ListingNotFound();
        if (!listing.isActive) revert ListingNotActive();
        if (listing.seller != sender) revert NotListingSeller();

        listing.isActive = false;

        // Return credits to seller
        carbonCredit.safeTransferFrom(
            address(this),
            sender,
            listing.tokenId,
            listing.amount,
            ""
        );

        emit ListingCancelled(listingId, sender);
    }

    /**
     * @notice Update listing price or amount
     * @param listingId The listing to update
     * @param newPricePerUnit New price (0 = keep current)
     * @param newAmount New amount (0 = keep current)
     */
    function updateListing(
        uint256 listingId,
        uint256 newPricePerUnit,
        uint256 newAmount
    ) external nonReentrant {
        address sender = _msgSender();
        Listing storage listing = listings[listingId];

        if (listing.listingId == 0) revert ListingNotFound();
        if (!listing.isActive) revert ListingNotActive();
        if (listing.seller != sender) revert NotListingSeller();

        if (newPricePerUnit > 0) {
            listing.pricePerUnit = newPricePerUnit;
        }

        if (newAmount > 0 && newAmount != listing.amount) {
            if (newAmount > listing.amount) {
                // Adding more credits
                uint256 additionalAmount = newAmount - listing.amount;
                if (carbonCredit.balanceOf(sender, listing.tokenId) < additionalAmount) {
                    revert InsufficientBalance();
                }
                carbonCredit.safeTransferFrom(
                    sender,
                    address(this),
                    listing.tokenId,
                    additionalAmount,
                    ""
                );
            } else {
                // Reducing credits
                uint256 reduceAmount = listing.amount - newAmount;
                carbonCredit.safeTransferFrom(
                    address(this),
                    sender,
                    listing.tokenId,
                    reduceAmount,
                    ""
                );
            }
            listing.amount = newAmount;
        }

        emit ListingUpdated(listingId, listing.pricePerUnit, listing.amount);
    }

    /**
     * @notice Purchase credits from a listing
     * @param listingId The listing to purchase from
     * @param amount Number of credits to purchase
     */
    function purchase(
        uint256 listingId,
        uint256 amount
    ) external payable whenNotPaused onlyKycVerified nonReentrant {
        address sender = _msgSender();
        Listing storage listing = listings[listingId];

        if (listing.listingId == 0) revert ListingNotFound();
        if (!listing.isActive) revert ListingNotActive();
        if (listing.expiresAt > 0 && block.timestamp > listing.expiresAt) {
            revert ListingExpired();
        }
        if (listing.seller == sender) revert CannotBuyOwnListing();
        if (amount == 0 || amount > listing.amount) revert InvalidAmount();
        if (listing.minPurchaseAmount > 0 && amount < listing.minPurchaseAmount) {
            revert BelowMinPurchase();
        }

        uint256 totalPrice = amount * listing.pricePerUnit;
        if (msg.value < totalPrice) revert InsufficientPayment();

        // Calculate platform fee
        uint256 platformFee = (totalPrice * platformFeeBps) / 10000;
        uint256 sellerProceeds = totalPrice - platformFee;

        // Update listing
        listing.amount -= amount;
        if (listing.amount == 0) {
            listing.isActive = false;
        }

        // Transfer credits to buyer
        carbonCredit.safeTransferFrom(
            address(this),
            sender,
            listing.tokenId,
            amount,
            ""
        );

        // Transfer payment to seller
        (bool sellerSuccess, ) = payable(listing.seller).call{value: sellerProceeds}("");
        if (!sellerSuccess) revert TransferFailed();

        // Transfer fee to platform
        if (platformFee > 0) {
            (bool feeSuccess, ) = payable(feeRecipient).call{value: platformFee}("");
            if (!feeSuccess) revert TransferFailed();
        }

        // Refund excess payment
        if (msg.value > totalPrice) {
            (bool refundSuccess, ) = payable(sender).call{value: msg.value - totalPrice}("");
            if (!refundSuccess) revert TransferFailed();
        }

        emit Purchase(
            listingId,
            sender,
            listing.seller,
            listing.tokenId,
            amount,
            totalPrice,
            platformFee
        );
    }

    // ============ Offer Functions ============

    /**
     * @notice Create an offer to buy credits
     * @param tokenId The token ID to make offer on
     * @param amount Number of credits wanted
     * @param pricePerUnit Offered price per credit
     * @param duration Offer duration in seconds
     */
    function createOffer(
        uint256 tokenId,
        uint256 amount,
        uint256 pricePerUnit,
        uint256 duration
    ) external payable whenNotPaused onlyKycVerified nonReentrant returns (uint256 offerId) {
        address sender = _msgSender();

        if (pricePerUnit == 0) revert InvalidPrice();
        if (amount == 0) revert InvalidAmount();

        uint256 totalDeposit = amount * pricePerUnit;
        if (msg.value < totalDeposit) revert InsufficientPayment();

        offerId = nextOfferId++;

        offers[offerId] = Offer({
            offerId: offerId,
            buyer: sender,
            tokenId: tokenId,
            amount: amount,
            pricePerUnit: pricePerUnit,
            depositAmount: totalDeposit,
            isActive: true,
            createdAt: block.timestamp,
            expiresAt: block.timestamp + duration
        });

        buyerOffers[sender].push(offerId);

        // Refund excess
        if (msg.value > totalDeposit) {
            (bool success, ) = payable(sender).call{value: msg.value - totalDeposit}("");
            if (!success) revert TransferFailed();
        }

        emit OfferCreated(offerId, sender, tokenId, amount, pricePerUnit);

        return offerId;
    }

    /**
     * @notice Cancel an offer and get refund
     * @param offerId The offer to cancel
     */
    function cancelOffer(uint256 offerId) external nonReentrant {
        address sender = _msgSender();
        Offer storage offer = offers[offerId];

        if (offer.offerId == 0) revert OfferNotFound();
        if (!offer.isActive) revert OfferNotActive();
        if (offer.buyer != sender) revert NotOfferBuyer();

        offer.isActive = false;

        // Refund deposit
        (bool success, ) = payable(sender).call{value: offer.depositAmount}("");
        if (!success) revert TransferFailed();

        emit OfferCancelled(offerId, sender);
    }

    /**
     * @notice Accept an offer (seller side)
     * @param offerId The offer to accept
     */
    function acceptOffer(uint256 offerId) external whenNotPaused onlyKycVerified nonReentrant {
        address sender = _msgSender();
        Offer storage offer = offers[offerId];

        if (offer.offerId == 0) revert OfferNotFound();
        if (!offer.isActive) revert OfferNotActive();
        if (offer.expiresAt > 0 && block.timestamp > offer.expiresAt) {
            revert OfferExpired();
        }
        if (offer.buyer == sender) revert CannotOfferOnOwnCredits();
        if (carbonCredit.balanceOf(sender, offer.tokenId) < offer.amount) {
            revert InsufficientBalance();
        }

        offer.isActive = false;

        uint256 totalPrice = offer.depositAmount;
        uint256 platformFee = (totalPrice * platformFeeBps) / 10000;
        uint256 sellerProceeds = totalPrice - platformFee;

        // Transfer credits from seller to buyer
        carbonCredit.safeTransferFrom(
            sender,
            offer.buyer,
            offer.tokenId,
            offer.amount,
            ""
        );

        // Transfer payment to seller
        (bool sellerSuccess, ) = payable(sender).call{value: sellerProceeds}("");
        if (!sellerSuccess) revert TransferFailed();

        // Transfer fee to platform
        if (platformFee > 0) {
            (bool feeSuccess, ) = payable(feeRecipient).call{value: platformFee}("");
            if (!feeSuccess) revert TransferFailed();
        }

        emit OfferAccepted(
            offerId,
            sender,
            offer.buyer,
            offer.tokenId,
            offer.amount,
            totalPrice
        );
    }

    /**
     * @notice Reject an offer
     * @dev Only the offer buyer can cancel their own offer, or a token holder
     *      with sufficient balance to fulfill the offer can reject it.
     *      This prevents griefing where any small token holder could reject offers.
     * @param offerId The offer to reject
     */
    function rejectOffer(uint256 offerId) external onlyKycVerified nonReentrant {
        address sender = _msgSender();
        Offer storage offer = offers[offerId];

        if (offer.offerId == 0) revert OfferNotFound();
        if (!offer.isActive) revert OfferNotActive();

        // Authorization check:
        // 1. The offer buyer can always cancel/reject their own offer
        // 2. A token holder with enough balance to fulfill the offer can reject
        //    (they are a legitimate potential seller being pestered by the offer)
        bool isBuyer = sender == offer.buyer;
        bool canFulfillOffer = carbonCredit.balanceOf(sender, offer.tokenId) >= offer.amount;

        if (!isBuyer && !canFulfillOffer) {
            revert NotAuthorizedToReject();
        }

        offer.isActive = false;

        // Refund deposit to buyer
        (bool success, ) = payable(offer.buyer).call{value: offer.depositAmount}("");
        if (!success) revert TransferFailed();

        emit OfferRejected(offerId, sender);
    }

    // ============ Pagination Structs ============

    /**
     * @notice Paginated result metadata for gas-safe enumeration
     */
    struct PaginatedResult {
        uint256[] ids;          // Listing or offer IDs in this page
        uint256 totalCount;     // Total active items (for UI pagination controls)
        uint256 offset;         // Offset used for this page
        uint256 returnedCount;  // Number of items returned in this page
        bool hasMore;           // Whether more pages exist beyond this one
    }

    // ============ Errors (Pagination) ============

    error InvalidPaginationLimit();
    error OffsetOutOfBounds();

    // ============ Constants (Pagination) ============

    /// @notice Maximum items per page to prevent gas-limit DoS
    uint256 public constant MAX_PAGE_SIZE = 100;

    /// @notice Default page size when limit is set to 0
    uint256 public constant DEFAULT_PAGE_SIZE = 25;

    // ============ View Functions ============

    /**
     * @notice Get listing details
     */
    function getListing(uint256 listingId) external view returns (Listing memory) {
        return listings[listingId];
    }

    /**
     * @notice Get offer details
     */
    function getOffer(uint256 offerId) external view returns (Offer memory) {
        return offers[offerId];
    }

    /**
     * @notice Get paginated active listings for a specific token
     * @dev Gas-safe pagination prevents unbounded iteration DoS
     * @param tokenId The token ID to query listings for
     * @param offset Starting index in the active listings (skip first N active items)
     * @param limit Maximum number of results to return (0 = default, capped at MAX_PAGE_SIZE)
     * @return result Paginated result containing IDs, total count, and navigation metadata
     */
    function getPaginatedListings(
        uint256 tokenId,
        uint256 offset,
        uint256 limit
    ) external view returns (PaginatedResult memory result) {
        if (limit > MAX_PAGE_SIZE) revert InvalidPaginationLimit();
        uint256 pageSize = limit == 0 ? DEFAULT_PAGE_SIZE : limit;

        uint256[] memory allListings = tokenListings[tokenId];
        uint256 totalLength = allListings.length;

        // First pass: count total active listings for pagination metadata
        uint256 totalActive = 0;
        for (uint256 i = 0; i < totalLength; i++) {
            if (listings[allListings[i]].isActive) {
                totalActive++;
            }
        }

        if (offset >= totalActive && totalActive > 0) {
            revert OffsetOutOfBounds();
        }

        // Determine how many items to return
        uint256 remaining = totalActive > offset ? totalActive - offset : 0;
        uint256 returnCount = remaining < pageSize ? remaining : pageSize;

        uint256[] memory pageIds = new uint256[](returnCount);
        uint256 activeIndex = 0;   // Tracks which active item we're on
        uint256 collected = 0;     // Items collected for this page

        for (uint256 i = 0; i < totalLength && collected < returnCount; i++) {
            if (listings[allListings[i]].isActive) {
                if (activeIndex >= offset) {
                    pageIds[collected] = allListings[i];
                    collected++;
                }
                activeIndex++;
            }
        }

        result = PaginatedResult({
            ids: pageIds,
            totalCount: totalActive,
            offset: offset,
            returnedCount: collected,
            hasMore: (offset + collected) < totalActive
        });
    }

    /**
     * @notice Get paginated listings with full Listing structs (convenience method)
     * @param tokenId The token ID to query
     * @param offset Starting index
     * @param limit Max results
     * @return items Array of full Listing structs
     * @return totalCount Total active listings for this token
     * @return hasMore Whether more pages exist
     */
    function getPaginatedListingDetails(
        uint256 tokenId,
        uint256 offset,
        uint256 limit
    ) external view returns (Listing[] memory items, uint256 totalCount, bool hasMore) {
        if (limit > MAX_PAGE_SIZE) revert InvalidPaginationLimit();
        uint256 pageSize = limit == 0 ? DEFAULT_PAGE_SIZE : limit;

        uint256[] memory allListings = tokenListings[tokenId];
        uint256 totalLength = allListings.length;

        uint256 totalActive = 0;
        for (uint256 i = 0; i < totalLength; i++) {
            if (listings[allListings[i]].isActive) {
                totalActive++;
            }
        }

        if (offset >= totalActive && totalActive > 0) {
            revert OffsetOutOfBounds();
        }

        uint256 remaining = totalActive > offset ? totalActive - offset : 0;
        uint256 returnCount = remaining < pageSize ? remaining : pageSize;

        items = new Listing[](returnCount);
        uint256 activeIndex = 0;
        uint256 collected = 0;

        for (uint256 i = 0; i < totalLength && collected < returnCount; i++) {
            if (listings[allListings[i]].isActive) {
                if (activeIndex >= offset) {
                    items[collected] = listings[allListings[i]];
                    collected++;
                }
                activeIndex++;
            }
        }

        totalCount = totalActive;
        hasMore = (offset + collected) < totalActive;
    }

    /**
     * @notice Get paginated seller listings (active only)
     * @param seller The seller address
     * @param offset Starting index
     * @param limit Max results (0 = default, capped at MAX_PAGE_SIZE)
     * @return result Paginated result
     */
    function getPaginatedSellerListings(
        address seller,
        uint256 offset,
        uint256 limit
    ) external view returns (PaginatedResult memory result) {
        if (limit > MAX_PAGE_SIZE) revert InvalidPaginationLimit();
        uint256 pageSize = limit == 0 ? DEFAULT_PAGE_SIZE : limit;

        uint256[] memory allIds = sellerListings[seller];
        uint256 totalLength = allIds.length;

        uint256 totalActive = 0;
        for (uint256 i = 0; i < totalLength; i++) {
            if (listings[allIds[i]].isActive) {
                totalActive++;
            }
        }

        if (offset >= totalActive && totalActive > 0) {
            revert OffsetOutOfBounds();
        }

        uint256 remaining = totalActive > offset ? totalActive - offset : 0;
        uint256 returnCount = remaining < pageSize ? remaining : pageSize;

        uint256[] memory pageIds = new uint256[](returnCount);
        uint256 activeIndex = 0;
        uint256 collected = 0;

        for (uint256 i = 0; i < totalLength && collected < returnCount; i++) {
            if (listings[allIds[i]].isActive) {
                if (activeIndex >= offset) {
                    pageIds[collected] = allIds[i];
                    collected++;
                }
                activeIndex++;
            }
        }

        result = PaginatedResult({
            ids: pageIds,
            totalCount: totalActive,
            offset: offset,
            returnedCount: collected,
            hasMore: (offset + collected) < totalActive
        });
    }

    /**
     * @notice Get paginated buyer offers (active only)
     * @param buyer The buyer address
     * @param offset Starting index
     * @param limit Max results (0 = default, capped at MAX_PAGE_SIZE)
     * @return result Paginated result
     */
    function getPaginatedBuyerOffers(
        address buyer,
        uint256 offset,
        uint256 limit
    ) external view returns (PaginatedResult memory result) {
        if (limit > MAX_PAGE_SIZE) revert InvalidPaginationLimit();
        uint256 pageSize = limit == 0 ? DEFAULT_PAGE_SIZE : limit;

        uint256[] memory allIds = buyerOffers[buyer];
        uint256 totalLength = allIds.length;

        uint256 totalActive = 0;
        for (uint256 i = 0; i < totalLength; i++) {
            if (offers[allIds[i]].isActive) {
                totalActive++;
            }
        }

        if (offset >= totalActive && totalActive > 0) {
            revert OffsetOutOfBounds();
        }

        uint256 remaining = totalActive > offset ? totalActive - offset : 0;
        uint256 returnCount = remaining < pageSize ? remaining : pageSize;

        uint256[] memory pageIds = new uint256[](returnCount);
        uint256 activeIndex = 0;
        uint256 collected = 0;

        for (uint256 i = 0; i < totalLength && collected < returnCount; i++) {
            if (offers[allIds[i]].isActive) {
                if (activeIndex >= offset) {
                    pageIds[collected] = allIds[i];
                    collected++;
                }
                activeIndex++;
            }
        }

        result = PaginatedResult({
            ids: pageIds,
            totalCount: totalActive,
            offset: offset,
            returnedCount: collected,
            hasMore: (offset + collected) < totalActive
        });
    }

    /**
     * @notice Get total count of active listings for a token (gas-efficient count-only query)
     * @param tokenId The token ID
     * @return count Number of active listings
     */
    function getActiveListingCount(uint256 tokenId) external view returns (uint256 count) {
        uint256[] memory allListings = tokenListings[tokenId];
        for (uint256 i = 0; i < allListings.length; i++) {
            if (listings[allListings[i]].isActive) {
                count++;
            }
        }
    }

    /**
     * @notice Get total count of active offers for a buyer
     * @param buyer The buyer address
     * @return count Number of active offers
     */
    function getActiveOfferCount(address buyer) external view returns (uint256 count) {
        uint256[] memory allOffers = buyerOffers[buyer];
        for (uint256 i = 0; i < allOffers.length; i++) {
            if (offers[allOffers[i]].isActive) {
                count++;
            }
        }
    }

    /**
     * @notice Backwards-compatible: Get all active listings for a token (capped at MAX_PAGE_SIZE)
     * @dev DEPRECATED: Use getPaginatedListings() for production. This function exists
     *      for backwards compatibility but caps results at MAX_PAGE_SIZE to prevent gas DoS.
     * @param tokenId The token ID
     * @return activeListingIds Array of active listing IDs (max MAX_PAGE_SIZE)
     */
    function getActiveListingsForToken(uint256 tokenId) external view returns (uint256[] memory) {
        uint256[] memory allListings = tokenListings[tokenId];
        uint256 totalLength = allListings.length;

        // Count active (capped)
        uint256 activeCount = 0;
        for (uint256 i = 0; i < totalLength && activeCount < MAX_PAGE_SIZE; i++) {
            if (listings[allListings[i]].isActive) {
                activeCount++;
            }
        }

        uint256[] memory activeListings = new uint256[](activeCount);
        uint256 index = 0;
        for (uint256 i = 0; i < totalLength && index < activeCount; i++) {
            if (listings[allListings[i]].isActive) {
                activeListings[index++] = allListings[i];
            }
        }

        return activeListings;
    }

    /**
     * @notice Get seller's active listings
     * @dev DEPRECATED: Use getPaginatedSellerListings() for production
     */
    function getSellerListings(address seller) external view returns (uint256[] memory) {
        return sellerListings[seller];
    }

    /**
     * @notice Get buyer's active offers
     * @dev DEPRECATED: Use getPaginatedBuyerOffers() for production
     */
    function getBuyerOffers(address buyer) external view returns (uint256[] memory) {
        return buyerOffers[buyer];
    }

    /**
     * @notice Calculate total price including fee
     */
    function calculateTotalPrice(
        uint256 pricePerUnit,
        uint256 amount
    ) external view returns (uint256 subtotal, uint256 fee, uint256 total) {
        subtotal = pricePerUnit * amount;
        fee = (subtotal * platformFeeBps) / 10000;
        total = subtotal; // Buyer pays subtotal, fee comes out of seller proceeds
        return (subtotal, fee, total);
    }

    // ============ Admin Functions ============

    /**
     * @notice Set KYC verification status for a user
     */
    function setKycStatus(address user, bool verified) external onlyOwner {
        isKycVerified[user] = verified;
        emit KycStatusUpdated(user, verified);
    }

    /**
     * @notice Batch set KYC status
     */
    function batchSetKycStatus(
        address[] calldata users,
        bool[] calldata statuses
    ) external onlyOwner {
        require(users.length == statuses.length, "Array length mismatch");
        for (uint256 i = 0; i < users.length; i++) {
            isKycVerified[users[i]] = statuses[i];
            emit KycStatusUpdated(users[i], statuses[i]);
        }
    }

    /**
     * @notice Set KYC requirement
     */
    function setKycRequired(bool required) external onlyOwner {
        kycRequired = required;
    }

    /**
     * @notice Update platform fee
     */
    function setPlatformFee(uint256 newFeeBps) external onlyOwner {
        if (newFeeBps > MAX_FEE_BPS) revert FeeTooHigh();
        uint256 oldFee = platformFeeBps;
        platformFeeBps = newFeeBps;
        emit PlatformFeeUpdated(oldFee, newFeeBps);
    }

    /**
     * @notice Update fee recipient
     */
    function setFeeRecipient(address newRecipient) external onlyOwner {
        if (newRecipient == address(0)) revert InvalidFeeRecipient();
        feeRecipient = newRecipient;
    }

    /**
     * @notice Pause marketplace
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @notice Unpause marketplace
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @notice Emergency withdraw stuck funds
     */
    function emergencyWithdraw(address to) external onlyOwner {
        uint256 balance = address(this).balance;
        (bool success, ) = payable(to).call{value: balance}("");
        if (!success) revert TransferFailed();
    }

    // ============ UUPS ============

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    /**
     * @notice Contract version
     * @dev v1.3.0: Added batch query functions for gas optimization
     * @dev v1.2.0: Added gas-safe paginated query functions (audit recommendation)
     * @dev v1.1.0: Fixed ERC-2771 compatibility - all msg.sender replaced with _msgSender()
     */
    function version() external pure returns (string memory) {
        return "1.3.0";
    }

    // ============ Batch Query Functions (Gas Optimization) ============

    /**
     * @notice Get multiple listings by IDs in a single call
     * @dev Gas optimization: Reduces RPC calls for frontend listing displays.
     *      Useful for loading user's portfolio of listings efficiently.
     * @param listingIds Array of listing IDs to fetch
     * @return listingsArray Array of Listing structs
     */
    function batchGetListings(
        uint256[] calldata listingIds
    ) external view returns (Listing[] memory listingsArray) {
        uint256 len = listingIds.length;
        require(len <= 100, "Batch too large");

        listingsArray = new Listing[](len);

        for (uint256 i = 0; i < len; ) {
            listingsArray[i] = listings[listingIds[i]];
            unchecked { ++i; }
        }
    }

    /**
     * @notice Get multiple offers by IDs in a single call
     * @dev Gas optimization: Reduces RPC calls for frontend offer displays.
     * @param offerIds Array of offer IDs to fetch
     * @return offersArray Array of Offer structs
     */
    function batchGetOffers(
        uint256[] calldata offerIds
    ) external view returns (Offer[] memory offersArray) {
        uint256 len = offerIds.length;
        require(len <= 100, "Batch too large");

        offersArray = new Offer[](len);

        for (uint256 i = 0; i < len; ) {
            offersArray[i] = offers[offerIds[i]];
            unchecked { ++i; }
        }
    }

    /**
     * @notice Calculate prices for multiple potential purchases
     * @dev Gas optimization: Single call for price comparison UI.
     * @param listingIds Array of listing IDs
     * @param amounts Array of amounts for each listing
     * @return subtotals Array of subtotals (amount × pricePerUnit)
     * @return fees Array of platform fees
     * @return totals Array of total prices buyers need to pay
     */
    function batchCalculatePrices(
        uint256[] calldata listingIds,
        uint256[] calldata amounts
    ) external view returns (
        uint256[] memory subtotals,
        uint256[] memory fees,
        uint256[] memory totals
    ) {
        uint256 len = listingIds.length;
        require(len == amounts.length, "Length mismatch");
        require(len <= 50, "Batch too large");

        subtotals = new uint256[](len);
        fees = new uint256[](len);
        totals = new uint256[](len);

        for (uint256 i = 0; i < len; ) {
            Listing storage listing = listings[listingIds[i]];
            uint256 amount = amounts[i];

            unchecked {
                uint256 subtotal = listing.pricePerUnit * amount;
                uint256 fee = (subtotal * platformFeeBps) / 10000;

                subtotals[i] = subtotal;
                fees[i] = fee;
                totals[i] = subtotal; // Buyer pays subtotal; fee comes from seller proceeds

                ++i;
            }
        }
    }

    /**
     * @notice Check if multiple listings are still active and purchasable
     * @dev Gas optimization: Single call for cart validation.
     * @param listingIds Array of listing IDs to check
     * @param amounts Array of amounts to purchase
     * @return isValid Array of booleans indicating if each purchase is valid
     * @return reasons Array of reason codes (0=valid, 1=inactive, 2=expired, 3=insufficient, 4=below_min)
     */
    function batchValidatePurchases(
        uint256[] calldata listingIds,
        uint256[] calldata amounts
    ) external view returns (bool[] memory isValid, uint8[] memory reasons) {
        uint256 len = listingIds.length;
        require(len == amounts.length, "Length mismatch");
        require(len <= 50, "Batch too large");

        isValid = new bool[](len);
        reasons = new uint8[](len);

        for (uint256 i = 0; i < len; ) {
            Listing storage listing = listings[listingIds[i]];
            uint256 amount = amounts[i];

            if (!listing.isActive) {
                isValid[i] = false;
                reasons[i] = 1; // Inactive
            } else if (listing.expiresAt > 0 && block.timestamp > listing.expiresAt) {
                isValid[i] = false;
                reasons[i] = 2; // Expired
            } else if (amount > listing.amount) {
                isValid[i] = false;
                reasons[i] = 3; // Insufficient amount
            } else if (listing.minPurchaseAmount > 0 && amount < listing.minPurchaseAmount) {
                isValid[i] = false;
                reasons[i] = 4; // Below minimum
            } else {
                isValid[i] = true;
                reasons[i] = 0; // Valid
            }

            unchecked { ++i; }
        }
    }
}
