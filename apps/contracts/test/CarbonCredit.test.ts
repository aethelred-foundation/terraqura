import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { CarbonCredit, VerificationEngine } from "../typechain-types";

describe("CarbonCredit", function () {
    let carbonCredit: CarbonCredit;
    let verificationEngine: VerificationEngine;
    let owner: SignerWithAddress;
    let operator: SignerWithAddress;
    let buyer: SignerWithAddress;
    let unauthorized: SignerWithAddress;

    // Test data
    const dacUnitId = ethers.keccak256(ethers.toUtf8Bytes("DAC_UNIT_001"));
    const sourceDataHash = ethers.keccak256(ethers.toUtf8Bytes("sensor_data_batch_001"));
    const captureTimestamp = Math.floor(Date.now() / 1000);
    const co2AmountKg = 1000000; // 1000 kg = 1 tonne
    const energyConsumedKwh = 350000; // 350 kWh (optimal efficiency)
    const latitude = 24453884; // Abu Dhabi (scaled by 1e6)
    const longitude = 54377344;
    const purityPercentage = 98;
    const ipfsMetadataUri = "ipfs://QmTest123456789";
    const arweaveBackupTxId = "arweave_tx_123";
    const gridIntensity = 50;

    beforeEach(async function () {
        [owner, operator, buyer, unauthorized] = await ethers.getSigners();

        // Deploy VerificationEngine (upgradeable)
        const VerificationEngineFactory = await ethers.getContractFactory("VerificationEngine");
        verificationEngine = await upgrades.deployProxy(
            VerificationEngineFactory,
            [ethers.ZeroAddress, ethers.ZeroAddress],
            { initializer: "initialize" }
        ) as unknown as VerificationEngine;
        await verificationEngine.waitForDeployment();

        // Deploy CarbonCredit (upgradeable)
        const CarbonCreditFactory = await ethers.getContractFactory("CarbonCredit");
        carbonCredit = await upgrades.deployProxy(
            CarbonCreditFactory,
            [await verificationEngine.getAddress(), "ipfs://", owner.address],
            { initializer: "initialize" }
        ) as unknown as CarbonCredit;
        await carbonCredit.waitForDeployment();

        // Configure VerificationEngine to point to CarbonCredit
        await verificationEngine.setCarbonCreditContract(await carbonCredit.getAddress());

        // Whitelist DAC unit
        await verificationEngine.whitelistDacUnit(dacUnitId, operator.address);

        // Approve operator as minter
        await carbonCredit.setMinter(operator.address, true);
    });

    describe("Deployment & Initialization", function () {
        it("should set the correct owner", async function () {
            expect(await carbonCredit.owner()).to.equal(owner.address);
        });

        it("should set the correct verification engine", async function () {
            expect(await carbonCredit.verificationEngine()).to.equal(
                await verificationEngine.getAddress()
            );
        });

        it("should have correct version", async function () {
            expect(await carbonCredit.version()).to.equal("3.0.0");
        });

        it("should have correct scale constant", async function () {
            expect(await carbonCredit.SCALE()).to.equal(10000);
        });

        it("should start with zero credits minted", async function () {
            expect(await carbonCredit.totalCreditsMinted()).to.equal(0);
        });

        it("should start with zero credits retired", async function () {
            expect(await carbonCredit.totalCreditsRetired()).to.equal(0);
        });

        it("should revert initialization with zero verification engine", async function () {
            const CarbonCreditFactory = await ethers.getContractFactory("CarbonCredit");
            await expect(
                upgrades.deployProxy(
                    CarbonCreditFactory,
                    [ethers.ZeroAddress, "ipfs://", owner.address],
                    { initializer: "initialize" }
                )
            ).to.be.revertedWithCustomError(carbonCredit, "InvalidVerificationEngine");
        });

        it("should transfer ownership to different owner on initialization", async function () {
            // Deploy new CarbonCredit with different owner
            const CarbonCreditFactory = await ethers.getContractFactory("CarbonCredit");
            const newOwner = buyer; // Different from deployer

            const newCarbonCredit = await upgrades.deployProxy(
                CarbonCreditFactory,
                [await verificationEngine.getAddress(), "ipfs://test/", newOwner.address],
                { initializer: "initialize" }
            );
            await newCarbonCredit.waitForDeployment();

            // Owner should be newOwner, not deployer
            expect(await newCarbonCredit.owner()).to.equal(newOwner.address);
        });
    });

    describe("Minter Management", function () {
        it("should approve a minter", async function () {
            await expect(carbonCredit.setMinter(buyer.address, true))
                .to.emit(carbonCredit, "MinterUpdated")
                .withArgs(buyer.address, true);

            expect(await carbonCredit.isMinter(buyer.address)).to.be.true;
        });

        it("should revoke a minter", async function () {
            await carbonCredit.setMinter(buyer.address, true);
            await carbonCredit.setMinter(buyer.address, false);

            expect(await carbonCredit.isMinter(buyer.address)).to.be.false;
        });

        it("should recognize owner as minter", async function () {
            expect(await carbonCredit.isMinter(owner.address)).to.be.true;
        });

        it("should only allow owner to set minter", async function () {
            await expect(
                carbonCredit.connect(unauthorized).setMinter(buyer.address, true)
            ).to.be.reverted;
        });
    });

    describe("Minting Credits", function () {
        it("should mint credits with valid verification", async function () {
            const tx = await carbonCredit.connect(operator).mintVerifiedCredits(
                buyer.address,
                dacUnitId,
                sourceDataHash,
                captureTimestamp,
                co2AmountKg,
                energyConsumedKwh,
                latitude,
                longitude,
                purityPercentage,
                gridIntensity,
                ipfsMetadataUri,
                arweaveBackupTxId
            );

            await expect(tx).to.emit(carbonCredit, "CreditMinted");
            await expect(tx).to.emit(carbonCredit, "VerificationCompleted");
        });

        it("should update total credits minted", async function () {
            await carbonCredit.connect(operator).mintVerifiedCredits(
                buyer.address,
                dacUnitId,
                sourceDataHash,
                captureTimestamp,
                co2AmountKg,
                energyConsumedKwh,
                latitude,
                longitude,
                purityPercentage,
                gridIntensity,
                ipfsMetadataUri,
                arweaveBackupTxId
            );

            expect(await carbonCredit.totalCreditsMinted()).to.be.gt(0);
        });

        it("should store correct metadata", async function () {
            await carbonCredit.connect(operator).mintVerifiedCredits(
                buyer.address,
                dacUnitId,
                sourceDataHash,
                captureTimestamp,
                co2AmountKg,
                energyConsumedKwh,
                latitude,
                longitude,
                purityPercentage,
                gridIntensity,
                ipfsMetadataUri,
                arweaveBackupTxId
            );

            // Get token ID from events or calculate it
            const tokenId = BigInt(ethers.keccak256(
                ethers.AbiCoder.defaultAbiCoder().encode(
                    ["bytes32", "uint256", "bytes32"],
                    [dacUnitId, captureTimestamp, sourceDataHash]
                )
            ));

            const metadata = await carbonCredit.getMetadata(tokenId);
            expect(metadata.dacUnitId).to.equal(dacUnitId);
            expect(metadata.co2AmountKg).to.equal(co2AmountKg);
            expect(metadata.ipfsMetadataUri).to.equal(ipfsMetadataUri);
        });

        it("should reject duplicate data hash", async function () {
            await carbonCredit.connect(operator).mintVerifiedCredits(
                buyer.address,
                dacUnitId,
                sourceDataHash,
                captureTimestamp,
                co2AmountKg,
                energyConsumedKwh,
                latitude,
                longitude,
                purityPercentage,
                gridIntensity,
                ipfsMetadataUri,
                arweaveBackupTxId
            );

            // Try to mint with same hash
            await expect(
                carbonCredit.connect(operator).mintVerifiedCredits(
                    buyer.address,
                    dacUnitId,
                    sourceDataHash, // Same hash
                    captureTimestamp + 1,
                    co2AmountKg,
                    energyConsumedKwh,
                    latitude,
                    longitude,
                    purityPercentage,
                    gridIntensity,
                    ipfsMetadataUri,
                    arweaveBackupTxId
                )
            ).to.be.revertedWithCustomError(carbonCredit, "DataHashAlreadyUsed");
        });

        it("should reject empty metadata URI", async function () {
            await expect(
                carbonCredit.connect(operator).mintVerifiedCredits(
                    buyer.address,
                    dacUnitId,
                    sourceDataHash,
                    captureTimestamp,
                    co2AmountKg,
                    energyConsumedKwh,
                    latitude,
                    longitude,
                    purityPercentage,
                    gridIntensity,
                    "", // Empty URI
                    arweaveBackupTxId
                )
            ).to.be.revertedWithCustomError(carbonCredit, "EmptyMetadataUri");
        });

        it("should reject unauthorized minter", async function () {
            await expect(
                carbonCredit.connect(unauthorized).mintVerifiedCredits(
                    buyer.address,
                    dacUnitId,
                    sourceDataHash,
                    captureTimestamp,
                    co2AmountKg,
                    energyConsumedKwh,
                    latitude,
                    longitude,
                    purityPercentage,
                    gridIntensity,
                    ipfsMetadataUri,
                    arweaveBackupTxId
                )
            ).to.be.revertedWithCustomError(carbonCredit, "UnauthorizedMinter");
        });

        it("should reject non-whitelisted DAC unit", async function () {
            const unknownDacId = ethers.keccak256(ethers.toUtf8Bytes("UNKNOWN_DAC"));

            await expect(
                carbonCredit.connect(operator).mintVerifiedCredits(
                    buyer.address,
                    unknownDacId,
                    ethers.keccak256(ethers.toUtf8Bytes("new_hash")),
                    captureTimestamp,
                    co2AmountKg,
                    energyConsumedKwh,
                    latitude,
                    longitude,
                    purityPercentage,
                    gridIntensity,
                    ipfsMetadataUri,
                    arweaveBackupTxId
                )
            ).to.be.revertedWithCustomError(carbonCredit, "VerificationFailed");
        });

        it("should reject suspiciously efficient data", async function () {
            await expect(
                carbonCredit.connect(operator).mintVerifiedCredits(
                    buyer.address,
                    dacUnitId,
                    ethers.keccak256(ethers.toUtf8Bytes("efficient_hash")),
                    captureTimestamp,
                    co2AmountKg,
                    100000, // Only 100 kWh for 1 tonne - too efficient
                    latitude,
                    longitude,
                    purityPercentage,
                    gridIntensity,
                    ipfsMetadataUri,
                    arweaveBackupTxId
                )
            ).to.be.revertedWithCustomError(carbonCredit, "VerificationFailed");
        });

        it("should reject low purity data", async function () {
            await expect(
                carbonCredit.connect(operator).mintVerifiedCredits(
                    buyer.address,
                    dacUnitId,
                    ethers.keccak256(ethers.toUtf8Bytes("low_purity_hash")),
                    captureTimestamp,
                    co2AmountKg,
                    energyConsumedKwh,
                    latitude,
                    longitude,
                    80, // Below 90% minimum
                    gridIntensity,
                    ipfsMetadataUri,
                    arweaveBackupTxId
                )
            ).to.be.revertedWithCustomError(carbonCredit, "VerificationFailed");
        });
    });

    describe("Credit Retirement", function () {
        let tokenId: bigint;

        beforeEach(async function () {
            await carbonCredit.connect(operator).mintVerifiedCredits(
                buyer.address,
                dacUnitId,
                sourceDataHash,
                captureTimestamp,
                co2AmountKg,
                energyConsumedKwh,
                latitude,
                longitude,
                purityPercentage,
                gridIntensity,
                ipfsMetadataUri,
                arweaveBackupTxId
            );

            // Calculate token ID
            tokenId = BigInt(ethers.keccak256(
                ethers.AbiCoder.defaultAbiCoder().encode(
                    ["bytes32", "uint256", "bytes32"],
                    [dacUnitId, captureTimestamp, sourceDataHash]
                )
            ));
        });

        it("should retire credits", async function () {
            const balance = await carbonCredit.balanceOf(buyer.address, tokenId);
            const retireAmount = balance / BigInt(2);

            await expect(
                carbonCredit.connect(buyer).retireCredits(tokenId, retireAmount, "Carbon offset for company X")
            ).to.emit(carbonCredit, "CreditRetired");
        });

        it("should update total credits retired", async function () {
            const balance = await carbonCredit.balanceOf(buyer.address, tokenId);
            await carbonCredit.connect(buyer).retireCredits(tokenId, balance, "Full retirement");

            expect(await carbonCredit.totalCreditsRetired()).to.equal(balance);
        });

        it("should reject retirement with insufficient balance", async function () {
            const balance = await carbonCredit.balanceOf(buyer.address, tokenId);

            await expect(
                carbonCredit.connect(buyer).retireCredits(tokenId, balance + BigInt(1), "Too much")
            ).to.be.revertedWithCustomError(carbonCredit, "InsufficientBalance");
        });

        it("should reject retirement by non-holder", async function () {
            await expect(
                carbonCredit.connect(unauthorized).retireCredits(tokenId, 1, "Not owner")
            ).to.be.revertedWithCustomError(carbonCredit, "InsufficientBalance");
        });
    });

    describe("Provenance & Metadata", function () {
        let tokenId: bigint;

        beforeEach(async function () {
            await carbonCredit.connect(operator).mintVerifiedCredits(
                buyer.address,
                dacUnitId,
                sourceDataHash,
                captureTimestamp,
                co2AmountKg,
                energyConsumedKwh,
                latitude,
                longitude,
                purityPercentage,
                gridIntensity,
                ipfsMetadataUri,
                arweaveBackupTxId
            );

            tokenId = BigInt(ethers.keccak256(
                ethers.AbiCoder.defaultAbiCoder().encode(
                    ["bytes32", "uint256", "bytes32"],
                    [dacUnitId, captureTimestamp, sourceDataHash]
                )
            ));
        });

        it("should return correct provenance data", async function () {
            const [metadata, verification] = await carbonCredit.getCreditProvenance(tokenId);

            expect(metadata.dacUnitId).to.equal(dacUnitId);
            expect(metadata.sourceDataHash).to.equal(sourceDataHash);
            expect(metadata.co2AmountKg).to.equal(co2AmountKg);
            expect(metadata.purityPercentage).to.equal(purityPercentage);

            expect(verification.sourceVerified).to.be.true;
            expect(verification.logicVerified).to.be.true;
            expect(verification.mintVerified).to.be.true;
            expect(verification.efficiencyFactor).to.be.gt(0);
        });

        it("should return correct URI", async function () {
            const uri = await carbonCredit.uri(tokenId);
            expect(uri).to.equal(ipfsMetadataUri);
        });

        it("should return base URI for non-existent token", async function () {
            const nonExistentTokenId = 999;
            const uri = await carbonCredit.uri(nonExistentTokenId);
            expect(uri).to.equal("ipfs://");
        });

        it("should check if token exists", async function () {
            expect(await carbonCredit.exists(tokenId)).to.be.true;
            expect(await carbonCredit.exists(999)).to.be.false;
        });

        it("should return verification result", async function () {
            const result = await carbonCredit.getVerificationResult(tokenId);
            expect(result.sourceVerified).to.be.true;
            expect(result.logicVerified).to.be.true;
            expect(result.mintVerified).to.be.true;
        });
    });

    describe("Admin Functions", function () {
        it("should update verification engine", async function () {
            const VerificationEngineFactory = await ethers.getContractFactory("VerificationEngine");
            const newEngine = await upgrades.deployProxy(
                VerificationEngineFactory,
                [ethers.ZeroAddress, ethers.ZeroAddress],
                { initializer: "initialize" }
            );

            await expect(carbonCredit.setVerificationEngine(await newEngine.getAddress()))
                .to.emit(carbonCredit, "VerificationEngineUpdated");

            expect(await carbonCredit.verificationEngine()).to.equal(await newEngine.getAddress());
        });

        it("should reject zero address for verification engine", async function () {
            await expect(carbonCredit.setVerificationEngine(ethers.ZeroAddress))
                .to.be.revertedWithCustomError(carbonCredit, "InvalidVerificationEngine");
        });

        it("should set base URI", async function () {
            await carbonCredit.setBaseUri("https://new-uri.com/");
            // Base URI change affects new tokens, not existing ones with custom URIs
        });
    });

    describe("Pause Functionality", function () {
        it("should pause contract", async function () {
            await carbonCredit.pause();
            expect(await carbonCredit.paused()).to.be.true;
        });

        it("should unpause contract", async function () {
            await carbonCredit.pause();
            await carbonCredit.unpause();
            expect(await carbonCredit.paused()).to.be.false;
        });

        it("should reject minting when paused", async function () {
            await carbonCredit.pause();

            await expect(
                carbonCredit.connect(operator).mintVerifiedCredits(
                    buyer.address,
                    dacUnitId,
                    ethers.keccak256(ethers.toUtf8Bytes("paused_hash")),
                    captureTimestamp,
                    co2AmountKg,
                    energyConsumedKwh,
                    latitude,
                    longitude,
                    purityPercentage,
                    gridIntensity,
                    ipfsMetadataUri,
                    arweaveBackupTxId
                )
            ).to.be.reverted; // EnforcedPause
        });

        it("should only allow owner to pause", async function () {
            await expect(carbonCredit.connect(unauthorized).pause()).to.be.reverted;
        });
    });

    describe("Data Hash Tracking", function () {
        it("should track used data hashes", async function () {
            expect(await carbonCredit.usedDataHashes(sourceDataHash)).to.be.false;

            await carbonCredit.connect(operator).mintVerifiedCredits(
                buyer.address,
                dacUnitId,
                sourceDataHash,
                captureTimestamp,
                co2AmountKg,
                energyConsumedKwh,
                latitude,
                longitude,
                purityPercentage,
                gridIntensity,
                ipfsMetadataUri,
                arweaveBackupTxId
            );

            expect(await carbonCredit.usedDataHashes(sourceDataHash)).to.be.true;
        });
    });

    describe("Approved Minters", function () {
        it("should track approved minters", async function () {
            expect(await carbonCredit.approvedMinters(buyer.address)).to.be.false;

            await carbonCredit.setMinter(buyer.address, true);
            expect(await carbonCredit.approvedMinters(buyer.address)).to.be.true;

            await carbonCredit.setMinter(buyer.address, false);
            expect(await carbonCredit.approvedMinters(buyer.address)).to.be.false;
        });
    });

    describe("Total Supply", function () {
        it("should return 0 for totalSupply (not tracked per token)", async function () {
            await carbonCredit.connect(operator).mintVerifiedCredits(
                buyer.address,
                dacUnitId,
                sourceDataHash,
                captureTimestamp,
                co2AmountKg,
                energyConsumedKwh,
                latitude,
                longitude,
                purityPercentage,
                gridIntensity,
                ipfsMetadataUri,
                arweaveBackupTxId
            );

            const tokenId = BigInt(ethers.keccak256(
                ethers.AbiCoder.defaultAbiCoder().encode(
                    ["bytes32", "uint256", "bytes32"],
                    [dacUnitId, captureTimestamp, sourceDataHash]
                )
            ));

            // Per v2.0.0 upgrade, totalSupply now tracks minted - burned per tokenId
            expect(await carbonCredit.totalSupply(tokenId)).to.be.greaterThan(0);
        });
    });
});
