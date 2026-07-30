# TerraQura operating documentation

The supported product is the lifecycle workbench, Fastify API, PostgreSQL
state, and Aethelred contracts described in the root [README](../README.md).
The API publishes its current schema through Swagger only when
`API_DOCS_ENABLED=true`; production should keep it disabled unless the endpoint
is protected.

Public-testnet deployment operators should use
[PUBLIC_TESTNET_DEPLOYMENT.md](deployment/PUBLIC_TESTNET_DEPLOYMENT.md). It
defines the immutable-SHA, five-proxy, two-phase ceremony and production-host
checks. [VPS_PRODUCTION.md](deployment/VPS_PRODUCTION.md) is a shorter service
reference. Contract behavior is defined by the Solidity source and tests in
`apps/contracts`; no deployment is valid until the finalized manifest is
reviewed against the target chain.

Repository checks are engineering evidence only. Environmental certification,
regulatory approval, recovery objectives, and operational service levels must
be documented and approved by the responsible external programs before being
claimed.
