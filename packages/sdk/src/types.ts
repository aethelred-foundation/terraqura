/**
 * @terraqura/sdk — Types & Zod Schemas
 *
 * SDK-specific types, Zod validation schemas, and re-exports
 * from @terraqura/types. All public method inputs are derived
 * from Zod schemas via z.infer<>.
 */

import { z } from "zod";

import type { NetworkName } from "./constants.js";
import type { IIdempotencyBackend } from "./utils.js";
import type { Tracer, Meter } from "@opentelemetry/api";
import type { ethers } from "ethers";

// ============================================
// Re-export all shared domain types
// ============================================

export type {
  CarbonCredit,
  CreditMetadata,
  CreditTransfer,
  ProvenanceEvent,
  DACUnit,
} from "@terraqura/types";

export {
  CreditStatus,
  DACStatus,
} from "@terraqura/types";

export type {
  Listing,
  Offer,
  Purchase,
  MarketStats,
  PricePoint,
  MarketplaceConfig,
  UserMarketActivity,
} from "@terraqura/types";

export {
  ListingStatus,
  OfferStatus,
} from "@terraqura/types";

export type {
  VerificationResult,
  VerificationRequest,
  VerificationEvent,
} from "@terraqura/types";

export {
  VerificationPhase,
  VerificationStatus,
  VERIFICATION_CONSTANTS,
} from "@terraqura/types";

// ============================================
// SDK Configuration Types
// ============================================

/** Gas management configuration */
export interface GasConfig {
  /** Gas estimate multiplier (default: 1.2) */
  multiplier?: number;
  /** Maximum gas price in wei */
  maxGasPrice?: bigint;
  /** Maximum priority fee per gas in wei (Aethelred default: 30 gwei) */
  maxPriorityFee?: bigint;
  /** Gas price cache TTL in ms (default: 15000) */
  cacheTtlMs?: number;
  /** Per-operation gas limit overrides */
  gasLimits?: Record<string, bigint>;
}

/** Retry / resilience configuration */
export interface RetryConfig {
  /** Maximum number of retries (default: 3) */
  maxRetries?: number;
  /** Base delay between retries in ms (default: 1000) */
  baseDelayMs?: number;
  /** Maximum delay between retries in ms (default: 30000) */
  maxDelayMs?: number;
  /** Error codes that should trigger a retry */
  retryableErrors?: string[];
}

/** OpenTelemetry configuration */
export interface TelemetryConfig {
  /** Enable/disable telemetry (default: true) */
  enabled?: boolean;
  /** Custom tracer instance */
  tracer?: Tracer;
  /** Custom meter instance */
  meter?: Meter;
  /** Service name for telemetry (default: "terraqura-sdk") */
  serviceName?: string;
}

/** Main SDK client configuration */
export interface TerraQuraClientConfig {
  /** Target network */
  network: NetworkName;
  /** Private key for signing transactions (creates ethers.Wallet) */
  privateKey?: string;
  /** External signer (e.g., KMS signer, hardware wallet) */
  signer?: ethers.Signer;
  /** Custom RPC URL (overrides default network URLs) */
  rpcUrl?: string;
  /** Custom subgraph URL */
  subgraphUrl?: string;
  /** Gas management settings */
  gas?: GasConfig;
  /** Retry / resilience settings */
  retry?: RetryConfig;
  /** OpenTelemetry settings */
  telemetry?: TelemetryConfig;
  /**
   * External idempotency backend for serverless environments.
   *
   * By default, the SDK uses an in-memory store which is lost
   * when the process exits (problematic for AWS Lambda, Cloud Functions).
   *
   * Provide a Redis, DynamoDB, or Upstash backend implementation
   * of `IIdempotencyBackend` to persist idempotency keys across
   * serverless cold starts.
   *
   * @example
   * ```ts
   * const client = new TerraQuraClient({
   *   network: "aethelred",
   *   privateKey: "0x...",
   *   idempotencyBackend: new RedisIdempotencyBackend(redis),
   * });
   * ```
   */
  idempotencyBackend?: IIdempotencyBackend;
  /**
   * Idempotency key TTL in milliseconds (default: 15 minutes).
   * After this period, a duplicate request with the same parameters
   * will be allowed through.
   */
  idempotencyTtlMs?: number;
}

// ============================================
// Zod Validation Schemas
// ============================================

/** Ethereum address validation */
const EthAddressSchema = z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address");

/** Bytes32 hex string validation */
const Bytes32Schema = z.string().regex(/^0x[a-fA-F0-9]{64}$/, "Invalid bytes32 hex string");

