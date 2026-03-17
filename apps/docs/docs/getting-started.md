---
sidebar_position: 2
---

# Getting Started

This guide will help you set up a local development environment for TerraQura.

## Prerequisites

- **Node.js** >= 20.0.0
- **pnpm** >= 9.0.0
- **Docker** & Docker Compose
- **Git**

## Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/terraqura/terraqura.git
cd terraqura
```

### 2. Install Dependencies

```bash
pnpm install
```

### 3. Set Up Environment Variables

```bash
cp .env.example .env.local
```

Edit `.env.local` and configure:

```bash
# Required
POLYGON_RPC_URL=https://polygon-amoy.g.alchemy.com/v2/YOUR_KEY
DATABASE_URL=postgresql://terraqura:password@localhost:5432/terraqura
REDIS_PASSWORD=terraqura_dev

# Optional (for KYC)
SUMSUB_APP_TOKEN=your_token
SUMSUB_SECRET_KEY=your_secret
```

### 4. Start Infrastructure

```bash
docker-compose up -d
```

This starts:
- TimescaleDB (PostgreSQL with time-series)
- Redis (job queues)
- IPFS (decentralized storage)

### 5. Run Database Migrations

```bash
pnpm --filter @terraqura/database prisma migrate dev
```

### 6. Start Development Servers

```bash
pnpm dev
```

This starts:
- **API**: http://localhost:4000
- **Web Dashboard**: http://localhost:3000
- **Worker**: Background job processor

## Project Structure

```
terraqura/
├── apps/
│   ├── api/          # Fastify REST API
│   ├── web/          # Next.js dashboard
│   ├── worker/       # BullMQ job processor
│   ├── contracts/    # Solidity smart contracts
│   └── docs/         # Docusaurus documentation
├── packages/
│   ├── types/        # Shared TypeScript types
│   ├── database/     # Prisma + TimescaleDB
│   ├── queue/        # BullMQ job definitions
│   ├── subgraph/     # The Graph indexer
│   └── monitoring/   # Prometheus metrics
└── infrastructure/   # Docker & deployment configs
```

## Development Commands

```bash
# Run all apps in development mode
pnpm dev

# Build all packages
pnpm build

# Run tests
pnpm test

# Lint code
pnpm lint

# Type check
pnpm typecheck

# Format code
pnpm format
```

## Smart Contract Development

```bash
# Compile contracts
cd apps/contracts
pnpm compile

# Run tests
pnpm test

# Deploy to local network
pnpm deploy:local

# Deploy to Polygon Amoy testnet
pnpm deploy:amoy
```

## Next Steps

- [Introduction](/docs/)
- [Smart Contracts](/docs/contracts/overview)
- [Carbon Credit Contract](/docs/contracts/carbon-credit)
- [Project Repository](https://github.com/terraqura/terraqura)
