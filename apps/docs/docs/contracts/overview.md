---
sidebar_position: 1
---

# Smart Contracts Overview

TerraQura's smart contracts are deployed on Polygon PoS and implement institutional-grade security and upgradeability patterns.

## Contract Architecture

All contracts use the **UUPS (Universal Upgradeable Proxy Standard)** pattern for upgradeability without losing state.

```
┌─────────────────────────────────────────────────────────────────┐
│                    TerraQuraAccessControl                        │
│                    (Role-based permissions)                      │
└─────────────────────────────────────────────────────────────────┘
        ↑                    ↑                    ↑
        │                    │                    │
┌───────┴───────┐   ┌────────┴────────┐   ┌──────┴──────┐
│ CarbonCredit  │   │VerificationEngine│   │ Marketplace │
│  (ERC-1155)   │   │ (3-Phase Check)  │   │   (P2P)     │
└───────────────┘   └──────────────────┘   └─────────────┘
                              ↑
                    ┌─────────┴─────────┐
                    │ ChainlinkVerifier │
                    │    (Oracle)       │
                    └───────────────────┘
```

## Deployed Contracts

| Contract | Network | Address | Verified |
|----------|---------|---------|----------|
| CarbonCredit | Polygon | `0x...` | ✓ |
| VerificationEngine | Polygon | `0x...` | ✓ |
| CarbonMarketplace | Polygon | `0x...` | ✓ |
| TerraQuraAccessControl | Polygon | `0x...` | ✓ |
| TerraQuraForwarder | Polygon | `0x...` | ✓ |

## Security Features

### Access Control Roles

```solidity
bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
bytes32 public constant VERIFIER_ROLE = keccak256("VERIFIER_ROLE");
bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
bytes32 public constant COMPLIANCE_ROLE = keccak256("COMPLIANCE_ROLE");
bytes32 public constant AUDITOR_ROLE = keccak256("AUDITOR_ROLE");
bytes32 public constant TREASURY_ROLE = keccak256("TREASURY_ROLE");
bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");
```

### Multi-Sig Administration

All administrative functions are controlled by a **Gnosis Safe** with 3-of-5 signature requirement.

### Emergency Controls

- **Pause**: All contracts can be paused in emergency
- **Upgrade**: Implementation can be upgraded via UUPS proxy
- **KYC Gate**: All marketplace actions require verified KYC

## Gas Optimization

Estimated gas costs on Polygon:

| Operation | Gas Units | Cost (100 gwei) |
|-----------|-----------|-----------------|
| Mint Credit | ~150,000 | ~0.015 MATIC |
| Transfer | ~65,000 | ~0.0065 MATIC |
| Create Listing | ~120,000 | ~0.012 MATIC |
| Purchase | ~200,000 | ~0.02 MATIC |
| Retire Credit | ~80,000 | ~0.008 MATIC |

## Audit Status

| Auditor | Date | Scope | Status |
|---------|------|-------|--------|
| TBD | Q2 2026 | Full Audit | Scheduled |

## Source Code

All contracts are verified on PolygonScan and open source:

- [GitHub Repository](https://github.com/terraqura/terraqura/tree/main/apps/contracts)
- [PolygonScan](https://polygonscan.com/address/0x...)
