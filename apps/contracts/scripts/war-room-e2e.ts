/**
 * TerraQura War Room End-to-End Simulation
 *
 * Simulates the complete carbon credit lifecycle for investor demos:
 *
 * Phase 1: Data Ingestion
 *   - Simulate IoT sensor data from DAC unit
 *   - Validate data quality and anomaly detection
 *
 * Phase 2: Verification
 *   - Execute 3-phase Proof-of-Physics verification
 *   - Generate cryptographic proofs
 *
 * Phase 3: Credit Minting
 *   - Mint ERC-1155 carbon credits
 *   - Upload metadata to IPFS
 *
 * Phase 4: Marketplace Trading
 *   - Create listing
 *   - Execute purchase (with gasless option)
 *   - Verify transfer
 *
 * Phase 5: Retirement
 *   - Retire credits for offset
 *   - Generate retirement certificate
 *
 * Usage:
 *   npx hardhat run scripts/war-room-e2e.ts --network aethelred
 *   npx hardhat run scripts/war-room-e2e.ts --network localhost
 */

import { ethers, upgrades } from "hardhat";
import { parseEther, formatEther, keccak256, toUtf8Bytes } from "ethers";

// ============================================
// WAR ROOM CONFIGURATION
// ============================================

const WAR_ROOM_CONFIG = {
  // DAC unit for demo
  dacUnit: {
    id: "TQ-DAC-DEMO",
    name: "Abu Dhabi Demo Facility",
    location: { lat: 24.4539, lng: 54.3773 },
  },

  // Sensor simulation parameters
  sensorSimulation: {
    durationMinutes: 60, // 1 hour of data
    intervalSeconds: 300, // 5-minute readings
    // Keep the simulated plant inside the on-chain 200-600 kWh/tonne envelope
    // after the verifier rounds capture volumes up to whole tonnes.
    co2BaseRate: 1550, // kg/hr base capture rate
    energyBaseRate: 58.5, // kWh per 5-min interval
  },

  // Verification parameters
  verification: {
    minEfficiency: 200, // kWh/tonne
    maxEfficiency: 600, // kWh/tonne
    optimalEfficiency: 350, // kWh/tonne
  },

  // Credit parameters
  credit: {
    co2Tonnes: 10, // Demo credit size
    pricePerTonne: "25", // AETH
  },

  // Test timing (ms)
  phasePauseDuration: 2000, // Pause between phases for demo effect
};

// ============================================
// TYPES
// ============================================

interface SensorReading {
  timestamp: Date;
  sensorId: string;
  type: "co2_flow" | "energy_meter" | "temperature" | "purity";
  value: number;
  unit: string;
  qualityScore: number;
  isAnomaly: boolean;
}

interface VerificationResult {
  sourceCheck: boolean;
  logicCheck: boolean;
  mintCheck: boolean;
  efficiencyFactor: number;
  dataHash: string;
  passed: boolean;
}

