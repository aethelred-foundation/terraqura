# Solidity API

## CircuitBreaker

Centralized emergency stop mechanism for all TerraQura contracts

_Implements multiple protection layers:

1. Global Pause - Stops all contract operations
2. Per-Contract Pause - Stops specific contract
3. Rate Limiting - Prevents excessive operations
4. Volume Limits - Caps daily transaction volumes
5. Anomaly Detection - Triggers on unusual patterns

Security levels:
- NORMAL: All operations allowed
- ELEVATED: Enhanced monitoring, some limits
- HIGH: Strict limits, some operations blocked
- CRITICAL: Only essential operations allowed
- EMERGENCY: All operations paused_

### SecurityLevel

```solidity
enum SecurityLevel {
  NORMAL,
  ELEVATED,
  HIGH,
  CRITICAL,
  EMERGENCY
}
```

### ContractStatus

```solidity
struct ContractStatus {
  bool isPaused;
  enum CircuitBreaker.SecurityLevel level;
  uint256 pausedAt;
  string pauseReason;
  address pausedBy;
}
```

### RateLimit

```solidity
struct RateLimit {
  uint256 maxOperationsPerHour;
  uint256 currentOperations;
  uint256 windowStart;
}
```

### VolumeLimit

```solidity
struct VolumeLimit {
  uint256 maxDailyVolume;
  uint256 currentDailyVolume;
  uint256 dayStart;
}
```

### globalSecurityLevel

```solidity
enum CircuitBreaker.SecurityLevel globalSecurityLevel
```

Global security level

### globalPause

```solidity
bool globalPause
```

Global pause status

### contractStatus

```solidity
mapping(address => struct CircuitBreaker.ContractStatus) contractStatus
```

Mapping of contract address to status

### rateLimits

```solidity
mapping(address => struct CircuitBreaker.RateLimit) rateLimits
```

Mapping of contract to rate limits

### volumeLimits

```solidity
mapping(address => struct CircuitBreaker.VolumeLimit) volumeLimits
```

Mapping of contract to volume limits

### isPauser

```solidity
mapping(address => bool) isPauser
```

Authorized pausers (can pause in emergency)

### monitoredContracts

```solidity
address[] monitoredContracts
```

List of monitored contracts

### UNPAUSE_COOLDOWN

```solidity
uint256 UNPAUSE_COOLDOWN
```

Cooldown period after unpause (prevents rapid pause/unpause)

### lastUnpause

```solidity
mapping(address => uint256) lastUnpause
```

Last unpause timestamp per contract

### defaultRateLimit

```solidity
uint256 defaultRateLimit
```

Default rate limit (operations per hour)

### defaultVolumeLimit

```solidity
uint256 defaultVolumeLimit
```

Default daily volume limit

### GlobalPauseActivated

```solidity
event GlobalPauseActivated(address by, string reason)
```

### GlobalPauseDeactivated

```solidity
event GlobalPauseDeactivated(address by)
```

### ContractPaused

```solidity
event ContractPaused(address contractAddr, address by, string reason)
```

### ContractUnpaused

```solidity
event ContractUnpaused(address contractAddr, address by)
```

### SecurityLevelChanged

```solidity
event SecurityLevelChanged(enum CircuitBreaker.SecurityLevel oldLevel, enum CircuitBreaker.SecurityLevel newLevel, string reason)
```

### ContractSecurityLevelChanged

```solidity
event ContractSecurityLevelChanged(address contractAddr, enum CircuitBreaker.SecurityLevel oldLevel, enum CircuitBreaker.SecurityLevel newLevel)
```

### RateLimitExceeded

```solidity
event RateLimitExceeded(address contractAddr, address user)
```

### VolumeLimitExceeded

```solidity
event VolumeLimitExceeded(address contractAddr, uint256 attempted, uint256 limit)
```

### PauserAdded

```solidity
event PauserAdded(address pauser)
```

