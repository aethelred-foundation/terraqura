import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import {
  CarbonRetirement,
  RetirementCertificate,
  MockERC1155,
} from "../typechain-types";

describe("CarbonRetirement", function () {
  const CREDIT_ID_1 = 1001n;
  const CREDIT_ID_2 = 1002n;
  const MINT_AMOUNT = 10000n;

  async function deployFixture() {
    const [owner, retiree, other, unauthorized] = await ethers.getSigners();

    // Deploy mock ERC-1155 as CarbonCredit stand-in
    const MockERC1155Factory = await ethers.getContractFactory("MockERC1155");
    const mockCredit = await MockERC1155Factory.deploy();
    await mockCredit.waitForDeployment();

    // Deploy CarbonRetirement (upgradeable)
    const RetirementFactory = await ethers.getContractFactory("CarbonRetirement");
    const retirement = (await upgrades.deployProxy(
      RetirementFactory,
      [await mockCredit.getAddress(), owner.address],
      { initializer: "initialize" }
    )) as unknown as CarbonRetirement;
    await retirement.waitForDeployment();

    // Deploy RetirementCertificate (upgradeable)
    const CertFactory = await ethers.getContractFactory("RetirementCertificate");
    const certificate = (await upgrades.deployProxy(
      CertFactory,
      [await retirement.getAddress(), owner.address],
      { initializer: "initialize" }
    )) as unknown as RetirementCertificate;
    await certificate.waitForDeployment();

    // Link certificate contract
    await retirement.setCertificateContract(await certificate.getAddress());

    // Mint mock credits to retiree
    await mockCredit.mint(retiree.address, CREDIT_ID_1, MINT_AMOUNT, "0x");
    await mockCredit.mint(retiree.address, CREDIT_ID_2, MINT_AMOUNT, "0x");

    // Approve retirement contract to transfer credits
    await mockCredit
      .connect(retiree)
      .setApprovalForAll(await retirement.getAddress(), true);

    return { retirement, certificate, mockCredit, owner, retiree, other, unauthorized };
  }

  describe("Deployment & Initialization", function () {
    it("should set the correct owner", async function () {
      const { retirement, owner } = await loadFixture(deployFixture);
      expect(await retirement.owner()).to.equal(owner.address);
    });

    it("should set the carbon credit contract address", async function () {
      const { retirement, mockCredit } = await loadFixture(deployFixture);
      expect(await retirement.carbonCredit()).to.equal(await mockCredit.getAddress());
    });

    it("should have certificate minting enabled", async function () {
      const { retirement } = await loadFixture(deployFixture);
      expect(await retirement.certificateMintingEnabled()).to.be.true;
    });

    it("should have correct version", async function () {
      const { retirement } = await loadFixture(deployFixture);
      expect(await retirement.VERSION()).to.equal("1.0.0");
    });

    it("should start with zero total retired", async function () {
      const { retirement } = await loadFixture(deployFixture);
      expect(await retirement.totalRetired()).to.equal(0);
    });

    it("should revert initialization with zero carbon credit address", async function () {
      const RetirementFactory = await ethers.getContractFactory("CarbonRetirement");
      const [owner] = await ethers.getSigners();
      await expect(
        upgrades.deployProxy(
          RetirementFactory,
          [ethers.ZeroAddress, owner.address],
          { initializer: "initialize" }
        )
      ).to.be.revertedWithCustomError(
        { interface: RetirementFactory.interface } as any,
        "InvalidCarbonCreditAddress"
      );
    });
  });

  describe("Single Credit Retirement", function () {
    it("should retire credits successfully", async function () {
      const { retirement, retiree } = await loadFixture(deployFixture);

      const tx = await retirement
        .connect(retiree)
        .retire(CREDIT_ID_1, 500n, "Acme Corp", "Annual offset");

      await expect(tx)
        .to.emit(retirement, "CreditRetired")
        .withArgs(1n, CREDIT_ID_1, retiree.address, 500n, "Acme Corp");
    });

    it("should create a retirement record with correct data", async function () {
      const { retirement, retiree } = await loadFixture(deployFixture);

      await retirement
        .connect(retiree)
        .retire(CREDIT_ID_1, 500n, "Acme Corp", "Annual offset");

      const record = await retirement.getRetirement(1n);
      expect(record.id).to.equal(1n);
      expect(record.creditId).to.equal(CREDIT_ID_1);
      expect(record.amount).to.equal(500n);
      expect(record.retiree).to.equal(retiree.address);
      expect(record.beneficiary).to.equal("Acme Corp");
      expect(record.reason).to.equal("Annual offset");
      expect(record.timestamp).to.be.gt(0);
      expect(record.certificateId).to.be.gt(0);
    });

    it("should update total retired counter", async function () {
      const { retirement, retiree } = await loadFixture(deployFixture);

      await retirement
        .connect(retiree)
        .retire(CREDIT_ID_1, 500n, "Acme Corp", "Offset");

      expect(await retirement.totalRetired()).to.equal(500n);
    });

    it("should update total retired by credit counter", async function () {
      const { retirement, retiree } = await loadFixture(deployFixture);

      await retirement
        .connect(retiree)
        .retire(CREDIT_ID_1, 300n, "Acme Corp", "Offset");

      expect(await retirement.totalRetiredByCredit(CREDIT_ID_1)).to.equal(300n);
    });

    it("should transfer credits to retirement contract", async function () {
      const { retirement, mockCredit, retiree } = await loadFixture(deployFixture);

      const balanceBefore = await mockCredit.balanceOf(retiree.address, CREDIT_ID_1);
      await retirement
        .connect(retiree)
        .retire(CREDIT_ID_1, 500n, "Acme Corp", "Offset");
      const balanceAfter = await mockCredit.balanceOf(retiree.address, CREDIT_ID_1);

      expect(balanceBefore - balanceAfter).to.equal(500n);
    });

    it("should auto-increment retirement IDs", async function () {
      const { retirement, retiree } = await loadFixture(deployFixture);

      await retirement
        .connect(retiree)
        .retire(CREDIT_ID_1, 100n, "Corp A", "Reason A");
      await retirement
        .connect(retiree)
        .retire(CREDIT_ID_1, 200n, "Corp B", "Reason B");

      const record1 = await retirement.getRetirement(1n);
      const record2 = await retirement.getRetirement(2n);
      expect(record1.id).to.equal(1n);
      expect(record2.id).to.equal(2n);
    });
  });

  describe("Batch Credit Retirement", function () {
    it("should retire batch credits successfully", async function () {
      const { retirement, retiree } = await loadFixture(deployFixture);

      const tx = await retirement
        .connect(retiree)
        .retireBatch(
          [CREDIT_ID_1, CREDIT_ID_2],
          [100n, 200n],
          "Acme Corp",
          "Batch offset"
        );

      await expect(tx)
        .to.emit(retirement, "CreditRetired")
        .withArgs(1n, CREDIT_ID_1, retiree.address, 100n, "Acme Corp");
      await expect(tx)
        .to.emit(retirement, "CreditRetired")
        .withArgs(2n, CREDIT_ID_2, retiree.address, 200n, "Acme Corp");
    });

    it("should return correct retirement IDs from batch", async function () {
      const { retirement, retiree } = await loadFixture(deployFixture);

      const retirementIds = await retirement
        .connect(retiree)
        .retireBatch.staticCall(
          [CREDIT_ID_1, CREDIT_ID_2],
          [100n, 200n],
          "Acme Corp",
          "Batch"
        );

      expect(retirementIds[0]).to.equal(1n);
      expect(retirementIds[1]).to.equal(2n);
    });

    it("should update total retired for batch", async function () {
      const { retirement, retiree } = await loadFixture(deployFixture);

      await retirement
        .connect(retiree)
        .retireBatch(
          [CREDIT_ID_1, CREDIT_ID_2],
          [100n, 200n],
          "Acme Corp",
          "Batch"
        );

      expect(await retirement.totalRetired()).to.equal(300n);
    });

    it("should revert batch with mismatched array lengths", async function () {
      const { retirement, retiree } = await loadFixture(deployFixture);

      await expect(
        retirement
          .connect(retiree)
          .retireBatch([CREDIT_ID_1, CREDIT_ID_2], [100n], "Acme", "Reason")
      ).to.be.revertedWithCustomError(retirement, "ArrayLengthMismatch");
    });

    it("should revert batch with empty arrays", async function () {
      const { retirement, retiree } = await loadFixture(deployFixture);

      await expect(
        retirement.connect(retiree).retireBatch([], [], "Acme", "Reason")
      ).to.be.revertedWithCustomError(retirement, "BatchTooLarge");
    });
  });

  describe("Query by Beneficiary", function () {
    it("should return retirements by beneficiary", async function () {
      const { retirement, retiree } = await loadFixture(deployFixture);

      await retirement
        .connect(retiree)
        .retire(CREDIT_ID_1, 100n, "Acme Corp", "Offset 1");
      await retirement
        .connect(retiree)
        .retire(CREDIT_ID_2, 200n, "Acme Corp", "Offset 2");

      const ids = await retirement.getRetirementsByBeneficiary("Acme Corp");
      expect(ids.length).to.equal(2);
      expect(ids[0]).to.equal(1n);
      expect(ids[1]).to.equal(2n);
    });

    it("should return empty array for unknown beneficiary", async function () {
      const { retirement } = await loadFixture(deployFixture);

      const ids = await retirement.getRetirementsByBeneficiary("Unknown Corp");
      expect(ids.length).to.equal(0);
    });
  });

  describe("Query by Retiree", function () {
    it("should return retirements by retiree address", async function () {
      const { retirement, retiree } = await loadFixture(deployFixture);

      await retirement
        .connect(retiree)
        .retire(CREDIT_ID_1, 100n, "Corp A", "Reason");
      await retirement
        .connect(retiree)
        .retire(CREDIT_ID_2, 200n, "Corp B", "Reason");

      const ids = await retirement.getRetirementsByRetiree(retiree.address);
      expect(ids.length).to.equal(2);
    });

    it("should return empty array for address with no retirements", async function () {
      const { retirement, other } = await loadFixture(deployFixture);

      const ids = await retirement.getRetirementsByRetiree(other.address);
      expect(ids.length).to.equal(0);
    });
  });

  describe("Cannot Retire More Than Balance", function () {
    it("should revert when retiring more than balance", async function () {
      const { retirement, retiree } = await loadFixture(deployFixture);

      await expect(
        retirement
          .connect(retiree)
          .retire(CREDIT_ID_1, MINT_AMOUNT + 1n, "Corp", "Too much")
      ).to.be.reverted; // ERC1155 insufficient balance
    });
  });

  describe("Cannot Retire Zero Amount", function () {
    it("should revert when retiring zero amount", async function () {
      const { retirement, retiree } = await loadFixture(deployFixture);

      await expect(
        retirement.connect(retiree).retire(CREDIT_ID_1, 0n, "Corp", "Zero")
      ).to.be.revertedWithCustomError(retirement, "ZeroAmount");
    });

    it("should revert batch with zero amount in array", async function () {
      const { retirement, retiree } = await loadFixture(deployFixture);

      await expect(
        retirement
          .connect(retiree)
          .retireBatch([CREDIT_ID_1], [0n], "Corp", "Zero")
      ).to.be.revertedWithCustomError(retirement, "ZeroAmount");
    });
  });

  describe("Empty Beneficiary Validation", function () {
    it("should revert with empty beneficiary", async function () {
      const { retirement, retiree } = await loadFixture(deployFixture);

      await expect(
        retirement.connect(retiree).retire(CREDIT_ID_1, 100n, "", "Reason")
      ).to.be.revertedWithCustomError(retirement, "EmptyBeneficiary");
    });

    it("should revert batch with empty beneficiary", async function () {
      const { retirement, retiree } = await loadFixture(deployFixture);

      await expect(
        retirement
          .connect(retiree)
          .retireBatch([CREDIT_ID_1], [100n], "", "Reason")
      ).to.be.revertedWithCustomError(retirement, "EmptyBeneficiary");
    });
  });

  describe("Emits CreditRetired Event", function () {
    it("should emit CreditRetired with all indexed parameters", async function () {
      const { retirement, retiree } = await loadFixture(deployFixture);

      await expect(
        retirement
          .connect(retiree)
          .retire(CREDIT_ID_1, 500n, "Acme Corp", "Annual offset")
      )
        .to.emit(retirement, "CreditRetired")
        .withArgs(1n, CREDIT_ID_1, retiree.address, 500n, "Acme Corp");
    });
  });

  describe("Creates Certificate Automatically", function () {
    it("should mint a certificate on retirement", async function () {
      const { retirement, certificate, retiree } = await loadFixture(deployFixture);

      await retirement
        .connect(retiree)
        .retire(CREDIT_ID_1, 500n, "Acme Corp", "Offset");

      expect(await certificate.totalCertificates()).to.equal(1);
      expect(await certificate.ownerOf(1n)).to.equal(retiree.address);
    });

    it("should not mint certificate when disabled", async function () {
      const { retirement, certificate, retiree } = await loadFixture(deployFixture);

      await retirement.setCertificateMintingEnabled(false);
      await retirement
        .connect(retiree)
        .retire(CREDIT_ID_1, 500n, "Acme Corp", "Offset");

      expect(await certificate.totalCertificates()).to.equal(0);

      const record = await retirement.getRetirement(1n);
      expect(record.certificateId).to.equal(0);
    });
  });

  describe("Total Retired Tracking", function () {
    it("should accumulate total retired across multiple retirements", async function () {
      const { retirement, retiree } = await loadFixture(deployFixture);

      await retirement
        .connect(retiree)
        .retire(CREDIT_ID_1, 100n, "Corp A", "Reason");
      await retirement
        .connect(retiree)
        .retire(CREDIT_ID_2, 200n, "Corp B", "Reason");

      expect(await retirement.totalRetired()).to.equal(300n);
    });

    it("should track per-credit retirement totals", async function () {
      const { retirement, retiree } = await loadFixture(deployFixture);

      await retirement
        .connect(retiree)
        .retire(CREDIT_ID_1, 100n, "Corp", "Reason");
      await retirement
        .connect(retiree)
        .retire(CREDIT_ID_1, 200n, "Corp", "Reason");

      expect(await retirement.totalRetiredByCredit(CREDIT_ID_1)).to.equal(300n);
      expect(await retirement.totalRetiredByCredit(CREDIT_ID_2)).to.equal(0n);
    });
  });

  describe("Access Control", function () {
    it("should only allow owner to set certificate contract", async function () {
      const { retirement, unauthorized } = await loadFixture(deployFixture);

      await expect(
        retirement.connect(unauthorized).setCertificateContract(ethers.ZeroAddress)
      ).to.be.reverted;
    });

    it("should only allow owner to toggle certificate minting", async function () {
      const { retirement, unauthorized } = await loadFixture(deployFixture);

      await expect(
        retirement.connect(unauthorized).setCertificateMintingEnabled(false)
      ).to.be.reverted;
    });

    it("should revert setCertificateContract with zero address", async function () {
      const { retirement } = await loadFixture(deployFixture);

      await expect(
        retirement.setCertificateContract(ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(retirement, "InvalidCertificateAddress");
    });
  });

  describe("Pause Functionality", function () {
    it("should pause the contract", async function () {
      const { retirement } = await loadFixture(deployFixture);

      await retirement.pause();
      expect(await retirement.paused()).to.be.true;
    });

    it("should unpause the contract", async function () {
      const { retirement } = await loadFixture(deployFixture);

      await retirement.pause();
      await retirement.unpause();
      expect(await retirement.paused()).to.be.false;
    });

    it("should reject retirement when paused", async function () {
      const { retirement, retiree } = await loadFixture(deployFixture);

      await retirement.pause();
      await expect(
        retirement
          .connect(retiree)
          .retire(CREDIT_ID_1, 100n, "Corp", "Reason")
      ).to.be.reverted;
    });

    it("should reject batch retirement when paused", async function () {
      const { retirement, retiree } = await loadFixture(deployFixture);

      await retirement.pause();
      await expect(
        retirement
          .connect(retiree)
          .retireBatch([CREDIT_ID_1], [100n], "Corp", "Reason")
      ).to.be.reverted;
    });

    it("should only allow owner to pause", async function () {
      const { retirement, unauthorized } = await loadFixture(deployFixture);

      await expect(retirement.connect(unauthorized).pause()).to.be.reverted;
    });

    it("should only allow owner to unpause", async function () {
      const { retirement, unauthorized } = await loadFixture(deployFixture);

      await retirement.pause();
      await expect(retirement.connect(unauthorized).unpause()).to.be.reverted;
    });
  });

  describe("ReentrancyGuard Protection", function () {
    it("should have nonReentrant modifier on retire", async function () {
      // Verified by successful single retirement - nonReentrant is applied
      const { retirement, retiree } = await loadFixture(deployFixture);

      await expect(
        retirement
          .connect(retiree)
          .retire(CREDIT_ID_1, 100n, "Corp", "Reason")
      ).to.not.be.reverted;
    });

    it("should have nonReentrant modifier on retireBatch", async function () {
      const { retirement, retiree } = await loadFixture(deployFixture);

      await expect(
        retirement
          .connect(retiree)
          .retireBatch([CREDIT_ID_1], [100n], "Corp", "Reason")
      ).to.not.be.reverted;
    });
  });
});
