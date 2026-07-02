# Why TerraQura's Proof-of-Physics Requires Aethelred to Be an L1

**Audience:** regulators, carbon registries, auditors, enterprise architects,
and developers evaluating "why not just deploy this on Ethereum / an L2 /
Polygon?"

**Short answer:** TerraQura's highest MRV assurance tier — `SealProofOfPhysics`
— anchors a carbon capture claim to a **Digital Seal minted by the chain's own
validator quorum** after the attested physics computation ran under a CEAP
confidentiality policy, and re-checks that seal's live status through a
**consensus-native precompile**. Those properties are consensus-layer facts. An
L2 — or a deployment on someone else's L1 — cannot provide them, because it is
not the entity that runs the attested compute, mints the seal, or finalizes
it. TerraQura is the default RWA/carbon platform for sovereign and regulated
clients *because* it sits on an L1 that treats attested, confidential
computation as a first-class consensus artifact.

This is the RWA companion to the chain's ADR-0004 (sovereign L1 thesis), the
liquid-staking companion (Cruzible), and the identity companion (ZeroID) — all
built on the same ISeal primitive.

---

## The reviewer test

For each property, ask: *would this still hold if Aethelred were a rollup
settling to Ethereum, or if TerraQura had stayed on Polygon?* If "no," the
property is a genuine L1 requirement, not L1-vanity.

### 1. The MRV root of trust is a consensus-minted attestation, not an oracle

The carbon market's core scandal pattern is verification capture: a claim is
"verified" because a small set of oracles or a verifier company signed it. In
`SealProofOfPhysics`, a claim's top-tier verification is a Digital Seal that
the **validator set produced** by actually verifying the attested MRV
computation (PoUW) under a CEAP policy — TEE/FHE/MPC backend, jurisdiction,
vendor-rooted hardware. The attestation *is* consensus work.

> **Polygon/rollup test:** TerraQura's Polygon deployment (the validated v3
> legacy) can only offer oracle-signed verification — Chainlink Functions or a
> verifier multisig. There is no quorum-minted attestation to anchor to.
> **Fails.**

### 2. Live revocation propagates from consensus, not from a registry admin

`isAnchored` re-reads `ISeal.verifySeal` on every call. When the chain revokes
the underlying seal (sensor fraud discovered, jurisdiction breach, attestation
key compromise), every downstream consumer — mint paths, marketplaces,
retirement certificates — sees the claim invalid on the very next read. No
registry admin transaction, no certificate recall process.

> **Rollup test:** seal state on an L2 is foreign state behind a bridge or a
> duplicated copy that can drift from the attester. Instant
> revocation-from-consensus is structurally unavailable. **Fails.**

### 3. Verification is bridge-free — the precompile reads consensus-native state

`ISeal` (0x0900) is a precompile: Solidity calls it and it reads the seal
keeper's state in the same execution as the EVM call. For an asset class whose
integrity IS the product, adding a bridge (the ecosystem's dominant loss
category) between the claim and its proof would be self-defeating.

> **Rollup test:** an L2 reaching L1 seal state needs a message bridge or proof
> relay — added trust, added latency, added attack surface. **Fails.**

### 4. Sovereignty and data residency are enforced where the compute runs

Sovereign carbon programs (Article 6 ITMOs, national registries) require
provable jurisdiction of the verification computation and confidentiality of
proprietary facility data. CEAP encodes `dataResidency`, `allowedBackends`,
`requireVendorRoot` into the seal, and the validator set enforces them where
the MRV computation happens. The registry's `setCompliancePolicy` then makes
those the admission rule for anchors — e.g. "AE residency, TEE backend" for a
Gulf DAC program.

> **Rollup test:** a rollup inherits the base layer's validator set and
> jurisdiction; it cannot promise a sovereign operator that verification ran
> under validators in their jurisdiction on vendor-rooted hardware. **Fails.**

### 5. Post-quantum finality on claims that must outlive the hardware

A carbon credit's integrity claim must remain auditable for decades (vintages,
buffer pools, reversal liability). Digital Seals are quorum-signed with PQC
(ML-DSA) via ABCI++ vote extensions — the attestation minted today is
finalized under a signature scheme meant to survive a store-now-decrypt-later
adversary.

> **Rollup test:** a rollup's finality is the base layer's signature scheme;
> you cannot unilaterally give your MRV attestations PQC finality. **Fails.**

---

## What this is *not*

It is not "another L1 for its own sake." TerraQura runs a full EVM surface with
standard tooling (Hardhat, OpenZeppelin, wagmi/viem, ethers) and keeps its
existing three-phase `VerificationEngine` — an integrator's mental model is
ordinary, and the Polygon-validated contract suite carried over unchanged.
The L1 requirement is narrow and load-bearing: the *root of trust for a
physical-world claim* is a consensus-minted, PQC-finalized, confidentially
attested seal, checked bridge-free. Everything an L2 can do, Aethelred also
does; the five properties above are the things an L2 structurally cannot do —
and they are exactly what a sovereign or regulated carbon program buys
TerraQura for.

## The honest boundary

- The strength of an anchor is the strength of the seal behind it: a seal is
  only as strong as the CEAP backend that produced it. Consult the chain's
  confidential-execution status ledger for which backends are
  production-operational vs. maturing — never present a maturing backend as
  fully operational.
- `SealProofOfPhysics` is the top assurance tier. The existing
  `VerificationEngine` (in-EVM parameter checks) and `NativeIoTOracle` remain
  the right tools for the physics-parameter and data-feed layers; the seal
  anchor complements, not replaces, them.
- The PoUW MRV *model* — the attested computation the validators verify — is
  program-specific and must be registered and reviewed per deployment; the
  registry only proves the computation ran under policy, not that the model
  itself is scientifically sound. Model governance is a registry/program
  responsibility.
- The contracts await a Tier-1 external audit before mainnet (launch gate).
  See `SECURITY.md`.