/** Positive bigint (as string for serialization) */
const PositiveBigIntSchema = z.union([
  z.bigint().positive(),
  z.string().regex(/^\d+$/).transform(BigInt),
  z.number().int().positive().transform(BigInt),
]);

/** Client config validation */
export const TerraQuraClientConfigSchema = z.object({
  network: z.enum(["aethelred-testnet", "aethelred"]),
  privateKey: z.string().regex(/^0x[a-fA-F0-9]{64}$/).optional(),
  signer: z.any().optional(),
  rpcUrl: z.string().url().optional(),
  subgraphUrl: z.string().url().optional(),
  gas: z
    .object({
      multiplier: z.number().positive().max(5).optional(),
      maxGasPrice: z.bigint().positive().optional(),
      maxPriorityFee: z.bigint().positive().optional(),
      cacheTtlMs: z.number().int().positive().optional(),
      gasLimits: z.record(z.bigint().positive()).optional(),
    })
    .optional(),
  retry: z
    .object({
      maxRetries: z.number().int().min(0).max(10).optional(),
      baseDelayMs: z.number().int().positive().optional(),
      maxDelayMs: z.number().int().positive().optional(),
      retryableErrors: z.array(z.string()).optional(),
    })
    .optional(),
  telemetry: z
    .object({
      enabled: z.boolean().optional(),
      tracer: z.any().optional(),
      meter: z.any().optional(),
      serviceName: z.string().optional(),
    })
    .optional(),
  idempotencyBackend: z.any().optional(),
  idempotencyTtlMs: z.number().int().positive().optional(),
});

/** Pagination parameters */
export const PaginationSchema = z.object({
  offset: z.number().int().min(0).default(0),
  limit: z.number().int().min(1).max(100).default(20),
});
export type PaginationInput = z.infer<typeof PaginationSchema>;

/** Create marketplace listing */
export const CreateListingSchema = z.object({
  tokenId: PositiveBigIntSchema,
  amount: PositiveBigIntSchema,
  pricePerUnit: PositiveBigIntSchema,
  minPurchaseAmount: PositiveBigIntSchema.optional().default(BigInt(1)),
  /** Duration in seconds (default: 30 days) */
  duration: z.number().int().positive().default(30 * 24 * 60 * 60),
});
export type CreateListingInput = z.infer<typeof CreateListingSchema>;

/** Create marketplace offer */
export const CreateOfferSchema = z.object({
  tokenId: PositiveBigIntSchema,
  amount: PositiveBigIntSchema,
  pricePerUnit: PositiveBigIntSchema,
  /** Duration in seconds (default: 7 days) */
  duration: z.number().int().positive().default(7 * 24 * 60 * 60),
});
export type CreateOfferInput = z.infer<typeof CreateOfferSchema>;

/** One-click carbon offset */
export const OffsetFootprintSchema = z.object({
  /** Amount of CO2 to offset in kilograms */
  amountKg: z.number().positive().min(1),
  /** Reason for retirement (stored on-chain) */
  reason: z.string().min(1).max(500),
  /** Whether to generate an SVG certificate */
  generateCertificate: z.boolean().default(true),
});
export type OffsetFootprintInput = z.infer<typeof OffsetFootprintSchema>;

/** MRV capture data submission */
export const CaptureSubmissionSchema = z.object({
  /** Recipient address for minted credits */
  recipient: EthAddressSchema,
  /** DAC unit identifier (bytes32 hex or human-readable name) */
  dacUnitId: z.string().min(1),
  /** Source data hash (bytes32 hex) */
  sourceDataHash: Bytes32Schema,
  /** Capture timestamp (unix seconds) */
  captureTimestamp: z.number().int().positive(),
  /** CO2 captured in kilograms */
  co2AmountKg: z.number().int().positive(),
  /** Energy consumed in kWh */
  energyConsumedKwh: z.number().int().positive(),
  /** GPS latitude (scaled by 1e6, e.g., 24500000 for 24.5) */
  latitude: z.number().int(),
  /** GPS longitude (scaled by 1e6) */
  longitude: z.number().int(),
  /** CO2 purity percentage (0-100) */
  purityPercentage: z.number().int().min(0).max(100),
  /** Grid carbon intensity in gCO2/kWh */
  gridIntensityGCO2PerKwh: z.number().int().min(0),
  /** IPFS metadata URI */
  ipfsMetadataUri: z.string().default(""),
  /** Arweave backup transaction ID */
  arweaveBackupTxId: z.string().default(""),
});
export type CaptureSubmissionInput = z.infer<typeof CaptureSubmissionSchema>;

