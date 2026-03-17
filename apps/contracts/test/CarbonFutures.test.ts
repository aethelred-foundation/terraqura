import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { CarbonFutures, TerraQuraAccessControl, MockERC1155 } from "../typechain-types";

describe("CarbonFutures", function () {
  const CREDIT_ID = 1;
  const AMOUNT = 100n;
  const PRICE_PER_UNIT = ethers.parseEther("0.1"); // 0.1 AETH per credit
  const COLLATERAL_BPS = 2000n; // 20%
  const SEVEN_DAYS = 7 * 24 * 3600;

  function notionalValue() {
    return AMOUNT * PRICE_PER_UNIT;
  }

  function requiredCollateral() {
    return (notionalValue() * COLLATERAL_BPS) / 10000n;
  }

  async function deployFixture() {
    const [owner, seller, buyer, third, unauthorized] = await ethers.getSigners();

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

    // Mint credits to seller
    await mockCredit.mint(seller.address, CREDIT_ID, 100_000n, "0x");

    // Deploy CarbonFutures
    const FuturesFactory = await ethers.getContractFactory("CarbonFutures");
    const futures = (await upgrades.deployProxy(
      FuturesFactory,
      [await accessControl.getAddress(), await mockCredit.getAddress()],
      { initializer: "initialize" }
    )) as unknown as CarbonFutures;
    await futures.waitForDeployment();

    // Approve futures contract
    const futuresAddr = await futures.getAddress();
    await mockCredit.connect(seller).setApprovalForAll(futuresAddr, true);

    return { futures, accessControl, mockCredit, owner, seller, buyer, third, unauthorized };
  }

  async function fixtureWithFuture() {
    const base = await loadFixture(deployFixture);
    const maturity = (await time.latest()) + 30 * 24 * 3600; // 30 days
    await base.futures.connect(base.seller).createFuture(
      CREDIT_ID, AMOUNT, PRICE_PER_UNIT, maturity, COLLATERAL_BPS,
      { value: requiredCollateral() }
    );
    return { ...base, maturity };
  }

  async function fixtureWithFilledFuture() {
    const base = await loadFixture(fixtureWithFuture);
    await base.futures.connect(base.buyer).buyFuture(1, { value: notionalValue() });
    return base;
  }

  // ==========================================
  // FUTURE CREATION
  // ==========================================

  describe("Create Future", function () {
    it("should create a future with collateral", async function () {
      const { futures, seller } = await loadFixture(deployFixture);
      const maturity = (await time.latest()) + 30 * 24 * 3600;

      await expect(
        futures.connect(seller).createFuture(
          CREDIT_ID, AMOUNT, PRICE_PER_UNIT, maturity, COLLATERAL_BPS,
          { value: requiredCollateral() }
        )
      ).to.emit(futures, "FutureCreated")
        .withArgs(1, CREDIT_ID, seller.address, AMOUNT, PRICE_PER_UNIT, maturity);
    });

    it("should use default collateral when bps is 0", async function () {
      const { futures, seller } = await loadFixture(deployFixture);
      const maturity = (await time.latest()) + 30 * 24 * 3600;
      // Default is 20% = same as COLLATERAL_BPS
      await futures.connect(seller).createFuture(
        CREDIT_ID, AMOUNT, PRICE_PER_UNIT, maturity, 0,
        { value: requiredCollateral() }
      );

      const [, , , , , , , collateral] = await futures.getFuture(1);
      expect(collateral).to.equal(requiredCollateral());
    });

    it("should revert with zero amount", async function () {
      const { futures, seller } = await loadFixture(deployFixture);
      const maturity = (await time.latest()) + 30 * 24 * 3600;
      await expect(
        futures.connect(seller).createFuture(CREDIT_ID, 0, PRICE_PER_UNIT, maturity, COLLATERAL_BPS, { value: requiredCollateral() })
      ).to.be.revertedWithCustomError(futures, "ZeroAmount");
    });

    it("should revert with zero price", async function () {
      const { futures, seller } = await loadFixture(deployFixture);
      const maturity = (await time.latest()) + 30 * 24 * 3600;
      await expect(
        futures.connect(seller).createFuture(CREDIT_ID, AMOUNT, 0, maturity, COLLATERAL_BPS, { value: requiredCollateral() })
      ).to.be.revertedWithCustomError(futures, "ZeroAmount");
    });

    it("should revert with maturity in the past", async function () {
      const { futures, seller } = await loadFixture(deployFixture);
      const pastTime = (await time.latest()) - 100;
      await expect(
        futures.connect(seller).createFuture(CREDIT_ID, AMOUNT, PRICE_PER_UNIT, pastTime, COLLATERAL_BPS, { value: requiredCollateral() })
      ).to.be.revertedWithCustomError(futures, "MaturityInPast");
    });

    it("should revert with insufficient collateral", async function () {
      const { futures, seller } = await loadFixture(deployFixture);
      const maturity = (await time.latest()) + 30 * 24 * 3600;
      await expect(
        futures.connect(seller).createFuture(CREDIT_ID, AMOUNT, PRICE_PER_UNIT, maturity, COLLATERAL_BPS, { value: 1n })
      ).to.be.revertedWithCustomError(futures, "InsufficientCollateral");
    });

    it("should revert with collateral bps below minimum", async function () {
      const { futures, seller } = await loadFixture(deployFixture);
      const maturity = (await time.latest()) + 30 * 24 * 3600;
      await expect(
        futures.connect(seller).createFuture(CREDIT_ID, AMOUNT, PRICE_PER_UNIT, maturity, 100, { value: requiredCollateral() })
      ).to.be.revertedWithCustomError(futures, "InvalidCollateralBps");
    });

    it("should increment future IDs", async function () {
      const { futures, seller } = await loadFixture(deployFixture);
      const maturity = (await time.latest()) + 30 * 24 * 3600;
      await futures.connect(seller).createFuture(CREDIT_ID, AMOUNT, PRICE_PER_UNIT, maturity, COLLATERAL_BPS, { value: requiredCollateral() });
      await futures.connect(seller).createFuture(CREDIT_ID, AMOUNT, PRICE_PER_UNIT, maturity, COLLATERAL_BPS, { value: requiredCollateral() });
      expect(await futures.nextFutureId()).to.equal(3);
    });
  });

  // ==========================================
  // BUY FUTURE
  // ==========================================

  describe("Buy Future", function () {
    it("should buy a future", async function () {
      const { futures, buyer } = await loadFixture(fixtureWithFuture);
      await expect(futures.connect(buyer).buyFuture(1, { value: notionalValue() }))
        .to.emit(futures, "FutureFilled")
        .withArgs(1, buyer.address);
    });

    it("should not buy own future", async function () {
      const { futures, seller } = await loadFixture(fixtureWithFuture);
      await expect(futures.connect(seller).buyFuture(1, { value: notionalValue() }))
        .to.be.revertedWithCustomError(futures, "CannotBuyOwnFuture");
    });

    it("should not buy with insufficient payment", async function () {
      const { futures, buyer } = await loadFixture(fixtureWithFuture);
      await expect(futures.connect(buyer).buyFuture(1, { value: 1n }))
        .to.be.revertedWithCustomError(futures, "InsufficientPayment");
    });

    it("should not buy already filled future", async function () {
      const { futures, buyer, third } = await loadFixture(fixtureWithFilledFuture);
      await expect(futures.connect(third).buyFuture(1, { value: notionalValue() }))
        .to.be.revertedWithCustomError(futures, "InvalidStatus");
    });

    it("should not buy non-existent future", async function () {
      const { futures, buyer } = await loadFixture(deployFixture);
      await expect(futures.connect(buyer).buyFuture(99, { value: notionalValue() }))
        .to.be.revertedWithCustomError(futures, "FutureNotFound");
    });
  });

  // ==========================================
  // SETTLE FUTURE
  // ==========================================

  describe("Settle Future", function () {
    it("should settle at maturity", async function () {
      const { futures, seller, buyer, mockCredit, maturity } = await loadFixture(fixtureWithFilledFuture);

      await time.increaseTo(maturity);

      const sellerBalBefore = await ethers.provider.getBalance(seller.address);
      const buyerCreditsBefore = await mockCredit.balanceOf(buyer.address, CREDIT_ID);

      await expect(futures.connect(seller).settleFuture(1))
        .to.emit(futures, "FutureSettled");

      const buyerCreditsAfter = await mockCredit.balanceOf(buyer.address, CREDIT_ID);
      expect(buyerCreditsAfter - buyerCreditsBefore).to.equal(AMOUNT);

      const sellerBalAfter = await ethers.provider.getBalance(seller.address);
      // Seller should receive payment + collateral (minus gas)
      expect(sellerBalAfter).to.be.gt(sellerBalBefore);
    });

    it("should not settle before maturity", async function () {
      const { futures, seller } = await loadFixture(fixtureWithFilledFuture);
      await expect(futures.connect(seller).settleFuture(1))
        .to.be.revertedWithCustomError(futures, "NotYetMature");
    });

    it("should not settle after grace period", async function () {
      const { futures, seller, maturity } = await loadFixture(fixtureWithFilledFuture);
      await time.increaseTo(maturity + SEVEN_DAYS + 1);
      await expect(futures.connect(seller).settleFuture(1))
        .to.be.revertedWithCustomError(futures, "GracePeriodExpired");
    });

    it("should only allow seller to settle", async function () {
      const { futures, buyer, maturity } = await loadFixture(fixtureWithFilledFuture);
      await time.increaseTo(maturity);
      await expect(futures.connect(buyer).settleFuture(1))
        .to.be.revertedWithCustomError(futures, "NotSeller");
    });

    it("should not settle unfilled future", async function () {
      const { futures, seller, maturity } = await loadFixture(fixtureWithFuture);
      await time.increaseTo(maturity);
      await expect(futures.connect(seller).settleFuture(1))
        .to.be.revertedWithCustomError(futures, "InvalidStatus");
    });
  });

  // ==========================================
  // DEFAULT FUTURE
  // ==========================================

  describe("Default Future", function () {
    it("should default after grace period and slash collateral", async function () {
      const { futures, buyer, maturity } = await loadFixture(fixtureWithFilledFuture);

      await time.increaseTo(maturity + SEVEN_DAYS + 1);

      const buyerBalBefore = await ethers.provider.getBalance(buyer.address);

      await expect(futures.connect(buyer).defaultFuture(1))
        .to.emit(futures, "FutureDefaulted");

      const buyerBalAfter = await ethers.provider.getBalance(buyer.address);
      // Buyer gets payment + collateral back
      expect(buyerBalAfter).to.be.gt(buyerBalBefore);
    });

    it("should not default before grace period expires", async function () {
      const { futures, buyer, maturity } = await loadFixture(fixtureWithFilledFuture);
      await time.increaseTo(maturity + SEVEN_DAYS - 10);
      await expect(futures.connect(buyer).defaultFuture(1))
        .to.be.revertedWithCustomError(futures, "GracePeriodNotExpired");
    });

    it("should not default unfilled future", async function () {
      const { futures, third, maturity } = await loadFixture(fixtureWithFuture);
      await time.increaseTo(maturity + SEVEN_DAYS + 1);
      await expect(futures.connect(third).defaultFuture(1))
        .to.be.revertedWithCustomError(futures, "InvalidStatus");
    });

    it("should allow third party to trigger default", async function () {
      const { futures, third, maturity } = await loadFixture(fixtureWithFilledFuture);
      await time.increaseTo(maturity + SEVEN_DAYS + 1);
      await expect(futures.connect(third).defaultFuture(1))
        .to.emit(futures, "FutureDefaulted");
    });
  });

  // ==========================================
  // CANCEL FUTURE
  // ==========================================

  describe("Cancel Future", function () {
    it("should cancel unfilled future and return collateral", async function () {
      const { futures, seller } = await loadFixture(fixtureWithFuture);

      const balBefore = await ethers.provider.getBalance(seller.address);

      await expect(futures.connect(seller).cancelFuture(1))
        .to.emit(futures, "FutureCancelled");

      const balAfter = await ethers.provider.getBalance(seller.address);
      // Should get collateral back (minus gas)
      expect(balAfter).to.be.gt(balBefore - ethers.parseEther("0.01"));
    });

    it("should not cancel filled future", async function () {
      const { futures, seller } = await loadFixture(fixtureWithFilledFuture);
      await expect(futures.connect(seller).cancelFuture(1))
        .to.be.revertedWithCustomError(futures, "InvalidStatus");
    });

    it("should only allow seller to cancel", async function () {
      const { futures, buyer } = await loadFixture(fixtureWithFuture);
      await expect(futures.connect(buyer).cancelFuture(1))
        .to.be.revertedWithCustomError(futures, "NotSeller");
    });

    it("should not cancel non-existent future", async function () {
      const { futures, seller } = await loadFixture(deployFixture);
      await expect(futures.connect(seller).cancelFuture(99))
        .to.be.revertedWithCustomError(futures, "FutureNotFound");
    });
  });

  // ==========================================
  // VIEW FUNCTIONS
  // ==========================================

  describe("View Functions", function () {
    it("should return future info", async function () {
      const { futures, seller, maturity } = await loadFixture(fixtureWithFuture);
      const [id, creditId, amount, price, sellerAddr, buyerAddr, mat, collateral, status] =
        await futures.getFuture(1);

      expect(id).to.equal(1);
      expect(creditId).to.equal(CREDIT_ID);
      expect(amount).to.equal(AMOUNT);
      expect(price).to.equal(PRICE_PER_UNIT);
      expect(sellerAddr).to.equal(seller.address);
      expect(buyerAddr).to.equal(ethers.ZeroAddress);
      expect(mat).to.equal(maturity);
      expect(collateral).to.equal(requiredCollateral());
      expect(status).to.equal(0); // Open
    });
  });
});
