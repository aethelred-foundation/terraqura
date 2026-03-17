# TerraQura Smart Contract Security Audit RFP

**Document Version:** 1.0.0
**Date:** February 2, 2026
**Prepared By:** TerraQura Engineering Team
**Contact:** security@terraqura.io

---

## Executive Summary

TerraQura is seeking proposals from qualified security audit firms to conduct a comprehensive security assessment of our blockchain-based carbon credit verification and trading platform. The audit scope encompasses 8 smart contracts deployed on Polygon, implementing ERC-1155 tokens, UUPS upgradeable proxies, multi-signature governance, and meta-transaction support.

### Project Overview

TerraQura is a institutional-grade carbon asset platform that transforms carbon credits from vague paper promises into high-fidelity digital assets using Proof-of-Physics verification. The platform enables:

- **Direct Air Capture (DAC) Verification**: Three-phase cryptographic verification of carbon capture events
- **Carbon Credit Tokenization**: ERC-1155 tokens representing verified CO₂ removal
- **P2P Marketplace**: Decentralized trading with platform fee collection
- **Gasless Transactions**: Meta-transaction support for improved UX
- **Enterprise Governance**: Multi-signature wallet with timelock protection

---

## Scope of Audit

### In-Scope Contracts

| Contract | Type | SLOC | Complexity |
|----------|------|------|------------|
| TerraQuraAccessControl.sol | UUPS Proxy | ~150 | Medium |
| VerificationEngine.sol | UUPS Proxy | ~300 | High |
| CarbonCredit.sol | UUPS Proxy (ERC-1155) | ~400 | High |
| CarbonMarketplace.sol | UUPS Proxy | ~350 | High |
| TerraQuraMultisig.sol | Standard | ~250 | Medium |
| TerraQuraTimelock.sol | Standard | ~200 | Medium |
| CircuitBreaker.sol | UUPS Proxy | ~200 | Medium |
| GaslessMarketplace.sol | UUPS Proxy | ~280 | High |

**Total Estimated SLOC:** ~2,130

### Technical Stack

- **Solidity Version:** 0.8.32
- **Framework:** Hardhat with TypeScript
- **Libraries:** OpenZeppelin Contracts v5.x
- **Network:** Polygon PoS (Mainnet deployment target)
- **Testing:** 562 tests with 100% statement coverage

### Key Areas of Focus

1. **UUPS Upgrade Mechanism**
   - Storage layout consistency across upgrades
   - Authorization controls for `_authorizeUpgrade`
   - Implementation initialization protection

2. **Verification Engine Logic**
   - Proof-of-Physics validation correctness
   - DAC unit whitelisting integrity
   - Energy-to-CO₂ ratio calculations
   - Replay attack prevention

3. **ERC-1155 Implementation**
   - Token minting authorization
   - Transfer restrictions for verification status
   - Balance tracking accuracy
   - Metadata URI handling

4. **Marketplace Security**
   - Reentrancy protection
   - Price manipulation resistance
   - Fee calculation accuracy
   - Listing state management

5. **Governance Controls**
   - Multi-signature threshold enforcement
   - Timelock delay enforcement
   - Emergency pause mechanisms
   - Role-based access control

6. **Meta-Transaction Security**
   - Signature verification
   - Nonce management
   - Replay attack prevention
   - Gas sponsorship model

---

## Current Security Posture

### Existing Protections

- ✅ OpenZeppelin ReentrancyGuard on all external payable functions
- ✅ Role-based access control (RBAC) with separation of duties
- ✅ UUPS proxy pattern with authorized upgrader role
- ✅ Circuit breaker for emergency pause across all contracts
- ✅ 2-of-3 multi-signature requirement for admin operations
- ✅ 24-hour timelock delay for governance actions
- ✅ Input validation on all external functions
- ✅ 100% test coverage with fuzz testing

### Known Considerations

1. **Centralization Risk**: Initial deployment has deployer as admin. Plan to transfer to Multisig post-audit.
2. **Oracle Dependency**: Future integration with Chainlink for price feeds (not in current scope).
3. **Upgradability**: UUPS pattern introduces upgrade risks that should be thoroughly analyzed.

---

