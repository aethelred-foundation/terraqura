import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { CarbonVault, TerraQuraAccessControl, MockERC1155 } from "../typechain-types";

describe("CarbonVault", function () {
  const CREDIT_ID = 1;
  const LOCK_PERIOD = 7 * 24 * 3600; // 7 days
  const REWARD_RATE = ethers.parseEther("0.001"); // 0.001 AETH per second

  async function deployFixture() {
    const [owner, alice, bob, unauthorized] = await ethers.getSigners();

    // Deploy AccessControl
    const ACFactory = await ethers.getContractFactory("TerraQuraAccessControl");
    const accessControl = (await upgrades.deployProxy(ACFactory, [owner.address], {
      initializer: "initialize",
    })) as unknown as TerraQuraAccessControl;
    await accessControl.waitForDeployment();

    // Deploy MockERC1155
    const MockFactory = await ethers.getContractFactory("MockERC1155");
    const mockCredit = (await MockFactory.deploy()) as unknown as MockERC1155;
    await mockCredit.waitForDeployment();

    // Mint credits
    await mockCredit.mint(alice.address, CREDIT_ID, 100_000n, "0x");
    await mockCredit.mint(bob.address, CREDIT_ID, 100_000n, "0x");

    // Deploy CarbonVault
    const VaultFactory = await ethers.getContractFactory("CarbonVault");
    const vault = (await upgrades.deployProxy(
      VaultFactory,
      [await accessControl.getAddress(), await mockCredit.getAddress()],
      { initializer: "initialize" }
    )) as unknown as CarbonVault;
    await vault.waitForDeployment();

    // Approve vault
    const vaultAddr = await vault.getAddress();
    await mockCredit.connect(alice).setApprovalForAll(vaultAddr, true);
    await mockCredit.connect(bob).setApprovalForAll(vaultAddr, true);

    // Fund vault with AETH for rewards
    await owner.sendTransaction({ to: vaultAddr, value: ethers.parseEther("100") });

    return { vault, accessControl, mockCredit, owner, alice, bob, unauthorized };
  }

  async function fixtureWithVault() {
    const base = await loadFixture(deployFixture);
    await base.vault.connect(base.owner).createVault(CREDIT_ID, REWARD_RATE, LOCK_PERIOD);
    return base;
  }

  async function fixtureWithStake() {
    const base = await loadFixture(fixtureWithVault);
    await base.vault.connect(base.alice).stake(1, 1000n);
    return base;
  }

  // ==========================================
  // VAULT CREATION
  // ==========================================

  describe("Vault Creation", function () {
    it("should create a vault", async function () {
      const { vault, owner } = await loadFixture(deployFixture);
      await expect(vault.connect(owner).createVault(CREDIT_ID, REWARD_RATE, LOCK_PERIOD))
        .to.emit(vault, "VaultCreated")
        .withArgs(1, CREDIT_ID, REWARD_RATE, LOCK_PERIOD);

      const info = await vault.getVaultInfo(1);
      expect(info.creditId).to.equal(CREDIT_ID);
      expect(info.rewardRate).to.equal(REWARD_RATE);
      expect(info.lockPeriod).to.equal(LOCK_PERIOD);
      expect(info.totalStaked).to.equal(0);
    });

    it("should reject vault creation by non-admin", async function () {
      const { vault, alice } = await loadFixture(deployFixture);
      await expect(vault.connect(alice).createVault(CREDIT_ID, REWARD_RATE, LOCK_PERIOD))
        .to.be.revertedWithCustomError(vault, "Unauthorized");
    });

    it("should increment vault IDs", async function () {
      const { vault, owner } = await loadFixture(deployFixture);
      await vault.connect(owner).createVault(CREDIT_ID, REWARD_RATE, LOCK_PERIOD);
      await vault.connect(owner).createVault(2, REWARD_RATE, LOCK_PERIOD);
      expect(await vault.nextVaultId()).to.equal(3);
    });
  });

  // ==========================================
  // STAKING
  // ==========================================

  describe("Staking", function () {
    it("should stake credits", async function () {
      const { vault, alice, mockCredit } = await loadFixture(fixtureWithVault);
      const balBefore = await mockCredit.balanceOf(alice.address, CREDIT_ID);

      await expect(vault.connect(alice).stake(1, 1000n))
        .to.emit(vault, "Staked")
        .withArgs(1, alice.address, 1000n);

      const balAfter = await mockCredit.balanceOf(alice.address, CREDIT_ID);
      expect(balBefore - balAfter).to.equal(1000n);

      const info = await vault.getVaultInfo(1);
      expect(info.totalStaked).to.equal(1000n);
    });

    it("should revert staking zero amount", async function () {
      const { vault, alice } = await loadFixture(fixtureWithVault);
      await expect(vault.connect(alice).stake(1, 0))
        .to.be.revertedWithCustomError(vault, "ZeroAmount");
    });

    it("should revert staking to non-existent vault", async function () {
      const { vault, alice } = await loadFixture(fixtureWithVault);
      await expect(vault.connect(alice).stake(99, 1000n))
        .to.be.revertedWithCustomError(vault, "VaultNotFound");
    });

    it("should allow multiple stakers", async function () {
      const { vault, alice, bob } = await loadFixture(fixtureWithVault);
      await vault.connect(alice).stake(1, 1000n);
      await vault.connect(bob).stake(1, 2000n);

      const info = await vault.getVaultInfo(1);
      expect(info.totalStaked).to.equal(3000n);
    });
  });

  // ==========================================
  // UNSTAKING
  // ==========================================

  describe("Unstaking", function () {
    it("should unstake after lock period", async function () {
      const { vault, alice, mockCredit } = await loadFixture(fixtureWithStake);

      // Advance past lock period
      await time.increase(LOCK_PERIOD + 1);

      const balBefore = await mockCredit.balanceOf(alice.address, CREDIT_ID);
      await vault.connect(alice).unstake(1, 1000n);
      const balAfter = await mockCredit.balanceOf(alice.address, CREDIT_ID);

      expect(balAfter - balBefore).to.equal(1000n);
    });

    it("should not unstake during lock period", async function () {
      const { vault, alice } = await loadFixture(fixtureWithStake);
      await expect(vault.connect(alice).unstake(1, 1000n))
        .to.be.revertedWithCustomError(vault, "LockPeriodActive");
    });

    it("should not unstake more than staked", async function () {
      const { vault, alice } = await loadFixture(fixtureWithStake);
      await time.increase(LOCK_PERIOD + 1);
      await expect(vault.connect(alice).unstake(1, 2000n))
        .to.be.revertedWithCustomError(vault, "InsufficientStake");
    });

    it("should revert unstaking zero", async function () {
      const { vault, alice } = await loadFixture(fixtureWithStake);
      await time.increase(LOCK_PERIOD + 1);
      await expect(vault.connect(alice).unstake(1, 0))
        .to.be.revertedWithCustomError(vault, "ZeroAmount");
    });

    it("should allow partial unstake", async function () {
      const { vault, alice } = await loadFixture(fixtureWithStake);
      await time.increase(LOCK_PERIOD + 1);
      await vault.connect(alice).unstake(1, 500n);

      const [amount] = await vault.getUserStake(1, alice.address);
      expect(amount).to.equal(500n);
    });
  });

  // ==========================================
  // REWARDS
  // ==========================================

  describe("Rewards", function () {
    it("should accumulate rewards over time", async function () {
      const { vault, alice } = await loadFixture(fixtureWithStake);
      await time.increase(100);

      const pending = await vault.pendingRewards(1, alice.address);
      // ~100 seconds * 0.001 AETH/s = ~0.1 AETH
      expect(pending).to.be.gt(0);
    });

    it("should claim rewards", async function () {
      const { vault, alice } = await loadFixture(fixtureWithStake);
      await time.increase(100);

      const balBefore = await ethers.provider.getBalance(alice.address);
      const tx = await vault.connect(alice).claimRewards(1);
      await expect(tx).to.emit(vault, "RewardsClaimed");

      const balAfter = await ethers.provider.getBalance(alice.address);
      // Should have received rewards (minus gas)
      expect(balAfter).to.be.gt(balBefore - ethers.parseEther("0.01"));
    });

    it("should revert claim with no rewards", async function () {
      const { vault, bob } = await loadFixture(fixtureWithVault);
      await expect(vault.connect(bob).claimRewards(1))
        .to.be.revertedWithCustomError(vault, "NoRewards");
    });

    it("should show correct pending rewards", async function () {
      const { vault, alice } = await loadFixture(fixtureWithStake);
      const elapsed = 200;
      await time.increase(elapsed);

      const pending = await vault.pendingRewards(1, alice.address);
      // Single staker gets all rewards: ~200 * 0.001e18 = ~0.2e18
      const expected = REWARD_RATE * BigInt(elapsed);
      // Allow 1 second margin for block timing
      expect(pending).to.be.closeTo(expected, REWARD_RATE * 2n);
    });

    it("should distribute rewards proportionally among multiple stakers", async function () {
      const { vault, alice, bob } = await loadFixture(fixtureWithVault);

      // Alice stakes 1000, Bob stakes 3000 (1:3 ratio)
      await vault.connect(alice).stake(1, 1000n);
      await vault.connect(bob).stake(1, 3000n);

      await time.increase(400);

      const alicePending = await vault.pendingRewards(1, alice.address);
      const bobPending = await vault.pendingRewards(1, bob.address);

      // Bob should have ~3x Alice's rewards
      // Use rough approximation due to block timing
      expect(bobPending).to.be.gt(alicePending * 2n);
    });

    it("should reset pending after claim", async function () {
      const { vault, alice } = await loadFixture(fixtureWithStake);
      await time.increase(100);

      await vault.connect(alice).claimRewards(1);
      // Pending should be near zero (maybe 1 block of rewards)
      const pending = await vault.pendingRewards(1, alice.address);
      expect(pending).to.be.lte(REWARD_RATE * 2n);
    });
  });

  // ==========================================
  // EMERGENCY WITHDRAW
  // ==========================================

  describe("Emergency Withdraw", function () {
    it("should emergency withdraw during lock period", async function () {
      const { vault, alice, mockCredit } = await loadFixture(fixtureWithStake);

      const balBefore = await mockCredit.balanceOf(alice.address, CREDIT_ID);
      await vault.connect(alice).emergencyWithdraw(1);
      const balAfter = await mockCredit.balanceOf(alice.address, CREDIT_ID);

      expect(balAfter - balBefore).to.equal(1000n);
    });

    it("should forfeit rewards on emergency withdraw", async function () {
      const { vault, alice } = await loadFixture(fixtureWithStake);
      await time.increase(100);

      // Verify there were pending rewards
      const pendingBefore = await vault.pendingRewards(1, alice.address);
      expect(pendingBefore).to.be.gt(0);

      await vault.connect(alice).emergencyWithdraw(1);

      // Pending should be 0 after emergency withdraw
      const pendingAfter = await vault.pendingRewards(1, alice.address);
      expect(pendingAfter).to.equal(0);
    });

    it("should revert emergency withdraw with zero balance", async function () {
      const { vault, bob } = await loadFixture(fixtureWithVault);
      await expect(vault.connect(bob).emergencyWithdraw(1))
        .to.be.revertedWithCustomError(vault, "ZeroAmount");
    });
  });

  // ==========================================
  // ZERO REWARD RATE
  // ==========================================

  describe("Zero Reward Rate Vault", function () {
    it("should not accumulate rewards with zero rate", async function () {
      const { vault, owner, alice } = await loadFixture(deployFixture);
      await vault.connect(owner).createVault(CREDIT_ID, 0, LOCK_PERIOD);
      await vault.connect(alice).stake(1, 1000n);
      await time.increase(1000);

      const pending = await vault.pendingRewards(1, alice.address);
      expect(pending).to.equal(0);
    });
  });

  // ==========================================
  // VIEW FUNCTIONS
  // ==========================================

  describe("View Functions", function () {
    it("should return user stake info", async function () {
      const { vault, alice } = await loadFixture(fixtureWithStake);
      const [amount, startTime] = await vault.getUserStake(1, alice.address);
      expect(amount).to.equal(1000n);
      expect(startTime).to.be.gt(0);
    });
  });
});
