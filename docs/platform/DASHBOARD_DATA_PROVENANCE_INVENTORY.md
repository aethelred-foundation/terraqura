# TerraQura Dashboard Data Provenance Inventory

This inventory classifies product and dashboard surfaces as Live, Preview, or
Mixed for release review.

Classification:

- `Live`: data is sourced from selected deployment contracts, API, database,
  indexer, analytics service, or verified runtime config.
- `Preview`: data is deterministic mock, seeded sample, static marketing copy,
  or local-only demonstration data.
- `Mixed`: the surface contains both live-capable wiring and preview-backed
  panels, cards, feeds, or charts.

Production rule:

No critical buyer, operator, sovereign, minting, retirement, or compliance view may depend on preview data in production.

## Runtime Control

Dashboard mode is controlled by:

- `NEXT_PUBLIC_TERRAQURA_DASHBOARD_DATA_MODE=preview`
- `NEXT_PUBLIC_TERRAQURA_DASHBOARD_DATA_MODE=live`

Preview mode:

- may render deterministic mock data
- must show the dashboard preview banner
- must not be presented as live operational evidence

Live mode:

- must disable synthetic activity-feed injection
- must use selected network/deployment identity from `packages/network-manifest`
- must not satisfy production evidence-pack requirements from preview values

The production launch gate requires live mode.

## Surface Inventory

| Surface | Current Class | Launch Critical | Required Live Source | Release Action |
| --- | --- | --- | --- | --- |
| Home page | Preview | No | CMS or approved static marketing content | Keep outside production evidence claims |
| About page | Preview | No | Approved static company content | Keep outside operational evidence |
| Buyer page | Mixed | Yes | API marketplace, verified credit inventory, retirement records | Replace buyer metrics and retirement claims with live API/domain data |
| Operator page | Mixed | Yes | DAC facilities, units, telemetry status, verification batches | Replace operator metrics with domain and Timescale-backed data |
| Investor page | Preview | No | Approved investor data room content | Do not use as operational proof |
| Projects page | Preview | No | Approved project registry or CMS | Label or remove operational-looking mock project metrics |
| Technology page | Preview | No | Approved static architecture content | Keep as explanatory material |
| Regulatory page | Mixed | Yes | Audit lineage export and compliance registry status | Replace compliance metrics with live audit/export status |
| Developers page | Mixed | No | API docs, SDK version, manifest metadata | Make version/deployment identity live-backed |
| Explorer page | Mixed | Yes | Indexer/subgraph/API chain events | Replace preview event rows before external deployment |
| `/dashboard` overview | Mixed | Yes | API health, chain status, contract reads, domain aggregates | Remove seeded executive metrics before production |
| `/dashboard/credits` | Mixed | Yes | CarbonCredit contract reads, domain carbon instruments, retirements | Remove seeded portfolio/provenance rows before production |
| `/dashboard/marketplace` | Mixed | Yes | Marketplace contract/API/domain market orders | Remove seeded order books and fake fills before production |
| `/dashboard/oracle` | Mixed | Yes | NativeIoTOracle, Timescale telemetry, device registry | Remove seeded device fleet and anomaly lab values before production |
| `/dashboard/analytics` | Mixed | Yes | Analytics service in live mode, domain/indexer inputs | Ensure analytics fails closed when live data unavailable |
| `/dashboard/compliance` | Mixed | Yes | Audit lineage, compliance registry, KYC status summaries | Replace preview compliance packs with export-backed records |
| `/dashboard/governance` | Mixed | Yes | Multisig/timelock/circuit breaker contract reads | Remove seeded governance proposals unless explicitly marked preview |
| `/dashboard/retirement` | Mixed | Yes | Retirement records, certificate references, retirement transaction receipts | Remove seeded retirement certificates before production |
| Realtime activity feed | Mixed | Yes | Contract event watchers, API/indexer events | Preview injection only when `preview`; live mode must stay clean |
| Demo banner | Live | Yes | `NEXT_PUBLIC_TERRAQURA_DASHBOARD_DATA_MODE` | Keep permanently |
| Web error reporting | Live | Yes | `NEXT_PUBLIC_ERROR_REPORTING_URL` | Production endpoint must be HTTPS |
| KYC/Sumsub widget | Live-capable | Yes | KYC provider config and API/worker status | Evidence must show provider mode and fail-closed behavior |

## Critical Path Replacement Rules

Buyer views:

- must use live verified credit inventory
- must show selected chain/deployment identity
- must show retirement transaction and certificate references from domain/chain data

Operator views:

- must use live facility/unit registry
- must use live or approved pilot telemetry
- must show verification batch status from normalized domain state

Sovereign/regulatory views:

- must use audit lineage helper outputs
- must hash event payloads by default
- must show jurisdiction and export scope

Minting views:

- must require verified batch state
- must show selected deployment and nonzero contract addresses
- must never mint from preview telemetry

Retirement views:

- must require live ownership/quantity evidence
- must write retirement records and transaction references
- must expose audit lineage after retirement

Compliance views:

- must use live KYC/compliance status summaries
- must not expose raw KYC provider response bodies
- must show export scope and payload inclusion policy

## Evidence-Pack Expectations

The production evidence pack must include:

- screenshot or artifact proving live dashboard mode
- selected network key and deployment key
- list of launch-critical surfaces reviewed
- signed live-vs-preview inventory
- explanation for any remaining preview surface and why it is outside the
  launch-critical workflow
