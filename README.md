# TerraQura

TerraQura is an Aethelred testnet dApp for operating an auditable carbon-removal
credit lifecycle:

1. register a removal facility;
2. provision a facility-bound sensor credential;
3. submit measured capture, energy, and purity evidence;
4. run source, logic, and mint-readiness verification;
5. issue verified ERC-1155 carbon units;
6. list, purchase, or cancel escrowed inventory; and
7. permanently retire owned units with an on-chain reason.

The supported application path is the lifecycle workbench at `/dashboard`.
Production builds fail closed when the API, HTTPS RPC, contract deployment, or
custody configuration is missing. No fallback records or fabricated chain
receipts are returned.

## Components

- `apps/web` — Next.js workbench with Aethelred Wallet as the primary connector.
- `apps/api` — Fastify API with SIWE, KYC/sanctions gates, durable PostgreSQL
  state, project-bound sensor credentials, and receipt validation.
- `apps/contracts` — the Solidity contracts and one controlled Aethelred
  testnet deployment script.
- `packages/types` — shared domain types. The API owns its versioned PostgreSQL
  schema and indexed telemetry persistence.

Legacy promotional pages redirect to the workbench or the architecture page.
Historical deployment manifests, generated audit claims, seeded market
activity, and unconnected SDK, indexer, monitoring, or background-service
surfaces are not shipped.

## Local verification

Requirements: Node.js 20+, pnpm 9+, Docker, and Docker Compose.

```bash
pnpm install
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
docker compose up --build
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

The local compose stack uses PostgreSQL inside its private network. Configure
the explicit Aethelred testnet RPC and contract addresses before starting the
API. The web app runs on port `3007`; the API runs on port `4000`.

## Controlled testnet deployment

Contract deployment is deliberately blocked unless all governance, signer,
metadata, RPC, and confirmation inputs are explicit:

```bash
pnpm --filter @terraqura/contracts deploy:testnet
```

The deployment script verifies chain ID `7332`, signer balance, HTTPS RPC,
governance ownership, and role transfer before writing a deployment manifest.
Never commit signer material or provider credentials.

For the production API, use `deploy/terraqura.production.env.example` as the
configuration checklist. Managed signer files must be mounted read-only.

## Security

See [SECURITY.md](SECURITY.md) for responsible disclosure. Repository tests and
static checks are engineering evidence, not an independent security audit,
regulatory approval, or environmental certification.

## License

Apache-2.0. See [LICENSE](LICENSE).