## Deliverables Expected

### Primary Deliverables

1. **Comprehensive Audit Report**
   - Executive summary for non-technical stakeholders
   - Detailed findings with severity classification (Critical/High/Medium/Low/Informational)
   - Proof-of-concept exploits where applicable
   - Gas optimization recommendations
   - Best practice recommendations

2. **Severity Classification Standards**
   - **Critical**: Direct loss of funds or permanent DoS
   - **High**: Significant financial impact or governance bypass
   - **Medium**: Limited financial impact or state corruption
   - **Low**: Minor issues or best practice violations
   - **Informational**: Code quality and optimization suggestions

3. **Remediation Verification**
   - Re-audit of all Critical and High findings after fixes
   - Written confirmation of remediation effectiveness

### Secondary Deliverables

4. **Threat Model Document**
   - Attack surface analysis
   - Trust assumptions
   - Potential attack vectors

5. **Gas Optimization Report**
   - Function-level gas analysis
   - Storage optimization opportunities
   - Loop and iteration improvements

---

## Timeline Requirements

| Phase | Duration | Activities |
|-------|----------|------------|
| Kickoff | 1 day | Code walkthrough, Q&A session |
| Primary Audit | 2-3 weeks | Full code review and testing |
| Initial Report | 3 days | Draft findings delivery |
| Remediation | 1 week | TerraQura fixes critical/high issues |
| Re-audit | 3-5 days | Verification of fixes |
| Final Report | 2 days | Final report delivery |

**Target Completion:** Before mainnet deployment (estimated 4-6 weeks from engagement)

---

## Proposal Requirements

### Company Information

- Company name and legal entity
- Year established
- Number of security researchers
- Relevant certifications (if any)

### Team Qualifications

- Lead auditor credentials
- Team composition for this engagement
- Prior experience with:
  - ERC-1155 tokens
  - UUPS upgradeable contracts
  - Marketplace/DEX protocols
  - Carbon credit or RWA platforms

### Portfolio

- List of 5+ relevant audits completed
- Public audit reports (links)
- Notable findings discovered
- Client references (optional)

### Methodology

- Static analysis tools used
- Dynamic testing approach
- Manual review process
- Formal verification capabilities (if any)

### Pricing

- Fixed price for defined scope
- Hourly rates for scope changes
- Re-audit pricing
- Payment terms

### Availability

- Proposed start date
- Estimated completion date
- Communication channels

---

## Technical Resources

### Repository Access

Upon engagement, auditors will receive:

- Private GitHub repository access
- Technical documentation
- Architecture diagrams
- Test suite and coverage reports

### Available Documentation

- Contract architecture overview
- Function-level specifications
- State machine diagrams
- Role permission matrix
- Upgrade procedures

### Point of Contact

- **Technical Lead**: Available for daily standups
- **Security Contact**: For vulnerability reports
- **Slack/Discord**: Real-time communication channel

---

## Evaluation Criteria

Proposals will be evaluated on:

| Criteria | Weight |
|----------|--------|
| Team expertise and track record | 30% |
| Methodology and thoroughness | 25% |
| Timeline feasibility | 20% |
| Cost effectiveness | 15% |
| Communication and availability | 10% |

---

## Submission Instructions

Please submit proposals to: **audit@terraqura.io**

**Subject Line:** "TerraQura Security Audit Proposal - [Company Name]"

**Deadline:** [To be determined based on mainnet schedule]

**Format:** PDF or Markdown

### Required Attachments

1. Company profile
2. Team resumes/CVs
3. Sample audit report (redacted if necessary)
4. Pricing breakdown
5. Proposed timeline

---

