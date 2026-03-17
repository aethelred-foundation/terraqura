/**
 * @terraqura/sdk — Connect Module
 *
 * Platform-as-a-Service infrastructure for TerraQura Connect partners.
 * Enables managed sub-accounts, deterministic wallets (BIP-44),
 * platform fee splitting, and delegated carbon operations.
 *
 * Architecture:
 * - Partners (airlines, logistics firms) create a parent integration
 * - Each partner can create thousands of managed sub-accounts
 * - Sub-accounts have real on-chain addresses (audit trail)
 * - Partners define custom fee markups (revenue sharing)
 * - Delegated operations execute on behalf of sub-accounts
 *
 * @example
 * ```ts
 * const client = new TerraQuraClient({
 *   network: "aethelred",
 *   privateKey: "0x...", // Partner's treasury key
 * });
 *
 * // Register a partner
 * const partner = await client.connect.registerPartner({
 *   name: "FedEx Green",
 *   webhookUrl: "https://fedex.com/webhooks/carbon",
 *   platformFeeBps: 350, // 3.5% total (2.5% TerraQura + 1% FedEx markup)
 *   masterSeed: process.env.PARTNER_SEED!, // BIP-39 mnemonic
 * });
 *
 * // Create a managed sub-account
 * const sub = client.connect.createSubAccount({
 *   partnerId: partner.id,
 *   externalId: "FEDEX-SHIPMENT-12345",
 *   metadata: { region: "US-WEST", tier: "premium" },
 * });
 *
 * // Retire carbon on behalf of a sub-account
 * const result = await client.connect.retireOnBehalf({
 *   partnerId: partner.id,
 *   subAccountId: sub.id,
 *   amountKg: 50,
 *   reason: "Carbon neutral shipping — FedEx #12345",
 * });
 * ```
 */

import { ethers } from "ethers";

import { PLATFORM_CONFIG } from "../constants.js";
import {
  ValidationError,
  AuthenticationError,
} from "../errors.js";

import type { ITelemetry } from "../telemetry.js";
import type { InternalConfig, PriceBreakdown } from "../types.js";
import type { OffsetModule } from "./offset.js";

// ============================================
// Connect Types
// ============================================

/** Partner registration input */
export interface RegisterPartnerInput {
  /** Partner organization name */
  name: string;
  /** Webhook URL for partner-scoped events */
  webhookUrl?: string;
  /**
   * Partner's custom platform fee in basis points.
   * This is the TOTAL fee charged to end-users.
   * TerraQura takes its base fee (250 BPS), the remainder goes to the partner.
   *
   * Example: 350 BPS total → 250 TerraQura + 100 Partner markup.
   * Must be >= TerraQura's base fee (250 BPS).
   */
  platformFeeBps?: number;
  /**
   * BIP-39 mnemonic for deterministic sub-account wallet derivation.
   * If not provided, sub-accounts will use generated addresses.
   *
   * ⚠️ SECURITY: Store this in a KMS/HSM. Never hardcode.
   */
  masterSeed?: string;
}

/** Partner record */
export interface Partner {
  /** Unique partner identifier */
  id: string;
  /** Organization name */
  name: string;
  /** API key hash (SHA-256 of the issued key) */
  apiKeyHash: string;
  /** Webhook URL */
  webhookUrl: string | null;
  /** Total platform fee in BPS */
  platformFeeBps: number;
  /** TerraQura's share of the fee in BPS */
  terraquraFeeBps: number;
  /** Partner's markup share in BPS */
  partnerMarkupBps: number;
  /** Whether the partner has a deterministic wallet seed */
  hasMasterSeed: boolean;
  /** Number of sub-accounts created */
  subAccountCount: number;
  /** Registration timestamp */
  createdAt: number;
}

/** Sub-account creation input */
export interface CreateSubAccountInput {
  /** Partner ID that owns this sub-account */
  partnerId: string;
  /** External ID from the partner's system (e.g., customer ID, shipment ID) */
  externalId: string;
  /** Optional metadata attached to the sub-account */
  metadata?: Record<string, string | number | boolean>;
}

