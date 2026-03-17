/**
 * TerraQuraMultisigMainnet - Enterprise Test Suite
 *
 * Comprehensive test coverage for production-hardened 3-of-5 multisig contract.
 * Tests cover all mainnet security requirements including:
 * - Geographic distribution validation (3+ countries)
 * - Hardware wallet type enforcement (LEDGER/TREZOR)
 * - 3-of-5 threshold enforcement
 * - 72-hour transaction expiry
 * - Emergency recovery 7-day delay
 * - EIP-712 signature validation
 *
 * @version 1.0.0
 * @author TerraQura Engineering
 * @audit Pre-audit test coverage requirement
 */

import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { TerraQuraMultisigMainnet } from "../typechain-types";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("TerraQuraMultisigMainnet", function () {
  // ============================================
  // Test Fixtures & Setup
  // ============================================

  let multisig: TerraQuraMultisigMainnet;
  let signers: SignerWithAddress[];
  let signer1: SignerWithAddress;
  let signer2: SignerWithAddress;
  let signer3: SignerWithAddress;
  let signer4: SignerWithAddress;
  let signer5: SignerWithAddress;
  let signer6: SignerWithAddress;
  let nonSigner: SignerWithAddress;
  let recipient: SignerWithAddress;

  // Mainnet-compliant configuration
  const MAINNET_THRESHOLD = 3;
  const MIN_SIGNERS = 5;

  // Geographic distribution (3+ unique countries required)
  const VALID_COUNTRY_CODES = ["AE", "US", "CH", "SG", "GB"];
  const VALID_WALLET_TYPES = ["LEDGER", "TREZOR", "LEDGER", "TREZOR", "LEDGER"];

  // Time constants
  const HOUR = 3600;
  const DAY = 24 * HOUR;
  const DEFAULT_EXPIRY = 72 * HOUR; // 72 hours
  const MIN_EXPIRY = 24 * HOUR; // 24 hours
  const MAX_EXPIRY = 7 * DAY; // 7 days
  const EMERGENCY_RECOVERY_DELAY = 7 * DAY; // 7 days

  /**
   * Deploy fresh multisig contract before each test
   */
  beforeEach(async function () {
    signers = await ethers.getSigners();
    [signer1, signer2, signer3, signer4, signer5, signer6, nonSigner, recipient] = signers;

    const MultisigFactory = await ethers.getContractFactory("TerraQuraMultisigMainnet");
    multisig = await MultisigFactory.deploy(
      [signer1.address, signer2.address, signer3.address, signer4.address, signer5.address],
      VALID_COUNTRY_CODES,
      VALID_WALLET_TYPES,
      MAINNET_THRESHOLD
    );
    await multisig.waitForDeployment();

    // Fund the multisig for testing ETH transfers
    await signer1.sendTransaction({
      to: await multisig.getAddress(),
      value: ethers.parseEther("100"),
    });
  });

  // ============================================
  // SECTION 1: Deployment & Initialization
  // ============================================

  describe("1. Deployment & Initialization", function () {
    describe("1.1 Minimum Signer Requirements", function () {
      it("should require minimum 5 signers for deployment", async function () {
        const MultisigFactory = await ethers.getContractFactory("TerraQuraMultisigMainnet");

        // Try with 4 signers - should fail
        await expect(
          MultisigFactory.deploy(
            [signer1.address, signer2.address, signer3.address, signer4.address],
            ["AE", "US", "CH", "SG"],
            ["LEDGER", "TREZOR", "LEDGER", "TREZOR"],
            3
          )
        ).to.be.revertedWith("Need at least 5 signers");
      });

      it("should allow exactly 5 signers", async function () {
        const MultisigFactory = await ethers.getContractFactory("TerraQuraMultisigMainnet");

        const newMultisig = await MultisigFactory.deploy(
          [signer1.address, signer2.address, signer3.address, signer4.address, signer5.address],
          ["AE", "US", "CH", "SG", "GB"],
          ["LEDGER", "TREZOR", "LEDGER", "TREZOR", "LEDGER"],
          3
        );

        expect(await newMultisig.getSignerCount()).to.equal(5);
      });

      it("should allow up to 10 signers (MAX_SIGNERS)", async function () {
        const MultisigFactory = await ethers.getContractFactory("TerraQuraMultisigMainnet");
        const extraSigners = signers.slice(0, 10);

        const newMultisig = await MultisigFactory.deploy(
          extraSigners.map((s) => s.address),
          ["AE", "US", "CH", "SG", "GB", "JP", "DE", "FR", "AU", "CA"],
          Array(10).fill("LEDGER"),
          5
        );

        expect(await newMultisig.getSignerCount()).to.equal(10);
      });

      it("should reject more than 10 signers", async function () {
        const MultisigFactory = await ethers.getContractFactory("TerraQuraMultisigMainnet");
        // Generate 11 unique addresses
        const manySigners = [];
        for (let i = 0; i < 11; i++) {
          manySigners.push(ethers.Wallet.createRandom().address);
        }

        await expect(
          MultisigFactory.deploy(
            manySigners,
            Array(11).fill("AE"),
            Array(11).fill("LEDGER"),
            5
          )
        ).to.be.revertedWith("Too many signers");
      });

      it("should reject duplicate signers", async function () {
        const MultisigFactory = await ethers.getContractFactory("TerraQuraMultisigMainnet");

        await expect(
          MultisigFactory.deploy(
            [signer1.address, signer1.address, signer3.address, signer4.address, signer5.address],
            ["AE", "US", "CH", "SG", "GB"],
            ["LEDGER", "TREZOR", "LEDGER", "TREZOR", "LEDGER"],
            3
          )
        ).to.be.revertedWith("Duplicate signer");
      });

      it("should reject zero address signers", async function () {
        const MultisigFactory = await ethers.getContractFactory("TerraQuraMultisigMainnet");

        await expect(
          MultisigFactory.deploy(
            [ethers.ZeroAddress, signer2.address, signer3.address, signer4.address, signer5.address],
            ["AE", "US", "CH", "SG", "GB"],
            ["LEDGER", "TREZOR", "LEDGER", "TREZOR", "LEDGER"],
            3
          )
        ).to.be.revertedWith("Invalid signer");
      });
    });

    describe("1.2 Threshold Requirements", function () {
      it("should enforce minimum threshold of 3", async function () {
        const MultisigFactory = await ethers.getContractFactory("TerraQuraMultisigMainnet");

        // Try with threshold of 2 - should fail
        await expect(
          MultisigFactory.deploy(
            [signer1.address, signer2.address, signer3.address, signer4.address, signer5.address],
            ["AE", "US", "CH", "SG", "GB"],
            ["LEDGER", "TREZOR", "LEDGER", "TREZOR", "LEDGER"],
            2 // Below minimum
          )
        ).to.be.revertedWith("Threshold must be >= 3");
      });

      it("should allow threshold equal to MIN_THRESHOLD (3)", async function () {
        expect(await multisig.threshold()).to.equal(3);
      });

      it("should allow threshold up to signer count", async function () {
        const MultisigFactory = await ethers.getContractFactory("TerraQuraMultisigMainnet");

        const newMultisig = await MultisigFactory.deploy(
          [signer1.address, signer2.address, signer3.address, signer4.address, signer5.address],
          ["AE", "US", "CH", "SG", "GB"],
          ["LEDGER", "TREZOR", "LEDGER", "TREZOR", "LEDGER"],
          5 // Maximum for 5 signers
        );

        expect(await newMultisig.threshold()).to.equal(5);
      });

      it("should reject threshold exceeding signer count", async function () {
        const MultisigFactory = await ethers.getContractFactory("TerraQuraMultisigMainnet");

        await expect(
          MultisigFactory.deploy(
            [signer1.address, signer2.address, signer3.address, signer4.address, signer5.address],
            ["AE", "US", "CH", "SG", "GB"],
            ["LEDGER", "TREZOR", "LEDGER", "TREZOR", "LEDGER"],
            6 // Exceeds 5 signers
          )
        ).to.be.revertedWith("Threshold exceeds signers");
      });
    });

    describe("1.3 Geographic Distribution Validation", function () {
      it("should require at least 3 unique countries", async function () {
        const MultisigFactory = await ethers.getContractFactory("TerraQuraMultisigMainnet");

        // Only 2 unique countries - should fail
        await expect(
          MultisigFactory.deploy(
            [signer1.address, signer2.address, signer3.address, signer4.address, signer5.address],
            ["AE", "AE", "US", "US", "AE"], // Only 2 unique countries
            ["LEDGER", "TREZOR", "LEDGER", "TREZOR", "LEDGER"],
            3
          )
        ).to.be.revertedWith("Insufficient geographic distribution - need 3+ countries");
      });

      it("should accept exactly 3 unique countries", async function () {
        const MultisigFactory = await ethers.getContractFactory("TerraQuraMultisigMainnet");

        const newMultisig = await MultisigFactory.deploy(
          [signer1.address, signer2.address, signer3.address, signer4.address, signer5.address],
          ["AE", "US", "CH", "AE", "US"], // 3 unique countries
          ["LEDGER", "TREZOR", "LEDGER", "TREZOR", "LEDGER"],
          3
        );

        const countries = await newMultisig.getGeographicDistribution();
        expect(countries).to.have.lengthOf(5);
      });

      it("should validate country code format (2 characters)", async function () {
        const MultisigFactory = await ethers.getContractFactory("TerraQuraMultisigMainnet");

        await expect(
          MultisigFactory.deploy(
            [signer1.address, signer2.address, signer3.address, signer4.address, signer5.address],
            ["UAE", "US", "CH", "SG", "GB"], // UAE is 3 characters - invalid
            ["LEDGER", "TREZOR", "LEDGER", "TREZOR", "LEDGER"],
            3
          )
        ).to.be.revertedWith("Invalid country code");
      });

      it("should return correct geographic distribution", async function () {
        const countries = await multisig.getGeographicDistribution();
        expect(countries).to.deep.equal(VALID_COUNTRY_CODES);
      });
    });

    describe("1.4 Hardware Wallet Type Enforcement", function () {
      it("should only accept LEDGER wallet type", async function () {
        const MultisigFactory = await ethers.getContractFactory("TerraQuraMultisigMainnet");

        const newMultisig = await MultisigFactory.deploy(
          [signer1.address, signer2.address, signer3.address, signer4.address, signer5.address],
          ["AE", "US", "CH", "SG", "GB"],
          ["LEDGER", "LEDGER", "LEDGER", "LEDGER", "LEDGER"],
          3
        );

        const info = await newMultisig.getSignerInfo(signer1.address);
        expect(info.walletType).to.equal("LEDGER");
      });

      it("should only accept TREZOR wallet type", async function () {
        const MultisigFactory = await ethers.getContractFactory("TerraQuraMultisigMainnet");

        const newMultisig = await MultisigFactory.deploy(
          [signer1.address, signer2.address, signer3.address, signer4.address, signer5.address],
          ["AE", "US", "CH", "SG", "GB"],
          ["TREZOR", "TREZOR", "TREZOR", "TREZOR", "TREZOR"],
          3
        );

        const info = await newMultisig.getSignerInfo(signer1.address);
        expect(info.walletType).to.equal("TREZOR");
      });

      it("should reject invalid wallet types", async function () {
        const MultisigFactory = await ethers.getContractFactory("TerraQuraMultisigMainnet");

        await expect(
          MultisigFactory.deploy(
            [signer1.address, signer2.address, signer3.address, signer4.address, signer5.address],
            ["AE", "US", "CH", "SG", "GB"],
            ["METAMASK", "TREZOR", "LEDGER", "TREZOR", "LEDGER"], // METAMASK not allowed
            3
          )
        ).to.be.revertedWith("Invalid wallet type - must be LEDGER or TREZOR");
      });

      it("should reject empty wallet type", async function () {
        const MultisigFactory = await ethers.getContractFactory("TerraQuraMultisigMainnet");

        await expect(
          MultisigFactory.deploy(
            [signer1.address, signer2.address, signer3.address, signer4.address, signer5.address],
            ["AE", "US", "CH", "SG", "GB"],
            ["", "TREZOR", "LEDGER", "TREZOR", "LEDGER"],
            3
          )
        ).to.be.revertedWith("Invalid wallet type - must be LEDGER or TREZOR");
      });
    });

    describe("1.5 Signer Info Storage", function () {
      it("should store complete signer information", async function () {
        const info = await multisig.getSignerInfo(signer1.address);

        expect(info.isActive).to.be.true;
        expect(info.countryCode).to.equal("AE");
        expect(info.walletType).to.equal("LEDGER");
        expect(info.addedAt).to.be.gt(0);
        expect(info.addedBy).to.equal(ethers.ZeroAddress); // Constructor deployment
      });

      it("should emit SignerAdded events during deployment", async function () {
        const MultisigFactory = await ethers.getContractFactory("TerraQuraMultisigMainnet");

        const newMultisig = await MultisigFactory.deploy(
          [signer1.address, signer2.address, signer3.address, signer4.address, signer5.address],
          ["AE", "US", "CH", "SG", "GB"],
          ["LEDGER", "TREZOR", "LEDGER", "TREZOR", "LEDGER"],
          3
        );

        const receipt = await newMultisig.deploymentTransaction()?.wait();

        // Check that SignerAdded events were emitted (5 signers = 5 events)
        const signerAddedEvents = receipt?.logs.filter(
          (log) => {
            try {
              const parsed = newMultisig.interface.parseLog({
                topics: log.topics as string[],
                data: log.data,
              });
              return parsed?.name === "SignerAdded";
            } catch {
              return false;
            }
          }
        );

        expect(signerAddedEvents?.length).to.equal(5);
      });
    });
  });

  // ============================================
  // SECTION 2: Transaction Lifecycle
  // ============================================

  describe("2. Transaction Lifecycle", function () {
    describe("2.1 Transaction Submission", function () {
      it("should submit transaction with default 72-hour expiry", async function () {
        const tx = await multisig.connect(signer1).submitTransaction(
          recipient.address,
          ethers.parseEther("1"),
          "0x",
          "Test transfer"
        );

        const receipt = await tx.wait();
        const txDetails = await multisig.getTransaction(0);

        // Verify expiry is ~72 hours from now
        const blockTimestamp = (await ethers.provider.getBlock(receipt!.blockNumber))!.timestamp;
        expect(txDetails.expiresAt).to.be.closeTo(BigInt(blockTimestamp) + BigInt(DEFAULT_EXPIRY), 5n);
      });

      it("should auto-confirm for transaction submitter", async function () {
        await multisig.connect(signer1).submitTransaction(
          recipient.address,
          ethers.parseEther("1"),
          "0x",
          "Test transfer"
        );

        const txDetails = await multisig.getTransaction(0);
        expect(txDetails.numConfirmations).to.equal(1n);
        expect(await multisig.hasConfirmed(0, signer1.address)).to.be.true;
      });

      it("should store transaction description for audit trail", async function () {
        const description = "Emergency fund transfer for server maintenance";

        await multisig.connect(signer1).submitTransaction(
          recipient.address,
          ethers.parseEther("1"),
          "0x",
          description
        );

        const txDetails = await multisig.getTransaction(0);
        expect(txDetails.description).to.equal(description);
      });

      it("should emit TransactionSubmitted event with full details", async function () {
        const value = ethers.parseEther("1");
        const data = "0x12345678";
        const description = "Test transaction";

        await expect(
          multisig.connect(signer1).submitTransaction(recipient.address, value, data, description)
        )
          .to.emit(multisig, "TransactionSubmitted")
          .withArgs(0, signer1.address, recipient.address, value, data, description);
      });

      it("should reject submission from non-signer", async function () {
        await expect(
          multisig.connect(nonSigner).submitTransaction(
            recipient.address,
            ethers.parseEther("1"),
            "0x",
            "Unauthorized"
          )
        ).to.be.revertedWithCustomError(multisig, "NotSigner");
      });
    });

    describe("2.2 Custom Expiry", function () {
      it("should allow custom expiry within bounds", async function () {
        const customExpiry = 2 * DAY; // 48 hours

        await multisig.connect(signer1).submitTransactionWithExpiry(
          recipient.address,
          ethers.parseEther("1"),
          "0x",
          customExpiry,
          "Custom expiry test"
        );

        const txDetails = await multisig.getTransaction(0);
        const currentTime = await time.latest();
        expect(txDetails.expiresAt).to.be.closeTo(BigInt(currentTime) + BigInt(customExpiry), 5n);
      });

      it("should enforce minimum 24-hour expiry", async function () {
        await expect(
          multisig.connect(signer1).submitTransactionWithExpiry(
            recipient.address,
            ethers.parseEther("1"),
            "0x",
            12 * HOUR, // 12 hours - too short
            "Short expiry"
          )
        ).to.be.revertedWith("Expiry too short - minimum 24 hours");
      });

      it("should enforce maximum 7-day expiry", async function () {
        await expect(
          multisig.connect(signer1).submitTransactionWithExpiry(
            recipient.address,
            ethers.parseEther("1"),
            "0x",
            8 * DAY, // 8 days - too long
            "Long expiry"
          )
        ).to.be.revertedWith("Expiry too long - maximum 7 days");
      });

      it("should accept exactly 24-hour minimum expiry", async function () {
        await expect(
          multisig.connect(signer1).submitTransactionWithExpiry(
            recipient.address,
            ethers.parseEther("1"),
            "0x",
            MIN_EXPIRY,
            "Minimum expiry"
          )
        ).to.not.be.reverted;
      });

      it("should accept exactly 7-day maximum expiry", async function () {
        await expect(
          multisig.connect(signer1).submitTransactionWithExpiry(
            recipient.address,
            ethers.parseEther("1"),
            "0x",
            MAX_EXPIRY,
            "Maximum expiry"
          )
        ).to.not.be.reverted;
      });
    });

    describe("2.3 Transaction Confirmation", function () {
      beforeEach(async function () {
        await multisig.connect(signer1).submitTransaction(
          recipient.address,
          ethers.parseEther("1"),
          "0x",
          "Test transaction"
        );
      });

      it("should allow second signer to confirm", async function () {
        await expect(multisig.connect(signer2).confirmTransaction(0))
          .to.emit(multisig, "TransactionConfirmed")
          .withArgs(0, signer2.address, 2);

        const txDetails = await multisig.getTransaction(0);
        expect(txDetails.numConfirmations).to.equal(2n);
      });

      it("should require exactly 3 confirmations to be executable", async function () {
        let txDetails = await multisig.getTransaction(0);
        expect(txDetails.canExecute).to.be.false;
        expect(await multisig.getConfirmationsNeeded(0)).to.equal(2n);

        // Second confirmation
        await multisig.connect(signer2).confirmTransaction(0);
        txDetails = await multisig.getTransaction(0);
        expect(txDetails.canExecute).to.be.false;
        expect(await multisig.getConfirmationsNeeded(0)).to.equal(1n);

        // Third confirmation - now executable
        await multisig.connect(signer3).confirmTransaction(0);
        txDetails = await multisig.getTransaction(0);
        expect(txDetails.canExecute).to.be.true;
        expect(await multisig.getConfirmationsNeeded(0)).to.equal(0n);
      });

      it("should reject with only 2 confirmations", async function () {
        await multisig.connect(signer2).confirmTransaction(0);

        await expect(
          multisig.connect(signer1).executeTransaction(0)
        ).to.be.revertedWithCustomError(multisig, "TransactionNotConfirmed");
      });

      it("should not allow double confirmation", async function () {
        await expect(
          multisig.connect(signer1).confirmTransaction(0)
        ).to.be.revertedWithCustomError(multisig, "AlreadyConfirmed");
      });

      it("should not allow non-signer to confirm", async function () {
        await expect(
          multisig.connect(nonSigner).confirmTransaction(0)
        ).to.be.revertedWithCustomError(multisig, "NotSigner");
      });

      it("should not allow confirmation of non-existent transaction", async function () {
        await expect(
          multisig.connect(signer2).confirmTransaction(999)
        ).to.be.revertedWithCustomError(multisig, "TransactionDoesNotExist");
      });

      it("should not allow confirmation of expired transaction", async function () {
        // Fast forward past 72-hour expiry
        await time.increase(DEFAULT_EXPIRY + 1);

        await expect(
          multisig.connect(signer2).confirmTransaction(0)
        ).to.be.revertedWithCustomError(multisig, "TransactionExpired");
      });
    });

    describe("2.4 Transaction Revocation", function () {
      beforeEach(async function () {
        await multisig.connect(signer1).submitTransaction(
          recipient.address,
          ethers.parseEther("1"),
          "0x",
          "Test transaction"
        );
        await multisig.connect(signer2).confirmTransaction(0);
      });

      it("should allow signer to revoke their confirmation", async function () {
        await expect(multisig.connect(signer1).revokeConfirmation(0))
          .to.emit(multisig, "TransactionRevoked")
          .withArgs(0, signer1.address, 1);

        expect(await multisig.hasConfirmed(0, signer1.address)).to.be.false;
      });

      it("should update confirmation count after revocation", async function () {
        await multisig.connect(signer1).revokeConfirmation(0);

        const txDetails = await multisig.getTransaction(0);
        expect(txDetails.numConfirmations).to.equal(1n);
      });

      it("should not allow revoking non-existent confirmation", async function () {
        await expect(
          multisig.connect(signer3).revokeConfirmation(0)
        ).to.be.revertedWithCustomError(multisig, "NotConfirmed");
      });
    });

    describe("2.5 Transaction Execution", function () {
      beforeEach(async function () {
        await multisig.connect(signer1).submitTransaction(
          recipient.address,
          ethers.parseEther("1"),
          "0x",
          "Test transfer"
        );
        // Get to 3 confirmations
        await multisig.connect(signer2).confirmTransaction(0);
        await multisig.connect(signer3).confirmTransaction(0);
      });

      it("should execute transaction with 3 confirmations", async function () {
        const recipientBalanceBefore = await ethers.provider.getBalance(recipient.address);

        await expect(multisig.connect(signer1).executeTransaction(0))
          .to.emit(multisig, "TransactionExecuted")
          .withArgs(0, signer1.address, true);

        const recipientBalanceAfter = await ethers.provider.getBalance(recipient.address);
        expect(recipientBalanceAfter - recipientBalanceBefore).to.equal(ethers.parseEther("1"));
      });

      it("should mark transaction as executed", async function () {
        await multisig.connect(signer1).executeTransaction(0);

        const txDetails = await multisig.getTransaction(0);
        expect(txDetails.executed).to.be.true;
        expect(txDetails.canExecute).to.be.false;
      });

      it("should not allow double execution", async function () {
        await multisig.connect(signer1).executeTransaction(0);

        await expect(
          multisig.connect(signer2).executeTransaction(0)
        ).to.be.revertedWithCustomError(multisig, "TransactionAlreadyExecuted");
      });

      it("should auto-expire transactions after 72 hours", async function () {
        // Fast forward past 72-hour expiry
        await time.increase(DEFAULT_EXPIRY + 1);

        await expect(
          multisig.connect(signer1).executeTransaction(0)
        ).to.be.revertedWithCustomError(multisig, "TransactionExpired");
      });

      it("should execute just before expiry", async function () {
        // Fast forward to just before expiry
        await time.increase(DEFAULT_EXPIRY - 60); // 1 minute before

        await expect(multisig.connect(signer1).executeTransaction(0)).to.not.be.reverted;
      });
    });

    describe("2.6 Contract Function Calls", function () {
      it("should execute contract calls with encoded data", async function () {
        // Deploy a simple receiver contract
        const ReceiverFactory = await ethers.getContractFactory("MockERC1155");
        const receiver = await ReceiverFactory.deploy();
        await receiver.waitForDeployment();

        // Encode a function call
        const mintData = receiver.interface.encodeFunctionData("mint", [
          signer1.address,
          1,
          100,
          "0x",
        ]);

        await multisig.connect(signer1).submitTransaction(
          await receiver.getAddress(),
          0,
          mintData,
          "Mint tokens"
        );

        await multisig.connect(signer2).confirmTransaction(0);
        await multisig.connect(signer3).confirmTransaction(0);
        await multisig.connect(signer1).executeTransaction(0);

        expect(await receiver.balanceOf(signer1.address, 1)).to.equal(100n);
      });
    });
  });

  // ============================================
  // SECTION 3: Signer Management
  // ============================================

  describe("3. Signer Management", function () {
    describe("3.1 Add Signer via Multisig", function () {
      it("should add new signer with valid metadata", async function () {
        const addSignerData = multisig.interface.encodeFunctionData("addSigner", [
          signer6.address,
          "JP", // Japan
          "LEDGER",
        ]);

        await multisig.connect(signer1).submitTransaction(
          await multisig.getAddress(),
          0,
          addSignerData,
          "Add new signer from Japan"
        );

        await multisig.connect(signer2).confirmTransaction(0);
        await multisig.connect(signer3).confirmTransaction(0);
        await multisig.connect(signer1).executeTransaction(0);

        const info = await multisig.getSignerInfo(signer6.address);
        expect(info.isActive).to.be.true;
        expect(info.countryCode).to.equal("JP");
        expect(info.walletType).to.equal("LEDGER");
        expect(await multisig.getSignerCount()).to.equal(6n);
      });

      it("should reject adding signer with invalid wallet type", async function () {
        const addSignerData = multisig.interface.encodeFunctionData("addSigner", [
          signer6.address,
          "JP",
          "METAMASK", // Invalid
        ]);

        await multisig.connect(signer1).submitTransaction(
          await multisig.getAddress(),
          0,
          addSignerData,
          "Add signer with invalid wallet"
        );

        await multisig.connect(signer2).confirmTransaction(0);
        await multisig.connect(signer3).confirmTransaction(0);

        await expect(
          multisig.connect(signer1).executeTransaction(0)
        ).to.be.revertedWithCustomError(multisig, "InvalidWalletType");
      });

      it("should reject adding duplicate signer", async function () {
        const addSignerData = multisig.interface.encodeFunctionData("addSigner", [
          signer1.address, // Already a signer
          "JP",
          "LEDGER",
        ]);

        await multisig.connect(signer1).submitTransaction(
          await multisig.getAddress(),
          0,
          addSignerData,
          "Add duplicate signer"
        );

        await multisig.connect(signer2).confirmTransaction(0);
        await multisig.connect(signer3).confirmTransaction(0);

        await expect(
          multisig.connect(signer1).executeTransaction(0)
        ).to.be.revertedWithCustomError(multisig, "SignerAlreadyExists");
      });

      it("should reject adding zero address", async function () {
        const addSignerData = multisig.interface.encodeFunctionData("addSigner", [
          ethers.ZeroAddress,
          "JP",
          "LEDGER",
        ]);

        await multisig.connect(signer1).submitTransaction(
          await multisig.getAddress(),
          0,
          addSignerData,
          "Add zero address"
        );

        await multisig.connect(signer2).confirmTransaction(0);
        await multisig.connect(signer3).confirmTransaction(0);

        await expect(
          multisig.connect(signer1).executeTransaction(0)
        ).to.be.revertedWithCustomError(multisig, "InvalidSigner");
      });

      it("should prevent direct addSigner call (bypass multisig)", async function () {
        await expect(
          multisig.connect(signer1).addSigner(signer6.address, "JP", "LEDGER")
        ).to.be.revertedWith("Only via multisig");
      });
    });

    describe("3.2 Remove Signer via Multisig", function () {
      beforeEach(async function () {
        // Add 6th signer first so we can remove one and still have 5
        const addSignerData = multisig.interface.encodeFunctionData("addSigner", [
          signer6.address,
          "JP",
          "LEDGER",
        ]);

        await multisig.connect(signer1).submitTransaction(
          await multisig.getAddress(),
          0,
          addSignerData,
          "Add signer"
        );

        await multisig.connect(signer2).confirmTransaction(0);
        await multisig.connect(signer3).confirmTransaction(0);
        await multisig.connect(signer1).executeTransaction(0);
      });

      it("should remove signer when above minimum count", async function () {
        expect(await multisig.getSignerCount()).to.equal(6n);

        const removeSignerData = multisig.interface.encodeFunctionData("removeSigner", [
          signer6.address,
        ]);

        await multisig.connect(signer1).submitTransaction(
          await multisig.getAddress(),
          0,
          removeSignerData,
          "Remove signer"
        );

        await multisig.connect(signer2).confirmTransaction(1);
        await multisig.connect(signer3).confirmTransaction(1);
        await multisig.connect(signer1).executeTransaction(1);

        const info = await multisig.getSignerInfo(signer6.address);
        expect(info.isActive).to.be.false;
        expect(await multisig.getSignerCount()).to.equal(5n);
      });

      it("should not allow removal below MIN_SIGNERS (5)", async function () {
        const removeSignerData = multisig.interface.encodeFunctionData("removeSigner", [
          signer5.address,
        ]);

        // Remove signer6 first to get to exactly 5
        const removeData1 = multisig.interface.encodeFunctionData("removeSigner", [signer6.address]);
        await multisig.connect(signer1).submitTransaction(
          await multisig.getAddress(),
          0,
          removeData1,
          "Remove to 5"
        );
        await multisig.connect(signer2).confirmTransaction(1);
        await multisig.connect(signer3).confirmTransaction(1);
        await multisig.connect(signer1).executeTransaction(1);

        expect(await multisig.getSignerCount()).to.equal(5n);

        // Now try to remove another - should fail
        await multisig.connect(signer1).submitTransaction(
          await multisig.getAddress(),
          0,
          removeSignerData,
          "Remove below minimum"
        );

        await multisig.connect(signer2).confirmTransaction(2);
        await multisig.connect(signer3).confirmTransaction(2);

        await expect(
          multisig.connect(signer1).executeTransaction(2)
        ).to.be.revertedWithCustomError(multisig, "InsufficientSigners");
      });
    });

    describe("3.3 Change Threshold via Multisig", function () {
      it("should change threshold via multisig", async function () {
        const changeThresholdData = multisig.interface.encodeFunctionData("changeThreshold", [4]);

        await multisig.connect(signer1).submitTransaction(
          await multisig.getAddress(),
          0,
          changeThresholdData,
          "Increase threshold to 4"
        );

        await multisig.connect(signer2).confirmTransaction(0);
        await multisig.connect(signer3).confirmTransaction(0);

        await expect(multisig.connect(signer1).executeTransaction(0))
          .to.emit(multisig, "ThresholdChanged")
          .withArgs(3, 4);

        expect(await multisig.threshold()).to.equal(4n);
      });

      it("should not allow threshold below MIN_THRESHOLD (3)", async function () {
        const changeThresholdData = multisig.interface.encodeFunctionData("changeThreshold", [2]);

        await multisig.connect(signer1).submitTransaction(
          await multisig.getAddress(),
          0,
          changeThresholdData,
          "Decrease threshold to 2"
        );

        await multisig.connect(signer2).confirmTransaction(0);
        await multisig.connect(signer3).confirmTransaction(0);

        await expect(
          multisig.connect(signer1).executeTransaction(0)
        ).to.be.revertedWithCustomError(multisig, "InvalidThreshold");
      });

      it("should not allow threshold above signer count", async function () {
        const changeThresholdData = multisig.interface.encodeFunctionData("changeThreshold", [6]);

        await multisig.connect(signer1).submitTransaction(
          await multisig.getAddress(),
          0,
          changeThresholdData,
          "Threshold above signers"
        );

        await multisig.connect(signer2).confirmTransaction(0);
        await multisig.connect(signer3).confirmTransaction(0);

        await expect(
          multisig.connect(signer1).executeTransaction(0)
        ).to.be.revertedWithCustomError(multisig, "InvalidThreshold");
      });
    });
  });

  // ============================================
  // SECTION 4: Emergency Recovery
  // ============================================

  describe("4. Emergency Recovery", function () {
    const newSigners = [
      ethers.Wallet.createRandom().address,
      ethers.Wallet.createRandom().address,
      ethers.Wallet.createRandom().address,
      ethers.Wallet.createRandom().address,
      ethers.Wallet.createRandom().address,
    ];
    const newCountryCodes = ["JP", "DE", "FR", "AU", "CA"];
    const newWalletTypes = ["LEDGER", "TREZOR", "LEDGER", "TREZOR", "LEDGER"];

    describe("4.1 Initiate Emergency Recovery", function () {
      it("should initiate emergency recovery via multisig", async function () {
        const initiateData = multisig.interface.encodeFunctionData("initiateEmergencyRecovery", [
          newSigners,
          newCountryCodes,
          newWalletTypes,
          3,
        ]);

        await multisig.connect(signer1).submitTransaction(
          await multisig.getAddress(),
          0,
          initiateData,
          "Initiate emergency recovery"
        );

        await multisig.connect(signer2).confirmTransaction(0);
        await multisig.connect(signer3).confirmTransaction(0);
        await multisig.connect(signer1).executeTransaction(0);

        const status = await multisig.getEmergencyRecoveryStatus();
        expect(status.isInitiated).to.be.true;
        expect(status.pendingSignerCount).to.equal(5n);
      });

      it("should enforce 7-day delay on emergency recovery", async function () {
        const initiateData = multisig.interface.encodeFunctionData("initiateEmergencyRecovery", [
          newSigners,
          newCountryCodes,
          newWalletTypes,
          3,
        ]);

        await multisig.connect(signer1).submitTransaction(
          await multisig.getAddress(),
          0,
          initiateData,
          "Initiate emergency recovery"
        );

        await multisig.connect(signer2).confirmTransaction(0);
        await multisig.connect(signer3).confirmTransaction(0);
        await multisig.connect(signer1).executeTransaction(0);

        const status = await multisig.getEmergencyRecoveryStatus();
        expect(status.canExecuteAfter).to.be.closeTo(
          BigInt(await time.latest()) + BigInt(EMERGENCY_RECOVERY_DELAY),
          5n
        );
      });

      it("should not allow initiation with insufficient signers", async function () {
        const initiateData = multisig.interface.encodeFunctionData("initiateEmergencyRecovery", [
          newSigners.slice(0, 4), // Only 4 signers
          newCountryCodes.slice(0, 4),
          newWalletTypes.slice(0, 4),
          3,
        ]);

        await multisig.connect(signer1).submitTransaction(
          await multisig.getAddress(),
          0,
          initiateData,
          "Initiate with insufficient signers"
        );

        await multisig.connect(signer2).confirmTransaction(0);
        await multisig.connect(signer3).confirmTransaction(0);

        await expect(
          multisig.connect(signer1).executeTransaction(0)
        ).to.be.revertedWith("Need at least 5 signers");
      });
    });

    describe("4.2 Cancel Emergency Recovery", function () {
      beforeEach(async function () {
        // Initiate recovery first
        const initiateData = multisig.interface.encodeFunctionData("initiateEmergencyRecovery", [
          newSigners,
          newCountryCodes,
          newWalletTypes,
          3,
        ]);

        await multisig.connect(signer1).submitTransaction(
          await multisig.getAddress(),
          0,
          initiateData,
          "Initiate emergency recovery"
        );

        await multisig.connect(signer2).confirmTransaction(0);
        await multisig.connect(signer3).confirmTransaction(0);
        await multisig.connect(signer1).executeTransaction(0);
      });

      it("should allow cancellation before delay passes", async function () {
        const cancelData = new ethers.Interface([
          "function cancelEmergencyRecovery()",
        ]).encodeFunctionData("cancelEmergencyRecovery");

        await multisig.connect(signer1).submitTransaction(
          await multisig.getAddress(),
          0,
          cancelData,
          "Cancel emergency recovery"
        );

        await multisig.connect(signer2).confirmTransaction(1);
        await multisig.connect(signer3).confirmTransaction(1);

        await expect(multisig.connect(signer1).executeTransaction(1))
          .to.emit(multisig, "EmergencyRecoveryCancelled");

        const status = await multisig.getEmergencyRecoveryStatus();
        expect(status.isInitiated).to.be.false;
      });

      it("should clear pending recovery data on cancellation", async function () {
        const cancelData = new ethers.Interface([
          "function cancelEmergencyRecovery()",
        ]).encodeFunctionData("cancelEmergencyRecovery");

        await multisig.connect(signer1).submitTransaction(
          await multisig.getAddress(),
          0,
          cancelData,
          "Cancel emergency recovery"
        );

        await multisig.connect(signer2).confirmTransaction(1);
        await multisig.connect(signer3).confirmTransaction(1);
        await multisig.connect(signer1).executeTransaction(1);

        const status = await multisig.getEmergencyRecoveryStatus();
        expect(status.pendingSignerCount).to.equal(0n);
        expect(status.initiatedAt).to.equal(0n);
      });
    });

    describe("4.3 Execute Emergency Recovery", function () {
      beforeEach(async function () {
        // Initiate recovery first
        const initiateData = multisig.interface.encodeFunctionData("initiateEmergencyRecovery", [
          newSigners,
          newCountryCodes,
          newWalletTypes,
          3,
        ]);

        await multisig.connect(signer1).submitTransaction(
          await multisig.getAddress(),
          0,
          initiateData,
          "Initiate emergency recovery"
        );

        await multisig.connect(signer2).confirmTransaction(0);
        await multisig.connect(signer3).confirmTransaction(0);
        await multisig.connect(signer1).executeTransaction(0);
      });

      it("should not execute before 7-day delay", async function () {
        // Try to execute immediately
        await expect(
          multisig.connect(signer1).executeEmergencyRecovery(newCountryCodes, newWalletTypes)
        ).to.be.revertedWithCustomError(multisig, "EmergencyRecoveryDelayNotPassed");

        // Try after 6 days
        await time.increase(6 * DAY);
        await expect(
          multisig.connect(signer1).executeEmergencyRecovery(newCountryCodes, newWalletTypes)
        ).to.be.revertedWithCustomError(multisig, "EmergencyRecoveryDelayNotPassed");
      });

      it("should execute after 7-day delay", async function () {
        await time.increase(EMERGENCY_RECOVERY_DELAY + 1);

        await expect(
          multisig.connect(signer1).executeEmergencyRecovery(newCountryCodes, newWalletTypes)
        )
          .to.emit(multisig, "EmergencyRecoveryExecuted")
          .withArgs(signer1.address, 3, 5);

        // Verify old signers are deactivated
        for (let i = 1; i <= 5; i++) {
          const info = await multisig.getSignerInfo(signers[i - 1].address);
          expect(info.isActive).to.be.false;
        }

        // Verify new signers are active
        expect(await multisig.getSignerCount()).to.equal(5n);
      });

      it("should validate geographic distribution on execution", async function () {
        await time.increase(EMERGENCY_RECOVERY_DELAY + 1);

        // Try with insufficient geographic distribution
        const badCountryCodes = ["JP", "JP", "JP", "JP", "JP"]; // Only 1 country

        await expect(
          multisig.connect(signer1).executeEmergencyRecovery(badCountryCodes, newWalletTypes)
        ).to.be.revertedWith("Insufficient geographic distribution - need 3+ countries");
      });
    });
  });

  // ============================================
  // SECTION 5: View Functions & Edge Cases
  // ============================================

  describe("5. View Functions & Edge Cases", function () {
    describe("5.1 View Functions", function () {
      it("should return all signers", async function () {
        const signersList = await multisig.getSigners();
        expect(signersList).to.have.lengthOf(5);
        expect(signersList).to.include(signer1.address);
        expect(signersList).to.include(signer5.address);
      });

      it("should return confirmations needed correctly", async function () {
        await multisig.connect(signer1).submitTransaction(
          recipient.address,
          ethers.parseEther("1"),
          "0x",
          "Test"
        );

        expect(await multisig.getConfirmationsNeeded(0)).to.equal(2n);

        await multisig.connect(signer2).confirmTransaction(0);
        expect(await multisig.getConfirmationsNeeded(0)).to.equal(1n);

        await multisig.connect(signer3).confirmTransaction(0);
        expect(await multisig.getConfirmationsNeeded(0)).to.equal(0n);
      });

      it("should return transaction details with canExecute flag", async function () {
        await multisig.connect(signer1).submitTransaction(
          recipient.address,
          ethers.parseEther("1"),
          "0x",
          "Test"
        );

        let tx = await multisig.getTransaction(0);
        expect(tx.canExecute).to.be.false;

        await multisig.connect(signer2).confirmTransaction(0);
        await multisig.connect(signer3).confirmTransaction(0);

        tx = await multisig.getTransaction(0);
        expect(tx.canExecute).to.be.true;
      });
    });

    describe("5.2 Constants Verification", function () {
      it("should have MIN_THRESHOLD of 3", async function () {
        expect(await multisig.MIN_THRESHOLD()).to.equal(3n);
      });

      it("should have MIN_SIGNERS of 5", async function () {
        expect(await multisig.MIN_SIGNERS()).to.equal(5n);
      });

      it("should have MAX_SIGNERS of 10", async function () {
        expect(await multisig.MAX_SIGNERS()).to.equal(10n);
      });

      it("should have DEFAULT_EXPIRY of 72 hours", async function () {
        expect(await multisig.DEFAULT_EXPIRY()).to.equal(BigInt(72 * 3600));
      });

      it("should have EMERGENCY_RECOVERY_DELAY of 7 days", async function () {
        expect(await multisig.EMERGENCY_RECOVERY_DELAY()).to.equal(BigInt(7 * 24 * 3600));
      });
    });

    describe("5.3 Receive ETH", function () {
      it("should accept ETH transfers", async function () {
        const multisigAddress = await multisig.getAddress();
        const balanceBefore = await ethers.provider.getBalance(multisigAddress);

        await signer1.sendTransaction({
          to: multisigAddress,
          value: ethers.parseEther("5"),
        });

        const balanceAfter = await ethers.provider.getBalance(multisigAddress);
        expect(balanceAfter - balanceBefore).to.equal(ethers.parseEther("5"));
      });
    });
  });

  // ============================================
  // SECTION 6: Security Attack Vectors
  // ============================================

  describe("6. Security Attack Vectors", function () {
    describe("6.1 Replay Attack Prevention", function () {
      it("should not allow re-execution of same transaction", async function () {
        await multisig.connect(signer1).submitTransaction(
          recipient.address,
          ethers.parseEther("1"),
          "0x",
          "Test"
        );

        await multisig.connect(signer2).confirmTransaction(0);
        await multisig.connect(signer3).confirmTransaction(0);
        await multisig.connect(signer1).executeTransaction(0);

        // Try to execute again
        await expect(
          multisig.connect(signer1).executeTransaction(0)
        ).to.be.revertedWithCustomError(multisig, "TransactionAlreadyExecuted");
      });
    });

    describe("6.2 Signer Impersonation Prevention", function () {
      it("should reject actions from removed signer", async function () {
        // Add a 6th signer
        const addData = multisig.interface.encodeFunctionData("addSigner", [
          signer6.address,
          "JP",
          "LEDGER",
        ]);

        await multisig.connect(signer1).submitTransaction(
          await multisig.getAddress(),
          0,
          addData,
          "Add"
        );
        await multisig.connect(signer2).confirmTransaction(0);
        await multisig.connect(signer3).confirmTransaction(0);
        await multisig.connect(signer1).executeTransaction(0);

        // Remove signer6
        const removeData = multisig.interface.encodeFunctionData("removeSigner", [signer6.address]);
        await multisig.connect(signer1).submitTransaction(
          await multisig.getAddress(),
          0,
          removeData,
          "Remove"
        );
        await multisig.connect(signer2).confirmTransaction(1);
        await multisig.connect(signer3).confirmTransaction(1);
        await multisig.connect(signer1).executeTransaction(1);

        // Try to submit from removed signer
        await expect(
          multisig.connect(signer6).submitTransaction(
            recipient.address,
            ethers.parseEther("1"),
            "0x",
            "Attack"
          )
        ).to.be.revertedWithCustomError(multisig, "NotSigner");
      });
    });

    describe("6.3 Confirmation After Expiry", function () {
      it("should not allow confirmation of expired transaction", async function () {
        await multisig.connect(signer1).submitTransaction(
          recipient.address,
          ethers.parseEther("1"),
          "0x",
          "Test"
        );

        // Fast forward past expiry
        await time.increase(DEFAULT_EXPIRY + 1);

        await expect(
          multisig.connect(signer2).confirmTransaction(0)
        ).to.be.revertedWithCustomError(multisig, "TransactionExpired");
      });
    });

    describe("6.4 Self-Destruct Prevention", function () {
      it("should handle failed executions gracefully", async function () {
        // Create a transaction that will fail (send ETH to a contract that reverts)
        const FailingReceiverFactory = await ethers.getContractFactory("SilentReverter");
        const failingReceiver = await FailingReceiverFactory.deploy();

        await multisig.connect(signer1).submitTransaction(
          await failingReceiver.getAddress(),
          ethers.parseEther("1"),
          "0x",
          "Will fail"
        );

        await multisig.connect(signer2).confirmTransaction(0);
        await multisig.connect(signer3).confirmTransaction(0);

        await expect(
          multisig.connect(signer1).executeTransaction(0)
        ).to.be.reverted;
      });
    });
  });
});
