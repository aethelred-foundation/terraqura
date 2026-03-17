<div align="center">
  <img src="TerraQura Logo.png" alt="TerraQura" width="200" />
  <h1>TerraQura</h1>
  <p><strong>Institutional-grade carbon credit platform with Proof-of-Physics verification on the Aethelred network.</strong></p>
  <p>
    <a href="https://github.com/aethelred-foundation/terraqura/actions/workflows/ci-cd.yml"><img src="https://img.shields.io/github/actions/workflow/status/aethelred-foundation/terraqura/ci-cd.yml?branch=main&style=flat-square&label=CI" alt="CI"></a>
    <a href="https://codecov.io/gh/aethelred-foundation/terraqura"><img src="https://img.shields.io/codecov/c/github/aethelred-foundation/terraqura?style=flat-square&label=coverage" alt="Coverage"></a>
    <a href="docs/security"><img src="https://img.shields.io/badge/audit-25_contracts_reviewed-informational?style=flat-square" alt="Audit"></a>
    <a href="LICENSE"><img src="https://img.shields.io/badge/license-Apache--2.0-blue?style=flat-square" alt="License"></a>
  </p>
  <p>
    <img src="https://img.shields.io/badge/TypeScript-5.7-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript">
    <img src="https://img.shields.io/badge/Solidity-0.8.28-363636?style=flat-square&logo=solidity&logoColor=white" alt="Solidity">
    <img src="https://img.shields.io/badge/Next.js-16-000000?style=flat-square&logo=next.js&logoColor=white" alt="Next.js">
    <img src="https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=white" alt="React">
  </p>
  <p>
    <a href="https://terraqura.aethelred.io">App</a> &middot;
    <a href="https://docs.aethelred.io">Docs</a> &middot;
    <a href="https://api.terraqura.aethelred.io/docs">API Reference</a> &middot;
    <a href="https://discord.gg/aethelred">Discord</a>
  </p>
</div>

---

## Overview

TerraQura is a full-stack institutional-grade carbon credit platform built on **Aethelred** — a sovereign Layer 1 optimised for verifiable AI computation. It enables the complete carbon credit lifecycle from Proof-of-Physics verification of direct air capture (DAC) units through to tokenised credit trading, DeFi vaults, and retirement — all with 1st-party sovereign IoT oracle data, ADGM/ITMO/Article 6 compliance, and on-chain provenance tracking.

> **Status** &mdash; Pre-mainnet. 25 contracts deployed to testnet, 881+ tests passing across all layers, 8 dashboard pages operational.

---

## Table of Contents

<table>
<tr>
<td width="50%" valign="top">

