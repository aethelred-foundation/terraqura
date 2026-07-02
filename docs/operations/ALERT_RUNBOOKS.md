# TerraQura Alert Runbooks

This document is the source of truth for production Prometheus alert runbooks.
Each alert in `infrastructure/monitoring/alerting-rules.yml` must carry a stable
`owner` label and a `runbook` label pointing to one of the anchors below.

Incident defaults:

- Critical alerts: acknowledge within 5 minutes, open an incident channel, assign incident commander, scribe, and technical lead.
- Warning alerts: acknowledge within 30 minutes, assign a service owner, and either resolve or promote to incident if user, settlement, verification, or custody impact is confirmed.
- Info alerts: review during business hours unless correlated with customer escalation, fraud signal, or external service outage.
- Every alert closure must include impact assessment, timeline, root cause or current hypothesis, mitigation, and follow-up owner.

Safe response principles:

- Prefer fail-closed controls for verification, minting, retirement, custody, KYC, sanctions, and settlement paths.
- Do not disable circuit breakers, sanctions checks, duplicate-mint controls, or chain-id drift checks to clear an alert.
- If the alert involves value movement, governance, verifier evidence, or retirement records, preserve logs, transaction hashes, event IDs, and database snapshots before making destructive changes.
- If a rollback or manual reconciliation is required, record the exact deployment, manifest network key, manifest deployment key, and operator approvals.

<a id="circuit-breaker-activated"></a>

## CircuitBreakerActivated

Owner: security-response. Severity: critical.

Signal: `terraqura_circuit_breaker_global_pause == 1`.

Immediate actions:

- Confirm whether the pause came from an authorized signer, automated policy, or contract-level emergency path.
- Open a security incident and freeze non-essential deploys, relayers, marketplace settlement, and manual admin operations.
- Review the last 100 governance, mint, transfer, retirement, marketplace, relayer, and verifier events before the pause.
- Verify customer-facing status pages and API readiness responses clearly state that protected operations are paused.

Diagnostics:

- Compare event logs from the contract monitor, API domain events, state-store mutation fingerprints, and indexer head.
- Check for recent abnormal wallet behavior, verifier bypass attempts, duplicate-mint rejections, sanctions/KYC failures, and governance threshold changes.
- Confirm the active network/deployment manifest identity and reject any evidence generated on legacy validation deployments unless the explicit drill opt-in is present.

Mitigation:

- Keep the pause active until the incident commander and governance approvers agree on the blast radius.
- If the trigger was false positive, document the exact rule and evidence before proposing unpause.
- If a vulnerability is suspected, prepare hotfix, audit notes, migration plan, and recovery communications before unpause.

Closure evidence:

- Include triggering transaction hash, signer set, scope of paused operations, customer impact, reconciliation status, and governance approval trail.

<a id="unusual-transaction-volume"></a>

## UnusualTransactionVolume

Owner: security-response. Severity: critical.

Signal: `rate(terraqura_transactions_total[5m])` exceeds 10x the 24-hour average.

Immediate actions:

- Determine whether the spike is expected campaign traffic, scripted load testing, indexer replay, or adversarial activity.
- Check API rate-limit dashboards, wallet clustering, relayer queue depth, marketplace purchases, and contract event cardinality.
- If value movement is abnormal, enable stricter rate limits and prepare circuit-breaker escalation.

Diagnostics:

- Segment by route, wallet, tenant, contract method, relayer key, source IP ASN, and chain transaction status.
- Compare successful transactions with rejected KYC, sanctions, duplicate-mint, signature, and nonce failures.
- Verify indexer lag is not causing duplicate event ingestion or replayed metric increments.

Mitigation:

- Block abusive sources at edge/WAF and pause affected API keys or wallets where policy allows.
- Throttle non-critical write paths while preserving read health and audit exports.
- Escalate to governance if contract-level pause may be required.

Closure evidence:

- Record spike window, top actors, affected endpoints, chain methods, mitigation decisions, and residual fraud review.

<a id="large-value-transfer"></a>

## LargeValueTransfer

