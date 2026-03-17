import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { FractionalCredit, TerraQuraAccessControl, MockERC1155 } from "../typechain-types";

describe("FractionalCredit", function () {
  const CREDIT_ID = 123;
  const WRAP_RATIO = BigInt(1e18);

  async function deployFixture() {
    const [owner, alice, bob, unauthorized] = await ethers.getSigners();

    // Deploy AccessControl
    const ACFactory = await ethers.getContractFactory("TerraQuraAccessControl");
    const accessControl = (await upgrades.deployProxy(ACFactory, [owner.address], {
      initializer: "initialize",
    })) as unknown as TerraQuraAccessControl;
    await accessControl.waitForDeployment();

    // Deploy MockERC1155
    const MockFactory = await ethers.getContractFactory("MockERC1155");
    const mockCredit = (await MockFactory.deploy()) as unknown as MockERC1155;
    await mockCredit.waitForDeployment();

    // Mint credits to alice and bob
    await mockCredit.mint(alice.address, CREDIT_ID, 10_000n, "0x");
    await mockCredit.mint(bob.address, CREDIT_ID, 5_000n, "0x");

    // Deploy FractionalCredit
    const FCFactory = await ethers.getContractFactory("FractionalCredit");
    const fractional = (await upgrades.deployProxy(
      FCFactory,
      [await accessControl.getAddress(), await mockCredit.getAddress(), CREDIT_ID],
      { initializer: "initialize" }
    )) as unknown as FractionalCredit;
    await fractional.waitForDeployment();

    // Approve fractional contract
    const fcAddr = await fractional.getAddress();
    await mockCredit.connect(alice).setApprovalForAll(fcAddr, true);
    await mockCredit.connect(bob).setApprovalForAll(fcAddr, true);

    return { fractional, accessControl, mockCredit, owner, alice, bob, unauthorized };
  }

  async function fixtureWithWrapped() {
    const base = await loadFixture(deployFixture);
    await base.fractional.connect(base.alice).wrap(CREDIT_ID, 100n);
    return base;
  }

  // ==========================================
  // INITIALIZATION
  // ==========================================

  describe("Initialization", function () {
    it("should have correct name", async function () {
      const { fractional } = await loadFixture(deployFixture);
      expect(await fractional.name()).to.equal("Wrapped TerraQura Credit #123");
    });

    it("should have correct symbol", async function () {
      const { fractional } = await loadFixture(deployFixture);
      expect(await fractional.symbol()).to.equal("wTQC-123");
    });

    it("should have correct wrapped credit ID", async function () {
      const { fractional } = await loadFixture(deployFixture);
      expect(await fractional.getWrappedCreditId()).to.equal(CREDIT_ID);
    });

    it("should start with zero total wrapped", async function () {
      const { fractional } = await loadFixture(deployFixture);
      expect(await fractional.totalWrapped()).to.equal(0);
    });
  });

  // ==========================================
  // WRAPPING
  // ==========================================

  describe("Wrap", function () {
    it("should wrap credits and receive ERC-20 tokens", async function () {
      const { fractional, alice, mockCredit } = await loadFixture(deployFixture);
      const amount = 50n;

      const creditsBefore = await mockCredit.balanceOf(alice.address, CREDIT_ID);

      await expect(fractional.connect(alice).wrap(CREDIT_ID, amount))
        .to.emit(fractional, "Wrapped")
        .withArgs(alice.address, CREDIT_ID, amount, amount * WRAP_RATIO);

      const creditsAfter = await mockCredit.balanceOf(alice.address, CREDIT_ID);
      expect(creditsBefore - creditsAfter).to.equal(amount);

      const erc20Balance = await fractional.balanceOf(alice.address);
      expect(erc20Balance).to.equal(amount * WRAP_RATIO);
    });

    it("should use 1:1e18 ratio (fractional precision)", async function () {
      const { fractional, alice } = await loadFixture(deployFixture);
      await fractional.connect(alice).wrap(CREDIT_ID, 1n);
      expect(await fractional.balanceOf(alice.address)).to.equal(WRAP_RATIO);
    });

    it("should update totalWrapped", async function () {
      const { fractional, alice } = await loadFixture(deployFixture);
      await fractional.connect(alice).wrap(CREDIT_ID, 100n);
      expect(await fractional.totalWrapped()).to.equal(100n);
    });

    it("should revert wrapping zero amount", async function () {
      const { fractional, alice } = await loadFixture(deployFixture);
      await expect(fractional.connect(alice).wrap(CREDIT_ID, 0))
        .to.be.revertedWithCustomError(fractional, "ZeroAmount");
    });

    it("should revert wrapping wrong credit ID", async function () {
      const { fractional, alice } = await loadFixture(deployFixture);
      await expect(fractional.connect(alice).wrap(999, 10n))
        .to.be.revertedWithCustomError(fractional, "ZeroAmount");
    });

    it("should allow multiple users to wrap", async function () {
      const { fractional, alice, bob } = await loadFixture(deployFixture);
      await fractional.connect(alice).wrap(CREDIT_ID, 100n);
      await fractional.connect(bob).wrap(CREDIT_ID, 50n);

      expect(await fractional.totalWrapped()).to.equal(150n);
      expect(await fractional.balanceOf(alice.address)).to.equal(100n * WRAP_RATIO);
      expect(await fractional.balanceOf(bob.address)).to.equal(50n * WRAP_RATIO);
    });
  });

  // ==========================================
  // UNWRAPPING
  // ==========================================

  describe("Unwrap", function () {
    it("should unwrap ERC-20 tokens and receive credits", async function () {
      const { fractional, alice, mockCredit } = await loadFixture(fixtureWithWrapped);

      const erc20Amount = 50n * WRAP_RATIO;

      await expect(fractional.connect(alice).unwrap(erc20Amount))
        .to.emit(fractional, "Unwrapped")
        .withArgs(alice.address, CREDIT_ID, 50n, erc20Amount);

      expect(await fractional.balanceOf(alice.address)).to.equal(50n * WRAP_RATIO);
      expect(await fractional.totalWrapped()).to.equal(50n);
    });

    it("should not unwrap more than wrapped total", async function () {
      const { fractional, alice } = await loadFixture(fixtureWithWrapped);
      const tooMuch = 200n * WRAP_RATIO; // only 100 wrapped
      await expect(fractional.connect(alice).unwrap(tooMuch))
        .to.be.reverted; // ERC20 burn will fail on balance check
    });

    it("should revert unwrapping zero", async function () {
      const { fractional, alice } = await loadFixture(fixtureWithWrapped);
      await expect(fractional.connect(alice).unwrap(0))
        .to.be.revertedWithCustomError(fractional, "ZeroAmount");
    });

    it("should revert unwrapping non-whole-credit amounts", async function () {
      const { fractional, alice } = await loadFixture(fixtureWithWrapped);
      // Try to unwrap 0.5 credits worth of ERC-20
      const halfCredit = WRAP_RATIO / 2n;
      await expect(fractional.connect(alice).unwrap(halfCredit))
        .to.be.revertedWithCustomError(fractional, "MustUnwrapWholeCredits");
    });

    it("should unwrap all and return to zero", async function () {
      const { fractional, alice } = await loadFixture(fixtureWithWrapped);
      await fractional.connect(alice).unwrap(100n * WRAP_RATIO);
      expect(await fractional.totalWrapped()).to.equal(0);
      expect(await fractional.balanceOf(alice.address)).to.equal(0);
    });
  });

  // ==========================================
  // ERC-20 FUNCTIONALITY
  // ==========================================

  describe("ERC-20 Transfer", function () {
    it("should transfer wrapped tokens between users", async function () {
      const { fractional, alice, bob } = await loadFixture(fixtureWithWrapped);
      const transferAmount = 25n * WRAP_RATIO;

      await fractional.connect(alice).transfer(bob.address, transferAmount);

      expect(await fractional.balanceOf(alice.address)).to.equal(75n * WRAP_RATIO);
      expect(await fractional.balanceOf(bob.address)).to.equal(transferAmount);
    });

    it("should support approve and transferFrom", async function () {
      const { fractional, alice, bob } = await loadFixture(fixtureWithWrapped);
      const amount = 10n * WRAP_RATIO;

      await fractional.connect(alice).approve(bob.address, amount);
      await fractional.connect(bob).transferFrom(alice.address, bob.address, amount);

      expect(await fractional.balanceOf(bob.address)).to.equal(amount);
    });

    it("should have 18 decimals", async function () {
      const { fractional } = await loadFixture(deployFixture);
      expect(await fractional.decimals()).to.equal(18);
    });

    it("should track total supply correctly", async function () {
      const { fractional, alice, bob } = await loadFixture(deployFixture);
      await fractional.connect(alice).wrap(CREDIT_ID, 100n);
      await fractional.connect(bob).wrap(CREDIT_ID, 50n);

      expect(await fractional.totalSupply()).to.equal(150n * WRAP_RATIO);

      await fractional.connect(alice).unwrap(30n * WRAP_RATIO);
      expect(await fractional.totalSupply()).to.equal(120n * WRAP_RATIO);
    });
  });

  // ==========================================
  // EDGE CASES
  // ==========================================

  describe("Edge Cases", function () {
    it("should handle wrap-transfer-unwrap by different user", async function () {
      const { fractional, alice, bob, mockCredit } = await loadFixture(fixtureWithWrapped);

      // Alice transfers to Bob
      await fractional.connect(alice).transfer(bob.address, 50n * WRAP_RATIO);

      // Bob unwraps
      const creditsBefore = await mockCredit.balanceOf(bob.address, CREDIT_ID);
      await fractional.connect(bob).unwrap(50n * WRAP_RATIO);
      const creditsAfter = await mockCredit.balanceOf(bob.address, CREDIT_ID);

      expect(creditsAfter - creditsBefore).to.equal(50n);
    });
  });
});
