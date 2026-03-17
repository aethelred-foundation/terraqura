/**
 * @terraqura/sdk — Constants
 *
 * Network configs, deployed contract addresses, ABIs, role hashes,
 * and verification thresholds. All data is `as const` for maximum
 * type narrowing.
 */

// ============================================
// Network Types & Configs
// ============================================

/** Supported network names */
export type NetworkName = "aethelred-testnet" | "aethelred";

export interface NetworkConfig {
  readonly chainId: number;
  readonly name: string;
  readonly displayName: string;
  readonly rpcUrls: readonly string[];
  readonly explorerUrl: string;
  readonly nativeCurrency: {
    readonly name: string;
    readonly symbol: string;
    readonly decimals: number;
  };
}

export const NETWORK_CONFIGS: Record<NetworkName, NetworkConfig> = {
  "aethelred-testnet": {
    chainId: 78432,
    name: "aethelred-testnet",
    displayName: "Aethelred Testnet",
    rpcUrls: [
      "https://rpc-testnet.aethelred.network",
      "https://testnet.aethelred.drpc.org",
    ],
    explorerUrl: "https://explorer-testnet.aethelred.network",
    nativeCurrency: { name: "AETH", symbol: "AETH", decimals: 18 },
  },
  aethelred: {
    chainId: 78431,
    name: "aethelred",
    displayName: "Aethelred Mainnet",
    rpcUrls: [
      "https://rpc.aethelred.network",
      "https://mainnet.aethelred.drpc.org",
    ],
    explorerUrl: "https://explorer.aethelred.network",
    nativeCurrency: { name: "AETH", symbol: "AETH", decimals: 18 },
  },
} as const;

// ============================================
// Contract Addresses
// ============================================

export interface ContractAddresses {
  readonly accessControl: string;
  readonly verificationEngine: string;
  readonly carbonCredit: string;
  readonly carbonMarketplace: string;
  readonly gaslessMarketplace: string;
  readonly multisig: string;
  readonly timelock: string;
  readonly circuitBreaker: string;
}

export const CONTRACT_ADDRESSES: Record<NetworkName, ContractAddresses> = {
  "aethelred-testnet": {
    accessControl: "0x55695aAAEC30AB495074c57e85Ae2E1A4866B83b",
    verificationEngine: "0x8dad7E87646e9607Fae225e3A7EAD17ce179dEA8",
    carbonCredit: "0x29B58064fD95b175e5824767d3B18bACFafaF959",
    carbonMarketplace: "0x5a4cb32709AB829E2918F0a914FBa1e0Dab2Fdec",
    gaslessMarketplace: "0x45a65e46e8C1D588702cB659b7d3786476Be0A80",
    multisig: "0x0805E6ffDE71fd798F3Fe787D1dC907aABA65bAD",
    timelock: "0xb8b01581d61Bf2D58B8B8626Ebb7Ab959ccF6354",
    circuitBreaker: "0x24192ecf06aA782F1dF69878413D217d9319e257",
  },
  aethelred: {
    accessControl: "",
    verificationEngine: "",
    carbonCredit: "",
    carbonMarketplace: "",
    gaslessMarketplace: "",
    multisig: "",
    timelock: "",
    circuitBreaker: "",
  },
} as const;

// ============================================
// Platform Config
// ============================================

export const PLATFORM_CONFIG = {
  /** Platform fee in basis points (250 = 2.5%) */
  platformFeeBps: 250,
  /** Fee recipient address */
  feeRecipient: "0x7F6A87fE3191FFBFa06D37939F3a3a4341159ABc",
  /** Basis points scale */
  BPS_SCALE: 10_000,
} as const;

// ============================================
// Verification Thresholds
// ============================================

