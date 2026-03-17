# TerraQura Compliance Framework

> Regulatory compliance architecture for the institutional-grade carbon credit platform.

---

## Regulatory Overview

TerraQura is designed to operate within the regulatory frameworks governing carbon markets, digital assets, and environmental instruments. The platform implements compliance controls at every layer -- from smart contract access control to API-level KYC gating.

---

## ADGM Regulatory Framework

TerraQura operates under the Abu Dhabi Global Market (ADGM) regulatory framework, which provides a comprehensive legal structure for digital asset platforms:

- **Financial Services Regulatory Authority (FSRA)** -- Oversees the issuance and trading of tokenised carbon credits as digital assets.
- **Virtual Asset Regulatory Framework** -- Carbon credits tokenised as ERC-1155 tokens fall under ADGM's virtual asset classification, requiring operator licensing and custody safeguards.
- **Market Infrastructure** -- The marketplace and auction modules are designed to comply with ADGM's requirements for organised trading facilities, including pre- and post-trade transparency.

### Compliance Controls

| Control | Implementation |
|---------|----------------|
| Operator licensing | All DAC unit operators must complete KYC and be whitelisted by an admin before minting credits. |
| Custody | Credits remain in the owner's self-custodial wallet. The platform does not take custody of user assets. |
| Market surveillance | The Activity module provides an immutable audit trail of all trades, listings, and transfers. |
| AML/CFT | KYC integration via Sumsub with tiered access control restricts high-value operations to verified users. |

---

## ITMO / Article 6 Paris Agreement Compliance

Internationally Transferred Mitigation Outcomes (ITMOs) under Article 6 of the Paris Agreement provide the framework for cross-border carbon credit transfers. TerraQura's compliance approach:

### ITMORegistry Contract

The `ITMORegistry` smart contract maintains an on-chain record of:

- **Retirement-to-ITMO linkages** -- Each retired credit can be linked to an ITMO serial number, enabling traceability from the physical DAC capture event through to the international transfer.
- **Corresponding adjustments** -- The registry records the host country and acquiring country for each transfer, supporting the corresponding adjustment process required under Article 6.2.
- **Vintage and methodology** -- Each ITMO record includes the credit vintage period and the verification methodology used, enabling registry interoperability.

### Article 6 Requirements

| Requirement | TerraQura Implementation |
|-------------|--------------------------|
| Environmental integrity | Proof-of-Physics verification with on-chain data hashes prevents double-counting and ensures additionality. |
| Transparency | All verification data, provenance chains, and retirement events are publicly queryable on-chain. |
| Corresponding adjustments | ITMORegistry records host/acquiring country pairs for cross-border transfers. |
| Avoidance of double counting | Credits are ERC-1155 tokens; retirement burns the token, making reuse cryptographically impossible. |
| Contribution to overall mitigation | Retirement certificates record the environmental claim, enabling Article 6.4 mechanism reporting. |

---

## KYC Tier Structure

TerraQura implements a tiered KYC model that progressively unlocks platform capabilities as users complete higher levels of identity verification.

### Tier Definitions

| Tier | Name | Verification | Access |
|------|------|-------------|--------|
| **Tier 0** | Unverified | Wallet connection only | View-only access. Can browse marketplace listings, view analytics, and read public data. Cannot trade, mint, or retire credits. |
| **Tier 1** | Basic | Email + wallet signature verification | Can purchase credits on the marketplace (up to 100 credits/month). Can view portfolio and activity history. |
| **Tier 2** | Enhanced | Government ID + liveness check (via Sumsub) | Full marketplace access (listings, offers, purchases) with no monthly cap. Can retire credits and receive certificates. Can register DAC units. |
| **Tier 3** | Institutional | Enhanced due diligence, corporate documentation, beneficial ownership declaration | Batch auction participation. API key provisioning for sensor integration. Access to CarbonVault and CarbonFutures DeFi contracts. Gasless transaction sponsorship. |

### KYC Flow

1. User connects wallet (Tier 0).
2. User calls `POST /v1/kyc/initiate` with identity details.
3. Sumsub conducts the verification check asynchronously.
4. Sumsub sends a webhook to `POST /v1/kyc/webhook` with the result.
5. The API updates the user's KYC status and JWT claims.
6. The `ComplianceRegistry` contract is updated with the on-chain attestation (hash of KYC record, not PII).

### On-Chain Attestation

The `ComplianceRegistry` contract stores KYC attestations as:

- Wallet address to KYC tier mapping.
- Jurisdiction whitelist (which countries the wallet is authorised to trade from).
- Transfer restriction flags (sanctions screening results, stored as boolean flags without PII).

