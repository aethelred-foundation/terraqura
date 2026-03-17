import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

/**
 * @title Gasless Meta-Transaction Tests
 * @notice Comprehensive tests for ERC-2771 forwarder functionality
 * @dev These tests explicitly exercise the _msgSender() and _msgData() paths
 *      when transactions are relayed through the TerraQuraForwarder.
 *
 * Enterprise Value: Proves gasless transactions work end-to-end, which is
 * critical for onboarding corporate clients who may not hold native tokens.
 */
describe("Gasless Meta-Transaction Tests (ERC-2771)", function () {
    let marketplace: any;
    let forwarder: any;
    let mockToken: any;
    let owner: SignerWithAddress;
    let seller: SignerWithAddress;
    let buyer: SignerWithAddress;
    let relayer: SignerWithAddress;

    const TOKEN_ID = 1;
    const PRICE_PER_UNIT = ethers.parseEther("0.01");

    // EIP-712 Domain for the forwarder
    let domain: any;
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

    beforeEach(async function () {
        [owner, seller, buyer, relayer] = await ethers.getSigners();

        // Deploy mock ERC1155 token
        const MockFactory = await ethers.getContractFactory("MockERC1155");
        mockToken = await MockFactory.deploy();
        await mockToken.waitForDeployment();

        // Deploy TerraQura Forwarder
        const ForwarderFactory = await ethers.getContractFactory("TerraQuraForwarder");
        forwarder = await ForwarderFactory.deploy();
        await forwarder.waitForDeployment();

        // Deploy GaslessMarketplace with forwarder
        const MarketplaceFactory = await ethers.getContractFactory("GaslessMarketplace");
        marketplace = await upgrades.deployProxy(
            MarketplaceFactory,
            [owner.address, await mockToken.getAddress(), await forwarder.getAddress()],
            { initializer: "initialize" }
        );
        await marketplace.waitForDeployment();

        // Setup EIP-712 domain
        domain = {
            name: "MinimalForwarder",
            version: "0.0.1",
            chainId: 31337,
            verifyingContract: await forwarder.getAddress()
        };

        // Mint tokens to seller
        await mockToken.mint(seller.address, TOKEN_ID, 10000, "0x");

        // Approve marketplace to transfer seller's tokens
        await mockToken.connect(seller).setApprovalForAll(await marketplace.getAddress(), true);
    });

    /**
     * Helper function to create and sign a meta-transaction request
     */
    async function createMetaTxRequest(
        signer: SignerWithAddress,
        functionData: string,
        value: bigint = 0n
    ) {
        const nonce = await forwarder.getNonce(signer.address);

        const request = {
            from: signer.address,
            to: await marketplace.getAddress(),
            value: value,
            gas: 500000n,
            nonce: nonce,
            data: functionData
        };

        const signature = await signer.signTypedData(domain, types, request);

        return { request, signature };
    }

    describe("_msgSender() Coverage via Forwarder Path", function () {
        it("should extract correct sender from meta-transaction (covers line 132-137)", async function () {
            // Encode createListing function call
            const data = marketplace.interface.encodeFunctionData("createListing", [
                TOKEN_ID,
                100,
                PRICE_PER_UNIT
            ]);

            // Create and sign the meta-transaction
            const { request, signature } = await createMetaTxRequest(seller, data);

            // Execute via relayer (NOT the seller)
            // This forces the contract to use _msgSender() which extracts
            // the sender from the appended calldata (ERC-2771 pattern)
            await forwarder.connect(relayer).execute(request, signature);

            // Verify the listing was created with SELLER as the owner
            // (not the relayer who actually sent the transaction)
            const listing = await marketplace.listings(1);
            expect(listing.seller).to.equal(seller.address);
            expect(listing.amount).to.equal(100);
            expect(listing.pricePerUnit).to.equal(PRICE_PER_UNIT);
        });

        it("should handle multiple meta-transactions from same user", async function () {
            // First meta-transaction: create listing
            const createData = marketplace.interface.encodeFunctionData("createListing", [
                TOKEN_ID,
                50,
                PRICE_PER_UNIT
            ]);
            const { request: req1, signature: sig1 } = await createMetaTxRequest(seller, createData);
            await forwarder.connect(relayer).execute(req1, sig1);

            // Second meta-transaction: create another listing (nonce should increment)
            const createData2 = marketplace.interface.encodeFunctionData("createListing", [
                TOKEN_ID,
                30,
                PRICE_PER_UNIT * 2n
            ]);
            const { request: req2, signature: sig2 } = await createMetaTxRequest(seller, createData2);
            await forwarder.connect(relayer).execute(req2, sig2);

            // Verify both listings created correctly
            const listing1 = await marketplace.listings(1);
            const listing2 = await marketplace.listings(2);

            expect(listing1.amount).to.equal(50);
            expect(listing2.amount).to.equal(30);
            expect(listing1.seller).to.equal(seller.address);
            expect(listing2.seller).to.equal(seller.address);
        });
    });

    describe("_msgData() Coverage via Forwarder Path", function () {
        it("should correctly truncate calldata when from forwarder (covers lines 141-142)", async function () {
            // The _msgData() function strips the last 20 bytes (sender address)
            // when called from the trusted forwarder

            // Create a listing via meta-transaction
            const data = marketplace.interface.encodeFunctionData("createListing", [
                TOKEN_ID,
                75,
                PRICE_PER_UNIT
            ]);

            const { request, signature } = await createMetaTxRequest(seller, data);
            await forwarder.connect(relayer).execute(request, signature);

            // If _msgData() didn't work correctly, the function parameters would be wrong
            const listing = await marketplace.listings(1);
            expect(listing.amount).to.equal(75); // Proves calldata was correctly parsed
        });

        it("should use full calldata when NOT from forwarder (covers line 144)", async function () {
            // Direct call - not through forwarder
            // _msgData() should return msg.data as-is
            await marketplace.connect(seller).createListing(TOKEN_ID, 100, PRICE_PER_UNIT);

            const listing = await marketplace.listings(1);
            expect(listing.seller).to.equal(seller.address);
            expect(listing.amount).to.equal(100);
        });
    });

    describe("isTrustedForwarder() Verification", function () {
        it("should identify the configured forwarder as trusted", async function () {
            const forwarderAddress = await forwarder.getAddress();
            expect(await marketplace.isTrustedForwarder(forwarderAddress)).to.be.true;
        });

        it("should not trust arbitrary addresses", async function () {
            expect(await marketplace.isTrustedForwarder(relayer.address)).to.be.false;
            expect(await marketplace.isTrustedForwarder(seller.address)).to.be.false;
            expect(await marketplace.isTrustedForwarder(ethers.ZeroAddress)).to.be.false;
        });
    });

    describe("Forwarder Signature Verification", function () {
        it("should verify valid signature", async function () {
            const data = marketplace.interface.encodeFunctionData("createListing", [
                TOKEN_ID,
                100,
                PRICE_PER_UNIT
            ]);

            const { request, signature } = await createMetaTxRequest(seller, data);

            // Verify the signature is valid
            expect(await forwarder.verify(request, signature)).to.be.true;
        });

        it("should reject signature with wrong signer", async function () {
            const data = marketplace.interface.encodeFunctionData("createListing", [
                TOKEN_ID,
                100,
                PRICE_PER_UNIT
            ]);

            const nonce = await forwarder.getNonce(seller.address);
            const request = {
                from: seller.address, // Claims to be from seller
                to: await marketplace.getAddress(),
                value: 0n,
                gas: 500000n,
                nonce: nonce,
                data: data
            };

            // Sign with buyer (wrong signer)
            const signature = await buyer.signTypedData(domain, types, request);

            // Verification should fail
            expect(await forwarder.verify(request, signature)).to.be.false;
        });

        it("should reject replay attacks (same nonce)", async function () {
            const data = marketplace.interface.encodeFunctionData("createListing", [
                TOKEN_ID,
                50,
                PRICE_PER_UNIT
            ]);

            const { request, signature } = await createMetaTxRequest(seller, data);

            // First execution succeeds
            await forwarder.connect(relayer).execute(request, signature);

            // Second execution with same request should fail (nonce already used)
            await expect(
                forwarder.connect(relayer).execute(request, signature)
            ).to.be.reverted;
        });

        it("should reject wrong nonce", async function () {
            const data = marketplace.interface.encodeFunctionData("createListing", [
                TOKEN_ID,
                100,
                PRICE_PER_UNIT
            ]);

            const request = {
                from: seller.address,
                to: await marketplace.getAddress(),
                value: 0n,
                gas: 500000n,
                nonce: 999n, // Wrong nonce
                data: data
            };

            const signature = await seller.signTypedData(domain, types, request);

            expect(await forwarder.verify(request, signature)).to.be.false;
        });
    });

    describe("End-to-End Gasless Flow", function () {
        it("should allow gasless listing creation", async function () {
            // Create listing via meta-transaction
            const createData = marketplace.interface.encodeFunctionData("createListing", [
                TOKEN_ID,
                100,
                PRICE_PER_UNIT
            ]);
            const { request, signature } = await createMetaTxRequest(seller, createData);
            await forwarder.connect(relayer).execute(request, signature);

            // Verify listing exists with correct seller
            const listing = await marketplace.listings(1);
            expect(listing.seller).to.equal(seller.address);
            expect(listing.amount).to.equal(100);
            expect(listing.pricePerUnit).to.equal(PRICE_PER_UNIT);
        });

        it("should allow gasless purchase (buyListing)", async function () {
            // Create listing directly by seller
            await marketplace.connect(seller).createListing(TOKEN_ID, 100, PRICE_PER_UNIT);

            // Buyer purchases via meta-transaction
            const purchaseAmount = 50n;
            const totalPrice = PRICE_PER_UNIT * purchaseAmount;

            const buyData = marketplace.interface.encodeFunctionData("buyListing", [
                1, // listingId
                purchaseAmount
            ]);

            const { request, signature } = await createMetaTxRequest(buyer, buyData, totalPrice);

            // Execute meta-transaction with value
            await forwarder.connect(relayer).execute(request, signature, { value: totalPrice });

            // Verify purchase succeeded - listing should have reduced amount
            const listing = await marketplace.listings(1);
            expect(listing.amount).to.equal(50); // 100 - 50 = 50 remaining
        });

        it("should track multiple gasless operations with correct nonces", async function () {
            // First operation
            const createData1 = marketplace.interface.encodeFunctionData("createListing", [
                TOKEN_ID,
                25,
                PRICE_PER_UNIT
            ]);
            const { request: req1, signature: sig1 } = await createMetaTxRequest(seller, createData1);
            await forwarder.connect(relayer).execute(req1, sig1);

            // Check nonce incremented
            expect(await forwarder.getNonce(seller.address)).to.equal(1);

            // Second operation
            const createData2 = marketplace.interface.encodeFunctionData("createListing", [
                TOKEN_ID,
                35,
                PRICE_PER_UNIT
            ]);
            const { request: req2, signature: sig2 } = await createMetaTxRequest(seller, createData2);
            await forwarder.connect(relayer).execute(req2, sig2);

            // Check nonce incremented again
            expect(await forwarder.getNonce(seller.address)).to.equal(2);

            // Verify both listings created correctly
            const listing1 = await marketplace.listings(1);
            const listing2 = await marketplace.listings(2);
            expect(listing1.amount).to.equal(25);
            expect(listing2.amount).to.equal(35);
        });
    });

    describe("Security: Forwarder Cannot Impersonate", function () {
        it("should not allow forwarder to impersonate other users", async function () {
            // Even if someone tries to manually craft a call through the forwarder,
            // the signature verification prevents impersonation

            const data = marketplace.interface.encodeFunctionData("createListing", [
                TOKEN_ID,
                100,
                PRICE_PER_UNIT
            ]);

            const nonce = await forwarder.getNonce(buyer.address);
            const request = {
                from: buyer.address, // Claims to be buyer
                to: await marketplace.getAddress(),
                value: 0n,
                gas: 500000n,
                nonce: nonce,
                data: data
            };

            // Seller signs (attempting to create listing as buyer)
            const signature = await seller.signTypedData(domain, types, request);

            // Should fail because seller's signature doesn't match "from: buyer"
            expect(await forwarder.verify(request, signature)).to.be.false;
        });
    });
});