export const VERIFICATION_THRESHOLDS = {
  /** Minimum kWh per tonne CO2 (below = suspiciously efficient) */
  MIN_KWH_PER_TONNE: 200,
  /** Maximum kWh per tonne CO2 (above = too inefficient) */
  MAX_KWH_PER_TONNE: 600,
  /** Optimal kWh per tonne CO2 */
  OPTIMAL_KWH_PER_TONNE: 350,
  /** Minimum CO2 purity percentage */
  MIN_PURITY_PERCENTAGE: 90,
  /** Efficiency factor scale (10000 = 100%) */
  SCALE: 10_000,
  /** Thermodynamic minimum kWh (Net-Negative model) */
  THERMODYNAMIC_MIN_KWH: 100,
  /** Thermodynamic maximum kWh (Net-Negative model) */
  THERMODYNAMIC_MAX_KWH: 800,
  /** Precision scale for Net-Negative calculations */
  PRECISION_SCALE: BigInt("1000000000000000000"), // 1e18
} as const;

// ============================================
// Subgraph URLs
// ============================================

export const SUBGRAPH_URLS: Record<NetworkName, string> = {
  "aethelred-testnet": "https://api.studio.thegraph.com/query/terraqura/carbon-credits-testnet/version/latest",
  aethelred: "https://api.studio.thegraph.com/query/terraqura/carbon-credits/version/latest",
} as const;

// ============================================
// Role Constants (keccak256 hashes)
// ============================================

export const ROLES = {
  DEFAULT_ADMIN: "0x0000000000000000000000000000000000000000000000000000000000000000",
  ADMIN: "0xa49807205ce4d355092ef5a8a18f56e8913cf4a201fbe287825b095693c21775",
  OPERATOR: "0x97667070c54ef182b0f5858b034beac1b6f3089aa2d3188bb1e8929f4fa9b929",
  VERIFIER: "0x0ce23c3e399818cfee81a7ab0880f714e53d7672b08df0fa62f2a3b3c24ea89a",
  MINTER: "0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6",
  COMPLIANCE: "0x9f95a5498d7e03a7c2c9e8a1ee9fdf21e54a6e31c0a2d1c0b8e9c0d9f8a7b6c5",
  AUDITOR: "0x8e8c9a8d7b6a5c4f3e2d1c0b9a8f7e6d5c4b3a2918f7e6d5c4b3a2918f7e6d5c4",
  TREASURY: "0x3496e2e73c4d42b75d702e60d9e48102720b8691234415f8349e50e3e419d9d5",
  UPGRADER: "0x189ab7a9244df0848122154315af71fe140f3db0fe014031783b0946b8c9d2e3",
  PAUSER: "0x65d7a28e3265b37a6474929f336521b332c1681b933f6cb9f3376673440d862a",
} as const;

// ============================================
// Contract ABIs
// ============================================

/**
 * CarbonCredit (ERC-1155) — Full ABI for SDK usage.
 * Extends the minimal frontend ABI with write functions.
 */
