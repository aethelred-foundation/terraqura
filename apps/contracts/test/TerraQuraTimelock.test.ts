import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { TerraQuraTimelock } from "../typechain-types";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("TerraQuraTimelock", function () {
    let timelock: TerraQuraTimelock;
    let proposer: SignerWithAddress;
    let executor: SignerWithAddress;
    let admin: SignerWithAddress;
    let target: SignerWithAddress;

    const MIN_DELAY_TESTNET = 3600; // 1 hour for testnet
    const MIN_DELAY_PRODUCTION = 172800; // 2 days for production

    beforeEach(async function () {
        [admin, proposer, executor, target] = await ethers.getSigners();

        const TimelockFactory = await ethers.getContractFactory("TerraQuraTimelock");
        timelock = await TimelockFactory.deploy(
            MIN_DELAY_TESTNET,
            [proposer.address],
            [executor.address],
            admin.address,
            false // testnet mode
        ) as unknown as TerraQuraTimelock;
        await timelock.waitForDeployment();

        // Fund timelock for operations
        await admin.sendTransaction({
            to: await timelock.getAddress(),
            value: ethers.parseEther("10")
        });
    });

    describe("Deployment", function () {
        it("should set correct minimum delay", async function () {
            expect(await timelock.getMinDelay()).to.equal(MIN_DELAY_TESTNET);
        });

        it("should set production flag correctly", async function () {
            expect(await timelock.isProduction()).to.be.false;
        });

        it("should grant proposer role", async function () {
            const PROPOSER_ROLE = await timelock.PROPOSER_ROLE();
            expect(await timelock.hasRole(PROPOSER_ROLE, proposer.address)).to.be.true;
        });

        it("should grant executor role", async function () {
            const EXECUTOR_ROLE = await timelock.EXECUTOR_ROLE();
            expect(await timelock.hasRole(EXECUTOR_ROLE, executor.address)).to.be.true;
        });

        it("should have correct constants", async function () {
            expect(await timelock.MIN_DELAY_PRODUCTION()).to.equal(MIN_DELAY_PRODUCTION);
            expect(await timelock.MIN_DELAY_TESTNET()).to.equal(3600);
        });
    });

    describe("Production Deployment", function () {
        it("should require 2-day minimum for production", async function () {
            const TimelockFactory = await ethers.getContractFactory("TerraQuraTimelock");

            await expect(
                TimelockFactory.deploy(
                    3600, // Only 1 hour - too short for production
                    [proposer.address],
                    [executor.address],
                    admin.address,
                    true // production mode
                )
            ).to.be.revertedWith("Production delay must be >= 2 days");
        });

        it("should deploy with 2-day delay for production", async function () {
            const TimelockFactory = await ethers.getContractFactory("TerraQuraTimelock");

            const prodTimelock = await TimelockFactory.deploy(
                MIN_DELAY_PRODUCTION,
                [proposer.address],
                [executor.address],
                admin.address,
                true
            );

            expect(await prodTimelock.isProduction()).to.be.true;
            expect(await prodTimelock.getMinDelay()).to.equal(MIN_DELAY_PRODUCTION);
        });
    });

    describe("Testnet Deployment", function () {
        it("should require 1-hour minimum for testnet", async function () {
            const TimelockFactory = await ethers.getContractFactory("TerraQuraTimelock");

            await expect(
                TimelockFactory.deploy(
                    60, // Only 1 minute - too short
                    [proposer.address],
                    [executor.address],
                    admin.address,
                    false
                )
            ).to.be.revertedWith("Testnet delay must be >= 1 hour");
        });
    });

    describe("Operation Scheduling", function () {
        let target_address: string;
        let value: bigint;
        let data: string;
        let predecessor: string;
        let salt: string;

        beforeEach(function () {
            target_address = target.address;
            value = ethers.parseEther("1");
            data = "0x";
            predecessor = ethers.ZeroHash;
            salt = ethers.keccak256(ethers.toUtf8Bytes("salt"));
        });

        it("should schedule operation", async function () {
            const id = await timelock.hashOperation(target_address, value, data, predecessor, salt);

            await timelock.connect(proposer).schedule(
                target_address,
                value,
                data,
                predecessor,
                salt,
                MIN_DELAY_TESTNET
            );

            expect(await timelock.isOperation(id)).to.be.true;
            expect(await timelock.isOperationPending(id)).to.be.true;
        });

        it("should only allow proposer to schedule", async function () {
            await expect(
                timelock.connect(executor).schedule(
                    target_address,
                    value,
                    data,
                    predecessor,
                    salt,
                    MIN_DELAY_TESTNET
                )
            ).to.be.reverted;
        });

        it("should execute operation after delay", async function () {
            const id = await timelock.hashOperation(target_address, value, data, predecessor, salt);

            await timelock.connect(proposer).schedule(
                target_address,
                value,
                data,
                predecessor,
                salt,
                MIN_DELAY_TESTNET
            );

            // Fast forward past delay
            await time.increase(MIN_DELAY_TESTNET + 1);

            const balanceBefore = await ethers.provider.getBalance(target_address);

            await timelock.connect(executor).execute(
                target_address,
                value,
                data,
                predecessor,
                salt
            );

            const balanceAfter = await ethers.provider.getBalance(target_address);
            expect(balanceAfter - balanceBefore).to.equal(value);
            expect(await timelock.isOperationDone(id)).to.be.true;
        });

        it("should not execute before delay", async function () {
            await timelock.connect(proposer).schedule(
                target_address,
                value,
                data,
                predecessor,
                salt,
                MIN_DELAY_TESTNET
            );

            // Don't wait, try to execute immediately
            await expect(
                timelock.connect(executor).execute(
                    target_address,
                    value,
                    data,
                    predecessor,
                    salt
                )
            ).to.be.reverted;
        });
    });

    describe("Operation Cancellation", function () {
        it("should cancel pending operation", async function () {
            const target_address = target.address;
            const value = ethers.parseEther("1");
            const data = "0x";
            const predecessor = ethers.ZeroHash;
            const salt = ethers.keccak256(ethers.toUtf8Bytes("cancel-test"));

            const id = await timelock.hashOperation(target_address, value, data, predecessor, salt);

            await timelock.connect(proposer).schedule(
                target_address,
                value,
                data,
                predecessor,
                salt,
                MIN_DELAY_TESTNET
            );

            expect(await timelock.isOperationPending(id)).to.be.true;

            // Cancel using the CANCELLER_ROLE (proposer has this by default)
            await timelock.connect(proposer).cancel(id);

            expect(await timelock.isOperation(id)).to.be.false;
        });
    });

    describe("Recommended Delay", function () {
        it("should return minimum delay for standard operations", async function () {
            const delay = await timelock.getRecommendedDelay(0);
            expect(delay).to.equal(MIN_DELAY_TESTNET);
        });

        it("should return 2x delay for critical operations", async function () {
            const delay = await timelock.getRecommendedDelay(1);
            expect(delay).to.equal(MIN_DELAY_TESTNET * 2);
        });

        it("should return minimum delay for emergency operations", async function () {
            const delay = await timelock.getRecommendedDelay(2);
            expect(delay).to.equal(MIN_DELAY_TESTNET);
        });
    });

    describe("Operation Status", function () {
        it("should return correct status for non-existent operation", async function () {
            const fakeId = ethers.keccak256(ethers.toUtf8Bytes("fake"));
            const [ready, timeRemaining] = await timelock.getOperationStatus(fakeId);

            expect(ready).to.be.false;
            expect(timeRemaining).to.equal(0);
        });

        it("should return correct status for pending operation", async function () {
            const target_address = target.address;
            const value = ethers.parseEther("1");
            const data = "0x";
            const predecessor = ethers.ZeroHash;
            const salt = ethers.keccak256(ethers.toUtf8Bytes("status-test"));

            const id = await timelock.hashOperation(target_address, value, data, predecessor, salt);

            await timelock.connect(proposer).schedule(
                target_address,
                value,
                data,
                predecessor,
                salt,
                MIN_DELAY_TESTNET
            );

            const [ready, timeRemaining] = await timelock.getOperationStatus(id);

            expect(ready).to.be.false;
            expect(timeRemaining).to.be.gt(0);
        });

        it("should return ready status after delay", async function () {
            const target_address = target.address;
            const value = ethers.parseEther("1");
            const data = "0x";
            const predecessor = ethers.ZeroHash;
            const salt = ethers.keccak256(ethers.toUtf8Bytes("ready-test"));

            const id = await timelock.hashOperation(target_address, value, data, predecessor, salt);

            await timelock.connect(proposer).schedule(
                target_address,
                value,
                data,
                predecessor,
                salt,
                MIN_DELAY_TESTNET
            );

            // Fast forward
            await time.increase(MIN_DELAY_TESTNET + 1);

            const [ready, timeRemaining] = await timelock.getOperationStatus(id);

            expect(ready).to.be.true;
            expect(timeRemaining).to.equal(0);
        });
    });

    describe("Batch Operations", function () {
        it("should schedule and execute batch operations", async function () {
            const targets = [target.address, target.address];
            const values = [ethers.parseEther("0.5"), ethers.parseEther("0.5")];
            const payloads = ["0x", "0x"];
            const predecessor = ethers.ZeroHash;
            const salt = ethers.keccak256(ethers.toUtf8Bytes("batch-test"));

            await timelock.connect(proposer).scheduleBatch(
                targets,
                values,
                payloads,
                predecessor,
                salt,
                MIN_DELAY_TESTNET
            );

            // Fast forward
            await time.increase(MIN_DELAY_TESTNET + 1);

            const balanceBefore = await ethers.provider.getBalance(target.address);

            await timelock.connect(executor).executeBatch(
                targets,
                values,
                payloads,
                predecessor,
                salt
            );

            const balanceAfter = await ethers.provider.getBalance(target.address);
            expect(balanceAfter - balanceBefore).to.equal(ethers.parseEther("1"));
        });
    });
});
