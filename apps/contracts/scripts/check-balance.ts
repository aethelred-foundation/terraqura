import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  const balance = await ethers.provider.getBalance(deployer.address);
  const network = await ethers.provider.getNetwork();

  console.log("========================================");
  console.log("WALLET STATUS");
  console.log("========================================");
  console.log("Network:", network.name);
  console.log("Chain ID:", network.chainId.toString());
  console.log("Address:", deployer.address);
  console.log("Balance:", ethers.formatEther(balance), "POL");
  console.log("========================================");

  // Estimate deployment costs (rough estimate)
  const estimatedGas = 15_000_000n; // ~15M gas for all contracts
  const gasPrice = (await ethers.provider.getFeeData()).gasPrice || 30_000_000_000n; // 30 gwei fallback
  const estimatedCost = estimatedGas * gasPrice;

  console.log("\nEstimated Deployment Cost:");
  console.log("Gas Price:", ethers.formatUnits(gasPrice, "gwei"), "gwei");
  console.log("Estimated Gas:", estimatedGas.toString());
  console.log("Estimated Cost:", ethers.formatEther(estimatedCost), "POL");

  if (balance < estimatedCost) {
    console.log("\n⚠️  WARNING: Balance may be insufficient for deployment!");
    console.log("   Minimum recommended:", ethers.formatEther(estimatedCost * 2n), "POL");
  } else {
    console.log("\n✅ Balance sufficient for deployment");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
