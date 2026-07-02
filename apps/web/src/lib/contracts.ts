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

export const ACTIVE_DEPLOYMENT_KEY = getActiveDeploymentKey(process.env);
const manifestContracts = getDeploymentContractAddresses(ACTIVE_DEPLOYMENT_KEY);
const configuredContracts = withContractAddressOverrides(
  manifestContracts,
  process.env,
  "NEXT_PUBLIC_TERRAQURA_CONTRACT_",
);

export const CONTRACTS = {
  ...configuredContracts,
  nativeIoTOracle: (
    process.env.NEXT_PUBLIC_ORACLE_ADDRESS || configuredContracts.nativeIoTOracle
  ) as `0x${string}`,
} as const;

export const CHAIN_ID = parseInt(
  process.env.NEXT_PUBLIC_CHAIN_ID || String(getActiveNetwork(process.env).chainId),
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
