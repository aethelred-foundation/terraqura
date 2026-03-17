import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import {
  CarbonRetirement,
  RetirementCertificate,
  MockERC1155,
} from "../typechain-types";

describe("RetirementCertificate", function () {
  const CREDIT_ID_1 = 1001n;
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

    // Link certificate contract to retirement
    await retirement.setCertificateContract(await certificate.getAddress());

    // Mint mock credits to retiree and approve
    await mockCredit.mint(retiree.address, CREDIT_ID_1, MINT_AMOUNT, "0x");
    await mockCredit
      .connect(retiree)
      .setApprovalForAll(await retirement.getAddress(), true);

    return { retirement, certificate, mockCredit, owner, retiree, other, unauthorized };
  }

  /**
   * Helper: perform a retirement and return the retirement & certificate data
   */
  async function retireAndGetCert(
    retirement: CarbonRetirement,
    certificate: RetirementCertificate,
    retiree: SignerWithAddress,
    creditId: bigint = CREDIT_ID_1,
    amount: bigint = 500n,
    beneficiary: string = "Acme Corp",
    reason: string = "Annual offset"
  ) {
    await retirement
      .connect(retiree)
      .retire(creditId, amount, beneficiary, reason);
    const record = await retirement.getRetirement(1n);
    const certData = await certificate.getCertificateData(record.certificateId);
    return { record, certData, tokenId: record.certificateId };
  }

  describe("Deployment & Initialization", function () {
    it("should set the correct owner", async function () {
      const { certificate, owner } = await loadFixture(deployFixture);
      expect(await certificate.owner()).to.equal(owner.address);
    });

    it("should set correct name and symbol", async function () {
      const { certificate } = await loadFixture(deployFixture);
      expect(await certificate.name()).to.equal("TerraQura Retirement Certificate");
      expect(await certificate.symbol()).to.equal("TQRC");
    });

    it("should set the retirement contract address", async function () {
      const { certificate, retirement } = await loadFixture(deployFixture);
      expect(await certificate.retirementContract()).to.equal(
        await retirement.getAddress()
      );
    });

    it("should have correct version", async function () {
      const { certificate } = await loadFixture(deployFixture);
      expect(await certificate.VERSION()).to.equal("1.0.0");
    });

    it("should start with soulbound disabled", async function () {
      const { certificate } = await loadFixture(deployFixture);
      expect(await certificate.soulbound()).to.be.false;
    });

    it("should start with zero total certificates", async function () {
      const { certificate } = await loadFixture(deployFixture);
      expect(await certificate.totalCertificates()).to.equal(0);
    });

    it("should revert initialization with zero retirement contract", async function () {
      const CertFactory = await ethers.getContractFactory("RetirementCertificate");
      const [owner] = await ethers.getSigners();
      await expect(
        upgrades.deployProxy(
          CertFactory,
          [ethers.ZeroAddress, owner.address],
          { initializer: "initialize" }
        )
      ).to.be.revertedWithCustomError(
        { interface: CertFactory.interface } as any,
        "InvalidRetirementContract"
      );
    });
  });

  describe("Mint Certificate", function () {
    it("should mint a certificate via retirement", async function () {
      const { retirement, certificate, retiree } = await loadFixture(deployFixture);

      await retirement
        .connect(retiree)
        .retire(CREDIT_ID_1, 500n, "Acme Corp", "Offset");

      expect(await certificate.totalCertificates()).to.equal(1);
      expect(await certificate.ownerOf(1n)).to.equal(retiree.address);
    });

    it("should emit CertificateMinted event", async function () {
      const { retirement, certificate, retiree } = await loadFixture(deployFixture);

      await expect(
        retirement
          .connect(retiree)
          .retire(CREDIT_ID_1, 500n, "Acme Corp", "Offset")
      ).to.emit(certificate, "CertificateMinted").withArgs(1n, 1n, retiree.address);
    });

    it("should auto-increment token IDs", async function () {
      const { retirement, certificate, retiree } = await loadFixture(deployFixture);

      await retirement
        .connect(retiree)
        .retire(CREDIT_ID_1, 100n, "Corp A", "Reason");
      await retirement
        .connect(retiree)
        .retire(CREDIT_ID_1, 200n, "Corp B", "Reason");

      expect(await certificate.ownerOf(1n)).to.equal(retiree.address);
      expect(await certificate.ownerOf(2n)).to.equal(retiree.address);
      expect(await certificate.totalCertificates()).to.equal(2);
    });
  });

  describe("On-chain tokenURI", function () {
    it("should return valid base64 JSON", async function () {
      const { retirement, certificate, retiree } = await loadFixture(deployFixture);

      await retirement
        .connect(retiree)
        .retire(CREDIT_ID_1, 500n, "Acme Corp", "Annual offset");

      const uri = await certificate.tokenURI(1n);
      expect(uri).to.match(/^data:application\/json;base64,/);

      // Decode and parse
      const base64Data = uri.replace("data:application/json;base64,", "");
      const jsonStr = Buffer.from(base64Data, "base64").toString("utf-8");
      const parsed = JSON.parse(jsonStr);

      expect(parsed.name).to.equal("TerraQura Retirement Certificate #1");
      expect(parsed.description).to.include("permanent carbon credit retirement");
      expect(parsed.attributes).to.be.an("array");
    });

    it("should include correct attributes in metadata", async function () {
      const { retirement, certificate, retiree } = await loadFixture(deployFixture);

      await retirement
        .connect(retiree)
        .retire(CREDIT_ID_1, 500n, "Acme Corp", "Annual offset");

      const uri = await certificate.tokenURI(1n);
      const base64Data = uri.replace("data:application/json;base64,", "");
      const jsonStr = Buffer.from(base64Data, "base64").toString("utf-8");
      const parsed = JSON.parse(jsonStr);

      const attributes = parsed.attributes;
      const findTrait = (name: string) =>
        attributes.find((a: any) => a.trait_type === name);

      expect(findTrait("Retirement ID").value).to.equal("1");
      expect(findTrait("Credit ID").value).to.equal(CREDIT_ID_1.toString());
      expect(findTrait("Amount (tonnes CO2)").value).to.equal("500");
      expect(findTrait("Beneficiary").value).to.equal("Acme Corp");
      expect(findTrait("Reason").value).to.equal("Annual offset");
      expect(findTrait("Methodology").value).to.equal("DAC");
    });

    it("should revert tokenURI for non-existent token", async function () {
      const { certificate } = await loadFixture(deployFixture);

      await expect(certificate.tokenURI(999n)).to.be.revertedWithCustomError(
        certificate,
        "TokenDoesNotExist"
      );
    });
  });

  describe("Certificate Data Matches Retirement", function () {
    it("should store matching certificate data", async function () {
      const { retirement, certificate, retiree } = await loadFixture(deployFixture);

      await retirement
        .connect(retiree)
        .retire(CREDIT_ID_1, 500n, "Acme Corp", "Annual offset");

      const record = await retirement.getRetirement(1n);
      const certData = await certificate.getCertificateData(record.certificateId);

      expect(certData.retirementId).to.equal(1n);
      expect(certData.creditId).to.equal(CREDIT_ID_1);
      expect(certData.amount).to.equal(500n);
      expect(certData.beneficiary).to.equal("Acme Corp");
      expect(certData.reason).to.equal("Annual offset");
      expect(certData.methodology).to.equal("DAC");
    });

    it("should revert getCertificateData for non-existent token", async function () {
      const { certificate } = await loadFixture(deployFixture);

      await expect(
        certificate.getCertificateData(999n)
      ).to.be.revertedWithCustomError(certificate, "TokenDoesNotExist");
    });
  });

  describe("Soulbound Mode", function () {
    it("should prevent transfer when soulbound enabled", async function () {
      const { retirement, certificate, retiree, other } =
        await loadFixture(deployFixture);

      await retirement
        .connect(retiree)
        .retire(CREDIT_ID_1, 500n, "Corp", "Reason");

      await certificate.setSoulbound(true);

      await expect(
        certificate
          .connect(retiree)
          .transferFrom(retiree.address, other.address, 1n)
      ).to.be.revertedWithCustomError(certificate, "SoulboundTransferBlocked");
    });

    it("should allow transfer when soulbound disabled", async function () {
      const { retirement, certificate, retiree, other } =
        await loadFixture(deployFixture);

      await retirement
        .connect(retiree)
        .retire(CREDIT_ID_1, 500n, "Corp", "Reason");

      expect(await certificate.soulbound()).to.be.false;

      await certificate
        .connect(retiree)
        .transferFrom(retiree.address, other.address, 1n);

      expect(await certificate.ownerOf(1n)).to.equal(other.address);
    });

    it("should allow minting even when soulbound", async function () {
      const { retirement, certificate, retiree } = await loadFixture(deployFixture);

      await certificate.setSoulbound(true);

      // Minting should still work (from == address(0))
      await expect(
        retirement
          .connect(retiree)
          .retire(CREDIT_ID_1, 500n, "Corp", "Reason")
      ).to.not.be.reverted;

      expect(await certificate.ownerOf(1n)).to.equal(retiree.address);
    });

    it("should only allow owner to toggle soulbound", async function () {
      const { certificate, unauthorized } = await loadFixture(deployFixture);

      await expect(
        certificate.connect(unauthorized).setSoulbound(true)
      ).to.be.reverted;
    });

    it("should be toggleable back and forth", async function () {
      const { retirement, certificate, retiree, other } =
        await loadFixture(deployFixture);

      await retirement
        .connect(retiree)
        .retire(CREDIT_ID_1, 100n, "Corp", "Reason");

      // Enable soulbound
      await certificate.setSoulbound(true);
      await expect(
        certificate
          .connect(retiree)
          .transferFrom(retiree.address, other.address, 1n)
      ).to.be.revertedWithCustomError(certificate, "SoulboundTransferBlocked");

      // Disable soulbound
      await certificate.setSoulbound(false);
      await certificate
        .connect(retiree)
        .transferFrom(retiree.address, other.address, 1n);
      expect(await certificate.ownerOf(1n)).to.equal(other.address);
    });
  });

  describe("Only Retirement Contract Can Mint", function () {
    it("should revert when non-retirement contract tries to mint", async function () {
      const { certificate, unauthorized } = await loadFixture(deployFixture);

      const certData = {
        retirementId: 1n,
        creditId: CREDIT_ID_1,
        amount: 500n,
        beneficiary: "Corp",
        reason: "Reason",
        timestamp: BigInt(Math.floor(Date.now() / 1000)),
        methodology: "DAC",
        vintage: "2025",
      };

      await expect(
        certificate.connect(unauthorized).mint(unauthorized.address, 1n, certData)
      ).to.be.revertedWithCustomError(certificate, "OnlyRetirementContract");
    });

    it("should revert when owner tries to mint directly", async function () {
      const { certificate, owner } = await loadFixture(deployFixture);

      const certData = {
        retirementId: 1n,
        creditId: CREDIT_ID_1,
        amount: 500n,
        beneficiary: "Corp",
        reason: "Reason",
        timestamp: BigInt(Math.floor(Date.now() / 1000)),
        methodology: "DAC",
        vintage: "2025",
      };

      await expect(
        certificate.mint(owner.address, 1n, certData)
      ).to.be.revertedWithCustomError(certificate, "OnlyRetirementContract");
    });
  });

  describe("Total Certificates Counter", function () {
    it("should increment counter on each mint", async function () {
      const { retirement, certificate, retiree } = await loadFixture(deployFixture);

      expect(await certificate.totalCertificates()).to.equal(0);

      await retirement
        .connect(retiree)
        .retire(CREDIT_ID_1, 100n, "Corp", "Reason");
      expect(await certificate.totalCertificates()).to.equal(1);

      await retirement
        .connect(retiree)
        .retire(CREDIT_ID_1, 100n, "Corp", "Reason");
      expect(await certificate.totalCertificates()).to.equal(2);
    });
  });

  describe("Enumeration (ERC721Enumerable)", function () {
    it("should support tokenOfOwnerByIndex", async function () {
      const { retirement, certificate, retiree } = await loadFixture(deployFixture);

      await retirement
        .connect(retiree)
        .retire(CREDIT_ID_1, 100n, "Corp A", "Reason");
      await retirement
        .connect(retiree)
        .retire(CREDIT_ID_1, 200n, "Corp B", "Reason");

      expect(await certificate.tokenOfOwnerByIndex(retiree.address, 0)).to.equal(1n);
      expect(await certificate.tokenOfOwnerByIndex(retiree.address, 1)).to.equal(2n);
    });

    it("should report correct balanceOf", async function () {
      const { retirement, certificate, retiree } = await loadFixture(deployFixture);

      await retirement
        .connect(retiree)
        .retire(CREDIT_ID_1, 100n, "Corp", "Reason");
      await retirement
        .connect(retiree)
        .retire(CREDIT_ID_1, 200n, "Corp", "Reason");

      expect(await certificate.balanceOf(retiree.address)).to.equal(2);
    });

    it("should support totalSupply", async function () {
      const { retirement, certificate, retiree } = await loadFixture(deployFixture);

      await retirement
        .connect(retiree)
        .retire(CREDIT_ID_1, 100n, "Corp", "Reason");

      expect(await certificate.totalSupply()).to.equal(1);
    });

    it("should support tokenByIndex", async function () {
      const { retirement, certificate, retiree } = await loadFixture(deployFixture);

      await retirement
        .connect(retiree)
        .retire(CREDIT_ID_1, 100n, "Corp A", "Reason");
      await retirement
        .connect(retiree)
        .retire(CREDIT_ID_1, 200n, "Corp B", "Reason");

      expect(await certificate.tokenByIndex(0)).to.equal(1n);
      expect(await certificate.tokenByIndex(1)).to.equal(2n);
    });
  });

  describe("Admin Functions", function () {
    it("should allow owner to update retirement contract", async function () {
      const { certificate, other } = await loadFixture(deployFixture);

      await certificate.setRetirementContract(other.address);
      expect(await certificate.retirementContract()).to.equal(other.address);
    });

    it("should revert setRetirementContract with zero address", async function () {
      const { certificate } = await loadFixture(deployFixture);

      await expect(
        certificate.setRetirementContract(ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(certificate, "InvalidRetirementContract");
    });

    it("should only allow owner to update retirement contract", async function () {
      const { certificate, unauthorized, other } = await loadFixture(deployFixture);

      await expect(
        certificate.connect(unauthorized).setRetirementContract(other.address)
      ).to.be.reverted;
    });
  });
});
