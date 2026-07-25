# TerraQura Subgraph

This package uses hardened wrappers for Graph build/test so local and CI runs are deterministic and permission-safe.

## Commands

- `pnpm --filter @terraqura/subgraph codegen`
- `pnpm --filter @terraqura/subgraph build`
- `pnpm --filter @terraqura/subgraph test`
- `pnpm --filter @terraqura/subgraph test:coverage`
- `pnpm --filter @terraqura/subgraph tools:prefetch` (download Matchstick binary only)

## Reliability Hardening

- Build/test scripts run through `scripts/*` wrappers, not direct `graph` commands.
- Runtime state is isolated to `packages/subgraph/.runtime` (cache/home/tmp/tools) to avoid global cache permission issues.
- Graph CLI is a development-only dependency; production installs contain only the mapping runtime.
- Test runner uses a pinned Matchstick version and downloads binaries into `.runtime/tools/matchstick` (not `node_modules`).
- Subgraph tests fail if no test files exist (quality gate stays meaningful).

## Security Boundary

Graph CLI 0.98.1 currently has a development-tool advisory through
`decompress@4.2.1` ([GHSA-mp2f-45pm-3cg9](https://github.com/advisories/GHSA-mp2f-45pm-3cg9)).
The npm advisory has no patched `decompress` release at this time.

TerraQura contains the exposure as follows:

- `@graphprotocol/graph-cli` is a `devDependency` and is absent from the production dependency graph.
- The affected extractor is called by Graph CLI's local `graph node` installer. TerraQura's wrappers invoke only `graph codegen` and `graph build`; Matchstick runs from its pinned standalone binary.
- Shipped subgraph artifacts contain the compiled WASM mappings, ABIs, schema, and manifest—not Graph CLI, `decompress`, or `node_modules`.
- `security:production-boundary` fails if Graph CLI or `decompress` enters the production graph, if wrappers invoke an unapproved Graph command, or if a generated artifact contains a tooling marker.
- The fail-closed production audit remains authoritative for runtime dependencies.

The advisory therefore remains explicitly tracked in the development toolchain.
Do not use `graph node` with untrusted archives. Upgrade Graph CLI or its extractor
as soon as an upstream patched release is available.

## CI Provisioning

Minimum CI requirements:

1. Writable workspace (for `.runtime/**`).
2. Network access to GitHub releases for initial Matchstick download, or a pre-provisioned binary.
3. Node.js 20.18.1 or later and a full `pnpm install` for build/test tooling.

Recommended CI sequence:

1. `pnpm install --frozen-lockfile`
2. `pnpm --filter @terraqura/subgraph tools:prefetch`
3. `pnpm --filter @terraqura/subgraph build`
4. `pnpm --filter @terraqura/subgraph test`

## Offline / Air-Gapped Mode

- Pre-provision Matchstick and set:
  - `MATCHSTICK_BINARY=/absolute/path/to/matchstick-binary`
  - `SUBGRAPH_OFFLINE=1`
- Then run:
  - `pnpm --filter @terraqura/subgraph test`

## Troubleshooting

- Matchstick download fails: use `MATCHSTICK_BINARY` or mirror with `MATCHSTICK_BASE_URL`.
- Missing `matchstick-as`: run `pnpm --filter @terraqura/subgraph add -D matchstick-as`.
