# TerraQura Production Evidence Pack

This document defines the reusable evidence pack required before TerraQura is
presented as production-ready to institutional buyers, DAC operators,
regulators, sovereign reviewers, investors, or external auditors.

Default concrete pack path:

- `output/evidence/terraqura-production-evidence-pack.md`

The production launch gate accepts an alternate file through:

- `TERRAQURA_PRODUCTION_EVIDENCE_PACK=/absolute/or/repo/relative/path.md`

## Go/No-Go

Every production evidence pack must start with:

- release candidate branch
- release candidate commit
- deployment key
- network key
- chain ID
- go/no-go decision
- approver names or roles
- date and time of approval
- open exceptions
- rollback owner

No production launch may proceed with unresolved critical exceptions.

## Required Command Evidence

Record command, timestamp, environment, exit code, and output location for:

- `pnpm validate:network`
- `pnpm validate:enterprise`
- `pnpm validate:production-artifacts`
- `pnpm validate:production-launch`
- `pnpm test:api-golden`
- `pnpm test:database-domain`
- `pnpm test:security-sim`
- API route tests for launch-critical route groups
- worker processor tests
- verifier tests
- indexer tests
- analytics service tests
- web typecheck and launch-critical dashboard smoke check

Command evidence should include raw output or a durable log reference.

## Deployment Manifest

Include:

- selected `TERRAQURA_NETWORK`
- selected `TERRAQURA_DEPLOYMENT`
- manifest source file
- network chain ID
- configured runtime chain ID
- RPC endpoint class, not secret URL if credential-bearing
- explorer URL
- contract addresses for access control, verification engine, carbon credit,
  marketplace, gasless marketplace, multisig, timelock, circuit breaker, and
  NativeIoT oracle
- implementation verification links where applicable
- relayer mode and signer custody model
- circuit breaker initial status

The pack must not present legacy Polygon validation addresses as Aethelred
deployment evidence.

## Golden Workflow Drill

The drill must cover:

1. tenant and operator membership creation
2. facility registration
3. DAC unit registration and whitelist evidence
4. telemetry ingestion into TimescaleDB
5. verification batch submission
6. verification worker evidence evaluation
7. Rust verifier result
8. verified batch approval or rejection
9. carbon instrument creation
10. mint transaction submission and receipt
11. marketplace transfer or direct buyer ownership evidence
12. retirement transaction and certificate reference
13. audit lineage export

For each step include:

- actor
- request or job id
- tenant id where applicable
- domain event id
- transaction hash where applicable
- resulting state
- failure handling observed or tested

## Health Checks

Capture health/readiness output for:

- API `/v1/health`
- API `/v1/health/ready`
- worker startup and queue status
- verifier `/health`
- indexer `/health`
- analytics service `/health`
- Postgres and TimescaleDB
- Redis
- Graph node or subgraph endpoint
- selected RPC provider
- contract-event monitor
- web dashboard smoke route

Each health check must state whether it is live, preview, local drill, or
unavailable.

## Audit Lineage

Attach at least one live-backed lineage export from
`getCarbonRemovalAuditLineage`.

Required lineage evidence:

- tenant
- facility
- DAC unit
- verification batch
- source data hash
- telemetry window hash
- carbon instrument
- token ID
- mint transaction
- market order or ownership transfer
- retirement record
- certificate token/reference
- domain events
- payload hashes by default

If raw event payloads are included, attach approval scope and compliance owner.

## Security Scope

Include:

- external audit status
- contracts in scope
- relayer and gasless flow scope
- verifier and worker scope
- key-management model
- open findings
- resolved findings
- accepted risks
- incident response owner
- circuit breaker runbook link

The local exploit simulation matrix is supporting evidence, not a substitute for
external audit.

## Operational Evidence

Include:

- service owners and SLO links
- Alertmanager routing proof
- Prometheus alert rule version
- runbook links
- backup/restore drill note
- failure-mode drill notes for RPC degradation, Redis interruption, delayed
  verifier response, failed webhook delivery, stale indexer data, and queue
  backlog
- rollback procedure and rollback owner

## Live vs Preview Evidence

Attach:

- `NEXT_PUBLIC_TERRAQURA_DASHBOARD_DATA_MODE`
- launch-critical surface inventory
- proof that critical buyer, operator, sovereign, minting, retirement, and
  compliance views are live-backed
- list of remaining preview surfaces, if any
- reason each remaining preview surface is outside the launch-critical workflow

## Secrets and Environment Isolation

Record:

- environment name
- secret owner roles
- secret rotation cadence
- relayer key custody model
- KYC provider mode
- webhook secret rotation plan
- PagerDuty and Slack secret mounting strategy
- statement that no committed file contains production secrets

Do not include secrets, credential-bearing URLs, private keys, bearer tokens, or
raw KYC provider response bodies.

## Gate-Checked Fields

`pnpm validate:production-launch` rejects a pack that is only a placeholder. The
full production gate checks for:

- `Decision: GO`
- `Open critical exceptions: none`
- concrete 7-40 character git `Release commit`
- `NEXT_PUBLIC_TERRAQURA_DASHBOARD_DATA_MODE=live`
- selected deployment key, network key, chain ID, and nonzero launch-critical
  contract addresses from `packages/network-manifest/manifest.json`
- required sections for approvals, validation commands, deployment manifest,
  golden workflow drill, health checks, audit lineage, security scope,
  operational evidence, live-vs-preview evidence, secrets/environment
  isolation, and exceptions/rollback
- command evidence for `pnpm validate:network`, `pnpm validate:enterprise`,
  `pnpm validate:production-launch`, `pnpm test:api-golden`,
  `pnpm test:database-domain`, and `pnpm test:security-sim`
- golden workflow event evidence for `tenant.created`,
  `telemetry.window_opened`, `verification_batch.verified`,
  `carbon_credit.minted`, `carbon_credit.retired`, and
  `audit_export.generated`
- service health terms for API, worker, verifier, indexer, analytics service,
  Postgres, Redis, and selected RPC provider
- `No production secrets committed: yes`

Generate a non-approved scaffold with:

- `pnpm evidence:production-template`

The generated scaffold is intentionally `Decision: NO-GO` until the release team
adds real live evidence and approver sign-off.

## Pack Template

```md
# TerraQura Production Evidence Pack

Prepared on:
Prepared by:
Release branch:
Release commit:
Network key:
Deployment key:
Decision: NO-GO
Open critical exceptions:
Rollback owner:

## Approvals

- Product:
- Engineering:
- Security:
- Compliance:
- Operations:

## Validation Commands

| Command | Timestamp | Exit Code | Output |
| --- | --- | --- | --- |
| pnpm validate:network | | | |
| pnpm validate:enterprise | | | |
| pnpm validate:production-launch | | | |

## Deployment Manifest

## Golden Workflow Drill

## Health Checks

## Audit Lineage

## Security Scope

## Operational Evidence

## Live vs Preview Evidence

NEXT_PUBLIC_TERRAQURA_DASHBOARD_DATA_MODE=

## Secrets and Environment Isolation

No production secrets committed:

## Exceptions and Rollback
```
