# TerraQura Consultant Status Report

Prepared on: 2026-06-23

Prepared from: repository inspection of the current TerraQura workspace

Purpose: give an external consultant a precise view of what TerraQura has actually built as of now, where the strongest implementation depth exists, and which areas still need architectural or execution refinement.

## 1. Report Basis and Scope

This report is based on direct inspection of the current repository contents, structure, configuration, documentation, and checked-in deployment artifacts.

Important context:

- This is a codebase and configuration review, not a full live-environment audit.
- I did not re-run the full platform test matrix or perform a fresh end-to-end deployment in this reporting pass.
- The repository is currently in an active development state, especially in the `apps/web` layer, with many uncommitted UI/content changes in progress.
- Where repository claims and checked-in artifacts differ, this report calls that out explicitly instead of assuming the marketing/documentation version is correct.

## 2. Executive Summary

TerraQura is already much more than a concept, pitch deck, or isolated smart-contract prototype. As of now, it is a substantial multi-layer carbon asset platform with:

- a full monorepo spanning smart contracts, web app, API, workers, analytics, verifier, indexer, subgraph, shared SDK, database, queueing, monitoring, and docs
- 25 Solidity implementation/library contracts covering the carbon-credit lifecycle and supporting infrastructure
- a public-facing web experience plus an 8-page dashboard surface
- a Fastify API with 13 documented route groups
- background workers for minting, verification, and KYC
- a Python analytics/ML service
- a Rust verification service
- a Go blockchain indexer
- a Graph subgraph package
- production-oriented infrastructure, monitoring, and alerting configuration

The platform appears to be in the "advanced pre-production buildout" stage.

My plain-language assessment:

- Smart-contract depth: strong
- Product/feature breadth: strong
- Backend workflow implementation: meaningful, but not fully hardened
- Deployment/configuration coherence: mixed
- Production readiness: promising, but not yet clean enough to describe as fully operational without caveats

The single biggest takeaway for a consultant is this: TerraQura has real engineering substance, but it also has some environment and integration inconsistencies that should be resolved before presenting the stack as fully consolidated or production-ready.

## 3. What TerraQura Is Intended to Be

The repository consistently positions TerraQura as an institutional-grade carbon-credit platform built around direct air capture and proof-of-physics verification. The intended operating model is:

1. ingest DAC telemetry and sensor data
2. verify carbon removal performance and provenance
3. mint tokenized carbon credits on-chain
4. enable trading, transfer, and retirement
5. provide compliance, auditability, and sovereign reporting
6. support enterprise procurement, operator tooling, and policy/regulatory workflows

The target chain throughout the product narrative is Aethelred, described as a sovereign EVM chain optimized for verifiable AI computation and first-party oracle integrations.

## 4. Current Repository Footprint

### 4.1 Applications Present

The repo currently contains these top-level applications:

- `apps/web` - Next.js 16 / React 19 frontend
- `apps/api` - Fastify API server
- `apps/contracts` - Solidity / Hardhat smart contracts
- `apps/worker` - BullMQ background workers
- `apps/analytics` - Python FastAPI analytics and ML service
- `apps/verifier` - Rust verification service
- `apps/indexer` - Go blockchain/event indexer
- `apps/docs` - Docusaurus documentation site

### 4.2 Shared Packages Present

The repo currently contains these reusable/shared packages:

- `packages/database` - Prisma + TimescaleDB integration
- `packages/sdk` - TypeScript SDK
- `packages/queue` - shared BullMQ queue definitions and Redis connection helpers
- `packages/monitoring` - metrics/alerts/observability helpers
- `packages/subgraph` - Graph protocol indexing package
- `packages/types` - shared domain types
- `packages/config/*` - shared ESLint and TypeScript configuration

## 5. What Has Been Built by Layer

### 5.1 Smart Contracts

This is the most mature and most substantial layer in the codebase.

There are 25 implementation/library Solidity contracts checked in, excluding interfaces and mocks.

Core lifecycle contracts:

- `CarbonCredit`
- `VerificationEngine`
- `CarbonMarketplace`
- `CarbonRetirement`
- `RetirementCertificate`
- `CarbonBatchAuction`

Oracle and data-verification contracts:

- `NativeIoTOracle`
- `ChainlinkVerifier`

Governance and access-control contracts:

- `TerraQuraAccessControl`
- `TerraQuraMultisig`
- `TerraQuraMultisigMainnet`
- `TerraQuraTimelock`
- `TerraQuraTimelockMainnet`

Compliance and policy contracts:

- `ComplianceRegistry`
- `ITMORegistry`

Gasless and transaction UX contracts:

- `GaslessMarketplace`
- `TerraQuraForwarder`

