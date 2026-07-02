# TerraQura Enterprise Readiness Envelope

This is the minimum package required before presenting TerraQura as an
institutional platform to banks, sovereigns, large DAC operators, or regulated
buyers.

Consultant hardening controls are tracked in
`docs/platform/CONSULTANT_HARDENING_REGISTER.md`. Production launch is gated by
`pnpm validate:production-launch`, which requires a clean release candidate,
live dashboard mode, a non-pending primary-target deployment manifest, nonzero
launch-critical contract addresses, and a concrete production evidence pack with
GO sign-off, live evidence, command output, health checks, audit lineage, and
secrets attestation. A non-approved scaffold can be generated with
`pnpm evidence:production-template`.

## Security Posture

Required artifacts:

- contract governance model covering UUPS upgrades, multisig, timelock, and circuit breaker
- key-management policy for deployer, relayer, oracle, admin, and emergency roles
- incident response runbook tied to circuit breaker activation
- dependency and image scanning policy
- external audit status and open finding register

Existing signals:

- governance contracts
- circuit breaker
- multisig and timelock contracts
- disaster recovery documentation
- gas optimization review
- focused dynamic exploit simulation matrix (`docs/security/EXPLOIT_SIMULATION_MATRIX.md`)
  covering sabotage paths, multisig fault injection, gasless replay/impersonation,
  and circuit breaker controls; runnable with `pnpm test:security-sim`
- crypto-backed API identifiers for user-facing records, webhook deliveries,
  marketplace purchases, simulated block metadata, and on-chain-style bytes32 IDs

## Operational Posture

Required artifacts:

- service ownership map
- SLOs for API, verifier, workers, indexer, and RPC access
- alert runbooks linked to Prometheus alerts
- deployment rollback procedure
- backup and restore test record

Existing signals:

- Terraform for AWS infrastructure
- Prometheus scrape config
- alerting rules
- production Prometheus alerts now carry stable `owner` and `runbook` labels,
  backed by `docs/operations/ALERT_RUNBOOKS.md`; the enterprise readiness gate
  rejects alerts without a public runbook URL and matching local runbook anchor
- Alertmanager routing is checked in at `infrastructure/monitoring/alertmanager.yml`
  with critical PagerDuty routing, Slack ops/security receivers, runbook context
  in notifications, and file-mounted secrets instead of inline webhook keys
- service ownership and SLOs are codified in
  `docs/operations/SERVICE_OWNERSHIP_AND_SLOS.md`; the readiness gate rejects
  alerts whose owner label is not registered in that operating model
- BullMQ worker isolation
- TimescaleDB schema for telemetry
- verification worker evidence contract requiring source validation, telemetry
  aggregate, duplicate-mint, KYC, and sanctions evidence outside local-drill mode
- analytics service fail-closed behavior for live marketplace/indexer data, with
  synthetic analytics requiring explicit `TQ_ALLOW_SYNTHETIC_DATA=true` opt-in
- SDK checkout session persistence abstraction, allowing Redis, Postgres,
  DynamoDB, or equivalent durable backends via `checkoutSessionBackend` instead
  of process-local session maps
- queue producers support explicit `idempotencyKey` values for notification and
  IPFS jobs, with crypto-random job IDs when dedupe is not requested
- queue Redis connection lifecycle/error logging now routes through an
  injectable structured logger with redaction and safe error serialization,
  rather than package-level raw `console` output
- monitoring alerts use crypto-backed IDs, return per-channel delivery reports,
  and fail closed for email unless a real `emailTransport` is supplied
- API gasless relay mode is explicit (`direct` or `defender`), and Defender mode
  fails closed unless a real Defender relay handler is configured rather than
  silently falling back to direct hot-wallet relay
- API Graph client normalizes primary/fallback subgraph endpoints and clears
  request timeout handles on both success and failure paths
- API compatibility state store uses Postgres row locks and now exposes a
  Fastify shutdown hook to close pooled database clients during deploy/test
  lifecycle transitions
- API state-store mutations can now append typed domain events in the same
  Postgres transaction; minting, retirement, listing creation, and purchase
  settlement emit audit-grade events alongside compatibility-layer payload
  fingerprints
