import { ethers } from "hardhat";

// Deployed contract addresses on Aethelred Testnet
const ADDRESSES = {
  accessControl: "0x6098a0cF16D90817f4C8d730DeA998453F2DE904",
  verificationEngine: "0xcB746aB50254A735566676979e69aD6F5842080d",
  carbonCredit: "0xfc0CaCA6C6abc035562F4a47e12a0d8f7Cd51036",
  carbonMarketplace: "0xABc0Fa37a6B78DA9514ee36974DAf16ABafFd682",
  testDacId: "0x45ccede947d5f744703ab7f5ba091940677382ac34daf7f8de21769129b88c55",
};

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Testing with account:", deployer.address);
  console.log("========================================\n");

  // Get contract instances
  const accessControl = await ethers.getContractAt("TerraQuraAccessControl", ADDRESSES.accessControl);
  const verificationEngine = await ethers.getContractAt("VerificationEngine", ADDRESSES.verificationEngine);
  const carbonCredit = await ethers.getContractAt("CarbonCredit", ADDRESSES.carbonCredit);
  const carbonMarketplace = await ethers.getContractAt("CarbonMarketplace", ADDRESSES.carbonMarketplace);

  // Test 1: Verify AccessControl roles
  console.log("1. Testing TerraQuraAccessControl...");
  const ADMIN_ROLE = await accessControl.DEFAULT_ADMIN_ROLE();
  const MINTER_ROLE = await accessControl.MINTER_ROLE();
  const OPERATOR_ROLE = await accessControl.OPERATOR_ROLE();

  const hasAdmin = await accessControl.hasRole(ADMIN_ROLE, deployer.address);
  const hasMinter = await accessControl.hasRole(MINTER_ROLE, deployer.address);
  const hasOperator = await accessControl.hasRole(OPERATOR_ROLE, deployer.address);

  console.log("   Admin role:", hasAdmin ? "✅" : "❌");
  console.log("   Minter role:", hasMinter ? "✅" : "❌");
  console.log("   Operator role:", hasOperator ? "✅" : "❌");

  // Test 2: Verify VerificationEngine configuration
  console.log("\n2. Testing VerificationEngine...");
  const carbonCreditAddr = await verificationEngine.carbonCreditContract();

  console.log("   CarbonCredit address:", carbonCreditAddr === ADDRESSES.carbonCredit ? "✅" : "❌");

  // Test 3: Verify DAC unit is whitelisted
  const isWhitelisted = await verificationEngine.isWhitelisted(ADDRESSES.testDacId);
  console.log("   Test DAC whitelisted:", isWhitelisted ? "✅" : "❌");

  // Test 4: Verify CarbonCredit configuration
  console.log("\n3. Testing CarbonCredit...");
  const veAddress = await carbonCredit.verificationEngine();
  console.log("   VerificationEngine address:", veAddress === ADDRESSES.verificationEngine ? "✅" : "❌");

  // Test 5: Verify CarbonMarketplace configuration
  console.log("\n4. Testing CarbonMarketplace...");
  const ccAddress = await carbonMarketplace.carbonCredit();
  const platformFee = await carbonMarketplace.platformFeeBps();
  const feeRecipient = await carbonMarketplace.feeRecipient();

  console.log("   CarbonCredit address:", ccAddress === ADDRESSES.carbonCredit ? "✅" : "❌");
  console.log("   Platform fee (2.5%):", platformFee === 250n ? "✅" : "❌");
  console.log("   Fee recipient:", feeRecipient === deployer.address ? "✅" : "❌");

  // Test 6: Mint a test carbon credit
  console.log("\n5. Minting test carbon credit...");
  const dataHash = ethers.keccak256(ethers.toUtf8Bytes(`test-mint-${Date.now()}`));
  const captureTimestamp = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago

  try {
    const mintTx = await carbonCredit.mintVerifiedCredits(
      deployer.address,          // recipient
      ADDRESSES.testDacId,       // dacId
      dataHash,                   // dataHash
      captureTimestamp,           // captureTimestamp
      1000,                       // co2AmountKg (1 tonne)
      350,                        // energyConsumedKwh (optimal efficiency)
      0,                          // latitude
      0,                          // longitude
      95,                         // purityPercentage
      50,                         // gridIntensity (gCO2/kWh) — solar-powered facility
      "ipfs://QmTest123",         // metadataUri
      ""                          // arweaveBackup
    );

    console.log("   Mint transaction submitted:", mintTx.hash);
    const receipt = await mintTx.wait();
    console.log("   Mint confirmed in block:", receipt?.blockNumber);
    console.log("   Gas used:", receipt?.gasUsed.toString());

    // Get the token ID from events
    const mintEvent = receipt?.logs.find((log: any) => {
      try {
        const parsed = carbonCredit.interface.parseLog(log);
        return parsed?.name === "CreditMinted";
      } catch {
        return false;
      }
    });

    if (mintEvent) {
      const parsed = carbonCredit.interface.parseLog(mintEvent);
      const tokenId = parsed?.args?.tokenId;
      console.log("   Token ID minted:", tokenId?.toString());

      // Verify balance
      const balance = await carbonCredit.balanceOf(deployer.address, tokenId);
      console.log("   Token balance:", balance.toString(), "✅");

      // Get credit provenance
      const provenance = await carbonCredit.getCreditProvenance(tokenId);
      console.log("   Credit info:");
      console.log("     - CO2 Amount:", provenance.metadata.co2AmountKg.toString(), "kg");
      console.log("     - Efficiency Score:", provenance.verification.efficiencyFactor.toString());
      console.log(
        "     - Verified:",
        provenance.verification.sourceVerified &&
          provenance.verification.logicVerified &&
          provenance.verification.mintVerified
          ? "YES"
          : "NO"
      );
    }
  } catch (error: any) {
    console.log("   Mint failed:", error.message);
  }

  console.log("\n========================================");
  console.log("DEPLOYMENT VERIFICATION COMPLETE");
  console.log("========================================");

  // Print contract links
  console.log("\nView contracts on Aethelred Explorer:");
  console.log(`AccessControl: https://explorer-testnet.aethelred.network/address/${ADDRESSES.accessControl}`);
  console.log(`VerificationEngine: https://explorer-testnet.aethelred.network/address/${ADDRESSES.verificationEngine}`);
  console.log(`CarbonCredit: https://explorer-testnet.aethelred.network/address/${ADDRESSES.carbonCredit}`);
  console.log(`CarbonMarketplace: https://explorer-testnet.aethelred.network/address/${ADDRESSES.carbonMarketplace}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
