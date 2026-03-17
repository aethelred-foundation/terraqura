# Solidity API

## CarbonMarketplace

Peer-to-peer marketplace for trading carbon credits

_Supports fixed-price listings and offers for ERC-1155 carbon credits

IMPORTANT: This contract uses _msgSender() instead of msg.sender to support
ERC-2771 meta-transactions (gasless transactions). When inherited by
GaslessMarketplace, the _msgSender() will return the actual user address
instead of the relayer address.

Features:
- List credits for sale at fixed price
- Make offers on any credit (listed or not)
- Accept/reject offers
- Cancel listings
- Platform fee collection (configurable)
- KYC requirement enforcement
- ERC-2771 gasless transaction support_

### Listing

```solidity
struct Listing {
  uint256 listingId;
  address seller;
  uint256 tokenId;
  uint256 amount;
  uint256 pricePerUnit;
  uint256 minPurchaseAmount;
  bool isActive;
  uint256 createdAt;
  uint256 expiresAt;
}
```

### Offer

```solidity
struct Offer {
  uint256 offerId;
  address buyer;
  uint256 tokenId;
  uint256 amount;
  uint256 pricePerUnit;
  uint256 depositAmount;
  bool isActive;
  uint256 createdAt;
  uint256 expiresAt;
}
```

### carbonCredit

```solidity
contract IERC1155 carbonCredit
```

The carbon credit token contract

### platformFeeBps

```solidity
uint256 platformFeeBps
```

Platform fee in basis points (100 = 1%)

### MAX_FEE_BPS

```solidity
uint256 MAX_FEE_BPS
```

Maximum platform fee (5%)

### feeRecipient

```solidity
address feeRecipient
```

Fee recipient address

### nextListingId

```solidity
uint256 nextListingId
```

Listing counter

### nextOfferId

```solidity
uint256 nextOfferId
```

Offer counter

### listings

```solidity
mapping(uint256 => struct CarbonMarketplace.Listing) listings
```

Mapping of listing ID to Listing

### offers

```solidity
mapping(uint256 => struct CarbonMarketplace.Offer) offers
```

Mapping of offer ID to Offer

### sellerListings

```solidity
mapping(address => uint256[]) sellerListings
```

Mapping of seller address to their active listing IDs

### buyerOffers

```solidity
mapping(address => uint256[]) buyerOffers
```

Mapping of buyer address to their active offer IDs

### tokenListings

```solidity
mapping(uint256 => uint256[]) tokenListings
```

Mapping of token ID to active listing IDs

### kycRegistry

```solidity
address kycRegistry
```

KYC registry contract (optional)

### kycRequired

```solidity
bool kycRequired
```

Whether KYC is required for trading

### isKycVerified

```solidity
mapping(address => bool) isKycVerified
```

Mapping of KYC-verified addresses

### ListingCreated

```solidity
event ListingCreated(uint256 listingId, address seller, uint256 tokenId, uint256 amount, uint256 pricePerUnit)
```

### ListingCancelled

```solidity
event ListingCancelled(uint256 listingId, address seller)
```

### ListingUpdated

```solidity
event ListingUpdated(uint256 listingId, uint256 newPrice, uint256 newAmount)
```

### Purchase

```solidity
event Purchase(uint256 listingId, address buyer, address seller, uint256 tokenId, uint256 amount, uint256 totalPrice, uint256 platformFee)
```

### OfferCreated

```solidity
event OfferCreated(uint256 offerId, address buyer, uint256 tokenId, uint256 amount, uint256 pricePerUnit)
```

### OfferAccepted

```solidity
event OfferAccepted(uint256 offerId, address seller, address buyer, uint256 tokenId, uint256 amount, uint256 totalPrice)
```

### OfferCancelled

```solidity
event OfferCancelled(uint256 offerId, address buyer)
```

### OfferRejected

```solidity
event OfferRejected(uint256 offerId, address seller)
```

### KycStatusUpdated

```solidity
event KycStatusUpdated(address user, bool verified)
```

### PlatformFeeUpdated

```solidity
event PlatformFeeUpdated(uint256 oldFee, uint256 newFee)
```

### InvalidCarbonCreditContract

```solidity
error InvalidCarbonCreditContract()
```

### InvalidFeeRecipient

```solidity
error InvalidFeeRecipient()
```

### FeeTooHigh

```solidity
error FeeTooHigh()
```

### InvalidPrice

```solidity
error InvalidPrice()
```

### InvalidAmount

```solidity
error InvalidAmount()
```

### ListingNotFound

```solidity
error ListingNotFound()
```

### ListingNotActive

```solidity
error ListingNotActive()
```

### ListingExpired

```solidity
error ListingExpired()
```

### NotListingSeller

```solidity
error NotListingSeller()
```

### InsufficientPayment

```solidity
error InsufficientPayment()
```

### InsufficientBalance

```solidity
error InsufficientBalance()
```

### BelowMinPurchase

```solidity
error BelowMinPurchase()
```

### OfferNotFound

```solidity
error OfferNotFound()
```

### OfferNotActive

```solidity
error OfferNotActive()
```

### OfferExpired

```solidity
error OfferExpired()
```

### NotOfferBuyer

```solidity
error NotOfferBuyer()
```

### KycNotVerified

```solidity
error KycNotVerified()
```

### TransferFailed

```solidity
error TransferFailed()
```

### CannotBuyOwnListing

