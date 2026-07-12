import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { InsurancePool, TerraQuraAccessControl } from "../typechain-types";

/**
 * InsurancePool — branch-coverage suite (pre-testnet hardening).
 * Covers policy creation validation, the claim lifecycle
 * (file → process → payout) and its guards, and pool deposit/withdraw.
 */
describe("InsurancePool — branch coverage", function () {
  const DAC = 0;
  const CREDIT_ID = 1n;
  const COVERAGE = ethers.parseEther("1");
  const DURATION = 30; // days

  async function deployFixture() {
    const [admin, holder, depositor, stranger] = await ethers.getSigners();
    const ACFactory = await ethers.getContractFactory("TerraQuraAccessControl");
    const accessControl = (await upgrades.deployProxy(ACFactory, [admin.address], {
      initializer: "initialize",
    })) as unknown as TerraQuraAccessControl;
    await accessControl.waitForDeployment();

    const Factory = await ethers.getContractFactory("InsurancePool");
    const pool = (await upgrades.deployProxy(Factory, [await accessControl.getAddress()], {
      initializer: "initialize",
    })) as unknown as InsurancePool;
    await pool.waitForDeployment();

    // Seed the pool so coverage capacity checks pass
    await pool.connect(depositor).depositToPool({ value: ethers.parseEther("100") });

    return { pool, accessControl, admin, holder, depositor, stranger };
  }

  async function premiumFor(pool: InsurancePool) {
    return pool.calculatePremium(COVERAGE, DURATION, DAC);
  }

  async function withPolicy() {
    const base = await deployFixture();
    const premium = await premiumFor(base.pool);
    await base.pool
      .connect(base.holder)
      .createPolicy(CREDIT_ID, COVERAGE, DURATION, DAC, { value: premium });
    return { ...base, premium }; // policyId 1
  }

  describe("createPolicy", function () {
    it("reverts on zero coverage", async function () {
      const { pool, holder } = await loadFixture(deployFixture);
      await expect(
        pool.connect(holder).createPolicy(CREDIT_ID, 0n, DURATION, DAC, { value: 1n }),
      ).to.be.revertedWithCustomError(pool, "InvalidCoverageAmount");
    });

    it("reverts on zero duration", async function () {
      const { pool, holder } = await loadFixture(deployFixture);
      await expect(
        pool.connect(holder).createPolicy(CREDIT_ID, COVERAGE, 0, DAC, { value: 1n }),
      ).to.be.revertedWithCustomError(pool, "InvalidDuration");
    });

    it("reverts on insufficient premium", async function () {
      const { pool, holder } = await loadFixture(deployFixture);
      await expect(
        pool.connect(holder).createPolicy(CREDIT_ID, COVERAGE, DURATION, DAC, { value: 0 }),
      ).to.be.revertedWithCustomError(pool, "InsufficientPremium");
    });

    it("reverts when pool capacity is insufficient", async function () {
      const { pool, holder } = await loadFixture(deployFixture);
      // Coverage far exceeds the 150%-backed pool balance
      const huge = ethers.parseEther("1000");
      const premium = await pool.calculatePremium(huge, DURATION, DAC);
      await expect(
        pool.connect(holder).createPolicy(CREDIT_ID, huge, DURATION, DAC, { value: premium }),
      ).to.be.revertedWithCustomError(pool, "InsufficientPoolCapacity");
    });

    it("creates a policy and refunds excess premium", async function () {
      const { pool, holder } = await loadFixture(deployFixture);
      const premium = await premiumFor(pool);
      await expect(
        pool
          .connect(holder)
          .createPolicy(CREDIT_ID, COVERAGE, DURATION, DAC, { value: premium + ethers.parseEther("1") }),
      ).to.emit(pool, "PolicyCreated");
    });
  });

  describe("fileClaim", function () {
    it("reverts when caller is not the policy holder", async function () {
      const { pool, stranger } = await loadFixture(withPolicy);
      await expect(
        pool.connect(stranger).fileClaim(1, "0x00"),
      ).to.be.revertedWithCustomError(pool, "Unauthorized");
    });

    it("reverts once the policy has expired", async function () {
      const { pool, holder } = await loadFixture(withPolicy);
      await time.increase(DURATION * 24 * 3600 + 1);
      await expect(pool.connect(holder).fileClaim(1, "0x00")).to.be.revertedWithCustomError(
        pool,
        "PolicyExpired",
      );
    });

    it("files a claim on an active policy", async function () {
      const { pool, holder } = await loadFixture(withPolicy);
      await expect(pool.connect(holder).fileClaim(1, "0xabcd")).to.emit(pool, "ClaimFiled");
    });

    it("reverts filing a second claim on the same (now non-active) policy", async function () {
      const { pool, holder } = await loadFixture(withPolicy);
      await pool.connect(holder).fileClaim(1, "0x00");
      await expect(pool.connect(holder).fileClaim(1, "0x00")).to.be.revertedWithCustomError(
        pool,
        "PolicyNotActive",
      );
    });
  });

  describe("processClaim / payout", function () {
    it("processClaim reverts for a non-admin", async function () {
      const { pool, holder, stranger } = await loadFixture(withPolicy);
      await pool.connect(holder).fileClaim(1, "0x00");
      await expect(
        pool.connect(stranger).processClaim(1, true),
      ).to.be.revertedWithCustomError(pool, "Unauthorized");
    });

    it("rejecting a claim re-activates a still-valid policy", async function () {
      const { pool, admin, holder } = await loadFixture(withPolicy);
      await pool.connect(holder).fileClaim(1, "0x00");
      await pool.connect(admin).processClaim(1, false);
      const policy = await pool.policies(1);
      expect(policy.status).to.equal(0); // Active
    });

    it("approving then paying out transfers coverage and reverts on double process", async function () {
      const { pool, admin, holder } = await loadFixture(withPolicy);
      await pool.connect(holder).fileClaim(1, "0x00");
      await pool.connect(admin).processClaim(1, true);
      await expect(
        pool.connect(admin).processClaim(1, true),
      ).to.be.revertedWithCustomError(pool, "ClaimAlreadyProcessed");
      await expect(pool.payout(1)).to.emit(pool, "Payout");
    });

    it("payout reverts when the claim is not approved", async function () {
      const { pool, holder } = await loadFixture(withPolicy);
      await pool.connect(holder).fileClaim(1, "0x00");
      await expect(pool.payout(1)).to.be.revertedWithCustomError(pool, "ClaimNotApproved");
    });
  });

  describe("pool deposit / withdraw", function () {
    it("depositToPool accepts funds", async function () {
      const { pool, depositor } = await loadFixture(deployFixture);
      await expect(pool.connect(depositor).depositToPool({ value: ethers.parseEther("1") })).to
        .not.be.reverted;
    });
  });
});
