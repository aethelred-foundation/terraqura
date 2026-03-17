# Solidity API

## CarbonCredit

ERC-1155 token representing verified carbon credits from DAC facilities

_Uses UUPS proxy pattern for upgradeability

Each token ID represents a unique batch of carbon credits from a specific
capture event. The token ID is derived from:
- DAC unit ID
- Capture timestamp
- Source data hash

This ensures each batch is uniquely identifiable and traceable back to
the original carbon capture event._

### verificationEngine

```solidity
contract IVerificationEngine verificationEngine
```

Reference to the verification engine contract

### usedDataHashes

```solidity
mapping(bytes32 => bool) usedDataHashes
```

Mapping of source data hashes to prevent double-minting

### approvedMinters

```solidity
mapping(address => bool) approvedMinters
```

Mapping of approved minters (operators)

### VERSION

```solidity
string VERSION
```

Contract version for upgrade tracking

### SCALE

```solidity
uint256 SCALE
```

Scaling factor matching verification engine

### MinterUpdated

```solidity
event MinterUpdated(address minter, bool approved)
```

Emitted when a minter is approved or revoked

### VerificationEngineUpdated

```solidity
event VerificationEngineUpdated(address oldEngine, address newEngine)
```

Emitted when verification engine is updated

### UnauthorizedMinter

```solidity
error UnauthorizedMinter()
```

### DataHashAlreadyUsed

```solidity
error DataHashAlreadyUsed()
```

### VerificationFailed

```solidity
error VerificationFailed(string phase)
```

### InsufficientBalance

```solidity
error InsufficientBalance()
```

### CreditAlreadyRetired

```solidity
error CreditAlreadyRetired()
```

### InvalidVerificationEngine

```solidity
error InvalidVerificationEngine()
```

### EmptyMetadataUri

```solidity
error EmptyMetadataUri()
```

### onlyMinter

```solidity
modifier onlyMinter()
```

Restricts minting to approved operators

### constructor

```solidity
constructor() public
```

### initialize

```solidity
function initialize(address _verificationEngine, string _uri, address _owner) public
```

Initialize the contract (called once during deployment)

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| _verificationEngine | address | Address of the verification engine |
| _uri | string | Base URI for token metadata |
| _owner | address | Address of the contract owner (multi-sig) |

### mintVerifiedCredits

```solidity
function mintVerifiedCredits(address to, bytes32 dacUnitId, bytes32 sourceDataHash, uint256 captureTimestamp, uint256 co2AmountKg, uint256 energyConsumedKwh, int256 latitude, int256 longitude, uint8 purityPercentage, string ipfsMetadataUri, string arweaveBackupTxId) external returns (uint256 tokenId)
```

Mint verified carbon credits

### retireCredits

```solidity
function retireCredits(uint256 tokenId, uint256 amount, string reason) external
```

Retire carbon credits

### getCreditProvenance

```solidity
function getCreditProvenance(uint256 tokenId) external view returns (struct ICarbonCredit.CreditMetadata metadata, struct ICarbonCredit.VerificationResult verification)
```

Get credit provenance

### totalCreditsMinted

```solidity
function totalCreditsMinted() external view returns (uint256)
```

Get total credits minted

### totalCreditsRetired

```solidity
function totalCreditsRetired() external view returns (uint256)
```

Get total credits retired

### getMetadata

```solidity
function getMetadata(uint256 tokenId) external view returns (struct ICarbonCredit.CreditMetadata)
```

Get the metadata for a specific token

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenId | uint256 | The token ID to query |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | struct ICarbonCredit.CreditMetadata | The credit metadata |

### getVerificationResult

```solidity
function getVerificationResult(uint256 tokenId) external view returns (struct ICarbonCredit.VerificationResult)
```

Get the verification result for a specific token

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenId | uint256 | The token ID to query |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | struct ICarbonCredit.VerificationResult | The verification result |

### uri

```solidity
function uri(uint256 tokenId) public view returns (string)
```

Returns the URI for a token ID

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenId | uint256 | The token ID |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | string | The IPFS URI for the token metadata |

### setMinter

```solidity
function setMinter(address minter, bool approved) external
```

Approve or revoke a minter

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| minter | address | Address to update |
| approved | bool | Whether to approve or revoke |

### setVerificationEngine

```solidity
function setVerificationEngine(address _verificationEngine) external
```

Update the verification engine address

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| _verificationEngine | address | New verification engine address |

### pause

```solidity
function pause() external
```

Pause the contract

### unpause

```solidity
function unpause() external
```

Unpause the contract

### setBaseUri

```solidity
function setBaseUri(string newUri) external
```

Set the base URI for all tokens

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| newUri | string | New base URI |

### _generateTokenId

```solidity
function _generateTokenId(bytes32 dacUnitId, uint256 captureTimestamp, bytes32 sourceDataHash) internal pure returns (uint256)
```

Generate a unique token ID

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| dacUnitId | bytes32 | The DAC facility ID |
| captureTimestamp | uint256 | The capture timestamp |
| sourceDataHash | bytes32 | The source data hash |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | The generated token ID |

### _authorizeUpgrade

```solidity
function _authorizeUpgrade(address newImplementation) internal
```

Authorize upgrade (UUPS pattern)

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| newImplementation | address | Address of new implementation |

### isMinter

```solidity
function isMinter(address account) external view returns (bool)
```

Check if an address is an approved minter

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| account | address | Address to check |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool | Whether the address is approved |

### totalSupply

```solidity
function totalSupply(uint256 tokenId) external view returns (uint256)
```

Get the total supply of a specific token

_Note: ERC1155 doesn't have built-in totalSupply, this requires tracking_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenId | uint256 | The token ID to query |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | This returns 0 as we don't track individual token supplies |

### exists

```solidity
function exists(uint256 tokenId) external view returns (bool)
```

Check if a token exists (has been minted)

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenId | uint256 | The token ID to check |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool | Whether the token exists |

### version

```solidity
function version() external pure returns (string)
```

Get contract version

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | string | The version string |

