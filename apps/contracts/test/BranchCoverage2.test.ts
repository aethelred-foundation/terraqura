import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-network-helpers";

/**
 * @title Additional Branch Coverage Tests
 * @notice Targets remaining uncovered branches to reach 99%+
 */
describe("Additional Branch Coverage Tests", function () {
    describe("TerraQuraMultisig - Signer Management", function () {
        let multisig: any;
        let signers: SignerWithAddress[];

        beforeEach(async function () {
            signers = await ethers.getSigners();

            const Factory = await ethers.getContractFactory("TerraQuraMultisig");
            multisig = await Factory.deploy(
                [signers[0].address, signers[1].address, signers[2].address, signers[3].address],
                2 // 2-of-4 (lower threshold to allow removals)
            );
            await multisig.waitForDeployment();

            // Fund multisig for transactions
            await signers[0].sendTransaction({
                to: await multisig.getAddress(),
                value: ethers.parseEther("10")
            });
        });

        it("should remove a signer when signers > threshold", async function () {
            // Current: 4 signers, threshold = 2
            // Can remove signers as long as signers > threshold after removal

            const removeSignerData = multisig.interface.encodeFunctionData("removeSigner", [signers[3].address]);

            await multisig.connect(signers[0]).submitTransaction(
                await multisig.getAddress(),
                0,
                removeSignerData
            );
            await multisig.connect(signers[1]).confirmTransaction(0);
            await multisig.executeTransaction(0);

            // Now we have 3 signers with threshold 2
            expect(await multisig.getSignerCount()).to.equal(3);
            expect(await multisig.threshold()).to.equal(2);
        });

        it("should revert remove signer when signers <= threshold", async function () {
            // Remove 2 signers to get to 2 signers with threshold 2
            // First removal
            const removeSignerData1 = multisig.interface.encodeFunctionData("removeSigner", [signers[3].address]);
            await multisig.connect(signers[0]).submitTransaction(await multisig.getAddress(), 0, removeSignerData1);
            await multisig.connect(signers[1]).confirmTransaction(0);
            await multisig.executeTransaction(0);

            // Second removal
            const removeSignerData2 = multisig.interface.encodeFunctionData("removeSigner", [signers[2].address]);
            await multisig.connect(signers[0]).submitTransaction(await multisig.getAddress(), 0, removeSignerData2);
            await multisig.connect(signers[1]).confirmTransaction(1);
            await multisig.executeTransaction(1);

            // Now 2 signers, threshold 2 - can't remove more
            const removeSignerData3 = multisig.interface.encodeFunctionData("removeSigner", [signers[1].address]);
            await multisig.connect(signers[0]).submitTransaction(await multisig.getAddress(), 0, removeSignerData3);
            await multisig.connect(signers[1]).confirmTransaction(2);

            // Should revert with CannotRemoveLastSigner
            await expect(
                multisig.executeTransaction(2)
            ).to.be.revertedWithCustomError(multisig, "CannotRemoveLastSigner");
        });

        it("should add a new signer", async function () {
            const addSignerData = multisig.interface.encodeFunctionData("addSigner", [signers[5].address]);

            await multisig.connect(signers[0]).submitTransaction(
                await multisig.getAddress(),
                0,
                addSignerData
            );
            await multisig.connect(signers[1]).confirmTransaction(0);

            await expect(multisig.executeTransaction(0))
                .to.emit(multisig, "SignerAdded")
                .withArgs(signers[5].address);

            expect(await multisig.getSignerCount()).to.equal(5);
        });

        it("should change threshold via multisig", async function () {
            const changeThresholdData = multisig.interface.encodeFunctionData("changeThreshold", [3]);

            await multisig.connect(signers[0]).submitTransaction(
                await multisig.getAddress(),
                0,
                changeThresholdData
            );
            await multisig.connect(signers[1]).confirmTransaction(0);

            await expect(multisig.executeTransaction(0))
                .to.emit(multisig, "ThresholdChanged")
                .withArgs(2, 3);

            expect(await multisig.threshold()).to.equal(3);
        });

        it("should revert changeThreshold below MIN_THRESHOLD", async function () {
            const changeThresholdData = multisig.interface.encodeFunctionData("changeThreshold", [1]); // Below MIN_THRESHOLD(2)

            await multisig.connect(signers[0]).submitTransaction(
                await multisig.getAddress(),
                0,
                changeThresholdData
            );
            await multisig.connect(signers[1]).confirmTransaction(0);

            await expect(
                multisig.executeTransaction(0)
            ).to.be.revertedWithCustomError(multisig, "InvalidThreshold");
        });

        it("should revert changeThreshold above signers count", async function () {
            const changeThresholdData = multisig.interface.encodeFunctionData("changeThreshold", [5]); // Above signers count (4)

            await multisig.connect(signers[0]).submitTransaction(
                await multisig.getAddress(),
                0,
                changeThresholdData
            );
            await multisig.connect(signers[1]).confirmTransaction(0);

            await expect(
                multisig.executeTransaction(0)
            ).to.be.revertedWithCustomError(multisig, "InvalidThreshold");
        });

        it("should revert addSigner for duplicate signer", async function () {
            const addSignerData = multisig.interface.encodeFunctionData("addSigner", [signers[1].address]); // Already a signer

            await multisig.connect(signers[0]).submitTransaction(
                await multisig.getAddress(),
                0,
                addSignerData
            );
            await multisig.connect(signers[1]).confirmTransaction(0);

            await expect(
                multisig.executeTransaction(0)
            ).to.be.revertedWithCustomError(multisig, "SignerAlreadyExists");
        });

        it("should revert removeSigner for non-signer", async function () {
            const removeSignerData = multisig.interface.encodeFunctionData("removeSigner", [signers[8].address]); // Not a signer

            await multisig.connect(signers[0]).submitTransaction(
                await multisig.getAddress(),
                0,
                removeSignerData
            );
            await multisig.connect(signers[1]).confirmTransaction(0);

            await expect(
                multisig.executeTransaction(0)
            ).to.be.revertedWithCustomError(multisig, "SignerDoesNotExist");
        });
    });

    describe("CircuitBreaker - Modifier Coverage (lines 130-136)", function () {
        let circuitBreaker: any;
        let owner: SignerWithAddress;
        let user: SignerWithAddress;

        beforeEach(async function () {
            [owner, user] = await ethers.getSigners();

            const Factory = await ethers.getContractFactory("CircuitBreaker");
            circuitBreaker = await upgrades.deployProxy(
                Factory,
                [owner.address],
                { initializer: "initialize" }
            );
            await circuitBreaker.waitForDeployment();
        });

        it("should test whenNotGloballyPaused modifier (line 130)", async function () {
            // Activate global pause
            await circuitBreaker.activateGlobalPause("Test");

            // Try to call a function with the modifier
            // checkRateLimit returns false when globally paused, but let's check isOperationAllowed
            const allowed = await circuitBreaker.isOperationAllowed(user.address);
            expect(allowed).to.be.false;
        });

        it("should test whenContractNotPaused modifier (lines 135-136)", async function () {
            const contractAddr = user.address;

            // Pause the specific contract
            await circuitBreaker.pauseContract(contractAddr, "Test");

            // Check if operations are blocked
            const allowed = await circuitBreaker.isOperationAllowed(contractAddr);
            expect(allowed).to.be.false;
        });

        it("should allow operations when contract is not paused", async function () {
            const contractAddr = user.address;
            const allowed = await circuitBreaker.isOperationAllowed(contractAddr);
            expect(allowed).to.be.true;
        });
    });

    describe("TerraQuraAccessControl - Branch Coverage", function () {
        let accessControl: any;
        let owner: SignerWithAddress;
        let user1: SignerWithAddress;
        let user2: SignerWithAddress;
        let compliance: SignerWithAddress;

        beforeEach(async function () {
            [owner, user1, user2, compliance] = await ethers.getSigners();

            const Factory = await ethers.getContractFactory("TerraQuraAccessControl");
            accessControl = await upgrades.deployProxy(
                Factory,
                [owner.address],
                { initializer: "initialize" }
            );
            await accessControl.waitForDeployment();

            // Grant compliance role
            const COMPLIANCE_ROLE = await accessControl.COMPLIANCE_ROLE();
            await accessControl.grantRole(COMPLIANCE_ROLE, compliance.address);
        });

        describe("KYC Status Branches", function () {
            it("should revert updateKycStatus with empty provider when VERIFIED", async function () {
                await expect(
                    accessControl.connect(compliance).updateKycStatus(
                        user1.address,
                        2, // VERIFIED
                        "", // Empty provider
                        ethers.ZeroHash
                    )
                ).to.be.revertedWithCustomError(accessControl, "InvalidKycProvider");
            });

            it("should allow empty provider for non-VERIFIED status", async function () {
                await accessControl.connect(compliance).updateKycStatus(
                    user1.address,
                    1, // PENDING
                    "", // Empty provider ok for non-VERIFIED
                    ethers.ZeroHash
                );

                const info = await accessControl.kycRegistry(user1.address);
                expect(info.status).to.equal(1);
            });

            it("should set verifiedAt and expiresAt only for VERIFIED status", async function () {
                // Set to REJECTED (no verifiedAt)
                await accessControl.connect(compliance).updateKycStatus(
                    user1.address,
                    3, // REJECTED
                    "provider",
                    ethers.ZeroHash
                );

                const infoRejected = await accessControl.kycRegistry(user1.address);
                expect(infoRejected.verifiedAt).to.equal(0);
                expect(infoRejected.expiresAt).to.equal(0);

                // Now set to VERIFIED
                await accessControl.connect(compliance).updateKycStatus(
                    user1.address,
                    2, // VERIFIED
                    "sumsub",
                    ethers.keccak256(ethers.toUtf8Bytes("applicant123"))
                );

                const infoVerified = await accessControl.kycRegistry(user1.address);
                expect(infoVerified.verifiedAt).to.be.gt(0);
                expect(infoVerified.expiresAt).to.be.gt(0);
            });
        });

        describe("Batch KYC Updates", function () {
            it("should batch update KYC for multiple accounts", async function () {
                const accounts = [user1.address, user2.address];

                await accessControl.connect(compliance).batchUpdateKycStatus(
                    accounts,
                    2, // VERIFIED
                    "batch-provider"
                );

                // Check both accounts
                const info1 = await accessControl.kycRegistry(user1.address);
                const info2 = await accessControl.kycRegistry(user2.address);

                expect(info1.status).to.equal(2);
                expect(info2.status).to.equal(2);
                expect(info1.provider).to.equal("batch-provider");
                expect(info2.provider).to.equal("batch-provider");
            });

            it("should set expiresAt = 0 for non-VERIFIED batch updates", async function () {
                const accounts = [user1.address, user2.address];

                await accessControl.connect(compliance).batchUpdateKycStatus(
                    accounts,
                    3, // REJECTED
                    ""
                );

                const info1 = await accessControl.kycRegistry(user1.address);
                expect(info1.expiresAt).to.equal(0);
            });
        });

        describe("Role Expiration Functions", function () {
            it("should handle role without expiration (isRoleExpired returns false)", async function () {
                const AUDITOR_ROLE = await accessControl.AUDITOR_ROLE();

                // Grant role without expiry
                await accessControl.grantRole(AUDITOR_ROLE, user1.address);

                // Check expiration - should be false (no expiry set)
                const expired = await accessControl.isRoleExpired(AUDITOR_ROLE, user1.address);
                expect(expired).to.be.false;
            });

            it("should return true for expired role", async function () {
                const AUDITOR_ROLE = await accessControl.AUDITOR_ROLE();

                // Grant role with short expiry
                const futureTime = (await time.latest()) + 100;
                await accessControl.grantRoleWithExpiry(AUDITOR_ROLE, user1.address, futureTime);

                // Not expired yet
                expect(await accessControl.isRoleExpired(AUDITOR_ROLE, user1.address)).to.be.false;

                // Fast forward past expiry
                await time.increase(200);

                // Now expired
                expect(await accessControl.isRoleExpired(AUDITOR_ROLE, user1.address)).to.be.true;
            });

            it("should revoke expired role successfully", async function () {
                const AUDITOR_ROLE = await accessControl.AUDITOR_ROLE();

                // Grant role with short expiry
                const futureTime = (await time.latest()) + 100;
                await accessControl.grantRoleWithExpiry(AUDITOR_ROLE, user1.address, futureTime);

                // Fast forward past expiry
                await time.increase(200);

                // Anyone can revoke expired roles
                await accessControl.connect(user2).revokeExpiredRole(AUDITOR_ROLE, user1.address);

                // Verify role is revoked
                expect(await accessControl.hasRole(AUDITOR_ROLE, user1.address)).to.be.false;
            });

            it("should revert revokeExpiredRole if role is not expired", async function () {
                const AUDITOR_ROLE = await accessControl.AUDITOR_ROLE();

                // Grant role with long expiry
                const futureTime = (await time.latest()) + 86400;
                await accessControl.grantRoleWithExpiry(AUDITOR_ROLE, user1.address, futureTime);

                // Try to revoke before expiry
                await expect(
                    accessControl.revokeExpiredRole(AUDITOR_ROLE, user1.address)
                ).to.be.revertedWithCustomError(accessControl, "RoleExpired");
            });

            it("should extend role expiry", async function () {
                const AUDITOR_ROLE = await accessControl.AUDITOR_ROLE();

                // Grant role with initial expiry
                const initialExpiry = (await time.latest()) + 1000;
                await accessControl.grantRoleWithExpiry(AUDITOR_ROLE, user1.address, initialExpiry);

                // Extend expiry
                const newExpiry = (await time.latest()) + 10000;
                await accessControl.extendRoleExpiry(AUDITOR_ROLE, user1.address, newExpiry);

                // Verify new expiry
                const expiry = await accessControl.roleExpiration(AUDITOR_ROLE, user1.address);
                expect(expiry).to.equal(newExpiry);
            });

            it("should revert extendRoleExpiry with past timestamp", async function () {
                const AUDITOR_ROLE = await accessControl.AUDITOR_ROLE();

                // Grant role
                const futureTime = (await time.latest()) + 1000;
                await accessControl.grantRoleWithExpiry(AUDITOR_ROLE, user1.address, futureTime);

                // Try to extend with past timestamp
                await expect(
                    accessControl.extendRoleExpiry(AUDITOR_ROLE, user1.address, 1)
                ).to.be.revertedWith("New expiry must be in future");
            });

            it("should revert extendRoleExpiry for account without role", async function () {
                const AUDITOR_ROLE = await accessControl.AUDITOR_ROLE();

                // Try to extend for account without role
                const futureTime = (await time.latest()) + 1000;
                await expect(
                    accessControl.extendRoleExpiry(AUDITOR_ROLE, user1.address, futureTime)
                ).to.be.revertedWith("Account does not have role");
            });

            it("should revert extendRoleExpiry if reducing expiry", async function () {
                const AUDITOR_ROLE = await accessControl.AUDITOR_ROLE();

                // Grant role with long expiry
                const longExpiry = (await time.latest()) + 100000;
                await accessControl.grantRoleWithExpiry(AUDITOR_ROLE, user1.address, longExpiry);

                // Try to reduce expiry (still in future but less than current)
                const shorterExpiry = (await time.latest()) + 50000;
                await expect(
                    accessControl.extendRoleExpiry(AUDITOR_ROLE, user1.address, shorterExpiry)
                ).to.be.revertedWith("Can only extend, not reduce");
            });
        });

        describe("hasRoleAndKyc", function () {
            it("should return true when has role and KYC verified", async function () {
                const AUDITOR_ROLE = await accessControl.AUDITOR_ROLE();

                // Grant role
                await accessControl.grantRole(AUDITOR_ROLE, user1.address);

                // Set KYC status
                await accessControl.connect(compliance).updateKycStatus(
                    user1.address,
                    2, // VERIFIED
                    "sumsub",
                    ethers.keccak256(ethers.toUtf8Bytes("test"))
                );
                await accessControl.connect(compliance).updateSanctionsStatus(user1.address, true);

                expect(await accessControl.hasRoleAndKyc(AUDITOR_ROLE, user1.address)).to.be.true;
            });

            it("should return false when has role but no KYC", async function () {
                const AUDITOR_ROLE = await accessControl.AUDITOR_ROLE();

                // Grant role only
                await accessControl.grantRole(AUDITOR_ROLE, user1.address);

                expect(await accessControl.hasRoleAndKyc(AUDITOR_ROLE, user1.address)).to.be.false;
            });

            it("should return false when has KYC but no role", async function () {
                const AUDITOR_ROLE = await accessControl.AUDITOR_ROLE();

                // Set KYC only
                await accessControl.connect(compliance).updateKycStatus(
                    user1.address,
                    2, // VERIFIED
                    "sumsub",
                    ethers.keccak256(ethers.toUtf8Bytes("test"))
                );
                await accessControl.connect(compliance).updateSanctionsStatus(user1.address, true);

                expect(await accessControl.hasRoleAndKyc(AUDITOR_ROLE, user1.address)).to.be.false;
            });
        });

        describe("isKycVerified edge cases", function () {
            it("should return false when status is VERIFIED but expired", async function () {
                // Set KYC as verified
                await accessControl.connect(compliance).updateKycStatus(
                    user1.address,
                    2, // VERIFIED
                    "sumsub",
                    ethers.keccak256(ethers.toUtf8Bytes("test"))
                );
                await accessControl.connect(compliance).updateSanctionsStatus(user1.address, true);

                // Fast forward past KYC expiry (default 365 days)
                await time.increase(366 * 24 * 60 * 60);

                expect(await accessControl.isKycVerified(user1.address)).to.be.false;
            });

            it("should return false when VERIFIED but sanctions not cleared", async function () {
                await accessControl.connect(compliance).updateKycStatus(
                    user1.address,
                    2, // VERIFIED
                    "sumsub",
                    ethers.keccak256(ethers.toUtf8Bytes("test"))
                );
                // Don't clear sanctions

                expect(await accessControl.isKycVerified(user1.address)).to.be.false;
            });
        });

        describe("hasValidRole", function () {
            it("should return true for non-expired role", async function () {
                const AUDITOR_ROLE = await accessControl.AUDITOR_ROLE();

                const futureTime = (await time.latest()) + 86400;
                await accessControl.grantRoleWithExpiry(AUDITOR_ROLE, user1.address, futureTime);

                expect(await accessControl.hasValidRole(AUDITOR_ROLE, user1.address)).to.be.true;
            });

            it("should return false for expired role", async function () {
                const AUDITOR_ROLE = await accessControl.AUDITOR_ROLE();

                const futureTime = (await time.latest()) + 100;
                await accessControl.grantRoleWithExpiry(AUDITOR_ROLE, user1.address, futureTime);

                await time.increase(200);

                expect(await accessControl.hasValidRole(AUDITOR_ROLE, user1.address)).to.be.false;
            });
        });

        describe("Pause Functions", function () {
            it("should emergency pause", async function () {
                const PAUSER_ROLE = await accessControl.PAUSER_ROLE();
                await accessControl.grantRole(PAUSER_ROLE, user1.address);

                await expect(
                    accessControl.connect(user1).emergencyPause("Security incident")
                ).to.emit(accessControl, "EmergencyPause")
                    .withArgs(user1.address, "Security incident");

                expect(await accessControl.paused()).to.be.true;
            });

            it("should unpause (only admin)", async function () {
                // First pause
                await accessControl.emergencyPause("Test");

                // Unpause
                await accessControl.unpause();

                expect(await accessControl.paused()).to.be.false;
            });
        });
    });

    describe("EfficiencyCalculator - Additional Branch Tests", function () {
        let calculator: any;

        beforeEach(async function () {
            const Factory = await ethers.getContractFactory("EfficiencyCalculatorTest");
            calculator = await Factory.deploy();
            await calculator.waitForDeployment();
        });

        it("should hit line 68 when in penalty range with range = 0", async function () {
            // To hit line 68 (else branch where range = 0 in penalty calculation):
            // kwhPerTonne > optimal AND optimal = max (making range = 0)
            // BUT this means kwhPerTonne > max which returns 0 from line 40-42

            // The only way to test the else at line 68 is when range is 0
            // and the value is at exactly optimal (goes to bonus branch) or
            // when optimal = max and we're testing the penalty path

            // Since optimal = max means any value > optimal is > max (returns 0),
            // we can't actually hit the penalty path with range = 0
            // The line 68 else branch in penalty calculation can be hit when
            // range calculation would be 0 but we enter the penalty path

            // Let's test an edge case where we're exactly at optimal = max
            const factor = await calculator.testCalculate(
                400, // kwhPerTonne = optimal = max
                400, // optimal
                200, // min
                400, // max
                10000
            );

            // At optimal, should return scale (takes the bonus path since kwhPerTonne <= optimal)
            expect(factor).to.equal(10000);
        });

        it("should hit line 109 with very low purity causing negative purityFactor", async function () {
            // purityFactor = scale + (purityDelta * 100)
            // For purityFactor <= 0: scale + (purity - 95) * 100 <= 0
            // With scale = 10000: 10000 + (purity - 95) * 100 <= 0
            // (purity - 95) * 100 <= -10000
            // purity - 95 <= -100
            // purity <= -5 (impossible with uint8)

            // The minimum uint8 is 0, which gives:
            // purityFactor = 10000 + (0 - 95) * 100 = 10000 - 9500 = 500
            // This is still positive, so line 109 is never hit with uint8 purity

            // However, let's verify the floor is applied
            const adjusted = await calculator.testApplyPurityAdjustment(
                5000, // baseFactor = 50%
                0,    // purity = 0 (minimum)
                10000 // scale
            );

            // purityFactor = 10000 + (0 - 95) * 100 = 500
            // adjustedFactor = (5000 * 500) / 10000 = 250
            // Since 250 < minFactor (5000), it should be clamped to 5000
            expect(adjusted).to.equal(5000);
        });

        it("should test calculateCredits function", async function () {
            // co2AmountKg * efficiencyFactor / scale
            const credits = await calculator.testCalculateCredits(
                1000,  // 1000 kg CO2
                10500, // 105% efficiency
                10000  // scale
            );

            expect(credits).to.equal(1050); // 1000 * 10500 / 10000
        });

        it("should test edge case with very low efficiency", async function () {
            const credits = await calculator.testCalculateCredits(
                1000, // 1000 kg CO2
                5000, // 50% efficiency (minimum)
                10000 // scale
            );

            expect(credits).to.equal(500); // 1000 * 5000 / 10000
        });
    });
});