Owner: security-response. Severity: critical.

Signal: `terraqura_transfer_value_eth > 100000`.

Immediate actions:

- Confirm the unit and token represented by the metric before communicating value impact.
- Identify source wallet, destination wallet, contract method, transaction hash, tenant, and linked order or retirement record.
- Freeze related off-chain workflows until the transfer is matched to an approved settlement, treasury, or governance action.

Diagnostics:

- Compare transfer against marketplace order books, escrow balances, treasury schedule, and domain event records.
- Check whether the transfer occurred on the active manifest deployment and expected chain ID.
- Verify no relayer, admin, or multisig key was used outside its approved window.

Mitigation:

- If unauthorized, trigger incident response, preserve key material evidence, and consider circuit breaker or wallet quarantine.
- If authorized but unexpected in alert thresholds, update change record and tune threshold only after approval.

Closure evidence:

- Include transaction hash, approval source, accounting entry, customer impact, and final authorization decision.

<a id="multisig-threshold-changed"></a>

## MultisigThresholdChanged

Owner: security-response. Severity: critical.

Signal: `changes(terraqura_multisig_threshold[1h]) > 0`.

Immediate actions:

- Confirm the threshold change matches an approved governance proposal and execution window.
- Verify signer set, quorum before/after, timelock status, and exact transaction hash.
- Suspend additional privileged operations until the change is validated.

Diagnostics:

- Compare contract event logs with governance meeting notes, deployment records, and key-custody approvals.
- Confirm no signer was added, removed, or rotated in the same window without documentation.
- Check monitoring for simultaneous circuit breaker, upgrade, treasury, or role-grant events.

Mitigation:

- If unauthorized, trigger emergency governance process and prepare contract pause.
- If authorized, update the governance register and ensure monitoring baselines use the new threshold.

Closure evidence:

- Attach proposal ID, transaction hash, signer approvals, old/new threshold, and confirmation from governance owner.

<a id="emergency-recovery-initiated"></a>

## EmergencyRecoveryInitiated

Owner: security-response. Severity: critical.

Signal: `terraqura_emergency_recovery_initiated == 1`.

Immediate actions:

- Open a security incident and confirm the recovery initiation transaction, signer, and activation delay.
- Notify governance, legal, compliance, and platform leads that a recovery timer is active.
- Freeze unrelated admin changes until the recovery intent is confirmed.

Diagnostics:

- Verify whether the recovery path was invoked for key loss, exploit containment, data corruption, or governance dispute.
- Review prior alerts in the same window, especially circuit breaker, multisig, large transfer, and API write-path failures.
- Confirm whether the recovery can be cancelled and by whom.

Mitigation:

- If unauthorized, execute the documented cancellation or countermeasure path before the delay expires.
- If authorized, prepare customer communication, migration checklist, reconciliation plan, and post-recovery validation.

Closure evidence:

- Record recovery transaction, authorization, deadline, cancellation or execution outcome, and reconciliation status.

<a id="high-verification-failure-rate"></a>

## HighVerificationFailureRate

Owner: verification-risk. Severity: warning.

Signal: verification failures exceed 10 percent over a one-hour window.

Immediate actions:

- Identify whether failures cluster by tenant, DAC unit, verifier, sensor source, model version, KYC status, sanctions status, or telemetry provider.
- Confirm production jobs are not falling back to local-drill or synthetic evidence.
- Pause affected verification batches if duplicate-mint, source-data, KYC, or sanctions failures are increasing.

Diagnostics:

- Review verifier rejection reasons, worker logs, API domain events, telemetry aggregate freshness, and source-data hash mismatches.
- Compare current verifier release, schema version, and manifest deployment with the last successful batch.
- Check for upstream telemetry outage or timestamp skew.

Mitigation:

- Quarantine suspect batches and require manual review before minting.
- Roll back verifier changes only if the previous version is compatible with current evidence schema and manifest.
- Notify affected operators if evidence resubmission is required.

Closure evidence:

- Include failure breakdown, quarantined batch IDs, accepted/rejected counts, and any operator remediation.

