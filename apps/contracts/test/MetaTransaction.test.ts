import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

/**
 * @title Meta-Transaction Tests
 * @notice Tests for ERC-2771 forwarder functionality
 * @dev Coverage for GaslessMarketplace lines 141-144
 */
describe("Meta-Transaction (ERC-2771) Tests", function () {
    let marketplace: any;
    let forwarder: any;
    let mockToken: any;
    let owner: SignerWithAddress;
    let seller: SignerWithAddress;
    let relayer: SignerWithAddress;

    const TOKEN_ID = 1;
    const PRICE_PER_UNIT = ethers.parseEther("0.01");

    beforeEach(async function () {
        [owner, seller, relayer] = await ethers.getSigners();

        // Deploy mock token
        const MockFactory = await ethers.getContractFactory("MockERC1155");
        mockToken = await MockFactory.deploy();
        await mockToken.waitForDeployment();

        // Deploy forwarder
        const ForwarderFactory = await ethers.getContractFactory("TerraQuraForwarder");
        forwarder = await ForwarderFactory.deploy();
        await forwarder.waitForDeployment();

        // Deploy marketplace
        const MarketplaceFactory = await ethers.getContractFactory("GaslessMarketplace");
        marketplace = await upgrades.deployProxy(
            MarketplaceFactory,
            [owner.address, await mockToken.getAddress(), await forwarder.getAddress()],
            { initializer: "initialize" }
        );
        await marketplace.waitForDeployment();

        // Setup
        await mockToken.mint(seller.address, TOKEN_ID, 1000, "0x");
        await mockToken.connect(seller).setApprovalForAll(await marketplace.getAddress(), true);
    });

    describe("Direct Calls (Non-Forwarder)", function () {
        it("should use msg.sender directly when not from forwarder", async function () {
            // Direct call from seller
            await marketplace.connect(seller).createListing(TOKEN_ID, 100, PRICE_PER_UNIT);

            const listing = await marketplace.listings(1);
            expect(listing.seller).to.equal(seller.address);
        });

        it("should use full msg.data when not from forwarder", async function () {
            // Direct call - msg.data is used as-is
            await marketplace.connect(seller).createListing(TOKEN_ID, 50, PRICE_PER_UNIT);

            const listing = await marketplace.listings(1);
            expect(listing.amount).to.equal(50);
        });
    });

    describe("Forwarder Detection", function () {
        it("should identify trusted forwarder correctly", async function () {
            expect(await marketplace.isTrustedForwarder(await forwarder.getAddress())).to.be.true;
        });

        it("should reject non-forwarder addresses", async function () {
            expect(await marketplace.isTrustedForwarder(relayer.address)).to.be.false;
        });
    });

    describe("Meta-Transaction Execution", function () {
        it("should create listing via forwarder", async function () {
            // Build the request
            const domain = {
                name: "MinimalForwarder",
                version: "0.0.1",
                chainId: 31337,
                verifyingContract: await forwarder.getAddress()
            };

            const types = {
                ForwardRequest: [
                    { name: "from", type: "address" },
                    { name: "to", type: "address" },
                    { name: "value", type: "uint256" },
                    { name: "gas", type: "uint256" },
                    { name: "nonce", type: "uint256" },
                    { name: "data", type: "bytes" }
                ]
            };

            const nonce = await forwarder.getNonce(seller.address);

            // Encode the function call
            const marketplaceInterface = marketplace.interface;
            const data = marketplaceInterface.encodeFunctionData("createListing", [
                TOKEN_ID,
                100,
                PRICE_PER_UNIT
            ]);

            const request = {
                from: seller.address,
                to: await marketplace.getAddress(),
                value: 0n,
                gas: 500000n,
                nonce: nonce,
                data: data
            };

            // Sign the request
            const signature = await seller.signTypedData(domain, types, request);

            // Execute via relayer
            await forwarder.connect(relayer).execute(request, signature);

            // Verify the listing was created with correct seller
            const listing = await marketplace.listings(1);
            expect(listing.seller).to.equal(seller.address);
            expect(listing.amount).to.equal(100);
        });
    });
});
