# Solidity API

## TerraQuraTimelock

Timelock controller for governance operations

_Enforces a delay on all critical admin operations

This contract wraps OpenZeppelin's TimelockController to provide
enterprise-grade governance with:
- Configurable delay (minimum 2 days for production)
- Multi-sig proposer support
- Emergency cancellation capability
- Full audit trail via events

Critical operations that must go through timelock:
- Contract upgrades
- Fee changes
- Role management
- Parameter updates_

### MIN_DELAY_PRODUCTION

```solidity
uint256 MIN_DELAY_PRODUCTION
```

Minimum delay for production (2 days)

### MIN_DELAY_TESTNET

```solidity
uint256 MIN_DELAY_TESTNET
```

Minimum delay for testnet (1 hour for testing)

### isProduction

```solidity
bool isProduction
```

Whether this is a production deployment

### EmergencyAction

```solidity
event EmergencyAction(address executor, string reason)
```

Event emitted when an emergency action is taken

### constructor

```solidity
constructor(uint256 minDelay, address[] proposers, address[] executors, address admin, bool _isProduction) public
```

Initialize the timelock

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| minDelay | uint256 | Minimum delay for operations (in seconds) |
| proposers | address[] | Addresses that can propose operations (should be multisig) |
| executors | address[] | Addresses that can execute operations (can be zero address for anyone) |
| admin | address | Admin address (should be set to address(0) after setup for decentralization) |
| _isProduction | bool | Whether this is a production deployment |

### getRecommendedDelay

```solidity
function getRecommendedDelay(uint8 operationType) external view returns (uint256)
```

Get recommended delay based on operation type

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| operationType | uint8 | Type of operation (0=standard, 1=critical, 2=emergency) |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | Recommended delay in seconds |

### getOperationStatus

```solidity
function getOperationStatus(bytes32 id) external view returns (bool ready, uint256 timeRemaining)
```

Check if an operation is ready for execution

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| id | bytes32 | Operation ID |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| ready | bool | Whether the operation can be executed |
| timeRemaining | uint256 | Seconds until execution is possible (0 if ready) |