<a id="api-high-error-rate"></a>

## APIHighErrorRate

Owner: platform-api. Severity: critical.

Signal: 5xx API responses exceed 5 percent over 5 minutes.

Immediate actions:

- Check deployment timeline, readiness failures, database connectivity, Redis connectivity, provider outages, and error budget burn.
- Freeze further deploys until the active failure mode is identified.
- If write paths are failing, verify idempotency and duplicate protection before replaying requests.

Diagnostics:

- Segment by route, tenant, status code, exception type, dependency, pod, version, and region.
- Review structured logs with request IDs, but avoid copying sensitive payloads into incident channels.
- Compare API failures with worker queues, database saturation, Graph client fallback, and chain RPC health.

Mitigation:

- Roll back the latest API deploy if failures correlate with release.
- Scale API pods only if CPU, memory, or connection pools show capacity pressure rather than dependency failure.
- Disable non-critical integrations using feature flags only when fail-closed controls remain intact.

Closure evidence:

- Include root cause, affected routes, failed request volume, customer impact, rollback or fix version, and replay decision.

<a id="api-high-latency"></a>

## APIHighLatency

Owner: platform-api. Severity: warning.

Signal: P95 API latency exceeds 2 seconds for 10 minutes.

Immediate actions:

- Determine whether latency is read-path, write-path, chain provider, database, Redis, KYC, Graph, or external webhook related.
- Check whether latency is causing client retries, queue growth, or elevated 5xx responses.
- Prioritize settlement, mint, retirement, and readiness endpoints.

Diagnostics:

- Review route-level histograms, slow query logs, connection pool waits, dependency timeouts, and request body size anomalies.
- Confirm timeout handles are clearing and no runaway background work is attached to request lifecycle.
- Compare canary and stable deployments.

Mitigation:

- Shed optional preview/dashboard traffic if critical workflows are affected.
- Scale bottlenecked service tiers only after confirming the dependency can absorb more concurrency.
- Roll back or disable the slow integration path if release-correlated.

Closure evidence:

- Include latency before/after, bottleneck, mitigation, and residual SLO impact.

<a id="api-down"></a>

## APIDown

Owner: platform-api. Severity: critical.

Signal: `up{job="terraqura-api"} == 0` for 1 minute.

Immediate actions:

- Confirm whether the API is actually unreachable from blackbox checks, internal probes, and customer regions.
- Check Kubernetes rollout status, pod crash loops, ingress health, DNS, TLS, and load balancer targets.
- Declare incident if public API or authenticated write paths are unavailable.

Diagnostics:

- Inspect readiness/liveness probe failures, container exit codes, recent deploys, configuration changes, and secret mounts.
- Verify database, Redis, and network manifest configuration are valid for the active environment.
- Check whether Prometheus scrape discovery failed independently of service availability.

Mitigation:

- Roll back the last deploy or restore last known-good configuration if crash loops correlate with release.
- Scale from zero only if deployment was accidentally drained.
- Fail traffic over to healthy region or maintenance page if available.

Closure evidence:

- Include outage window, external impact, root cause, restore action, and any missed monitoring gaps.

<a id="worker-queue-backlog"></a>

## WorkerQueueBacklog

Owner: platform-workers. Severity: warning.

Signal: `terraqura_worker_queue_size > 1000` for 10 minutes.

Immediate actions:

- Identify which queue is growing: verification, notification, IPFS, webhook, settlement, analytics, or maintenance.
- Confirm workers are running and not blocked by Redis, database, provider, or manifest errors.
- Protect minting and settlement workflows from duplicate processing before scaling.

Diagnostics:

- Review job age, retry counts, failure reasons, idempotency keys, dead-letter volume, and worker concurrency.
- Check whether an upstream service is accepting work faster than downstream dependencies can process.
- Compare queue growth with API traffic, verification failure rate, and provider latency.

Mitigation:

- Scale workers cautiously and only within downstream service rate limits.
- Pause low-priority queues if critical verification or settlement jobs are delayed.
- Drain or quarantine poison jobs after preserving payload hashes and job IDs.