```solidity
error CannotBuyOwnListing()
```

### CannotOfferOnOwnCredits

```solidity
error CannotOfferOnOwnCredits()
```

### NotAuthorizedToReject

```solidity
error NotAuthorizedToReject()
```

### onlyKycVerified

```solidity
modifier onlyKycVerified()
```

### constructor

```solidity
constructor() public
```

### initialize

```solidity
function initialize(address _carbonCredit, address _feeRecipient, uint256 _platformFeeBps, address _owner) public
```

Initialize the marketplace

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| _carbonCredit | address | Address of the CarbonCredit contract |
| _feeRecipient | address | Address to receive platform fees |
| _platformFeeBps | uint256 | Platform fee in basis points |
| _owner | address | Contract owner (multi-sig) |

### createListing

```solidity
function createListing(uint256 tokenId, uint256 amount, uint256 pricePerUnit, uint256 minPurchaseAmount, uint256 duration) external returns (uint256 listingId)
```

Create a new listing to sell carbon credits

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenId | uint256 | The token ID to sell |
| amount | uint256 | Number of credits to sell |
| pricePerUnit | uint256 | Price per credit in wei |
| minPurchaseAmount | uint256 | Minimum credits per purchase (0 = no minimum) |
| duration | uint256 | Listing duration in seconds (0 = no expiry) |

### cancelListing

```solidity
function cancelListing(uint256 listingId) external
```

Cancel a listing and return credits to seller

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| listingId | uint256 | The listing to cancel |

### updateListing

```solidity
function updateListing(uint256 listingId, uint256 newPricePerUnit, uint256 newAmount) external
```

Update listing price or amount

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| listingId | uint256 | The listing to update |
| newPricePerUnit | uint256 | New price (0 = keep current) |
| newAmount | uint256 | New amount (0 = keep current) |

### purchase

```solidity
function purchase(uint256 listingId, uint256 amount) external payable
```

Purchase credits from a listing

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| listingId | uint256 | The listing to purchase from |
| amount | uint256 | Number of credits to purchase |

### createOffer

```solidity
function createOffer(uint256 tokenId, uint256 amount, uint256 pricePerUnit, uint256 duration) external payable returns (uint256 offerId)
```

Create an offer to buy credits

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenId | uint256 | The token ID to make offer on |
| amount | uint256 | Number of credits wanted |
| pricePerUnit | uint256 | Offered price per credit |
| duration | uint256 | Offer duration in seconds |

### cancelOffer

```solidity
function cancelOffer(uint256 offerId) external
```

Cancel an offer and get refund

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| offerId | uint256 | The offer to cancel |

### acceptOffer

```solidity
function acceptOffer(uint256 offerId) external
```

Accept an offer (seller side)

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| offerId | uint256 | The offer to accept |

### rejectOffer

```solidity
function rejectOffer(uint256 offerId) external
```

Reject an offer

_Only the offer buyer can cancel their own offer, or a token holder
     with sufficient balance to fulfill the offer can reject it.
     This prevents griefing where any small token holder could reject offers._

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| offerId | uint256 | The offer to reject |

### getListing

```solidity
function getListing(uint256 listingId) external view returns (struct CarbonMarketplace.Listing)
```

Get listing details

### getOffer

```solidity
function getOffer(uint256 offerId) external view returns (struct CarbonMarketplace.Offer)
```

Get offer details

### getActiveListingsForToken

```solidity
function getActiveListingsForToken(uint256 tokenId) external view returns (uint256[])
```

Get all active listings for a token

### getSellerListings

```solidity
function getSellerListings(address seller) external view returns (uint256[])
```

Get seller's active listings

### getBuyerOffers

```solidity
function getBuyerOffers(address buyer) external view returns (uint256[])
```

Get buyer's active offers

### calculateTotalPrice

```solidity
function calculateTotalPrice(uint256 pricePerUnit, uint256 amount) external view returns (uint256 subtotal, uint256 fee, uint256 total)
```

Calculate total price including fee

### setKycStatus

```solidity
function setKycStatus(address user, bool verified) external
```

Set KYC verification status for a user

### batchSetKycStatus

```solidity
function batchSetKycStatus(address[] users, bool[] statuses) external
```

Batch set KYC status

### setKycRequired

```solidity
function setKycRequired(bool required) external
```

Set KYC requirement

### setPlatformFee

```solidity
function setPlatformFee(uint256 newFeeBps) external
```

Update platform fee

### setFeeRecipient

```solidity
function setFeeRecipient(address newRecipient) external
```

Update fee recipient

### pause

```solidity
function pause() external
```

Pause marketplace

### unpause

```solidity
function unpause() external
```

Unpause marketplace

### emergencyWithdraw

```solidity
function emergencyWithdraw(address to) external
```

Emergency withdraw stuck funds

### _authorizeUpgrade

```solidity
function _authorizeUpgrade(address newImplementation) internal
```

_Function that should revert when `msg.sender` is not authorized to upgrade the contract. Called by
{upgradeTo} and {upgradeToAndCall}.

Normally, this function will use an xref:access.adoc[access control] modifier such as {Ownable-onlyOwner}.

```solidity
function _authorizeUpgrade(address) internal override onlyOwner {}
```_

### version

```solidity
function version() external pure returns (string)
```

Contract version

_v1.1.0: Fixed ERC-2771 compatibility - all msg.sender replaced with _msgSender()_

