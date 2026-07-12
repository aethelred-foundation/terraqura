# TerraQura → Aethelred Testnet Integration Handoff

**Date:** 2026-07-12
**From:** TerraQura app team
**To:** Aethelred testnet team (US)
**Purpose:** hand off the P0-remediated TerraQura contract stack for deployment to the Aethelred testnet (chain 7332), on-chain validation, and independent testing. This document is the integration contract: what changed, how to wire it, what the enforced invariants are, and the full local test evidence behind it.

**Branch:** `fix/vercel-gitignore` @ `468357b` (+ stress-suite commit on top)
**Bottom line:** all local suites are green — **1,611 contract tests + 5,000+ across the stack and sibling dApps, 0 failing**; contract statement coverage **97.3%**. Nothing here is theoretical; every enforced behavior below has a regression test named in §6.

---

## 1. What the US team needs to do (integration checklist)

1. **Confirm canonical protocol identity** (single source of truth: aethelred repo `ecosystem/manifest.json` v2.0.0):
   - EVM chain id **7332** (testnet; devnet shares it), **7331** reserved mainnet.
   - Native token **AETHEL** (18 EVM decimals), base denom `uaethel`, bech32 `aethel`.
   - ISeal precompile at **`0x0900`** (IVerify `0x0901`, IPoUW `0x0902` reserved).
   - RPC host naming `evm-rpc-testnet.aethelred.network` / local devnet `http://127.0.0.1:8545`.
2. **Deploy** with `apps/contracts/scripts/deploy.ts` (Hardhat). It now deploys and wires the full golden-workflow set (see §3) — not just the core four.
3. **Verify the ISeal precompile is live at 0x0900** on your testnet node before enabling seal enforcement. `SealProofOfPhysics` calls it at verification time; without it, seal-anchored mints revert (fail-closed, by design).
4. **Record enforcement attestations** from live chain reads into the deployment manifest (see §4) — the production launch gate requires them.
5. **Run the on-chain golden workflow** and compare gas against the local snapshot in §5.
6. Report back: deployed addresses, `eth_chainId`, ISeal presence, and any gas deltas > 15% vs §5.

---

## 2. What changed since the last consultant review (context for integrators)

Two work streams landed this session. Full detail: `TERRAQURA_P0_REMEDIATION_2026-07-12.md`.

**P0.1 — canonical protocol identity (cross-repo).** The ecosystem had conflicting chain IDs (8821/88210 placeholders vs. the real 7331/7332) and token symbols (AETH/AET vs AETHEL). Reconciled across aethelred (manifest v2.0.0), ZeroID, NoblePay, Cruzible, and TerraQura. **For you this means: 7332 / AETHEL / 0x0900 are now authoritative and consistent everywhere.**

**P0.2–P0.8 — contract lifecycle & security hardening.** Retirement now burns supply (was reversible escrow), seal revocation propagates to settlement, the circuit breaker is actually wired, KYC has one authority with settlement-time rechecks, and the launch gate covers the full contract set. These change on-chain behavior — §4 lists the invariants you'll observe.

---

## 3. Deployment topology (what deploy.ts wires)

```
TerraQuraAccessControl (UUPS)  ── KYC authority (status + expiry + sanctions)
VerificationEngine (UUPS)      ── 3-phase physics checks
CarbonCredit (UUPS, ERC-1155)  ── mint / retire(burn) / transfer
   ├─ sealRegistry ───────────► SealProofOfPhysics (NON-upgradeable) ──► ISeal 0x0900
   ├─ circuitBreaker ─────────► CircuitBreaker (UUPS)
   └─ approvedRetirers ───────► CarbonRetirement (UUPS) ──► RetirementCertificate (UUPS)
CarbonMarketplace (UUPS)       ── kycRegistry ► TerraQuraAccessControl
```

`deploy.ts` performs the wiring the invariants depend on:
- `carbonCredit.setSealRegistry(sealProofOfPhysics)` (enforcement stays **OFF** until you enable it)
- `carbonCredit.setCircuitBreaker(circuitBreaker)`
- `carbonCredit.setApprovedRetirer(carbonRetirement, true)`
- `carbonRetirement.setCertificateContract(retirementCertificate)`
- `carbonMarketplace.setKycRegistry(accessControl)`

