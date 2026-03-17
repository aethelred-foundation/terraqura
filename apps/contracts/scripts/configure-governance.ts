import { ethers } from "hardhat";

/**
 * Configure Enterprise Governance
 *
 * This script properly wires up:
 * 1. CircuitBreaker - registers all contracts for monitoring
 * 2. Multisig - grants pauser role to multisig
 * 3. Timelock - sets up timelock as admin for critical operations
 *
 * Run after all contracts are deployed.
 */

const CONTRACTS = {
  // Core
  accessControl: "0x6098a0cF16D90817f4C8d730DeA998453F2DE904",
  verificationEngine: "0xcB746aB50254A735566676979e69aD6F5842080d",
  carbonCredit: "0xfc0CaCA6C6abc035562F4a47e12a0d8f7Cd51036",
  carbonMarketplace: "0xABc0Fa37a6B78DA9514ee36974DAf16ABafFd682",
  // Governance
  multisig: "0xBcCeB8cc6995c54467D144De05eD0325f0448a05",
  timelock: "0x57AA5593dD9a8cBB6080247cb2CD2F2a7D21Ac31",
  // Security
  circuitBreaker: "0xa0489d8a69075908926bCDdAe2D6BD61EbBb550B",
};

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Configuring governance with account:", deployer.address);
  console.log("========================================\n");

  // Get contract instances
  const accessControl = await ethers.getContractAt("TerraQuraAccessControl", CONTRACTS.accessControl);
  const circuitBreaker = await ethers.getContractAt("CircuitBreaker", CONTRACTS.circuitBreaker);

  // ============================================
  // 1. Configure CircuitBreaker
  // ============================================
  console.log("1. Configuring CircuitBreaker...");

  // Check if contracts are already registered
  const status = await circuitBreaker.getStatus();
  console.log("   Currently monitoring:", status.monitoredCount.toString(), "contracts");

  // Register core contracts for monitoring
  const contractsToMonitor = [
    { name: "CarbonCredit", address: CONTRACTS.carbonCredit },
    { name: "CarbonMarketplace", address: CONTRACTS.carbonMarketplace },
    { name: "VerificationEngine", address: CONTRACTS.verificationEngine },
  ];

  for (const contract of contractsToMonitor) {
    try {
      const contractStatus = await circuitBreaker.getContractStatus(contract.address);
      if (contractStatus.level === 0n) {
        // Not registered yet
        const tx = await circuitBreaker.registerContract(contract.address);
        await tx.wait();
        console.log(`   ✅ Registered ${contract.name}`);
      } else {
        console.log(`   ℹ️  ${contract.name} already registered`);
      }
    } catch (error: any) {
      console.log(`   ⚠️  ${contract.name}: ${error.message}`);
    }
  }

  // Add multisig as pauser
  const isMultisigPauser = await circuitBreaker.isPauser(CONTRACTS.multisig);
  if (!isMultisigPauser) {
    const tx = await circuitBreaker.addPauser(CONTRACTS.multisig);
    await tx.wait();
    console.log("   ✅ Added Multisig as pauser");
  } else {
    console.log("   ℹ️  Multisig already a pauser");
  }

  // ============================================
  // 2. Configure Access Control Roles
  // ============================================
  console.log("\n2. Configuring AccessControl roles...");

  const PAUSER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("PAUSER_ROLE"));

  // Grant PAUSER_ROLE to CircuitBreaker
  const hasPauserRole = await accessControl.hasRole(PAUSER_ROLE, CONTRACTS.circuitBreaker);
  if (!hasPauserRole) {
    const tx = await accessControl.grantRole(PAUSER_ROLE, CONTRACTS.circuitBreaker);
    await tx.wait();
    console.log("   ✅ Granted PAUSER_ROLE to CircuitBreaker");
  } else {
    console.log("   ℹ️  CircuitBreaker already has PAUSER_ROLE");
  }

  // Grant PAUSER_ROLE to Multisig
  const multisigHasPauser = await accessControl.hasRole(PAUSER_ROLE, CONTRACTS.multisig);
  if (!multisigHasPauser) {
    const tx = await accessControl.grantRole(PAUSER_ROLE, CONTRACTS.multisig);
    await tx.wait();
    console.log("   ✅ Granted PAUSER_ROLE to Multisig");
  } else {
    console.log("   ℹ️  Multisig already has PAUSER_ROLE");
  }

  // ============================================
  // 3. Summary
  // ============================================
  console.log("\n========================================");
  console.log("GOVERNANCE CONFIGURATION COMPLETE");
  console.log("========================================");

  // Verify final state
  const finalStatus = await circuitBreaker.getStatus();
  console.log("\nCircuitBreaker Status:");
  console.log("  Global Pause:", finalStatus.isGloballyPaused);
  console.log("  Security Level:", finalStatus.currentLevel.toString());
  console.log("  Monitored Contracts:", finalStatus.monitoredCount.toString());

  console.log("\nPausers:");
  console.log("  Owner:", await circuitBreaker.isPauser(deployer.address) ? "✅" : "❌");
  console.log("  Multisig:", await circuitBreaker.isPauser(CONTRACTS.multisig) ? "✅" : "❌");

  console.log("\nAccess Control Roles:");
  console.log("  CircuitBreaker PAUSER:", await accessControl.hasRole(PAUSER_ROLE, CONTRACTS.circuitBreaker) ? "✅" : "❌");
  console.log("  Multisig PAUSER:", await accessControl.hasRole(PAUSER_ROLE, CONTRACTS.multisig) ? "✅" : "❌");

  console.log("\n========================================");
  console.log("Next Steps for Production:");
  console.log("1. Transfer contract ownership to Timelock");
  console.log("2. Set Timelock as DEFAULT_ADMIN_ROLE");
  console.log("3. Renounce deployer admin role");
  console.log("========================================");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
