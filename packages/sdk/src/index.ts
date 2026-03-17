/**
 * @terraqura/sdk
 *
 * Enterprise-grade TypeScript SDK for the TerraQura carbon credit platform.
 * "Stripe for Carbon" — clean, modular, production-ready.
 *
 * Core Modules:
 * - `client.assets`     — Provenance, balances, metadata, verification
 * - `client.market`     — Listings, offers, purchases, batch operations
 * - `client.offset`     — One-click carbon offset with certificate generation
 * - `client.mrv`        — DAC operator MRV pipeline + verification
 *
 * Enterprise Modules:
 * - `client.connect`    — Platform-as-a-Service: sub-accounts, fee splitting
 * - `client.checkout`   — Hosted checkout sessions (Stripe Checkout for carbon)
 * - `client.badge`      — Carbon Integrity Badge with live proof-of-physics
 * - `client.compliance` — Article 6 sovereign API, provenance proofs, audit trails
 *
 * Insurance Pillar:
 * - `client.risk`       — Actuarial risk scoring, on-chain Risk Oracle
 * - `client.insurance`  — Buffer pool, policies, treasury, premium engine
 * - `client.claims`     — Automated reversal detection and restitution
 *
 * Sovereign Pillar:
 * - `client.sovereign`  — National inventory, strategic reserve, CBAM, carbon repo
 *
 * @example
 * ```ts
 * import { TerraQuraClient } from "@terraqura/sdk";
 *
 * // Read-only mode
 * const client = new TerraQuraClient({ network: "aethelred-testnet" });
 * const provenance = await client.assets.getProvenance("42");
 *
 * // Read-write mode
 * const client = new TerraQuraClient({ network: "aethelred-testnet", privateKey: "0x..." });
 * const result = await client.offset.offsetFootprint(1000, "Carbon neutral Q1");
 *
 * // Enterprise: hosted checkout
 * const session = await client.checkout.createSession({
 *   amountKg: 50, reason: "Carbon neutral shipping",
 * });
 *
 * // Enterprise: compliance proof
 * const proof = await client.compliance.getProvenanceProof("42");
 * ```
 *
 * @packageDocumentation
 */

// ============================================
// Main Client
// ============================================

export { TerraQuraClient } from "./client.js";

// ============================================
// Domain Modules (for advanced usage / testing)
// ============================================

export { AssetsModule } from "./modules/assets.js";
export { MarketModule } from "./modules/market.js";
export { OffsetModule } from "./modules/offset.js";
export { MRVModule } from "./modules/mrv.js";

// ============================================
// Enterprise Modules (Connect / Checkout / Badge / Compliance)
// ============================================

export { ConnectModule } from "./modules/connect.js";
export { CheckoutModule } from "./modules/checkout.js";
export { BadgeModule } from "./modules/badge.js";
export { ComplianceModule } from "./modules/compliance.js";

// ============================================
// Insurance Pillar (Risk / Insurance / Claims)
// ============================================

export { RiskModule } from "./modules/risk.js";
export { InsuranceModule } from "./modules/insurance.js";
export { ClaimsModule } from "./modules/claims.js";

// ============================================
// Sovereign Pillar (National Intelligence)
// ============================================

export { SovereignModule } from "./modules/sovereign.js";

// ============================================
// Types
// ============================================

export type {
  // SDK config
  TerraQuraClientConfig,
  GasConfig,
  RetryConfig,
  TelemetryConfig,
  // Response types
  TransactionResult,
  PaginatedResult,
  PriceBreakdown,
  // Domain types
  Provenance,
  OnChainVerification,
  OnChainMetadata,
  NetNegativeBreakdown,
  DACUnitInfo,
  TransferRecord,
  CreditSummary,
  ListingSummary,
  RetirementRecord,
  OffsetResult,
  OffsetEstimate,
  VerificationPreview,
  CertificateData,
  GasEstimate,
  GasPriceInfo,
  // Internal (for advanced users)
  InternalConfig,
  SDKEvent,
  SDKEventPayload,
  WebhookOptions,
  // Input types
  PaginationInput,
  CreateListingInput,
  CreateOfferInput,
  OffsetFootprintInput,
  CaptureSubmissionInput,
} from "./types.js";

// Re-export shared domain types from @terraqura/types
export {
  CreditStatus,
  DACStatus,
  ListingStatus,
  OfferStatus,
  VerificationPhase,
  VerificationStatus,
  VERIFICATION_CONSTANTS,
} from "./types.js";

