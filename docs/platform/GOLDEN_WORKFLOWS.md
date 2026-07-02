# TerraQura Golden Workflows

The platform has many modules, but enterprise hardening should focus first on
the workflows that make TerraQura unmistakably useful.

The launch-critical state machine for the first institutional workflow lives in
`docs/platform/GOLDEN_WORKFLOW_STATE_MACHINE.md`. That document is authoritative
for actors, approval boundaries, data handoffs, domain events, and replay safety.

## Workflow 1: Operator MRV to Verified Removal

Primary user:

- DAC operator

Outcome:

- telemetry-backed verified carbon removal batch ready for minting

State path:

1. Tenant and operator membership created
2. Facility registered
3. DAC unit created and whitelisted
4. Sensor readings ingested into TimescaleDB
5. Verification batch opened with source-validation evidence
6. Worker evaluates source completeness, signature/timestamp evidence, telemetry
   aggregate evidence, duplicate-mint evidence, and operator KYC/sanctions evidence
7. Rust verifier evaluates proof, quality, and efficiency
8. Verification batch marked `verified` or `rejected`
9. Domain event emitted for each state transition

Worker evidence contract:

- `sourceValidation`: registered/active sensors, expected and received points,
  signature status, timestamp sequence status, and gap detection status
- `telemetrySnapshot`: total CO2 captured, total energy, point count, anomaly
  count, and quality score for the capture window
- `mintValidation`: duplicate/overlap status plus operator KYC and sanctions
  evidence

Production workers fail fast if this evidence is absent. Local drills may set
`VERIFICATION_ALLOW_DERIVED_SNAPSHOT=true`, but that mode must not be used as
enterprise proof.

First-class tables:

- `domain_tenants`
- `domain_tenant_memberships`
- `domain_dac_facilities`
- `domain_dac_units`
- `domain_verification_batches`
- `domain_events`

## Workflow 2: Verified Removal to Mint, Trade, and Retire

Primary user:

- enterprise buyer

Outcome:

- retired carbon credit with audit trail and certificate reference

State path:

1. Verified batch approved for mint
2. Carbon instrument created
3. Mint transaction submitted and indexed
4. Instrument listed or transferred
5. Buyer purchases or receives the instrument
6. Buyer retires some or all of the quantity
7. Retirement record and certificate reference stored
8. Domain event emitted for mint, transfer, listing, settlement, and retirement

Implemented API event spine:

- `carbon_credit.minted`
- `market_listing.created`
- `market_purchase.settled`
- `carbon_credit.partially_retired`
- `carbon_credit.retired`

These are emitted inside the same Postgres transaction as the compatibility
state mutation, followed by an `api_state_store.mutated` fingerprint event so
the JSONB bridge remains auditable while normalized tables are adopted.

The API full-flow integration test now captures this event spine end to end and
asserts that mint, listing creation, purchase settlement, and retirement events
link through the same credit, token, listing, chain, and transaction references.

First-class tables:

- `domain_verification_batches`
- `domain_carbon_instruments`
- `domain_market_orders`
- `domain_retirement_records`
- `domain_events`

## Workflow 3: Sovereign and Compliance Reporting

Primary user:

- regulator, sovereign entity, or institutional auditor

Outcome:

- jurisdiction-aware audit report showing removal, issuance, transfer, and retirement lineage

State path:

1. Tenant and jurisdiction identified
2. Facility and unit provenance resolved
3. Verification batches summarized by reporting period
4. Instruments and retirement records reconciled with on-chain data
5. Compliance export generated with event lineage

First-class tables:

- `domain_tenants`
- `domain_dac_facilities`
- `domain_dac_units`
- `domain_verification_batches`
- `domain_carbon_instruments`
- `domain_retirement_records`
- `domain_events`

## Implementation Rule

New features should be classified as:

- `golden-path`: must use the domain backbone and carry tests
- `platform-extension`: may use orchestration while the workflow is being shaped
- `roadmap-module`: documented but not presented as production-grade

DeFi, insurance, futures, and advanced sovereign modules should remain roadmap or
platform-extension features until the first two golden workflows are end-to-end
stable.