/** Managed sub-account record */
export interface SubAccount {
  /** Unique sub-account identifier */
  id: string;
  /** Partner's external identifier */
  externalId: string;
  /** Partner ID */
  partnerId: string;
  /** Deterministic on-chain wallet address */
  walletAddress: string;
  /** Total CO2 retired (kg) */
  totalRetiredKg: number;
  /** Total amount spent (wei) */
  totalSpentWei: bigint;
  /** Metadata */
  metadata: Record<string, string | number | boolean>;
  /** Creation timestamp */
  createdAt: number;
}

/** Retire-on-behalf input */
export interface RetireOnBehalfInput {
  /** Partner ID */
  partnerId: string;
  /** Sub-account ID or external ID */
  subAccountId: string;
  /** Amount of CO2 to offset in kilograms */
  amountKg: number;
  /** Reason for retirement (stored on-chain) */
  reason: string;
  /** Generate SVG certificate */
  generateCertificate?: boolean;
}

/** Retire-on-behalf result */
export interface RetireOnBehalfResult {
  /** Sub-account that received the retirement */
  subAccount: SubAccount;
  /** Token IDs retired */
  tokenIds: string[];
  /** Amount retired (kg CO2) */
  amountRetiredKg: number;
  /** Transaction hashes */
  txHashes: string[];
  /** Cost breakdown with fee split */
  cost: FeeSplitBreakdown;
  /** SVG certificate (if requested) */
  certificate?: string;
}

/** Fee split breakdown showing partner/TerraQura shares */
export interface FeeSplitBreakdown extends PriceBreakdown {
  /** TerraQura's share of the platform fee (wei) */
  terraquraFee: bigint;
  /** Partner's markup share (wei) */
  partnerMarkup: bigint;
  /** Total fee BPS charged to the end-user */
  totalFeeBps: number;
  /** Partner's markup BPS */
  partnerMarkupBps: number;
}

/** Sub-account ledger summary */
export interface SubAccountLedger {
  subAccountId: string;
  externalId: string;
  walletAddress: string;
  retirements: Array<{
    tokenId: string;
    amountKg: number;
    reason: string;
    txHash: string;
    timestamp: number;
  }>;
  totalRetiredKg: number;
  certificateCount: number;
}

/** Partner analytics */
export interface PartnerAnalytics {
  partnerId: string;
  totalSubAccounts: number;
  totalRetiredKg: number;
  totalRevenue: bigint;
  totalPartnerEarnings: bigint;
  activeSubAccounts: number;
  topSubAccounts: Array<{
    externalId: string;
    totalRetiredKg: number;
  }>;
}

// ============================================
// Internal Storage Types
// ============================================

interface PartnerRecord extends Partner {
  masterSeed: string | null;
  subAccountIndex: number;
  apiKey: string;
}

interface SubAccountRecord extends SubAccount {
  derivationIndex: number;
}

// ============================================
// Connect Module
// ============================================

/**
 * TerraQura Connect — Platform-as-a-Service for carbon markets.
 *
 * Enables partner platforms to integrate carbon offsetting into their
 * products without building blockchain infrastructure. Partners get:
 *
 * - **Managed Sub-Accounts**: Each end-user gets a unique on-chain address
 * - **Deterministic Wallets**: BIP-44 derivation from a single seed
 * - **Fee Splitting**: Partners earn markup on every transaction
 * - **Delegated Operations**: Offset/retire on behalf of sub-accounts
 * - **Scoped Webhooks**: Event filtering by partner and sub-account
 * - **Compliance Portal**: Per-user transparency and audit trail
 */
export class ConnectModule {
  private readonly config: InternalConfig;
  private readonly telemetry: ITelemetry;
  private readonly offset: OffsetModule;

  // In-memory registries (will be replaced by DB in production API)
  private readonly partners = new Map<string, PartnerRecord>();
  private readonly subAccounts = new Map<string, SubAccountRecord>();
  private readonly partnerSubAccounts = new Map<string, Set<string>>();
  private readonly externalIdIndex = new Map<string, string>(); // "partnerId:externalId" → subAccountId

