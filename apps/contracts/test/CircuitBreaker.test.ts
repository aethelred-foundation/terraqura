import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { CircuitBreaker } from "../typechain-types";

describe("CircuitBreaker", function () {
    let circuitBreaker: CircuitBreaker;
    let owner: SignerWithAddress;
    let pauser: SignerWithAddress;
    let contract1: SignerWithAddress;
    let contract2: SignerWithAddress;
    let unauthorized: SignerWithAddress;

    // Security levels enum matching contract
    const SecurityLevel = {
        NORMAL: 0,
        ELEVATED: 1,
        HIGH: 2,
        CRITICAL: 3,
        EMERGENCY: 4
    };

    beforeEach(async function () {
        [owner, pauser, contract1, contract2, unauthorized] = await ethers.getSigners();

        const CircuitBreakerFactory = await ethers.getContractFactory("CircuitBreaker");
        circuitBreaker = await upgrades.deployProxy(
            CircuitBreakerFactory,
            [owner.address],
            { initializer: "initialize" }
        ) as unknown as CircuitBreaker;
        await circuitBreaker.waitForDeployment();

        // Add pauser role
        await circuitBreaker.addPauser(pauser.address);

        // Register contracts for monitoring
        await circuitBreaker.registerContract(contract1.address);
        await circuitBreaker.registerContract(contract2.address);
    });

    describe("Initialization", function () {
        it("should set correct owner", async function () {
            expect(await circuitBreaker.owner()).to.equal(owner.address);
        });

        it("should start with NORMAL security level", async function () {
            expect(await circuitBreaker.globalSecurityLevel()).to.equal(SecurityLevel.NORMAL);
        });

        it("should start with global pause disabled", async function () {
            expect(await circuitBreaker.globalPause()).to.be.false;
        });

        it("should set owner as pauser by default", async function () {
            expect(await circuitBreaker.isPauser(owner.address)).to.be.true;
        });

        it("should set default rate limit", async function () {
            expect(await circuitBreaker.defaultRateLimit()).to.equal(100);
        });

        it("should set default volume limit", async function () {
            expect(await circuitBreaker.defaultVolumeLimit()).to.equal(ethers.parseEther("1000"));
        });
    });

    describe("Pauser Management", function () {
        it("should add pauser", async function () {
            await expect(circuitBreaker.addPauser(unauthorized.address))
                .to.emit(circuitBreaker, "PauserAdded")
                .withArgs(unauthorized.address);

            expect(await circuitBreaker.isPauser(unauthorized.address)).to.be.true;
        });

        it("should remove pauser", async function () {
            await expect(circuitBreaker.removePauser(pauser.address))
                .to.emit(circuitBreaker, "PauserRemoved")
                .withArgs(pauser.address);

            expect(await circuitBreaker.isPauser(pauser.address)).to.be.false;
        });

        it("should only allow owner to add pauser", async function () {
            await expect(
                circuitBreaker.connect(unauthorized).addPauser(unauthorized.address)
            ).to.be.reverted;
        });

        it("should only allow owner to remove pauser", async function () {
            await expect(
                circuitBreaker.connect(unauthorized).removePauser(pauser.address)
            ).to.be.reverted;
        });
    });

    describe("Global Pause", function () {
        it("should activate global pause", async function () {
            await expect(circuitBreaker.connect(pauser).activateGlobalPause("Security incident"))
                .to.emit(circuitBreaker, "GlobalPauseActivated")
                .withArgs(pauser.address, "Security incident");

            expect(await circuitBreaker.globalPause()).to.be.true;
            expect(await circuitBreaker.globalSecurityLevel()).to.equal(SecurityLevel.EMERGENCY);
        });

        it("should deactivate global pause", async function () {
            await circuitBreaker.connect(pauser).activateGlobalPause("Test");

            await expect(circuitBreaker.deactivateGlobalPause())
                .to.emit(circuitBreaker, "GlobalPauseDeactivated")
                .withArgs(owner.address);

            expect(await circuitBreaker.globalPause()).to.be.false;
            expect(await circuitBreaker.globalSecurityLevel()).to.equal(SecurityLevel.ELEVATED);
        });

        it("should only allow pauser to activate global pause", async function () {
            await expect(
                circuitBreaker.connect(unauthorized).activateGlobalPause("Unauthorized")
            ).to.be.revertedWithCustomError(circuitBreaker, "NotPauser");
        });

        it("should only allow owner to deactivate global pause", async function () {
            await circuitBreaker.connect(pauser).activateGlobalPause("Test");

            await expect(
                circuitBreaker.connect(pauser).deactivateGlobalPause()
            ).to.be.reverted;
        });
    });

    describe("Contract Pause", function () {
        it("should pause specific contract", async function () {
            await expect(circuitBreaker.connect(pauser).pauseContract(contract1.address, "Contract issue"))
                .to.emit(circuitBreaker, "ContractPaused")
                .withArgs(contract1.address, pauser.address, "Contract issue");

            const [isPaused, level, pausedAt, pauseReason] = await circuitBreaker.getContractStatus(contract1.address);
            expect(isPaused).to.be.true;
            expect(level).to.equal(SecurityLevel.EMERGENCY);
            expect(pauseReason).to.equal("Contract issue");
        });

        it("should unpause specific contract", async function () {
            await circuitBreaker.connect(pauser).pauseContract(contract1.address, "Test");

            await expect(circuitBreaker.unpauseContract(contract1.address))
                .to.emit(circuitBreaker, "ContractUnpaused")
                .withArgs(contract1.address, owner.address);

            const [isPaused] = await circuitBreaker.getContractStatus(contract1.address);
            expect(isPaused).to.be.false;
        });

        it("should enforce cooldown on unpause", async function () {
            await circuitBreaker.connect(pauser).pauseContract(contract1.address, "Test 1");
            await circuitBreaker.unpauseContract(contract1.address);

            // Immediately pause again
            await circuitBreaker.connect(pauser).pauseContract(contract1.address, "Test 2");

            // Try to unpause immediately - should fail due to cooldown
            await expect(
                circuitBreaker.unpauseContract(contract1.address)
            ).to.be.revertedWithCustomError(circuitBreaker, "CooldownActive");
        });

        it("should not affect other contracts when one is paused", async function () {
            await circuitBreaker.connect(pauser).pauseContract(contract1.address, "Test");

            expect(await circuitBreaker.isOperationAllowed(contract1.address)).to.be.false;
            expect(await circuitBreaker.isOperationAllowed(contract2.address)).to.be.true;
        });
    });

    describe("Security Level", function () {
        it("should set security level", async function () {
            await expect(
                circuitBreaker.connect(pauser).setSecurityLevel(SecurityLevel.HIGH, "Elevated threat")
            ).to.emit(circuitBreaker, "SecurityLevelChanged")
                .withArgs(SecurityLevel.NORMAL, SecurityLevel.HIGH, "Elevated threat");

            expect(await circuitBreaker.globalSecurityLevel()).to.equal(SecurityLevel.HIGH);
        });

        it("should only allow owner to lower security level", async function () {
            await circuitBreaker.connect(pauser).setSecurityLevel(SecurityLevel.HIGH, "Up");

            // Pauser tries to lower - should fail
            await expect(
                circuitBreaker.connect(pauser).setSecurityLevel(SecurityLevel.NORMAL, "Down")
            ).to.be.revertedWithCustomError(circuitBreaker, "SecurityLevelTooHigh");

            // Owner can lower
            await circuitBreaker.setSecurityLevel(SecurityLevel.NORMAL, "Reset");
            expect(await circuitBreaker.globalSecurityLevel()).to.equal(SecurityLevel.NORMAL);
        });

        it("should allow pauser to raise security level", async function () {
            await circuitBreaker.connect(pauser).setSecurityLevel(SecurityLevel.CRITICAL, "Critical threat");
            expect(await circuitBreaker.globalSecurityLevel()).to.equal(SecurityLevel.CRITICAL);
        });
    });

    describe("Rate Limiting", function () {
        it("should allow operations within rate limit", async function () {
            const allowed = await circuitBreaker.checkRateLimit.staticCall(contract1.address);
            expect(allowed).to.be.true;
        });

        it("should track operations and enforce limit", async function () {
            // Set low rate limit for testing
            await circuitBreaker.setRateLimit(contract1.address, 5);

            // Perform 5 operations
            for (let i = 0; i < 5; i++) {
                await circuitBreaker.checkRateLimit(contract1.address);
            }

            // 6th should fail
            const allowed = await circuitBreaker.checkRateLimit.staticCall(contract1.address);
            expect(allowed).to.be.false;
        });

        it("should reset rate limit after time window", async function () {
            await circuitBreaker.setRateLimit(contract1.address, 2);

            // Use up the limit
            await circuitBreaker.checkRateLimit(contract1.address);
            await circuitBreaker.checkRateLimit(contract1.address);

            // Fast forward 1 hour
            await ethers.provider.send("evm_increaseTime", [3601]);
            await ethers.provider.send("evm_mine", []);

            // Should work again
            const allowed = await circuitBreaker.checkRateLimit.staticCall(contract1.address);
            expect(allowed).to.be.true;
        });

        it("should return false when globally paused", async function () {
            await circuitBreaker.connect(pauser).activateGlobalPause("Test");

            const allowed = await circuitBreaker.checkRateLimit.staticCall(contract1.address);
            expect(allowed).to.be.false;
        });

        it("should return false when contract is paused", async function () {
            await circuitBreaker.connect(pauser).pauseContract(contract1.address, "Test");

            const allowed = await circuitBreaker.checkRateLimit.staticCall(contract1.address);
            expect(allowed).to.be.false;
        });
    });

    describe("Volume Limiting", function () {
        it("should allow operations within volume limit", async function () {
            const allowed = await circuitBreaker.checkVolumeLimit.staticCall(
                contract1.address,
                ethers.parseEther("10")
            );
            expect(allowed).to.be.true;
        });

        it("should track volume and enforce limit", async function () {
            // Set low volume limit for testing
            await circuitBreaker.setVolumeLimit(contract1.address, ethers.parseEther("100"));

            // Use 80 ETH
            await circuitBreaker.checkVolumeLimit(contract1.address, ethers.parseEther("80"));

            // Try to use 30 more - should fail (exceeds 100 limit)
            const allowed = await circuitBreaker.checkVolumeLimit.staticCall(
                contract1.address,
                ethers.parseEther("30")
            );
            expect(allowed).to.be.false;
        });

        it("should reset volume after day", async function () {
            await circuitBreaker.setVolumeLimit(contract1.address, ethers.parseEther("100"));

            // Use full limit
            await circuitBreaker.checkVolumeLimit(contract1.address, ethers.parseEther("100"));

            // Fast forward 1 day
            await ethers.provider.send("evm_increaseTime", [86401]);
            await ethers.provider.send("evm_mine", []);

            // Should work again
            const allowed = await circuitBreaker.checkVolumeLimit.staticCall(
                contract1.address,
                ethers.parseEther("50")
            );
            expect(allowed).to.be.true;
        });

        it("should return false when globally paused", async function () {
            await circuitBreaker.connect(pauser).activateGlobalPause("Test");

            const allowed = await circuitBreaker.checkVolumeLimit.staticCall(
                contract1.address,
                ethers.parseEther("1")
            );
            expect(allowed).to.be.false;
        });
    });

    describe("Configuration", function () {
        it("should set rate limit for contract", async function () {
            await circuitBreaker.setRateLimit(contract1.address, 50);

            const limit = await circuitBreaker.rateLimits(contract1.address);
            expect(limit.maxOperationsPerHour).to.equal(50);
        });

        it("should set volume limit for contract", async function () {
            await circuitBreaker.setVolumeLimit(contract1.address, ethers.parseEther("500"));

            const limit = await circuitBreaker.volumeLimits(contract1.address);
            expect(limit.maxDailyVolume).to.equal(ethers.parseEther("500"));
        });

        it("should set default limits", async function () {
            await circuitBreaker.setDefaultLimits(200, ethers.parseEther("2000"));

            expect(await circuitBreaker.defaultRateLimit()).to.equal(200);
            expect(await circuitBreaker.defaultVolumeLimit()).to.equal(ethers.parseEther("2000"));
        });

        it("should register contract", async function () {
            const newContract = unauthorized.address;
            await circuitBreaker.registerContract(newContract);

            const [, level] = await circuitBreaker.getContractStatus(newContract);
            expect(level).to.equal(SecurityLevel.NORMAL);
        });
    });

    describe("View Functions", function () {
        it("should check if operation is allowed", async function () {
            expect(await circuitBreaker.isOperationAllowed(contract1.address)).to.be.true;

            await circuitBreaker.connect(pauser).activateGlobalPause("Test");
            expect(await circuitBreaker.isOperationAllowed(contract1.address)).to.be.false;
        });

        it("should return status summary", async function () {
            const [isGloballyPaused, currentLevel, monitoredCount] = await circuitBreaker.getStatus();

            expect(isGloballyPaused).to.be.false;
            expect(currentLevel).to.equal(SecurityLevel.NORMAL);
            expect(monitoredCount).to.equal(2); // We registered 2 contracts
        });

        it("should return contract status", async function () {
            await circuitBreaker.connect(pauser).pauseContract(contract1.address, "Test reason");

            const [isPaused, level, pausedAt, pauseReason] = await circuitBreaker.getContractStatus(contract1.address);

            expect(isPaused).to.be.true;
            expect(level).to.equal(SecurityLevel.EMERGENCY);
            expect(pausedAt).to.be.gt(0);
            expect(pauseReason).to.equal("Test reason");
        });
    });

    describe("Emergency Scenarios", function () {
        it("should handle multiple contract pauses", async function () {
            await circuitBreaker.connect(pauser).pauseContract(contract1.address, "Issue 1");
            await circuitBreaker.connect(pauser).pauseContract(contract2.address, "Issue 2");

            expect(await circuitBreaker.isOperationAllowed(contract1.address)).to.be.false;
            expect(await circuitBreaker.isOperationAllowed(contract2.address)).to.be.false;
        });

        it("should handle global pause overriding contract state", async function () {
            // Contract 1 is operational
            expect(await circuitBreaker.isOperationAllowed(contract1.address)).to.be.true;

            // Global pause
            await circuitBreaker.connect(pauser).activateGlobalPause("Global emergency");

            // Even unpaused contracts should be blocked
            expect(await circuitBreaker.isOperationAllowed(contract1.address)).to.be.false;
        });

        it("should block at EMERGENCY security level", async function () {
            await circuitBreaker.connect(pauser).setSecurityLevel(SecurityLevel.EMERGENCY, "Max threat");

            expect(await circuitBreaker.isOperationAllowed(contract1.address)).to.be.false;
        });
    });
});