**Enabling the top assurance tier (do this once the ISeal precompile and PoUW/seal pipeline are confirmed live on your node):**
```
carbonCredit.setSealAnchorRequired(true)   // requires registry set first
carbonCredit.lockSealEnforcement()         // ONE-WAY — do only when ready; freezes registry + requirement
```

---

## 4. Enforced invariants you will observe on-chain

These are the P0 fixes as testable on-chain behaviors. Each maps to a named regression test (§6).

| Area | Invariant | Revert / effect |
|---|---|---|
| Retirement | Zero-amount retire is rejected | `InvalidRetirementAmount` |
| Retirement | `isRetired` flips only when the batch's **total supply** hits 0 (not one holder's balance) | — |
| Retirement | Retirement **burns** supply; the retirement contract never holds credits | balance→0 |
| Retirement | Only an approved retirer + approved operator may `retireCreditsFrom` | `UnauthorizedRetirer` / `RetirerNotApprovedOperator` |
| Seal tier | Seal-anchored batch with a revoked seal reads `isCreditActive == false` on the next call | — |
| Seal tier | Suspended (revoked) credit cannot be listed, purchased, or normally retired | `CreditNotActive` / `CreditSuspended` |
| Seal tier | Enforcement is one-way after `lockSealEnforcement()` | `SealEnforcementIsLocked` |
| Seal tier | Each anchor records the CEAP `policyHash` + `policyVersion` at admission | — |
| Circuit breaker | Global (or per-contract) pause blocks **every** token movement: mint, transfer, retire | `CircuitBreakerTripped` |
| Circuit breaker | Rate/volume limits are self-reporting only (`msg.sender == contractAddr`) | `UnauthorizedLimitConsumer` |
| KYC | Marketplace delegates KYC to the registry when set (expiry + sanctions aware) | `KycNotVerified` |
| KYC | `purchase` re-checks the **seller**, `acceptOffer` re-checks the **buyer** at settlement | `SellerNotKycVerified` / `BuyerNotKycVerified` |
| Access control | An expired role fails `hasRoleAndKyc` without any revocation tx | — |

**Deployment manifest — enforcement attestations (record from live chain reads):**
```
enforcement.sealAnchorRequired            = carbonCredit.sealAnchorRequired()
enforcement.sealEnforcementLocked         = carbonCredit.sealEnforcementLocked()
enforcement.kycRegistryConfigured         = carbonMarketplace.kycRegistry() != 0x0
enforcement.circuitBreakerWired           = carbonCredit.circuitBreaker() != 0x0
enforcement.retirementWiredAsApprovedRetirer = carbonCredit.approvedRetirers(carbonRetirement)
```
The production launch gate (`scripts/production-launch-gate.mjs`) fails unless all five are `true` **and** all golden-workflow addresses are non-zero. It is expected to keep failing until you deploy and attest.

---

## 5. Gas snapshot (local hardhat EVM — compare against your testnet)

| Operation | Gas |
|---|---|
| `mintVerifiedCredits` (no seal gate) | ~520,000 |
| `retireCredits` (single) | ~55,000 |
| `batchRetireCredits` ×100 | ~2,136,000 |
| `createListing` | ~338,000 |
| `purchase` | ~121,000 |

Seal-gated mint adds one `ISeal.verifySeal` STATICCALL to the precompile — measure that delta on your node, since precompile gas is chain-configured.

---

## 6. Full local test evidence (this is why integration is worth your time)

### 6.1 TerraQura stack — all green