- API IoT simulator variance/anomaly generation uses crypto-backed sampling
  rather than predictable `Math.random()` sequences
- API KYC/Sumsub integration uses a shared structured logger with KYC-specific
  redaction, avoids copying provider response bodies into thrown errors, safely
  rejects malformed webhook signatures, and logs queue/webhook activity with
  deterministic references instead of raw wallet, applicant, or external-user IDs
- API webhook test delivery now performs a real signed HTTP POST with delivery
  attempt/status accounting and localhost/private-network guardrails, rather
  than returning a placeholder payload that operators still had to send manually
- web runtime error reporting posts to an explicit
  `NEXT_PUBLIC_ERROR_REPORTING_URL` monitoring endpoint and returns
  sent/skipped/failed delivery outcomes instead of console-only production logs
- web route/global error boundaries, Web3 provider/query failures, Wagmi
  configuration failures, KYC/Sumsub widget errors, legal acceptance/signing
  failures, and optimized image registry misses are wired through the shared
  `reportClientError` path with sanitized metadata; the enterprise gate rejects
  raw `console` logging in web runtime source outside the central reporter
- web error reports strip query strings and URL fragments before delivery so
  monitoring events cannot leak callback tokens, applicant references, or other
  sensitive browser URL parameters; production delivery also rejects insecure
  non-HTTPS monitoring endpoints
- web production builds no longer depend on live Google Fonts fetches; the
  design system defines deterministic font tokens in CSS, CSP no longer permits
  Google Fonts by default, and the enterprise gate rejects external font
  reintroduction in the build path
- web image optimizer caching is left under Next.js control instead of forcing
  immutable `/_next/image` headers, keeping production builds clean and avoiding
  stale optimized-image behavior
- web visual/runtime randomness now routes through browser-crypto-backed helper
  functions, and the enterprise gate rejects `Math.random()` in production web
  source except the explicitly deterministic seeded mock-data utility
- dashboard data provenance is centralized behind
  `NEXT_PUBLIC_TERRAQURA_DASHBOARD_DATA_MODE`; preview mode is visibly labeled,
  live mode disables synthetic activity-feed injection, and the environment
  template no longer steers new deployments toward legacy Polygon settings
- web notification and activity-feed IDs use browser crypto APIs with a
  monotonic fallback instead of timestamp-plus-`Math.random()` identifiers
- SDK on-chain risk reads/writes now require a dedicated RiskOracle address from
  the network manifest or explicit `riskOracleAddress` client config; the module
  no longer relies on placeholder address slots or untyped private config
- SDK insurance policy creation no longer prices policies from a hidden
  hardcoded "healthy" DAC score; async creation resolves premiums through
  RiskOracle-backed `calculateInsurancePremium`, while synchronous creation
  requires an explicit partner override or local health score
- SDK sovereign national inventory now resolves average fleet health from
  RiskOracle profiles when available, reports unknown health transparently when
  oracle evidence is unavailable, and supports explicit sector allocation
  weights instead of relying only on hidden fixed distribution assumptions
- SDK retry backoff jitter now uses crypto-backed randomness via `ethers.randomBytes`,
  returns a true half-open unit interval, and the enterprise gate rejects
  `Math.random()` in production SDK source
- SDK webhook dispatch paths for hosted checkout and event listeners now clear
  abort timeout handles on both success and failed fetch paths, preventing timer
  leaks in long-running services and serverless runtimes
- worker runtime and processors now emit structured Pino logs through a shared
  redaction policy, serialize errors deliberately, avoid logging completed job
  result payloads, and correlate KYC events with deterministic references
  instead of raw user, wallet, or applicant identifiers

## Data and Compliance Posture

Required artifacts:

- data retention policy by tenant and jurisdiction
- privacy classification for wallet addresses, KYC records, telemetry, and audit events
- pseudonymization/anonymization rules for analytics
- audit export format
- lineage view from telemetry to verification to instrument to retirement

New backbone:

- `packages/database/src/domain/schema.sql`
- `docs/compliance/DATA_GOVERNANCE_AND_AUDIT_EXPORT.md`

