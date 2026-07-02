# TerraQura Service Ownership and SLOs

This document defines the minimum operating envelope for production TerraQura
services. It is intentionally specific: every Prometheus alert owner label must
map to a real operational domain here, and every critical platform surface must
have a measurable service-level objective.

Version: 1.0

## Ownership Registry

| Alert owner label         | Operational domain                                     | Primary responsibility                                                                                            | Escalation                                                 |
| ------------------------- | ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `security-response`       | Security and governance response                       | Circuit breaker, multisig, emergency recovery, abnormal value movement, privileged wallet activity                | Incident commander, governance approvers, legal/compliance |
| `verification-risk`       | MRV and verification risk                              | Verification evidence quality, duplicate-mint prevention, KYC/sanctions evidence, verifier failure analysis       | Security-response, platform-workers, DAC operator success  |
| `platform-api`            | Public API and application control plane               | Authentication, write/read API health, state-store mutations, Graph/RPC client behavior, customer-facing API SLOs | Platform-infrastructure, data-platform, security-response  |
| `platform-workers`        | Asynchronous job processing                            | Verification, minting, notifications, webhook delivery, IPFS publishing, queue backlogs, replay safety            | Platform-api, platform-cache, verification-risk            |
| `data-platform`           | PostgreSQL, TimescaleDB, domain event store            | Primary database health, replication, slow queries, domain lineage data, backup/restore execution                 | Platform-api, platform-infrastructure                      |
| `platform-cache`          | Redis and queue transport                              | Redis availability, replication, queue durability, job retention, connection hygiene                              | Platform-workers, platform-infrastructure                  |
| `blockchain-platform`     | Chain RPC and transaction execution                    | Approved RPC providers, manifest chain identity, relayer transaction health, gas and receipt reliability          | Security-response, platform-api                            |
| `blockchain-indexer`      | Contract event indexing and subgraph freshness         | Chain event ingestion, Graph node health, block lag, replay/backfill correctness                                  | Blockchain-platform, data-platform                         |
| `product-operations`      | Marketplace and customer activity operations           | Business-volume alerts, buyer/operator adoption checks, suspicious non-technical activity                         | Platform-api, verification-risk, security-response         |
| `platform-infrastructure` | Cloud, ingress, certificate, deployment infrastructure | Kubernetes, ingress, TLS, blackbox probes, regional failover, deploy/rollback mechanics                           | Platform-api, security-response                            |

## SLO Model

SLO reporting windows:

- Monthly SLOs are measured over calendar months in production.
- Incident impact is counted from the first customer-impacting symptom until validated recovery.
- Scheduled maintenance is excluded only when announced in advance and when protected flows are intentionally placed in maintenance mode.
- Error budgets are consumed by failed requests, unavailable dependencies that break user workflows, stale compliance data beyond the stated freshness target, and failed protected write operations.

Burn-rate policy:

- Page immediately when a critical alert indicates active user, settlement, verification, custody, governance, or compliance impact.
- Freeze non-emergency deploys when a service consumes more than 25 percent of its monthly error budget in 24 hours.
- Require leadership review when a service consumes more than 50 percent of monthly error budget before the month is half complete.
- Do not spend error budget by disabling fail-closed controls. Verification, KYC, sanctions, duplicate-mint, manifest chain-id, and retirement integrity checks must remain active.

## API Availability SLO

Owner: `platform-api`.

Target:

- 99.95 percent monthly availability for authenticated API reads and protected write endpoints.
- 95 percent of successful API requests complete under 2 seconds.
- 99 percent of readiness checks complete under 500 milliseconds when dependencies are healthy.

Counts as error:

- 5xx responses, authentication-control failures, unavailable write paths, Graph/RPC fallback failure that breaks API responses, and request timeouts before a deterministic response.

Does not count as error:

- 4xx validation failures, invalid signatures, blocked KYC/sanctions requests, duplicate-mint rejection, and explicitly documented maintenance windows.

Primary alerts:

- `APIHighErrorRate`
- `APIHighLatency`
- `APIDown`

Operational evidence:

- Request metrics, structured API logs, state-store mutation events, Graph client fallback logs, readiness checks, and synthetic golden workflow results.

## Web Dashboard SLO

