import { ethers, upgrades } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Deploying TerraQura contracts with account:", deployer.address);
  console.log(
    "Account balance:",
    ethers.formatEther(await ethers.provider.getBalance(deployer.address)),
    "AETHEL",
  );

  // Get the contract factories
  const TerraQuraAccessControl = await ethers.getContractFactory(
    "TerraQuraAccessControl",
  );
  const VerificationEngine =
    await ethers.getContractFactory("VerificationEngine");
  const CarbonCredit = await ethers.getContractFactory("CarbonCredit");
  const CarbonMarketplace =
    await ethers.getContractFactory("CarbonMarketplace");

  // 1. Deploy TerraQuraAccessControl (UUPS upgradeable)
  console.log("\n1. Deploying TerraQuraAccessControl (UUPS Proxy)...");
  const accessControl = await upgrades.deployProxy(
    TerraQuraAccessControl,
    [deployer.address], // admin
    {
      initializer: "initialize",
      kind: "uups",
    },
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
    },
  );
  await verificationEngine.waitForDeployment();
  const verificationEngineAddress = await verificationEngine.getAddress();
  console.log("   VerificationEngine Proxy:", verificationEngineAddress);

  // 3. Deploy CarbonCredit (UUPS upgradeable)
  console.log("\n3. Deploying CarbonCredit (UUPS Proxy)...");
  const carbonCredit = await upgrades.deployProxy(
    CarbonCredit,
    [
      verificationEngineAddress,
      "https://api.terraqura.aethelred.network/metadata/",
      deployer.address,
    ],
    {
      initializer: "initialize",
      kind: "uups",
    },
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
    },
  );
  await carbonMarketplace.waitForDeployment();
  const carbonMarketplaceAddress = await carbonMarketplace.getAddress();
  console.log("   CarbonMarketplace Proxy:", carbonMarketplaceAddress);

  // 5. Configure VerificationEngine with CarbonCredit address
  console.log("\n5. Configuring VerificationEngine...");
  const setTx =
    await verificationEngine.setCarbonCreditContract(carbonCreditAddress);
  await setTx.wait();
  console.log("   CarbonCredit contract set in VerificationEngine");

  // 5b. Deploy SealProofOfPhysics (consensus-anchored MRV; NOT upgradeable) and
  //     wire it into CarbonCredit as the top assurance tier. Enforcement stays
  //     OFF here — governance turns it on once the seal pipeline is live.
  console.log("\n5b. Deploying SealProofOfPhysics (consensus-anchored MRV)...");
  const SealProofOfPhysics =
    await ethers.getContractFactory("SealProofOfPhysics");
  const sealRegistry = await SealProofOfPhysics.deploy(deployer.address);
  await sealRegistry.waitForDeployment();
  const sealRegistryAddress = await sealRegistry.getAddress();
  console.log("   SealProofOfPhysics:", sealRegistryAddress);

  const wireTx = await carbonCredit.setSealRegistry(sealRegistryAddress);
  await wireTx.wait();
  console.log("   Seal registry wired into CarbonCredit (enforcement: OFF)");

  // 5c. Deploy CarbonRetirement + RetirementCertificate and wire the burn
  //     authority: retirement BURNS supply via CarbonCredit.retireCreditsFrom,
  //     so the retirement contract must be an approved retirer.
  console.log("\n5c. Deploying CarbonRetirement + RetirementCertificate...");
  const CarbonRetirement = await ethers.getContractFactory("CarbonRetirement");
  const carbonRetirement = await upgrades.deployProxy(
    CarbonRetirement,
    [carbonCreditAddress, deployer.address],
    { initializer: "initialize", kind: "uups" },
  );
  await carbonRetirement.waitForDeployment();
  const carbonRetirementAddress = await carbonRetirement.getAddress();
  console.log("   CarbonRetirement Proxy:", carbonRetirementAddress);

  const RetirementCertificate = await ethers.getContractFactory(
    "RetirementCertificate",
  );
  const retirementCertificate = await upgrades.deployProxy(
    RetirementCertificate,
    [carbonRetirementAddress, deployer.address],
    { initializer: "initialize", kind: "uups" },
  );
  await retirementCertificate.waitForDeployment();
  const retirementCertificateAddress = await retirementCertificate.getAddress();
  console.log("   RetirementCertificate Proxy:", retirementCertificateAddress);

  await (
    await carbonRetirement.setCertificateContract(retirementCertificateAddress)
  ).wait();
  await (
    await carbonCredit.setApprovedRetirer(carbonRetirementAddress, true)
  ).wait();
  console.log("   CarbonRetirement approved as burn-retirer on CarbonCredit");

  // 5d. Deploy CircuitBreaker and wire it into CarbonCredit so a global pause
  //     actually halts every token movement (mint/transfer/burn).
  console.log("\n5d. Deploying CircuitBreaker...");
  const CircuitBreaker = await ethers.getContractFactory("CircuitBreaker");
  const circuitBreaker = await upgrades.deployProxy(
    CircuitBreaker,
    [deployer.address],
    { initializer: "initialize", kind: "uups" },
  );
  await circuitBreaker.waitForDeployment();
  const circuitBreakerAddress = await circuitBreaker.getAddress();
  console.log("   CircuitBreaker Proxy:", circuitBreakerAddress);

  await (await carbonCredit.setCircuitBreaker(circuitBreakerAddress)).wait();
  console.log("   CircuitBreaker wired into CarbonCredit token movements");

  // 5e. One KYC authority: the marketplace delegates KYC decisions to
  //     TerraQuraAccessControl (expiry + sanctions aware).
  await (await carbonMarketplace.setKycRegistry(accessControlAddress)).wait();
  console.log("   Marketplace KYC delegated to TerraQuraAccessControl");

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
  await (
    await verificationEngine.whitelistDacUnit(testDacId, deployer.address)
  ).wait();
  console.log("   Test DAC unit whitelisted:", testDacId);

  // Get implementation addresses
  const accessControlImpl =
    await upgrades.erc1967.getImplementationAddress(accessControlAddress);
  const verificationEngineImpl =
    await upgrades.erc1967.getImplementationAddress(verificationEngineAddress);
  const carbonCreditImpl =
    await upgrades.erc1967.getImplementationAddress(carbonCreditAddress);
  const carbonMarketplaceImpl = await upgrades.erc1967.getImplementationAddress(
    carbonMarketplaceAddress,
  );
  const carbonRetirementImpl = await upgrades.erc1967.getImplementationAddress(
    carbonRetirementAddress,
  );
  const retirementCertificateImpl =
    await upgrades.erc1967.getImplementationAddress(
      retirementCertificateAddress,
    );
  const circuitBreakerImpl = await upgrades.erc1967.getImplementationAddress(
    circuitBreakerAddress,
  );

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
  console.log("SealProofOfPhysics:", sealRegistryAddress);
  console.log("----------------------------------------");
  console.log("CarbonRetirement Proxy:", carbonRetirementAddress);
  console.log("CarbonRetirement Impl:", carbonRetirementImpl);
  console.log("----------------------------------------");
  console.log("RetirementCertificate Proxy:", retirementCertificateAddress);
  console.log("RetirementCertificate Impl:", retirementCertificateImpl);
  console.log("----------------------------------------");
  console.log("CircuitBreaker Proxy:", circuitBreakerAddress);
  console.log("CircuitBreaker Impl:", circuitBreakerImpl);
  console.log("----------------------------------------");
  console.log("Platform Fee:", platformFeeBps / 100, "%");
  console.log("Fee Recipient:", deployer.address);
  console.log("Owner:", deployer.address);
  console.log("Test DAC ID:", testDacId);
  console.log("========================================");

  // Enforcement attestations (testnet handoff §4) — read back from the live
  // chain, never assumed, so the printed block can be pasted straight into
  // the deployment manifest the production launch gate checks.
  const attestations = {
    sealAnchorRequired: await carbonCredit.sealAnchorRequired(),
    sealEnforcementLocked: await carbonCredit.sealEnforcementLocked(),
    kycRegistryConfigured:
      (await carbonMarketplace.kycRegistry()) !== ethers.ZeroAddress,
    circuitBreakerWired:
      (await carbonCredit.circuitBreaker()) !== ethers.ZeroAddress,
    retirementWiredAsApprovedRetirer: await carbonCredit.approvedRetirers(
      carbonRetirementAddress,
    ),
  };
  console.log("\nEnforcement attestations (live chain reads):");
  for (const [key, value] of Object.entries(attestations)) {
    console.log(`  enforcement.${key} = ${value}`);
  }

  const finalBalance = await ethers.provider.getBalance(deployer.address);
  console.log("\nFinal balance:", ethers.formatEther(finalBalance), "AETHEL");

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
    sealProofOfPhysics: {
      address: sealRegistryAddress,
    },
    carbonRetirement: {
      proxy: carbonRetirementAddress,
      implementation: carbonRetirementImpl,
    },
    retirementCertificate: {
      proxy: retirementCertificateAddress,
      implementation: retirementCertificateImpl,
    },
    circuitBreaker: {
      proxy: circuitBreakerAddress,
      implementation: circuitBreakerImpl,
    },
    enforcement: attestations,
    testDacId,
    owner: deployer.address,
  };
}

main()
  .then((addresses) => {
    console.log(
      "\nContract addresses for verification:",
      JSON.stringify(addresses, null, 2),
    );
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
