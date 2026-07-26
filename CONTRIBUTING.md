# Contributing

Create a focused branch from `main`, keep credentials out of the repository,
and use conventional commit messages.

Before requesting review, run:

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

Changes to contract ABIs, runtime configuration, custody, authentication,
compliance, sensor ingestion, or transaction indexing must include relevant
tests and deployment documentation. Do not add sample production data,
unverified network endpoints, hardcoded deployed addresses, or generated
security claims.

Report vulnerabilities through [SECURITY.md](SECURITY.md), not a public issue.
