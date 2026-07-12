import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { CarbonAMM, TerraQuraAccessControl, MockERC1155 } from "../typechain-types";

/**
 * CarbonAMM — branch-coverage suite (pre-testnet hardening).
 *
 * Targets the error paths, admin-role guards, and boundary conditions the
 * happy-path suite leaves uncovered: every custom revert, both swap
 * directions at their edge cases, empty/zero pools, slippage bounds, and the
 * role checks on withdraw/pause/unpause/upgrade.
 */
describe("CarbonAMM — branch coverage", function () {
  const CREDIT_ID = 1;
  const SUPPLY = 1_000_000n;

  async function deployFixture() {
    const [owner, alice, bob, treasury, stranger] = await ethers.getSigners();

    const ACFactory = await ethers.getContractFactory("TerraQuraAccessControl");
    const accessControl = (await upgrades.deployProxy(ACFactory, [owner.address], {
      initializer: "initialize",
    })) as unknown as TerraQuraAccessControl;
    await accessControl.waitForDeployment();
    await accessControl.grantRole(await accessControl.TREASURY_ROLE(), treasury.address);

    const MockFactory = await ethers.getContractFactory("MockERC1155");
    const mockCredit = (await MockFactory.deploy()) as unknown as MockERC1155;
    await mockCredit.waitForDeployment();
    await mockCredit.mint(alice.address, CREDIT_ID, SUPPLY, "0x");
    await mockCredit.mint(bob.address, CREDIT_ID, SUPPLY, "0x");

    const AMMFactory = await ethers.getContractFactory("CarbonAMM");
    const amm = (await upgrades.deployProxy(
      AMMFactory,
      [await accessControl.getAddress(), await mockCredit.getAddress(), treasury.address],
      { initializer: "initialize" },
    )) as unknown as CarbonAMM;
    await amm.waitForDeployment();

    const ammAddr = await amm.getAddress();
    await mockCredit.connect(alice).setApprovalForAll(ammAddr, true);
    await mockCredit.connect(bob).setApprovalForAll(ammAddr, true);

    return { amm, accessControl, mockCredit, owner, alice, bob, treasury, stranger };
  }

  async function withPool() {
    const base = await loadFixture(deployFixture);
    await base.amm.connect(base.alice).createPool(CREDIT_ID);
    return base;
  }

  async function withLiquidity() {
    const base = await withPool();
    await base.amm
      .connect(base.alice)
      .addLiquidity(1, 10_000n, 0, { value: ethers.parseEther("10") });
    return base;
  }

  describe("createPool", function () {
    it("reverts on duplicate creditId", async function () {
      const { amm, alice } = await withPool();
      await expect(amm.connect(alice).createPool(CREDIT_ID))
        .to.be.revertedWithCustomError(amm, "PoolAlreadyExists")
        .withArgs(CREDIT_ID);
    });
  });

  describe("addLiquidity", function () {
    it("reverts for a non-existent pool", async function () {
      const { amm, alice } = await loadFixture(deployFixture);
      await expect(
        amm.connect(alice).addLiquidity(999, 1000n, 0, { value: ethers.parseEther("1") }),
      ).to.be.revertedWithCustomError(amm, "PoolNotFound");
    });

    it("reverts on zero AETHEL value", async function () {
      const { amm, alice } = await withPool();
      await expect(
        amm.connect(alice).addLiquidity(1, 1000n, 0, { value: 0 }),
      ).to.be.revertedWithCustomError(amm, "ZeroAmount");
    });

    it("reverts on zero credit amount", async function () {
      const { amm, alice } = await withPool();
      await expect(
        amm.connect(alice).addLiquidity(1, 0n, 0, { value: ethers.parseEther("1") }),
      ).to.be.revertedWithCustomError(amm, "ZeroAmount");
    });

    it("reverts when initial liquidity is below the minimum lock", async function () {
      const { amm, alice } = await withPool();
      // sqrt(1 * 1) = 1 <= MINIMUM_LIQUIDITY
      await expect(
        amm.connect(alice).addLiquidity(1, 1n, 0, { value: 1n }),
      ).to.be.revertedWithCustomError(amm, "InsufficientLiquidity");
    });

    it("reverts when minted LP is below minLpTokens (slippage) on first deposit", async function () {
      const { amm, alice } = await withPool();
      await expect(
        amm
          .connect(alice)
          .addLiquidity(1, 10_000n, ethers.MaxUint256, { value: ethers.parseEther("10") }),
      ).to.be.revertedWithCustomError(amm, "SlippageExceeded");
    });

    it("takes the proportional (min) branch on a second deposit", async function () {
      const { amm, bob } = await withLiquidity();
      // Lopsided deposit exercises the lpFromAeth < lpFromCredit min() selection
      await expect(
        amm.connect(bob).addLiquidity(1, 100_000n, 0, { value: ethers.parseEther("1") }),
      ).to.emit(amm, "LiquidityAdded");
    });

    it("reverts a proportional deposit that undershoots minLpTokens", async function () {
      const { amm, bob } = await withLiquidity();
      await expect(
        amm
          .connect(bob)
          .addLiquidity(1, 5_000n, ethers.MaxUint256, { value: ethers.parseEther("5") }),
      ).to.be.revertedWithCustomError(amm, "SlippageExceeded");
    });
  });

  describe("removeLiquidity", function () {
    it("reverts for a non-existent pool", async function () {
      const { amm, alice } = await loadFixture(deployFixture);
      await expect(
        amm.connect(alice).removeLiquidity(999, 1n, 0, 0),
      ).to.be.revertedWithCustomError(amm, "PoolNotFound");
    });

    it("reverts on zero LP tokens", async function () {
      const { amm, alice } = await withLiquidity();
      await expect(
        amm.connect(alice).removeLiquidity(1, 0n, 0, 0),
      ).to.be.revertedWithCustomError(amm, "ZeroAmount");
    });

    it("reverts when removing more LP than owned", async function () {
      const { amm, bob } = await withLiquidity();
      await expect(
        amm.connect(bob).removeLiquidity(1, 1n, 0, 0),
      ).to.be.revertedWithCustomError(amm, "InsufficientLpTokens");
    });

    it("reverts when output undershoots minAeth/minCredits", async function () {
      const { amm, alice } = await withLiquidity();
      const bal = await amm.lpBalances(1, alice.address);
      await expect(
        amm.connect(alice).removeLiquidity(1, bal, ethers.MaxUint256, 0),
      ).to.be.revertedWithCustomError(amm, "SlippageExceeded");
    });

    it("succeeds and returns assets for a valid removal", async function () {
      const { amm, alice } = await withLiquidity();
      const bal = await amm.lpBalances(1, alice.address);
      await expect(amm.connect(alice).removeLiquidity(1, bal, 0, 0)).to.emit(
        amm,
        "LiquidityRemoved",
      );
    });
  });

  describe("swapAethForCredits", function () {
    it("reverts for a non-existent pool", async function () {
      const { amm, bob } = await loadFixture(deployFixture);
      await expect(
        amm.connect(bob).swapAethForCredits(999, 0, { value: ethers.parseEther("1") }),
      ).to.be.revertedWithCustomError(amm, "PoolNotFound");
    });

    it("reverts on an empty (no-liquidity) pool", async function () {
      const { amm, bob } = await withPool();
      await expect(
        amm.connect(bob).swapAethForCredits(1, 0, { value: ethers.parseEther("1") }),
      ).to.be.revertedWithCustomError(amm, "EmptyPool");
    });

    it("reverts on zero input value", async function () {
      const { amm, bob } = await withLiquidity();
      await expect(
        amm.connect(bob).swapAethForCredits(1, 0, { value: 0 }),
      ).to.be.revertedWithCustomError(amm, "ZeroAmount");
    });

    it("reverts when output undershoots minCreditsOut", async function () {
      const { amm, bob } = await withLiquidity();
      await expect(
        amm
          .connect(bob)
          .swapAethForCredits(1, ethers.MaxUint256, { value: ethers.parseEther("1") }),
      ).to.be.revertedWithCustomError(amm, "SlippageExceeded");
    });

    it("succeeds and emits Swap for a valid trade", async function () {
      const { amm, bob } = await withLiquidity();
      await expect(
        amm.connect(bob).swapAethForCredits(1, 0, { value: ethers.parseEther("1") }),
      ).to.emit(amm, "Swap");
    });
  });

  describe("swapCreditsForAeth", function () {
    it("reverts for a non-existent pool", async function () {
      const { amm, bob } = await loadFixture(deployFixture);
      await expect(
        amm.connect(bob).swapCreditsForAeth(999, 1000n, 0),
      ).to.be.revertedWithCustomError(amm, "PoolNotFound");
    });

    it("reverts on an empty pool", async function () {
      const { amm, bob } = await withPool();
      await expect(
        amm.connect(bob).swapCreditsForAeth(1, 1000n, 0),
      ).to.be.revertedWithCustomError(amm, "EmptyPool");
    });

    it("reverts on zero credit amount", async function () {
      const { amm, bob } = await withLiquidity();
      await expect(
        amm.connect(bob).swapCreditsForAeth(1, 0n, 0),
      ).to.be.revertedWithCustomError(amm, "ZeroAmount");
    });

    it("reverts when output undershoots minAethOut", async function () {
      const { amm, bob } = await withLiquidity();
      await expect(
        amm.connect(bob).swapCreditsForAeth(1, 1000n, ethers.MaxUint256),
      ).to.be.revertedWithCustomError(amm, "SlippageExceeded");
    });

    it("succeeds and emits Swap for a valid trade", async function () {
      const { amm, bob } = await withLiquidity();
      await expect(amm.connect(bob).swapCreditsForAeth(1, 1000n, 0)).to.emit(amm, "Swap");
    });
  });

  describe("getQuote / getSpotPrice", function () {
    it("getQuote returns 0 for an empty pool", async function () {
      const { amm } = await withPool();
      expect(await amm.getQuote(1, 1000n, true)).to.equal(0);
    });

    it("getQuote returns a positive amount both directions with liquidity", async function () {
      const { amm } = await withLiquidity();
      expect(await amm.getQuote(1, ethers.parseEther("1"), true)).to.be.gt(0);
      expect(await amm.getQuote(1, 1000n, false)).to.be.gt(0);
    });

    it("getSpotPrice returns 0 for an empty pool and positive with liquidity", async function () {
      const empty = await withPool();
      expect(await empty.amm.getSpotPrice(1)).to.equal(0);
      const funded = await withLiquidity();
      expect(await funded.amm.getSpotPrice(1)).to.be.gt(0);
    });
  });

  describe("admin role guards", function () {
    it("withdrawProtocolFees reverts for a non-treasury caller", async function () {
      const { amm, stranger } = await withLiquidity();
      await expect(
        amm.connect(stranger).withdrawProtocolFees(),
      ).to.be.revertedWithCustomError(amm, "Unauthorized");
    });

    it("treasury can withdraw accumulated protocol fees", async function () {
      const { amm, bob, treasury } = await withLiquidity();
      // Generate protocol fees via a swap
      await amm.connect(bob).swapAethForCredits(1, 0, { value: ethers.parseEther("5") });
      await expect(amm.connect(treasury).withdrawProtocolFees()).to.not.be.reverted;
    });

    it("pause reverts for a non-pauser", async function () {
      const { amm, stranger } = await loadFixture(deployFixture);
      await expect(amm.connect(stranger).pause()).to.be.revertedWithCustomError(
        amm,
        "Unauthorized",
      );
    });

    it("unpause reverts for a non-admin", async function () {
      const { amm, owner, stranger } = await loadFixture(deployFixture);
      await amm.connect(owner).pause();
      await expect(amm.connect(stranger).unpause()).to.be.revertedWithCustomError(
        amm,
        "Unauthorized",
      );
    });

    it("owner (pauser+admin) can pause and unpause", async function () {
      const { amm, owner } = await loadFixture(deployFixture);
      await amm.connect(owner).pause();
      await amm.connect(owner).unpause();
      // A pool op works again after unpause
      await expect(amm.connect(owner).createPool(42)).to.emit(amm, "PoolCreated");
    });

    it("blocks liquidity operations while paused", async function () {
      const { amm, owner, alice } = await withPool();
      await amm.connect(owner).pause();
      // Pausable revert reason is OZ-version-dependent (custom EnforcedPause
      // vs "Pausable: paused"); assert it reverts, not the exact reason.
      await expect(
        amm.connect(alice).addLiquidity(1, 1000n, 0, { value: ethers.parseEther("1") }),
      ).to.be.reverted;
    });
  });
});
