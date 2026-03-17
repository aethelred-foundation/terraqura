/**
 * BranchCoverageVerification - Enterprise Branch Coverage Test Suite
 *
 * Comprehensive branch coverage tests for VerificationEngine.sol targeting 95%+
 * coverage. Tests are organized by feature area with explicit branch condition
 * documentation to ensure all paths are exercised.
 *
 * Branch Coverage Categories:
 * 1. Technology Threshold Branches (Lines 630-670) - 6 branches
 * 2. Net-Negative Calculation Branches (Lines 688-711) - 3 branches
 * 3. DAC Unit Management Branches - 4 branches
 * 4. Source Verification Branches - 3 branches
 * 5. Tech Type Management Branches - 4 branches
 *
 * @version 1.0.0
 * @author TerraQura Engineering
 * @audit Pre-mainnet branch coverage requirement
 */

import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { VerificationEngine, CarbonCredit } from "../typechain-types";

describe("BranchCoverageVerification", function () {
  // ============================================
  // Test Fixtures & Setup
  // ============================================

  let verificationEngine: VerificationEngine;
  let carbonCredit: CarbonCredit;
  let owner: SignerWithAddress;
  let operator: SignerWithAddress;
  let user1: SignerWithAddress;

  // Constants matching contract
  const SCALE = 10000n;
  const MIN_KWH_PER_TONNE = 200n;
  const MAX_KWH_PER_TONNE = 800n;
  const MIN_PURITY_PERCENTAGE = 85n;

  // Technology types
  const TECH_DAC = 0;
  const TECH_BECCS = 1;
  const TECH_BIOCHAR = 2;
  const TECH_ENHANCED_WEATHERING = 3;
  const TECH_OCEAN_ALKALINITY = 4;

  // DAC unit identifiers
  const DAC_UNIT_ID = ethers.keccak256(ethers.toUtf8Bytes("DAC-UNIT-001"));
  const DAC_UNIT_ID_2 = ethers.keccak256(ethers.toUtf8Bytes("DAC-UNIT-002"));
  const DAC_UNIT_ID_3 = ethers.keccak256(ethers.toUtf8Bytes("DAC-UNIT-003"));

  let hashCounter = 0;

  /**
   * Generate unique source data hash
   */
  function generateHash(): string {
    hashCounter++;
    return ethers.keccak256(ethers.toUtf8Bytes(`VERIFY-SOURCE-${hashCounter}-${Date.now()}`));
  }

  /**
   * Deploy fresh contracts before each test
   */
  beforeEach(async function () {
    [owner, operator, user1] = await ethers.getSigners();

    // Deploy VerificationEngine
    const VerificationEngineFactory = await ethers.getContractFactory("VerificationEngine");
    verificationEngine = await upgrades.deployProxy(
      VerificationEngineFactory,
      [ethers.ZeroAddress, owner.address],
      { initializer: "initialize" }
    ) as unknown as VerificationEngine;

    // Deploy CarbonCredit
    const CarbonCreditFactory = await ethers.getContractFactory("CarbonCredit");
    carbonCredit = await upgrades.deployProxy(
      CarbonCreditFactory,
      [await verificationEngine.getAddress(), "https://terraqura.io/metadata/", owner.address],
      { initializer: "initialize" }
    ) as unknown as CarbonCredit;

    // Set CarbonCredit contract in VerificationEngine
    await verificationEngine.setCarbonCreditContract(await carbonCredit.getAddress());

    // Whitelist DAC unit with operator
    await verificationEngine.whitelistDacUnit(DAC_UNIT_ID, operator.address);

    // Grant minter role to operator for section 4 tests
    await carbonCredit.setMinter(operator.address, true);
  });

  // ============================================
  // SECTION 1: Technology Threshold Branches (via view functions)
  // Note: verify() has onlyCarbonCredit, so we use previewEfficiencyFactorForTech
  // ============================================

  describe("1. Technology Threshold Branches", function () {
    describe("1.1 Tech Type Active vs Default Thresholds", function () {
      it("should use custom thresholds when tech type is active", async function () {
        // Set custom thresholds for BECCS
        await verificationEngine.setTechThresholds(
          TECH_BECCS,
          150n, // minKwh
          600n, // maxKwh
          350n, // optimalKwh
          80n,  // minPurity (below default 90)
          "BECCS Custom"
        );

        const co2Amount = 1000n * 10n ** 18n;
        const energy = 300n * 10n ** 18n; // 300 kWh/tonne - within BECCS bounds

        // previewEfficiencyFactorForTech uses tech-specific thresholds
        const result = await verificationEngine.previewEfficiencyFactorForTech(
          TECH_BECCS,
          co2Amount,
          energy,
          85n // 85% > 80% BECCS min, but < 90% default
        );

        expect(result.isValid).to.be.true;
        expect(result.efficiencyFactor).to.be.gt(0n);
      });

      it("should use default thresholds via previewEfficiencyFactor", async function () {
        const co2Amount = 1000n * 10n ** 18n;
        const energy = 250n * 10n ** 18n; // 250 kWh/tonne - within default bounds (200-600)

        const result = await verificationEngine.previewEfficiencyFactor(
          co2Amount,
          energy,
          95n // >= 90% default min
        );

        expect(result.isValid).to.be.true;
        expect(result.efficiencyFactor).to.be.gt(0n);
      });

      it("should reject when kWh below tech minimum via previewEfficiencyFactorForTech", async function () {
        // Set custom thresholds with high minimum
        await verificationEngine.setTechThresholds(
          TECH_BIOCHAR,
          300n, // minKwh = 300
          700n,
          500n,
          90n,
          "Biochar"
        );

        const co2Amount = 1000n * 10n ** 18n;
        const energy = 250n * 10n ** 18n; // 250 kWh/tonne < 300 min

        const result = await verificationEngine.previewEfficiencyFactorForTech(
          TECH_BIOCHAR,
          co2Amount,
          energy,
          95n
        );

        expect(result.isValid).to.be.false;
      });

      it("should reject when kWh above tech maximum", async function () {
        // Set custom thresholds with low maximum
        await verificationEngine.setTechThresholds(
          TECH_ENHANCED_WEATHERING,
          100n,
          400n, // maxKwh = 400
          250n,
          90n,
          "Enhanced Weathering"
        );

        const co2Amount = 1000n * 10n ** 18n;
        const energy = 500n * 10n ** 18n; // 500 kWh/tonne > 400 max

        const result = await verificationEngine.previewEfficiencyFactorForTech(
          TECH_ENHANCED_WEATHERING,
          co2Amount,
          energy,
          95n
        );

        expect(result.isValid).to.be.false;
      });
    });

    describe("1.2 Purity Threshold Branches", function () {
      it("should reject when purity below default minimum (90%)", async function () {
        const co2Amount = 1000n * 10n ** 18n;
        const energy = 300n * 10n ** 18n;

        const result = await verificationEngine.previewEfficiencyFactor(
          co2Amount,
          energy,
          85n // 85% < 90% default
        );

        expect(result.isValid).to.be.false;
      });

      it("should accept when purity meets minimum", async function () {
        const co2Amount = 1000n * 10n ** 18n;
        const energy = 300n * 10n ** 18n;

        const result = await verificationEngine.previewEfficiencyFactor(
          co2Amount,
          energy,
          90n // Exactly at minimum
        );

        expect(result.isValid).to.be.true;
      });
    });

    describe("1.3 Deactivated Tech Type Fallback", function () {
      it("should reject deactivating already inactive tech type", async function () {
        await expect(
          verificationEngine.deactivateTechType(99) // Non-existent tech type
        ).to.be.revertedWithCustomError(verificationEngine, "TechTypeNotActive");
      });

      it("should allow deactivating active tech type", async function () {
        await verificationEngine.setTechThresholds(
          TECH_BECCS,
          300n, 600n, 450n, 90n, "BECCS"
        );

        await expect(
          verificationEngine.deactivateTechType(TECH_BECCS)
        ).to.not.be.reverted;
      });
    });
  });

  // ============================================
  // SECTION 2: Net-Negative Calculation Branches (via view functions)
  // ============================================

  describe("2. Net-Negative Calculation Branches", function () {
    describe("2.1 Net-Negative Preview", function () {
      it("should return net-negative details for valid capture", async function () {
        const co2Amount = 1000n * 10n ** 18n;
        const energy = 300n * 10n ** 18n;
        const gridIntensity = 100n;

        // Returns: (isValid, netCreditsKg, efficiencyFactor, grossCreditsScaled, energyDebtScaled)
        const [isValid, netCreditsKg, efficiencyFactor, grossScaled, energyDebtScaled] =
          await verificationEngine.previewNetNegativeCredits(
            co2Amount,
            energy,
            95n,
            gridIntensity
          );

        expect(isValid).to.be.true;
        expect(grossScaled).to.be.gt(0n);
        expect(netCreditsKg).to.be.gt(0n);
      });

      it("should calculate energy debt correctly", async function () {
        const co2Amount = 1000n * 10n ** 18n;
        const energy = 300n * 10n ** 18n;
        const gridIntensity = 200n; // Higher intensity = more debt

        const [isValid, netCreditsKg, efficiencyFactor, grossScaled, energyDebtScaled] =
          await verificationEngine.previewNetNegativeCredits(
            co2Amount,
            energy,
            95n,
            gridIntensity
          );

        expect(isValid).to.be.true;
        expect(energyDebtScaled).to.be.gt(0n);
        // Gross should be more than net after subtracting debt
        expect(grossScaled).to.be.gt(energyDebtScaled);
      });

      it("should return false when CO2 is zero", async function () {
        // CO2 = 0 is the condition for isPhysicallyPlausible = false
        const [isValid] = await verificationEngine.previewNetNegativeCredits(
          0n, // Zero CO2
          100n * 10n ** 18n,
          95n,
          100n
        );

        expect(isValid).to.be.false;
      });
    });

    describe("2.2 Efficiency Factor Edge Cases", function () {
      it("should return valid efficiency for optimal energy", async function () {
        const co2Amount = 1000n * 10n ** 18n;
        const energy = 350n * 10n ** 18n; // 350 = OPTIMAL_KWH_PER_TONNE

        const result = await verificationEngine.previewEfficiencyFactor(
          co2Amount,
          energy,
          95n
        );

        expect(result.isValid).to.be.true;
        expect(result.efficiencyFactor).to.be.gt(0n);
      });

      it("should handle high grid intensity impact on net credits", async function () {
        const co2Amount = 1000n * 10n ** 18n;
        const energy = 300n * 10n ** 18n;

        const [, lowNetCredits] = await verificationEngine.previewNetNegativeCredits(
          co2Amount,
          energy,
          95n,
          50n // Low grid intensity
        );

        const [, highNetCredits] = await verificationEngine.previewNetNegativeCredits(
          co2Amount,
          energy,
          95n,
          400n // High grid intensity
        );

        // Higher grid intensity = more energy debt = lower net credits
        expect(highNetCredits).to.be.lt(lowNetCredits);
      });
    });
  });

  // ============================================
  // SECTION 3: DAC Unit Management Branches
  // ============================================

  describe("3. DAC Unit Management Branches", function () {
    describe("3.1 Whitelist DAC Unit", function () {
      it("should whitelist new DAC unit successfully", async function () {
        const newDacId = ethers.keccak256(ethers.toUtf8Bytes("NEW-DAC"));

        await expect(
          verificationEngine.whitelistDacUnit(newDacId, user1.address)
        ).to.emit(verificationEngine, "DacUnitWhitelisted");

        expect(await verificationEngine.isWhitelisted(newDacId)).to.be.true;
      });

      it("should reject whitelisting already whitelisted DAC unit", async function () {
        await expect(
          verificationEngine.whitelistDacUnit(DAC_UNIT_ID, operator.address)
        ).to.be.revertedWithCustomError(verificationEngine, "DacUnitAlreadyWhitelisted");
      });

      it("should reject whitelisting with zero address operator", async function () {
        const newDacId = ethers.keccak256(ethers.toUtf8Bytes("NEW-DAC-2"));

        await expect(
          verificationEngine.whitelistDacUnit(newDacId, ethers.ZeroAddress)
        ).to.be.revertedWithCustomError(verificationEngine, "InvalidOperatorAddress");
      });
    });

    describe("3.2 Whitelist DAC Unit with Tech Type", function () {
      it("should whitelist with valid tech type", async function () {
        const newDacId = ethers.keccak256(ethers.toUtf8Bytes("TECH-DAC"));

        // First set tech thresholds
        await verificationEngine.setTechThresholds(
          TECH_BECCS,
          200n, 600n, 400n, 85n, "BECCS"
        );

        await verificationEngine.whitelistDacUnitWithTech(newDacId, user1.address, TECH_BECCS);

        expect(await verificationEngine.isWhitelisted(newDacId)).to.be.true;
      });

      it("should reject whitelisting with inactive tech type", async function () {
        const newDacId = ethers.keccak256(ethers.toUtf8Bytes("INVALID-TECH-DAC"));

        await expect(
          verificationEngine.whitelistDacUnitWithTech(newDacId, user1.address, 99) // Invalid tech type
        ).to.be.revertedWithCustomError(verificationEngine, "TechTypeNotActive");
      });
    });

    describe("3.3 Remove DAC Unit", function () {
      it("should remove whitelisted DAC unit", async function () {
        await expect(
          verificationEngine.removeDacUnit(DAC_UNIT_ID)
        ).to.emit(verificationEngine, "DacUnitRemoved");

        expect(await verificationEngine.isWhitelisted(DAC_UNIT_ID)).to.be.false;
      });

      it("should reject removing non-whitelisted DAC unit", async function () {
        const nonExistentDac = ethers.keccak256(ethers.toUtf8Bytes("NON-EXISTENT"));

        await expect(
          verificationEngine.removeDacUnit(nonExistentDac)
        ).to.be.revertedWithCustomError(verificationEngine, "DacUnitNotWhitelisted");
      });
    });

    describe("3.4 Update Operator", function () {
      it("should update operator for whitelisted DAC unit", async function () {
        // updateOperator doesn't emit an event, just verify it doesn't revert
        await expect(
          verificationEngine.updateOperator(DAC_UNIT_ID, user1.address)
        ).to.not.be.reverted;

        // Verify operator was updated
        const newOperator = await verificationEngine.getOperator(DAC_UNIT_ID);
        expect(newOperator).to.equal(user1.address);
      });

      it("should reject updating operator for non-whitelisted DAC", async function () {
        const nonExistentDac = ethers.keccak256(ethers.toUtf8Bytes("NON-EXISTENT"));

        await expect(
          verificationEngine.updateOperator(nonExistentDac, user1.address)
        ).to.be.revertedWithCustomError(verificationEngine, "DacUnitNotWhitelisted");
      });

      it("should reject updating to zero address operator", async function () {
        await expect(
          verificationEngine.updateOperator(DAC_UNIT_ID, ethers.ZeroAddress)
        ).to.be.revertedWithCustomError(verificationEngine, "InvalidOperatorAddress");
      });
    });
  });

  // ============================================
  // SECTION 4: Source Verification Branches
  // ============================================

  describe("4. Source Verification Branches", function () {
    // Note: verify() has onlyCarbonCredit modifier so we test via view functions
    // and integration with CarbonCredit.mintVerifiedCredits

    describe("4.1 DAC Whitelist Status", function () {
      it("should report whitelisted status for known DAC", async function () {
        const isWhitelisted = await verificationEngine.isWhitelisted(DAC_UNIT_ID);
        expect(isWhitelisted).to.be.true;
      });

      it("should report non-whitelisted status for unknown DAC", async function () {
        const unknownDac = ethers.keccak256(ethers.toUtf8Bytes("UNKNOWN"));
        const isWhitelisted = await verificationEngine.isWhitelisted(unknownDac);
        expect(isWhitelisted).to.be.false;
      });

      it("should get operator for whitelisted DAC", async function () {
        const op = await verificationEngine.getOperator(DAC_UNIT_ID);
        expect(op).to.equal(operator.address);
      });
    });

    describe("4.2 Hash Processing (via mintVerifiedCredits)", function () {
      it("should fail mint for duplicate hash", async function () {
        const hash = generateHash();
        const co2Amount = 1000n * 10n ** 18n;
        const energy = (co2Amount * 300n) / 1000n;

        // First mint succeeds
        await carbonCredit.connect(operator).mintVerifiedCredits(
          operator.address,
          DAC_UNIT_ID,
          hash,
          Math.floor(Date.now() / 1000),
          co2Amount,
          energy,
          33000000n, -117000000n, 95n, 100n,
          "ipfs://test", "arweave://test"
        );

        // Second mint with same hash fails
        await expect(
          carbonCredit.connect(operator).mintVerifiedCredits(
            operator.address,
            DAC_UNIT_ID,
            hash, // Duplicate hash
            Math.floor(Date.now() / 1000),
            co2Amount,
            energy,
            33000000n, -117000000n, 95n, 100n,
            "ipfs://test2", "arweave://test2"
          )
        ).to.be.revertedWithCustomError(carbonCredit, "DataHashAlreadyUsed");
      });

      it("should succeed with unique hash", async function () {
        const hash = generateHash();
        const co2Amount = 1000n * 10n ** 18n;
        const energy = (co2Amount * 300n) / 1000n;

        await expect(
          carbonCredit.connect(operator).mintVerifiedCredits(
            operator.address,
            DAC_UNIT_ID,
            hash,
            Math.floor(Date.now() / 1000),
            co2Amount,
            energy,
            33000000n, -117000000n, 95n, 100n,
            "ipfs://test", "arweave://test"
          )
        ).to.emit(carbonCredit, "CreditMinted");
      });
    });
  });

  // ============================================
  // SECTION 5: Tech Type Management Branches
  // ============================================

  describe("5. Tech Type Management Branches", function () {
    describe("5.1 Set Tech Thresholds", function () {
      it("should set valid tech thresholds", async function () {
        await expect(
          verificationEngine.setTechThresholds(
            TECH_BIOCHAR,
            250n, // minKwh
            650n, // maxKwh
            450n, // optimalKwh
            88n,  // minPurity
            "Biochar Custom"
          )
        ).to.emit(verificationEngine, "TechThresholdsUpdated");
      });

      it("should reject invalid threshold range (min > max)", async function () {
        await expect(
          verificationEngine.setTechThresholds(
            TECH_BIOCHAR,
            700n, // minKwh > maxKwh
            600n, // maxKwh
            650n,
            85n,
            "Invalid"
          )
        ).to.be.revertedWithCustomError(verificationEngine, "InvalidTechThresholds");
      });

      it("should reject optimal outside range", async function () {
        await expect(
          verificationEngine.setTechThresholds(
            TECH_BIOCHAR,
            200n,
            600n,
            700n, // optimal > max
            85n,
            "Invalid Optimal"
          )
        ).to.be.revertedWithCustomError(verificationEngine, "InvalidTechThresholds");
      });
    });

    describe("5.2 Set DAC Unit Tech Type", function () {
      it("should set tech type for existing DAC unit", async function () {
        // First set up the tech type
        await verificationEngine.setTechThresholds(
          TECH_BECCS,
          200n, 600n, 400n, 90n, "BECCS"
        );

        await expect(
          verificationEngine.setDacUnitTechType(DAC_UNIT_ID, TECH_BECCS)
        ).to.emit(verificationEngine, "DacUnitTechTypeUpdated");
      });

      it("should reject setting to inactive tech type", async function () {
        await expect(
          verificationEngine.setDacUnitTechType(DAC_UNIT_ID, 99) // Non-existent
        ).to.be.revertedWithCustomError(verificationEngine, "TechTypeNotActive");
      });

      it("should reject setting tech type for non-whitelisted DAC", async function () {
        const nonExistent = ethers.keccak256(ethers.toUtf8Bytes("NON-EXISTENT"));

        await verificationEngine.setTechThresholds(
          TECH_BECCS,
          200n, 600n, 400n, 90n, "BECCS"
        );

        await expect(
          verificationEngine.setDacUnitTechType(nonExistent, TECH_BECCS)
        ).to.be.revertedWithCustomError(verificationEngine, "DacUnitNotWhitelisted");
      });
    });

    describe("5.3 Deactivate Tech Type", function () {
      it("should deactivate active tech type", async function () {
        // First activate
        await verificationEngine.setTechThresholds(
          TECH_BIOCHAR,
          200n, 600n, 400n, 90n, "Biochar"
        );

        // Then deactivate - no event, just verify it doesn't revert
        await expect(
          verificationEngine.deactivateTechType(TECH_BIOCHAR)
        ).to.not.be.reverted;
      });

      it("should reject deactivating inactive tech type", async function () {
        await expect(
          verificationEngine.deactivateTechType(99)
        ).to.be.revertedWithCustomError(verificationEngine, "TechTypeNotActive");
      });
    });
  });

  // ============================================
  // SECTION 6: Thermodynamic Bounds Branches (via previewEfficiencyFactor)
  // Note: verify() has onlyCarbonCredit modifier, so we use the view function
  // ============================================

  describe("6. Thermodynamic Bounds Branches", function () {
    describe("6.1 Below Absolute Minimum (< MIN_KWH=200 kWh/tonne)", function () {
      it("should reject as too efficient", async function () {
        const co2Amount = 1000n * 10n ** 18n;
        const energy = 50n * 10n ** 18n; // 50 kWh/tonne < 200 minimum

        const result = await verificationEngine.previewEfficiencyFactor(
          co2Amount,
          energy,
          95n
        );

        expect(result.isValid).to.be.false;
      });
    });

    describe("6.2 Above Maximum (> MAX_KWH=600 kWh/tonne)", function () {
      it("should reject as too inefficient", async function () {
        const co2Amount = 100n * 10n ** 18n;
        const energy = 700n * 10n ** 18n; // 700 kWh/tonne > 600 maximum

        const result = await verificationEngine.previewEfficiencyFactor(
          co2Amount,
          energy,
          95n
        );

        expect(result.isValid).to.be.false;
      });
    });

    describe("6.3 At Boundary Values", function () {
      it("should accept exactly MIN_KWH=200 kWh/tonne", async function () {
        const co2Amount = 1000n * 10n ** 18n;
        const energy = 200n * 10n ** 18n; // Exactly at minimum

        const result = await verificationEngine.previewEfficiencyFactor(
          co2Amount,
          energy,
          95n
        );

        expect(result.isValid).to.be.true;
      });

      it("should accept exactly MAX_KWH=600 kWh/tonne", async function () {
        const co2Amount = 1000n * 10n ** 18n;
        const energy = 600n * 10n ** 18n; // Exactly at maximum

        const result = await verificationEngine.previewEfficiencyFactor(
          co2Amount,
          energy,
          95n
        );

        expect(result.isValid).to.be.true;
      });
    });
  });

  // ============================================
  // SECTION 7: Access Control Branches
  // ============================================

  describe("7. Access Control Branches", function () {
    it("should reject non-owner from whitelisting DAC units", async function () {
      const newDac = ethers.keccak256(ethers.toUtf8Bytes("NEW"));

      await expect(
        verificationEngine.connect(user1).whitelistDacUnit(newDac, user1.address)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("should reject non-owner from setting tech thresholds", async function () {
      await expect(
        verificationEngine.connect(user1).setTechThresholds(
          TECH_BIOCHAR,
          200n, 600n, 400n, 85n, "Biochar"
        )
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("should reject non-owner from removing DAC units", async function () {
      await expect(
        verificationEngine.connect(user1).removeDacUnit(DAC_UNIT_ID)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("should reject non-CarbonCredit from calling verify", async function () {
      const hash = ethers.keccak256(ethers.toUtf8Bytes("test-hash"));

      // Only CarbonCredit contract can call verify()
      await expect(
        verificationEngine.connect(user1).verify(
          DAC_UNIT_ID,
          hash,
          1000n * 10n ** 18n,
          300n * 10n ** 18n,
          95n,
          100n
        )
      ).to.be.revertedWithCustomError(verificationEngine, "UnauthorizedCaller");
    });
  });
});
