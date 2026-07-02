import { expect } from "chai";
import { ethers, network, upgrades } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import {
  CarbonCredit,
  MockISeal,
  SealProofOfPhysics,
  VerificationEngine,
} from "../typechain-types";

/**
 * CarbonCredit × SealProofOfPhysics — enforced top assurance tier.
 *
 * Behavioral integration suite over the REAL contract stack: the only mock is
 * the ISeal precompile boundary (MockISeal installed at 0x0900 via
 * hardhat_setCode — state populated after install, since setCode wipes
 * storage). Everything else — SealProofOfPhysics, VerificationEngine,
 * CarbonCredit (UUPS proxies where applicable) — is the production code, so a
 * mint exercises the full path:
 *
 *   MockISeal(0x0900) → SealProofOfPhysics.isAnchored → CarbonCredit gate
 *                     → VerificationEngine.verify → ERC-1155 mint
 */
describe("CarbonCredit — seal-anchored minting (enforced tier)", function () {
  const SEAL_PRECOMPILE = "0x0000000000000000000000000000000000000900";

  let carbonCredit: CarbonCredit;
  let verificationEngine: VerificationEngine;
  let registry: SealProofOfPhysics;
  let seal: MockISeal;
  let owner: SignerWithAddress;
  let operator: SignerWithAddress;
  let buyer: SignerWithAddress;
  let stranger: SignerWithAddress;

  const dacUnitId = ethers.keccak256(ethers.toUtf8Bytes("DAC_UNIT_001"));
  const sourceDataHash = ethers.keccak256(
    ethers.toUtf8Bytes("sensor_data_batch_001"),
  );
  const captureTimestamp = Math.floor(Date.now() / 1000);
  const co2AmountKg = 1000000;
  const energyConsumedKwh = 350000;
  const latitude = 24453884;
  const longitude = 54377344;
  const purityPercentage = 98;
  const gridIntensity = 50;
  const ipfsMetadataUri = "ipfs://QmSealAnchorTest";
  const arweaveBackupTxId = "arweave_tx_seal";

  const JOB = "job-mrv-001";
  const SEAL_ID = "a".repeat(64);
  const purposeFor = (unit: string, batch: string) =>
    `terraqura:${unit}:${batch}`;

  /** Mint call with default claim params against the real stack. */
  function mint(batch = sourceDataHash, uri = ipfsMetadataUri) {
    return carbonCredit
      .connect(operator)
      .mintVerifiedCredits(
        buyer.address,
        dacUnitId,
        batch,
        captureTimestamp,
        co2AmountKg,
        energyConsumedKwh,
        latitude,
        longitude,
        purityPercentage,
        gridIntensity,
        uri,
        arweaveBackupTxId,
      );
  }

  beforeEach(async function () {
    [owner, operator, buyer, stranger] = await ethers.getSigners();

    // Real precompile boundary: MockISeal runtime code at 0x0900.
    const MockISealFactory = await ethers.getContractFactory("MockISeal");
    const deployed = await MockISealFactory.deploy();
    await deployed.waitForDeployment();
    const runtime = await ethers.provider.getCode(await deployed.getAddress());
    await network.provider.send("hardhat_setCode", [SEAL_PRECOMPILE, runtime]);
    seal = MockISealFactory.attach(SEAL_PRECOMPILE) as MockISeal;
    await seal.setPolicyResult(true, "");

    // Real seal registry.
    const Registry = await ethers.getContractFactory("SealProofOfPhysics");
    registry = (await Registry.deploy(owner.address)) as SealProofOfPhysics;
    await registry.waitForDeployment();

    // Real verification engine + carbon credit (UUPS proxies).
    const VerificationEngineFactory =
      await ethers.getContractFactory("VerificationEngine");
    verificationEngine = (await upgrades.deployProxy(
      VerificationEngineFactory,
      [ethers.ZeroAddress, ethers.ZeroAddress],
      { initializer: "initialize" },
    )) as unknown as VerificationEngine;
    await verificationEngine.waitForDeployment();

    const CarbonCreditFactory = await ethers.getContractFactory("CarbonCredit");
    carbonCredit = (await upgrades.deployProxy(
      CarbonCreditFactory,
      [await verificationEngine.getAddress(), "ipfs://", owner.address],
      { initializer: "initialize" },
    )) as unknown as CarbonCredit;
    await carbonCredit.waitForDeployment();

    await verificationEngine.setCarbonCreditContract(
      await carbonCredit.getAddress(),
    );
    await verificationEngine.whitelistDacUnit(dacUnitId, operator.address);
    await carbonCredit.setMinter(operator.address, true);
  });

  /** Seed a claim-bound ACTIVE seal and anchor it in the real registry. */
  async function anchorClaim(
    batch = sourceDataHash,
    job = JOB,
    sealId = SEAL_ID,
  ) {
    await seal.setSeal(job, sealId, purposeFor(dacUnitId, batch), true);
    await registry.anchor(dacUnitId, batch, job);
  }

  describe("defaults (tier opt-in until governance enables it)", function () {
    it("deploys with no registry and enforcement off", async function () {
      expect(await carbonCredit.sealRegistry()).to.equal(ethers.ZeroAddress);
      expect(await carbonCredit.sealAnchorRequired()).to.equal(false);
    });

    it("mints without any seal infrastructure when enforcement is off", async function () {
      await expect(mint()).to.emit(carbonCredit, "CreditMinted");
    });
  });

  describe("governance wiring (fail-closed)", function () {
    it("cannot enable enforcement without a registry", async function () {
      await expect(
        carbonCredit.setSealAnchorRequired(true),
      ).to.be.revertedWithCustomError(carbonCredit, "SealRegistryNotSet");
    });

    it("setSealRegistry emits and stores; setSealAnchorRequired then enables", async function () {
      await expect(carbonCredit.setSealRegistry(await registry.getAddress()))
        .to.emit(carbonCredit, "SealRegistryUpdated")
        .withArgs(ethers.ZeroAddress, await registry.getAddress());

      await expect(carbonCredit.setSealAnchorRequired(true))
        .to.emit(carbonCredit, "SealAnchorRequirementUpdated")
        .withArgs(true);
      expect(await carbonCredit.sealAnchorRequired()).to.equal(true);
    });

    it("clearing the registry auto-disables enforcement (never required-without-registry)", async function () {
      await carbonCredit.setSealRegistry(await registry.getAddress());
      await carbonCredit.setSealAnchorRequired(true);

      await expect(carbonCredit.setSealRegistry(ethers.ZeroAddress))
        .to.emit(carbonCredit, "SealAnchorRequirementUpdated")
        .withArgs(false);
      expect(await carbonCredit.sealAnchorRequired()).to.equal(false);
      expect(await carbonCredit.sealRegistry()).to.equal(ethers.ZeroAddress);

      // Mint path is open again (tier back to opt-in).
      await expect(mint()).to.emit(carbonCredit, "CreditMinted");
    });

    it("both setters are owner-only", async function () {
      await expect(
        carbonCredit
          .connect(stranger)
          .setSealRegistry(await registry.getAddress()),
      ).to.be.revertedWith("Ownable: caller is not the owner");
      await expect(
        carbonCredit.connect(stranger).setSealAnchorRequired(false),
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });

  describe("enforced minting (the moat, end to end)", function () {
    beforeEach(async function () {
      await carbonCredit.setSealRegistry(await registry.getAddress());
      await carbonCredit.setSealAnchorRequired(true);
    });

    it("blocks minting for a claim with no consensus anchor", async function () {
      await expect(mint())
        .to.be.revertedWithCustomError(carbonCredit, "SealAnchorMissing")
        .withArgs(dacUnitId, sourceDataHash);
    });

    it("mints when the claim carries a live anchor — full real-contract path", async function () {
      await anchorClaim();
      const tx = await mint();
      await expect(tx).to.emit(carbonCredit, "CreditMinted");

      // The mint really consumed the anchored claim: same claim can't
      // re-mint (data-hash replay guard), and the anchor is still live.
      expect(await registry.isAnchored(dacUnitId, sourceDataHash)).to.equal(
        true,
      );
      await expect(mint()).to.be.revertedWithCustomError(
        carbonCredit,
        "DataHashAlreadyUsed",
      );
    });

    it("consensus seal revocation blocks minting live — no oracle, no admin tx", async function () {
      await anchorClaim();
      await seal.setActive(SEAL_ID, false); // chain revokes the seal
      await expect(mint())
        .to.be.revertedWithCustomError(carbonCredit, "SealAnchorMissing")
        .withArgs(dacUnitId, sourceDataHash);
    });

    it("governance anchor revocation blocks minting", async function () {
      await anchorClaim();
      await registry.revoke(dacUnitId, sourceDataHash);
      await expect(mint()).to.be.revertedWithCustomError(
        carbonCredit,
        "SealAnchorMissing",
      );
    });

    it("an anchor for a different data window does not admit this claim", async function () {
      const otherBatch = ethers.keccak256(
        ethers.toUtf8Bytes("sensor_data_batch_002"),
      );
      await anchorClaim(otherBatch, "job-mrv-002", "b".repeat(64));
      await expect(mint())
        .to.be.revertedWithCustomError(carbonCredit, "SealAnchorMissing")
        .withArgs(dacUnitId, sourceDataHash);
    });

    it("still enforces the engine's physics checks on top of the anchor", async function () {
      await anchorClaim();
      // Anchored claim but purity below the engine's minimum: the seal
      // tier complements, not replaces, the three-phase verification.
      await expect(
        carbonCredit.connect(operator).mintVerifiedCredits(
          buyer.address,
          dacUnitId,
          sourceDataHash,
          captureTimestamp,
          co2AmountKg,
          energyConsumedKwh,
          latitude,
          longitude,
          50, // purity below minimum
          gridIntensity,
          ipfsMetadataUri,
          arweaveBackupTxId,
        ),
      ).to.be.revertedWithCustomError(carbonCredit, "VerificationFailed");
    });
  });
});
