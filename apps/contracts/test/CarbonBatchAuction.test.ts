import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { CarbonBatchAuction, TerraQuraAccessControl } from "../typechain-types";

describe("CarbonBatchAuction", function () {
    async function deployFixture() {
        const [admin, seller, bidder1, bidder2, bidder3, other] = await ethers.getSigners();

        const ACFactory = await ethers.getContractFactory("TerraQuraAccessControl");
        const accessControl = (await upgrades.deployProxy(ACFactory, [admin.address], {
            initializer: "initialize",
        })) as unknown as TerraQuraAccessControl;
        await accessControl.waitForDeployment();

        const AuctionFactory = await ethers.getContractFactory("CarbonBatchAuction");
        const auction = (await upgrades.deployProxy(
            AuctionFactory,
            [await accessControl.getAddress()],
            { initializer: "initialize" }
        )) as unknown as CarbonBatchAuction;
        await auction.waitForDeployment();

        return { auction, accessControl, admin, seller, bidder1, bidder2, bidder3, other };
    }

    const ONE_ETHER = ethers.parseEther("1");
    const HALF_ETHER = ethers.parseEther("0.5");

    describe("Dutch Auction - Create", function () {
        it("should create a Dutch auction", async function () {
            const { auction, seller } = await loadFixture(deployFixture);
            await expect(
                auction.connect(seller).createDutchAuction(1, 100, ONE_ETHER, HALF_ETHER, 3600)
            ).to.emit(auction, "AuctionCreated");

            const a = await auction.getAuction(1);
            expect(a.seller).to.equal(seller.address);
            expect(a.creditId).to.equal(1);
            expect(a.amount).to.equal(100);
            expect(a.startPrice).to.equal(ONE_ETHER);
            expect(a.endPrice).to.equal(HALF_ETHER);
            expect(a.auctionType).to.equal(0); // Dutch
            expect(a.status).to.equal(0); // Active
        });

        it("should revert if startPrice <= endPrice", async function () {
            const { auction, seller } = await loadFixture(deployFixture);
            await expect(
                auction.connect(seller).createDutchAuction(1, 100, HALF_ETHER, ONE_ETHER, 3600)
            ).to.be.revertedWithCustomError(auction, "InvalidPrice");
        });

        it("should revert zero amount", async function () {
            const { auction, seller } = await loadFixture(deployFixture);
            await expect(
                auction.connect(seller).createDutchAuction(1, 0, ONE_ETHER, HALF_ETHER, 3600)
            ).to.be.revertedWithCustomError(auction, "InvalidAmount");
        });

        it("should revert zero duration", async function () {
            const { auction, seller } = await loadFixture(deployFixture);
            await expect(
                auction.connect(seller).createDutchAuction(1, 100, ONE_ETHER, HALF_ETHER, 0)
            ).to.be.revertedWithCustomError(auction, "InvalidDuration");
        });
    });

    describe("Dutch Auction - Price", function () {
        async function dutchFixture() {
            const base = await deployFixture();
            // 1 hour auction: 1 ETH -> 0.5 ETH
            await base.auction.connect(base.seller).createDutchAuction(1, 100, ONE_ETHER, HALF_ETHER, 3600);
            return base;
        }

        it("should start at startPrice", async function () {
            const { auction } = await loadFixture(dutchFixture);
            const price = await auction.getDutchPrice(1);
            expect(price).to.equal(ONE_ETHER);
        });

        it("should decrease linearly", async function () {
            const { auction } = await loadFixture(dutchFixture);
            await time.increase(1800); // 50% through
            const price = await auction.getDutchPrice(1);
            expect(price).to.be.closeTo(ethers.parseEther("0.75"), ethers.parseEther("0.01"));
        });

        it("should reach endPrice at end", async function () {
            const { auction } = await loadFixture(dutchFixture);
            await time.increase(3601);
            const price = await auction.getDutchPrice(1);
            expect(price).to.equal(HALF_ETHER);
        });
    });

    describe("Dutch Auction - Bidding", function () {
        async function dutchFixture() {
            const base = await deployFixture();
            await base.auction.connect(base.seller).createDutchAuction(1, 10, ONE_ETHER, HALF_ETHER, 3600);
            return base;
        }

        it("should accept bid at current price", async function () {
            const { auction, bidder1 } = await loadFixture(dutchFixture);
            const price = await auction.getDutchPrice(1);
            const cost = price * 5n;

            await expect(
                auction.connect(bidder1).bidDutch(1, 5, { value: cost })
            ).to.emit(auction, "BidPlaced")
                .withArgs(1, bidder1.address, 5);
        });

        it("should pay seller on Dutch bid", async function () {
            const { auction, seller, bidder1 } = await loadFixture(dutchFixture);
            const sellerBalBefore = await ethers.provider.getBalance(seller.address);

            // Overpay to ensure enough, seller gets the actual price at execution
            const overpay = ONE_ETHER * 5n;
            await auction.connect(bidder1).bidDutch(1, 5, { value: overpay });

            const sellerBalAfter = await ethers.provider.getBalance(seller.address);
            const sellerGain = sellerBalAfter - sellerBalBefore;

            // Seller should receive approximately 5 * current_price (close to startPrice)
            expect(sellerGain).to.be.gt(0);
            expect(sellerGain).to.be.closeTo(ONE_ETHER * 5n, ethers.parseEther("0.05"));
        });

        it("should refund excess payment", async function () {
            const { auction, bidder1 } = await loadFixture(dutchFixture);
            const price = await auction.getDutchPrice(1);
            const cost = price * 2n;
            const overpay = cost + ONE_ETHER;

            const balBefore = await ethers.provider.getBalance(bidder1.address);
            const tx = await auction.connect(bidder1).bidDutch(1, 2, { value: overpay });
            const receipt = await tx.wait();
            const gasCost = receipt!.gasUsed * receipt!.gasPrice;
            const balAfter = await ethers.provider.getBalance(bidder1.address);

            expect(balBefore - balAfter - gasCost).to.be.closeTo(cost, ethers.parseEther("0.001"));
        });

        it("should revert insufficient payment", async function () {
            const { auction, bidder1 } = await loadFixture(dutchFixture);
            await expect(
                auction.connect(bidder1).bidDutch(1, 5, { value: 1 })
            ).to.be.revertedWithCustomError(auction, "InsufficientPayment");
        });

        it("should revert if amount exceeds available", async function () {
            const { auction, bidder1 } = await loadFixture(dutchFixture);
            await expect(
                auction.connect(bidder1).bidDutch(1, 11, { value: ONE_ETHER * 11n })
            ).to.be.revertedWithCustomError(auction, "AmountExceedsAvailable");
        });

        it("should auto-finalize when fully sold", async function () {
            const { auction, bidder1 } = await loadFixture(dutchFixture);
            const price = await auction.getDutchPrice(1);
            await auction.connect(bidder1).bidDutch(1, 10, { value: price * 10n });

            const a = await auction.getAuction(1);
            expect(a.status).to.equal(1); // Finalized
            expect(a.amountSold).to.equal(10);
        });

        it("should revert bid after auction ended", async function () {
            const { auction, bidder1 } = await loadFixture(dutchFixture);
            await time.increase(3601);
            await expect(
                auction.connect(bidder1).bidDutch(1, 5, { value: ONE_ETHER * 5n })
            ).to.be.revertedWithCustomError(auction, "AuctionEnded");
        });
    });

    describe("Sealed Bid Auction - Create", function () {
        it("should create a sealed bid auction", async function () {
            const { auction, seller } = await loadFixture(deployFixture);
            await expect(
                auction.connect(seller).createSealedBidAuction(1, 100, HALF_ETHER, 3600, 1800)
            ).to.emit(auction, "AuctionCreated");

            const a = await auction.getAuction(1);
            expect(a.auctionType).to.equal(1); // SealedBid
            expect(a.reservePrice).to.equal(HALF_ETHER);
        });

        it("should revert zero amount", async function () {
            const { auction, seller } = await loadFixture(deployFixture);
            await expect(
                auction.connect(seller).createSealedBidAuction(1, 0, HALF_ETHER, 3600, 1800)
            ).to.be.revertedWithCustomError(auction, "InvalidAmount");
        });

        it("should revert zero bidding duration", async function () {
            const { auction, seller } = await loadFixture(deployFixture);
            await expect(
                auction.connect(seller).createSealedBidAuction(1, 100, HALF_ETHER, 0, 1800)
            ).to.be.revertedWithCustomError(auction, "InvalidDuration");
        });
    });

    describe("Sealed Bid Auction - Submit and Reveal", function () {
        async function sealedFixture() {
            const base = await deployFixture();
            // 1 hour bidding, 30 min reveal
            await base.auction.connect(base.seller).createSealedBidAuction(1, 100, HALF_ETHER, 3600, 1800);
            return base;
        }

        it("should submit a sealed bid", async function () {
            const { auction, bidder1 } = await loadFixture(sealedFixture);
            const salt = ethers.randomBytes(32);
            const commitment = ethers.keccak256(ethers.solidityPacked(["uint256", "bytes32"], [ONE_ETHER, salt]));

            await expect(
                auction.connect(bidder1).submitSealedBid(1, commitment, { value: ONE_ETHER })
            ).to.emit(auction, "BidPlaced");
        });

        it("should revert double bid", async function () {
            const { auction, bidder1 } = await loadFixture(sealedFixture);
            const salt = ethers.randomBytes(32);
            const commitment = ethers.keccak256(ethers.solidityPacked(["uint256", "bytes32"], [ONE_ETHER, salt]));

            await auction.connect(bidder1).submitSealedBid(1, commitment, { value: ONE_ETHER });
            await expect(
                auction.connect(bidder1).submitSealedBid(1, commitment, { value: ONE_ETHER })
            ).to.be.revertedWithCustomError(auction, "AlreadyBid");
        });

        it("should revert bid after bidding phase", async function () {
            const { auction, bidder1 } = await loadFixture(sealedFixture);
            await time.increase(3601);

            const salt = ethers.randomBytes(32);
            const commitment = ethers.keccak256(ethers.solidityPacked(["uint256", "bytes32"], [ONE_ETHER, salt]));
            await expect(
                auction.connect(bidder1).submitSealedBid(1, commitment, { value: ONE_ETHER })
            ).to.be.revertedWithCustomError(auction, "NotInBiddingPhase");
        });

        it("should reveal bid during reveal phase", async function () {
            const { auction, bidder1 } = await loadFixture(sealedFixture);
            const salt = ethers.hexlify(ethers.randomBytes(32));
            const bidAmount = ONE_ETHER;
            const commitment = ethers.keccak256(ethers.solidityPacked(["uint256", "bytes32"], [bidAmount, salt]));

            await auction.connect(bidder1).submitSealedBid(1, commitment, { value: bidAmount });

            // Advance to reveal phase
            await time.increase(3601);

            await expect(
                auction.connect(bidder1).revealBid(1, bidAmount, salt)
            ).to.emit(auction, "BidRevealed")
                .withArgs(1, bidder1.address, bidAmount);
        });

        it("should revert reveal before bidding ends", async function () {
            const { auction, bidder1 } = await loadFixture(sealedFixture);
            const salt = ethers.hexlify(ethers.randomBytes(32));
            const commitment = ethers.keccak256(ethers.solidityPacked(["uint256", "bytes32"], [ONE_ETHER, salt]));
            await auction.connect(bidder1).submitSealedBid(1, commitment, { value: ONE_ETHER });

            await expect(
                auction.connect(bidder1).revealBid(1, ONE_ETHER, salt)
            ).to.be.revertedWithCustomError(auction, "NotInRevealPhase");
        });

        it("should revert reveal with wrong commitment", async function () {
            const { auction, bidder1 } = await loadFixture(sealedFixture);
            const salt = ethers.hexlify(ethers.randomBytes(32));
            const commitment = ethers.keccak256(ethers.solidityPacked(["uint256", "bytes32"], [ONE_ETHER, salt]));
            await auction.connect(bidder1).submitSealedBid(1, commitment, { value: ONE_ETHER });

            await time.increase(3601);

            await expect(
                auction.connect(bidder1).revealBid(1, HALF_ETHER, salt) // wrong amount
            ).to.be.revertedWithCustomError(auction, "CommitmentMismatch");
        });
    });

    describe("Sealed Bid Auction - Finalize", function () {
        it("should finalize to highest bidder and refund others", async function () {
            const { auction, seller, bidder1, bidder2 } = await loadFixture(deployFixture);

            await auction.connect(seller).createSealedBidAuction(1, 100, HALF_ETHER, 3600, 1800);

            // Bidder 1: 1 ETH
            const salt1 = ethers.hexlify(ethers.randomBytes(32));
            const commitment1 = ethers.keccak256(ethers.solidityPacked(["uint256", "bytes32"], [ONE_ETHER, salt1]));
            await auction.connect(bidder1).submitSealedBid(1, commitment1, { value: ONE_ETHER });

            // Bidder 2: 2 ETH
            const twoEth = ethers.parseEther("2");
            const salt2 = ethers.hexlify(ethers.randomBytes(32));
            const commitment2 = ethers.keccak256(ethers.solidityPacked(["uint256", "bytes32"], [twoEth, salt2]));
            await auction.connect(bidder2).submitSealedBid(1, commitment2, { value: twoEth });

            // Reveal phase
            await time.increase(3601);
            await auction.connect(bidder1).revealBid(1, ONE_ETHER, salt1);
            await auction.connect(bidder2).revealBid(1, twoEth, salt2);

            // Finalize
            await time.increase(1801);

            const sellerBal = await ethers.provider.getBalance(seller.address);
            const bidder1Bal = await ethers.provider.getBalance(bidder1.address);

            await expect(auction.connect(seller).finalizeAuction(1))
                .to.emit(auction, "AuctionFinalized")
                .withArgs(1, bidder2.address, twoEth);

            // Seller received 2 ETH
            const sellerBalAfter = await ethers.provider.getBalance(seller.address);
            expect(sellerBalAfter - sellerBal).to.be.closeTo(twoEth, ethers.parseEther("0.01"));

            // Bidder1 got refund
            const bidder1BalAfter = await ethers.provider.getBalance(bidder1.address);
            expect(bidder1BalAfter - bidder1Bal).to.equal(ONE_ETHER);
        });

        it("should cancel if no valid bids above reserve", async function () {
            const { auction, seller, bidder1 } = await loadFixture(deployFixture);
            const reserve = ethers.parseEther("2");
            await auction.connect(seller).createSealedBidAuction(1, 100, reserve, 3600, 1800);

            // Bid below reserve
            const salt = ethers.hexlify(ethers.randomBytes(32));
            const commitment = ethers.keccak256(ethers.solidityPacked(["uint256", "bytes32"], [ONE_ETHER, salt]));
            await auction.connect(bidder1).submitSealedBid(1, commitment, { value: ONE_ETHER });

            await time.increase(3601);
            await auction.connect(bidder1).revealBid(1, ONE_ETHER, salt);

            await time.increase(1801);

            const bidder1Bal = await ethers.provider.getBalance(bidder1.address);
            await expect(auction.connect(seller).finalizeAuction(1))
                .to.emit(auction, "AuctionCancelled");

            // Bidder1 gets refund
            const bidder1BalAfter = await ethers.provider.getBalance(bidder1.address);
            expect(bidder1BalAfter - bidder1Bal).to.equal(ONE_ETHER);

            const a = await auction.getAuction(1);
            expect(a.status).to.equal(2); // Cancelled
        });

        it("should revert finalize before reveal ends", async function () {
            const { auction, seller } = await loadFixture(deployFixture);
            await auction.connect(seller).createSealedBidAuction(1, 100, HALF_ETHER, 3600, 1800);

            await expect(
                auction.connect(seller).finalizeAuction(1)
            ).to.be.revertedWithCustomError(auction, "AuctionNotEnded");
        });

        it("should cancel with no bidders", async function () {
            const { auction, seller } = await loadFixture(deployFixture);
            await auction.connect(seller).createSealedBidAuction(1, 100, HALF_ETHER, 3600, 1800);

            await time.increase(5401); // past reveal

            await expect(auction.connect(seller).finalizeAuction(1))
                .to.emit(auction, "AuctionCancelled");
        });
    });

    describe("Cancel Auction", function () {
        it("should allow seller to cancel Dutch auction", async function () {
            const { auction, seller } = await loadFixture(deployFixture);
            await auction.connect(seller).createDutchAuction(1, 100, ONE_ETHER, HALF_ETHER, 3600);

            await expect(auction.connect(seller).cancelAuction(1))
                .to.emit(auction, "AuctionCancelled")
                .withArgs(1);
        });

        it("should allow admin to cancel auction", async function () {
            const { auction, seller, admin } = await loadFixture(deployFixture);
            await auction.connect(seller).createDutchAuction(1, 100, ONE_ETHER, HALF_ETHER, 3600);

            await expect(auction.connect(admin).cancelAuction(1))
                .to.emit(auction, "AuctionCancelled");
        });

        it("should revert non-seller non-admin cancel", async function () {
            const { auction, seller, other } = await loadFixture(deployFixture);
            await auction.connect(seller).createDutchAuction(1, 100, ONE_ETHER, HALF_ETHER, 3600);

            await expect(
                auction.connect(other).cancelAuction(1)
            ).to.be.revertedWithCustomError(auction, "OnlySeller");
        });

        it("should refund sealed bid deposits on cancel", async function () {
            const { auction, seller, bidder1 } = await loadFixture(deployFixture);
            await auction.connect(seller).createSealedBidAuction(1, 100, HALF_ETHER, 3600, 1800);

            const salt = ethers.hexlify(ethers.randomBytes(32));
            const commitment = ethers.keccak256(ethers.solidityPacked(["uint256", "bytes32"], [ONE_ETHER, salt]));
            await auction.connect(bidder1).submitSealedBid(1, commitment, { value: ONE_ETHER });

            const balBefore = await ethers.provider.getBalance(bidder1.address);
            await auction.connect(seller).cancelAuction(1);
            const balAfter = await ethers.provider.getBalance(bidder1.address);

            expect(balAfter - balBefore).to.equal(ONE_ETHER);
        });

        it("should revert cancel of finalized auction", async function () {
            const { auction, seller, bidder1 } = await loadFixture(deployFixture);
            await auction.connect(seller).createDutchAuction(1, 10, ONE_ETHER, HALF_ETHER, 3600);

            const price = await auction.getDutchPrice(1);
            await auction.connect(bidder1).bidDutch(1, 10, { value: price * 10n });

            await expect(
                auction.connect(seller).cancelAuction(1)
            ).to.be.revertedWithCustomError(auction, "AuctionAlreadyFinalized");
        });
    });
});
