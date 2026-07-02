import { expect } from "chai";
import { ethers, network } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { MockISeal, SealProofOfPhysics } from "../typechain-types";

/**
 * SealProofOfPhysics — consensus-anchored MRV registry.
 *
 * The ISeal precompile lives at a fixed address (0x0900) on Aethelred, so the
 * suite installs MockISeal's runtime bytecode there with `hardhat_setCode`.
 * NOTE: setCode wipes storage — mock seals must be (re)populated AFTER the
 * code is installed. The REAL precompile binding (real seal keeper, vendored
 * bytecode, live revocation) is proven in the aethelred repo's evmhost test.
 */
describe("SealProofOfPhysics", function () {
    const SEAL_PRECOMPILE = "0x0000000000000000000000000000000000000900";

    let registry: SealProofOfPhysics;
    let seal: MockISeal; // attached at the precompile address
    let governance: SignerWithAddress;
    let operator: SignerWithAddress;
    let stranger: SignerWithAddress;

    const dacUnitId = ethers.keccak256(ethers.toUtf8Bytes("DAC_UNIT_001"));
    const sourceDataHash = ethers.keccak256(ethers.toUtf8Bytes("sensor_data_batch_001"));
    const otherUnit = ethers.keccak256(ethers.toUtf8Bytes("DAC_UNIT_002"));
    const otherBatch = ethers.keccak256(ethers.toUtf8Bytes("sensor_data_batch_002"));

    const JOB = "job-mrv-001";
    const SEAL_ID = "a".repeat(64);

    /** The canonical purpose the contract expects for (unit, batch). */
    const purposeFor = (unit: string, batch: string) => `terraqura:${unit}:${batch}`;

    beforeEach(async function () {
        [governance, operator, stranger] = await ethers.getSigners();

        // Install MockISeal's runtime bytecode at the precompile address.
        const MockISealFactory = await ethers.getContractFactory("MockISeal");
        const deployed = await MockISealFactory.deploy();
        await deployed.waitForDeployment();
        const runtime = await ethers.provider.getCode(await deployed.getAddress());
        await network.provider.send("hardhat_setCode", [SEAL_PRECOMPILE, runtime]);
        seal = MockISealFactory.attach(SEAL_PRECOMPILE) as MockISeal;

        // setCode wiped storage — set mock state afterwards.
        await seal.setPolicyResult(true, "");

        const Registry = await ethers.getContractFactory("SealProofOfPhysics");
        registry = (await Registry.deploy(governance.address)) as SealProofOfPhysics;
        await registry.waitForDeployment();
    });

    async function mintSeal(
        job = JOB,
        sealId = SEAL_ID,
        unit = dacUnitId,
        batch = sourceDataHash,
        active = true,
    ) {
        await seal.setSeal(job, sealId, purposeFor(unit, batch), active);
    }

    describe("anchoring", function () {
        it("anchors a claim backed by a bound, active, policy-satisfying seal", async function () {
            await mintSeal();
            expect(await registry.isAnchored(dacUnitId, sourceDataHash)).to.equal(false);

            await expect(registry.connect(operator).anchor(dacUnitId, sourceDataHash, JOB))
                .to.emit(registry, "ClaimAnchored")
                .withArgs(dacUnitId, sourceDataHash, SEAL_ID, JOB);

            expect(await registry.isAnchored(dacUnitId, sourceDataHash)).to.equal(true);
            const record = await registry.getAnchor(dacUnitId, sourceDataHash);
            expect(record.sealId).to.equal(SEAL_ID);
            expect(record.exists).to.equal(true);
            expect(record.revoked).to.equal(false);
        });

        it("is permissionless: any caller may anchor — the seal itself binds the claim", async function () {
            await mintSeal();
            await expect(registry.connect(stranger).anchor(dacUnitId, sourceDataHash, JOB)).to.not
                .be.reverted;
            expect(await registry.isAnchored(dacUnitId, sourceDataHash)).to.equal(true);
        });

        it("rejects a seal bound to a different DAC unit", async function () {
            await mintSeal(JOB, SEAL_ID, otherUnit, sourceDataHash);
            await expect(
                registry.anchor(dacUnitId, sourceDataHash, JOB),
            ).to.be.revertedWithCustomError(registry, "SealNotBoundToClaim");
        });

        it("rejects a seal bound to a different sensor-data batch", async function () {
            await mintSeal(JOB, SEAL_ID, dacUnitId, otherBatch);
            await expect(
                registry.anchor(dacUnitId, sourceDataHash, JOB),
            ).to.be.revertedWithCustomError(registry, "SealNotBoundToClaim");
        });

        it("rejects a seal that fails the CEAP compliance policy", async function () {
            await mintSeal();
            await seal.setPolicyResult(false, "jurisdiction not allowed");
            await expect(registry.anchor(dacUnitId, sourceDataHash, JOB))
                .to.be.revertedWithCustomError(registry, "PolicyNotSatisfied")
                .withArgs("jurisdiction not allowed");
        });

        it("rejects an inactive (revoked/expired) seal", async function () {
            await mintSeal(JOB, SEAL_ID, dacUnitId, sourceDataHash, false);
            await expect(
                registry.anchor(dacUnitId, sourceDataHash, JOB),
            ).to.be.revertedWithCustomError(registry, "SealNotActive");
        });

        it("rejects seal replay across claims (one seal, one anchor)", async function () {
            await mintSeal();
            await registry.anchor(dacUnitId, sourceDataHash, JOB);

            // Same seal presented for a second claim via another job mapping.
            await seal.setSeal("job-mrv-002", SEAL_ID, purposeFor(otherUnit, otherBatch), true);
            await expect(
                registry.anchor(otherUnit, otherBatch, "job-mrv-002"),
            ).to.be.revertedWithCustomError(registry, "SealAlreadyUsed");
        });

        it("rejects zero-value claim components", async function () {
            await expect(
                registry.anchor(ethers.ZeroHash, sourceDataHash, JOB),
            ).to.be.revertedWithCustomError(registry, "ZeroClaim");
            await expect(
                registry.anchor(dacUnitId, ethers.ZeroHash, JOB),
            ).to.be.revertedWithCustomError(registry, "ZeroClaim");
        });

        it("one claim, one anchor: a live anchor cannot be overwritten by a second bound seal", async function () {
            await mintSeal();
            await registry.anchor(dacUnitId, sourceDataHash, JOB);
            const before = await registry.getAnchor(dacUnitId, sourceDataHash);

            // A second quorum seal bound to the SAME claim must not rewrite the
            // record (sealId/anchoredAt refresh would corrupt the audit trail).
            await seal.setSeal("job-mrv-dup", "c".repeat(64), purposeFor(dacUnitId, sourceDataHash), true);
            await expect(registry.anchor(dacUnitId, sourceDataHash, "job-mrv-dup"))
                .to.be.revertedWithCustomError(registry, "AlreadyAnchored")
                .withArgs(dacUnitId, sourceDataHash);

            const after = await registry.getAnchor(dacUnitId, sourceDataHash);
            expect(after.sealId).to.equal(before.sealId);
            expect(after.anchoredAt).to.equal(before.anchoredAt);
        });

        it("SECURITY: a governance revocation cannot be undone by re-anchoring with a fresh seal", async function () {
            await mintSeal();
            await registry.anchor(dacUnitId, sourceDataHash, JOB);
            await registry.connect(governance).revoke(dacUnitId, sourceDataHash);
            expect(await registry.isAnchored(dacUnitId, sourceDataHash)).to.equal(false);

            // Attacker holds a second, legitimately claim-bound ACTIVE seal.
            // Without the AlreadyAnchored guard this call would rewrite the
            // record with revoked=false, silently undoing governance's
            // withdrawal of trust through a permissionless call.
            await seal.setSeal("job-mrv-fresh", "d".repeat(64), purposeFor(dacUnitId, sourceDataHash), true);
            await expect(
                registry.connect(stranger).anchor(dacUnitId, sourceDataHash, "job-mrv-fresh"),
            ).to.be.revertedWithCustomError(registry, "AlreadyAnchored");

            expect(await registry.isAnchored(dacUnitId, sourceDataHash)).to.equal(false);
            const record = await registry.getAnchor(dacUnitId, sourceDataHash);
            expect(record.revoked).to.equal(true);
        });
    });

    describe("live consensus revocation", function () {
        it("an anchor goes invalid the moment the chain revokes the seal — no TerraQura tx", async function () {
            await mintSeal();
            await registry.anchor(dacUnitId, sourceDataHash, JOB);
            expect(await registry.isAnchored(dacUnitId, sourceDataHash)).to.equal(true);

            await seal.setActive(SEAL_ID, false); // consensus-side revocation
            expect(await registry.isAnchored(dacUnitId, sourceDataHash)).to.equal(false);
            await expect(
                registry.requireAnchored(dacUnitId, sourceDataHash),
            ).to.be.revertedWithCustomError(registry, "NoSuchAnchor");
        });
    });

    describe("local revocation", function () {
        it("governance can revoke an anchor", async function () {
            await mintSeal();
            await registry.anchor(dacUnitId, sourceDataHash, JOB);

            await expect(registry.connect(governance).revoke(dacUnitId, sourceDataHash))
                .to.emit(registry, "AnchorRevoked")
                .withArgs(dacUnitId, sourceDataHash, governance.address);
            expect(await registry.isAnchored(dacUnitId, sourceDataHash)).to.equal(false);
        });

        it("non-owner cannot revoke", async function () {
            await mintSeal();
            await registry.anchor(dacUnitId, sourceDataHash, JOB);
            await expect(
                registry.connect(stranger).revoke(dacUnitId, sourceDataHash),
            ).to.be.revertedWith("Ownable: caller is not the owner");
        });

        it("revoking a non-existent anchor reverts", async function () {
            await expect(
                registry.connect(governance).revoke(dacUnitId, sourceDataHash),
            ).to.be.revertedWithCustomError(registry, "NoSuchAnchor");
        });
    });

    describe("governance", function () {
        it("only owner can set the compliance policy", async function () {
            await expect(
                registry.connect(stranger).setCompliancePolicy(["fhe"], "", [], false, ["EU"]),
            ).to.be.revertedWith("Ownable: caller is not the owner");

            await registry
                .connect(governance)
                .setCompliancePolicy(["fhe"], "", [], false, ["EU"]);
            const policy = await registry.compliancePolicy();
            expect(policy[0]).to.deep.equal(["fhe"]);
            expect(policy[4]).to.deep.equal(["EU"]);
        });

        it("ownership transfer is two-step", async function () {
            await registry.connect(governance).transferOwnership(operator.address);
            expect(await registry.owner()).to.equal(governance.address); // not yet

            await registry.connect(operator).acceptOwnership();
            expect(await registry.owner()).to.equal(operator.address);
        });

        it("pause blocks anchoring but verification reads stay live", async function () {
            await mintSeal();
            await registry.anchor(dacUnitId, sourceDataHash, JOB);

            await registry.connect(governance).pause();
            await seal.setSeal("job-mrv-003", "b".repeat(64), purposeFor(otherUnit, otherBatch), true);
            await expect(
                registry.anchor(otherUnit, otherBatch, "job-mrv-003"),
            ).to.be.revertedWith("Pausable: paused");

            // Reads unaffected while paused.
            expect(await registry.isAnchored(dacUnitId, sourceDataHash)).to.equal(true);

            await registry.connect(governance).unpause();
            await expect(registry.anchor(otherUnit, otherBatch, "job-mrv-003")).to.not.be
                .reverted;
        });
    });

    describe("helpers", function () {
        it("expectedPurpose returns the canonical binding string", async function () {
            expect(await registry.expectedPurpose(dacUnitId, sourceDataHash)).to.equal(
                purposeFor(dacUnitId, sourceDataHash),
            );
        });

        it("requireAnchored passes silently for a live anchor (hard-gate success path)", async function () {
            await mintSeal();
            await registry.anchor(dacUnitId, sourceDataHash, JOB);
            await expect(registry.requireAnchored(dacUnitId, sourceDataHash)).to.not.be
                .reverted;
        });

        it("getAnchor on an unknown claim returns an empty record", async function () {
            const record = await registry.getAnchor(otherUnit, otherBatch);
            expect(record.exists).to.equal(false);
            expect(record.revoked).to.equal(false);
            expect(record.sealId).to.equal("");
            expect(record.anchoredAt).to.equal(0);
        });

        it("compliancePolicy starts empty (any backend/jurisdiction) until governance sets it", async function () {
            const policy = await registry.compliancePolicy();
            expect(policy[0]).to.deep.equal([]);
            expect(policy[1]).to.equal("");
            expect(policy[2]).to.deep.equal([]);
            expect(policy[3]).to.equal(false);
            expect(policy[4]).to.deep.equal([]);
        });

        it("acceptOwnership by a non-pending account reverts", async function () {
            await registry.connect(governance).transferOwnership(operator.address);
            await expect(registry.connect(stranger).acceptOwnership()).to.be.revertedWith(
                "Ownable2Step: caller is not the new owner",
            );
        });

        it("only owner can pause and unpause", async function () {
            await expect(registry.connect(stranger).pause()).to.be.revertedWith(
                "Ownable: caller is not the owner",
            );
            await registry.connect(governance).pause();
            await expect(registry.connect(stranger).unpause()).to.be.revertedWith(
                "Ownable: caller is not the owner",
            );
            await registry.connect(governance).unpause();
        });
    });
});
