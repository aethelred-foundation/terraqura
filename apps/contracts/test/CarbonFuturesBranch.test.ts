import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { CarbonFutures, TerraQuraAccessControl, MockERC1155 } from "../typechain-types";

/**
 * CarbonFutures — branch-coverage suite (pre-testnet hardening).
 *
 * Drives the full lifecycle (buy → settle / default / cancel) and every
 * status/timing guard and admin-role check the happy-path suite leaves
 * uncovered.
 */
describe("CarbonFutures — branch coverage", function () {
  const CREDIT_ID = 1;
  const AMOUNT = 100n;
  const PRICE = ethers.parseEther("0.1");
  const COLLATERAL_BPS = 2000n;
  const GRACE = 7 * 24 * 3600; // matches GRACE_PERIOD assumption in tests

  const notional = () => AMOUNT * PRICE;
  const collateral = () => (notional() * COLLATERAL_BPS) / 10000n;

  async function deployFixture() {
    const [owner, seller, buyer, keeper, stranger] = await ethers.getSigners();

    const ACFactory = await ethers.getContractFactory("TerraQuraAccessControl");
    const accessControl = (await upgrades.deployProxy(ACFactory, [owner.address], {
      initializer: "initialize",
    })) as unknown as TerraQuraAccessControl;
    await accessControl.waitForDeployment();

    const MockFactory = await ethers.getContractFactory("MockERC1155");
    const credit = (await MockFactory.deploy()) as unknown as MockERC1155;
    await credit.waitForDeployment();
    await credit.mint(seller.address, CREDIT_ID, 100_000n, "0x");

    const Factory = await ethers.getContractFactory("CarbonFutures");
    const futures = (await upgrades.deployProxy(
      Factory,
      [await accessControl.getAddress(), await credit.getAddress()],
      { initializer: "initialize" },
    )) as unknown as CarbonFutures;
    await futures.waitForDeployment();
    await credit.connect(seller).setApprovalForAll(await futures.getAddress(), true);

    return { futures, accessControl, credit, owner, seller, buyer, keeper, stranger };
  }

  async function withFuture() {
    const base = await deployFixture();
    const maturity = (await time.latest()) + 30 * 24 * 3600;
    await base.futures
      .connect(base.seller)
      .createFuture(CREDIT_ID, AMOUNT, PRICE, maturity, COLLATERAL_BPS, {
        value: collateral(),
      });
    return { ...base, maturity }; // futureId 1
  }

  async function withFilledFuture() {
    const base = await withFuture();
    await base.futures.connect(base.buyer).buyFuture(1, { value: notional() });
    return base;
  }

  describe("buyFuture", function () {
    it("reverts for a non-existent future", async function () {
      const { futures, buyer } = await loadFixture(deployFixture);
      await expect(
        futures.connect(buyer).buyFuture(999, { value: notional() }),
      ).to.be.revertedWithCustomError(futures, "FutureNotFound");
    });

    it("reverts when the seller tries to buy their own future", async function () {
      const { futures, seller } = await loadFixture(withFuture);
      await expect(
        futures.connect(seller).buyFuture(1, { value: notional() }),
      ).to.be.revertedWithCustomError(futures, "CannotBuyOwnFuture");
    });

    it("reverts on insufficient payment", async function () {
      const { futures, buyer } = await loadFixture(withFuture);
      await expect(
        futures.connect(buyer).buyFuture(1, { value: notional() - 1n }),
      ).to.be.revertedWithCustomError(futures, "InsufficientPayment");
    });

    it("reverts buying an already-filled future", async function () {
      const { futures, keeper } = await loadFixture(withFilledFuture);
      await expect(
        futures.connect(keeper).buyFuture(1, { value: notional() }),
      ).to.be.revertedWithCustomError(futures, "InvalidStatus");
    });

    it("fills an open future", async function () {
      const { futures, buyer } = await loadFixture(withFuture);
      await expect(futures.connect(buyer).buyFuture(1, { value: notional() })).to.emit(
        futures,
        "FutureFilled",
      );
    });
  });

  describe("settleFuture", function () {
    it("reverts for a non-existent future", async function () {
      const { futures, seller } = await loadFixture(deployFixture);
      await expect(futures.connect(seller).settleFuture(999)).to.be.revertedWithCustomError(
        futures,
        "FutureNotFound",
      );
    });

    it("reverts settling an unfilled (open) future", async function () {
      const { futures, seller } = await loadFixture(withFuture);
      await expect(futures.connect(seller).settleFuture(1)).to.be.revertedWithCustomError(
        futures,
        "InvalidStatus",
      );
    });

    it("reverts before maturity", async function () {
      const { futures, seller } = await loadFixture(withFilledFuture);
      await expect(futures.connect(seller).settleFuture(1)).to.be.revertedWithCustomError(
        futures,
        "NotYetMature",
      );
    });

    it("reverts when a non-seller tries to settle", async function () {
      const { futures, buyer, maturity } = await loadFixture(withFilledFuture);
      await time.increaseTo(maturity + 1);
      await expect(futures.connect(buyer).settleFuture(1)).to.be.revertedWithCustomError(
        futures,
        "NotSeller",
      );
    });

    it("settles successfully within the grace window", async function () {
      const { futures, seller, maturity } = await loadFixture(withFilledFuture);
      await time.increaseTo(maturity + 1);
      await expect(futures.connect(seller).settleFuture(1)).to.emit(futures, "FutureSettled");
    });
  });

  describe("defaultFuture", function () {
    it("reverts before the grace period expires", async function () {
      const { futures, keeper, maturity } = await loadFixture(withFilledFuture);
      await time.increaseTo(maturity + 1);
      await expect(futures.connect(keeper).defaultFuture(1)).to.be.revertedWithCustomError(
        futures,
        "GracePeriodNotExpired",
      );
    });

    it("reverts defaulting an unfilled future", async function () {
      const { futures, keeper } = await loadFixture(withFuture);
      await expect(futures.connect(keeper).defaultFuture(1)).to.be.revertedWithCustomError(
        futures,
        "InvalidStatus",
      );
    });

    it("lets anyone trigger default after grace, paying the buyer", async function () {
      const { futures, keeper, buyer, maturity } = await loadFixture(withFilledFuture);
      await time.increaseTo(maturity + GRACE + 2);
      await expect(futures.connect(keeper).defaultFuture(1)).to.emit(futures, "FutureDefaulted");
    });
  });

  describe("cancelFuture", function () {
    it("reverts for a non-seller", async function () {
      const { futures, buyer } = await loadFixture(withFuture);
      await expect(futures.connect(buyer).cancelFuture(1)).to.be.revertedWithCustomError(
        futures,
        "NotSeller",
      );
    });

    it("reverts cancelling a filled future", async function () {
      const { futures, seller } = await loadFixture(withFilledFuture);
      await expect(futures.connect(seller).cancelFuture(1)).to.be.revertedWithCustomError(
        futures,
        "InvalidStatus",
      );
    });

    it("returns collateral to the seller on cancel", async function () {
      const { futures, seller } = await loadFixture(withFuture);
      await expect(futures.connect(seller).cancelFuture(1)).to.emit(futures, "FutureCancelled");
    });
  });

  describe("admin role guards", function () {
    it("pause reverts for a non-pauser", async function () {
      const { futures, stranger } = await loadFixture(deployFixture);
      await expect(futures.connect(stranger).pause()).to.be.revertedWithCustomError(
        futures,
        "Unauthorized",
      );
    });

    it("unpause reverts for a non-admin", async function () {
      const { futures, owner, stranger } = await loadFixture(deployFixture);
      await futures.connect(owner).pause();
      await expect(futures.connect(stranger).unpause()).to.be.revertedWithCustomError(
        futures,
        "Unauthorized",
      );
    });

    it("owner can pause and unpause", async function () {
      const { futures, owner } = await loadFixture(deployFixture);
      await futures.connect(owner).pause();
      await futures.connect(owner).unpause();
    });
  });
});
