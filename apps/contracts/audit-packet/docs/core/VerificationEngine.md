# Solidity API

## VerificationEngine

Implements "Proof-of-Physics" verification for carbon credits

_Three-phase verification: Source, Logic, Mint

This contract validates that carbon capture data is:
1. From a legitimate, whitelisted DAC facility (Source Check)
2. Physically plausible based on energy/CO2 ratios (Logic Check)
3. Not a duplicate submission (Mint Check)

The verification engine is the core anti-fraud mechanism that ensures
only legitimate carbon capture events can be minted as credits._

### MIN_KWH_PER_TONNE

```solidity
uint256 MIN_KWH_PER_TONNE
```

Expected energy consumption per tonne CO2 captured (kWh)

_Based on DAC industry benchmarks: 200-600 kWh per tonne
Values below MIN are fraud indicators (impossibly efficient)
Values above MAX are rejected as too inefficient_

### MAX_KWH_PER_TONNE

```solidity
uint256 MAX_KWH_PER_TONNE
```

### OPTIMAL_KWH_PER_TONNE

```solidity
uint256 OPTIMAL_KWH_PER_TONNE
```

### MIN_PURITY_PERCENTAGE

```solidity
uint8 MIN_PURITY_PERCENTAGE
```

Minimum acceptable CO2 purity percentage

### SCALE

```solidity
uint256 SCALE
```

Scaling factor for efficiency calculations

_10000 = 100%, allows for 2 decimal places of precision_

### whitelistedDacUnits

```solidity
mapping(bytes32 => bool) whitelistedDacUnits
```

Mapping of DAC unit IDs to whitelist status

### dacUnitOperators

```solidity
mapping(bytes32 => address) dacUnitOperators
```

Mapping of DAC unit IDs to operator addresses

### carbonCreditContract

```solidity
address carbonCreditContract
```

Address of the CarbonCredit contract (only caller allowed to verify)

### DacUnitWhitelisted

```solidity
event DacUnitWhitelisted(bytes32 dacUnitId, address operator, uint256 timestamp)
```

Emitted when a DAC unit is whitelisted

### DacUnitRemoved

```solidity
event DacUnitRemoved(bytes32 dacUnitId, uint256 timestamp)
```

Emitted when a DAC unit is removed from whitelist

### VerificationPhaseCompleted

```solidity
event VerificationPhaseCompleted(bytes32 dacUnitId, bytes32 sourceDataHash, string phase, bool passed, string reason)
```

Emitted for each verification phase

### CarbonCreditContractUpdated

```solidity
event CarbonCreditContractUpdated(address oldAddress, address newAddress)
```

Emitted when the CarbonCredit contract address is updated

### UnauthorizedCaller

```solidity
error UnauthorizedCaller()
```

### DacUnitAlreadyWhitelisted

```solidity
error DacUnitAlreadyWhitelisted()
```

### DacUnitNotWhitelisted

```solidity
error DacUnitNotWhitelisted()
```

### InvalidOperatorAddress

```solidity
error InvalidOperatorAddress()
```

### InvalidCarbonCreditContract

```solidity
error InvalidCarbonCreditContract()
```

### onlyCarbonCredit

```solidity
modifier onlyCarbonCredit()
```

Restricts function to CarbonCredit contract only

### constructor

```solidity
constructor() public
```

### initialize

```solidity
function initialize(address _accessControl, address _carbonCreditContract) public
```

Initialize the verification engine

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| _accessControl | address | Address of the access control contract (unused, for interface compatibility) |
| _carbonCreditContract | address | Address of the CarbonCredit contract |

### verify

```solidity
function verify(bytes32 dacUnitId, bytes32 sourceDataHash, uint256 co2AmountKg, uint256 energyConsumedKwh, uint8 purityPercentage) external returns (bool sourceVerified, bool logicVerified, bool mintVerified, uint256 efficiencyFactor)
```

Verify carbon capture data before minting

_Only callable by the CarbonCredit contract_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| dacUnitId | bytes32 | The DAC facility identifier |
| sourceDataHash | bytes32 | Hash of the off-chain sensor data |
| co2AmountKg | uint256 | Amount of CO2 captured in kilograms |
| energyConsumedKwh | uint256 | Energy consumed in kilowatt-hours |
| purityPercentage | uint8 | CO2 purity percentage (0-100) |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| sourceVerified | bool | Whether the source check passed |
| logicVerified | bool | Whether the logic check passed |
| mintVerified | bool | Whether the mint check passed |
| efficiencyFactor | uint256 | Calculated efficiency factor (scaled by 1e4) |

