import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { ITMORegistry, TerraQuraAccessControl } from "../typechain-types";

describe("ITMORegistry", function () {
    async function deployFixture() {
        const [admin, complianceOfficer, other] = await ethers.getSigners();

        const ACFactory = await ethers.getContractFactory("TerraQuraAccessControl");
        const accessControl = (await upgrades.deployProxy(ACFactory, [admin.address], {
            initializer: "initialize",
        })) as unknown as TerraQuraAccessControl;
        await accessControl.waitForDeployment();

        const COMPLIANCE_ROLE = await accessControl.COMPLIANCE_ROLE();
        await accessControl.connect(admin).grantRole(COMPLIANCE_ROLE, complianceOfficer.address);

        const ITMOFactory = await ethers.getContractFactory("ITMORegistry");
        const registry = (await upgrades.deployProxy(
            ITMOFactory,
            [await accessControl.getAddress()],
            { initializer: "initialize" }
        )) as unknown as ITMORegistry;
        await registry.waitForDeployment();

        return { registry, accessControl, admin, complianceOfficer, other };
    }

    const BR = ethers.encodeBytes32String("BR").slice(0, 6) as `0x${string}`;
    const CH = ethers.encodeBytes32String("CH").slice(0, 6) as `0x${string}`;
    const JP = ethers.encodeBytes32String("JP").slice(0, 6) as `0x${string}`;

    describe("Register Transfer", function () {
        it("should register a transfer", async function () {
            const { registry, complianceOfficer } = await loadFixture(deployFixture);
            await expect(
                registry.connect(complianceOfficer).registerTransfer(1, BR, CH, 1000, 2025)
            ).to.emit(registry, "TransferRegistered")
                .withArgs(1, 1, BR, CH, 1000, 2025);
        });

        it("should assign incremental transfer IDs", async function () {
            const { registry, complianceOfficer } = await loadFixture(deployFixture);
            await registry.connect(complianceOfficer).registerTransfer(1, BR, CH, 1000, 2025);
            await registry.connect(complianceOfficer).registerTransfer(2, BR, JP, 500, 2025);

            const t1 = await registry.getTransfer(1);
            expect(t1.id).to.equal(1);
            const t2 = await registry.getTransfer(2);
            expect(t2.id).to.equal(2);
        });

        it("should revert same country", async function () {
            const { registry, complianceOfficer } = await loadFixture(deployFixture);
            await expect(
                registry.connect(complianceOfficer).registerTransfer(1, BR, BR, 1000, 2025)
            ).to.be.revertedWithCustomError(registry, "SameCountry");
        });

        it("should revert zero amount", async function () {
            const { registry, complianceOfficer } = await loadFixture(deployFixture);
            await expect(
                registry.connect(complianceOfficer).registerTransfer(1, BR, CH, 0, 2025)
            ).to.be.revertedWithCustomError(registry, "InvalidAmount");
        });

        it("should revert zero country code", async function () {
            const { registry, complianceOfficer } = await loadFixture(deployFixture);
            await expect(
                registry.connect(complianceOfficer).registerTransfer(1, "0x0000", CH, 1000, 2025)
            ).to.be.revertedWithCustomError(registry, "InvalidCountryCode");
        });

        it("should revert unauthorized register", async function () {
            const { registry, other } = await loadFixture(deployFixture);
            await expect(
                registry.connect(other).registerTransfer(1, BR, CH, 1000, 2025)
            ).to.be.revertedWithCustomError(registry, "Unauthorized");
        });

        it("should prevent double counting (same credit, same from/to)", async function () {
            const { registry, complianceOfficer } = await loadFixture(deployFixture);
            await registry.connect(complianceOfficer).registerTransfer(1, BR, CH, 1000, 2025);
            await expect(
                registry.connect(complianceOfficer).registerTransfer(1, BR, CH, 500, 2025)
            ).to.be.revertedWithCustomError(registry, "TransferAlreadyExists");
        });
    });

    describe("Authorize Transfer", function () {
        async function registeredFixture() {
            const base = await deployFixture();
            await base.registry.connect(base.complianceOfficer).registerTransfer(1, BR, CH, 1000, 2025);
            return base;
        }

        it("should authorize and apply corresponding adjustment", async function () {
            const { registry, complianceOfficer } = await loadFixture(registeredFixture);
            await expect(registry.connect(complianceOfficer).authorizeTransfer(1))
                .to.emit(registry, "TransferAuthorized")
                .withArgs(1, BR);

            const t = await registry.getTransfer(1);
            expect(t.status).to.equal(1); // Authorized
            expect(t.correspondingAdjustment).to.be.true;

            const balance = await registry.getCountryBalance(BR);
            expect(balance.totalTransferredOut).to.equal(1000);
            expect(balance.netBalance).to.equal(-1000);
        });

        it("should revert if not pending", async function () {
            const { registry, complianceOfficer } = await loadFixture(registeredFixture);
            await registry.connect(complianceOfficer).authorizeTransfer(1);
            await expect(
                registry.connect(complianceOfficer).authorizeTransfer(1)
            ).to.be.revertedWithCustomError(registry, "TransferNotPending");
        });
    });

    describe("Confirm Transfer", function () {
        async function authorizedFixture() {
            const base = await deployFixture();
            await base.registry.connect(base.complianceOfficer).registerTransfer(1, BR, CH, 1000, 2025);
            await base.registry.connect(base.complianceOfficer).authorizeTransfer(1);
            return base;
        }

        it("should confirm and credit destination country", async function () {
            const { registry, complianceOfficer } = await loadFixture(authorizedFixture);
            await expect(registry.connect(complianceOfficer).confirmTransfer(1))
                .to.emit(registry, "TransferConfirmed")
                .withArgs(1, CH);

            const t = await registry.getTransfer(1);
            expect(t.status).to.equal(2); // Confirmed

            const balance = await registry.getCountryBalance(CH);
            expect(balance.totalTransferredIn).to.equal(1000);
            expect(balance.netBalance).to.equal(1000);
        });

        it("should revert if not authorized", async function () {
            const base = await deployFixture();
            await base.registry.connect(base.complianceOfficer).registerTransfer(1, BR, CH, 1000, 2025);
            // Try to confirm without authorizing
            await expect(
                base.registry.connect(base.complianceOfficer).confirmTransfer(1)
            ).to.be.revertedWithCustomError(base.registry, "TransferNotAuthorized");
        });
    });

    describe("Reject Transfer", function () {
        it("should reject a pending transfer", async function () {
            const { registry, complianceOfficer } = await loadFixture(deployFixture);
            await registry.connect(complianceOfficer).registerTransfer(1, BR, CH, 1000, 2025);
            await expect(registry.connect(complianceOfficer).rejectTransfer(1))
                .to.emit(registry, "TransferRejected")
                .withArgs(1);
        });

        it("should reject an authorized transfer and reverse adjustment", async function () {
            const { registry, complianceOfficer } = await loadFixture(deployFixture);
            await registry.connect(complianceOfficer).registerTransfer(1, BR, CH, 1000, 2025);
            await registry.connect(complianceOfficer).authorizeTransfer(1);

            // Before reject: BR has -1000
            let balance = await registry.getCountryBalance(BR);
            expect(balance.netBalance).to.equal(-1000);

            await registry.connect(complianceOfficer).rejectTransfer(1);

            // After reject: BR back to 0
            balance = await registry.getCountryBalance(BR);
            expect(balance.netBalance).to.equal(0);
            expect(balance.totalTransferredOut).to.equal(0);
        });

        it("should allow re-registration after rejection", async function () {
            const { registry, complianceOfficer } = await loadFixture(deployFixture);
            await registry.connect(complianceOfficer).registerTransfer(1, BR, CH, 1000, 2025);
            await registry.connect(complianceOfficer).rejectTransfer(1);

            // Should be able to register again
            await expect(
                registry.connect(complianceOfficer).registerTransfer(1, BR, CH, 500, 2025)
            ).to.emit(registry, "TransferRegistered");
        });

        it("should revert rejecting a confirmed transfer", async function () {
            const { registry, complianceOfficer } = await loadFixture(deployFixture);
            await registry.connect(complianceOfficer).registerTransfer(1, BR, CH, 1000, 2025);
            await registry.connect(complianceOfficer).authorizeTransfer(1);
            await registry.connect(complianceOfficer).confirmTransfer(1);

            await expect(
                registry.connect(complianceOfficer).rejectTransfer(1)
            ).to.be.revertedWithCustomError(registry, "TransferAlreadyProcessed");
        });
    });

    describe("Country Balance and History", function () {
        it("should track transfer history per country", async function () {
            const { registry, complianceOfficer } = await loadFixture(deployFixture);
            await registry.connect(complianceOfficer).registerTransfer(1, BR, CH, 1000, 2025);
            await registry.connect(complianceOfficer).registerTransfer(2, BR, JP, 500, 2025);

            const history = await registry.getTransferHistory(BR);
            expect(history.length).to.equal(2);
        });

        it("should track origination via registerOrigination", async function () {
            const { registry, complianceOfficer } = await loadFixture(deployFixture);
            await registry.connect(complianceOfficer).registerOrigination(BR, 5000);

            const balance = await registry.getCountryBalance(BR);
            expect(balance.totalOriginated).to.equal(5000);
            expect(balance.netBalance).to.equal(5000);
        });

        it("should compute correct net balance after origination and transfer", async function () {
            const { registry, complianceOfficer } = await loadFixture(deployFixture);
            await registry.connect(complianceOfficer).registerOrigination(BR, 5000);
            await registry.connect(complianceOfficer).registerTransfer(1, BR, CH, 1000, 2025);
            await registry.connect(complianceOfficer).authorizeTransfer(1);
            await registry.connect(complianceOfficer).confirmTransfer(1);

            const brBalance = await registry.getCountryBalance(BR);
            expect(brBalance.netBalance).to.equal(4000); // 5000 - 1000

            const chBalance = await registry.getCountryBalance(CH);
            expect(chBalance.netBalance).to.equal(1000);
        });
    });
});
