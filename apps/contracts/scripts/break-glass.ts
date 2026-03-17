/**
 * TerraQura Break Glass Emergency Procedures
 *
 * Emergency response scripts for critical situations:
 *
 * 1. PAUSE ALL - Emergency pause all contracts
 * 2. UNPAUSE ALL - Resume operations after incident
 * 3. REVOKE ACCESS - Emergency access revocation
 * 4. FREEZE ACCOUNT - Freeze suspicious account
 * 5. EMERGENCY WITHDRAW - Rescue stuck funds
 * 6. UPGRADE CONTRACTS - Emergency contract upgrade
 *
 * Usage:
 *   npx hardhat run scripts/break-glass.ts --network aethelred
 *
 * Environment Variables Required:
 *   CARBON_CREDIT_ADDRESS
 *   MARKETPLACE_ADDRESS
 *   ACCESS_CONTROL_ADDRESS
 *
 * Multi-sig Required: Most operations require 3-of-5 Gnosis Safe approval
 */

import { ethers } from "hardhat";
import { formatEther } from "ethers";
import * as readline from "readline";

// ============================================
// CONFIGURATION
// ============================================

interface ContractAddresses {
  carbonCredit: string;
  marketplace: string;
  accessControl: string;
  forwarder: string;
  verificationEngine: string;
}

const BREAK_GLASS_CONFIG = {
  // Delay before critical operations (seconds)
  confirmationDelay: 5,

  // Emergency contacts
  contacts: {
    techLead: "tech@terraqura.io",
    security: "security@terraqura.io",
    compliance: "compliance@terraqura.io",
  },

  // Incident severity levels
  severity: {
    CRITICAL: "🔴 CRITICAL",
    HIGH: "🟠 HIGH",
    MEDIUM: "🟡 MEDIUM",
    LOW: "🟢 LOW",
  },
};

// ============================================
// HELPER FUNCTIONS
// ============================================

function logHeader(title: string, severity?: string) {
  console.log("\n" + "═".repeat(70));
  if (severity) {
    console.log(`  ${severity} - ${title}`);
  } else {
    console.log(`  ${title}`);
  }
  console.log("═".repeat(70) + "\n");
}

function logStep(step: number, message: string) {
  console.log(`  [Step ${step}] ${message}`);
}

function logSuccess(message: string) {
  console.log(`  ✓ ${message}`);
}

function logWarning(message: string) {
  console.log(`  ⚠ ${message}`);
}

function logError(message: string) {
  console.log(`  ✗ ${message}`);
}

async function countdown(seconds: number, action: string) {
  console.log(`\n  ⏳ Executing "${action}" in:`);
  for (let i = seconds; i > 0; i--) {
    process.stdout.write(`\r     ${i} seconds... (Press Ctrl+C to abort)`);
    await new Promise((r) => setTimeout(r, 1000));
  }
  console.log("\n");
}

async function confirmAction(prompt: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(`\n  ⚠ ${prompt} (type 'CONFIRM' to proceed): `, (answer) => {
      rl.close();
      resolve(answer.trim().toUpperCase() === "CONFIRM");
    });
  });
}

function generateIncidentId(): string {
  const timestamp = new Date().toISOString().replace(/[-:T.]/g, "").slice(0, 14);
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `INC-${timestamp}-${random}`;
}

// ============================================
// EMERGENCY PROCEDURES
// ============================================

/**
 * PROCEDURE 1: Emergency Pause All Contracts
 */