Owner: `platform-api` for application behavior and `platform-infrastructure` for delivery.

Target:

- 99.9 percent monthly availability for production dashboard shell and authenticated operator/buyer flows.
- 95 percent of client-side route transitions complete without uncaught runtime error.
- Production client error reports are delivered or explicitly skipped for policy reasons, never silently dropped.

Counts as error:

- Public dashboard unavailable, production runtime errors that block golden workflows, wallet connection provider failure without visible recovery state, and insecure monitoring endpoint configuration.

Primary alerts:

- API alerts for backend dependencies.
- Blackbox checks for web health.
- Client error reporting dashboards.

Operational evidence:

- Web build provenance, CSP configuration, sanitized client error reports, blackbox probes, and dashboard data-mode telemetry.

## Worker Processing SLO

Owner: `platform-workers`.

Target:

- 99.9 percent monthly successful processing for retryable jobs after policy-compliant retries.
- 95 percent of verification, minting, notification, and webhook jobs start within 5 minutes of enqueue.
- No duplicate protected side effects from replayed jobs.

Counts as error:

- Job exhaustion after retries, poison-job loops, missed protected side effects, duplicate notification or mint attempts, and queue delay beyond 5 minutes for golden workflows.

Does not count as error:

- Jobs rejected because required production evidence is missing, sanctions/KYC policy blocks execution, or duplicate-mint guardrails intentionally stop execution.

Primary alerts:

- `WorkerQueueBacklog`
- `WorkerJobFailures`
- Redis health alerts.

Operational evidence:

- Queue metrics, job IDs, idempotency keys, structured worker logs, dead-letter records, and replay reports.

## Verification and MRV SLO

Owner: `verification-risk`.

Target:

- 99 percent of eligible verification batches complete within 30 minutes after all required evidence is available.
- 100 percent of production verification jobs include source validation, telemetry aggregate, duplicate-mint, KYC, and sanctions evidence.
- 0 known duplicate-mint approvals.

Counts as error:

- Eligible batch stuck without decision, verifier result written without required evidence, duplicate/overlap approval, source-data hash mismatch accepted, and unreviewed verifier policy drift.

Does not count as error:

- Batch rejected because evidence is missing, source data is inconsistent, telemetry is anomalous, KYC/sanctions is blocked, or local-drill opt-in is absent.

Primary alerts:

- `HighVerificationFailureRate`
- Worker alerts.
- Block/indexer freshness alerts when verifier proof depends on chain state.

Operational evidence:

- Verification batch records, verifier proof output, evidence hashes, source-data summaries, KYC/sanctions references, and domain events.

## Database and Domain Event SLO

Owner: `data-platform`.

Target:

- 99.95 percent monthly availability for primary database writes.
- 99.9 percent monthly availability for domain event writes.
- Recovery point objective of 15 minutes for production data.
- Recovery time objective of 4 hours for primary database restore.

Counts as error:

- Failed committed write path, unavailable primary database, domain-event write failure during golden workflow mutation, replication lag beyond SLO that causes stale customer-visible data, and unrecoverable backup gap.

Does not count as error:

- Query rejected by policy, read replica intentionally marked stale, or analytics freshness degraded with visible unavailable status.

Primary alerts:

- `DatabaseConnectionSaturation`
- `DatabaseHighCPU`
- `DatabaseReplicationLag`
- `SlowQueries`

Operational evidence:

- Postgres metrics, Timescale metrics, domain event table, backup job records, restore drill notes, query plans, and migration approvals.

## Redis and Queue Transport SLO

Owner: `platform-cache`.

Target:

- 99.9 percent monthly Redis availability for queue and rate-limit paths.
- Redis replica healthy within 5 minutes of primary health.
- Queue metadata retained long enough to support incident replay and audit reconstruction.

Counts as error:

- Redis unavailable to workers/API, queue job loss, replica unavailable beyond target, connection exhaustion, and memory pressure causing eviction of audit-relevant queue metadata.

Primary alerts:

- `RedisHighMemory`
- `RedisConnectionLimit`
- `RedisReplicationBroken`
- Worker queue alerts.

Operational evidence:

- Redis metrics, queue counts, dead-letter queues, job retention settings, connection lists, and replay records.

