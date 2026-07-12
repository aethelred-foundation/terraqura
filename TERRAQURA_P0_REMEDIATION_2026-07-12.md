# TerraQura P0 Remediation Record

**Date:** 2026-07-12
**Scope:** repo-local fixes responding to the consultant review of `TERRAQURA_CONSULTANT_STATUS_REPORT_2026-07-12.md` ("Conditional GO for testnet hardening / NO-GO for production").
**Result:** every consultant P0 claim was **verified against source before fixing**; all confirmed. All repo-local P0 items are now fixed with regression tests. Contract suite: **1,603 tests passing, 0 failing** (was 1,585 pre-fix; 19 domain-invariant tests added, 1 bug-enshrining test inverted).

Items that require the Aethelred protocol repo or sibling dApp repos (P0.1 canonical ecosystem manifest, Wallet/ZeroID/NoblePay/Cruzible integration, external audit, methodology committee) are recorded in §3 as cross-repo actions — they cannot be closed from this repository.

---

## 1. Verification-first summary

| Consultant claim | Verified? | Fixed? |
|---|---|---|
| P0.2a `retireCredits` flags batch retired on *caller's* zero balance | ✅ confirmed | ✅ |
| P0.2b zero-amount retirement accepted (isRetired corruption) | ✅ confirmed | ✅ |
| P0.2c `CarbonRetirement` escrows instead of burning (reversible custody, dual accounting) | ✅ confirmed | ✅ |
| P0.2d certificates hardcode `"DAC"` / empty vintage | ✅ confirmed | ✅ |
| P0.3 marketplace/retirement never consult the seal after mint | ✅ confirmed | ✅ |
| P0.4 seal enforcement freely disable-able; anchors don't record policy | ✅ confirmed | ✅ |
| P0.5 CircuitBreaker wired into zero core contracts; unauthenticated limit consumption; `hasRoleAndKyc` ignores expiry | ✅ confirmed | ✅ |
| P0.6 duplicate KYC state; `kycRegistry` declared but never used (no setter existed at all); only one party checked at settlement | ✅ confirmed | ✅ |
| P0.7 launch gate omits sealProofOfPhysics / retirement contracts, no enforcement assertions | ✅ confirmed | ✅ |
| P0.8 README claims (25 contracts, "deployed to testnet", AETH, audit badge, blanket UUPS) | ✅ confirmed | ✅ |

---

## 2. What changed

### P0.2 — Retirement is now an irreversible, single-authority burn

`apps/contracts/contracts/core/CarbonCredit.sol`
- All retirement paths route through one internal `_retireFor` enforcing shared invariants:
  - **zero-amount retirements revert** (`InvalidRetirementAmount`) — previously a zero-balance caller could flag an entire batch retired without burning any supply;
  - **`isRetired` derives from the batch's remaining total supply**, never from one holder's balance (multi-holder safety); the same fix applies to `batchRetireCredits`, which had duplicated (and diverged) logic;
  - suspended (revoked-seal) batches cannot be normally retired (`CreditSuspended`).
- New `retireCreditsFrom(account, tokenId, amount, reason)` — the restricted burn authority for retirement manager contracts. Double-gated: caller must be an **approved retirer** (`setApprovedRetirer`, owner-only) *and* an **approved ERC-1155 operator** of the account (holder opt-in via `setApprovalForAll`, same UX as before).

`apps/contracts/contracts/core/CarbonRetirement.sol`
- `_executeRetirement` **burns via `retireCreditsFrom`** instead of transferring credits into upgradeable-contract custody. CarbonCredit is now the single retirement accounting authority; the retirement contract keeps records/indexes and mints certificates **in the same atomic transaction**.
- Certificates now carry **real credit metadata**: vintage derived on-chain from the credit's `captureTimestamp` (civil-from-days), methodology sourced from the token contract (`methodology()`), not hardcoded by the retirement contract.

### P0.3 — Revoked seals now suspend issued credits at every settlement path

- `CarbonCredit.isCreditActive(tokenId)`: false if nonexistent, retired, or — for seal-anchored batches — the consensus anchor is no longer live. Fail-closed: a seal-tier batch with a cleared registry reads *suspended*, not silently downgraded.
- Batches minted under enforcement are tagged `sealAnchoredToken[tokenId]` at mint, so the assurance tier is a recorded property of the batch.
- `CarbonMarketplace`: `createListing`, `purchase`, and `acceptOffer` all call `_requireCreditActive` — a seal revoked after listing blocks settlement on the next call (`CreditNotActive`).
- Normal retirement of a suspended batch reverts; corrective flows use the existing buffer-pool reversal mechanism.
- **Open policy item (deliberate):** the full credit state machine (SUSPENDED → ACTIVE/REVOKED/COMPENSATED, buffer-pool compensation rules, holder notification) is an economic/legal decision the consultant flagged as such — the enforced minimum (block listing/settlement/normal retirement) is implemented; the state-machine policy needs a product/legal decision before Phase 1 hardening.

### P0.4 — Seal assurance is sticky and reproducible

- `CarbonCredit.lockSealEnforcement()` — **one-way**. Only callable once enforcement is fully wired; afterwards neither `setSealRegistry` nor `setSealAnchorRequired` can ever change (`SealEnforcementIsLocked`). Intended at mainnet activation; the launch gate attests it.
- `SealProofOfPhysics` anchors now **snapshot the CEAP policy** at admission: `policyHash` + monotonic `policyVersion` stored per anchor; later policy changes cannot rewrite which rule admitted a historical anchor.

### P0.5 — The circuit breaker and role expiry are real

