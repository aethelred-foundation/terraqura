# TerraQura operating documentation

The supported product is the lifecycle workbench, Fastify API, PostgreSQL
state, and Aethelred contracts described in the root [README](../README.md).
The API publishes its current schema through Swagger only when
`API_DOCS_ENABLED=true`; production should keep it disabled unless the endpoint
is protected.

Deployment operators should use
[VPS_PRODUCTION.md](deployment/VPS_PRODUCTION.md). Contract behavior is defined
by the Solidity source and tests in `apps/contracts`; no deployment is valid
until the generated manifest is reviewed against the target chain.

Repository checks are engineering evidence only. Environmental certification,
regulatory approval, recovery objectives, and operational service levels must
be documented and approved by the responsible external programs before being
claimed.
