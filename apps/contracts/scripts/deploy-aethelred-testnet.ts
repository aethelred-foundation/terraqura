import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { ethers, network, upgrades } from "hardhat";

function requiredAddress(name: string): string {
  const value = process.env[name]?.trim();
  if (!value || !ethers.isAddress(value) || value === ethers.ZeroAddress) {
    throw new Error(`${name} must be a non-zero address`);
  }
  return ethers.getAddress(value);
}

function requiredHttpsUrl(name: string): string {
  const value = process.env[name]?.trim();
  if (!value || new URL(value).protocol !== "https:") {
    throw new Error(`${name} must be an HTTPS URL`);
  }
  return value;
}

async function confirmed(
  transaction: Promise<{ wait: () => Promise<unknown> }>,
): Promise<void> {
  await (await transaction).wait();
}

async function main(): Promise<void> {
  if (process.env.CONFIRM_TESTNET_DEPLOY !== "true") {
    throw new Error("Set CONFIRM_TESTNET_DEPLOY=true after deployment review");
  }
  if (network.name !== "aethelredTestnet") {
    throw new Error("This script only deploys to aethelredTestnet");
  }
  requiredHttpsUrl("AETHELRED_TESTNET_RPC_URL");

  const protocolOwner = requiredAddress("PROTOCOL_OWNER_ADDRESS");
  const feeRecipient = requiredAddress("FEE_RECIPIENT_ADDRESS");
  const operatorSigner = requiredAddress("OPERATOR_SIGNER_ADDRESS");
  const metadataBaseUri = requiredHttpsUrl("METADATA_BASE_URI");
  const platformFeeBps = Number.parseInt(
    process.env.PLATFORM_FEE_BPS || "250",
    10,
  );
  if (
    !Number.isSafeInteger(platformFeeBps) ||
    platformFeeBps < 0 ||
    platformFeeBps > 500
  ) {
    throw new Error("PLATFORM_FEE_BPS must be between 0 and 500");
  }

  const [deployer] = await ethers.getSigners();
  if (!deployer) {
    throw new Error("Deployment signer is not configured");
  }
  if (protocolOwner === deployer.address) {
    throw new Error(
      "PROTOCOL_OWNER_ADDRESS must be independent of the deployment signer",
    );
  }
  const chain = await ethers.provider.getNetwork();
  const expectedChainId = BigInt(
    process.env.AETHELRED_TESTNET_CHAIN_ID || "7332",
  );
  if (chain.chainId !== expectedChainId) {
    throw new Error(
      `RPC chain mismatch: expected ${expectedChainId}, received ${chain.chainId}`,
    );
  }
  if ((await ethers.provider.getBalance(deployer.address)) === 0n) {
    throw new Error("Deployment signer has no AETH for transaction fees");
  }

  const AccessControl = await ethers.getContractFactory(
    "TerraQuraAccessControl",
  );
  const CircuitBreaker = await ethers.getContractFactory("CircuitBreaker");
  const VerificationEngine =
    await ethers.getContractFactory("VerificationEngine");
  const CarbonCredit = await ethers.getContractFactory("CarbonCredit");
  const CarbonMarketplace =
    await ethers.getContractFactory("CarbonMarketplace");

  const accessControl = await upgrades.deployProxy(
    AccessControl,
    [deployer.address],
    { initializer: "initialize", kind: "uups" },
  );
  await accessControl.waitForDeployment();
  const accessControlAddress = await accessControl.getAddress();

  const circuitBreaker = await upgrades.deployProxy(
    CircuitBreaker,
    [deployer.address],
    { initializer: "initialize", kind: "uups" },
  );
  await circuitBreaker.waitForDeployment();
  const circuitBreakerAddress = await circuitBreaker.getAddress();

  const verificationEngine = await upgrades.deployProxy(
    VerificationEngine,
    [accessControlAddress, ethers.ZeroAddress],
    { initializer: "initialize", kind: "uups" },
  );
  await verificationEngine.waitForDeployment();
  const verificationEngineAddress = await verificationEngine.getAddress();

  const carbonCredit = await upgrades.deployProxy(
    CarbonCredit,
    [verificationEngineAddress, metadataBaseUri, deployer.address],
    { initializer: "initialize", kind: "uups" },
  );
  await carbonCredit.waitForDeployment();
  const carbonCreditAddress = await carbonCredit.getAddress();

  const marketplace = await upgrades.deployProxy(
    CarbonMarketplace,
    [carbonCreditAddress, feeRecipient, platformFeeBps, deployer.address],
    { initializer: "initialize", kind: "uups" },
  );
  await marketplace.waitForDeployment();
  const marketplaceAddress = await marketplace.getAddress();

  await confirmed(
    verificationEngine.setCarbonCreditContract(carbonCreditAddress),
  );
  await confirmed(verificationEngine.setCircuitBreaker(circuitBreakerAddress));
  await confirmed(carbonCredit.setCircuitBreaker(circuitBreakerAddress));
  await confirmed(carbonCredit.setMinter(operatorSigner, true));
  await confirmed(marketplace.setCircuitBreaker(circuitBreakerAddress));
  await confirmed(marketplace.setKycRegistry(accessControlAddress));
  await confirmed(marketplace.setKycRequired(true));

  for (const address of [
    verificationEngineAddress,
    carbonCreditAddress,
    marketplaceAddress,
  ]) {
    await confirmed(circuitBreaker.registerContract(address));
  }
  await confirmed(circuitBreaker.addPauser(protocolOwner));

  const DEFAULT_ADMIN_ROLE = await accessControl.DEFAULT_ADMIN_ROLE();
  const ADMIN_ROLE = await accessControl.ADMIN_ROLE();
  const UPGRADER_ROLE = await accessControl.UPGRADER_ROLE();
  const PAUSER_ROLE = await accessControl.PAUSER_ROLE();
  const OPERATOR_ROLE = await accessControl.OPERATOR_ROLE();
  const MINTER_ROLE = await accessControl.MINTER_ROLE();
  const COMPLIANCE_ROLE = await accessControl.COMPLIANCE_ROLE();

  for (const role of [
    DEFAULT_ADMIN_ROLE,
    ADMIN_ROLE,
    UPGRADER_ROLE,
    PAUSER_ROLE,
  ]) {
    await confirmed(accessControl.grantRole(role, protocolOwner));
  }
  for (const role of [OPERATOR_ROLE, MINTER_ROLE, COMPLIANCE_ROLE]) {
    await confirmed(accessControl.grantRole(role, operatorSigner));
  }

  await confirmed(verificationEngine.transferOwnership(protocolOwner));
  await confirmed(carbonCredit.transferOwnership(protocolOwner));
  await confirmed(marketplace.transferOwnership(protocolOwner));
  await confirmed(circuitBreaker.removePauser(deployer.address));
  await confirmed(circuitBreaker.transferOwnership(protocolOwner));

  for (const role of [UPGRADER_ROLE, PAUSER_ROLE, ADMIN_ROLE]) {
    await confirmed(accessControl.revokeRole(role, deployer.address));
  }
  await confirmed(
    accessControl.revokeRole(DEFAULT_ADMIN_ROLE, deployer.address),
  );

  const deployments = {
    network: network.name,
    chainId: Number(chain.chainId),
    deployedAt: new Date().toISOString(),
    deployedBy: deployer.address,
    protocolOwner,
    operatorSigner,
    contracts: {
      accessControl: {
        proxy: accessControlAddress,
        implementation:
          await upgrades.erc1967.getImplementationAddress(accessControlAddress),
      },
      verificationEngine: {
        proxy: verificationEngineAddress,
        implementation: await upgrades.erc1967.getImplementationAddress(
          verificationEngineAddress,
        ),
      },
      carbonCredit: {
        proxy: carbonCreditAddress,
        implementation:
          await upgrades.erc1967.getImplementationAddress(carbonCreditAddress),
      },
      carbonMarketplace: {
        proxy: marketplaceAddress,
        implementation:
          await upgrades.erc1967.getImplementationAddress(marketplaceAddress),
      },
      circuitBreaker: {
        proxy: circuitBreakerAddress,
        implementation: await upgrades.erc1967.getImplementationAddress(
          circuitBreakerAddress,
        ),
      },
    },
    configuration: {
      feeRecipient,
      platformFeeBps,
      metadataBaseUri,
      kycRequired: true,
    },
  };
  const deploymentsDirectory = resolve("deployments");
  mkdirSync(deploymentsDirectory, { recursive: true });
  const manifestPath = resolve(
    deploymentsDirectory,
    `aethelred-testnet-${chain.chainId}.json`,
  );
  writeFileSync(manifestPath, `${JSON.stringify(deployments, null, 2)}\n`, {
    mode: 0o600,
  });
  console.log(`Deployment manifest written to ${manifestPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
