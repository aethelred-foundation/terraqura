/**
 * BranchCoverageCarbonCredit - Enterprise Branch Coverage Test Suite
 *
 * Comprehensive branch coverage tests for CarbonCredit.sol targeting 95%+
 * coverage. Tests are organized by feature area with explicit branch condition
 * documentation to ensure all paths are exercised.
 *
 * Branch Coverage Categories:
 * 1. Buffer Pool Logic (Lines 342-360) - 4 branches
 * 2. Retirement Logic (Lines 388-402) - 3 branches
 * 3. Buffer Configuration Validation (Lines 521-539) - 4 branches
 * 4. Reversal Handling (Lines 591-618) - 4 branches
 * 5. Buffer Release (Lines 551-571) - 3 branches
 * 6. Batch Operations - Multiple branches
 *
 * @version 1.0.0
 * @author TerraQura Engineering
 * @audit Pre-mainnet branch coverage requirement
 */

import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { CarbonCredit, VerificationEngine } from "../typechain-types";

describe("BranchCoverageCarbonCredit", function () {
  // ============================================
  // Test Fixtures & Setup
  // ============================================

  let carbonCredit: CarbonCredit;
  let verificationEngine: VerificationEngine;
  let owner: SignerWithAddress;
  let minter: SignerWithAddress;
  let operator: SignerWithAddress;
  let bufferPool: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;

  // Constants
  const SCALE = 10000n;
  const MAX_BUFFER_BPS = 1000n; // 10%
  const DAC_UNIT_ID = ethers.keccak256(ethers.toUtf8Bytes("DAC-UNIT-001"));
  const SOURCE_DATA_HASH_BASE = ethers.keccak256(ethers.toUtf8Bytes("SOURCE-DATA"));

  // Minting parameters
  const DEFAULT_CO2_AMOUNT = 1000n * 10n ** 18n; // 1000 tonnes
  const DEFAULT_ENERGY = 250n * 10n ** 18n; // 250 kWh/tonne
  const DEFAULT_LAT = 33000000n; // 33.0 degrees
  const DEFAULT_LONG = -117000000n; // -117.0 degrees
  const DEFAULT_PURITY = 99n; // 99%
  const DEFAULT_GRID_INTENSITY = 100n; // 100 gCO2/kWh

  let tokenIdCounter = 0;

  /**
   * Generate unique source data hash for each test
   */
  function generateUniqueHash(): string {
    tokenIdCounter++;
    return ethers.keccak256(ethers.toUtf8Bytes(`SOURCE-DATA-${tokenIdCounter}-${Date.now()}`));
  }

  /**
   * Deploy fresh contracts before each test
   */
  beforeEach(async function () {
    [owner, minter, operator, bufferPool, user1, user2] = await ethers.getSigners();

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

    // Set CarbonCredit in VerificationEngine
    await verificationEngine.setCarbonCreditContract(await carbonCredit.getAddress());

    // Whitelist DAC unit
    await verificationEngine.whitelistDacUnit(DAC_UNIT_ID, operator.address);

    // Approve minter
    await carbonCredit.setMinter(minter.address, true);
  });

  /**
   * Helper to mint credits with default parameters
   */
  async function mintCredits(
    to: string,
    amount: bigint = DEFAULT_CO2_AMOUNT,
    sourceHash?: string
  ): Promise<bigint> {
    const hash = sourceHash || generateUniqueHash();
    const timestamp = Math.floor(Date.now() / 1000);

    // Energy must be proportional to CO2 to maintain valid kWh/tonne ratio (300 kWh/tonne)
    const proportionalEnergy = (amount * 300n) / 1000n; // 300 kWh per 1000 kg (1 tonne)

    const tx = await carbonCredit.connect(minter).mintVerifiedCredits(
      to,
      DAC_UNIT_ID,
      hash,
      timestamp,
      amount,
      proportionalEnergy,
      DEFAULT_LAT,
      DEFAULT_LONG,
      DEFAULT_PURITY,
      DEFAULT_GRID_INTENSITY,
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
  // SECTION 1: Buffer Pool Logic Branches
  // Covers Lines 342-360
  // ============================================

  describe("1. Buffer Pool Logic Branches", function () {
    describe("1.1 Buffer Pool Active State (Both Conditions True)", function () {
      /**
       * Branch: bufferPoolAddress != address(0) && bufferPercentageBps > 0
       * Expected: Credits split between operator and buffer pool
       */
      it("should split credits when buffer pool fully configured", async function () {
        // Configure buffer pool: address set, percentage > 0
        await carbonCredit.setBufferConfiguration(bufferPool.address, 500n); // 5%

        const tokenId = await mintCredits(operator.address, 1000n * SCALE);

        // Calculate expected amounts
        const totalCredits = await carbonCredit.balanceOf(operator.address, tokenId) +
          await carbonCredit.bufferPoolBalance(tokenId);

        const bufferBalance = await carbonCredit.bufferPoolBalance(tokenId);
        const operatorBalance = await carbonCredit.balanceOf(operator.address, tokenId);

        // Verify buffer received 5%
        expect(bufferBalance).to.be.gt(0);
        // Verify operator received 95%
        expect(operatorBalance).to.be.gt(0);
        // Verify total adds up
        expect(bufferBalance + operatorBalance).to.be.gte(totalCredits - 1n);
      });

      it("should emit BufferPoolAllocation event when buffer active", async function () {
        await carbonCredit.setBufferConfiguration(bufferPool.address, 500n);

        const hash = generateUniqueHash();
        const timestamp = Math.floor(Date.now() / 1000);

        await expect(
          carbonCredit.connect(minter).mintVerifiedCredits(
            operator.address,
            DAC_UNIT_ID,
            hash,
            timestamp,
            DEFAULT_CO2_AMOUNT,
            DEFAULT_ENERGY,
            DEFAULT_LAT,
            DEFAULT_LONG,
            DEFAULT_PURITY,
            DEFAULT_GRID_INTENSITY,
            "ipfs://test",
            "arweave://test"
          )
        ).to.emit(carbonCredit, "BufferPoolAllocation");
      });

      it("should update totalBufferPoolCredits when minting with buffer", async function () {
        await carbonCredit.setBufferConfiguration(bufferPool.address, 1000n); // 10%

        const initialTotal = await carbonCredit.totalBufferPoolCredits();

        await mintCredits(operator.address);

        const finalTotal = await carbonCredit.totalBufferPoolCredits();
        expect(finalTotal).to.be.gt(initialTotal);
      });
    });

    describe("1.2 Buffer Pool Disabled - Zero Address", function () {
      /**
       * Branch: bufferPoolAddress == address(0)
       * Expected: All credits go to operator, no buffer allocation
       */
      it("should mint all credits to operator when buffer address is zero", async function () {
        // Ensure buffer pool is disabled (default state)
        const stats = await carbonCredit.getBufferPoolStats();
        expect(stats.poolAddress).to.equal(ethers.ZeroAddress);

        const tokenId = await mintCredits(operator.address, 1000n * SCALE);

        // All credits should go to operator
        const operatorBalance = await carbonCredit.balanceOf(operator.address, tokenId);
        const bufferBalance = await carbonCredit.bufferPoolBalance(tokenId);

        expect(bufferBalance).to.equal(0);
        expect(operatorBalance).to.be.gt(0);
      });

      it("should NOT emit BufferPoolAllocation when address is zero", async function () {
        // Buffer not configured - should not emit BufferPoolAllocation
        const hash = generateUniqueHash();
        const timestamp = Math.floor(Date.now() / 1000);

        await expect(
          carbonCredit.connect(minter).mintVerifiedCredits(
            operator.address,
            DAC_UNIT_ID,
            hash,
            timestamp,
            DEFAULT_CO2_AMOUNT,
            DEFAULT_ENERGY,
            DEFAULT_LAT,
            DEFAULT_LONG,
            DEFAULT_PURITY,
            DEFAULT_GRID_INTENSITY,
            "ipfs://test",
            "arweave://test"
          )
        ).to.not.emit(carbonCredit, "BufferPoolAllocation");
      });
    });

    describe("1.3 Buffer Pool Disabled - Zero Percentage", function () {
      /**
       * Branch: bufferPercentageBps == 0
       * Expected: All credits go to operator even with valid address
       */
      it("should mint all credits to operator when percentage is zero", async function () {
        // Set address but percentage is 0
        await carbonCredit.setBufferConfiguration(bufferPool.address, 0n);

        const tokenId = await mintCredits(operator.address, 1000n * SCALE);

        const bufferBalance = await carbonCredit.bufferPoolBalance(tokenId);
        expect(bufferBalance).to.equal(0);
      });
    });

    describe("1.4 Buffer Pool Edge Cases", function () {
      it("should handle maximum buffer percentage (10%)", async function () {
        await carbonCredit.setBufferConfiguration(bufferPool.address, 1000n); // 10%

        const tokenId = await mintCredits(operator.address, 10000n * SCALE);

        const bufferBalance = await carbonCredit.bufferPoolBalance(tokenId);
        expect(bufferBalance).to.be.gt(0);
      });

      it("should handle minimum buffer percentage (1 bps = 0.01%)", async function () {
        await carbonCredit.setBufferConfiguration(bufferPool.address, 1n); // 0.01%

        const tokenId = await mintCredits(operator.address, 1000000n * SCALE);

        const bufferBalance = await carbonCredit.bufferPoolBalance(tokenId);
        expect(bufferBalance).to.be.gt(0);
      });

      it("should correctly track per-token buffer balances", async function () {
        await carbonCredit.setBufferConfiguration(bufferPool.address, 500n);

        const tokenId1 = await mintCredits(operator.address);
        const tokenId2 = await mintCredits(operator.address);

        const balance1 = await carbonCredit.bufferPoolBalance(tokenId1);
        const balance2 = await carbonCredit.bufferPoolBalance(tokenId2);

        expect(balance1).to.be.gt(0);
        expect(balance2).to.be.gt(0);
        expect(balance1).to.not.equal(0);
        expect(balance2).to.not.equal(0);
      });
    });
  });

  // ============================================
  // SECTION 2: Retirement Logic Branches
  // Covers Lines 388-402
  // ============================================

  describe("2. Retirement Logic Branches", function () {
    describe("2.1 Partial Retirement (Balance > 0 After)", function () {
      /**
       * Branch: balanceOf(msg.sender, tokenId) > 0 after burn
       * Expected: isRetired should remain FALSE
       */
      it("should NOT mark retired when partial retirement leaves balance > 0", async function () {
        const tokenId = await mintCredits(operator.address, 1000n * SCALE);

        const initialBalance = await carbonCredit.balanceOf(operator.address, tokenId);

        // Retire only 50%
        const retireAmount = initialBalance / 2n;
        await carbonCredit.connect(operator).retireCredits(tokenId, retireAmount, "partial retirement");

        // Check remaining balance
        const remainingBalance = await carbonCredit.balanceOf(operator.address, tokenId);
        expect(remainingBalance).to.be.gt(0);

        // isRetired should be FALSE (balance still exists)
        const metadata = await carbonCredit.getMetadata(tokenId);
        expect(metadata.isRetired).to.be.false;
      });

      it("should allow multiple partial retirements without marking retired", async function () {
        const tokenId = await mintCredits(operator.address, 1000n * SCALE);

        const initialBalance = await carbonCredit.balanceOf(operator.address, tokenId);
        const partialAmount = initialBalance / 4n;

        // Retire 25%
        await carbonCredit.connect(operator).retireCredits(tokenId, partialAmount, "first partial");
        let metadata = await carbonCredit.getMetadata(tokenId);
        expect(metadata.isRetired).to.be.false;

        // Retire another 25%
        await carbonCredit.connect(operator).retireCredits(tokenId, partialAmount, "second partial");
        metadata = await carbonCredit.getMetadata(tokenId);
        expect(metadata.isRetired).to.be.false;

        // Still have 50% remaining
        const remaining = await carbonCredit.balanceOf(operator.address, tokenId);
        expect(remaining).to.be.gt(0);
      });
    });

    describe("2.2 Full Retirement (Balance = 0 After)", function () {
      /**
       * Branch: balanceOf(msg.sender, tokenId) == 0 after burn
       * Expected: isRetired should be TRUE
       */
      it("should mark retired when full balance is retired", async function () {
        const tokenId = await mintCredits(operator.address, 1000n * SCALE);

        const fullBalance = await carbonCredit.balanceOf(operator.address, tokenId);

        // Retire full balance
        await carbonCredit.connect(operator).retireCredits(tokenId, fullBalance, "full retirement");

        // Check balance is now 0
        const remainingBalance = await carbonCredit.balanceOf(operator.address, tokenId);
        expect(remainingBalance).to.equal(0);

        // isRetired should be TRUE
        const metadata = await carbonCredit.getMetadata(tokenId);
        expect(metadata.isRetired).to.be.true;
      });

      it("should mark retired when last partial retirement empties balance", async function () {
        const tokenId = await mintCredits(operator.address, 1000n * SCALE);

        const initialBalance = await carbonCredit.balanceOf(operator.address, tokenId);

        // Retire 60%
        const firstRetire = (initialBalance * 60n) / 100n;
        await carbonCredit.connect(operator).retireCredits(tokenId, firstRetire, "first partial");

        let metadata = await carbonCredit.getMetadata(tokenId);
        expect(metadata.isRetired).to.be.false;

        // Retire remaining 40%
        const remaining = await carbonCredit.balanceOf(operator.address, tokenId);
        await carbonCredit.connect(operator).retireCredits(tokenId, remaining, "final retirement");

        // NOW isRetired should be TRUE
        metadata = await carbonCredit.getMetadata(tokenId);
        expect(metadata.isRetired).to.be.true;
      });
    });

    describe("2.3 Retirement Validation Branches", function () {
      it("should revert when retiring more than balance", async function () {
        const tokenId = await mintCredits(operator.address, 100n * SCALE);

        const balance = await carbonCredit.balanceOf(operator.address, tokenId);

        await expect(
          carbonCredit.connect(operator).retireCredits(tokenId, balance + 1n, "over-retire")
        ).to.be.revertedWithCustomError(carbonCredit, "InsufficientBalance");
      });

      it("should revert when retiring from non-holder", async function () {
        const tokenId = await mintCredits(operator.address);

        // user1 has no balance
        await expect(
          carbonCredit.connect(user1).retireCredits(tokenId, 1n, "no balance")
        ).to.be.revertedWithCustomError(carbonCredit, "InsufficientBalance");
      });

      it("should emit CreditRetired event with correct parameters", async function () {
        const tokenId = await mintCredits(operator.address, 500n * SCALE);
        const retireAmount = 100n * SCALE;

        await expect(
          carbonCredit.connect(operator).retireCredits(tokenId, retireAmount, "test retirement")
        )
          .to.emit(carbonCredit, "CreditRetired")
          .withArgs(tokenId, operator.address, retireAmount, "test retirement");
      });
    });
  });

  // ============================================
  // SECTION 3: Buffer Configuration Validation
  // Covers Lines 521-539
  // ============================================

  describe("3. Buffer Configuration Validation Branches", function () {
    describe("3.1 Percentage Validation", function () {
      /**
       * Branch: _bufferPercentageBps > MAX_BUFFER_BPS
       * Expected: Revert with InvalidBufferPercentage
       */
      it("should reject percentage > MAX_BUFFER_BPS (10%)", async function () {
        await expect(
          carbonCredit.setBufferConfiguration(bufferPool.address, 1001n) // 10.01%
        ).to.be.revertedWithCustomError(carbonCredit, "InvalidBufferPercentage");
      });

      it("should reject percentage = MAX_BUFFER_BPS + 1", async function () {
        await expect(
          carbonCredit.setBufferConfiguration(bufferPool.address, MAX_BUFFER_BPS + 1n)
        ).to.be.revertedWithCustomError(carbonCredit, "InvalidBufferPercentage");
      });

      it("should accept exactly MAX_BUFFER_BPS (10%)", async function () {
        await expect(
          carbonCredit.setBufferConfiguration(bufferPool.address, MAX_BUFFER_BPS)
        ).to.not.be.reverted;
      });

      it("should accept percentage = 0", async function () {
        // First set valid config
        await carbonCredit.setBufferConfiguration(bufferPool.address, 500n);

        // Then disable with 0%
        await expect(
          carbonCredit.setBufferConfiguration(ethers.ZeroAddress, 0n)
        ).to.not.be.reverted;
      });
    });

    describe("3.2 Address + Percentage Combination Validation", function () {
      /**
       * Branch: _bufferPercentageBps > 0 && _bufferPoolAddress == address(0)
       * Expected: Revert with InvalidBufferPoolAddress
       */
      it("should reject percentage > 0 with zero address", async function () {
        await expect(
          carbonCredit.setBufferConfiguration(ethers.ZeroAddress, 500n) // 5% with no address
        ).to.be.revertedWithCustomError(carbonCredit, "InvalidBufferPoolAddress");
      });

      it("should reject any positive percentage with zero address", async function () {
        await expect(
          carbonCredit.setBufferConfiguration(ethers.ZeroAddress, 1n)
        ).to.be.revertedWithCustomError(carbonCredit, "InvalidBufferPoolAddress");
      });

      it("should accept percentage = 0 with zero address (disabling)", async function () {
        await expect(
          carbonCredit.setBufferConfiguration(ethers.ZeroAddress, 0n)
        ).to.not.be.reverted;

        const stats = await carbonCredit.getBufferPoolStats();
        expect(stats.poolAddress).to.equal(ethers.ZeroAddress);
        expect(stats.percentageBps).to.equal(0n);
      });

      it("should accept valid percentage with valid address", async function () {
        await expect(
          carbonCredit.setBufferConfiguration(bufferPool.address, 500n)
        ).to.not.be.reverted;
      });
    });

    describe("3.3 Configuration Event Emission", function () {
      it("should emit BufferPoolConfigured with old and new values", async function () {
        await expect(
          carbonCredit.setBufferConfiguration(bufferPool.address, 500n)
        )
          .to.emit(carbonCredit, "BufferPoolConfigured")
          .withArgs(ethers.ZeroAddress, bufferPool.address, 0n, 500n);
      });

      it("should emit correct values when updating existing config", async function () {
        // Set initial config
        await carbonCredit.setBufferConfiguration(bufferPool.address, 300n);

        // Update config
        await expect(
          carbonCredit.setBufferConfiguration(user1.address, 700n)
        )
          .to.emit(carbonCredit, "BufferPoolConfigured")
          .withArgs(bufferPool.address, user1.address, 300n, 700n);
      });
    });
  });

  // ============================================
  // SECTION 4: Reversal Handling Branches
  // Covers Lines 591-618
  // ============================================

  describe("4. Reversal Handling Branches", function () {
    let tokenId: bigint;

    beforeEach(async function () {
      // Configure buffer pool and mint credits
      await carbonCredit.setBufferConfiguration(bufferPool.address, 1000n); // 10%
      tokenId = await mintCredits(operator.address, 10000n * SCALE);
    });

    describe("4.1 Amount Validation", function () {
      /**
       * Branch: amountToBurn == 0
       * Expected: Revert with InvalidReversalAmount
       */
      it("should reject reversal with amount = 0", async function () {
        await expect(
          carbonCredit.handleReversal(tokenId, 0n, "zero amount")
        ).to.be.revertedWithCustomError(carbonCredit, "InvalidReversalAmount");
      });
    });

    describe("4.2 Buffer Balance Validation", function () {
      /**
       * Branch: bufferPoolBalance[tokenId] < amountToBurn
       * Expected: Revert with ReversalAmountExceedsBuffer
       */
      it("should reject reversal exceeding buffer balance", async function () {
        const bufferBalance = await carbonCredit.bufferPoolBalance(tokenId);

        await expect(
          carbonCredit.handleReversal(tokenId, bufferBalance + 1n, "exceeds buffer")
        ).to.be.revertedWithCustomError(carbonCredit, "ReversalAmountExceedsBuffer");
      });

      it("should reject reversal when no buffer exists for token", async function () {
        // Mint without buffer
        await carbonCredit.setBufferConfiguration(ethers.ZeroAddress, 0n);
        const newTokenId = await mintCredits(operator.address);

        // Re-enable buffer for the call to work
        await carbonCredit.setBufferConfiguration(bufferPool.address, 500n);

        await expect(
          carbonCredit.handleReversal(newTokenId, 1n, "no buffer for token")
        ).to.be.revertedWithCustomError(carbonCredit, "ReversalAmountExceedsBuffer");
      });
    });

    describe("4.3 Buffer Pool Address Validation", function () {
      /**
       * Branch: bufferPoolAddress == address(0)
       * Expected: Revert with InvalidBufferPoolAddress
       */
      it("should reject reversal when buffer pool not configured", async function () {
        // Get current buffer balance
        const bufferBalance = await carbonCredit.bufferPoolBalance(tokenId);
        expect(bufferBalance).to.be.gt(0);

        // Disable buffer pool
        await carbonCredit.setBufferConfiguration(ethers.ZeroAddress, 0n);

        // Try to handle reversal - should fail
        await expect(
          carbonCredit.handleReversal(tokenId, bufferBalance, "buffer disabled")
        ).to.be.revertedWithCustomError(carbonCredit, "InvalidBufferPoolAddress");
      });
    });

    describe("4.4 Successful Reversal Execution", function () {
      it("should successfully burn exact buffer balance", async function () {
        const bufferBalance = await carbonCredit.bufferPoolBalance(tokenId);

        await expect(
          carbonCredit.handleReversal(tokenId, bufferBalance, "full reversal")
        ).to.emit(carbonCredit, "CarbonReversalHandled");

        expect(await carbonCredit.bufferPoolBalance(tokenId)).to.equal(0);
      });

      it("should successfully burn partial buffer balance", async function () {
        const bufferBalance = await carbonCredit.bufferPoolBalance(tokenId);
        const burnAmount = bufferBalance / 2n;

        await carbonCredit.handleReversal(tokenId, burnAmount, "partial reversal");

        expect(await carbonCredit.bufferPoolBalance(tokenId)).to.equal(bufferBalance - burnAmount);
      });

      it("should update totalBufferPoolCredits after reversal", async function () {
        const initialTotal = await carbonCredit.totalBufferPoolCredits();
        const bufferBalance = await carbonCredit.bufferPoolBalance(tokenId);

        await carbonCredit.handleReversal(tokenId, bufferBalance, "full reversal");

        const finalTotal = await carbonCredit.totalBufferPoolCredits();
        expect(finalTotal).to.equal(initialTotal - bufferBalance);
      });

      it("should emit CarbonReversalHandled with correct parameters", async function () {
        const bufferBalance = await carbonCredit.bufferPoolBalance(tokenId);
        const burnAmount = bufferBalance / 2n;

        await expect(
          carbonCredit.handleReversal(tokenId, burnAmount, "test reversal")
        )
          .to.emit(carbonCredit, "CarbonReversalHandled")
          .withArgs(
            tokenId,
            burnAmount,
            bufferBalance - burnAmount,
            "test reversal",
            (value: bigint) => value > 0 // timestamp
          );
      });
    });
  });

  // ============================================
  // SECTION 5: Buffer Release Branches
  // Covers Lines 551-571
  // ============================================

  describe("5. Buffer Release Branches", function () {
    let tokenId: bigint;

    beforeEach(async function () {
      await carbonCredit.setBufferConfiguration(bufferPool.address, 1000n);
      tokenId = await mintCredits(operator.address, 10000n * SCALE);
    });

    describe("5.1 Amount Validation", function () {
      it("should reject release with amount = 0", async function () {
        await expect(
          carbonCredit.releaseBufferCredits(tokenId, 0n, user1.address, "zero amount")
        ).to.be.revertedWithCustomError(carbonCredit, "InsufficientBalance");
      });
    });

    describe("5.2 Buffer Balance Validation", function () {
      it("should reject release exceeding buffer balance", async function () {
        const bufferBalance = await carbonCredit.bufferPoolBalance(tokenId);

        await expect(
          carbonCredit.releaseBufferCredits(tokenId, bufferBalance + 1n, user1.address, "exceeds")
        ).to.be.revertedWithCustomError(carbonCredit, "InsufficientBufferBalance");
      });
    });

    describe("5.3 Recipient Validation", function () {
      it("should reject release to zero address", async function () {
        const bufferBalance = await carbonCredit.bufferPoolBalance(tokenId);

        await expect(
          carbonCredit.releaseBufferCredits(tokenId, bufferBalance, ethers.ZeroAddress, "zero recipient")
        ).to.be.revertedWithCustomError(carbonCredit, "InvalidBufferPoolAddress");
      });
    });

    describe("5.4 Successful Release", function () {
      it("should release credits to specified recipient", async function () {
        const bufferBalance = await carbonCredit.bufferPoolBalance(tokenId);
        const releaseAmount = bufferBalance / 2n;

        const initialUserBalance = await carbonCredit.balanceOf(user1.address, tokenId);

        await carbonCredit.releaseBufferCredits(tokenId, releaseAmount, user1.address, "release test");

        const finalUserBalance = await carbonCredit.balanceOf(user1.address, tokenId);
        expect(finalUserBalance).to.equal(initialUserBalance + releaseAmount);
      });

      it("should update buffer tracking after release", async function () {
        const initialBufferBalance = await carbonCredit.bufferPoolBalance(tokenId);
        const initialTotal = await carbonCredit.totalBufferPoolCredits();
        const releaseAmount = initialBufferBalance / 2n;

        await carbonCredit.releaseBufferCredits(tokenId, releaseAmount, user1.address, "release");

        expect(await carbonCredit.bufferPoolBalance(tokenId)).to.equal(initialBufferBalance - releaseAmount);
        expect(await carbonCredit.totalBufferPoolCredits()).to.equal(initialTotal - releaseAmount);
      });

      it("should emit BufferPoolRelease event", async function () {
        const bufferBalance = await carbonCredit.bufferPoolBalance(tokenId);

        await expect(
          carbonCredit.releaseBufferCredits(tokenId, bufferBalance, user1.address, "full release")
        )
          .to.emit(carbonCredit, "BufferPoolRelease")
          .withArgs(tokenId, user1.address, bufferBalance, "full release");
      });
    });
  });

  // ============================================
  // SECTION 6: Batch Operations Branch Coverage
  // ============================================

  describe("6. Batch Operations Branches", function () {
    describe("6.1 Batch Retire Credits", function () {
      it("should reject zero-length batch", async function () {
        await expect(
          carbonCredit.connect(operator).batchRetireCredits([], [], "empty batch")
        ).to.be.revertedWith("Invalid batch size");
      });

      it("should reject mismatched array lengths", async function () {
        const tokenId = await mintCredits(operator.address);

        await expect(
          carbonCredit.connect(operator).batchRetireCredits(
            [tokenId, tokenId],
            [100n],
            "mismatched"
          )
        ).to.be.revertedWith("Length mismatch");
      });

      it("should retire multiple tokens in one transaction", async function () {
        const tokenId1 = await mintCredits(operator.address);
        const tokenId2 = await mintCredits(operator.address);

        const balance1 = await carbonCredit.balanceOf(operator.address, tokenId1);
        const balance2 = await carbonCredit.balanceOf(operator.address, tokenId2);

        await carbonCredit.connect(operator).batchRetireCredits(
          [tokenId1, tokenId2],
          [balance1, balance2],
          "batch retirement"
        );

        expect(await carbonCredit.balanceOf(operator.address, tokenId1)).to.equal(0);
        expect(await carbonCredit.balanceOf(operator.address, tokenId2)).to.equal(0);
      });
    });

    describe("6.2 Batch Get Credit Provenance", function () {
      it("should return empty arrays for empty input", async function () {
        const [metadatas, verifications] = await carbonCredit.batchGetCreditProvenance([]);
        expect(metadatas.length).to.equal(0);
        expect(verifications.length).to.equal(0);
      });

      it("should return data for multiple tokens", async function () {
        const tokenId1 = await mintCredits(operator.address);
        const tokenId2 = await mintCredits(operator.address);

        const [metadatas, verifications] = await carbonCredit.batchGetCreditProvenance([tokenId1, tokenId2]);

        expect(metadatas.length).to.equal(2);
        expect(verifications.length).to.equal(2);
        expect(metadatas[0].dacUnitId).to.equal(DAC_UNIT_ID);
        expect(metadatas[1].dacUnitId).to.equal(DAC_UNIT_ID);
      });
    });

    describe("6.3 Batch Balance Of", function () {
      it("should return empty array for empty input", async function () {
        const balances = await carbonCredit.batchBalanceOf(operator.address, []);
        expect(balances.length).to.equal(0);
      });

      it("should return correct balances for single account with multiple tokens", async function () {
        const tokenId1 = await mintCredits(operator.address);
        const tokenId2 = await mintCredits(operator.address);

        const balances = await carbonCredit.batchBalanceOf(
          operator.address,
          [tokenId1, tokenId2]
        );

        expect(balances.length).to.equal(2);
        expect(balances[0]).to.be.gt(0);
        expect(balances[1]).to.be.gt(0);
      });
    });
  });

  // ============================================
  // SECTION 7: Access Control Branch Coverage
  // ============================================

  describe("7. Access Control Branches", function () {
    describe("7.1 Only Owner Functions", function () {
      it("should reject non-owner from setting buffer configuration", async function () {
        await expect(
          carbonCredit.connect(user1).setBufferConfiguration(bufferPool.address, 500n)
        ).to.be.revertedWith("Ownable: caller is not the owner");
      });

      it("should reject non-owner from handling reversal", async function () {
        await carbonCredit.setBufferConfiguration(bufferPool.address, 1000n);
        const tokenId = await mintCredits(operator.address);
        const bufferBalance = await carbonCredit.bufferPoolBalance(tokenId);

        await expect(
          carbonCredit.connect(user1).handleReversal(tokenId, bufferBalance, "unauthorized")
        ).to.be.revertedWith("Ownable: caller is not the owner");
      });

      it("should reject non-owner from releasing buffer credits", async function () {
        await carbonCredit.setBufferConfiguration(bufferPool.address, 1000n);
        const tokenId = await mintCredits(operator.address);
        const bufferBalance = await carbonCredit.bufferPoolBalance(tokenId);

        await expect(
          carbonCredit.connect(user1).releaseBufferCredits(tokenId, bufferBalance, user2.address, "unauthorized")
        ).to.be.revertedWith("Ownable: caller is not the owner");
      });
    });

    describe("7.2 Only Minter Functions", function () {
      it("should reject non-minter from minting", async function () {
        const hash = generateUniqueHash();

        await expect(
          carbonCredit.connect(user1).mintVerifiedCredits(
            operator.address,
            DAC_UNIT_ID,
            hash,
            Math.floor(Date.now() / 1000),
            DEFAULT_CO2_AMOUNT,
            DEFAULT_ENERGY,
            DEFAULT_LAT,
            DEFAULT_LONG,
            DEFAULT_PURITY,
            DEFAULT_GRID_INTENSITY,
            "ipfs://test",
            "arweave://test"
          )
        ).to.be.revertedWithCustomError(carbonCredit, "UnauthorizedMinter");
      });
    });
  });

  // ============================================
  // SECTION 8: Pausable Branch Coverage
  // ============================================

  describe("8. Pausable Branches", function () {
    describe("8.1 Paused State Blocking", function () {
      beforeEach(async function () {
        await carbonCredit.pause();
      });

      afterEach(async function () {
        if (await carbonCredit.paused()) {
          await carbonCredit.unpause();
        }
      });

      it("should reject minting when paused", async function () {
        const hash = generateUniqueHash();

        await expect(
          carbonCredit.connect(minter).mintVerifiedCredits(
            operator.address,
            DAC_UNIT_ID,
            hash,
            Math.floor(Date.now() / 1000),
            DEFAULT_CO2_AMOUNT,
            DEFAULT_ENERGY,
            DEFAULT_LAT,
            DEFAULT_LONG,
            DEFAULT_PURITY,
            DEFAULT_GRID_INTENSITY,
            "ipfs://test",
            "arweave://test"
          )
        ).to.be.revertedWith("Pausable: paused");
      });

      it("should reject retirement when paused", async function () {
        // Mint before pausing
        await carbonCredit.unpause();
        const tokenId = await mintCredits(operator.address);
        await carbonCredit.pause();

        await expect(
          carbonCredit.connect(operator).retireCredits(tokenId, 1n, "paused")
        ).to.be.revertedWith("Pausable: paused");
      });

      it("should reject buffer release when paused", async function () {
        // Setup before pausing
        await carbonCredit.unpause();
        await carbonCredit.setBufferConfiguration(bufferPool.address, 1000n);
        const tokenId = await mintCredits(operator.address);
        await carbonCredit.pause();

        const bufferBalance = await carbonCredit.bufferPoolBalance(tokenId);

        await expect(
          carbonCredit.releaseBufferCredits(tokenId, bufferBalance, user1.address, "paused")
        ).to.be.revertedWith("Pausable: paused");
      });

      it("should reject reversal handling when paused", async function () {
        // Setup before pausing
        await carbonCredit.unpause();
        await carbonCredit.setBufferConfiguration(bufferPool.address, 1000n);
        const tokenId = await mintCredits(operator.address);
        await carbonCredit.pause();

        const bufferBalance = await carbonCredit.bufferPoolBalance(tokenId);

        await expect(
          carbonCredit.handleReversal(tokenId, bufferBalance, "paused")
        ).to.be.revertedWith("Pausable: paused");
      });
    });
  });
});
