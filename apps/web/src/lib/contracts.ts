import { isAddress, zeroAddress, type Address } from "viem";

const addressEnvironment = {
  accessControl: process.env.NEXT_PUBLIC_ACCESS_CONTROL_ADDRESS,
  verificationEngine: process.env.NEXT_PUBLIC_VERIFICATION_ENGINE_ADDRESS,
  carbonCredit: process.env.NEXT_PUBLIC_CARBON_CREDIT_ADDRESS,
  carbonMarketplace: process.env.NEXT_PUBLIC_CARBON_MARKETPLACE_ADDRESS,
  circuitBreaker: process.env.NEXT_PUBLIC_CIRCUIT_BREAKER_ADDRESS,
} as const;

function configuredAddress(value: string | undefined): Address {
  const candidate = value?.trim();
  return candidate && isAddress(candidate) && candidate !== zeroAddress
    ? candidate
    : zeroAddress;
}

export const CONTRACTS = {
  accessControl: configuredAddress(addressEnvironment.accessControl),
  verificationEngine: configuredAddress(addressEnvironment.verificationEngine),
  carbonCredit: configuredAddress(addressEnvironment.carbonCredit),
  carbonMarketplace: configuredAddress(addressEnvironment.carbonMarketplace),
  circuitBreaker: configuredAddress(addressEnvironment.circuitBreaker),
} as const;

export const CHAIN_ID = Number.parseInt(
  process.env.NEXT_PUBLIC_AETHELRED_TESTNET_CHAIN_ID ||
    process.env.NEXT_PUBLIC_CHAIN_ID ||
    "7332",
  10,
);

const requiredContractNames = [
  "accessControl",
  "verificationEngine",
  "carbonCredit",
  "carbonMarketplace",
  "circuitBreaker",
] as const;

export const BLOCKCHAIN_CONFIGURED =
  Number.isSafeInteger(CHAIN_ID) &&
  CHAIN_ID > 0 &&
  requiredContractNames.every((name) => CONTRACTS[name] !== zeroAddress);

export const BLOCKCHAIN_CONFIGURATION_ERROR = BLOCKCHAIN_CONFIGURED
  ? null
  : "TerraQura contract deployment has not been configured for this network.";

const explorerBase = (
  process.env.NEXT_PUBLIC_AETHELRED_TESTNET_EXPLORER_URL || ""
).replace(/\/+$/, "");

function contractExplorerUrl(address: Address): string {
  return explorerBase && address !== zeroAddress
    ? `${explorerBase}/address/${address}#code`
    : "";
}

export const VERIFIED_IMPLEMENTATIONS = {
  accessControl: contractExplorerUrl(CONTRACTS.accessControl),
  verificationEngine: contractExplorerUrl(CONTRACTS.verificationEngine),
  carbonCredit: contractExplorerUrl(CONTRACTS.carbonCredit),
  carbonMarketplace: contractExplorerUrl(CONTRACTS.carbonMarketplace),
  circuitBreaker: contractExplorerUrl(CONTRACTS.circuitBreaker),
} as const;

export type ContractName = keyof typeof CONTRACTS;
