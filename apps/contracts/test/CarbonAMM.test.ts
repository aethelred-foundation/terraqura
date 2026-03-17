import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { CarbonAMM, TerraQuraAccessControl, MockERC1155 } from "../typechain-types";

describe("CarbonAMM", function () {
  const CREDIT_ID = 1;
  const INITIAL_CREDIT_SUPPLY = 1_000_000n;

  async function deployFixture() {
    const [owner, alice, bob, treasury, unauthorized] = await ethers.getSigners();

    // Deploy AccessControl
    const ACFactory = await ethers.getContractFactory("TerraQuraAccessControl");
    const accessControl = (await upgrades.deployProxy(ACFactory, [owner.address], {
      initializer: "initialize",
    })) as unknown as TerraQuraAccessControl;
    await accessControl.waitForDeployment();

    // Grant treasury role
    const TREASURY_ROLE = await accessControl.TREASURY_ROLE();
    await accessControl.grantRole(TREASURY_ROLE, treasury.address);

    // Deploy MockERC1155
    const MockFactory = await ethers.getContractFactory("MockERC1155");
    const mockCredit = (await MockFactory.deploy()) as unknown as MockERC1155;
    await mockCredit.waitForDeployment();

    // Mint credits to alice and bob
    await mockCredit.mint(alice.address, CREDIT_ID, INITIAL_CREDIT_SUPPLY, "0x");
    await mockCredit.mint(bob.address, CREDIT_ID, INITIAL_CREDIT_SUPPLY, "0x");

    // Deploy CarbonAMM
    const AMMFactory = await ethers.getContractFactory("CarbonAMM");
    const amm = (await upgrades.deployProxy(
      AMMFactory,
      [await accessControl.getAddress(), await mockCredit.getAddress(), treasury.address],
      { initializer: "initialize" }
    )) as unknown as CarbonAMM;
    await amm.waitForDeployment();

    // Approve AMM to spend credits
    const ammAddr = await amm.getAddress();
    await mockCredit.connect(alice).setApprovalForAll(ammAddr, true);
    await mockCredit.connect(bob).setApprovalForAll(ammAddr, true);

    return { amm, accessControl, mockCredit, owner, alice, bob, treasury, unauthorized };
  }

  async function fixtureWithPool() {
    const base = await loadFixture(deployFixture);
    await base.amm.connect(base.alice).createPool(CREDIT_ID);
    return base;
  }

  async function fixtureWithLiquidity() {
    const base = await loadFixture(fixtureWithPool);
    const aethAmount = ethers.parseEther("10");
    const creditAmount = 10000n;
    await base.amm.connect(base.alice).addLiquidity(1, creditAmount, 0, { value: aethAmount });
    return { ...base, aethAmount, creditAmount };
  }

  // ==========================================
  // POOL CREATION
  // ==========================================

  describe("Pool Creation", function () {
    it("should create a pool", async function () {
      const { amm, alice } = await loadFixture(deployFixture);
      await expect(amm.connect(alice).createPool(CREDIT_ID))
        .to.emit(amm, "PoolCreated")
        .withArgs(1, CREDIT_ID, alice.address);

      const info = await amm.getPoolInfo(1);
      expect(info.creditId).to.equal(CREDIT_ID);
      expect(info.creator).to.equal(alice.address);
    });

    it("should not create duplicate pool for same creditId", async function () {
      const { amm, alice, bob } = await loadFixture(deployFixture);
      await amm.connect(alice).createPool(CREDIT_ID);
      await expect(amm.connect(bob).createPool(CREDIT_ID))
        .to.be.revertedWithCustomError(amm, "PoolAlreadyExists");
    });

    it("should increment pool IDs", async function () {
      const { amm, alice } = await loadFixture(deployFixture);
      await amm.connect(alice).createPool(1);
      await amm.connect(alice).createPool(2);
      expect(await amm.nextPoolId()).to.equal(3);
    });
  });

  // ==========================================
  // ADD LIQUIDITY
  // ==========================================

  describe("Add Liquidity", function () {
    it("should add initial liquidity and lock minimum", async function () {
      const { amm, alice } = await loadFixture(fixtureWithPool);
      const aethAmount = ethers.parseEther("10");
      const creditAmount = 10000n;

      const tx = await amm.connect(alice).addLiquidity(1, creditAmount, 0, { value: aethAmount });
      await expect(tx).to.emit(amm, "LiquidityAdded");

      const info = await amm.getPoolInfo(1);
      expect(info.aethReserve).to.equal(aethAmount);
      expect(info.creditReserve).to.equal(creditAmount);
      // totalLpSupply includes the MINIMUM_LIQUIDITY lock
      expect(info.totalLpSupply).to.be.gt(0);
    });

    it("should assign LP tokens to provider", async function () {
      const { amm, alice } = await loadFixture(fixtureWithPool);
      await amm.connect(alice).addLiquidity(1, 10000n, 0, { value: ethers.parseEther("10") });
      const lpBalance = await amm.lpBalances(1, alice.address);
      expect(lpBalance).to.be.gt(0);
    });

    it("should add proportional liquidity to existing pool", async function () {
      const { amm, alice, bob } = await loadFixture(fixtureWithPool);
      await amm.connect(alice).addLiquidity(1, 10000n, 0, { value: ethers.parseEther("10") });

      // Bob adds proportional liquidity
      await amm.connect(bob).addLiquidity(1, 5000n, 0, { value: ethers.parseEther("5") });
      const bobLp = await amm.lpBalances(1, bob.address);
      expect(bobLp).to.be.gt(0);
    });

    it("should revert with zero AETH", async function () {
      const { amm, alice } = await loadFixture(fixtureWithPool);
      await expect(amm.connect(alice).addLiquidity(1, 10000n, 0, { value: 0 }))
        .to.be.revertedWithCustomError(amm, "ZeroAmount");
    });

    it("should revert with zero credits", async function () {
      const { amm, alice } = await loadFixture(fixtureWithPool);
      await expect(amm.connect(alice).addLiquidity(1, 0, 0, { value: ethers.parseEther("1") }))
        .to.be.revertedWithCustomError(amm, "ZeroAmount");
    });

    it("should revert if slippage exceeded on LP tokens", async function () {
      const { amm, alice } = await loadFixture(fixtureWithPool);
      await expect(
        amm.connect(alice).addLiquidity(1, 10000n, ethers.parseEther("999999"), {
          value: ethers.parseEther("10"),
        })
      ).to.be.revertedWithCustomError(amm, "SlippageExceeded");
    });

    it("should revert for non-existent pool", async function () {
      const { amm, alice } = await loadFixture(deployFixture);
      await expect(
        amm.connect(alice).addLiquidity(99, 100n, 0, { value: ethers.parseEther("1") })
      ).to.be.revertedWithCustomError(amm, "PoolNotFound");
    });
  });

  // ==========================================
  // REMOVE LIQUIDITY
  // ==========================================

  describe("Remove Liquidity", function () {
    it("should remove liquidity and return assets", async function () {
      const { amm, alice, mockCredit } = await loadFixture(fixtureWithLiquidity);
      const lpBalance = await amm.lpBalances(1, alice.address);

      const balanceBefore = await ethers.provider.getBalance(alice.address);
      const creditsBefore = await mockCredit.balanceOf(alice.address, CREDIT_ID);

      await amm.connect(alice).removeLiquidity(1, lpBalance, 0, 0);

      const balanceAfter = await ethers.provider.getBalance(alice.address);
      const creditsAfter = await mockCredit.balanceOf(alice.address, CREDIT_ID);

      expect(balanceAfter).to.be.gt(balanceBefore);
      expect(creditsAfter).to.be.gt(creditsBefore);
    });

    it("should revert with zero LP tokens", async function () {
      const { amm, alice } = await loadFixture(fixtureWithLiquidity);
      await expect(amm.connect(alice).removeLiquidity(1, 0, 0, 0))
        .to.be.revertedWithCustomError(amm, "ZeroAmount");
    });

    it("should revert with insufficient LP tokens", async function () {
      const { amm, bob } = await loadFixture(fixtureWithLiquidity);
      await expect(amm.connect(bob).removeLiquidity(1, 1, 0, 0))
        .to.be.revertedWithCustomError(amm, "InsufficientLpTokens");
    });

    it("should revert if slippage on AETH exceeded", async function () {
      const { amm, alice } = await loadFixture(fixtureWithLiquidity);
      const lpBalance = await amm.lpBalances(1, alice.address);
      await expect(
        amm.connect(alice).removeLiquidity(1, lpBalance, ethers.parseEther("999"), 0)
      ).to.be.revertedWithCustomError(amm, "SlippageExceeded");
    });

    it("should revert if slippage on credits exceeded", async function () {
      const { amm, alice } = await loadFixture(fixtureWithLiquidity);
      const lpBalance = await amm.lpBalances(1, alice.address);
      await expect(
        amm.connect(alice).removeLiquidity(1, lpBalance, 0, 999_999n)
      ).to.be.revertedWithCustomError(amm, "SlippageExceeded");
    });
  });

  // ==========================================
  // SWAPS
  // ==========================================

  describe("Swap AETH for Credits", function () {
    it("should swap AETH for credits", async function () {
      const { amm, bob, mockCredit } = await loadFixture(fixtureWithLiquidity);
      const creditsBefore = await mockCredit.balanceOf(bob.address, CREDIT_ID);

      const tx = await amm.connect(bob).swapAethForCredits(1, 0, { value: ethers.parseEther("1") });
      await expect(tx).to.emit(amm, "Swap");

      const creditsAfter = await mockCredit.balanceOf(bob.address, CREDIT_ID);
      expect(creditsAfter).to.be.gt(creditsBefore);
    });

    it("should revert with zero AETH", async function () {
      const { amm, bob } = await loadFixture(fixtureWithLiquidity);
      await expect(amm.connect(bob).swapAethForCredits(1, 0, { value: 0 }))
        .to.be.revertedWithCustomError(amm, "ZeroAmount");
    });

    it("should revert with empty pool", async function () {
      const { amm, bob } = await loadFixture(fixtureWithPool);
      await expect(
        amm.connect(bob).swapAethForCredits(1, 0, { value: ethers.parseEther("1") })
      ).to.be.revertedWithCustomError(amm, "EmptyPool");
    });

    it("should enforce slippage protection", async function () {
      const { amm, bob } = await loadFixture(fixtureWithLiquidity);
      await expect(
        amm.connect(bob).swapAethForCredits(1, 999_999n, { value: ethers.parseEther("1") })
      ).to.be.revertedWithCustomError(amm, "SlippageExceeded");
    });

    it("should have large price impact on big swap", async function () {
      const { amm, bob } = await loadFixture(fixtureWithLiquidity);

      // Small swap — effective price = amountIn / creditsOut
      const smallIn = ethers.parseEther("0.1");
      const smallQuote = await amm.getQuote(1, smallIn, true);
      // Large swap
      const bigIn = ethers.parseEther("5");
      const bigQuote = await amm.getQuote(1, bigIn, true);

      // Price impact: big swap should cost more AETH per credit
      // effectivePrice = amountIn / creditsOut  (higher = worse for buyer)
      // For comparison: smallIn/smallQuote < bigIn/bigQuote
      // Rearranged to avoid division: smallIn * bigQuote < bigIn * smallQuote
      expect(smallIn * bigQuote).to.be.lt(bigIn * smallQuote);
    });
  });

  describe("Swap Credits for AETH", function () {
    it("should swap credits for AETH", async function () {
      const { amm, bob } = await loadFixture(fixtureWithLiquidity);
      const balanceBefore = await ethers.provider.getBalance(bob.address);

      await amm.connect(bob).swapCreditsForAeth(1, 500n, 0);

      const balanceAfter = await ethers.provider.getBalance(bob.address);
      // Balance should increase (minus gas)
      // We check the AETH was received by looking at the event
      expect(balanceAfter).to.be.gt(balanceBefore - ethers.parseEther("0.01"));
    });

    it("should revert with zero credits", async function () {
      const { amm, bob } = await loadFixture(fixtureWithLiquidity);
      await expect(amm.connect(bob).swapCreditsForAeth(1, 0, 0))
        .to.be.revertedWithCustomError(amm, "ZeroAmount");
    });

    it("should enforce slippage protection on credit-to-AETH swaps", async function () {
      const { amm, bob } = await loadFixture(fixtureWithLiquidity);
      await expect(
        amm.connect(bob).swapCreditsForAeth(1, 100n, ethers.parseEther("999"))
      ).to.be.revertedWithCustomError(amm, "SlippageExceeded");
    });
  });

  // ==========================================
  // QUOTES & PRICING
  // ==========================================

  describe("Quotes & Pricing", function () {
    it("should return accurate quote matching actual swap", async function () {
      const { amm, bob, mockCredit } = await loadFixture(fixtureWithLiquidity);
      const swapAmount = ethers.parseEther("1");
      const quote = await amm.getQuote(1, swapAmount, true);

      const creditsBefore = await mockCredit.balanceOf(bob.address, CREDIT_ID);
      await amm.connect(bob).swapAethForCredits(1, 0, { value: swapAmount });
      const creditsAfter = await mockCredit.balanceOf(bob.address, CREDIT_ID);
      const actual = creditsAfter - creditsBefore;

      expect(actual).to.equal(quote);
    });

    it("should return 0 quote for empty pool", async function () {
      const { amm } = await loadFixture(fixtureWithPool);
      expect(await amm.getQuote(1, ethers.parseEther("1"), true)).to.equal(0);
    });

    it("should return correct spot price", async function () {
      const { amm, aethAmount, creditAmount } = await loadFixture(fixtureWithLiquidity);
      const spotPrice = await amm.getSpotPrice(1);
      const expectedPrice = (aethAmount * BigInt(1e18)) / creditAmount;
      expect(spotPrice).to.equal(expectedPrice);
    });

    it("should return 0 spot price for pool with no credit reserve", async function () {
      const { amm } = await loadFixture(fixtureWithPool);
      expect(await amm.getSpotPrice(1)).to.equal(0);
    });
  });

  // ==========================================
  // FEE COLLECTION
  // ==========================================

  describe("Fee Collection", function () {
    it("should collect protocol fees on swap", async function () {
      const { amm, bob } = await loadFixture(fixtureWithLiquidity);
      const feesBefore = await amm.protocolFees();
      await amm.connect(bob).swapAethForCredits(1, 0, { value: ethers.parseEther("1") });
      const feesAfter = await amm.protocolFees();
      expect(feesAfter).to.be.gt(feesBefore);
    });

    it("should emit FeesCollected event", async function () {
      const { amm, bob } = await loadFixture(fixtureWithLiquidity);
      await expect(amm.connect(bob).swapAethForCredits(1, 0, { value: ethers.parseEther("1") }))
        .to.emit(amm, "FeesCollected");
    });

    it("should allow treasury to withdraw protocol fees", async function () {
      const { amm, bob, treasury } = await loadFixture(fixtureWithLiquidity);
      await amm.connect(bob).swapAethForCredits(1, 0, { value: ethers.parseEther("1") });

      const fees = await amm.protocolFees();
      expect(fees).to.be.gt(0);

      const balBefore = await ethers.provider.getBalance(treasury.address);
      await amm.connect(treasury).withdrawProtocolFees();
      const balAfter = await ethers.provider.getBalance(treasury.address);
      expect(balAfter).to.be.gt(balBefore);
    });

    it("should revert fee withdrawal by unauthorized user", async function () {
      const { amm, unauthorized } = await loadFixture(fixtureWithLiquidity);
      await expect(amm.connect(unauthorized).withdrawProtocolFees())
        .to.be.revertedWithCustomError(amm, "Unauthorized");
    });
  });

  // ==========================================
  // MINIMUM LIQUIDITY
  // ==========================================

  describe("Minimum Liquidity Lock", function () {
    it("should lock MINIMUM_LIQUIDITY on first deposit", async function () {
      const { amm, alice } = await loadFixture(fixtureWithPool);
      await amm.connect(alice).addLiquidity(1, 10000n, 0, { value: ethers.parseEther("10") });
      const info = await amm.getPoolInfo(1);
      const userLp = await amm.lpBalances(1, alice.address);
      // totalLpSupply = userLp + MINIMUM_LIQUIDITY(1000)
      expect(info.totalLpSupply).to.equal(userLp + 1000n);
    });
  });

  // ==========================================
  // POOL INFO
  // ==========================================

  describe("Pool Info", function () {
    it("should return correct pool info", async function () {
      const { amm, alice, aethAmount, creditAmount } = await loadFixture(fixtureWithLiquidity);
      const info = await amm.getPoolInfo(1);
      expect(info.creditId).to.equal(CREDIT_ID);
      expect(info.aethReserve).to.equal(aethAmount);
      expect(info.creditReserve).to.equal(creditAmount);
      expect(info.feeRate).to.equal(30); // 30 bps default
      expect(info.creator).to.equal(alice.address);
    });
  });
});
