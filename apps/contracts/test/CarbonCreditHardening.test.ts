import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import {
  CarbonCredit,
  ReentrantReceiver,
  VerificationEngine,
} from "../typechain-types";

/**
 * CarbonCredit hardening suite — closes the branch-coverage gaps the baseline
 * solidity-coverage run exposed, with behavioral tests (attack fixtures and
 * lifecycle assertions), not stubs:
 *
 *  - genuine cross-function reentrancy attempt from inside the ERC-1155 mint
 *    callback (proves nonReentrant actually guards the mid-mint window)
 *  - UUPS upgrade authorization (owner path + non-owner rejection) INCLUDING
 *    proof that pre-upgrade state and the v3.1.0 appended seal fields survive
 *    the upgrade (storage-layout safety of the append)
 *  - re-initialization lockout
 *  - owner-only negative paths (setVerificationEngine, unpause, setBaseUri,
 *    releaseBufferCredits, handleReversal)
 *  - batchRetireCredits edges: insufficient balance, partial retire (balance
 *    remains), batch limits on the view helpers
 */
describe("CarbonCredit — hardening (branch-coverage completion)", function () {
  let carbonCredit: CarbonCredit;
  let verificationEngine: VerificationEngine;
  let owner: SignerWithAddress;
  let operator: SignerWithAddress;
  let buyer: SignerWithAddress;
  let stranger: SignerWithAddress;

  const dacUnitId = ethers.keccak256(ethers.toUtf8Bytes("DAC_UNIT_001"));
  const captureTimestamp = Math.floor(Date.now() / 1000);
  const co2AmountKg = 1000000;
  const energyConsumedKwh = 350000;
  const latitude = 24453884;
  const longitude = 54377344;
  const purityPercentage = 98;
  const gridIntensity = 50;
  const ipfsMetadataUri = "ipfs://QmHardeningTest";
  const arweaveBackupTxId = "arweave_tx_hardening";

  let batchCounter = 0;
  function freshBatch(): string {
    batchCounter += 1;
    return ethers.keccak256(
      ethers.toUtf8Bytes(`hardening_batch_${batchCounter}`),
    );
  }

  async function mintTo(to: string, batch = freshBatch()): Promise<bigint> {
    const tx = await carbonCredit
      .connect(operator)
      .mintVerifiedCredits(
        to,
        dacUnitId,
        batch,
        captureTimestamp,
        co2AmountKg,
        energyConsumedKwh,
        latitude,
        longitude,
        purityPercentage,
        gridIntensity,
        ipfsMetadataUri,
        arweaveBackupTxId,
      );
    const receipt = await tx.wait();
    const iface = carbonCredit.interface;
    for (const log of receipt!.logs) {
      try {
        const parsed = iface.parseLog(log);
        if (parsed?.name === "CreditMinted")
          return parsed.args.tokenId as bigint;
      } catch {
        /* other contract's log */
      }
    }
    throw new Error("CreditMinted not found");
  }

  beforeEach(async function () {
    [owner, operator, buyer, stranger] = await ethers.getSigners();

    const VerificationEngineFactory =
      await ethers.getContractFactory("VerificationEngine");
    verificationEngine = (await upgrades.deployProxy(
      VerificationEngineFactory,
      [ethers.ZeroAddress, ethers.ZeroAddress],
      { initializer: "initialize" },
    )) as unknown as VerificationEngine;
    await verificationEngine.waitForDeployment();

    const CarbonCreditFactory = await ethers.getContractFactory("CarbonCredit");
    carbonCredit = (await upgrades.deployProxy(
      CarbonCreditFactory,
      [await verificationEngine.getAddress(), "ipfs://", owner.address],
      { initializer: "initialize" },
    )) as unknown as CarbonCredit;
    await carbonCredit.waitForDeployment();

    await verificationEngine.setCarbonCreditContract(
      await carbonCredit.getAddress(),
    );
    await verificationEngine.whitelistDacUnit(dacUnitId, operator.address);
    await carbonCredit.setMinter(operator.address, true);
  });

  describe("reentrancy (real attack fixture)", function () {
    it("rejects cross-function reentrancy from inside the mint callback", async function () {
      const Receiver = await ethers.getContractFactory("ReentrantReceiver");
      const receiver =
        (await Receiver.deploy()) as unknown as ReentrantReceiver;
      await receiver.waitForDeployment();
      await receiver.arm(await carbonCredit.getAddress());

      // Minting to the armed receiver hands it execution control
      // mid-mint via onERC1155Received; its retireCredits re-entry must
      // be stopped by the guard, reverting the whole mint.
      await expect(
        carbonCredit
          .connect(operator)
          .mintVerifiedCredits(
            await receiver.getAddress(),
            dacUnitId,
            freshBatch(),
            captureTimestamp,
            co2AmountKg,
            energyConsumedKwh,
            latitude,
            longitude,
            purityPercentage,
            gridIntensity,
            ipfsMetadataUri,
            arweaveBackupTxId,
          ),
      ).to.be.revertedWith("ReentrancyGuard: reentrant call");
    });

    it("the same receiver mints fine once disarmed (fixture sanity)", async function () {
      const Receiver = await ethers.getContractFactory("ReentrantReceiver");
      const receiver =
        (await Receiver.deploy()) as unknown as ReentrantReceiver;
      await receiver.waitForDeployment();
      // not armed
      const tokenId = await mintTo(await receiver.getAddress());
      expect(
        await carbonCredit.balanceOf(await receiver.getAddress(), tokenId),
      ).to.be.gt(0);
    });
  });

  describe("UUPS upgrade authorization + storage-layout safety", function () {
    it("owner can upgrade; pre-upgrade state AND v3.1.0 seal fields survive", async function () {
      // Set state across old and appended (v3.1.0) storage regions.
      const tokenId = await mintTo(buyer.address);
      const registryAddr = ethers.getAddress(
        "0x00000000000000000000000000000000000000A1",
      );
      await carbonCredit.setSealRegistry(registryAddr);
      const mintedBefore = await carbonCredit.totalCreditsMinted();

      const CarbonCreditFactory =
        await ethers.getContractFactory("CarbonCredit");
      const upgraded = (await upgrades.upgradeProxy(
        await carbonCredit.getAddress(),
        CarbonCreditFactory,
      )) as unknown as CarbonCredit;

      // Old storage intact…
      expect(await upgraded.totalCreditsMinted()).to.equal(mintedBefore);
      expect(await upgraded.balanceOf(buyer.address, tokenId)).to.be.gt(0);
      // …and the appended seal fields too (layout-safe append).
      expect(await upgraded.sealRegistry()).to.equal(registryAddr);
      expect(await upgraded.sealAnchorRequired()).to.equal(false);
    });

    it("non-owner cannot upgrade (authorizeUpgrade gate)", async function () {
      const CarbonCreditFactory =
        await ethers.getContractFactory("CarbonCredit");
      const newImpl = await CarbonCreditFactory.deploy();
      await newImpl.waitForDeployment();

      await expect(
        carbonCredit.connect(stranger).upgradeTo(await newImpl.getAddress()),
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });

  describe("initialization lockout", function () {
    it("re-initialization reverts", async function () {
      await expect(
        carbonCredit.initialize(
          await verificationEngine.getAddress(),
          "ipfs://again/",
          stranger.address,
        ),
      ).to.be.revertedWith("Initializable: contract is already initialized");
    });
  });

  describe("owner-only negative paths", function () {
    it("setVerificationEngine rejects non-owner", async function () {
      await expect(
        carbonCredit
          .connect(stranger)
          .setVerificationEngine(await verificationEngine.getAddress()),
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("unpause rejects non-owner", async function () {
      await carbonCredit.pause();
      await expect(carbonCredit.connect(stranger).unpause()).to.be.revertedWith(
        "Ownable: caller is not the owner",
      );
      await carbonCredit.unpause();
    });

    it("setBaseUri rejects non-owner", async function () {
      await expect(
        carbonCredit.connect(stranger).setBaseUri("ipfs://evil/"),
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("releaseBufferCredits rejects non-owner", async function () {
      await expect(
        carbonCredit
          .connect(stranger)
          .releaseBufferCredits(1, 1, stranger.address, "grab"),
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("handleReversal rejects non-owner", async function () {
      await expect(
        carbonCredit.connect(stranger).handleReversal(1, 1, "grab"),
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });

  describe("batchRetireCredits edges", function () {
    it("reverts when any entry exceeds the caller's balance (whole batch atomic)", async function () {
      const tokenId = await mintTo(buyer.address);
      const balance = await carbonCredit.balanceOf(buyer.address, tokenId);
      await expect(
        carbonCredit
          .connect(buyer)
          .batchRetireCredits([tokenId], [balance + 1n], "overdraw"),
      ).to.be.revertedWithCustomError(carbonCredit, "InsufficientBalance");
    });

    it("partial retire leaves the remaining balance live (not marked retired)", async function () {
      const tokenId = await mintTo(buyer.address);
      const balance = await carbonCredit.balanceOf(buyer.address, tokenId);
      const half = balance / 2n;

      await carbonCredit
        .connect(buyer)
        .batchRetireCredits([tokenId], [half], "partial");

      expect(await carbonCredit.balanceOf(buyer.address, tokenId)).to.equal(
        balance - half,
      );
      const metadata = await carbonCredit.getMetadata(tokenId);
      expect(metadata.isRetired).to.equal(false);
    });

    it("retiring the full balance marks the credit retired", async function () {
      const tokenId = await mintTo(buyer.address);
      const balance = await carbonCredit.balanceOf(buyer.address, tokenId);

      await carbonCredit
        .connect(buyer)
        .batchRetireCredits([tokenId], [balance], "full");

      expect(await carbonCredit.balanceOf(buyer.address, tokenId)).to.equal(0);
      const metadata = await carbonCredit.getMetadata(tokenId);
      expect(metadata.isRetired).to.equal(true);
    });
  });

  describe("pausable gates on privileged/lifecycle functions", function () {
    it("releaseBufferCredits reverts when paused", async function () {
      await carbonCredit.pause();
      await expect(
        carbonCredit.releaseBufferCredits(1, 1, buyer.address, "while paused"),
      ).to.be.revertedWith("Pausable: paused");
    });

    it("handleReversal reverts when paused", async function () {
      await carbonCredit.pause();
      await expect(
        carbonCredit.handleReversal(1, 1, "while paused"),
      ).to.be.revertedWith("Pausable: paused");
    });

    it("batchRetireCredits reverts when paused", async function () {
      const tokenId = await mintTo(buyer.address);
      await carbonCredit.pause();
      await expect(
        carbonCredit
          .connect(buyer)
          .batchRetireCredits([tokenId], [1], "while paused"),
      ).to.be.revertedWith("Pausable: paused");
    });
  });

  describe("batch view limits", function () {
    it("batchGetCreditProvenance rejects more than 100 ids", async function () {
      const ids = Array.from({ length: 101 }, (_, i) => i + 1);
      await expect(
        carbonCredit.batchGetCreditProvenance(ids),
      ).to.be.revertedWith("Batch too large");
    });

    it("batchBalanceOf rejects more than 200 ids", async function () {
      const ids = Array.from({ length: 201 }, (_, i) => i + 1);
      await expect(
        carbonCredit.batchBalanceOf(buyer.address, ids),
      ).to.be.revertedWith("Batch too large");
    });
  });
});