### isWhitelisted

```solidity
function isWhitelisted(bytes32 dacUnitId) external view returns (bool)
```

Check if a DAC unit is whitelisted

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| dacUnitId | bytes32 | The DAC facility identifier |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool | Whether the DAC unit is whitelisted |

### getOperator

```solidity
function getOperator(bytes32 dacUnitId) external view returns (address)
```

Get the operator address for a DAC unit

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| dacUnitId | bytes32 | The DAC facility identifier |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | address | The operator's address |

### isHashProcessed

```solidity
function isHashProcessed(bytes32 sourceDataHash) external view returns (bool)
```

Check if a data hash has already been processed

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| sourceDataHash | bytes32 | The hash to check |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool | Whether the hash has been used |

### whitelistDacUnit

```solidity
function whitelistDacUnit(bytes32 dacUnitId, address operator) external
```

Whitelist a DAC unit

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| dacUnitId | bytes32 | The unique identifier for the DAC facility |
| operator | address | The address of the DAC facility operator |

### removeDacUnit

```solidity
function removeDacUnit(bytes32 dacUnitId) external
```

Remove a DAC unit from the whitelist

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| dacUnitId | bytes32 | The unique identifier for the DAC facility |

### updateOperator

```solidity
function updateOperator(bytes32 dacUnitId, address newOperator) external
```

Update the operator address for a DAC unit

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| dacUnitId | bytes32 | The unique identifier for the DAC facility |
| newOperator | address | The new operator address |

### setCarbonCreditContract

```solidity
function setCarbonCreditContract(address _carbonCreditContract) external
```

Set the CarbonCredit contract address

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| _carbonCreditContract | address | Address of the CarbonCredit contract |

### _authorizeUpgrade

```solidity
function _authorizeUpgrade(address newImplementation) internal
```

Authorize upgrade (UUPS pattern)

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| newImplementation | address | Address of new implementation |

### _verifySource

```solidity
function _verifySource(bytes32 dacUnitId, bytes32 sourceDataHash) internal returns (bool)
```

Phase 1: Verify the data source is from a whitelisted DAC unit

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| dacUnitId | bytes32 | The DAC facility identifier |
| sourceDataHash | bytes32 | The hash of the source data (for event logging) |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool | Whether the source verification passed |

### _verifyLogic

```solidity
function _verifyLogic(bytes32 dacUnitId, bytes32 sourceDataHash, uint256 co2AmountKg, uint256 energyConsumedKwh, uint8 purityPercentage) internal returns (bool verified, uint256 efficiencyFactor)
```

Phase 2: Verify the physics constraints (energy vs CO2 ratio)

_This is the core "Proof-of-Physics" check_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| dacUnitId | bytes32 | The DAC facility identifier |
| sourceDataHash | bytes32 | The hash of the source data |
| co2AmountKg | uint256 | CO2 captured in kilograms |
| energyConsumedKwh | uint256 | Energy consumed in kilowatt-hours |
| purityPercentage | uint8 | CO2 purity (0-100) |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| verified | bool | Whether the logic verification passed |
| efficiencyFactor | uint256 | The calculated efficiency factor |

### _verifyMint

```solidity
function _verifyMint(bytes32 dacUnitId, bytes32 sourceDataHash) internal returns (bool)
```

Phase 3: Verify the data hash has not been used before

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| dacUnitId | bytes32 | The DAC facility identifier |
| sourceDataHash | bytes32 | The hash to check |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool | Whether the mint verification passed |

### getVerificationThresholds

```solidity
function getVerificationThresholds() external pure returns (uint256 minKwh, uint256 maxKwh, uint256 optimalKwh, uint8 minPurity)
```

Get verification thresholds

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| minKwh | uint256 | Minimum kWh per tonne |
| maxKwh | uint256 | Maximum kWh per tonne |
| optimalKwh | uint256 | Optimal kWh per tonne |
| minPurity | uint8 | Minimum purity percentage |

### previewEfficiencyFactor

```solidity
function previewEfficiencyFactor(uint256 co2AmountKg, uint256 energyConsumedKwh, uint8 purityPercentage) external pure returns (bool isValid, uint256 efficiencyFactor)
```

Preview efficiency factor calculation without state changes

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| co2AmountKg | uint256 | CO2 captured in kilograms |
| energyConsumedKwh | uint256 | Energy consumed in kilowatt-hours |
| purityPercentage | uint8 | CO2 purity (0-100) |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| isValid | bool | Whether the values would pass verification |
| efficiencyFactor | uint256 | The calculated efficiency factor |