Security and resilience contracts:

- `CircuitBreaker`

DeFi / secondary market / financing contracts:

- `CarbonAMM`
- `CarbonFutures`
- `CarbonVault`
- `FractionalCredit`

Insurance and rewards contracts:

- `InsurancePool`
- `RewardDistributor`

Shared library:

- `EfficiencyCalculator`

What this means:

- TerraQura is not only modeling issuance and retirement.
- It has already expanded into auctions, gasless flows, governance, compliance registries, DeFi primitives, rewards, and insurance.
- That is unusually broad scope for a carbon platform at this stage.

### 5.2 Smart-Contract Governance and Safety Model

The contract layer includes meaningful operational controls:

- UUPS upgradeability
- dedicated access control contract
- multisig governance
- timelock governance
- circuit breaker / pause mechanics
- compliance and KYC-linked registry concepts
- gasless forwarding pattern

This indicates the engineering effort has gone beyond feature implementation into governance and operational safety design.

### 5.3 Frontend / Product Surface

The frontend is a real product surface, not only a placeholder dashboard.

Public-facing pages currently present include:

- home
- about/company
- blog index and blog detail pages
- buyer
- operator
- investor
- projects
- technology
- developers
- explorer
- regulatory
- solutions/enterprise
- solutions/suppliers
- privacy
- terms
- cookies

Dashboard surface currently present:

- `/dashboard`
- `/dashboard/analytics`
- `/dashboard/compliance`
- `/dashboard/credits`
- `/dashboard/governance`
- `/dashboard/marketplace`
- `/dashboard/oracle`
- `/dashboard/retirement`

This gives TerraQura:

- a marketing and positioning layer
- audience-specific pages for buyers, operators, and investors
- a developer-facing page
- an explorer-style surface
- a multi-section operating dashboard

Technology stack for the web layer:

- Next.js 16
- React 19
- RainbowKit / wagmi / viem
- Radix UI
- Framer Motion

Important current-state note:

- the web app is under heavy active revision right now
- the current worktree shows 80+ modified/new/deleted frontend files concentrated in `apps/web`
- this suggests the frontend experience is actively being refined and should be described as in motion, not frozen

### 5.4 API Layer

The API layer is meaningful and fairly broad.

The Fastify server currently registers these route groups:

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

The API documentation also references retirement and auction functionality as smart-contract-driven capabilities.

Notable API characteristics:

- bearer auth and API-key auth patterns are present
- Swagger/OpenAPI docs are wired in
- rate limiting is present
- CORS and security middleware are present
- blockchain service integration exists
- a gasless relayer service exists
- graph client integration exists
- KYC service integration exists

Important architecture nuance:

- much of the API route layer persists workflow state through a generic Postgres JSONB-backed `api_state_store` table
- this is more durable than pure in-memory mocks, but it is not the same as a fully modeled transactional backend
- in other words, the API is implemented, but parts of it still resemble an application-state orchestration layer rather than a fully normalized enterprise backend domain model

This is one of the key points a consultant should react to.

### 5.5 Worker / Async Processing Layer

There is a dedicated worker service with BullMQ-based queue processing.

Currently implemented processors:

- minting
- verification
- KYC

The worker layer includes:

- concurrency control
- rate limiting
- graceful shutdown handling
- queue-specific worker configuration
- shared queue package integration

This is a strong sign that TerraQura is designed as an event-driven system rather than a single monolithic app.

### 5.6 Analytics and ML Layer

The Python analytics service is a real subsystem, not a placeholder folder.

It uses:

- FastAPI
- NumPy
- pandas
- scikit-learn

The checked-in analytics documentation and tests indicate support for:

- price prediction
- anomaly detection
- impact calculations
- protocol stats
- leaderboard/stats
- risk assessment
- value-at-risk style outputs

This suggests TerraQura is trying to extend beyond marketplace plumbing into financial and operational intelligence.

### 5.7 Rust Verifier

The Rust verifier service contains modules for:

- cryptography
- Merkle logic
- provenance
- sensor processing
- verification
- API handlers and typed errors

This is notable because it indicates TerraQura is not relying only on Solidity or Node.js for verification logic; it has a dedicated high-performance verification component.

### 5.8 Go Indexer

There is a dedicated Go indexer package with:

- Ethereum/go-ethereum integration
- HTTP server framework usage
- structured logging
- test coverage across internal modules

This points to a serious attempt to handle blockchain event ingestion/indexing as its own service boundary.

### 5.9 The Graph Subgraph

The repo includes a Graph subgraph package with:

- indexed handlers for carbon credit, marketplace, and verification engine events
- Graph build/test wrappers
- deterministic runtime hardening
- subgraph schema and tests

