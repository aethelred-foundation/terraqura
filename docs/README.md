# TerraQura Documentation

> Institutional-Grade Carbon Asset Platform with Proof-of-Physics Verification on the Aethelred Network.

---

## Quick Navigation

| Section | Description | Link |
|---------|-------------|------|
| Architecture | System design, data flow, monorepo structure | [architecture/](architecture/) |
| API Reference | REST API endpoints, authentication, webhooks | [api/](api/) |
| Smart Contracts | 25 Solidity contracts, roles, upgrade process | [contracts/](contracts/) |
| Compliance | ADGM, ITMO/Article 6, KYC tiers, data residency | [compliance/](compliance/) |
| Disaster Recovery | RTO/RPO targets, failover procedures | [DISASTER_RECOVERY.md](DISASTER_RECOVERY.md) |
| Gas Optimization | Contract gas benchmarks and optimization notes | [GAS_OPTIMIZATION_REVIEW.md](GAS_OPTIMIZATION_REVIEW.md) |

---

## Overview

TerraQura is a full-stack, institutional-grade carbon credit platform built on **Aethelred** -- a sovereign Layer 1 EVM chain optimised for verifiable AI computation. The platform enables the complete carbon credit lifecycle:

1. **Capture** -- Direct Air Capture (DAC) units report real-time telemetry via the NativeIoT Oracle.
2. **Verify** -- A 3-phase Proof-of-Physics pipeline (source check, logic check, mint check) validates sensor data against on-chain thresholds.
3. **Mint** -- Verified capture periods produce ERC-1155 carbon credits with immutable provenance metadata stored on IPFS/Arweave.
4. **Trade** -- Credits are traded on a P2P marketplace with batch auctions, AMM liquidity pools, fractional credit support, and gasless meta-transactions.
5. **Retire** -- Credits are permanently retired on-chain, producing retirement certificates linked to the ITMO registry for Article 6 compliance.

---

## Platform Status

| Metric | Value |
|--------|-------|
| Smart contracts | 25 (Solidity 0.8.28, UUPS upgradeable) |
| Test coverage | 881+ tests passing across all layers |
| Dashboard pages | 8 operational |
| Deployment target | Aethelred Testnet (pre-mainnet) |
| License | Apache 2.0 |

---

## Repository Structure

```
terraqura/
  apps/
    api/            Fastify REST API (TypeScript)
    web/            Next.js 16 frontend (React 19)
    contracts/      Solidity smart contracts (Hardhat)
    worker/         BullMQ background job workers
    docs/           Docusaurus documentation site
    analytics/      Python analytics service
    verifier/       Rust verification service
    indexer/        Go blockchain indexer
  packages/
    config/         Shared ESLint and TypeScript configs
    contract-types/ Generated TypeChain typings
    database/       Drizzle ORM schema and migrations
    monitoring/     Prometheus metrics and alerting
    queue/          BullMQ queue definitions
    sdk/            Client SDK
    subgraph/       The Graph subgraph definitions
    types/          Shared TypeScript type definitions
  infrastructure/   Docker, Kubernetes, CI/CD manifests
  docs/             Project documentation (this directory)
```

---

## Getting Started

Refer to the root [README](../README.md) for quick-start instructions, environment setup, and development workflow.

---

## Contributing

See [CONTRIBUTING.md](../CONTRIBUTING.md) for contribution guidelines, branch naming conventions, and pull request requirements.

---

## Security

For security reports and the responsible disclosure policy, see [SECURITY.md](../SECURITY.md).
