import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { TerraQuraAccessControl } from "../typechain-types";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("TerraQuraAccessControl", function () {
    let accessControl: TerraQuraAccessControl;
    let admin: SignerWithAddress;
    let operator: SignerWithAddress;
    let compliance: SignerWithAddress;
    let user: SignerWithAddress;

    // Role constants
    let ADMIN_ROLE: string;
    let OPERATOR_ROLE: string;
    let COMPLIANCE_ROLE: string;
    let MINTER_ROLE: string;

    beforeEach(async function () {
        [admin, operator, compliance, user] = await ethers.getSigners();

        const AccessControlFactory = await ethers.getContractFactory("TerraQuraAccessControl");
        accessControl = await upgrades.deployProxy(
            AccessControlFactory,
            [admin.address],
            { initializer: "initialize" }
        ) as unknown as TerraQuraAccessControl;
        await accessControl.waitForDeployment();

        // Get role constants
        ADMIN_ROLE = await accessControl.ADMIN_ROLE();
        OPERATOR_ROLE = await accessControl.OPERATOR_ROLE();
        COMPLIANCE_ROLE = await accessControl.COMPLIANCE_ROLE();
        MINTER_ROLE = await accessControl.MINTER_ROLE();

        // Grant compliance role for KYC tests
        await accessControl.grantRole(COMPLIANCE_ROLE, compliance.address);
    });

    describe("Initialization", function () {
        it("should set admin with correct roles", async function () {
            expect(await accessControl.hasRole(ADMIN_ROLE, admin.address)).to.be.true;
            expect(await accessControl.hasRole(await accessControl.UPGRADER_ROLE(), admin.address)).to.be.true;
            expect(await accessControl.hasRole(await accessControl.PAUSER_ROLE(), admin.address)).to.be.true;
        });

        it("should set default KYC validity period", async function () {
            const expectedPeriod = 365 * 24 * 60 * 60; // 1 year in seconds
            expect(await accessControl.kycValidityPeriod()).to.equal(expectedPeriod);
        });
    });

    describe("Role Management", function () {
        it("should grant role", async function () {
            await accessControl.grantRole(OPERATOR_ROLE, operator.address);
            expect(await accessControl.hasRole(OPERATOR_ROLE, operator.address)).to.be.true;
        });

        it("should revoke role", async function () {
            await accessControl.grantRole(OPERATOR_ROLE, operator.address);
            await accessControl.revokeRole(OPERATOR_ROLE, operator.address);
            expect(await accessControl.hasRole(OPERATOR_ROLE, operator.address)).to.be.false;
        });

        it("should only allow admin to grant roles", async function () {
            await expect(
                accessControl.connect(user).grantRole(OPERATOR_ROLE, operator.address)
            ).to.be.reverted;
        });
    });

    describe("Role Expiration (Fixed Bug)", function () {
        it("should grant role with expiry", async function () {
            const expiresAt = (await time.latest()) + 86400; // 1 day from now

            await expect(
                accessControl.grantRoleWithExpiry(OPERATOR_ROLE, operator.address, expiresAt)
            ).to.emit(accessControl, "RoleGrantedWithExpiry")
                .withArgs(OPERATOR_ROLE, operator.address, expiresAt);

            expect(await accessControl.hasRole(OPERATOR_ROLE, operator.address)).to.be.true;
            expect(await accessControl.roleExpiration(OPERATOR_ROLE, operator.address)).to.equal(expiresAt);
        });

        it("should revert if expiry is in the past", async function () {
            const pastTime = (await time.latest()) - 100;

            await expect(
                accessControl.grantRoleWithExpiry(OPERATOR_ROLE, operator.address, pastTime)
            ).to.be.revertedWith("Expiry must be in future");
        });

        it("should correctly report expired roles", async function () {
            const expiresAt = (await time.latest()) + 100; // 100 seconds from now

            await accessControl.grantRoleWithExpiry(OPERATOR_ROLE, operator.address, expiresAt);

            // Before expiry
            expect(await accessControl.isRoleExpired(OPERATOR_ROLE, operator.address)).to.be.false;
            expect(await accessControl.hasValidRole(OPERATOR_ROLE, operator.address)).to.be.true;

            // Move time forward past expiry
            await time.increase(200);

            // After expiry
            expect(await accessControl.isRoleExpired(OPERATOR_ROLE, operator.address)).to.be.true;
            expect(await accessControl.hasValidRole(OPERATOR_ROLE, operator.address)).to.be.false;
        });

        it("should allow revoking expired roles", async function () {
            const expiresAt = (await time.latest()) + 100;
            await accessControl.grantRoleWithExpiry(OPERATOR_ROLE, operator.address, expiresAt);

            // Move time forward past expiry
            await time.increase(200);

            // Anyone can revoke expired roles
            await accessControl.connect(user).revokeExpiredRole(OPERATOR_ROLE, operator.address);

            expect(await accessControl.hasRole(OPERATOR_ROLE, operator.address)).to.be.false;
        });

        it("should not allow revoking non-expired roles via revokeExpiredRole", async function () {
            const expiresAt = (await time.latest()) + 86400;
            await accessControl.grantRoleWithExpiry(OPERATOR_ROLE, operator.address, expiresAt);

            await expect(
                accessControl.connect(user).revokeExpiredRole(OPERATOR_ROLE, operator.address)
            ).to.be.revertedWithCustomError(accessControl, "RoleExpired");
        });

        it("should extend role expiry", async function () {
            const initialExpiry = (await time.latest()) + 86400;
            await accessControl.grantRoleWithExpiry(OPERATOR_ROLE, operator.address, initialExpiry);

            const newExpiry = initialExpiry + 86400; // Extend by 1 more day
            await accessControl.extendRoleExpiry(OPERATOR_ROLE, operator.address, newExpiry);

            expect(await accessControl.roleExpiration(OPERATOR_ROLE, operator.address)).to.equal(newExpiry);
        });

        it("should not allow reducing expiry via extend", async function () {
            const initialExpiry = (await time.latest()) + 86400;
            await accessControl.grantRoleWithExpiry(OPERATOR_ROLE, operator.address, initialExpiry);

            const earlierExpiry = initialExpiry - 1000;
            await expect(
                accessControl.extendRoleExpiry(OPERATOR_ROLE, operator.address, earlierExpiry)
            ).to.be.revertedWith("Can only extend, not reduce");
        });

        it("should treat roles without expiry as permanent", async function () {
            // Grant role without expiry (standard grantRole)
            await accessControl.grantRole(OPERATOR_ROLE, operator.address);

            // Expiration should be 0
            expect(await accessControl.roleExpiration(OPERATOR_ROLE, operator.address)).to.equal(0);

            // Should not be expired
            expect(await accessControl.isRoleExpired(OPERATOR_ROLE, operator.address)).to.be.false;
            expect(await accessControl.hasValidRole(OPERATOR_ROLE, operator.address)).to.be.true;
        });
    });

    describe("KYC Management", function () {
        const KycStatus = {
            NONE: 0,
            PENDING: 1,
            VERIFIED: 2,
            REJECTED: 3,
            EXPIRED: 4
        };

        it("should update KYC status", async function () {
            const applicantIdHash = ethers.keccak256(ethers.toUtf8Bytes("applicant-123"));

            await expect(
                accessControl.connect(compliance).updateKycStatus(
                    user.address,
                    KycStatus.VERIFIED,
                    "sumsub",
                    applicantIdHash
                )
            ).to.emit(accessControl, "KycStatusUpdated");

            // Need sanctions clearance for full KYC verification
            await accessControl.connect(compliance).updateSanctionsStatus(user.address, true);

            expect(await accessControl.isKycVerified(user.address)).to.be.true;
        });

        it("should reject KYC update from non-compliance role", async function () {
            await expect(
                accessControl.connect(user).updateKycStatus(
                    operator.address,
                    KycStatus.VERIFIED,
                    "sumsub",
                    ethers.ZeroHash
                )
            ).to.be.reverted;
        });

        it("should set correct expiration for KYC", async function () {
            const applicantIdHash = ethers.keccak256(ethers.toUtf8Bytes("applicant-123"));
            const beforeTime = await time.latest();

            await accessControl.connect(compliance).updateKycStatus(
                user.address,
                KycStatus.VERIFIED,
                "sumsub",
                applicantIdHash
            );

            const kycInfo = await accessControl.getKycInfo(user.address);
            const expectedExpiry = beforeTime + 365 * 24 * 60 * 60;

            // Allow 10 second tolerance for block timestamp
            expect(kycInfo.expiresAt).to.be.closeTo(expectedExpiry, 10);
        });

        it("should expire KYC after validity period", async function () {
            const applicantIdHash = ethers.keccak256(ethers.toUtf8Bytes("applicant-123"));

            await accessControl.connect(compliance).updateKycStatus(
                user.address,
                KycStatus.VERIFIED,
                "sumsub",
                applicantIdHash
            );

            // Update sanctions status
            await accessControl.connect(compliance).updateSanctionsStatus(user.address, true);

            expect(await accessControl.isKycVerified(user.address)).to.be.true;

            // Fast forward past KYC validity
            await time.increase(366 * 24 * 60 * 60);

            expect(await accessControl.isKycVerified(user.address)).to.be.false;
        });

        it("should require sanctions clearance for KYC verification", async function () {
            const applicantIdHash = ethers.keccak256(ethers.toUtf8Bytes("applicant-123"));

            await accessControl.connect(compliance).updateKycStatus(
                user.address,
                KycStatus.VERIFIED,
                "sumsub",
                applicantIdHash
            );

            // Without sanctions clearance
            expect(await accessControl.isKycVerified(user.address)).to.be.false;

            // With sanctions clearance
            await accessControl.connect(compliance).updateSanctionsStatus(user.address, true);
            expect(await accessControl.isKycVerified(user.address)).to.be.true;
        });

        it("should batch update KYC status", async function () {
            const accounts = [user.address, operator.address];

            await accessControl.connect(compliance).batchUpdateKycStatus(
                accounts,
                KycStatus.VERIFIED,
                "sumsub"
            );

            // Set sanctions for both
            await accessControl.connect(compliance).updateSanctionsStatus(user.address, true);
            await accessControl.connect(compliance).updateSanctionsStatus(operator.address, true);

            expect(await accessControl.isKycVerified(user.address)).to.be.true;
            expect(await accessControl.isKycVerified(operator.address)).to.be.true;
        });
    });

    describe("Pause Functionality", function () {
        it("should emergency pause", async function () {
            await expect(accessControl.emergencyPause("Security incident"))
                .to.emit(accessControl, "EmergencyPause")
                .withArgs(admin.address, "Security incident");

            expect(await accessControl.paused()).to.be.true;
        });

        it("should only allow admin to unpause", async function () {
            await accessControl.emergencyPause("Test");

            await expect(
                accessControl.connect(user).unpause()
            ).to.be.reverted;

            await accessControl.unpause();
            expect(await accessControl.paused()).to.be.false;
        });

        it("should allow pauser role to pause", async function () {
            await accessControl.grantRole(await accessControl.PAUSER_ROLE(), operator.address);

            await accessControl.connect(operator).emergencyPause("Operator pause");
            expect(await accessControl.paused()).to.be.true;
        });
    });

    describe("Combined Role and KYC Check", function () {
        it("should check both role and KYC", async function () {
            await accessControl.grantRole(OPERATOR_ROLE, operator.address);

            // Has role but not KYC
            expect(await accessControl.hasRoleAndKyc(OPERATOR_ROLE, operator.address)).to.be.false;

            // Add KYC
            await accessControl.connect(compliance).updateKycStatus(
                operator.address,
                2, // VERIFIED
                "sumsub",
                ethers.keccak256(ethers.toUtf8Bytes("op-123"))
            );
            await accessControl.connect(compliance).updateSanctionsStatus(operator.address, true);

            // Now has both
            expect(await accessControl.hasRoleAndKyc(OPERATOR_ROLE, operator.address)).to.be.true;
        });
    });

    describe("KYC Edge Cases", function () {
        const KycStatus = {
            NONE: 0,
            PENDING: 1,
            VERIFIED: 2,
            REJECTED: 3,
            EXPIRED: 4
        };

        it("should revert updateKycStatus with empty provider for VERIFIED status", async function () {
            await expect(
                accessControl.connect(compliance).updateKycStatus(
                    user.address,
                    KycStatus.VERIFIED,
                    "", // Empty provider
                    ethers.ZeroHash
                )
            ).to.be.revertedWithCustomError(accessControl, "InvalidKycProvider");
        });

        it("should allow empty provider for non-VERIFIED status", async function () {
            await accessControl.connect(compliance).updateKycStatus(
                user.address,
                KycStatus.PENDING,
                "", // Empty provider is OK for PENDING
                ethers.ZeroHash
            );

            const kycInfo = await accessControl.getKycInfo(user.address);
            expect(kycInfo.status).to.equal(KycStatus.PENDING);
        });

        it("should set expiresAt to 0 for non-VERIFIED status", async function () {
            await accessControl.connect(compliance).updateKycStatus(
                user.address,
                KycStatus.REJECTED,
                "sumsub",
                ethers.ZeroHash
            );

            const kycInfo = await accessControl.getKycInfo(user.address);
            expect(kycInfo.expiresAt).to.equal(0);
            expect(kycInfo.verifiedAt).to.equal(0);
        });

        it("should preserve sanctionsCleared status when updating KYC", async function () {
            // First set sanctions cleared
            await accessControl.connect(compliance).updateSanctionsStatus(user.address, true);

            // Then update KYC - sanctions should be preserved
            await accessControl.connect(compliance).updateKycStatus(
                user.address,
                KycStatus.VERIFIED,
                "sumsub",
                ethers.keccak256(ethers.toUtf8Bytes("app-123"))
            );

            const kycInfo = await accessControl.getKycInfo(user.address);
            expect(kycInfo.sanctionsCleared).to.be.true;
        });

        it("should set KYC validity period", async function () {
            const newPeriod = 180 * 24 * 60 * 60; // 6 months
            await accessControl.setKycValidityPeriod(newPeriod);
            expect(await accessControl.kycValidityPeriod()).to.equal(newPeriod);
        });

        it("should only allow admin to set KYC validity period", async function () {
            await expect(
                accessControl.connect(user).setKycValidityPeriod(100)
            ).to.be.reverted;
        });

        it("should update sanctions status", async function () {
            await expect(
                accessControl.connect(compliance).updateSanctionsStatus(user.address, true)
            ).to.emit(accessControl, "SanctionsStatusUpdated")
                .withArgs(user.address, true);
        });
    });

    describe("Role Expiry Edge Cases", function () {
        it("should revert extendRoleExpiry for account without role", async function () {
            const futureTime = (await time.latest()) + 86400;
            await expect(
                accessControl.extendRoleExpiry(OPERATOR_ROLE, operator.address, futureTime)
            ).to.be.revertedWith("Account does not have role");
        });

        it("should revert extendRoleExpiry with past time", async function () {
            const expiresAt = (await time.latest()) + 86400;
            await accessControl.grantRoleWithExpiry(OPERATOR_ROLE, operator.address, expiresAt);

            const pastTime = (await time.latest()) - 100;
            await expect(
                accessControl.extendRoleExpiry(OPERATOR_ROLE, operator.address, pastTime)
            ).to.be.revertedWith("New expiry must be in future");
        });

        it("should only allow role admin to grant role with expiry", async function () {
            const futureTime = (await time.latest()) + 86400;
            await expect(
                accessControl.connect(user).grantRoleWithExpiry(OPERATOR_ROLE, operator.address, futureTime)
            ).to.be.reverted;
        });
    });

    describe("Interface Support", function () {
        it("should support AccessControl interface", async function () {
            // AccessControl interface ID: 0x7965db0b
            expect(await accessControl.supportsInterface("0x7965db0b")).to.be.true;
        });

        it("should support ERC165 interface", async function () {
            // ERC165 interface ID: 0x01ffc9a7
            expect(await accessControl.supportsInterface("0x01ffc9a7")).to.be.true;
        });
    });
});
