import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { CarbonVault, TerraQuraAccessControl, MockERC1155 } from "../typechain-types";

/**
 * CarbonVault — branch-coverage suite (pre-testnet hardening).
 *
 * Covers the error paths, lock-period enforcement, emergency withdraw,
 * reward edge cases, and admin-role guards left uncovered by the happy-path
 * suite.
 */
describe("CarbonVault — branch coverage", function () {
  const CREDIT_ID = 1;
  const LOCK = 7 * 24 * 3600;
  const RATE = ethers.parseEther("0.001");

  async function deployFixture() {
    const [owner, alice, bob, stranger] = await ethers.getSigners();

    const ACFactory = await ethers.getContractFactory("TerraQuraAccessControl");
    const accessControl = (await upgrades.deployProxy(ACFactory, [owner.address], {
      initializer: "initialize",
    })) as unknown as TerraQuraAccessControl;
    await accessControl.waitForDeployment();

    const MockFactory = await ethers.getContractFactory("MockERC1155");
    const mockCredit = (await MockFactory.deploy()) as unknown as MockERC1155;
    await mockCredit.waitForDeployment();
    await mockCredit.mint(alice.address, CREDIT_ID, 100_000n, "0x");
    await mockCredit.mint(bob.address, CREDIT_ID, 100_000n, "0x");

    const VaultFactory = await ethers.getContractFactory("CarbonVault");
    const vault = (await upgrades.deployProxy(
      VaultFactory,
      [await accessControl.getAddress(), await mockCredit.getAddress()],
      { initializer: "initialize" },
    )) as unknown as CarbonVault;
    await vault.waitForDeployment();

    const vaultAddr = await vault.getAddress();
    await mockCredit.connect(alice).setApprovalForAll(vaultAddr, true);
    await mockCredit.connect(bob).setApprovalForAll(vaultAddr, true);
    await vault.connect(owner).fundRewards({ value: ethers.parseEther("100") });

    return { vault, accessControl, mockCredit, owner, alice, bob, stranger };
  }

  async function withVault() {
    const base = await loadFixture(deployFixture);
    await base.vault.connect(base.owner).createVault(CREDIT_ID, RATE, LOCK);
    return base;
  }

  async function withStake() {
    const base = await withVault();
    await base.vault.connect(base.alice).stake(1, 1000n);
    return base;
  }

  describe("createVault", function () {
    it("reverts for a non-admin caller", async function () {
      const { vault, stranger } = await loadFixture(deployFixture);
      await expect(
        vault.connect(stranger).createVault(CREDIT_ID, RATE, LOCK),
      ).to.be.revertedWithCustomError(vault, "Unauthorized");
    });
  });

  describe("vaultExists guard", function () {
    it("stake reverts for an unknown vault id", async function () {
      const { vault, alice } = await loadFixture(deployFixture);
      await expect(vault.connect(alice).stake(999, 1000n)).to.be.revertedWithCustomError(
        vault,
        "VaultNotFound",
      );
    });

    it("unstake reverts for an unknown vault id", async function () {
      const { vault, alice } = await loadFixture(deployFixture);
      await expect(vault.connect(alice).unstake(999, 1n)).to.be.revertedWithCustomError(
        vault,
        "VaultNotFound",
      );
    });
  });

  describe("stake", function () {
    it("reverts on zero amount", async function () {
      const { vault, alice } = await withVault();
      await expect(vault.connect(alice).stake(1, 0n)).to.be.revertedWithCustomError(
        vault,
        "ZeroAmount",
      );
    });

    it("accepts a valid stake and updates totals", async function () {
      const { vault, alice } = await withVault();
      await expect(vault.connect(alice).stake(1, 1000n)).to.emit(vault, "Staked");
      const info = await vault.userStakes(1, alice.address);
      expect(info.amount).to.equal(1000n);
    });

    it("runs the updateReward account branch on a second stake", async function () {
      const { vault, alice } = await withStake();
      await time.increase(3600);
      await expect(vault.connect(alice).stake(1, 500n)).to.emit(vault, "Staked");
      // pending reward accrued during the elapsed hour
      expect(await vault.pendingRewards(1, alice.address)).to.be.gt(0);
    });
  });

  describe("unstake", function () {
    it("reverts on zero amount", async function () {
      const { vault, alice } = await withStake();
      await expect(vault.connect(alice).unstake(1, 0n)).to.be.revertedWithCustomError(
        vault,
        "ZeroAmount",
      );
    });

    it("reverts when unstaking more than staked", async function () {
      const { vault, alice } = await withStake();
      await expect(vault.connect(alice).unstake(1, 5000n)).to.be.revertedWithCustomError(
        vault,
        "InsufficientStake",
      );
    });

    it("reverts while the lock period is active", async function () {
      const { vault, alice } = await withStake();
      await expect(vault.connect(alice).unstake(1, 1000n)).to.be.revertedWithCustomError(
        vault,
        "LockPeriodActive",
      );
    });

    it("succeeds after the lock period elapses", async function () {
      const { vault, alice } = await withStake();
      await time.increase(LOCK + 1);
      await expect(vault.connect(alice).unstake(1, 1000n)).to.emit(vault, "Unstaked");
    });
  });

  describe("emergencyWithdraw", function () {
    it("reverts when there is nothing staked", async function () {
      const { vault, bob } = await withVault();
      await expect(vault.connect(bob).emergencyWithdraw(1)).to.be.revertedWithCustomError(
        vault,
        "ZeroAmount",
      );
    });

    it("returns credits and forfeits rewards", async function () {
      const { vault, alice } = await withStake();
      await time.increase(3600);
      await expect(vault.connect(alice).emergencyWithdraw(1)).to.emit(vault, "Unstaked");
      // Rewards forfeited: pending resets to 0
      expect(await vault.pendingRewards(1, alice.address)).to.equal(0);
      const info = await vault.userStakes(1, alice.address);
      expect(info.amount).to.equal(0n);
    });
  });

  describe("claimRewards", function () {
    it("reverts when there are no rewards to claim", async function () {
      const { vault, bob } = await withVault();
      await expect(vault.connect(bob).claimRewards(1)).to.be.revertedWithCustomError(
        vault,
        "NoRewards",
      );
    });

    it("pays accrued rewards after time passes", async function () {
      const { vault, alice } = await withStake();
      await time.increase(3600);
      await expect(vault.connect(alice).claimRewards(1)).to.emit(vault, "RewardsClaimed");
    });
  });

  describe("admin role guards", function () {
    it("pause reverts for a non-pauser", async function () {
      const { vault, stranger } = await loadFixture(deployFixture);
      await expect(vault.connect(stranger).pause()).to.be.revertedWithCustomError(
        vault,
        "Unauthorized",
      );
    });

    it("unpause reverts for a non-admin", async function () {
      const { vault, owner, stranger } = await loadFixture(deployFixture);
      await vault.connect(owner).pause();
      await expect(vault.connect(stranger).unpause()).to.be.revertedWithCustomError(
        vault,
        "Unauthorized",
      );
    });

    it("owner can pause and unpause; staking is blocked while paused", async function () {
      const { vault, owner, alice } = await withVault();
      await vault.connect(owner).pause();
      await expect(vault.connect(alice).stake(1, 1000n)).to.be.reverted;
      await vault.connect(owner).unpause();
      await expect(vault.connect(alice).stake(1, 1000n)).to.emit(vault, "Staked");
    });
  });
});
