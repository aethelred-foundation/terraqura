import { expect } from "chai";
import { ethers, upgrades } from "hardhat";

describe("CircuitBreaker Integration", function () {
    it("blocks CarbonMarketplace listings when the circuit breaker pauses the contract", async function () {
        const [owner, seller, feeRecipient] = await ethers.getSigners();

        const MockERC1155Factory = await ethers.getContractFactory("MockERC1155");
        const mockToken = await MockERC1155Factory.deploy();
        await mockToken.waitForDeployment();

        const MarketplaceFactory = await ethers.getContractFactory("CarbonMarketplace");
        const marketplace = await upgrades.deployProxy(
            MarketplaceFactory,
            [await mockToken.getAddress(), feeRecipient.address, 250, owner.address],
            { initializer: "initialize" }
        );
        await marketplace.waitForDeployment();

        const CircuitBreakerFactory = await ethers.getContractFactory("CircuitBreaker");
        const circuitBreaker = await upgrades.deployProxy(
            CircuitBreakerFactory,
            [owner.address],
            { initializer: "initialize" }
        );
        await circuitBreaker.waitForDeployment();

        await marketplace.setCircuitBreaker(await circuitBreaker.getAddress());
        await circuitBreaker.registerContract(await marketplace.getAddress());

        await mockToken.mint(seller.address, 1, 100, "0x");
        await mockToken.connect(seller).setApprovalForAll(await marketplace.getAddress(), true);
        await marketplace.setKycStatus(seller.address, true);

        await circuitBreaker.pauseContract(await marketplace.getAddress(), "test");

        await expect(
            marketplace.connect(seller).createListing(1, 10, ethers.parseEther("0.01"), 0, 3600)
        ).to.be.revertedWithCustomError(marketplace, "CircuitBreakerBlocked");
    });

    it("blocks verification-driven minting when the VerificationEngine circuit breaker is paused", async function () {
        const [owner, operator] = await ethers.getSigners();

        const CircuitBreakerFactory = await ethers.getContractFactory("CircuitBreaker");
        const circuitBreaker = await upgrades.deployProxy(
            CircuitBreakerFactory,
            [owner.address],
            { initializer: "initialize" }
        );
        await circuitBreaker.waitForDeployment();

        const VerificationEngineFactory = await ethers.getContractFactory("VerificationEngine");
        const verificationEngine = await upgrades.deployProxy(
            VerificationEngineFactory,
            [ethers.ZeroAddress, ethers.ZeroAddress],
            { initializer: "initialize" }
        );
        await verificationEngine.waitForDeployment();

        const CarbonCreditFactory = await ethers.getContractFactory("CarbonCredit");
        const carbonCredit = await upgrades.deployProxy(
            CarbonCreditFactory,
            [await verificationEngine.getAddress(), "ipfs://", owner.address],
            { initializer: "initialize" }
        );
        await carbonCredit.waitForDeployment();

        const dacUnitId = ethers.keccak256(ethers.toUtf8Bytes("CB_DAC_UNIT"));
        const sourceDataHash = ethers.keccak256(ethers.toUtf8Bytes("cb-source-data"));

        await verificationEngine.setCarbonCreditContract(await carbonCredit.getAddress());
        await verificationEngine.whitelistDacUnit(dacUnitId, operator.address);
        await carbonCredit.setMinter(owner.address, true);
        await verificationEngine.setCircuitBreaker(await circuitBreaker.getAddress());
        await circuitBreaker.registerContract(await verificationEngine.getAddress());
        await circuitBreaker.pauseContract(await verificationEngine.getAddress(), "test");

        await expect(
            carbonCredit.mintVerifiedCredits(
                owner.address,
                dacUnitId,
                sourceDataHash,
                1_710_000_000,
                1_000_000,
                350_000,
                24_453_884,
                54_377_344,
                98,
                50,
                "ipfs://cb-test",
                "arweave-cb-test"
            )
        ).to.be.revertedWithCustomError(verificationEngine, "CircuitBreakerBlocked");
    });

    it("blocks GaslessMarketplace listings when the circuit breaker pauses the contract", async function () {
        const [owner, seller] = await ethers.getSigners();

        const AccessControlFactory = await ethers.getContractFactory("TerraQuraAccessControl");
        const accessControl = await upgrades.deployProxy(
            AccessControlFactory,
            [owner.address],
            { initializer: "initialize" }
        );
        await accessControl.waitForDeployment();

        const MockERC1155Factory = await ethers.getContractFactory("MockERC1155");
        const mockToken = await MockERC1155Factory.deploy();
        await mockToken.waitForDeployment();

        const ForwarderFactory = await ethers.getContractFactory("TerraQuraForwarder");
        const forwarder = await ForwarderFactory.deploy();
        await forwarder.waitForDeployment();

        const MarketplaceFactory = await ethers.getContractFactory("GaslessMarketplace");
        const marketplace = await upgrades.deployProxy(
            MarketplaceFactory,
            [await accessControl.getAddress(), await mockToken.getAddress(), await forwarder.getAddress()],
            { initializer: "initialize" }
        );
        await marketplace.waitForDeployment();

        const CircuitBreakerFactory = await ethers.getContractFactory("CircuitBreaker");
        const circuitBreaker = await upgrades.deployProxy(
            CircuitBreakerFactory,
            [owner.address],
            { initializer: "initialize" }
        );
        await circuitBreaker.waitForDeployment();

        await marketplace.setCircuitBreaker(await circuitBreaker.getAddress());
        await circuitBreaker.registerContract(await marketplace.getAddress());

        await mockToken.mint(seller.address, 1, 100, "0x");
        await mockToken.connect(seller).setApprovalForAll(await marketplace.getAddress(), true);

        await circuitBreaker.pauseContract(await marketplace.getAddress(), "test");

        await expect(
            marketplace.connect(seller).createListing(1, 10, ethers.parseEther("0.01"))
        ).to.be.revertedWithCustomError(marketplace, "CircuitBreakerBlocked");
    });
});