This gives TerraQura another indexing/query pathway in addition to the Go indexer.

### 5.10 Shared SDK

The TypeScript SDK is broad and professionally structured.

Exposed module families include:

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

This is important strategically because it means TerraQura is being shaped not only as an application, but also as a platform that third parties could integrate into.

### 5.11 Data Layer

The database package combines:

- Prisma client support
- TimescaleDB support for time-series sensor data

The Timescale schema includes:

- `sensor_readings`
- hourly materialized views
- daily materialized views
- `verification_snapshots`
- `efficiency_metrics`

This aligns well with the DAC / telemetry / verification use case and is a sign that the data layer has been thought through for time-series workloads.

### 5.12 Monitoring and Infrastructure

The repo includes meaningful operational infrastructure assets:

- Terraform for AWS deployment
- Prometheus scrape config
- alerting rules

The Terraform configuration describes a production architecture with:

- AWS Bahrain region
- VPC
- EKS
- RDS PostgreSQL with TimescaleDB
- Redis
- ALB / WAF
- CloudWatch
- S3
- Secrets Manager

The monitoring config covers:

- API metrics
- worker metrics
- Postgres / Redis
- graph node
- endpoint health checks
- contract event monitoring
- security/operations alert rules

This suggests TerraQura has at least designed for serious production operations, even if the repo alone cannot prove the full environment is currently deployed and running.

## 6. Evidence of Engineering Depth

Several signals suggest this is a serious engineering effort:

- 25 implementation/library Solidity contracts
- 44 smart-contract test files
- 10 API test files
- 13 SDK test files
- 3 worker test files
- 5 analytics test modules
- 5 Rust verifier test modules
- 6 Go test files in the indexer
- 3 subgraph test files

Additional maturity evidence:

- the checked-in deployment manifest `polygonAmoy-v3-final.json` records 562 contract tests and published coverage figures of 100% statements, 82.36% branches, 96.25% functions, and 100% lines
- repository documentation claims 881+ tests across all layers
- there is an audit packet/docs generation path in the contracts app
- there are gas optimization review docs and disaster recovery docs

Important caution:

- I did not independently rerun these full suites in this pass
- the evidence above comes from the repository, test inventory, and checked-in artifacts

## 7. Deployment and Environment Status

This is where the story becomes more nuanced.

### 7.1 What the Repo Narrative Says

The product narrative, docs, contract config, API service descriptions, and web wallet configuration all describe Aethelred as the intended core network.

Examples of that narrative:

- Aethelred mainnet/testnet RPC and explorer settings are present
- the contracts app is configured for Aethelred deployment and verification
- the API blockchain service describes the contracts as Aethelred Testnet contracts
- the web app defines Aethelred mainnet and testnet chains

### 7.2 What the Checked-In Deployment Artifacts Prove

The concrete deployment manifests currently checked into the repo are for Polygon Amoy, dated `2026-02-02`.

Confirmed manifest files:

- `polygonAmoy-v1-initial.json`
- `polygonAmoy-v2.json`
- `polygonAmoy-v3-final.json`
- `polygonAmoy-complete.json`
- `polygonAmoy.json`

The `polygonAmoy-v3-final.json` manifest records deployed proxy addresses for:

- AccessControl
- VerificationEngine
- CarbonCredit
- CarbonMarketplace
- CircuitBreaker
- GaslessMarketplace
- Multisig
- Timelock

### 7.3 Consultant-Relevant Interpretation

The most likely interpretation is:

- TerraQura originally validated or deployed a working contract stack on Polygon Amoy
- the strategic platform narrative has since shifted toward Aethelred
- the codebase has been partially reoriented toward Aethelred, but the deployment/configuration/documentation story is not yet fully normalized

That is not fatal, but it does need to be acknowledged honestly.

## 8. Key Inconsistencies and Risks to Surface Honestly

This section is important if the consultant is expected to give useful architectural or go-to-market feedback.

### 8.1 Network / Chain Identity Is Not Fully Clean Yet

The repo contains mixed signals across Aethelred and Polygon Amoy.

Examples:

- deployment manifests in source control are Polygon Amoy
- API contract service labels those same addresses as Aethelred Testnet addresses
- monitoring configuration still includes Polygon-oriented RPC naming

This suggests the network migration or network-story cleanup is incomplete.

### 8.2 Frontend Testnet Chain ID Defaults Do Not Match Contract/API References

There is a direct inconsistency between layers:

- contracts and API reference Aethelred Testnet chain ID `78432`
- the frontend wagmi config defaults `NEXT_PUBLIC_AETHELRED_TESTNET_CHAIN_ID` to `123457`