Closure evidence:

- Include peak backlog, oldest job age, affected queues, root cause, and jobs replayed or quarantined.

<a id="worker-job-failures"></a>

## WorkerJobFailures

Owner: platform-workers. Severity: warning.

Signal: worker job failure rate exceeds threshold for 10 minutes.

Immediate actions:

- Identify failing processor, queue, job type, deployment version, tenant, and dependency.
- Stop automatic retries if failures are non-transient and risk duplicate writes or duplicate notifications.
- Preserve failed job IDs, idempotency keys, and serialized safe errors.

Diagnostics:

- Review structured worker logs, dead-letter queues, Redis health, database errors, provider status, and schema compatibility.
- Check whether recent code changed payload shape, evidence validation, or external service authentication.
- Determine whether failures are recoverable, poison jobs, rate-limit exhaustion, or dependency outage.

Mitigation:

- Roll back processor release or deploy compatibility fix.
- Replay only idempotent jobs after confirming downstream side effects.
- Backfill missed notifications or analytics after source-of-truth records are consistent.

Closure evidence:

- Include failed job count, replay count, lost work assessment, and prevention follow-up.

<a id="database-connection-saturation"></a>

## DatabaseConnectionSaturation

Owner: data-platform. Severity: warning.

Signal: active database connections exceed 80 percent of max connections.

Immediate actions:

- Determine top connection owners by application, pod, user, query state, and transaction age.
- Check whether API, workers, analytics, or migration jobs recently scaled up.
- Protect write-path consistency before killing sessions.

Diagnostics:

- Review pool sizes, idle-in-transaction sessions, slow queries, lock waits, and recent deploys.
- Confirm state-store transactions and domain-event writes are committing promptly.
- Check for analytics/reporting queries using production primary instead of replica.

Mitigation:

- Reduce client pool sizes or scale PgBouncer if configured.
- Terminate only confirmed idle or runaway sessions after preserving query text and owner.
- Move analytical load to replica or pause heavy backfills.

Closure evidence:

- Include peak utilization, offender services, killed sessions, and pool/config changes.

<a id="database-high-cpu"></a>

## DatabaseHighCPU

Owner: data-platform. Severity: warning.

Signal: database CPU exceeds 80 percent for 10 minutes.

Immediate actions:

- Check whether CPU is query execution, vacuum, index build, replication, or backup related.
- Confirm API error rate and latency impact.
- Pause non-critical analytics and backfill jobs if customer workflows are affected.

Diagnostics:

- Review top queries, execution plans, lock waits, cache hit ratio, write amplification, and recently deployed migrations.
- Compare CPU with connection saturation, slow queries, and replication lag.
- Verify no indexer replay or dashboard query is scanning large tables unnecessarily.

Mitigation:

- Add or fix indexes only through reviewed migration flow.
- Cancel runaway analytical queries if they threaten critical write paths.
- Scale database tier only after query-level remediation is insufficient.

Closure evidence:

- Include top query, plan change or mitigation, customer impact, and follow-up migration if needed.

<a id="database-replication-lag"></a>

## DatabaseReplicationLag

Owner: data-platform. Severity: warning.

Signal: replication lag exceeds 30 seconds for 5 minutes.

Immediate actions:

- Determine whether lag affects read replicas, analytics, backups, or disaster recovery objectives.
- Confirm primary health, WAL generation rate, replica resource pressure, and network status.
- Route critical consistency-sensitive reads to primary if stale data could cause wrong decisions.

Diagnostics:

- Check long-running transactions, replication slot status, WAL disk usage, replica CPU/I/O, and maintenance jobs.
- Compare lag with indexer backfills, analytics exports, and bulk writes.
- Verify RPO/RTO commitments remain inside policy.

Mitigation:

- Pause heavy writes or backfills if safe and needed.
- Restart or resync unhealthy replica only after preserving lag metrics and slot state.
- Communicate degraded analytics freshness when applicable.

Closure evidence:

- Include max lag, affected replicas, cause, data freshness impact, and restore timestamp.

