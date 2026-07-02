import { ethers, upgrades } from "hardhat";
import {
  getActiveDeployment,
  getActiveDeploymentKey,
  getNetwork,
  requireContractAddress,
  withContractAddressOverrides,
} from "@terraqura/network-manifest";

/**
 * Enterprise Deployment Script
 * Deploys: TerraQuraTimelock, TerraQuraMultisig, CircuitBreaker, GaslessMarketplace
 *
 * Requires either a deployed manifest or TERRAQURA_CONTRACT_* overrides for
 * the existing core contracts.
 */

const deploymentEnv = {
  ...process.env,
  TERRAQURA_NETWORK: process.env.TERRAQURA_NETWORK ?? "aethelredTestnet",
};
const ACTIVE_DEPLOYMENT_KEY = getActiveDeploymentKey(deploymentEnv);
const ACTIVE_DEPLOYMENT = getActiveDeployment(deploymentEnv);
const ACTIVE_NETWORK = getNetwork(ACTIVE_DEPLOYMENT.network);
const ACTIVE_CONTRACTS = withContractAddressOverrides(ACTIVE_DEPLOYMENT.contracts, deploymentEnv);

const EXISTING_CONTRACTS = {
  accessControl: requireContractAddress(ACTIVE_CONTRACTS, "accessControl", ACTIVE_DEPLOYMENT_KEY),
  verificationEngine: requireContractAddress(ACTIVE_CONTRACTS, "verificationEngine", ACTIVE_DEPLOYMENT_KEY),
  carbonCredit: requireContractAddress(ACTIVE_CONTRACTS, "carbonCredit", ACTIVE_DEPLOYMENT_KEY),
  carbonMarketplace: requireContractAddress(ACTIVE_CONTRACTS, "carbonMarketplace", ACTIVE_DEPLOYMENT_KEY),
};

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying Enterprise Security contracts with account:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "AETHEL\n");

  // ============================================
  // 1. Deploy TerraQuraMultisig (2-of-3 for testnet)
  // ============================================
  console.log("1. Deploying TerraQuraMultisig (2-of-3)...");

  // For testnet, we use deployer as all signers (replace with real addresses in production)
  // In production, these would be different hardware wallet addresses
  const signers = [
    deployer.address,
    "0x1111111111111111111111111111111111111111", // Placeholder signer 2
    "0x2222222222222222222222222222222222222222", // Placeholder signer 3
  ];
  const threshold = 2; // 2-of-3

  const TerraQuraMultisig = await ethers.getContractFactory("TerraQuraMultisig");
  const multisig = await TerraQuraMultisig.deploy(signers, threshold);
  await multisig.waitForDeployment();
  const multisigAddress = await multisig.getAddress();
  console.log("   TerraQuraMultisig:", multisigAddress);

  // ============================================
  // 2. Deploy TerraQuraTimelock
  // ============================================
  console.log("\n2. Deploying TerraQuraTimelock...");

  const minDelay = 1 * 60 * 60; // 1 hour for testnet (2 days for mainnet)
  const proposers = [multisigAddress]; // Multisig can propose
  const executors = [ethers.ZeroAddress]; // Anyone can execute after delay
  const admin = deployer.address; // Admin for initial setup

  const TerraQuraTimelock = await ethers.getContractFactory("TerraQuraTimelock");
  const timelock = await TerraQuraTimelock.deploy(
    minDelay,
    proposers,
    executors,
    admin,
    false // isProduction = false for testnet
  );
  await timelock.waitForDeployment();
  const timelockAddress = await timelock.getAddress();
  console.log("   TerraQuraTimelock:", timelockAddress);

  // ============================================
  // 3. Deploy CircuitBreaker (UUPS Proxy)
  // ============================================
  console.log("\n3. Deploying CircuitBreaker (UUPS Proxy)...");

  const CircuitBreaker = await ethers.getContractFactory("CircuitBreaker");
  const circuitBreaker = await upgrades.deployProxy(
    CircuitBreaker,
    [deployer.address],
    { kind: "uups" }
  );
  await circuitBreaker.waitForDeployment();
  const circuitBreakerAddress = await circuitBreaker.getAddress();
  const circuitBreakerImpl = await upgrades.erc1967.getImplementationAddress(circuitBreakerAddress);
  console.log("   CircuitBreaker Proxy:", circuitBreakerAddress);
  console.log("   CircuitBreaker Impl:", circuitBreakerImpl);

  // ============================================
  // 4. Deploy GaslessMarketplace (UUPS Proxy)
  // ============================================
  console.log("\n4. Deploying GaslessMarketplace (UUPS Proxy)...");

  // For testnet, use deployer as trusted forwarder (replace with real forwarder in production)
  const trustedForwarder = deployer.address;

  const GaslessMarketplace = await ethers.getContractFactory("GaslessMarketplace");
  const gaslessMarketplace = await upgrades.deployProxy(
    GaslessMarketplace,
    [EXISTING_CONTRACTS.accessControl, EXISTING_CONTRACTS.carbonCredit, trustedForwarder],
    { kind: "uups", unsafeAllow: ["constructor"] }
  );
  await gaslessMarketplace.waitForDeployment();
  const gaslessMarketplaceAddress = await gaslessMarketplace.getAddress();
  const gaslessMarketplaceImpl = await upgrades.erc1967.getImplementationAddress(gaslessMarketplaceAddress);
  console.log("   GaslessMarketplace Proxy:", gaslessMarketplaceAddress);
  console.log("   GaslessMarketplace Impl:", gaslessMarketplaceImpl);

  // ============================================
  // 5. Configure CircuitBreaker
  // ============================================
  console.log("\n5. Configuring CircuitBreaker...");

  // Register all contracts with CircuitBreaker
  const contractsToMonitor = [
    EXISTING_CONTRACTS.carbonCredit,
    EXISTING_CONTRACTS.carbonMarketplace,
    gaslessMarketplaceAddress,
  ];

  for (const contractAddr of contractsToMonitor) {
    await circuitBreaker.registerContract(contractAddr);
    console.log("   Registered:", contractAddr);
  }

  // Add multisig as pauser
  await circuitBreaker.addPauser(multisigAddress);
  console.log("   Added multisig as pauser");

  // ============================================
  // Summary
  // ============================================
  console.log("\n========================================");
  console.log("ENTERPRISE DEPLOYMENT COMPLETE");
  console.log("========================================");
  console.log("Network:", ACTIVE_NETWORK.name);
  console.log("Chain ID:", ACTIVE_NETWORK.chainId);
  console.log("Deployment:", ACTIVE_DEPLOYMENT_KEY);
  console.log("----------------------------------------");
  console.log("GOVERNANCE:");
  console.log("  TerraQuraMultisig:", multisigAddress);
  console.log("    - Threshold: 2-of-3");
  console.log("    - Signers:", signers.join(", "));
  console.log("----------------------------------------");
  console.log("  TerraQuraTimelock:", timelockAddress);
  console.log("    - Min Delay: 1 hour (testnet)");
  console.log("    - Proposer: Multisig");
  console.log("----------------------------------------");
  console.log("SECURITY:");
  console.log("  CircuitBreaker Proxy:", circuitBreakerAddress);
  console.log("  CircuitBreaker Impl:", circuitBreakerImpl);
  console.log("    - Pausers: Owner, Multisig");
  console.log("----------------------------------------");
  console.log("GASLESS:");
  console.log("  GaslessMarketplace Proxy:", gaslessMarketplaceAddress);
  console.log("  GaslessMarketplace Impl:", gaslessMarketplaceImpl);
  console.log("----------------------------------------");
  console.log("PREVIOUSLY DEPLOYED (Core):");
  console.log("  AccessControl:", EXISTING_CONTRACTS.accessControl);
  console.log("  VerificationEngine:", EXISTING_CONTRACTS.verificationEngine);
  console.log("  CarbonCredit:", EXISTING_CONTRACTS.carbonCredit);
  console.log("  CarbonMarketplace:", EXISTING_CONTRACTS.carbonMarketplace);
  console.log("========================================");

  const finalBalance = await ethers.provider.getBalance(deployer.address);
  console.log("\nFinal balance:", ethers.formatEther(finalBalance), "AETHEL");
  console.log("Gas used:", ethers.formatEther(balance - finalBalance), "AETHEL");

  // Output JSON for records
  const deployment = {
    network: ACTIVE_NETWORK.name,
    chainId: ACTIVE_NETWORK.chainId,
    deploymentKey: ACTIVE_DEPLOYMENT_KEY,
    deployedAt: new Date().toISOString(),
    governance: {
      multisig: {
        address: multisigAddress,
        threshold: threshold,
        signers: signers,
      },
      timelock: {
        address: timelockAddress,
        minDelay: minDelay,
        proposers: proposers,
      },
    },
    security: {
      circuitBreaker: {
        proxy: circuitBreakerAddress,
        implementation: circuitBreakerImpl,
      },
    },
    gasless: {
      gaslessMarketplace: {
        proxy: gaslessMarketplaceAddress,
        implementation: gaslessMarketplaceImpl,
        trustedForwarder: trustedForwarder,
      },
    },
    core: EXISTING_CONTRACTS,
  };

  console.log("\nDeployment JSON:");
  console.log(JSON.stringify(deployment, null, 2));

  return deployment;
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
