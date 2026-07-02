# TerraQura ↔ Aethelred Protocol Sync — Seal-Anchored Proof-of-Physics

**Contract:** `apps/contracts/contracts/core/SealProofOfPhysics.sol` (MIT, solc 0.8.20, via-ir, cancun)
**Chain:** Aethelred L1 — EVM EIP-155 chain id **7332** (`eth_chainId` → `0x1ca4`); mainnet reserved **7331**
**Precompile:** `ISeal` at `0x0000000000000000000000000000000000000900`

This document is the contract-of-record for how TerraQura's highest MRV
assurance tier binds to Aethelred consensus. It exists so an auditor, a carbon
registry, or an enterprise integrator can confirm — without reading the whole
monorepo — that a `SealProofOfPhysics` anchor is backed by the chain's own
Proof-of-Useful-Work (PoUW) pipeline and not by an oracle multisig.

---

## 1. Trust model in one paragraph

A TerraQura *seal-anchored MRV claim* is valid iff a **Digital Seal** — an
artifact minted by the Aethelred validator quorum when a PoUW MRV job (the
attested physics computation over the DAC unit's sensor data, run under a CEAP
confidentiality policy) completed — exists, is `ACTIVE`, was bound to **this
exact (dacUnitId, sourceDataHash) claim**, and carries a CEAP attestation that
satisfies the registry's policy. Every one of those checks is evaluated
**inside the EVM by the `ISeal` precompile**, which reads consensus-native
state directly. No oracle, no bridge, and no off-chain verifier service sits in
the verification path. When the chain revokes the seal, the anchor goes invalid
on the next `isAnchored` call — liveness flows from consensus, not from a
TerraQura transaction.

---

## 2. The four ISeal touchpoints

The registry uses exactly these precompile methods (aethelred repo
`precompiles/seal/ISeal.sol`, vendored at
`apps/contracts/contracts/interfaces/ISeal.sol` with the pragma aligned to the
repo's solhint policy):

| Call | Used for | Failure semantics |
| --- | --- | --- |
| `getSealIdByJob(jobId)` | resolve the seal minted for a PoUW job | reverts if the job is unsealed |
| `verifySeal(sealId)` | is the seal `ACTIVE` right now | `false` → not active / revoked |
| `getSeal(sealId)` | read the `purpose` field for claim binding | — |
| `requireConfidentiality(sealId, backends, minVerification, platforms, requireVendorRoot, dataResidency)` | CEAP policy check with **consensus parity** | `(false, reason)` → policy unmet |

`requireConfidentiality` runs the **same `Satisfies()` logic** the chain uses
when it decides whether a job may be sealed. The Solidity side never
re-implements policy evaluation, so the on-chain and in-EVM answers cannot
diverge.

---

## 3. The purpose binding (anti-replay, anti-mis-attribution)

A seal only backs an anchor if its `purpose` string equals, byte-for-byte:

```
terraqura:0x<dacUnitId-hex-64>:0x<sourceDataHash-hex-64>
```

- `<dacUnitId>` — the DAC facility identifier used across TerraQura
  (`VerificationEngine`, `CarbonCredit`), lowercase hex.
- `<sourceDataHash>` — the hash of the off-chain sensor-data window the MRV job
  computed over, lowercase hex.

Because the claim is inside the purpose the quorum signed, **anchoring is
permissionless**: any operator, relayer, or keeper bot may call `anchor` — no
caller can mis-attribute an anchor to a claim the quorum did not verify, and a
seal cannot be re-scoped to a different DAC unit or a different data window.
`expectedPurpose(dacUnitId, sourceDataHash)` returns this exact string for
operators constructing the PoUW job.

Each seal admits **exactly one** anchor (`sealUsed[sealId]`).

---

## 4. Lifecycle

```
  ┌── sensors / PoUW ─────────────────────┐        ┌── EVM (chain id 7332) ─────────────┐
  │ 1. DAC sensor stream → MRV job with    │        │ 3. anyone → anchor(dacUnitId,      │
  │    purpose terraqura:0x<unit>:0x<data>,│        │    sourceDataHash, jobId)          │
  │    CEAP policy (jurisdiction/backend)  │        │      ISeal.getSealIdByJob          │
  │ 2. validator quorum verifies the       │  seal  │      ISeal.verifySeal (ACTIVE)     │
  │    attested physics computation →      │ ─────► │      ISeal.getSeal → purpose match │
  │    mints Digital Seal (PQC-signed)     │        │      ISeal.requireConfidentiality  │
  └────────────────────────────────────────┘        │    → record anchor                 │
                                                     │ 4. mint/settlement paths →         │
                                                     │    isAnchored / requireAnchored    │
                                                     │      re-checks ISeal.verifySeal    │
                                                     │      (live revocation)             │
                                                     └────────────────────────────────────┘
```

Relationship to the existing stack: `VerificationEngine` performs the in-EVM
three-phase Source/Logic/Mint parameter checks; `SealProofOfPhysics` anchors
the claim to attested, confidential, quorum-verified compute. Mint paths that
want the top tier gate on `requireAnchored(dacUnitId, sourceDataHash)` **in
addition to** the engine's checks.

---

## 5. Network wiring (single source of truth)

`packages/network-manifest` is the monorepo's typed source of truth; hardhat,
the web app (wagmi), the indexer (Go), the verifier (Rust), and analytics
(Python) all derive from it:

- **aethelred (mainnet)** — chain id **7331** (reserved until a production
  network exists), currency **AETHEL** (18 dec).
- **aethelredTestnet** — chain id **7332**, the CONFIRMED live EVM id; a local
  `aethelredd start --json-rpc.enable` devnet node reports the same id — point
  `AETHELRED_TESTNET_RPC_URL` / `NEXT_PUBLIC_AETHELRED_TESTNET_RPC_URL` at
  `http://127.0.0.1:8545` for it.
- The runtime guard in `packages/network-manifest/src/index.ts` fails
  validation if either id drifts.

Source of truth for the ids: aethelred repo `ecosystem/manifest.json` →
`protocol.evm_chain_id`. The earlier `123456/78432` values were never-deployed
placeholders and have been reconciled across the monorepo (manifest, env
examples, service fallbacks, fixtures, docs).

---

## 6. How this stays in sync with the chain (drift protection)

1. **Vendored bytecode** — aethelred repo
   `internal/evmhost/testdata/terraqura/SealProofOfPhysics.{abi,bin}` is the
   exact reviewed contract, compiled with `npx hardhat compile` and copied
   over. If the Solidity changes, re-vendor.
2. **Real-precompile proof** — aethelred repo
   `internal/evmhost/terraqura_test.go`
   (`TestTerraQura_SealProofOfPhysics_RealPrecompile`) deploys that bytecode
   into a real EVM host wired to the **real `ISeal` precompile and a real seal
   keeper**, then proves:
   - a policy-satisfying, claim-bound seal anchors and the claim reads anchored;
   - a US-jurisdiction seal is rejected under an AE-only policy *by the precompile*;
   - revoking the seal in the keeper invalidates the anchor live, with no
     TerraQura transaction.

If the ABI or the purpose format changes without updating both sides, this Go
test fails in the chain repo's CI. The contract-side behaviour is
independently locked by the Hardhat suite
`apps/contracts/test/SealProofOfPhysics.test.ts` (16 tests; see `SECURITY.md`).
