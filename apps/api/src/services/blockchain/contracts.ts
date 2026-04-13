/**
 * TerraQura Blockchain Service
 *
 * Provides ethers.js integration with deployed contracts on Aethelred Testnet
 */

import { ethers } from "ethers";

// Contract addresses on Aethelred Testnet (Chain ID: 78432) - Solidity 0.8.32 (Bug-free)
export const CONTRACTS = {
  // Core Contracts (UUPS Proxies)
  accessControl: "0x55695aAAEC30AB495074c57e85Ae2E1A4866B83b",
  verificationEngine: "0x8dad7E87646e9607Fae225e3A7EAD17ce179dEA8",
  carbonCredit: "0x29B58064fD95b175e5824767d3B18bACFafaF959",
  carbonMarketplace: "0x5a4cb32709AB829E2918F0a914FBa1e0Dab2Fdec",

  // Governance Contracts
  multisig: "0x0805E6ffDE71fd798F3Fe787D1dC907aABA65bAD",
  timelock: "0xb8b01581d61Bf2D58B8B8626Ebb7Ab959ccF6354",

  // Security Contracts
  circuitBreaker: "0x24192ecf06aA782F1dF69878413D217d9319e257",

  // Gasless Marketplace
  gaslessMarketplace: "0x45a65e46e8C1D588702cB659b7d3786476Be0A80",
} as const;

// Network configuration
export const NETWORK = {
  chainId: 78432,
  name: "Aethelred Testnet",
  rpcUrl: process.env.AETHELRED_RPC_URL || "https://rpc-testnet.aethelred.network",
  explorerUrl: "https://explorer-testnet.aethelred.network",
};

// Minimal ABIs for contract interaction
export const ABIS = {
  carbonCredit: [
    "function name() view returns (string)",
    "function symbol() view returns (string)",
    "function balanceOf(address account, uint256 id) view returns (uint256)",
    "function uri(uint256 tokenId) view returns (string)",
    "function mintVerifiedCredits(address recipient, bytes32 dacId, bytes32 dataHash, uint256 captureTimestamp, uint256 co2AmountKg, uint256 energyConsumedKwh, int256 latitude, int256 longitude, uint8 purityPercentage, uint256 gridIntensityGCO2PerKwh, string metadataUri, string arweaveBackup) external returns (uint256)",
    "function retireCredits(uint256 tokenId, uint256 amount, string reason) external",
    "event CreditMinted(uint256 indexed tokenId, bytes32 indexed dacUnitId, address indexed operator, uint256 co2AmountKg, bytes32 sourceDataHash)",
    "event CreditRetired(uint256 indexed tokenId, address indexed retiredBy, uint256 amount, string retirementReason)",
    "event Transfer(address indexed operator, address indexed from, address indexed to, uint256 id, uint256 value)",
  ],
  carbonMarketplace: [
    "function createListing(uint256 tokenId, uint256 amount, uint256 pricePerUnit) external returns (uint256)",
    "function buyCredits(uint256 listingId, uint256 amount) external payable",
    "function cancelListing(uint256 listingId) external",
    "function listings(uint256 listingId) view returns (uint256 tokenId, address seller, uint256 amount, uint256 pricePerUnit, bool active)",
    "function platformFeeBps() view returns (uint256)",
    "event ListingCreated(uint256 indexed listingId, address indexed seller, uint256 indexed tokenId, uint256 amount, uint256 pricePerUnit)",
    "event ListingSold(uint256 indexed listingId, address indexed buyer, uint256 amount, uint256 totalPrice)",
  ],
  verificationEngine: [
    "function isWhitelisted(bytes32 dacUnitId) view returns (bool)",
    "function getOperator(bytes32 dacUnitId) view returns (address)",
    "function whitelistDacUnit(bytes32 unitId, address operator, string location) external",
    "function carbonCreditContract() view returns (address)",
  ],
  circuitBreaker: [
    "function isOperationAllowed(address contractAddr) view returns (bool)",
    "function globalPause() view returns (bool)",
    "function getStatus() view returns (bool isGloballyPaused, uint8 currentLevel, uint256 monitoredCount)",
    "function activateGlobalPause(string reason) external",
  ],
};

// Provider singleton
let provider: ethers.JsonRpcProvider | null = null;

export interface WhitelistDacUnitParams {
  unitId: string;
  operator: string;
  location: string;
}

export interface MintVerifiedCreditsParams {
  recipient: string;
  dacUnitId: string;
  sourceDataHash: string;
  captureTimestamp: number;
  co2AmountKg: number;
  energyConsumedKwh: number;
  latitude: number;
  longitude: number;
  purityPercentage: number;
  gridIntensityGco2PerKwh: number;
  metadataUri: string;
  arweaveBackupTxId?: string | null;
}

export function getProvider(): ethers.JsonRpcProvider {
  if (!provider) {
    provider = new ethers.JsonRpcProvider(NETWORK.rpcUrl);
  }
  return provider;
}

