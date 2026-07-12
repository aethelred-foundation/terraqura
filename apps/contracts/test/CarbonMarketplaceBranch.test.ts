import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { CarbonMarketplace, MockERC1155 } from "../typechain-types";

/**
 * CarbonMarketplace — branch-coverage suite (pre-testnet hardening).
 *
 * Covers offer cancel/reject authorization paths, admin setters and their
 * guards, batch-view validation reverts, and active-offer/listing enumeration
 * left uncovered by the happy-path + P0 suites.
 */
describe("CarbonMarketplace — branch coverage", function () {
  const TOKEN = 1n;
  const FEE_BPS = 250;
  const PRICE = ethers.parseEther("0.001");

  async function deployFixture() {
    const [owner, seller, buyer, other, feeRecipient] = await ethers.getSigners();

    const MockFactory = await ethers.getContractFactory("MockERC1155");
    const credit = (await MockFactory.deploy()) as unknown as MockERC1155;
    await credit.waitForDeployment();
    await credit.mint(seller.address, TOKEN, 1000n, "0x");
    await credit.mint(other.address, TOKEN, 1000n, "0x");

    const Factory = await ethers.getContractFactory("CarbonMarketplace");
    const marketplace = (await upgrades.deployProxy(
      Factory,
      [await credit.getAddress(), feeRecipient.address, FEE_BPS, owner.address],
      { initializer: "initialize" },
    )) as unknown as CarbonMarketplace;
    await marketplace.waitForDeployment();

    for (const s of [seller, buyer, other]) {
      await marketplace.setKycStatus(s.address, true);
    }
    await credit.connect(seller).setApprovalForAll(await marketplace.getAddress(), true);
    await credit.connect(other).setApprovalForAll(await marketplace.getAddress(), true);

    return { marketplace, credit, owner, seller, buyer, other, feeRecipient };
  }

  async function withOffer() {
    const base = await deployFixture();
    // buyer places an offer on TOKEN
    await base.marketplace
      .connect(base.buyer)
      .createOffer(TOKEN, 10n, PRICE, 3600, { value: PRICE * 10n });
    return base; // offerId 1
  }

  describe("cancelOffer", function () {
    it("reverts for an unknown offer", async function () {
      const { marketplace, buyer } = await loadFixture(deployFixture);
      await expect(marketplace.connect(buyer).cancelOffer(999)).to.be.revertedWithCustomError(
        marketplace,
        "OfferNotFound",
      );
    });

    it("reverts when the caller is not the offer buyer", async function () {
      const { marketplace, seller } = await loadFixture(withOffer);
      await expect(marketplace.connect(seller).cancelOffer(1)).to.be.revertedWithCustomError(
        marketplace,
        "NotOfferBuyer",
      );
    });

    it("refunds and deactivates the offer for the buyer", async function () {
      const { marketplace, buyer } = await loadFixture(withOffer);
      await expect(marketplace.connect(buyer).cancelOffer(1)).to.emit(marketplace, "OfferCancelled");
      await expect(marketplace.connect(buyer).cancelOffer(1)).to.be.revertedWithCustomError(
        marketplace,
        "OfferNotActive",
      );
    });
  });

  describe("rejectOffer", function () {
    it("reverts for an unknown offer", async function () {
      const { marketplace, seller } = await loadFixture(deployFixture);
      await expect(marketplace.connect(seller).rejectOffer(999)).to.be.revertedWithCustomError(
        marketplace,
        "OfferNotFound",
      );
    });

    it("reverts when the caller can neither buy nor fulfill", async function () {
      const { marketplace, buyer } = await loadFixture(withOffer);
      // buyer has no TOKEN balance and isn't... actually buyer IS the offer buyer.
      // Use a KYC'd account with no balance and not the buyer:
      const [, , , , , , stranger] = await ethers.getSigners();
      await marketplace.setKycStatus(stranger.address, true);
      await expect(marketplace.connect(stranger).rejectOffer(1)).to.be.revertedWithCustomError(
        marketplace,
        "NotAuthorizedToReject",
      );
    });

    it("lets the offer buyer reject their own offer", async function () {
      const { marketplace, buyer } = await loadFixture(withOffer);
      await expect(marketplace.connect(buyer).rejectOffer(1)).to.emit(marketplace, "OfferRejected");
    });

    it("lets a token holder with enough balance reject the offer", async function () {
      const { marketplace, other } = await loadFixture(withOffer);
      // `other` holds 1000 TOKEN >= offer amount 10
      await expect(marketplace.connect(other).rejectOffer(1)).to.emit(marketplace, "OfferRejected");
    });
  });

  describe("acceptOffer guards", function () {
    it("reverts for an unknown offer", async function () {
      const { marketplace, seller } = await loadFixture(deployFixture);
      await expect(marketplace.connect(seller).acceptOffer(999)).to.be.revertedWithCustomError(
        marketplace,
        "OfferNotFound",
      );
    });

    it("reverts when the accepter is the offer buyer", async function () {
      const { marketplace, buyer } = await loadFixture(withOffer);
      await expect(marketplace.connect(buyer).acceptOffer(1)).to.be.revertedWithCustomError(
        marketplace,
        "CannotOfferOnOwnCredits",
      );
    });

    it("reverts when the accepter lacks sufficient credit balance", async function () {
      const { marketplace, credit, seller } = await loadFixture(withOffer);
      // Move seller's whole balance away so acceptance fails on balance
      await credit
        .connect(seller)
        .safeTransferFrom(seller.address, (await ethers.getSigners())[9].address, TOKEN, 1000n, "0x");
      await expect(marketplace.connect(seller).acceptOffer(1)).to.be.revertedWithCustomError(
        marketplace,
        "InsufficientBalance",
      );
    });
  });

  describe("admin setters", function () {
    it("setKycRegistry is owner-only and emits", async function () {
      const { marketplace, owner, other } = await loadFixture(deployFixture);
      await expect(marketplace.connect(other).setKycRegistry(other.address)).to.be.revertedWith(
        "Ownable: caller is not the owner",
      );
      await expect(marketplace.connect(owner).setKycRegistry(other.address)).to.emit(
        marketplace,
        "KycRegistryUpdated",
      );
    });

    it("setKycStatus is owner-only", async function () {
      const { marketplace, other } = await loadFixture(deployFixture);
      await expect(marketplace.connect(other).setKycStatus(other.address, true)).to.be.revertedWith(
        "Ownable: caller is not the owner",
      );
    });

    it("batchSetKycStatus reverts on array length mismatch", async function () {
      const { marketplace, owner, seller, buyer } = await loadFixture(deployFixture);
      await expect(
        marketplace.connect(owner).batchSetKycStatus([seller.address, buyer.address], [true]),
      ).to.be.revertedWith("Array length mismatch");
    });

    it("batchSetKycStatus sets multiple statuses", async function () {
      const { marketplace, owner, seller, buyer } = await loadFixture(deployFixture);
      await marketplace.connect(owner).batchSetKycStatus([seller.address, buyer.address], [false, true]);
      expect(await marketplace.isKycVerified(buyer.address)).to.equal(true);
      expect(await marketplace.isKycVerified(seller.address)).to.equal(false);
    });

    it("setKycRequired toggles the requirement", async function () {
      const { marketplace, owner } = await loadFixture(deployFixture);
      await marketplace.connect(owner).setKycRequired(false);
      expect(await marketplace.kycRequired()).to.equal(false);
    });

    it("setPlatformFee reverts above the max", async function () {
      const { marketplace, owner } = await loadFixture(deployFixture);
      await expect(marketplace.connect(owner).setPlatformFee(10001)).to.be.revertedWithCustomError(
        marketplace,
        "FeeTooHigh",
      );
    });

    it("setPlatformFee updates within bounds and emits", async function () {
      const { marketplace, owner } = await loadFixture(deployFixture);
      await expect(marketplace.connect(owner).setPlatformFee(500)).to.emit(
        marketplace,
        "PlatformFeeUpdated",
      );
      expect(await marketplace.platformFeeBps()).to.equal(500);
    });

    it("setFeeRecipient reverts on the zero address", async function () {
      const { marketplace, owner } = await loadFixture(deployFixture);
      await expect(
        marketplace.connect(owner).setFeeRecipient(ethers.ZeroAddress),
      ).to.be.revertedWithCustomError(marketplace, "InvalidFeeRecipient");
    });

    it("pause/unpause are owner-only and gate trading", async function () {
      const { marketplace, owner, other, seller } = await loadFixture(deployFixture);
      await expect(marketplace.connect(other).pause()).to.be.revertedWith(
        "Ownable: caller is not the owner",
      );
      await marketplace.connect(owner).pause();
      await expect(
        marketplace.connect(seller).createListing(TOKEN, 100n, PRICE, 0, 0),
      ).to.be.reverted;
      await marketplace.connect(owner).unpause();
      await expect(
        marketplace.connect(seller).createListing(TOKEN, 100n, PRICE, 0, 0),
      ).to.emit(marketplace, "ListingCreated");
    });
  });

  describe("batch view functions", function () {
    it("batchCalculatePrices reverts on length mismatch", async function () {
      const { marketplace } = await loadFixture(deployFixture);
      await marketplace; // ensure deployed
      await expect(
        marketplace.batchCalculatePrices([1n, 2n], [10n]),
      ).to.be.revertedWith("Length mismatch");
    });

    it("batchValidatePurchases reverts on length mismatch", async function () {
      const { marketplace } = await loadFixture(deployFixture);
      await expect(
        marketplace.batchValidatePurchases([1n], [10n, 20n]),
      ).to.be.revertedWith("Length mismatch");
    });

    it("getActiveOfferCount counts only active offers for a buyer", async function () {
      const { marketplace, buyer } = await loadFixture(withOffer);
      expect(await marketplace.getActiveOfferCount(buyer.address)).to.equal(1n);
      await marketplace.connect(buyer).cancelOffer(1);
      expect(await marketplace.getActiveOfferCount(buyer.address)).to.equal(0n);
    });

    it("getActiveListingsForToken returns active listing ids", async function () {
      const { marketplace, seller } = await loadFixture(deployFixture);
      await marketplace.connect(seller).createListing(TOKEN, 100n, PRICE, 0, 0);
      const ids = await marketplace.getActiveListingsForToken(TOKEN);
      expect(ids.length).to.equal(1);
    });
  });
});
