import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-network-helpers";

/**
 * @title Edge Case Tests
 * @notice Tests for all edge cases and error branches
 */
describe("Edge Case & Error Branch Tests", function () {
    describe("CarbonMarketplace - Error Branches", function () {
        let marketplace: any;
        let mockToken: any;
        let owner: SignerWithAddress;
        let seller: SignerWithAddress;
        let buyer: SignerWithAddress;
        let feeRecipient: SignerWithAddress;

        const TOKEN_ID = 1;
        const PRICE_PER_UNIT = ethers.parseEther("0.01");
        const PLATFORM_FEE_BPS = 250;

        beforeEach(async function () {
            [owner, seller, buyer, feeRecipient] = await ethers.getSigners();

            const MockERC1155 = await ethers.getContractFactory("MockERC1155");
            mockToken = await MockERC1155.deploy();
            await mockToken.waitForDeployment();

            const MarketplaceFactory = await ethers.getContractFactory("CarbonMarketplace");
            marketplace = await upgrades.deployProxy(
                MarketplaceFactory,
                [await mockToken.getAddress(), feeRecipient.address, PLATFORM_FEE_BPS, owner.address],
                { initializer: "initialize" }
            );
            await marketplace.waitForDeployment();

            await mockToken.mint(seller.address, TOKEN_ID, 10000, "0x");
            await marketplace.setKycStatus(seller.address, true);
            await marketplace.setKycStatus(buyer.address, true);
            await mockToken.connect(seller).setApprovalForAll(await marketplace.getAddress(), true);
        });

        describe("Initialization errors", function () {
            it("should revert with invalid carbon credit contract", async function () {
                const MarketplaceFactory = await ethers.getContractFactory("CarbonMarketplace");
                await expect(
                    upgrades.deployProxy(
                        MarketplaceFactory,
                        [ethers.ZeroAddress, feeRecipient.address, PLATFORM_FEE_BPS, owner.address],
                        { initializer: "initialize" }
                    )
                ).to.be.revertedWithCustomError(MarketplaceFactory, "InvalidCarbonCreditContract");
            });

            it("should revert with invalid fee recipient", async function () {
                const MarketplaceFactory = await ethers.getContractFactory("CarbonMarketplace");
                await expect(
                    upgrades.deployProxy(
                        MarketplaceFactory,
                        [await mockToken.getAddress(), ethers.ZeroAddress, PLATFORM_FEE_BPS, owner.address],
                        { initializer: "initialize" }
                    )
                ).to.be.revertedWithCustomError(MarketplaceFactory, "InvalidFeeRecipient");
            });

            it("should revert with fee too high", async function () {
                const MarketplaceFactory = await ethers.getContractFactory("CarbonMarketplace");
                await expect(
                    upgrades.deployProxy(
                        MarketplaceFactory,
                        [await mockToken.getAddress(), feeRecipient.address, 1001, owner.address], // > 10%
                        { initializer: "initialize" }
                    )
                ).to.be.revertedWithCustomError(MarketplaceFactory, "FeeTooHigh");
            });
        });

        describe("Listing errors", function () {
            it("should revert createListing with zero price", async function () {
                await expect(
                    marketplace.connect(seller).createListing(TOKEN_ID, 100, 0, 0, 86400)
                ).to.be.revertedWithCustomError(marketplace, "InvalidPrice");
            });

            it("should revert createListing with zero amount", async function () {
                await expect(
                    marketplace.connect(seller).createListing(TOKEN_ID, 0, PRICE_PER_UNIT, 0, 86400)
                ).to.be.revertedWithCustomError(marketplace, "InvalidAmount");
            });

            it("should revert createListing with insufficient balance", async function () {
                await expect(
                    marketplace.connect(seller).createListing(TOKEN_ID, 100000, PRICE_PER_UNIT, 0, 86400)
                ).to.be.revertedWithCustomError(marketplace, "InsufficientBalance");
            });

            it("should revert updateListing for non-owner", async function () {
                await marketplace.connect(seller).createListing(TOKEN_ID, 100, PRICE_PER_UNIT, 0, 86400);

                await expect(
                    marketplace.connect(buyer).updateListing(1, PRICE_PER_UNIT * 2n, 0)
                ).to.be.revertedWithCustomError(marketplace, "NotListingSeller");
            });

            it("should revert updateListing for non-existent listing", async function () {
                await expect(
                    marketplace.connect(seller).updateListing(999, PRICE_PER_UNIT, 100)
                ).to.be.revertedWithCustomError(marketplace, "ListingNotFound");
            });

            it("should revert updateListing for inactive listing", async function () {
                await marketplace.connect(seller).createListing(TOKEN_ID, 100, PRICE_PER_UNIT, 0, 86400);

                // Buy all to deactivate
                await marketplace.connect(buyer).purchase(1, 100, { value: PRICE_PER_UNIT * 100n });

                await expect(
                    marketplace.connect(seller).updateListing(1, PRICE_PER_UNIT * 2n, 0)
                ).to.be.revertedWithCustomError(marketplace, "ListingNotActive");
            });
        });

        describe("Purchase errors", function () {
            beforeEach(async function () {
                await marketplace.connect(seller).createListing(TOKEN_ID, 100, PRICE_PER_UNIT, 0, 86400);
            });

            it("should revert purchase of own listing", async function () {
                await expect(
                    marketplace.connect(seller).purchase(1, 50, { value: PRICE_PER_UNIT * 50n })
                ).to.be.revertedWithCustomError(marketplace, "CannotBuyOwnListing");
            });

            it("should revert purchase with zero amount", async function () {
                await expect(
                    marketplace.connect(buyer).purchase(1, 0, { value: 0 })
                ).to.be.revertedWithCustomError(marketplace, "InvalidAmount");
            });

            it("should revert purchase exceeding available", async function () {
                await expect(
                    marketplace.connect(buyer).purchase(1, 200, { value: PRICE_PER_UNIT * 200n })
                ).to.be.revertedWithCustomError(marketplace, "InvalidAmount");
            });

            it("should revert purchase with insufficient payment", async function () {
                await expect(
                    marketplace.connect(buyer).purchase(1, 50, { value: PRICE_PER_UNIT * 10n })
                ).to.be.revertedWithCustomError(marketplace, "InsufficientPayment");
            });
        });

        describe("Offer errors", function () {
            it("should revert createOffer with zero price", async function () {
                await expect(
                    marketplace.connect(buyer).createOffer(TOKEN_ID, 50, 0, 86400, { value: ethers.parseEther("1") })
                ).to.be.revertedWithCustomError(marketplace, "InvalidPrice");
            });

            it("should revert createOffer with zero amount", async function () {
                await expect(
                    marketplace.connect(buyer).createOffer(TOKEN_ID, 0, PRICE_PER_UNIT, 86400, { value: PRICE_PER_UNIT * 50n })
                ).to.be.revertedWithCustomError(marketplace, "InvalidAmount");
            });

            it("should revert cancelOffer by non-buyer", async function () {
                const depositAmount = PRICE_PER_UNIT * 50n;
                await marketplace.connect(buyer).createOffer(TOKEN_ID, 50, PRICE_PER_UNIT, 86400, { value: depositAmount });

                await expect(
                    marketplace.connect(seller).cancelOffer(1)
                ).to.be.revertedWithCustomError(marketplace, "NotOfferBuyer");
            });
        });

        describe("Admin functions", function () {
            it("should set new fee recipient", async function () {
                await marketplace.setFeeRecipient(buyer.address);
                expect(await marketplace.feeRecipient()).to.equal(buyer.address);
            });

            it("should set new platform fee", async function () {
                await marketplace.setPlatformFee(500); // 5%
                expect(await marketplace.platformFeeBps()).to.equal(500);
            });

            it("should revert setPlatformFee with fee too high", async function () {
                await expect(
                    marketplace.setPlatformFee(1001)
                ).to.be.revertedWithCustomError(marketplace, "FeeTooHigh");
            });

            it("should pause and unpause", async function () {
                await marketplace.pause();
                expect(await marketplace.paused()).to.be.true;

                await marketplace.unpause();
                expect(await marketplace.paused()).to.be.false;
            });
        });

        describe("View functions", function () {
            it("should get listing details", async function () {
                await marketplace.connect(seller).createListing(TOKEN_ID, 100, PRICE_PER_UNIT, 0, 86400);

                const listing = await marketplace.getListing(1);
                expect(listing.seller).to.equal(seller.address);
                expect(listing.amount).to.equal(100);
                expect(listing.pricePerUnit).to.equal(PRICE_PER_UNIT);
            });

            it("should get offer details", async function () {
                const depositAmount = PRICE_PER_UNIT * 50n;
                await marketplace.connect(buyer).createOffer(TOKEN_ID, 50, PRICE_PER_UNIT, 86400, { value: depositAmount });

                const offer = await marketplace.getOffer(1);
                expect(offer.buyer).to.equal(buyer.address);
                expect(offer.amount).to.equal(50);
            });
        });
    });

    describe("CarbonCredit - Error Branches", function () {
        let carbonCredit: any;
        let verificationEngine: any;
        let accessControl: any;
        let owner: SignerWithAddress;
        let minter: SignerWithAddress;
        let user: SignerWithAddress;

        beforeEach(async function () {
            [owner, minter, user] = await ethers.getSigners();

            // Deploy access control
            const AccessControlFactory = await ethers.getContractFactory("TerraQuraAccessControl");
            accessControl = await upgrades.deployProxy(
                AccessControlFactory,
                [owner.address],
                { initializer: "initialize" }
            );
            await accessControl.waitForDeployment();

            // Deploy verification engine
            const VerificationFactory = await ethers.getContractFactory("VerificationEngine");
            verificationEngine = await upgrades.deployProxy(
                VerificationFactory,
                [await accessControl.getAddress(), ethers.ZeroAddress],
                { initializer: "initialize" }
            );
            await verificationEngine.waitForDeployment();

            // Deploy carbon credit
            const CarbonCreditFactory = await ethers.getContractFactory("CarbonCredit");
            carbonCredit = await upgrades.deployProxy(
                CarbonCreditFactory,
                [
                    await verificationEngine.getAddress(),
                    "https://api.terraqura.aethelred.network/metadata/",
                    owner.address
                ],
                { initializer: "initialize" }
            );
            await carbonCredit.waitForDeployment();

            // Setup roles
            const MINTER_ROLE = await accessControl.MINTER_ROLE();
            await accessControl.grantRole(MINTER_ROLE, minter.address);

            // Setup verification engine
            await verificationEngine.setCarbonCreditContract(await carbonCredit.getAddress());
        });

        it("should get total supply for non-existent token", async function () {
            const supply = await carbonCredit.totalSupply(999);
            expect(supply).to.equal(0);
        });

        it("should get batch metadata", async function () {
            // Just test that uri() function works
            const uri = await carbonCredit.uri(1);
            expect(uri).to.include("https://api.terraqura.aethelred.network/metadata/");
        });
    });

    describe("VerificationEngine - Error Branches", function () {
        let verificationEngine: any;
        let accessControl: any;
        let owner: SignerWithAddress;
        let operator: SignerWithAddress;

        beforeEach(async function () {
            [owner, operator] = await ethers.getSigners();

            const AccessControlFactory = await ethers.getContractFactory("TerraQuraAccessControl");
            accessControl = await upgrades.deployProxy(
                AccessControlFactory,
                [owner.address],
                { initializer: "initialize" }
            );
            await accessControl.waitForDeployment();

            const VerificationFactory = await ethers.getContractFactory("VerificationEngine");
            verificationEngine = await upgrades.deployProxy(
                VerificationFactory,
                [await accessControl.getAddress(), ethers.ZeroAddress],
                { initializer: "initialize" }
            );
            await verificationEngine.waitForDeployment();

            // Grant operator role
            const OPERATOR_ROLE = await accessControl.OPERATOR_ROLE();
            await accessControl.grantRole(OPERATOR_ROLE, operator.address);
        });

        it("should revert whitelisting with zero address operator", async function () {
            const dacId = ethers.keccak256(ethers.toUtf8Bytes("test-dac"));
            await expect(
                verificationEngine.whitelistDacUnit(dacId, ethers.ZeroAddress)
            ).to.be.revertedWithCustomError(verificationEngine, "InvalidOperatorAddress");
        });

        it("should revert duplicate DAC whitelisting", async function () {
            const dacId = ethers.keccak256(ethers.toUtf8Bytes("test-dac"));
            await verificationEngine.whitelistDacUnit(dacId, operator.address);

            await expect(
                verificationEngine.whitelistDacUnit(dacId, operator.address)
            ).to.be.revertedWithCustomError(verificationEngine, "DacUnitAlreadyWhitelisted");
        });

        it("should check DAC whitelist status", async function () {
            const dacId = ethers.keccak256(ethers.toUtf8Bytes("test-dac"));
            await verificationEngine.whitelistDacUnit(dacId, operator.address);

            const isWhitelisted = await verificationEngine.whitelistedDacUnits(dacId);
            expect(isWhitelisted).to.be.true;
        });
    });

    describe("TerraQuraTimelock - Error Branches", function () {
        let timelock: any;
        let owner: SignerWithAddress;

        beforeEach(async function () {
            [owner] = await ethers.getSigners();

            const Factory = await ethers.getContractFactory("TerraQuraTimelock");
            timelock = await Factory.deploy(
                3600, // 1 hour delay
                [owner.address],
                [ethers.ZeroAddress],
                ethers.ZeroAddress,
                false
            );
            await timelock.waitForDeployment();
        });

        it("should get minimum delay", async function () {
            expect(await timelock.getMinDelay()).to.equal(3600);
        });

        it("should check if production", async function () {
            expect(await timelock.isProduction()).to.be.false;
        });
    });

    describe("TerraQuraForwarder - Verify", function () {
        let forwarder: any;
        let owner: SignerWithAddress;
        let user: SignerWithAddress;

        beforeEach(async function () {
            [owner, user] = await ethers.getSigners();

            const Factory = await ethers.getContractFactory("TerraQuraForwarder");
            forwarder = await Factory.deploy();
            await forwarder.waitForDeployment();
        });

        it("should verify valid signature", async function () {
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

            const nonce = await forwarder.getNonce(user.address);

            const request = {
                from: user.address,
                to: owner.address,
                value: 0n,
                gas: 100000n,
                nonce: nonce,
                data: "0x"
            };

            const signature = await user.signTypedData(domain, types, request);

            const isValid = await forwarder.verify(request, signature);
            expect(isValid).to.be.true;
        });

        it("should reject invalid nonce", async function () {
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

            const request = {
                from: user.address,
                to: owner.address,
                value: 0n,
                gas: 100000n,
                nonce: 999n, // Wrong nonce
                data: "0x"
            };

            const signature = await user.signTypedData(domain, types, request);

            const isValid = await forwarder.verify(request, signature);
            expect(isValid).to.be.false;
        });
    });
});