| Suite | Result | Notes |
|---|---|---|
| **Contracts** (`hardhat test`) | **1,611 passing / 0 failing** | incl. new stress (8) + lifecycle-hardening (18) suites |
| **Contract coverage** (`hardhat coverage`) | **97.3% statements** (1,582/1,626), **79.1% branch**, 26 contracts | clean single-threaded run; SealProofOfPhysics 100% |
| **Security simulation** (`test:security-sim`) | **69 passing** | exploit/fault-injection + emergency scenarios |
| **API** (Fastify) | **208 passing** (17 files) | |
| **API golden workflow** (`test:api-golden`) | **16 passing** | full operator→mint→retire→audit flow |
| **Database domain/audit export** | **passing** | lineage helpers |
| **SDK** | **446 passing** | |
| **Web** (Next.js) | **38 passing** (7 files) | |
| **Worker** (BullMQ) | **84 passing** (4 files) | |
| **Go indexer** (`go test ./...`) | **96 passing / 0 fail** | api, config, indexer, store |
| **Rust verifier** (`cargo test`) | **137 passing** | crypto, Merkle, provenance, sensor, verification |
| **Python analytics** (`pytest`) | **112 passing** | |
| **Enterprise validation** (`validate:enterprise`) | **passing** | network + subgraph + api-golden + db-domain + security-sim + launch-gate (3/3) + artifacts + readiness |
| **Network manifest** (`validate:network`) | **passing** | 7331/7332, evm-rpc.* hosts, no drift |

### 6.2 Stress / volume regression (new — the load evidence you asked for)

All 8 scenarios pass on the **real** contract stack (only the ISeal precompile is mocked):
- 50-batch mint volume with exact aggregate supply accounting + replay guard held
- 10-holder retirement storm — `isRetired` stayed false until total supply hit 0
- 100-item atomic batch retirement; one zero-amount item reverts the whole batch
- 40-listing marketplace churn with interleaved partial purchases + cancels — escrow netted to **exactly 0**, supply conserved
- 20-offer create/accept/reject storm — **no stuck ETH** in the marketplace
- circuit breaker halted a 10-batch live population, then recovered with no state damage
- rate-limit saturation exact at the 100-op boundary
- 20 seal-anchored batches, revoked half — only the revoked half suspended

### 6.3 Sibling dApps (changed this session for P0.1 — re-verified)

| Repo | Result | Change validated |
|---|---|---|
| **NoblePay** | **988 passing** (35 suites) | devnet id 7333→7332, AETHEL symbols |
| **Cruzible** | **304 passing** (61 files) | 7332 dedupe fix (devnet localhost RPC no longer leaks to testnet) |
| **ZeroID** | **2,419 passing** (117 suites) | conformant to 7331/7332 (docs corrected) |

**Aggregate: ~5,900 automated tests passing, 0 failing, across TerraQura + 3 sibling dApps.**

---

## 7. Known gaps / not-in-scope for this handoff

- **ISeal precompile is mocked locally.** The single most important thing to validate on your node is the **real** 0x0900 behavior end-to-end: PoUW job → seal mint → `anchor()` → seal-gated mint → revoke → suspension. Local tests prove TerraQura's side of that contract; only your node proves the precompile side.
- **Aethelred deployment is still pending** in TerraQura's manifest (zero addresses) — this handoff is what unblocks it. After you deploy, send addresses back so we can check in the canonical deployment manifest.
- **Digital Seal AIP** still cites `0x0500` in the AIPs repo (not on our machines); the implementation and manifest say `0x0900`. Please confirm your node's actual precompile address and flag if it differs.
- **External Tier-1 audit** is still a separate launch gate — this handoff is for testnet validation, not a mainnet go-ahead.
- **Dashboard** remains preview-backed until wired to your deployed addresses.

---

## 8. Quick reproduction (for the US team)

```bash
# contracts
cd apps/contracts && npx hardhat test            # 1611 passing
npx hardhat test test/StressRegression.test.ts   # 8 stress scenarios + gas snapshot
npx hardhat coverage                             # 97.3% stmts (run alone; concurrency skews it)

# deploy to your testnet (set PRIVATE_KEY + AETHELRED_TESTNET_RPC_URL)
npx hardhat run scripts/deploy.ts --network aethelredTestnet

# whole-repo gates
cd ../.. && corepack pnpm@9.0.0 validate:enterprise
node scripts/production-launch-gate.mjs          # expected to FAIL until you deploy + attest
```

> Note: run `hardhat coverage` on its own. Running it concurrently with other test suites contaminates its private hardhat network and produces a falsely low number (we hit 55.7% under parallel load vs 97.3% clean — same 1,611 tests passing in both).
