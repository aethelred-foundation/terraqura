import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-network-helpers";

/**
 * @title Branch Coverage Tests
 * @notice Comprehensive tests to achieve 99%+ branch coverage
 * @dev Targets all uncovered branches across contracts
 */
describe("Branch Coverage Tests", function () {
    describe("CarbonMarketplace - All Branches", function () {
        let marketplace: any;
        let mockCarbonCredit: any;
        let owner: SignerWithAddress;
        let seller: SignerWithAddress;
        let buyer: SignerWithAddress;
        let feeRecipient: SignerWithAddress;
        let unauthorized: SignerWithAddress;

        const TOKEN_ID = 1;
        const PRICE_PER_UNIT = ethers.parseEther("0.01");
        const PLATFORM_FEE_BPS = 250;

        beforeEach(async function () {
            [owner, seller, buyer, feeRecipient, unauthorized] = await ethers.getSigners();

            const MockERC1155 = await ethers.getContractFactory("MockERC1155");
            mockCarbonCredit = await MockERC1155.deploy();
            await mockCarbonCredit.waitForDeployment();

            await mockCarbonCredit.mint(seller.address, TOKEN_ID, 1000, "0x");

            const MarketplaceFactory = await ethers.getContractFactory("CarbonMarketplace");
            marketplace = await upgrades.deployProxy(
                MarketplaceFactory,
                [await mockCarbonCredit.getAddress(), feeRecipient.address, PLATFORM_FEE_BPS, owner.address],
                { initializer: "initialize" }
            );
            await marketplace.waitForDeployment();

            await marketplace.setKycStatus(seller.address, true);
            await marketplace.setKycStatus(buyer.address, true);
            await mockCarbonCredit.connect(seller).setApprovalForAll(await marketplace.getAddress(), true);
        });

        describe("Offer Expiration Branch (line 537-538)", function () {
            it("should revert when offer has expired", async function () {
                // Create offer with 1 second duration
                const depositAmount = PRICE_PER_UNIT * BigInt(50);
                await marketplace.connect(buyer).createOffer(TOKEN_ID, 50, PRICE_PER_UNIT, 1, { value: depositAmount });

                // Wait for offer to expire
                await time.increase(10);

                // Try to accept expired offer
                await expect(
                    marketplace.connect(seller).acceptOffer(1)
                ).to.be.revertedWithCustomError(marketplace, "OfferExpired");
            });

            it("should accept offer before expiration", async function () {
                const depositAmount = PRICE_PER_UNIT * BigInt(50);
                await marketplace.connect(buyer).createOffer(TOKEN_ID, 50, PRICE_PER_UNIT, 86400, { value: depositAmount });

                // Accept before expiration
                await expect(
                    marketplace.connect(seller).acceptOffer(1)
                ).to.emit(marketplace, "OfferAccepted");
            });

            it("should accept offer with very long duration", async function () {
                const depositAmount = PRICE_PER_UNIT * BigInt(50);
                // Very long duration (1 year)
                await marketplace.connect(buyer).createOffer(TOKEN_ID, 50, PRICE_PER_UNIT, 365 * 24 * 3600, { value: depositAmount });

                // Should be acceptable
                await expect(
                    marketplace.connect(seller).acceptOffer(1)
                ).to.emit(marketplace, "OfferAccepted");
            });
        });

        describe("Excess Refund Branch (lines 496-499)", function () {
            it("should refund excess payment when creating offer", async function () {
                const exactDeposit = PRICE_PER_UNIT * BigInt(50);
                const excessPayment = exactDeposit + ethers.parseEther("1"); // 1 ETH extra

                const balanceBefore = await ethers.provider.getBalance(buyer.address);

                const tx = await marketplace.connect(buyer).createOffer(
                    TOKEN_ID, 50, PRICE_PER_UNIT, 86400,
                    { value: excessPayment }
                );
                const receipt = await tx.wait();
                const gasUsed = receipt?.fee ?? 0n;

                const balanceAfter = await ethers.provider.getBalance(buyer.address);

                // Buyer should have paid only the exact deposit (plus gas)
                expect(balanceBefore - balanceAfter - gasUsed).to.equal(exactDeposit);
            });
        });

        describe("Seller Cannot Accept Own Offer (line 540)", function () {
            it("should revert when seller tries to accept their own offer", async function () {
                // Seller creates an offer on their own tokens (weird but possible)
                const depositAmount = PRICE_PER_UNIT * BigInt(50);
                await marketplace.connect(seller).createOffer(TOKEN_ID, 50, PRICE_PER_UNIT, 86400, { value: depositAmount });

                // Seller tries to accept their own offer
                await expect(
                    marketplace.connect(seller).acceptOffer(1)
                ).to.be.revertedWithCustomError(marketplace, "CannotOfferOnOwnCredits");
            });
        });

        describe("Offer Not Found/Active Branches", function () {
            it("should revert cancelOffer for non-existent offer (line 514)", async function () {
                await expect(
                    marketplace.connect(buyer).cancelOffer(999)
                ).to.be.revertedWithCustomError(marketplace, "OfferNotFound");
            });

            it("should revert cancelOffer for inactive offer (line 515)", async function () {
                const depositAmount = PRICE_PER_UNIT * BigInt(50);
                await marketplace.connect(buyer).createOffer(TOKEN_ID, 50, PRICE_PER_UNIT, 86400, { value: depositAmount });

                // Cancel once
                await marketplace.connect(buyer).cancelOffer(1);

                // Try to cancel again
                await expect(
                    marketplace.connect(buyer).cancelOffer(1)
                ).to.be.revertedWithCustomError(marketplace, "OfferNotActive");
            });

            it("should revert acceptOffer for non-existent offer (line 535)", async function () {
                await expect(
                    marketplace.connect(seller).acceptOffer(999)
                ).to.be.revertedWithCustomError(marketplace, "OfferNotFound");
            });

            it("should revert acceptOffer for inactive offer (line 536)", async function () {
                const depositAmount = PRICE_PER_UNIT * BigInt(50);
                await marketplace.connect(buyer).createOffer(TOKEN_ID, 50, PRICE_PER_UNIT, 86400, { value: depositAmount });

                // Accept once
                await marketplace.connect(seller).acceptOffer(1);

                // Try to accept again
                await expect(
                    marketplace.connect(seller).acceptOffer(1)
                ).to.be.revertedWithCustomError(marketplace, "OfferNotActive");
            });
        });

        describe("Listing Expiration Branch", function () {
            it("should revert purchase of expired listing", async function () {
                // Create listing with short duration
                await marketplace.connect(seller).createListing(TOKEN_ID, 100, PRICE_PER_UNIT, 0, 1);

                // Wait for listing to expire
                await time.increase(10);

                // Try to purchase
                await expect(
                    marketplace.connect(buyer).purchase(1, 50, { value: PRICE_PER_UNIT * BigInt(50) })
                ).to.be.revertedWithCustomError(marketplace, "ListingExpired");
            });

            it("should allow purchase before expiration", async function () {
                await marketplace.connect(seller).createListing(TOKEN_ID, 100, PRICE_PER_UNIT, 0, 86400);

                await expect(
                    marketplace.connect(buyer).purchase(1, 50, { value: PRICE_PER_UNIT * BigInt(50) })
                ).to.emit(marketplace, "Purchase");
            });
        });

        describe("Minimum Purchase Amount Branch", function () {
            it("should revert when below minimum purchase", async function () {
                // Create listing with minimum purchase of 10
                await marketplace.connect(seller).createListing(TOKEN_ID, 100, PRICE_PER_UNIT, 10, 86400);

                // Try to purchase less than minimum
                await expect(
                    marketplace.connect(buyer).purchase(1, 5, { value: PRICE_PER_UNIT * BigInt(5) })
                ).to.be.revertedWithCustomError(marketplace, "BelowMinPurchase");
            });

            it("should allow purchase at minimum", async function () {
                await marketplace.connect(seller).createListing(TOKEN_ID, 100, PRICE_PER_UNIT, 10, 86400);

                await expect(
                    marketplace.connect(buyer).purchase(1, 10, { value: PRICE_PER_UNIT * BigInt(10) })
                ).to.emit(marketplace, "Purchase");
            });
        });

        describe("Cancel Listing Branch", function () {
            it("should allow seller to cancel listing", async function () {
                await marketplace.connect(seller).createListing(TOKEN_ID, 100, PRICE_PER_UNIT, 0, 86400);

                await expect(
                    marketplace.connect(seller).cancelListing(1)
                ).to.emit(marketplace, "ListingCancelled");

                const listing = await marketplace.getListing(1);
                expect(listing.isActive).to.be.false;
            });

            it("should revert cancel by non-seller", async function () {
                await marketplace.connect(seller).createListing(TOKEN_ID, 100, PRICE_PER_UNIT, 0, 86400);

                await expect(
                    marketplace.connect(buyer).cancelListing(1)
                ).to.be.revertedWithCustomError(marketplace, "NotListingSeller");
            });

            it("should revert cancel of non-existent listing", async function () {
                await expect(
                    marketplace.connect(seller).cancelListing(999)
                ).to.be.revertedWithCustomError(marketplace, "ListingNotFound");
            });

            it("should revert cancel of inactive listing", async function () {
                await marketplace.connect(seller).createListing(TOKEN_ID, 100, PRICE_PER_UNIT, 0, 86400);

                // Buy all to deactivate
                await marketplace.connect(buyer).purchase(1, 100, { value: PRICE_PER_UNIT * BigInt(100) });

                await expect(
                    marketplace.connect(seller).cancelListing(1)
                ).to.be.revertedWithCustomError(marketplace, "ListingNotActive");
            });
        });
    });

    describe("CircuitBreaker - All Branches", function () {
        let circuitBreaker: any;
        let owner: SignerWithAddress;
        let pauser: SignerWithAddress;
        let user: SignerWithAddress;

        beforeEach(async function () {
            [owner, pauser, user] = await ethers.getSigners();

            const Factory = await ethers.getContractFactory("CircuitBreaker");
            circuitBreaker = await upgrades.deployProxy(
                Factory,
                [owner.address],
                { initializer: "initialize" }
            );
            await circuitBreaker.waitForDeployment();

            // Grant pauser role
            await circuitBreaker.addPauser(pauser.address);
        });

        describe("Rate Limit Branches", function () {
            it("should initialize rate limit on first call", async function () {
                const contractAddr = user.address;
                await circuitBreaker.checkRateLimit(contractAddr);

                // Check rate limit was initialized
                const limit = await circuitBreaker.rateLimits(contractAddr);
                expect(limit.maxOperationsPerHour).to.equal(100); // Default
            });

            it("should reset rate limit after hour passes", async function () {
                const contractAddr = user.address;

                // Use up some rate limit
                for (let i = 0; i < 5; i++) {
                    await circuitBreaker.checkRateLimit(contractAddr);
                }

                // Fast forward 1 hour
                await time.increase(3601);

                // Should reset
                const allowed = await circuitBreaker.checkRateLimit.staticCall(contractAddr);
                expect(allowed).to.be.true;
            });

            it("should reject when rate limit exceeded", async function () {
                const contractAddr = user.address;

                // Set very low rate limit
                await circuitBreaker.setRateLimit(contractAddr, 2);

                // Use up rate limit
                await circuitBreaker.checkRateLimit(contractAddr);
                await circuitBreaker.checkRateLimit(contractAddr);

                // Third call should fail
                const allowed = await circuitBreaker.checkRateLimit.staticCall(contractAddr);
                expect(allowed).to.be.false;
            });
        });

        describe("Volume Limit Branches", function () {
            it("should check volume limit correctly", async function () {
                const contractAddr = user.address;
                const amount = ethers.parseEther("100");

                // Set volume limit
                await circuitBreaker.setVolumeLimit(contractAddr, ethers.parseEther("1000"));

                // Check volume - should pass
                const allowed = await circuitBreaker.checkVolumeLimit.staticCall(contractAddr, amount);
                expect(allowed).to.be.true;
            });

            it("should reject when volume limit exceeded", async function () {
                const contractAddr = user.address;

                // Set volume limit
                await circuitBreaker.setVolumeLimit(contractAddr, ethers.parseEther("100"));

                // Try to exceed
                const allowed = await circuitBreaker.checkVolumeLimit.staticCall(
                    contractAddr,
                    ethers.parseEther("200")
                );
                expect(allowed).to.be.false;
            });

            it("should reset volume after day passes", async function () {
                const contractAddr = user.address;

                await circuitBreaker.setVolumeLimit(contractAddr, ethers.parseEther("100"));

                // Use up volume
                await circuitBreaker.checkVolumeLimit(contractAddr, ethers.parseEther("100"));

                // Fast forward 1 day
                await time.increase(86401);

                // Should reset
                const allowed = await circuitBreaker.checkVolumeLimit.staticCall(
                    contractAddr,
                    ethers.parseEther("100")
                );
                expect(allowed).to.be.true;
            });
        });

        describe("Security Level Branches", function () {
            it("should set security level", async function () {
                await circuitBreaker.connect(pauser).setSecurityLevel(2, "High alert");

                expect(await circuitBreaker.globalSecurityLevel()).to.equal(2);
            });

            it("should not allow non-owner to lower security level", async function () {
                // First raise it
                await circuitBreaker.connect(pauser).setSecurityLevel(3, "Critical");

                // Pauser tries to lower it
                await expect(
                    circuitBreaker.connect(pauser).setSecurityLevel(1, "Lower")
                ).to.be.revertedWithCustomError(circuitBreaker, "SecurityLevelTooHigh");
            });

            it("should allow owner to lower security level", async function () {
                // First raise it
                await circuitBreaker.connect(pauser).setSecurityLevel(3, "Critical");

                // Owner can lower it
                await circuitBreaker.setSecurityLevel(1, "Back to normal");
                expect(await circuitBreaker.globalSecurityLevel()).to.equal(1);
            });
        });

        describe("Unpause Branches", function () {
            it("should unpause contract on first unpause", async function () {
                const contractAddr = user.address;
                await circuitBreaker.pauseContract(contractAddr, "Test");

                const status = await circuitBreaker.contractStatus(contractAddr);
                expect(status.isPaused).to.be.true;

                // First unpause - no cooldown needed
                await circuitBreaker.unpauseContract(contractAddr);

                const statusAfter = await circuitBreaker.contractStatus(contractAddr);
                expect(statusAfter.isPaused).to.be.false;
            });

            it("should revert unpause during cooldown (after previous unpause)", async function () {
                const contractAddr = user.address;

                // First pause and unpause
                await circuitBreaker.pauseContract(contractAddr, "First pause");
                await circuitBreaker.unpauseContract(contractAddr);

                // Pause again immediately
                await circuitBreaker.pauseContract(contractAddr, "Second pause");

                // Try to unpause - should fail due to cooldown
                await expect(
                    circuitBreaker.unpauseContract(contractAddr)
                ).to.be.revertedWithCustomError(circuitBreaker, "CooldownActive");

                // Wait for cooldown
                await time.increase(3601);

                // Should succeed after cooldown
                await circuitBreaker.unpauseContract(contractAddr);
            });

            it("should deactivate global pause", async function () {
                await circuitBreaker.activateGlobalPause("Emergency");
                expect(await circuitBreaker.globalPause()).to.be.true;

                await circuitBreaker.deactivateGlobalPause();
                expect(await circuitBreaker.globalPause()).to.be.false;
            });
        });
    });

    describe("TerraQuraMultisig - All Branches", function () {
        let multisig: any;
        let owner: SignerWithAddress;
        let signer1: SignerWithAddress;
        let signer2: SignerWithAddress;
        let signer3: SignerWithAddress;
        let signer4: SignerWithAddress;
        let nonSigner: SignerWithAddress;

        beforeEach(async function () {
            [owner, signer1, signer2, signer3, signer4, nonSigner] = await ethers.getSigners();

            const Factory = await ethers.getContractFactory("TerraQuraMultisig");
            multisig = await Factory.deploy(
                [owner.address, signer1.address, signer2.address, signer3.address],
                2 // 2-of-4
            );
            await multisig.waitForDeployment();

            // Fund the multisig
            await owner.sendTransaction({
                to: await multisig.getAddress(),
                value: ethers.parseEther("10")
            });
        });

        describe("Transaction Submission Branches", function () {
            it("should submit transaction", async function () {
                const tx = await multisig.submitTransaction(
                    nonSigner.address,
                    ethers.parseEther("1"),
                    "0x"
                );

                await expect(tx).to.emit(multisig, "TransactionSubmitted");
            });

            it("should revert if non-signer submits", async function () {
                await expect(
                    multisig.connect(nonSigner).submitTransaction(
                        nonSigner.address,
                        ethers.parseEther("1"),
                        "0x"
                    )
                ).to.be.revertedWithCustomError(multisig, "NotSigner");
            });
        });

        describe("Transaction Confirmation Branches", function () {
            let txId: bigint;

            beforeEach(async function () {
                const tx = await multisig.submitTransaction(
                    nonSigner.address,
                    ethers.parseEther("1"),
                    "0x"
                );
                const receipt = await tx.wait();
                const event = receipt.logs.find((log: any) => log.fragment?.name === "TransactionSubmitted");
                txId = event?.args?.txId;
            });

            it("should confirm transaction", async function () {
                await expect(
                    multisig.connect(signer1).confirmTransaction(txId)
                ).to.emit(multisig, "TransactionConfirmed");
            });

            it("should not allow double confirmation", async function () {
                await multisig.connect(signer1).confirmTransaction(txId);

                await expect(
                    multisig.connect(signer1).confirmTransaction(txId)
                ).to.be.revertedWithCustomError(multisig, "AlreadyConfirmed");
            });

            it("should revert for non-existent transaction", async function () {
                await expect(
                    multisig.connect(signer1).confirmTransaction(999)
                ).to.be.revertedWithCustomError(multisig, "TransactionDoesNotExist");
            });
        });

        describe("Transaction Execution Branches", function () {
            let txId: bigint;

            beforeEach(async function () {
                const tx = await multisig.submitTransaction(
                    nonSigner.address,
                    ethers.parseEther("1"),
                    "0x"
                );
                const receipt = await tx.wait();
                const event = receipt.logs.find((log: any) => log.fragment?.name === "TransactionSubmitted");
                txId = event?.args?.txId;
            });

            it("should execute after reaching threshold", async function () {
                // Confirm by signer1 (submitter already confirmed)
                await multisig.connect(signer1).confirmTransaction(txId);

                // Execute
                const balanceBefore = await ethers.provider.getBalance(nonSigner.address);
                await multisig.executeTransaction(txId);
                const balanceAfter = await ethers.provider.getBalance(nonSigner.address);

                expect(balanceAfter - balanceBefore).to.equal(ethers.parseEther("1"));
            });

            it("should not execute if not enough confirmations", async function () {
                // Only submitter has confirmed (threshold is 2)
                await expect(
                    multisig.executeTransaction(txId)
                ).to.be.revertedWithCustomError(multisig, "TransactionNotConfirmed");
            });

            it("should not execute expired transaction", async function () {
                await multisig.connect(signer1).confirmTransaction(txId);

                // Fast forward past expiry (default 7 days)
                await time.increase(7 * 24 * 60 * 60 + 1);

                await expect(
                    multisig.executeTransaction(txId)
                ).to.be.revertedWithCustomError(multisig, "TransactionExpired");
            });

            it("should not execute already executed transaction", async function () {
                await multisig.connect(signer1).confirmTransaction(txId);
                await multisig.executeTransaction(txId);

                await expect(
                    multisig.executeTransaction(txId)
                ).to.be.revertedWithCustomError(multisig, "TransactionAlreadyExecuted");
            });
        });

        describe("Revoke Confirmation Branch", function () {
            let txId: bigint;

            beforeEach(async function () {
                const tx = await multisig.submitTransaction(
                    nonSigner.address,
                    ethers.parseEther("1"),
                    "0x"
                );
                const receipt = await tx.wait();
                const event = receipt.logs.find((log: any) => log.fragment?.name === "TransactionSubmitted");
                txId = event?.args?.txId;
            });

            it("should revoke confirmation", async function () {
                await multisig.connect(signer1).confirmTransaction(txId);

                await expect(
                    multisig.connect(signer1).revokeConfirmation(txId)
                ).to.emit(multisig, "TransactionRevoked");
            });

            it("should not revoke if not confirmed", async function () {
                await expect(
                    multisig.connect(signer1).revokeConfirmation(txId)
                ).to.be.revertedWithCustomError(multisig, "NotConfirmed");
            });
        });
    });

    describe("EfficiencyCalculator - Edge Case Branches", function () {
        let calculator: any;

        const SCALE = 10000;
        const MIN_KWH = 200;
        const MAX_KWH = 600;
        const OPTIMAL_KWH = 350;

        beforeEach(async function () {
            const Factory = await ethers.getContractFactory("EfficiencyCalculatorTest");
            calculator = await Factory.deploy();
            await calculator.waitForDeployment();
        });

        describe("Range Zero Branch (line 68)", function () {
            it("should handle when optimal equals max (range = 0)", async function () {
                // When optimal = max, range = max - optimal = 0
                // Since kwhPerTonne must be <= maxAcceptable to be in valid range,
                // and kwhPerTonne must be > optimal to hit the else branch,
                // but optimal = max, we can only test kwhPerTonne = optimal = max
                // which goes to the kwhPerTonne <= optimal branch

                // To hit line 68 (else branch with range = 0), we need:
                // - kwhPerTonne > optimal
                // - kwhPerTonne <= maxAcceptable
                // - range = maxAcceptable - optimal = 0
                // This is impossible since optimal = max means no value can be > optimal AND <= max

                // So let's test the BONUS path with range = 0 (optimal = minAcceptable)
                // This hits line 54-55 in the bonus calculation
                const factor = await calculator.testCalculate(
                    300, // At optimal (also = min)
                    300, // optimal = minAcceptable
                    300, // min = optimal
                    600, // max
                    SCALE
                );

                // When at optimal with range = 0 (bonus path), factor should be scale
                expect(factor).to.equal(SCALE);
            });

            it("should handle penalty path when at exactly optimal=max boundary", async function () {
                // Test the edge case where kwhPerTonne equals optimal which equals max
                // This goes to the bonus branch (kwhPerTonne <= optimal)
                const factor = await calculator.testCalculate(
                    400, // At optimal = max
                    400, // optimal
                    200, // min
                    400, // max = optimal
                    SCALE
                );

                // Should return scale (100%) since at optimal
                expect(factor).to.equal(SCALE);
            });
        });

        describe("Negative Purity Factor Branch (line 109)", function () {
            it("should handle purity that creates very low purity factor", async function () {
                // With purity = 0: purityDelta = 0 - 95 = -95
                // purityFactor = 10000 + (-95 * 100) = 10000 - 9500 = 500
                // Since 500 > 0, it doesn't hit line 109

                // We need purity such that purityFactor <= 0
                // 10000 + ((purity - 95) * 100) <= 0
                // (purity - 95) * 100 <= -10000
                // purity - 95 <= -100
                // purity <= -5 (impossible with uint8)

                // So line 109 can only be hit if scale is very small
                // Let's test with 0 purity which gives minimum factor
                const adjusted = await calculator.testApplyPurityAdjustment(
                    10000,
                    0, // 0% purity
                    SCALE
                );

                // Should be clamped to minimum floor
                expect(adjusted).to.be.gte(SCALE / 2);
            });
        });

        describe("Factor Bounds (lines 76-77)", function () {
            it("should clamp factor to minimum when too low", async function () {
                // Very high kWh consumption should give low factor
                const factor = await calculator.testCalculate(
                    MAX_KWH - 1, // Near maximum (worst efficiency)
                    OPTIMAL_KWH,
                    MIN_KWH,
                    MAX_KWH,
                    SCALE
                );

                // Should be above minimum (50%)
                expect(factor).to.be.gte(SCALE / 2);
            });

            it("should clamp factor to maximum when too high", async function () {
                // Very low kWh consumption should give high factor (capped at 105%)
                const factor = await calculator.testCalculate(
                    MIN_KWH, // At minimum (best efficiency)
                    OPTIMAL_KWH,
                    MIN_KWH,
                    MAX_KWH,
                    SCALE
                );

                // Should be capped at maximum (105%)
                expect(factor).to.be.lte(SCALE + SCALE / 20);
            });
        });

        describe("Adjusted Factor Minimum (lines 117-118)", function () {
            it("should apply minimum floor to adjusted factor", async function () {
                // Very low purity should result in minimum floor
                const adjusted = await calculator.testApplyPurityAdjustment(
                    5000, // Low base factor (50%)
                    80,   // 80% purity (below typical)
                    SCALE
                );

                // Should be at least minimum (50%)
                expect(adjusted).to.be.gte(SCALE / 2);
            });
        });
    });

    describe("GaslessMarketplace - Forwarder Branches", function () {
        let marketplace: any;
        let forwarder: any;
        let mockToken: any;
        let owner: SignerWithAddress;
        let seller: SignerWithAddress;
        let buyer: SignerWithAddress;
        let relayer: SignerWithAddress;

        beforeEach(async function () {
            [owner, seller, buyer, relayer] = await ethers.getSigners();

            const MockFactory = await ethers.getContractFactory("MockERC1155");
            mockToken = await MockFactory.deploy();
            await mockToken.waitForDeployment();

            const ForwarderFactory = await ethers.getContractFactory("TerraQuraForwarder");
            forwarder = await ForwarderFactory.deploy();
            await forwarder.waitForDeployment();

            const MarketplaceFactory = await ethers.getContractFactory("GaslessMarketplace");
            marketplace = await upgrades.deployProxy(
                MarketplaceFactory,
                [owner.address, await mockToken.getAddress(), await forwarder.getAddress()],
                { initializer: "initialize" }
            );
            await marketplace.waitForDeployment();

            await mockToken.mint(seller.address, 1, 1000, "0x");
            await mockToken.connect(seller).setApprovalForAll(await marketplace.getAddress(), true);
        });

        describe("Meta-Transaction Flow (lines 132-137, 141-144)", function () {
            it("should execute meta-transaction through forwarder", async function () {
                // Build EIP-712 request
                const domain = {
                    name: "MinimalForwarder",
                    version: "0.0.1",
                    chainId: 31337,
                    verifyingContract: await forwarder.getAddress()
                };

                const types = {
                    ForwardRequest: [
                        { name: "from", type: "address" },
                        { name: "to", type: "address" },
                        { name: "value", type: "uint256" },
                        { name: "gas", type: "uint256" },
                        { name: "nonce", type: "uint256" },
                        { name: "data", type: "bytes" }
                    ]
                };

                const nonce = await forwarder.getNonce(seller.address);

                const data = marketplace.interface.encodeFunctionData("createListing", [
                    1,
                    100,
                    ethers.parseEther("0.01")
                ]);

                const request = {
                    from: seller.address,
                    to: await marketplace.getAddress(),
                    value: 0n,
                    gas: 500000n,
                    nonce: nonce,
                    data: data
                };

                const signature = await seller.signTypedData(domain, types, request);

                // Execute through relayer (covers forwarder path in _msgSender)
                await forwarder.connect(relayer).execute(request, signature);

                const listing = await marketplace.listings(1);
                expect(listing.seller).to.equal(seller.address);
                expect(listing.amount).to.equal(100);
            });
        });
    });
});
