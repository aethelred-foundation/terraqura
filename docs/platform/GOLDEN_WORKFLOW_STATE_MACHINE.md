# TerraQura Golden Workflow State Machine

Canonical launch workflow:

operator onboarding -> telemetry ingestion -> verification -> minting -> retirement -> audit export

This document is the deployment spine for the first institutional release. Any
feature outside this path is a platform extension or roadmap module until this
workflow is live-backed, monitored, auditable, and security-reviewed.

## State Machine Principles

- Every state transition must have one actor, one authoritative write path, one
  approval boundary, and at least one domain event or immutable chain reference.
- Tenant, facility, DAC unit, verification batch, carbon instrument, retirement
  record, and domain event writes must use normalized `domain_*` tables for
  launch-critical evidence.
- The JSONB compatibility store may mirror or orchestrate non-critical state,
  but it must not be the only audit source for production golden workflow
  decisions.
- Production workers fail closed when source validation, telemetry aggregate,
  duplicate-mint, KYC, sanctions, or manifest evidence is missing.
- Preview data must never satisfy an approval boundary.

## State Transition Table

| Step | From State | To State | Actor | Approval Boundary | Authoritative Data Handoff | Domain Event | Replay Safety |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | none | `tenant.active` | TerraQura ops or enterprise admin | Tenant creation requires approved customer record and jurisdiction | `domain_tenants`, `domain_tenant_memberships` | `tenant.created`, `tenant_member.added` | Unique tenant slug and membership wallet key |
| 2 | `tenant.active` | `facility.active` | Operator admin | Facility must have tenant ownership and approved jurisdiction/data residency | `domain_dac_facilities` | `facility.registered` | Unique facility code |
| 3 | `facility.active` | `dac_unit.whitelisted` | Operator admin plus verifier/admin approval | DAC unit must map to facility, expected sensor inventory, and on-chain unit identity | `domain_dac_units`, contract whitelist transaction | `dac_unit.registered`, `dac_unit.whitelisted` | Unique unit code and on-chain unit id |
| 4 | `dac_unit.whitelisted` | `telemetry.window_open` | Sensor/API key holder | API key or sensor credential must map to tenant/unit | TimescaleDB `sensor_readings` plus source hash | `telemetry.window_opened` | Sensor timestamp ordering and reading idempotency key |
| 5 | `telemetry.window_open` | `verification.submitted` | Operator or automated scheduler | Capture window must have sufficient signed readings and no overlap with prior minted window | `domain_verification_batches` | `verification_batch.submitted` | Unique unit and capture window constraint |
| 6 | `verification.submitted` | `verification.verifying` | Verification worker | Worker must load source validation, telemetry snapshot, duplicate-mint evidence, KYC, and sanctions evidence | Worker evidence payload, verifier request | `verification_batch.verifying` | Queue job idempotency key and row-level lock |
| 7 | `verification.verifying` | `verification.verified` or `verification.rejected` | Rust verifier and verification worker | Proof-of-Physics checks, quality score, efficiency, source hash, and policy checks must pass | `domain_verification_batches` completion fields | `verification_batch.verified` or `verification_batch.rejected` | Processed source hash and completed batch guard |
| 8 | `verification.verified` | `instrument.pending_mint` | API or minting worker | Verified batch must be unminted, KYC/sanctions valid, and deployment manifest chain id must match runtime chain id | `domain_carbon_instruments` | `carbon_instrument.created` | Unique verification batch to instrument mapping |
| 9 | `instrument.pending_mint` | `instrument.minted` | Minting worker / relayer / signer | Mint transaction must target selected manifest deployment and nonzero CarbonCredit address | Contract receipt, `domain_carbon_instruments.mint_tx_hash` | `carbon_credit.minted` | Transaction hash, token id, and duplicate-mint guard |
| 10 | `instrument.minted` | `instrument.listed` or `instrument.held` | Seller or buyer workflow | Listing requires owner balance, price, expiry, and marketplace contract availability | `domain_market_orders`, marketplace transaction | `market_listing.created` | Unique listing id and seller/order lock |
| 11 | `instrument.listed` | `market_purchase.settled` | Buyer | Buyer eligibility, amount, price, KYC/sanctions, and chain receipt must pass | `domain_market_orders`, settlement receipt | `market_purchase.settled` | Idempotency key, listing fill guard, receipt reconciliation |
| 12 | `instrument.minted` or `market_purchase.settled` | `instrument.partially_retired` or `instrument.retired` | Enterprise buyer | Retirement requires owner balance, beneficiary/reason, certificate reference, and retirement transaction | `domain_retirement_records`, instrument quantity fields | `carbon_credit.partially_retired` or `carbon_credit.retired` | Quantity check, retirement record id, tx hash |
| 13 | `instrument.retired` | `audit_export.ready` | Compliance officer, buyer admin, regulator, or sovereign auditor | Export scope must be tenant/jurisdiction authorized and payload inclusion must be explicitly approved | `getCarbonRemovalAuditLineage` output | `audit_export.generated` | Export scope hash, bounded limit, payload hash by default |