export type {
  CarbonCredit,
  CreditMetadata,
  CreditTransfer,
  ProvenanceEvent,
  DACUnit,
  Listing,
  Offer,
  Purchase,
  MarketStats,
  PricePoint,
  MarketplaceConfig,
  UserMarketActivity,
  VerificationResult,
  VerificationRequest,
  VerificationEvent,
} from "./types.js";

// ============================================
// Connect Module Types
// ============================================

export type {
  RegisterPartnerInput,
  Partner,
  CreateSubAccountInput,
  SubAccount,
  RetireOnBehalfInput,
  RetireOnBehalfResult,
  FeeSplitBreakdown,
  SubAccountLedger,
  PartnerAnalytics,
} from "./modules/connect.js";

// ============================================
// Checkout Module Types
// ============================================

export type {
  CheckoutSessionStatus,
  CreateCheckoutSessionInput,
  CheckoutSession,
  CheckoutSessionResult,
  CheckoutSessionFilter,
} from "./modules/checkout.js";

// ============================================
// Badge Module Types
// ============================================

export type {
  BadgeVariant,
  BadgeTheme,
  GenerateBadgeInput,
  Badge,
  BadgeData,
  EmbedSnippetInput,
  LiveBadgeStatus,
} from "./modules/badge.js";

// ============================================
// Compliance Module Types
// ============================================

export type {
  CountryCode,
  ProvenanceProof,
  SovereignReportInput,
  SovereignReport,
  ITMOEntry,
  AuditExportFormat,
  AuditTrailInput,
  AuditEntry,
  AuditTrailExport,
} from "./modules/compliance.js";

// ============================================
// Risk Module Types
// ============================================

export type {
  RiskTier,
  HealthScoreInput,
  HealthScoreResult,
  OnChainRiskProfile,
  InsurancePremium,
  FleetRiskAnalytics,
  UpdateRiskProfileInput,
} from "./modules/risk.js";

// ============================================
// Insurance Module Types
// ============================================

export type {
  PolicyStatus,
  CoverageType,
  CreatePolicyInput,
  InsurancePolicy,
  BufferPoolStatus,
  TreasuryAnalytics,
  PolicyFilter,
} from "./modules/insurance.js";

// ============================================
// Claims Module Types
// ============================================

export type {
  ClaimStatus,
  ClaimSeverity,
  FileClaimInput,
  DetectReversalInput,
  Claim,
  ClaimAuditEntry,
  ReversalDetection,
  BatchResolutionResult,
  ClaimsDashboard,
} from "./modules/claims.js";

// ============================================
// Sovereign Module Types
// ============================================

export type {
  SovereignCountryCode,
  IndustrialSector,
  ReadinessLevel,
  NationalInventoryInput,
  NationalInventory,
  SectorBreakdown,
  OperatorBreakdown,
  StrategicReserve,
  IndustrialHealth,
  IndustrialUnitSummary,
  CBAMGoodsEntry,
  CBAMReportInput,
  CBAMReport,
  CollateralValuationInput,
  CollateralValuation,
} from "./modules/sovereign.js";

// ============================================
// Zod Schemas (for consumer validation)
// ============================================

export {
  TerraQuraClientConfigSchema,
  CreateListingSchema,
  CreateOfferSchema,
  OffsetFootprintSchema,
  CaptureSubmissionSchema,
  PaginationSchema,
} from "./types.js";

// ============================================
// Errors
// ============================================

export {
  TerraQuraError,
  NetworkError,
  ContractError,
  ValidationError,
  InsufficientFundsError,
  InsufficientBalanceError,
  CircuitBreakerError,
  TransactionError,
  SubgraphError,
  AuthenticationError,
  IdempotencyError,
  TimeoutError,
  SDKErrorCode,
} from "./errors.js";

// ============================================
// Constants (selective)
// ============================================

export {
  CONTRACT_ADDRESSES,
  NETWORK_CONFIGS,
  ROLES,
  PLATFORM_CONFIG,
  VERIFICATION_THRESHOLDS,
  SUBGRAPH_URLS,
} from "./constants.js";

export type { NetworkName, NetworkConfig, ContractAddresses } from "./constants.js";

// ============================================
// Utilities
// ============================================

export { generateCertificateSVG, sanitizeSVGText } from "./certificate.js";
export { GasManager, DEFAULT_GAS_LIMITS } from "./gas.js";
export { WebhookManager } from "./webhooks.js";
export { SDK_METRICS } from "./telemetry.js";

// Idempotency (pluggable backend for serverless)
export {
  IdempotencyStore,
  InMemoryIdempotencyBackend,
} from "./utils.js";
export type {
  IIdempotencyBackend,
  IdempotencyEntry,
} from "./utils.js";

// ============================================
// Default Export
// ============================================

export { TerraQuraClient as default } from "./client.js";
