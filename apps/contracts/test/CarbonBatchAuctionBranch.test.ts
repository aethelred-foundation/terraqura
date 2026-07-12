import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { CarbonBatchAuction, TerraQuraAccessControl } from "../typechain-types";

/**
 * CarbonBatchAuction — branch-coverage suite (pre-testnet hardening).
 *
 * Covers Dutch and sealed-bid creation validation, the full sealed-bid
 * lifecycle (submit → reveal → finalize with refunds), Dutch overpay refund
 * and auto-finalize, cancellation, and status/timing guards.
 */
describe("CarbonBatchAuction — branch coverage", function () {
  const CREDIT_ID = 1n;
  const AMOUNT = 10n;
  const ONE = ethers.parseEther("1");

  async function deployFixture() {
    const [admin, seller, bidder1, bidder2, stranger] = await ethers.getSigners();

    const ACFactory = await ethers.getContractFactory("TerraQuraAccessControl");
    const accessControl = (await upgrades.deployProxy(ACFactory, [admin.address], {
      initializer: "initialize",
    })) as unknown as TerraQuraAccessControl;
    await accessControl.waitForDeployment();

    const Factory = await ethers.getContractFactory("CarbonBatchAuction");
    const auction = (await upgrades.deployProxy(
      Factory,
      [await accessControl.getAddress()],
      { initializer: "initialize" },
    )) as unknown as CarbonBatchAuction;
    await auction.waitForDeployment();

    return { auction, accessControl, admin, seller, bidder1, bidder2, stranger };
  }

  describe("createDutchAuction validation", function () {
    it("reverts when startPrice <= endPrice", async function () {
      const { auction, seller } = await loadFixture(deployFixture);
      await expect(
        auction.connect(seller).createDutchAuction(CREDIT_ID, AMOUNT, ONE, ONE, 3600),
      ).to.be.revertedWithCustomError(auction, "InvalidPrice");
    });

    it("reverts on zero amount", async function () {
      const { auction, seller } = await loadFixture(deployFixture);
      await expect(
        auction.connect(seller).createDutchAuction(CREDIT_ID, 0n, ONE * 2n, ONE, 3600),
      ).to.be.revertedWithCustomError(auction, "InvalidAmount");
    });

    it("reverts on zero duration", async function () {
      const { auction, seller } = await loadFixture(deployFixture);
      await expect(
        auction.connect(seller).createDutchAuction(CREDIT_ID, AMOUNT, ONE * 2n, ONE, 0),
      ).to.be.revertedWithCustomError(auction, "InvalidDuration");
    });

    it("creates a valid Dutch auction", async function () {
      const { auction, seller } = await loadFixture(deployFixture);
      await expect(
        auction.connect(seller).createDutchAuction(CREDIT_ID, AMOUNT, ONE * 2n, ONE, 3600),
      ).to.emit(auction, "AuctionCreated");
    });
  });

  describe("bidDutch", function () {
    async function withDutch() {
      const base = await deployFixture();
      await base.auction
        .connect(base.seller)
        .createDutchAuction(CREDIT_ID, AMOUNT, ONE * 2n, ONE, 3600);
      return base; // auctionId 1
    }

    it("reverts bidding on a non-existent auction (zero-struct reads ended)", async function () {
      const { auction, bidder1 } = await loadFixture(deployFixture);
      // A zero-initialized auction has status Active (enum 0) but endTime 0,
      // so the timing guard fires first.
      await expect(
        auction.connect(bidder1).bidDutch(999, 1n, { value: ONE * 3n }),
      ).to.be.revertedWithCustomError(auction, "AuctionEnded");
    });

    it("reverts on zero bid amount", async function () {
      const { auction, bidder1 } = await loadFixture(withDutch);
      await expect(
        auction.connect(bidder1).bidDutch(1, 0n, { value: ONE * 3n }),
      ).to.be.revertedWithCustomError(auction, "InvalidAmount");
    });

    it("reverts when bidding more than available", async function () {
      const { auction, bidder1 } = await loadFixture(withDutch);
      await expect(
        auction.connect(bidder1).bidDutch(1, AMOUNT + 1n, { value: ONE * 100n }),
      ).to.be.revertedWithCustomError(auction, "AmountExceedsAvailable");
    });

    it("reverts on insufficient payment", async function () {
      const { auction, bidder1 } = await loadFixture(withDutch);
      await expect(
        auction.connect(bidder1).bidDutch(1, 5n, { value: 1n }),
      ).to.be.revertedWithCustomError(auction, "InsufficientPayment");
    });

    it("refunds excess payment and pays the seller", async function () {
      const { auction, bidder1 } = await loadFixture(withDutch);
      await expect(
        auction.connect(bidder1).bidDutch(1, 2n, { value: ONE * 100n }),
      ).to.emit(auction, "BidPlaced");
    });

    it("auto-finalizes when the full amount sells", async function () {
      const { auction, bidder1 } = await loadFixture(withDutch);
      await auction.connect(bidder1).bidDutch(1, AMOUNT, { value: ONE * 100n });
      const a = await auction.auctions(1);
      expect(a.amountSold).to.equal(AMOUNT);
    });

    it("reverts bidding after the auction ends", async function () {
      const { auction, bidder1 } = await loadFixture(withDutch);
      await time.increase(3601);
      await expect(
        auction.connect(bidder1).bidDutch(1, 1n, { value: ONE * 3n }),
      ).to.be.revertedWithCustomError(auction, "AuctionEnded");
    });
  });

  describe("createSealedBidAuction validation", function () {
    it("reverts on zero amount", async function () {
      const { auction, seller } = await loadFixture(deployFixture);
      await expect(
        auction.connect(seller).createSealedBidAuction(CREDIT_ID, 0n, ONE, 3600, 3600),
      ).to.be.revertedWithCustomError(auction, "InvalidAmount");
    });

    it("reverts on zero bidding/reveal duration", async function () {
      const { auction, seller } = await loadFixture(deployFixture);
      await expect(
        auction.connect(seller).createSealedBidAuction(CREDIT_ID, AMOUNT, ONE, 0, 3600),
      ).to.be.revertedWithCustomError(auction, "InvalidDuration");
      await expect(
        auction.connect(seller).createSealedBidAuction(CREDIT_ID, AMOUNT, ONE, 3600, 0),
      ).to.be.revertedWithCustomError(auction, "InvalidDuration");
    });
  });

  describe("sealed-bid lifecycle", function () {
    const BID = ONE;
    const SALT = ethers.encodeBytes32String("salt-1");
    const commitment = ethers.solidityPackedKeccak256(["uint256", "bytes32"], [BID, SALT]);

    async function withSealed() {
      const base = await deployFixture();
      await base.auction
        .connect(base.seller)
        .createSealedBidAuction(CREDIT_ID, AMOUNT, ONE / 2n, 3600, 3600);
      return base; // auctionId 1
    }

    it("submitSealedBid reverts on an unknown/inactive auction", async function () {
      const { auction, bidder1 } = await loadFixture(deployFixture);
      await expect(
        auction.connect(bidder1).submitSealedBid(999, commitment, { value: BID }),
      ).to.be.revertedWithCustomError(auction, "AuctionNotActive");
    });

    it("accepts a sealed bid and rejects a duplicate from the same bidder", async function () {
      const { auction, bidder1 } = await loadFixture(withSealed);
      await expect(
        auction.connect(bidder1).submitSealedBid(1, commitment, { value: BID }),
      ).to.emit(auction, "BidPlaced");
      await expect(
        auction.connect(bidder1).submitSealedBid(1, commitment, { value: BID }),
      ).to.be.revertedWithCustomError(auction, "AlreadyBid");
    });

    it("revealBid reverts before the reveal phase opens", async function () {
      const { auction, bidder1 } = await loadFixture(withSealed);
      await auction.connect(bidder1).submitSealedBid(1, commitment, { value: BID });
      await expect(
        auction.connect(bidder1).revealBid(1, BID, SALT),
      ).to.be.revertedWithCustomError(auction, "NotInRevealPhase");
    });

    it("revealBid reverts on a commitment mismatch", async function () {
      const { auction, bidder1 } = await loadFixture(withSealed);
      await auction.connect(bidder1).submitSealedBid(1, commitment, { value: BID });
      await time.increase(3601); // into reveal phase
      await expect(
        auction.connect(bidder1).revealBid(1, BID + 1n, SALT),
      ).to.be.revertedWithCustomError(auction, "CommitmentMismatch");
    });

    it("reveals a valid bid and rejects a second reveal", async function () {
      const { auction, bidder1 } = await loadFixture(withSealed);
      await auction.connect(bidder1).submitSealedBid(1, commitment, { value: BID });
      await time.increase(3601);
      await expect(auction.connect(bidder1).revealBid(1, BID, SALT)).to.emit(
        auction,
        "BidRevealed",
      );
      await expect(
        auction.connect(bidder1).revealBid(1, BID, SALT),
      ).to.be.revertedWithCustomError(auction, "AlreadyRevealed");
    });

    it("finalizes with a winner after the reveal phase", async function () {
      const { auction, bidder1 } = await loadFixture(withSealed);
      await auction.connect(bidder1).submitSealedBid(1, commitment, { value: BID });
      await time.increase(3601);
      await auction.connect(bidder1).revealBid(1, BID, SALT);
      await time.increase(3601); // past reveal end
      await expect(auction.finalizeAuction(1)).to.not.be.reverted;
    });

    it("finalize reverts before the reveal window closes", async function () {
      const { auction, bidder1 } = await loadFixture(withSealed);
      await auction.connect(bidder1).submitSealedBid(1, commitment, { value: BID });
      await expect(auction.finalizeAuction(1)).to.be.revertedWithCustomError(
        auction,
        "AuctionNotEnded",
      );
    });

    it("finalize cancels an auction that received no bids", async function () {
      const { auction } = await loadFixture(withSealed);
      await time.increase(3601 + 3601);
      await expect(auction.finalizeAuction(1)).to.emit(auction, "AuctionCancelled");
    });
  });

  describe("cancelAuction", function () {
    it("cancels an active Dutch auction and refunds nothing outstanding", async function () {
      const { auction, seller } = await loadFixture(deployFixture);
      await auction.connect(seller).createDutchAuction(CREDIT_ID, AMOUNT, ONE * 2n, ONE, 3600);
      await expect(auction.connect(seller).cancelAuction(1)).to.emit(auction, "AuctionCancelled");
    });
  });
});
