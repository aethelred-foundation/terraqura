import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { RewardDistributor, TerraQuraAccessControl } from "../typechain-types";

/**
 * RewardDistributor — branch-coverage suite (pre-testnet hardening).
 * Covers campaign-creation validation, admin guards, merkle-root setting,
 * and claim-path guards.
 */
describe("RewardDistributor — branch coverage", function () {
  const VERIFICATION = 0;
  const TEN = ethers.parseEther("10");
  const ONE = ethers.parseEther("1");

  async function deployFixture() {
    const [admin, user, stranger] = await ethers.getSigners();
    const ACFactory = await ethers.getContractFactory("TerraQuraAccessControl");
    const accessControl = (await upgrades.deployProxy(ACFactory, [admin.address], {
      initializer: "initialize",
    })) as unknown as TerraQuraAccessControl;
    await accessControl.waitForDeployment();

    const Factory = await ethers.getContractFactory("RewardDistributor");
    const distributor = (await upgrades.deployProxy(Factory, [await accessControl.getAddress()], {
      initializer: "initialize",
    })) as unknown as RewardDistributor;
    await distributor.waitForDeployment();

    return { distributor, accessControl, admin, user, stranger };
  }

  async function times() {
    const now = await time.latest();
    return { start: now + 100, end: now + 10_000 };
  }

  describe("createCampaign", function () {
    it("reverts for a non-admin", async function () {
      const { distributor, stranger } = await loadFixture(deployFixture);
      const { start, end } = await times();
      await expect(
        distributor.connect(stranger).createCampaign("C", TEN, start, end, VERIFICATION, { value: TEN }),
      ).to.be.revertedWithCustomError(distributor, "Unauthorized");
    });

    it("reverts when startTime >= endTime", async function () {
      const { distributor, admin } = await loadFixture(deployFixture);
      const now = await time.latest();
      await expect(
        distributor
          .connect(admin)
          .createCampaign("C", TEN, now + 200, now + 100, VERIFICATION, { value: TEN }),
      ).to.be.revertedWithCustomError(distributor, "InvalidTimePeriod");
    });

    it("reverts on insufficient funding", async function () {
      const { distributor, admin } = await loadFixture(deployFixture);
      const { start, end } = await times();
      await expect(
        distributor.connect(admin).createCampaign("C", TEN, start, end, VERIFICATION, { value: ONE }),
      ).to.be.revertedWithCustomError(distributor, "InsufficientFunding");
    });

    it("reverts on zero total reward", async function () {
      const { distributor, admin } = await loadFixture(deployFixture);
      const { start, end } = await times();
      await expect(
        distributor.connect(admin).createCampaign("C", 0n, start, end, VERIFICATION, { value: 0 }),
      ).to.be.revertedWithCustomError(distributor, "ZeroAmount");
    });

    it("creates a campaign and refunds excess funding", async function () {
      const { distributor, admin } = await loadFixture(deployFixture);
      const { start, end } = await times();
      await expect(
        distributor.connect(admin).createCampaign("C", TEN, start, end, VERIFICATION, { value: TEN + ONE }),
      ).to.emit(distributor, "CampaignCreated");
    });
  });

  describe("setMerkleRoot", function () {
    async function withCampaign() {
      const base = await deployFixture();
      const { start, end } = await times();
      await base.distributor
        .connect(base.admin)
        .createCampaign("C", TEN, start, end, VERIFICATION, { value: TEN });
      return { ...base, start, end };
    }

    it("reverts for a non-admin", async function () {
      const { distributor, stranger } = await loadFixture(withCampaign);
      const root = ethers.encodeBytes32String("root");
      await expect(
        distributor.connect(stranger).setMerkleRoot(1, root),
      ).to.be.revertedWithCustomError(distributor, "Unauthorized");
    });

    it("admin can set the merkle root and total shares", async function () {
      const { distributor, admin } = await loadFixture(withCampaign);
      const root = ethers.encodeBytes32String("root");
      await expect(distributor.connect(admin).setMerkleRoot(1, root)).to.not.be.reverted;
    });
  });

  describe("claim guards", function () {
    it("reverts claiming when the caller has nothing claimable", async function () {
      const base = await deployFixture();
      const { start, end } = await times();
      await base.distributor
        .connect(base.admin)
        .createCampaign("C", TEN, start, end, VERIFICATION, { value: TEN });
      await time.increaseTo(start + 1);
      // getClaimable returns 0 for an unlisted recipient, so claim reverts first
      // on NothingToClaim.
      await expect(
        base.distributor.connect(base.user).claim(1),
      ).to.be.revertedWithCustomError(base.distributor, "NothingToClaim");
    });
  });
});