  constructor(
    config: InternalConfig,
    telemetry: ITelemetry,
    offset: OffsetModule,
  ) {
    this.config = config;
    this.telemetry = telemetry;
    this.offset = offset;
  }

  // ============================================
  // Partner Management
  // ============================================

  /**
   * Register a new Connect partner.
   *
   * Partners are organizations that integrate TerraQura into their
   * products (e.g., airlines, logistics firms, ride-sharing apps).
   *
   * @param input - Partner registration data
   * @returns Partner record with API key (only shown once)
   */
  async registerPartner(
    input: RegisterPartnerInput,
  ): Promise<Partner & { apiKey: string }> {
    return this.telemetry.wrapAsync("connect.registerPartner", async () => {
      // Validate
      if (!input.name || input.name.trim().length === 0) {
        throw new ValidationError("Partner name is required", {
          field: "name",
        });
      }

      const totalFeeBps = input.platformFeeBps ?? PLATFORM_CONFIG.platformFeeBps;
      if (totalFeeBps < PLATFORM_CONFIG.platformFeeBps) {
        throw new ValidationError(
          `Platform fee must be >= ${PLATFORM_CONFIG.platformFeeBps} BPS (TerraQura base fee)`,
          {
            field: "platformFeeBps",
            value: totalFeeBps,
            minimum: PLATFORM_CONFIG.platformFeeBps,
          },
        );
      }

      if (totalFeeBps > 5000) {
        throw new ValidationError("Platform fee cannot exceed 50% (5000 BPS)", {
          field: "platformFeeBps",
          value: totalFeeBps,
        });
      }

      if (input.webhookUrl) {
        try {
          new URL(input.webhookUrl);
        } catch {
          throw new ValidationError("Invalid webhook URL", {
            field: "webhookUrl",
            value: input.webhookUrl,
          });
        }
      }

      // Validate master seed if provided
      if (input.masterSeed) {
        try {
          ethers.HDNodeWallet.fromPhrase(input.masterSeed);
        } catch {
          throw new ValidationError(
            "Invalid BIP-39 mnemonic for masterSeed",
            { field: "masterSeed" },
          );
        }
      }

      // Generate partner ID and API key
      const partnerId = this.generatePartnerId(input.name);
      const apiKey = this.generateApiKey();
      const apiKeyHash = ethers.keccak256(ethers.toUtf8Bytes(apiKey));

      const partnerMarkupBps = totalFeeBps - PLATFORM_CONFIG.platformFeeBps;

      const record: PartnerRecord = {
        id: partnerId,
        name: input.name.trim(),
        apiKeyHash,
        apiKey,
        webhookUrl: input.webhookUrl || null,
        platformFeeBps: totalFeeBps,
        terraquraFeeBps: PLATFORM_CONFIG.platformFeeBps,
        partnerMarkupBps,
        hasMasterSeed: !!input.masterSeed,
        masterSeed: input.masterSeed || null,
        subAccountCount: 0,
        subAccountIndex: 0,
        createdAt: Date.now(),
      };

      this.partners.set(partnerId, record);
      this.partnerSubAccounts.set(partnerId, new Set());

      return {
        id: record.id,
        name: record.name,
        apiKeyHash: record.apiKeyHash,
        apiKey, // Only returned once at registration
        webhookUrl: record.webhookUrl,
        platformFeeBps: record.platformFeeBps,
        terraquraFeeBps: record.terraquraFeeBps,
        partnerMarkupBps: record.partnerMarkupBps,
        hasMasterSeed: record.hasMasterSeed,
        subAccountCount: 0,
        createdAt: record.createdAt,
      };
    });
  }

  /**
   * Get a partner by ID.
   */
  async getPartner(partnerId: string): Promise<Partner> {
    return this.telemetry.wrapAsync("connect.getPartner", async () => {
      const record = this.partners.get(partnerId);
      if (!record) {
        throw new ValidationError(`Partner not found: ${partnerId}`, {
          field: "partnerId",
        });
      }
      return this.toPartner(record);
    });
  }

