import { ethers, upgrades } from "hardhat";

/**
 * Redeploy ALL TerraQura Contracts with Solidity 0.8.28
 *
 * This fixes the LostStorageArrayWriteOnSlotOverflow bug warning
 *
 * Run: npx hardhat run scripts/redeploy-all.ts --network aethelredTestnet
 */

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Redeploying ALL contracts with Solidity 0.8.28");
  console.log("Account:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Balance:", ethers.formatEther(balance), "AETH\n");

  // ============================================
  // 1. Deploy TerraQuraAccessControl (UUPS)
  // ============================================
  console.log("1. Deploying TerraQuraAccessControl...");
  const AccessControl = await ethers.getContractFactory("TerraQuraAccessControl");
  const accessControl = await upgrades.deployProxy(AccessControl, [deployer.address], { kind: "uups" });
  await accessControl.waitForDeployment();
  const accessControlAddr = await accessControl.getAddress();
  const accessControlImpl = await upgrades.erc1967.getImplementationAddress(accessControlAddr);
  console.log("   Proxy:", accessControlAddr);
  console.log("   Impl:", accessControlImpl);

  // ============================================
  // 2. Deploy VerificationEngine (UUPS)
  // ============================================
  console.log("\n2. Deploying VerificationEngine...");
  const VerificationEngine = await ethers.getContractFactory("VerificationEngine");
  const verificationEngine = await upgrades.deployProxy(
    VerificationEngine,
    [accessControlAddr, ethers.ZeroAddress],
    { kind: "uups" }
  );
  await verificationEngine.waitForDeployment();
  const verificationEngineAddr = await verificationEngine.getAddress();
  const verificationEngineImpl = await upgrades.erc1967.getImplementationAddress(verificationEngineAddr);
  console.log("   Proxy:", verificationEngineAddr);
  console.log("   Impl:", verificationEngineImpl);

  // ============================================
  // 3. Deploy CarbonCredit (UUPS)
  // ============================================
  console.log("\n3. Deploying CarbonCredit...");
  const CarbonCredit = await ethers.getContractFactory("CarbonCredit");
  const carbonCredit = await upgrades.deployProxy(
    CarbonCredit,
    [verificationEngineAddr, "https://api.terraqura.io/metadata/", deployer.address],
    { kind: "uups" }
  );
  await carbonCredit.waitForDeployment();
  const carbonCreditAddr = await carbonCredit.getAddress();
  const carbonCreditImpl = await upgrades.erc1967.getImplementationAddress(carbonCreditAddr);
  console.log("   Proxy:", carbonCreditAddr);
  console.log("   Impl:", carbonCreditImpl);

  // Set CarbonCredit in VerificationEngine
  await verificationEngine.setCarbonCreditContract(carbonCreditAddr);
  console.log("   CarbonCredit set in VerificationEngine");

  // ============================================
  // 4. Deploy CarbonMarketplace (UUPS)
  // ============================================
  console.log("\n4. Deploying CarbonMarketplace...");
  const CarbonMarketplace = await ethers.getContractFactory("CarbonMarketplace");
  const carbonMarketplace = await upgrades.deployProxy(
    CarbonMarketplace,
    [carbonCreditAddr, accessControlAddr, 250, deployer.address],
    { kind: "uups" }
  );
  await carbonMarketplace.waitForDeployment();
  const carbonMarketplaceAddr = await carbonMarketplace.getAddress();
  const carbonMarketplaceImpl = await upgrades.erc1967.getImplementationAddress(carbonMarketplaceAddr);
  console.log("   Proxy:", carbonMarketplaceAddr);
  console.log("   Impl:", carbonMarketplaceImpl);

  // ============================================
  // 5. Deploy TerraQuraMultisig
  // ============================================
  console.log("\n5. Deploying TerraQuraMultisig (2-of-3)...");
  const signers = [
    deployer.address,
    "0x1111111111111111111111111111111111111111",
    "0x2222222222222222222222222222222222222222",
  ];
  const TerraQuraMultisig = await ethers.getContractFactory("TerraQuraMultisig");
  const multisig = await TerraQuraMultisig.deploy(signers, 2);
  await multisig.waitForDeployment();
  const multisigAddr = await multisig.getAddress();
  console.log("   Address:", multisigAddr);

  // ============================================
  // 6. Deploy TerraQuraTimelock
  // ============================================
  console.log("\n6. Deploying TerraQuraTimelock...");
  const TerraQuraTimelock = await ethers.getContractFactory("TerraQuraTimelock");
  const timelock = await TerraQuraTimelock.deploy(
    3600, // 1 hour for testnet
    [multisigAddr], // proposers
    [ethers.ZeroAddress], // executors (anyone)
    deployer.address, // admin
    false // isProduction
  );
  await timelock.waitForDeployment();
  const timelockAddr = await timelock.getAddress();
  console.log("   Address:", timelockAddr);

  // ============================================
  // 7. Deploy CircuitBreaker (UUPS)
  // ============================================
  console.log("\n7. Deploying CircuitBreaker...");
  const CircuitBreaker = await ethers.getContractFactory("CircuitBreaker");
  const circuitBreaker = await upgrades.deployProxy(CircuitBreaker, [deployer.address], { kind: "uups" });
  await circuitBreaker.waitForDeployment();
  const circuitBreakerAddr = await circuitBreaker.getAddress();
  const circuitBreakerImpl = await upgrades.erc1967.getImplementationAddress(circuitBreakerAddr);
  console.log("   Proxy:", circuitBreakerAddr);
  console.log("   Impl:", circuitBreakerImpl);

  // ============================================
  // 8. Deploy GaslessMarketplace (UUPS)
  // ============================================
  console.log("\n8. Deploying GaslessMarketplace...");
  const GaslessMarketplace = await ethers.getContractFactory("GaslessMarketplace");
  const gaslessMarketplace = await upgrades.deployProxy(
    GaslessMarketplace,
    [accessControlAddr, carbonCreditAddr, deployer.address],
    { kind: "uups" }
  );
  await gaslessMarketplace.waitForDeployment();
  const gaslessMarketplaceAddr = await gaslessMarketplace.getAddress();
  const gaslessMarketplaceImpl = await upgrades.erc1967.getImplementationAddress(gaslessMarketplaceAddr);
  console.log("   Proxy:", gaslessMarketplaceAddr);
  console.log("   Impl:", gaslessMarketplaceImpl);

  // ============================================
  // 9. Configure Roles & Governance
  // ============================================
  console.log("\n9. Configuring roles and governance...");

  // Grant roles
  const MINTER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("MINTER_ROLE"));
  const OPERATOR_ROLE = ethers.keccak256(ethers.toUtf8Bytes("OPERATOR_ROLE"));
  const PAUSER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("PAUSER_ROLE"));

  await accessControl.grantRole(MINTER_ROLE, deployer.address);
  await accessControl.grantRole(OPERATOR_ROLE, deployer.address);
  await accessControl.grantRole(PAUSER_ROLE, circuitBreakerAddr);
  await accessControl.grantRole(PAUSER_ROLE, multisigAddr);
  console.log("   Roles granted");

  // Register contracts with CircuitBreaker
  await circuitBreaker.registerContract(carbonCreditAddr);
  await circuitBreaker.registerContract(carbonMarketplaceAddr);
  await circuitBreaker.registerContract(gaslessMarketplaceAddr);
  await circuitBreaker.addPauser(multisigAddr);
  console.log("   CircuitBreaker configured");

  // Whitelist test DAC
  const testDacId = ethers.keccak256(ethers.toUtf8Bytes("test-dac-unit-001"));
  await verificationEngine.whitelistDacUnit(testDacId, deployer.address);
  console.log("   Test DAC whitelisted");

  // ============================================
  // Summary
  // ============================================
  const finalBalance = await ethers.provider.getBalance(deployer.address);

  console.log("\n========================================");
  console.log("REDEPLOYMENT COMPLETE (Solidity 0.8.28)");
  console.log("========================================");
  console.log("\nCORE CONTRACTS:");
  console.log("  AccessControl Proxy:", accessControlAddr);
  console.log("  AccessControl Impl:", accessControlImpl);
  console.log("  VerificationEngine Proxy:", verificationEngineAddr);
  console.log("  VerificationEngine Impl:", verificationEngineImpl);
  console.log("  CarbonCredit Proxy:", carbonCreditAddr);
  console.log("  CarbonCredit Impl:", carbonCreditImpl);
  console.log("  CarbonMarketplace Proxy:", carbonMarketplaceAddr);
  console.log("  CarbonMarketplace Impl:", carbonMarketplaceImpl);
  console.log("\nGOVERNANCE:");
  console.log("  Multisig:", multisigAddr);
  console.log("  Timelock:", timelockAddr);
  console.log("\nSECURITY:");
  console.log("  CircuitBreaker Proxy:", circuitBreakerAddr);
  console.log("  CircuitBreaker Impl:", circuitBreakerImpl);
  console.log("\nGASLESS:");
  console.log("  GaslessMarketplace Proxy:", gaslessMarketplaceAddr);
  console.log("  GaslessMarketplace Impl:", gaslessMarketplaceImpl);
  console.log("\nTEST DAC ID:", testDacId);
  console.log("\nGas used:", ethers.formatEther(balance - finalBalance), "AETH");
  console.log("Final balance:", ethers.formatEther(finalBalance), "AETH");

  // Output JSON for verification script
  console.log("\n// Update verify-all-contracts.ts with these addresses:");
  console.log(`const IMPLEMENTATIONS = {
  accessControl: "${accessControlImpl}",
  verificationEngine: "${verificationEngineImpl}",
  carbonCredit: "${carbonCreditImpl}",
  carbonMarketplace: "${carbonMarketplaceImpl}",
  circuitBreaker: "${circuitBreakerImpl}",
  gaslessMarketplace: "${gaslessMarketplaceImpl}",
};

const STANDARD_CONTRACTS = {
  multisig: {
    address: "${multisigAddr}",
    constructorArgs: [
      ["${deployer.address}", "0x1111111111111111111111111111111111111111", "0x2222222222222222222222222222222222222222"],
      2,
    ],
  },
  timelock: {
    address: "${timelockAddr}",
    constructorArgs: [3600, ["${multisigAddr}"], ["0x0000000000000000000000000000000000000000"], "${deployer.address}", false],
  },
};`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
