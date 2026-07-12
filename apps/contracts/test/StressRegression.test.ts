import { expect } from "chai";
import { ethers, network, upgrades } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import {
  CarbonCredit,
  CarbonMarketplace,
  CircuitBreaker,
  MockERC1155,
  MockISeal,
  SealProofOfPhysics,
  VerificationEngine,
} from "../typechain-types";

/**
 * Stress / volume regression — pre-testnet-integration confidence run.
 *
 * Exercises the P0-hardened paths under load rather than in isolation:
 *   - high-volume minting with per-batch supply accounting
 *   - multi-holder retirement storms (supply-derived isRetired under churn)
 *   - max-size batch retirement (100 items)
 *   - marketplace churn: many listings, partial purchases, cancels, offers
 *   - circuit-breaker saturation and recovery while trades are in flight
 *   - seal revocation sweeps across a live minted population
 *
 * Gas figures for the hot paths are logged so the testnet team can compare
 * on-chain numbers against local expectations.
 */
describe("Stress regression (pre-testnet integration)", function () {
  const SEAL_PRECOMPILE = "0x0000000000000000000000000000000000000900";

  let carbonCredit: CarbonCredit;
  let verificationEngine: VerificationEngine;
  let registry: SealProofOfPhysics;
  let seal: MockISeal;
  let owner: SignerWithAddress;
  let operator: SignerWithAddress;
  let holders: SignerWithAddress[];

  const dacUnitId = ethers.keccak256(ethers.toUtf8Bytes("DAC_STRESS_01"));
  const captureTimestamp = 1767225600; // 2026-01-01
  const co2AmountKg = 100000;
  const energyConsumedKwh = 35000;

  const gasLog: Array<{ op: string; gas: bigint }> = [];

  function batchHash(i: number): string {
    return ethers.keccak256(ethers.toUtf8Bytes(`stress_batch_${i}`));
  }

  function mintTo(to: string, batch: string) {
    return carbonCredit
      .connect(operator)
      .mintVerifiedCredits(
        to,
        dacUnitId,
        batch,
        captureTimestamp,
        co2AmountKg,
        energyConsumedKwh,
        24453884,
        54377344,
        98,
        50,
        "ipfs://QmStress",
        "arweave_stress",
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
    const signers = await ethers.getSigners();
    [owner, operator] = signers;
    holders = signers.slice(2, 12); // 10 distinct holders

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

  after(function () {
    if (gasLog.length > 0) {
      console.log("\n      Gas snapshot (hot paths):");
      for (const { op, gas } of gasLog) {
        console.log(`        ${op}: ${gas.toString()}`);
      }
    }
  });

  describe("high-volume minting", function () {
    it("mints 50 distinct batches with exact aggregate supply accounting", async function () {
      this.timeout(120000);
      const before = await carbonCredit.totalCreditsMinted();
      let expectedTotal = 0n;

      for (let i = 0; i < 50; i++) {
        const tx = await mintTo(holders[i % holders.length].address, batchHash(i));
        const receipt = await tx.wait();
        if (i === 0) gasLog.push({ op: "mintVerifiedCredits (no seal gate)", gas: receipt!.gasUsed });
        const evt = receipt!.logs
          .map((l: any) => {
            try {
              return carbonCredit.interface.parseLog(l);
            } catch {
              return null;
            }
          })
          .find((e: any) => e && e.name === "CreditMinted");
        const tokenId = evt!.args[0] as bigint;
        const supply = await carbonCredit.totalSupply(tokenId);
        expect(supply).to.be.gt(0n);
        expectedTotal += supply;
      }

      expect((await carbonCredit.totalCreditsMinted()) - before).to.equal(expectedTotal);

      // Replay guard holds across the whole population
      await expect(mintTo(holders[0].address, batchHash(7))).to.be.revertedWithCustomError(
        carbonCredit,
        "DataHashAlreadyUsed",
      );
    });
  });

  describe("multi-holder retirement storm", function () {
    it("10 holders churn one batch; isRetired flips only at zero supply", async function () {
      this.timeout(120000);
      const tokenId = await mintedTokenId(mintTo(holders[0].address, batchHash(100)));
      const supply = await carbonCredit.totalSupply(tokenId);

      // Spray the batch across all 10 holders
      const share = supply / 10n;
      for (let i = 1; i < 10; i++) {
        await carbonCredit
          .connect(holders[0])
          .safeTransferFrom(holders[0].address, holders[i].address, tokenId, share, "0x");
      }

      // Everyone retires HALF their balance; batch must remain active throughout
      for (const h of holders) {
        const bal = await carbonCredit.balanceOf(h.address, tokenId);
        if (bal > 1n) {
          await carbonCredit.connect(h).retireCredits(tokenId, bal / 2n, "half");
        }
        const [meta] = await carbonCredit.getCreditProvenance(tokenId);
        expect(meta.isRetired).to.equal(false);
      }

      // Everyone retires the rest; only after the LAST burn does the flag flip
      for (let i = 0; i < holders.length; i++) {
        const bal = await carbonCredit.balanceOf(holders[i].address, tokenId);
        if (bal > 0n) {
          const tx = await carbonCredit.connect(holders[i]).retireCredits(tokenId, bal, "rest");
          if (i === 0) gasLog.push({ op: "retireCredits", gas: (await tx.wait())!.gasUsed });
        }
      }

      expect(await carbonCredit.totalSupply(tokenId)).to.equal(0n);
      const [meta] = await carbonCredit.getCreditProvenance(tokenId);
      expect(meta.isRetired).to.equal(true);
      expect(await carbonCredit.isCreditActive(tokenId)).to.equal(false);
    });

    it("handles a max-size (100-item) batch retirement atomically", async function () {
      this.timeout(300000);
      const tokenIds: bigint[] = [];
      for (let i = 0; i < 100; i++) {
        tokenIds.push(await mintedTokenId(mintTo(holders[0].address, batchHash(200 + i))));
      }
      const amounts = tokenIds.map(() => 10n);

      const tx = await carbonCredit
        .connect(holders[0])
        .batchRetireCredits(tokenIds, amounts, "bulk offset");
      gasLog.push({ op: "batchRetireCredits x100", gas: (await tx.wait())!.gasUsed });

      // One bad item reverts the WHOLE batch (zero-amount invariant under load)
      await expect(
        carbonCredit
          .connect(holders[0])
          .batchRetireCredits(tokenIds.slice(0, 10), [10n, 10n, 10n, 10n, 0n, 10n, 10n, 10n, 10n, 10n], "bad"),
      ).to.be.revertedWithCustomError(carbonCredit, "InvalidRetirementAmount");
    });
  });

  describe("marketplace churn", function () {
    const TOKEN = 9001n;
    let marketplace: CarbonMarketplace;
    let mockCredit: MockERC1155;
    let seller: SignerWithAddress;

    beforeEach(async function () {
      seller = holders[0];
      const MockFactory = await ethers.getContractFactory("MockERC1155");
      mockCredit = (await MockFactory.deploy()) as MockERC1155;
      await mockCredit.waitForDeployment();
      await mockCredit.mint(seller.address, TOKEN, 1000000n, "0x");

      const MarketplaceFactory = await ethers.getContractFactory("CarbonMarketplace");
      marketplace = (await upgrades.deployProxy(
        MarketplaceFactory,
        [await mockCredit.getAddress(), owner.address, 250, owner.address],
        { initializer: "initialize" },
      )) as unknown as CarbonMarketplace;
      await marketplace.waitForDeployment();
      await mockCredit.connect(seller).setApprovalForAll(await marketplace.getAddress(), true);
    });

    it("survives 40 listings with interleaved purchases and cancels; escrow nets to zero", async function () {
      this.timeout(300000);
      const price = ethers.parseEther("0.001");
      const listingIds: bigint[] = [];

      for (let i = 0; i < 40; i++) {
        const tx = await marketplace.connect(seller).createListing(TOKEN, 100n, price, 0, 0);
        if (i === 0) gasLog.push({ op: "createListing", gas: (await tx.wait())!.gasUsed });
        listingIds.push(BigInt(i + 1));
      }

      // Buyers sweep half of each even listing, all of each odd listing
      for (let i = 0; i < 40; i++) {
        const buyer = holders[(i % 8) + 1];
        const amount = i % 2 === 0 ? 50n : 100n;
        const tx = await marketplace
          .connect(buyer)
          .purchase(listingIds[i], amount, { value: price * amount });
        if (i === 0) gasLog.push({ op: "purchase", gas: (await tx.wait())!.gasUsed });
      }

      // Cancel every remaining even listing (returns escrow)
      for (let i = 0; i < 40; i += 2) {
        await marketplace.connect(seller).cancelListing(listingIds[i]);
      }

      // Escrow accounting: marketplace must hold exactly zero after full unwind
      expect(await mockCredit.balanceOf(await marketplace.getAddress(), TOKEN)).to.equal(0n);

      // Supply conservation across the churn (seller IS holders[0], so
      // summing over holders covers every party exactly once)
      let total = 0n;
      for (const h of holders) {
        total += await mockCredit.balanceOf(h.address, TOKEN);
      }
      expect(total).to.equal(1000000n);
    });

    it("processes an offer create/accept/reject storm without stuck deposits", async function () {
      this.timeout(300000);
      const price = ethers.parseEther("0.001");
      const mpAddr = await marketplace.getAddress();

      // 20 offers from rotating buyers
      for (let i = 0; i < 20; i++) {
        const buyer = holders[(i % 8) + 1];
        await marketplace
          .connect(buyer)
          .createOffer(TOKEN, 10n, price, 3600, { value: price * 10n });
      }

      // Seller accepts even offers, rejects odd ones
      for (let i = 1; i <= 20; i++) {
        if (i % 2 === 0) {
          await marketplace.connect(seller).acceptOffer(BigInt(i));
        } else {
          await marketplace.connect(seller).rejectOffer(BigInt(i));
        }
      }

      // No ETH stuck: every deposit either paid the seller or was refunded
      expect(await ethers.provider.getBalance(mpAddr)).to.equal(0n);
    });
  });

  describe("circuit breaker under load", function () {
    it("halts an in-flight population and recovers cleanly", async function () {
      this.timeout(300000);
      const BreakerFactory = await ethers.getContractFactory("CircuitBreaker");
      const breaker = (await upgrades.deployProxy(BreakerFactory, [owner.address], {
        initializer: "initialize",
      })) as unknown as CircuitBreaker;
      await breaker.waitForDeployment();

      // Mint 10 live batches, then wire the breaker
      const tokenIds: bigint[] = [];
      for (let i = 0; i < 10; i++) {
        tokenIds.push(await mintedTokenId(mintTo(holders[i].address, batchHash(300 + i))));
      }
      await carbonCredit.setCircuitBreaker(await breaker.getAddress());

      await breaker.activateGlobalPause("stress drill");
      // EVERY holder's every operation must fail while paused
      for (let i = 0; i < 10; i++) {
        await expect(
          carbonCredit.connect(holders[i]).retireCredits(tokenIds[i], 1n, "blocked"),
        ).to.be.revertedWithCustomError(carbonCredit, "CircuitBreakerTripped");
        await expect(
          carbonCredit
            .connect(holders[i])
            .safeTransferFrom(holders[i].address, owner.address, tokenIds[i], 1n, "0x"),
        ).to.be.revertedWithCustomError(carbonCredit, "CircuitBreakerTripped");
      }
      await expect(mintTo(owner.address, batchHash(399))).to.be.revertedWithCustomError(
        carbonCredit,
        "CircuitBreakerTripped",
      );

      // Recovery: everything works again, no residual state damage
      await breaker.deactivateGlobalPause();
      for (let i = 0; i < 10; i++) {
        await expect(
          carbonCredit.connect(holders[i]).retireCredits(tokenIds[i], 1n, "ok"),
        ).to.emit(carbonCredit, "CreditRetired");
      }
    });

    it("saturates the self-reported rate limit exactly at the boundary", async function () {
      this.timeout(300000);
      const BreakerFactory = await ethers.getContractFactory("CircuitBreaker");
      const breaker = (await upgrades.deployProxy(BreakerFactory, [owner.address], {
        initializer: "initialize",
      })) as unknown as CircuitBreaker;
      await breaker.waitForDeployment();

      const consumer = holders[5];
      await breaker.registerContract(consumer.address);
      await breaker.setRateLimit(consumer.address, 100);

      // Exactly 100 allowed…
      for (let i = 0; i < 100; i++) {
        await breaker.connect(consumer).checkRateLimit(consumer.address);
      }
      // …the 101st is rejected
      const allowed = await breaker.connect(consumer).checkRateLimit.staticCall(consumer.address);
      expect(allowed).to.equal(false);
    });
  });

  describe("seal revocation sweep across a live population", function () {
    it("mints 20 seal-anchored batches, revokes half, and only those suspend", async function () {
      this.timeout(300000);
      await carbonCredit.setSealRegistry(await registry.getAddress());
      await carbonCredit.setSealAnchorRequired(true);

      const tokenIds: bigint[] = [];
      for (let i = 0; i < 20; i++) {
        const batch = batchHash(400 + i);
        const job = `job-stress-${i}`;
        const sealId = i.toString(16).padStart(2, "0").repeat(32);
        await seal.setSeal(job, sealId, `terraqura:${dacUnitId}:${batch}`, true);
        await registry.anchor(dacUnitId, batch, job);
        const tx = mintTo(holders[i % holders.length].address, batch);
        tokenIds.push(await mintedTokenId(tx));
      }

      // Revoke the even-indexed anchors via local governance
      for (let i = 0; i < 20; i += 2) {
        await registry.revoke(dacUnitId, batchHash(400 + i));
      }

      for (let i = 0; i < 20; i++) {
        const active = await carbonCredit.isCreditActive(tokenIds[i]);
        expect(active).to.equal(i % 2 !== 0, `token ${i} active=${active}`);
      }

      // Suspended batches cannot be retired; live ones can
      const holder1 = holders[0 % holders.length];
      await expect(
        carbonCredit.connect(holder1).retireCredits(tokenIds[0], 1n, "suspended"),
      ).to.be.revertedWithCustomError(carbonCredit, "CreditSuspended");
      await expect(
        carbonCredit
          .connect(holders[1 % holders.length])
          .retireCredits(tokenIds[1], 1n, "live"),
      ).to.emit(carbonCredit, "CreditRetired");
    });
  });
});
