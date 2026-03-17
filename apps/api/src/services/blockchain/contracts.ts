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
    "function mintVerifiedCredits(address recipient, bytes32 dacId, bytes32 dataHash, uint256 captureTimestamp, uint256 co2AmountKg, uint256 energyConsumedKwh, int256 latitude, int256 longitude, uint256 purityPercentage, string metadataUri, string arweaveBackup) external returns (uint256)",
    "event CreditMinted(uint256 indexed tokenId, address indexed recipient, bytes32 indexed dacId, uint256 co2AmountKg, uint256 efficiencyScore)",
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
    return true; // Default to operational if check fails
  }
}

// Get explorer link for transaction
export function getExplorerTxLink(txHash: string): string {
  return `${NETWORK.explorerUrl}/tx/${txHash}`;
}

// Get explorer link for address
export function getExplorerAddressLink(address: string): string {
  return `${NETWORK.explorerUrl}/address/${address}`;
}