<a id="slow-queries"></a>

## SlowQueries

Owner: data-platform. Severity: warning.

Signal: active transaction duration exceeds 30 seconds.

Immediate actions:

- Identify query text, user, application, relation, lock status, and transaction age.
- Determine whether the query blocks critical writes or is isolated analytical work.
- Avoid killing migration or reconciliation jobs without confirming rollback impact.

Diagnostics:

- Review execution plan, missing indexes, table bloat, lock graph, row estimates, and recent schema changes.
- Check whether route-level API latency or worker failures correlate.
- Verify tenant scoping and pagination for application queries.

Mitigation:

- Cancel blocking or runaway queries after preserving diagnostics.
- Add query timeout or pagination guardrails where missing.
- Create migration ticket for index/schema remediation.

Closure evidence:

- Include query fingerprint, blocked resources, mitigation, and permanent fix owner.

<a id="redis-high-memory"></a>

## RedisHighMemory

Owner: platform-cache. Severity: warning.

Signal: Redis memory usage exceeds 90 percent.

Immediate actions:

- Identify whether memory is queues, cache keys, rate-limit keys, sessions, or dead-letter retention.
- Confirm eviction policy and whether Redis is near write failure.
- Check worker queues before deleting keys.

Diagnostics:

- Review top key patterns, queue sizes, job payload sizes, retry/dead-letter counts, and key TTL coverage.
- Confirm no deployment removed expiry from high-cardinality keys.
- Compare memory growth with API traffic and job failure rate.

Mitigation:

- Reduce retention for non-critical queues after preserving audit-relevant job metadata.
- Drain stuck queues or quarantine oversized jobs.
- Scale Redis memory only after fixing runaway key growth.

Closure evidence:

- Include peak memory, top key families, deleted/expired keys, and prevention change.

<a id="redis-connection-limit"></a>

## RedisConnectionLimit

Owner: platform-cache. Severity: warning.

Signal: Redis connected clients exceed 1000.

Immediate actions:

- Identify client sources by service, pod, deployment, and connection age.
- Check for reconnect storms, leaked clients, or worker over-scaling.
- Protect queue integrity before restarting clients.

Diagnostics:

- Review Redis client list, API/worker pool settings, recent deployments, and network errors.
- Compare with API error rate, worker failures, and Redis memory pressure.
- Confirm graceful shutdown is closing clients during rollouts.

Mitigation:

- Roll back services leaking connections or reduce replicas/concurrency.
- Restart only affected pods when leakage is confirmed.
- Update pool limits and shutdown hooks if missing.

Closure evidence:

- Include max clients, offender service/version, restart or rollback actions, and leak fix.

<a id="redis-replication-broken"></a>

## RedisReplicationBroken

Owner: platform-cache. Severity: critical.

Signal: Redis primary has no connected replicas.

Immediate actions:

- Confirm whether queue durability, cache availability, and failover posture are degraded.
- Check Redis primary health, replica pods, network, disk, and authentication.
- Avoid planned deploys or high-volume backfills until redundancy is restored.

Diagnostics:

- Review replication offsets, replica logs, resource limits, persistence status, and failover controller events.
- Determine whether data loss risk exists for queue or session workloads.
- Check for simultaneous Redis memory or connection alerts.

Mitigation:

- Restore replica connectivity or provision replacement replica.
- If failover occurred, verify clients reconnect to the correct primary.
- Reduce non-critical Redis write volume until healthy.

Closure evidence:

- Include outage window, replication offset delta, failover status, and durability assessment.

<a id="rpc-node-down"></a>

## RPCNodeDown

Owner: blockchain-platform. Severity: critical.

Signal: `terraqura_rpc_healthy == 0` for 2 minutes.

Immediate actions:

- Confirm primary chain RPC health from internal probes and external provider status.
- Verify API, verifier, relayer, indexer, and contract monitor have failed over where configured.
- Pause non-critical chain writes if provider uncertainty could create duplicate or stale transactions.

Diagnostics:

