import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { ComplianceRegistry, TerraQuraAccessControl } from "../typechain-types";

describe("ComplianceRegistry", function () {
    async function deployFixture() {
        const [admin, complianceOfficer, entity, other] = await ethers.getSigners();

        const ACFactory = await ethers.getContractFactory("TerraQuraAccessControl");
        const accessControl = (await upgrades.deployProxy(ACFactory, [admin.address], {
            initializer: "initialize",
        })) as unknown as TerraQuraAccessControl;
        await accessControl.waitForDeployment();

        // Grant COMPLIANCE_ROLE
        const COMPLIANCE_ROLE = await accessControl.COMPLIANCE_ROLE();
        await accessControl.connect(admin).grantRole(COMPLIANCE_ROLE, complianceOfficer.address);

        const CRFactory = await ethers.getContractFactory("ComplianceRegistry");
        const registry = (await upgrades.deployProxy(
            CRFactory,
            [await accessControl.getAddress()],
            { initializer: "initialize" }
        )) as unknown as ComplianceRegistry;
        await registry.waitForDeployment();

        return { registry, accessControl, admin, complianceOfficer, entity, other };
    }

    const US = ethers.encodeBytes32String("US").slice(0, 6) as `0x${string}`;
    const EU = ethers.encodeBytes32String("EU").slice(0, 6) as `0x${string}`;
    const JP = ethers.encodeBytes32String("JP").slice(0, 6) as `0x${string}`;

    // ComplianceStatus: Pending=0, Compliant=1, NonCompliant=2, Suspended=3, Expired=4
    const PENDING = 0;
    const COMPLIANT = 1;
    const NONCOMPLIANT = 2;
    const SUSPENDED = 3;

    describe("Initialization", function () {
        it("should register supported standards on init", async function () {
            const { registry } = await loadFixture(deployFixture);
            const standards = await registry.getSupportedStandards();
            expect(standards).to.include("Verra VCS");
            expect(standards).to.include("Gold Standard");
            expect(standards).to.include("CORSIA");
            expect(standards).to.include("EU-ETS");
            expect(standards.length).to.equal(7);
        });
    });

    describe("Jurisdiction Management", function () {
        it("should register a jurisdiction", async function () {
            const { registry, admin } = await loadFixture(deployFixture);
            await expect(registry.connect(admin).registerJurisdiction(US, "United States", true, 100))
                .to.emit(registry, "JurisdictionRegistered")
                .withArgs(US, "United States", true, 100);

            const jur = await registry.getJurisdiction(US);
            expect(jur.name).to.equal("United States");
            expect(jur.article6Eligible).to.be.true;
            expect(jur.taxRate).to.equal(100);
            expect(jur.active).to.be.true;
        });

        it("should revert duplicate jurisdiction", async function () {
            const { registry, admin } = await loadFixture(deployFixture);
            await registry.connect(admin).registerJurisdiction(US, "United States", true, 100);
            await expect(
                registry.connect(admin).registerJurisdiction(US, "USA", true, 200)
            ).to.be.revertedWithCustomError(registry, "JurisdictionAlreadyRegistered");
        });

        it("should revert zero country code", async function () {
            const { registry, admin } = await loadFixture(deployFixture);
            await expect(
                registry.connect(admin).registerJurisdiction("0x0000", "None", false, 0)
            ).to.be.revertedWithCustomError(registry, "InvalidCountryCode");
        });

        it("should revert non-admin registering jurisdiction", async function () {
            const { registry, other } = await loadFixture(deployFixture);
            await expect(
                registry.connect(other).registerJurisdiction(US, "United States", true, 100)
            ).to.be.revertedWithCustomError(registry, "Unauthorized");
        });

        it("should track jurisdiction count", async function () {
            const { registry, admin } = await loadFixture(deployFixture);
            await registry.connect(admin).registerJurisdiction(US, "United States", true, 100);
            await registry.connect(admin).registerJurisdiction(EU, "European Union", true, 200);
            expect(await registry.getJurisdictionCount()).to.equal(2);
        });
    });

    describe("Entity Compliance", function () {
        async function jurisdictionFixture() {
            const base = await deployFixture();
            await base.registry.connect(base.admin).registerJurisdiction(US, "United States", true, 100);
            await base.registry.connect(base.admin).registerJurisdiction(EU, "European Union", true, 200);
            return base;
        }

        it("should set entity compliance", async function () {
            const { registry, complianceOfficer, entity } = await loadFixture(jurisdictionFixture);
            const expiry = (await time.latest()) + 365 * 24 * 60 * 60;

            await expect(
                registry.connect(complianceOfficer).setEntityCompliance(entity.address, US, COMPLIANT, expiry)
            ).to.emit(registry, "ComplianceUpdated");
        });

        it("should return compliant for valid entity", async function () {
            const { registry, complianceOfficer, entity } = await loadFixture(jurisdictionFixture);
            const expiry = (await time.latest()) + 365 * 24 * 60 * 60;
            await registry.connect(complianceOfficer).setEntityCompliance(entity.address, US, COMPLIANT, expiry);

            expect(await registry.isCompliant(entity.address, US)).to.be.true;
        });

        it("should return non-compliant for expired entity", async function () {
            const { registry, complianceOfficer, entity } = await loadFixture(jurisdictionFixture);
            const expiry = (await time.latest()) + 10;
            await registry.connect(complianceOfficer).setEntityCompliance(entity.address, US, COMPLIANT, expiry);

            await time.increase(20);
            expect(await registry.isCompliant(entity.address, US)).to.be.false;
        });

        it("should return non-compliant for non-compliant status", async function () {
            const { registry, complianceOfficer, entity } = await loadFixture(jurisdictionFixture);
            const expiry = (await time.latest()) + 365 * 24 * 60 * 60;
            await registry.connect(complianceOfficer).setEntityCompliance(entity.address, US, NONCOMPLIANT, expiry);

            expect(await registry.isCompliant(entity.address, US)).to.be.false;
        });

        it("should return non-compliant for suspended status", async function () {
            const { registry, complianceOfficer, entity } = await loadFixture(jurisdictionFixture);
            const expiry = (await time.latest()) + 365 * 24 * 60 * 60;
            await registry.connect(complianceOfficer).setEntityCompliance(entity.address, US, SUSPENDED, expiry);

            expect(await registry.isCompliant(entity.address, US)).to.be.false;
        });

        it("should revert on unregistered jurisdiction", async function () {
            const { registry, complianceOfficer, entity } = await loadFixture(jurisdictionFixture);
            const expiry = (await time.latest()) + 365 * 24 * 60 * 60;
            await expect(
                registry.connect(complianceOfficer).setEntityCompliance(entity.address, JP, COMPLIANT, expiry)
            ).to.be.revertedWithCustomError(registry, "JurisdictionNotRegistered");
        });

        it("should revert compliant with past expiry", async function () {
            const { registry, complianceOfficer, entity } = await loadFixture(jurisdictionFixture);
            await expect(
                registry.connect(complianceOfficer).setEntityCompliance(entity.address, US, COMPLIANT, 1)
            ).to.be.revertedWithCustomError(registry, "InvalidExpiry");
        });

        it("should revert unauthorized entity compliance update", async function () {
            const { registry, other, entity } = await loadFixture(jurisdictionFixture);
            const expiry = (await time.latest()) + 365 * 24 * 60 * 60;
            await expect(
                registry.connect(other).setEntityCompliance(entity.address, US, COMPLIANT, expiry)
            ).to.be.revertedWithCustomError(registry, "Unauthorized");
        });
    });

    describe("Credit Compliance", function () {
        async function jurisdictionFixture() {
            const base = await deployFixture();
            await base.registry.connect(base.admin).registerJurisdiction(US, "United States", true, 100);
            return base;
        }

        it("should set credit compliance", async function () {
            const { registry, complianceOfficer } = await loadFixture(jurisdictionFixture);
            await expect(
                registry.connect(complianceOfficer).setCreditCompliance(1, US, true, "Verra VCS")
            ).to.emit(registry, "CreditComplianceSet");
        });

        it("should check credit compliance", async function () {
            const { registry, complianceOfficer } = await loadFixture(jurisdictionFixture);
            await registry.connect(complianceOfficer).setCreditCompliance(1, US, true, "Verra VCS");
            expect(await registry.isCreditCompliant(1, US)).to.be.true;
        });

        it("should return false for non-compliant credit", async function () {
            const { registry, complianceOfficer } = await loadFixture(jurisdictionFixture);
            await registry.connect(complianceOfficer).setCreditCompliance(1, US, false, "Verra VCS");
            expect(await registry.isCreditCompliant(1, US)).to.be.false;
        });
    });

    describe("Compliance Report", function () {
        it("should return full compliance report", async function () {
            const { registry, admin, complianceOfficer, entity } = await loadFixture(deployFixture);
            await registry.connect(admin).registerJurisdiction(US, "United States", true, 100);
            await registry.connect(admin).registerJurisdiction(EU, "European Union", true, 200);

            const expiry = (await time.latest()) + 365 * 24 * 60 * 60;
            await registry.connect(complianceOfficer).setEntityCompliance(entity.address, US, COMPLIANT, expiry);
            await registry.connect(complianceOfficer).setEntityCompliance(entity.address, EU, PENDING, 0);

            const report = await registry.getComplianceReport(entity.address);
            expect(report.entity).to.equal(entity.address);
            expect(report.jurisdictions.length).to.equal(2);
            expect(report.statuses[0]).to.equal(COMPLIANT);
            expect(report.statuses[1]).to.equal(PENDING);
        });
    });
});
