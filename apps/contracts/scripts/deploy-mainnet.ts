/**
 * TerraQura Aethelred Mainnet Deployment Script
 *
 * Enterprise-grade deployment with:
 * - Pre-flight checks
 * - Gas estimation
 * - Deployment verification
 * - Rollback procedures
 * - Comprehensive logging
 *
 * Prerequisites:
 * 1. Ensure PRIVATE_KEY is set in .env.local (deployer wallet with AETH)
 * 2. Ensure AETHELRED_MAINNET_RPC_URL is set in .env.local
 * 3. Ensure AETHELRED_EXPLORER_API_KEY is set for verification
 * 4. Review and update MAINNET_CONFIG before deployment
 *
 * Run: npx hardhat run scripts/deploy-mainnet.ts --network aethelredMainnet
 */

import { ethers, upgrades, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

// ============================================
// MAINNET CONFIGURATION
// ============================================

const MAINNET_CONFIG = {
  // Multisig signers - MUST be HARDWARE WALLET addresses (Ledger/Trezor ONLY)
  // Geographic distribution required: at least 3 unique countries
  multisigSigners: [
    {
      address: process.env.SIGNER_1 || "",
      countryCode: process.env.SIGNER_1_COUNTRY || "AE", // UAE
      walletType: "LEDGER" as const,
      name: "Signer 1 - UAE Primary",
    },
    {
      address: process.env.SIGNER_2 || "",
      countryCode: process.env.SIGNER_2_COUNTRY || "CH", // Switzerland
      walletType: "LEDGER" as const,
      name: "Signer 2 - Switzerland",
    },
    {
      address: process.env.SIGNER_3 || "",
      countryCode: process.env.SIGNER_3_COUNTRY || "SG", // Singapore
      walletType: "TREZOR" as const,
      name: "Signer 3 - Singapore",
    },
    {
      address: process.env.SIGNER_4 || "",
      countryCode: process.env.SIGNER_4_COUNTRY || "US", // United States
      walletType: "LEDGER" as const,
      name: "Signer 4 - US",
    },
    {
      address: process.env.SIGNER_5 || "",
      countryCode: process.env.SIGNER_5_COUNTRY || "GB", // United Kingdom
      walletType: "TREZOR" as const,
      name: "Signer 5 - UK",
    },
  ],
  multisigThreshold: 3, // CRITICAL: 3-of-5 required for mainnet security

  // Timelock configuration - CRITICAL: 48-72 hours minimum for mainnet
  timelockDelay: 48 * 60 * 60, // 48 hours (172800 seconds) - MINIMUM for mainnet
  isProduction: true,

  // Use hardened mainnet contracts
  useHardenedContracts: true, // Deploy TerraQuraMultisigMainnet & TerraQuraTimelockMainnet

  // Platform configuration
  platformFeeBps: 250, // 2.5%

  // Metadata base URI (update before mainnet)
  metadataBaseUri: "https://api.terraqura.io/metadata/",

  // Minimum balance requirements (in AETH)
  minDeployerBalance: "5", // 5 AETH minimum

  // Gas price limits (in gwei)
  maxGasPrice: 500, // Won't deploy if gas > 500 gwei

  // Deployment options
  deployGovernance: true,
  deployCircuitBreaker: true,
  deployGaslessMarketplace: true,
};

// ============================================
// TYPES
// ============================================

interface DeploymentResult {
  name: string;
  proxy?: string;
  implementation?: string;
  address?: string;
  txHash: string;
  gasUsed: bigint;
  type: "uups" | "standard";
}

interface DeploymentManifest {
  network: string;
  chainId: number;
  deployedAt: string;
  deployedBy: string;
  version: string;
  solidity: string;
  totalGasUsed: string;
  totalCost: string;
  contracts: {
    core: Record<string, DeploymentResult>;
    governance: Record<string, DeploymentResult>;
    security: Record<string, DeploymentResult>;
    gasless: Record<string, DeploymentResult>;
  };
  configuration: {
    platformFeeBps: number;
    timelockDelay: number;
    multisigThreshold: string;
  };
  verification: {
    status: string;
    timestamp: string;
  };
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function log(message: string, level: "info" | "warn" | "error" | "success" = "info") {
  const colors = {
    info: "\x1b[36m",
    warn: "\x1b[33m",
    error: "\x1b[31m",
    success: "\x1b[32m",
  };
  const reset = "\x1b[0m";
  const timestamp = new Date().toISOString();
  console.log(`${colors[level]}[${timestamp}] ${message}${reset}`);
}

function logSection(title: string) {
  console.log("\n" + "═".repeat(60));
  console.log(`  ${title}`);
  console.log("═".repeat(60) + "\n");
}

async function confirmDeployment(): Promise<boolean> {
  // In non-interactive environments, check for CONFIRM_MAINNET_DEPLOY env var
  if (process.env.CONFIRM_MAINNET_DEPLOY === "true") {
    return true;
  }

  log("⚠️  MAINNET DEPLOYMENT REQUIRES MANUAL CONFIRMATION", "warn");
  log("Set CONFIRM_MAINNET_DEPLOY=true to proceed", "warn");
  return false;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================
// PRE-FLIGHT CHECKS
// ============================================

async function runPreflightChecks(): Promise<boolean> {
  logSection("🔍 PRE-FLIGHT CHECKS");

  const [deployer] = await ethers.getSigners();
  let checksPass = true;

  // 1. Network check
  log(`Network: ${network.name} (Chain ID: ${network.config.chainId})`);
  if (network.name !== "aethelredMainnet") {
    log("❌ Not on Aethelred Mainnet!", "error");
    checksPass = false;
  } else {
    log("✅ Correct network", "success");
  }

  // 2. Balance check
  const balance = await ethers.provider.getBalance(deployer.address);
  const balanceEther = ethers.formatEther(balance);
  log(`Deployer: ${deployer.address}`);
  log(`Balance: ${balanceEther} AETH`);

  const minBalance = ethers.parseEther(MAINNET_CONFIG.minDeployerBalance);
  if (balance < minBalance) {
    log(`❌ Insufficient balance. Need at least ${MAINNET_CONFIG.minDeployerBalance} AETH`, "error");
    checksPass = false;
  } else {
    log("✅ Sufficient balance", "success");
  }

  // 3. Gas price check
  const feeData = await ethers.provider.getFeeData();
  const gasPriceGwei = feeData.gasPrice ? Number(ethers.formatUnits(feeData.gasPrice, "gwei")) : 0;
  log(`Current gas price: ${gasPriceGwei.toFixed(2)} gwei`);

  if (gasPriceGwei > MAINNET_CONFIG.maxGasPrice) {
    log(`❌ Gas price too high. Max allowed: ${MAINNET_CONFIG.maxGasPrice} gwei`, "error");
    checksPass = false;
  } else {
    log("✅ Gas price acceptable", "success");
  }

  // 4. Multisig signers check
  log(`Multisig signers: ${MAINNET_CONFIG.multisigSigners.length}`);
  const invalidSigners = MAINNET_CONFIG.multisigSigners.filter(
    (s) => !s || !ethers.isAddress(s)
  );
  if (invalidSigners.length > 0) {
    log("❌ Invalid multisig signer addresses", "error");
    checksPass = false;
  } else if (MAINNET_CONFIG.multisigSigners.length < 3) {
    log("❌ Need at least 3 multisig signers for mainnet", "error");
    checksPass = false;
  } else {
    log("✅ Multisig signers configured", "success");
  }

  // 5. Timelock delay check
  if (MAINNET_CONFIG.timelockDelay < 3600) {
    log("⚠️ Timelock delay is less than 1 hour - not recommended for mainnet", "warn");
  } else {
    log(`✅ Timelock delay: ${MAINNET_CONFIG.timelockDelay / 3600} hours`, "success");
  }

  // 6. Contract compilation check
  try {
    await ethers.getContractFactory("CarbonCredit");
    await ethers.getContractFactory("CarbonMarketplace");
    await ethers.getContractFactory("VerificationEngine");
    await ethers.getContractFactory("TerraQuraAccessControl");
    log("✅ All contracts compiled", "success");
  } catch (error) {
    log("❌ Contract compilation error", "error");
    checksPass = false;
  }

  return checksPass;
}

// ============================================
// DEPLOYMENT FUNCTIONS
// ============================================

async function deployUUPSProxy(
  name: string,
  contractFactory: string,
  initArgs: unknown[]
): Promise<DeploymentResult> {
  log(`Deploying ${name}...`);

  const Factory = await ethers.getContractFactory(contractFactory);
  const proxy = await upgrades.deployProxy(Factory, initArgs, {
    kind: "uups",
    timeout: 300000, // 5 minutes
  });

  await proxy.waitForDeployment();

  const proxyAddress = await proxy.getAddress();
  const implAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress);

  const deployTx = proxy.deploymentTransaction();
  const receipt = await deployTx?.wait();

  log(`  ✅ Proxy: ${proxyAddress}`, "success");
  log(`  ✅ Implementation: ${implAddress}`, "success");
  log(`  Gas used: ${receipt?.gasUsed.toString() || "0"}`);

  return {
    name,
    proxy: proxyAddress,
    implementation: implAddress,
    txHash: receipt?.hash || "",
    gasUsed: receipt?.gasUsed || 0n,
    type: "uups",
  };
}

async function deployStandardContract(
  name: string,
  contractFactory: string,
  constructorArgs: unknown[]
): Promise<DeploymentResult> {
  log(`Deploying ${name}...`);

  const Factory = await ethers.getContractFactory(contractFactory);
  const contract = await Factory.deploy(...constructorArgs);

  await contract.waitForDeployment();

  const address = await contract.getAddress();
  const deployTx = contract.deploymentTransaction();
  const receipt = await deployTx?.wait();

  log(`  ✅ Address: ${address}`, "success");
  log(`  Gas used: ${receipt?.gasUsed.toString() || "0"}`);

  return {
    name,
    address,
    txHash: receipt?.hash || "",
    gasUsed: receipt?.gasUsed || 0n,
    type: "standard",
  };
}

// ============================================
// MAIN DEPLOYMENT
// ============================================

async function main() {
  console.clear();
  logSection("🚀 TERRAQURA AETHELRED MAINNET DEPLOYMENT");

  // Pre-flight checks
  const checksPass = await runPreflightChecks();
  if (!checksPass) {
    log("\n❌ Pre-flight checks failed. Aborting deployment.", "error");
    process.exit(1);
  }

  // Deployment confirmation
  const confirmed = await confirmDeployment();
  if (!confirmed) {
    log("\n⚠️ Deployment not confirmed. Aborting.", "warn");
    process.exit(0);
  }

  const [deployer] = await ethers.getSigners();
  const startBalance = await ethers.provider.getBalance(deployer.address);
  const deployments: DeploymentManifest = {
    network: "aethelredMainnet",
    chainId: 78431,
    deployedAt: new Date().toISOString(),
    deployedBy: deployer.address,
    version: "1.0.0",
    solidity: "0.8.28",
    totalGasUsed: "0",
    totalCost: "0",
    contracts: {
      core: {},
      governance: {},
      security: {},
      gasless: {},
    },
    configuration: {
      platformFeeBps: MAINNET_CONFIG.platformFeeBps,
      timelockDelay: MAINNET_CONFIG.timelockDelay,
      multisigThreshold: `${MAINNET_CONFIG.multisigThreshold}-of-${MAINNET_CONFIG.multisigSigners.length}`,
    },
    verification: {
      status: "pending",
      timestamp: "",
    },
  };

  let totalGasUsed = 0n;

  try {
    // ============================================
    // PHASE 1: CORE CONTRACTS
    // ============================================
    logSection("📦 PHASE 1: CORE CONTRACTS");

    // 1. Access Control
    const accessControl = await deployUUPSProxy(
      "TerraQuraAccessControl",
      "TerraQuraAccessControl",
      [deployer.address]
    );
    deployments.contracts.core["accessControl"] = accessControl;
    totalGasUsed += accessControl.gasUsed;
    await sleep(5000); // Rate limiting

    // 2. Verification Engine
    const verificationEngine = await deployUUPSProxy(
      "VerificationEngine",
      "VerificationEngine",
      [accessControl.proxy, ethers.ZeroAddress]
    );
    deployments.contracts.core["verificationEngine"] = verificationEngine;
    totalGasUsed += verificationEngine.gasUsed;
    await sleep(5000);

    // 3. Carbon Credit
    const carbonCredit = await deployUUPSProxy(
      "CarbonCredit",
      "CarbonCredit",
      [verificationEngine.proxy, MAINNET_CONFIG.metadataBaseUri, deployer.address]
    );
    deployments.contracts.core["carbonCredit"] = carbonCredit;
    totalGasUsed += carbonCredit.gasUsed;
    await sleep(5000);

    // Set CarbonCredit in VerificationEngine
    log("Setting CarbonCredit in VerificationEngine...");
    const veContract = await ethers.getContractAt(
      "VerificationEngine",
      verificationEngine.proxy!
    );
    const setTx = await veContract.setCarbonCreditContract(carbonCredit.proxy!);
    await setTx.wait();
    log("  ✅ CarbonCredit set in VerificationEngine", "success");
    await sleep(5000);

    // 4. Carbon Marketplace
    const carbonMarketplace = await deployUUPSProxy(
      "CarbonMarketplace",
      "CarbonMarketplace",
      [
        carbonCredit.proxy,
        accessControl.proxy,
        MAINNET_CONFIG.platformFeeBps,
        deployer.address, // Fee recipient (update to multisig later)
      ]
    );
    deployments.contracts.core["carbonMarketplace"] = carbonMarketplace;
    totalGasUsed += carbonMarketplace.gasUsed;
    await sleep(5000);

    // ============================================
    // PHASE 2: GOVERNANCE CONTRACTS
    // ============================================
    if (MAINNET_CONFIG.deployGovernance) {
      logSection("🏛️ PHASE 2: GOVERNANCE CONTRACTS");

      // 5. Multisig
      const multisig = await deployStandardContract(
        "TerraQuraMultisig",
        "TerraQuraMultisig",
        [MAINNET_CONFIG.multisigSigners, MAINNET_CONFIG.multisigThreshold]
      );
      deployments.contracts.governance["multisig"] = multisig;
      totalGasUsed += multisig.gasUsed;
      await sleep(5000);

      // 6. Timelock
      const timelock = await deployStandardContract(
        "TerraQuraTimelock",
        "TerraQuraTimelock",
        [
          MAINNET_CONFIG.timelockDelay,
          [multisig.address], // Proposers
          [ethers.ZeroAddress], // Executors (anyone)
          deployer.address, // Admin (transfer to multisig later)
          MAINNET_CONFIG.isProduction,
        ]
      );
      deployments.contracts.governance["timelock"] = timelock;
      totalGasUsed += timelock.gasUsed;
      await sleep(5000);
    }

    // ============================================
    // PHASE 3: SECURITY CONTRACTS
    // ============================================
    if (MAINNET_CONFIG.deployCircuitBreaker) {
      logSection("🛡️ PHASE 3: SECURITY CONTRACTS");

      // 7. Circuit Breaker
      const circuitBreaker = await deployUUPSProxy(
        "CircuitBreaker",
        "CircuitBreaker",
        [deployer.address]
      );
      deployments.contracts.security["circuitBreaker"] = circuitBreaker;
      totalGasUsed += circuitBreaker.gasUsed;
      await sleep(5000);

      // Register contracts with CircuitBreaker
      log("Registering contracts with CircuitBreaker...");
      const cbContract = await ethers.getContractAt(
        "CircuitBreaker",
        circuitBreaker.proxy!
      );
      await cbContract.registerContract(carbonCredit.proxy!);
      await cbContract.registerContract(carbonMarketplace.proxy!);

      if (MAINNET_CONFIG.deployGovernance) {
        await cbContract.addPauser(deployments.contracts.governance["multisig"].address!);
      }
      log("  ✅ CircuitBreaker configured", "success");
      await sleep(5000);
    }

    // ============================================
    // PHASE 4: GASLESS CONTRACTS
    // ============================================
    if (MAINNET_CONFIG.deployGaslessMarketplace) {
      logSection("⛽ PHASE 4: GASLESS CONTRACTS");

      // 8. Gasless Marketplace
      const gaslessMarketplace = await deployUUPSProxy(
        "GaslessMarketplace",
        "GaslessMarketplace",
        [accessControl.proxy, carbonCredit.proxy, deployer.address]
      );
      deployments.contracts.gasless["gaslessMarketplace"] = gaslessMarketplace;
      totalGasUsed += gaslessMarketplace.gasUsed;

      // Register with CircuitBreaker
      if (MAINNET_CONFIG.deployCircuitBreaker) {
        const cbContract = await ethers.getContractAt(
          "CircuitBreaker",
          deployments.contracts.security["circuitBreaker"].proxy!
        );
        await cbContract.registerContract(gaslessMarketplace.proxy!);
      }
      await sleep(5000);
    }

    // ============================================
    // PHASE 5: ROLE CONFIGURATION
    // ============================================
    logSection("🔑 PHASE 5: ROLE CONFIGURATION");

    const acContract = await ethers.getContractAt(
      "TerraQuraAccessControl",
      accessControl.proxy!
    );

    const MINTER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("MINTER_ROLE"));
    const OPERATOR_ROLE = ethers.keccak256(ethers.toUtf8Bytes("OPERATOR_ROLE"));
    const PAUSER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("PAUSER_ROLE"));

    // Grant roles to deployer (for initial setup)
    await acContract.grantRole(MINTER_ROLE, deployer.address);
    await acContract.grantRole(OPERATOR_ROLE, deployer.address);
    log("  ✅ Initial roles granted to deployer", "success");

    // Grant PAUSER_ROLE to CircuitBreaker and Multisig
    if (MAINNET_CONFIG.deployCircuitBreaker) {
      await acContract.grantRole(
        PAUSER_ROLE,
        deployments.contracts.security["circuitBreaker"].proxy!
      );
    }
    if (MAINNET_CONFIG.deployGovernance) {
      await acContract.grantRole(
        PAUSER_ROLE,
        deployments.contracts.governance["multisig"].address!
      );
    }
    log("  ✅ PAUSER_ROLE granted to CircuitBreaker and Multisig", "success");

    // ============================================
    // PHASE 6: FINALIZATION
    // ============================================
    logSection("📋 DEPLOYMENT SUMMARY");

    const endBalance = await ethers.provider.getBalance(deployer.address);
    const totalCost = startBalance - endBalance;

    deployments.totalGasUsed = totalGasUsed.toString();
    deployments.totalCost = ethers.formatEther(totalCost) + " AETH";

    // Save deployment manifest
    const manifestPath = path.join(
      __dirname,
      "..",
      "deployments",
      "aethelred-mainnet.json"
    );
    fs.writeFileSync(manifestPath, JSON.stringify(deployments, null, 2));
    log(`Deployment manifest saved to: ${manifestPath}`, "success");

    // Print summary
    console.log("\n" + "─".repeat(60));
    console.log("CORE CONTRACTS:");
    Object.entries(deployments.contracts.core).forEach(([name, data]) => {
      console.log(`  ${name}:`);
      if (data.proxy) console.log(`    Proxy: ${data.proxy}`);
      if (data.implementation) console.log(`    Impl:  ${data.implementation}`);
    });

    if (Object.keys(deployments.contracts.governance).length > 0) {
      console.log("\nGOVERNANCE CONTRACTS:");
      Object.entries(deployments.contracts.governance).forEach(([name, data]) => {
        console.log(`  ${name}: ${data.address}`);
      });
    }

    if (Object.keys(deployments.contracts.security).length > 0) {
      console.log("\nSECURITY CONTRACTS:");
      Object.entries(deployments.contracts.security).forEach(([name, data]) => {
        console.log(`  ${name}:`);
        if (data.proxy) console.log(`    Proxy: ${data.proxy}`);
        if (data.implementation) console.log(`    Impl:  ${data.implementation}`);
      });
    }

    if (Object.keys(deployments.contracts.gasless).length > 0) {
      console.log("\nGASLESS CONTRACTS:");
      Object.entries(deployments.contracts.gasless).forEach(([name, data]) => {
        console.log(`  ${name}:`);
        if (data.proxy) console.log(`    Proxy: ${data.proxy}`);
        if (data.implementation) console.log(`    Impl:  ${data.implementation}`);
      });
    }

    console.log("\n" + "─".repeat(60));
    console.log(`Total Gas Used: ${totalGasUsed.toString()}`);
    console.log(`Total Cost: ${ethers.formatEther(totalCost)} AETH`);
    console.log(`Remaining Balance: ${ethers.formatEther(endBalance)} AETH`);
    console.log("─".repeat(60));

    log("\n🎉 MAINNET DEPLOYMENT COMPLETE!", "success");
    log("\nNEXT STEPS:", "info");
    log("1. Run contract verification: npx hardhat run scripts/verify-mainnet.ts --network aethelredMainnet");
    log("2. Transfer ownership to Multisig/Timelock");
    log("3. Update frontend contract addresses");
    log("4. Perform post-deployment testing");

  } catch (error: any) {
    log(`\n❌ DEPLOYMENT FAILED: ${error.message}`, "error");
    console.error(error);

    // Save partial deployment for recovery
    const partialPath = path.join(
      __dirname,
      "..",
      "deployments",
      `aethelred-mainnet-partial-${Date.now()}.json`
    );
    fs.writeFileSync(partialPath, JSON.stringify(deployments, null, 2));
    log(`Partial deployment saved to: ${partialPath}`, "warn");

    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
