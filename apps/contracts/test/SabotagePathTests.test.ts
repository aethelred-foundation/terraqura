import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-network-helpers";

/**
 * @title Sabotage Path Tests
 * @notice Tests targeting "unhappy paths" that require intentional sabotage
 * @dev These tests achieve coverage on edge cases that normal testing misses:
 * - CarbonCredit: Mint to a contract that rejects tokens
 * - TerraQuraTimelock: Cancel and attempt to execute a "zombie" operation
 * - VerificationEngine: MINT verification failure via hash poisoning
 */
describe("Sabotage Path Tests", function () {

    describe("CarbonCredit - Poisoned Receiver (MintRejector)", function () {
        let carbonCredit: any;
        let verificationEngine: any;
        let accessControl: any;
        let mintRejector: any;
        let owner: SignerWithAddress;
        let operator: SignerWithAddress;

        beforeEach(async function () {
            [owner, operator] = await ethers.getSigners();

            // Deploy MintRejector (the saboteur)
            const MintRejectorFactory = await ethers.getContractFactory("MintRejector");
            mintRejector = await MintRejectorFactory.deploy();
            await mintRejector.waitForDeployment();

            // Deploy access control
            const ACFactory = await ethers.getContractFactory("TerraQuraAccessControl");
            accessControl = await upgrades.deployProxy(ACFactory, [owner.address], { initializer: "initialize" });
            await accessControl.waitForDeployment();

            // Deploy verification engine
            const VEFactory = await ethers.getContractFactory("VerificationEngine");
            verificationEngine = await upgrades.deployProxy(
                VEFactory,
                [await accessControl.getAddress(), ethers.ZeroAddress],
                { initializer: "initialize" }
            );
            await verificationEngine.waitForDeployment();

            // Deploy carbon credit
            const CCFactory = await ethers.getContractFactory("CarbonCredit");
            carbonCredit = await upgrades.deployProxy(
                CCFactory,
                [
                    await verificationEngine.getAddress(),
                    "https://api.terraqura.aethelred.network/metadata/",
                    owner.address
                ],
                { initializer: "initialize" }
            );
            await carbonCredit.waitForDeployment();

            // Setup verification engine
            await verificationEngine.setCarbonCreditContract(await carbonCredit.getAddress());

            // Grant roles
            const MINTER_ROLE = await accessControl.MINTER_ROLE();
            const OPERATOR_ROLE = await accessControl.OPERATOR_ROLE();
            await accessControl.grantRole(MINTER_ROLE, owner.address);
            await accessControl.grantRole(OPERATOR_ROLE, operator.address);

            // Whitelist a DAC unit
            const dacId = ethers.keccak256(ethers.toUtf8Bytes("test-dac"));
            await verificationEngine.whitelistDacUnit(dacId, operator.address);
        });

        it("should revert when minting to a contract that rejects tokens", async function () {
            const dacId = ethers.keccak256(ethers.toUtf8Bytes("test-dac"));
            const dataHash = ethers.keccak256(ethers.toUtf8Bytes("poisoned-receiver-test"));
            const captureTimestamp = await time.latest();

            // Attempt to mint to the MintRejector
            // All verification passes, but the _mint call fails
            await expect(
                carbonCredit.mintVerifiedCredits(
                    await mintRejector.getAddress(), // The trap!
                    dacId,
                    dataHash,
                    captureTimestamp,
                    1000,  // co2AmountKg
                    350,   // energyConsumedKwh (optimal)
                    0,     // latitude
                    0,     // longitude
                    95,    // purityPercentage
                    50,    // gridIntensity (gCO2/kWh)
                    "ipfs://metadata",
                    ""     // arweave backup
                )
            ).to.be.revertedWith("MintRejector: I reject this mint");
        });
    });

    describe("VerificationEngine - MINT Verification Failure via Hash Poisoning", function () {
        let carbonCredit: any;
        let verificationEngine: any;
        let accessControl: any;
        let owner: SignerWithAddress;
        let operator: SignerWithAddress;
        let attacker: SignerWithAddress;

        beforeEach(async function () {
            [owner, operator, attacker] = await ethers.getSigners();

            // Deploy access control
            const ACFactory = await ethers.getContractFactory("TerraQuraAccessControl");
            accessControl = await upgrades.deployProxy(ACFactory, [owner.address], { initializer: "initialize" });
            await accessControl.waitForDeployment();

            // Deploy verification engine
            const VEFactory = await ethers.getContractFactory("VerificationEngine");
            verificationEngine = await upgrades.deployProxy(
                VEFactory,
                [await accessControl.getAddress(), ethers.ZeroAddress],
                { initializer: "initialize" }
            );
            await verificationEngine.waitForDeployment();

            // Deploy carbon credit
            const CCFactory = await ethers.getContractFactory("CarbonCredit");
            carbonCredit = await upgrades.deployProxy(
                CCFactory,
                [
                    await verificationEngine.getAddress(),
                    "https://api.terraqura.aethelred.network/metadata/",
                    owner.address
                ],
                { initializer: "initialize" }
            );
            await carbonCredit.waitForDeployment();

            // Setup verification engine with CarbonCredit
            await verificationEngine.setCarbonCreditContract(await carbonCredit.getAddress());

            // Grant roles
            const MINTER_ROLE = await accessControl.MINTER_ROLE();
            const OPERATOR_ROLE = await accessControl.OPERATOR_ROLE();
            await accessControl.grantRole(MINTER_ROLE, owner.address);
            await accessControl.grantRole(OPERATOR_ROLE, operator.address);

            // Whitelist DAC unit
            const dacId = ethers.keccak256(ethers.toUtf8Bytes("test-dac"));
            await verificationEngine.whitelistDacUnit(dacId, operator.address);
        });

        it("should mark hash as processed in VerificationEngine after successful mint", async function () {
            const dacId = ethers.keccak256(ethers.toUtf8Bytes("test-dac"));
            const dataHash = ethers.keccak256(ethers.toUtf8Bytes("hash-tracking-test"));
            const captureTimestamp = await time.latest();

            // First mint should succeed
            await carbonCredit.mintVerifiedCredits(
                owner.address,
                dacId,
                dataHash,
                captureTimestamp,
                1000,
                350,
                0,
                0,
                95,
                50,    // gridIntensity (gCO2/kWh)
                "ipfs://metadata",
                ""
            );

            // Verify the hash is marked as processed in VerificationEngine
            expect(await verificationEngine.isHashProcessed(dataHash)).to.be.true;
        });
    });

    describe("TerraQuraTimelock - Zombie Operation (Cancel then Execute)", function () {
        let timelock: any;
        let owner: SignerWithAddress;
        let proposer: SignerWithAddress;
        let executor: SignerWithAddress;
        let canceller: SignerWithAddress;

        const MIN_DELAY = 3600; // 1 hour

        beforeEach(async function () {
            [owner, proposer, executor, canceller] = await ethers.getSigners();

            const Factory = await ethers.getContractFactory("TerraQuraTimelock");
            timelock = await Factory.deploy(
                MIN_DELAY,
                [proposer.address], // proposers
                [executor.address], // executors
                owner.address,      // admin
                false               // not production
            );
            await timelock.waitForDeployment();

            // Grant canceller role to canceller
            const CANCELLER_ROLE = await timelock.CANCELLER_ROLE();
            await timelock.grantRole(CANCELLER_ROLE, canceller.address);
        });

        it("should revert when executing a cancelled (zombie) operation", async function () {
            // 1. Setup a valid proposal
            const target = owner.address; // Just a target address
            const value = 0;
            const data = "0x"; // Empty calldata
            const predecessor = ethers.ZeroHash;
            const salt = ethers.keccak256(ethers.toUtf8Bytes("zombie-test-salt"));

            // 2. Schedule the operation
            await timelock.connect(proposer).schedule(
                target,
                value,
                data,
                predecessor,
                salt,
                MIN_DELAY
            );

            // Get the operation ID
            const operationId = await timelock.hashOperation(target, value, data, predecessor, salt);

            // Verify it's scheduled
            expect(await timelock.isOperation(operationId)).to.be.true;
            expect(await timelock.isOperationPending(operationId)).to.be.true;

            // 3. Cancel the operation - This creates a "zombie"
            await timelock.connect(canceller).cancel(operationId);

            // Verify it's cancelled (no longer an operation)
            expect(await timelock.isOperation(operationId)).to.be.false;

            // 4. Try to execute the cancelled operation
            // This should fail because the operation no longer exists
            // OpenZeppelin 4.x uses string-based require, 5.x uses custom errors
            await expect(
                timelock.connect(executor).execute(target, value, data, predecessor, salt)
            ).to.be.revertedWith("TimelockController: operation is not ready");
        });

        it("should return (false, 0) for cancelled operation in getOperationStatus", async function () {
            const target = owner.address;
            const value = 0;
            const data = "0x";
            const predecessor = ethers.ZeroHash;
            const salt = ethers.keccak256(ethers.toUtf8Bytes("status-test-salt"));

            // Schedule
            await timelock.connect(proposer).schedule(
                target,
                value,
                data,
                predecessor,
                salt,
                MIN_DELAY
            );

            const operationId = await timelock.hashOperation(target, value, data, predecessor, salt);

            // Before cancellation - should be pending
            let [ready, timeRemaining] = await timelock.getOperationStatus(operationId);
            expect(ready).to.be.false;
            expect(timeRemaining).to.be.gt(0);

            // Cancel
            await timelock.connect(canceller).cancel(operationId);

            // After cancellation - should return (false, 0) because isOperation returns false
            [ready, timeRemaining] = await timelock.getOperationStatus(operationId);
            expect(ready).to.be.false;
            expect(timeRemaining).to.equal(0);
        });

        it("should allow scheduling the same operation again after cancellation", async function () {
            const target = owner.address;
            const value = 0;
            const data = "0x";
            const predecessor = ethers.ZeroHash;
            const salt = ethers.keccak256(ethers.toUtf8Bytes("reschedule-test"));

            // Schedule
            await timelock.connect(proposer).schedule(
                target,
                value,
                data,
                predecessor,
                salt,
                MIN_DELAY
            );

            const operationId = await timelock.hashOperation(target, value, data, predecessor, salt);

            // Cancel
            await timelock.connect(canceller).cancel(operationId);

            // Re-schedule the same operation
            await timelock.connect(proposer).schedule(
                target,
                value,
                data,
                predecessor,
                salt,
                MIN_DELAY
            );

            // Should be pending again
            expect(await timelock.isOperationPending(operationId)).to.be.true;

            // Fast forward and execute
            await time.increase(MIN_DELAY + 1);
            await timelock.connect(executor).execute(target, value, data, predecessor, salt);

            // Should now be done
            expect(await timelock.isOperationDone(operationId)).to.be.true;
        });

        it("should track full lifecycle: schedule -> ready -> execute -> done", async function () {
            const target = owner.address;
            const value = 0;
            const data = "0x";
            const predecessor = ethers.ZeroHash;
            const salt = ethers.keccak256(ethers.toUtf8Bytes("lifecycle-test"));

            // Schedule
            await timelock.connect(proposer).schedule(
                target,
                value,
                data,
                predecessor,
                salt,
                MIN_DELAY
            );

            const operationId = await timelock.hashOperation(target, value, data, predecessor, salt);

            // State 1: Pending (not ready)
            expect(await timelock.isOperationPending(operationId)).to.be.true;
            expect(await timelock.isOperationReady(operationId)).to.be.false;
            expect(await timelock.isOperationDone(operationId)).to.be.false;

            let [ready, timeRemaining] = await timelock.getOperationStatus(operationId);
            expect(ready).to.be.false;
            expect(timeRemaining).to.be.gt(0);

            // Fast forward past delay
            await time.increase(MIN_DELAY + 1);

            // State 2: Ready (can execute)
            expect(await timelock.isOperationPending(operationId)).to.be.true;
            expect(await timelock.isOperationReady(operationId)).to.be.true;
            expect(await timelock.isOperationDone(operationId)).to.be.false;

            [ready, timeRemaining] = await timelock.getOperationStatus(operationId);
            expect(ready).to.be.true;
            expect(timeRemaining).to.equal(0);

            // Execute
            await timelock.connect(executor).execute(target, value, data, predecessor, salt);

            // State 3: Done
            expect(await timelock.isOperationPending(operationId)).to.be.false;
            expect(await timelock.isOperationReady(operationId)).to.be.false;
            expect(await timelock.isOperationDone(operationId)).to.be.true;
        });
    });

    describe("Additional Edge Cases", function () {
        describe("CarbonCredit - Zero Amount Edge Case", function () {
            let carbonCredit: any;
            let verificationEngine: any;
            let accessControl: any;
            let owner: SignerWithAddress;
            let operator: SignerWithAddress;

            beforeEach(async function () {
                [owner, operator] = await ethers.getSigners();

                const ACFactory = await ethers.getContractFactory("TerraQuraAccessControl");
                accessControl = await upgrades.deployProxy(ACFactory, [owner.address], { initializer: "initialize" });
                await accessControl.waitForDeployment();

                const VEFactory = await ethers.getContractFactory("VerificationEngine");
                verificationEngine = await upgrades.deployProxy(
                    VEFactory,
                    [await accessControl.getAddress(), ethers.ZeroAddress],
                    { initializer: "initialize" }
                );
                await verificationEngine.waitForDeployment();

                const CCFactory = await ethers.getContractFactory("CarbonCredit");
                carbonCredit = await upgrades.deployProxy(
                    CCFactory,
                    [
                        await verificationEngine.getAddress(),
                        "https://api.terraqura.aethelred.network/metadata/",
                        owner.address
                    ],
                    { initializer: "initialize" }
                );
                await carbonCredit.waitForDeployment();

                await verificationEngine.setCarbonCreditContract(await carbonCredit.getAddress());

                const MINTER_ROLE = await accessControl.MINTER_ROLE();
                const OPERATOR_ROLE = await accessControl.OPERATOR_ROLE();
                await accessControl.grantRole(MINTER_ROLE, owner.address);
                await accessControl.grantRole(OPERATOR_ROLE, operator.address);

                const dacId = ethers.keccak256(ethers.toUtf8Bytes("test-dac"));
                await verificationEngine.whitelistDacUnit(dacId, operator.address);
            });

            it("should reject very small CO2 amounts that are net-negative", async function () {
                const dacId = ethers.keccak256(ethers.toUtf8Bytes("test-dac"));
                const dataHash = ethers.keccak256(ethers.toUtf8Bytes("small-amount-test"));
                const captureTimestamp = await time.latest();

                // 1 kg CO2 with 350 kWh at gridIntensity=50 means:
                //   energyDebt = 350 * 50 / 1000 = 17.5 kg CO2
                //   grossCredits = 1 * 0.95 = 0.95 kg CO2
                // Net is negative → verification rejects (correct behavior)
                await expect(
                    carbonCredit.mintVerifiedCredits(
                        owner.address,
                        dacId,
                        dataHash,
                        captureTimestamp,
                        1,     // Just 1 kg — net-negative at any grid intensity > 0
                        350,   // 350 kWh/tonne (thermodynamically plausible)
                        0,
                        0,
                        95,
                        50,    // gridIntensity (gCO2/kWh)
                        "ipfs://metadata",
                        ""
                    )
                ).to.be.revertedWithCustomError(carbonCredit, "VerificationFailed");
            });

            it("should handle small CO2 with zero-carbon energy (pure renewable)", async function () {
                const dacId = ethers.keccak256(ethers.toUtf8Bytes("test-dac"));
                const dataHash = ethers.keccak256(ethers.toUtf8Bytes("small-renewable-test"));
                const captureTimestamp = await time.latest();

                // With gridIntensity=0 (pure renewable), energyDebt=0.
                // Use 1000 kg (1 tonne) to ensure mintable credits > 0 after rounding.
                const tx = await carbonCredit.mintVerifiedCredits(
                    owner.address,
                    dacId,
                    dataHash,
                    captureTimestamp,
                    1000,  // 1 tonne (avoids sub-integer rounding to 0)
                    350,   // 350 kWh/tonne (optimal)
                    0,
                    0,
                    95,
                    0,     // gridIntensity=0 (100% renewable energy)
                    "ipfs://metadata",
                    ""
                );

                const receipt = await tx.wait();
                expect(receipt!.status).to.equal(1);

                const totalMinted = await carbonCredit.totalCreditsMinted();
                expect(totalMinted).to.be.gt(0);
            });
        });
    });
});