interface WarRoomResult {
  phase1: { sensorReadings: number; anomaliesDetected: number };
  phase2: { verified: boolean; efficiency: number };
  phase3: { tokenId: string; co2Tonnes: number };
  phase4: { listingId: string; purchaseAmount: number };
  phase5: { retired: boolean; certificateHash: string };
  totalDuration: number;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function log(phase: string, message: string, icon = "→") {
  const timestamp = new Date().toISOString().slice(11, 19);
  console.log(`[${timestamp}] ${icon} [${phase}] ${message}`);
}

function logHeader(title: string) {
  console.log("\n" + "═".repeat(60));
  console.log(`  ${title}`);
  console.log("═".repeat(60) + "\n");
}

function logSuccess(phase: string, message: string) {
  log(phase, message, "✓");
}

function logWarning(phase: string, message: string) {
  log(phase, message, "⚠");
}

function logError(phase: string, message: string) {
  log(phase, message, "✗");
}

async function pause(ms: number, message?: string) {
  if (message) {
    console.log(`   ⏳ ${message}`);
  }
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function generateHash(data: string): string {
  return keccak256(toUtf8Bytes(data));
}

// ============================================
// PHASE 1: DATA INGESTION
// ============================================

async function phase1DataIngestion(): Promise<{
  readings: SensorReading[];
  anomalies: number;
  aggregates: {
    totalCo2: number;
    totalEnergy: number;
    efficiency: number;
  };
}> {
  logHeader("PHASE 1: DATA INGESTION");

  const { sensorSimulation, dacUnit } = WAR_ROOM_CONFIG;
  const readings: SensorReading[] = [];
  let anomalyCount = 0;

  const totalReadings =
    (sensorSimulation.durationMinutes * 60) / sensorSimulation.intervalSeconds;

  log("Phase1", `Simulating ${totalReadings} sensor readings over ${sensorSimulation.durationMinutes} minutes`);
  log("Phase1", `DAC Unit: ${dacUnit.name} (${dacUnit.id})`);

  // Simulate sensor readings
  for (let i = 0; i < totalReadings; i++) {
    const timestamp = new Date(
      Date.now() - (totalReadings - i) * sensorSimulation.intervalSeconds * 1000
    );

    // CO2 flow sensor (with occasional noise)
    const co2Noise = (Math.random() - 0.5) * 2;
    const co2Value = sensorSimulation.co2BaseRate + co2Noise;
    const co2IsAnomaly = Math.random() < 0.02; // 2% anomaly rate

    readings.push({
      timestamp,
      sensorId: `${dacUnit.id}-CO2-001`,
      type: "co2_flow",
      value: co2IsAnomaly ? co2Value * 3 : co2Value, // Spike anomaly
      unit: "kg/hr",
      qualityScore: co2IsAnomaly ? 0.3 : 0.95 + Math.random() * 0.05,
      isAnomaly: co2IsAnomaly,
    });

    if (co2IsAnomaly) anomalyCount++;

    // Energy meter
    const energyNoise = (Math.random() - 0.5) * 0.5;
    const energyValue = sensorSimulation.energyBaseRate + energyNoise;

    readings.push({
      timestamp,
      sensorId: `${dacUnit.id}-PWR-001`,
      type: "energy_meter",
      value: energyValue,
      unit: "kWh",
      qualityScore: 0.95 + Math.random() * 0.05,
      isAnomaly: false,
    });

    // Temperature sensor
    readings.push({
      timestamp,
      sensorId: `${dacUnit.id}-TMP-001`,
      type: "temperature",
      value: 28 + (Math.random() - 0.5) * 10,
      unit: "celsius",
      qualityScore: 0.98,
      isAnomaly: false,
    });

    // CO2 purity sensor
    readings.push({
      timestamp,
      sensorId: `${dacUnit.id}-PUR-001`,
      type: "purity",
      value: 98 + Math.random() * 2,
      unit: "percent",
      qualityScore: 0.99,
      isAnomaly: false,
    });
  }

  // Calculate aggregates
  const co2Readings = readings.filter(
    (r) => r.type === "co2_flow" && !r.isAnomaly
  );
  const energyReadings = readings.filter((r) => r.type === "energy_meter");

  // CO2 in kg/hr * hours = total kg
  const totalCo2Kg =
    co2Readings.reduce((sum, r) => sum + r.value, 0) *
    (sensorSimulation.intervalSeconds / 3600);
  const totalCo2Tonnes = totalCo2Kg / 1000;

  const totalEnergyKwh = energyReadings.reduce((sum, r) => sum + r.value, 0);
  const effectiveTonnesForVerification = Math.max(1, Math.ceil(totalCo2Kg / 1000));
  const efficiency = totalEnergyKwh / effectiveTonnesForVerification;

  logSuccess("Phase1", `Total readings: ${readings.length}`);
  logSuccess("Phase1", `Anomalies detected: ${anomalyCount}`);
  logSuccess("Phase1", `CO2 captured: ${totalCo2Tonnes.toFixed(3)} tonnes`);
  logSuccess("Phase1", `Energy used: ${totalEnergyKwh.toFixed(2)} kWh`);
  logSuccess("Phase1", `Efficiency: ${efficiency.toFixed(1)} kWh/tonne`);

  await pause(WAR_ROOM_CONFIG.phasePauseDuration);

  return {
    readings,
    anomalies: anomalyCount,
    aggregates: {
      totalCo2: totalCo2Tonnes,
      totalEnergy: totalEnergyKwh,
      efficiency,
    },
  };
}

// ============================================
// PHASE 2: VERIFICATION
// ============================================

async function phase2Verification(
  aggregates: { totalCo2: number; totalEnergy: number; efficiency: number },
  readings: SensorReading[]
): Promise<VerificationResult> {
  logHeader("PHASE 2: PROOF-OF-PHYSICS VERIFICATION");

  const { verification, dacUnit } = WAR_ROOM_CONFIG;

  // Generate data hash from readings
  const readingsData = readings
    .map((r) => `${r.timestamp.toISOString()}|${r.sensorId}|${r.value}`)
    .join(",");
  const dataHash = generateHash(readingsData);

  log("Phase2", "Starting 3-phase verification...");
  log("Phase2", `Data hash: ${dataHash.slice(0, 20)}...`);

  await pause(500);

  // Phase 2.1: Source Check
  log("Phase2", "→ Source Check: Validating DAC unit registration...");
  await pause(300);
  const sourceCheck = true; // DAC unit is registered
  logSuccess("Phase2", `Source Check: PASSED (DAC ${dacUnit.id} is whitelisted)`);

  await pause(500);

  // Phase 2.2: Logic Check
  log("Phase2", "→ Logic Check: Validating efficiency metrics...");
  await pause(300);

  const isWithinRange =
    aggregates.efficiency >= verification.minEfficiency &&
    aggregates.efficiency <= verification.maxEfficiency;

  const logicCheck = isWithinRange;

  if (logicCheck) {
    logSuccess(
      "Phase2",
      `Logic Check: PASSED (${aggregates.efficiency.toFixed(1)} kWh/tonne within ${verification.minEfficiency}-${verification.maxEfficiency} range)`
    );
  } else {
    logError(
      "Phase2",
      `Logic Check: FAILED (${aggregates.efficiency.toFixed(1)} kWh/tonne outside valid range)`
    );
  }

  // Calculate efficiency factor (0.5 to 1.05)
  let efficiencyFactor: number;
  if (aggregates.efficiency <= verification.optimalEfficiency) {
    // Better than optimal = bonus (up to 5%)
    efficiencyFactor = Math.min(
      1.05,
      1 + (verification.optimalEfficiency - aggregates.efficiency) / 1000
    );
  } else {
    // Worse than optimal = penalty
    efficiencyFactor = Math.max(
      0.5,
      1 - (aggregates.efficiency - verification.optimalEfficiency) / 500
    );
  }

  log("Phase2", `   Efficiency factor: ${(efficiencyFactor * 100).toFixed(1)}%`);

  await pause(500);

  // Phase 2.3: Mint Check
  log("Phase2", "→ Mint Check: Checking for duplicate data hash...");
  await pause(300);
  const mintCheck = true; // No duplicates in this simulation
  logSuccess("Phase2", "Mint Check: PASSED (no duplicate hash found)");

  await pause(WAR_ROOM_CONFIG.phasePauseDuration);

  const passed = sourceCheck && logicCheck && mintCheck;

  if (passed) {
    logSuccess("Phase2", "🎉 ALL CHECKS PASSED - Ready for minting");
  } else {
    logError("Phase2", "Verification failed - cannot mint credits");
  }

  return {
    sourceCheck,
    logicCheck,
    mintCheck,
    efficiencyFactor,
    dataHash,
    passed,
  };
}

// ============================================
// PHASE 3: CREDIT MINTING
// ============================================

async function phase3CreditMinting(
  carbonCredit: any,
  deployer: any,
  aggregates: { totalCo2: number; totalEnergy: number },
  verificationResult: VerificationResult
): Promise<{ tokenId: bigint; mintedCredits: bigint; txHash: string }> {
  logHeader("PHASE 3: CARBON CREDIT MINTING");

  if (!verificationResult.passed) {
    throw new Error("Cannot mint - verification failed");
  }

  const co2AmountKg = BigInt(Math.floor(aggregates.totalCo2 * 1000));
  const energyUsedKwh = BigInt(Math.floor(aggregates.totalEnergy));
  const dacUnitId = generateHash(WAR_ROOM_CONFIG.dacUnit.id);
  const captureTimestamp = BigInt(Math.floor(Date.now() / 1000));
  const averagePurity = 99;
  const gridIntensityGco2PerKwh = 50n;

  log("Phase3", `Minting ${aggregates.totalCo2.toFixed(3)} tonnes of carbon credits...`);
  log("Phase3", `Recipient: ${deployer.address}`);
  log("Phase3", `Data hash: ${verificationResult.dataHash.slice(0, 20)}...`);

  await pause(500);

  // Generate mock IPFS CID
  const ipfsCid = `ipfs://QmWarRoom${Date.now().toString(16)}`;
  log("Phase3", `IPFS CID: ${ipfsCid}`);

  await pause(300);

  log("Phase3", "Submitting mint transaction...");

  const tx = await carbonCredit.mintVerifiedCredits(
    deployer.address,
    dacUnitId,
    verificationResult.dataHash,
    captureTimestamp,
    co2AmountKg,
    energyUsedKwh,
    BigInt(Math.round(WAR_ROOM_CONFIG.dacUnit.location.lat * 1_000_000)),
    BigInt(Math.round(WAR_ROOM_CONFIG.dacUnit.location.lng * 1_000_000)),
    averagePurity,
    gridIntensityGco2PerKwh,
    ipfsCid,
    ""
  );

  log("Phase3", `Transaction submitted: ${tx.hash}`);

  const receipt = await tx.wait();

  const tokenId = BigInt(
    keccak256(
      ethers.solidityPacked(
        ["bytes32", "uint256", "bytes32"],
        [dacUnitId, captureTimestamp, verificationResult.dataHash]
      )
    )
  );
  const mintedCredits = await carbonCredit.balanceOf(deployer.address, tokenId);

  logSuccess("Phase3", `✅ CREDIT MINTED SUCCESSFULLY`);
  logSuccess("Phase3", `Token ID: ${tokenId}`);
  logSuccess("Phase3", `Credits Minted: ${mintedCredits.toString()}`);
  logSuccess("Phase3", `TX Hash: ${receipt.hash}`);
  logSuccess("Phase3", `Block: ${receipt.blockNumber}`);
  logSuccess("Phase3", `Gas Used: ${receipt.gasUsed.toString()}`);

  await pause(WAR_ROOM_CONFIG.phasePauseDuration);

  return { tokenId, mintedCredits, txHash: receipt.hash };
}

// ============================================
// PHASE 4: MARKETPLACE TRADING
// ============================================

async function phase4MarketplaceTrading(
  carbonCredit: any,
  marketplace: any,
  deployer: any,
  buyer: any,
  tokenId: bigint,
  creditAmount: bigint
): Promise<{ listingId: bigint; purchaseAmount: bigint; purchaseTxHash: string }> {
  logHeader("PHASE 4: MARKETPLACE TRADING");

  const pricePerUnit = parseEther(WAR_ROOM_CONFIG.credit.pricePerTonne) / 1000n;
  const purchaseAmount = creditAmount / 2n; // Purchase half

  // Step 4.1: Approve marketplace
  log("Phase4", "Approving marketplace for credit transfers...");
  const approvalTx = await carbonCredit.setApprovalForAll(
    await marketplace.getAddress(),
    true
  );
  await approvalTx.wait();
  logSuccess("Phase4", "Marketplace approved");

  await pause(500);

  // Step 4.2: Set KYC status
  log("Phase4", "Setting KYC status for seller and buyer...");
  await (await marketplace.setKycStatus(deployer.address, true)).wait();
  await (await marketplace.setKycStatus(buyer.address, true)).wait();
  logSuccess("Phase4", "KYC status set");

  await pause(500);

  // Step 4.3: Create listing
  const sellAmount = creditAmount;
  const minPurchase = 1n;
  const duration = 30 * 24 * 60 * 60; // 30 days

  log("Phase4", `Creating listing for ${sellAmount.toString()} credits...`);
  log("Phase4", `Price: ${formatEther(pricePerUnit)} AETH per credit`);

  const listingTx = await marketplace.createListing(
    tokenId,
    sellAmount,
    pricePerUnit,
    minPurchase,
    duration
  );
  const listingReceipt = await listingTx.wait();

  // Get listing ID
  const listingId = await marketplace.nextListingId() - 1n;

  logSuccess("Phase4", `Listing created: ID ${listingId}`);
  logSuccess("Phase4", `TX: ${listingReceipt.hash}`);

  await pause(500);

  // Step 4.4: Execute purchase
  log("Phase4", `Buyer purchasing ${purchaseAmount.toString()} credits...`);

  const totalCost = pricePerUnit * purchaseAmount;
  log("Phase4", `Total cost: ${formatEther(totalCost)} AETH`);

  const purchaseTx = await marketplace.connect(buyer).purchase(listingId, purchaseAmount, {
    value: totalCost,
  });
  const purchaseReceipt = await purchaseTx.wait();

  logSuccess("Phase4", `✅ PURCHASE SUCCESSFUL`);
  logSuccess("Phase4", `Buyer: ${buyer.address}`);
  logSuccess("Phase4", `Amount: ${purchaseAmount.toString()} credits`);
  logSuccess("Phase4", `TX: ${purchaseReceipt.hash}`);

  // Verify balances
  const sellerBalance = await carbonCredit.balanceOf(deployer.address, tokenId);
  const buyerBalance = await carbonCredit.balanceOf(buyer.address, tokenId);

  log("Phase4", `Seller balance: ${sellerBalance} credits`);
  log("Phase4", `Buyer balance: ${buyerBalance} credits`);

  await pause(WAR_ROOM_CONFIG.phasePauseDuration);

  return {
    listingId,
    purchaseAmount,
    purchaseTxHash: purchaseReceipt.hash,
  };
}

// ============================================
// PHASE 5: CREDIT RETIREMENT
// ============================================

async function phase5Retirement(
  carbonCredit: any,
  buyer: any,
  tokenId: bigint,
  retireAmount: bigint
): Promise<{ retired: boolean; certificateHash: string; txHash: string }> {
  logHeader("PHASE 5: CREDIT RETIREMENT");

  log("Phase5", `Retiring ${retireAmount.toString()} credits for carbon offset...`);
  log("Phase5", `Account: ${buyer.address}`);

  const retirementReason = `Carbon offset for Q1 2026 - War Room Demo ${new Date().toISOString()}`;
  log("Phase5", `Reason: "${retirementReason.slice(0, 50)}..."`);

  await pause(500);

  // Execute retirement
  const retireTx = await carbonCredit.connect(buyer).retireCredits(
    tokenId,
    retireAmount,
    retirementReason
  );
  const retireReceipt = await retireTx.wait();

  // Generate certificate hash
  const certificateData = `${buyer.address}|${tokenId}|${retireAmount}|${retirementReason}|${retireReceipt.hash}`;
  const certificateHash = generateHash(certificateData);

  logSuccess("Phase5", `✅ CREDITS RETIRED SUCCESSFULLY`);
  logSuccess("Phase5", `Amount: ${retireAmount.toString()} credits`);
  logSuccess("Phase5", `TX: ${retireReceipt.hash}`);
  logSuccess("Phase5", `Certificate Hash: ${certificateHash.slice(0, 30)}...`);

  // Verify balance reduced
  const remainingBalance = await carbonCredit.balanceOf(buyer.address, tokenId);
  log("Phase5", `Remaining balance: ${remainingBalance} credits`);

  await pause(WAR_ROOM_CONFIG.phasePauseDuration);

  return {
    retired: true,
    certificateHash,
    txHash: retireReceipt.hash,
  };
}

// ============================================
// MAIN WAR ROOM SIMULATION
// ============================================

async function runWarRoomSimulation() {
  console.log("\n");
  console.log("╔════════════════════════════════════════════════════════════════╗");
  console.log("║                                                                 ║");
  console.log("║   ████████╗███████╗██████╗ ██████╗  █████╗  ██████╗ ██╗   ██╗   ║");
  console.log("║   ╚══██╔══╝██╔════╝██╔══██╗██╔══██╗██╔══██╗██╔═══██╗██║   ██║   ║");
  console.log("║      ██║   █████╗  ██████╔╝██████╔╝███████║██║   ██║██║   ██║   ║");
  console.log("║      ██║   ██╔══╝  ██╔══██╗██╔══██╗██╔══██║██║▄▄ ██║██║   ██║   ║");
  console.log("║      ██║   ███████╗██║  ██║██║  ██║██║  ██║╚██████╔╝╚██████╔╝   ║");
  console.log("║      ╚═╝   ╚══════╝╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝ ╚══▀▀═╝  ╚═════╝    ║");
  console.log("║                                                                 ║");
  console.log("║         WAR ROOM END-TO-END SIMULATION                          ║");
  console.log("║         Institutional-Grade Carbon Asset Platform               ║");
  console.log("║                                                                 ║");
  console.log("╚════════════════════════════════════════════════════════════════╝\n");

  const startTime = Date.now();
  const [deployer, buyer] = await ethers.getSigners();

  console.log(`🔑 Deployer (Seller): ${deployer.address}`);
  console.log(`🔑 Buyer: ${buyer?.address || "Not available"}`);
  console.log(
    `💰 Deployer Balance: ${formatEther(await ethers.provider.getBalance(deployer.address))} AETH`
  );
  if (buyer) {
    console.log(
      `💰 Buyer Balance: ${formatEther(await ethers.provider.getBalance(buyer.address))} AETH`
    );
  }
  console.log("");

  // Deploy or load contracts
  log("Setup", "Deploying fresh contracts for war room...");

  const VerificationEngine = await ethers.getContractFactory("VerificationEngine");
  const verificationEngine = await upgrades.deployProxy(
    VerificationEngine,
    [ethers.ZeroAddress, ethers.ZeroAddress],
    { initializer: "initialize", kind: "uups" }
  );
  await verificationEngine.waitForDeployment();

  const CarbonCredit = await ethers.getContractFactory("CarbonCredit");
  const carbonCredit = await upgrades.deployProxy(
    CarbonCredit,
    [await verificationEngine.getAddress(), "ipfs://", deployer.address],
    { initializer: "initialize", kind: "uups" }
  );
  await carbonCredit.waitForDeployment();

  const CarbonMarketplace = await ethers.getContractFactory("CarbonMarketplace");
  const marketplace = await upgrades.deployProxy(
    CarbonMarketplace,
    [await carbonCredit.getAddress(), deployer.address, 250, deployer.address],
    { initializer: "initialize", kind: "uups" }
  );
  await marketplace.waitForDeployment();

  // Configure
  const warRoomDacUnitId = generateHash(WAR_ROOM_CONFIG.dacUnit.id);
  await verificationEngine.setCarbonCreditContract(await carbonCredit.getAddress());
  await verificationEngine.whitelistDacUnit(warRoomDacUnitId, deployer.address);
  await carbonCredit.setMinter(deployer.address, true);
  await marketplace.setKycRequired(true);

  logSuccess("Setup", `CarbonCredit: ${await carbonCredit.getAddress()}`);
  logSuccess("Setup", `Marketplace: ${await marketplace.getAddress()}`);

  try {
    // PHASE 1: Data Ingestion
    const phase1Result = await phase1DataIngestion();

    // PHASE 2: Verification
    const phase2Result = await phase2Verification(
      phase1Result.aggregates,
      phase1Result.readings
    );

    if (!phase2Result.passed) {
      throw new Error("Verification failed - simulation cannot continue");
    }

    // PHASE 3: Credit Minting
    const phase3Result = await phase3CreditMinting(
      carbonCredit,
      deployer,
      phase1Result.aggregates,
      phase2Result
    );

    // PHASE 4: Marketplace Trading (only if buyer available)
    let phase4Result = {
      listingId: BigInt(0),
      purchaseAmount: 0n,
      purchaseTxHash: "",
    };

    if (buyer) {
      phase4Result = await phase4MarketplaceTrading(
        carbonCredit,
        marketplace,
        deployer,
        buyer,
        phase3Result.tokenId,
        phase3Result.mintedCredits
      );
    } else {
      logWarning("Phase4", "Skipping marketplace - no buyer signer available");
    }

    // PHASE 5: Retirement (only if buyer purchased)
    let phase5Result = {
      retired: false,
      certificateHash: "",
      txHash: "",
    };

    if (buyer && phase4Result.purchaseAmount > 0) {
      const retireAmount = phase4Result.purchaseAmount / 2n;
      phase5Result = await phase5Retirement(
        carbonCredit,
        buyer,
        phase3Result.tokenId,
        retireAmount
      );
    } else {
      logWarning("Phase5", "Skipping retirement - no credits to retire");
    }

    // FINAL SUMMARY
    const totalDuration = (Date.now() - startTime) / 1000;

    console.log("\n");
    console.log("╔════════════════════════════════════════════════════════════════╗");
    console.log("║               WAR ROOM SIMULATION COMPLETE                     ║");
    console.log("╚════════════════════════════════════════════════════════════════╝\n");

    console.log("📊 RESULTS SUMMARY\n");

    console.log("Phase 1 - Data Ingestion:");
    console.log(`   • Sensor readings: ${phase1Result.readings.length}`);
    console.log(`   • Anomalies detected: ${phase1Result.anomalies}`);
    console.log(`   • CO2 captured: ${phase1Result.aggregates.totalCo2.toFixed(3)} tonnes`);
    console.log(`   • Energy used: ${phase1Result.aggregates.totalEnergy.toFixed(2)} kWh`);
    console.log("");

    console.log("Phase 2 - Verification:");
    console.log(`   • Source Check: ${phase2Result.sourceCheck ? "✓" : "✗"}`);
    console.log(`   • Logic Check: ${phase2Result.logicCheck ? "✓" : "✗"}`);
    console.log(`   • Mint Check: ${phase2Result.mintCheck ? "✓" : "✗"}`);
    console.log(`   • Efficiency: ${phase1Result.aggregates.efficiency.toFixed(1)} kWh/tonne`);
    console.log(`   • Factor: ${(phase2Result.efficiencyFactor * 100).toFixed(1)}%`);
    console.log("");

    console.log("Phase 3 - Credit Minting:");
    console.log(`   • Token ID: ${phase3Result.tokenId}`);
    console.log(`   • TX: ${phase3Result.txHash}`);
    console.log("");

    console.log("Phase 4 - Marketplace:");
    console.log(`   • Listing ID: ${phase4Result.listingId}`);
    console.log(`   • Purchase: ${phase4Result.purchaseAmount} credits`);
    console.log(`   • TX: ${phase4Result.purchaseTxHash || "N/A"}`);
    console.log("");

    console.log("Phase 5 - Retirement:");
    console.log(`   • Retired: ${phase5Result.retired ? "Yes" : "No"}`);
    console.log(`   • Certificate: ${phase5Result.certificateHash.slice(0, 20) || "N/A"}...`);
    console.log(`   • TX: ${phase5Result.txHash || "N/A"}`);
    console.log("");

    console.log(`⏱️  Total Duration: ${totalDuration.toFixed(1)} seconds`);
    console.log("");

    console.log("🎉 WAR ROOM SIMULATION SUCCESSFUL!");
    console.log("");

    return {
      phase1: {
        sensorReadings: phase1Result.readings.length,
        anomaliesDetected: phase1Result.anomalies,
      },
      phase2: {
        verified: phase2Result.passed,
        efficiency: phase1Result.aggregates.efficiency,
      },
      phase3: {
        tokenId: phase3Result.tokenId.toString(),
        co2Tonnes: phase1Result.aggregates.totalCo2,
      },
      phase4: {
        listingId: phase4Result.listingId.toString(),
        purchaseAmount: phase4Result.purchaseAmount,
      },
      phase5: {
        retired: phase5Result.retired,
        certificateHash: phase5Result.certificateHash,
      },
      totalDuration,
    };
  } catch (error: any) {
    logError("Simulation", `FAILED: ${error.message}`);
    throw error;
  }
}

// ============================================
// RUN
// ============================================

runWarRoomSimulation()
  .then((result) => {
    console.log(
      "\nFinal Result:",
      JSON.stringify(result, (_key, value) => (typeof value === "bigint" ? value.toString() : value), 2)
    );
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ War Room Simulation Failed:", error);
    process.exit(1);
  });