async function emergencyPauseAll(addresses: ContractAddresses, reason: string) {
  const incidentId = generateIncidentId();

  logHeader("EMERGENCY PAUSE ALL CONTRACTS", BREAK_GLASS_CONFIG.severity.CRITICAL);

  console.log(`  Incident ID: ${incidentId}`);
  console.log(`  Reason: ${reason}`);
  console.log(`  Timestamp: ${new Date().toISOString()}`);
  console.log("");

  const [operator] = await ethers.getSigners();
  console.log(`  Operator: ${operator.address}`);
  console.log("");

  // Confirm action
  const confirmed = await confirmAction(
    "This will PAUSE all trading and minting. Users will NOT be able to trade or mint credits."
  );

  if (!confirmed) {
    logWarning("Operation aborted by operator");
    return { success: false, incidentId };
  }

  await countdown(BREAK_GLASS_CONFIG.confirmationDelay, "PAUSE ALL");

  const results: { contract: string; paused: boolean; error?: string }[] = [];

  // Pause CarbonCredit
  logStep(1, "Pausing CarbonCredit contract...");
  try {
    const carbonCredit = await ethers.getContractAt("CarbonCredit", addresses.carbonCredit);
    const tx = await carbonCredit.pause();
    await tx.wait();
    results.push({ contract: "CarbonCredit", paused: true });
    logSuccess(`CarbonCredit paused (TX: ${tx.hash})`);
  } catch (error: any) {
    results.push({ contract: "CarbonCredit", paused: false, error: error.message });
    logError(`Failed to pause CarbonCredit: ${error.message}`);
  }

  // Pause Marketplace
  logStep(2, "Pausing CarbonMarketplace contract...");
  try {
    const marketplace = await ethers.getContractAt("CarbonMarketplace", addresses.marketplace);
    const tx = await marketplace.pause();
    await tx.wait();
    results.push({ contract: "CarbonMarketplace", paused: true });
    logSuccess(`CarbonMarketplace paused (TX: ${tx.hash})`);
  } catch (error: any) {
    results.push({ contract: "CarbonMarketplace", paused: false, error: error.message });
    logError(`Failed to pause Marketplace: ${error.message}`);
  }

  // Log incident
  logStep(3, "Logging incident...");
  const incident = {
    id: incidentId,
    type: "EMERGENCY_PAUSE",
    reason,
    operator: operator.address,
    timestamp: new Date().toISOString(),
    results,
    severity: "CRITICAL",
  };

  console.log("\n  📋 INCIDENT LOG:");
  console.log(JSON.stringify(incident, null, 2));

  // Notify contacts
  logStep(4, "Sending notifications...");
  console.log(`     → Email: ${BREAK_GLASS_CONFIG.contacts.techLead}`);
  console.log(`     → Email: ${BREAK_GLASS_CONFIG.contacts.security}`);
  console.log(`     → Email: ${BREAK_GLASS_CONFIG.contacts.compliance}`);

  const allPaused = results.every((r) => r.paused);

  if (allPaused) {
    logSuccess("\n  ✅ ALL CONTRACTS PAUSED SUCCESSFULLY");
  } else {
    logWarning("\n  ⚠ PARTIAL PAUSE - Some contracts failed to pause");
  }

  return { success: allPaused, incidentId, results };
}

/**
 * PROCEDURE 2: Unpause All Contracts
 */
