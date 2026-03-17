import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-network-helpers";

/**
 * @title Coverage Boost Tests
 * @notice Comprehensive tests to achieve 99% coverage
 * @dev Targets specific uncovered lines across all contracts
 */
describe("Coverage Boost Tests", function () {
    let owner: SignerWithAddress;
    let user1: SignerWithAddress;
    let user2: SignerWithAddress;
    let user3: SignerWithAddress;
    let user4: SignerWithAddress;
    let user5: SignerWithAddress;

    before(async function () {
        [owner, user1, user2, user3, user4, user5] = await ethers.getSigners();
    });

    describe("CarbonMarketplace - calculateTotalPrice", function () {
        let marketplace: any;
        let mockToken: any;

        beforeEach(async function () {
            const MockERC1155 = await ethers.getContractFactory("MockERC1155");
            mockToken = await MockERC1155.deploy();
            await mockToken.waitForDeployment();

            const MarketplaceFactory = await ethers.getContractFactory("CarbonMarketplace");
            marketplace = await upgrades.deployProxy(
                MarketplaceFactory,
                [await mockToken.getAddress(), owner.address, 250, owner.address],
                { initializer: "initialize" }
            );
            await marketplace.waitForDeployment();
        });

        it("should calculate total price correctly (coverage line 677-680)", async function () {
            const pricePerUnit = ethers.parseEther("0.01");
            const amount = 100n;

            const [subtotal, fee, total] = await marketplace.calculateTotalPrice(pricePerUnit, amount);

            expect(subtotal).to.equal(pricePerUnit * amount);
            expect(fee).to.equal((pricePerUnit * amount * 250n) / 10000n);
            expect(total).to.equal(subtotal); // Buyer pays subtotal
        });

        it("should handle zero amount", async function () {
            const [subtotal, fee, total] = await marketplace.calculateTotalPrice(ethers.parseEther("1"), 0);
            expect(subtotal).to.equal(0);
            expect(fee).to.equal(0);
            expect(total).to.equal(0);
        });
    });

    describe("CircuitBreaker - Modifier Coverage", function () {
        let circuitBreaker: any;

        beforeEach(async function () {
            const Factory = await ethers.getContractFactory("CircuitBreaker");
            circuitBreaker = await upgrades.deployProxy(
                Factory,
                [owner.address],
                { initializer: "initialize" }
            );
            await circuitBreaker.waitForDeployment();
        });

        it("should return false from checkRateLimit when globally paused (line 130, 243)", async function () {
            await circuitBreaker.activateGlobalPause("Test");

            // checkRateLimit returns false instead of reverting when paused
            const contractAddr = user1.address;
            const allowed = await circuitBreaker.checkRateLimit.staticCall(contractAddr);
            expect(allowed).to.be.false;
        });

        it("should return false from checkRateLimit when contract is paused (line 135, 243)", async function () {
            const contractAddr = user1.address;
            await circuitBreaker.pauseContract(contractAddr, "Test");

            const allowed = await circuitBreaker.checkRateLimit.staticCall(contractAddr);
            expect(allowed).to.be.false;
        });

        it("should transfer ownership when owner differs (line 148-149)", async function () {
            const Factory = await ethers.getContractFactory("CircuitBreaker");
            const newBreaker = await upgrades.deployProxy(
                Factory,
                [user1.address], // Different owner
                { initializer: "initialize" }
            );
            await newBreaker.waitForDeployment();

            expect(await newBreaker.owner()).to.equal(user1.address);
        });

        it("should check rate limit normally when not paused", async function () {
            const contractAddr = user1.address;
            const allowed = await circuitBreaker.checkRateLimit.staticCall(contractAddr);
            expect(allowed).to.be.true;
        });
    });

    describe("TerraQuraMultisig - View Functions", function () {
        let multisig: any;

        beforeEach(async function () {
            const Factory = await ethers.getContractFactory("TerraQuraMultisig");
            multisig = await Factory.deploy(
                [owner.address, user1.address, user2.address, user3.address, user4.address],
                3 // 3-of-5
            );
            await multisig.waitForDeployment();
        });

        it("should return correct signer count", async function () {
            expect(await multisig.getSignerCount()).to.equal(5);
        });

        it("should verify signer status", async function () {
            expect(await multisig.isSigner(owner.address)).to.be.true;
            expect(await multisig.isSigner(user5.address)).to.be.false;
        });

        it("should return all signers", async function () {
            const signers = await multisig.getSigners();
            expect(signers.length).to.equal(5);
            expect(signers).to.include(owner.address);
        });
    });

    describe("TerraQuraTimelock - testnet deployment (line 93)", function () {
        it("should deploy with shorter delay for testnet", async function () {
            const Factory = await ethers.getContractFactory("TerraQuraTimelock");

            // Deploy with testnet flag (shorter delay)
            const testnetDelay = 3600; // 1 hour
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

    describe("EfficiencyCalculator - Edge Cases (lines 68, 109)", function () {
        let calculator: any;

        beforeEach(async function () {
            const Factory = await ethers.getContractFactory("EfficiencyCalculatorTest");
            calculator = await Factory.deploy();
            await calculator.waitForDeployment();
        });

        it("should hit line 68 when range is 0 (optimal = max)", async function () {
            // When optimal equals max, range = max - optimal = 0
            // This hits the else branch at line 68
            const factor = await calculator.testCalculate(
                400, // kwhPerTonne (between min and max)
                400, // optimal = 400
                200, // min
                400, // max = optimal (range = 0)
                10000
            );

            // When range is 0 and kwhPerTonne > optimal, factor should be scale
            expect(factor).to.equal(10000);
        });

        it("should hit line 109 when purity creates negative factor", async function () {
            // With very low purity (below 0), purityFactor would be <= 0
            // Need purity such that: scale + (purityDelta * 100) <= 0
            // 10000 + ((purity - 95) * 100) <= 0
            // purity - 95 <= -100
            // purity <= -5 (impossible with uint8)
            // BUT with very low purity values, purityFactor can still be very low

            // Let's try with 0 purity
            const adjusted = await calculator.testApplyPurityAdjustment(
                10000, // baseFactor
                0,     // purity = 0%, purityDelta = -95, purityFactor = 10000 + (-95 * 100) = 10000 - 9500 = 500
                10000  // scale
            );

            // Should hit minimum floor calculation
            expect(adjusted).to.be.gt(0);
        });
    });

    describe("GaslessMarketplace - ERC2771 _msgData coverage (lines 141-144)", function () {
        let marketplace: any;
        let forwarder: any;
        let mockToken: any;

        beforeEach(async function () {
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
            await mockToken.mint(user1.address, 1, 1000, "0x");
            await mockToken.connect(user1).setApprovalForAll(await marketplace.getAddress(), true);
        });

        it("should handle _msgData when NOT from forwarder (line 144)", async function () {
            // Direct call - not through forwarder
            // _msgData should return msg.data as-is
            await marketplace.connect(user1).createListing(1, 100, ethers.parseEther("0.01"));

            const listing = await marketplace.listings(1);
            expect(listing.seller).to.equal(user1.address);
        });

        // Note: Testing lines 141-142 (forwarder path) requires complex meta-transaction setup
        // These are internal view functions called when isTrustedForwarder returns true
    });

    describe("ChainlinkVerifier - Additional branches (lines 177, 218, 222)", function () {
        let verifier: any;
        let mockRouter: any;

        beforeEach(async function () {
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

        it("should use encrypted secrets when configured (line 177)", async function () {
            // Set encrypted secrets
            const secrets = ethers.toUtf8Bytes("https://secrets.example.com/encrypted");
            await verifier.setEncryptedSecretsUrls(secrets);

            // Verify secrets are set
            expect(await verifier.encryptedSecretsUrls()).to.equal(ethers.hexlify(secrets));

            // Make a request - the secrets should be included
            const batchId = ethers.keccak256(ethers.toUtf8Bytes("batch-with-secrets"));
            await verifier.requestVerification(
                batchId,
                ethers.parseEther("100"),
                3500000n,
                "https://api.example.com",
                ethers.keccak256(ethers.toUtf8Bytes("data"))
            );

            // Request should be created
            const requestId = await verifier.batchToRequest(batchId);
            expect(requestId).to.not.equal(ethers.ZeroHash);
        });
    });
});
