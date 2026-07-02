# TerraQura Network Manifest

Canonical network and deployment metadata for TerraQura services.

This package exists to prevent drift between the API, web app, SDK, contracts,
monitoring, indexer, verifier, analytics service, and documentation. Aethelred
remains the primary target network. Polygon Amoy is retained only as a legacy
validation deployment because it is the only deployment with checked-in address
manifests as of this snapshot.

The TypeScript source also generates `manifest.json`, a language-neutral runtime
artifact consumed by Go, Rust, and Python services.

## Rules

- Add every new deployment here before wiring it into app code.
- Do not copy contract addresses directly into API, web, worker, or SDK modules.
- Use `TERRAQURA_DEPLOYMENT` or `NEXT_PUBLIC_TERRAQURA_DEPLOYMENT` to select a
  deployment at runtime.
- Use `TERRAQURA_NETWORK` or `NEXT_PUBLIC_TERRAQURA_NETWORK` to select a network.
- Polygon Amoy is historical validation evidence only. Runtime selection of
  `polygonAmoy` or `polygonAmoyV3Final` must set
  `TERRAQURA_ALLOW_LEGACY_VALIDATION_DEPLOYMENT=true` or
  `NEXT_PUBLIC_TERRAQURA_ALLOW_LEGACY_VALIDATION_DEPLOYMENT=true`.
- Regenerate `manifest.json` whenever the TypeScript manifest changes.
- Non-TypeScript services must validate their selected chain ID against
  `manifest.json` before starting chain-sensitive work.

## Validation

```bash
pnpm --filter @terraqura/network-manifest manifest:json
pnpm --filter @terraqura/network-manifest validate
```
