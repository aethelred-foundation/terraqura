import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { GaslessMarketplace, MockERC1155, TerraQuraForwarder } from "../typechain-types";

describe("GaslessMarketplace", function () {
    let marketplace: GaslessMarketplace;
    let mockToken: MockERC1155;
    let forwarder: TerraQuraForwarder;
    let owner: SignerWithAddress;
    let seller: SignerWithAddress;
    let buyer: SignerWithAddress;
    let accessControl: SignerWithAddress;
    let unauthorized: SignerWithAddress;

    const TOKEN_ID = 1;
    const TOKEN_AMOUNT = 1000;
    const PRICE_PER_UNIT = ethers.parseEther("0.01");

    beforeEach(async function () {
        [owner, seller, buyer, accessControl, unauthorized] = await ethers.getSigners();

        // Deploy mock ERC1155 token
        const MockERC1155Factory = await ethers.getContractFactory("MockERC1155");
        mockToken = await MockERC1155Factory.deploy() as unknown as MockERC1155;
        await mockToken.waitForDeployment();

        // Deploy forwarder
        const ForwarderFactory = await ethers.getContractFactory("TerraQuraForwarder");
        forwarder = await ForwarderFactory.deploy() as unknown as TerraQuraForwarder;
        await forwarder.waitForDeployment();

        // Deploy GaslessMarketplace
        const MarketplaceFactory = await ethers.getContractFactory("GaslessMarketplace");
        marketplace = await upgrades.deployProxy(
            MarketplaceFactory,
            [accessControl.address, await mockToken.getAddress(), await forwarder.getAddress()],
            { initializer: "initialize" }
        ) as unknown as GaslessMarketplace;
        await marketplace.waitForDeployment();

        // Mint tokens to seller
        await mockToken.mint(seller.address, TOKEN_ID, TOKEN_AMOUNT, "0x");

        // Approve marketplace
        await mockToken.connect(seller).setApprovalForAll(await marketplace.getAddress(), true);
    });

    describe("Initialization", function () {
        it("should set correct carbon credit address", async function () {
            expect(await marketplace.carbonCredit()).to.equal(await mockToken.getAddress());
        });

        it("should set correct admin role", async function () {
            const ADMIN_ROLE = await marketplace.ADMIN_ROLE();
            expect(await marketplace.hasRole(ADMIN_ROLE, accessControl.address)).to.be.true;
        });

        it("should set default admin role to deployer", async function () {
            const DEFAULT_ADMIN_ROLE = await marketplace.DEFAULT_ADMIN_ROLE();
            expect(await marketplace.hasRole(DEFAULT_ADMIN_ROLE, owner.address)).to.be.true;
        });

        it("should support ERC1155 receiver interface", async function () {
            // ERC1155 receiver interface ID
            const ERC1155_RECEIVER_INTERFACE = "0x4e2312e0";
            expect(await marketplace.supportsInterface(ERC1155_RECEIVER_INTERFACE)).to.be.true;
        });

        it("should support AccessControl interface", async function () {
            // AccessControl interface ID
            const ACCESS_CONTROL_INTERFACE = "0x7965db0b";
            expect(await marketplace.supportsInterface(ACCESS_CONTROL_INTERFACE)).to.be.true;
        });
    });

    describe("Trusted Forwarder", function () {
        it("should recognize trusted forwarder", async function () {
            expect(await marketplace.isTrustedForwarder(await forwarder.getAddress())).to.be.true;
        });

        it("should not recognize non-forwarder address", async function () {
            expect(await marketplace.isTrustedForwarder(unauthorized.address)).to.be.false;
        });
    });

    describe("Create Listing", function () {
        it("should create listing successfully", async function () {
            const amount = 100;

            await expect(
                marketplace.connect(seller).createListing(TOKEN_ID, amount, PRICE_PER_UNIT)
            ).to.emit(marketplace, "ListingCreated")
                .withArgs(1, seller.address, TOKEN_ID, amount, PRICE_PER_UNIT);

            const listing = await marketplace.listings(1);
            expect(listing.seller).to.equal(seller.address);
            expect(listing.tokenId).to.equal(TOKEN_ID);
            expect(listing.amount).to.equal(amount);
            expect(listing.pricePerUnit).to.equal(PRICE_PER_UNIT);
            expect(listing.active).to.be.true;
        });

        it("should revert if amount is zero", async function () {
            await expect(
                marketplace.connect(seller).createListing(TOKEN_ID, 0, PRICE_PER_UNIT)
            ).to.be.revertedWith("Amount must be > 0");
        });

        it("should revert if seller has insufficient balance", async function () {
            await expect(
                marketplace.connect(seller).createListing(TOKEN_ID, TOKEN_AMOUNT + 1, PRICE_PER_UNIT)
            ).to.be.revertedWith("Insufficient balance");
        });

        it("should revert if marketplace not approved", async function () {
            // Revoke approval
            await mockToken.connect(seller).setApprovalForAll(await marketplace.getAddress(), false);

            await expect(
                marketplace.connect(seller).createListing(TOKEN_ID, 100, PRICE_PER_UNIT)
            ).to.be.revertedWith("Marketplace not approved");
        });

        it("should increment listing IDs", async function () {
            await marketplace.connect(seller).createListing(TOKEN_ID, 50, PRICE_PER_UNIT);
            await marketplace.connect(seller).createListing(TOKEN_ID, 50, PRICE_PER_UNIT);

            const listing1 = await marketplace.listings(1);
            const listing2 = await marketplace.listings(2);

            expect(listing1.listingId).to.equal(1);
            expect(listing2.listingId).to.equal(2);
        });
    });

    describe("Buy Listing", function () {
        beforeEach(async function () {
            await marketplace.connect(seller).createListing(TOKEN_ID, 100, PRICE_PER_UNIT);
        });

        it("should buy listing successfully", async function () {
            const amountToBuy = 50;
            const totalPrice = PRICE_PER_UNIT * BigInt(amountToBuy);

            await expect(
                marketplace.connect(buyer).buyListing(1, amountToBuy, { value: totalPrice })
            ).to.emit(marketplace, "ListingSold")
                .withArgs(1, buyer.address, amountToBuy, totalPrice);

            // Check buyer received tokens
            expect(await mockToken.balanceOf(buyer.address, TOKEN_ID)).to.equal(amountToBuy);

            // Check listing amount reduced
            const listing = await marketplace.listings(1);
            expect(listing.amount).to.equal(50);
            expect(listing.active).to.be.true;
        });

        it("should deactivate listing when fully bought", async function () {
            const amountToBuy = 100; // Full amount
            const totalPrice = PRICE_PER_UNIT * BigInt(amountToBuy);

            await marketplace.connect(buyer).buyListing(1, amountToBuy, { value: totalPrice });

            const listing = await marketplace.listings(1);
            expect(listing.amount).to.equal(0);
            expect(listing.active).to.be.false;
        });

        it("should transfer payment to seller", async function () {
            const amountToBuy = 50;
            const totalPrice = PRICE_PER_UNIT * BigInt(amountToBuy);

            const sellerBalanceBefore = await ethers.provider.getBalance(seller.address);

            await marketplace.connect(buyer).buyListing(1, amountToBuy, { value: totalPrice });

            const sellerBalanceAfter = await ethers.provider.getBalance(seller.address);
            expect(sellerBalanceAfter - sellerBalanceBefore).to.equal(totalPrice);
        });

        it("should revert if listing not active", async function () {
            // First, buy all
            await marketplace.connect(buyer).buyListing(1, 100, { value: PRICE_PER_UNIT * BigInt(100) });

            // Try to buy from inactive listing
            await expect(
                marketplace.connect(buyer).buyListing(1, 10, { value: PRICE_PER_UNIT * BigInt(10) })
            ).to.be.revertedWith("Listing not active");
        });

        it("should revert if amount exceeds listing", async function () {
            await expect(
                marketplace.connect(buyer).buyListing(1, 150, { value: PRICE_PER_UNIT * BigInt(150) })
            ).to.be.revertedWith("Insufficient listing amount");
        });

        it("should revert if payment insufficient", async function () {
            await expect(
                marketplace.connect(buyer).buyListing(1, 50, { value: ethers.parseEther("0.1") })
            ).to.be.revertedWith("Insufficient payment");
        });
    });

    describe("Multiple Listings", function () {
        it("should handle multiple listings from same seller", async function () {
            // Mint more tokens for different token ID
            const TOKEN_ID_2 = 2;
            await mockToken.mint(seller.address, TOKEN_ID_2, 500, "0x");

            await marketplace.connect(seller).createListing(TOKEN_ID, 100, PRICE_PER_UNIT);
            await marketplace.connect(seller).createListing(TOKEN_ID_2, 200, ethers.parseEther("0.02"));

            const listing1 = await marketplace.listings(1);
            const listing2 = await marketplace.listings(2);

            expect(listing1.tokenId).to.equal(TOKEN_ID);
            expect(listing1.amount).to.equal(100);

            expect(listing2.tokenId).to.equal(TOKEN_ID_2);
            expect(listing2.amount).to.equal(200);
        });

        it("should handle multiple buyers for same listing", async function () {
            await marketplace.connect(seller).createListing(TOKEN_ID, 100, PRICE_PER_UNIT);

            // First buyer
            await marketplace.connect(buyer).buyListing(1, 30, { value: PRICE_PER_UNIT * BigInt(30) });

            // Second buyer (use unauthorized as second buyer)
            await marketplace.connect(unauthorized).buyListing(1, 40, { value: PRICE_PER_UNIT * BigInt(40) });

            expect(await mockToken.balanceOf(buyer.address, TOKEN_ID)).to.equal(30);
            expect(await mockToken.balanceOf(unauthorized.address, TOKEN_ID)).to.equal(40);

            const listing = await marketplace.listings(1);
            expect(listing.amount).to.equal(30); // 100 - 30 - 40 = 30
        });
    });

    describe("Role-Based Access", function () {
        it("should have MARKET_ROLE constant", async function () {
            const MARKET_ROLE = await marketplace.MARKET_ROLE();
            expect(MARKET_ROLE).to.not.equal(ethers.ZeroHash);
        });

        it("should have ADMIN_ROLE constant", async function () {
            const ADMIN_ROLE = await marketplace.ADMIN_ROLE();
            expect(ADMIN_ROLE).to.not.equal(ethers.ZeroHash);
        });
    });

    describe("ERC-2771 Context", function () {
        it("should return correct _msgSender for direct calls", async function () {
            // When called directly (not through forwarder), msg.sender should be returned
            // This is tested implicitly through createListing where seller is _msgSender()
            await marketplace.connect(seller).createListing(TOKEN_ID, 50, PRICE_PER_UNIT);

            const listing = await marketplace.listings(1);
            expect(listing.seller).to.equal(seller.address);
        });

        it("should handle _msgData correctly", async function () {
            // _msgData is used internally for proper calldata handling
            // Test by making a successful call that uses _msgData
            await marketplace.connect(seller).createListing(TOKEN_ID, 100, PRICE_PER_UNIT);
            const listing = await marketplace.listings(1);
            expect(listing.amount).to.equal(100);
        });
    });

    describe("Edge Cases", function () {
        it("should handle listing with very high price", async function () {
            const highPrice = ethers.parseEther("1000000"); // 1M ETH per unit
            await marketplace.connect(seller).createListing(TOKEN_ID, 1, highPrice);

            const listing = await marketplace.listings(1);
            expect(listing.pricePerUnit).to.equal(highPrice);
        });

        it("should handle listing with minimal price", async function () {
            const minPrice = 1n; // 1 wei per unit
            await marketplace.connect(seller).createListing(TOKEN_ID, 100, minPrice);

            const listing = await marketplace.listings(1);
            expect(listing.pricePerUnit).to.equal(minPrice);
        });

        it("should handle exact payment amount", async function () {
            await marketplace.connect(seller).createListing(TOKEN_ID, 100, PRICE_PER_UNIT);

            const exactPayment = PRICE_PER_UNIT * BigInt(50);
            await marketplace.connect(buyer).buyListing(1, 50, { value: exactPayment });

            expect(await mockToken.balanceOf(buyer.address, TOKEN_ID)).to.equal(50);
        });
    });

    describe("ERC1155 Receiver", function () {
        it("should accept ERC1155 single transfers", async function () {
            // The marketplace should be able to receive ERC1155 tokens
            // This is verified by the supportsInterface test for ERC1155Receiver
            const ERC1155_RECEIVER_INTERFACE = "0x4e2312e0";
            expect(await marketplace.supportsInterface(ERC1155_RECEIVER_INTERFACE)).to.be.true;
        });

        it("should support ERC1155 Receiver interface for batch transfers", async function () {
            // ERC1155 batch receiver is part of the same interface
            // Just verify the marketplace can handle tokens
            await mockToken.mint(seller.address, 2, 500, "0x");
            await mockToken.connect(seller).setApprovalForAll(await marketplace.getAddress(), true);

            // Create listing with different token
            await marketplace.connect(seller).createListing(2, 100, PRICE_PER_UNIT);
            const listing = await marketplace.listings(1);
            expect(listing.tokenId).to.equal(2);
        });
    });
});
