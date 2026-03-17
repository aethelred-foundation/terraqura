/**
 * TerraQura Contract ABIs
 *
 * Minimal ABIs for frontend contract interactions
 * Updated to match actual deployed contracts (Solidity 0.8.32)
 *
 * Using JSON ABI format for proper wagmi/viem compatibility
 */

// ============================================
// CarbonCredit Contract ABI
// ============================================

export const CarbonCreditABI = [
  // View functions
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
  // Events
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
] as const;

// ============================================
// CarbonMarketplace Contract ABI
// ============================================

export const CarbonMarketplaceABI = [
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
          { name: "seller", type: "address" },
          { name: "tokenId", type: "uint256" },
          { name: "amount", type: "uint256" },
          { name: "pricePerUnit", type: "uint256" },
          { name: "isActive", type: "bool" },
          { name: "createdAt", type: "uint256" },
        ],
      },
    ],
  },
  // Events
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
] as const;

// ============================================
// VerificationEngine Contract ABI
// ============================================

export const VerificationEngineABI = [
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
] as const;

// ============================================
// CircuitBreaker Contract ABI
// ============================================

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
    name: "owner",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
  {
    name: "isPauser",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "bool" }],
  },
  // Events
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

// ============================================
// AccessControl Contract ABI
// ============================================

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
  {
    name: "owner",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
  // Events
  {
    name: "RoleGranted",
    type: "event",
    inputs: [
      { name: "role", type: "bytes32", indexed: true },
      { name: "account", type: "address", indexed: true },
      { name: "sender", type: "address", indexed: true },
    ],
  },
  {
    name: "RoleRevoked",
    type: "event",
    inputs: [
      { name: "role", type: "bytes32", indexed: true },
      { name: "account", type: "address", indexed: true },
      { name: "sender", type: "address", indexed: true },
    ],
  },
] as const;

// ============================================
// Multisig Contract ABI
// ============================================

export const MultisigABI = [
  {
    name: "getSigners",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address[]" }],
  },
  {
    name: "getSignerCount",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "threshold",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "nonce",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "isSigner",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "bool" }],
  },
  // Events
  {
    name: "TransactionSubmitted",
    type: "event",
    inputs: [
      { name: "txId", type: "uint256", indexed: true },
      { name: "submitter", type: "address", indexed: true },
      { name: "to", type: "address", indexed: false },
      { name: "value", type: "uint256", indexed: false },
      { name: "data", type: "bytes", indexed: false },
    ],
  },
  {
    name: "TransactionExecuted",
    type: "event",
    inputs: [
      { name: "txId", type: "uint256", indexed: true },
      { name: "executor", type: "address", indexed: true },
    ],
  },
] as const;

// ============================================
// Timelock Contract ABI
// ============================================

export const TimelockABI = [
  {
    name: "getMinDelay",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "isOperation",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "id", type: "bytes32" }],
    outputs: [{ type: "bool" }],
  },
  {
    name: "isOperationPending",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "id", type: "bytes32" }],
    outputs: [{ type: "bool" }],
  },
  {
    name: "isOperationReady",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "id", type: "bytes32" }],
    outputs: [{ type: "bool" }],
  },
  {
    name: "isOperationDone",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "id", type: "bytes32" }],
    outputs: [{ type: "bool" }],
  },
  {
    name: "getTimestamp",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "id", type: "bytes32" }],
    outputs: [{ type: "uint256" }],
  },
  // Events
  {
    name: "CallScheduled",
    type: "event",
    inputs: [
      { name: "id", type: "bytes32", indexed: true },
      { name: "index", type: "uint256", indexed: true },
      { name: "target", type: "address", indexed: false },
      { name: "value", type: "uint256", indexed: false },
      { name: "data", type: "bytes", indexed: false },
      { name: "predecessor", type: "bytes32", indexed: false },
      { name: "delay", type: "uint256", indexed: false },
    ],
  },
  {
    name: "CallExecuted",
    type: "event",
    inputs: [
      { name: "id", type: "bytes32", indexed: true },
      { name: "index", type: "uint256", indexed: true },
      { name: "target", type: "address", indexed: false },
      { name: "value", type: "uint256", indexed: false },
      { name: "data", type: "bytes", indexed: false },
    ],
  },
] as const;

// ============================================
// Role Constants (keccak256 hashes)
// ============================================

// ============================================
// NativeIoTOracle Contract ABI
// 1st-Party sovereign oracle for Aethelred deployment
// ============================================