This is a real integration risk and should be corrected before external technical review or public rollout.

### 8.3 API Domain Persistence Is Practical but Not Fully Mature

The API is not fake, but its persistence model is still transitional in places.

Observed pattern:

- many route modules read and mutate large JSON payloads in a generic `api_state_store` table
- this is workable for rapid iteration and demo-grade persistence
- however, it is not yet the same as a hardened domain model with clear relational boundaries, eventing guarantees, and analytics-friendly schema design

For consultant review, this should be framed as:

- implemented and functional
- probably suitable for controlled pre-production/demo usage
- likely needing a second pass for long-term scalability and operational clarity

### 8.4 Frontend Is Actively In Flux

The current branch has major ongoing edits concentrated in the web app.

Implication:

- frontend polish, copy, SEO assets, and some user journeys should be treated as currently under revision
- a consultant should not assume the present UI branch is the final product expression

### 8.5 Some Documentation Is Ahead of Some Concrete Proof Points

Examples:

- docs confidently present Aethelred deployment narratives
- contract docs still contain placeholders like `TBD` in some address sections
- deployment proof is stronger for Polygon Amoy than for checked-in Aethelred manifests

This does not mean the platform is weak. It means the reporting layer has not fully caught up with the implementation and migration history.

## 9. Overall Maturity Assessment

My honest assessment is that TerraQura should currently be described as:

"A technically ambitious, unusually broad, advanced pre-production carbon-credit platform with strong smart-contract depth, real multi-service architecture, and clear institutional/compliance intent, but with some unresolved network/configuration coherence and backend-hardening work still ahead."

If I had to rate maturity by layer:

| Area | Assessment |
| --- | --- |
| Smart contracts | Strong |
| Product breadth | Strong |
| Frontend breadth | Strong, but actively changing |
| API breadth | Strong |
| API hardening/model maturity | Medium |
| Analytics / verifier / indexer depth | Strong signal of depth |
| Infrastructure planning | Strong |
| Deployment coherence | Mixed |
| Production readiness as a unified platform | Medium |

## 10. Best Way to Present TerraQura to a Consultant

The most accurate framing is:

- TerraQura has already built a full-stack institutional carbon platform with unusually broad technical scope
- the contract layer is the most mature and best-evidenced part of the stack
- the broader platform architecture is real, not conceptual
- the team is now at the stage where consolidation, hardening, environment cleanup, and productionization matter as much as adding more features

That framing should get better feedback than either of these extremes:

- overstating it as already fully production-ready
- understating it as only an MVP

It is clearly beyond MVP in scope, but not yet fully unified in operational polish.

## 11. Questions a Consultant Should Be Asked to Opine On

To get maximum value from a consultant, I would ask for opinions on these points:

1. Should TerraQura keep the current breadth, or narrow the go-to-market scope around the strongest 2-3 workflows first?
2. How should the team rationalize the network story: Aethelred-first, Polygon validation history, or multi-chain positioning?
3. Which backend workflows should be upgraded first from JSON-state orchestration into more explicit domain persistence?
4. Which of the advanced modules are true near-term product pillars versus roadmap assets: DeFi, insurance, sovereign reporting, auctions, gasless commerce?
5. What is the best productionization sequence across contracts, API, data model, ops, and customer-facing UX?
6. What is missing from an institutional buyer or operator readiness standpoint?
7. Which proofs are most important before enterprise conversations: security review, live pilot metrics, network consistency, operational SLA readiness, or compliance/legal packaging?

## 12. Recommended Internal Next Steps Before External Review

Before sharing TerraQura more broadly, I would recommend:

1. normalize the network/deployment narrative across contracts, API, web, docs, and monitoring
2. resolve the frontend testnet chain ID mismatch
3. decide which deployment artifacts are canonical and publish a single source of truth for contract addresses
4. classify which APIs are production-grade versus state-orchestrated prototypes
5. lock down a current status snapshot for the web app after the active UI pass stabilizes
6. update top-level docs so they match the actual checked-in environment and deployment evidence

## 13. Bottom Line

TerraQura has already built a serious amount of real software.

The strongest positive signal is not one individual feature. It is the fact that the repository contains a coherent attempt at the entire stack:

- issuance
- verification
- telemetry
- trading
- retirement
- compliance
- governance
- gasless UX
- analytics
- indexing
- observability
- platform SDKs

The main weakness is not lack of ambition or lack of implementation. The main weakness is that the current codebase still shows signs of transition between environments, network narratives, and maturity stages.

That is fixable.

The consultant should come away with this view:

TerraQura is a strong technical build with real depth and a lot already done. The next challenge is disciplined consolidation, not proving that nothing exists.

