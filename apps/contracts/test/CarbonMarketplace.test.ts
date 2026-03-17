import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { CarbonMarketplace } from "../typechain-types";

describe("CarbonMarketplace", function () {
    let marketplace: CarbonMarketplace;
    let mockCarbonCredit: any;
    let owner: SignerWithAddress;
    let seller: SignerWithAddress;
    let buyer: SignerWithAddress;
    let feeRecipient: SignerWithAddress;
    let unauthorized: SignerWithAddress;

    const TOKEN_ID = 1;
    const LISTING_AMOUNT = 100;
    const PRICE_PER_UNIT = ethers.parseEther("0.01");
    const PLATFORM_FEE_BPS = 250; // 2.5%

    beforeEach(async function () {
        [owner, seller, buyer, feeRecipient, unauthorized] = await ethers.getSigners();

        // Deploy mock ERC1155
        const MockERC1155 = await ethers.getContractFactory("MockERC1155");
        mockCarbonCredit = await MockERC1155.deploy();
        await mockCarbonCredit.waitForDeployment();

        // Mint tokens to seller
        await mockCarbonCredit.mint(seller.address, TOKEN_ID, 1000, "0x");

        // Deploy marketplace
        const MarketplaceFactory = await ethers.getContractFactory("CarbonMarketplace");
        marketplace = await upgrades.deployProxy(
            MarketplaceFactory,
            [
                await mockCarbonCredit.getAddress(),
                feeRecipient.address,
                PLATFORM_FEE_BPS,
                owner.address
            ],
            { initializer: "initialize" }
        ) as unknown as CarbonMarketplace;
        await marketplace.waitForDeployment();

        // Set KYC status for test accounts
        await marketplace.setKycStatus(seller.address, true);
        await marketplace.setKycStatus(buyer.address, true);

        // Approve marketplace for seller
        await mockCarbonCredit.connect(seller).setApprovalForAll(await marketplace.getAddress(), true);
    });

    describe("Initialization", function () {
        it("should set correct initial values", async function () {
            expect(await marketplace.carbonCredit()).to.equal(await mockCarbonCredit.getAddress());
            expect(await marketplace.feeRecipient()).to.equal(feeRecipient.address);
            expect(await marketplace.platformFeeBps()).to.equal(PLATFORM_FEE_BPS);
            expect(await marketplace.owner()).to.equal(owner.address);
        });

        it("should start with listing and offer IDs at 1", async function () {
            expect(await marketplace.nextListingId()).to.equal(1);
            expect(await marketplace.nextOfferId()).to.equal(1);
        });
    });

    describe("Listings", function () {
        describe("createListing", function () {
            it("should create a listing successfully", async function () {
                const tx = await marketplace.connect(seller).createListing(
                    TOKEN_ID,
                    LISTING_AMOUNT,
                    PRICE_PER_UNIT,
                    10, // min purchase
                    86400 // 1 day duration
                );

                await expect(tx)
                    .to.emit(marketplace, "ListingCreated")
                    .withArgs(1, seller.address, TOKEN_ID, LISTING_AMOUNT, PRICE_PER_UNIT);

                const listing = await marketplace.getListing(1);
                expect(listing.seller).to.equal(seller.address);
                expect(listing.tokenId).to.equal(TOKEN_ID);
                expect(listing.amount).to.equal(LISTING_AMOUNT);
                expect(listing.pricePerUnit).to.equal(PRICE_PER_UNIT);
                expect(listing.isActive).to.be.true;
            });

            it("should transfer tokens to marketplace", async function () {
                await marketplace.connect(seller).createListing(TOKEN_ID, LISTING_AMOUNT, PRICE_PER_UNIT, 0, 0);

                expect(await mockCarbonCredit.balanceOf(await marketplace.getAddress(), TOKEN_ID))
                    .to.equal(LISTING_AMOUNT);
            });

            it("should revert for zero price", async function () {
                await expect(
                    marketplace.connect(seller).createListing(TOKEN_ID, LISTING_AMOUNT, 0, 0, 0)
                ).to.be.revertedWithCustomError(marketplace, "InvalidPrice");
            });

            it("should revert for zero amount", async function () {
                await expect(
                    marketplace.connect(seller).createListing(TOKEN_ID, 0, PRICE_PER_UNIT, 0, 0)
                ).to.be.revertedWithCustomError(marketplace, "InvalidAmount");
            });

            it("should revert if seller has insufficient balance", async function () {
                await expect(
                    marketplace.connect(seller).createListing(TOKEN_ID, 10000, PRICE_PER_UNIT, 0, 0)
                ).to.be.revertedWithCustomError(marketplace, "InsufficientBalance");
            });

            it("should revert if KYC not verified", async function () {
                await marketplace.setKycRequired(true);
                await expect(
                    marketplace.connect(unauthorized).createListing(TOKEN_ID, 100, PRICE_PER_UNIT, 0, 0)
                ).to.be.revertedWithCustomError(marketplace, "KycNotVerified");
            });
        });

        describe("cancelListing", function () {
            beforeEach(async function () {
                await marketplace.connect(seller).createListing(TOKEN_ID, LISTING_AMOUNT, PRICE_PER_UNIT, 0, 0);
            });

            it("should cancel listing and return tokens", async function () {
                const balanceBefore = await mockCarbonCredit.balanceOf(seller.address, TOKEN_ID);

                await expect(marketplace.connect(seller).cancelListing(1))
                    .to.emit(marketplace, "ListingCancelled")
                    .withArgs(1, seller.address);

                const listing = await marketplace.getListing(1);
                expect(listing.isActive).to.be.false;

                expect(await mockCarbonCredit.balanceOf(seller.address, TOKEN_ID))
                    .to.equal(balanceBefore + BigInt(LISTING_AMOUNT));
            });

            it("should revert if not seller", async function () {
                await expect(marketplace.connect(unauthorized).cancelListing(1))
                    .to.be.revertedWithCustomError(marketplace, "NotListingSeller");
            });

            it("should revert for non-existent listing", async function () {
                await expect(marketplace.connect(seller).cancelListing(999))
                    .to.be.revertedWithCustomError(marketplace, "ListingNotFound");
            });
        });

        describe("updateListing", function () {
            beforeEach(async function () {
                await marketplace.connect(seller).createListing(TOKEN_ID, LISTING_AMOUNT, PRICE_PER_UNIT, 0, 0);
            });

            it("should update price", async function () {
                const newPrice = ethers.parseEther("0.02");
                await marketplace.connect(seller).updateListing(1, newPrice, 0);

                const listing = await marketplace.getListing(1);
                expect(listing.pricePerUnit).to.equal(newPrice);
            });

            it("should increase amount", async function () {
                const additionalAmount = 50;
                await marketplace.connect(seller).updateListing(1, 0, LISTING_AMOUNT + additionalAmount);

                const listing = await marketplace.getListing(1);
                expect(listing.amount).to.equal(LISTING_AMOUNT + additionalAmount);
            });

            it("should decrease amount and return tokens", async function () {
                const newAmount = 50;
                const balanceBefore = await mockCarbonCredit.balanceOf(seller.address, TOKEN_ID);

                await marketplace.connect(seller).updateListing(1, 0, newAmount);

                expect(await mockCarbonCredit.balanceOf(seller.address, TOKEN_ID))
                    .to.equal(balanceBefore + BigInt(LISTING_AMOUNT - newAmount));
            });
        });
    });

    describe("Purchases", function () {
        beforeEach(async function () {
            await marketplace.connect(seller).createListing(TOKEN_ID, LISTING_AMOUNT, PRICE_PER_UNIT, 10, 0);
        });

        it("should complete purchase successfully", async function () {
            const purchaseAmount = 50;
            const totalPrice = PRICE_PER_UNIT * BigInt(purchaseAmount);

            await expect(
                marketplace.connect(buyer).purchase(1, purchaseAmount, { value: totalPrice })
            ).to.emit(marketplace, "Purchase");

            expect(await mockCarbonCredit.balanceOf(buyer.address, TOKEN_ID)).to.equal(purchaseAmount);

            const listing = await marketplace.getListing(1);
            expect(listing.amount).to.equal(LISTING_AMOUNT - purchaseAmount);
        });

        it("should distribute fees correctly", async function () {
            const purchaseAmount = 100;
            const totalPrice = PRICE_PER_UNIT * BigInt(purchaseAmount);
            const expectedFee = (totalPrice * BigInt(PLATFORM_FEE_BPS)) / BigInt(10000);
            const expectedSellerProceeds = totalPrice - expectedFee;

            const sellerBalanceBefore = await ethers.provider.getBalance(seller.address);
            const feeRecipientBalanceBefore = await ethers.provider.getBalance(feeRecipient.address);

            await marketplace.connect(buyer).purchase(1, purchaseAmount, { value: totalPrice });

            const sellerBalanceAfter = await ethers.provider.getBalance(seller.address);
            const feeRecipientBalanceAfter = await ethers.provider.getBalance(feeRecipient.address);

            expect(sellerBalanceAfter - sellerBalanceBefore).to.equal(expectedSellerProceeds);
            expect(feeRecipientBalanceAfter - feeRecipientBalanceBefore).to.equal(expectedFee);
        });

        it("should revert if buying own listing", async function () {
            await expect(
                marketplace.connect(seller).purchase(1, 10, { value: PRICE_PER_UNIT * BigInt(10) })
            ).to.be.revertedWithCustomError(marketplace, "CannotBuyOwnListing");
        });

        it("should revert if below minimum purchase", async function () {
            await expect(
                marketplace.connect(buyer).purchase(1, 5, { value: PRICE_PER_UNIT * BigInt(5) })
            ).to.be.revertedWithCustomError(marketplace, "BelowMinPurchase");
        });

        it("should revert if insufficient payment", async function () {
            await expect(
                marketplace.connect(buyer).purchase(1, 50, { value: ethers.parseEther("0.1") })
            ).to.be.revertedWithCustomError(marketplace, "InsufficientPayment");
        });

        it("should refund excess payment", async function () {
            const purchaseAmount = 10;
            const totalPrice = PRICE_PER_UNIT * BigInt(purchaseAmount);
            const excessPayment = ethers.parseEther("1");

            const balanceBefore = await ethers.provider.getBalance(buyer.address);
            const tx = await marketplace.connect(buyer).purchase(1, purchaseAmount, { value: totalPrice + excessPayment });
            const receipt = await tx.wait();
            const gasUsed = receipt!.gasUsed * receipt!.gasPrice;

            const balanceAfter = await ethers.provider.getBalance(buyer.address);
            const expectedBalance = balanceBefore - totalPrice - gasUsed;

            // Allow small difference due to gas estimation
            expect(balanceAfter).to.be.closeTo(expectedBalance, ethers.parseEther("0.001"));
        });
    });

    describe("Offers", function () {
        describe("createOffer", function () {
            it("should create an offer successfully", async function () {
                const offerAmount = 50;
                const offerPrice = ethers.parseEther("0.008");
                const totalDeposit = offerPrice * BigInt(offerAmount);

                await expect(
                    marketplace.connect(buyer).createOffer(TOKEN_ID, offerAmount, offerPrice, 86400, { value: totalDeposit })
                ).to.emit(marketplace, "OfferCreated")
                    .withArgs(1, buyer.address, TOKEN_ID, offerAmount, offerPrice);

                const offer = await marketplace.getOffer(1);
                expect(offer.buyer).to.equal(buyer.address);
                expect(offer.amount).to.equal(offerAmount);
                expect(offer.depositAmount).to.equal(totalDeposit);
                expect(offer.isActive).to.be.true;
            });

            it("should hold deposit in contract", async function () {
                const totalDeposit = PRICE_PER_UNIT * BigInt(50);
                const balanceBefore = await ethers.provider.getBalance(await marketplace.getAddress());

                await marketplace.connect(buyer).createOffer(TOKEN_ID, 50, PRICE_PER_UNIT, 86400, { value: totalDeposit });

                expect(await ethers.provider.getBalance(await marketplace.getAddress()))
                    .to.equal(balanceBefore + totalDeposit);
            });
        });

        describe("cancelOffer", function () {
            let offerId: number;
            let depositAmount: bigint;

            beforeEach(async function () {
                depositAmount = PRICE_PER_UNIT * BigInt(50);
                const tx = await marketplace.connect(buyer).createOffer(TOKEN_ID, 50, PRICE_PER_UNIT, 86400, { value: depositAmount });
                const receipt = await tx.wait();
                offerId = 1;
            });

            it("should cancel offer and refund deposit", async function () {
                const balanceBefore = await ethers.provider.getBalance(buyer.address);

                const tx = await marketplace.connect(buyer).cancelOffer(offerId);
                const receipt = await tx.wait();
                const gasUsed = receipt!.gasUsed * receipt!.gasPrice;

                const balanceAfter = await ethers.provider.getBalance(buyer.address);
                expect(balanceAfter).to.equal(balanceBefore + depositAmount - gasUsed);

                const offer = await marketplace.getOffer(offerId);
                expect(offer.isActive).to.be.false;
            });

            it("should revert if not offer buyer", async function () {
                await expect(marketplace.connect(unauthorized).cancelOffer(offerId))
                    .to.be.revertedWithCustomError(marketplace, "NotOfferBuyer");
            });
        });

        describe("acceptOffer", function () {
            let offerId: number;
            let depositAmount: bigint;
            const offerAmount = 50;

            beforeEach(async function () {
                depositAmount = PRICE_PER_UNIT * BigInt(offerAmount);
                await marketplace.connect(buyer).createOffer(TOKEN_ID, offerAmount, PRICE_PER_UNIT, 86400, { value: depositAmount });
                offerId = 1;
            });

            it("should accept offer and transfer tokens", async function () {
                await expect(marketplace.connect(seller).acceptOffer(offerId))
                    .to.emit(marketplace, "OfferAccepted");

                expect(await mockCarbonCredit.balanceOf(buyer.address, TOKEN_ID)).to.equal(offerAmount);

                const offer = await marketplace.getOffer(offerId);
                expect(offer.isActive).to.be.false;
            });

            it("should distribute payment correctly", async function () {
                const expectedFee = (depositAmount * BigInt(PLATFORM_FEE_BPS)) / BigInt(10000);
                const expectedSellerProceeds = depositAmount - expectedFee;

                const sellerBalanceBefore = await ethers.provider.getBalance(seller.address);

                const tx = await marketplace.connect(seller).acceptOffer(offerId);
                const receipt = await tx.wait();
                const gasUsed = receipt!.gasUsed * receipt!.gasPrice;

                const sellerBalanceAfter = await ethers.provider.getBalance(seller.address);
                expect(sellerBalanceAfter - sellerBalanceBefore + gasUsed).to.equal(expectedSellerProceeds);
            });

            it("should revert if seller has insufficient balance", async function () {
                // Transfer all tokens away
                await mockCarbonCredit.connect(seller).safeTransferFrom(
                    seller.address,
                    unauthorized.address,
                    TOKEN_ID,
                    1000,
                    "0x"
                );

                await expect(marketplace.connect(seller).acceptOffer(offerId))
                    .to.be.revertedWithCustomError(marketplace, "InsufficientBalance");
            });
        });

        describe("rejectOffer (Fixed - No Griefing)", function () {
            let offerId: number;
            let depositAmount: bigint;
            const offerAmount = 50;

            beforeEach(async function () {
                depositAmount = PRICE_PER_UNIT * BigInt(offerAmount);
                await marketplace.connect(buyer).createOffer(TOKEN_ID, offerAmount, PRICE_PER_UNIT, 86400, { value: depositAmount });
                offerId = 1;
            });

            it("should allow buyer to reject their own offer", async function () {
                await expect(marketplace.connect(buyer).rejectOffer(offerId))
                    .to.emit(marketplace, "OfferRejected");

                const offer = await marketplace.getOffer(offerId);
                expect(offer.isActive).to.be.false;
            });

            it("should allow holder with sufficient balance to reject", async function () {
                await expect(marketplace.connect(seller).rejectOffer(offerId))
                    .to.emit(marketplace, "OfferRejected");
            });

            it("should NOT allow holder with insufficient balance to reject (anti-griefing)", async function () {
                // Give unauthorized just 1 token (less than offer amount of 50)
                await mockCarbonCredit.mint(unauthorized.address, TOKEN_ID, 1, "0x");
                await marketplace.setKycStatus(unauthorized.address, true);

                await expect(marketplace.connect(unauthorized).rejectOffer(offerId))
                    .to.be.revertedWithCustomError(marketplace, "NotAuthorizedToReject");
            });

            it("should NOT allow non-holder to reject", async function () {
                await marketplace.setKycStatus(unauthorized.address, true);

                await expect(marketplace.connect(unauthorized).rejectOffer(offerId))
                    .to.be.revertedWithCustomError(marketplace, "NotAuthorizedToReject");
            });

            it("should refund deposit when rejected", async function () {
                const balanceBefore = await ethers.provider.getBalance(buyer.address);

                await marketplace.connect(seller).rejectOffer(offerId);

                const balanceAfter = await ethers.provider.getBalance(buyer.address);
                expect(balanceAfter - balanceBefore).to.equal(depositAmount);
            });
        });
    });

    describe("Admin Functions", function () {
        it("should set platform fee", async function () {
            const newFee = 300;
            await expect(marketplace.setPlatformFee(newFee))
                .to.emit(marketplace, "PlatformFeeUpdated")
                .withArgs(PLATFORM_FEE_BPS, newFee);

            expect(await marketplace.platformFeeBps()).to.equal(newFee);
        });

        it("should revert if fee too high", async function () {
            await expect(marketplace.setPlatformFee(600))
                .to.be.revertedWithCustomError(marketplace, "FeeTooHigh");
        });

        it("should pause and unpause", async function () {
            await marketplace.pause();

            await expect(
                marketplace.connect(seller).createListing(TOKEN_ID, 100, PRICE_PER_UNIT, 0, 0)
            ).to.be.reverted; // Paused

            await marketplace.unpause();

            await expect(
                marketplace.connect(seller).createListing(TOKEN_ID, 100, PRICE_PER_UNIT, 0, 0)
            ).to.not.be.reverted;
        });

        it("should set fee recipient", async function () {
            await marketplace.setFeeRecipient(buyer.address);
            expect(await marketplace.feeRecipient()).to.equal(buyer.address);
        });

        it("should revert setFeeRecipient with zero address", async function () {
            await expect(marketplace.setFeeRecipient(ethers.ZeroAddress))
                .to.be.revertedWithCustomError(marketplace, "InvalidFeeRecipient");
        });

        it("should set KYC required flag", async function () {
            await marketplace.setKycRequired(false);
            expect(await marketplace.kycRequired()).to.be.false;
        });

        it("should batch update KYC status", async function () {
            const users = [unauthorized.address, buyer.address];
            const statuses = [true, false];

            await marketplace.batchSetKycStatus(users, statuses);

            expect(await marketplace.isKycVerified(unauthorized.address)).to.be.true;
            expect(await marketplace.isKycVerified(buyer.address)).to.be.false;
        });

        it("should revert batch KYC with mismatched arrays", async function () {
            const users = [unauthorized.address];
            const statuses = [true, false]; // Different length

            await expect(marketplace.batchSetKycStatus(users, statuses))
                .to.be.revertedWith("Array length mismatch");
        });

        it("should emergency withdraw when marketplace has balance from offers", async function () {
            // Create an offer to deposit ETH into the marketplace
            const offerAmount = 50;
            const depositAmount = PRICE_PER_UNIT * BigInt(offerAmount);
            await marketplace.connect(buyer).createOffer(TOKEN_ID, offerAmount, PRICE_PER_UNIT, 86400, { value: depositAmount });

            // Marketplace should have the deposit
            expect(await ethers.provider.getBalance(await marketplace.getAddress())).to.equal(depositAmount);

            // Emergency withdraw
            const balanceBefore = await ethers.provider.getBalance(unauthorized.address);
            await marketplace.emergencyWithdraw(unauthorized.address);
            const balanceAfter = await ethers.provider.getBalance(unauthorized.address);

            expect(balanceAfter - balanceBefore).to.equal(depositAmount);
        });

        it("should only allow owner for admin functions", async function () {
            await expect(marketplace.connect(unauthorized).setPlatformFee(100))
                .to.be.reverted;
            await expect(marketplace.connect(unauthorized).setFeeRecipient(unauthorized.address))
                .to.be.reverted;
            await expect(marketplace.connect(unauthorized).setKycRequired(false))
                .to.be.reverted;
            await expect(marketplace.connect(unauthorized).pause())
                .to.be.reverted;
            await expect(marketplace.connect(unauthorized).emergencyWithdraw(unauthorized.address))
                .to.be.reverted;
        });
    });

    describe("Version", function () {
        it("should return version string", async function () {
            const version = await marketplace.version();
            expect(version).to.equal("1.3.0");
        });
    });

    describe("View Functions", function () {
        it("should get seller listings (coverage line 660)", async function () {
            await marketplace.connect(seller).createListing(TOKEN_ID, 50, PRICE_PER_UNIT, 0, 0);
            await marketplace.connect(seller).createListing(TOKEN_ID, 30, PRICE_PER_UNIT, 0, 0);

            const sellerListings = await marketplace.getSellerListings(seller.address);
            expect(sellerListings.length).to.equal(2);
        });

        it("should get buyer offers (coverage line 667)", async function () {
            const depositAmount = PRICE_PER_UNIT * BigInt(50);
            await marketplace.connect(buyer).createOffer(TOKEN_ID, 50, PRICE_PER_UNIT, 86400, { value: depositAmount });

            const buyerOffers = await marketplace.getBuyerOffers(buyer.address);
            expect(buyerOffers.length).to.equal(1);
        });

        it("should get active listings for token (coverage line 633-653)", async function () {
            // Create some listings
            await marketplace.connect(seller).createListing(TOKEN_ID, 50, PRICE_PER_UNIT, 0, 0);
            await marketplace.connect(seller).createListing(TOKEN_ID, 30, PRICE_PER_UNIT, 0, 0);

            // Buy one completely to deactivate it
            await marketplace.connect(buyer).purchase(1, 50, { value: PRICE_PER_UNIT * BigInt(50) });

            // Get active listings for this token
            const activeListings = await marketplace.getActiveListingsForToken(TOKEN_ID);
            // Only second listing should be active
            expect(activeListings.length).to.equal(1);
            expect(activeListings[0]).to.equal(2);
        });

        it("should return empty for seller with no listings", async function () {
            const sellerListings = await marketplace.getSellerListings(unauthorized.address);
            expect(sellerListings.length).to.equal(0);
        });

        it("should return empty for buyer with no offers", async function () {
            const buyerOffers = await marketplace.getBuyerOffers(unauthorized.address);
            expect(buyerOffers.length).to.equal(0);
        });
    });

    describe("KYC Restrictions", function () {
        it("should prevent non-KYC buyer from creating offers when KYC required", async function () {
            // Enable KYC requirement
            await marketplace.setKycRequired(true);
            await marketplace.setKycStatus(unauthorized.address, false);

            await expect(
                marketplace.connect(unauthorized).createOffer(
                    TOKEN_ID,
                    50,
                    PRICE_PER_UNIT,
                    86400,
                    { value: PRICE_PER_UNIT * BigInt(50) }
                )
            ).to.be.revertedWithCustomError(marketplace, "KycNotVerified");
        });

        it("should prevent non-KYC seller from creating listing when KYC required", async function () {
            // Enable KYC requirement
            await marketplace.setKycRequired(true);
            await marketplace.setKycStatus(seller.address, false);

            await expect(
                marketplace.connect(seller).createListing(
                    TOKEN_ID,
                    100,
                    PRICE_PER_UNIT,
                    0,
                    0
                )
            ).to.be.revertedWithCustomError(marketplace, "KycNotVerified");
        });

        it("should allow operations when KYC not required", async function () {
            // KYC requirement is disabled by default
            expect(await marketplace.kycRequired()).to.be.false;

            // Should work even without KYC status
            await marketplace.connect(seller).createListing(TOKEN_ID, 50, PRICE_PER_UNIT, 0, 0);
            const listing = await marketplace.getListing(1);
            expect(listing.isActive).to.be.true;
        });
    });
});

// Mock ERC1155 contract for testing
const MockERC1155Source = `
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";

contract MockERC1155 is ERC1155 {
    constructor() ERC1155("") {}

    function mint(address to, uint256 id, uint256 amount, bytes memory data) external {
        _mint(to, id, amount, data);
    }
}
`;
