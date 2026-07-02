/**
 * TerraQura Blockchain Service
 *
 * Provides ethers.js integration with the active TerraQura deployment.
 */

import {
  getActiveDeployment,
  getActiveDeploymentKey,
  getDeploymentContractAddresses,
  getNetwork,
  requireContractAddress,
  withContractAddressOverrides,
  type ContractAddressKey,
} from "@terraqura/network-manifest";
import { ethers } from "ethers";

import { createScopedLogger, serializeError } from "../../lib/logger.js";

const activeDeploymentKey = getActiveDeploymentKey(process.env);
const activeDeployment = getActiveDeployment(process.env);
const activeNetwork = getNetwork(activeDeployment.network);
const deploymentAddresses = getDeploymentContractAddresses(activeDeploymentKey);
const resolvedAddresses = withContractAddressOverrides(deploymentAddresses, process.env);
const blockchainLogger = createScopedLogger("blockchain.contracts", {
  deploymentKey: activeDeploymentKey,
  networkKey: activeNetwork.key,
});

function resolveRpcUrl(): string {
  const scopedRpcUrl =
    activeNetwork.key === "polygonAmoy"
      ? process.env.POLYGON_AMOY_RPC_URL ?? process.env.POLYGON_RPC_URL
      : activeNetwork.key === "aethelredTestnet"
        ? process.env.AETHELRED_TESTNET_RPC_URL ?? process.env.AETHELRED_RPC_URL
        : process.env.AETHELRED_RPC_URL;

  return process.env.TERRAQURA_RPC_URL ?? scopedRpcUrl ?? activeNetwork.rpcUrls[0];
}

function requireAddress(key: ContractAddressKey): `0x${string}` {
  return requireContractAddress(resolvedAddresses, key, activeDeploymentKey);
}

export const CONTRACTS = resolvedAddresses;

// Network configuration
export const NETWORK = {
  chainId: activeNetwork.chainId,
  name: activeNetwork.displayName,
  key: activeNetwork.key,
  deploymentKey: activeDeploymentKey,
  deploymentStatus: activeDeployment.status,
  rpcUrl: resolveRpcUrl(),
  explorerUrl: activeNetwork.explorerUrl,
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
    requireAddress("carbonCredit"),
    ABIS.carbonCredit,
    signerOrProvider || getProvider()
  );
}

export function getMarketplaceContract(signerOrProvider?: ethers.Signer | ethers.Provider) {
  return new ethers.Contract(
    requireAddress("carbonMarketplace"),
    ABIS.carbonMarketplace,
    signerOrProvider || getProvider()
  );
}

export function getVerificationEngineContract(signerOrProvider?: ethers.Signer | ethers.Provider) {
  return new ethers.Contract(
    requireAddress("verificationEngine"),
    ABIS.verificationEngine,
    signerOrProvider || getProvider()
  );
}

export function getCircuitBreakerContract(signerOrProvider?: ethers.Signer | ethers.Provider) {
  return new ethers.Contract(
    requireAddress("circuitBreaker"),
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
    blockchainLogger.warn(
      { err: serializeError(error) },
      "Unable to check circuit breaker status; defaulting to operational"
    );
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
