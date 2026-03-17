# Solidity API

## EfficiencyCalculator

Library for calculating carbon credit efficiency factors

_Implements the Proof-of-Physics efficiency calculation

The efficiency factor rewards more efficient carbon capture while
penalizing wasteful operations. The calculation is based on:
1. Energy consumption per tonne of CO2 captured
2. CO2 purity percentage

Efficiency Factor Range: 5000 (50%) to 10500 (105%)
Optimal efficiency (350 kWh/tonne) = 10000 (100%)_

### calculate

```solidity
function calculate(uint256 kwhPerTonne, uint256 optimal, uint256 minAcceptable, uint256 maxAcceptable, uint256 scale) internal pure returns (uint256 factor)
```

Calculate efficiency factor based on energy consumption and purity

_The calculation follows this logic:
- If at or better than optimal: Linear bonus from 100% to 105%
- If worse than optimal: Linear penalty from 100% to 50%
- Outside bounds returns 0 (invalid)_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| kwhPerTonne | uint256 | Actual kWh consumed per tonne of CO2 |
| optimal | uint256 | Optimal kWh per tonne (best case scenario) |
| minAcceptable | uint256 | Minimum acceptable (below = fraud indicator) |
| maxAcceptable | uint256 | Maximum acceptable (above = too inefficient) |
| scale | uint256 | Scaling factor (e.g., 10000 = 100%) |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| factor | uint256 | Efficiency factor (scaled) |

### applyPurityAdjustment

```solidity
function applyPurityAdjustment(uint256 baseFactor, uint8 purityPercentage, uint256 scale) internal pure returns (uint256 adjustedFactor)
```

Apply purity adjustment to efficiency factor

_Purity adjustment formula:
- 100% purity = 105% factor
- 95% purity = 100% factor (neutral)
- 90% purity = 95% factor_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| baseFactor | uint256 | The base efficiency factor from energy calculation |
| purityPercentage | uint8 | The CO2 purity percentage (0-100) |
| scale | uint256 | Scaling factor (10000 = 100%) |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| adjustedFactor | uint256 | The purity-adjusted efficiency factor |

### calculateCredits

```solidity
function calculateCredits(uint256 co2AmountKg, uint256 efficiencyFactor, uint256 scale) internal pure returns (uint256 credits)
```

Calculate credits to mint based on CO2 amount and efficiency

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| co2AmountKg | uint256 | Raw CO2 captured in kilograms |
| efficiencyFactor | uint256 | The efficiency factor (scaled by 1e4) |
| scale | uint256 | The scale factor (10000 = 100%) |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| credits | uint256 | Number of credits to mint |