  /**
   * Authenticate a partner by API key.
   *
   * @param apiKey - The partner's API key
   * @returns Partner record if valid
   * @throws AuthenticationError if the key is invalid
   */
  async authenticatePartner(apiKey: string): Promise<Partner> {
    return this.telemetry.wrapAsync("connect.authenticatePartner", async () => {
      const keyHash = ethers.keccak256(ethers.toUtf8Bytes(apiKey));

      for (const record of this.partners.values()) {
        if (record.apiKeyHash === keyHash) {
          return this.toPartner(record);
        }
      }

      throw new AuthenticationError(
        "Invalid API key",
      );
    });
  }

  // ============================================
  // Sub-Account Management
  // ============================================

  /**
   * Create a managed sub-account for an end-user.
   *
   * Each sub-account gets a unique, deterministic on-chain address
   * derived from the partner's master seed (BIP-44). This ensures:
   * - Every user has a real blockchain audit trail
   * - No "pooling" of carbon credits (regulators require this)
   * - Reproducible: same seed + index = same address
   *
   * @param input - Sub-account creation data
   * @returns Sub-account with its unique wallet address
   */
  async createSubAccount(
    input: CreateSubAccountInput,
  ): Promise<SubAccount> {
    return this.telemetry.wrapAsync("connect.createSubAccount", async () => {
      // Validate partner
      const partner = this.partners.get(input.partnerId);
      if (!partner) {
        throw new ValidationError(`Partner not found: ${input.partnerId}`, {
          field: "partnerId",
        });
      }

      if (!input.externalId || input.externalId.trim().length === 0) {
        throw new ValidationError("External ID is required", {
          field: "externalId",
        });
      }

      // Check for duplicate
      const compositeKey = `${input.partnerId}:${input.externalId}`;
      if (this.externalIdIndex.has(compositeKey)) {
        throw new ValidationError(
          `Sub-account already exists for partner ${input.partnerId} with external ID ${input.externalId}`,
          {
            field: "externalId",
            value: input.externalId,
            existingId: this.externalIdIndex.get(compositeKey),
          },
        );
      }

      // Derive deterministic wallet address
      const derivationIndex = partner.subAccountIndex;
      const walletAddress = this.deriveSubAccountAddress(
        partner,
        derivationIndex,
      );

      // Generate sub-account ID
      const subAccountId = this.generateSubAccountId(
        input.partnerId,
        input.externalId,
      );

      const record: SubAccountRecord = {
        id: subAccountId,
        externalId: input.externalId.trim(),
        partnerId: input.partnerId,
        walletAddress,
        totalRetiredKg: 0,
        totalSpentWei: 0n,
        metadata: input.metadata || {},
        derivationIndex,
        createdAt: Date.now(),
      };

      // Update indices
      this.subAccounts.set(subAccountId, record);
      this.externalIdIndex.set(compositeKey, subAccountId);
      this.partnerSubAccounts.get(input.partnerId)?.add(subAccountId);

      // Increment partner's sub-account counter
      partner.subAccountIndex++;
      partner.subAccountCount++;

      return this.toSubAccount(record);
    });
  }

  /**
   * Get a sub-account by ID.
   */
  async getSubAccount(subAccountId: string): Promise<SubAccount> {
    return this.telemetry.wrapAsync("connect.getSubAccount", async () => {
      const record = this.subAccounts.get(subAccountId);
      if (!record) {
        throw new ValidationError(`Sub-account not found: ${subAccountId}`, {
          field: "subAccountId",
        });
      }
      return this.toSubAccount(record);
    });
  }

  /**
   * Resolve a sub-account by external ID within a partner scope.
   */
  async resolveByExternalId(
    partnerId: string,
    externalId: string,
  ): Promise<SubAccount> {
    return this.telemetry.wrapAsync("connect.resolveByExternalId", async () => {
      const compositeKey = `${partnerId}:${externalId}`;
      const subAccountId = this.externalIdIndex.get(compositeKey);

      if (!subAccountId) {
        throw new ValidationError(
          `No sub-account found for partner ${partnerId} with external ID ${externalId}`,
          { partnerId, externalId },
        );
      }

      return this.getSubAccount(subAccountId);
    });
  }

