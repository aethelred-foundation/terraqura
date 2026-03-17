import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { TerraQuraMultisig } from "../typechain-types";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("TerraQuraMultisig", function () {
    let multisig: TerraQuraMultisig;
    let signer1: SignerWithAddress;
    let signer2: SignerWithAddress;
    let signer3: SignerWithAddress;
    let signer4: SignerWithAddress;
    let nonSigner: SignerWithAddress;
    let recipient: SignerWithAddress;

    const THRESHOLD = 2;

    beforeEach(async function () {
        [signer1, signer2, signer3, signer4, nonSigner, recipient] = await ethers.getSigners();

        const MultisigFactory = await ethers.getContractFactory("TerraQuraMultisig");
        multisig = await MultisigFactory.deploy(
            [signer1.address, signer2.address, signer3.address],
            THRESHOLD
        );
        await multisig.waitForDeployment();

        // Fund the multisig
        await signer1.sendTransaction({
            to: await multisig.getAddress(),
            value: ethers.parseEther("10")
        });
    });

    describe("Initialization", function () {
        it("should set correct signers", async function () {
            expect(await multisig.isSigner(signer1.address)).to.be.true;
            expect(await multisig.isSigner(signer2.address)).to.be.true;
            expect(await multisig.isSigner(signer3.address)).to.be.true;
            expect(await multisig.isSigner(nonSigner.address)).to.be.false;
        });

        it("should set correct threshold", async function () {
            expect(await multisig.threshold()).to.equal(THRESHOLD);
        });

        it("should return all signers", async function () {
            const signers = await multisig.getSigners();
            expect(signers).to.have.lengthOf(3);
            expect(signers).to.include(signer1.address);
            expect(signers).to.include(signer2.address);
            expect(signers).to.include(signer3.address);
        });

        it("should reject less than 2 signers", async function () {
            const MultisigFactory = await ethers.getContractFactory("TerraQuraMultisig");
            await expect(
                MultisigFactory.deploy([signer1.address], 1)
            ).to.be.revertedWith("Need at least 2 signers");
        });

        it("should reject threshold higher than signers", async function () {
            const MultisigFactory = await ethers.getContractFactory("TerraQuraMultisig");
            await expect(
                MultisigFactory.deploy([signer1.address, signer2.address], 3)
            ).to.be.revertedWith("Threshold exceeds signers");
        });
    });

    describe("Transaction Submission", function () {
        it("should submit transaction and auto-confirm", async function () {
            const value = ethers.parseEther("1");
            const data = "0x";

            await expect(
                multisig.connect(signer1).submitTransaction(recipient.address, value, data)
            ).to.emit(multisig, "TransactionSubmitted")
                .and.to.emit(multisig, "TransactionConfirmed");

            const tx = await multisig.getTransaction(0);
            expect(tx.to).to.equal(recipient.address);
            expect(tx.value).to.equal(value);
            expect(tx.numConfirmations).to.equal(1); // Auto-confirmed by submitter
            expect(tx.executed).to.be.false;
        });

        it("should reject submission from non-signer", async function () {
            await expect(
                multisig.connect(nonSigner).submitTransaction(recipient.address, 0, "0x")
            ).to.be.revertedWithCustomError(multisig, "NotSigner");
        });

        it("should increment transaction nonce", async function () {
            expect(await multisig.nonce()).to.equal(0);

            await multisig.connect(signer1).submitTransaction(recipient.address, 0, "0x");
            expect(await multisig.nonce()).to.equal(1);

            await multisig.connect(signer1).submitTransaction(recipient.address, 0, "0x");
            expect(await multisig.nonce()).to.equal(2);
        });
    });

    describe("Transaction Confirmation", function () {
        beforeEach(async function () {
            await multisig.connect(signer1).submitTransaction(
                recipient.address,
                ethers.parseEther("1"),
                "0x"
            );
        });

        it("should confirm transaction", async function () {
            await expect(multisig.connect(signer2).confirmTransaction(0))
                .to.emit(multisig, "TransactionConfirmed")
                .withArgs(0, signer2.address);

            const tx = await multisig.getTransaction(0);
            expect(tx.numConfirmations).to.equal(2);
        });

        it("should not allow double confirmation", async function () {
            await expect(
                multisig.connect(signer1).confirmTransaction(0) // Already confirmed by submitter
            ).to.be.revertedWithCustomError(multisig, "AlreadyConfirmed");
        });

        it("should not allow non-signer to confirm", async function () {
            await expect(
                multisig.connect(nonSigner).confirmTransaction(0)
            ).to.be.revertedWithCustomError(multisig, "NotSigner");
        });

        it("should check if signer has confirmed", async function () {
            expect(await multisig.hasConfirmed(0, signer1.address)).to.be.true;
            expect(await multisig.hasConfirmed(0, signer2.address)).to.be.false;

            await multisig.connect(signer2).confirmTransaction(0);
            expect(await multisig.hasConfirmed(0, signer2.address)).to.be.true;
        });
    });

    describe("Transaction Revocation", function () {
        beforeEach(async function () {
            await multisig.connect(signer1).submitTransaction(
                recipient.address,
                ethers.parseEther("1"),
                "0x"
            );
        });

        it("should revoke confirmation", async function () {
            await expect(multisig.connect(signer1).revokeConfirmation(0))
                .to.emit(multisig, "TransactionRevoked")
                .withArgs(0, signer1.address);

            const tx = await multisig.getTransaction(0);
            expect(tx.numConfirmations).to.equal(0);
        });

        it("should not allow revoking non-existent confirmation", async function () {
            await expect(
                multisig.connect(signer2).revokeConfirmation(0)
            ).to.be.revertedWithCustomError(multisig, "NotConfirmed");
        });
    });

    describe("Transaction Execution", function () {
        beforeEach(async function () {
            await multisig.connect(signer1).submitTransaction(
                recipient.address,
                ethers.parseEther("1"),
                "0x"
            );
        });

        it("should execute transaction with enough confirmations", async function () {
            await multisig.connect(signer2).confirmTransaction(0);

            const balanceBefore = await ethers.provider.getBalance(recipient.address);

            await expect(multisig.connect(signer1).executeTransaction(0))
                .to.emit(multisig, "TransactionExecuted")
                .withArgs(0, signer1.address);

            const balanceAfter = await ethers.provider.getBalance(recipient.address);
            expect(balanceAfter - balanceBefore).to.equal(ethers.parseEther("1"));

            const tx = await multisig.getTransaction(0);
            expect(tx.executed).to.be.true;
        });

        it("should not execute without enough confirmations", async function () {
            await expect(
                multisig.connect(signer1).executeTransaction(0)
            ).to.be.revertedWithCustomError(multisig, "TransactionNotConfirmed");
        });

        it("should not execute already executed transaction", async function () {
            await multisig.connect(signer2).confirmTransaction(0);
            await multisig.connect(signer1).executeTransaction(0);

            await expect(
                multisig.connect(signer1).executeTransaction(0)
            ).to.be.revertedWithCustomError(multisig, "TransactionAlreadyExecuted");
        });

        it("should not execute expired transaction", async function () {
            await multisig.connect(signer2).confirmTransaction(0);

            // Fast forward past expiry (default 7 days)
            await time.increase(8 * 24 * 60 * 60);

            await expect(
                multisig.connect(signer1).executeTransaction(0)
            ).to.be.revertedWithCustomError(multisig, "TransactionExpired");
        });
    });

    describe("Transaction with Custom Expiry", function () {
        it("should create transaction with custom expiry", async function () {
            const expiry = 24 * 60 * 60; // 1 day

            await multisig.connect(signer1).submitTransactionWithExpiry(
                recipient.address,
                0,
                "0x",
                expiry
            );

            const tx = await multisig.getTransaction(0);
            const expectedExpiry = (await time.latest()) + expiry;
            expect(tx.expiresAt).to.be.closeTo(expectedExpiry, 5);
        });

        it("should reject too short expiry", async function () {
            await expect(
                multisig.connect(signer1).submitTransactionWithExpiry(
                    recipient.address,
                    0,
                    "0x",
                    60 // 1 minute - too short
                )
            ).to.be.revertedWith("Expiry too short");
        });

        it("should reject too long expiry", async function () {
            await expect(
                multisig.connect(signer1).submitTransactionWithExpiry(
                    recipient.address,
                    0,
                    "0x",
                    31 * 24 * 60 * 60 // 31 days - too long
                )
            ).to.be.revertedWith("Expiry too long");
        });
    });

    describe("Signer Management (via multisig)", function () {
        it("should add signer via multisig transaction", async function () {
            const addSignerData = multisig.interface.encodeFunctionData("addSigner", [signer4.address]);

            await multisig.connect(signer1).submitTransaction(
                await multisig.getAddress(),
                0,
                addSignerData
            );

            await multisig.connect(signer2).confirmTransaction(0);
            await multisig.connect(signer1).executeTransaction(0);

            expect(await multisig.isSigner(signer4.address)).to.be.true;
            expect(await multisig.getSignerCount()).to.equal(4);
        });

        it("should remove signer via multisig transaction", async function () {
            const removeSignerData = multisig.interface.encodeFunctionData("removeSigner", [signer3.address]);

            await multisig.connect(signer1).submitTransaction(
                await multisig.getAddress(),
                0,
                removeSignerData
            );

            await multisig.connect(signer2).confirmTransaction(0);
            await multisig.connect(signer1).executeTransaction(0);

            expect(await multisig.isSigner(signer3.address)).to.be.false;
            expect(await multisig.getSignerCount()).to.equal(2);
        });

        it("should change threshold via multisig transaction", async function () {
            // First add a signer so we can increase threshold
            const addSignerData = multisig.interface.encodeFunctionData("addSigner", [signer4.address]);
            await multisig.connect(signer1).submitTransaction(await multisig.getAddress(), 0, addSignerData);
            await multisig.connect(signer2).confirmTransaction(0);
            await multisig.connect(signer1).executeTransaction(0);

            // Now change threshold
            const changeThresholdData = multisig.interface.encodeFunctionData("changeThreshold", [3]);
            await multisig.connect(signer1).submitTransaction(await multisig.getAddress(), 0, changeThresholdData);
            await multisig.connect(signer2).confirmTransaction(1);
            await multisig.connect(signer1).executeTransaction(1);

            expect(await multisig.threshold()).to.equal(3);
        });

        it("should not allow direct call to add signer", async function () {
            await expect(
                multisig.connect(signer1).addSigner(signer4.address)
            ).to.be.revertedWith("Only via multisig");
        });
    });

    describe("View Functions", function () {
        beforeEach(async function () {
            await multisig.connect(signer1).submitTransaction(
                recipient.address,
                ethers.parseEther("1"),
                "0x"
            );
        });

        it("should return confirmations needed", async function () {
            expect(await multisig.getConfirmationsNeeded(0)).to.equal(1); // Need 1 more

            await multisig.connect(signer2).confirmTransaction(0);
            expect(await multisig.getConfirmationsNeeded(0)).to.equal(0); // Ready to execute
        });

        it("should return correct canExecute status", async function () {
            let tx = await multisig.getTransaction(0);
            expect(tx.canExecute).to.be.false;

            await multisig.connect(signer2).confirmTransaction(0);

            tx = await multisig.getTransaction(0);
            expect(tx.canExecute).to.be.true;
        });
    });
});
