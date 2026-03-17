/**
 * TerraQura Genesis Batch Seeding Script
 *
 * Creates initial demo data for War Room presentations and testing:
 * - 3 DAC Units (Abu Dhabi, Dubai, Saudi Arabia)
 * - Verified carbon credits for each unit
 * - Marketplace listings
 * - KYC-verified test users
 *
 * Usage:
 *   npx hardhat run scripts/seed-genesis.ts --network aethelred
 *   npx hardhat run scripts/seed-genesis.ts --network localhost
 */

import { ethers, upgrades } from "hardhat";
import { keccak256, toUtf8Bytes, parseEther, formatEther } from "ethers";

// ============================================
// GENESIS CONFIGURATION
// ============================================

const GENESIS_CONFIG = {
  // DAC Units representing real-world facilities
  dacUnits: [
    {
      id: "TQ-DAC-001",
      name: "Abu Dhabi Masdar Facility",
      location: { lat: 24.4539, lng: 54.3773 },
      capacity: 1000, // tonnes/year
      operator: "TerraQura Operations UAE",
      vintage: 2026,
    },
    {
      id: "TQ-DAC-002",
      name: "Dubai Innovation Hub",
      location: { lat: 25.2048, lng: 55.2708 },
      capacity: 500,
      operator: "TerraQura Operations UAE",
      vintage: 2026,
    },
    {
      id: "TQ-DAC-003",
      name: "NEOM Green Hydrogen Valley",
      location: { lat: 28.0, lng: 35.0 },
      capacity: 2000,
      operator: "TerraQura Operations KSA",
      vintage: 2026,
    },
  ],

  // Carbon credits to mint for each DAC unit
  credits: [
    {
      dacUnitId: "TQ-DAC-001",
      co2Tonnes: 100,
      energyKwh: 35000, // 350 kWh/tonne (optimal)
      purity: 99,
    },
    {
      dacUnitId: "TQ-DAC-001",
      co2Tonnes: 75,
      energyKwh: 28125, // 375 kWh/tonne
      purity: 98,
    },
    {
      dacUnitId: "TQ-DAC-002",
      co2Tonnes: 50,
      energyKwh: 17500, // 350 kWh/tonne
      purity: 99,
    },
    {
      dacUnitId: "TQ-DAC-003",
      co2Tonnes: 250,
      energyKwh: 87500, // 350 kWh/tonne
      purity: 99,
    },
  ],

  // Test users for demo (addresses will be derived from mnemonic or deployer)
  testUsers: [
    { name: "Corporate Buyer A", role: "buyer", kycVerified: true },
    { name: "Institutional Investor", role: "investor", kycVerified: true },
    { name: "DAC Operator", role: "operator", kycVerified: true },
    { name: "Pending KYC User", role: "buyer", kycVerified: false },
  ],

  // Marketplace listings
  listings: [
    {
      creditIndex: 0, // First credit batch
      amount: 50,
      pricePerTonne: "25", // AETH
      minPurchase: 5,
      durationDays: 30,
    },
    {
      creditIndex: 2, // Third credit batch
      amount: 25,
      pricePerTonne: "28",
      minPurchase: 1,
      durationDays: 60,
    },
  ],
};

// ============================================
// HELPER FUNCTIONS
// ============================================

function generateDataHash(dacUnitId: string, timestamp: number): string {
  const data = `${dacUnitId}|${timestamp}|genesis`;
  return keccak256(toUtf8Bytes(data));
}

