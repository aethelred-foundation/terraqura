# TerraQura Network and Deployment Manifest v1.0

## Decision

TerraQura is Aethelred-first.

The current repository keeps Polygon Amoy only as legacy validation evidence because
the checked-in deployment manifests prove a Polygon Amoy contract deployment dated
2026-02-02. Those addresses must not be presented as Aethelred deployments.

## Source of Truth

Canonical metadata now lives in:

- `packages/network-manifest`
- `packages/network-manifest/manifest.json`

TypeScript consumers should import network IDs, explorer URLs, deployment status,
contract addresses, and verification links from this package instead of copying
literals. Go, Rust, Python, and other non-TypeScript runtimes should read the
portable JSON artifact and fail fast when the configured chain ID does not match
the selected network.

Current deployment keys:

| Deployment                | Network           | Status             | Purpose                    |
| ------------------------- | ----------------- | ------------------ | -------------------------- |
| `aethelredMainnetPending` | Aethelred Mainnet | Pending deployment | Production target          |
| `aethelredTestnetPending` | Aethelred Testnet | Pending deployment | Pre-production target      |
| `polygonAmoyV3Final`      | Polygon Amoy      | Validated testnet  | Legacy validation evidence |

## Runtime Selection

Backend services:

- `TERRAQURA_NETWORK=aethelredTestnet`
- `TERRAQURA_DEPLOYMENT=aethelredTestnetPending`
- `TERRAQURA_RPC_URL=https://rpc-testnet.aethelred.network`
- `TERRAQURA_NETWORK_MANIFEST_JSON=packages/network-manifest/manifest.json`

Frontend:

- `NEXT_PUBLIC_TERRAQURA_NETWORK=aethelredTestnet`
- `NEXT_PUBLIC_TERRAQURA_DEPLOYMENT=aethelredTestnetPending`
- `NEXT_PUBLIC_AETHELRED_TESTNET_CHAIN_ID=7332`

Legacy validation review:

- `TERRAQURA_NETWORK=polygonAmoy`
- `TERRAQURA_DEPLOYMENT=polygonAmoyV3Final`
- `NEXT_PUBLIC_TERRAQURA_NETWORK=polygonAmoy`
- `NEXT_PUBLIC_TERRAQURA_DEPLOYMENT=polygonAmoyV3Final`
- `TERRAQURA_ALLOW_LEGACY_VALIDATION_DEPLOYMENT=true`

The legacy validation opt-in is mandatory. Without it, TypeScript, Go, Rust,
and Python runtimes fail closed when `polygonAmoy` or `polygonAmoyV3Final` is
selected.

Operational services:

- the API `/v1/health` and `/v1/health/ready` responses include the selected
  TerraQura network, deployment key, deployment status, manifest chain ID,
  configured chain ID, RPC presence, and manifest drift status
- the API readiness check fails the blockchain check when `CHAIN_ID` does not
  match the selected manifest network
- the Go indexer validates `CHAIN_ID` against `manifest.json` and only starts
  live indexing when deployed contract filters exist
- the Go indexer uses `DATABASE_URL` for a durable Postgres event store; live
  indexing refuses in-memory storage unless `INDEXER_ALLOW_IN_MEMORY_STORE=true`
  is explicitly set for local drills
- the Go indexer `/health` response includes `network_key`, `deployment_key`,
  `chain_id`, `store_backend`, `indexer_enabled`, contract filter count, and
  confirmation depth
- the Rust verifier publishes `network_key`, `deployment_key`, and `chain_id` on
  `/health`
- the Python analytics service resolves `rpc_url` and `chain_id` from the same
  portable manifest

## Aethelred Deployment Rule

When a new Aethelred deployment is completed:

1. Add a new deployment entry to `packages/network-manifest`.
2. Add the raw deployment output under `apps/contracts/deployments`.
3. Update docs and API examples to point at the new deployment key.
4. Run `pnpm --filter @terraqura/network-manifest manifest:json`.
5. Run `pnpm validate:network`.
6. Run API, web, SDK, indexer, verifier, analytics, and contract smoke checks
   against the selected chain.

## Why This Matters

The consultant feedback correctly identified environment drift as the biggest
enterprise-readiness risk. This manifest package is the control point that keeps
API, web, workers, monitoring, SDK, docs, and contracts from developing separate
versions of chain truth.
