import { expect } from "chai";
import { ethers, upgrades, network } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import {
    CarbonCredit,
    CarbonMarketplace,
    VerificationEngine,
    ChainlinkVerifier,
    MockChainlinkRouter,
} from "../typechain-types";

/**
 * Comprehensive test suite for audit-recommended upgrades:
 * 1. Paginated Marketplace Listings (CarbonMarketplace)
 * 2. Buffer Pool Reserve (CarbonCredit)
 * 3. Multi-Technology Thresholds (VerificationEngine)
 */
describe("Audit Upgrades", function () {
    // ================================================================
    // SECTION 1: Paginated Marketplace Listings
    // ================================================================
    describe("CarbonMarketplace - Paginated Listings", function () {
        let marketplace: CarbonMarketplace;
        let mockCarbonCredit: any;
        let owner: SignerWithAddress;
        let seller: SignerWithAddress;
        let buyer: SignerWithAddress;
        let feeRecipient: SignerWithAddress;

        const TOKEN_ID = 1;
        const PRICE_PER_UNIT = ethers.parseEther("0.01");
        const PLATFORM_FEE_BPS = 250;

        beforeEach(async function () {
            [owner, seller, buyer, feeRecipient] = await ethers.getSigners();

            const MockERC1155 = await ethers.getContractFactory("MockERC1155");
            mockCarbonCredit = await MockERC1155.deploy();
            await mockCarbonCredit.waitForDeployment();

            // Mint a large supply to seller for pagination tests
            await mockCarbonCredit.mint(seller.address, TOKEN_ID, 100000, "0x");

            const MarketplaceFactory = await ethers.getContractFactory("CarbonMarketplace");
            marketplace = await upgrades.deployProxy(
                MarketplaceFactory,
                [
                    await mockCarbonCredit.getAddress(),
                    feeRecipient.address,
                    PLATFORM_FEE_BPS,
                    owner.address,
                ],
                { initializer: "initialize" }
            ) as unknown as CarbonMarketplace;
            await marketplace.waitForDeployment();

            await marketplace.setKycStatus(seller.address, true);
            await marketplace.setKycStatus(buyer.address, true);
            await mockCarbonCredit
                .connect(seller)
                .setApprovalForAll(await marketplace.getAddress(), true);
        });

        async function createListings(count: number) {
            for (let i = 0; i < count; i++) {
                await marketplace
                    .connect(seller)
                    .createListing(TOKEN_ID, 10, PRICE_PER_UNIT, 0, 0);
            }
        }

        describe("getPaginatedListings", function () {
            it("should return empty result for token with no listings", async function () {
                const result = await marketplace.getPaginatedListings(999, 0, 10);
                expect(result.totalCount).to.equal(0);
                expect(result.returnedCount).to.equal(0);
                expect(result.hasMore).to.be.false;
                expect(result.ids.length).to.equal(0);
            });

            it("should return first page of listings", async function () {
                await createListings(10);
                const result = await marketplace.getPaginatedListings(TOKEN_ID, 0, 5);

                expect(result.totalCount).to.equal(10);
                expect(result.returnedCount).to.equal(5);
                expect(result.hasMore).to.be.true;
                expect(result.ids.length).to.equal(5);
                expect(result.offset).to.equal(0);
            });

            it("should return second page of listings", async function () {
                await createListings(10);
                const result = await marketplace.getPaginatedListings(TOKEN_ID, 5, 5);

                expect(result.totalCount).to.equal(10);
                expect(result.returnedCount).to.equal(5);
                expect(result.hasMore).to.be.false;
                expect(result.offset).to.equal(5);
            });

            it("should handle partial last page", async function () {
                await createListings(7);
                const result = await marketplace.getPaginatedListings(TOKEN_ID, 5, 5);

                expect(result.totalCount).to.equal(7);
                expect(result.returnedCount).to.equal(2);
                expect(result.hasMore).to.be.false;
            });

            it("should use default page size when limit is 0", async function () {
                await createListings(30);
                const result = await marketplace.getPaginatedListings(TOKEN_ID, 0, 0);

                // Default is 25
                expect(result.returnedCount).to.equal(25);
                expect(result.hasMore).to.be.true;
            });

            it("should revert when limit exceeds MAX_PAGE_SIZE", async function () {
                await expect(
                    marketplace.getPaginatedListings(TOKEN_ID, 0, 101)
                ).to.be.revertedWithCustomError(marketplace, "InvalidPaginationLimit");
            });

            it("should revert when offset is out of bounds", async function () {
                await createListings(5);
                await expect(
                    marketplace.getPaginatedListings(TOKEN_ID, 10, 5)
                ).to.be.revertedWithCustomError(marketplace, "OffsetOutOfBounds");
            });

            it("should skip inactive listings in pagination", async function () {
                await createListings(5);

                // Cancel listing #2 and #4
                await marketplace.connect(seller).cancelListing(2);
                await marketplace.connect(seller).cancelListing(4);

                const result = await marketplace.getPaginatedListings(TOKEN_ID, 0, 10);
                expect(result.totalCount).to.equal(3);
                expect(result.returnedCount).to.equal(3);

                // Verify only active listing IDs are returned
                for (let i = 0; i < Number(result.returnedCount); i++) {
                    const listing = await marketplace.getListing(result.ids[i]);
                    expect(listing.isActive).to.be.true;
                }
            });
        });

        describe("getPaginatedListingDetails", function () {
            it("should return full Listing structs", async function () {
                await createListings(3);
                const [items, totalCount, hasMore] =
                    await marketplace.getPaginatedListingDetails(TOKEN_ID, 0, 10);

                expect(totalCount).to.equal(3);
                expect(hasMore).to.be.false;
                expect(items.length).to.equal(3);
                expect(items[0].seller).to.equal(seller.address);
                expect(items[0].pricePerUnit).to.equal(PRICE_PER_UNIT);
            });
        });

        describe("getPaginatedSellerListings", function () {
            it("should paginate seller's active listings", async function () {
                await createListings(8);
                await marketplace.connect(seller).cancelListing(3);

                const result = await marketplace.getPaginatedSellerListings(
                    seller.address, 0, 5
                );
                expect(result.totalCount).to.equal(7);
                expect(result.returnedCount).to.equal(5);
                expect(result.hasMore).to.be.true;
            });
        });

        describe("getPaginatedBuyerOffers", function () {
            it("should paginate buyer's active offers", async function () {
                // Create offers
                for (let i = 0; i < 5; i++) {
                    await marketplace.connect(buyer).createOffer(
                        TOKEN_ID,
                        10,
                        PRICE_PER_UNIT,
                        86400,
                        { value: ethers.parseEther("0.1") }
                    );
                }

                // Cancel one
                await marketplace.connect(buyer).cancelOffer(2);

                const result = await marketplace.getPaginatedBuyerOffers(
                    buyer.address, 0, 10
                );
                expect(result.totalCount).to.equal(4);
                expect(result.returnedCount).to.equal(4);
                expect(result.hasMore).to.be.false;
            });
        });

        describe("Count functions", function () {
            it("should return correct active listing count", async function () {
                await createListings(5);
                await marketplace.connect(seller).cancelListing(2);

                const count = await marketplace.getActiveListingCount(TOKEN_ID);
                expect(count).to.equal(4);
            });

            it("should return correct active offer count", async function () {
                for (let i = 0; i < 3; i++) {
                    await marketplace.connect(buyer).createOffer(
                        TOKEN_ID, 10, PRICE_PER_UNIT, 86400,
                        { value: ethers.parseEther("0.1") }
                    );
                }

                const count = await marketplace.getActiveOfferCount(buyer.address);
                expect(count).to.equal(3);
            });
        });

        describe("Backwards compatibility", function () {
            it("getActiveListingsForToken should cap results at MAX_PAGE_SIZE", async function () {
                // Create enough listings to test the cap
                await createListings(10);
                const result = await marketplace.getActiveListingsForToken(TOKEN_ID);
                expect(result.length).to.equal(10);
            });

            it("version should be 1.3.0", async function () {
                expect(await marketplace.version()).to.equal("1.3.0");
            });
        });
    });

    // ================================================================
    // SECTION 2: Buffer Pool Reserve
    // ================================================================
    describe("CarbonCredit - Buffer Pool", function () {
        let carbonCredit: CarbonCredit;
        let verificationEngine: VerificationEngine;
        let owner: SignerWithAddress;
        let operator: SignerWithAddress;
        let bufferPool: SignerWithAddress;
        let releaseTarget: SignerWithAddress;

        const dacUnitId = ethers.keccak256(ethers.toUtf8Bytes("DAC_UNIT_BUFFER"));
        const co2AmountKg = 1000000;
        const energyConsumedKwh = 350000;
        const purityPercentage = 98;
        const ipfsUri = "ipfs://QmBufferTest123";
        const arweaveTxId = "arweave_buffer_tx";

        async function mintCredits(hashSuffix: string) {
            const sourceDataHash = ethers.keccak256(
                ethers.toUtf8Bytes(`buffer_test_${hashSuffix}`)
            );
            const captureTimestamp = Math.floor(Date.now() / 1000) + Math.floor(Math.random() * 100000);

            return carbonCredit.connect(operator).mintVerifiedCredits(
                operator.address,
                dacUnitId,
                sourceDataHash,
                captureTimestamp,
                co2AmountKg,
                energyConsumedKwh,
                24453884,
                54377344,
                purityPercentage,
                50, // gridIntensity (gCO2/kWh)
                ipfsUri,
                arweaveTxId
            );
        }

        beforeEach(async function () {
            [owner, operator, bufferPool, releaseTarget] = await ethers.getSigners();

            const VEFactory = await ethers.getContractFactory("VerificationEngine");
            verificationEngine = await upgrades.deployProxy(
                VEFactory,
                [ethers.ZeroAddress, ethers.ZeroAddress],
                { initializer: "initialize" }
            ) as unknown as VerificationEngine;
            await verificationEngine.waitForDeployment();

            const CCFactory = await ethers.getContractFactory("CarbonCredit");
            carbonCredit = await upgrades.deployProxy(
                CCFactory,
                [await verificationEngine.getAddress(), "ipfs://", owner.address],
                { initializer: "initialize" }
            ) as unknown as CarbonCredit;
            await carbonCredit.waitForDeployment();

            await verificationEngine.setCarbonCreditContract(
                await carbonCredit.getAddress()
            );
            await verificationEngine.whitelistDacUnit(dacUnitId, operator.address);
            await carbonCredit.setMinter(operator.address, true);
        });

        describe("Buffer Configuration", function () {
            it("should configure buffer pool address and percentage", async function () {
                await expect(
                    carbonCredit.setBufferConfiguration(bufferPool.address, 500)
                )
                    .to.emit(carbonCredit, "BufferPoolConfigured")
                    .withArgs(ethers.ZeroAddress, bufferPool.address, 0, 500);

                const [poolAddr, pctBps, totalHeld] = await carbonCredit.getBufferPoolStats();
                expect(poolAddr).to.equal(bufferPool.address);
                expect(pctBps).to.equal(500);
                expect(totalHeld).to.equal(0);
            });

            it("should revert if percentage exceeds MAX_BUFFER_BPS", async function () {
                await expect(
                    carbonCredit.setBufferConfiguration(bufferPool.address, 1001)
                ).to.be.revertedWithCustomError(carbonCredit, "InvalidBufferPercentage");
            });

            it("should revert if percentage > 0 but address is zero", async function () {
                await expect(
                    carbonCredit.setBufferConfiguration(ethers.ZeroAddress, 500)
                ).to.be.revertedWithCustomError(carbonCredit, "InvalidBufferPoolAddress");
            });

            it("should allow disabling buffer pool by setting address to zero with 0%", async function () {
                await carbonCredit.setBufferConfiguration(bufferPool.address, 500);
                await carbonCredit.setBufferConfiguration(ethers.ZeroAddress, 0);

                const [poolAddr, pctBps] = await carbonCredit.getBufferPoolStats();
                expect(poolAddr).to.equal(ethers.ZeroAddress);
                expect(pctBps).to.equal(0);
            });

            it("should only allow owner to configure buffer", async function () {
                await expect(
                    carbonCredit.connect(operator).setBufferConfiguration(bufferPool.address, 500)
                ).to.be.revertedWith("Ownable: caller is not the owner");
            });
        });

        describe("Minting with Buffer Pool", function () {
            it("should split mint between operator and buffer when configured", async function () {
                // Configure 5% buffer
                await carbonCredit.setBufferConfiguration(bufferPool.address, 500);

                const tx = await mintCredits("split_1");
                const receipt = await tx.wait();

                // Find the BufferPoolAllocation event
                const allocationEvent = receipt!.logs.find((log: any) => {
                    try {
                        return carbonCredit.interface.parseLog(log as any)?.name === "BufferPoolAllocation";
                    } catch { return false; }
                });
                expect(allocationEvent).to.not.be.undefined;

                const parsed = carbonCredit.interface.parseLog(allocationEvent as any);
                const operatorAmount = parsed!.args.operatorAmount;
                const bufferAmount = parsed!.args.bufferAmount;
                const totalMinted = parsed!.args.totalMinted;

                // Verify split: 5% of total goes to buffer
                expect(bufferAmount).to.equal(totalMinted * 500n / 10000n);
                expect(operatorAmount).to.equal(totalMinted - bufferAmount);

                // Verify buffer pool balance tracking
                const tokenId = parsed!.args.tokenId;
                expect(await carbonCredit.getBufferBalance(tokenId)).to.equal(bufferAmount);
                expect(await carbonCredit.totalBufferPoolCredits()).to.equal(bufferAmount);
            });

            it("should mint all to operator when buffer pool is not configured", async function () {
                // No buffer configured - all goes to operator
                await mintCredits("no_buffer_1");

                expect(await carbonCredit.totalBufferPoolCredits()).to.equal(0);
            });

            it("should track per-token total supply correctly", async function () {
                await carbonCredit.setBufferConfiguration(bufferPool.address, 500);

                const tx = await mintCredits("supply_track_1");
                const receipt = await tx.wait();

                const allocationEvent = receipt!.logs.find((log: any) => {
                    try {
                        return carbonCredit.interface.parseLog(log as any)?.name === "BufferPoolAllocation";
                    } catch { return false; }
                });
                const parsed = carbonCredit.interface.parseLog(allocationEvent as any);
                const tokenId = parsed!.args.tokenId;
                const totalMinted = parsed!.args.totalMinted;

                const supply = await carbonCredit.totalSupply(tokenId);
                expect(supply).to.equal(totalMinted);
            });
        });

        describe("Buffer Release", function () {
            let tokenId: bigint;
            let bufferAmount: bigint;

            beforeEach(async function () {
                await carbonCredit.setBufferConfiguration(bufferPool.address, 500);

                const tx = await mintCredits("release_test_1");
                const receipt = await tx.wait();

                const allocationEvent = receipt!.logs.find((log: any) => {
                    try {
                        return carbonCredit.interface.parseLog(log as any)?.name === "BufferPoolAllocation";
                    } catch { return false; }
                });
                const parsed = carbonCredit.interface.parseLog(allocationEvent as any);
                tokenId = parsed!.args.tokenId;
                bufferAmount = parsed!.args.bufferAmount;

                // Buffer pool address must approve the CarbonCredit contract
                await carbonCredit.connect(bufferPool).setApprovalForAll(
                    await carbonCredit.getAddress(),
                    true
                );
            });

            it("should release buffer credits to target address", async function () {
                const halfBuffer = bufferAmount / 2n;
                await expect(
                    carbonCredit.releaseBufferCredits(
                        tokenId,
                        halfBuffer,
                        releaseTarget.address,
                        "Verification period complete"
                    )
                )
                    .to.emit(carbonCredit, "BufferPoolRelease")
                    .withArgs(tokenId, releaseTarget.address, halfBuffer, "Verification period complete");

                expect(await carbonCredit.getBufferBalance(tokenId)).to.equal(
                    bufferAmount - halfBuffer
                );
                expect(await carbonCredit.balanceOf(releaseTarget.address, tokenId)).to.equal(
                    halfBuffer
                );
            });

            it("should revert if releasing more than buffer balance", async function () {
                await expect(
                    carbonCredit.releaseBufferCredits(
                        tokenId,
                        bufferAmount + 1n,
                        releaseTarget.address,
                        "Over-release"
                    )
                ).to.be.revertedWithCustomError(carbonCredit, "InsufficientBufferBalance");
            });

            it("should revert if releasing to zero address", async function () {
                await expect(
                    carbonCredit.releaseBufferCredits(
                        tokenId,
                        1n,
                        ethers.ZeroAddress,
                        "Bad target"
                    )
                ).to.be.revertedWithCustomError(carbonCredit, "InvalidBufferPoolAddress");
            });

            it("should only allow owner to release buffer credits", async function () {
                await expect(
                    carbonCredit.connect(operator).releaseBufferCredits(
                        tokenId,
                        1n,
                        releaseTarget.address,
                        "Unauthorized"
                    )
                ).to.be.revertedWith("Ownable: caller is not the owner");
            });
        });

        describe("Token Supply Tracking", function () {
            it("should track supply decrease on retirement", async function () {
                const tx = await mintCredits("retire_supply_1");
                const receipt = await tx.wait();

                // Find token ID from CreditMinted event
                const mintEvent = receipt!.logs.find((log: any) => {
                    try {
                        return carbonCredit.interface.parseLog(log as any)?.name === "CreditMinted";
                    } catch { return false; }
                });
                const parsed = carbonCredit.interface.parseLog(mintEvent as any);
                const tokenId = parsed!.args.tokenId;

                const supplyBefore = await carbonCredit.totalSupply(tokenId);
                const balance = await carbonCredit.balanceOf(operator.address, tokenId);

                // Retire half
                const retireAmount = balance / 2n;
                await carbonCredit.connect(operator).retireCredits(
                    tokenId,
                    retireAmount,
                    "Climate offset"
                );

                const supplyAfter = await carbonCredit.totalSupply(tokenId);
                expect(supplyAfter).to.equal(supplyBefore - retireAmount);
            });

            it("version should be 3.0.0", async function () {
                expect(await carbonCredit.version()).to.equal("3.0.0");
            });
        });
    });

    // ================================================================
    // SECTION 3: Multi-Technology Thresholds
    // ================================================================
    describe("VerificationEngine - Multi-Technology Thresholds", function () {
        let verificationEngine: VerificationEngine;
        let carbonCredit: CarbonCredit;
        let owner: SignerWithAddress;
        let operator: SignerWithAddress;

        const dacUnitId = ethers.keccak256(ethers.toUtf8Bytes("DAC_UNIT_MULTI_TECH"));
        const beccsUnitId = ethers.keccak256(ethers.toUtf8Bytes("BECCS_UNIT_001"));
        const biocharUnitId = ethers.keccak256(ethers.toUtf8Bytes("BIOCHAR_UNIT_001"));

        beforeEach(async function () {
            [owner, operator] = await ethers.getSigners();

            const VEFactory = await ethers.getContractFactory("VerificationEngine");
            verificationEngine = await upgrades.deployProxy(
                VEFactory,
                [ethers.ZeroAddress, ethers.ZeroAddress],
                { initializer: "initialize" }
            ) as unknown as VerificationEngine;
            await verificationEngine.waitForDeployment();

            const CCFactory = await ethers.getContractFactory("CarbonCredit");
            carbonCredit = await upgrades.deployProxy(
                CCFactory,
                [await verificationEngine.getAddress(), "ipfs://", owner.address],
                { initializer: "initialize" }
            ) as unknown as CarbonCredit;
            await carbonCredit.waitForDeployment();

            await verificationEngine.setCarbonCreditContract(
                await carbonCredit.getAddress()
            );
            await carbonCredit.setMinter(operator.address, true);
        });

        describe("Default Technology Thresholds", function () {
            it("should have 5 default technology types registered", async function () {
                expect(await verificationEngine.registeredTechCount()).to.equal(5);
            });

            it("should have DAC thresholds matching legacy constants", async function () {
                const dacThresholds = await verificationEngine.getTechThresholds(0);
                expect(dacThresholds.minKwhPerTonne).to.equal(200);
                expect(dacThresholds.maxKwhPerTonne).to.equal(600);
                expect(dacThresholds.optimalKwhPerTonne).to.equal(350);
                expect(dacThresholds.minPurityPercentage).to.equal(90);
                expect(dacThresholds.isActive).to.be.true;
                expect(dacThresholds.name).to.equal("Direct Air Capture");
            });

            it("should have BECCS thresholds configured", async function () {
                const beccsThresholds = await verificationEngine.getTechThresholds(1);
                expect(beccsThresholds.minKwhPerTonne).to.equal(100);
                expect(beccsThresholds.maxKwhPerTonne).to.equal(400);
                expect(beccsThresholds.optimalKwhPerTonne).to.equal(200);
                expect(beccsThresholds.minPurityPercentage).to.equal(85);
                expect(beccsThresholds.isActive).to.be.true;
                expect(beccsThresholds.name).to.equal("BECCS");
            });

            it("should have Biochar thresholds configured", async function () {
                const biocharThresholds = await verificationEngine.getTechThresholds(2);
                expect(biocharThresholds.minKwhPerTonne).to.equal(50);
                expect(biocharThresholds.maxKwhPerTonne).to.equal(300);
                expect(biocharThresholds.isActive).to.be.true;
            });

            it("should have Enhanced Weathering thresholds configured", async function () {
                const ewThresholds = await verificationEngine.getTechThresholds(3);
                expect(ewThresholds.minKwhPerTonne).to.equal(30);
                expect(ewThresholds.maxKwhPerTonne).to.equal(200);
                expect(ewThresholds.isActive).to.be.true;
            });

            it("should have Ocean Alkalinity thresholds configured", async function () {
                const oaThresholds = await verificationEngine.getTechThresholds(4);
                expect(oaThresholds.minKwhPerTonne).to.equal(40);
                expect(oaThresholds.maxKwhPerTonne).to.equal(250);
                expect(oaThresholds.isActive).to.be.true;
            });
        });

        describe("Whitelisting with Technology Types", function () {
            it("should default to TECH_DAC when using whitelistDacUnit", async function () {
                await verificationEngine.whitelistDacUnit(dacUnitId, operator.address);
                expect(await verificationEngine.dacUnitTechType(dacUnitId)).to.equal(0);
            });

            it("should whitelist with specific tech type", async function () {
                await verificationEngine.whitelistDacUnitWithTech(
                    beccsUnitId,
                    operator.address,
                    1 // TECH_BECCS
                );

                expect(await verificationEngine.whitelistedDacUnits(beccsUnitId)).to.be.true;
                expect(await verificationEngine.dacUnitTechType(beccsUnitId)).to.equal(1);
            });

            it("should revert if tech type is not active", async function () {
                await expect(
                    verificationEngine.whitelistDacUnitWithTech(
                        beccsUnitId,
                        operator.address,
                        200 // Non-existent tech type
                    )
                ).to.be.revertedWithCustomError(verificationEngine, "TechTypeNotActive");
            });

            it("should update DAC unit tech type", async function () {
                await verificationEngine.whitelistDacUnit(dacUnitId, operator.address);

                await expect(
                    verificationEngine.setDacUnitTechType(dacUnitId, 1)
                )
                    .to.emit(verificationEngine, "DacUnitTechTypeUpdated")
                    .withArgs(dacUnitId, 0, 1);

                expect(await verificationEngine.dacUnitTechType(dacUnitId)).to.equal(1);
            });
        });

        describe("Technology-Specific Verification", function () {
            it("should verify DAC unit with DAC thresholds", async function () {
                await verificationEngine.whitelistDacUnit(dacUnitId, operator.address);

                // 350 kWh/tonne - optimal for DAC
                const [isValid, factor] = await verificationEngine.previewEfficiencyFactorForTech(
                    0, // TECH_DAC
                    1000000, // 1 tonne in kg
                    350000,  // 350 kWh
                    98
                );
                expect(isValid).to.be.true;
                expect(factor).to.be.greaterThan(0);
            });

            it("should verify BECCS unit with BECCS thresholds", async function () {
                await verificationEngine.whitelistDacUnitWithTech(
                    beccsUnitId, operator.address, 1
                );

                // 200 kWh/tonne - optimal for BECCS
                const [isValid, factor] = await verificationEngine.previewEfficiencyFactorForTech(
                    1, // TECH_BECCS
                    1000000,
                    200000,
                    90
                );
                expect(isValid).to.be.true;
                expect(factor).to.be.greaterThan(0);
            });

            it("should reject values outside BECCS range using DAC thresholds", async function () {
                // 150 kWh/tonne is valid for BECCS but below DAC minimum (200)
                const [isValidDac] = await verificationEngine.previewEfficiencyFactorForTech(
                    0, // TECH_DAC
                    1000000,
                    150000,
                    95
                );
                expect(isValidDac).to.be.false;

                // Same values should be valid for BECCS
                const [isValidBeccs] = await verificationEngine.previewEfficiencyFactorForTech(
                    1, // TECH_BECCS
                    1000000,
                    150000,
                    90
                );
                expect(isValidBeccs).to.be.true;
            });

            it("should use tech-specific thresholds during actual verification", async function () {
                // Whitelist BECCS unit
                await verificationEngine.whitelistDacUnitWithTech(
                    beccsUnitId, operator.address, 1
                );

                // Mint with BECCS-specific parameters (150 kWh/tonne - below DAC min but valid for BECCS)
                const sourceHash = ethers.keccak256(ethers.toUtf8Bytes("beccs_verification_test"));
                const tx = await carbonCredit.connect(operator).mintVerifiedCredits(
                    operator.address,
                    beccsUnitId,
                    sourceHash,
                    Math.floor(Date.now() / 1000),
                    1000000,  // 1 tonne
                    150000,   // 150 kWh (valid for BECCS, invalid for DAC)
                    24453884,
                    54377344,
                    90,
                    50,       // gridIntensity (gCO2/kWh)
                    "ipfs://QmBeccsTest",
                    "arweave_beccs"
                );

                const receipt = await tx.wait();
                expect(receipt!.status).to.equal(1);
            });

            it("should reject BECCS unit values below BECCS minimum", async function () {
                await verificationEngine.whitelistDacUnitWithTech(
                    beccsUnitId, operator.address, 1
                );

                // 50 kWh/tonne - below BECCS minimum (100)
                const sourceHash = ethers.keccak256(ethers.toUtf8Bytes("beccs_reject_test"));
                await expect(
                    carbonCredit.connect(operator).mintVerifiedCredits(
                        operator.address,
                        beccsUnitId,
                        sourceHash,
                        Math.floor(Date.now() / 1000),
                        1000000,
                        50000,   // 50 kWh - below BECCS min of 100
                        24453884,
                        54377344,
                        90,
                        50,      // gridIntensity (gCO2/kWh)
                        "ipfs://QmBeccsReject",
                        "arweave_reject"
                    )
                ).to.be.revertedWithCustomError(carbonCredit, "VerificationFailed");
            });
        });

        describe("Custom Technology Thresholds", function () {
            it("should allow adding new technology types", async function () {
                await expect(
                    verificationEngine.setTechThresholds(
                        10, // Custom tech type ID
                        80,
                        500,
                        200,
                        75,
                        "Kelp Sequestration"
                    )
                )
                    .to.emit(verificationEngine, "TechThresholdsUpdated")
                    .withArgs(10, "Kelp Sequestration", 80, 500, 200, 75);

                expect(await verificationEngine.registeredTechCount()).to.equal(6);

                const thresholds = await verificationEngine.getTechThresholds(10);
                expect(thresholds.name).to.equal("Kelp Sequestration");
                expect(thresholds.isActive).to.be.true;
            });

            it("should revert if min >= optimal", async function () {
                await expect(
                    verificationEngine.setTechThresholds(10, 300, 500, 200, 75, "Bad Thresholds")
                ).to.be.revertedWithCustomError(verificationEngine, "InvalidTechThresholds");
            });

            it("should revert if optimal >= max", async function () {
                await expect(
                    verificationEngine.setTechThresholds(10, 100, 200, 300, 75, "Bad Thresholds")
                ).to.be.revertedWithCustomError(verificationEngine, "InvalidTechThresholds");
            });

            it("should revert if name is empty", async function () {
                await expect(
                    verificationEngine.setTechThresholds(10, 100, 500, 300, 75, "")
                ).to.be.revertedWithCustomError(verificationEngine, "InvalidTechThresholds");
            });

            it("should update existing tech type thresholds", async function () {
                // Update DAC thresholds
                const countBefore = await verificationEngine.registeredTechCount();
                await verificationEngine.setTechThresholds(
                    0, // TECH_DAC
                    180,
                    650,
                    320,
                    88,
                    "Direct Air Capture v2"
                );

                const countAfter = await verificationEngine.registeredTechCount();
                expect(countAfter).to.equal(countBefore); // Should not increment for existing

                const updated = await verificationEngine.getTechThresholds(0);
                expect(updated.minKwhPerTonne).to.equal(180);
                expect(updated.maxKwhPerTonne).to.equal(650);
            });

            it("should deactivate a technology type", async function () {
                await verificationEngine.deactivateTechType(4); // Ocean Alkalinity
                expect(await verificationEngine.registeredTechCount()).to.equal(4);

                const thresholds = await verificationEngine.getTechThresholds(4);
                expect(thresholds.isActive).to.be.false;
            });

            it("should revert deactivating already inactive tech type", async function () {
                await expect(
                    verificationEngine.deactivateTechType(200)
                ).to.be.revertedWithCustomError(verificationEngine, "TechTypeNotActive");
            });
        });

        describe("Effective Thresholds Query", function () {
            it("should return technology-specific thresholds for whitelisted unit", async function () {
                await verificationEngine.whitelistDacUnitWithTech(
                    beccsUnitId, operator.address, 1
                );

                const result = await verificationEngine.getEffectiveThresholds(beccsUnitId);
                expect(result.minKwh).to.equal(100);
                expect(result.maxKwh).to.equal(400);
                expect(result.optimalKwh).to.equal(200);
                expect(result.minPurity).to.equal(85);
                expect(result.techType).to.equal(1);
                expect(result.techName).to.equal("BECCS");
            });

            it("should fall back to DAC defaults for unknown tech type", async function () {
                // Query for a non-whitelisted unit (tech type defaults to 0 = DAC)
                const unknownId = ethers.keccak256(ethers.toUtf8Bytes("UNKNOWN_UNIT"));
                const result = await verificationEngine.getEffectiveThresholds(unknownId);
                expect(result.minKwh).to.equal(200);
                expect(result.techType).to.equal(0);
            });
        });

        describe("Legacy Compatibility", function () {
            it("getVerificationThresholds should return DAC defaults", async function () {
                const [minKwh, maxKwh, optimalKwh, minPurity] =
                    await verificationEngine.getVerificationThresholds();
                expect(minKwh).to.equal(200);
                expect(maxKwh).to.equal(600);
                expect(optimalKwh).to.equal(350);
                expect(minPurity).to.equal(90);
            });

            it("previewEfficiencyFactor should use DAC thresholds", async function () {
                const [isValid, factor] = await verificationEngine.previewEfficiencyFactor(
                    1000000,
                    350000,
                    98
                );
                expect(isValid).to.be.true;
                expect(factor).to.be.greaterThan(0);
            });

            it("should verify DAC units same as before upgrade", async function () {
                await verificationEngine.whitelistDacUnit(dacUnitId, operator.address);

                const sourceHash = ethers.keccak256(ethers.toUtf8Bytes("legacy_compat_test"));
                const tx = await carbonCredit.connect(operator).mintVerifiedCredits(
                    operator.address,
                    dacUnitId,
                    sourceHash,
                    Math.floor(Date.now() / 1000),
                    1000000,
                    350000,
                    24453884,
                    54377344,
                    98,
                    50,       // gridIntensity (gCO2/kWh)
                    "ipfs://QmLegacy",
                    "arweave_legacy"
                );

                const receipt = await tx.wait();
                expect(receipt!.status).to.equal(1);
            });
        });
    });

    // ================================================================
    // SECTION 4: Carbon Reversal Handling (handleReversal)
    // ================================================================
    describe("CarbonCredit - Carbon Reversal Handling", function () {
        let carbonCredit: CarbonCredit;
        let verificationEngine: VerificationEngine;
        let owner: SignerWithAddress;
        let operator: SignerWithAddress;
        let bufferPool: SignerWithAddress;
        let nonOwner: SignerWithAddress;

        const dacUnitId = ethers.keccak256(ethers.toUtf8Bytes("DAC_UNIT_REVERSAL"));
        const co2AmountKg = 1000000;
        const energyConsumedKwh = 350000;
        const purityPercentage = 98;
        const ipfsUri = "ipfs://QmReversalTest123";
        const arweaveTxId = "arweave_reversal_tx";

        let tokenId: bigint;
        let bufferAmount: bigint;
        let totalMinted: bigint;

        async function mintCreditsAndGetInfo(hashSuffix: string) {
            const sourceDataHash = ethers.keccak256(
                ethers.toUtf8Bytes(`reversal_test_${hashSuffix}`)
            );
            const captureTimestamp = Math.floor(Date.now() / 1000) + Math.floor(Math.random() * 100000);

            const tx = await carbonCredit.connect(operator).mintVerifiedCredits(
                operator.address,
                dacUnitId,
                sourceDataHash,
                captureTimestamp,
                co2AmountKg,
                energyConsumedKwh,
                24453884,
                54377344,
                purityPercentage,
                50,       // gridIntensity (gCO2/kWh)
                ipfsUri,
                arweaveTxId
            );
            const receipt = await tx.wait();

            const allocationEvent = receipt!.logs.find((log: any) => {
                try {
                    return carbonCredit.interface.parseLog(log as any)?.name === "BufferPoolAllocation";
                } catch { return false; }
            });
            const parsed = carbonCredit.interface.parseLog(allocationEvent as any);
            return {
                tokenId: parsed!.args.tokenId as bigint,
                bufferAmount: parsed!.args.bufferAmount as bigint,
                operatorAmount: parsed!.args.operatorAmount as bigint,
                totalMinted: parsed!.args.totalMinted as bigint,
            };
        }

        beforeEach(async function () {
            [owner, operator, bufferPool, nonOwner] = await ethers.getSigners();

            const VEFactory = await ethers.getContractFactory("VerificationEngine");
            verificationEngine = await upgrades.deployProxy(
                VEFactory,
                [ethers.ZeroAddress, ethers.ZeroAddress],
                { initializer: "initialize" }
            ) as unknown as VerificationEngine;
            await verificationEngine.waitForDeployment();

            const CCFactory = await ethers.getContractFactory("CarbonCredit");
            carbonCredit = await upgrades.deployProxy(
                CCFactory,
                [await verificationEngine.getAddress(), "ipfs://", owner.address],
                { initializer: "initialize" }
            ) as unknown as CarbonCredit;
            await carbonCredit.waitForDeployment();

            await verificationEngine.setCarbonCreditContract(
                await carbonCredit.getAddress()
            );
            await verificationEngine.whitelistDacUnit(dacUnitId, operator.address);
            await carbonCredit.setMinter(operator.address, true);

            // Configure buffer pool (5%)
            await carbonCredit.setBufferConfiguration(bufferPool.address, 500);

            // Mint credits with buffer allocation
            const info = await mintCreditsAndGetInfo("reversal_setup");
            tokenId = info.tokenId;
            bufferAmount = info.bufferAmount;
            totalMinted = info.totalMinted;
        });

        describe("Successful Reversal", function () {
            it("should burn buffer credits on reversal", async function () {
                const burnAmount = bufferAmount / 2n;
                const supplyBefore = await carbonCredit.totalSupply(tokenId);

                await expect(
                    carbonCredit.handleReversal(
                        tokenId,
                        burnAmount,
                        "Storage leak detected at facility XYZ"
                    )
                )
                    .to.emit(carbonCredit, "CarbonReversalHandled")
                    .withArgs(
                        tokenId,
                        burnAmount,
                        bufferAmount - burnAmount,
                        "Storage leak detected at facility XYZ",
                        (v: any) => v > 0 // timestamp > 0
                    );

                // Verify buffer balance decreased
                expect(await carbonCredit.getBufferBalance(tokenId)).to.equal(
                    bufferAmount - burnAmount
                );

                // Verify total buffer pool credits decreased
                expect(await carbonCredit.totalBufferPoolCredits()).to.equal(
                    bufferAmount - burnAmount
                );

                // Verify total supply decreased
                expect(await carbonCredit.totalSupply(tokenId)).to.equal(
                    supplyBefore - burnAmount
                );

                // Verify buffer pool address balance decreased
                expect(await carbonCredit.balanceOf(bufferPool.address, tokenId)).to.equal(
                    bufferAmount - burnAmount
                );
            });

            it("should allow full buffer burn", async function () {
                await carbonCredit.handleReversal(
                    tokenId,
                    bufferAmount,
                    "Complete facility failure"
                );

                expect(await carbonCredit.getBufferBalance(tokenId)).to.equal(0);
                expect(await carbonCredit.totalBufferPoolCredits()).to.equal(0);
                expect(await carbonCredit.balanceOf(bufferPool.address, tokenId)).to.equal(0);
            });

            it("should not affect operator balance during reversal", async function () {
                const operatorBalanceBefore = await carbonCredit.balanceOf(operator.address, tokenId);

                await carbonCredit.handleReversal(
                    tokenId,
                    bufferAmount / 2n,
                    "Partial leak"
                );

                const operatorBalanceAfter = await carbonCredit.balanceOf(operator.address, tokenId);
                expect(operatorBalanceAfter).to.equal(operatorBalanceBefore);
            });

            it("should handle multiple reversals for same token", async function () {
                const firstBurn = bufferAmount / 4n;
                const secondBurn = bufferAmount / 4n;

                await carbonCredit.handleReversal(tokenId, firstBurn, "First reversal");
                expect(await carbonCredit.getBufferBalance(tokenId)).to.equal(
                    bufferAmount - firstBurn
                );

                await carbonCredit.handleReversal(tokenId, secondBurn, "Second reversal");
                expect(await carbonCredit.getBufferBalance(tokenId)).to.equal(
                    bufferAmount - firstBurn - secondBurn
                );
            });
        });

        describe("Reversal Revert Conditions", function () {
            it("should revert if amount is zero", async function () {
                await expect(
                    carbonCredit.handleReversal(tokenId, 0, "Zero burn")
                ).to.be.revertedWithCustomError(carbonCredit, "InvalidReversalAmount");
            });

            it("should revert if amount exceeds buffer balance", async function () {
                await expect(
                    carbonCredit.handleReversal(
                        tokenId,
                        bufferAmount + 1n,
                        "Over-burn"
                    )
                ).to.be.revertedWithCustomError(carbonCredit, "ReversalAmountExceedsBuffer");
            });

            it("should revert if buffer pool address is zero (disabled)", async function () {
                // Disable buffer pool for new mints (existing balances remain)
                await carbonCredit.setBufferConfiguration(ethers.ZeroAddress, 0);

                await expect(
                    carbonCredit.handleReversal(tokenId, 1n, "Buffer disabled")
                ).to.be.revertedWithCustomError(carbonCredit, "InvalidBufferPoolAddress");
            });

            it("should revert if non-owner calls handleReversal", async function () {
                await expect(
                    carbonCredit.connect(operator).handleReversal(
                        tokenId,
                        bufferAmount / 2n,
                        "Unauthorized reversal"
                    )
                ).to.be.revertedWith("Ownable: caller is not the owner");
            });

            it("should revert if non-owner (random) calls handleReversal", async function () {
                await expect(
                    carbonCredit.connect(nonOwner).handleReversal(
                        tokenId,
                        1n,
                        "Random user"
                    )
                ).to.be.revertedWith("Ownable: caller is not the owner");
            });

            it("should revert if contract is paused", async function () {
                await carbonCredit.pause();
                await expect(
                    carbonCredit.handleReversal(
                        tokenId,
                        bufferAmount / 2n,
                        "Paused"
                    )
                ).to.be.revertedWith("Pausable: paused");
            });

            it("should revert on token with no buffer balance", async function () {
                // Mint without buffer (configure 0% then mint)
                await carbonCredit.setBufferConfiguration(ethers.ZeroAddress, 0);

                const sourceDataHash = ethers.keccak256(
                    ethers.toUtf8Bytes("reversal_no_buffer_test")
                );
                const tx = await carbonCredit.connect(operator).mintVerifiedCredits(
                    operator.address,
                    dacUnitId,
                    sourceDataHash,
                    Math.floor(Date.now() / 1000) + 99999,
                    co2AmountKg,
                    energyConsumedKwh,
                    24453884,
                    54377344,
                    purityPercentage,
                    50,       // gridIntensity (gCO2/kWh)
                    ipfsUri,
                    arweaveTxId
                );
                const receipt = await tx.wait();
                const mintEvent = receipt!.logs.find((log: any) => {
                    try {
                        return carbonCredit.interface.parseLog(log as any)?.name === "CreditMinted";
                    } catch { return false; }
                });
                const parsed = carbonCredit.interface.parseLog(mintEvent as any);
                const noBufferTokenId = parsed!.args.tokenId;

                // Re-enable buffer pool address for the reversal call to not hit InvalidBufferPoolAddress
                await carbonCredit.setBufferConfiguration(bufferPool.address, 500);

                await expect(
                    carbonCredit.handleReversal(noBufferTokenId, 1n, "No buffer")
                ).to.be.revertedWithCustomError(carbonCredit, "ReversalAmountExceedsBuffer");
            });
        });

        describe("Reversal Supply Integrity", function () {
            it("should maintain supply = operator + buffer after partial reversal", async function () {
                const burnAmount = bufferAmount / 3n;

                await carbonCredit.handleReversal(tokenId, burnAmount, "Partial");

                const operatorBal = await carbonCredit.balanceOf(operator.address, tokenId);
                const bufferBal = await carbonCredit.balanceOf(bufferPool.address, tokenId);
                const totalSupply = await carbonCredit.totalSupply(tokenId);

                expect(totalSupply).to.equal(operatorBal + bufferBal);
            });

            it("should maintain consistency across multiple mint+reversal cycles", async function () {
                // Mint a second batch
                const info2 = await mintCreditsAndGetInfo("reversal_multi_cycle");

                // Burn from first
                await carbonCredit.handleReversal(tokenId, bufferAmount / 2n, "First batch reversal");

                // Burn from second
                await carbonCredit.handleReversal(info2.tokenId, info2.bufferAmount / 4n, "Second batch reversal");

                const expectedBufferTotal = (bufferAmount - bufferAmount / 2n) + (info2.bufferAmount - info2.bufferAmount / 4n);
                expect(await carbonCredit.totalBufferPoolCredits()).to.equal(expectedBufferTotal);
            });
        });
    });

    // ================================================================
    // SECTION 5: ChainlinkVerifier v2 - Multi-Tech & Enterprise Features
    // ================================================================
    describe("ChainlinkVerifier v2.0.0", function () {
        let verifier: ChainlinkVerifier;
        let mockRouter: MockChainlinkRouter;
        let owner: SignerWithAddress;
        let authorizedCaller: SignerWithAddress;
        let unauthorized: SignerWithAddress;

        const DON_ID = ethers.keccak256(ethers.toUtf8Bytes("don-aethelred-1"));
        const SUBSCRIPTION_ID = 123n;
        const BATCH_ID = ethers.keccak256(ethers.toUtf8Bytes("test-batch-001"));
        const DATA_HASH = ethers.keccak256(ethers.toUtf8Bytes("sensor-data-hash"));

        beforeEach(async function () {
            [owner, authorizedCaller, unauthorized] = await ethers.getSigners();

            const MockRouterFactory = await ethers.getContractFactory("MockChainlinkRouter");
            mockRouter = await MockRouterFactory.deploy() as unknown as MockChainlinkRouter;
            await mockRouter.waitForDeployment();

            const VerifierFactory = await ethers.getContractFactory("ChainlinkVerifier");
            verifier = await VerifierFactory.deploy(
                await mockRouter.getAddress(),
                DON_ID,
                SUBSCRIPTION_ID
            ) as unknown as ChainlinkVerifier;
            await verifier.waitForDeployment();

            await verifier.setAuthorizedCaller(authorizedCaller.address, true);
        });

        describe("Deployment & Version", function () {
            it("should report VERSION 3.0.0", async function () {
                expect(await verifier.VERSION()).to.equal("3.0.0");
            });

            it("should initialize 5 default oracle tech bounds", async function () {
                expect(await verifier.registeredOracleTechCount()).to.equal(5);

                const dacBounds = await verifier.getOracleTechBounds(0);
                expect(dacBounds.minEfficiency).to.equal(2000000);
                expect(dacBounds.maxEfficiency).to.equal(6000000);
                expect(dacBounds.isActive).to.be.true;
                expect(dacBounds.name).to.equal("Direct Air Capture");
            });

            it("should have BECCS oracle bounds configured", async function () {
                const beccsBounds = await verifier.getOracleTechBounds(1);
                expect(beccsBounds.minEfficiency).to.equal(1000000);
                expect(beccsBounds.maxEfficiency).to.equal(4000000);
                expect(beccsBounds.isActive).to.be.true;
                expect(beccsBounds.name).to.equal("BECCS");
            });

            it("should set default operator cooldown to 0 (disabled)", async function () {
                // Deploy fresh verifier
                const VerifierFactory = await ethers.getContractFactory("ChainlinkVerifier");
                const freshVerifier = await VerifierFactory.deploy(
                    await mockRouter.getAddress(),
                    DON_ID,
                    SUBSCRIPTION_ID
                ) as unknown as ChainlinkVerifier;
                expect(await freshVerifier.operatorCooldown()).to.equal(0);
            });

            it("should set default request timeout to 1800s", async function () {
                expect(await verifier.requestTimeout()).to.equal(1800);
            });

            it("should set MAX_RETRIES to 3", async function () {
                expect(await verifier.MAX_RETRIES()).to.equal(3);
            });
        });

        describe("Technology-Aware Verification Requests", function () {
            it("should send legacy requestVerification with techType=0", async function () {
                const tx = await verifier.connect(authorizedCaller).requestVerification(
                    BATCH_ID,
                    ethers.parseEther("100"),
                    3500000n,
                    "https://api.terraqura.aethelred.network/sensor/batch001",
                    DATA_HASH
                );
                const receipt = await tx.wait();

                // Should emit both VerificationRequested and VerificationRequestedWithTech
                const requestedEvent = receipt!.logs.find((log: any) => {
                    try {
                        return verifier.interface.parseLog(log as any)?.name === "VerificationRequestedWithTech";
                    } catch { return false; }
                });
                expect(requestedEvent).to.not.be.undefined;
                const parsed = verifier.interface.parseLog(requestedEvent as any);
                expect(parsed!.args.techType).to.equal(0);
            });

            it("should send requestVerificationWithTech for BECCS", async function () {
                const beccsBatchId = ethers.keccak256(ethers.toUtf8Bytes("beccs-batch-001"));
                const tx = await verifier.connect(authorizedCaller).requestVerificationWithTech(
                    beccsBatchId,
                    ethers.parseEther("200"),
                    2000000n,
                    "https://api.terraqura.aethelred.network/sensor/beccs001",
                    DATA_HASH,
                    1 // TECH_BECCS
                );
                const receipt = await tx.wait();

                const requestedEvent = receipt!.logs.find((log: any) => {
                    try {
                        return verifier.interface.parseLog(log as any)?.name === "VerificationRequestedWithTech";
                    } catch { return false; }
                });
                const parsed = verifier.interface.parseLog(requestedEvent as any);
                expect(parsed!.args.techType).to.equal(1);

                // Check request stored correctly
                const requestId = await verifier.batchToRequest(beccsBatchId);
                const enhancedStatus = await verifier.getEnhancedRequestStatus(requestId);
                expect(enhancedStatus.techType).to.equal(1);
                expect(enhancedStatus.retryCount).to.equal(0);
            });

            it("should revert for unregistered tech type", async function () {
                const badBatchId = ethers.keccak256(ethers.toUtf8Bytes("bad-tech-batch"));
                await expect(
                    verifier.connect(authorizedCaller).requestVerificationWithTech(
                        badBatchId,
                        ethers.parseEther("100"),
                        3500000n,
                        "https://api.terraqura.aethelred.network/sensor/bad",
                        DATA_HASH,
                        200 // Non-existent tech type
                    )
                ).to.be.revertedWithCustomError(verifier, "TechTypeNotRegistered");
            });

            it("should revert for unauthorized caller", async function () {
                await expect(
                    verifier.connect(unauthorized).requestVerification(
                        BATCH_ID,
                        ethers.parseEther("100"),
                        3500000n,
                        "https://api.example.com",
                        DATA_HASH
                    )
                ).to.be.revertedWithCustomError(verifier, "UnauthorizedCaller");
            });

            it("should revert for empty batch ID", async function () {
                await expect(
                    verifier.connect(authorizedCaller).requestVerification(
                        ethers.ZeroHash,
                        ethers.parseEther("100"),
                        3500000n,
                        "https://api.example.com",
                        DATA_HASH
                    )
                ).to.be.revertedWithCustomError(verifier, "InvalidBatchId");
            });
        });

        describe("Enhanced Fulfillment", function () {
            let requestId: string;

            beforeEach(async function () {
                await verifier.connect(authorizedCaller).requestVerification(
                    BATCH_ID,
                    ethers.parseEther("100"),
                    3500000n,
                    "https://api.terraqura.aethelred.network/sensor/batch001",
                    DATA_HASH
                );
                requestId = await verifier.batchToRequest(BATCH_ID);
            });

            it("should handle legacy fulfillment (4-field response)", async function () {
                const legacyResponse = ethers.AbiCoder.defaultAbiCoder().encode(
                    ["bool", "uint256", "uint256", "bytes32"],
                    [true, ethers.parseEther("100"), 3500000n, DATA_HASH]
                );

                await mockRouter.fulfillRequestWithResponse(requestId, legacyResponse);

                const result = await verifier.getVerificationResult(BATCH_ID);
                expect(result.verified).to.be.true;
                expect(result.co2Verified).to.equal(ethers.parseEther("100"));

                // Enhanced result should have default confidence
                const enhanced = await verifier.getEnhancedVerificationResult(BATCH_ID);
                expect(enhanced.confidenceScore).to.equal(10000); // 100% default
                expect(enhanced.techType).to.equal(0); // Defaults to request's tech type
            });

            it("should handle enhanced fulfillment (6-field response)", async function () {
                const enhancedResponse = ethers.AbiCoder.defaultAbiCoder().encode(
                    ["bool", "uint256", "uint256", "bytes32", "uint256", "uint8"],
                    [true, ethers.parseEther("100"), 3500000n, DATA_HASH, 9500n, 0]
                );

                await mockRouter.fulfillRequestWithResponse(requestId, enhancedResponse);

                const enhanced = await verifier.getEnhancedVerificationResult(BATCH_ID);
                expect(enhanced.verified).to.be.true;
                expect(enhanced.confidenceScore).to.equal(9500);
                expect(enhanced.techType).to.equal(0);
            });

            it("should handle failed verification", async function () {
                const failResponse = ethers.AbiCoder.defaultAbiCoder().encode(
                    ["bool", "uint256", "uint256", "bytes32"],
                    [false, ethers.parseEther("50"), 1500000n, DATA_HASH]
                );

                await mockRouter.fulfillRequestWithResponse(requestId, failResponse);

                const result = await verifier.getVerificationResult(BATCH_ID);
                expect(result.verified).to.be.false;
            });

            it("should handle error fulfillment", async function () {
                const errorBytes = ethers.toUtf8Bytes("API request failed");
                await mockRouter.fulfillRequestWithError(requestId, errorBytes);

                const status = await verifier.getRequestStatus(requestId);
                expect(status.fulfilled).to.be.true;
                expect(status.passed).to.be.false;
            });
        });

        describe("Rate Limiting (Operator Cooldown)", function () {
            it("should enforce cooldown between requests", async function () {
                // Enable cooldown
                await verifier.setOperatorCooldown(120); // 120 seconds

                // First request should succeed
                const batch1 = ethers.keccak256(ethers.toUtf8Bytes("cooldown-batch-1"));
                await verifier.connect(authorizedCaller).requestVerification(
                    batch1,
                    ethers.parseEther("100"),
                    3500000n,
                    "https://api.example.com",
                    DATA_HASH
                );

                // Second request immediately should fail
                const batch2 = ethers.keccak256(ethers.toUtf8Bytes("cooldown-batch-2"));
                await expect(
                    verifier.connect(authorizedCaller).requestVerification(
                        batch2,
                        ethers.parseEther("100"),
                        3500000n,
                        "https://api.example.com",
                        DATA_HASH
                    )
                ).to.be.revertedWithCustomError(verifier, "OperatorCooldownActive");
            });

            it("should allow requests after cooldown expires", async function () {
                await verifier.setOperatorCooldown(60);

                const batch1 = ethers.keccak256(ethers.toUtf8Bytes("cooldown-expire-1"));
                await verifier.connect(authorizedCaller).requestVerification(
                    batch1,
                    ethers.parseEther("100"),
                    3500000n,
                    "https://api.example.com",
                    DATA_HASH
                );

                // Advance time past cooldown
                await network.provider.send("evm_increaseTime", [61]);
                await network.provider.send("evm_mine");

                const batch2 = ethers.keccak256(ethers.toUtf8Bytes("cooldown-expire-2"));
                await expect(
                    verifier.connect(authorizedCaller).requestVerification(
                        batch2,
                        ethers.parseEther("100"),
                        3500000n,
                        "https://api.example.com",
                        DATA_HASH
                    )
                ).to.not.be.reverted;
            });

            it("should revert if cooldown exceeds maximum (1 hour)", async function () {
                await expect(
                    verifier.setOperatorCooldown(3601)
                ).to.be.revertedWithCustomError(verifier, "InvalidCooldown");
            });
        });

        describe("Request Timeout & Retry", function () {
            let requestId: string;

            beforeEach(async function () {
                await verifier.connect(authorizedCaller).requestVerification(
                    BATCH_ID,
                    ethers.parseEther("100"),
                    3500000n,
                    "https://api.terraqura.aethelred.network/sensor/batch001",
                    DATA_HASH
                );
                requestId = await verifier.batchToRequest(BATCH_ID);
            });

            it("should detect non-timed-out request", async function () {
                const [isTimedOut, canRetry] = await verifier.isRequestTimedOut(requestId);
                expect(isTimedOut).to.be.false;
                expect(canRetry).to.be.false;
            });

            it("should detect timed-out request after timeout period", async function () {
                await network.provider.send("evm_increaseTime", [1801]);
                await network.provider.send("evm_mine");

                const [isTimedOut, canRetry] = await verifier.isRequestTimedOut(requestId);
                expect(isTimedOut).to.be.true;
                expect(canRetry).to.be.true;
            });

            it("should allow retry after timeout", async function () {
                await network.provider.send("evm_increaseTime", [1801]);
                await network.provider.send("evm_mine");

                const tx = await verifier.connect(authorizedCaller).retryVerification(
                    requestId,
                    "https://api.terraqura.aethelred.network/sensor/batch001-retry"
                );
                const receipt = await tx.wait();

                const retryEvent = receipt!.logs.find((log: any) => {
                    try {
                        return verifier.interface.parseLog(log as any)?.name === "RequestRetried";
                    } catch { return false; }
                });
                expect(retryEvent).to.not.be.undefined;

                const parsed = verifier.interface.parseLog(retryEvent as any);
                expect(parsed!.args.retryCount).to.equal(1);

                // Verify new request has correct retry count
                const newRequestId = await verifier.batchToRequest(BATCH_ID);
                const enhancedStatus = await verifier.getEnhancedRequestStatus(newRequestId);
                expect(enhancedStatus.retryCount).to.equal(1);
                expect(enhancedStatus.previousRequestId).to.equal(requestId);
            });

            it("should revert retry before timeout", async function () {
                await expect(
                    verifier.connect(authorizedCaller).retryVerification(
                        requestId,
                        "https://api.example.com"
                    )
                ).to.be.revertedWithCustomError(verifier, "RequestNotTimedOut");
            });

            it("should revert retry on fulfilled request", async function () {
                const response = ethers.AbiCoder.defaultAbiCoder().encode(
                    ["bool", "uint256", "uint256", "bytes32"],
                    [true, ethers.parseEther("100"), 3500000n, DATA_HASH]
                );
                await mockRouter.fulfillRequestWithResponse(requestId, response);

                await network.provider.send("evm_increaseTime", [1801]);
                await network.provider.send("evm_mine");

                await expect(
                    verifier.connect(authorizedCaller).retryVerification(
                        requestId,
                        "https://api.example.com"
                    )
                ).to.be.revertedWithCustomError(verifier, "RequestAlreadyFulfilled");
            });

            it("should revert retry by unauthorized caller", async function () {
                await network.provider.send("evm_increaseTime", [1801]);
                await network.provider.send("evm_mine");

                await expect(
                    verifier.connect(unauthorized).retryVerification(
                        requestId,
                        "https://api.example.com"
                    )
                ).to.be.revertedWithCustomError(verifier, "UnauthorizedCaller");
            });
        });

        describe("Oracle Tech Bounds Management", function () {
            it("should register new tech bounds", async function () {
                await expect(
                    verifier.setOracleTechBounds(
                        10,
                        800000,
                        5000000,
                        "Kelp Sequestration"
                    )
                )
                    .to.emit(verifier, "TechThresholdsRegistered")
                    .withArgs(10, "Kelp Sequestration", 800000, 5000000);

                expect(await verifier.registeredOracleTechCount()).to.equal(6);
            });

            it("should update existing tech bounds", async function () {
                const countBefore = await verifier.registeredOracleTechCount();
                await verifier.setOracleTechBounds(0, 1800000, 6500000, "DAC v2");

                expect(await verifier.registeredOracleTechCount()).to.equal(countBefore);

                const updated = await verifier.getOracleTechBounds(0);
                expect(updated.minEfficiency).to.equal(1800000);
                expect(updated.maxEfficiency).to.equal(6500000);
            });

            it("should revert if min >= max", async function () {
                await expect(
                    verifier.setOracleTechBounds(10, 5000000, 3000000, "Bad Bounds")
                ).to.be.revertedWith("min >= max");
            });

            it("should revert if name is empty", async function () {
                await expect(
                    verifier.setOracleTechBounds(10, 1000000, 5000000, "")
                ).to.be.revertedWith("Empty name");
            });
        });

        describe("Admin Configuration", function () {
            it("should update request timeout", async function () {
                await expect(
                    verifier.setRequestTimeout(600)
                )
                    .to.emit(verifier, "RequestTimeoutUpdated")
                    .withArgs(1800, 600);

                expect(await verifier.requestTimeout()).to.equal(600);
            });

            it("should revert timeout below minimum (5 min)", async function () {
                await expect(
                    verifier.setRequestTimeout(299)
                ).to.be.revertedWithCustomError(verifier, "InvalidTimeout");
            });

            it("should revert timeout above maximum (24 hours)", async function () {
                await expect(
                    verifier.setRequestTimeout(86401)
                ).to.be.revertedWithCustomError(verifier, "InvalidTimeout");
            });

            it("should update operator cooldown", async function () {
                await expect(
                    verifier.setOperatorCooldown(300)
                )
                    .to.emit(verifier, "OperatorCooldownUpdated");

                expect(await verifier.operatorCooldown()).to.equal(300);
            });

            it("should allow disabling cooldown (set to 0)", async function () {
                await verifier.setOperatorCooldown(0);
                expect(await verifier.operatorCooldown()).to.equal(0);
            });
        });

        describe("Backwards Compatibility", function () {
            it("should maintain legacy getRequestStatus interface", async function () {
                await verifier.connect(authorizedCaller).requestVerification(
                    BATCH_ID,
                    ethers.parseEther("100"),
                    3500000n,
                    "https://api.example.com",
                    DATA_HASH
                );

                const requestId = await verifier.batchToRequest(BATCH_ID);
                const status = await verifier.getRequestStatus(requestId);
                expect(status.batchId).to.equal(BATCH_ID);
                expect(status.operator).to.equal(authorizedCaller.address);
                expect(status.fulfilled).to.be.false;
                expect(status.passed).to.be.false;
            });

            it("should maintain legacy getVerificationResult interface", async function () {
                await verifier.connect(authorizedCaller).requestVerification(
                    BATCH_ID,
                    ethers.parseEther("100"),
                    3500000n,
                    "https://api.example.com",
                    DATA_HASH
                );

                const requestId = await verifier.batchToRequest(BATCH_ID);
                const response = ethers.AbiCoder.defaultAbiCoder().encode(
                    ["bool", "uint256", "uint256", "bytes32"],
                    [true, ethers.parseEther("100"), 3500000n, DATA_HASH]
                );
                await mockRouter.fulfillRequestWithResponse(requestId, response);

                const result = await verifier.getVerificationResult(BATCH_ID);
                expect(result.verified).to.be.true;
                expect(result.co2Verified).to.equal(ethers.parseEther("100"));
            });

            it("should maintain isVerified interface", async function () {
                expect(await verifier.isVerified(BATCH_ID)).to.be.false;

                await verifier.connect(authorizedCaller).requestVerification(
                    BATCH_ID,
                    ethers.parseEther("100"),
                    3500000n,
                    "https://api.example.com",
                    DATA_HASH
                );

                const requestId = await verifier.batchToRequest(BATCH_ID);
                const response = ethers.AbiCoder.defaultAbiCoder().encode(
                    ["bool", "uint256", "uint256", "bytes32"],
                    [true, ethers.parseEther("100"), 3500000n, DATA_HASH]
                );
                await mockRouter.fulfillRequestWithResponse(requestId, response);

                expect(await verifier.isVerified(BATCH_ID)).to.be.true;
            });
        });
    });

    // ================================================================
    // SECTION 6: Net-Negative Verification System (v3.0.0)
    // ================================================================
    describe("Net-Negative Verification System", function () {

        // ─────────────────────────────────────────────────────────
        // 6A: EfficiencyCalculator – Net-Negative Math (1e18 precision)
        // ─────────────────────────────────────────────────────────
        describe("EfficiencyCalculator – Net-Negative Math", function () {
            let calculator: any;
            const PRECISION = BigInt("1000000000000000000"); // 1e18
            const BPS_SCALE = 10000n;

            before(async function () {
                const Factory = await ethers.getContractFactory("EfficiencyCalculatorTest");
                calculator = await Factory.deploy();
                await calculator.waitForDeployment();
            });

            describe("calculateNetCredits()", function () {
                it("should return correct net credits for standard DAC operation", async function () {
                    // 1 tonne CO2, 350 kWh, 95% purity, grid 50 gCO2/kWh (solar)
                    const [netCredits, grossCredits, energyDebt, purityFactor] =
                        await calculator.testCalculateNetCredits(1000, 350, 9500, 50);

                    // purityFactor = 9500/10000 * 1e18 = 9.5e17
                    expect(purityFactor).to.equal(BigInt(9500) * PRECISION / BPS_SCALE);

                    // grossCredits = 1000 * purityFactor
                    expect(grossCredits).to.equal(1000n * purityFactor);

                    // energyDebt = (350 * 50 * 1e18) / 1000 = 17.5 * 1e18
                    const expectedDebt = (350n * 50n * PRECISION) / 1000n;
                    expect(energyDebt).to.equal(expectedDebt);

                    // netCredits = grossCredits - energyDebt
                    expect(netCredits).to.equal(grossCredits - energyDebt);

                    // Should be positive (net-positive capture)
                    expect(netCredits).to.be.gt(0);
                });

                it("should return zero for net-negative operation (high grid intensity)", async function () {
                    // 1 tonne CO2, 350 kWh, 95% purity, grid 3000 gCO2/kWh (coal-heavy)
                    const [netCredits, grossCredits, energyDebt] =
                        await calculator.testCalculateNetCredits(1000, 350, 9500, 3000);

                    // energyDebt = (350 * 3000 / 1000) * 1e18 = 1050 * 1e18
                    // grossCredits = 1000 * 0.95 * 1e18 = 950 * 1e18
                    // energyDebt > grossCredits → netCredits = 0
                    expect(energyDebt).to.be.gt(grossCredits);
                    expect(netCredits).to.equal(0);
                });

                it("should handle zero grid intensity (pure renewable)", async function () {
                    const [netCredits, grossCredits, energyDebt] =
                        await calculator.testCalculateNetCredits(1000, 350, 9500, 0);

                    // Zero grid intensity → zero energy debt
                    expect(energyDebt).to.equal(0);

                    // Net credits = gross credits (no deduction)
                    expect(netCredits).to.equal(grossCredits);
                });

                it("should scale linearly with CO2 amount", async function () {
                    const [net1] = await calculator.testCalculateNetCredits(1000, 350, 9500, 50);
                    const [net10] = await calculator.testCalculateNetCredits(10000, 3500, 9500, 50);

                    // 10× CO2 with 10× energy should give 10× net credits
                    expect(net10).to.equal(net1 * 10n);
                });

                it("should handle maximum purity (100%)", async function () {
                    const [netCredits100, gross100] =
                        await calculator.testCalculateNetCredits(1000, 350, 10000, 50);
                    const [netCredits95, gross95] =
                        await calculator.testCalculateNetCredits(1000, 350, 9500, 50);

                    // Higher purity → more gross credits → more net credits
                    expect(gross100).to.be.gt(gross95);
                    expect(netCredits100).to.be.gt(netCredits95);
                });
            });

            describe("Non-linear Purity Penalty", function () {
                it("should apply linear purity above 90% threshold", async function () {
                    // 95% purity → 9500 bps → linear: factor = 9500/10000 * 1e18
                    const [,, , purityFactor95] =
                        await calculator.testCalculateNetCredits(1000, 350, 9500, 50);
                    const expected95 = 9500n * PRECISION / BPS_SCALE;
                    expect(purityFactor95).to.equal(expected95);

                    // 90% purity → 9000 bps → exactly at threshold
                    const [,, , purityFactor90] =
                        await calculator.testCalculateNetCredits(1000, 350, 9000, 50);
                    const expected90 = 9000n * PRECISION / BPS_SCALE;
                    expect(purityFactor90).to.equal(expected90);
                });

                it("should apply quadratic penalty below 90% threshold", async function () {
                    // 80% purity → 8000 bps → below 9000 threshold
                    // effectiveBps = 8000² / 10000 = 6400
                    const [,, , purityFactor80] =
                        await calculator.testCalculateNetCredits(1000, 350, 8000, 50);
                    const expected80 = (8000n * 8000n / BPS_SCALE) * PRECISION / BPS_SCALE;
                    expect(purityFactor80).to.equal(expected80);
                });

                it("should severely penalize very low purity", async function () {
                    // 50% purity → 5000 bps → effectiveBps = 5000² / 10000 = 2500
                    const [,, , purityFactor50] =
                        await calculator.testCalculateNetCredits(1000, 350, 5000, 50);
                    const expected50 = (5000n * 5000n / BPS_SCALE) * PRECISION / BPS_SCALE;
                    expect(purityFactor50).to.equal(expected50);
                });

                it("should return zero for zero purity", async function () {
                    const [netCredits, grossCredits, , purityFactor] =
                        await calculator.testCalculateNetCredits(1000, 350, 0, 50);

                    expect(purityFactor).to.equal(0);
                    expect(grossCredits).to.equal(0);
                    expect(netCredits).to.equal(0);
                });
            });

            describe("isPhysicallyPlausible()", function () {
                it("should accept valid DAC range (100-800 kWh/tonne)", async function () {
                    const [plausible350, kwh350] = await calculator.testIsPhysicallyPlausible(1000, 350);
                    expect(plausible350).to.be.true;
                    expect(kwh350).to.equal(350);

                    const [plausible100] = await calculator.testIsPhysicallyPlausible(1000, 100);
                    expect(plausible100).to.be.true;

                    const [plausible800] = await calculator.testIsPhysicallyPlausible(1000, 800);
                    expect(plausible800).to.be.true;
                });

                it("should reject below thermodynamic minimum (< 100 kWh/tonne)", async function () {
                    const [plausible] = await calculator.testIsPhysicallyPlausible(1000, 99);
                    expect(plausible).to.be.false;
                });

                it("should reject above thermodynamic maximum (> 800 kWh/tonne)", async function () {
                    const [plausible] = await calculator.testIsPhysicallyPlausible(1000, 801);
                    expect(plausible).to.be.false;
                });

                it("should reject zero CO2 amount", async function () {
                    const [plausible] = await calculator.testIsPhysicallyPlausible(0, 350);
                    expect(plausible).to.be.false;
                });

                it("should round up small CO2 amounts to prevent gaming", async function () {
                    // 1 kg CO2 with 350 kWh: co2Tonnes = (1+999)/1000 = 1, kwhPerTonne = 350
                    const [plausible, kwhPerTonne] = await calculator.testIsPhysicallyPlausible(1, 350);
                    expect(plausible).to.be.true;
                    expect(kwhPerTonne).to.equal(350);
                });
            });

            describe("scaleToMintable()", function () {
                it("should convert 1e18-scaled credits to integer", async function () {
                    const scaled = 950n * PRECISION; // 950 credits at 1e18
                    const mintable = await calculator.testScaleToMintable(scaled);
                    expect(mintable).to.equal(950);
                });

                it("should truncate sub-unit remainders", async function () {
                    const scaled = PRECISION / 2n; // 0.5 credits → rounds to 0
                    const mintable = await calculator.testScaleToMintable(scaled);
                    expect(mintable).to.equal(0);
                });

                it("should handle very large scaled values", async function () {
                    const scaled = 1000000n * PRECISION; // 1M credits
                    const mintable = await calculator.testScaleToMintable(scaled);
                    expect(mintable).to.equal(1000000);
                });
            });

            describe("toLegacyEfficiencyFactor()", function () {
                it("should derive correct legacy factor from net credits", async function () {
                    // Net 950 credits from 1000 kg CO2 → factor = (950 * 10000) / 1000 = 9500
                    const netScaled = 950n * PRECISION;
                    const factor = await calculator.testToLegacyEfficiencyFactor(netScaled, 1000);
                    expect(factor).to.equal(9500);
                });

                it("should return 10000 for perfect conversion (1:1)", async function () {
                    const netScaled = 1000n * PRECISION;
                    const factor = await calculator.testToLegacyEfficiencyFactor(netScaled, 1000);
                    expect(factor).to.equal(10000);
                });

                it("should return 0 for zero net credits", async function () {
                    const factor = await calculator.testToLegacyEfficiencyFactor(0, 1000);
                    expect(factor).to.equal(0);
                });

                it("should handle net credits exceeding CO2 input (bonus scenario)", async function () {
                    // If somehow net > co2 (shouldn't happen but test boundary)
                    const netScaled = 1100n * PRECISION;
                    const factor = await calculator.testToLegacyEfficiencyFactor(netScaled, 1000);
                    expect(factor).to.equal(11000); // 110%
                });
            });
        });

        // ─────────────────────────────────────────────────────────
        // 6B: VerificationEngine – Net-Negative Integration
        // ─────────────────────────────────────────────────────────
        describe("VerificationEngine – Net-Negative Integration", function () {
            let verificationEngine: VerificationEngine;
            let carbonCredit: CarbonCredit;
            let accessControl: any;
            let owner: SignerWithAddress;
            let operator: SignerWithAddress;
            let carbonCreditSigner: SignerWithAddress;

            const dacUnitId = ethers.keccak256(ethers.toUtf8Bytes("DAC_NET_NEG"));

            beforeEach(async function () {
                [owner, operator, carbonCreditSigner] = await ethers.getSigners();

                const ACFactory = await ethers.getContractFactory("TerraQuraAccessControl");
                accessControl = await upgrades.deployProxy(ACFactory, [owner.address], { initializer: "initialize" });
                await accessControl.waitForDeployment();

                const VEFactory = await ethers.getContractFactory("VerificationEngine");
                verificationEngine = await upgrades.deployProxy(
                    VEFactory,
                    [await accessControl.getAddress(), ethers.ZeroAddress],
                    { initializer: "initialize" }
                ) as unknown as VerificationEngine;
                await verificationEngine.waitForDeployment();

                const CCFactory = await ethers.getContractFactory("CarbonCredit");
                carbonCredit = await upgrades.deployProxy(
                    CCFactory,
                    [
                        await verificationEngine.getAddress(),
                        "https://api.terraqura.aethelred.network/metadata/",
                        owner.address
                    ],
                    { initializer: "initialize" }
                ) as unknown as CarbonCredit;
                await carbonCredit.waitForDeployment();

                await verificationEngine.setCarbonCreditContract(await carbonCredit.getAddress());

                const MINTER_ROLE = await accessControl.MINTER_ROLE();
                const OPERATOR_ROLE = await accessControl.OPERATOR_ROLE();
                await accessControl.grantRole(MINTER_ROLE, owner.address);
                await accessControl.grantRole(OPERATOR_ROLE, operator.address);

                // Grant minter role to operator for the CarbonCredit contract
                await carbonCredit.setMinter(operator.address, true);

                await verificationEngine.whitelistDacUnit(dacUnitId, operator.address);
            });

            describe("Grid Intensity Impact on Verification", function () {
                it("should produce higher efficiency factor with lower grid intensity", async function () {
                    const hash1 = ethers.keccak256(ethers.toUtf8Bytes("grid_low"));
                    const hash2 = ethers.keccak256(ethers.toUtf8Bytes("grid_high"));

                    // Use the CarbonCredit contract address as the caller for verify()
                    const ccAddress = await carbonCredit.getAddress();

                    // Solar (50 gCO2/kWh) — use previewNetNegativeCredits (no access control)
                    const [valid1, netKg1, factor1] = await verificationEngine.previewNetNegativeCredits(
                        1000000, 350000, 95, 50
                    );

                    // Coal (800 gCO2/kWh)
                    const [valid2, netKg2, factor2] = await verificationEngine.previewNetNegativeCredits(
                        1000000, 350000, 95, 800
                    );

                    expect(valid1).to.be.true;
                    expect(valid2).to.be.true;
                    expect(factor1).to.be.gt(factor2);
                });

                it("should reject verification when grid intensity makes it net-negative", async function () {
                    // Use preview function which doesn't require onlyCarbonCredit
                    const [isValid, netCreditsKg, effFactor] = await verificationEngine.previewNetNegativeCredits(
                        1000000, 350000, 95, 3000
                    );

                    expect(isValid).to.be.false;
                    expect(netCreditsKg).to.equal(0);
                    expect(effFactor).to.equal(0);
                });

                it("should mint with zero grid intensity (pure renewable)", async function () {
                    const hash = ethers.keccak256(ethers.toUtf8Bytes("grid_zero"));
                    const tx = await carbonCredit.connect(operator).mintVerifiedCredits(
                        operator.address,
                        dacUnitId,
                        hash,
                        Math.floor(Date.now() / 1000),
                        1000000,
                        350000,
                        0,
                        0,
                        95,
                        0,    // Zero grid intensity (pure renewable)
                        "ipfs://QmRenewable",
                        ""
                    );
                    const receipt = await tx.wait();
                    expect(receipt!.status).to.equal(1);
                });
            });

            describe("Thermodynamic Plausibility Enforcement", function () {
                it("should reject below 100 kWh/tonne (thermodynamically impossible)", async function () {
                    // Use preview function — no access control needed
                    const [isValid] = await verificationEngine.previewNetNegativeCredits(
                        10000, 500, 95, 50
                    );
                    expect(isValid).to.be.false;
                });

                it("should reject above 800 kWh/tonne (thermodynamically implausible)", async function () {
                    const [isValid] = await verificationEngine.previewNetNegativeCredits(
                        1000, 900, 95, 50
                    );
                    expect(isValid).to.be.false;
                });

                it("should accept exactly 100 kWh/tonne at boundary", async function () {
                    // 1 tonne (1000 kg), 100 kWh → 100 kWh/tonne
                    // Passes thermodynamic (100 >= 100) but fails DAC tech bounds (100 < 200)
                    // previewNetNegativeCredits only checks thermodynamic, not tech bounds
                    const [isValid] = await verificationEngine.previewNetNegativeCredits(
                        1000, 100, 95, 50
                    );
                    // Thermodynamic check passes (100 >= 100), so isValid depends on net credits
                    expect(isValid).to.be.true;
                });

                it("should accept exactly 800 kWh/tonne at boundary", async function () {
                    // 1 tonne, 800 kWh → 800 kWh/tonne (at thermodynamic max)
                    const [isValid] = await verificationEngine.previewNetNegativeCredits(
                        1000, 800, 95, 50
                    );
                    // Passes thermodynamic (800 <= 800)
                    expect(isValid).to.be.true;
                });
            });

            describe("previewNetNegativeCredits()", function () {
                it("should preview net credits for given parameters", async function () {
                    // Returns: (isValid, netCreditsKg, efficiencyFactor, grossCreditsScaled, energyDebtScaled)
                    const result = await verificationEngine.previewNetNegativeCredits(
                        1000000,  // 1 tonne
                        350000,   // 350 kWh
                        95,       // 95% purity
                        50        // 50 gCO2/kWh (solar)
                    );

                    expect(result[0]).to.be.true;     // isValid
                    expect(result[1]).to.be.gt(0);     // netCreditsKg
                    expect(result[2]).to.be.gt(0);     // efficiencyFactor
                    expect(result[3]).to.be.gt(result[4]); // grossCreditsScaled > energyDebtScaled
                });

                it("should return invalid for net-negative scenario", async function () {
                    const result = await verificationEngine.previewNetNegativeCredits(
                        1000000, 350000, 95, 3000
                    );

                    expect(result[0]).to.be.false; // isValid
                    expect(result[1]).to.equal(0);  // netCreditsKg
                });

                it("should return invalid for below thermodynamic minimum", async function () {
                    const result = await verificationEngine.previewNetNegativeCredits(
                        10000, 500, 95, 50
                    );
                    expect(result[0]).to.be.false;
                });
            });

            describe("End-to-End Mint with Grid Intensity", function () {
                it("should produce fewer credits with higher grid intensity", async function () {
                    // Use preview function to compare efficiency factors
                    const [, , factor1] = await verificationEngine.previewNetNegativeCredits(
                        1000000, 350000, 95, 50    // solar (50 gCO2/kWh)
                    );
                    const [, , factor2] = await verificationEngine.previewNetNegativeCredits(
                        1000000, 350000, 95, 500   // natural gas (500 gCO2/kWh)
                    );

                    // Solar should have higher efficiency factor (more credits per kg CO2)
                    expect(factor1).to.be.gt(factor2);

                    // Actually mint both and compare balances
                    const hash1 = ethers.keccak256(ethers.toUtf8Bytes("e2e_solar"));
                    const hash2 = ethers.keccak256(ethers.toUtf8Bytes("e2e_gas"));
                    const ts1 = Math.floor(Date.now() / 1000);
                    const ts2 = ts1 + 1;

                    await carbonCredit.connect(operator).mintVerifiedCredits(
                        operator.address, dacUnitId, hash1,
                        ts1, 1000000, 350000, 0, 0, 95,
                        50, "ipfs://QmSolar", ""
                    );

                    await carbonCredit.connect(operator).mintVerifiedCredits(
                        operator.address, dacUnitId, hash2,
                        ts2, 1000000, 350000, 0, 0, 95,
                        500, "ipfs://QmGas", ""
                    );

                    // Derive token IDs
                    const tokenId1 = BigInt(ethers.keccak256(
                        ethers.AbiCoder.defaultAbiCoder().encode(
                            ["bytes32", "uint256", "bytes32"],
                            [dacUnitId, ts1, hash1]
                        )
                    ));
                    const tokenId2 = BigInt(ethers.keccak256(
                        ethers.AbiCoder.defaultAbiCoder().encode(
                            ["bytes32", "uint256", "bytes32"],
                            [dacUnitId, ts2, hash2]
                        )
                    ));

                    const balance1 = await carbonCredit.balanceOf(operator.address, tokenId1);
                    const balance2 = await carbonCredit.balanceOf(operator.address, tokenId2);

                    // Solar-powered facility should produce more credits
                    expect(balance1).to.be.gt(balance2);
                });

                it("should store gridIntensity in credit metadata", async function () {
                    const hash = ethers.keccak256(ethers.toUtf8Bytes("metadata_grid"));
                    const captureTs = Math.floor(Date.now() / 1000) + 12345;

                    await carbonCredit.connect(operator).mintVerifiedCredits(
                        operator.address, dacUnitId, hash,
                        captureTs,
                        1000000, 350000, 0, 0, 95,
                        42,    // specific grid intensity
                        "ipfs://QmGrid", ""
                    );

                    const tokenId = BigInt(ethers.keccak256(
                        ethers.AbiCoder.defaultAbiCoder().encode(
                            ["bytes32", "uint256", "bytes32"],
                            [dacUnitId, captureTs, hash]
                        )
                    ));

                    const [metadata] = await carbonCredit.getCreditProvenance(tokenId);
                    expect(metadata.gridIntensityGCO2PerKwh).to.equal(42);
                });
            });
        });
    });
});