## Appendix A: Contract Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     TERRAQURA ARCHITECTURE                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────┐         ┌──────────────────┐             │
│  │  AccessControl   │◄────────│    Multisig      │             │
│  │  (UUPS Proxy)    │         │   (2-of-3)       │             │
│  └────────┬─────────┘         └────────┬─────────┘             │
│           │                            │                        │
│           ▼                            ▼                        │
│  ┌──────────────────┐         ┌──────────────────┐             │
│  │ Verification     │         │    Timelock      │             │
│  │ Engine           │         │   (24h delay)    │             │
│  │ (UUPS Proxy)     │         └──────────────────┘             │
│  └────────┬─────────┘                                          │
│           │                                                     │
│           ▼                                                     │
│  ┌──────────────────┐                                          │
│  │  CarbonCredit    │◄───────┐                                 │
│  │  (ERC-1155)      │        │                                 │
│  │  (UUPS Proxy)    │        │                                 │
│  └────────┬─────────┘        │                                 │
│           │                   │                                 │
│           ▼                   │                                 │
│  ┌──────────────────┐  ┌─────┴────────────┐                    │
│  │ CarbonMarket-    │  │ GaslessMarket-   │                    │
│  │ place            │  │ place            │                    │
│  │ (UUPS Proxy)     │  │ (UUPS Proxy)     │                    │
│  └────────┬─────────┘  └──────────────────┘                    │
│           │                                                     │
│           ▼                                                     │
│  ┌──────────────────┐                                          │
│  │ CircuitBreaker   │                                          │
│  │ (Emergency Pause)│                                          │
│  │ (UUPS Proxy)     │                                          │
│  └──────────────────┘                                          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Appendix B: Deployed Contracts (Testnet)

**Network:** Polygon Amoy (Chain ID: 80002)
**Solidity:** 0.8.32
**Status:** All contracts verified on Polygonscan

| Contract | Proxy Address | Implementation |
|----------|---------------|----------------|
| AccessControl | 0x55695aAAEC30AB495074c57e85Ae2E1A4866B83b | 0x7e3bf0EBAF28bcC9A7d96a54Ad6FFEfA0b4Ebc17 |
| VerificationEngine | 0x8dad7E87646e9607Fae225e3A7EAD17ce179dEA8 | 0x2b7881C372f2244020c91c2d8c2421513Cf769c0 |
| CarbonCredit | 0x29B58064fD95b175e5824767d3B18bACFafaF959 | 0xBF82A70152CAA15cdD8f451128ccF5a7A7b8155c |
| CarbonMarketplace | 0x5a4cb32709AB829E2918F0a914FBa1e0Dab2Fdec | 0x85b13A91e1DE82a6eE628dc17865bfAED01a49de |
| Multisig | 0x0805E6ffDE71fd798F3Fe787D1dC907aABA65bAD | N/A |
| Timelock | 0xb8b01581d61Bf2D58B8B8626Ebb7Ab959ccF6354 | N/A |
| CircuitBreaker | 0x24192ecf06aA782F1dF69878413D217d9319e257 | 0x324a72C8A99D27C2d285Feb837Ee4243Fb6ee938 |
| GaslessMarketplace | 0x45a65e46e8C1D588702cB659b7d3786476Be0A80 | 0x6Fbfe3A06a82d3357D21B16bAad92dc14103c45B |

---

## Appendix C: Test Coverage Summary

```
-----------------------------|----------|----------|----------|----------|
File                         |  % Stmts | % Branch |  % Funcs |  % Lines |
-----------------------------|----------|----------|----------|----------|
All files                    |      100 |    85.71 |      100 |      100 |
 CarbonCredit.sol            |      100 |    88.89 |      100 |      100 |
 CarbonMarketplace.sol       |      100 |    83.33 |      100 |      100 |
 CircuitBreaker.sol          |      100 |    87.50 |      100 |      100 |
 GaslessMarketplace.sol      |      100 |    80.00 |      100 |      100 |
 TerraQuraAccessControl.sol  |      100 |    90.00 |      100 |      100 |
 TerraQuraMultisig.sol       |      100 |    85.71 |      100 |      100 |
 TerraQuraTimelock.sol       |      100 |    83.33 |      100 |      100 |
 VerificationEngine.sol      |      100 |    85.00 |      100 |      100 |
-----------------------------|----------|----------|----------|----------|
```

**Total Tests:** 562
**Passing:** 562
**Failed:** 0

---

## Confidentiality Notice

This document and all related materials are confidential and intended solely for the recipients to whom they are addressed. Unauthorized distribution, copying, or disclosure is strictly prohibited.

---

*Thank you for your interest in securing the TerraQura platform. We look forward to your proposal.*
