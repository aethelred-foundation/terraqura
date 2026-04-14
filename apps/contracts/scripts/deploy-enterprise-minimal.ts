import { ethers, upgrades } from "hardhat";

/**
 * Minimal Enterprise Deployment - deploys remaining contracts one by one
 *
 * ALREADY DEPLOYED:
 * - TerraQuraMultisig: 0xd122120E35446617c34AD0164573372a59da9FdF (from failed run)
 * - Earlier Multisig: 0xBcCeB8cc6995c54467D144De05eD0325f0448a05
 */

const EXISTING_CONTRACTS = {
  accessControl: "0x6098a0cF16D90817f4C8d730DeA998453F2DE904",
  verificationEngine: "0xcB746aB50254A735566676979e69aD6F5842080d",
  carbonCredit: "0xfc0CaCA6C6abc035562F4a47e12a0d8f7Cd51036",
  carbonMarketplace: "0xABc0Fa37a6B78DA9514ee36974DAf16ABafFd682",
  // From earlier deployment runs
  multisig: "0xBcCeB8cc6995c54467D144De05eD0325f0448a05",
  timelock: "0x57AA5593dD9a8cBB6080247cb2CD2F2a7D21Ac31",
  circuitBreaker: {
    proxy: "0xa0489d8a69075908926bCDdAe2D6BD61EbBb550B",
    impl: "0x8a02DD0A8C24478F4d0271a584b04A42a275dBc3",
  },
};

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "POL\n");

  if (balance < ethers.parseEther("0.1")) {
    console.log("⚠️  Low balance! Only deploying GaslessMarketplace...\n");
  }

  // Deploy only GaslessMarketplace (needed still)
  console.log("Deploying GaslessMarketplace (UUPS Proxy)...");

  const TerraQuraForwarder = await ethers.getContractFactory("TerraQuraForwarder");
  const forwarder = await TerraQuraForwarder.deploy();
  await forwarder.waitForDeployment();
  const trustedForwarder = await forwarder.getAddress();

  const GaslessMarketplace = await ethers.getContractFactory("GaslessMarketplace");
  const gaslessMarketplace = await upgrades.deployProxy(
    GaslessMarketplace,
    [EXISTING_CONTRACTS.accessControl, EXISTING_CONTRACTS.carbonCredit, trustedForwarder],
    { kind: "uups" }
  );
  await gaslessMarketplace.waitForDeployment();
  const gaslessMarketplaceAddress = await gaslessMarketplace.getAddress();
  const gaslessMarketplaceImpl = await upgrades.erc1967.getImplementationAddress(gaslessMarketplaceAddress);

  console.log("   GaslessMarketplace Proxy:", gaslessMarketplaceAddress);
  console.log("   GaslessMarketplace Impl:", gaslessMarketplaceImpl);
  console.log("   TerraQuraForwarder:", trustedForwarder);

  // Configure CircuitBreaker to monitor GaslessMarketplace
  console.log("\nConfiguring CircuitBreaker...");
  const circuitBreaker = await ethers.getContractAt("CircuitBreaker", EXISTING_CONTRACTS.circuitBreaker.proxy);
  await circuitBreaker.registerContract(gaslessMarketplaceAddress);
  await gaslessMarketplace.setCircuitBreaker(EXISTING_CONTRACTS.circuitBreaker.proxy);
  console.log("   Registered GaslessMarketplace with CircuitBreaker");
  console.log("   Linked GaslessMarketplace to CircuitBreaker");

  console.log("\n========================================");
  console.log("ENTERPRISE DEPLOYMENT COMPLETE");
  console.log("========================================");
  console.log("ALL CONTRACTS:");
  console.log("----------------------------------------");
  console.log("CORE:");
  console.log("  AccessControl:", EXISTING_CONTRACTS.accessControl);
  console.log("  VerificationEngine:", EXISTING_CONTRACTS.verificationEngine);
  console.log("  CarbonCredit:", EXISTING_CONTRACTS.carbonCredit);
  console.log("  CarbonMarketplace:", EXISTING_CONTRACTS.carbonMarketplace);
  console.log("----------------------------------------");
  console.log("GOVERNANCE:");
  console.log("  Multisig:", EXISTING_CONTRACTS.multisig);
  console.log("  Timelock:", EXISTING_CONTRACTS.timelock);
  console.log("----------------------------------------");
  console.log("SECURITY:");
  console.log("  CircuitBreaker:", EXISTING_CONTRACTS.circuitBreaker.proxy);
  console.log("----------------------------------------");
  console.log("GASLESS:");
  console.log("  TerraQuraForwarder:", trustedForwarder);
  console.log("  GaslessMarketplace:", gaslessMarketplaceAddress);
  console.log("========================================");

  const finalBalance = await ethers.provider.getBalance(deployer.address);
  console.log("\nFinal balance:", ethers.formatEther(finalBalance), "POL");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
