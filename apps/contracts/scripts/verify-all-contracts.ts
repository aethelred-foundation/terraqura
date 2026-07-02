import { run } from "hardhat";
import { DEPLOYMENTS } from "@terraqura/network-manifest";

/**
 * Verify legacy TerraQura validation contracts on the configured explorer.
 *
 * Prerequisites:
 * 1. Confirm the selected Hardhat network matches the deployment manifest.
 * 2. Add the matching explorer API key to .env.local.
 *
 * Run: npx hardhat run scripts/verify-all-contracts.ts --network <validation-network>
 */

const VALIDATION_DEPLOYMENT = DEPLOYMENTS.polygonAmoyV3Final;

// Implementation addresses (the actual contract code to verify).
const IMPLEMENTATIONS = {
  // Core (UUPS - verify implementations)
  accessControl: VALIDATION_DEPLOYMENT.implementations.accessControl!,
  verificationEngine: VALIDATION_DEPLOYMENT.implementations.verificationEngine!,
  carbonCredit: VALIDATION_DEPLOYMENT.implementations.carbonCredit!,
  carbonMarketplace: VALIDATION_DEPLOYMENT.implementations.carbonMarketplace!,

  // Security (UUPS - verify implementations)
  circuitBreaker: VALIDATION_DEPLOYMENT.implementations.circuitBreaker!,

  // Gasless (UUPS - verify implementation)
  gaslessMarketplace: VALIDATION_DEPLOYMENT.implementations.gaslessMarketplace!,
};

// Standard contracts (non-proxy, verify directly)
const STANDARD_CONTRACTS = {
  multisig: {
    address: VALIDATION_DEPLOYMENT.contracts.multisig,
    constructorArgs: [
      [
        "0x7F6A87fE3191FFBFa06D37939F3a3a4341159ABc",
        "0x1111111111111111111111111111111111111111",
        "0x2222222222222222222222222222222222222222",
      ],
      2, // threshold
    ],
  },
  timelock: {
    address: VALIDATION_DEPLOYMENT.contracts.timelock,
    constructorArgs: [
      3600, // minDelay (1 hour)
      [VALIDATION_DEPLOYMENT.contracts.multisig], // proposers (multisig)
      ["0x0000000000000000000000000000000000000000"], // executors (anyone)
      "0x7F6A87fE3191FFBFa06D37939F3a3a4341159ABc", // admin
      false, // isProduction
    ],
  },
};

async function verifyContract(
  name: string,
  address: string,
  constructorArgs: any[] = []
) {
  console.log(`\nVerifying ${name} at ${address}...`);

  try {
    await run("verify:verify", {
      address: address,
      constructorArguments: constructorArgs,
    });
    console.log(`✅ ${name} verified successfully!`);
    return true;
  } catch (error: any) {
    if (error.message.includes("Already Verified")) {
      console.log(`ℹ️  ${name} is already verified`);
      return true;
    }
    console.error(`❌ ${name} verification failed:`, error.message);
    return false;
  }
}

async function main() {
  console.log("╔════════════════════════════════════════════════════════╗");
  console.log("║   TerraQura Legacy Validation Contract Verification    ║");
  console.log("╚════════════════════════════════════════════════════════╝");

  let verified = 0;
  let failed = 0;

  // Verify UUPS implementations (no constructor args)
  console.log("\n📋 Verifying UUPS Implementation Contracts...");
  console.log("   (These are the actual contract code behind proxies)\n");

  for (const [name, address] of Object.entries(IMPLEMENTATIONS)) {
    const success = await verifyContract(name, address);
    if (success) verified++;
    else failed++;
  }

  // Verify standard contracts (with constructor args)
  console.log("\n📋 Verifying Standard Contracts...");
  console.log("   (These have constructor arguments)\n");

  for (const [name, config] of Object.entries(STANDARD_CONTRACTS)) {
    const success = await verifyContract(
      name,
      config.address,
      config.constructorArgs
    );
    if (success) verified++;
    else failed++;
  }

  // Summary
  console.log("\n════════════════════════════════════════════════════════");
  console.log("                    VERIFICATION SUMMARY                  ");
  console.log("════════════════════════════════════════════════════════");
  console.log(`  ✅ Verified: ${verified}`);
  console.log(`  ❌ Failed:   ${failed}`);
  console.log("════════════════════════════════════════════════════════");

  if (failed === 0) {
    console.log("\n🎉 All contracts verified! View on Aethelred Explorer:");
    console.log("   https://explorer-testnet.aethelred.network/address/0xfc0CaCA6C6abc035562F4a47e12a0d8f7Cd51036#code");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