// Contract getters
export function getCarbonCreditContract(signerOrProvider?: ethers.Signer | ethers.Provider) {
  return new ethers.Contract(
    CONTRACTS.carbonCredit,
    ABIS.carbonCredit,
    signerOrProvider || getProvider()
  );
}

export function getMarketplaceContract(signerOrProvider?: ethers.Signer | ethers.Provider) {
  return new ethers.Contract(
    CONTRACTS.carbonMarketplace,
    ABIS.carbonMarketplace,
    signerOrProvider || getProvider()
  );
}

export function getVerificationEngineContract(signerOrProvider?: ethers.Signer | ethers.Provider) {
  return new ethers.Contract(
    CONTRACTS.verificationEngine,
    ABIS.verificationEngine,
    signerOrProvider || getProvider()
  );
}

export function getCircuitBreakerContract(signerOrProvider?: ethers.Signer | ethers.Provider) {
  return new ethers.Contract(
    CONTRACTS.circuitBreaker,
    ABIS.circuitBreaker,
    signerOrProvider || getProvider()
  );
}

// Helper to get signer from private key
export function getSigner(): ethers.Wallet {
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    throw new Error("PRIVATE_KEY not set in environment");
  }
  return new ethers.Wallet(privateKey, getProvider());
}

function assertBlockchainExecutionConfigured(): void {
  if (!process.env.PRIVATE_KEY) {
    throw new Error("Blockchain signer is not configured");
  }
}

function assertSuccessfulReceipt(
  receipt: ethers.TransactionReceipt | null,
  operation: string,
): ethers.TransactionReceipt {
  if (!receipt || receipt.status !== 1) {
    throw new Error(`${operation} transaction was not confirmed on-chain`);
  }

  return receipt;
}

// Check if operations are allowed (circuit breaker)
export async function isSystemOperational(): Promise<boolean> {
  try {
    const cb = getCircuitBreakerContract();
    if (typeof cb.getStatus !== "function") {
      throw new Error("Circuit breaker contract missing getStatus()");
    }

    const status = await cb.getStatus();
    const isGloballyPaused = Array.isArray(status) ? status[0] : status.isGloballyPaused;
    return !isGloballyPaused;
  } catch (error) {
    console.error("Error checking system status:", error);
    return false;
  }
}

async function assertSystemOperationalOrThrow(): Promise<void> {
  const operational = await isSystemOperational();
  if (!operational) {
    throw new Error("Circuit breaker is active or unavailable");
  }
}

export async function whitelistDacUnitOnChain(
  params: WhitelistDacUnitParams,
): Promise<{ txHash: string }> {
  assertBlockchainExecutionConfigured();
  await assertSystemOperationalOrThrow();

  const contract = getVerificationEngineContract(getSigner()) as ethers.Contract & {
    whitelistDacUnit: (
      unitId: string,
      operator: string,
      location: string,
    ) => Promise<ethers.ContractTransactionResponse>;
  };
  const tx = await contract.whitelistDacUnit(
    params.unitId,
    params.operator,
    params.location,
  );
  const receipt = assertSuccessfulReceipt(
    await tx.wait(),
    "DAC unit whitelist",
  );

  return { txHash: receipt.hash };
}

export async function mintVerifiedCreditsOnChain(
  params: MintVerifiedCreditsParams,
): Promise<{ txHash: string; tokenId: string }> {
  assertBlockchainExecutionConfigured();
  await assertSystemOperationalOrThrow();

  const contract = getCarbonCreditContract(getSigner()) as ethers.Contract & {
    mintVerifiedCredits: (
      recipient: string,
      dacUnitId: string,
      sourceDataHash: string,
      captureTimestamp: number,
      co2AmountKg: number,
      energyConsumedKwh: number,
      latitude: number,
      longitude: number,
      purityPercentage: number,
      gridIntensityGco2PerKwh: number,
      metadataUri: string,
      arweaveBackupTxId: string,
    ) => Promise<ethers.ContractTransactionResponse>;
  };
  const tx = await contract.mintVerifiedCredits(
    params.recipient,
    params.dacUnitId,
    params.sourceDataHash,
    params.captureTimestamp,
    params.co2AmountKg,
    params.energyConsumedKwh,
    params.latitude,
    params.longitude,
    params.purityPercentage,
    params.gridIntensityGco2PerKwh,
    params.metadataUri,
    params.arweaveBackupTxId || "",
  );
  const receipt = assertSuccessfulReceipt(await tx.wait(), "Carbon credit mint");

  for (const log of receipt.logs) {
    try {
      const parsed = contract.interface.parseLog(log);
      if (parsed?.name === "CreditMinted") {
        return {
          txHash: receipt.hash,
          tokenId: ethers.toBeHex(parsed.args.tokenId, 32),
        };
      }
    } catch {
      // Ignore unrelated logs.
    }
  }

  throw new Error("Mint transaction confirmed without a CreditMinted event");
}

// Get explorer link for transaction
export function getExplorerTxLink(txHash: string): string {
  return `${NETWORK.explorerUrl}/tx/${txHash}`;
}

// Get explorer link for address
export function getExplorerAddressLink(address: string): string {
  return `${NETWORK.explorerUrl}/address/${address}`;
}
