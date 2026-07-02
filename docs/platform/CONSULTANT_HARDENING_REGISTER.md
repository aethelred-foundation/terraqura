# TerraQura Consultant Hardening Register

This register converts the consultant hardening checklist into concrete
repo-level controls. It is intentionally stricter than the general enterprise
readiness envelope: the readiness check proves the platform has the right
backbone, while the production launch gate proves a specific release candidate
is clean, live-backed, deployed, and evidence-supported.

## Control Model

Every checklist item is classified as one of:

- `enforced`: blocked by code, test, or validation script
- `evidence-required`: must be captured in the production evidence pack
- `process-required`: requires human review, external audit, or deployment action
- `roadmap-contained`: deliberately kept outside the first production spine

Primary enforcement commands:

- `pnpm validate:enterprise`
- `pnpm validate:production-artifacts`
- `pnpm validate:production-launch`

The production launch gate is `scripts/production-launch-gate.mjs`.

## Critical Priority

### 1. Freeze a clean release candidate

Status: `enforced` and `process-required`.

Controls:

- `scripts/production-launch-gate.mjs` fails production launch when the worktree
  is dirty unless `TERRAQURA_ALLOW_DIRTY_RELEASE=true` is explicitly set for a
  documented emergency drill.
- The gate fails when generated/static archive outputs such as `latest-version`
  or `new-version` are present without
  `TERRAQURA_RELEASE_ARTIFACT_POLICY_ACK=true`.
- The release branch must be reviewed through normal pull request discipline
  before launch.

Evidence:

- Git commit hash, branch name, reviewer approvals, and release notes must be
  recorded in the production evidence pack.

### 2. Canonicalize the golden workflow

Status: `enforced`.

Controls:

- The first launch workflow is fixed as
  operator onboarding -> telemetry ingestion -> verification -> minting -> retirement -> audit export.
- `docs/platform/GOLDEN_WORKFLOW_STATE_MACHINE.md` documents state transitions,
  actors, approval boundaries, data handoffs, domain events, and replay safety.
- `docs/platform/GOLDEN_WORKFLOWS.md` keeps DeFi, insurance, futures, and other
  broad modules out of launch-critical messaging unless they directly support
  the golden workflow.
- `scripts/production-launch-gate.mjs` requires
  `TERRAQURA_LAUNCH_PROFILE=golden-workflow`.

Evidence:

- Golden workflow drill output must be included in the production evidence pack.

### 3. Finish normalized persistence for the first live workflow

Status: `enforced` and `evidence-required`.

Controls:

- `packages/database/src/domain/schema.sql` defines first-class tables for
  tenants, memberships, facilities, DAC units, verification batches, carbon
  instruments, market orders, retirement records, and domain events.
- API compatibility mutations append typed domain events in the same Postgres
  transaction as JSONB state changes.
- `pnpm test:database-domain` validates audit export query shape, payload hash
  defaults, record bounds, and export mapping.
- `pnpm test:api-golden` validates the golden API event spine.

Evidence:

- Production launch requires a golden workflow drill showing writes to the
  normalized domain backbone, not only preview state.

### 4. Prove audit-grade lineage

Status: `enforced` and `evidence-required`.

Controls:

- `getCarbonRemovalAuditLineage` and
  `buildCarbonRemovalAuditLineageQuery` provide bounded lineage export across
  facility, DAC unit, verification, instrument, market, retirement, and event
  data.
- Event payloads are hashed by default unless a scoped audit export explicitly
  requests payload inclusion.
- `docs/compliance/DATA_GOVERNANCE_AND_AUDIT_EXPORT.md` defines field
  classification, retention, minimization, and export shape.

Evidence:

- At least one live-backed audit lineage export must be attached to the
  production evidence pack.

### 5. Complete deployment security review

Status: `enforced`, `evidence-required`, and `process-required`.

Controls:

- `pnpm test:security-sim` runs focused sabotage, multisig fault injection,
  gasless replay/impersonation, and circuit breaker tests.
- `docs/security/EXPLOIT_SIMULATION_MATRIX.md` records known local exploit
  classes and expected safe outcomes.
- Gasless relayer mode is explicit and fails closed when Defender mode lacks a
  real handler.
- Worker verification jobs fail fast without source validation, telemetry,
  duplicate-mint, KYC, and sanctions evidence outside approved local drill
  modes.

Evidence:

- External audit scope, open findings, resolved findings, and sign-off must be
  included before production rollout.

### 6. Remove ambiguity from live vs preview product data

Status: `enforced`.

Controls:

- `docs/platform/DASHBOARD_DATA_PROVENANCE_INVENTORY.md` classifies dashboard
  and product surfaces as Live, Preview, or Mixed.
- `NEXT_PUBLIC_TERRAQURA_DASHBOARD_DATA_MODE=live` is required by the production
  launch gate.
- Preview data is visibly labeled through the dashboard banner.
- No critical buyer, operator, sovereign, minting, retirement, or compliance
  view may depend on preview data in production.

Evidence:

- Release evidence must include a live-vs-preview inventory signed off by the
  product and compliance owners.

### 7. Run an end-to-end readiness drill

Status: `evidence-required`.

Controls:

- `pnpm validate:enterprise` validates network manifest consistency, subgraph
  manifest posture, API golden flow, database domain export, contract security
  simulations, and enterprise artifact integrity.