No personally identifiable information (PII) is stored on-chain. Only cryptographic attestations (hashes) that prove a verification occurred.

---

## Data Residency

### UAE Data Sovereignty

| Data Category | Storage Location | Justification |
|---------------|-----------------|---------------|
| KYC documents (PII) | Sumsub (UAE-hosted instance) | ADGM data protection regulations require PII to remain within UAE jurisdiction. |
| Sensor telemetry | PostgreSQL + TimescaleDB (UAE region) | IoT data sovereignty and latency requirements. |
| Transaction records | Aethelred L1 (distributed) | Blockchain data is globally distributed but the primary RPC infrastructure is UAE-hosted. |
| API logs and audit trails | UAE-region cloud infrastructure | Regulatory requirement for audit data accessibility by ADGM supervisory authorities. |
| Credit metadata | IPFS + Arweave (distributed) | Metadata is content-addressed and immutable; geographic distribution is inherent to the protocol. |

### Cross-Border Data Transfers

When credits are traded internationally (ITMO transfers), only the following data crosses borders:

- On-chain transaction data (public blockchain, no PII).
- ITMO registry records (credit serial numbers, vintage, methodology -- no PII).
- Retirement certificate metadata (environmental claim details -- no PII).

PII (KYC documents, personal details) never leaves the UAE data residency boundary.

---

## Privacy Architecture

TerraQura follows a strict separation between on-chain and off-chain data:

### Off-Chain (Private)

- Full KYC records and identity documents.
- Wallet-to-identity mappings.
- Sensor raw data and device credentials.
- API access logs with IP addresses.
- Webhook endpoint URLs and secrets.

### On-Chain (Public)

- KYC attestation hashes (proves verification occurred, no PII).
- Credit token balances and transfer history.
- Retirement events and certificate metadata.
- Verification source data hashes (proves data integrity, not the data itself).
- ITMO registry records (serial numbers, countries, methodology).
- Marketplace listing and trade settlement records.

### Data Minimisation

- Sensor readings are aggregated before on-chain submission; individual readings remain off-chain.
- KYC tier levels are stored on-chain as integer values (0-3), not as verification details.
- Activity logs record action types and resource IDs but not request payloads.

---

## Audit Trail

### Immutable Activity Log

The Activity module (`/v1/activity`) provides a comprehensive, append-only audit trail of all platform operations:

| Property | Description |
|----------|-------------|
| **Completeness** | Every state-changing API call generates an activity record. |
| **Immutability** | Activity records are append-only. No deletion or modification is possible through the API. |
| **Attribution** | Each record includes the authenticated wallet address and user type. |
| **Timestamping** | Server-side timestamps with millisecond precision. |
| **Exportability** | CSV export endpoint for regulatory reporting. |

### Tracked Actions

All 28 action types are tracked:

- Credit lifecycle: `credit.minted`, `credit.retired`, `credit.transferred`
- Marketplace: `listing.created`, `listing.cancelled`, `listing.purchased`, `offer.created`, `offer.accepted`, `offer.cancelled`
- Verification: `verification.started`, `verification.completed`, `verification.failed`
- KYC: `kyc.submitted`, `kyc.approved`, `kyc.rejected`
- Infrastructure: `webhook.registered`, `webhook.deleted`, `api_key.created`, `api_key.revoked`
- IoT: `sensor.reading_submitted`, `dac_unit.registered`, `dac_unit.updated`

### On-Chain Audit

In addition to the off-chain activity log, all on-chain operations emit Solidity events that are indexed by The Graph subgraph (`packages/subgraph/`), providing a second, independently verifiable audit trail on the blockchain.

---

## Compliance Checklist

| # | Requirement | Status |
|---|-------------|--------|
| 1 | KYC/AML integration | Implemented (Sumsub) |
| 2 | Tiered access control | Implemented (4 tiers) |
| 3 | On-chain transfer restrictions | Implemented (ComplianceRegistry) |
| 4 | ITMO registry linkage | Implemented (ITMORegistry contract) |
| 5 | Immutable audit trail | Implemented (Activity module + on-chain events) |
| 6 | UAE data residency | Implemented (infrastructure configuration) |
| 7 | PII off-chain separation | Implemented (hash-only attestations on-chain) |
| 8 | Emergency pause capability | Implemented (CircuitBreaker + PAUSER_ROLE) |
| 9 | Multisig governance | Implemented (TerraQuraMultisig) |
| 10 | Timelock on upgrades | Implemented (TerraQuraTimelock) |
| 11 | Double-counting prevention | Implemented (ERC-1155 burn on retirement) |
| 12 | Cross-border transfer tracking | Implemented (ITMORegistry corresponding adjustments) |