function generateIpfsCid(tokenId: number): string {
  // Mock IPFS CID for demo (would be real IPFS upload in production)
  return `ipfs://QmGenesis${tokenId.toString().padStart(10, "0")}`;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================
// MAIN SEEDING FUNCTION
// ============================================

async function seedGenesis() {
  console.log("\n╔════════════════════════════════════════════════════════╗");
  console.log("║           TerraQura Genesis Batch Seeding              ║");
  console.log("║      Institutional-Grade Carbon Asset Platform          ║");
  console.log("╚════════════════════════════════════════════════════════╝\n");

  const [deployer, ...testSigners] = await ethers.getSigners();

  console.log("🔑 Deployer:", deployer.address);
  console.log(
    "💰 Balance:",
    formatEther(await ethers.provider.getBalance(deployer.address)),
    "AETH"
  );
  console.log("");

  // ============================================
  // STEP 1: Load or Deploy Contracts
  // ============================================
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("STEP 1: Loading Contracts");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  // Check if contracts are already deployed (from .env or deployment file)
  const CARBON_CREDIT_ADDRESS = process.env.CARBON_CREDIT_ADDRESS;
  const MARKETPLACE_ADDRESS = process.env.MARKETPLACE_ADDRESS;
  const VERIFICATION_ENGINE_ADDRESS = process.env.VERIFICATION_ENGINE_ADDRESS;

  let carbonCredit: any;
  let marketplace: any;
  let verificationEngine: any;

  if (CARBON_CREDIT_ADDRESS && MARKETPLACE_ADDRESS) {
    console.log("📦 Using existing deployed contracts...");
    carbonCredit = await ethers.getContractAt(
      "CarbonCredit",
      CARBON_CREDIT_ADDRESS
    );
    marketplace = await ethers.getContractAt(
      "CarbonMarketplace",
      MARKETPLACE_ADDRESS
    );
    if (VERIFICATION_ENGINE_ADDRESS) {
      verificationEngine = await ethers.getContractAt(
        "VerificationEngine",
        VERIFICATION_ENGINE_ADDRESS
      );
    }
  } else {
    console.log("🚀 Deploying fresh contracts for genesis...");

    // Deploy VerificationEngine
    const VerificationEngine =
      await ethers.getContractFactory("VerificationEngine");
    verificationEngine = await VerificationEngine.deploy();
    await verificationEngine.waitForDeployment();
    console.log(
      "   ✓ VerificationEngine:",
      await verificationEngine.getAddress()
    );

    // Deploy CarbonCredit
    const CarbonCredit = await ethers.getContractFactory("CarbonCredit");
    carbonCredit = await upgrades.deployProxy(
      CarbonCredit,
      [await verificationEngine.getAddress(), "ipfs://", deployer.address],
      { initializer: "initialize", kind: "uups" }
    );
    await carbonCredit.waitForDeployment();
    console.log("   ✓ CarbonCredit:", await carbonCredit.getAddress());

    // Deploy CarbonMarketplace
    const CarbonMarketplace =
      await ethers.getContractFactory("CarbonMarketplace");
    marketplace = await upgrades.deployProxy(
      CarbonMarketplace,
      [await carbonCredit.getAddress(), deployer.address, 250, deployer.address],
      { initializer: "initialize", kind: "uups" }
    );
    await marketplace.waitForDeployment();
    console.log("   ✓ CarbonMarketplace:", await marketplace.getAddress());

    // Configure contracts
    await verificationEngine.setCarbonCreditContract(
      await carbonCredit.getAddress()
    );
    await carbonCredit.setMinter(deployer.address, true);
    console.log("   ✓ Contracts configured\n");
  }

  // ============================================
  // STEP 2: Register DAC Units
  // ============================================
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("STEP 2: Registering DAC Units");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  for (const unit of GENESIS_CONFIG.dacUnits) {
    console.log(`   🏭 ${unit.name}`);
    console.log(`      ID: ${unit.id}`);
    console.log(`      Location: ${unit.location.lat}, ${unit.location.lng}`);
    console.log(`      Capacity: ${unit.capacity} tonnes/year`);
    console.log(`      Operator: ${unit.operator}`);
    console.log("");

    // In production, this would register with the VerificationEngine
    // For demo, we just log the units
  }

  // ============================================
  // STEP 3: Mint Genesis Carbon Credits
  // ============================================
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("STEP 3: Minting Genesis Carbon Credits");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  const mintedTokenIds: bigint[] = [];

  for (let i = 0; i < GENESIS_CONFIG.credits.length; i++) {
    const credit = GENESIS_CONFIG.credits[i];
    const timestamp = Math.floor(Date.now() / 1000) - i * 86400; // Stagger by day
    const dataHash = generateDataHash(credit.dacUnitId, timestamp);

    console.log(`   🪙 Credit Batch #${i + 1}`);
    console.log(`      DAC Unit: ${credit.dacUnitId}`);
    console.log(`      CO2 Captured: ${credit.co2Tonnes} tonnes`);
    console.log(`      Energy Used: ${credit.energyKwh} kWh`);
    console.log(
      `      Efficiency: ${(credit.energyKwh / credit.co2Tonnes).toFixed(1)} kWh/tonne`
    );
    console.log(`      Purity: ${credit.purity}%`);

    try {
      // Convert to wei (18 decimals)
      const co2AmountWei = BigInt(credit.co2Tonnes) * BigInt(10 ** 18);
      const energyUsedWei = BigInt(credit.energyKwh) * BigInt(10 ** 18);

      const tx = await carbonCredit.mintFromVerification(
        deployer.address,
        co2AmountWei,
        energyUsedWei,
        dataHash,
        generateIpfsCid(i)
      );

      const receipt = await tx.wait();

      // Extract tokenId from events
      const mintEvent = receipt.logs.find(
        (log: any) =>
          log.topics[0] ===
          carbonCredit.interface.getEvent("CreditMinted").topicHash
      );

      if (mintEvent) {
        const tokenId = BigInt(mintEvent.topics[1]);
        mintedTokenIds.push(tokenId);
        console.log(`      ✓ Token ID: ${tokenId}`);
        console.log(`      ✓ TX: ${receipt.hash}`);
      } else {
        // Fallback: use index-based token ID
        const nextTokenId = await carbonCredit.nextTokenId();
        mintedTokenIds.push(nextTokenId - 1n);
        console.log(`      ✓ Minted (Token ID: ${nextTokenId - 1n})`);
      }
    } catch (error: any) {
      console.log(`      ⚠ Error: ${error.message}`);
      // Push placeholder for failed mints
      mintedTokenIds.push(BigInt(i));
    }
    console.log("");
  }

  // ============================================
  // STEP 4: Set Up KYC-Verified Users
  // ============================================
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("STEP 4: Setting Up KYC-Verified Users");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  const userAddresses: string[] = [];

  for (let i = 0; i < GENESIS_CONFIG.testUsers.length; i++) {
    const user = GENESIS_CONFIG.testUsers[i];
    // Use test signers or generate deterministic addresses
    const userAddress =
      testSigners[i]?.address ||
      ethers.Wallet.createRandom().address;
    userAddresses.push(userAddress);

    console.log(`   👤 ${user.name}`);
    console.log(`      Address: ${userAddress}`);
    console.log(`      Role: ${user.role}`);
    console.log(`      KYC: ${user.kycVerified ? "✓ Verified" : "⏳ Pending"}`);

    if (user.kycVerified) {
      try {
        const tx = await marketplace.setKycStatus(userAddress, true);
        await tx.wait();
        console.log("      ✓ KYC status set on marketplace");
      } catch (error: any) {
        console.log(`      ⚠ Error setting KYC: ${error.message}`);
      }
    }
    console.log("");
  }

  // Also set deployer as KYC verified
  try {
    const deployerKyc = await marketplace.setKycStatus(deployer.address, true);
    await deployerKyc.wait();
    console.log("   ✓ Deployer KYC verified\n");
  } catch (error: any) {
    console.log(`   ⚠ Error setting deployer KYC: ${error.message}\n`);
  }

  // ============================================
  // STEP 5: Create Marketplace Listings
  // ============================================
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("STEP 5: Creating Marketplace Listings");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  // Enable KYC requirement
  try {
    const kycReqTx = await marketplace.setKycRequired(true);
    await kycReqTx.wait();
    console.log("   ✓ KYC requirement enabled on marketplace\n");
  } catch (error: any) {
    console.log(`   ⚠ Error enabling KYC: ${error.message}\n`);
  }

  // Approve marketplace to transfer credits
  try {
    const approvalTx = await carbonCredit.setApprovalForAll(
      await marketplace.getAddress(),
      true
    );
    await approvalTx.wait();
    console.log("   ✓ Marketplace approved for credit transfers\n");
  } catch (error: any) {
    console.log(`   ⚠ Error approving marketplace: ${error.message}\n`);
  }

  for (let i = 0; i < GENESIS_CONFIG.listings.length; i++) {
    const listing = GENESIS_CONFIG.listings[i];
    const tokenId = mintedTokenIds[listing.creditIndex];

    if (!tokenId) {
      console.log(`   ⚠ Skipping listing #${i + 1} - no token minted`);
      continue;
    }

    console.log(`   📋 Listing #${i + 1}`);
    console.log(`      Token ID: ${tokenId}`);
    console.log(`      Amount: ${listing.amount} credits`);
    console.log(`      Price: ${listing.pricePerTonne} AETH/credit`);
    console.log(`      Min Purchase: ${listing.minPurchase} credits`);
    console.log(`      Duration: ${listing.durationDays} days`);

    try {
      const priceWei = parseEther(listing.pricePerTonne);
      const durationSeconds = listing.durationDays * 24 * 60 * 60;

      const tx = await marketplace.createListing(
        tokenId,
        listing.amount,
        priceWei,
        listing.minPurchase,
        durationSeconds
      );
      const receipt = await tx.wait();

      console.log(`      ✓ Listing created`);
      console.log(`      ✓ TX: ${receipt.hash}`);
    } catch (error: any) {
      console.log(`      ⚠ Error: ${error.message}`);
    }
    console.log("");
  }

  // ============================================
  // GENESIS SUMMARY
  // ============================================
  console.log("\n╔════════════════════════════════════════════════════════╗");
  console.log("║              GENESIS BATCH COMPLETE                     ║");
  console.log("╚════════════════════════════════════════════════════════╝\n");

  console.log("📊 Summary:");
  console.log(`   • DAC Units Registered: ${GENESIS_CONFIG.dacUnits.length}`);
  console.log(`   • Carbon Credits Minted: ${mintedTokenIds.length}`);
  console.log(
    `   • Total CO2 Captured: ${GENESIS_CONFIG.credits.reduce((sum, c) => sum + c.co2Tonnes, 0)} tonnes`
  );
  console.log(`   • KYC Users Set Up: ${userAddresses.length}`);
  console.log(`   • Marketplace Listings: ${GENESIS_CONFIG.listings.length}`);
  console.log("");

  console.log("📍 Contract Addresses:");
  console.log(`   • CarbonCredit: ${await carbonCredit.getAddress()}`);
  console.log(`   • Marketplace: ${await marketplace.getAddress()}`);
  if (verificationEngine) {
    console.log(
      `   • VerificationEngine: ${await verificationEngine.getAddress()}`
    );
  }
  console.log("");

  console.log("🪙 Minted Token IDs:");
  mintedTokenIds.forEach((id, i) => {
    console.log(`   • Token #${i + 1}: ${id}`);
  });
  console.log("");

  console.log("👥 Test Users:");
  userAddresses.forEach((addr, i) => {
    const user = GENESIS_CONFIG.testUsers[i];
    console.log(
      `   • ${user.name}: ${addr.slice(0, 10)}...${addr.slice(-8)}`
    );
  });
  console.log("");

  // Return for external usage
  return {
    contracts: {
      carbonCredit: await carbonCredit.getAddress(),
      marketplace: await marketplace.getAddress(),
      verificationEngine: verificationEngine
        ? await verificationEngine.getAddress()
        : null,
    },
    mintedTokenIds: mintedTokenIds.map((id) => id.toString()),
    userAddresses,
    dacUnits: GENESIS_CONFIG.dacUnits,
  };
}

// ============================================
// DATABASE SEEDING (PostgreSQL/TimescaleDB)
// ============================================

async function seedDatabase() {
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("STEP 6: Seeding TimescaleDB Sensor Data");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  // Generate SQL for sensor data seeding
  const sensorDataSQL = generateSensorDataSQL();

  console.log("📝 Generated SQL for sensor data seeding.");
  console.log("   Run the following file to seed TimescaleDB:");
  console.log("   psql -f scripts/seed-sensor-data.sql\n");

  // Write SQL file
  const fs = await import("fs/promises");
  await fs.writeFile(
    "scripts/seed-sensor-data.sql",
    sensorDataSQL,
    "utf-8"
  );

  console.log("   ✓ SQL file written to scripts/seed-sensor-data.sql\n");
}

function generateSensorDataSQL(): string {
  const lines: string[] = [];

  lines.push("-- TerraQura Genesis Sensor Data");
  lines.push("-- Auto-generated by seed-genesis.ts");
  lines.push("-- Run with: psql -f seed-sensor-data.sql\n");

  // Generate sensor readings for each DAC unit
  for (const unit of GENESIS_CONFIG.dacUnits) {
    lines.push(`-- Sensor data for ${unit.name} (${unit.id})`);

    // Generate 24 hours of data at 5-minute intervals
    const now = Date.now();
    const interval = 5 * 60 * 1000; // 5 minutes in ms
    const readings = 24 * 12; // 24 hours at 5-min intervals

    for (let i = 0; i < readings; i++) {
      const timestamp = new Date(now - i * interval).toISOString();

      // CO2 flow sensor (kg/hr) - varies around 10-15 kg/hr
      const co2Value = (12 + Math.random() * 6).toFixed(2);
      lines.push(
        `INSERT INTO sensor_readings (time, sensor_id, dac_unit_id, sensor_type, value, unit, quality_score, raw_data_hash) ` +
          `VALUES ('${timestamp}', '${unit.id}-CO2-001', '${unit.id}', 'co2_flow', ${co2Value}, 'kg/hr', ${(0.95 + Math.random() * 0.05).toFixed(3)}, '${generateDataHash(unit.id, i)}');`
      );

      // Energy meter (kWh) - varies around 4-6 kWh per 5 minutes
      const energyValue = (5 + Math.random() * 2).toFixed(2);
      lines.push(
        `INSERT INTO sensor_readings (time, sensor_id, dac_unit_id, sensor_type, value, unit, quality_score, raw_data_hash) ` +
          `VALUES ('${timestamp}', '${unit.id}-PWR-001', '${unit.id}', 'energy_meter', ${energyValue}, 'kWh', ${(0.95 + Math.random() * 0.05).toFixed(3)}, '${generateDataHash(unit.id, i + 1000)}');`
      );

      // Temperature sensor (celsius) - varies around 25-35°C
      const tempValue = (30 + Math.random() * 10 - 5).toFixed(1);
      lines.push(
        `INSERT INTO sensor_readings (time, sensor_id, dac_unit_id, sensor_type, value, unit, quality_score, raw_data_hash) ` +
          `VALUES ('${timestamp}', '${unit.id}-TMP-001', '${unit.id}', 'temperature', ${tempValue}, 'celsius', ${(0.95 + Math.random() * 0.05).toFixed(3)}, '${generateDataHash(unit.id, i + 2000)}');`
      );
    }
    lines.push("");
  }

  return lines.join("\n");
}

// ============================================
// RUN
// ============================================

seedGenesis()
  .then(async (result) => {
    console.log("\n✅ Blockchain genesis complete!\n");

    // Optionally seed database
    if (process.env.SEED_DATABASE === "true") {
      await seedDatabase();
    }

    console.log("Genesis result:", JSON.stringify(result, null, 2));
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Genesis failed:", error);
    process.exit(1);
  });
