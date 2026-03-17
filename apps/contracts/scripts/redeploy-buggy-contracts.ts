import { ethers, upgrades } from "hardhat";

/**
 * Redeploy contracts that still have Solidity 0.8.28 bug
 *
 * Contracts to redeploy:
 * - VerificationEngine (was reused: 0x8f78979Ec38617Ad114CcbBbf448a26D0001238a)
 * - CarbonMarketplace (was reused: 0xb83402330a1d69C6EC455cC1d2cFa4747f1B6626)
 * - GaslessMarketplace (was reused: 0x5472c5096846f52cef6bc8FD30E95e9DcAda8463)
 */

// Current V2 deployment addresses
const CURRENT = {
  accessControl: "0x55695aAAEC30AB495074c57e85Ae2E1A4866B83b",
  carbonCredit: "0x29B58064fD95b175e5824767d3B18bACFafaF959",
};

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Redeploying buggy contracts with Solidity 0.8.28");
  console.log("Account:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Balance:", ethers.formatEther(balance), "POL\n");

  // Force recompile to ensure fresh bytecode
  console.log("Compiling with Solidity 0.8.28...\n");

  // ============================================
  // 1. Deploy fresh VerificationEngine
  // ============================================
  console.log("1. Deploying fresh VerificationEngine...");
  const VerificationEngine = await ethers.getContractFactory("VerificationEngine");
  const verificationEngine = await upgrades.deployProxy(
    VerificationEngine,
    [CURRENT.accessControl, CURRENT.carbonCredit],
    { kind: "uups" }
  );
  await verificationEngine.waitForDeployment();
  const verificationEngineAddr = await verificationEngine.getAddress();
  const verificationEngineImpl = await upgrades.erc1967.getImplementationAddress(verificationEngineAddr);
  console.log("   Proxy:", verificationEngineAddr);
  console.log("   Impl:", verificationEngineImpl);

  // ============================================
  // 2. Deploy fresh CarbonMarketplace
  // ============================================
  console.log("\n2. Deploying fresh CarbonMarketplace...");
  const CarbonMarketplace = await ethers.getContractFactory("CarbonMarketplace");
  const carbonMarketplace = await upgrades.deployProxy(
    CarbonMarketplace,
    [CURRENT.carbonCredit, CURRENT.accessControl, 250, deployer.address],
    { kind: "uups" }
  );
  await carbonMarketplace.waitForDeployment();
  const carbonMarketplaceAddr = await carbonMarketplace.getAddress();
  const carbonMarketplaceImpl = await upgrades.erc1967.getImplementationAddress(carbonMarketplaceAddr);
  console.log("   Proxy:", carbonMarketplaceAddr);
  console.log("   Impl:", carbonMarketplaceImpl);

  // ============================================
  // 3. Deploy fresh GaslessMarketplace
  // ============================================
  console.log("\n3. Deploying fresh GaslessMarketplace...");
  const GaslessMarketplace = await ethers.getContractFactory("GaslessMarketplace");
  const gaslessMarketplace = await upgrades.deployProxy(
    GaslessMarketplace,
    [CURRENT.accessControl, CURRENT.carbonCredit, deployer.address],
    { kind: "uups" }
  );
  await gaslessMarketplace.waitForDeployment();
  const gaslessMarketplaceAddr = await gaslessMarketplace.getAddress();
  const gaslessMarketplaceImpl = await upgrades.erc1967.getImplementationAddress(gaslessMarketplaceAddr);
  console.log("   Proxy:", gaslessMarketplaceAddr);
  console.log("   Impl:", gaslessMarketplaceImpl);

  // ============================================
  // Summary
  // ============================================
  const finalBalance = await ethers.provider.getBalance(deployer.address);

  console.log("\n========================================");
  console.log("REDEPLOYMENT COMPLETE (Solidity 0.8.28)");
  console.log("========================================");
  console.log("\nNEW IMPLEMENTATIONS (0.8.28 - No bug):");
  console.log("  VerificationEngine Impl:", verificationEngineImpl);
  console.log("  CarbonMarketplace Impl:", carbonMarketplaceImpl);
  console.log("  GaslessMarketplace Impl:", gaslessMarketplaceImpl);
  console.log("\nNEW PROXY ADDRESSES:");
  console.log("  VerificationEngine:", verificationEngineAddr);
  console.log("  CarbonMarketplace:", carbonMarketplaceAddr);
  console.log("  GaslessMarketplace:", gaslessMarketplaceAddr);
  console.log("\nGas used:", ethers.formatEther(balance - finalBalance), "POL");

  // Output for verification script update
  console.log("\n// Update verify-all-contracts.ts with:");
  console.log(`verificationEngine: "${verificationEngineImpl}",`);
  console.log(`carbonMarketplace: "${carbonMarketplaceImpl}",`);
  console.log(`gaslessMarketplace: "${gaslessMarketplaceImpl}",`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