This schema introduces first-class `domain_*` tenants, facilities, units, verification
batches, instruments, orders, retirements, and domain events so the platform can
answer regulator-style questions without reconstructing every workflow from JSON
or colliding with the existing Prisma application tables.

The database domain package now exposes `getCarbonRemovalAuditLineage(db, scope)`
and `buildCarbonRemovalAuditLineageQuery(scope)` so authorized exports can trace
facility and DAC unit provenance through verification, instrument issuance,
market activity, retirement, and typed domain events. Event payloads are hashed
by default unless an approved audit scope explicitly requests payload inclusion.

## Integration Posture

Required artifacts:

- canonical network manifest
- SDK versioning and deprecation policy
- API compatibility policy
- event schema versioning policy
- reference integrations for operator MRV and enterprise retirement

New backbone:

- `packages/network-manifest`
- `packages/network-manifest/manifest.json`

Runtime enforcement now covers:

- TypeScript apps and packages through direct manifest imports
- runtime network/deployment selection fails closed when legacy Polygon Amoy
  validation evidence is selected, unless
  `TERRAQURA_ALLOW_LEGACY_VALIDATION_DEPLOYMENT=true` or the matching
  `NEXT_PUBLIC_*` opt-in is set for an explicit historical validation drill
- Go indexer, Rust verifier, and Python analytics service enforce the same
  legacy-validation opt-in contract when consuming the portable manifest
- API health/readiness publishing manifest identity and failing chain-id drift
- worker verification jobs failing fast when production evidence payloads are
  missing instead of silently using demonstration metrics
- Python analytics protocol stats and traded leaderboards reading live API
  marketplace data in production, returning unavailable status instead of
  silently substituting synthetic values
- SDK hosted checkout sessions can now survive process restarts and multi-node
  deployments when supplied with a durable `CheckoutSessionBackend`
- SDK actuarial scoring can still run locally without a chain call, while
  RiskOracle-backed reads/writes fail closed until `riskOracleAddress` or
  `TERRAQURA_CONTRACT_RISK_ORACLE` is configured for the target deployment
- notification/IPFS queue producers avoid timestamp-only job identifiers and can
  dedupe producer retries with stable idempotency keys
- queue infrastructure exposes a logger injection point so API and worker
  processes can route Redis lifecycle events into their production logging
  backends without coupling the shared package to either runtime
- database/TimescaleDB shared clients expose an injectable structured logger with
  redaction and safe error serialization, so pool lifecycle errors no longer
  depend on raw package-level `console` output
- monitoring alert delivery no longer treats console logging as an email
  backend; operators get explicit sent/skipped/failed channel outcomes
- worker observability no longer depends on raw `console` output; startup,
  queue lifecycle, verification, minting, and KYC provider flows produce
  filterable structured fields suitable for centralized logging and incident
  review
- gasless relayer status reports mode, direct signing capability, and Defender
  credential state for operational readiness checks
- API service logs now have a reusable redaction/error-serialization layer for
  service code that runs outside request-scoped Fastify handlers
- production API source is guarded against raw `console` logging; gasless
  relayer verification, subgraph fallback failures, and circuit-breaker health
  checks now emit structured API logger events
- Go indexer startup, chain ID validation, and contract-filtered live indexing
- Go indexer durable Postgres event storage when `DATABASE_URL` is configured
- Rust verifier startup and health identity
- Python analytics RPC and chain ID resolution

## Readiness Gate

Before an environment is described as enterprise-ready, it must pass:

1. `pnpm validate:enterprise` (pins pnpm 9 where workspace script invocation is
   required, uses package-local manifest tooling instead of nested pnpm for
   network/subgraph validation, runs the API golden workflow test, runs the
   database domain audit export test, runs `pnpm test:security-sim`, and then
   runs the enterprise readiness script)
2. API typecheck and route tests
3. web typecheck and dashboard smoke test
4. worker typecheck and queue processor tests
5. contract test suite for the selected deployment
6. synthetic golden workflow test from telemetry to retirement
7. backup/restore rehearsal for database and event log

API route tests are configured to run deterministically as integration tests
instead of racing many full Fastify server startups in parallel. This avoids
false confidence from skipped route suites and keeps the gate useful for
consultant review and CI promotion decisions.
