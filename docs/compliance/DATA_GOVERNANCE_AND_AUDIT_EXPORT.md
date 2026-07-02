# TerraQura Data Governance and Audit Export

This document defines the enterprise data-governance posture for TerraQura's
golden workflows. It complements the compliance overview by making retention,
privacy classification, pseudonymization, audit export, and lineage expectations
explicit enough for institutional diligence.

## Control Objectives

- Prove lineage from DAC facility and unit through telemetry-backed verification, carbon instrument issuance, marketplace activity, and retirement.
- Keep PII and sensitive commercial data out of broad exports by default.
- Preserve enough event and hash evidence for regulators, auditors, sovereign entities, and enterprise buyers to verify environmental claims.
- Make export behavior deterministic, tenant-scoped, and repeatable.

## Data Classification

| Data class                  | Examples                                                                                                                       | Default handling                                                           |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| Public                      | chain ID, transaction hash, contract address, token ID, public retirement proof                                                | Can appear in public certificates, explorers, and audit packs.             |
| Internal                    | telemetry hashes, source-data hashes, event IDs, service versions, verifier quality scores                                     | Export to authorized operators, auditors, and platform teams.              |
| Confidential                | tenant IDs, facility codes, unit codes, marketplace order references, domain event payloads                                    | Tenant-scoped export only; redact from broad reports unless approved.      |
| Restricted                  | wallet-to-identity mappings, KYC status, sanctions evidence, webhook endpoints, provider references                            | Hash, tokenize, or summarize unless compliance officer approves inclusion. |
| Prohibited in audit exports | KYC documents, government IDs, liveness media, raw sanctions provider response bodies, secrets, API keys, private webhook URLs | Never exported through TerraQura audit lineage helpers.                    |

The database package publishes
`DOMAIN_AUDIT_EXPORT_FIELD_CLASSIFICATION` so code and reviews can reference the
same classification vocabulary used here.

## Retention Policy

| Dataset                | Default retention                                                  | Rationale                                                                                     |
| ---------------------- | ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| Sensor readings        | 730 days in TimescaleDB hot storage, then archive by tenant policy | Supports verification disputes and performance analysis while bounding high-volume telemetry. |
| Verification batches   | 10 years                                                           | Required for carbon accounting, dispute resolution, and regulator review.                     |
| Carbon instruments     | Life of instrument plus 10 years                                   | Required for issuance, transfer, and retirement lineage.                                      |
| Retirement records     | Permanent or jurisdictional maximum                                | Retirement claims are durable environmental assertions.                                       |
| Domain events          | 10 years minimum                                                   | Required for API/state mutation auditability and migration bridge from compatibility state.   |
| KYC provider documents | Provider-managed according to jurisdiction and contract            | TerraQura stores attestations/status, not raw documents.                                      |
| API logs               | 365 days hot, 7 years archived for security/compliance events      | Balances incident investigation and privacy minimization.                                     |
| Alert/incident records | 7 years                                                            | Supports operational audit, SLA review, and postmortem accountability.                        |

Retention exceptions require compliance approval and must be recorded with
tenant, jurisdiction, dataset, reason, duration, and approver.

## Pseudonymization and Minimization

- Wallet addresses are treated as restricted pseudonymous identifiers when tied to tenants, KYC, purchases, or retirements.
- Broad analytics should aggregate by tenant, geography, facility type, time window, or instrument class rather than raw wallet.
- KYC exports must include status, level, provider reference hash, and expiry only; raw identity data stays inside the KYC provider boundary.
- Event payloads are hashed by default in audit lineage exports. Full payload inclusion requires an approved scope and should be limited to named tenants, instruments, and date windows.
- Webhook endpoints, API keys, provider secrets, and private URLs must be redacted or omitted.

## Canonical Audit Export

The canonical export helper is:

```ts
import {
  getCarbonRemovalAuditLineage,
  buildCarbonRemovalAuditLineageQuery,
} from "@terraqura/database/domain";
```

Default behavior:

- Export rows are bounded with a maximum limit of 500 records.
- Event payloads are replaced with SHA-256 digests by default.
- Scope can filter by tenant, carbon instrument ID, token ID, and capture window.
- Export rows include facility, DAC unit, verification batch, carbon instrument, market order, retirement, and typed domain event references.

Approved payload export:

```ts
await getCarbonRemovalAuditLineage(db, {
  tenantId,
  carbonInstrumentId,
  startAt,
  endAt,
  includeEventPayload: true,
  limit: 100,
});
```

Only compliance-approved exports should set `includeEventPayload: true`.

## Export Shape

Each record represents one carbon instrument and includes:

- `carbonInstrumentId`, `tokenId`, `chainId`, `contractAddress`, `status`
- `initialQuantity`, `availableQuantity`, `retiredQuantity`, `ownerWallet`
- `mintTxHash`, `metadataUri`, `mintedAt`
- `verificationBatchId`, `sourceDataHash`, `telemetryWindowHash`
- `captureStartAt`, `captureEndAt`, `totalCo2CapturedKg`, `totalEnergyKwh`, `qualityScore`
- `dacUnitId`, `unitCode`, `facilityId`, `facilityCode`, `facilityCountryCode`
- `marketOrders[]`
- `retirements[]`
- `events[]` with either `payloadSha256` or approved `payload`

## Lineage Contract

For the flagship workflow, every export must be able to answer:

- Which tenant, facility, and DAC unit produced the removal?
- Which capture window and source-data hash supported verification?
- Which verifier/domain event approved or rejected the batch?
- Which carbon instrument and token ID represented the verified removal?
- Which market order or purchase moved economic ownership?
- Which retirement record permanently consumed the claim?
- Which transaction hashes and domain events prove the state transitions?

## Access Review

- Operator exports are tenant-scoped and exclude other tenants' marketplace or KYC details.
- Buyer retirement exports include purchased/retired instrument lineage and certificate references, not unrelated operator telemetry.
- Regulator/sovereign exports can include jurisdiction-wide lineage after written authorization.
- Internal engineering exports must prefer payload hashes unless debugging a specific incident or migration.

## Evidence Preservation

Before destructive remediation, migration rollback, or manual reconciliation,
preserve:

- active network and deployment manifest keys
- relevant domain events and payload hashes
- transaction hashes and receipt status
- verification batch source hashes
- state-store mutation fingerprints
- database migration version
- incident/runbook reference
