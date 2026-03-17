import { ethers, upgrades } from "hardhat";
import fs from "fs";
import path from "path";
// Adjust these imports if your package structure is different
// e.g., import { TerraQuraDACSimulator } from "../../../packages/iot-simulator/src"; 
// For this script to work without external deps, we will inline the simulator logic below if needed, 
// but try to keep your imports if the packages exist.

async function main() {
    console.log("\n🚀 INITIALIZING TERRAQURA GENESIS LAUNCH SEQUENCE...");
    console.log("====================================================");

    const [deployer] = await ethers.getSigners();
    console.log(`👨‍✈️ Pilot (Deployer): ${deployer.address}`);

    // --- STEP 1: DEPLOY CORE INFRASTRUCTURE ---
    console.log("\n[1/6] 🏗️ Deploying Smart Contracts...");

    // 1.1 Access Control
    const AccessControl = await ethers.getContractFactory("TerraQuraAccessControl");
    const accessControl = await upgrades.deployProxy(AccessControl, [], { initializer: 'initialize' });
    await accessControl.waitForDeployment();
    const accessAddress = await accessControl.getAddress();
    console.log(`   ✅ AccessControl deployed: ${accessAddress}`);

    // 1.2 Trusted Forwarder
    const Forwarder = await ethers.getContractFactory("TerraQuraForwarder");
    const forwarder = await Forwarder.deploy();
    await forwarder.waitForDeployment();
    const forwarderAddress = await forwarder.getAddress();
    console.log(`   ✅ TrustedForwarder deployed: ${forwarderAddress}`);

    // 1.3 Carbon Credit (NFT)
    const CarbonCredit = await ethers.getContractFactory("CarbonCredit");
    const carbonCredit = await upgrades.deployProxy(CarbonCredit, [accessAddress, forwarderAddress], { initializer: 'initialize' });
    await carbonCredit.waitForDeployment();
    const creditAddress = await carbonCredit.getAddress();
    console.log(`   ✅ CarbonCredit (1155) deployed: ${creditAddress}`);

    // 1.4 Verification Engine
    const VerificationEngine = await ethers.getContractFactory("VerificationEngine");
    const engine = await upgrades.deployProxy(VerificationEngine, [accessAddress, creditAddress], { initializer: 'initialize' });
    await engine.waitForDeployment();
    const engineAddress = await engine.getAddress();
    console.log(`   ✅ VerificationEngine deployed: ${engineAddress}`);

    // 1.5 Gasless Marketplace
    const Marketplace = await ethers.getContractFactory("GaslessMarketplace");
    const marketplace = await upgrades.deployProxy(Marketplace, [accessAddress, creditAddress, forwarderAddress], { initializer: 'initialize' });
    await marketplace.waitForDeployment();
    const marketAddress = await marketplace.getAddress();
    console.log(`   ✅ GaslessMarketplace deployed: ${marketAddress}`);

    // --- STEP 2: CONFIGURATION ---
    console.log("\n[2/6] 🔌 Wiring System Permissions...");

    const MINTER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("MINTER_ROLE"));
    const MARKET_ROLE = ethers.keccak256(ethers.toUtf8Bytes("MARKET_ROLE"));

    await accessControl.grantRole(MINTER_ROLE, engineAddress);
    console.log("   👉 Engine granted MINTER_ROLE");

    await accessControl.grantRole(MARKET_ROLE, marketAddress);
    console.log("   👉 Marketplace granted MARKET_ROLE");

    // --- STEP 3: MINT GENESIS BATCH ---
    console.log("\n[3/6] 🏭 Registering & Minting Genesis Batch...");

    // Register Unit
    const genesisUnitId = "TQ-AD-GENESIS-001";
    const genesisLocation = "24.4539, 54.3773";
    const genesisUnitHash = ethers.keccak256(ethers.toUtf8Bytes(genesisUnitId));
    try {
        const txReg = await engine.whitelistDacUnit(genesisUnitHash, deployer.address);
        await txReg.wait();
        console.log(`   ✅ Unit ${genesisUnitId} Registered`);
    } catch (e) {
        console.log(`   ⚠️ Unit might already be registered, skipping...`);
    }

    // Mint Token (Dummy Hash for Genesis)
    const dummyHash = ethers.keccak256(ethers.toUtf8Bytes("GENESIS_BATCH_DATA"));
    console.log(`   💎 Minting genesis batch for unit ${genesisUnitId}`);
    const txMint = await carbonCredit.mintVerifiedCredits(
        deployer.address,
        genesisUnitHash,
        dummyHash,
        Math.floor(Date.now() / 1000),
        5000000, // 5000 tons (in grams/units)
        1200000, // kWh consumed
        24453900, // latitude * 1e6
        54377300, // longitude * 1e6
        9800, // 98.00% purity
        450, // gCO2/kWh
        "ipfs://QmGenesisPlaceholder",
        "ar://GENESIS_BACKUP_PLACEHOLDER"
    );
    await txMint.wait();
    console.log(`   🎉 GENESIS BATCH MINTED!`);

    // --- STEP 4: SAVE MANIFEST ---
    console.log("\n[4/6] 💾 Saving Deployment Manifest...");

    const manifest = {
        network: process.env.HARDHAT_NETWORK || "unknown",
        timestamp: new Date().toISOString(),
        contracts: {
            AccessControl: accessAddress,
            Forwarder: forwarderAddress,
            CarbonCredit: creditAddress,
            VerificationEngine: engineAddress,
            Marketplace: marketAddress
        }
    };

    const outputPath = path.join(__dirname, "../../web/src/config/deployment.json");
    // Ensure directory exists
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify(manifest, null, 2));

    console.log(`   ✅ Manifest saved to: ${outputPath}`);
    console.log("\n✅ LAUNCH SEQUENCE COMPLETE.");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
