// TerraQura Contract Verification Script
// Verifies all contracts on Aethelred Explorer for transparency

import { run } from "hardhat";
import * as fs from "fs";
import * as path from "path";

interface DeploymentInfo {
  network: string;
  contracts: {
    name: string;
    address: string;
    implementation?: string;
    constructorArgs?: any[];
    proxy?: boolean;
  }[];
  timestamp: string;
}

async function main() {
  console.log("╔════════════════════════════════════════════════════════╗");
  console.log("║   TerraQura Contract Verification                      ║");
  console.log("║   Uploading source code to Aethelred Explorer            ║");
  console.log("╚════════════════════════════════════════════════════════╝\n");

  // Load deployment info
  const deploymentsPath = path.join(__dirname, "../deployments");
  const network = process.env.HARDHAT_NETWORK || "aethelred";
  const deploymentFile = path.join(deploymentsPath, `${network}.json`);

  if (!fs.existsSync(deploymentFile)) {
    console.error(`No deployment found for network: ${network}`);
    console.log("Please run the deploy script first.");
    process.exit(1);
  }

  const deployment: DeploymentInfo = JSON.parse(
    fs.readFileSync(deploymentFile, "utf8")
  );

  console.log(`Network: ${deployment.network}`);
  console.log(`Deployment timestamp: ${deployment.timestamp}\n`);

  const results: { name: string; status: string; error?: string }[] = [];

  for (const contract of deployment.contracts) {
    console.log(`\nVerifying: ${contract.name}`);
    console.log(`  Address: ${contract.address}`);

    if (contract.implementation) {
      console.log(`  Implementation: ${contract.implementation}`);
    }

    try {
      if (contract.proxy) {
        // Verify proxy first
        console.log("  Verifying proxy...");
        await run("verify:verify", {
          address: contract.address,
          constructorArguments: [],
        });

        // Then verify implementation
        if (contract.implementation) {
          console.log("  Verifying implementation...");
          await run("verify:verify", {
            address: contract.implementation,
            constructorArguments: contract.constructorArgs || [],
          });
        }
      } else {
        // Standard contract verification
        await run("verify:verify", {
          address: contract.address,
          constructorArguments: contract.constructorArgs || [],
        });
      }

      console.log(`  ✓ Verified successfully`);
      results.push({ name: contract.name, status: "verified" });
    } catch (error: any) {
      if (error.message.includes("Already Verified")) {
        console.log(`  ✓ Already verified`);
        results.push({ name: contract.name, status: "already verified" });
      } else {
        console.error(`  ✗ Verification failed: ${error.message}`);
        results.push({
          name: contract.name,
          status: "failed",
          error: error.message,
        });
      }
    }
  }

  // Summary
  console.log("\n╔════════════════════════════════════════════════════════╗");
  console.log("║   VERIFICATION SUMMARY                                 ║");
  console.log("╠════════════════════════════════════════════════════════╣");

  for (const result of results) {
    const status =
      result.status === "verified" || result.status === "already verified"
        ? "✓"
        : "✗";
    console.log(`║   ${status} ${result.name.padEnd(30)} ${result.status.padEnd(20)}║`);
  }

  console.log("╚════════════════════════════════════════════════════════╝");

  // Generate verification report
  const report = {
    network: deployment.network,
    verifiedAt: new Date().toISOString(),
    results,
    explorerUrls: results.map((r) => ({
      name: r.name,
      url: getExplorerUrl(
        network,
        deployment.contracts.find((c) => c.name === r.name)?.address || ""
      ),
    })),
  };

  const reportPath = path.join(deploymentsPath, `${network}-verification.json`);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\nVerification report saved to: ${reportPath}`);

  // Print explorer links
  console.log("\n📋 Contract Explorer Links:");
  for (const { name, url } of report.explorerUrls) {
    console.log(`   ${name}: ${url}`);
  }
}

function getExplorerUrl(network: string, address: string): string {
  const explorers: Record<string, string> = {
    aethelred: "https://explorer.aethelred.network/address/",
    "aethelred-testnet": "https://explorer-testnet.aethelred.network/address/",
    aethelredTestnet: "https://explorer-testnet.aethelred.network/address/",
    localhost: "http://localhost:8545/address/",
  };

  const baseUrl = explorers[network] || explorers.aethelred;
  return `${baseUrl}${address}`;
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
