/**
 * TerraQura Contract Addresses
 *
 * Resolved from the canonical TerraQura network manifest for the active
 * Aethelred deployment profile.
 */

import {
  PLATFORM_CONFIG as MANIFEST_PLATFORM_CONFIG,
  getActiveDeploymentKey,
  getActiveNetwork,
  getDeploymentContractAddresses,
  getVerifiedImplementationLinks,
  withContractAddressOverrides,
} from "@terraqura/network-manifest";

// Next.js only inlines process.env.X when X is a LITERAL key. The manifest
// helpers read keys dynamically (env[name]), so handing them the bare
// process.env object silently loses every value in the browser bundle — the
// client then falls back to the mainnet-pending deployment, whose contract
// addresses are all zero, and to the mainnet chain id. Snapshot every key the
// helpers consult with literal accesses so the values survive bundling.
const CLIENT_ENV = {
  NODE_ENV: process.env.NODE_ENV,
  USE_TESTNET: process.env.USE_TESTNET,
  NEXT_PUBLIC_USE_TESTNET: process.env.NEXT_PUBLIC_USE_TESTNET,
  TERRAQURA_NETWORK: process.env.TERRAQURA_NETWORK,
  NEXT_PUBLIC_TERRAQURA_NETWORK: process.env.NEXT_PUBLIC_TERRAQURA_NETWORK,
  TERRAQURA_DEPLOYMENT: process.env.TERRAQURA_DEPLOYMENT,
  NEXT_PUBLIC_TERRAQURA_DEPLOYMENT: process.env.NEXT_PUBLIC_TERRAQURA_DEPLOYMENT,
  NEXT_PUBLIC_TERRAQURA_ALLOW_LEGACY_VALIDATION_DEPLOYMENT:
    process.env.NEXT_PUBLIC_TERRAQURA_ALLOW_LEGACY_VALIDATION_DEPLOYMENT,
  NEXT_PUBLIC_TERRAQURA_CONTRACT_ACCESS_CONTROL:
    process.env.NEXT_PUBLIC_TERRAQURA_CONTRACT_ACCESS_CONTROL,
  NEXT_PUBLIC_TERRAQURA_CONTRACT_VERIFICATION_ENGINE:
    process.env.NEXT_PUBLIC_TERRAQURA_CONTRACT_VERIFICATION_ENGINE,
  NEXT_PUBLIC_TERRAQURA_CONTRACT_CARBON_CREDIT:
    process.env.NEXT_PUBLIC_TERRAQURA_CONTRACT_CARBON_CREDIT,
  NEXT_PUBLIC_TERRAQURA_CONTRACT_CARBON_MARKETPLACE:
    process.env.NEXT_PUBLIC_TERRAQURA_CONTRACT_CARBON_MARKETPLACE,
  NEXT_PUBLIC_TERRAQURA_CONTRACT_GASLESS_MARKETPLACE:
    process.env.NEXT_PUBLIC_TERRAQURA_CONTRACT_GASLESS_MARKETPLACE,
  NEXT_PUBLIC_TERRAQURA_CONTRACT_MULTISIG:
    process.env.NEXT_PUBLIC_TERRAQURA_CONTRACT_MULTISIG,
  NEXT_PUBLIC_TERRAQURA_CONTRACT_TIMELOCK:
    process.env.NEXT_PUBLIC_TERRAQURA_CONTRACT_TIMELOCK,
  NEXT_PUBLIC_TERRAQURA_CONTRACT_CIRCUIT_BREAKER:
    process.env.NEXT_PUBLIC_TERRAQURA_CONTRACT_CIRCUIT_BREAKER,
  NEXT_PUBLIC_TERRAQURA_CONTRACT_RISK_ORACLE:
    process.env.NEXT_PUBLIC_TERRAQURA_CONTRACT_RISK_ORACLE,
  NEXT_PUBLIC_TERRAQURA_CONTRACT_NATIVE_IOT_ORACLE:
    process.env.NEXT_PUBLIC_TERRAQURA_CONTRACT_NATIVE_IOT_ORACLE,
  NEXT_PUBLIC_TERRAQURA_CONTRACT_SEAL_PROOF_OF_PHYSICS:
    process.env.NEXT_PUBLIC_TERRAQURA_CONTRACT_SEAL_PROOF_OF_PHYSICS,
  NEXT_PUBLIC_TERRAQURA_CONTRACT_CARBON_RETIREMENT:
    process.env.NEXT_PUBLIC_TERRAQURA_CONTRACT_CARBON_RETIREMENT,
  NEXT_PUBLIC_TERRAQURA_CONTRACT_RETIREMENT_CERTIFICATE:
    process.env.NEXT_PUBLIC_TERRAQURA_CONTRACT_RETIREMENT_CERTIFICATE,
} as const;

export const ACTIVE_DEPLOYMENT_KEY = getActiveDeploymentKey(CLIENT_ENV);
const manifestContracts = getDeploymentContractAddresses(ACTIVE_DEPLOYMENT_KEY);
const configuredContracts = withContractAddressOverrides(
  manifestContracts,
  CLIENT_ENV,
  "NEXT_PUBLIC_TERRAQURA_CONTRACT_",
);

export const CONTRACTS = {
  ...configuredContracts,
  nativeIoTOracle: (
    process.env.NEXT_PUBLIC_ORACLE_ADDRESS || configuredContracts.nativeIoTOracle
  ) as `0x${string}`,
} as const;

export const CHAIN_ID = parseInt(
  process.env.NEXT_PUBLIC_CHAIN_ID || String(getActiveNetwork(CLIENT_ENV).chainId),
  10,
);

// Platform configuration
export const PLATFORM_CONFIG = {
  platformFeeBps: MANIFEST_PLATFORM_CONFIG.platformFeeBps,
  feeRecipient: MANIFEST_PLATFORM_CONFIG.feeRecipient,
};

export const VERIFIED_IMPLEMENTATIONS =
  getVerifiedImplementationLinks(ACTIVE_DEPLOYMENT_KEY);

// Export for convenience
export type ContractName = keyof typeof CONTRACTS;
