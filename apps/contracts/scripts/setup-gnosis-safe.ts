// TerraQura Gnosis Safe Setup
// Configure multi-sig wallet for enterprise-grade admin security

import { ethers } from "hardhat";
import SafeApiKit from "@safe-global/api-kit";
import Safe, { SafeFactory, SafeAccountConfig } from "@safe-global/protocol-kit";
import { MetaTransactionData, OperationType } from "@safe-global/safe-core-sdk-types";

// Configuration
const SAFE_CONFIG = {
  // Required signers (3 of 5)
  threshold: 3,

  // Signer addresses (replace with actual addresses)
  owners: [
    process.env.SIGNER_1_ADDRESS!,
    process.env.SIGNER_2_ADDRESS!,
    process.env.SIGNER_3_ADDRESS!,
    process.env.SIGNER_4_ADDRESS!,
    process.env.SIGNER_5_ADDRESS!,
  ],

  // Network configuration
  chainId: 78431, // Aethelred mainnet

  // Safe transaction service URL
  txServiceUrl: "https://safe-transaction.aethelred.network",
};

interface DeployedContracts {
  carbonCredit: string;
  verificationEngine: string;
  marketplace: string;
  accessControl: string;
}

async function main() {
  console.log("Setting up Gnosis Safe for TerraQura...\n");

  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);

  // Initialize Safe API Kit
  const apiKit = new SafeApiKit({
    chainId: BigInt(SAFE_CONFIG.chainId),
  });

  // Check if Safe already exists or create new one
  let safeAddress = process.env.GNOSIS_SAFE_ADDRESS;

  if (!safeAddress) {
    console.log("\nCreating new Gnosis Safe...");
    safeAddress = await createSafe(deployer);
  }

  console.log("\nGnosis Safe Address:", safeAddress);

  // Initialize Safe SDK
  const safeSdk = await Safe.create({
    ethAdapter: deployer as any, // ethers v6 adapter
    safeAddress,
  });

  // Get contract addresses from environment or deployment
  const contracts: DeployedContracts = {
    carbonCredit: process.env.CARBON_CREDIT_CONTRACT!,
    verificationEngine: process.env.VERIFICATION_ENGINE_CONTRACT!,
    marketplace: process.env.CARBON_MARKETPLACE_CONTRACT!,
    accessControl: process.env.ACCESS_CONTROL_CONTRACT!,
  };

  // Transfer ownership to Safe
  console.log("\nPreparing ownership transfer transactions...");

  const ownershipTransactions = await prepareOwnershipTransfer(
    contracts,
    safeAddress
  );

  // Create Safe transaction
  const safeTransaction = await safeSdk.createTransaction({
    transactions: ownershipTransactions,
  });

  // Sign transaction
  console.log("\nSigning transaction...");
  const signedTx = await safeSdk.signTransaction(safeTransaction);

  // Get transaction hash
  const safeTxHash = await safeSdk.getTransactionHash(safeTransaction);
  console.log("Transaction Hash:", safeTxHash);

  // Propose transaction to Safe
  console.log("\nProposing transaction to Safe...");
  await apiKit.proposeTransaction({
    safeAddress,
    safeTransactionData: safeTransaction.data,
    safeTxHash,
    senderAddress: deployer.address,
    senderSignature: signedTx.signatures.get(deployer.address.toLowerCase())!.data,
  });

  console.log("\nTransaction proposed successfully!");
  console.log("Other signers can now approve at: https://app.safe.global/");

  // Output summary
  console.log("\n============================================");
  console.log("GNOSIS SAFE SETUP COMPLETE");
  console.log("============================================");
  console.log(`Safe Address: ${safeAddress}`);
  console.log(`Required Signatures: ${SAFE_CONFIG.threshold} of ${SAFE_CONFIG.owners.length}`);
  console.log("\nOwners:");
  SAFE_CONFIG.owners.forEach((owner, i) => {
    console.log(`  ${i + 1}. ${owner}`);
  });
  console.log("\nContracts to be owned by Safe:");
  console.log(`  - CarbonCredit: ${contracts.carbonCredit}`);
  console.log(`  - VerificationEngine: ${contracts.verificationEngine}`);
  console.log(`  - Marketplace: ${contracts.marketplace}`);
  console.log(`  - AccessControl: ${contracts.accessControl}`);
  console.log("\n============================================");
}

