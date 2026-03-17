# Solidity API

## ChainlinkVerifier

Decentralized oracle verification for carbon capture data

_Uses Chainlink Functions to verify IoT data off-chain_

### VerificationRequested

```solidity
event VerificationRequested(bytes32 requestId, bytes32 batchId, address operator)
```

### VerificationFulfilled

```solidity
event VerificationFulfilled(bytes32 requestId, bytes32 batchId, bool passed, uint256 co2Verified, uint256 efficiencyVerified)
```

### VerificationFailed

```solidity
event VerificationFailed(bytes32 requestId, bytes32 batchId, bytes error)
```

### donId

```solidity
bytes32 donId
```

### subscriptionId

```solidity
uint64 subscriptionId
```

### gasLimit

```solidity
uint32 gasLimit
```

### encryptedSecretsUrls

```solidity
bytes encryptedSecretsUrls
```

### verificationSource

```solidity
string verificationSource
```

### VerificationRequest

```solidity
struct VerificationRequest {
  bytes32 batchId;
  address operator;
  uint256 co2Claimed;
  uint256 efficiencyClaimed;
  uint256 timestamp;
  bool fulfilled;
  bool passed;
}
```

### requests

```solidity
mapping(bytes32 => struct ChainlinkVerifier.VerificationRequest) requests
```

### batchToRequest

```solidity
mapping(bytes32 => bytes32) batchToRequest
```

### VerificationResult

```solidity
struct VerificationResult {
  bool verified;
  uint256 co2Verified;
  uint256 efficiencyVerified;
  bytes32 dataHash;
  uint256 timestamp;
}
```

### results

```solidity
mapping(bytes32 => struct ChainlinkVerifier.VerificationResult) results
```

### authorizedCallers

```solidity
mapping(address => bool) authorizedCallers
```

### UnauthorizedCaller

```solidity
error UnauthorizedCaller()
```

### RequestNotFound

```solidity
error RequestNotFound()
```

### RequestAlreadyFulfilled

```solidity
error RequestAlreadyFulfilled()
```

### InvalidBatchId

```solidity
error InvalidBatchId()
```

### constructor

```solidity
constructor(address _router, bytes32 _donId, uint64 _subscriptionId) public
```

### setDonId

```solidity
function setDonId(bytes32 _donId) external
```

### setSubscriptionId

```solidity
function setSubscriptionId(uint64 _subscriptionId) external
```

### setGasLimit

```solidity
function setGasLimit(uint32 _gasLimit) external
```

### setVerificationSource

```solidity
function setVerificationSource(string _source) external
```

### setEncryptedSecretsUrls

```solidity
function setEncryptedSecretsUrls(bytes _urls) external
```

### setAuthorizedCaller

```solidity
function setAuthorizedCaller(address caller, bool authorized) external
```

### requestVerification

```solidity
function requestVerification(bytes32 batchId, uint256 co2Claimed, uint256 efficiencyClaimed, string apiEndpoint, bytes32 dataHash) external returns (bytes32 requestId)
```

Request verification for a batch

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| batchId | bytes32 | Unique identifier for the verification batch |
| co2Claimed | uint256 | Claimed CO2 captured (in wei, 18 decimals) |
| efficiencyClaimed | uint256 | Claimed efficiency factor (kWh/tonne * 10000) |
| apiEndpoint | string | API endpoint to fetch sensor data |
| dataHash | bytes32 | Hash of the raw data for integrity check |

### fulfillRequest

```solidity
function fulfillRequest(bytes32 requestId, bytes response, bytes err) internal
```

Callback function for Chainlink Functions

_Called by the DON when the request is fulfilled_

### getVerificationResult

```solidity
function getVerificationResult(bytes32 batchId) external view returns (bool verified, uint256 co2Verified, uint256 efficiencyVerified, bytes32 dataHash, uint256 timestamp)
```

### getRequestStatus

```solidity
function getRequestStatus(bytes32 requestId) external view returns (bytes32 batchId, address operator, bool fulfilled, bool passed)
```

### isVerified

```solidity
function isVerified(bytes32 batchId) external view returns (bool)
```

### _bytes32ToString

```solidity
function _bytes32ToString(bytes32 _bytes) internal pure returns (string)
```

### _char

```solidity
function _char(bytes1 b) internal pure returns (bytes1)
```

### _uint256ToString

```solidity
function _uint256ToString(uint256 value) internal pure returns (string)
```

### _getDefaultVerificationSource

```solidity
function _getDefaultVerificationSource() internal pure returns (string)
```