  /**
   * List all sub-accounts for a partner.
   */
  async listSubAccounts(
    partnerId: string,
    options?: { offset?: number; limit?: number },
  ): Promise<{
    items: SubAccount[];
    total: number;
    hasMore: boolean;
  }> {
    return this.telemetry.wrapAsync("connect.listSubAccounts", async () => {
      const subIds = this.partnerSubAccounts.get(partnerId);
      if (!subIds) {
        throw new ValidationError(`Partner not found: ${partnerId}`, {
          field: "partnerId",
        });
      }

      const offset = options?.offset ?? 0;
      const limit = options?.limit ?? 50;

      const allSubs = Array.from(subIds)
        .map((id) => this.subAccounts.get(id))
        .filter((sub): sub is SubAccountRecord => Boolean(sub))
        .sort((a, b) => b.createdAt - a.createdAt);

      const items = allSubs.slice(offset, offset + limit).map(this.toSubAccount);
      const total = allSubs.length;

      return {
        items,
        total,
        hasMore: offset + limit < total,
      };
    });
  }

  // ============================================
  // Delegated Carbon Operations
  // ============================================

  /**
   * Retire carbon credits on behalf of a managed sub-account.
   *
   * The partner's wallet pays gas and credit costs. The retirement
   * is attributed to the sub-account's on-chain address for audit.
   *
   * Fee splitting:
   * - TerraQura takes its base fee (250 BPS)
   * - Partner receives their markup (platformFeeBps - 250 BPS)
   *
   * @param input - Retirement parameters
   * @returns Result with fee split breakdown and certificate
   */
  async retireOnBehalf(
    input: RetireOnBehalfInput,
  ): Promise<RetireOnBehalfResult> {
    return this.telemetry.wrapAsync("connect.retireOnBehalf", async () => {
      this.requireSigner();

      // Validate inputs
      if (input.amountKg <= 0) {
        throw new ValidationError("Amount must be positive", {
          field: "amountKg",
          value: input.amountKg,
        });
      }

      if (!input.reason || input.reason.trim().length === 0) {
        throw new ValidationError("Reason is required", {
          field: "reason",
        });
      }

      // Resolve partner and sub-account
      const partner = this.partners.get(input.partnerId);
      if (!partner) {
        throw new ValidationError(`Partner not found: ${input.partnerId}`, {
          field: "partnerId",
        });
      }

      let subAccount = this.subAccounts.get(input.subAccountId);
      if (!subAccount) {
        // Try resolving by external ID
        const compositeKey = `${input.partnerId}:${input.subAccountId}`;
        const resolvedId = this.externalIdIndex.get(compositeKey);
        if (resolvedId) {
          subAccount = this.subAccounts.get(resolvedId);
        }
      }

      if (!subAccount) {
        throw new ValidationError(
          `Sub-account not found: ${input.subAccountId}`,
          { field: "subAccountId" },
        );
      }

      if (subAccount.partnerId !== input.partnerId) {
        throw new ValidationError(
          "Sub-account does not belong to this partner",
          {
            subAccountId: subAccount.id,
            partnerId: input.partnerId,
          },
        );
      }

      // Build the on-chain reason with sub-account attribution
      const attributedReason = [
        input.reason.trim(),
        `[TQ-Connect: partner=${partner.name},`,
        `sub=${subAccount.externalId},`,
        `addr=${subAccount.walletAddress}]`,
      ].join(" ");

      // Execute offset via the OffsetModule
      const offsetResult = await this.offset.offsetFootprint(
        input.amountKg,
        attributedReason,
        { generateCertificate: input.generateCertificate ?? true },
      );

      // Calculate fee split
      const feeSplit = this.calculateFeeSplit(
        offsetResult.cost,
        partner.platformFeeBps,
      );

      // Update sub-account ledger
      subAccount.totalRetiredKg += input.amountKg;
      subAccount.totalSpentWei += offsetResult.cost.total;

      return {
        subAccount: this.toSubAccount(subAccount),
        tokenIds: offsetResult.tokenIds,
        amountRetiredKg: offsetResult.amountRetiredKg,
        txHashes: offsetResult.txHashes,
        cost: feeSplit,
        certificate: offsetResult.certificate,
      };
    });
  }

