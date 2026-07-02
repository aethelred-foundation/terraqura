# SealProofOfPhysics — Security Model & Self-Audit

**Contract:** `apps/contracts/contracts/core/SealProofOfPhysics.sol` (MIT, solc 0.8.20, via-ir, cancun)
**Status:** implemented, self-audited, test-covered. **Tier-1 external audit is
a mainnet launch gate (not yet done).** Treat this as the pre-audit security
narrative, not an audit report.

Base: OpenZeppelin 4.9.6 `Ownable2Step`, `Pausable`, `ReentrancyGuard`.
Deliberately **non-upgradeable** (unlike the UUPS core stack): the consensus
anchor of record must not be admin-mutable; governance surface is limited to
the CEAP policy, pause (anchoring only), and local revocation.

---

## 1. Assets and actors

| Asset | Why it matters |
| --- | --- |
| Anchors `_anchors[dacUnitId][sourceDataHash]` | the thing mint/settlement paths gate on |
| `sealUsed[sealId]` | one-anchor-per-seal replay guard |
| CEAP policy (backends / minVerification / platforms / vendorRoot / residency) | the admission rule for every anchor |
| Ownership (governance) | can set policy, pause, revoke |

| Actor | Capability |
| --- | --- |
| Anyone (operator/relayer/keeper) | `anchor` — permissionless; bounded by the seal's purpose binding |
| Governance (owner) | `setCompliancePolicy`, `revoke`, `pause`/`unpause`, two-step ownership transfer |
| ISeal precompile (0x0900) | source of truth for seal existence, activity, purpose, CEAP satisfaction |

**Why permissionless anchoring is safe:** the quorum-signed purpose contains
the exact claim (`terraqura:0x<dacUnitId>:0x<sourceDataHash>`). A caller
cannot bind a seal to any claim the validators did not verify; the caller
identity carries no authority at all.

---

## 2. Threats and mitigations

| # | Threat | Mitigation | Test |
| --- | --- | --- | --- |
| T1 | **Replay** — one seal anchoring many claims | `sealUsed[sealId]` monotonic guard; second use reverts `SealAlreadyUsed` | `rejects seal replay across claims` |
| T2 | **Claim re-scoping** — seal for unit A / window X anchored to unit B / window Y | purpose binds BOTH `dacUnitId` and `sourceDataHash`; mismatch reverts `SealNotBoundToClaim` | `rejects a seal bound to a different DAC unit`, `…different sensor-data batch` |
| T3 | **Policy bypass** — seal violating jurisdiction/backend/vendor-root admitted | `requireConfidentiality` delegates to the precompile's consensus-parity `Satisfies()`; `(false, reason)` → `PolicyNotSatisfied` | `rejects a seal that fails the CEAP compliance policy` |
| T4 | **Stale anchor** — seal revoked on-chain but claim still reads anchored | `isAnchored` re-checks `verifySeal` live on every call | `an anchor goes invalid the moment the chain revokes the seal` |
| T5 | **Inactive/forged seal** | `verifySeal` must be true (`SealNotActive`); `getSealIdByJob` reverts for unsealed jobs | `rejects an inactive (revoked/expired) seal` |
| T6 | **Unauthorized local revocation** | `revoke` is `onlyOwner` | `non-owner cannot revoke` |
| T7 | **Unauthorized policy change** | `setCompliancePolicy` is `onlyOwner` | `only owner can set the compliance policy` |
| T8 | **Reentrancy** during anchor | `nonReentrant`; precompile calls are `view`; state written after checks | (guard present) |
| T9 | **Ownership takeover / fat-finger** | `Ownable2Step` | `ownership transfer is two-step` |
| T10 | **Emergency stop** | `pause` blocks anchoring; verification reads stay live | `pause blocks anchoring but verification reads stay live` |
| T11 | **Zero-value claim sentinel confusion** | `dacUnitId == 0 \|\| sourceDataHash == 0` reverts `ZeroClaim` | `rejects zero-value claim components` |
| T12 | **Upgrade-key compromise** | contract is non-upgradeable by design | (structural) |

**Suites:**
- `apps/contracts/test/SealProofOfPhysics.test.ts` — **16 tests, all passing**
  (`npx hardhat test test/SealProofOfPhysics.test.ts`); the full contracts
  suite (1547 tests) is green with the contract added.