// ============================================
// Response Types
// ============================================

/** Generic transaction result wrapper */
export interface TransactionResult<T = void> {
  /** Transaction hash */
  txHash: string;
  /** Block number where the transaction was confirmed */
  blockNumber: number;
  /** Gas used by the transaction */
  gasUsed: bigint;
  /** Parsed data from the transaction */
  data: T;
  /** Full ethers TransactionReceipt */
  receipt: ethers.TransactionReceipt;
}

/** Generic paginated result */
export interface PaginatedResult<T> {
  /** Result items */
  items: T[];
  /** Total count of matching items */
  total: number;
  /** Current offset */
  offset: number;
  /** Page size */
  limit: number;
  /** Whether more results exist */
  hasMore: boolean;
}

/** Price breakdown for marketplace operations */
export interface PriceBreakdown {
  /** Base price (pricePerUnit * amount) in wei */
  subtotal: bigint;
  /** Platform fee in wei */
  platformFee: bigint;
  /** Total price (subtotal + fee) in wei */
  total: bigint;
  /** Platform fee in basis points */
  feeBps: number;
}

// ============================================
// Domain-Specific Types
// ============================================

/** On-chain verification result (from contract tuple) */
export interface OnChainVerification {
  sourceVerified: boolean;
  logicVerified: boolean;
  mintVerified: boolean;
  efficiencyFactor: bigint;
  verifiedAt: number;
}

/** Net-Negative credit calculation breakdown */
export interface NetNegativeBreakdown {
  /** Gross credits before energy deduction (kg CO2) */
  grossCreditsKg: number;
  /** Energy debt — CO2 emitted by energy use (kg CO2) */
  energyDebtKg: number;
  /** Net credits after deduction (kg CO2) */
  netCreditsKg: number;
  /** Raw CO2 captured (kg) */
  co2AmountKg: number;
  /** Energy consumed (kWh) */
  energyConsumedKwh: number;
  /** CO2 purity percentage */
  purityPercentage: number;
  /** Grid carbon intensity (gCO2/kWh) */
  gridIntensityGCO2PerKwh: number;
}

/** Full on-chain credit metadata (from getCreditProvenance) */
export interface OnChainMetadata {
  dacUnitId: string;
  sourceDataHash: string;
  captureTimestamp: number;
  co2AmountKg: number;
  energyConsumedKwh: number;
  latitude: number;
  longitude: number;
  purityPercentage: number;
  gridIntensityGCO2PerKwh: number;
  isRetired: boolean;
  ipfsMetadataUri: string;
  arweaveBackupTxId: string;
}

/**
 * Provenance — The Trust Object.
 * Complete provenance chain for a carbon credit,
 * combining on-chain data with indexed history.
 */
export interface Provenance {
  /** ERC-1155 token ID */
  tokenId: string;
  /** Full on-chain metadata */
  metadata: OnChainMetadata;
  /** Three-phase verification result */
  verification: OnChainVerification;
  /** GPS coordinates (decimal degrees) */
  gps: { lat: number; lng: number };
  /** Efficiency factor (SCALE = 10000) */
  efficiencyFactor: number;
  /** Grid carbon intensity (gCO2/kWh) */
  gridIntensity: number;
  /** Net-Negative calculation breakdown */
  netNegativeBreakdown: NetNegativeBreakdown;
  /** DAC unit information */
  dacUnit: DACUnitInfo;
  /** Transfer history from subgraph */
  transferHistory: TransferRecord[];
}

/** DAC unit summary */
export interface DACUnitInfo {
  /** DAC unit identifier (bytes32) */
  dacUnitId: string;
  /** Operator address */
  operator: string;
  /** Whether the unit is currently whitelisted */
  isWhitelisted: boolean;
}

/** Transfer record from subgraph */
export interface TransferRecord {
  from: string;
  to: string;
  amount: bigint;
  txHash: string;
  blockNumber: number;
  timestamp: number;
}

/** Carbon credit summary for listing */
export interface CreditSummary {
  tokenId: string;
  co2AmountKg: number;
  balance: bigint;
  isRetired: boolean;
  mintedAt: number;
}

/** Marketplace listing summary */
export interface ListingSummary {
  listingId: bigint;
  tokenId: bigint;
  amount: bigint;
  pricePerUnit: bigint;
  seller: string;
}