export const NativeIoTOracleABI = [
  // View: Get latest sensor data for a device
  {
    name: "getLatestData",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "dacId", type: "string" }],
    outputs: [
      {
        name: "data",
        type: "tuple",
        components: [
          { name: "co2Captured", type: "uint256" },
          { name: "energyUsed", type: "uint256" },
          { name: "timestamp", type: "uint256" },
          { name: "anomalyFlag", type: "bool" },
          { name: "satelliteCID", type: "string" },
        ],
      },
    ],
  },
  // View: Check data freshness
  {
    name: "isDataFresh",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "dacId", type: "string" }],
    outputs: [
      { name: "isFresh", type: "bool" },
      { name: "lastTimestamp", type: "uint256" },
      { name: "age", type: "uint256" },
    ],
  },
  // View: Get historical data with pagination
  {
    name: "getDataHistory",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "dacId", type: "string" },
      { name: "offset", type: "uint256" },
      { name: "limit", type: "uint256" },
    ],
    outputs: [
      {
        name: "entries",
        type: "tuple[]",
        components: [
          { name: "co2Captured", type: "uint256" },
          { name: "energyUsed", type: "uint256" },
          { name: "timestamp", type: "uint256" },
          { name: "anomalyFlag", type: "bool" },
          { name: "satelliteCID", type: "string" },
        ],
      },
      { name: "total", type: "uint256" },
    ],
  },
  // View: Get all registered devices
  {
    name: "getRegisteredDevices",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "devices", type: "string[]" }],
  },
  // View: Get device count
  {
    name: "getDeviceCount",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "count", type: "uint256" }],
  },
  // View: Get history count for a device
  {
    name: "getHistoryCount",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "dacId", type: "string" }],
    outputs: [{ name: "count", type: "uint256" }],
  },
  // View: Get total submissions
  {
    name: "totalSubmissions",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  // View: Get heartbeat timeout
  {
    name: "heartbeatTimeout",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  // View: Get anomaly count for a device
  {
    name: "anomalyCount",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "", type: "string" }],
    outputs: [{ type: "uint256" }],
  },
  // View: Check if device is suspended
  {
    name: "suspendedDevices",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "", type: "string" }],
    outputs: [{ type: "bool" }],
  },
  // View: Version
  {
    name: "VERSION",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "string" }],
  },
  // Events
  {
    name: "IoTDataLogged",
    type: "event",
    inputs: [
      { name: "dacId", type: "string", indexed: true },
      { name: "co2Captured", type: "uint256", indexed: false },
      { name: "energyUsed", type: "uint256", indexed: false },
      { name: "satelliteCID", type: "string", indexed: false },
      { name: "timestamp", type: "uint256", indexed: false },
      { name: "oracleNode", type: "address", indexed: true },
    ],
  },
  {
    name: "AnomalyDetected",
    type: "event",
    inputs: [
      { name: "dacId", type: "string", indexed: true },
      { name: "co2Captured", type: "uint256", indexed: false },
      { name: "energyUsed", type: "uint256", indexed: false },
      { name: "timestamp", type: "uint256", indexed: false },
      { name: "consecutiveAnomalies", type: "uint256", indexed: false },
    ],
  },
  {
    name: "DeviceSuspended",
    type: "event",
    inputs: [
      { name: "dacId", type: "string", indexed: true },
      { name: "anomalyCount", type: "uint256", indexed: false },
      { name: "timestamp", type: "uint256", indexed: false },
    ],
  },
  {
    name: "BatchDataLogged",
    type: "event",
    inputs: [
      { name: "deviceCount", type: "uint256", indexed: false },
      { name: "timestamp", type: "uint256", indexed: false },
      { name: "oracleNode", type: "address", indexed: true },
    ],
  },
] as const;

export const ROLES = {
  DEFAULT_ADMIN: "0x0000000000000000000000000000000000000000000000000000000000000000" as const,
  ADMIN: "0xa49807205ce4d355092ef5a8a18f56e8913cf4a201fbe287825b095693c21775" as const,
  OPERATOR: "0x97667070c54ef182b0f5858b034beac1b6f3089aa2d3188bb1e8929f4fa9b929" as const,
  VERIFIER: "0x0ce23c3e399818cfee81a7ab0880f714e53d7672b08df0fa62f2a3b3c24ea89a" as const,
  MINTER: "0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6" as const,
  COMPLIANCE: "0x9f95a5498d7e03a7c2c9e8a1ee9fdf21e54a6e31c0a2d1c0b8e9c0d9f8a7b6c5" as const,
  AUDITOR: "0x8e8c9a8d7b6a5c4f3e2d1c0b9a8f7e6d5c4b3a2918f7e6d5c4b3a2918f7e6d5c4" as const,
  TREASURY: "0x3496e2e73c4d42b75d702e60d9e48102720b8691234415f8349e50e3e419d9d5" as const,
  UPGRADER: "0x189ab7a9244df0848122154315af71fe140f3db0fe014031783b0946b8c9d2e3" as const,
  PAUSER: "0x65d7a28e3265b37a6474929f336521b332c1681b933f6cb9f3376673440d862a" as const,
} as const;