  /**
   * Get the carbon ledger for a specific sub-account.
   * Used for the transparency portal (carbon.partner.com).
   */
  async getSubAccountLedger(
    subAccountId: string,
  ): Promise<SubAccountLedger> {
    return this.telemetry.wrapAsync("connect.getSubAccountLedger", async () => {
      const subAccount = this.subAccounts.get(subAccountId);
      if (!subAccount) {
        throw new ValidationError(`Sub-account not found: ${subAccountId}`, {
          field: "subAccountId",
        });
      }

      // Query on-chain retirement history for this address
      const history = await this.offset.getRetirementHistory(
        subAccount.walletAddress,
      );

      return {
        subAccountId: subAccount.id,
        externalId: subAccount.externalId,
        walletAddress: subAccount.walletAddress,
        retirements: history.map((r) => ({
          tokenId: r.tokenId,
          amountKg: Number(r.amount),
          reason: r.reason,
          txHash: r.txHash,
          timestamp: r.timestamp,
        })),
        totalRetiredKg: subAccount.totalRetiredKg,
        certificateCount: history.length,
      };
    });
  }

  // ============================================
  // Partner Analytics
  // ============================================

  /**
   * Get aggregated analytics for a partner's Connect integration.
   */
  async getPartnerAnalytics(
    partnerId: string,
  ): Promise<PartnerAnalytics> {
    return this.telemetry.wrapAsync("connect.getPartnerAnalytics", async () => {
      const partner = this.partners.get(partnerId);
      if (!partner) {
        throw new ValidationError(`Partner not found: ${partnerId}`, {
          field: "partnerId",
        });
      }

      const subIds = this.partnerSubAccounts.get(partnerId) ?? new Set();
      const subs = Array.from(subIds)
        .map((id) => this.subAccounts.get(id))
        .filter((sub): sub is SubAccountRecord => Boolean(sub));

      let totalRetiredKg = 0;
      let totalRevenue = 0n;
      let totalPartnerEarnings = 0n;
      let activeCount = 0;

      const subStats: Array<{ externalId: string; totalRetiredKg: number }> = [];

      for (const sub of subs) {
        totalRetiredKg += sub.totalRetiredKg;
        totalRevenue += sub.totalSpentWei;

        // Calculate partner's share of each sub-account's spend
        if (sub.totalSpentWei > 0n) {
          const partnerShare =
            (sub.totalSpentWei * BigInt(partner.partnerMarkupBps)) /
            BigInt(PLATFORM_CONFIG.BPS_SCALE);
          totalPartnerEarnings += partnerShare;
        }

        if (sub.totalRetiredKg > 0) {
          activeCount++;
          subStats.push({
            externalId: sub.externalId,
            totalRetiredKg: sub.totalRetiredKg,
          });
        }
      }

      // Sort by total retired (descending) and take top 10
      subStats.sort((a, b) => b.totalRetiredKg - a.totalRetiredKg);

      return {
        partnerId,
        totalSubAccounts: subs.length,
        totalRetiredKg,
        totalRevenue,
        totalPartnerEarnings,
        activeSubAccounts: activeCount,
        topSubAccounts: subStats.slice(0, 10),
      };
    });
  }

  // ============================================
  // Fee Calculation
  // ============================================

