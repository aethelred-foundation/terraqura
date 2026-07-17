/**
 * Minimal devnet seeder for the TerraQura credit flow.
 *
 * Deploys the verification + credit core (UUPS proxies, properly initialized),
 * whitelists demo DAC units, grants the deployer minter rights, and mints
 * verified credit batches TO THE DEPLOYER so the web app's Credits dashboard
 * has real on-chain holdings to display, retire, and transfer.
 *
 * Unlike seed-genesis.ts (written against an older contract surface), this
 * script targets the current CarbonCredit v3 mint path:
 *   whitelistDacUnit -> setMinter -> mintVerifiedCredits (3-phase verify,
 *   Net-Negative accounting; sealAnchorRequired stays false because no seal
 *   registry is configured on a bare devnet).
 *
 * All writes carry explicit gas limits: the Aethelred devnet's
 * eth_estimateGas under-reports for state-changing calls (GAS-01), so relying
 * on estimates would revert out-of-gas.
 *
 * Usage:
 *   PRIVATE_KEY=0x... AETHELRED_RPC_URL=http://localhost:8545 \
 *   AETHELRED_CHAIN_ID=7332 \
 *   npx hardhat run scripts/seed-devnet.ts --network aethelred
 */

import { ethers, upgrades } from "hardhat";
import * as fs from "fs";
import * as path from "path";

const GAS = { gasLimit: 3_000_000 };

// DAC-technology defaults: 200-600 kWh/tonne window, purity >= 90.
const DEMO_BATCHES = [
  { dac: "DAC-AUH-001", co2Kg: 1000n, energyKwh: 350n, purity: 97, lat: 24_450_000n, lng: 54_650_000n },
  { dac: "DAC-DXB-001", co2Kg: 2000n, energyKwh: 800n, purity: 95, lat: 25_200_000n, lng: 55_270_000n },
  { dac: "DAC-RYD-001", co2Kg: 1500n, energyKwh: 525n, purity: 93, lat: 24_710_000n, lng: 46_670_000n },
];

// Low-carbon grid (e.g. solar-heavy): keeps every batch strongly net-negative.
const GRID_INTENSITY_GCO2_PER_KWH = 50n;

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  console.log(
    "Balance:",
    ethers.formatEther(await ethers.provider.getBalance(deployer.address)),
    "AETHEL\n",
  );

  // 1. VerificationEngine (UUPS). Access-control linkage is reserved in the
  //    current initializer, so zero is valid; the credit contract is wired next.
  const VerificationEngine = await ethers.getContractFactory("VerificationEngine");
  const verificationEngine = await upgrades.deployProxy(
    VerificationEngine,
    [ethers.ZeroAddress, ethers.ZeroAddress],
    { initializer: "initialize", kind: "uups" },
  );
  await verificationEngine.waitForDeployment();
  const verificationEngineAddress = await verificationEngine.getAddress();
  console.log("VerificationEngine:", verificationEngineAddress);

  // 2. CarbonCredit (UUPS), owned by the deployer.
  const CarbonCredit = await ethers.getContractFactory("CarbonCredit");
  const carbonCredit = await upgrades.deployProxy(
    CarbonCredit,
    [verificationEngineAddress, "ipfs://terraqura-devnet/", deployer.address],
    { initializer: "initialize", kind: "uups" },
  );
  await carbonCredit.waitForDeployment();
  const carbonCreditAddress = await carbonCredit.getAddress();
  console.log("CarbonCredit:      ", carbonCreditAddress);

  // 3. Wire + authorize.
  await (await verificationEngine.setCarbonCreditContract(carbonCreditAddress, GAS)).wait();
  await (await carbonCredit.setMinter(deployer.address, true, GAS)).wait();
  console.log("Wired verify<->credit, deployer approved as minter\n");

  // 4. Whitelist DAC units + mint a verified batch from each to the deployer.
  const minted: { tokenId: string; dac: string; balance: string }[] = [];
  for (const [i, batch] of DEMO_BATCHES.entries()) {
    const dacUnitId = ethers.encodeBytes32String(batch.dac);
    await (await verificationEngine.whitelistDacUnit(dacUnitId, deployer.address, GAS)).wait();

    const captureTimestamp = BigInt(Math.floor(Date.now() / 1000) - i * 86_400);
    const sourceDataHash = ethers.keccak256(
      ethers.solidityPacked(["bytes32", "uint256"], [dacUnitId, captureTimestamp]),
    );

    const tx = await carbonCredit.mintVerifiedCredits(
      deployer.address,
      dacUnitId,
      sourceDataHash,
      captureTimestamp,
      batch.co2Kg,
      batch.energyKwh,
      batch.lat,
      batch.lng,
      batch.purity,
      GRID_INTENSITY_GCO2_PER_KWH,
      `ipfs://terraqura-devnet/${batch.dac}.json`,
      "",
      GAS,
    );
    const receipt = await tx.wait();

    const mintTopic = carbonCredit.interface.getEvent("CreditMinted")!.topicHash;
    const mintLog = receipt!.logs.find((l: { topics: readonly string[] }) => l.topics[0] === mintTopic);
    if (!mintLog) throw new Error(`CreditMinted event missing for ${batch.dac}`);
    const tokenId = BigInt(mintLog.topics[1]);
    const balance = await carbonCredit.balanceOf(deployer.address, tokenId);
    minted.push({ tokenId: tokenId.toString(), dac: batch.dac, balance: balance.toString() });
    console.log(`Minted ${batch.dac}: tokenId=${tokenId} balance=${balance}`);
  }

  // 5. Manifest for the web app / provers.
  const network = await ethers.provider.getNetwork();
  const manifest = {
    chainId: Number(network.chainId),
    deployer: deployer.address,
    contracts: {
      verificationEngine: verificationEngineAddress,
      carbonCredit: carbonCreditAddress,
    },
    minted,
    seededAt: new Date().toISOString(),
  };
  const outPath = path.join(__dirname, "..", "deployments", `devnet-${network.chainId}-seed.json`);
  fs.writeFileSync(outPath, JSON.stringify(manifest, null, 2));
  console.log(`\nManifest written: ${outPath}`);
}

main().catch((error) => {
  console.error("Seeding failed:", error);
  process.exitCode = 1;
});
