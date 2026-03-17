# TerraQura Architecture

> System architecture for the institutional-grade carbon credit platform on the Aethelred network.

---

## System Overview

```
                            +---------------------+
                            |     Web Frontend     |
                            |   Next.js 16 / SSR   |
                            |  React 19 + wagmi v2 |
                            +----------+----------+
                                       |
                           HTTPS / REST + WebSocket
                                       |
                            +----------v----------+
                            |     API Gateway      |
                            |    Fastify 4.26      |
                            |  SIWE + JWT Auth     |
                            |  Rate Limiting       |
                            +---+------+------+---+
                                |      |      |
                  +-------------+   +--+--+   +-------------+
                  |                 |     |                  |
         +--------v--------+  +----v--+  +------v--------+  |
         |   PostgreSQL +   |  | Redis |  |  BullMQ       |  |
         |  TimescaleDB    |  |  7.x  |  |  Workers      |  |
         |  (IoT + OLTP)   |  +-------+  +------+--------+  |
         +-----------------+                     |           |
                                                 |           |
                            +--------------------v-----------v--+
                            |         Aethelred L1 (EVM)        |
                            |                                   |
                            |  +-------------+ +-------------+  |
                            |  | Core        | | DeFi        |  |
                            |  | Contracts   | | Contracts   |  |
                            |  +-------------+ +-------------+  |
                            |  +-------------+ +-------------+  |
                            |  | Oracle      | | Governance  |  |
                            |  | Contracts   | | Contracts   |  |
                            |  +-------------+ +-------------+  |
                            +-----------------------------------+
                                          |
                              +-----------+-----------+
                              |                       |
                     +--------v--------+   +----------v--------+
                     | NativeIoT Oracle|   | Chainlink VRF     |
                     | DAC Telemetry   |   | Randomised Audits |
                     +-----------------+   +-------------------+
```

---

## Monorepo Structure

TerraQura uses **Turborepo** with **pnpm workspaces** for build orchestration.

```
terraqura/
  turbo.json              Turborepo pipeline config
  pnpm-workspace.yaml     Workspace definitions
  package.json            Root scripts, lint-staged, engines

  apps/
    web/                  Next.js 16 frontend
    api/                  Fastify REST API
    contracts/            Solidity smart contracts (Hardhat)
    worker/               BullMQ background workers
    docs/                 Docusaurus documentation site
    analytics/            Python analytics service (pytest)
    verifier/             Rust verification service (cargo)
    indexer/              Go blockchain event indexer

  packages/
    types/                Shared TypeScript type definitions
    contract-types/       Auto-generated TypeChain typings
    database/             Drizzle ORM schema and migrations
    queue/                BullMQ queue definitions
    sdk/                  Client SDK for third-party integrations
    subgraph/             The Graph subgraph for indexing
    monitoring/           Prometheus metrics collection
    config/
      eslint-config/      Shared ESLint configuration
      typescript-config/  Shared tsconfig bases

  infrastructure/         Docker Compose, K8s manifests, CI/CD
```

### Build Pipeline

Turborepo manages task dependencies declaratively:

- `build` -- depends on upstream `^build`; outputs `dist/`, `.next/`, `artifacts/`, `typechain-types/`
- `test` -- depends on upstream `^build`
- `lint` / `typecheck` -- depends on upstream `^build`
- `compile` (contracts) -- depends on upstream `^build`; outputs `artifacts/`, `typechain-types/`
- `deploy` -- depends on `compile`

Cross-language test suite:

```bash
pnpm test           # TypeScript (Vitest + Hardhat)
pnpm test:python    # Python (pytest)
pnpm test:rust      # Rust (cargo test)
pnpm test:go        # Go (go test)
pnpm test:all       # All of the above
```

---

## Frontend: Next.js 16

### Technology

| Concern | Library |
|---------|---------|
| Framework | Next.js 16 (App Router) |
| UI | React 19, Tailwind CSS 3.4, Radix UI primitives |
| Animation | Framer Motion, GSAP |
| Web3 | wagmi v2, viem, RainbowKit |
| State | TanStack React Query v5 |
| Auth | NextAuth v4 (SIWE provider) |
| Analytics | Vercel Analytics + Speed Insights |

### SSR Strategy

The frontend provides two provider configurations:

- **`AppProvider`** -- Client-side rendering with full wallet context (wagmi, RainbowKit, React Query). Used for authenticated dashboard pages.
- **`AppProviderSSR`** (via `web3-providers.tsx`) -- Server-compatible provider tree that defers wallet connection to the client via hydration boundaries. Used for public marketing pages and SEO-critical routes.

Key pages: landing, dashboard (operator/buyer views), explorer, developer portal, investor relations, about, technology, solutions, regulatory, blog, privacy, terms, cookies.

### Deployment

The frontend is deployed to Vercel with SSR enabled. Environment variables are injected via Vercel project settings and `.env.local` for development.

---

## Backend: Fastify API

### Architecture

The API is a single Fastify 4.26 instance with 13 route modules, each registered under `/v1/<module>`:

```
/v1/health          /v1/auth            /v1/dac-units
/v1/sensors         /v1/verification    /v1/credits
/v1/marketplace     /v1/kyc             /v1/gasless
/v1/webhooks        /v1/activity        /v1/analytics
/v1/api-keys
```

### Plugins

| Plugin | Purpose |
|--------|---------|
| `@fastify/helmet` | HTTP security headers |
| `@fastify/cors` | Cross-origin resource sharing |
| `@fastify/rate-limit` | 100 req/min per IP |
| `@fastify/jwt` | JWT signing and verification |
| `@fastify/swagger` + `swagger-ui` | OpenAPI spec generation and UI |