- Check provider errors, chain ID, latest block, rate limits, authentication, network partitions, and fallback endpoint health.
- Compare with block lag, gas price, API error rate, and relayer failures.
- Confirm manifest network identity has not drifted.

Mitigation:

- Fail over to approved RPC provider and monitor nonce/receipt consistency.
- Throttle transaction submission until block and receipt reads stabilize.
- Escalate to provider support with request IDs and timestamps.

Closure evidence:

- Include provider outage window, failover endpoint, missed transactions, and reconciliation status.

<a id="block-lag"></a>

## BlockLag

Owner: blockchain-indexer. Severity: warning.

Signal: indexed block height lags latest chain block by more than 100.

Immediate actions:

- Determine whether lag affects marketplace views, verification status, retirement proofs, or analytics.
- Check indexer process health, Graph node health, database writes, RPC health, and recent schema changes.
- Mark derived dashboards stale if user-visible data is behind.

Diagnostics:

- Compare chain head, indexer checkpoint, Graph node head, reorg depth, and event ingestion errors.
- Check whether a replay, backfill, or contract deployment changed event volume.
- Verify no legacy validation deployment is selected without opt-in.

Mitigation:

- Restart or scale indexer if processing is stalled and state is safe.
- Pause heavy analytics queries competing with indexer writes.
- Backfill missed ranges after head catches up.

Closure evidence:

- Include max block lag, affected consumers, backfill range, and final indexed head.

<a id="gas-price-spike"></a>

## GasPriceSpike

Owner: blockchain-platform. Severity: warning.

Signal: gas price exceeds 500 gwei.

Immediate actions:

- Determine whether urgent transactions are required for security, settlement, retirement, or governance.
- Notify product and support if user transactions may be delayed or expensive.
- Check relayer fee policies and pending transaction queue.

Diagnostics:

- Compare gas price across approved RPC providers and public explorers.
- Review stuck nonces, pending transaction age, relayer balance, and priority fee configuration.
- Check for network-wide incident or provider anomaly.

Mitigation:

- Delay non-urgent transactions and batch where policy allows.
- Increase gas only for critical security or settlement actions with approval.
- Ensure relayer balance remains sufficient for retry strategy.

Closure evidence:

- Include spike duration, deferred transactions, urgent overrides, and final fee normalization.

<a id="graph-node-unhealthy"></a>

## GraphNodeUnhealthy

Owner: blockchain-indexer. Severity: warning.

Signal: Graph node chain head update takes longer than 60 seconds.

Immediate actions:

- Confirm whether Graph-backed queries are stale or failing.
- Compare Graph node health with direct indexer checkpoints and primary RPC status.
- Mark affected analytics and dashboards as degraded if freshness is compromised.

Diagnostics:

- Review Graph node logs, subgraph errors, database pressure, RPC latency, and recent subgraph deployment.
- Check for reorg handling, entity write failures, or schema incompatibility.
- Verify API fallback behavior for Graph client requests.

Mitigation:

- Roll back subgraph deployment if errors correlate with release.
- Restart Graph node only after confirming database and RPC dependencies are healthy.
- Reindex affected subgraph range if data corruption is suspected.

Closure evidence:

- Include impacted subgraph, lag duration, rollback/reindex action, and freshness restored timestamp.

<a id="low-credit-minting-rate"></a>

## LowCreditMintingRate

Owner: product-operations. Severity: info.

Signal: fewer than 100 credits minted over 24 hours.

Immediate actions:

- Check whether the drop matches expected operator schedule, maintenance window, market holiday, or demand cycle.
- Confirm verification batches, mint route health, KYC/sanctions checks, and DAC telemetry freshness.
- Review customer support channels for blocked operators.

Diagnostics:

- Segment by operator, DAC unit, verifier, geography, source telemetry, and failed verification reason.
- Compare with high verification failure rate, API errors, worker backlog, and chain RPC health.
- Verify dashboard mode is not showing preview data as live production state.

Mitigation:

- Contact affected operators if evidence ingestion or verification is blocked.
- Escalate to platform teams if minting is technically impaired.
- Leave as business observation if no technical issue exists.

