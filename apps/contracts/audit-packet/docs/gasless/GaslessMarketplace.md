# Solidity API

## ICarbonCreditBase

### safeTransferFrom

```solidity
function safeTransferFrom(address from, address to, uint256 id, uint256 amount, bytes data) external
```

### isApprovedForAll

```solidity
function isApprovedForAll(address account, address operator) external view returns (bool)
```

## GaslessMarketplace

_Marketplace with INLINE ERC-2771 support and Fixed v4 Inheritance._

### MARKET_ROLE

```solidity
bytes32 MARKET_ROLE
```

### ADMIN_ROLE

```solidity
bytes32 ADMIN_ROLE
```

### carbonCredit

```solidity
address carbonCredit
```

### Listing

```solidity
struct Listing {
  uint256 listingId;
  address seller;
  uint256 tokenId;
  uint256 amount;
  uint256 pricePerUnit;
  bool active;
}
```

### listings

```solidity
mapping(uint256 => struct GaslessMarketplace.Listing) listings
```

### ListingCreated

```solidity
event ListingCreated(uint256 listingId, address seller, uint256 tokenId, uint256 amount, uint256 pricePerUnit)
```

### ListingSold

```solidity
event ListingSold(uint256 listingId, address buyer, uint256 amount, uint256 totalPrice)
```

### ListingCancelled

```solidity
event ListingCancelled(uint256 listingId)
```

### constructor

```solidity
constructor() public
```

### initialize

```solidity
function initialize(address _accessControl, address _carbonCredit, address _forwarderAddress) public
```

### createListing

```solidity
function createListing(uint256 _tokenId, uint256 _amount, uint256 _pricePerUnit) external
```

### buyListing

```solidity
function buyListing(uint256 _listingId, uint256 _amountToBuy) external payable
```

### isTrustedForwarder

```solidity
function isTrustedForwarder(address forwarder) public view virtual returns (bool)
```

### _msgSender

```solidity
function _msgSender() internal view virtual returns (address sender)
```

### _msgData

```solidity
function _msgData() internal view virtual returns (bytes)
```

### supportsInterface

```solidity
function supportsInterface(bytes4 interfaceId) public view virtual returns (bool)
```

