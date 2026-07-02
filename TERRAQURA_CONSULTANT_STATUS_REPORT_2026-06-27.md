# TerraQura Consultant Status Report

Prepared on: 2026-06-27

Prepared from: direct repository inspection of the current TerraQura workspace

Purpose: give an external consultant a clear view of what has been built so far, what is strongest, what is still in progress, and which decisions should guide the next phase.

## 1. Report Basis and Scope

This is a current workspace snapshot, not a full live-environment audit.

Important context:

- Current repository root resolves to `/Users/rameshtamilselvan/Downloads/terraqura`.
- The workspace path `/Users/rameshtamilselvan/Downloads/aethelred/dApps/terraqura` is a symlink to that repository.
- Current branch: `fix/vercel-gitignore`.
- Latest committed baseline inspected: `fe64f6d`, dated 2026-03-24.
- The current worktree is very active: 193 modified tracked files, 4 deleted tracked files, and 68 untracked paths.
- I reran the core enterprise validation chain during this reporting pass. I did not perform a live deployment.
- This report treats the current checked-out workspace, including uncommitted work, as "built so far".

## 2. Executive Summary

TerraQura is already a substantial multi-layer dApp platform, not just a website or isolated smart-contract prototype. The repository contains a full monorepo with:

- Solidity smart contracts for carbon credit issuance, verification, trading, retirement, governance, compliance, gasless transactions, DeFi extensions, insurance, rewards, and oracle integrations
- a Next.js / React web app with public pages, role-specific pages, blog/content surfaces, and an 8-section dashboard
- a Fastify API server with 13 route groups and approximately 47 endpoint handlers
- BullMQ workers for minting, verification, and KYC processing
- a Python analytics and ML service
- a Rust verifier service
- a Go blockchain/event indexer
- a Graph subgraph package
- shared SDK, database, queue, monitoring, network-manifest, and type packages
- production-oriented Terraform, Prometheus, Alertmanager, SLO, runbook, compliance, and security documentation

Plain-language assessment:

- Smart-contract depth: strong
- Platform breadth: strong
- Enterprise readiness planning: much stronger than a typical prototype
- API and backend workflow depth: meaningful, but still partly transitional
- Web/product surface: broad and polished, but some dashboard data is intentionally preview/mock-backed
- Deployment readiness: improving, but not yet complete because Aethelred contract deployments are still marked pending in the canonical manifest
- Overall stage: advanced pre-production buildout

The most important consultant takeaway is this:

TerraQura has real engineering substance across the full carbon-credit lifecycle. The next phase should focus less on adding features and more on consolidation: canonical deployment, live-data integration, normalized backend workflows, production validation, and external audit evidence.

Hardening update from this pass:

- consultant checklist items are now mapped to repo-level controls in `docs/platform/CONSULTANT_HARDENING_REGISTER.md`
- the first institutional workflow is fixed as operator onboarding -> telemetry ingestion -> verification -> minting -> retirement -> audit export
- live-vs-preview dashboard provenance is documented and tied to launch gating
- production launch now has an explicit gate: `pnpm validate:production-launch`
- a non-approved evidence-pack scaffold can be generated with `pnpm evidence:production-template`
- the production gate rejects placeholder evidence packs unless they contain GO sign-off, no critical exceptions, live-mode proof, deployment identity, command evidence, workflow event evidence, health checks, and secrets attestation

## 3. What TerraQura Is Intended to Be

The platform is designed as an institutional carbon removal and carbon credit system built around:

1. direct air capture operator onboarding
2. sensor and telemetry ingestion
3. Proof-of-Physics verification
4. tokenized carbon credit issuance
5. marketplace trading and settlement
6. credit retirement and certificate generation
7. compliance, audit lineage, sovereign reporting, and institutional buyer workflows

The strategic network target is Aethelred, described in the repo as a sovereign EVM chain. Polygon Amoy is retained as legacy validation evidence, not the intended production network.

## 4. What Has Been Built by Layer

### 4.1 Monorepo Structure

Main applications:

- `apps/web` - Next.js / React frontend
- `apps/api` - Fastify REST API
- `apps/contracts` - Solidity / Hardhat smart contracts
- `apps/worker` - BullMQ background workers
- `apps/analytics` - Python FastAPI analytics and ML service
- `apps/verifier` - Rust verification service
- `apps/indexer` - Go blockchain/event indexer
- `apps/docs` - Docusaurus documentation site

Shared packages:

