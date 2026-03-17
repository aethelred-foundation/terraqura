---
sidebar_position: 1
slug: /
---

# TerraQura Documentation

Welcome to the TerraQura documentation. TerraQura is an **Institutional-Grade Carbon Asset Platform** that transforms carbon credits from vague paper promises into high-fidelity digital assets using blockchain technology and IoT verification.

## What is TerraQura?

TerraQura provides:

- **Proof-of-Physics Verification**: Three-phase verification using real-time IoT sensor data
- **Blockchain-Based Carbon Credits**: ERC-1155 tokens on Polygon representing verified CO2 removal
- **P2P Marketplace**: Trade carbon credits with KYC-verified counterparties
- **ADGM Compliance**: Built for regulatory compliance in Abu Dhabi Global Market

## Key Features

### 🔬 Proof-of-Physics Verification

Every carbon credit is backed by verifiable sensor data:

1. **Source Check**: Validates data authenticity from registered IoT sensors
2. **Logic Check**: Ensures efficiency metrics (200-600 kWh/tonne) are within bounds
3. **Mint Check**: Final validation before token creation

### 🔗 Blockchain Infrastructure

- **Network**: Polygon PoS (Layer 2 Ethereum)
- **Token Standard**: ERC-1155 (multi-token)
- **Upgradeability**: UUPS Proxy pattern
- **Admin**: Gnosis Safe (3-of-5 multi-sig)

### 🛡️ Enterprise Security

- **KYC/AML**: Sumsub integration with sanctions screening
- **Access Control**: Role-based permissions (Operator, Verifier, Compliance, etc.)
- **Monitoring**: OpenZeppelin Defender with real-time alerts
- **Gasless Transactions**: Meta-transactions for corporate buyers

## Quick Links

- [Getting Started](/docs/getting-started) - Set up your environment
- [Smart Contracts](/docs/contracts/overview) - Technical contract documentation
- [Carbon Credit Contract](/docs/contracts/carbon-credit) - Core ERC-1155 implementation
- [Project Repository](https://github.com/terraqura/terraqura) - Source code and issue tracking

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         INGESTION LAYER                          │
│  IoT Sensors → Fastify API → TimescaleDB → Redis Queue          │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                       VERIFICATION LAYER                         │
│  Worker Service → Chainlink Functions → Hash Verification        │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                       BLOCKCHAIN LAYER                           │
│  UUPS Proxy Contracts on Polygon                                │
│  ├── CarbonCredit (ERC-1155)                                    │
│  ├── VerificationEngine                                          │
│  ├── CarbonMarketplace                                          │
│  └── TerraQuraAccessControl                                      │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                         DATA LAYER                               │
│  The Graph (Subgraph) → Fast GraphQL Queries                    │
└─────────────────────────────────────────────────────────────────┘
```

## Getting Help

- **GitHub Issues**: [github.com/terraqura/terraqura/issues](https://github.com/terraqura/terraqura/issues)
- **Email**: tech@terraqura.io
- **Slack**: Contact us for developer community access
