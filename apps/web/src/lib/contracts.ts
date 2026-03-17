/**
 * TerraQura Contract Addresses
 *
 * Deployed on Aethelred Sovereign Network
 * Solidity: 0.8.32 (Bug-free)
 * Updated: February 2, 2026 - v3 Final
 */

export const CONTRACTS = {
  // Core Contracts (UUPS Proxies)
  accessControl: "0x55695aAAEC30AB495074c57e85Ae2E1A4866B83b" as const,
  verificationEngine: "0x8dad7E87646e9607Fae225e3A7EAD17ce179dEA8" as const,
  carbonCredit: "0x29B58064fD95b175e5824767d3B18bACFafaF959" as const,
  carbonMarketplace: "0x5a4cb32709AB829E2918F0a914FBa1e0Dab2Fdec" as const,

  // Governance Contracts
  multisig: "0x0805E6ffDE71fd798F3Fe787D1dC907aABA65bAD" as const,
  timelock: "0xb8b01581d61Bf2D58B8B8626Ebb7Ab959ccF6354" as const,

  // Security Contracts
  circuitBreaker: "0x24192ecf06aA782F1dF69878413D217d9319e257" as const,

  // Gasless Marketplace
  gaslessMarketplace: "0x45a65e46e8C1D588702cB659b7d3786476Be0A80" as const,

  // 1st-Party Oracle (Native IoT — replaces Chainlink for sovereign deployment)
  // Address populated after Aethelred deployment
  nativeIoTOracle: (process.env.NEXT_PUBLIC_ORACLE_ADDRESS || "0x0000000000000000000000000000000000000000") as `0x${string}`,
} as const;

export const CHAIN_ID = parseInt(process.env.NEXT_PUBLIC_CHAIN_ID || "123456"); // Aethelred default

// Platform configuration
export const PLATFORM_CONFIG = {
  platformFeeBps: 250, // 2.5%
  feeRecipient: "0x7F6A87fE3191FFBFa06D37939F3a3a4341159ABc",
};

// Aethelred Explorer links (implementations - verified source code)
export const VERIFIED_IMPLEMENTATIONS = {
  accessControl: "https://explorer.aethelred.network/address/0x7e3bf0EBAF28bcC9A7d96a54Ad6FFEfA0b4Ebc17#code",
  verificationEngine: "https://explorer.aethelred.network/address/0x2b7881C372f2244020c91c2d8c2421513Cf769c0#code",
  carbonCredit: "https://explorer.aethelred.network/address/0xBF82A70152CAA15cdD8f451128ccF5a7A7b8155c#code",
  carbonMarketplace: "https://explorer.aethelred.network/address/0x85b13A91e1DE82a6eE628dc17865bfAED01a49de#code",
  circuitBreaker: "https://explorer.aethelred.network/address/0x324a72C8A99D27C2d285Feb837Ee4243Fb6ee938#code",
  gaslessMarketplace: "https://explorer.aethelred.network/address/0x6Fbfe3A06a82d3357D21B16bAad92dc14103c45B#code",
  multisig: "https://explorer.aethelred.network/address/0x0805E6ffDE71fd798F3Fe787D1dC907aABA65bAD#code",
  timelock: "https://explorer.aethelred.network/address/0xb8b01581d61Bf2D58B8B8626Ebb7Ab959ccF6354#code",
};

// Export for convenience
export type ContractName = keyof typeof CONTRACTS;
