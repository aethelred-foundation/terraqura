# TerraQura Disaster Recovery Plan

> **Classification:** CONFIDENTIAL - INTERNAL USE ONLY
> **Version:** 1.0.0
> **Last Updated:** February 2026
> **Owner:** TerraQura Security Team

---

## Table of Contents

1. [Emergency Contact Tree](#1-emergency-contact-tree)
2. [Incident Severity Classification](#2-incident-severity-classification)
3. [Contract Pause Procedures](#3-contract-pause-procedures)
4. [Fund Recovery Procedures](#4-fund-recovery-procedures)
5. [Communication Templates](#5-communication-templates)
6. [War Room Runbook](#6-war-room-runbook)
7. [Post-Incident Procedures](#7-post-incident-procedures)
8. [Testing & Drills](#8-testing--drills)

---

## 1. Emergency Contact Tree

### Primary Response Team

| Role | Name | Phone | Telegram | Availability |
|------|------|-------|----------|--------------|
| **Incident Commander** | [REDACTED] | [REDACTED] | @terraqura_ic | 24/7 |
| **Technical Lead** | [REDACTED] | [REDACTED] | @terraqura_tech | 24/7 |
| **Security Lead** | [REDACTED] | [REDACTED] | @terraqura_sec | 24/7 |
| **Communications Lead** | [REDACTED] | [REDACTED] | @terraqura_comms | Business hours |
| **Legal Counsel** | [REDACTED] | [REDACTED] | @terraqura_legal | On-call |

### Escalation Path

```
L1: On-Call Engineer (PagerDuty) → 5 min response
    ↓ (if P1/P2)
L2: Technical Lead → 15 min response
    ↓ (if security breach or >$100K at risk)
L3: Incident Commander + Security Lead → 30 min response
    ↓ (if >$1M at risk or public disclosure)
L4: Full Executive Team + Legal → 1 hour response
```

### External Contacts

| Service | Contact | Purpose |
|---------|---------|---------|
| AWS Support | Enterprise Support Portal | Infrastructure issues |
| Polygon Team | security@polygon.technology | Chain-level issues |
| Alchemy Support | support@alchemy.com | RPC issues |
| Immunefi | [Bug Bounty Dashboard] | Vulnerability reports |
| Legal Firm | [REDACTED] | Legal guidance |
| PR Agency | [REDACTED] | Crisis communications |

---

## 2. Incident Severity Classification

### P1 - Critical (Immediate Response Required)

**Definition:** Active exploit, funds at immediate risk, or complete service outage.

**Examples:**
- Active smart contract exploit
- Unauthorized fund transfers detected
- Private key compromise suspected
- Complete platform outage
- Circuit breaker auto-triggered by anomaly

**Response Time:** 5 minutes
**Communication:** Immediate internal alert + user notification within 1 hour

### P2 - High (Urgent Response Required)

**Definition:** Significant security concern, major functionality impaired, or potential exploit identified.

**Examples:**
- Vulnerability reported via bug bounty
- Failed transaction spike (>10%)
- Database replication failure
- RPC node failure (all backups)
- Unusual transaction patterns

**Response Time:** 15 minutes
**Communication:** Internal alert + status page update within 2 hours

### P3 - Medium (Business Hours Response)

**Definition:** Non-critical functionality affected, potential security concern under investigation.

**Examples:**
- Single service degradation
- Non-critical bug in production
- Minor anomaly in metrics
- Certificate expiration warning

**Response Time:** 4 hours
**Communication:** Internal tracking + scheduled fix

### P4 - Low (Scheduled Response)

**Definition:** Minor issues, informational alerts, planned maintenance.

**Examples:**
- Performance optimization opportunities
- Non-urgent bug fixes
- Documentation updates

**Response Time:** Next business day
**Communication:** Standard ticket workflow

---

## 3. Contract Pause Procedures

### 3.1 Global Pause (Circuit Breaker)

**Who Can Execute:** Any authorized PAUSER_ROLE holder

**When to Use:**
- Active exploit detected
- Suspicious transaction patterns
- Security vulnerability disclosure
- Chain instability

**Procedure:**

```bash
# Step 1: Verify you have PAUSER_ROLE
cast call $CIRCUIT_BREAKER "isPauser(address)(bool)" $YOUR_ADDRESS

# Step 2: Activate global pause
cast send $CIRCUIT_BREAKER "activateGlobalPause(string)" "REASON: [brief description]" --private-key $PAUSER_KEY

# Step 3: Verify pause is active
cast call $CIRCUIT_BREAKER "globalPause()(bool)"
# Should return: true

# Step 4: Notify team via PagerDuty
curl -X POST https://events.pagerduty.com/v2/enqueue \
  -H "Content-Type: application/json" \
  -d '{
    "routing_key": "[PAGERDUTY_KEY]",
    "event_action": "trigger",
    "payload": {
      "summary": "CIRCUIT BREAKER ACTIVATED",
      "severity": "critical",
      "source": "manual-trigger"
    }
  }'
```

### 3.2 Per-Contract Pause

**When to Use:**
- Issue isolated to specific contract
- Targeted maintenance
- Single contract vulnerability

**Procedure:**

```bash
# Pause specific contract
cast send $CIRCUIT_BREAKER "pauseContract(address,string)" $TARGET_CONTRACT "REASON: [description]" --private-key $PAUSER_KEY

# Verify
cast call $CIRCUIT_BREAKER "getContractStatus(address)(bool,uint8,uint256,string)" $TARGET_CONTRACT
```

### 3.3 Unpause Procedure

**Who Can Execute:** OWNER only (multisig required)

**Requirements:**
- Root cause identified and mitigated
- Security review completed
- At least 3-of-5 multisig approval
- 1-hour cooldown period observed

**Procedure:**

```bash
# Step 1: Prepare multisig transaction
# This must be proposed through the multisig

# Step 2: Wait for cooldown (1 hour minimum after last pause)
cast call $CIRCUIT_BREAKER "lastUnpause(address)(uint256)" $TARGET_CONTRACT

# Step 3: Execute via multisig
# Submit transaction: CircuitBreaker.unpauseContract(address)
# Wait for 3/5 confirmations
# Execute transaction

# Step 4: Verify unpause
cast call $CIRCUIT_BREAKER "isOperationAllowed(address)(bool)" $TARGET_CONTRACT
```

---

## 4. Fund Recovery Procedures

### 4.1 Emergency Treasury Withdrawal

**Prerequisites:**
- 3-of-5 multisig approval
- 48-hour timelock delay (cannot be bypassed)
- Documented justification

**Procedure:**

```bash
# Step 1: Submit timelock proposal
# Target: Treasury contract
# Value: Amount to withdraw
# Description: "Emergency withdrawal - [reason]"

# Step 2: Wait for 48-hour delay

# Step 3: Execute after delay expires
```

### 4.2 User Fund Recovery (Stuck Transactions)

**Scenario:** User funds stuck due to failed transaction

**Procedure:**

1. Identify stuck transaction hash
2. Verify funds are recoverable
3. If contract issue: Fix via upgrade (timelock)
4. If user error: Provide recovery instructions
5. Document in incident report

### 4.3 Buffer Pool Emergency Drawdown

**When to Use:** Insurance claims exceed normal reserves

**Procedure:**

```bash
# Requires TREASURY_ROLE + timelock

# Step 1: Calculate required drawdown
# Step 2: Submit via timelock with 7-day delay (high-value)
# Step 3: Notify affected policyholders
# Step 4: Execute after delay
```

---

## 5. Communication Templates

### 5.1 Initial Incident Notification (Internal)

```markdown
🚨 INCIDENT ALERT - P[X]

**Time Detected:** [UTC timestamp]
**Detected By:** [Person/System]
**Initial Classification:** [P1/P2/P3/P4]

**Summary:**
[1-2 sentence description]

**Immediate Actions Taken:**
- [ ] Circuit breaker activated
- [ ] Team notified
- [ ] War room opened

**Current Status:** INVESTIGATING

**Next Update:** [time]

War Room: [Slack channel / Zoom link]
```

### 5.2 User-Facing Status Update

```markdown
# Service Disruption Notice

**Status:** [Investigating / Identified / Monitoring / Resolved]
**Impact:** [Description of user impact]
**Started:** [Time UTC]

## Current Situation
[Brief, non-technical description]

## What We're Doing
[Actions being taken]

## What You Can Do
[User actions if any]

## Next Update
We will provide an update by [time UTC].

---
Questions? Contact support@terraqura.io
```

### 5.3 Post-Incident Summary (Public)

```markdown
# Incident Report: [Title]

**Date:** [Date]
**Duration:** [Start time] - [End time] UTC
**Severity:** [P1/P2/P3]
**Impact:** [User impact summary]

## Summary
[2-3 paragraph summary of what happened]

## Timeline
- **[Time]:** [Event]
- **[Time]:** [Event]
- ...

## Root Cause
[Technical explanation at appropriate level]

## Resolution
[How the issue was resolved]

## Preventive Measures
[What we're doing to prevent recurrence]

## Affected Users
[Any compensation or follow-up actions]

---
Contact: security@terraqura.io
```

---

## 6. War Room Runbook

### 6.1 Opening the War Room

**Trigger:** P1 or P2 incident declared

**Checklist:**

- [ ] Create dedicated Slack channel: `#incident-YYYY-MM-DD-[brief-name]`
- [ ] Start Zoom call (persistent link: [REDACTED])
- [ ] Page Incident Commander if not present
- [ ] Create incident document from template
- [ ] Assign roles:
  - Incident Commander (coordinates)
  - Technical Lead (investigation)
  - Communications Lead (updates)
  - Scribe (documentation)

### 6.2 War Room Rules

1. **Single source of truth:** All decisions in incident document
2. **Clear communication:** State name before speaking
3. **No blame:** Focus on resolution, not fault
4. **Regular updates:** Status every 15 minutes
5. **Decisions documented:** Log who decided what and why

### 6.3 Investigation Checklist

#### Smart Contract Issues

- [ ] Check recent transactions on PolygonScan
- [ ] Review The Graph indexer for anomalies
- [ ] Check contract balances vs expected
- [ ] Review recent multisig transactions
- [ ] Check for pending timelock operations
- [ ] Analyze logs in CloudWatch/Datadog

#### Infrastructure Issues

- [ ] Check AWS Health Dashboard
- [ ] Verify EKS cluster health
- [ ] Check RDS metrics and connections
- [ ] Verify Redis cluster status
- [ ] Check Alchemy RPC status
- [ ] Review CDN and WAF logs

### 6.4 Resolution Verification

Before declaring resolved:

- [ ] Root cause identified
- [ ] Fix deployed and verified
- [ ] Monitoring shows normal operation
- [ ] No user reports in last 30 minutes
- [ ] Relevant parties notified

---

## 7. Post-Incident Procedures

### 7.1 Incident Close-Out

- [ ] Final status update published
- [ ] War room channel archived
- [ ] Incident document completed
- [ ] Action items assigned
- [ ] Timeline frozen (no edits)

### 7.2 Post-Mortem Schedule

| Severity | Post-Mortem Required | Timeline |
|----------|---------------------|----------|
| P1 | Yes - Full review | Within 72 hours |
| P2 | Yes - Standard | Within 1 week |
| P3 | Optional | Within 2 weeks |
| P4 | No | - |

### 7.3 Post-Mortem Template

```markdown
# Post-Mortem: [Incident Title]

**Date of Incident:** [Date]
**Post-Mortem Date:** [Date]
**Author:** [Name]
**Attendees:** [Names]

## Executive Summary
[3-5 sentences]

## Impact
- Users affected: [number]
- Duration: [time]
- Financial impact: [if applicable]
- Reputation impact: [assessment]

## Timeline
[Detailed timeline with timestamps]

## Root Cause Analysis
### Contributing Factors
1. [Factor]
2. [Factor]

### 5 Whys Analysis
- Why did X happen? Because Y
- Why did Y happen? Because Z
...

## What Went Well
- [Item]
- [Item]

## What Went Wrong
- [Item]
- [Item]

## Action Items
| Action | Owner | Priority | Due Date | Status |
|--------|-------|----------|----------|--------|
| [Action] | [Name] | [P1/P2/P3] | [Date] | [Status] |

## Lessons Learned
[Key takeaways]
```

---

## 8. Testing & Drills

### 8.1 Quarterly Drill Schedule

| Quarter | Drill Type | Scenario |
|---------|-----------|----------|
| Q1 | Tabletop | Smart contract exploit |
| Q2 | Live (Testnet) | Circuit breaker activation |
| Q3 | Tabletop | Key compromise |
| Q4 | Live (Testnet) | Full disaster recovery |

### 8.2 Drill Execution Checklist

- [ ] Schedule drill 2 weeks in advance
- [ ] Notify all participants
- [ ] Prepare scenario details (sealed until drill)
- [ ] Set up isolated test environment
- [ ] Assign observers
- [ ] Run drill (2-4 hours)
- [ ] Debrief immediately after
- [ ] Document findings within 1 week

### 8.3 Success Criteria

| Metric | Target | Measurement |
|--------|--------|-------------|
| Time to detect | < 5 min | From injection to alert |
| Time to respond | < 15 min | From alert to war room |
| Time to mitigate | < 1 hour | From war room to pause |
| Communication quality | 90%+ | Survey score |

---

## Appendix A: Contract Addresses (Production)

```
CircuitBreaker:     [TO BE DEPLOYED]
Multisig:           [TO BE DEPLOYED]
Timelock:           [TO BE DEPLOYED]
CarbonCredit:       [TO BE DEPLOYED]
Marketplace:        [TO BE DEPLOYED]
AccessControl:      [TO BE DEPLOYED]
```

## Appendix B: Monitoring Dashboards

- Grafana: https://grafana.terraqura.io
- CloudWatch: AWS Console → CloudWatch → Dashboards
- The Graph: https://thegraph.com/hosted-service/subgraph/terraqura/carbon-credits
- Tenderly: https://dashboard.tenderly.co/terraqura

## Appendix C: Version History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | Feb 2026 | Security Team | Initial release |

---

**This document must be reviewed and updated quarterly.**

**Next Review Date:** May 2026
