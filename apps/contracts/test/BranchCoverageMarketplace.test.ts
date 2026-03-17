/**
 * BranchCoverageMarketplace - Enterprise Branch Coverage Test Suite
 *
 * Comprehensive branch coverage tests for CarbonMarketplace.sol targeting 95%+
 * coverage. Tests are organized by feature area with explicit branch condition
 * documentation to ensure all paths are exercised.
 *
 * Branch Coverage Categories:
 * 1. KYC Modifier Branches (Lines 206-212) - 4 branches
 * 2. Update Listing Branches (Lines 337-382) - 6 branches
 * 3. Offer Rejection Branches (Lines 587-612) - 4 branches
 * 4. Purchase Flow Branches - Multiple branches
 * 5. Offer Creation/Acceptance Branches - Multiple branches
 *
 * @version 1.0.0
 * @author TerraQura Engineering
 * @audit Pre-mainnet branch coverage requirement
 */

import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { CarbonCredit, CarbonMarketplace, VerificationEngine } from "../typechain-types";

describe("BranchCoverageMarketplace", function () {
  // ============================================
  // Test Fixtures & Setup
  // ============================================

  let carbonCredit: CarbonCredit;
  let marketplace: CarbonMarketplace;
  let verificationEngine: VerificationEngine;
  let owner: SignerWithAddress;
  let seller: SignerWithAddress;
  let buyer: SignerWithAddress;
  let feeRecipient: SignerWithAddress;
  let kycUser: SignerWithAddress;
  let nonKycUser: SignerWithAddress;
  let randomUser: SignerWithAddress;

  // Constants
  const SCALE = 10000n;
  const PLATFORM_FEE_BPS = 250n; // 2.5%
  const DAC_UNIT_ID = ethers.keccak256(ethers.toUtf8Bytes("DAC-UNIT-001"));
  const PRICE_PER_UNIT = ethers.parseEther("0.01"); // 0.01 ETH per credit
  const OFFER_DURATION = 7 * 24 * 60 * 60; // 7 days

  // Minting parameters
  const DEFAULT_CO2_AMOUNT = 10000n * 10n ** 18n; // 10000 tonnes
  const DEFAULT_ENERGY = 250n * 10n ** 18n;
  const DEFAULT_LAT = 33000000n;
  const DEFAULT_LONG = -117000000n;
  const DEFAULT_PURITY = 99n;
  const DEFAULT_GRID_INTENSITY = 100n;

  let tokenIdCounter = 0;
  let currentTokenId: bigint;

  /**
   * Generate unique source data hash for each test
   */
  function generateUniqueHash(): string {
    tokenIdCounter++;
    return ethers.keccak256(ethers.toUtf8Bytes(`MARKET-SOURCE-${tokenIdCounter}-${Date.now()}`));
  }

  /**
   * Deploy fresh contracts before each test
   */
  beforeEach(async function () {
    [owner, seller, buyer, feeRecipient, kycUser, nonKycUser, randomUser] = await ethers.getSigners();

    // Deploy VerificationEngine
    const VerificationEngineFactory = await ethers.getContractFactory("VerificationEngine");
    verificationEngine = await upgrades.deployProxy(
      VerificationEngineFactory,
      [ethers.ZeroAddress, owner.address],
      { initializer: "initialize" }
    ) as unknown as VerificationEngine;

    // Deploy CarbonCredit
    const CarbonCreditFactory = await ethers.getContractFactory("CarbonCredit");
    carbonCredit = await upgrades.deployProxy(
      CarbonCreditFactory,
      [await verificationEngine.getAddress(), "https://terraqura.io/metadata/", owner.address],
      { initializer: "initialize" }
    ) as unknown as CarbonCredit;

    // Set CarbonCredit in VerificationEngine
    await verificationEngine.setCarbonCreditContract(await carbonCredit.getAddress());

    // Whitelist DAC unit with seller as operator
    await verificationEngine.whitelistDacUnit(DAC_UNIT_ID, seller.address);

    // Approve seller as minter
    await carbonCredit.setMinter(seller.address, true);

    // Deploy CarbonMarketplace
    const MarketplaceFactory = await ethers.getContractFactory("CarbonMarketplace");
    marketplace = await upgrades.deployProxy(
      MarketplaceFactory,
      [await carbonCredit.getAddress(), feeRecipient.address, PLATFORM_FEE_BPS, owner.address],
      { initializer: "initialize" }
    ) as unknown as CarbonMarketplace;

    // Mint credits to seller
    currentTokenId = await mintCreditsToSeller();

    // Approve marketplace for seller's tokens
    await carbonCredit.connect(seller).setApprovalForAll(await marketplace.getAddress(), true);

    // Setup KYC for required tests
    await marketplace.setKycStatus(seller.address, true);
    await marketplace.setKycStatus(buyer.address, true);
    await marketplace.setKycStatus(kycUser.address, true);
    // nonKycUser explicitly NOT verified
  });

  /**
   * Helper to mint credits to seller
   */
  async function mintCreditsToSeller(amount: bigint = DEFAULT_CO2_AMOUNT): Promise<bigint> {
    const hash = generateUniqueHash();
    const timestamp = Math.floor(Date.now() / 1000);

    // Energy must be proportional to CO2 to maintain valid kWh/tonne ratio (300 kWh/tonne)
    const proportionalEnergy = (amount * 300n) / 1000n;

    const tx = await carbonCredit.connect(seller).mintVerifiedCredits(
      seller.address,
      DAC_UNIT_ID,
      hash,
      timestamp,
      amount,
      proportionalEnergy,
      DEFAULT_LAT,
      DEFAULT_LONG,
      DEFAULT_PURITY,
      DEFAULT_GRID_INTENSITY,
      "ipfs://test",
      "arweave://test"
    );

    const receipt = await tx.wait();
    const event = receipt?.logs.find((log) => {
      try {
        const parsed = carbonCredit.interface.parseLog({
          topics: log.topics as string[],
          data: log.data,
        });
        return parsed?.name === "CreditMinted";
      } catch {
        return false;
      }
    });

    if (event) {
      const parsed = carbonCredit.interface.parseLog({
        topics: event.topics as string[],
        data: event.data,
      });
      return parsed?.args[0];
    }
    throw new Error("CreditMinted event not found");
  }

  // ============================================
  // SECTION 1: KYC Modifier Branches
  // Covers Lines 206-212
  // ============================================

  describe("1. KYC Modifier Branches", function () {
    describe("1.1 KYC Not Required (kycRequired = false)", function () {
      /**
       * Branch: kycRequired == false
       * Expected: All users can perform actions regardless of KYC status
       */
      beforeEach(async function () {
        await marketplace.setKycRequired(false);
      });

      it("should allow non-KYC user to create listing when KYC not required", async function () {
        // Mint to nonKycUser
        await verificationEngine.updateOperator(DAC_UNIT_ID, nonKycUser.address);
        await carbonCredit.setMinter(nonKycUser.address, true);

        const tokenId = await mintCreditsForUser(nonKycUser);
        await carbonCredit.connect(nonKycUser).setApprovalForAll(await marketplace.getAddress(), true);

        await expect(
          marketplace.connect(nonKycUser).createListing(tokenId, 100n, PRICE_PER_UNIT, 0, 0)
        ).to.not.be.reverted;
      });

      it("should allow non-KYC user to purchase when KYC not required", async function () {
        // Create listing as seller
        await marketplace.connect(seller).createListing(currentTokenId, 100n, PRICE_PER_UNIT, 0, 0);

        const totalPrice = 100n * PRICE_PER_UNIT;

        await expect(
          marketplace.connect(nonKycUser).purchase(1, 50n, { value: totalPrice })
        ).to.not.be.reverted;
      });

      it("should allow non-KYC user to create offer when KYC not required", async function () {
        const deposit = 50n * PRICE_PER_UNIT;

        await expect(
          marketplace.connect(nonKycUser).createOffer(currentTokenId, 50n, PRICE_PER_UNIT, OFFER_DURATION, { value: deposit })
        ).to.not.be.reverted;
      });
    });

    describe("1.2 KYC Required - User NOT Verified", function () {
      /**
       * Branch: kycRequired == true && !isKycVerified[sender]
       * Expected: Revert with KycNotVerified
       */
      beforeEach(async function () {
        await marketplace.setKycRequired(true);
        await marketplace.setKycStatus(nonKycUser.address, false);
      });

      it("should reject non-KYC user from creating listing when KYC required", async function () {
        // Setup nonKycUser with tokens
        await verificationEngine.updateOperator(DAC_UNIT_ID, nonKycUser.address);
        await carbonCredit.setMinter(nonKycUser.address, true);

        const tokenId = await mintCreditsForUser(nonKycUser);
        await carbonCredit.connect(nonKycUser).setApprovalForAll(await marketplace.getAddress(), true);

        await expect(
          marketplace.connect(nonKycUser).createListing(tokenId, 100n, PRICE_PER_UNIT, 0, 0)
        ).to.be.revertedWithCustomError(marketplace, "KycNotVerified");
      });

      it("should reject non-KYC user from purchasing when KYC required", async function () {
        // Create listing as verified seller
        await marketplace.connect(seller).createListing(currentTokenId, 100n, PRICE_PER_UNIT, 0, 0);

        const totalPrice = 100n * PRICE_PER_UNIT;

        await expect(
          marketplace.connect(nonKycUser).purchase(1, 50n, { value: totalPrice })
        ).to.be.revertedWithCustomError(marketplace, "KycNotVerified");
      });

      it("should reject non-KYC user from creating offers when KYC required", async function () {
        const deposit = 50n * PRICE_PER_UNIT;

        await expect(
          marketplace.connect(nonKycUser).createOffer(currentTokenId, 50n, PRICE_PER_UNIT, OFFER_DURATION, { value: deposit })
        ).to.be.revertedWithCustomError(marketplace, "KycNotVerified");
      });

      it("should reject non-KYC user from accepting offers when KYC required", async function () {
        // Create offer as verified buyer
        const deposit = 50n * PRICE_PER_UNIT;
        await marketplace.connect(buyer).createOffer(currentTokenId, 50n, PRICE_PER_UNIT, OFFER_DURATION, { value: deposit });

        // Try to accept as non-KYC user (who somehow has tokens)
        await expect(
          marketplace.connect(nonKycUser).acceptOffer(1)
        ).to.be.revertedWithCustomError(marketplace, "KycNotVerified");
      });
    });

    describe("1.3 KYC Required - User IS Verified", function () {
      /**
       * Branch: kycRequired == true && isKycVerified[sender]
       * Expected: Actions allowed
       */
      beforeEach(async function () {
        await marketplace.setKycRequired(true);
      });

      it("should allow KYC-verified user to create listing", async function () {
        await expect(
          marketplace.connect(seller).createListing(currentTokenId, 100n, PRICE_PER_UNIT, 0, 0)
        ).to.not.be.reverted;
      });

      it("should allow KYC-verified user to purchase", async function () {
        await marketplace.connect(seller).createListing(currentTokenId, 100n, PRICE_PER_UNIT, 0, 0);

        const totalPrice = 100n * PRICE_PER_UNIT;

        await expect(
          marketplace.connect(buyer).purchase(1, 50n, { value: totalPrice })
        ).to.not.be.reverted;
      });

      it("should allow KYC-verified user to create offers", async function () {
        const deposit = 50n * PRICE_PER_UNIT;

        await expect(
          marketplace.connect(buyer).createOffer(currentTokenId, 50n, PRICE_PER_UNIT, OFFER_DURATION, { value: deposit })
        ).to.not.be.reverted;
      });
    });

    describe("1.4 Batch KYC Status Updates", function () {
      it("should update multiple KYC statuses in one transaction", async function () {
        const users = [randomUser.address, nonKycUser.address];
        const statuses = [true, true];

        await marketplace.batchSetKycStatus(users, statuses);

        expect(await marketplace.isKycVerified(randomUser.address)).to.be.true;
        expect(await marketplace.isKycVerified(nonKycUser.address)).to.be.true;
      });

      it("should reject mismatched array lengths in batch KYC update", async function () {
        await expect(
          marketplace.batchSetKycStatus([randomUser.address], [true, false])
        ).to.be.revertedWith("Array length mismatch");
      });
    });
  });

  /**
   * Helper to mint credits for a specific user
   */
  async function mintCreditsForUser(user: SignerWithAddress): Promise<bigint> {
    const hash = generateUniqueHash();
    const timestamp = Math.floor(Date.now() / 1000);

    // Energy must be proportional to CO2 to maintain valid kWh/tonne ratio
    const proportionalEnergy = (DEFAULT_CO2_AMOUNT * 300n) / 1000n;

    const tx = await carbonCredit.connect(user).mintVerifiedCredits(
      user.address,
      DAC_UNIT_ID,
      hash,
      timestamp,
      DEFAULT_CO2_AMOUNT,
      proportionalEnergy,
      DEFAULT_LAT,
      DEFAULT_LONG,
      DEFAULT_PURITY,
      DEFAULT_GRID_INTENSITY,
      "ipfs://test",
      "arweave://test"
    );

    const receipt = await tx.wait();
    const event = receipt?.logs.find((log) => {
      try {
        const parsed = carbonCredit.interface.parseLog({
          topics: log.topics as string[],
          data: log.data,
        });
        return parsed?.name === "CreditMinted";
      } catch {
        return false;
      }
    });

    if (event) {
      const parsed = carbonCredit.interface.parseLog({
        topics: event.topics as string[],
        data: event.data,
      });
      return parsed?.args[0];
    }
    throw new Error("CreditMinted event not found");
  }

  // ============================================
  // SECTION 2: Update Listing Branches
  // Covers Lines 337-382
  // ============================================

  describe("2. Update Listing Branches", function () {
    let listingId: bigint;

    beforeEach(async function () {
      // Create initial listing
      await marketplace.connect(seller).createListing(currentTokenId, 500n, PRICE_PER_UNIT, 0, 0);
      listingId = 1n;
    });

    describe("2.1 Price Update Branch (newPricePerUnit > 0)", function () {
      /**
       * Branch: newPricePerUnit > 0
       * Expected: Price is updated
       */
      it("should update price when newPricePerUnit > 0", async function () {
        const newPrice = PRICE_PER_UNIT * 2n;

        await marketplace.connect(seller).updateListing(listingId, newPrice, 0n);

        const listing = await marketplace.getListing(listingId);
        expect(listing.pricePerUnit).to.equal(newPrice);
      });

      it("should NOT update price when newPricePerUnit = 0", async function () {
        const originalListing = await marketplace.getListing(listingId);

        await marketplace.connect(seller).updateListing(listingId, 0n, 600n);

        const updatedListing = await marketplace.getListing(listingId);
        expect(updatedListing.pricePerUnit).to.equal(originalListing.pricePerUnit);
      });
    });

    describe("2.2 Amount Update - Adding Credits (newAmount > current)", function () {
      /**
       * Branch: newAmount > 0 && newAmount != listing.amount && newAmount > listing.amount
       * Expected: Additional credits transferred to marketplace
       */
      it("should add more credits when newAmount > current", async function () {
        const originalListing = await marketplace.getListing(listingId);
        const newAmount = originalListing.amount + 200n;

        await marketplace.connect(seller).updateListing(listingId, 0n, newAmount);

        const updatedListing = await marketplace.getListing(listingId);
        expect(updatedListing.amount).to.equal(newAmount);
      });

      it("should transfer additional credits from seller to marketplace", async function () {
        const originalSellerBalance = await carbonCredit.balanceOf(seller.address, currentTokenId);

        await marketplace.connect(seller).updateListing(listingId, 0n, 700n);

        const newSellerBalance = await carbonCredit.balanceOf(seller.address, currentTokenId);
        expect(newSellerBalance).to.be.lt(originalSellerBalance);
      });

      it("should reject adding more credits when insufficient balance", async function () {
        // Seller has limited remaining balance after listing
        const sellerBalance = await carbonCredit.balanceOf(seller.address, currentTokenId);
        const currentListing = await marketplace.getListing(listingId);
        const impossibleAmount = currentListing.amount + sellerBalance + 1000n;

        await expect(
          marketplace.connect(seller).updateListing(listingId, 0n, impossibleAmount)
        ).to.be.revertedWithCustomError(marketplace, "InsufficientBalance");
      });
    });

    describe("2.3 Amount Update - Reducing Credits (newAmount < current)", function () {
      /**
       * Branch: newAmount > 0 && newAmount != listing.amount && newAmount < listing.amount
       * Expected: Credits returned to seller
       */
      it("should reduce credits when newAmount < current", async function () {
        const newAmount = 200n;

        await marketplace.connect(seller).updateListing(listingId, 0n, newAmount);

        const updatedListing = await marketplace.getListing(listingId);
        expect(updatedListing.amount).to.equal(newAmount);
      });

      it("should return credits to seller when reducing", async function () {
        const originalSellerBalance = await carbonCredit.balanceOf(seller.address, currentTokenId);

        await marketplace.connect(seller).updateListing(listingId, 0n, 200n);

        const newSellerBalance = await carbonCredit.balanceOf(seller.address, currentTokenId);
        expect(newSellerBalance).to.be.gt(originalSellerBalance);
      });
    });

    describe("2.4 Amount Update - Same Amount (newAmount = current)", function () {
      /**
       * Branch: newAmount > 0 && newAmount == listing.amount
       * Expected: No transfer, amount unchanged
       */
      it("should not transfer when newAmount equals current amount", async function () {
        const originalListing = await marketplace.getListing(listingId);
        const originalSellerBalance = await carbonCredit.balanceOf(seller.address, currentTokenId);

        await marketplace.connect(seller).updateListing(listingId, PRICE_PER_UNIT * 3n, originalListing.amount);

        const newSellerBalance = await carbonCredit.balanceOf(seller.address, currentTokenId);
        expect(newSellerBalance).to.equal(originalSellerBalance);
      });
    });

    describe("2.5 Update Listing Validation Branches", function () {
      it("should reject update for non-existent listing", async function () {
        await expect(
          marketplace.connect(seller).updateListing(999n, PRICE_PER_UNIT, 100n)
        ).to.be.revertedWithCustomError(marketplace, "ListingNotFound");
      });

      it("should reject update for inactive listing", async function () {
        await marketplace.connect(seller).cancelListing(listingId);

        await expect(
          marketplace.connect(seller).updateListing(listingId, PRICE_PER_UNIT, 100n)
        ).to.be.revertedWithCustomError(marketplace, "ListingNotActive");
      });

      it("should reject update from non-seller", async function () {
        await expect(
          marketplace.connect(buyer).updateListing(listingId, PRICE_PER_UNIT, 100n)
        ).to.be.revertedWithCustomError(marketplace, "NotListingSeller");
      });
    });

    describe("2.6 Update Listing Event Emission", function () {
      it("should emit ListingUpdated with correct values", async function () {
        const newPrice = PRICE_PER_UNIT * 2n;
        const newAmount = 600n;

        await expect(
          marketplace.connect(seller).updateListing(listingId, newPrice, newAmount)
        )
          .to.emit(marketplace, "ListingUpdated")
          .withArgs(listingId, newPrice, newAmount);
      });
    });
  });

  // ============================================
  // SECTION 3: Offer Rejection Branches
  // Covers Lines 587-612
  // ============================================

  describe("3. Offer Rejection Branches", function () {
    let offerId: bigint;

    beforeEach(async function () {
      // Create offer from buyer
      const deposit = 100n * PRICE_PER_UNIT;
      await marketplace.connect(buyer).createOffer(currentTokenId, 100n, PRICE_PER_UNIT, OFFER_DURATION, { value: deposit });
      offerId = 1n;
    });

    describe("3.1 Buyer Rejection (sender == offer.buyer)", function () {
      /**
       * Branch: isBuyer == true
       * Expected: Buyer can always reject their own offer
       */
      it("should allow buyer to reject their own offer", async function () {
        await expect(
          marketplace.connect(buyer).rejectOffer(offerId)
        ).to.not.be.reverted;
      });

      it("should refund deposit to buyer when rejecting", async function () {
        const offer = await marketplace.getOffer(offerId);
        const buyerBalanceBefore = await ethers.provider.getBalance(buyer.address);

        const tx = await marketplace.connect(buyer).rejectOffer(offerId);
        const receipt = await tx.wait();
        const gasCost = receipt!.gasUsed * receipt!.gasPrice;

        const buyerBalanceAfter = await ethers.provider.getBalance(buyer.address);
        expect(buyerBalanceAfter).to.equal(buyerBalanceBefore + offer.depositAmount - gasCost);
      });

      it("should mark offer as inactive after buyer rejection", async function () {
        await marketplace.connect(buyer).rejectOffer(offerId);

        const offer = await marketplace.getOffer(offerId);
        expect(offer.isActive).to.be.false;
      });
    });

    describe("3.2 Token Holder Rejection (canFulfillOffer == true)", function () {
      /**
       * Branch: canFulfillOffer == true (balanceOf >= offer.amount)
       * Expected: Token holder with sufficient balance can reject
       */
      it("should allow token holder with sufficient balance to reject", async function () {
        // Seller has enough tokens to fulfill the offer
        const sellerBalance = await carbonCredit.balanceOf(seller.address, currentTokenId);
        const offer = await marketplace.getOffer(offerId);
        expect(sellerBalance).to.be.gte(offer.amount);

        await expect(
          marketplace.connect(seller).rejectOffer(offerId)
        ).to.not.be.reverted;
      });

      it("should refund deposit to buyer when holder rejects", async function () {
        const offer = await marketplace.getOffer(offerId);
        const buyerBalanceBefore = await ethers.provider.getBalance(buyer.address);

        await marketplace.connect(seller).rejectOffer(offerId);

        const buyerBalanceAfter = await ethers.provider.getBalance(buyer.address);
        expect(buyerBalanceAfter).to.equal(buyerBalanceBefore + offer.depositAmount);
      });
    });

    describe("3.3 Unauthorized Rejection (!isBuyer && !canFulfillOffer)", function () {
      /**
       * Branch: isBuyer == false && canFulfillOffer == false
       * Expected: Revert with NotAuthorizedToReject
       */
      it("should reject when non-buyer and non-holder tries to reject", async function () {
        // randomUser has no tokens and is not the buyer
        await marketplace.setKycStatus(randomUser.address, true);

        await expect(
          marketplace.connect(randomUser).rejectOffer(offerId)
        ).to.be.revertedWithCustomError(marketplace, "NotAuthorizedToReject");
      });

      it("should reject when holder has insufficient balance for this token", async function () {
        // kycUser has NO balance of currentTokenId (the token the offer is for)
        // So they are not authorized to reject
        const kycUserBalance = await carbonCredit.balanceOf(kycUser.address, currentTokenId);
        expect(kycUserBalance).to.equal(0n); // Confirm they have 0 of this token

        // This user is not authorized because they don't have the specific token
        await expect(
          marketplace.connect(kycUser).rejectOffer(offerId)
        ).to.be.revertedWithCustomError(marketplace, "NotAuthorizedToReject");
      });
    });

    describe("3.4 Offer Rejection Validation Branches", function () {
      it("should reject rejection of non-existent offer", async function () {
        await expect(
          marketplace.connect(buyer).rejectOffer(999n)
        ).to.be.revertedWithCustomError(marketplace, "OfferNotFound");
      });

      it("should reject rejection of inactive offer", async function () {
        await marketplace.connect(buyer).rejectOffer(offerId);

        await expect(
          marketplace.connect(buyer).rejectOffer(offerId)
        ).to.be.revertedWithCustomError(marketplace, "OfferNotActive");
      });
    });

    describe("3.5 Offer Rejection Event Emission", function () {
      it("should emit OfferRejected when buyer rejects", async function () {
        await expect(
          marketplace.connect(buyer).rejectOffer(offerId)
        )
          .to.emit(marketplace, "OfferRejected")
          .withArgs(offerId, buyer.address);
      });

      it("should emit OfferRejected when seller rejects", async function () {
        await expect(
          marketplace.connect(seller).rejectOffer(offerId)
        )
          .to.emit(marketplace, "OfferRejected")
          .withArgs(offerId, seller.address);
      });
    });
  });

  // ============================================
  // SECTION 4: Purchase Flow Branches
  // ============================================

  describe("4. Purchase Flow Branches", function () {
    let listingId: bigint;

    beforeEach(async function () {
      await marketplace.connect(seller).createListing(currentTokenId, 1000n, PRICE_PER_UNIT, 0, 0);
      listingId = 1n;
    });

    describe("4.1 Successful Purchase", function () {
      it("should complete purchase and transfer credits", async function () {
        const buyAmount = 100n;
        const totalPrice = buyAmount * PRICE_PER_UNIT;

        const buyerBalanceBefore = await carbonCredit.balanceOf(buyer.address, currentTokenId);

        await marketplace.connect(buyer).purchase(listingId, buyAmount, { value: totalPrice });

        const buyerBalanceAfter = await carbonCredit.balanceOf(buyer.address, currentTokenId);
        expect(buyerBalanceAfter).to.equal(buyerBalanceBefore + buyAmount);
      });

      it("should calculate and distribute platform fee correctly", async function () {
        const buyAmount = 100n;
        const totalPrice = buyAmount * PRICE_PER_UNIT;
        const expectedFee = (totalPrice * PLATFORM_FEE_BPS) / 10000n;

        const feeBalanceBefore = await ethers.provider.getBalance(feeRecipient.address);

        await marketplace.connect(buyer).purchase(listingId, buyAmount, { value: totalPrice });

        const feeBalanceAfter = await ethers.provider.getBalance(feeRecipient.address);
        expect(feeBalanceAfter).to.equal(feeBalanceBefore + expectedFee);
      });

      it("should refund excess payment", async function () {
        const buyAmount = 100n;
        const totalPrice = buyAmount * PRICE_PER_UNIT;
        const excessPayment = ethers.parseEther("1");

        const buyerBalanceBefore = await ethers.provider.getBalance(buyer.address);

        const tx = await marketplace.connect(buyer).purchase(listingId, buyAmount, { value: totalPrice + excessPayment });
        const receipt = await tx.wait();
        const gasCost = receipt!.gasUsed * receipt!.gasPrice;

        const buyerBalanceAfter = await ethers.provider.getBalance(buyer.address);

        // Should be: before - totalPrice - gasCost (excess refunded)
        expect(buyerBalanceAfter).to.be.closeTo(buyerBalanceBefore - totalPrice - gasCost, ethers.parseEther("0.001"));
      });
    });

    describe("4.2 Purchase Validation Branches", function () {
      it("should reject purchase of non-existent listing", async function () {
        await expect(
          marketplace.connect(buyer).purchase(999n, 10n, { value: PRICE_PER_UNIT * 10n })
        ).to.be.revertedWithCustomError(marketplace, "ListingNotFound");
      });

      it("should reject purchase of inactive listing", async function () {
        await marketplace.connect(seller).cancelListing(listingId);

        await expect(
          marketplace.connect(buyer).purchase(listingId, 10n, { value: PRICE_PER_UNIT * 10n })
        ).to.be.revertedWithCustomError(marketplace, "ListingNotActive");
      });

      it("should reject purchase with insufficient payment", async function () {
        const buyAmount = 100n;
        const insufficientPayment = PRICE_PER_UNIT * 50n; // Only pay for 50

        await expect(
          marketplace.connect(buyer).purchase(listingId, buyAmount, { value: insufficientPayment })
        ).to.be.revertedWithCustomError(marketplace, "InsufficientPayment");
      });

      it("should reject purchase of more credits than available", async function () {
        const listing = await marketplace.getListing(listingId);
        const tooManyCredits = listing.amount + 1n;

        await expect(
          marketplace.connect(buyer).purchase(listingId, tooManyCredits, { value: PRICE_PER_UNIT * tooManyCredits })
        ).to.be.revertedWithCustomError(marketplace, "InvalidAmount");
      });

      it("should reject zero amount purchase", async function () {
        await expect(
          marketplace.connect(buyer).purchase(listingId, 0n, { value: 0n })
        ).to.be.revertedWithCustomError(marketplace, "InvalidAmount");
      });
    });

    describe("4.3 Partial vs Full Purchase", function () {
      it("should keep listing active after partial purchase", async function () {
        const buyAmount = 100n;
        await marketplace.connect(buyer).purchase(listingId, buyAmount, { value: PRICE_PER_UNIT * buyAmount });

        const listing = await marketplace.getListing(listingId);
        expect(listing.isActive).to.be.true;
        expect(listing.amount).to.equal(1000n - buyAmount);
      });

      it("should deactivate listing after full purchase", async function () {
        const listing = await marketplace.getListing(listingId);
        await marketplace.connect(buyer).purchase(listingId, listing.amount, { value: PRICE_PER_UNIT * listing.amount });

        const updatedListing = await marketplace.getListing(listingId);
        expect(updatedListing.isActive).to.be.false;
        expect(updatedListing.amount).to.equal(0n);
      });
    });
  });

  // ============================================
  // SECTION 5: Offer Creation Branches
  // ============================================

  describe("5. Offer Creation Branches", function () {
    describe("5.1 Successful Offer Creation", function () {
      it("should create offer with correct parameters", async function () {
        const amount = 100n;
        const deposit = amount * PRICE_PER_UNIT;

        await marketplace.connect(buyer).createOffer(currentTokenId, amount, PRICE_PER_UNIT, OFFER_DURATION, { value: deposit });

        const offer = await marketplace.getOffer(1);
        expect(offer.buyer).to.equal(buyer.address);
        expect(offer.tokenId).to.equal(currentTokenId);
        expect(offer.amount).to.equal(amount);
        expect(offer.pricePerUnit).to.equal(PRICE_PER_UNIT);
        expect(offer.isActive).to.be.true;
      });

      it("should refund excess deposit", async function () {
        const amount = 100n;
        const requiredDeposit = amount * PRICE_PER_UNIT;
        const excessDeposit = ethers.parseEther("1");

        const buyerBalanceBefore = await ethers.provider.getBalance(buyer.address);

        const tx = await marketplace.connect(buyer).createOffer(
          currentTokenId,
          amount,
          PRICE_PER_UNIT,
          OFFER_DURATION,
          { value: requiredDeposit + excessDeposit }
        );
        const receipt = await tx.wait();
        const gasCost = receipt!.gasUsed * receipt!.gasPrice;

        const buyerBalanceAfter = await ethers.provider.getBalance(buyer.address);

        // Should be: before - requiredDeposit - gasCost
        expect(buyerBalanceAfter).to.be.closeTo(buyerBalanceBefore - requiredDeposit - gasCost, ethers.parseEther("0.001"));
      });
    });

    describe("5.2 Offer Creation Validation", function () {
      it("should reject offer with zero amount", async function () {
        await expect(
          marketplace.connect(buyer).createOffer(currentTokenId, 0n, PRICE_PER_UNIT, OFFER_DURATION, { value: PRICE_PER_UNIT })
        ).to.be.revertedWithCustomError(marketplace, "InvalidAmount");
      });

      it("should reject offer with zero price", async function () {
        await expect(
          marketplace.connect(buyer).createOffer(currentTokenId, 100n, 0n, OFFER_DURATION, { value: PRICE_PER_UNIT })
        ).to.be.revertedWithCustomError(marketplace, "InvalidPrice");
      });

      it("should reject offer with insufficient deposit", async function () {
        const amount = 100n;
        const insufficientDeposit = PRICE_PER_UNIT * 50n;

        await expect(
          marketplace.connect(buyer).createOffer(currentTokenId, amount, PRICE_PER_UNIT, OFFER_DURATION, { value: insufficientDeposit })
        ).to.be.revertedWithCustomError(marketplace, "InsufficientPayment");
      });
    });
  });

  // ============================================
  // SECTION 6: Offer Acceptance Branches
  // ============================================

  describe("6. Offer Acceptance Branches", function () {
    let offerId: bigint;

    beforeEach(async function () {
      const deposit = 100n * PRICE_PER_UNIT;
      await marketplace.connect(buyer).createOffer(currentTokenId, 100n, PRICE_PER_UNIT, OFFER_DURATION, { value: deposit });
      offerId = 1n;
    });

    describe("6.1 Successful Acceptance", function () {
      it("should transfer credits to buyer on acceptance", async function () {
        const offer = await marketplace.getOffer(offerId);
        const buyerBalanceBefore = await carbonCredit.balanceOf(buyer.address, currentTokenId);

        await marketplace.connect(seller).acceptOffer(offerId);

        const buyerBalanceAfter = await carbonCredit.balanceOf(buyer.address, currentTokenId);
        expect(buyerBalanceAfter).to.equal(buyerBalanceBefore + offer.amount);
      });

      it("should pay seller after fee deduction", async function () {
        const offer = await marketplace.getOffer(offerId);
        const totalValue = offer.amount * offer.pricePerUnit;
        const fee = (totalValue * PLATFORM_FEE_BPS) / 10000n;
        const sellerProceeds = totalValue - fee;

        const sellerBalanceBefore = await ethers.provider.getBalance(seller.address);

        const tx = await marketplace.connect(seller).acceptOffer(offerId);
        const receipt = await tx.wait();
        const gasCost = receipt!.gasUsed * receipt!.gasPrice;

        const sellerBalanceAfter = await ethers.provider.getBalance(seller.address);
        expect(sellerBalanceAfter).to.equal(sellerBalanceBefore + sellerProceeds - gasCost);
      });

      it("should mark offer as inactive after acceptance", async function () {
        await marketplace.connect(seller).acceptOffer(offerId);

        const offer = await marketplace.getOffer(offerId);
        expect(offer.isActive).to.be.false;
      });
    });

    describe("6.2 Acceptance Validation", function () {
      it("should reject acceptance of non-existent offer", async function () {
        await expect(
          marketplace.connect(seller).acceptOffer(999n)
        ).to.be.revertedWithCustomError(marketplace, "OfferNotFound");
      });

      it("should reject acceptance of inactive offer", async function () {
        await marketplace.connect(buyer).rejectOffer(offerId);

        await expect(
          marketplace.connect(seller).acceptOffer(offerId)
        ).to.be.revertedWithCustomError(marketplace, "OfferNotActive");
      });

      it("should reject acceptance when seller has insufficient balance", async function () {
        // Transfer all seller's tokens away
        const sellerBalance = await carbonCredit.balanceOf(seller.address, currentTokenId);
        await carbonCredit.connect(seller).safeTransferFrom(seller.address, randomUser.address, currentTokenId, sellerBalance, "0x");

        await expect(
          marketplace.connect(seller).acceptOffer(offerId)
        ).to.be.revertedWithCustomError(marketplace, "InsufficientBalance");
      });
    });
  });

  // ============================================
  // SECTION 7: Batch Operations Branches
  // ============================================

  describe("7. Batch Operations Branches", function () {
    describe("7.1 Batch Get Listings", function () {
      beforeEach(async function () {
        // Create multiple listings
        await marketplace.connect(seller).createListing(currentTokenId, 100n, PRICE_PER_UNIT, 0, 0);
        await marketplace.connect(seller).createListing(currentTokenId, 200n, PRICE_PER_UNIT * 2n, 0, 0);
        await marketplace.connect(seller).createListing(currentTokenId, 300n, PRICE_PER_UNIT * 3n, 0, 0);
      });

      it("should return empty array for empty input", async function () {
        const listings = await marketplace.batchGetListings([]);
        expect(listings.length).to.equal(0);
      });

      it("should return correct listings for valid IDs", async function () {
        const listings = await marketplace.batchGetListings([1n, 2n, 3n]);

        expect(listings.length).to.equal(3);
        expect(listings[0].amount).to.equal(100n);
        expect(listings[1].amount).to.equal(200n);
        expect(listings[2].amount).to.equal(300n);
      });
    });

    describe("7.2 Batch Get Offers", function () {
      beforeEach(async function () {
        const deposit = 100n * PRICE_PER_UNIT;
        await marketplace.connect(buyer).createOffer(currentTokenId, 100n, PRICE_PER_UNIT, OFFER_DURATION, { value: deposit });
        await marketplace.connect(buyer).createOffer(currentTokenId, 200n, PRICE_PER_UNIT, OFFER_DURATION, { value: deposit * 2n });
      });

      it("should return empty array for empty input", async function () {
        const offers = await marketplace.batchGetOffers([]);
        expect(offers.length).to.equal(0);
      });

      it("should return correct offers for valid IDs", async function () {
        const offers = await marketplace.batchGetOffers([1n, 2n]);

        expect(offers.length).to.equal(2);
        expect(offers[0].amount).to.equal(100n);
        expect(offers[1].amount).to.equal(200n);
      });
    });

    describe("7.3 Batch Calculate Prices", function () {
      it("should calculate prices for multiple listings", async function () {
        await marketplace.connect(seller).createListing(currentTokenId, 1000n, PRICE_PER_UNIT, 0, 0);
        await marketplace.connect(seller).createListing(currentTokenId, 1000n, PRICE_PER_UNIT * 2n, 0, 0);

        const [prices, fees, totals] = await marketplace.batchCalculatePrices(
          [1n, 2n],
          [100n, 100n]
        );

        expect(prices[0]).to.equal(100n * PRICE_PER_UNIT);
        expect(prices[1]).to.equal(100n * PRICE_PER_UNIT * 2n);
      });
    });
  });

  // ============================================
  // SECTION 8: Pause State Branches
  // ============================================

  describe("8. Pause State Branches", function () {
    beforeEach(async function () {
      await marketplace.pause();
    });

    afterEach(async function () {
      if (await marketplace.paused()) {
        await marketplace.unpause();
      }
    });

    it("should reject listing creation when paused", async function () {
      await expect(
        marketplace.connect(seller).createListing(currentTokenId, 100n, PRICE_PER_UNIT, 0, 0)
      ).to.be.revertedWith("Pausable: paused");
    });

    it("should reject purchases when paused", async function () {
      // Create listing before pausing
      await marketplace.unpause();
      await marketplace.connect(seller).createListing(currentTokenId, 100n, PRICE_PER_UNIT, 0, 0);
      await marketplace.pause();

      await expect(
        marketplace.connect(buyer).purchase(1, 50n, { value: PRICE_PER_UNIT * 50n })
      ).to.be.revertedWith("Pausable: paused");
    });

    it("should reject offer creation when paused", async function () {
      await expect(
        marketplace.connect(buyer).createOffer(currentTokenId, 100n, PRICE_PER_UNIT, OFFER_DURATION, { value: PRICE_PER_UNIT * 100n })
      ).to.be.revertedWith("Pausable: paused");
    });
  });
});