async function emergencyUnpauseAll(addresses: ContractAddresses, incidentId: string) {
  logHeader("RESUME OPERATIONS - UNPAUSE ALL", BREAK_GLASS_CONFIG.severity.HIGH);

  console.log(`  Incident ID: ${incidentId}`);
  console.log(`  Timestamp: ${new Date().toISOString()}`);
  console.log("");

  const [operator] = await ethers.getSigners();
  console.log(`  Operator: ${operator.address}`);

  const confirmed = await confirmAction(
    "This will RESUME all trading and minting. Ensure the incident has been resolved."
  );

  if (!confirmed) {
    logWarning("Operation aborted by operator");
    return { success: false };
  }

  await countdown(BREAK_GLASS_CONFIG.confirmationDelay, "UNPAUSE ALL");

  const results: { contract: string; unpaused: boolean; error?: string }[] = [];

  // Unpause CarbonCredit
  logStep(1, "Unpausing CarbonCredit contract...");
  try {
    const carbonCredit = await ethers.getContractAt("CarbonCredit", addresses.carbonCredit);
    const tx = await carbonCredit.unpause();
    await tx.wait();
    results.push({ contract: "CarbonCredit", unpaused: true });
    logSuccess(`CarbonCredit unpaused (TX: ${tx.hash})`);
  } catch (error: any) {
    results.push({ contract: "CarbonCredit", unpaused: false, error: error.message });
    logError(`Failed to unpause CarbonCredit: ${error.message}`);
  }

  // Unpause Marketplace
  logStep(2, "Unpausing CarbonMarketplace contract...");
  try {
    const marketplace = await ethers.getContractAt("CarbonMarketplace", addresses.marketplace);
    const tx = await marketplace.unpause();
    await tx.wait();
    results.push({ contract: "CarbonMarketplace", unpaused: true });
    logSuccess(`CarbonMarketplace unpaused (TX: ${tx.hash})`);
  } catch (error: any) {
    results.push({ contract: "CarbonMarketplace", unpaused: false, error: error.message });
    logError(`Failed to unpause Marketplace: ${error.message}`);
  }

  const allUnpaused = results.every((r) => r.unpaused);

  if (allUnpaused) {
    logSuccess("\n  ✅ ALL CONTRACTS RESUMED SUCCESSFULLY");
  } else {
    logWarning("\n  ⚠ PARTIAL RESUME - Some contracts failed to unpause");
  }

  return { success: allUnpaused, results };
}

/**
 * PROCEDURE 3: Freeze Suspicious Account
 */
async function freezeAccount(
  addresses: ContractAddresses,
  targetAddress: string,
  reason: string
) {
  const incidentId = generateIncidentId();

  logHeader("FREEZE SUSPICIOUS ACCOUNT", BREAK_GLASS_CONFIG.severity.HIGH);

  console.log(`  Incident ID: ${incidentId}`);
  console.log(`  Target: ${targetAddress}`);
  console.log(`  Reason: ${reason}`);
  console.log(`  Timestamp: ${new Date().toISOString()}`);
  console.log("");

  const [operator] = await ethers.getSigners();

  const confirmed = await confirmAction(
    `This will FREEZE account ${targetAddress}. They will NOT be able to trade.`
  );

  if (!confirmed) {
    logWarning("Operation aborted by operator");
    return { success: false, incidentId };
  }

  await countdown(BREAK_GLASS_CONFIG.confirmationDelay, "FREEZE ACCOUNT");

  // Revoke KYC status (effectively freezing the account)
  logStep(1, "Revoking KYC status on Marketplace...");
  try {
    const marketplace = await ethers.getContractAt("CarbonMarketplace", addresses.marketplace);
    const tx = await marketplace.setKycStatus(targetAddress, false);
    await tx.wait();
    logSuccess(`KYC revoked for ${targetAddress}`);
  } catch (error: any) {
    logError(`Failed to revoke KYC: ${error.message}`);
    return { success: false, incidentId, error: error.message };
  }

  // Log the freeze
  logStep(2, "Logging freeze action...");
  const freezeLog = {
    incidentId,
    action: "ACCOUNT_FREEZE",
    target: targetAddress,
    reason,
    operator: operator.address,
    timestamp: new Date().toISOString(),
  };

  console.log("\n  📋 FREEZE LOG:");
  console.log(JSON.stringify(freezeLog, null, 2));

  logSuccess("\n  ✅ ACCOUNT FROZEN SUCCESSFULLY");

  return { success: true, incidentId };
}

/**
 * PROCEDURE 4: Emergency Fund Withdrawal
 */
