import { expect } from "chai";
import { ethers, network, upgrades } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import {
  CarbonCredit,
  CarbonMarketplace,
  CircuitBreaker,
  MockERC1155,
  MockISeal,
  MockKycRegistry,
  SealProofOfPhysics,
  TerraQuraAccessControl,
  VerificationEngine,
} from "../typechain-types";

/**
 * Lifecycle hardening — consultant P0 regression suite (2026-07).
 *
 * Domain-invariant tests for the defects that statement coverage did not
 * catch:
 *   P0.2 retirement burns supply; multi-holder isRetired; zero-amount revert
 *   P0.3 revoked seal suspends settlement + retirement of issued credits
 *   P0.4 seal enforcement one-way lock; policy hash/version snapshots
 *   P0.5 circuit breaker actually blocks core mutations; limit auth
 *   P0.6 one KYC authority; settlement-time rechecks of BOTH parties
 */
describe("Lifecycle hardening (consultant P0 fixes)", function () {
  // ============================================================
  // Real-stack fixture: MockISeal at the precompile address, real
  // SealProofOfPhysics, real VerificationEngine, real CarbonCredit.
  // ============================================================
  const SEAL_PRECOMPILE = "0x0000000000000000000000000000000000000900";

  let carbonCredit: CarbonCredit;
  let verificationEngine: VerificationEngine;
  let registry: SealProofOfPhysics;
  let seal: MockISeal;
  let owner: SignerWithAddress;
  let operator: SignerWithAddress;
  let buyer: SignerWithAddress;
  let stranger: SignerWithAddress;

  const dacUnitId = ethers.keccak256(ethers.toUtf8Bytes("DAC_UNIT_P0"));
  const sourceDataHash = ethers.keccak256(ethers.toUtf8Bytes("sensor_batch_p0"));
  const captureTimestamp = 1767225600; // 2026-01-01T00:00:00Z → vintage "2026"
  const co2AmountKg = 1000000;
  const energyConsumedKwh = 350000;
  const purity = 98;
  const gridIntensity = 50;

  const JOB = "job-mrv-p0";
  const SEAL_ID = "b".repeat(64);
  const purposeFor = (unit: string, batch: string) => `terraqura:${unit}:${batch}`;

  function mint(batch = sourceDataHash) {
    return carbonCredit
      .connect(operator)
      .mintVerifiedCredits(
        buyer.address,
        dacUnitId,
        batch,
        captureTimestamp,
        co2AmountKg,
        energyConsumedKwh,
        24453884,
        54377344,
        purity,
        gridIntensity,
        "ipfs://QmLifecycleP0",
        "arweave_tx_p0",
      );
  }

  async function mintedTokenId(tx: Promise<any>): Promise<bigint> {
    const receipt = await (await tx).wait();
    const evt = receipt!.logs
      .map((l: any) => {
        try {
          return carbonCredit.interface.parseLog(l);
        } catch {
          return null;
        }
      })
      .find((e: any) => e && e.name === "CreditMinted");
    return evt!.args[0] as bigint;
  }

  beforeEach(async function () {
    [owner, operator, buyer, stranger] = await ethers.getSigners();

    const MockISealFactory = await ethers.getContractFactory("MockISeal");
    const deployed = await MockISealFactory.deploy();
    await deployed.waitForDeployment();
    const runtime = await ethers.provider.getCode(await deployed.getAddress());
    await network.provider.send("hardhat_setCode", [SEAL_PRECOMPILE, runtime]);
    seal = MockISealFactory.attach(SEAL_PRECOMPILE) as MockISeal;
    await seal.setPolicyResult(true, "");

    const Registry = await ethers.getContractFactory("SealProofOfPhysics");
    registry = (await Registry.deploy(owner.address)) as SealProofOfPhysics;
    await registry.waitForDeployment();

    const VerificationEngineFactory = await ethers.getContractFactory("VerificationEngine");
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

    await verificationEngine.setCarbonCreditContract(await carbonCredit.getAddress());
    await verificationEngine.whitelistDacUnit(dacUnitId, operator.address);
    await carbonCredit.setMinter(operator.address, true);
  });

  async function anchorClaim(batch = sourceDataHash, job = JOB, sealId = SEAL_ID) {
    await seal.setSeal(job, sealId, purposeFor(dacUnitId, batch), true);
    await registry.anchor(dacUnitId, batch, job);
  }

  async function enableSealTier() {
    await carbonCredit.setSealRegistry(await registry.getAddress());
    await carbonCredit.setSealAnchorRequired(true);
  }

  // ============================================================
  // P0.2 — retirement invariants
  // ============================================================
  describe("P0.2 retirement invariants", function () {
    let tokenId: bigint;

    beforeEach(async function () {
      tokenId = await mintedTokenId(mint());
    });

    it("reverts a zero-amount retirement (the isRetired-corruption exploit)", async function () {
      // A zero-balance stranger must NOT be able to flag the batch retired
      // via a zero-amount call (previously: _burn(0) no-op + caller-balance
      // check set isRetired for a batch other holders still owned).
      await expect(
        carbonCredit.connect(stranger).retireCredits(tokenId, 0, "griefing"),
      ).to.be.revertedWithCustomError(carbonCredit, "InvalidRetirementAmount");

      const [meta] = await carbonCredit.getCreditProvenance(tokenId);
      expect(meta.isRetired).to.equal(false);
    });

    it("reverts zero amounts inside batchRetireCredits too", async function () {
      await expect(
        carbonCredit.connect(buyer).batchRetireCredits([tokenId], [0], "zero"),
      ).to.be.revertedWithCustomError(carbonCredit, "InvalidRetirementAmount");
    });

    it("keeps the batch un-retired while OTHER holders still own supply", async function () {
      const balance = await carbonCredit.balanceOf(buyer.address, tokenId);
      const half = balance / 2n;
      await carbonCredit
        .connect(buyer)
        .safeTransferFrom(buyer.address, stranger.address, tokenId, half, "0x");

      // Buyer retires their ENTIRE remaining balance…
      await carbonCredit.connect(buyer).retireCredits(tokenId, balance - half, "mine");

      // …but the batch is NOT retired: stranger still holds supply.
      let [meta] = await carbonCredit.getCreditProvenance(tokenId);
      expect(meta.isRetired).to.equal(false);
      expect(await carbonCredit.isCreditActive(tokenId)).to.equal(true);

      // Only when the remaining total supply hits zero does the flag flip.
      await carbonCredit.connect(stranger).retireCredits(tokenId, half, "rest");
      [meta] = await carbonCredit.getCreditProvenance(tokenId);
      expect(meta.isRetired).to.equal(true);
      expect(await carbonCredit.isCreditActive(tokenId)).to.equal(false);
    });

    it("restricts retireCreditsFrom to approved retirers WITH operator approval", async function () {
      // Not an approved retirer.
      await expect(
        carbonCredit.connect(stranger).retireCreditsFrom(buyer.address, tokenId, 1, "x"),
      ).to.be.revertedWithCustomError(carbonCredit, "UnauthorizedRetirer");

      // Approved retirer but the holder has NOT opted in via setApprovalForAll.
      await carbonCredit.setApprovedRetirer(stranger.address, true);
      await expect(
        carbonCredit.connect(stranger).retireCreditsFrom(buyer.address, tokenId, 1, "x"),
      ).to.be.revertedWithCustomError(carbonCredit, "RetirerNotApprovedOperator");

      // Both gates satisfied → burn succeeds and reduces the holder balance.
      await carbonCredit.connect(buyer).setApprovalForAll(stranger.address, true);
      const before = await carbonCredit.balanceOf(buyer.address, tokenId);
      await carbonCredit.connect(stranger).retireCreditsFrom(buyer.address, tokenId, 5, "ok");
      expect(await carbonCredit.balanceOf(buyer.address, tokenId)).to.equal(before - 5n);
    });
  });

  // ============================================================
  // P0.3 — post-mint seal revocation suspends the batch
  // ============================================================
  describe("P0.3 revoked seal suspends issued credits", function () {
    let tokenId: bigint;

    beforeEach(async function () {
      await enableSealTier();
      await anchorClaim();
      tokenId = await mintedTokenId(mint());
    });

    it("records the assurance tier at mint", async function () {
      expect(await carbonCredit.sealAnchoredToken(tokenId)).to.equal(true);
      expect(await carbonCredit.isCreditActive(tokenId)).to.equal(true);
    });

    it("on-chain seal revocation reads inactive on the NEXT call and blocks retirement", async function () {
      // Consensus revokes the Digital Seal (e.g. sensor fraud discovered).
      await seal.setActive(SEAL_ID, false);

      expect(await carbonCredit.isCreditActive(tokenId)).to.equal(false);
      await expect(
        carbonCredit.connect(buyer).retireCredits(tokenId, 1, "should fail"),
      ).to.be.revertedWithCustomError(carbonCredit, "CreditSuspended");
    });

    it("local governance revocation has the same effect", async function () {
      await registry.revoke(dacUnitId, sourceDataHash);
      expect(await carbonCredit.isCreditActive(tokenId)).to.equal(false);
      await expect(
        carbonCredit.connect(buyer).retireCredits(tokenId, 1, "should fail"),
      ).to.be.revertedWithCustomError(carbonCredit, "CreditSuspended");
    });

    it("non-seal-tier batches are unaffected by the seal machinery", async function () {
      // Disable enforcement and mint a second, ordinary batch.
      await carbonCredit.setSealAnchorRequired(false);
      const batch2 = ethers.keccak256(ethers.toUtf8Bytes("sensor_batch_p0_2"));
      const token2 = await mintedTokenId(mint(batch2));

      expect(await carbonCredit.sealAnchoredToken(token2)).to.equal(false);
      expect(await carbonCredit.isCreditActive(token2)).to.equal(true);
      await expect(carbonCredit.connect(buyer).retireCredits(token2, 1, "fine")).to.emit(
        carbonCredit,
        "CreditRetired",
      );
    });
  });

  // ============================================================
  // P0.4 — one-way enforcement lock + policy snapshots
  // ============================================================
  describe("P0.4 seal enforcement lock and policy versioning", function () {
    it("lock requires fully wired enforcement first", async function () {
      await expect(carbonCredit.lockSealEnforcement()).to.be.revertedWithCustomError(
        carbonCredit,
        "SealRegistryNotSet",
      );
    });

    it("after locking, the registry and requirement are immutable", async function () {
      await enableSealTier();
      await expect(carbonCredit.lockSealEnforcement()).to.emit(
        carbonCredit,
        "SealEnforcementLocked",
      );
      expect(await carbonCredit.sealEnforcementLocked()).to.equal(true);

      await expect(
        carbonCredit.setSealAnchorRequired(false),
      ).to.be.revertedWithCustomError(carbonCredit, "SealEnforcementIsLocked");
      await expect(
        carbonCredit.setSealRegistry(ethers.ZeroAddress),
      ).to.be.revertedWithCustomError(carbonCredit, "SealEnforcementIsLocked");
      await expect(
        carbonCredit.setSealRegistry(stranger.address),
      ).to.be.revertedWithCustomError(carbonCredit, "SealEnforcementIsLocked");
    });

    it("anchors snapshot the CEAP policy hash and version at admission time", async function () {
      expect(await registry.policyVersion()).to.equal(0);
      await registry.setCompliancePolicy(["tee"], "tee-attested", [], true, ["AE"]);
      expect(await registry.policyVersion()).to.equal(1);
      const hashAtAnchor = await registry.policyHash();

      await anchorClaim();
      const anchor = await registry.getAnchor(dacUnitId, sourceDataHash);
      expect(anchor.policyVersion).to.equal(1);
      expect(anchor.policyHash).to.equal(hashAtAnchor);

      // Later policy changes do NOT rewrite the recorded admission rule.
      await registry.setCompliancePolicy([], "", [], false, []);
      expect(await registry.policyVersion()).to.equal(2);
      const after = await registry.getAnchor(dacUnitId, sourceDataHash);
      expect(after.policyHash).to.equal(hashAtAnchor);
      expect(after.policyVersion).to.equal(1);
    });
  });

  // ============================================================
  // P0.5 — circuit breaker actually halts core mutations
  // ============================================================
  describe("P0.5 circuit breaker blocks every token movement", function () {
    let breaker: CircuitBreaker;
    let tokenId: bigint;

    beforeEach(async function () {
      const BreakerFactory = await ethers.getContractFactory("CircuitBreaker");
      breaker = (await upgrades.deployProxy(BreakerFactory, [owner.address], {
        initializer: "initialize",
      })) as unknown as CircuitBreaker;
      await breaker.waitForDeployment();

      tokenId = await mintedTokenId(mint());
      await carbonCredit.setCircuitBreaker(await breaker.getAddress());
    });

    it("global pause blocks mint, transfer, AND retirement; unpause restores", async function () {
      await breaker.activateGlobalPause("incident drill");

      const batch2 = ethers.keccak256(ethers.toUtf8Bytes("blocked_batch"));
      await expect(mint(batch2)).to.be.revertedWithCustomError(
        carbonCredit,
        "CircuitBreakerTripped",
      );
      await expect(
        carbonCredit
          .connect(buyer)
          .safeTransferFrom(buyer.address, stranger.address, tokenId, 1, "0x"),
      ).to.be.revertedWithCustomError(carbonCredit, "CircuitBreakerTripped");
      await expect(
        carbonCredit.connect(buyer).retireCredits(tokenId, 1, "blocked"),
      ).to.be.revertedWithCustomError(carbonCredit, "CircuitBreakerTripped");

      await breaker.deactivateGlobalPause();
      await expect(carbonCredit.connect(buyer).retireCredits(tokenId, 1, "ok")).to.emit(
        carbonCredit,
        "CreditRetired",
      );
    });

    it("per-contract pause on the token has the same effect", async function () {
      await breaker.pauseContract(await carbonCredit.getAddress(), "targeted");
      await expect(
        carbonCredit.connect(buyer).retireCredits(tokenId, 1, "blocked"),
      ).to.be.revertedWithCustomError(carbonCredit, "CircuitBreakerTripped");
    });
  });

  // ============================================================
  // P0.5c — role expiry enforcement in hasRoleAndKyc
  // ============================================================
  describe("P0.5c hasRoleAndKyc honors role expiry", function () {
    it("an expired role fails hasRoleAndKyc without an explicit revocation", async function () {
      const AccessFactory = await ethers.getContractFactory("TerraQuraAccessControl");
      const access = (await upgrades.deployProxy(AccessFactory, [owner.address], {
        initializer: "initialize",
      })) as unknown as TerraQuraAccessControl;
      await access.waitForDeployment();

      const OPERATOR_ROLE = await access.OPERATOR_ROLE();
      const COMPLIANCE_ROLE = await access.COMPLIANCE_ROLE();
      await access.grantRole(COMPLIANCE_ROLE, owner.address);

      const expiresAt = (await time.latest()) + 3600;
      await access.grantRoleWithExpiry(OPERATOR_ROLE, operator.address, expiresAt);
      await access.updateKycStatus(
        operator.address,
        2, // KycStatus.VERIFIED (NONE=0, PENDING=1, VERIFIED=2)
        "test-provider",
        ethers.keccak256(ethers.toUtf8Bytes("applicant")),
      );
      // isKycVerified additionally requires sanctions clearance.
      await access.updateSanctionsStatus(operator.address, true);

      expect(await access.hasRoleAndKyc(OPERATOR_ROLE, operator.address)).to.equal(true);

      // Warp past expiry: NO revocation transaction happens.
      await time.increaseTo(expiresAt + 1);
      expect(await access.hasValidRole(OPERATOR_ROLE, operator.address)).to.equal(false);
      expect(await access.hasRoleAndKyc(OPERATOR_ROLE, operator.address)).to.equal(false);
    });
  });

  // ============================================================
  // P0.6 — one KYC authority + settlement-time rechecks
  // ============================================================
  describe("P0.6 marketplace settlement rechecks", function () {
    const TOKEN_ID = 7001n;
    let marketplace: CarbonMarketplace;
    let mockCredit: MockERC1155;
    let kycRegistry: MockKycRegistry;
    let seller: SignerWithAddress;
    let purchaser: SignerWithAddress;

    beforeEach(async function () {
      seller = operator;
      purchaser = buyer;

      const MockFactory = await ethers.getContractFactory("MockERC1155");
      mockCredit = (await MockFactory.deploy()) as MockERC1155;
      await mockCredit.waitForDeployment();
      await mockCredit.mint(seller.address, TOKEN_ID, 1000n, "0x");

      const MarketplaceFactory = await ethers.getContractFactory("CarbonMarketplace");
      marketplace = (await upgrades.deployProxy(
        MarketplaceFactory,
        [await mockCredit.getAddress(), owner.address, 250, owner.address],
        { initializer: "initialize" },
      )) as unknown as CarbonMarketplace;
      await marketplace.waitForDeployment();

      await mockCredit.connect(seller).setApprovalForAll(await marketplace.getAddress(), true);

      const KycFactory = await ethers.getContractFactory("MockKycRegistry");
      kycRegistry = (await KycFactory.deploy()) as MockKycRegistry;
      await kycRegistry.waitForDeployment();

      await marketplace.setKycRequired(true);
      await marketplace.setKycRegistry(await kycRegistry.getAddress());
      await kycRegistry.setVerified(seller.address, true);
      await kycRegistry.setVerified(purchaser.address, true);
    });

    it("delegates KYC to the registry (single authority) when configured", async function () {
      // The DEPRECATED local mapping says "not verified" — the registry wins.
      expect(await marketplace.isKycVerified(seller.address)).to.equal(false);
      await expect(
        marketplace.connect(seller).createListing(TOKEN_ID, 100n, ethers.parseEther("1"), 0, 0),
      ).to.emit(marketplace, "ListingCreated");

      // Registry revocation is immediately authoritative.
      await kycRegistry.setVerified(seller.address, false);
      await expect(
        marketplace.connect(seller).createListing(TOKEN_ID, 100n, ethers.parseEther("1"), 0, 0),
      ).to.be.revertedWithCustomError(marketplace, "KycNotVerified");
    });

    it("purchase reverts when the SELLER's KYC was revoked after listing", async function () {
      await marketplace.connect(seller).createListing(TOKEN_ID, 100n, ethers.parseEther("1"), 0, 0);
      await kycRegistry.setVerified(seller.address, false);

      await expect(
        marketplace.connect(purchaser).purchase(1n, 10n, { value: ethers.parseEther("10") }),
      ).to.be.revertedWithCustomError(marketplace, "SellerNotKycVerified");
    });

    it("acceptOffer reverts when the BUYER's KYC was revoked after offering", async function () {
      // NOTE: for offers, duration 0 means "expires immediately" (expiresAt =
      // now + duration), unlike listings where 0 means "no expiry".
      await marketplace
        .connect(purchaser)
        .createOffer(TOKEN_ID, 10n, ethers.parseEther("1"), 3600, {
          value: ethers.parseEther("10"),
        });
      await kycRegistry.setVerified(purchaser.address, false);

      await expect(
        marketplace.connect(seller).acceptOffer(1n),
      ).to.be.revertedWithCustomError(marketplace, "BuyerNotKycVerified");
    });

    it("listing and settlement reject credits that are no longer active", async function () {
      // Inactive credit cannot be listed.
      await mockCredit.setCreditActive(TOKEN_ID, false);
      await expect(
        marketplace.connect(seller).createListing(TOKEN_ID, 100n, ethers.parseEther("1"), 0, 0),
      ).to.be.revertedWithCustomError(marketplace, "CreditNotActive");

      // A credit suspended AFTER listing cannot settle.
      await mockCredit.setCreditActive(TOKEN_ID, true);
      await marketplace.connect(seller).createListing(TOKEN_ID, 100n, ethers.parseEther("1"), 0, 0);
      await mockCredit.setCreditActive(TOKEN_ID, false);
      await expect(
        marketplace.connect(purchaser).purchase(1n, 10n, { value: ethers.parseEther("10") }),
      ).to.be.revertedWithCustomError(marketplace, "CreditNotActive");
    });
  });
});