export const CarbonCreditABI = [
  // ---- View Functions ----
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "account", type: "address" },
      { name: "id", type: "uint256" },
    ],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "totalCreditsMinted",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "totalCreditsRetired",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "paused",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "bool" }],
  },
  {
    name: "owner",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
  {
    name: "exists",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ type: "bool" }],
  },
  {
    name: "uri",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ type: "string" }],
  },
  {
    name: "totalSupply",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "verificationEngine",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
  {
    name: "approvedMinters",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "bool" }],
  },
  {
    name: "getMetadata",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "dacUnitId", type: "bytes32" },
          { name: "sourceDataHash", type: "bytes32" },
          { name: "captureTimestamp", type: "uint256" },
          { name: "co2AmountKg", type: "uint256" },
          { name: "energyConsumedKwh", type: "uint256" },
          { name: "latitude", type: "int256" },
          { name: "longitude", type: "int256" },
          { name: "purityPercentage", type: "uint8" },
          { name: "isRetired", type: "bool" },
        ],
      },
    ],
  },
  {
    name: "getVerificationResult",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "sourceVerified", type: "bool" },
          { name: "logicVerified", type: "bool" },
          { name: "mintVerified", type: "bool" },
          { name: "efficiencyFactor", type: "uint256" },
          { name: "verifiedAt", type: "uint256" },
        ],
      },
    ],
  },
  {
    name: "getCreditProvenance",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [
      {
        name: "metadata",
        type: "tuple",
        components: [
          { name: "dacUnitId", type: "bytes32" },
          { name: "sourceDataHash", type: "bytes32" },
          { name: "captureTimestamp", type: "uint256" },
          { name: "co2AmountKg", type: "uint256" },
          { name: "energyConsumedKwh", type: "uint256" },
          { name: "latitude", type: "int256" },
          { name: "longitude", type: "int256" },
          { name: "purityPercentage", type: "uint8" },
          { name: "gridIntensityGCO2PerKwh", type: "uint256" },
          { name: "isRetired", type: "bool" },
          { name: "ipfsMetadataUri", type: "string" },
          { name: "arweaveBackupTxId", type: "string" },
        ],
      },
      {
        name: "verification",
        type: "tuple",
        components: [
          { name: "sourceVerified", type: "bool" },
          { name: "logicVerified", type: "bool" },
          { name: "mintVerified", type: "bool" },
          { name: "efficiencyFactor", type: "uint256" },
          { name: "verifiedAt", type: "uint256" },
        ],
      },
    ],
  },
  {
    name: "isApprovedForAll",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "account", type: "address" },
      { name: "operator", type: "address" },
    ],
    outputs: [{ type: "bool" }],
  },
  // ---- Write Functions ----
  {
    name: "mintVerifiedCredits",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "dacUnitId", type: "bytes32" },
      { name: "sourceDataHash", type: "bytes32" },
      { name: "captureTimestamp", type: "uint256" },
      { name: "co2AmountKg", type: "uint256" },
      { name: "energyConsumedKwh", type: "uint256" },
      { name: "latitude", type: "int256" },
      { name: "longitude", type: "int256" },
      { name: "purityPercentage", type: "uint8" },
      { name: "gridIntensityGCO2PerKwh", type: "uint256" },
      { name: "ipfsMetadataUri", type: "string" },
      { name: "arweaveBackupTxId", type: "string" },
    ],
    outputs: [{ name: "tokenId", type: "uint256" }],
  },
  {
    name: "retireCredits",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "tokenId", type: "uint256" },
      { name: "amount", type: "uint256" },
      { name: "reason", type: "string" },
    ],
    outputs: [],
  },
  {
    name: "setApprovalForAll",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "operator", type: "address" },
      { name: "approved", type: "bool" },
    ],
    outputs: [],
  },
  // ---- Events ----
  {
    name: "CreditMinted",
    type: "event",
    inputs: [
      { name: "tokenId", type: "uint256", indexed: true },
      { name: "dacUnitId", type: "bytes32", indexed: true },
      { name: "recipient", type: "address", indexed: true },
      { name: "creditsAmount", type: "uint256", indexed: false },
      { name: "sourceDataHash", type: "bytes32", indexed: false },
    ],
  },
  {
    name: "CreditRetired",
    type: "event",
    inputs: [
      { name: "tokenId", type: "uint256", indexed: true },
      { name: "retiree", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
      { name: "reason", type: "string", indexed: false },
    ],
  },
  {
    name: "TransferSingle",
    type: "event",
    inputs: [
      { name: "operator", type: "address", indexed: true },
      { name: "from", type: "address", indexed: true },
      { name: "to", type: "address", indexed: true },
      { name: "id", type: "uint256", indexed: false },
      { name: "value", type: "uint256", indexed: false },
    ],
  },
  {
    name: "VerificationCompleted",
    type: "event",
    inputs: [
      { name: "tokenId", type: "uint256", indexed: true },
      { name: "sourceVerified", type: "bool", indexed: false },
      { name: "logicVerified", type: "bool", indexed: false },
      { name: "mintVerified", type: "bool", indexed: false },
      { name: "efficiencyFactor", type: "uint256", indexed: false },
    ],
  },
] as const;