async function createSafe(deployer: any): Promise<string> {
  const safeFactory = await SafeFactory.create({
    ethAdapter: deployer,
  });

  const safeAccountConfig: SafeAccountConfig = {
    owners: SAFE_CONFIG.owners,
    threshold: SAFE_CONFIG.threshold,
  };

  const safeSdk = await safeFactory.deploySafe({
    safeAccountConfig,
    options: {
      gasLimit: 1000000,
    },
  });

  const safeAddress = await safeSdk.getAddress();
  console.log("New Safe deployed at:", safeAddress);

  return safeAddress;
}

async function prepareOwnershipTransfer(
  contracts: DeployedContracts,
  newOwner: string
): Promise<MetaTransactionData[]> {
  const transactions: MetaTransactionData[] = [];

  // ABI for ownership transfer
  const ownableAbi = [
    "function transferOwnership(address newOwner)",
  ];

  const accessControlAbi = [
    "function grantRole(bytes32 role, address account)",
    "function renounceRole(bytes32 role, address account)",
  ];

  const iface = new ethers.Interface(ownableAbi);
  const accessIface = new ethers.Interface(accessControlAbi);

  // Transfer CarbonCredit ownership
  transactions.push({
    to: contracts.carbonCredit,
    value: "0",
    data: iface.encodeFunctionData("transferOwnership", [newOwner]),
    operation: OperationType.Call,
  });

  // Transfer VerificationEngine ownership
  transactions.push({
    to: contracts.verificationEngine,
    value: "0",
    data: iface.encodeFunctionData("transferOwnership", [newOwner]),
    operation: OperationType.Call,
  });

  // Transfer Marketplace ownership
  transactions.push({
    to: contracts.marketplace,
    value: "0",
    data: iface.encodeFunctionData("transferOwnership", [newOwner]),
    operation: OperationType.Call,
  });

  // Grant ADMIN_ROLE to Safe on AccessControl
  const ADMIN_ROLE = ethers.keccak256(ethers.toUtf8Bytes("ADMIN_ROLE"));
  transactions.push({
    to: contracts.accessControl,
    value: "0",
    data: accessIface.encodeFunctionData("grantRole", [ADMIN_ROLE, newOwner]),
    operation: OperationType.Call,
  });

  return transactions;
}

// Utility function to propose a transaction
export async function proposeTransaction(
  safeAddress: string,
  to: string,
  data: string,
  value = "0"
): Promise<string> {
  const [signer] = await ethers.getSigners();

  const safeSdk = await Safe.create({
    ethAdapter: signer as any,
    safeAddress,
  });

  const apiKit = new SafeApiKit({
    chainId: BigInt(SAFE_CONFIG.chainId),
  });

  const safeTransaction = await safeSdk.createTransaction({
    transactions: [
      {
        to,
        value,
        data,
        operation: OperationType.Call,
      },
    ],
  });

  const signedTx = await safeSdk.signTransaction(safeTransaction);
  const safeTxHash = await safeSdk.getTransactionHash(safeTransaction);

  await apiKit.proposeTransaction({
    safeAddress,
    safeTransactionData: safeTransaction.data,
    safeTxHash,
    senderAddress: signer.address,
    senderSignature: signedTx.signatures.get(signer.address.toLowerCase())!.data,
  });

  return safeTxHash;
}

// Utility function to execute approved transaction
export async function executeTransaction(
  safeAddress: string,
  safeTxHash: string
): Promise<string> {
  const [signer] = await ethers.getSigners();

  const safeSdk = await Safe.create({
    ethAdapter: signer as any,
    safeAddress,
  });

  const apiKit = new SafeApiKit({
    chainId: BigInt(SAFE_CONFIG.chainId),
  });

  // Get transaction details
  const safeTransaction = await apiKit.getTransaction(safeTxHash);

  // Execute
  const executeTxResponse = await safeSdk.executeTransaction(safeTransaction as any);
  const receipt = await executeTxResponse.transactionResponse?.wait();

  return receipt?.hash || "";
}

// Export configuration for use in other scripts
export const gnosisSafeConfig = SAFE_CONFIG;

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
