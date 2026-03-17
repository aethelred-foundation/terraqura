import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { VerificationEngine } from "../typechain-types";

describe("VerificationEngine", function () {
    let verificationEngine: VerificationEngine;
    let owner: SignerWithAddress;
    let carbonCredit: SignerWithAddress;
    let operator: SignerWithAddress;
    let unauthorized: SignerWithAddress;

    const DAC_UNIT_ID = ethers.keccak256(ethers.toUtf8Bytes("DAC-001"));
    const DATA_HASH = ethers.keccak256(ethers.toUtf8Bytes("sample-data-hash"));

    beforeEach(async function () {
        [owner, carbonCredit, operator, unauthorized] = await ethers.getSigners();

        const VerificationEngineFactory = await ethers.getContractFactory("VerificationEngine");
        verificationEngine = await upgrades.deployProxy(
            VerificationEngineFactory,
            [ethers.ZeroAddress, carbonCredit.address],
            { initializer: "initialize" }
        ) as unknown as VerificationEngine;
        await verificationEngine.waitForDeployment();
    });

    describe("Initialization", function () {
        it("should set the correct owner", async function () {
            expect(await verificationEngine.owner()).to.equal(owner.address);
        });

        it("should set the carbon credit contract address", async function () {
            expect(await verificationEngine.carbonCreditContract()).to.equal(carbonCredit.address);
        });

        it("should have correct verification thresholds", async function () {
            const [minKwh, maxKwh, optimalKwh, minPurity] = await verificationEngine.getVerificationThresholds();
            expect(minKwh).to.equal(200);
            expect(maxKwh).to.equal(600);
            expect(optimalKwh).to.equal(350);
            expect(minPurity).to.equal(90);
        });
    });

    describe("DAC Unit Whitelisting", function () {
        it("should whitelist a DAC unit", async function () {
            await expect(verificationEngine.whitelistDacUnit(DAC_UNIT_ID, operator.address))
                .to.emit(verificationEngine, "DacUnitWhitelisted");

            expect(await verificationEngine.isWhitelisted(DAC_UNIT_ID)).to.be.true;
            expect(await verificationEngine.getOperator(DAC_UNIT_ID)).to.equal(operator.address);
        });

        it("should revert if DAC unit already whitelisted", async function () {
            await verificationEngine.whitelistDacUnit(DAC_UNIT_ID, operator.address);
            await expect(verificationEngine.whitelistDacUnit(DAC_UNIT_ID, operator.address))
                .to.be.revertedWithCustomError(verificationEngine, "DacUnitAlreadyWhitelisted");
        });

        it("should revert if operator is zero address", async function () {
            await expect(verificationEngine.whitelistDacUnit(DAC_UNIT_ID, ethers.ZeroAddress))
                .to.be.revertedWithCustomError(verificationEngine, "InvalidOperatorAddress");
        });

        it("should only allow owner to whitelist", async function () {
            await expect(verificationEngine.connect(unauthorized).whitelistDacUnit(DAC_UNIT_ID, operator.address))
                .to.be.reverted;
        });
    });

    describe("DAC Unit Removal", function () {
        beforeEach(async function () {
            await verificationEngine.whitelistDacUnit(DAC_UNIT_ID, operator.address);
        });

        it("should remove a DAC unit from whitelist", async function () {
            await expect(verificationEngine.removeDacUnit(DAC_UNIT_ID))
                .to.emit(verificationEngine, "DacUnitRemoved");

            expect(await verificationEngine.isWhitelisted(DAC_UNIT_ID)).to.be.false;
        });

        it("should revert if DAC unit not whitelisted", async function () {
            const unknownUnit = ethers.keccak256(ethers.toUtf8Bytes("UNKNOWN"));
            await expect(verificationEngine.removeDacUnit(unknownUnit))
                .to.be.revertedWithCustomError(verificationEngine, "DacUnitNotWhitelisted");
        });
    });

    describe("Operator Management", function () {
        beforeEach(async function () {
            await verificationEngine.whitelistDacUnit(DAC_UNIT_ID, operator.address);
        });

        it("should update operator address", async function () {
            const newOperator = unauthorized.address;
            await verificationEngine.updateOperator(DAC_UNIT_ID, newOperator);
            expect(await verificationEngine.getOperator(DAC_UNIT_ID)).to.equal(newOperator);
        });

        it("should revert if updating non-whitelisted unit", async function () {
            const unknownUnit = ethers.keccak256(ethers.toUtf8Bytes("UNKNOWN"));
            await expect(verificationEngine.updateOperator(unknownUnit, operator.address))
                .to.be.revertedWithCustomError(verificationEngine, "DacUnitNotWhitelisted");
        });

        it("should revert if new operator is zero address", async function () {
            await expect(verificationEngine.updateOperator(DAC_UNIT_ID, ethers.ZeroAddress))
                .to.be.revertedWithCustomError(verificationEngine, "InvalidOperatorAddress");
        });
    });

    describe("Carbon Credit Contract Management", function () {
        it("should update carbon credit contract address", async function () {
            const newAddress = unauthorized.address;
            await expect(verificationEngine.setCarbonCreditContract(newAddress))
                .to.emit(verificationEngine, "CarbonCreditContractUpdated")
                .withArgs(carbonCredit.address, newAddress);

            expect(await verificationEngine.carbonCreditContract()).to.equal(newAddress);
        });

        it("should revert if new address is zero", async function () {
            await expect(verificationEngine.setCarbonCreditContract(ethers.ZeroAddress))
                .to.be.revertedWithCustomError(verificationEngine, "InvalidCarbonCreditContract");
        });
    });

    describe("Verification (called by CarbonCredit)", function () {
        beforeEach(async function () {
            await verificationEngine.whitelistDacUnit(DAC_UNIT_ID, operator.address);
        });

        it("should revert if called by unauthorized address", async function () {
            await expect(
                verificationEngine.connect(unauthorized).verify(
                    DAC_UNIT_ID,
                    DATA_HASH,
                    1000,  // 1000 kg CO2
                    350,   // 350 kWh
                    95,    // 95% purity
                    50     // grid intensity gCO2/kWh (solar)
                )
            ).to.be.revertedWithCustomError(verificationEngine, "UnauthorizedCaller");
        });

        it("should pass verification with valid data", async function () {
            const result = await verificationEngine.connect(carbonCredit).verify.staticCall(
                DAC_UNIT_ID,
                DATA_HASH,
                1000,  // 1000 kg CO2 = 1 tonne
                350,   // 350 kWh (optimal)
                95,    // 95% purity
                50     // grid intensity gCO2/kWh (solar)
            );

            expect(result.sourceVerified).to.be.true;
            expect(result.logicVerified).to.be.true;
            expect(result.mintVerified).to.be.true;
            expect(result.efficiencyFactor).to.be.gt(0);
        });

        it("should fail source verification for non-whitelisted DAC", async function () {
            const unknownUnit = ethers.keccak256(ethers.toUtf8Bytes("UNKNOWN"));
            const result = await verificationEngine.connect(carbonCredit).verify.staticCall(
                unknownUnit,
                DATA_HASH,
                1000,
                350,
                95,
                50     // grid intensity gCO2/kWh (solar)
            );

            expect(result.sourceVerified).to.be.false;
            expect(result.logicVerified).to.be.false;
            expect(result.mintVerified).to.be.false;
        });

        it("should fail logic verification for low purity", async function () {
            const result = await verificationEngine.connect(carbonCredit).verify.staticCall(
                DAC_UNIT_ID,
                DATA_HASH,
                1000,
                350,
                80,    // Below 90% minimum
                50     // grid intensity gCO2/kWh (solar)
            );

            expect(result.sourceVerified).to.be.true;
            expect(result.logicVerified).to.be.false;
        });

        it("should fail logic verification for suspiciously efficient data", async function () {
            const result = await verificationEngine.connect(carbonCredit).verify.staticCall(
                DAC_UNIT_ID,
                DATA_HASH,
                1000,
                100,  // Only 100 kWh for 1 tonne - impossibly efficient
                95,
                50    // grid intensity gCO2/kWh (solar)
            );

            expect(result.sourceVerified).to.be.true;
            expect(result.logicVerified).to.be.false;
        });

        it("should fail logic verification for too inefficient data", async function () {
            const result = await verificationEngine.connect(carbonCredit).verify.staticCall(
                DAC_UNIT_ID,
                DATA_HASH,
                1000,
                1000,  // 1000 kWh for 1 tonne - too inefficient
                95,
                50     // grid intensity gCO2/kWh (solar)
            );

            expect(result.sourceVerified).to.be.true;
            expect(result.logicVerified).to.be.false;
        });

        it("should prevent double-minting with same hash", async function () {
            // First verification
            await verificationEngine.connect(carbonCredit).verify(
                DAC_UNIT_ID,
                DATA_HASH,
                1000,
                350,
                95,
                50     // grid intensity gCO2/kWh (solar)
            );

            // Second verification with same hash should fail mint check
            const result = await verificationEngine.connect(carbonCredit).verify.staticCall(
                DAC_UNIT_ID,
                DATA_HASH,
                1000,
                350,
                95,
                50     // grid intensity gCO2/kWh (solar)
            );

            expect(result.sourceVerified).to.be.true;
            expect(result.logicVerified).to.be.true;
            expect(result.mintVerified).to.be.false;
        });
    });

    describe("Efficiency Factor Calculation", function () {
        it("should return higher efficiency for optimal kWh", async function () {
            const [isValid, efficiencyFactor] = await verificationEngine.previewEfficiencyFactor(
                1000,  // 1000 kg
                350,   // Optimal 350 kWh
                95     // 95% purity
            );

            expect(isValid).to.be.true;
            // Net-Negative model with default grid intensity (400 gCO2/kWh) deducts energy debt
            // Factor ~8100 for 350 kWh/tonne at 95% purity with global average grid
            expect(efficiencyFactor).to.be.gt(5000); // Healthy positive net credits
        });

        it("should return lower efficiency for high kWh consumption", async function () {
            const [isValid, efficiencyFactor] = await verificationEngine.previewEfficiencyFactor(
                1000,
                550,  // High consumption
                95
            );

            expect(isValid).to.be.true;
            expect(efficiencyFactor).to.be.lt(10000); // Less than 100%
        });

        it("should adjust for purity", async function () {
            const [, highPurityFactor] = await verificationEngine.previewEfficiencyFactor(1000, 350, 99);
            const [, lowPurityFactor] = await verificationEngine.previewEfficiencyFactor(1000, 350, 91);

            expect(highPurityFactor).to.be.gt(lowPurityFactor);
        });

        it("should reject below minimum purity", async function () {
            const [isValid] = await verificationEngine.previewEfficiencyFactor(1000, 350, 85);
            expect(isValid).to.be.false;
        });
    });

    describe("Hash Processing", function () {
        beforeEach(async function () {
            await verificationEngine.whitelistDacUnit(DAC_UNIT_ID, operator.address);
        });

        it("should track processed hashes", async function () {
            expect(await verificationEngine.isHashProcessed(DATA_HASH)).to.be.false;

            await verificationEngine.connect(carbonCredit).verify(
                DAC_UNIT_ID,
                DATA_HASH,
                1000,
                350,
                95,
                50     // grid intensity gCO2/kWh (solar)
            );

            expect(await verificationEngine.isHashProcessed(DATA_HASH)).to.be.true;
        });
    });

    // Helper function to get current block timestamp
    async function getBlockTimestamp(): Promise<number> {
        const block = await ethers.provider.getBlock("latest");
        return block!.timestamp;
    }
});