/**
 * CarbonMarketplace — Full ABI for SDK usage.
 */
export const CarbonMarketplaceABI = [
  // ---- View Functions ----
  {
    name: "platformFeeBps",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "feeRecipient",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
  {
    name: "paused",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "bool" }],
  },
  {
    name: "nextListingId",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "nextOfferId",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "owner",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
  {
    name: "carbonCredit",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
  {
    name: "getListing",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "listingId", type: "uint256" }],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "listingId", type: "uint256" },
          { name: "seller", type: "address" },
          { name: "tokenId", type: "uint256" },
          { name: "amount", type: "uint256" },
          { name: "pricePerUnit", type: "uint256" },
          { name: "minPurchaseAmount", type: "uint256" },
          { name: "isActive", type: "bool" },
          { name: "createdAt", type: "uint256" },
          { name: "expiresAt", type: "uint256" },
        ],
      },
    ],
  },
  {
    name: "getOffer",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "offerId", type: "uint256" }],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "offerId", type: "uint256" },
          { name: "buyer", type: "address" },
          { name: "tokenId", type: "uint256" },
          { name: "amount", type: "uint256" },
          { name: "pricePerUnit", type: "uint256" },
          { name: "depositAmount", type: "uint256" },
          { name: "isActive", type: "bool" },
          { name: "createdAt", type: "uint256" },
          { name: "expiresAt", type: "uint256" },
        ],
      },
    ],
  },
  {
    name: "calculateTotalPrice",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "pricePerUnit", type: "uint256" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [
      { name: "subtotal", type: "uint256" },
      { name: "fee", type: "uint256" },
      { name: "total", type: "uint256" },
    ],
  },
  {
    name: "getPaginatedListings",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "tokenId", type: "uint256" },
      { name: "offset", type: "uint256" },
      { name: "limit", type: "uint256" },
    ],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "ids", type: "uint256[]" },
          { name: "totalCount", type: "uint256" },
          { name: "offset", type: "uint256" },
          { name: "returnedCount", type: "uint256" },
          { name: "hasMore", type: "bool" },
        ],
      },
    ],
  },
  {
    name: "getPaginatedListingDetails",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "tokenId", type: "uint256" },
      { name: "offset", type: "uint256" },
      { name: "limit", type: "uint256" },
    ],
    outputs: [
      {
        name: "items",
        type: "tuple[]",
        components: [
          { name: "listingId", type: "uint256" },
          { name: "seller", type: "address" },
          { name: "tokenId", type: "uint256" },
          { name: "amount", type: "uint256" },
          { name: "pricePerUnit", type: "uint256" },
          { name: "minPurchaseAmount", type: "uint256" },
          { name: "isActive", type: "bool" },
          { name: "createdAt", type: "uint256" },
          { name: "expiresAt", type: "uint256" },
        ],
      },
      { name: "totalCount", type: "uint256" },
      { name: "hasMore", type: "bool" },
    ],
  },
  // ---- Write Functions ----
  {
    name: "createListing",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "tokenId", type: "uint256" },
      { name: "amount", type: "uint256" },
      { name: "pricePerUnit", type: "uint256" },
      { name: "minPurchaseAmount", type: "uint256" },
      { name: "duration", type: "uint256" },
    ],
    outputs: [{ name: "listingId", type: "uint256" }],
  },
  {
    name: "purchase",
    type: "function",
    stateMutability: "payable",
    inputs: [
      { name: "listingId", type: "uint256" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
  {
    name: "createOffer",
    type: "function",
    stateMutability: "payable",
    inputs: [
      { name: "tokenId", type: "uint256" },
      { name: "amount", type: "uint256" },
      { name: "pricePerUnit", type: "uint256" },
      { name: "duration", type: "uint256" },
    ],
    outputs: [{ name: "offerId", type: "uint256" }],
  },
  {
    name: "acceptOffer",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "offerId", type: "uint256" }],
    outputs: [],
  },
  {
    name: "cancelOffer",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "offerId", type: "uint256" }],
    outputs: [],
  },
  {
    name: "cancelListing",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "listingId", type: "uint256" }],
    outputs: [],
  },
  // ---- Events ----
  {
    name: "ListingCreated",
    type: "event",
    inputs: [
      { name: "listingId", type: "uint256", indexed: true },
      { name: "seller", type: "address", indexed: true },
      { name: "tokenId", type: "uint256", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
      { name: "pricePerUnit", type: "uint256", indexed: false },
    ],
  },
  {
    name: "Purchase",
    type: "event",
    inputs: [
      { name: "listingId", type: "uint256", indexed: true },
      { name: "buyer", type: "address", indexed: true },
      { name: "seller", type: "address", indexed: true },
      { name: "tokenId", type: "uint256", indexed: false },
      { name: "amount", type: "uint256", indexed: false },
      { name: "totalPrice", type: "uint256", indexed: false },
      { name: "platformFee", type: "uint256", indexed: false },
    ],
  },
  {
    name: "OfferCreated",
    type: "event",
    inputs: [
      { name: "offerId", type: "uint256", indexed: true },
      { name: "buyer", type: "address", indexed: true },
      { name: "tokenId", type: "uint256", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
      { name: "pricePerUnit", type: "uint256", indexed: false },
    ],
  },
  {
    name: "OfferAccepted",
    type: "event",
    inputs: [
      { name: "offerId", type: "uint256", indexed: true },
      { name: "seller", type: "address", indexed: true },
      { name: "buyer", type: "address", indexed: true },
      { name: "tokenId", type: "uint256", indexed: false },
      { name: "amount", type: "uint256", indexed: false },
      { name: "totalPrice", type: "uint256", indexed: false },
    ],
  },
  {
    name: "ListingCancelled",
    type: "event",
    inputs: [
      { name: "listingId", type: "uint256", indexed: true },
      { name: "seller", type: "address", indexed: true },
    ],
  },
  {
    name: "OfferCancelled",
    type: "event",
    inputs: [
      { name: "offerId", type: "uint256", indexed: true },
      { name: "buyer", type: "address", indexed: true },
    ],
  },
] as const;

/**
 * VerificationEngine — Full ABI for SDK usage.
 */
export const VerificationEngineABI = [
  // ---- View Functions ----
  {
    name: "isWhitelisted",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "dacUnitId", type: "bytes32" }],
    outputs: [{ type: "bool" }],
  },
  {
    name: "getOperator",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "dacUnitId", type: "bytes32" }],
    outputs: [{ type: "address" }],
  },
  {
    name: "owner",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
  {
    name: "carbonCreditContract",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
  {
    name: "getVerificationThresholds",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "minKwh", type: "uint256" },
      { name: "maxKwh", type: "uint256" },
      { name: "optimalKwh", type: "uint256" },
      { name: "minPurity", type: "uint8" },
    ],
  },
  {
    name: "isHashProcessed",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "sourceDataHash", type: "bytes32" }],
    outputs: [{ type: "bool" }],
  },
  // ---- Pure Functions ----
  {
    name: "previewNetNegativeCredits",
    type: "function",
    stateMutability: "pure",
    inputs: [
      { name: "co2AmountKg", type: "uint256" },
      { name: "energyConsumedKwh", type: "uint256" },
      { name: "purityPercentage", type: "uint8" },
      { name: "gridIntensityGCO2PerKwh", type: "uint256" },
    ],
    outputs: [
      { name: "isValid", type: "bool" },
      { name: "netCreditsKg", type: "uint256" },
      { name: "efficiencyFactor", type: "uint256" },
      { name: "grossCreditsScaled", type: "uint256" },
      { name: "energyDebtScaled", type: "uint256" },
    ],
  },
  {
    name: "previewEfficiencyFactor",
    type: "function",
    stateMutability: "pure",
    inputs: [
      { name: "co2AmountKg", type: "uint256" },
      { name: "energyConsumedKwh", type: "uint256" },
      { name: "purityPercentage", type: "uint8" },
    ],
    outputs: [
      { name: "isValid", type: "bool" },
      { name: "efficiencyFactor", type: "uint256" },
    ],
  },
  // ---- Write Functions ----
  {
    name: "verify",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "dacUnitId", type: "bytes32" },
      { name: "sourceDataHash", type: "bytes32" },
      { name: "co2AmountKg", type: "uint256" },
      { name: "energyConsumedKwh", type: "uint256" },
      { name: "purityPercentage", type: "uint8" },
      { name: "gridIntensityGCO2PerKwh", type: "uint256" },
    ],
    outputs: [
      { name: "sourceVerified", type: "bool" },
      { name: "logicVerified", type: "bool" },
      { name: "mintVerified", type: "bool" },
      { name: "efficiencyFactor", type: "uint256" },
    ],
  },
  {
    name: "whitelistDacUnit",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "dacUnitId", type: "bytes32" },
      { name: "operator", type: "address" },
    ],
    outputs: [],
  },
  {
    name: "removeDacUnit",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "dacUnitId", type: "bytes32" }],
    outputs: [],
  },
  // ---- Events ----
  {
    name: "DacUnitWhitelisted",
    type: "event",
    inputs: [
      { name: "dacUnitId", type: "bytes32", indexed: true },
      { name: "operator", type: "address", indexed: true },
      { name: "timestamp", type: "uint256", indexed: false },
    ],
  },
  {
    name: "DacUnitRemoved",
    type: "event",
    inputs: [
      { name: "dacUnitId", type: "bytes32", indexed: true },
      { name: "timestamp", type: "uint256", indexed: false },
    ],
  },
  {
    name: "VerificationPhaseCompleted",
    type: "event",
    inputs: [
      { name: "dacUnitId", type: "bytes32", indexed: true },
      { name: "sourceDataHash", type: "bytes32", indexed: true },
      { name: "phase", type: "string", indexed: false },
      { name: "passed", type: "bool", indexed: false },
      { name: "reason", type: "string", indexed: false },
    ],
  },
] as const;