## Actors

- `TerraQura ops`: platform administration and production release approval
- `operator admin`: DAC operator tenant administrator
- `sensor/API key holder`: approved telemetry source or sensor integration
- `verification worker`: asynchronous policy/evidence processor
- `Rust verifier`: Proof-of-Physics and cryptographic verification service
- `minting worker`: chain transaction producer for verified credit issuance
- `relayer/signer`: direct or Defender relay path, selected explicitly
- `enterprise buyer`: wallet or account retiring credits
- `compliance officer`: approved audit/export reviewer
- `regulator/sovereign auditor`: authorized external reviewer

## Approval Boundary

The approval boundary is the point where untrusted or incomplete data becomes
eligible to change institutional state. Approval boundaries are fail-closed.

Required boundaries:

- Tenant and operator membership approval
- Facility and DAC unit approval
- Sensor credential and source data approval
- Verification evidence approval
- Duplicate-mint prevention
- KYC and sanctions approval
- Manifest chain-id and contract-address approval
- Mint transaction receipt approval
- Marketplace settlement approval
- Retirement and certificate approval
- Audit export scope approval

## Data Handoffs

Web:

- captures operator, buyer, and reviewer intent
- must display live/preview data provenance
- must not be the only authorization layer

API:

- validates request shape, auth, tenant boundaries, and idempotency
- writes compatibility state only with typed domain event fingerprints
- must use normalized domain tables for launch-critical workflow evidence

Worker:

- performs asynchronous verification, minting, KYC, notification, and webhook work
- uses idempotency keys and structured redacted logs
- fails closed when required production evidence is missing

Verifier:

- validates proof, quality, sensor, provenance, and Merkle evidence
- publishes network/deployment identity on health

Contracts:

- enforce token, marketplace, governance, circuit breaker, gasless, and oracle rules
- must be selected from the canonical network manifest

Indexer and subgraph:

- reconcile chain events into queryable state
- must publish selected network/deployment identity and block freshness

Database:

- owns domain state, domain events, Timescale telemetry, and audit lineage query shape

Reporting:

- exports bounded lineage records with payload hashes by default
- requires compliance approval to include raw event payloads

## Domain Event Contract

Launch-critical domain events:

- `tenant.created`
- `tenant_member.added`
- `facility.registered`
- `dac_unit.registered`
- `dac_unit.whitelisted`
- `telemetry.window_opened`
- `verification_batch.submitted`
- `verification_batch.verifying`
- `verification_batch.verified`
- `verification_batch.rejected`
- `carbon_instrument.created`
- `carbon_credit.minted`
- `market_listing.created`
- `market_purchase.settled`
- `carbon_credit.partially_retired`
- `carbon_credit.retired`
- `audit_export.generated`
- `api_state_store.mutated`

Every event must carry:

- `event_type`
- `event_version`
- `aggregate_type`
- `aggregate_id`
- `tenant_id` when tenant-scoped
- `chain_id` and `tx_hash` when chain-linked
- payload or payload hash according to export scope
- `causation_id` and `correlation_id` when part of a cross-service workflow

## Replay Safety

Replay protection must be enforced at every state-changing boundary:

- API mutation idempotency key for client retries
- queue job idempotency key for worker retries
- row-level locking for mutable compatibility state
- unique normalized constraints for facility, DAC unit, verification batch, and instrument mappings
- processed source hash checks for duplicate verification/mint paths
- contract nonce checks for gasless meta-transactions
- transaction receipt reconciliation before marking chain state final
- bounded audit export limits to avoid unreviewed bulk disclosure

## Launch Rule

Production launch is not approved until this workflow has one complete evidence
run with:

- live telemetry or approved pilot telemetry
- live selected deployment identity
- nonzero selected contract addresses
- verifier output
- mint transaction receipt
- retirement or transfer transaction receipt
- normalized domain events
- audit lineage export
- service health checks
- signed go/no-go decision in the production evidence pack

