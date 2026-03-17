import { run } from "hardhat";

/**
 * Verify All TerraQura Contracts on Aethelred Explorer
 *
 * Prerequisites:
 * 1. Get API key from https://explorer-testnet.aethelred.network/myapikey
 * 2. Add to .env.local: AETHELRED_API_KEY=your_key_here
 *
 * Run: npx hardhat run scripts/verify-all-contracts.ts --network aethelredTestnet
 */

// Implementation addresses (the actual contract code to verify) - Solidity 0.8.28 - ALL BUG-FREE
const IMPLEMENTATIONS = {
  // Core (UUPS - verify implementations)
  accessControl: "0x7e3bf0EBAF28bcC9A7d96a54Ad6FFEfA0b4Ebc17",
  verificationEngine: "0x2b7881C372f2244020c91c2d8c2421513Cf769c0",
  carbonCredit: "0xBF82A70152CAA15cdD8f451128ccF5a7A7b8155c",
  carbonMarketplace: "0x85b13A91e1DE82a6eE628dc17865bfAED01a49de",

  // Security (UUPS - verify implementations)
  circuitBreaker: "0x324a72C8A99D27C2d285Feb837Ee4243Fb6ee938",

  // Gasless (UUPS - verify implementation)
  gaslessMarketplace: "0x6Fbfe3A06a82d3357D21B16bAad92dc14103c45B",
};

// Standard contracts (non-proxy, verify directly)
const STANDARD_CONTRACTS = {
  multisig: {
    address: "0x0805E6ffDE71fd798F3Fe787D1dC907aABA65bAD",
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
    address: "0xb8b01581d61Bf2D58B8B8626Ebb7Ab959ccF6354",
    constructorArgs: [
      3600, // minDelay (1 hour)
      ["0x0805E6ffDE71fd798F3Fe787D1dC907aABA65bAD"], // proposers (multisig)
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
  console.log("║   TerraQura Contract Verification on Aethelred Explorer  ║");
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