- `CarbonCredit._beforeTokenTransfer` consults the breaker on **every token movement** — mint, transfer, marketplace escrow/settlement, and every retirement burn all route through this ERC-1155 hook, so `activateGlobalPause` (and per-contract pause) actually halts the platform's critical transitions. Regression test proves mint/transfer/retire all revert under global pause and recover on unpause.
- `CircuitBreaker.checkRateLimit/checkVolumeLimit` are **self-reporting only** (`msg.sender == contractAddr`) — third parties can no longer exhaust another contract's budget.
- `TerraQuraAccessControl.hasRoleAndKyc` now uses `hasValidRole` — an **expired role fails authorization without an explicit revocation transaction** (test warps past expiry and asserts denial).

### P0.6 — One KYC authority, both parties rechecked at settlement

- `CarbonMarketplace.setKycRegistry` (this setter **did not exist** — the registry field was dead state). When set, ALL KYC decisions delegate to the platform authority (`IKycRegistry` → TerraQuraAccessControl: status + expiry + sanctions). The local boolean mapping is deprecated to test/bootstrap fallback and is ignored while a registry is configured.
- **Settlement-time rechecks:** `purchase` re-validates the *seller*; `acceptOffer` re-validates the *buyer* (previously each checked only one side, so a party whose KYC was revoked between listing/offer and settlement still settled).

### P0.7 — Launch gate now covers the feature that justifies the positioning

`scripts/production-launch-gate.mjs` + `packages/network-manifest`:
- Required non-zero addresses extended with `riskOracle`, `sealProofOfPhysics`, `carbonRetirement`, `retirementCertificate` (manifest schema extended to match; Amoy legacy truthfully carries zeros for structurally-absent contracts).
- New **enforcement attestation block** per deployment — the gate fails unless the deploy pipeline records, from live chain reads: `sealAnchorRequired`, `sealEnforcementLocked`, `kycRegistryConfigured`, `circuitBreakerWired`, `retirementWiredAsApprovedRetirer` — all `true`. Pending deployments carry all-false attestations, so the gate keeps failing honestly until a real deployment proves otherwise.
- `apps/contracts/scripts/deploy.ts` now deploys CarbonRetirement + RetirementCertificate + CircuitBreaker and wires the retirer approval, breaker, and marketplace KYC registry, so a real deployment *can* satisfy the attestations.
- Gate regression tests: 3/3 passing.

### P0.8 — Public claims corrected

`README.md`: 26 contracts (was 25, table row added for SealProofOfPhysics); status now says **pre-deployment on Aethelred** with Polygon Amoy explicitly legacy; native token **AETHEL** (was AETH); UUPS claim qualified (SealProofOfPhysics deliberately non-upgradeable); the "audit — 25 contracts reviewed" badge replaced with **"internal review … external audit pending"**; interface count corrected (17).

---

## 3. What this repo cannot close alone (consultant cross-repo P0s)

| Item | Owner | Status |
|---|---|---|
| P0.1 **Aethelred Ecosystem Release Manifest** (chain IDs, token symbol, precompile address/ABI, endpoints, compatible release tags) | Aethelred protocol repo | **Closed 2026-07-12 (cross-repo pass)** — `ecosystem/manifest.json` rewritten as v2.0.0: canonical EVM ids 7331/7332 (devnet shares 7332), deprecated-ids block (8821/88210 = never-deployed placeholders; 8821 is the SLIP-44 coin type), cosmos identity (aethelred-mainnet-1/-testnet-1, bech32 `aethel`, `uaethel`), AETHEL declared canonical (AETH/AET stale), canonical `evm-rpc.*` endpoints, ISeal 0x0900 precompile registry, genesis-hash slots, dApp pins refreshed to current HEADs with per-repo `network_module`. ZeroID stale-canonical docs corrected; NoblePay devnet id 7333→7332 + AET/AETH examples fixed (988 tests pass); Cruzible 7332-dedupe bug fixed (304 tests pass); TerraQura RPC hosts aligned to `evm-rpc.*` and stale-id/host CI guards added. Cryptographic signing of the manifest remains a maintainer/release-process action. |
| Digital Seal AIP finalization (0x0900 vs draft 0x0500, ABI) | Aethelred protocol repo (AIPs repo) | **Open** — the AIPs repo is not on this machine; manifest v2.0.0 now flags the stale 0x0500 draft explicitly (`tiers.core[AIPs].action_required`) and records 0x0900 as implemented. |
| ZeroID-backed `IEligibilityPolicy`, Wallet EIP-6963 integration, NoblePay `PaymentIntent` settlement router, Cruzible indexing | respective dApp repos + TerraQura Phase 2/3 | **Open** — the `IKycRegistry` seam introduced here is the integration point ZeroID's adapter will implement. |
| External Tier-1 audit; scientific methodology committee; DAC-only first release scoping | Security / Product / Legal | **Open** — unchanged launch gates. |

---

## 4. Evidence

- Full contract suite: `npx hardhat test` → **1,603 passing, 0 failing**.
- New regression suite: `apps/contracts/test/LifecycleHardening.test.ts` (18 domain-invariant tests, real contract stack incl. MockISeal at the 0x0900 boundary).
- One pre-existing test **asserted the P0.2 bug as intended behavior** ("should allow retiring zero (no-op)") — inverted to assert the revert. This is direct evidence for the consultant's point that statement coverage was giving false confidence.
- Network manifest regenerated from source and drift-validated (`validate:network` passing).
- Launch gate: artifacts check passing; full gate still fails — **correctly** — on pending Aethelred deployment and all-false enforcement attestations.