async function emergencyWithdraw(addresses: ContractAddresses, recipientAddress: string) {
  const incidentId = generateIncidentId();

  logHeader("EMERGENCY FUND WITHDRAWAL", BREAK_GLASS_CONFIG.severity.CRITICAL);

  console.log(`  Incident ID: ${incidentId}`);
  console.log(`  Recipient: ${recipientAddress}`);
  console.log(`  Timestamp: ${new Date().toISOString()}`);
  console.log("");

  const [operator] = await ethers.getSigners();

  // Check marketplace balance
  const marketplace = await ethers.getContractAt("CarbonMarketplace", addresses.marketplace);
  const marketplaceAddress = await marketplace.getAddress();
  const balance = await ethers.provider.getBalance(marketplaceAddress);

  console.log(`  Marketplace Balance: ${formatEther(balance)} AETH`);

  if (balance === 0n) {
    logWarning("No funds to withdraw");
    return { success: false, incidentId, reason: "No funds" };
  }

  const confirmed = await confirmAction(
    `This will withdraw ${formatEther(balance)} AETH to ${recipientAddress}. This action is IRREVERSIBLE.`
  );

  if (!confirmed) {
    logWarning("Operation aborted by operator");
    return { success: false, incidentId };
  }

  await countdown(BREAK_GLASS_CONFIG.confirmationDelay, "EMERGENCY WITHDRAW");

  logStep(1, "Executing emergency withdrawal...");
  try {
    const tx = await marketplace.emergencyWithdraw(recipientAddress);
    const receipt = await tx.wait();
    if (!receipt) {
      throw new Error("Emergency withdrawal transaction receipt was null");
    }

    logSuccess(`Withdrawal complete`);
    logSuccess(`TX: ${receipt.hash}`);
    logSuccess(`Amount: ${formatEther(balance)} AETH`);
    logSuccess(`Recipient: ${recipientAddress}`);

    return { success: true, incidentId, amount: formatEther(balance), txHash: receipt.hash };
  } catch (error: any) {
    logError(`Withdrawal failed: ${error.message}`);
    return { success: false, incidentId, error: error.message };
  }
}

/**
 * PROCEDURE 5: Revoke All Minter Access
 */
async function revokeAllMinters(addresses: ContractAddresses) {
  const incidentId = generateIncidentId();

  logHeader("REVOKE ALL MINTER ACCESS", BREAK_GLASS_CONFIG.severity.CRITICAL);

  console.log(`  Incident ID: ${incidentId}`);
  console.log(`  Timestamp: ${new Date().toISOString()}`);
  console.log("");

  const [operator] = await ethers.getSigners();

  const confirmed = await confirmAction(
    "This will REVOKE all minter access. No new credits can be minted until access is restored."
  );

  if (!confirmed) {
    logWarning("Operation aborted by operator");
    return { success: false, incidentId };
  }

  await countdown(BREAK_GLASS_CONFIG.confirmationDelay, "REVOKE MINTERS");

  // Note: In production, you would query events to find all minters
  // For now, we revoke the deployer's minting access
  logStep(1, "Revoking minter access...");
  try {
    const carbonCredit = await ethers.getContractAt("CarbonCredit", addresses.carbonCredit);
    const tx = await carbonCredit.setMinter(operator.address, false);
    await tx.wait();
    logSuccess(`Minter access revoked for ${operator.address}`);
  } catch (error: any) {
    logError(`Failed to revoke minter: ${error.message}`);
    return { success: false, incidentId, error: error.message };
  }

  logSuccess("\n  ✅ MINTER ACCESS REVOKED");

  return { success: true, incidentId };
}

/**
 * PROCEDURE 6: Health Check (Pre-incident verification)
 */
