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
- Graph CLI codegen is patched to lazy-load `sync-request` fixture logic, preventing `sync-rpc` bind failures in restricted environments.
- Test runner uses a pinned Matchstick version and downloads binaries into `.runtime/tools/matchstick` (not `node_modules`).
- Subgraph tests fail if no test files exist (quality gate stays meaningful).

## CI Provisioning

Minimum CI requirements:

1. Writable workspace (for `.runtime/**`).
2. Network access to GitHub releases for initial Matchstick download, or a pre-provisioned binary.
3. `pnpm install` so patched dependencies are applied.

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

- `listen EPERM ... sync-rpc`: run `pnpm install` to apply the Graph CLI patch.
- Matchstick download fails: use `MATCHSTICK_BINARY` or mirror with `MATCHSTICK_BASE_URL`.
- Missing `matchstick-as`: run `pnpm --filter @terraqura/subgraph add -D matchstick-as`.