### PauserRemoved

```solidity
event PauserRemoved(address pauser)
```

### AnomalyDetected

```solidity
event AnomalyDetected(address contractAddr, string anomalyType, bytes data)
```

### NotPauser

```solidity
error NotPauser()
```

### GloballyPaused

```solidity
error GloballyPaused()
```

### ContractPaused_

```solidity
error ContractPaused_()
```

### RateLimitExceeded_

```solidity
error RateLimitExceeded_()
```

### VolumeLimitExceeded_

```solidity
error VolumeLimitExceeded_()
```

### SecurityLevelTooHigh

```solidity
error SecurityLevelTooHigh()
```

### CooldownActive

```solidity
error CooldownActive()
```

### ContractNotMonitored

```solidity
error ContractNotMonitored()
```

### onlyPauser

```solidity
modifier onlyPauser()
```

### whenNotGloballyPaused

```solidity
modifier whenNotGloballyPaused()
```

### whenContractNotPaused

```solidity
modifier whenContractNotPaused(address contractAddr)
```

### constructor

```solidity
constructor() public
```

### initialize

```solidity
function initialize(address _owner) public
```

### activateGlobalPause

```solidity
function activateGlobalPause(string reason) external
```

Activate global pause (stops everything)

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| reason | string | Reason for pause |

### deactivateGlobalPause

```solidity
function deactivateGlobalPause() external
```

Deactivate global pause

### pauseContract

```solidity
function pauseContract(address contractAddr, string reason) external
```

Pause a specific contract

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| contractAddr | address | Contract to pause |
| reason | string | Reason for pause |

### unpauseContract

```solidity
function unpauseContract(address contractAddr) external
```

Unpause a specific contract

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| contractAddr | address | Contract to unpause |

### setSecurityLevel

```solidity
function setSecurityLevel(enum CircuitBreaker.SecurityLevel level, string reason) external
```

Set global security level

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| level | enum CircuitBreaker.SecurityLevel | New security level |
| reason | string | Reason for change |

### checkRateLimit

```solidity
function checkRateLimit(address contractAddr) external returns (bool allowed)
```

Check and update rate limit for a contract/user operation

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| contractAddr | address | Contract being called |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| allowed | bool | Whether the operation is allowed |

### checkVolumeLimit

```solidity
function checkVolumeLimit(address contractAddr, uint256 volume) external returns (bool allowed)
```

Check and update volume limit for a contract

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| contractAddr | address | Contract being called |
| volume | uint256 | Transaction volume in wei |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| allowed | bool | Whether the operation is allowed |

### addPauser

```solidity
function addPauser(address pauser) external
```

Add a pauser

### removePauser

```solidity
function removePauser(address pauser) external
```

Remove a pauser

### setRateLimit

```solidity
function setRateLimit(address contractAddr, uint256 maxPerHour) external
```

Set rate limit for a contract

### setVolumeLimit

```solidity
function setVolumeLimit(address contractAddr, uint256 maxDaily) external
```

Set volume limit for a contract

### setDefaultLimits

```solidity
function setDefaultLimits(uint256 rateLimit, uint256 volumeLimit) external
```

Set default limits

### registerContract

```solidity
function registerContract(address contractAddr) external
```

Register a contract for monitoring

### isOperationAllowed

```solidity
function isOperationAllowed(address contractAddr) external view returns (bool)
```

Check if operations are allowed for a contract

### getStatus

```solidity
function getStatus() external view returns (bool isGloballyPaused, enum CircuitBreaker.SecurityLevel currentLevel, uint256 monitoredCount)
```

Get current status summary

### getContractStatus

```solidity
function getContractStatus(address contractAddr) external view returns (bool isPaused, enum CircuitBreaker.SecurityLevel level, uint256 pausedAt, string pauseReason)
```

Get contract status

### _authorizeUpgrade

```solidity
function _authorizeUpgrade(address) internal
```

