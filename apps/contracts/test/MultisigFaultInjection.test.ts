import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

/**
 * @title Multisig Fault Injection Tests
 * @notice Tests for TerraQuraMultisig error paths using fault injection
 * @dev These tests achieve 100% coverage on the ExecutionFailed() error path
 *      by using a SilentReverter contract that reverts without error data.
 */
describe("TerraQuraMultisig - Fault Injection Tests", function () {
    let multisig: any;
    let silentReverter: any;
    let signer1: SignerWithAddress;
    let signer2: SignerWithAddress;
    let signer3: SignerWithAddress;

    beforeEach(async function () {
        [signer1, signer2, signer3] = await ethers.getSigners();

        // Deploy SilentReverter
        const SilentReverterFactory = await ethers.getContractFactory("SilentReverter");
        silentReverter = await SilentReverterFactory.deploy();
        await silentReverter.waitForDeployment();

        // Deploy Multisig with 2-of-3 threshold
        const MultisigFactory = await ethers.getContractFactory("TerraQuraMultisig");
        multisig = await MultisigFactory.deploy(
            [signer1.address, signer2.address, signer3.address],
            2  // 2-of-3 threshold
        );
        await multisig.waitForDeployment();
    });

    describe("ExecutionFailed() Coverage via Silent Revert", function () {
        it("should revert with ExecutionFailed when target reverts without data (covers line 307)", async function () {
            // Encode a call to the silentRevert function
            const callData = silentReverter.interface.encodeFunctionData("silentRevert");

            // Submit transaction to call silentRevert on SilentReverter
            await multisig.connect(signer1).submitTransaction(
                await silentReverter.getAddress(),
                0,  // no ETH
                callData
            );

            // Confirm with signer2 (signer1 auto-confirmed on submit)
            await multisig.connect(signer2).confirmTransaction(0);

            // Execute - should trigger ExecutionFailed() because silentRevert
            // reverts with empty data (result.length == 0)
            await expect(
                multisig.connect(signer1).executeTransaction(0)
            ).to.be.revertedWithCustomError(multisig, "ExecutionFailed");
        });

        it("should bubble up error data when target reverts with data", async function () {
            // Encode a call to the normalRevert function
            const callData = silentReverter.interface.encodeFunctionData("normalRevert");

            // Submit transaction
            await multisig.connect(signer1).submitTransaction(
                await silentReverter.getAddress(),
                0,
                callData
            );

            // Confirm with signer2
            await multisig.connect(signer2).confirmTransaction(0);

            // Execute - should bubble up the revert reason
            await expect(
                multisig.connect(signer1).executeTransaction(0)
            ).to.be.revertedWith("This is a normal revert with error data");
        });

        it("should succeed when target function succeeds", async function () {
            // Encode a call to the succeed function
            const callData = silentReverter.interface.encodeFunctionData("succeed");

            // Submit transaction
            await multisig.connect(signer1).submitTransaction(
                await silentReverter.getAddress(),
                0,
                callData
            );

            // Confirm with signer2
            await multisig.connect(signer2).confirmTransaction(0);

            // Execute - should succeed
            await expect(
                multisig.connect(signer1).executeTransaction(0)
            ).to.emit(multisig, "TransactionExecuted").withArgs(0, signer1.address);
        });

        it("should revert with ExecutionFailed on silent ETH transfer failure", async function () {
            // Fund the multisig with some ETH
            await signer1.sendTransaction({
                to: await multisig.getAddress(),
                value: ethers.parseEther("1")
            });

            // Submit transaction to send ETH to SilentReverter (its receive() silently reverts)
            await multisig.connect(signer1).submitTransaction(
                await silentReverter.getAddress(),
                ethers.parseEther("0.1"),  // send 0.1 ETH
                "0x"  // empty data
            );

            // Confirm with signer2
            await multisig.connect(signer2).confirmTransaction(0);

            // Execute - should trigger ExecutionFailed because receive() silently reverts
            await expect(
                multisig.connect(signer1).executeTransaction(0)
            ).to.be.revertedWithCustomError(multisig, "ExecutionFailed");
        });

        it("should revert with ExecutionFailed on unknown function call to SilentReverter", async function () {
            // Encode a call to a non-existent function (will hit fallback)
            const fakeCallData = "0x12345678";  // Random 4-byte selector

            // Submit transaction
            await multisig.connect(signer1).submitTransaction(
                await silentReverter.getAddress(),
                0,
                fakeCallData
            );

            // Confirm with signer2
            await multisig.connect(signer2).confirmTransaction(0);

            // Execute - should trigger ExecutionFailed because fallback silently reverts
            await expect(
                multisig.connect(signer1).executeTransaction(0)
            ).to.be.revertedWithCustomError(multisig, "ExecutionFailed");
        });
    });

    describe("Multi-step Execution Flow", function () {
        it("should handle mix of successful and failing transactions", async function () {
            // First transaction: succeed
            const succeedData = silentReverter.interface.encodeFunctionData("succeed");
            await multisig.connect(signer1).submitTransaction(
                await silentReverter.getAddress(),
                0,
                succeedData
            );
            await multisig.connect(signer2).confirmTransaction(0);
            await multisig.connect(signer1).executeTransaction(0);

            // Second transaction: silent revert
            const silentData = silentReverter.interface.encodeFunctionData("silentRevert");
            await multisig.connect(signer1).submitTransaction(
                await silentReverter.getAddress(),
                0,
                silentData
            );
            await multisig.connect(signer2).confirmTransaction(1);

            await expect(
                multisig.connect(signer1).executeTransaction(1)
            ).to.be.revertedWithCustomError(multisig, "ExecutionFailed");

            // Third transaction: succeed again (proving multisig still works after failed tx)
            await multisig.connect(signer1).submitTransaction(
                await silentReverter.getAddress(),
                0,
                succeedData
            );
            await multisig.connect(signer2).confirmTransaction(2);
            await multisig.connect(signer1).executeTransaction(2);
        });
    });
});