Closure evidence:

- Include expected vs actual minting, top causes, affected operators, and whether this was technical or business-driven.

<a id="no-trading-activity"></a>

## NoTradingActivity

Owner: product-operations. Severity: info.

Signal: no trades executed in the last 6 hours.

Immediate actions:

- Determine whether no trading is expected due to market hours, maintenance, low liquidity, or customer behavior.
- Confirm marketplace listing, purchase, settlement, API, wallet, and chain write paths are healthy.
- Check customer support and sales channels for buyer/seller friction.

Diagnostics:

- Review order creation, purchase attempts, failed settlements, wallet connection errors, and listing availability.
- Compare with API latency/errors, gas price spike, chain RPC health, and marketplace domain events.
- Verify no feature flag or maintenance banner disabled purchases.

Mitigation:

- Escalate to platform if technical purchase path is impaired.
- Escalate to product if liquidity, pricing, or onboarding is the cause.
- Communicate degraded marketplace status only if technical impairment is confirmed.

Closure evidence:

- Include trading window, attempted purchases, technical health status, and product follow-up if applicable.

<a id="high-retirement-rate"></a>

## HighRetirementRate

Owner: product-operations. Severity: info.

Signal: retirements exceed 50 percent of minting rate over 6 hours.

Immediate actions:

- Confirm whether retirement activity maps to known customer campaign, compliance deadline, or automated retirement job.
- Check retirement records, token balances, domain events, and customer references.
- Verify there are no duplicate or unauthorized retirement requests.

Diagnostics:

- Segment retirements by tenant, wallet, credit instrument, reason, and API client.
- Compare with marketplace purchases, API error rate, unusual transaction volume, and large transfer alerts.
- Confirm retired credits cannot be transferred or re-retired.

Mitigation:

- If activity is expected, notify product and support with context.
- If suspicious, pause affected API client or wallet flows and escalate to security-response.
- Reconcile retirement proofs and customer-facing certificates.

Closure evidence:

- Include retirement IDs, customer approval evidence, duplicate checks, and final reconciliation.

<a id="ssl-certificate-expiring-soon"></a>

## SSLCertificateExpiringSoon

Owner: platform-infrastructure. Severity: warning.

Signal: certificate expires within 30 days.

Immediate actions:

- Identify domain, certificate authority, renewal method, environment, and owner.
- Confirm automatic renewal is configured and has not failed due to DNS, ACME, issuer, or ingress issues.
- Schedule renewal before customer-facing risk reaches the critical threshold.

Diagnostics:

- Check certificate chain, DNS validation, ingress annotations, issuer logs, and secret rotation status.
- Confirm all endpoints using the certificate are covered by the renewed SAN list.
- Verify blackbox probes will observe the new certificate after deployment.

Mitigation:

- Renew certificate through standard automation or approved manual process.
- Update DNS/issuer configuration if validation is failing.
- Avoid last-minute manual certificate swaps without rollback plan.

Closure evidence:

- Include old/new expiry, issuer, affected domains, validation status, and probe confirmation.

<a id="ssl-certificate-expiry-critical"></a>

## SSLCertificateExpiryCritical

Owner: platform-infrastructure. Severity: critical.

Signal: certificate expires within 7 days.

Immediate actions:

- Open an infrastructure incident and assign a certificate renewal lead immediately.
- Confirm whether automated renewal can complete before expiry; if not, prepare manual renewal with peer review.
- Notify API, web, docs, and customer support owners of risk window.

Diagnostics:

- Identify blocking DNS, issuer, rate-limit, secret, ingress, or deployment issue.
- Verify no endpoint still serves stale certificate after renewal.
- Check whether customers or integrations pin certificate chains.

Mitigation:

- Complete renewal and roll out updated secret across all affected ingress/load balancer targets.
- If renewal is blocked, route traffic to endpoint with valid certificate only if service identity remains correct.
- Monitor blackbox probes continuously until expiry horizon is safe.

Closure evidence:

- Include renewed certificate fingerprint, expiry date, affected endpoints, probe results, and prevention follow-up.
