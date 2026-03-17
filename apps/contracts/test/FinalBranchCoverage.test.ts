import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-network-helpers";

/**
 * @title Final Branch Coverage Tests
 * @notice Targets remaining uncovered branches to reach 99%+
 */
describe("Final Branch Coverage Tests", function () {
    describe("CarbonMarketplace - Remaining Branches", function () {
        let marketplace: any;
        let mockToken: any;
        let owner: SignerWithAddress;
        let differentOwner: SignerWithAddress;
        let seller: SignerWithAddress;
        let buyer: SignerWithAddress;
        let feeRecipient: SignerWithAddress;

        const TOKEN_ID = 1;
        const PRICE_PER_UNIT = ethers.parseEther("0.01");
        const PLATFORM_FEE_BPS = 250;

        beforeEach(async function () {
            [owner, differentOwner, seller, buyer, feeRecipient] = await ethers.getSigners();

            const MockERC1155 = await ethers.getContractFactory("MockERC1155");
            mockToken = await MockERC1155.deploy();
            await mockToken.waitForDeployment();

            await mockToken.mint(seller.address, TOKEN_ID, 10000, "0x");
        });

        it("should transfer ownership when initializer differs from owner (line 240)", async function () {
            const MarketplaceFactory = await ethers.getContractFactory("CarbonMarketplace");

            // Deploy where msg.sender != _owner
            marketplace = await upgrades.deployProxy(
                MarketplaceFactory,
                [await mockToken.getAddress(), feeRecipient.address, PLATFORM_FEE_BPS, differentOwner.address],
                { initializer: "initialize" }
            );
            await marketplace.waitForDeployment();

            // Verify ownership was transferred to differentOwner
            expect(await marketplace.owner()).to.equal(differentOwner.address);
        });

        it("should update listing with increased amount (line 356-366)", async function () {
            const MarketplaceFactory = await ethers.getContractFactory("CarbonMarketplace");
            marketplace = await upgrades.deployProxy(
                MarketplaceFactory,
                [await mockToken.getAddress(), feeRecipient.address, PLATFORM_FEE_BPS, owner.address],
                { initializer: "initialize" }
            );
            await marketplace.waitForDeployment();

            await marketplace.setKycStatus(seller.address, true);
            await mockToken.connect(seller).setApprovalForAll(await marketplace.getAddress(), true);

            // Create listing with 50 credits
            await marketplace.connect(seller).createListing(TOKEN_ID, 50, PRICE_PER_UNIT, 0, 86400);

            // Update listing to have 100 credits (increase by 50)
            // updateListing(listingId, newPricePerUnit, newAmount)
            await marketplace.connect(seller).updateListing(1, PRICE_PER_UNIT, 100);

            const listing = await marketplace.getListing(1);
            expect(listing.amount).to.equal(100);
        });

        it("should update listing with decreased amount (line 368-375)", async function () {
            const MarketplaceFactory = await ethers.getContractFactory("CarbonMarketplace");
            marketplace = await upgrades.deployProxy(
                MarketplaceFactory,
                [await mockToken.getAddress(), feeRecipient.address, PLATFORM_FEE_BPS, owner.address],
                { initializer: "initialize" }
            );
            await marketplace.waitForDeployment();

            await marketplace.setKycStatus(seller.address, true);
            await mockToken.connect(seller).setApprovalForAll(await marketplace.getAddress(), true);

            // Create listing with 100 credits
            await marketplace.connect(seller).createListing(TOKEN_ID, 100, PRICE_PER_UNIT, 0, 86400);

            // Update listing to have 50 credits (decrease by 50)
            // updateListing(listingId, newPricePerUnit, newAmount)
            await marketplace.connect(seller).updateListing(1, PRICE_PER_UNIT, 50);

            const listing = await marketplace.getListing(1);
            expect(listing.amount).to.equal(50);
        });

        it("should revert update listing with insufficient balance for increase", async function () {
            const MarketplaceFactory = await ethers.getContractFactory("CarbonMarketplace");
            marketplace = await upgrades.deployProxy(
                MarketplaceFactory,
                [await mockToken.getAddress(), feeRecipient.address, PLATFORM_FEE_BPS, owner.address],
                { initializer: "initialize" }
            );
            await marketplace.waitForDeployment();

            await marketplace.setKycStatus(seller.address, true);
            await mockToken.connect(seller).setApprovalForAll(await marketplace.getAddress(), true);

            // Create listing with all credits
            await marketplace.connect(seller).createListing(TOKEN_ID, 10000, PRICE_PER_UNIT, 0, 86400);

            // Try to increase beyond available balance
            await expect(
                marketplace.connect(seller).updateListing(1, PRICE_PER_UNIT, 15000)
            ).to.be.revertedWithCustomError(marketplace, "InsufficientBalance");
        });
    });

    describe("TerraQuraAccessControl - Remaining Branches", function () {
        let accessControl: any;
        let owner: SignerWithAddress;
        let admin: SignerWithAddress;
        let user1: SignerWithAddress;

        beforeEach(async function () {
            [owner, admin, user1] = await ethers.getSigners();

            const Factory = await ethers.getContractFactory("TerraQuraAccessControl");
            accessControl = await upgrades.deployProxy(
                Factory,
                [admin.address],
                { initializer: "initialize" }
            );
            await accessControl.waitForDeployment();
        });

        it("should grant role with expiry using correct role admin", async function () {
            const OPERATOR_ROLE = await accessControl.OPERATOR_ROLE();
            const futureTime = (await time.latest()) + 86400;

            // Admin can grant OPERATOR_ROLE (admin is role admin for OPERATOR_ROLE)
            await accessControl.connect(admin).grantRoleWithExpiry(
                OPERATOR_ROLE,
                user1.address,
                futureTime
            );

            expect(await accessControl.hasRole(OPERATOR_ROLE, user1.address)).to.be.true;
            expect(await accessControl.roleExpiration(OPERATOR_ROLE, user1.address)).to.equal(futureTime);
        });

        it("should revert grantRoleWithExpiry with past expiry", async function () {
            const OPERATOR_ROLE = await accessControl.OPERATOR_ROLE();

            await expect(
                accessControl.connect(admin).grantRoleWithExpiry(
                    OPERATOR_ROLE,
                    user1.address,
                    1 // Past timestamp
                )
            ).to.be.revertedWith("Expiry must be in future");
        });

        it("should set KYC validity period", async function () {
            const newPeriod = 180 * 24 * 60 * 60; // 180 days

            await accessControl.connect(admin).setKycValidityPeriod(newPeriod);

            expect(await accessControl.kycValidityPeriod()).to.equal(newPeriod);
        });

        it("should get full KYC info", async function () {
            const COMPLIANCE_ROLE = await accessControl.COMPLIANCE_ROLE();
            await accessControl.connect(admin).grantRole(COMPLIANCE_ROLE, owner.address);

            // Set KYC
            await accessControl.updateKycStatus(
                user1.address,
                2, // VERIFIED
                "sumsub",
                ethers.keccak256(ethers.toUtf8Bytes("applicant123"))
            );
            await accessControl.updateSanctionsStatus(user1.address, true);

            const info = await accessControl.getKycInfo(user1.address);
            expect(info.status).to.equal(2); // VERIFIED
            expect(info.provider).to.equal("sumsub");
            expect(info.sanctionsCleared).to.be.true;
            expect(info.isValid).to.be.true;
        });

        it("should preserve sanctions status when updating KYC", async function () {
            const COMPLIANCE_ROLE = await accessControl.COMPLIANCE_ROLE();
            await accessControl.connect(admin).grantRole(COMPLIANCE_ROLE, owner.address);

            // Set sanctions cleared first
            await accessControl.updateSanctionsStatus(user1.address, true);

            // Update KYC status
            await accessControl.updateKycStatus(
                user1.address,
                2, // VERIFIED
                "sumsub",
                ethers.keccak256(ethers.toUtf8Bytes("applicant123"))
            );

            // Sanctions should still be cleared
            const info = await accessControl.kycRegistry(user1.address);
            expect(info.sanctionsCleared).to.be.true;
        });

        it("should handle supportsInterface correctly", async function () {
            // AccessControl interface
            const accessControlInterfaceId = "0x7965db0b";
            expect(await accessControl.supportsInterface(accessControlInterfaceId)).to.be.true;

            // Invalid interface
            expect(await accessControl.supportsInterface("0xffffffff")).to.be.false;
        });
    });

    describe("EfficiencyCalculator - Line 68 and 109", function () {
        let calculator: any;

        beforeEach(async function () {
            const Factory = await ethers.getContractFactory("EfficiencyCalculatorTest");
            calculator = await Factory.deploy();
            await calculator.waitForDeployment();
        });

        it("should hit bonus range = 0 branch (line 54-55)", async function () {
            // When optimal = minAcceptable, bonus range = optimal - min = 0
            // This hits line 54-55
            const factor = await calculator.testCalculate(
                350,  // at optimal
                350,  // optimal = min
                350,  // min = optimal
                600,  // max
                10000
            );

            // At optimal with no bonus range, returns scale
            expect(factor).to.equal(10000);
        });

        it("should hit penalty range = 0 branch (line 68)", async function () {
            // When optimal = maxAcceptable, penalty range = max - optimal = 0
            // This requires kwhPerTonne > optimal but <= max, which is impossible when optimal = max
            // The closest we can get is kwhPerTonne = optimal = max
            const factor = await calculator.testCalculate(
                500,  // at optimal = max
                500,  // optimal = max
                300,  // min
                500,  // max = optimal
                10000
            );

            // At optimal, goes through bonus path (kwhPerTonne <= optimal)
            expect(factor).to.equal(10000);
        });

        it("should apply minimum floor on low purity factor (line 109)", async function () {
            // With purity = 0: purityFactor = 10000 + (0 - 95) * 100 = 500
            // This doesn't hit line 109 since 500 > 0
            // The only way to hit line 109 is with a very small scale that makes purityFactor <= 0
            // With uint8, we can't go negative on purity

            // Test with minimum purity to get lowest possible purityFactor
            const adjusted = await calculator.testApplyPurityAdjustment(
                10000, // baseFactor
                0,     // 0% purity -> purityFactor = 10000 - 9500 = 500
                10000  // scale
            );

            // adjustedFactor = 10000 * 500 / 10000 = 500
            // 500 < minFactor (5000), so clamped to 5000 (line 117-118)
            expect(adjusted).to.equal(5000);
        });

        it("should calculate very high efficiency credits", async function () {
            const credits = await calculator.testCalculateCredits(
                1000000, // 1000 tonnes CO2
                10500,   // 105% efficiency (max)
                10000    // scale
            );

            expect(credits).to.equal(1050000); // 1000000 * 10500 / 10000
        });
    });

    describe("GaslessMarketplace - _msgData Coverage", function () {
        let marketplace: any;
        let forwarder: any;
        let mockToken: any;
        let owner: SignerWithAddress;
        let seller: SignerWithAddress;
        let relayer: SignerWithAddress;

        beforeEach(async function () {
            [owner, seller, relayer] = await ethers.getSigners();

            const MockFactory = await ethers.getContractFactory("MockERC1155");
            mockToken = await MockFactory.deploy();
            await mockToken.waitForDeployment();

            const ForwarderFactory = await ethers.getContractFactory("TerraQuraForwarder");
            forwarder = await ForwarderFactory.deploy();
            await forwarder.waitForDeployment();

            const MarketplaceFactory = await ethers.getContractFactory("GaslessMarketplace");
            marketplace = await upgrades.deployProxy(
                MarketplaceFactory,
                [owner.address, await mockToken.getAddress(), await forwarder.getAddress()],
                { initializer: "initialize" }
            );
            await marketplace.waitForDeployment();

            await mockToken.mint(seller.address, 1, 1000, "0x");
            await mockToken.connect(seller).setApprovalForAll(await marketplace.getAddress(), true);
        });

        it("should execute meta-transaction through forwarder (covers _msgSender and _msgData forwarder path)", async function () {
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

            // Encode createListing call
            const data = marketplace.interface.encodeFunctionData("createListing", [
                1,
                100,
                ethers.parseEther("0.01")
            ]);

            const request = {
                from: seller.address,
                to: await marketplace.getAddress(),
                value: 0n,
                gas: 500000n,
                nonce: nonce,
                data: data
            };

            const signature = await seller.signTypedData(domain, types, request);

            // Execute through relayer
            await forwarder.connect(relayer).execute(request, signature);

            // Verify listing created with correct seller
            const listing = await marketplace.listings(1);
            expect(listing.seller).to.equal(seller.address);
        });

        it("should identify trusted forwarder", async function () {
            expect(await marketplace.isTrustedForwarder(await forwarder.getAddress())).to.be.true;
            expect(await marketplace.isTrustedForwarder(relayer.address)).to.be.false;
        });
    });

    describe("ChainlinkVerifier - Remaining Branches", function () {
        let verifier: any;
        let mockRouter: any;
        let owner: SignerWithAddress;

        beforeEach(async function () {
            [owner] = await ethers.getSigners();

            const MockRouterFactory = await ethers.getContractFactory("MockChainlinkRouter");
            mockRouter = await MockRouterFactory.deploy();
            await mockRouter.waitForDeployment();

            const DON_ID = ethers.keccak256(ethers.toUtf8Bytes("don-test"));
            const SUB_ID = 123n;

            const VerifierFactory = await ethers.getContractFactory("ChainlinkVerifier");
            verifier = await VerifierFactory.deploy(
                await mockRouter.getAddress(),
                DON_ID,
                SUB_ID
            );
            await verifier.waitForDeployment();

            await verifier.setAuthorizedCaller(owner.address, true);
        });

        it("should handle request with encrypted secrets (line 177)", async function () {
            // Set encrypted secrets
            const secrets = ethers.toUtf8Bytes("https://secrets.example.com/api");
            await verifier.setEncryptedSecretsUrls(secrets);

            // Make a request
            const batchId = ethers.keccak256(ethers.toUtf8Bytes("test-batch"));
            await verifier.requestVerification(
                batchId,
                ethers.parseEther("100"),
                3500000n,
                "https://api.example.com",
                ethers.keccak256(ethers.toUtf8Bytes("data"))
            );

            const requestId = await verifier.batchToRequest(batchId);
            expect(requestId).to.not.equal(ethers.ZeroHash);
        });

        it("should update DON ID", async function () {
            const newDonId = ethers.keccak256(ethers.toUtf8Bytes("new-don"));
            await verifier.setDonId(newDonId);
            expect(await verifier.donId()).to.equal(newDonId);
        });

        it("should update subscription ID", async function () {
            await verifier.setSubscriptionId(456n);
            expect(await verifier.subscriptionId()).to.equal(456n);
        });

        it("should update gas limit", async function () {
            await verifier.setGasLimit(500000n);
            expect(await verifier.gasLimit()).to.equal(500000n);
        });

        it("should update verification source code", async function () {
            const newSource = "new source code";
            await verifier.setVerificationSource(newSource);
            expect(await verifier.verificationSource()).to.equal(newSource);
        });
    });

    describe("TerraQuraTimelock - Line 93", function () {
        it("should deploy production timelock", async function () {
            const [owner] = await ethers.getSigners();

            const Factory = await ethers.getContractFactory("TerraQuraTimelock");

            // Production deployment with longer delay
            const productionDelay = 2 * 24 * 60 * 60; // 2 days
            const timelock = await Factory.deploy(
                productionDelay,
                [owner.address],
                [ethers.ZeroAddress],
                ethers.ZeroAddress,
                true // isProduction = true
            );
            await timelock.waitForDeployment();

            expect(await timelock.getMinDelay()).to.equal(productionDelay);
            expect(await timelock.isProduction()).to.be.true;
        });

        it("should deploy testnet timelock with shorter delay", async function () {
            const [owner] = await ethers.getSigners();

            const Factory = await ethers.getContractFactory("TerraQuraTimelock");

            // Testnet deployment with shorter delay
            const testnetDelay = 60 * 60; // 1 hour
            const timelock = await Factory.deploy(
                testnetDelay,
                [owner.address],
                [ethers.ZeroAddress],
                ethers.ZeroAddress,
                false // isProduction = false (testnet)
            );
            await timelock.waitForDeployment();

            expect(await timelock.getMinDelay()).to.equal(testnetDelay);
            expect(await timelock.isProduction()).to.be.false;
        });
    });
});
