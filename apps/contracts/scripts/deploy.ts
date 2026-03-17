import { ethers, upgrades } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Deploying TerraQura contracts with account:", deployer.address);
  console.log("Account balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "POL");

  // Get the contract factories
  const TerraQuraAccessControl = await ethers.getContractFactory("TerraQuraAccessControl");
  const VerificationEngine = await ethers.getContractFactory("VerificationEngine");
  const CarbonCredit = await ethers.getContractFactory("CarbonCredit");
  const CarbonMarketplace = await ethers.getContractFactory("CarbonMarketplace");

  // 1. Deploy TerraQuraAccessControl (UUPS upgradeable)
  console.log("\n1. Deploying TerraQuraAccessControl (UUPS Proxy)...");
  const accessControl = await upgrades.deployProxy(
    TerraQuraAccessControl,
    [deployer.address], // admin
    {
      initializer: "initialize",
      kind: "uups",
    }
  );
  await accessControl.waitForDeployment();
  const accessControlAddress = await accessControl.getAddress();
  console.log("   TerraQuraAccessControl Proxy:", accessControlAddress);

  // 2. Deploy VerificationEngine (UUPS upgradeable)
  console.log("\n2. Deploying VerificationEngine (UUPS Proxy)...");
  const verificationEngine = await upgrades.deployProxy(
    VerificationEngine,
    [accessControlAddress, ethers.ZeroAddress], // accessControl, carbonCredit (will be set later)
    {
      initializer: "initialize",
      kind: "uups",
    }
  );
  await verificationEngine.waitForDeployment();
  const verificationEngineAddress = await verificationEngine.getAddress();
  console.log("   VerificationEngine Proxy:", verificationEngineAddress);

  // 3. Deploy CarbonCredit (UUPS upgradeable)
  console.log("\n3. Deploying CarbonCredit (UUPS Proxy)...");
  const carbonCredit = await upgrades.deployProxy(
    CarbonCredit,
    [verificationEngineAddress, "https://api.terraqura.aethelred.network/metadata/", deployer.address],
    {
      initializer: "initialize",
      kind: "uups",
    }
  );
  await carbonCredit.waitForDeployment();
  const carbonCreditAddress = await carbonCredit.getAddress();
  console.log("   CarbonCredit Proxy:", carbonCreditAddress);

  // 4. Deploy CarbonMarketplace (UUPS upgradeable)
  console.log("\n4. Deploying CarbonMarketplace (UUPS Proxy)...");
  const platformFeeBps = 250; // 2.5% platform fee
  const carbonMarketplace = await upgrades.deployProxy(
    CarbonMarketplace,
    [carbonCreditAddress, deployer.address, platformFeeBps, deployer.address],
    {
      initializer: "initialize",
      kind: "uups",
    }
  );
  await carbonMarketplace.waitForDeployment();
  const carbonMarketplaceAddress = await carbonMarketplace.getAddress();
  console.log("   CarbonMarketplace Proxy:", carbonMarketplaceAddress);

  // 5. Configure VerificationEngine with CarbonCredit address
  console.log("\n5. Configuring VerificationEngine...");
  const setTx = await verificationEngine.setCarbonCreditContract(carbonCreditAddress);
  await setTx.wait();
  console.log("   CarbonCredit contract set in VerificationEngine");

  // 6. Grant roles via AccessControl
  console.log("\n6. Setting up roles...");
  const MINTER_ROLE = await accessControl.MINTER_ROLE();
  const OPERATOR_ROLE = await accessControl.OPERATOR_ROLE();

  // Grant MINTER_ROLE to deployer for testing
  await (await accessControl.grantRole(MINTER_ROLE, deployer.address)).wait();
  console.log("   Deployer granted MINTER_ROLE");

  // Grant OPERATOR_ROLE to deployer for testing
  await (await accessControl.grantRole(OPERATOR_ROLE, deployer.address)).wait();
  console.log("   Deployer granted OPERATOR_ROLE");

  // 7. Whitelist a test DAC unit
  console.log("\n7. Whitelisting test DAC unit...");
  const testDacId = ethers.keccak256(ethers.toUtf8Bytes("test-dac-unit-001"));
  await (await verificationEngine.whitelistDacUnit(testDacId, deployer.address)).wait();
  console.log("   Test DAC unit whitelisted:", testDacId);

  // Get implementation addresses
  const accessControlImpl = await upgrades.erc1967.getImplementationAddress(accessControlAddress);
  const verificationEngineImpl = await upgrades.erc1967.getImplementationAddress(verificationEngineAddress);
  const carbonCreditImpl = await upgrades.erc1967.getImplementationAddress(carbonCreditAddress);
  const carbonMarketplaceImpl = await upgrades.erc1967.getImplementationAddress(carbonMarketplaceAddress);

  // Deployment summary
  console.log("\n========================================");
  console.log("DEPLOYMENT COMPLETE");
  console.log("========================================");
  const network = await ethers.provider.getNetwork();
  console.log("Network:", network.name);
  console.log("Chain ID:", network.chainId.toString());
  console.log("----------------------------------------");
  console.log("TerraQuraAccessControl Proxy:", accessControlAddress);
  console.log("TerraQuraAccessControl Impl:", accessControlImpl);
  console.log("----------------------------------------");
  console.log("VerificationEngine Proxy:", verificationEngineAddress);
  console.log("VerificationEngine Impl:", verificationEngineImpl);
  console.log("----------------------------------------");
  console.log("CarbonCredit Proxy:", carbonCreditAddress);
  console.log("CarbonCredit Impl:", carbonCreditImpl);
  console.log("----------------------------------------");
  console.log("CarbonMarketplace Proxy:", carbonMarketplaceAddress);
  console.log("CarbonMarketplace Impl:", carbonMarketplaceImpl);
  console.log("----------------------------------------");
  console.log("Platform Fee:", platformFeeBps / 100, "%");
  console.log("Fee Recipient:", deployer.address);
  console.log("Owner:", deployer.address);
  console.log("Test DAC ID:", testDacId);
  console.log("========================================");

  const finalBalance = await ethers.provider.getBalance(deployer.address);
  console.log("\nFinal balance:", ethers.formatEther(finalBalance), "POL");

  // Return addresses for verification script
  return {
    accessControl: {
      proxy: accessControlAddress,
      implementation: accessControlImpl,
    },
    verificationEngine: {
      proxy: verificationEngineAddress,
      implementation: verificationEngineImpl,
    },
    carbonCredit: {
      proxy: carbonCreditAddress,
      implementation: carbonCreditImpl,
    },
    carbonMarketplace: {
      proxy: carbonMarketplaceAddress,
      implementation: carbonMarketplaceImpl,
    },
    testDacId,
    owner: deployer.address,
  };
}

main()
  .then((addresses) => {
    console.log("\nContract addresses for verification:", JSON.stringify(addresses, null, 2));
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
