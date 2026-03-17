# Solidity API

## TerraQuraMultisig

Enterprise-grade multisig wallet for critical operations

_Implements M-of-N signature scheme with:
- Configurable threshold (e.g., 3-of-5)
- Transaction queuing with nonce
- Signer management
- Emergency recovery options

Security features:
- EIP-712 typed signatures
- Replay protection via nonces
- Signer rotation support
- Transaction expiration_

### Transaction

```solidity
struct Transaction {
  address to;
  uint256 value;
  bytes data;
  bool executed;
  uint256 confirmations;
  uint256 createdAt;
  uint256 expiresAt;
}
```

### signers

```solidity
address[] signers
```

List of signers

### isSigner

```solidity
mapping(address => bool) isSigner
```

Mapping to check if address is a signer

### threshold

```solidity
uint256 threshold
```

Number of required confirmations

### MIN_THRESHOLD

```solidity
uint256 MIN_THRESHOLD
```

Minimum threshold (at least 2 signers)

### MAX_SIGNERS

```solidity
uint256 MAX_SIGNERS
```

Maximum signers

### nonce

```solidity
uint256 nonce
```

Transaction nonce

### transactions

```solidity
mapping(uint256 => struct TerraQuraMultisig.Transaction) transactions
```

Mapping of transaction ID to Transaction

### confirmations

```solidity
mapping(uint256 => mapping(address => bool)) confirmations
```

Mapping of transaction ID to signer to confirmation status

### DEFAULT_EXPIRY

```solidity
uint256 DEFAULT_EXPIRY
```

Default transaction expiry (7 days)

### TRANSACTION_TYPEHASH

```solidity
bytes32 TRANSACTION_TYPEHASH
```

EIP-712 type hash for transaction

### TransactionSubmitted

```solidity
event TransactionSubmitted(uint256 txId, address submitter, address to, uint256 value, bytes data)
```

### TransactionConfirmed

```solidity
event TransactionConfirmed(uint256 txId, address signer)
```

### TransactionRevoked

```solidity
event TransactionRevoked(uint256 txId, address signer)
```

### TransactionExecuted

```solidity
event TransactionExecuted(uint256 txId, address executor)
```

### TransactionFailed

```solidity
event TransactionFailed(uint256 txId, string reason)
```

### SignerAdded

```solidity
event SignerAdded(address signer)
```

### SignerRemoved

```solidity
event SignerRemoved(address signer)
```

### ThresholdChanged

```solidity
event ThresholdChanged(uint256 oldThreshold, uint256 newThreshold)
```

### NotSigner

```solidity
error NotSigner()
```

### InvalidThreshold

```solidity
error InvalidThreshold()
```

### InvalidSigner

```solidity
error InvalidSigner()
```

### SignerAlreadyExists

```solidity
error SignerAlreadyExists()
```

### SignerDoesNotExist

```solidity
error SignerDoesNotExist()
```

### TransactionDoesNotExist

```solidity
error TransactionDoesNotExist()
```

### TransactionAlreadyExecuted

```solidity
error TransactionAlreadyExecuted()
```

### TransactionExpired

```solidity
error TransactionExpired()
```

### TransactionNotConfirmed

```solidity
error TransactionNotConfirmed()
```

### AlreadyConfirmed

```solidity
error AlreadyConfirmed()
```

### NotConfirmed

```solidity
error NotConfirmed()
```

### ExecutionFailed

```solidity
error ExecutionFailed()
```

### CannotRemoveLastSigner

```solidity
error CannotRemoveLastSigner()
```

### onlySigner

```solidity
modifier onlySigner()
```

### onlySelf

```solidity
modifier onlySelf()
```

### txExists

```solidity
modifier txExists(uint256 txId)
```

### notExecuted

```solidity
modifier notExecuted(uint256 txId)
```

### notExpired

```solidity
modifier notExpired(uint256 txId)
```

### constructor

```solidity
constructor(address[] _signers, uint256 _threshold) public
```

Initialize the multisig

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| _signers | address[] | Initial list of signers |
| _threshold | uint256 | Required confirmations |

### submitTransaction

```solidity
function submitTransaction(address to, uint256 value, bytes data) external returns (uint256 txId)
```

Submit a new transaction

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| to | address | Target address |
| value | uint256 | ETH value |
| data | bytes | Call data |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| txId | uint256 | Transaction ID |

### submitTransactionWithExpiry

```solidity
function submitTransactionWithExpiry(address to, uint256 value, bytes data, uint256 expiry) external returns (uint256 txId)
```

Submit a transaction with custom expiry

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| to | address | Target address |
| value | uint256 | ETH value |
| data | bytes | Call data |
| expiry | uint256 | Expiry duration in seconds |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| txId | uint256 | Transaction ID |

### _submitTransaction

```solidity
function _submitTransaction(address to, uint256 value, bytes data, uint256 expiry) internal returns (uint256 txId)
```

### confirmTransaction

```solidity
function confirmTransaction(uint256 txId) external
```

Confirm a pending transaction

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| txId | uint256 | Transaction ID |

### _confirmTransaction

```solidity
function _confirmTransaction(uint256 txId) internal
```

### revokeConfirmation

```solidity
function revokeConfirmation(uint256 txId) external
```

Revoke confirmation for a transaction

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| txId | uint256 | Transaction ID |

### executeTransaction

```solidity
function executeTransaction(uint256 txId) external
```

Execute a confirmed transaction

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| txId | uint256 | Transaction ID |

### addSigner

```solidity
function addSigner(address signer) external
```

Add a new signer (must be called via multisig)

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| signer | address | Address to add |

### removeSigner

```solidity
function removeSigner(address signer) external
```

Remove a signer (must be called via multisig)

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| signer | address | Address to remove |

### changeThreshold

```solidity
function changeThreshold(uint256 newThreshold) external
```

Change the threshold (must be called via multisig)

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| newThreshold | uint256 | New required confirmations |

### getSigners

```solidity
function getSigners() external view returns (address[])
```

Get all signers

### getSignerCount

```solidity
function getSignerCount() external view returns (uint256)
```

Get signer count

### getTransaction

```solidity
function getTransaction(uint256 txId) external view returns (address to, uint256 value, bytes data, bool executed, uint256 numConfirmations, uint256 expiresAt, bool canExecute)
```

Get transaction details

### hasConfirmed

```solidity
function hasConfirmed(uint256 txId, address signer) external view returns (bool)
```

Check if signer has confirmed a transaction

### getConfirmationsNeeded

```solidity
function getConfirmationsNeeded(uint256 txId) external view returns (uint256)
```

Get confirmations needed

### receive

```solidity
receive() external payable
```