- `packages/sdk` - TypeScript SDK
- `packages/database` - Prisma, TimescaleDB, and normalized domain/audit schema
- `packages/queue` - shared queue definitions and Redis/BullMQ helpers
- `packages/monitoring` - metrics and alert helpers
- `packages/network-manifest` - canonical network and deployment source of truth
- `packages/subgraph` - Graph Protocol indexing package
- `packages/types` - shared domain types
- `packages/config/*` - shared TypeScript and ESLint config

There are also static website/package outputs under `latest-version` and `new-version`, including Hostinger-ready HTML bundles and assets.

### 4.2 Smart Contracts

The contract layer is one of the strongest parts of the repo.

There are 25 implementation/library Solidity contracts, excluding interfaces and mocks:

- `CarbonCredit`
- `VerificationEngine`
- `CarbonMarketplace`
- `CarbonRetirement`
- `RetirementCertificate`
- `CarbonBatchAuction`
- `NativeIoTOracle`
- `ChainlinkVerifier`
- `TerraQuraAccessControl`
- `TerraQuraMultisig`
- `TerraQuraMultisigMainnet`
- `TerraQuraTimelock`
- `TerraQuraTimelockMainnet`
- `ComplianceRegistry`
- `ITMORegistry`
- `GaslessMarketplace`
- `TerraQuraForwarder`
- `CircuitBreaker`
- `CarbonAMM`
- `CarbonFutures`
- `CarbonVault`
- `FractionalCredit`
- `InsurancePool`
- `RewardDistributor`
- `EfficiencyCalculator`

Implemented contract themes:

- ERC-1155 tokenized carbon credits
- verification and source-data hash controls
- marketplace listing and purchase flows
- carbon retirement and certificates
- batch auctions
- gasless/meta-transaction support
- access control, multisig, timelock, and circuit breaker governance
- compliance registries and ITMO concepts
- DeFi/secondary market primitives such as AMM, vaults, futures, fractional credits
- insurance and reward distribution
- oracle and Chainlink verification integration

Test and security evidence:

- 44 contract test files are present.
- The checked-in security simulation matrix records 68 passing local exploit/fault-injection tests on 2026-06-26.
- The repo includes contract audit packet materials, flattened contracts, gas optimization docs, and security review docs.

Caution:

- Local test coverage and exploit simulations are useful evidence, but they do not replace a formal external audit.

### 4.3 Deployment and Network State

This area has improved since the older June 23 report.

The repo now has a canonical network/deployment control point:

- `packages/network-manifest`
- `packages/network-manifest/manifest.json`
- `docs/platform/NETWORK_DEPLOYMENT_MANIFEST.md`

Current network posture:

- Aethelred mainnet is the primary production target.
- Aethelred testnet is the primary pre-production target.
- Polygon Amoy is explicitly marked as legacy validation evidence.

Current deployment evidence:

- Aethelred mainnet deployment: pending in the manifest
- Aethelred testnet deployment: pending in the manifest
- Polygon Amoy V3 final deployment: validated testnet evidence, dated 2026-02-02

The Polygon Amoy deployment includes checked-in addresses for access control, verification engine, carbon credit, marketplace, gasless marketplace, multisig, timelock, and circuit breaker.

Consultant interpretation:

- The platform has deployment proof for a prior Polygon Amoy validation stack.
- The codebase has been reoriented to Aethelred-first.
- A fresh Aethelred testnet deployment manifest is still needed before the system can be presented as deployed on Aethelred.

### 4.4 Web App and Product Surface

The web app is a real product surface, not just a placeholder.

Public and marketing surfaces include:

- home
- about
- technology
- buyer
- operator
- investor
- projects
- regulatory
- developers
- explorer
- blog index and blog article pages
- enterprise and supplier solution pages
- privacy, terms, cookies

Dashboard surfaces include:

- `/dashboard`
- `/dashboard/analytics`
- `/dashboard/compliance`
- `/dashboard/credits`
- `/dashboard/governance`
- `/dashboard/marketplace`
- `/dashboard/oracle`
- `/dashboard/retirement`

Notable web implementation details:

- wallet and Web3 stack via RainbowKit, wagmi, viem, and React Query
- contract-read and event-watch hooks for dashboard integration
- centralized contract/network resolution through the network manifest
- SEO metadata, JSON-LD, sitemap, robots, Open Graph image, error pages, loading states, and global error boundaries
- KYC and legal gate components
- sanitized client error reporting path
- deterministic preview/mock data utilities
- dashboard data-mode flag: `NEXT_PUBLIC_TERRAQURA_DASHBOARD_DATA_MODE`
- preview banner that warns viewers when values are deterministic mock data

Consultant-relevant caveat:

- The dashboard is live-data capable in parts, but it is currently set up with a clear preview-data mode. Until Aethelred contract addresses and live APIs are wired through end to end, dashboard screenshots should be described as product preview, not live production metrics.