  /**
   * Calculate the fee split for a given price breakdown.
   *
   * @param baseCost - The original price breakdown from the marketplace
   * @param totalFeeBps - Total fee BPS (TerraQura base + partner markup)
   * @returns Full fee split breakdown
   */
  calculateFeeSplit(
    baseCost: PriceBreakdown,
    totalFeeBps: number,
  ): FeeSplitBreakdown {
    const partnerMarkupBps = totalFeeBps - PLATFORM_CONFIG.platformFeeBps;

    // TerraQura's base fee (always 250 BPS)
    const terraquraFee =
      (baseCost.subtotal * BigInt(PLATFORM_CONFIG.platformFeeBps)) /
      BigInt(PLATFORM_CONFIG.BPS_SCALE);

    // Partner's markup
    const partnerMarkup = partnerMarkupBps > 0
      ? (baseCost.subtotal * BigInt(partnerMarkupBps)) /
        BigInt(PLATFORM_CONFIG.BPS_SCALE)
      : 0n;

    // Total fee is TerraQura + Partner
    const totalFee = terraquraFee + partnerMarkup;
    const total = baseCost.subtotal + totalFee;

    return {
      subtotal: baseCost.subtotal,
      platformFee: totalFee,
      total,
      feeBps: totalFeeBps,
      terraquraFee,
      partnerMarkup,
      totalFeeBps,
      partnerMarkupBps,
    };
  }

  // ============================================
  // Private Helpers
  // ============================================

  /**
   * Derive a deterministic wallet address for a sub-account.
   * Uses BIP-44 path: m/44'/60'/0'/0/{partnerIndex}/{subAccountIndex}
   */
  private deriveSubAccountAddress(
    partner: PartnerRecord,
    index: number,
  ): string {
    if (partner.masterSeed) {
      try {
        const hdNode = ethers.HDNodeWallet.fromPhrase(partner.masterSeed);
        // BIP-44 compliant path for sub-account derivation
        const derived = hdNode.derivePath(`m/44'/60'/0'/0/${index}`);
        return derived.address;
      } catch {
        // Fall through to random wallet on derivation failure
      }
    }

    // Deterministic from partner ID + index (no seed required)
    const entropy = ethers.keccak256(
      ethers.toUtf8Bytes(`${partner.id}:${index}:${partner.createdAt}`),
    );
    return ethers.computeAddress(entropy);
  }

  /**
   * Generate a unique partner ID.
   */
  private generatePartnerId(name: string): string {
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 20);

    const suffix = Date.now().toString(36).slice(-6);
    return `tqp_${slug}_${suffix}`;
  }

  /**
   * Generate a unique sub-account ID.
   */
  private generateSubAccountId(partnerId: string, externalId: string): string {
    const hash = ethers.keccak256(
      ethers.toUtf8Bytes(`${partnerId}:${externalId}:${Date.now()}`),
    ).slice(2, 14);
    return `tqs_${hash}`;
  }

  /**
   * Generate a cryptographic API key.
   */
  private generateApiKey(): string {
    const randomBytes = ethers.randomBytes(32);
    return `tqk_live_${ethers.hexlify(randomBytes).slice(2)}`;
  }

  /**
   * Strip internal fields from a partner record.
   */
  private toPartner(record: PartnerRecord): Partner {
    return {
      id: record.id,
      name: record.name,
      apiKeyHash: record.apiKeyHash,
      webhookUrl: record.webhookUrl,
      platformFeeBps: record.platformFeeBps,
      terraquraFeeBps: record.terraquraFeeBps,
      partnerMarkupBps: record.partnerMarkupBps,
      hasMasterSeed: record.hasMasterSeed,
      subAccountCount: record.subAccountCount,
      createdAt: record.createdAt,
    };
  }

  /**
   * Strip internal fields from a sub-account record.
   */
  private toSubAccount(record: SubAccountRecord): SubAccount {
    return {
      id: record.id,
      externalId: record.externalId,
      partnerId: record.partnerId,
      walletAddress: record.walletAddress,
      totalRetiredKg: record.totalRetiredKg,
      totalSpentWei: record.totalSpentWei,
      metadata: { ...record.metadata },
      createdAt: record.createdAt,
    };
  }

  private requireSigner(): void {
    if (!this.config.signer) {
      throw new AuthenticationError();
    }
  }
}
