import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("Modifier Tests (Coverage)", function () {
    let modifierContract: any;
    let owner: SignerWithAddress;
    let user: SignerWithAddress;

    beforeEach(async function () {
        [owner, user] = await ethers.getSigners();

        const Factory = await ethers.getContractFactory("ModifierTestContract");
        modifierContract = await Factory.deploy();
        await modifierContract.waitForDeployment();
    });

    describe("onlyKycVerified modifier", function () {
        it("should allow access for verified account", async function () {
            await modifierContract.setupVerifiedAccount(user.address);
            expect(await modifierContract.protectedByKyc(user.address)).to.be.true;
        });

        it("should revert for unverified account", async function () {
            await modifierContract.setupUnverifiedAccount(user.address);
            await expect(
                modifierContract.protectedByKyc(user.address)
            ).to.be.revertedWithCustomError(modifierContract, "KycNotVerified");
        });

        it("should revert for account without sanctions clearance", async function () {
            await modifierContract.setupAccountWithoutSanctions(user.address);
            await expect(
                modifierContract.protectedByKyc(user.address)
            ).to.be.revertedWithCustomError(modifierContract, "KycNotVerified");
        });
    });

    describe("onlySanctionsCleared modifier", function () {
        it("should allow access for sanctions cleared account", async function () {
            await modifierContract.setupVerifiedAccount(user.address);
            expect(await modifierContract.protectedBySanctions(user.address)).to.be.true;
        });

        it("should revert for account without sanctions clearance", async function () {
            await modifierContract.setupAccountWithoutSanctions(user.address);
            await expect(
                modifierContract.protectedBySanctions(user.address)
            ).to.be.revertedWithCustomError(modifierContract, "SanctionsNotCleared");
        });

        it("should revert for completely unverified account", async function () {
            await modifierContract.setupUnverifiedAccount(user.address);
            await expect(
                modifierContract.protectedBySanctions(user.address)
            ).to.be.revertedWithCustomError(modifierContract, "SanctionsNotCleared");
        });
    });

    describe("Combined modifiers", function () {
        it("should allow access when both conditions met", async function () {
            await modifierContract.setupVerifiedAccount(user.address);
            expect(await modifierContract.protectedByBoth(user.address)).to.be.true;
        });

        it("should revert when KYC not met", async function () {
            await modifierContract.setupUnverifiedAccount(user.address);
            await modifierContract.setSanctionsCleared(user.address, true);
            await expect(
                modifierContract.protectedByBoth(user.address)
            ).to.be.revertedWithCustomError(modifierContract, "KycNotVerified");
        });

        it("should revert when sanctions not cleared (KYC check fails first)", async function () {
            // setupAccountWithoutSanctions sets status=VERIFIED but sanctionsCleared=false
            // isKycVerified returns false because it requires sanctionsCleared=true
            // So the onlyKycVerified modifier (which comes first) will fail
            await modifierContract.setupAccountWithoutSanctions(user.address);
            await expect(
                modifierContract.protectedByBoth(user.address)
            ).to.be.revertedWithCustomError(modifierContract, "KycNotVerified");
        });
    });
});