/**
 * CircuitBreaker — Full ABI.
 */
export const CircuitBreakerABI = [
  {
    name: "isOperationAllowed",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "contractAddr", type: "address" }],
    outputs: [{ type: "bool" }],
  },
  {
    name: "globalPause",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "bool" }],
  },
  {
    name: "globalSecurityLevel",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint8" }],
  },
  {
    name: "getStatus",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "isGloballyPaused", type: "bool" },
      { name: "currentLevel", type: "uint8" },
      { name: "monitoredCount", type: "uint256" },
    ],
  },
  {
    name: "GlobalPauseActivated",
    type: "event",
    inputs: [
      { name: "by", type: "address", indexed: true },
      { name: "reason", type: "string", indexed: false },
    ],
  },
  {
    name: "GlobalPauseDeactivated",
    type: "event",
    inputs: [{ name: "by", type: "address", indexed: true }],
  },
] as const;

/**
 * AccessControl — Full ABI.
 */
export const AccessControlABI = [
  {
    name: "hasRole",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "role", type: "bytes32" },
      { name: "account", type: "address" },
    ],
    outputs: [{ type: "bool" }],
  },
  {
    name: "getRoleAdmin",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "role", type: "bytes32" }],
    outputs: [{ type: "bytes32" }],
  },
  {
    name: "isKycVerified",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "bool" }],
  },
  {
    name: "paused",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "bool" }],
  },
] as const;
