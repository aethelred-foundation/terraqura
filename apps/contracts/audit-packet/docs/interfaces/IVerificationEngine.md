# Solidity API

## IVerificationEngine

Interface for the Proof-of-Physics verification engine

_Implements three-phase verification: Source, Logic, Mint_

### verify

```solidity
function verify(bytes32 dacUnitId, bytes32 sourceDataHash, uint256 co2AmountKg, uint256 energyConsumedKwh, uint8 purityPercentage) external returns (bool sourceVerified, bool logicVerified, bool mintVerified, uint256 efficiencyFactor)
```

Verify carbon capture data before minting

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

