import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { InsurancePool, TerraQuraAccessControl } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("InsurancePool", function () {
    async function deployFixture() {
        const [admin, holder, depositor, other] = await ethers.getSigners();

        // Deploy AccessControl
        const ACFactory = await ethers.getContractFactory("TerraQuraAccessControl");
        const accessControl = (await upgrades.deployProxy(ACFactory, [admin.address], {
            initializer: "initialize",
        })) as unknown as TerraQuraAccessControl;
        await accessControl.waitForDeployment();

        // Deploy InsurancePool
        const PoolFactory = await ethers.getContractFactory("InsurancePool");
        const pool = (await upgrades.deployProxy(
            PoolFactory,
            [await accessControl.getAddress()],
            { initializer: "initialize" }
        )) as unknown as InsurancePool;
        await pool.waitForDeployment();

        return { pool, accessControl, admin, holder, depositor, other };
    }

    // Methodology enum: DAC=0, Biochar=1, Forestry=2, BECCS=3
    const DAC = 0;
    const BIOCHAR = 1;
    const FORESTRY = 2;
    const BECCS = 3;

    const ONE_ETHER = ethers.parseEther("1");
    const TEN_ETHER = ethers.parseEther("10");

    async function seedPool(pool: InsurancePool, depositor: SignerWithAddress, amount: bigint) {
        await pool.connect(depositor).depositToPool({ value: amount });
    }

    describe("Initialization", function () {
        it("should set correct risk factors", async function () {
            const { pool } = await loadFixture(deployFixture);
            expect(await pool.riskFactorBps(DAC)).to.equal(200);
            expect(await pool.riskFactorBps(BIOCHAR)).to.equal(500);
            expect(await pool.riskFactorBps(FORESTRY)).to.equal(1000);
            expect(await pool.riskFactorBps(BECCS)).to.equal(400);
        });

        it("should set 150% minimum coverage ratio", async function () {
            const { pool } = await loadFixture(deployFixture);
            expect(await pool.minCoverageRatioBps()).to.equal(15000);
        });

        it("should set 7-day withdrawal timelock", async function () {
            const { pool } = await loadFixture(deployFixture);
            expect(await pool.withdrawTimelock()).to.equal(7 * 24 * 60 * 60);
        });
    });

    describe("Premium Calculation", function () {
        it("should calculate DAC premium correctly (2%)", async function () {
            const { pool } = await loadFixture(deployFixture);
            // coverageAmount * 200 * 365 / (10000 * 365) = coverageAmount * 2%
            const premium = await pool.calculatePremium(ONE_ETHER, 365, DAC);
            expect(premium).to.equal(ONE_ETHER * 200n / 10000n);
        });

        it("should calculate Biochar premium correctly (5%)", async function () {
            const { pool } = await loadFixture(deployFixture);
            const premium = await pool.calculatePremium(ONE_ETHER, 365, BIOCHAR);
            expect(premium).to.equal(ONE_ETHER * 500n / 10000n);
        });

        it("should calculate Forestry premium correctly (10%)", async function () {
            const { pool } = await loadFixture(deployFixture);
            const premium = await pool.calculatePremium(ONE_ETHER, 365, FORESTRY);
            expect(premium).to.equal(ONE_ETHER * 1000n / 10000n);
        });

        it("should calculate BECCS premium correctly (4%)", async function () {
            const { pool } = await loadFixture(deployFixture);
            const premium = await pool.calculatePremium(ONE_ETHER, 365, BECCS);
            expect(premium).to.equal(ONE_ETHER * 400n / 10000n);
        });

        it("should pro-rate premium for partial year", async function () {
            const { pool } = await loadFixture(deployFixture);
            // 30 days at 10% = coverageAmount * 1000 * 30 / (10000 * 365)
            const premium = await pool.calculatePremium(ONE_ETHER, 30, FORESTRY);
            const expected = (ONE_ETHER * 1000n * 30n) / (10000n * 365n);
            expect(premium).to.equal(expected);
        });
    });

    describe("Create Policy", function () {
        it("should create a policy and emit event", async function () {
            const { pool, holder, depositor } = await loadFixture(deployFixture);
            await seedPool(pool, depositor, TEN_ETHER);

            const premium = await pool.calculatePremium(ONE_ETHER, 90, DAC);

            await expect(
                pool.connect(holder).createPolicy(1, ONE_ETHER, 90, DAC, { value: premium })
            ).to.emit(pool, "PolicyCreated");
        });

        it("should store correct policy data", async function () {
            const { pool, holder, depositor } = await loadFixture(deployFixture);
            await seedPool(pool, depositor, TEN_ETHER);

            const premium = await pool.calculatePremium(ONE_ETHER, 90, DAC);
            await pool.connect(holder).createPolicy(42, ONE_ETHER, 90, DAC, { value: premium });

            const policy = await pool.getPolicy(1);
            expect(policy.creditId).to.equal(42);
            expect(policy.holder).to.equal(holder.address);
            expect(policy.coverageAmount).to.equal(ONE_ETHER);
            expect(policy.status).to.equal(0); // Active
        });

        it("should revert with zero coverage amount", async function () {
            const { pool, holder } = await loadFixture(deployFixture);
            await expect(
                pool.connect(holder).createPolicy(1, 0, 90, DAC, { value: ONE_ETHER })
            ).to.be.revertedWithCustomError(pool, "InvalidCoverageAmount");
        });

        it("should revert with zero duration", async function () {
            const { pool, holder } = await loadFixture(deployFixture);
            await expect(
                pool.connect(holder).createPolicy(1, ONE_ETHER, 0, DAC, { value: ONE_ETHER })
            ).to.be.revertedWithCustomError(pool, "InvalidDuration");
        });

        it("should revert with insufficient premium", async function () {
            const { pool, holder, depositor } = await loadFixture(deployFixture);
            await seedPool(pool, depositor, TEN_ETHER);

            await expect(
                pool.connect(holder).createPolicy(1, ONE_ETHER, 90, DAC, { value: 1 })
            ).to.be.revertedWithCustomError(pool, "InsufficientPremium");
        });

        it("should refund excess premium", async function () {
            const { pool, holder, depositor } = await loadFixture(deployFixture);
            await seedPool(pool, depositor, TEN_ETHER);

            const premium = await pool.calculatePremium(ONE_ETHER, 90, DAC);
            const overpayment = premium + ethers.parseEther("0.5");

            const balBefore = await ethers.provider.getBalance(holder.address);
            const tx = await pool.connect(holder).createPolicy(1, ONE_ETHER, 90, DAC, { value: overpayment });
            const receipt = await tx.wait();
            const gasCost = receipt!.gasUsed * receipt!.gasPrice;
            const balAfter = await ethers.provider.getBalance(holder.address);

            // holder paid exactly premium + gas
            expect(balBefore - balAfter - gasCost).to.be.closeTo(premium, ethers.parseEther("0.0001"));
        });

        it("should revert if pool capacity insufficient", async function () {
            const { pool, holder } = await loadFixture(deployFixture);
            // No deposits in pool
            const premium = await pool.calculatePremium(ONE_ETHER, 90, DAC);
            await expect(
                pool.connect(holder).createPolicy(1, ONE_ETHER, 90, DAC, { value: premium })
            ).to.be.revertedWithCustomError(pool, "InsufficientPoolCapacity");
        });

        it("should update totalActiveCoverage", async function () {
            const { pool, holder, depositor } = await loadFixture(deployFixture);
            await seedPool(pool, depositor, TEN_ETHER);

            const premium = await pool.calculatePremium(ONE_ETHER, 90, DAC);
            await pool.connect(holder).createPolicy(1, ONE_ETHER, 90, DAC, { value: premium });

            expect(await pool.totalActiveCoverage()).to.equal(ONE_ETHER);
        });
    });

    describe("File Claim", function () {
        async function policyFixture() {
            const base = await deployFixture();
            await seedPool(base.pool, base.depositor, TEN_ETHER);
            const premium = await base.pool.calculatePremium(ONE_ETHER, 90, DAC);
            await base.pool.connect(base.holder).createPolicy(1, ONE_ETHER, 90, DAC, { value: premium });
            return base;
        }

        it("should file a claim and emit event", async function () {
            const { pool, holder } = await loadFixture(policyFixture);
            const evidence = ethers.toUtf8Bytes("forest fire evidence");

            await expect(pool.connect(holder).fileClaim(1, evidence))
                .to.emit(pool, "ClaimFiled")
                .withArgs(1, 1, holder.address);
        });

        it("should revert if not the policy holder", async function () {
            const { pool, other } = await loadFixture(policyFixture);
            await expect(
                pool.connect(other).fileClaim(1, "0x")
            ).to.be.revertedWithCustomError(pool, "Unauthorized");
        });

        it("should revert if policy is expired", async function () {
            const { pool, holder } = await loadFixture(policyFixture);
            await time.increase(91 * 24 * 60 * 60); // past 90 days

            await expect(
                pool.connect(holder).fileClaim(1, "0x")
            ).to.be.revertedWithCustomError(pool, "PolicyExpired");
        });

        it("should set policy status to Claimed", async function () {
            const { pool, holder } = await loadFixture(policyFixture);
            await pool.connect(holder).fileClaim(1, "0x");

            const policy = await pool.getPolicy(1);
            expect(policy.status).to.equal(2); // Claimed
        });
    });

    describe("Process Claim", function () {
        async function claimFixture() {
            const base = await deployFixture();
            await seedPool(base.pool, base.depositor, TEN_ETHER);
            const premium = await base.pool.calculatePremium(ONE_ETHER, 90, DAC);
            await base.pool.connect(base.holder).createPolicy(1, ONE_ETHER, 90, DAC, { value: premium });
            await base.pool.connect(base.holder).fileClaim(1, ethers.toUtf8Bytes("evidence"));
            return base;
        }

        it("should approve a claim", async function () {
            const { pool, admin } = await loadFixture(claimFixture);
            await expect(pool.connect(admin).processClaim(1, true))
                .to.emit(pool, "ClaimProcessed")
                .withArgs(1, true);

            const claim = await pool.getClaim(1);
            expect(claim.status).to.equal(1); // Approved
        });

        it("should reject a claim and reactivate policy", async function () {
            const { pool, admin } = await loadFixture(claimFixture);
            await pool.connect(admin).processClaim(1, false);

            const claim = await pool.getClaim(1);
            expect(claim.status).to.equal(2); // Rejected

            const policy = await pool.getPolicy(1);
            expect(policy.status).to.equal(0); // Active (reactivated)
        });

        it("should revert if not admin", async function () {
            const { pool, other } = await loadFixture(claimFixture);
            await expect(
                pool.connect(other).processClaim(1, true)
            ).to.be.revertedWithCustomError(pool, "Unauthorized");
        });

        it("should revert if claim already processed", async function () {
            const { pool, admin } = await loadFixture(claimFixture);
            await pool.connect(admin).processClaim(1, true);
            await expect(
                pool.connect(admin).processClaim(1, false)
            ).to.be.revertedWithCustomError(pool, "ClaimAlreadyProcessed");
        });
    });

    describe("Payout", function () {
        async function approvedClaimFixture() {
            const base = await deployFixture();
            await seedPool(base.pool, base.depositor, TEN_ETHER);
            const premium = await base.pool.calculatePremium(ONE_ETHER, 90, DAC);
            await base.pool.connect(base.holder).createPolicy(1, ONE_ETHER, 90, DAC, { value: premium });
            await base.pool.connect(base.holder).fileClaim(1, ethers.toUtf8Bytes("evidence"));
            await base.pool.connect(base.admin).processClaim(1, true);
            return base;
        }

        it("should pay out an approved claim", async function () {
            const { pool, holder } = await loadFixture(approvedClaimFixture);
            const balBefore = await ethers.provider.getBalance(holder.address);

            const tx = await pool.connect(holder).payout(1);
            const receipt = await tx.wait();
            const gasCost = receipt!.gasUsed * receipt!.gasPrice;

            const balAfter = await ethers.provider.getBalance(holder.address);
            expect(balAfter - balBefore + gasCost).to.equal(ONE_ETHER);
        });

        it("should emit Payout event", async function () {
            const { pool, holder } = await loadFixture(approvedClaimFixture);
            await expect(pool.connect(holder).payout(1))
                .to.emit(pool, "Payout")
                .withArgs(1, holder.address, ONE_ETHER);
        });

        it("should set claim and policy to PaidOut", async function () {
            const { pool, holder } = await loadFixture(approvedClaimFixture);
            await pool.connect(holder).payout(1);

            const claim = await pool.getClaim(1);
            expect(claim.status).to.equal(3); // PaidOut

            const policy = await pool.getPolicy(1);
            expect(policy.status).to.equal(3); // PaidOut
        });

        it("should reduce totalActiveCoverage", async function () {
            const { pool, holder } = await loadFixture(approvedClaimFixture);
            await pool.connect(holder).payout(1);
            expect(await pool.totalActiveCoverage()).to.equal(0);
        });

        it("should revert if claim not approved", async function () {
            const base = await deployFixture();
            await seedPool(base.pool, base.depositor, TEN_ETHER);
            const premium = await base.pool.calculatePremium(ONE_ETHER, 90, DAC);
            await base.pool.connect(base.holder).createPolicy(1, ONE_ETHER, 90, DAC, { value: premium });
            await base.pool.connect(base.holder).fileClaim(1, "0x");
            // Claim is Filed, not Approved
            await expect(
                base.pool.connect(base.holder).payout(1)
            ).to.be.revertedWithCustomError(base.pool, "ClaimNotApproved");
        });
    });

    describe("Pool Deposit and Withdraw", function () {
        it("should accept deposits", async function () {
            const { pool, depositor } = await loadFixture(deployFixture);
            await expect(pool.connect(depositor).depositToPool({ value: TEN_ETHER }))
                .to.emit(pool, "PoolDeposit")
                .withArgs(depositor.address, TEN_ETHER);

            expect(await pool.deposits(depositor.address)).to.equal(TEN_ETHER);
            expect(await pool.totalDeposited()).to.equal(TEN_ETHER);
        });

        it("should revert deposit of zero", async function () {
            const { pool, depositor } = await loadFixture(deployFixture);
            await expect(
                pool.connect(depositor).depositToPool({ value: 0 })
            ).to.be.revertedWithCustomError(pool, "ZeroAmount");
        });

        it("should allow withdrawal after timelock", async function () {
            const { pool, depositor } = await loadFixture(deployFixture);
            await pool.connect(depositor).depositToPool({ value: TEN_ETHER });

            await time.increase(7 * 24 * 60 * 60 + 1); // 7 days + 1 second

            await expect(pool.connect(depositor).withdrawFromPool(TEN_ETHER))
                .to.emit(pool, "PoolWithdraw")
                .withArgs(depositor.address, TEN_ETHER);

            expect(await pool.deposits(depositor.address)).to.equal(0);
        });

        it("should revert withdrawal before timelock", async function () {
            const { pool, depositor } = await loadFixture(deployFixture);
            await pool.connect(depositor).depositToPool({ value: TEN_ETHER });

            await expect(
                pool.connect(depositor).withdrawFromPool(TEN_ETHER)
            ).to.be.revertedWithCustomError(pool, "WithdrawTimelockNotMet");
        });

        it("should revert withdrawal exceeding deposit", async function () {
            const { pool, depositor } = await loadFixture(deployFixture);
            await pool.connect(depositor).depositToPool({ value: ONE_ETHER });
            await time.increase(7 * 24 * 60 * 60 + 1);

            await expect(
                pool.connect(depositor).withdrawFromPool(TEN_ETHER)
            ).to.be.revertedWithCustomError(pool, "InsufficientDeposit");
        });

        it("should prevent withdrawal that breaks coverage ratio", async function () {
            const { pool, holder, depositor } = await loadFixture(deployFixture);
            await pool.connect(depositor).depositToPool({ value: TEN_ETHER });

            // Create a large policy
            const coverage = ethers.parseEther("5");
            const premium = await pool.calculatePremium(coverage, 365, DAC);
            await pool.connect(holder).createPolicy(1, coverage, 365, DAC, { value: premium });

            await time.increase(7 * 24 * 60 * 60 + 1);

            // Try to withdraw too much (would break 150% ratio)
            await expect(
                pool.connect(depositor).withdrawFromPool(TEN_ETHER)
            ).to.be.revertedWithCustomError(pool, "InsufficientPoolCapacity");
        });
    });

    describe("Admin Functions", function () {
        it("should allow admin to set risk factor", async function () {
            const { pool, admin } = await loadFixture(deployFixture);
            await pool.connect(admin).setRiskFactor(DAC, 300);
            expect(await pool.riskFactorBps(DAC)).to.equal(300);
        });

        it("should allow admin to set min coverage ratio", async function () {
            const { pool, admin } = await loadFixture(deployFixture);
            await pool.connect(admin).setMinCoverageRatio(20000);
            expect(await pool.minCoverageRatioBps()).to.equal(20000);
        });

        it("should revert non-admin setting risk factor", async function () {
            const { pool, other } = await loadFixture(deployFixture);
            await expect(
                pool.connect(other).setRiskFactor(DAC, 300)
            ).to.be.revertedWithCustomError(pool, "Unauthorized");
        });
    });

    describe("View Functions", function () {
        it("should return available capacity", async function () {
            const { pool, depositor } = await loadFixture(deployFixture);
            await pool.connect(depositor).depositToPool({ value: TEN_ETHER });
            // No active coverage, so all capacity is available (minus what's needed for 150% ratio of 0)
            expect(await pool.availableCapacity()).to.equal(TEN_ETHER);
        });
    });
});