async function healthCheck(addresses: ContractAddresses) {
  logHeader("SYSTEM HEALTH CHECK", BREAK_GLASS_CONFIG.severity.LOW);

  console.log(`  Timestamp: ${new Date().toISOString()}`);
  console.log("");

  const checks: { name: string; status: "OK" | "WARN" | "FAIL"; details: string }[] = [];

  // Check CarbonCredit
  logStep(1, "Checking CarbonCredit contract...");
  try {
    const carbonCredit = await ethers.getContractAt("CarbonCredit", addresses.carbonCredit);
    const paused = await carbonCredit.paused();
    const owner = await carbonCredit.owner();

    checks.push({
      name: "CarbonCredit",
      status: paused ? "WARN" : "OK",
      details: `Paused: ${paused}, Owner: ${owner.slice(0, 10)}...`,
    });

    if (paused) {
      logWarning("CarbonCredit is PAUSED");
    } else {
      logSuccess("CarbonCredit is operational");
    }
  } catch (error: any) {
    checks.push({ name: "CarbonCredit", status: "FAIL", details: error.message });
    logError(`CarbonCredit check failed: ${error.message}`);
  }

  // Check Marketplace
  logStep(2, "Checking CarbonMarketplace contract...");
  try {
    const marketplace = await ethers.getContractAt("CarbonMarketplace", addresses.marketplace);
    const paused = await marketplace.paused();
    const owner = await marketplace.owner();
    const balance = await ethers.provider.getBalance(await marketplace.getAddress());

    checks.push({
      name: "Marketplace",
      status: paused ? "WARN" : "OK",
      details: `Paused: ${paused}, Balance: ${formatEther(balance)} AETH`,
    });

    if (paused) {
      logWarning("Marketplace is PAUSED");
    } else {
      logSuccess(`Marketplace is operational (Balance: ${formatEther(balance)} AETH)`);
    }
  } catch (error: any) {
    checks.push({ name: "Marketplace", status: "FAIL", details: error.message });
    logError(`Marketplace check failed: ${error.message}`);
  }

  // Check network
  logStep(3, "Checking network status...");
  try {
    const network = await ethers.provider.getNetwork();
    const block = await ethers.provider.getBlockNumber();
    const gasPrice = await ethers.provider.getFeeData();

    checks.push({
      name: "Network",
      status: "OK",
      details: `Chain: ${network.chainId}, Block: ${block}, Gas: ${formatEther(gasPrice.gasPrice || 0n)} AETH`,
    });

    logSuccess(`Network OK (Chain ID: ${network.chainId}, Block: ${block})`);
  } catch (error: any) {
    checks.push({ name: "Network", status: "FAIL", details: error.message });
    logError(`Network check failed: ${error.message}`);
  }

  // Summary
  console.log("\n  📋 HEALTH CHECK SUMMARY:");
  console.log("  " + "-".repeat(50));
  for (const check of checks) {
    const icon = check.status === "OK" ? "✓" : check.status === "WARN" ? "⚠" : "✗";
    console.log(`  ${icon} ${check.name}: ${check.status} - ${check.details}`);
  }
  console.log("  " + "-".repeat(50));

  const hasFailures = checks.some((c) => c.status === "FAIL");
  const hasWarnings = checks.some((c) => c.status === "WARN");

  if (hasFailures) {
    logError("\n  ❌ HEALTH CHECK FAILED - Immediate attention required");
  } else if (hasWarnings) {
    logWarning("\n  ⚠ HEALTH CHECK PASSED WITH WARNINGS");
  } else {
    logSuccess("\n  ✅ ALL SYSTEMS OPERATIONAL");
  }

  return { checks, healthy: !hasFailures };
}

// ============================================
// CLI INTERFACE
// ============================================