### 4.5 API Layer

The API layer is meaningful and broad.

Current API route groups:

- Health
- Auth
- DAC Units
- Sensors
- Verification
- Credits
- Marketplace
- KYC
- Gasless
- Webhooks
- Activity
- Analytics
- API Keys

There are approximately 47 endpoint handlers across these route groups.

Implemented API capabilities include:

- JWT/bearer auth
- API key management
- DAC unit registration and lookup
- sensor data ingestion
- verification submission and status
- credit listing and retirement flows
- marketplace listing, purchase, and auction-style flows
- KYC integration hooks
- gasless relayer status and operations
- signed webhook delivery tests and delivery accounting
- activity feeds and analytics endpoints
- Swagger/OpenAPI docs
- CORS, helmet, and rate limiting

Important backend architecture note:

- The API still uses a Postgres JSONB `api_state_store` as a compatibility/orchestration layer.
- That state store now uses row locks and writes typed `domain_events` in the same transaction.
- This is a meaningful step toward audit-grade workflows, but it is still not the same as fully normalized production domain persistence for every workflow.

### 4.6 Data and Compliance Backbone

The database package now includes a first-class domain/audit backbone.

The normalized domain schema includes:

- tenants
- tenant memberships
- DAC facilities
- DAC units
- verification batches
- carbon instruments
- market orders
- retirement records
- domain events

The compliance/audit export layer includes:

- data classification rules
- retention policy
- pseudonymization/minimization expectations
- canonical audit lineage helper:
  - `getCarbonRemovalAuditLineage`
  - `buildCarbonRemovalAuditLineageQuery`
- default hashing of domain event payloads unless an approved audit scope requests full payloads

This is strategically important because it gives TerraQura a path to answer regulator and institutional buyer questions about lineage from facility and DAC unit through verification, issuance, trade, and retirement.

### 4.7 Worker and Async Processing

The worker service uses BullMQ and shared queue packages.

Implemented processors:

- minting
- verification
- KYC

Notable details:

- queue-specific concurrency and rate limiting
- Redis/BullMQ integration
- graceful shutdown
- structured Pino logging with redaction
- production verification jobs require evidence such as source validation, telemetry aggregate, duplicate-mint checks, KYC, and sanctions evidence
- local drill modes are explicitly opt-in

This indicates the platform is designed as an event-driven system rather than a single synchronous app.

### 4.8 Analytics and ML Service

The Python analytics service is a real subsystem.

It uses:

- FastAPI
- NumPy
- pandas
- scikit-learn
- Pydantic settings

Implemented or documented capabilities:

- carbon price prediction
- sensor anomaly detection
- environmental impact calculations
- protocol statistics
- leaderboard/statistical endpoints
- credit risk assessment
- Value-at-Risk style calculations

Recent enterprise-readiness work also points this service toward:

- chain/network resolution through the portable manifest
- fail-closed behavior for live marketplace/indexer data
- explicit opt-in for synthetic analytics data

### 4.9 Rust Verifier

The Rust verifier service includes modules for:

- cryptography
- Merkle logic
- provenance
- sensor processing
- verification
- API handlers
- typed runtime/config errors

It is built with Axum/Tokio and has tests around crypto, Merkle, provenance, sensor, and verification logic.

Strategic value:

- TerraQura is not relying only on Solidity and Node.js for verification.
- It has a dedicated verification service boundary that can be hardened and scaled separately.

### 4.10 Go Indexer and Subgraph

The Go indexer includes:

- go-ethereum integration
- Gin HTTP server
- Postgres event store support
- chain ID and manifest validation
- health output with network/deployment identity
- live indexing controls and contract filter checks

The Graph subgraph package includes:

- event handlers for carbon credit, marketplace, and verification engine flows
- schema/tests
- manifest validation tooling

Together, these give TerraQura two indexing/query paths: a custom indexer and a Graph subgraph.

### 4.11 SDK and Integration Layer

The TypeScript SDK is broad and platform-oriented.

Current module families include:

- assets
- market
- offset
- MRV
- connect
- checkout
- badge
- compliance
- risk
- insurance
- claims
- sovereign

Recent hardening includes:

- network manifest integration
- risk oracle address requirements
- durable checkout session backend abstraction
- webhook dispatch improvements
- crypto-backed retry jitter and identifiers
- tests across most modules

This is a strong signal that TerraQura is being shaped as an integration platform, not just an app.

### 4.12 Monitoring, Operations, and Infrastructure

Production-oriented infrastructure and operations assets are present.

Infrastructure:

- Terraform for AWS Middle East/Bahrain
- VPC, public/private subnets, EKS, RDS PostgreSQL, Redis, ALB/WAF, CloudWatch, S3, and Secrets Manager
- data residency and ADGM-oriented comments/configuration

Monitoring:

- Prometheus scrape configuration
- alerting rules
- Alertmanager routing
- PagerDuty and Slack receiver structure using file-mounted secrets
- API, worker, Postgres, Redis, Graph node, RPC, IPFS, Kubernetes, blackbox, and contract-event monitoring targets

Operations documentation:

- service ownership map
- SLOs
- alert runbooks
- disaster recovery
- enterprise readiness envelope
- golden workflows
- dynamic exploit simulation matrix

Important caveat:

- Terraform and monitoring config prove production architecture planning. They do not, by themselves, prove that a live production environment is deployed and healthy today.

### 4.10 Consultant Hardening and Production Launch Controls

New hardening artifacts added during this pass:

- `docs/platform/CONSULTANT_HARDENING_REGISTER.md` - maps the consultant checklist to enforced, evidence-required, process-required, and roadmap-contained controls
- `docs/platform/GOLDEN_WORKFLOW_STATE_MACHINE.md` - defines the launch-critical workflow state machine, actors, approval boundaries, data handoffs, domain events, and replay-safety rules
- `docs/platform/DASHBOARD_DATA_PROVENANCE_INVENTORY.md` - classifies launch-critical product and dashboard surfaces as Live, Preview, or Mixed
- `docs/platform/PRODUCTION_EVIDENCE_PACK.md` - defines the production evidence pack required before institutional launch
- `scripts/production-launch-gate.mjs` - blocks production launch unless the release candidate is clean, live-backed, deployed to a primary-target network, backed by nonzero launch-critical contract addresses, and supported by an approved evidence pack
- `scripts/create-production-evidence-pack.mjs` - generates a consistent non-approved evidence-pack scaffold
- `scripts/production-launch-gate.test.mjs` - regression tests for artifact validation, scaffold rejection, and finalized evidence content checks

The production launch gate intentionally fails today because Aethelred deployment manifests are still pending, the current worktree is not frozen, the default evidence pack is not approved, and archive/static outputs require explicit release-policy acknowledgement. That failure is useful: it prevents a preview or partially assembled release from being represented as production-ready.

## 5. Test and Evidence Inventory

Excluding the `.claude` worktree copy, the current repo contains 109 conventional test files plus a network-manifest runtime guard script.

Breakdown:

- contracts: 44 test files
- API: 17 test files, including full-flow integration coverage
- web: 7 test files
- worker: 4 test files
- analytics: 7 test files
- Go indexer: 7 test files
- Rust verifier: 5 test files
- SDK: 14 test files
- subgraph: 3 test files
- database domain/audit export: 1 test file
- network manifest runtime guard script: 1 script

The repo also contains:

- security simulation documentation recording 68 passing exploit/fault-injection tests on 2026-06-26
- top-level scripts for `test:all`, `validate:network`, `validate:enterprise`, `validate:production-artifacts`, `validate:production-launch`, `test:production-launch-gate`, and `evidence:production-template`
- enterprise readiness checks that tie together network validation, subgraph validation, API golden flow, database audit export, contract security simulation, production launch-gate regression tests, production artifact validation, and operational docs checks

Validation rerun during this hardening pass:

- `corepack pnpm@9.0.0 validate:enterprise` passed
- `corepack pnpm@9.0.0 test:production-launch-gate` passed with 3 tests
- `node scripts/production-launch-gate.mjs --artifacts-only` passed
- an intentionally generated `Decision: NO-GO` evidence scaffold was rejected by the full production gate, as expected

Caution:

- These validation results prove the local enterprise gates in the current workspace. They do not prove that a live Aethelred production environment is deployed and healthy.

## 6. Strongest Assets Right Now

The strongest assets are:

1. Smart-contract depth and breadth
2. Canonical network manifest and explicit Aethelred-first posture
3. Full-stack service architecture rather than a one-app prototype
4. Audit lineage and domain event backbone
5. Enterprise operations documentation with owners, SLOs, runbooks, and readiness gates
6. Multi-language verification/indexing architecture
7. Broad SDK and integration strategy
8. Product surface for buyers, operators, investors, developers, regulators, and dashboard users

## 7. Main Gaps and Risks

### 7.1 Aethelred Deployment Is Still Pending

The canonical manifest marks Aethelred mainnet and testnet deployments as pending. Polygon Amoy has validated addresses, but is explicitly legacy validation evidence.

Decision needed:

- complete an Aethelred testnet deployment
- check in the deployment manifest
- make it the canonical demo/pre-production target

### 7.2 Current Workspace Is Not a Clean Release

The current branch has 193 modified tracked files, 4 deleted tracked files, and 68 untracked paths. That is normal during active buildout, but it is risky for external review unless frozen into a clean snapshot.

Decision needed:

- create a release branch/tag or consultant-review branch after tests pass
- separate source code from generated/static/archive outputs where appropriate

### 7.3 Dashboard Is Partly Preview-Backed

The app is honest about this through a preview banner and data-mode flag, which is good. But the consultant should not mistake all dashboard metrics for live chain/API metrics yet.

Decision needed:

- define exactly which dashboard cards are live, mocked, or mixed
- connect the golden workflow screens to real deployed Aethelred contracts and API/domain data

### 7.4 Backend Persistence Is Mid-Migration

The API compatibility state store is practical and now auditable through domain events, but key golden workflows should increasingly write into normalized domain tables.

Decision needed:

- choose the first normalized workflow to harden end to end:
  - operator MRV to verified removal
  - verified removal to mint/trade/retire
  - sovereign/compliance audit export

### 7.5 External Audit and Live Pilot Evidence Are Still Needed

The repo contains strong local security/test signals, but institutional customers will still expect external validation.

Decision needed:

- schedule external smart-contract/security audit
- create a pilot evidence pack with deployment manifest, test results, audit scope, sample lineage export, and incident/runbook posture

### 7.6 Production Environment Health Is Not Proven by Repo Alone

Infrastructure-as-code and monitoring config are present. This report does not prove the production cluster, database, RPC, relayer, KYC provider, or monitoring stack are live and passing health checks.

Decision needed:

- run a deployment readiness drill
- capture health/readiness output from API, verifier, indexer, analytics, workers, database, Redis, and contract/RPC integrations

## 8. Recommended Consultant Discussion Questions

1. Should TerraQura narrow its first market launch around the 2-3 golden workflows instead of presenting the full advanced feature set?
2. Should Polygon Amoy be described only as historical validation, or should TerraQura keep a multi-chain story?
3. What is the right sequence for Aethelred deployment, external audit, pilot operator onboarding, and buyer demo?
4. Which modules should be treated as launch-critical versus roadmap: DeFi, insurance, futures, auctions, sovereign reporting, gasless UX?
5. Which API workflows should be moved first from compatibility JSONB state into normalized domain tables?
6. What evidence will an institutional buyer, DAC operator, regulator, or investor require before trusting the platform?
7. What should be the minimum launch package: deployed contracts, audit, dashboard live mode, operator pilot, retirement certificate demo, or compliance export?

## 9. Recommended Next Steps

### Next 7 Days

1. Freeze a consultant-review snapshot.
2. Run and record `pnpm validate:enterprise`.
3. Generate the initial evidence-pack scaffold with `pnpm evidence:production-template`.
4. Fill the evidence pack with command output, health checks, audit lineage, sign-offs, and open exceptions.
5. Produce a signed live-vs-preview dashboard inventory using `docs/platform/DASHBOARD_DATA_PROVENANCE_INVENTORY.md`.
6. Confirm which static website bundle, if any, is intended for public use and exclude non-production archive outputs from the release manifest.

### Next 30 Days

1. Complete Aethelred testnet deployment and check in the canonical deployment manifest.
2. Wire the golden dashboard/API flow to the deployed Aethelred testnet contracts.
3. Move the first golden workflow into the normalized domain schema end to end.
4. Prepare an external audit package for the contract and relayer/verifier surfaces.
5. Run a controlled pilot scenario from DAC telemetry to verification, mint, marketplace transfer, retirement, and audit export.
6. Capture a production-readiness evidence pack: test output, deployment manifest, health checks, runbook links, SLO ownership, and sample audit lineage export.
7. Run `pnpm validate:production-launch` and resolve every blocker without emergency bypasses before presenting TerraQura as production-ready.

## 10. Bottom Line

TerraQura has already built a serious amount of real software.

The strongest signal is the breadth and coherence of the architecture: contracts, web, API, workers, analytics, verifier, indexer, subgraph, SDK, database, monitoring, compliance, and infrastructure all exist in the repository.

The right next move is not to add more surface area. The right next move is to prove a narrow set of golden workflows on Aethelred with live data, audited contracts, clean deployment manifests, normalized audit lineage, and a stable review snapshot.

The new production launch gate gives the consultant a practical decision line:
TerraQura should not be called production-ready until `pnpm validate:production-launch`
passes against a clean release candidate and an approved evidence pack.