- `docs/platform/PRODUCTION_EVIDENCE_PACK.md` defines the go/no-go evidence
  pack.

Evidence:

- The evidence pack must include telemetry ingestion, verification, minting,
  transfer or retirement, audit export, service health, and chain/indexing
  outputs from the selected deployment.

## High Priority

### 8. Harden operational resilience

Status: `enforced` and `evidence-required`.

Controls:

- Worker, queue, database, monitoring, and API services use structured logging
  with redaction instead of raw console output in production code.
- Queue producers support idempotency keys.
- Analytics and verification fail closed when live data or required evidence is
  unavailable.
- Alert runbooks define failure-mode response for API, workers, database,
  Redis, RPC, Graph/indexer, verification, and security events.

Evidence:

- Failure-mode drill notes for RPC degradation, Redis interruption, delayed
  verifier responses, failed webhooks, stale indexer data, and queue backlogs
  must be included before production rollout.

### 9. Tighten secrets and environment isolation

Status: `enforced`.

Controls:

- The network manifest is the source of truth for runtime network and
  deployment identity.
- Legacy Polygon validation deployments fail closed unless an explicit legacy
  drill opt-in is set.
- Client-exposed values remain under `NEXT_PUBLIC_*` and are treated as public.
- Alertmanager uses file-mounted Slack/PagerDuty secrets, not inline webhook
  keys.

Evidence:

- The evidence pack must include environment class, selected deployment,
  configured chain ID, manifest chain ID, and secret-rotation owner references.

### 10. Harden monitoring and ownership

Status: `enforced`.

Controls:

- Prometheus alerts must carry `severity`, `category`, `owner`, and public
  `runbook` labels.
- Alert owner labels must map to
  `docs/operations/SERVICE_OWNERSHIP_AND_SLOS.md`.
- Runbook anchors must exist in `docs/operations/ALERT_RUNBOOKS.md`.
- Alertmanager must route critical alerts to PagerDuty and relevant Slack
  channels using file-mounted secrets.

Evidence:

- On-call owner, escalation path, and alert smoke output must be captured in the
  evidence pack.

### 11. Create a production evidence pack

Status: `enforced`.

Controls:

- `docs/platform/PRODUCTION_EVIDENCE_PACK.md` defines the reusable buyer-grade
  and regulator-grade pack format.
- `scripts/production-launch-gate.mjs` requires a concrete pack at
  `output/evidence/terraqura-production-evidence-pack.md` or the path named by
  `TERRAQURA_PRODUCTION_EVIDENCE_PACK`.
- The production launch gate rejects placeholder packs unless they contain
  `Decision: GO`, `Open critical exceptions: none`, live dashboard mode proof,
  selected deployment identity, required command evidence, workflow event
  evidence, service health evidence, and `No production secrets committed: yes`.
- `pnpm evidence:production-template` generates a non-approved `Decision: NO-GO`
  scaffold so release owners start from a consistent pack without bypassing the
  launch gate.

Evidence:

- The pack must include deployment manifest, targeted test outputs, security
  scope, lineage exports, health checks, runbooks, SLO owners, and go/no-go
  sign-off.

### 12. Reduce launch complexity

Status: `roadmap-contained`.

Controls:

- `docs/platform/GOLDEN_WORKFLOWS.md` marks advanced DeFi, insurance, futures,
  and secondary-market modules as roadmap or platform-extension until the first
  institutional path is live and hardened.
- Launch messaging must focus on MRV integrity, verified issuance, retirement
  trust, and sovereign/compliance reporting.

Evidence:

- Release notes must classify non-core modules as roadmap or platform-extension
  unless explicitly included in the golden workflow evidence.

## Medium Priority

### 13. Refine customer-facing trust UX

Status: `evidence-required`.

Controls:

- Network/deployment identity is surfaced through the manifest-backed web/API
  configuration.
- The dashboard preview banner prevents synthetic metrics from being mistaken
  for live data.
- Audit lineage exports are defined for institutional and regulator review.

Evidence:

- Screenshots or recordings for verification status, provenance, retirement
  integrity, and audit export inspection should be added to the evidence pack.

### 14. Mature integration surfaces

Status: `enforced` and `roadmap-contained`.

Controls:

- SDK modules resolve deployment identity and contract addresses from the
  network manifest.
- Hosted checkout can use a durable session backend.
- Webhook dispatch reports delivery outcomes and clears timeout handles.
- Non-essential SDK modules remain secondary until golden workflow interfaces
  are stable.

Evidence:

- Reference integration logs for operator MRV and enterprise retirement should
  be included once live-backed integrations are exercised.

### 15. Expand testing breadth after workflow hardening

Status: `process-required`.

Controls:

- Current validation prioritizes golden workflow, domain audit export, network
  identity, and focused security simulations.
- Secondary modules should add deeper end-to-end and chaos coverage only after
  the first production spine is stable.

Evidence:

- Post-launch roadmap should sequence auctions, claims, insurance, and advanced
  trading tests after the first institutional path has signed live evidence.

## Deployment Gate

TerraQura is production-launch eligible only when all of the following are true:

- `pnpm validate:enterprise` passes.
- `pnpm validate:production-launch` passes without emergency bypasses.
- Aethelred deployment manifest is checked in and selected.
- Dashboard data mode is live.
- The release candidate is clean and reviewed.
- One institutional workflow is live-backed, auditable, monitored,
  security-reviewed, and represented in the production evidence pack.