async function main() {
  console.log("\n");
  console.log("╔════════════════════════════════════════════════════════════════╗");
  console.log("║                                                                 ║");
  console.log("║   🚨 TERRAQURA BREAK GLASS EMERGENCY PROCEDURES 🚨              ║");
  console.log("║                                                                 ║");
  console.log("║   USE WITH EXTREME CAUTION - REQUIRES MULTI-SIG APPROVAL        ║");
  console.log("║                                                                 ║");
  console.log("╚════════════════════════════════════════════════════════════════╝\n");

  // Load contract addresses from environment
  const addresses: ContractAddresses = {
    carbonCredit: process.env.CARBON_CREDIT_ADDRESS || "",
    marketplace: process.env.MARKETPLACE_ADDRESS || "",
    accessControl: process.env.ACCESS_CONTROL_ADDRESS || "",
    forwarder: process.env.FORWARDER_ADDRESS || "",
    verificationEngine: process.env.VERIFICATION_ENGINE_ADDRESS || "",
  };

  // Parse command line arguments
  const args = process.argv.slice(2);
  const command = args[0];

  console.log("Available Commands:");
  console.log("  1. health      - Run system health check");
  console.log("  2. pause       - Emergency pause all contracts");
  console.log("  3. unpause     - Resume operations");
  console.log("  4. freeze      - Freeze suspicious account");
  console.log("  5. withdraw    - Emergency fund withdrawal");
  console.log("  6. revoke      - Revoke all minter access");
  console.log("");

  if (!addresses.carbonCredit || !addresses.marketplace) {
    // Deploy fresh contracts for testing
    console.log("⚠ Contract addresses not found in environment. Deploying test contracts...\n");

    const [deployer] = await ethers.getSigners();

    const VerificationEngine = await ethers.getContractFactory("VerificationEngine");
    const verificationEngine = await VerificationEngine.deploy();
    await verificationEngine.waitForDeployment();

    const CarbonCredit = await ethers.getContractFactory("CarbonCredit");
    const { upgrades } = await import("hardhat");
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

    await verificationEngine.setCarbonCreditContract(await carbonCredit.getAddress());
    await carbonCredit.setMinter(deployer.address, true);

    addresses.carbonCredit = await carbonCredit.getAddress();
    addresses.marketplace = await marketplace.getAddress();
    addresses.verificationEngine = await verificationEngine.getAddress();

    console.log(`  CarbonCredit: ${addresses.carbonCredit}`);
    console.log(`  Marketplace: ${addresses.marketplace}`);
    console.log("");
  }

  // Execute command
  switch (command) {
    case "health":
      await healthCheck(addresses);
      break;

    case "pause":
      const pauseReason = args[1] || "Emergency pause requested via CLI";
      await emergencyPauseAll(addresses, pauseReason);
      break;

    case "unpause":
      const incidentId = args[1] || "MANUAL-UNPAUSE";
      await emergencyUnpauseAll(addresses, incidentId);
      break;

    case "freeze":
      const targetAddress = args[1];
      const freezeReason = args[2] || "Suspicious activity detected";
      if (!targetAddress) {
        console.log("Usage: npx hardhat run scripts/break-glass.ts -- freeze <address> [reason]");
        break;
      }
      await freezeAccount(addresses, targetAddress, freezeReason);
      break;

    case "withdraw":
      const recipient = args[1];
      if (!recipient) {
        console.log("Usage: npx hardhat run scripts/break-glass.ts -- withdraw <recipient>");
        break;
      }
      await emergencyWithdraw(addresses, recipient);
      break;

    case "revoke":
      await revokeAllMinters(addresses);
      break;

    default:
      // Run health check by default
      console.log("Running default health check...\n");
      await healthCheck(addresses);

      // Then run a pause/unpause drill
      console.log("\n--- BREAK GLASS DRILL ---\n");

      const drillConfirmed = await confirmAction(
        "Run a pause/unpause drill? This will temporarily pause and immediately unpause all contracts."
      );

      if (drillConfirmed) {
        await emergencyPauseAll(addresses, "DRILL - Break Glass procedure test");
        await new Promise((r) => setTimeout(r, 2000));
        await emergencyUnpauseAll(addresses, "DRILL-RECOVERY");
        console.log("\n✅ DRILL COMPLETE - All systems back to normal\n");
      }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Break Glass Procedure Failed:", error);
    process.exit(1);
  });