## Chain RPC and Relayer SLO

Owner: `blockchain-platform`.

Target:

- 99.9 percent monthly availability for approved RPC read operations needed by API, workers, verifier, and indexer.
- 99 percent of submitted protected transactions receive a final receipt or deterministic failure classification within 10 minutes.
- 0 accepted transactions on a chain ID that differs from the active manifest.

Counts as error:

- RPC unavailable without approved failover, chain-id drift, transaction nonce deadlock, relayer misconfiguration, and failed receipt reconciliation after protected write submission.

Does not count as error:

- Transaction intentionally delayed due to gas spike, policy pause, missing signer capability, or fail-closed Defender/direct relayer configuration.

Primary alerts:

- `RPCNodeDown`
- `GasPriceSpike`
- Circuit breaker and large transfer security alerts.

Operational evidence:

- RPC health probes, relayer logs, transaction hashes, receipt records, manifest identity, gas reports, and provider incident timestamps.

## Indexer and Subgraph Freshness SLO

Owner: `blockchain-indexer`.

Target:

- 99 percent of production contract events indexed within 5 minutes of finality.
- Block lag remains under 100 blocks except during approved backfill or provider incident.
- Reindex/backfill jobs produce deterministic range and checkpoint records.

Counts as error:

- Indexer lag beyond target that affects marketplace, retirement, verification, or compliance views; Graph node unhealthy without fallback; missing event range after reorg/backfill.

Does not count as error:

- Historical backfill explicitly marked degraded, approved maintenance window, or chain provider outage already counted against RPC SLO.

Primary alerts:

- `BlockLag`
- `GraphNodeUnhealthy`
- `RPCNodeDown`

Operational evidence:

- Indexed block checkpoints, event storage records, Graph node metrics, backfill manifests, and reconciliation queries.

## Analytics Freshness SLO

Owner: `product-operations` for business interpretation and `data-platform` for data dependencies.

Target:

- 99 percent of production analytics views clearly report live, stale, unavailable, or preview data mode.
- Live marketplace analytics refresh within 15 minutes when API and database dependencies are healthy.
- Synthetic analytics are unavailable in production unless the explicit synthetic-data opt-in is set for a drill.

Counts as error:

- Production analytics silently substituting synthetic values, live dashboards presenting stale data without visible status, and missing provenance for regulatory or customer-facing reports.

Primary alerts:

- Business metrics alerts.
- API, database, and indexer freshness alerts.

Operational evidence:

- Analytics service status payloads, data-mode labels, API marketplace data timestamps, and report-generation logs.

## Infrastructure and TLS SLO

Owner: `platform-infrastructure`.

Target:

- 99.95 percent monthly availability for production ingress, DNS, and TLS termination.
- Certificates renewed before 7-day critical threshold.
- Rollback decision available within 15 minutes of a failed deploy causing customer impact.

Counts as error:

- Expired or invalid certificate, unavailable ingress, DNS misrouting, failed deploy without rollback path, and blackbox probe failure that reflects customer-visible outage.

Primary alerts:

- `SSLCertificateExpiringSoon`
- `SSLCertificateExpiryCritical`
- `APIDown`

Operational evidence:

- Blackbox probes, certificate expiry checks, deployment records, rollback logs, ingress events, and status communications.

## Business Activity Review SLO

Owner: `product-operations`.

Target:

- Info-level business activity alerts reviewed within one business day.
- Confirmed technical impairment from business alerts is escalated to the owning service within 30 minutes of triage.
- Suspicious activity from business alerts is escalated to security-response within 30 minutes.

Counts as error:

- Business alert ignored past review target, technical impairment not routed to platform owner, or suspicious activity not escalated to security.

Primary alerts:

- `LowCreditMintingRate`
- `NoTradingActivity`
- `HighRetirementRate`

Operational evidence:

- Activity dashboards, marketplace domain events, support tickets, customer communications, and product review notes.

## Review Cadence

- Weekly: review critical/warning alert trends, error-budget burn, and open runbook gaps.
- Monthly: publish SLO report, incident postmortem summary, and burn-rate exceptions.
- Quarterly: review owner labels, escalation paths, regulatory/customer commitments, and readiness gate requirements.