### State Store Pattern

The API uses an in-memory state store abstraction (`readState` / `mutateState`) for development, with PostgreSQL-backed persistence for production. This pattern allows route handlers to be pure functions of state transitions, simplifying testing and enabling eventual migration to event sourcing.

### BullMQ Workers

Background job processing for:

- Verification pipeline execution (3-phase async processing)
- Webhook delivery with exponential backoff retry
- Sensor data aggregation and anomaly detection
- Credit transfer event indexing

---

## Smart Contracts

### Contract Architecture

25 contracts organised by domain, all using the **UUPS (Universal Upgradeable Proxy Standard)** pattern from OpenZeppelin.

| Category | Contracts |
|----------|-----------|
| Core | CarbonCredit (ERC-1155), CarbonMarketplace, VerificationEngine, CarbonRetirement, RetirementCertificate, CarbonBatchAuction |
| DeFi | CarbonAMM, CarbonVault, CarbonFutures, FractionalCredit |
| Oracle | NativeIoTOracle, ChainlinkVerifier |
| Governance | TerraQuraMultisig, TerraQuraMultisigMainnet, TerraQuraTimelock, TerraQuraTimelockMainnet |
| Infrastructure | TerraQuraAccessControl, TerraQuraForwarder (ERC-2771), CircuitBreaker |
| Compliance | ComplianceRegistry, ITMORegistry |
| Insurance | InsurancePool |
| Rewards | RewardDistributor |
| Libraries | EfficiencyCalculator |

### Role Hierarchy

```
DEFAULT_ADMIN_ROLE (multisig)
  +-- OPERATOR_ROLE
  +-- MINTER_ROLE
  +-- PAUSER_ROLE
```

### Compiler Settings

- Solidity 0.8.28
- EVM target: Cancun
- Optimizer: 200 runs
- viaIR: enabled

### Target Network

| Network | Chain ID | RPC |
|---------|----------|-----|
| Aethelred Mainnet | 123456 | `https://rpc.aethelred.network` |
| Aethelred Testnet | 78432 | `https://rpc-testnet.aethelred.network` |
| Hardhat (local) | 31337 | `http://127.0.0.1:8545` |

---

## Oracle Layer

### NativeIoT Oracle

The NativeIoT Oracle is a 1st-party sovereign oracle designed specifically for DAC telemetry ingestion. Unlike third-party oracle networks, it operates within the Aethelred network's trust boundary:

1. **DAC sensors** push readings to the API via authenticated `X-Sensor-API-Key` endpoints.
2. **The API** validates readings against physical thresholds (200-600 kWh/tonne, 90%+ purity) and flags anomalies.
3. **Validated readings** are aggregated and submitted to the `NativeIoTOracle` contract, which stores source data hashes.
4. **The VerificationEngine** references oracle data during the Proof-of-Physics verification pipeline.

### Chainlink VRF Integration

Chainlink VRF (Verifiable Random Function) is used for randomised audit selection -- ensuring that a statistically significant subset of verification periods are subjected to enhanced scrutiny without predictability.

---

## Database

### PostgreSQL + TimescaleDB

| Concern | Technology |
|---------|------------|
| Relational data | PostgreSQL (users, DAC units, credits, listings, KYC) |
| Time-series IoT | TimescaleDB hypertables (sensor readings, telemetry) |
| ORM | Drizzle ORM 0.29 with `drizzle-kit` migrations |
| Cache / Queues | Redis 7 (BullMQ job queues, rate-limit counters) |

TimescaleDB hypertables are used for sensor data to enable efficient time-range queries, continuous aggregates, and automatic data retention policies.

---

## Data Flow

The complete lifecycle of a carbon credit:

```
1. DAC Telemetry Ingestion
   DAC Sensor --> POST /v1/sensors/readings --> Validation --> TimescaleDB
                                                    |
                                             Anomaly Detection

2. Verification
   Operator --> POST /v1/verification --> Source Check --> Logic Check --> Mint Check
                                              |               |              |
                                         Data hash       Efficiency    Credits calc
                                         validation      200-600       kWh/tonne
                                                        kWh/tonne

3. Minting
   POST /v1/credits/mint --> VerificationEngine.verify() --> CarbonCredit.mint()
                                                                   |
                                                          ERC-1155 token + IPFS metadata

4. Trading
   POST /v1/marketplace/listings --> CarbonMarketplace.list()
   POST /v1/marketplace/listings/:id/purchase --> CarbonMarketplace.buy()
                                                        |
                                                  On-chain settlement

5. Retirement
   POST /v1/credits/:id/retire --> CarbonRetirement.retire()
                                          |
                                   RetirementCertificate.mint()
                                          |
                                   ITMORegistry.record()
```

---

## Infrastructure

### Docker Compose (Development)

The `docker-compose.yml` at the repository root provides:

- PostgreSQL + TimescaleDB
- Redis 7
- API server
- Worker processes
- Frontend dev server

### Deployment

| Component | Platform |
|-----------|----------|
| Frontend | Vercel (SSR) |
| API | Containerised (Docker) |
| Workers | Containerised (Docker) |
| Database | Managed PostgreSQL + TimescaleDB |
| Contracts | Aethelred L1 |

### Monitoring

The `packages/monitoring` package provides Prometheus metric collection via `prom-client`, exposing:

- HTTP request latency and throughput
- Verification pipeline duration
- Credit minting and retirement rates
- Sensor reading ingestion rates
- BullMQ job queue depths