- The mock ISeal is installed at 0x0900 with `hardhat_setCode` (which wipes
  storage — mock state is set afterwards, mirroring the vm.etch lesson from
  the Cruzible/ZeroID suites).

---

## 3. Invariants

1. **One anchor per seal.** `sealUsed[sealId]` is never cleared; a seal backs
   at most one anchor for its lifetime.
2. **Anchor ⇒ live seal at read time.** `isAnchored` is false whenever the
   backing seal is not `ACTIVE` — consensus revocation always wins over local
   state.
3. **Anchor ⇒ claim-bound seal.** A stored anchor can only have been created
   from a seal whose purpose equalled `terraqura:0x<dacUnitId>:0x<sourceDataHash>`.
4. **Anchor ⇒ policy-satisfying seal at issuance**, evaluated by the
   precompile (consensus parity), never re-derived in Solidity.
5. **No admin mutation of the record.** No upgrade path; governance can only
   revoke (one-way flag) — it cannot forge or edit anchors.

---

## 4. Consensus-parity proof (chain repo)

Contract tests prove the contract; they cannot prove the *precompile binding
is real*. That is proven in the aethelred repo by
`internal/evmhost/terraqura_test.go`
(`TestTerraQura_SealProofOfPhysics_RealPrecompile`), which deploys the
**vendored, reviewed bytecode** into a real EVM host wired to the **real
`ISeal` precompile and a real seal keeper**, and asserts anchor-on-valid-seal,
policy rejection (US seal vs AE policy) by the precompile, and live
revocation. See `PROTOCOL_SYNC.md` §6.

---

## 5. Trust assumptions (be explicit)

- **Precompile integrity.** `0x0900` is the real Aethelred precompile only on
  Aethelred (chain id 7332 / production successor). On any other chain this
  contract is inert or unsafe — do not deploy elsewhere.
- **Seal strength = backend strength.** Consult the chain's
  confidential-execution status ledger; do not present maturing backends as
  fully operational.
- **MRV model governance.** The seal proves the registered MRV computation ran
  under policy on attested infrastructure; it does not prove the model is
  scientifically sound. Model registration/review is a program-level control.
- **Governance is trusted** to set a sane CEAP policy; production should place
  `owner` behind the existing TerraQura multisig + timelock stack.

---

## 6. Known limitations / honest ledger

- [ ] **Tier-1 external audit** (Trail of Bits / OpenZeppelin class) — required
      before mainnet. Not done. (The wider TerraQura audit packet exists under
      `apps/contracts/audit-packet/`; this contract must be added to its scope.)
- [ ] **Mint-path integration** — `CarbonCredit`/`VerificationEngine` do not
      yet *require* a seal anchor for top-tier mints; wiring
      `requireAnchored` into the mint path (behind a governance flag) is the
      follow-up that makes the tier enforced rather than opt-in.
- [ ] **Owner hardening** — deploy `owner` as the TerraQura multisig behind the
      timelock; not enforced by the contract.
- [ ] **Live-node E2E** — the operator script
      (`scripts/devnet-seal-proof-of-physics-e2e.ts`) is runnable but was not
      executed against a live aethelredd node in this pass; the definitive
      binding proof is the chain-repo real-precompile Go test.
- [ ] **Per-party MPC topology attestation** — CEAP checks backend/
      jurisdiction/vendor-root, not per-party MPC quorum composition. Tracked
      upstream.

---

## 7. Deployment checklist

1. Deploy to Aethelred (chain id **7332** / production successor) only —
   confirm `eth_chainId` = `0x1ca4` and `ISeal` at `0x0900`.
2. Construct with `governance` = the TerraQura multisig (timelocked), not an
   EOA.
3. Call `setCompliancePolicy` with the program's jurisdiction/backend/
   vendor-root policy (empty arrays = "any" — almost never right for a
   regulated program; set them).
4. Verify `compliancePolicy()` reads back the intended policy.
5. Re-vendor bytecode into the aethelred repo and confirm
   `TestTerraQura_SealProofOfPhysics_RealPrecompile` is green there.
6. Record the deployed address in `packages/network-manifest` (new
   `sealProofOfPhysics` contract key) once a canonical deployment manifest
   exists.