- [Overview](#overview)
- [Features](#features)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Quick Start](#quick-start)
- [Project Structure](#project-structure)
- [Smart Contracts](#smart-contracts)

</td>
<td width="50%" valign="top">

- [API Routes](#api-routes)
- [Testing](#testing)
- [Security](#security)
- [Performance](#performance)
- [Development](#development)
- [Contributing](#contributing)
- [License](#license)

</td>
</tr>
</table>

---

## Features

<table>
<tr>
<td width="50%">

**Carbon Credit Lifecycle**
- ERC-1155 tokenized credits with full provenance tracking
- Proof-of-Physics 3-phase verification pipeline
- Batch minting with configurable vintage and methodology
- On-chain retirement certificates with ITMO registry

</td>
<td width="50%">

**NativeIoT Oracle**
- 1st-party sovereign IoT oracle for DAC telemetry
- Real-time sensor data ingestion with TimescaleDB
- Anomaly detection and device health monitoring
- Chainlink VRF integration for randomised audits

</td>
</tr>
<tr>
<td width="50%">

**Carbon Marketplace**
- P2P trading with batch auctions and order matching
- AMM liquidity pools for continuous price discovery
- Fractional credits and DeFi vault strategies
- Gasless meta-transactions via ERC-2771 forwarder

</td>
<td width="50%">

**Compliance & Governance**
- ADGM/ITMO/Article 6 regulatory compliance
- KYC tiered access control with on-chain attestation
- Multisig governance with timelock execution
- Circuit breaker and emergency pause mechanisms

</td>
</tr>
</table>

---

## Architecture

```mermaid
graph TB
    subgraph Frontend
        A[Next.js 16 / React 19<br/>Tailwind CSS / wagmi v2]
    end

    subgraph API Gateway
        B[Fastify 4.26 / TypeScript<br/>BullMQ Workers / JWT Auth]
    end

    subgraph Smart Contracts
        C[Solidity 0.8.28 / Hardhat<br/>25 contracts / UUPS upgradeable]
    end

    subgraph Storage
        D[(PostgreSQL + TimescaleDB<br/>Time-series IoT + relational)]
        E[(Redis 7<br/>Cache & Job Queues)]
    end

    subgraph Oracle Layer
        F[NativeIoT Oracle<br/>Chainlink VRF]
    end

    subgraph DeFi Layer
        G[CarbonAMM / CarbonVault<br/>CarbonFutures / InsurancePool]
    end

    A <-->|REST| B
    B --- D
    B --- E
    B <-->|ethers.js| C
    C --- F
    C --- G
```

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| Monorepo | Turborepo + pnpm | Unified builds, shared configs |
| Blockchain | Aethelred L1 (EVM) | Sovereign chain, native AETH |
| Contracts | Solidity 0.8.28 + Hardhat | 25 contracts, UUPS upgradeable |
| Backend | Fastify 4.26 + BullMQ | High-performance REST + job processing |
| Frontend | Next.js 16 + React 19 | App Router, Turbopack, SSR |
| Auth | RainbowKit + SIWE | Web3 wallet authentication |
| Database | PostgreSQL + TimescaleDB | Time-series IoT + relational |
| SDK | @terraqura/sdk | TypeScript SDK for integrations |
| Web3 | wagmi v2 + viem | Type-safe contract interactions |

---

## Quick Start

### Prerequisites

| Tool | Version |
|------|---------|
| Node.js | >= 20.0.0 |
| pnpm | >= 9.0.0 |
| Docker + Compose | latest |
| PostgreSQL | >= 16 |
| Redis | >= 7 |

### Installation

```bash
# Clone
git clone https://github.com/aethelred-foundation/terraqura.git
cd terraqura

# Install dependencies
pnpm install

# Configure
cp .env.example .env
# Edit .env with your configuration

# Start infrastructure
docker-compose up -d

# Run database migrations
cd apps/api && npx prisma migrate dev && cd ../..

# Compile smart contracts
cd apps/contracts && npx hardhat compile && cd ../..

# Start development servers
pnpm dev              # All apps via Turborepo
pnpm --filter web dev # Frontend  — http://localhost:3000
pnpm --filter api dev # API       — http://localhost:3001
```

<details>
<summary>Environment variables</summary>

```bash
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/terraqura

# Redis
REDIS_URL=redis://localhost:6379

# Blockchain
RPC_URL=http://localhost:8545
CHAIN_ID=31337

# Security
JWT_SECRET=your-secret-key
JWT_REFRESH_SECRET=your-refresh-secret

# IoT Oracle
NATIVE_IOT_ORACLE_URL=http://localhost:8082
CHAINLINK_VRF_COORDINATOR=0x...

# SIWE
NEXTAUTH_SECRET=your-nextauth-secret
NEXTAUTH_URL=http://localhost:3000

# External Services
SENTRY_DSN=your-sentry-dsn
ANALYTICS_ID=your-analytics-id
```

</details>

---

## Project Structure

```
terraqura/
├── apps/
│   ├── web/              # Next.js 16 Dashboard (8 pages, 50+ features)
│   ├── api/              # Fastify REST API (15 route modules)
│   ├── contracts/        # Hardhat Smart Contracts (25 contracts)
│   └── worker/           # BullMQ Background Workers
├── packages/
│   ├── sdk/              # TypeScript SDK (12 modules)
│   ├── types/            # Shared TypeScript types
│   └── config/           # Shared ESLint/TS configs
├── infrastructure/       # Terraform (UAE deployment)
└── docs/                 # Technical documentation
```

---

## Smart Contracts

All contracts target the Aethelred L1 EVM and are written in Solidity 0.8.28 with OpenZeppelin base contracts and UUPS upgradeability.

<table>
<tr><td><strong>Contract</strong></td><td><strong>Category</strong></td><td><strong>Description</strong></td></tr>
<tr><td><code>CarbonCredit</code></td><td>Core</td><td>ERC-1155 tokenized carbon credits with vintage and methodology metadata</td></tr>
<tr><td><code>VerificationEngine</code></td><td>Core</td><td>Proof-of-Physics 3-phase verification pipeline for DAC units</td></tr>
<tr><td><code>CarbonMarketplace</code></td><td>Core</td><td>P2P trading with order matching and gasless meta-transactions</td></tr>
<tr><td><code>CarbonRetirement</code></td><td>Core</td><td>Credit retirement with on-chain provenance and compliance checks</td></tr>
<tr><td><code>RetirementCertificate</code></td><td>Core</td><td>NFT retirement certificates with ITMO registry integration</td></tr>
<tr><td><code>CarbonBatchAuction</code></td><td>Core</td><td>Batch auction mechanism for large-volume credit sales</td></tr>
<tr><td><code>CarbonAMM</code></td><td>DeFi</td><td>Automated market maker for continuous carbon credit liquidity</td></tr>
<tr><td><code>CarbonVault</code></td><td>DeFi</td><td>Yield vault strategies for carbon credit holders</td></tr>
<tr><td><code>CarbonFutures</code></td><td>DeFi</td><td>Carbon credit futures contracts with settlement</td></tr>
<tr><td><code>FractionalCredit</code></td><td>DeFi</td><td>Fractional ownership of high-value carbon credits</td></tr>
<tr><td><code>NativeIoTOracle</code></td><td>Oracle</td><td>1st-party sovereign IoT oracle for DAC device telemetry</td></tr>
<tr><td><code>ChainlinkVerifier</code></td><td>Oracle</td><td>Chainlink VRF integration for randomised verification audits</td></tr>
<tr><td><code>TerraQuraMultisig</code></td><td>Governance</td><td>Multisig admin for testnet contract operations</td></tr>
<tr><td><code>TerraQuraMultisigMainnet</code></td><td>Governance</td><td>Multisig admin for mainnet contract operations</td></tr>
<tr><td><code>TerraQuraTimelock</code></td><td>Governance</td><td>Time-locked execution for testnet governance actions</td></tr>
<tr><td><code>TerraQuraTimelockMainnet</code></td><td>Governance</td><td>Time-locked execution for mainnet governance actions</td></tr>
<tr><td><code>TerraQuraAccessControl</code></td><td>Infrastructure</td><td>Role-based access control with KYC tier enforcement</td></tr>
<tr><td><code>CircuitBreaker</code></td><td>Infrastructure</td><td>Emergency pause mechanism with configurable thresholds</td></tr>
<tr><td><code>TerraQuraForwarder</code></td><td>Infrastructure</td><td>ERC-2771 trusted forwarder for gasless meta-transactions</td></tr>
<tr><td><code>GaslessMarketplace</code></td><td>Infrastructure</td><td>Gasless marketplace wrapper with meta-transaction support</td></tr>
<tr><td><code>ComplianceRegistry</code></td><td>Compliance</td><td>On-chain compliance registry for ADGM regulatory checks</td></tr>
<tr><td><code>ITMORegistry</code></td><td>Compliance</td><td>ITMO/Article 6 registry for international carbon transfers</td></tr>
<tr><td><code>InsurancePool</code></td><td>Insurance</td><td>Insurance pool for carbon credit default and reversal risk</td></tr>
<tr><td><code>RewardDistributor</code></td><td>Rewards</td><td>Platform reward distribution for verification participants</td></tr>
<tr><td><code>EfficiencyCalculator</code></td><td>Library</td><td>On-chain efficiency calculation library for DAC verification</td></tr>
</table>

**Interfaces:** 13 interfaces providing full coverage across all contract categories.

---

## API Routes

15+ route modules organised across the Fastify REST API:

<table>
<tr>
<td width="50%" valign="top">

| Route | Domain |
|-------|--------|
| `/health` | Service health checks |
| `/auth` | SIWE authentication |
| `/dac-units` | DAC device management |
| `/sensors` | IoT sensor data ingestion |
| `/verification` | Proof-of-Physics pipeline |
| `/credits` | Carbon credit CRUD |
| `/marketplace` | Trading and order matching |
| `/kyc` | KYC tier management |

</td>
<td width="50%" valign="top">

| Route | Domain |
|-------|--------|
| `/gasless` | Meta-transaction relay |
| `/webhooks` | External event ingestion |
| `/activity` | On-chain activity feed |
| `/analytics` | Platform analytics |
| `/api-keys` | Developer API key management |
| `/retirement` | Credit retirement flow |
| `/auctions` | Batch auction operations |

</td>
</tr>
</table>

Full reference: [api.terraqura.aethelred.io/docs](https://api.terraqura.aethelred.io/docs)

---

## Testing

881+ tests across all layers covering API routes, SDK modules, background workers, and smart contracts.

```bash
# Run all tests via Turborepo
pnpm test

# API tests
pnpm --filter api test

# SDK tests
pnpm --filter sdk test

# Worker tests
pnpm --filter worker test

# Smart contracts
cd apps/contracts && npx hardhat test

# Coverage
pnpm --filter api test:coverage
cd apps/contracts && npx hardhat coverage
```

| Suite | Tests |
|-------|-------|
| API Routes | 152 |
| SDK Modules | 300+ |
| Background Workers | 66 |
| Smart Contracts | 363+ |

---

## Security

**Smart contract layer:**
Reentrancy guards (checks-effects-interactions), UUPS upgradeable proxies, circuit breaker with configurable thresholds, multisig admin operations, time-locked governance execution, oracle data validation.

**Application layer:**
JWT + SIWE authentication, role-based access control with KYC tiers, Zod input validation on all routes, per-endpoint rate limiting, CORS policy, Helmet security headers, parameterised queries.

**Infrastructure layer:**
TLS 1.3 end-to-end, ADGM data residency compliance, DDoS protection, encrypted secrets management, infrastructure-as-code auditing.

---

## Performance

| Metric | Target | Current |
|--------|--------|---------|
| First Contentful Paint | < 1.5 s | 0.9 s |
| Largest Contentful Paint | < 2.5 s | 1.7 s |
| Time to Interactive | < 3.5 s | 2.1 s |
| API Response Time (p95) | < 200 ms | 105 ms |
| IoT Telemetry Ingestion | < 100 ms | 65 ms |
| Contract Gas — mint credit | < 150 k | 120 k |
| Contract Gas — retire credit | < 100 k | 78 k |

Optimisations: Turborepo parallel builds, Turbopack dev server, Next.js App Router streaming, React Server Components, code splitting, Redis response caching, TimescaleDB hypertables, CDN edge delivery, Brotli compression.

---

## Development

```bash
pnpm lint && pnpm lint:fix      # ESLint
pnpm format                     # Prettier
pnpm type-check                 # TypeScript strict mode
pnpm validate                   # All checks (type-check + lint + format + tests)
```

### Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start all apps via Turborepo |
| `pnpm build` | Production build for all packages |
| `pnpm test` | Run all test suites |
| `pnpm lint` | Run ESLint across monorepo |
| `pnpm type-check` | Run TypeScript compiler checks |
| `pnpm format` | Format code with Prettier |
| `pnpm validate` | Run all checks |

Pre-commit hooks (Husky + lint-staged) run ESLint, Prettier, TypeScript checks, and unit tests on changed files.

### CI/CD Pipeline

**On every PR:** security audit, lint + format, type-check, unit tests (API, SDK, workers, contracts), integration tests, build verification.

**On merge to main:** Docker build, push to registry, deploy to staging, smoke tests, deploy to production.

---

## Contributing

We welcome contributions. Please see the [Contributing Guide](CONTRIBUTING.md) before opening a PR.

| Standard | Requirement |
|----------|-------------|
| Commits | [Conventional Commits](https://www.conventionalcommits.org/) |
| Solidity | Hardhat `solhint` + NatSpec documentation |
| TypeScript | ESLint + Prettier + strict mode, no `any` |
| Tests | All new code must include tests |
| Lint | Zero warnings on `pnpm validate` |

1. Fork the repository
2. Create a feature branch &mdash; `git checkout -b feature/my-feature`
3. Run `pnpm validate`
4. Commit with Conventional Commits
5. Open a Pull Request

---

## License

Apache 2.0 &mdash; see [LICENSE](LICENSE) for details.

---

## Acknowledgements

[Hardhat](https://hardhat.org/) &middot; [OpenZeppelin](https://openzeppelin.com/) &middot; [Next.js](https://nextjs.org/) &middot; [Tailwind CSS](https://tailwindcss.com/) &middot; [wagmi](https://wagmi.sh/) &middot; [viem](https://viem.sh/) &middot; [Fastify](https://fastify.dev/) &middot; [BullMQ](https://bullmq.io/) &middot; [Turborepo](https://turbo.build/)

---

<p align="center">
  <a href="https://terraqura.aethelred.io">App</a> &middot;
  <a href="https://docs.aethelred.io">Docs</a> &middot;
  <a href="https://discord.gg/aethelred">Discord</a> &middot;
  <a href="https://twitter.com/aethelred">Twitter</a> &middot;
  <a href="mailto:support@aethelred.io">Support</a>
</p>
<p align="center">
  Copyright &copy; 2024&ndash;2026 Aethelred Foundation
</p>
