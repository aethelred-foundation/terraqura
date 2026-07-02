---
sidebar_position: 1
---

# Smart Contracts Overview

TerraQura's smart contracts target the Aethelred sovereign EVM network and implement institutional-grade security and upgradeability patterns. Polygon Amoy remains historical validation evidence only.

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

| Contract | Network | Address Source | Status |
|----------|---------|----------------|--------|
| CarbonCredit | Aethelred Testnet | `@terraqura/network-manifest` or `TERRAQURA_CONTRACT_CARBON_CREDIT` | Pending deployment |
| VerificationEngine | Aethelred Testnet | `@terraqura/network-manifest` or `TERRAQURA_CONTRACT_VERIFICATION_ENGINE` | Pending deployment |
| CarbonMarketplace | Aethelred Testnet | `@terraqura/network-manifest` or `TERRAQURA_CONTRACT_CARBON_MARKETPLACE` | Pending deployment |
| TerraQuraAccessControl | Aethelred Testnet | `@terraqura/network-manifest` or `TERRAQURA_CONTRACT_ACCESS_CONTROL` | Pending deployment |
| GaslessMarketplace | Aethelred Testnet | `@terraqura/network-manifest` or `TERRAQURA_CONTRACT_GASLESS_MARKETPLACE` | Pending deployment |

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

Estimated gas costs on Aethelred-compatible EVM execution:

| Operation | Gas Units | Cost (100 gwei) |
|-----------|-----------|-----------------|
| Mint Credit | ~150,000 | Network gas dependent |
| Transfer | ~65,000 | Network gas dependent |
| Create Listing | ~120,000 | Network gas dependent |
| Purchase | ~200,000 | Network gas dependent |
| Retire Credit | ~80,000 | Network gas dependent |

## Audit Status

| Auditor | Date | Scope | Status |
|---------|------|-------|--------|
| TBD | Q2 2026 | Full Audit | Scheduled |

## Source Code

All deployment addresses must be sourced from the canonical manifest package:

- [GitHub Repository](https://github.com/terraqura/terraqura/tree/main/apps/contracts)
- `packages/network-manifest`