/** Retirement record from subgraph */
export interface RetirementRecord {
  tokenId: string;
  amount: bigint;
  reason: string;
  retiree: string;
  txHash: string;
  blockNumber: number;
  timestamp: number;
}

/** One-click offset result */
export interface OffsetResult {
  /** Token IDs of purchased/retired credits */
  tokenIds: string[];
  /** Total amount retired (kg CO2) */
  amountRetiredKg: number;
  /** Transaction hashes */
  txHashes: string[];
  /** SVG certificate (if generateCertificate was true) */
  certificate?: string;
  /** Retirement reason */
  retirementReason: string;
  /** Cost breakdown */
  cost: PriceBreakdown;
}

/** One-click offset cost estimate */
export interface OffsetEstimate {
  /** Amount to offset (kg CO2) */
  amountKg: number;
  /** Estimated total cost */
  estimatedCost: PriceBreakdown;
  /** Best listings that would be used */
  bestListings: ListingSummary[];
  /** Whether sufficient supply exists */
  sufficientSupply: boolean;
}

/** MRV verification preview result */
export interface VerificationPreview {
  /** Whether the data would pass all verification phases */
  isValid: boolean;
  /** Net credits after Net-Negative deduction (kg) */
  netCreditsKg: number;
  /** Legacy efficiency factor (SCALE=10000) */
  efficiencyFactor: number;
  /** Gross credits before energy deduction (scaled by 1e18) */
  grossCreditsScaled: bigint;
  /** Energy debt (scaled by 1e18) */
  energyDebtScaled: bigint;
}

/** Certificate data for SVG generation */
export interface CertificateData {
  /** Certificate unique identifier */
  certificateId: string;
  /** Token ID of the retired credit */
  tokenId: string;
  /** Amount of CO2 retired (kg) */
  co2AmountKg: number;
  /** Date of retirement */
  retirementDate: Date;
  /** Address that retired the credits */
  retiredBy: string;
  /** Retirement reason */
  reason: string;
  /** DAC unit name/ID */
  dacUnitName: string;
  /** Verification status description */
  verificationStatus: string;
  /** Efficiency factor (human-readable percentage) */
  efficiencyFactor: number;
  /** GPS coordinates */
  gps: { lat: number; lng: number };
  /** Transaction hash */
  txHash: string;
  /** Grid carbon intensity */
  gridIntensity: number;
  /** Network name */
  network: NetworkName;
}

/** Gas estimation result */
export interface GasEstimate {
  /** Estimated gas limit */
  gasLimit: bigint;
  /** Max fee per gas (EIP-1559) */
  maxFeePerGas: bigint;
  /** Max priority fee per gas (EIP-1559) */
  maxPriorityFeePerGas: bigint;
  /** Estimated cost in wei */
  estimatedCostWei: bigint;
  /** Estimated cost in AETH (human-readable) */
  estimatedCostAeth: string;
}

/** Gas price info with caching metadata */
export interface GasPriceInfo {
  maxFeePerGas: bigint;
  maxPriorityFeePerGas: bigint;
  baseFee: bigint;
  fetchedAt: number;
}

// ============================================
// Internal Types (not exported from index.ts)
// ============================================

/** Internal SDK config passed to modules after validation */
export interface InternalConfig {
  network: NetworkName;
  provider: ethers.Provider;
  signer: ethers.Signer | null;
  addresses: {
    accessControl: string;
    verificationEngine: string;
    carbonCredit: string;
    carbonMarketplace: string;
    gaslessMarketplace: string;
    circuitBreaker: string;
  };
  subgraphUrl: string;
  gas: Required<GasConfig>;
  retry: Required<RetryConfig>;
  telemetryEnabled: boolean;
}

/** Webhook event types */
export type SDKEvent =
  | "CreditMinted"
  | "CreditRetired"
  | "ListingCreated"
  | "Purchase"
  | "OfferCreated"
  | "OfferAccepted"
  | "GlobalPauseActivated"
  | "GlobalPauseDeactivated";

/** Webhook event payload */
export interface SDKEventPayload {
  event: SDKEvent;
  data: Record<string, unknown>;
  txHash: string;
  blockNumber: number;
  timestamp: number;
}

/** Webhook endpoint options */
export interface WebhookOptions {
  /** HMAC secret for signature verification */
  secret?: string;
  /** Max retries for failed deliveries (default: 3) */
  retries?: number;
  /** Request timeout in ms (default: 10000) */
  timeoutMs?: number;
}
