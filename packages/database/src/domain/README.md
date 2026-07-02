# TerraQura Domain Backbone

This folder defines the normalized operational schema that should gradually
replace JSON-only orchestration in `api_state_store` for flagship workflows.
The tables intentionally use a `domain_` prefix so they do not collide with
the existing Prisma application tables while we migrate workflow by workflow.

Initial scope:

- operator onboarding and facility registration
- continuous DAC telemetry verification
- verified removal issuance
- marketplace listing and settlement references
- retirement and certificate audit trails
- canonical domain event log

The JSONB state store can continue to support prototypes and secondary modules,
but institutional workflows should move into these first-class tables. During
the transition, state-store mutations should emit `domain_events` entries with
payload hashes so auditors can trace changes without duplicating sensitive JSON.

## Commands

- `pnpm --filter @terraqura/database db:domain:apply`

## Programmatic Use

- `recordDomainEvent(db, input)` writes append-only event records to
  `domain_events`.
- The API compatibility state store emits typed events for golden workflow
  actions such as `carbon_credit.minted`, `market_listing.created`,
  `market_purchase.settled`, and `carbon_credit.retired` inside the same
  transaction as the JSON mutation.
- The API also emits `api_state_store.mutated` fingerprint events for every JSON
  mutation, creating an audit bridge until the corresponding route is migrated
  to a normalized `domain_*` table.
- `getCarbonRemovalAuditLineage(db, scope)` returns a bounded audit export
  across facility, DAC unit, verification batch, carbon instrument, market
  orders, retirements, and domain events. Event payloads are represented by
  SHA-256 hashes by default unless `includeEventPayload` is explicitly approved
  for the export scope.
- `DOMAIN_AUDIT_EXPORT_FIELD_CLASSIFICATION` defines the privacy classification
  used by the compliance data-governance document.
- The database package also exports `setDatabaseLogger`, `getDatabaseLogger`,
  and `serializeDatabaseError` so API/worker runtimes can route shared database
  lifecycle errors into structured production logging without package-level raw
  console output.
