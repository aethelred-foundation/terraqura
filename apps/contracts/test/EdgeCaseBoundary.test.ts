/**
 * EdgeCaseBoundary - Enterprise Boundary Value Test Suite
 *
 * Comprehensive boundary value analysis (BVA) tests for all contracts.
 * Tests ensure correct behavior at exact boundaries, just below, and just above
 * critical thresholds to maximize branch coverage.
 *
 * Categories:
 * 1. Numeric Boundaries (min, max, zero, overflow potential)
 * 2. Array Boundaries (empty, single, max length)
 * 3. Time Boundaries (expiry, delays)
 * 4. Percentage Boundaries (0%, 100%, edge values)
 *
 * @version 1.0.0
 * @author TerraQura Engineering
 * @audit Pre-mainnet boundary analysis requirement
 */

import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import {
  CarbonCredit,
  CarbonMarketplace,
  VerificationEngine,
  TerraQuraMultisigMainnet,
  TerraQuraTimelockMainnet,
} from "../typechain-types";

describe("EdgeCaseBoundary", function () {
  // ============================================
  // Test Fixtures & Setup
  // ============================================

  let carbonCredit: CarbonCredit;
  let marketplace: CarbonMarketplace;
  let verificationEngine: VerificationEngine;
  let owner: SignerWithAddress;
  let operator: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;
  let user3: SignerWithAddress;
  let feeRecipient: SignerWithAddress;

  // Constants
  const SCALE = 10000n;
  const DAC_UNIT_ID = ethers.keccak256(ethers.toUtf8Bytes("BOUNDARY-DAC"));

  let hashCounter = 0;

  function generateHash(): string {
    hashCounter++;
    return ethers.keccak256(ethers.toUtf8Bytes(`BOUNDARY-${hashCounter}-${Date.now()}`));
  }

  beforeEach(async function () {
    [owner, operator, user1, user2, user3, feeRecipient] = await ethers.getSigners();

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
      [await verificationEngine.getAddress(), "https://terraqura.io/", owner.address],
      { initializer: "initialize" }
    ) as unknown as CarbonCredit;

    await verificationEngine.setCarbonCreditContract(await carbonCredit.getAddress());
    await verificationEngine.whitelistDacUnit(DAC_UNIT_ID, operator.address);
    await carbonCredit.setMinter(operator.address, true);

    // Deploy Marketplace
    const MarketplaceFactory = await ethers.getContractFactory("CarbonMarketplace");
    marketplace = await upgrades.deployProxy(
      MarketplaceFactory,
      [await carbonCredit.getAddress(), feeRecipient.address, 250n, owner.address],
      { initializer: "initialize" }
    ) as unknown as CarbonMarketplace;

    await marketplace.setKycStatus(operator.address, true);
    await marketplace.setKycStatus(user1.address, true);
  });

  async function mintCredits(amount: bigint = 10000n * 10n ** 18n): Promise<bigint> {
    const hash = generateHash();
    // Energy must be proportional to CO2 to maintain valid kWh/tonne ratio (300 kWh/tonne)
    const proportionalEnergy = (amount * 300n) / 1000n;

    const tx = await carbonCredit.connect(operator).mintVerifiedCredits(
      operator.address,
      DAC_UNIT_ID,
      hash,
      Math.floor(Date.now() / 1000),
      amount,
      proportionalEnergy,
      33000000n,
      -117000000n,
      95n,
      100n,
      "ipfs://test",
      "arweave://test"
    );

    const receipt = await tx.wait();
    const event = receipt?.logs.find((log) => {
      try {
        const parsed = carbonCredit.interface.parseLog({
          topics: log.topics as string[],
          data: log.data,
        });
        return parsed?.name === "CreditMinted";
      } catch {
        return false;
      }
    });

    if (event) {
      const parsed = carbonCredit.interface.parseLog({
        topics: event.topics as string[],
        data: event.data,
      });
      return parsed?.args[0];
    }
    throw new Error("CreditMinted event not found");
  }

  // ============================================
  // SECTION 1: Buffer Pool Percentage Boundaries
  // ============================================

  describe("1. Buffer Pool Percentage Boundaries", function () {
    describe("1.1 Exact Boundary Values", function () {
      it("should accept 0 bps (buffer disabled)", async function () {
        await expect(
          carbonCredit.setBufferConfiguration(ethers.ZeroAddress, 0n)
        ).to.not.be.reverted;
      });

      it("should accept 1 bps (0.01% - minimum positive)", async function () {
        await expect(
          carbonCredit.setBufferConfiguration(user1.address, 1n)
        ).to.not.be.reverted;
      });

      it("should accept 999 bps (9.99% - just below max)", async function () {
        await expect(
          carbonCredit.setBufferConfiguration(user1.address, 999n)
        ).to.not.be.reverted;
      });

      it("should accept 1000 bps (10% - exact max)", async function () {
        await expect(
          carbonCredit.setBufferConfiguration(user1.address, 1000n)
        ).to.not.be.reverted;
      });

      it("should reject 1001 bps (10.01% - just above max)", async function () {
        await expect(
          carbonCredit.setBufferConfiguration(user1.address, 1001n)
        ).to.be.revertedWithCustomError(carbonCredit, "InvalidBufferPercentage");
      });

      it("should reject max uint256", async function () {
        await expect(
          carbonCredit.setBufferConfiguration(user1.address, ethers.MaxUint256)
        ).to.be.revertedWithCustomError(carbonCredit, "InvalidBufferPercentage");
      });
    });
  });

  // ============================================
  // SECTION 2: Marketplace Fee Boundaries
  // ============================================

  describe("2. Marketplace Fee Boundaries", function () {
    describe("2.1 Platform Fee Boundaries", function () {
      it("should handle 0% platform fee", async function () {
        await marketplace.setPlatformFee(0n);

        const tokenId = await mintCredits();
        await carbonCredit.connect(operator).setApprovalForAll(await marketplace.getAddress(), true);
        await marketplace.connect(operator).createListing(tokenId, 100n, ethers.parseEther("0.01"), 0, 0);

        const feeBalanceBefore = await ethers.provider.getBalance(feeRecipient.address);
        await marketplace.connect(user1).purchase(1, 10n, { value: ethers.parseEther("0.1") });
        const feeBalanceAfter = await ethers.provider.getBalance(feeRecipient.address);

        // No fee should be collected
        expect(feeBalanceAfter).to.equal(feeBalanceBefore);
      });

      it("should handle maximum platform fee (5%)", async function () {
        await marketplace.setPlatformFee(500n); // 5% (MAX_FEE_BPS)

        const tokenId = await mintCredits();
        await carbonCredit.connect(operator).setApprovalForAll(await marketplace.getAddress(), true);
        await marketplace.connect(operator).createListing(tokenId, 100n, ethers.parseEther("0.1"), 0, 0);

        const purchasePrice = ethers.parseEther("1"); // 10 credits * 0.1 ETH
        const expectedFee = purchasePrice / 20n; // 5%

        const feeBalanceBefore = await ethers.provider.getBalance(feeRecipient.address);
        await marketplace.connect(user1).purchase(1, 10n, { value: purchasePrice });
        const feeBalanceAfter = await ethers.provider.getBalance(feeRecipient.address);

        expect(feeBalanceAfter - feeBalanceBefore).to.equal(expectedFee);
      });

      it("should reject fee above maximum (5%)", async function () {
        await expect(
          marketplace.setPlatformFee(501n) // Above MAX_FEE_BPS (500)
        ).to.be.revertedWithCustomError(marketplace, "FeeTooHigh");
      });
    });
  });

  // ============================================
  // SECTION 3: CO2 Amount Boundaries (via previewEfficiencyFactor)
  // ============================================

  describe("3. CO2 Amount Boundaries", function () {
    describe("3.1 Efficiency Factor Preview", function () {
      it("should preview valid efficiency with proper kWh/tonne ratio", async function () {
        const co2Amount = 1000n * 10n ** 18n;
        const energy = 300n * 10n ** 18n; // 300 kWh/tonne - valid range
        const kwhPerTonne = (energy * 1000n) / co2Amount; // = 300

        const result = await verificationEngine.previewEfficiencyFactor(
          co2Amount,
          energy,
          95n // purity above minimum (90)
        );

        expect(result.isValid).to.be.true;
        expect(result.efficiencyFactor).to.be.gt(0n);
      });

      it("should reject with low purity", async function () {
        const co2Amount = 1000n * 10n ** 18n;
        const energy = 300n * 10n ** 18n;

        const result = await verificationEngine.previewEfficiencyFactor(
          co2Amount,
          energy,
          85n // Below MIN_PURITY (90)
        );

        expect(result.isValid).to.be.false;
      });

      it("should handle very large CO2 amounts", async function () {
        const largeCo2 = 10n ** 24n; // 1 million tonnes
        const energy = largeCo2 * 300n / 1000n; // Maintain 300 kWh/tonne ratio

        const result = await verificationEngine.previewEfficiencyFactor(
          largeCo2,
          energy,
          95n
        );

        expect(result.isValid).to.be.true;
      });
    });
  });

  // ============================================
  // SECTION 4: Energy Efficiency Boundaries (via previewEfficiencyFactor)
  // ============================================

  describe("4. Energy Efficiency Boundaries", function () {
    describe("4.1 kWh/tonne Thresholds", function () {
      it("should reject 199 kWh/tonne (just below minimum)", async function () {
        const co2Amount = 1000n * 10n ** 18n;
        const energy = 199n * 10n ** 18n; // 199 kWh/tonne

        const result = await verificationEngine.previewEfficiencyFactor(
          co2Amount,
          energy,
          95n
        );

        expect(result.isValid).to.be.false;
      });

      it("should accept 200 kWh/tonne (exactly at MIN_KWH_PER_TONNE)", async function () {
        const co2Amount = 1000n * 10n ** 18n;
        const energy = 200n * 10n ** 18n; // 200 kWh/tonne

        const result = await verificationEngine.previewEfficiencyFactor(
          co2Amount,
          energy,
          95n
        );

        expect(result.isValid).to.be.true;
      });

      it("should accept 600 kWh/tonne (exactly at MAX_KWH_PER_TONNE)", async function () {
        const co2Amount = 1000n * 10n ** 18n;
        const energy = 600n * 10n ** 18n; // 600 kWh/tonne - MAX

        const result = await verificationEngine.previewEfficiencyFactor(
          co2Amount,
          energy,
          95n
        );

        expect(result.isValid).to.be.true;
      });

      it("should reject 601 kWh/tonne (just above maximum)", async function () {
        const co2Amount = 1000n * 10n ** 18n;
        const energy = 601n * 10n ** 18n; // 601 kWh/tonne

        const result = await verificationEngine.previewEfficiencyFactor(
          co2Amount,
          energy,
          95n
        );

        expect(result.isValid).to.be.false;
      });

      it("should accept optimal 350 kWh/tonne", async function () {
        const co2Amount = 1000n * 10n ** 18n;
        const energy = 350n * 10n ** 18n; // Optimal

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
  // SECTION 5: Purity Boundaries (via previewEfficiencyFactor)
  // ============================================

  describe("5. Purity Boundaries", function () {
    describe("5.1 Minimum Purity Thresholds", function () {
      it("should reject 89% purity (just below MIN_PURITY=90)", async function () {
        const co2Amount = 1000n * 10n ** 18n;
        const energy = 300n * 10n ** 18n;

        const result = await verificationEngine.previewEfficiencyFactor(
          co2Amount,
          energy,
          89n // Below MIN_PURITY (90)
        );

        expect(result.isValid).to.be.false;
      });

      it("should accept 90% purity (exactly at MIN_PURITY_PERCENTAGE)", async function () {
        const co2Amount = 1000n * 10n ** 18n;
        const energy = 300n * 10n ** 18n;

        const result = await verificationEngine.previewEfficiencyFactor(
          co2Amount,
          energy,
          90n // Exactly at minimum
        );

        expect(result.isValid).to.be.true;
      });

      it("should accept 100% purity (maximum)", async function () {
        const co2Amount = 1000n * 10n ** 18n;
        const energy = 300n * 10n ** 18n;

        const result = await verificationEngine.previewEfficiencyFactor(
          co2Amount,
          energy,
          100n // Maximum purity
        );

        expect(result.isValid).to.be.true;
      });
    });
  });

  // ============================================
  // SECTION 6: Listing Amount Boundaries
  // ============================================

  describe("6. Listing Amount Boundaries", function () {
    let tokenId: bigint;

    beforeEach(async function () {
      tokenId = await mintCredits(10000n * SCALE);
      await carbonCredit.connect(operator).setApprovalForAll(await marketplace.getAddress(), true);
    });

    describe("6.1 Amount Validation", function () {
      it("should reject zero amount listing", async function () {
        await expect(
          marketplace.connect(operator).createListing(tokenId, 0n, ethers.parseEther("0.01"), 0, 0)
        ).to.be.revertedWithCustomError(marketplace, "InvalidAmount");
      });

      it("should accept 1 credit listing (minimum)", async function () {
        await expect(
          marketplace.connect(operator).createListing(tokenId, 1n, ethers.parseEther("0.01"), 0, 0)
        ).to.not.be.reverted;
      });

      it("should reject listing more than balance", async function () {
        const balance = await carbonCredit.balanceOf(operator.address, tokenId);

        await expect(
          marketplace.connect(operator).createListing(tokenId, balance + 1n, ethers.parseEther("0.01"), 0, 0)
        ).to.be.revertedWithCustomError(marketplace, "InsufficientBalance");
      });

      it("should accept listing exact balance", async function () {
        const balance = await carbonCredit.balanceOf(operator.address, tokenId);

        await expect(
          marketplace.connect(operator).createListing(tokenId, balance, ethers.parseEther("0.01"), 0, 0)
        ).to.not.be.reverted;
      });
    });
  });

  // ============================================
  // SECTION 7: Price Boundaries
  // ============================================

  describe("7. Price Boundaries", function () {
    let tokenId: bigint;

    beforeEach(async function () {
      tokenId = await mintCredits();
      await carbonCredit.connect(operator).setApprovalForAll(await marketplace.getAddress(), true);
    });

    describe("7.1 Price Validation", function () {
      it("should reject zero price", async function () {
        await expect(
          marketplace.connect(operator).createListing(tokenId, 100n, 0n, 0, 0)
        ).to.be.revertedWithCustomError(marketplace, "InvalidPrice");
      });

      it("should accept 1 wei price (minimum)", async function () {
        await expect(
          marketplace.connect(operator).createListing(tokenId, 100n, 1n, 0, 0)
        ).to.not.be.reverted;
      });

      it("should accept very large price", async function () {
        await expect(
          marketplace.connect(operator).createListing(tokenId, 100n, ethers.parseEther("1000000"), 0, 0)
        ).to.not.be.reverted;
      });
    });
  });

  // ============================================
  // SECTION 8: Array Length Boundaries
  // ============================================

  describe("8. Array Length Boundaries", function () {
    describe("8.1 Empty Arrays", function () {
      it("should reject empty batch retire", async function () {
        await expect(
          carbonCredit.connect(operator).batchRetireCredits([], [], "empty")
        ).to.be.revertedWith("Invalid batch size");
      });

      it("should handle empty batch get listings", async function () {
        const result = await marketplace.batchGetListings([]);
        expect(result.length).to.equal(0);
      });

      it("should handle empty batch balance query", async function () {
        // batchBalanceOf takes (account, tokenIds[]) so use valid account with empty tokenIds
        const result = await carbonCredit.batchBalanceOf(operator.address, []);
        expect(result.length).to.equal(0);
      });
    });

    describe("8.2 Single Element Arrays", function () {
      it("should handle single element batch retire", async function () {
        const tokenId = await mintCredits();
        const balance = await carbonCredit.balanceOf(operator.address, tokenId);

        await expect(
          carbonCredit.connect(operator).batchRetireCredits([tokenId], [balance], "single retirement")
        ).to.not.be.reverted;
      });
    });

    describe("8.3 Mismatched Array Lengths", function () {
      it("should reject mismatched retire arrays", async function () {
        const tokenId = await mintCredits();

        await expect(
          carbonCredit.connect(operator).batchRetireCredits(
            [tokenId, tokenId],
            [100n],
            "mismatched"
          )
        ).to.be.revertedWith("Length mismatch");
      });

      it("should handle balance query for single account with multiple tokens", async function () {
        const tokenId1 = await mintCredits();
        const tokenId2 = await mintCredits();

        const balances = await carbonCredit.batchBalanceOf(operator.address, [tokenId1, tokenId2]);
        expect(balances.length).to.equal(2);
      });
    });
  });

  // ============================================
  // SECTION 9: Offer Duration Boundaries
  // ============================================

  describe("9. Offer Duration Boundaries", function () {
    let tokenId: bigint;

    beforeEach(async function () {
      tokenId = await mintCredits();
      await carbonCredit.connect(operator).setApprovalForAll(await marketplace.getAddress(), true);
    });

    describe("9.1 Duration Validation", function () {
      it("should handle minimum duration (1 second)", async function () {
        const deposit = ethers.parseEther("1");

        await expect(
          marketplace.connect(user1).createOffer(tokenId, 100n, ethers.parseEther("0.01"), 1, { value: deposit })
        ).to.not.be.reverted;
      });

      it("should handle long duration (1 year)", async function () {
        const deposit = ethers.parseEther("1");
        const oneYear = 365 * 24 * 60 * 60;

        await expect(
          marketplace.connect(user1).createOffer(tokenId, 100n, ethers.parseEther("0.01"), oneYear, { value: deposit })
        ).to.not.be.reverted;
      });
    });
  });

  // ============================================
  // SECTION 10: Verification Constants Boundaries
  // ============================================

  describe("10. Verification Constants Boundaries", function () {
    describe("10.1 Constants Verification", function () {
      it("should have correct MIN_KWH_PER_TONNE constant", async function () {
        expect(await verificationEngine.MIN_KWH_PER_TONNE()).to.equal(200n);
      });

      it("should have correct MAX_KWH_PER_TONNE constant", async function () {
        expect(await verificationEngine.MAX_KWH_PER_TONNE()).to.equal(600n); // Actual value is 600
      });

      it("should have correct MIN_PURITY_PERCENTAGE constant", async function () {
        expect(await verificationEngine.MIN_PURITY_PERCENTAGE()).to.equal(90n); // Actual value is 90
      });

      it("should verify DAC unit is whitelisted", async function () {
        expect(await verificationEngine.isWhitelisted(DAC_UNIT_ID)).to.be.true; // Correct function name
      });
    });
  });

  // ============================================
  // SECTION 11: Retirement Boundaries
  // ============================================

  describe("11. Retirement Boundaries", function () {
    let tokenId: bigint;
    let balance: bigint;

    beforeEach(async function () {
      tokenId = await mintCredits();
      balance = await carbonCredit.balanceOf(operator.address, tokenId);
    });

    describe("11.1 Retirement Amount Boundaries", function () {
      it("should allow retiring 1 credit (minimum)", async function () {
        await expect(
          carbonCredit.connect(operator).retireCredits(tokenId, 1n, "minimum")
        ).to.emit(carbonCredit, "CreditRetired");
      });

      it("should allow retiring exact balance", async function () {
        await expect(
          carbonCredit.connect(operator).retireCredits(tokenId, balance, "full")
        ).to.emit(carbonCredit, "CreditRetired");

        const metadata = await carbonCredit.getMetadata(tokenId);
        expect(metadata.isRetired).to.be.true;
      });

      it("should reject retiring more than balance", async function () {
        await expect(
          carbonCredit.connect(operator).retireCredits(tokenId, balance + 1n, "over")
        ).to.be.revertedWithCustomError(carbonCredit, "InsufficientBalance");
      });

      it("should allow retiring zero (no-op)", async function () {
        // Zero retirement is allowed (just doesn't do anything meaningful)
        await expect(
          carbonCredit.connect(operator).retireCredits(tokenId, 0n, "zero")
        ).to.not.be.reverted;
      });
    });
  });

  // ============================================
  // SECTION 12: Multisig Boundaries
  // ============================================

  describe("12. Multisig Signer Boundaries", function () {
    let multisig: TerraQuraMultisigMainnet;

    describe("12.1 Signer Count Boundaries", function () {
      it("should reject 4 signers (below minimum 5)", async function () {
        const signers = await ethers.getSigners();
        const MultisigFactory = await ethers.getContractFactory("TerraQuraMultisigMainnet");

        await expect(
          MultisigFactory.deploy(
            [signers[0].address, signers[1].address, signers[2].address, signers[3].address],
            ["US", "GB", "DE", "FR"],
            ["LEDGER", "TREZOR", "LEDGER", "TREZOR"],
            3
          )
        ).to.be.revertedWith("Need at least 5 signers");
      });

      it("should accept exactly 5 signers (minimum)", async function () {
        const signers = await ethers.getSigners();
        const MultisigFactory = await ethers.getContractFactory("TerraQuraMultisigMainnet");

        await expect(
          MultisigFactory.deploy(
            [signers[0].address, signers[1].address, signers[2].address, signers[3].address, signers[4].address],
            ["US", "GB", "DE", "FR", "JP"],
            ["LEDGER", "TREZOR", "LEDGER", "TREZOR", "LEDGER"],
            3
          )
        ).to.not.be.reverted;
      });

      it("should accept exactly 10 signers (maximum)", async function () {
        const signers = await ethers.getSigners();
        const MultisigFactory = await ethers.getContractFactory("TerraQuraMultisigMainnet");

        await expect(
          MultisigFactory.deploy(
            signers.slice(0, 10).map(s => s.address),
            ["US", "GB", "DE", "FR", "JP", "AU", "CA", "NZ", "SG", "CH"],
            ["LEDGER", "TREZOR", "LEDGER", "TREZOR", "LEDGER", "TREZOR", "LEDGER", "TREZOR", "LEDGER", "TREZOR"],
            3
          )
        ).to.not.be.reverted;
      });

      it("should reject 11 signers (above maximum)", async function () {
        const signers = await ethers.getSigners();
        const MultisigFactory = await ethers.getContractFactory("TerraQuraMultisigMainnet");

        await expect(
          MultisigFactory.deploy(
            signers.slice(0, 11).map(s => s.address),
            ["US", "GB", "DE", "FR", "JP", "AU", "CA", "NZ", "SG", "CH", "SE"],
            ["LEDGER", "TREZOR", "LEDGER", "TREZOR", "LEDGER", "TREZOR", "LEDGER", "TREZOR", "LEDGER", "TREZOR", "LEDGER"],
            3
          )
        ).to.be.revertedWith("Too many signers");
      });
    });

    describe("12.2 Threshold Boundaries", function () {
      it("should reject threshold 2 (below minimum 3)", async function () {
        const signers = await ethers.getSigners();
        const MultisigFactory = await ethers.getContractFactory("TerraQuraMultisigMainnet");

        await expect(
          MultisigFactory.deploy(
            [signers[0].address, signers[1].address, signers[2].address, signers[3].address, signers[4].address],
            ["US", "GB", "DE", "FR", "JP"],
            ["LEDGER", "TREZOR", "LEDGER", "TREZOR", "LEDGER"],
            2 // Below minimum
          )
        ).to.be.revertedWith("Threshold must be >= 3");
      });

      it("should accept threshold 3 (minimum)", async function () {
        const signers = await ethers.getSigners();
        const MultisigFactory = await ethers.getContractFactory("TerraQuraMultisigMainnet");

        await expect(
          MultisigFactory.deploy(
            [signers[0].address, signers[1].address, signers[2].address, signers[3].address, signers[4].address],
            ["US", "GB", "DE", "FR", "JP"],
            ["LEDGER", "TREZOR", "LEDGER", "TREZOR", "LEDGER"],
            3
          )
        ).to.not.be.reverted;
      });

      it("should reject threshold exceeding signer count", async function () {
        const signers = await ethers.getSigners();
        const MultisigFactory = await ethers.getContractFactory("TerraQuraMultisigMainnet");

        await expect(
          MultisigFactory.deploy(
            [signers[0].address, signers[1].address, signers[2].address, signers[3].address, signers[4].address],
            ["US", "GB", "DE", "FR", "JP"],
            ["LEDGER", "TREZOR", "LEDGER", "TREZOR", "LEDGER"],
            6 // More than 5 signers
          )
        ).to.be.revertedWith("Threshold exceeds signers");
      });
    });

    describe("12.3 Geographic Distribution Boundaries", function () {
      it("should reject 2 unique countries (below minimum 3)", async function () {
        const signers = await ethers.getSigners();
        const MultisigFactory = await ethers.getContractFactory("TerraQuraMultisigMainnet");

        await expect(
          MultisigFactory.deploy(
            [signers[0].address, signers[1].address, signers[2].address, signers[3].address, signers[4].address],
            ["US", "US", "US", "GB", "GB"], // Only 2 unique countries
            ["LEDGER", "TREZOR", "LEDGER", "TREZOR", "LEDGER"],
            3
          )
        ).to.be.revertedWith("Insufficient geographic distribution - need 3+ countries");
      });

      it("should accept exactly 3 unique countries (minimum)", async function () {
        const signers = await ethers.getSigners();
        const MultisigFactory = await ethers.getContractFactory("TerraQuraMultisigMainnet");

        await expect(
          MultisigFactory.deploy(
            [signers[0].address, signers[1].address, signers[2].address, signers[3].address, signers[4].address],
            ["US", "US", "GB", "GB", "DE"], // Exactly 3 unique countries
            ["LEDGER", "TREZOR", "LEDGER", "TREZOR", "LEDGER"],
            3
          )
        ).to.not.be.reverted;
      });
    });
  });

  // ============================================
  // SECTION 13: Timelock Delay Boundaries
  // ============================================

  describe("13. Timelock Delay Boundaries", function () {
    describe("13.1 Minimum Delay Boundaries", function () {
      it("should reject delay below 48 hours", async function () {
        const signers = await ethers.getSigners();
        const TimelockFactory = await ethers.getContractFactory("TerraQuraTimelockMainnet");

        const HOUR = 3600;

        await expect(
          TimelockFactory.deploy(
            47 * HOUR, // Below 48 hour minimum
            [signers[0].address],
            [signers[1].address],
            signers[2].address
          )
        ).to.be.revertedWithCustomError(TimelockFactory, "DelayTooShort");
      });

      it("should accept exactly 48 hour delay (minimum)", async function () {
        const signers = await ethers.getSigners();
        const TimelockFactory = await ethers.getContractFactory("TerraQuraTimelockMainnet");

        const HOUR = 3600;

        await expect(
          TimelockFactory.deploy(
            48 * HOUR,
            [signers[0].address],
            [signers[1].address],
            signers[2].address
          )
        ).to.not.be.reverted;
      });

      it("should reject delay above 30 days", async function () {
        const signers = await ethers.getSigners();
        const TimelockFactory = await ethers.getContractFactory("TerraQuraTimelockMainnet");

        const DAY = 24 * 3600;

        await expect(
          TimelockFactory.deploy(
            31 * DAY, // Above 30 day maximum
            [signers[0].address],
            [signers[1].address],
            signers[2].address
          )
        ).to.be.revertedWithCustomError(TimelockFactory, "DelayTooLong");
      });
    });
  });
});
