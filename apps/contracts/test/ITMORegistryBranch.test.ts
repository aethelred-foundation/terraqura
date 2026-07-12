import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { ITMORegistry, TerraQuraAccessControl } from "../typechain-types";

/**
 * ITMORegistry — branch-coverage suite (pre-testnet hardening).
 * Covers registration validation, the transfer state machine
 * (pending → authorized → confirmed / rejected), and the compliance guard.
 */
describe("ITMORegistry — branch coverage", function () {
  const BR = "0x4252"; // "BR"
  const CH = "0x4348"; // "CH"

  async function deployFixture() {
    const [admin, officer, stranger] = await ethers.getSigners();
    const ACFactory = await ethers.getContractFactory("TerraQuraAccessControl");
    const accessControl = (await upgrades.deployProxy(ACFactory, [admin.address], {
      initializer: "initialize",
    })) as unknown as TerraQuraAccessControl;
    await accessControl.waitForDeployment();
    await accessControl.grantRole(await accessControl.COMPLIANCE_ROLE(), officer.address);

    const Factory = await ethers.getContractFactory("ITMORegistry");
    const registry = (await upgrades.deployProxy(Factory, [await accessControl.getAddress()], {
      initializer: "initialize",
    })) as unknown as ITMORegistry;
    await registry.waitForDeployment();

    return { registry, admin, officer, stranger };
  }

  async function withTransfer() {
    const base = await deployFixture();
    await base.registry.connect(base.officer).registerTransfer(1, BR, CH, 1000, 2026);
    return base; // transferId 1
  }

  describe("registerTransfer", function () {
    it("reverts for a non-compliance caller", async function () {
      const { registry, stranger } = await loadFixture(deployFixture);
      await expect(
        registry.connect(stranger).registerTransfer(1, BR, CH, 1000, 2026),
      ).to.be.revertedWithCustomError(registry, "Unauthorized");
    });

    it("reverts on a zero country code", async function () {
      const { registry, officer } = await loadFixture(deployFixture);
      await expect(
        registry.connect(officer).registerTransfer(1, "0x0000", CH, 1000, 2026),
      ).to.be.revertedWithCustomError(registry, "InvalidCountryCode");
    });

    it("reverts when from and to countries are the same", async function () {
      const { registry, officer } = await loadFixture(deployFixture);
      await expect(
        registry.connect(officer).registerTransfer(1, BR, BR, 1000, 2026),
      ).to.be.revertedWithCustomError(registry, "SameCountry");
    });

    it("reverts on zero amount", async function () {
      const { registry, officer } = await loadFixture(deployFixture);
      await expect(
        registry.connect(officer).registerTransfer(1, BR, CH, 0, 2026),
      ).to.be.revertedWithCustomError(registry, "InvalidAmount");
    });

    it("reverts on a duplicate credit/from/to transfer", async function () {
      const { registry, officer } = await loadFixture(withTransfer);
      await expect(
        registry.connect(officer).registerTransfer(1, BR, CH, 500, 2026),
      ).to.be.revertedWithCustomError(registry, "TransferAlreadyExists");
    });

    it("registers a valid transfer", async function () {
      const { registry, officer } = await loadFixture(deployFixture);
      await expect(
        registry.connect(officer).registerTransfer(1, BR, CH, 1000, 2026),
      ).to.emit(registry, "TransferRegistered");
    });
  });

  describe("authorize / confirm / reject state machine", function () {
    it("authorize reverts when not pending", async function () {
      const { registry, officer } = await loadFixture(withTransfer);
      await registry.connect(officer).authorizeTransfer(1);
      await expect(
        registry.connect(officer).authorizeTransfer(1),
      ).to.be.revertedWithCustomError(registry, "TransferNotPending");
    });

    it("confirm reverts when not authorized", async function () {
      const { registry, officer } = await loadFixture(withTransfer);
      await expect(
        registry.connect(officer).confirmTransfer(1),
      ).to.be.revertedWithCustomError(registry, "TransferNotAuthorized");
    });

    it("full happy path: authorize applies a corresponding adjustment, confirm credits destination", async function () {
      const { registry, officer } = await loadFixture(withTransfer);
      await expect(registry.connect(officer).authorizeTransfer(1)).to.emit(
        registry,
        "TransferAuthorized",
      );
      const fromBal = await registry.countryBalances(BR);
      expect(fromBal.totalTransferredOut).to.equal(1000n);
      await expect(registry.connect(officer).confirmTransfer(1)).to.emit(
        registry,
        "TransferConfirmed",
      );
      const toBal = await registry.countryBalances(CH);
      expect(toBal.totalTransferredIn).to.equal(1000n);
    });

    it("reject on a pending transfer marks it rejected", async function () {
      const { registry, officer } = await loadFixture(withTransfer);
      await expect(registry.connect(officer).rejectTransfer(1)).to.emit(
        registry,
        "TransferRejected",
      );
    });

    it("reject on an authorized transfer reverses the adjustment", async function () {
      const { registry, officer } = await loadFixture(withTransfer);
      await registry.connect(officer).authorizeTransfer(1);
      await registry.connect(officer).rejectTransfer(1);
      const fromBal = await registry.countryBalances(BR);
      expect(fromBal.totalTransferredOut).to.equal(0n);
    });

    it("reject reverts once confirmed or already rejected", async function () {
      const { registry, officer } = await loadFixture(withTransfer);
      await registry.connect(officer).authorizeTransfer(1);
      await registry.connect(officer).confirmTransfer(1);
      await expect(
        registry.connect(officer).rejectTransfer(1),
      ).to.be.revertedWithCustomError(registry, "TransferAlreadyProcessed");
    });
  });
});
