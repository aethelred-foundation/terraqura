/**
 * @terraqura/sdk — TerraQuraClient
 *
 * The single entry point for the TerraQura SDK.
 * Provides lazy-initialized access to all domain modules.
 *
 * @example
 * ```ts
 * // Read-only mode (no signer needed)
 * const client = new TerraQuraClient({ network: "aethelred-testnet" });
 * const provenance = await client.assets.getProvenance("42");
 * const minted = await client.assets.getTotalMinted();
 *
 * // Read-write mode (private key)
 * const client = new TerraQuraClient({
 *   network: "aethelred-testnet",
 *   privateKey: "0x...",
 * });
 * const result = await client.market.purchase(1n, 10n);
 *
 * // Read-write mode (external signer / KMS)
 * const client = new TerraQuraClient({
 *   network: "aethelred-testnet",
 *   signer: myKmsSigner,
 * });
 * ```
 */

import { ethers } from "ethers";

import {
  CONTRACT_ADDRESSES,
  SUBGRAPH_URLS,
  CircuitBreakerABI,
  type NetworkName,
} from "./constants.js";
import { ValidationError } from "./errors.js";
import { GasManager, DEFAULT_GAS_CONFIG } from "./gas.js";
import { AssetsModule } from "./modules/assets.js";
import { BadgeModule } from "./modules/badge.js";
import { CheckoutModule } from "./modules/checkout.js";
import { ClaimsModule } from "./modules/claims.js";
import { ComplianceModule } from "./modules/compliance.js";
import { ConnectModule } from "./modules/connect.js";
import { InsuranceModule } from "./modules/insurance.js";
import { MarketModule } from "./modules/market.js";
import { MRVModule } from "./modules/mrv.js";
import { OffsetModule } from "./modules/offset.js";
import { RiskModule } from "./modules/risk.js";
import { SovereignModule } from "./modules/sovereign.js";
import { createTelemetry, type ITelemetry } from "./telemetry.js";
import { TerraQuraClientConfigSchema } from "./types.js";
import {
  createProvider,
  IdempotencyStore,
  DEFAULT_RETRY_CONFIG,
  withRetry,
} from "./utils.js";
import { WebhookManager } from "./webhooks.js";

import type {
  TerraQuraClientConfig,
  InternalConfig,
  GasConfig,
  RetryConfig,
} from "./types.js";

// ============================================
// TerraQuraClient
// ============================================

export class TerraQuraClient {
  // Core infrastructure
  private readonly _provider: ethers.Provider;
  private readonly _signer: ethers.Signer | null;
  private readonly _network: NetworkName;
  private readonly _config: InternalConfig;
  private readonly _telemetry: ITelemetry;
  private readonly _gasManager: GasManager;
  private readonly _idempotency: IdempotencyStore;

  // Lazy-initialized modules
  private _assets: AssetsModule | null = null;
  private _market: MarketModule | null = null;
  private _mrv: MRVModule | null = null;
  private _offset: OffsetModule | null = null;
  private _webhooks: WebhookManager | null = null;
  private _connect: ConnectModule | null = null;
  private _checkout: CheckoutModule | null = null;
  private _badge: BadgeModule | null = null;
  private _compliance: ComplianceModule | null = null;
  private _risk: RiskModule | null = null;
  private _insurance: InsuranceModule | null = null;
  private _claims: ClaimsModule | null = null;
  private _sovereign: SovereignModule | null = null;

  /**
   * Create a new TerraQura SDK client.
   *
   * @param config - Client configuration
   * @throws ValidationError if the configuration is invalid
   */
  constructor(config: TerraQuraClientConfig) {
    // Validate configuration
    const parseResult = TerraQuraClientConfigSchema.safeParse(config);
    if (!parseResult.success) {
      throw new ValidationError(
        `Invalid SDK configuration: ${parseResult.error.issues.map((i) => i.message).join(", ")}`,
        { issues: parseResult.error.issues },
      );
    }

    this._network = config.network;

    // Create provider
    this._provider = createProvider({
      rpcUrl: config.rpcUrl,
      network: config.network,
    });

    // Create signer (if provided)
    if (config.privateKey) {
      this._signer = new ethers.Wallet(config.privateKey, this._provider);
    } else if (config.signer) {
      this._signer = config.signer;
    } else {
      this._signer = null;
    }

    // Resolve addresses
    const addresses = CONTRACT_ADDRESSES[config.network];
    if (!addresses.carbonCredit) {
      throw new ValidationError(
        `No contract addresses configured for network "${config.network}"`,
        { network: config.network },
      );
    }

    // Create telemetry
    this._telemetry = createTelemetry(config.telemetry);

    // Create gas manager
    const gasConfig: Required<GasConfig> = {
      ...DEFAULT_GAS_CONFIG,
      ...(config.gas || {}),
      gasLimits: { ...DEFAULT_GAS_CONFIG.gasLimits, ...(config.gas?.gasLimits || {}) },
    };
    this._gasManager = new GasManager(this._provider, gasConfig);

    // Create idempotency store (with optional external backend for serverless)
    this._idempotency = new IdempotencyStore(
      config.idempotencyTtlMs,
      config.idempotencyBackend,
    );

    // Build internal config for modules
    const retryConfig: Required<RetryConfig> = {
      ...DEFAULT_RETRY_CONFIG,
      ...(config.retry || {}),
      retryableErrors: [
        ...DEFAULT_RETRY_CONFIG.retryableErrors,
        ...(config.retry?.retryableErrors || []),
      ],
    };

    this._config = {
      network: config.network,
      provider: this._provider,
      signer: this._signer,
      addresses: {
        accessControl: addresses.accessControl,
        verificationEngine: addresses.verificationEngine,
        carbonCredit: addresses.carbonCredit,
        carbonMarketplace: addresses.carbonMarketplace,
        gaslessMarketplace: addresses.gaslessMarketplace,
        circuitBreaker: addresses.circuitBreaker,
      },
      subgraphUrl: config.subgraphUrl || SUBGRAPH_URLS[config.network] || "",
      gas: gasConfig,
      retry: retryConfig,
      telemetryEnabled: config.telemetry?.enabled !== false,
    };
  }

  // ============================================
  // Module Accessors (Lazy)
  // ============================================

  /**
   * Carbon credit asset operations.
   * Read-only: provenance, balances, metadata, verification.
   */
  get assets(): AssetsModule {
    if (!this._assets) {
      this._assets = new AssetsModule(this._config, this._telemetry);
    }
    return this._assets;
  }

  /**
   * Marketplace operations.
   * Create/cancel listings, purchase, create/accept/cancel offers.
   */
  get market(): MarketModule {
    if (!this._market) {
      this._market = new MarketModule(
        this._config,
        this._telemetry,
        this._gasManager,
        this._idempotency,
      );
    }
    return this._market;
  }

  /**
   * MRV (Monitoring, Reporting, Verification) operations.
   * Submit capture data, preview verification, manage DAC units.
   */
  get mrv(): MRVModule {
    if (!this._mrv) {
      this._mrv = new MRVModule(
        this._config,
        this._telemetry,
        this._gasManager,
        this._idempotency,
      );
    }
    return this._mrv;
  }

  /**
   * One-click carbon offset.
   * Find → Purchase → Retire → Certificate in one call.
   */
  get offset(): OffsetModule {
    if (!this._offset) {
      this._offset = new OffsetModule(
        this._config,
        this._telemetry,
        this._gasManager,
        this._idempotency,
        this.market,
        this.assets,
      );
    }
    return this._offset;
  }

  /**
   * On-chain event listener and webhook dispatch system.
   */
  get webhooks(): WebhookManager {
    if (!this._webhooks) {
      this._webhooks = new WebhookManager(
        this._provider,
        CONTRACT_ADDRESSES[this._network],
      );
    }
    return this._webhooks;
  }

  /**
   * TerraQura Connect — Platform-as-a-Service for partners.
   *
   * Enables managed sub-accounts with deterministic wallets (BIP-44),
   * platform fee splitting, and delegated carbon operations.
   *
   * @example
   * ```ts
   * const partner = await client.connect.registerPartner({
   *   name: "FedEx Green",
   *   platformFeeBps: 350,
   *   masterSeed: process.env.PARTNER_SEED!,
   * });
   * ```
   */
  get connect(): ConnectModule {
    if (!this._connect) {
      this._connect = new ConnectModule(
        this._config,
        this._telemetry,
        this.offset,
      );
    }
    return this._connect;
  }

  /**
   * Hosted checkout sessions — "Stripe Checkout" for carbon offsets.
   *
   * Creates payment sessions that abstract the entire offset pipeline
   * behind a single API call with webhook notifications.
   *
   * @example
   * ```ts
   * const session = await client.checkout.createSession({
   *   amountKg: 50,
   *   reason: "Carbon neutral shipping",
   *   successUrl: "https://mystore.com/thank-you",
   * });
   * ```
   */
  get checkout(): CheckoutModule {
    if (!this._checkout) {
      this._checkout = new CheckoutModule(
        this._config,
        this._telemetry,
        this.offset,
      );
    }
    return this._checkout;
  }

  /**
   * Carbon Integrity Badge — live proof-of-physics widget.
   *
   * Generates SVG badges, embeddable HTML snippets, and JSON payloads
   * that prove carbon offset claims with on-chain data.
   *
   * @example
   * ```ts
   * const badge = await client.badge.generateBadge({
   *   partnerName: "FedEx Green",
   *   variant: "detailed",
   *   theme: "dark",
   * });
   * ```
   */
  get badge(): BadgeModule {
    if (!this._badge) {
      this._badge = new BadgeModule(
        this._config,
        this._telemetry,
        this.assets,
        this.mrv,
      );
    }
    return this._badge;
  }

  /**
   * Enterprise compliance, transparency portal, and Article 6 sovereign API.
   *
   * Provides cryptographic provenance proofs, ITMO reports for Corresponding
   * Adjustments under the Paris Agreement, and audit trail exports.
   *
   * @example
   * ```ts
   * const proof = await client.compliance.getProvenanceProof("42");
   * const report = await client.compliance.generateSovereignReport({
   *   issuingCountry: "KE",
   *   acquiringCountry: "CH",
   *   tokenIds: ["42", "43"],
   *   reportingPeriod: { start: "2026-01-01", end: "2026-06-30" },
   * });
   * ```
   */
  get compliance(): ComplianceModule {
    if (!this._compliance) {
      this._compliance = new ComplianceModule(
        this._config,
        this._telemetry,
        this.assets,
      );
    }
    return this._compliance;
  }

  /**
   * Risk Oracle — actuarial health scoring and insurance premium engine.
   *
   * Calculates dynamic risk scores for DAC units, reads/writes the
   * on-chain RiskOracle, and computes insurance premiums.
   *
   * @example
   * ```ts
   * const score = client.risk.calculateHealthScore({
   *   uptimePercentage: 0.985,
   *   efficiencyVariance: 1.2,
   *   anomalyRate: 0.0003,
   *   maintenanceAgeDays: 45,
   * });
   * ```
   */
  get risk(): RiskModule {
    if (!this._risk) {
      this._risk = new RiskModule(
        this._config,
        this._telemetry,
      );
    }
    return this._risk;
  }

  /**
   * Carbon Insurance — buffer pool, policies, treasury, and premiums.
   *
   * Creates insurance policies for carbon credit purchases, manages
   * the buffer pool reserve, and tracks treasury float/loss ratios.
   *
   * @example
   * ```ts
   * const policy = client.insurance.createPolicySync({
   *   tokenId: "42",
   *   amountKg: 1000,
   *   purchasePriceWei: ethers.parseEther("10"),
   *   dacUnitId: "dac-unit-001",
   *   buyerAddress: "0x...",
   * });
   * ```
   */
  get insurance(): InsuranceModule {
    if (!this._insurance) {
      this._insurance = new InsuranceModule(
        this._telemetry,
        this.risk,
      );
    }
    return this._insurance;
  }

  /**
   * Automated Claims — reversal detection and restitution engine.
   *
   * Detects carbon reversals, files claims on affected policies,
   * and executes automated credit replacement from the Buffer Pool.
   *
   * @example
   * ```ts
   * const detection = await client.claims.detectReversal({
   *   dacUnitId: "dac-unit-001",
   *   currentHealthScore: 0,
   *   previousHealthScore: 75,
   *   reason: "Hardware failure",
   * });
   * const resolution = await client.claims.resolveAllClaims(detection.claimIds);
   * ```
   */
  get claims(): ClaimsModule {
    if (!this._claims) {
      this._claims = new ClaimsModule(
        this._config,
        this._telemetry,
        this.insurance,
      );
    }
    return this._claims;
  }

  /**
   * Sovereign Intelligence — national carbon inventory, strategic reserves,
   * industrial health, CBAM compliance, and carbon repo terminal.
   *
   * Designed for UAE national infrastructure: ADNOC, Etihad, FAB,
   * MOCCAE, and sovereign wealth funds.
   *
   * @example
   * ```ts
   * const inventory = await client.sovereign.getNationalInventory({
   *   country: "AE",
   *   reportingPeriod: { start: "2026-01-01", end: "2026-06-30" },
   * });
   * const cbam = await client.sovereign.generateCBAMReport({
   *   exporterName: "ADNOC Refining",
   *   exporterCountry: "AE",
   *   importerCountry: "DE",
   *   goods: [{ hsCode: "7206", description: "Iron & Steel", volumeTonnes: 50000 }],
   *   reportingPeriod: { start: "2026-01-01", end: "2026-03-31" },
   * });
   * ```
   */
  get sovereign(): SovereignModule {
    if (!this._sovereign) {
      this._sovereign = new SovereignModule(
        this._config,
        this._telemetry,
        this.assets,
        this.compliance,
        this.insurance,
        this.risk,
        this.mrv,
      );
    }
    return this._sovereign;
  }

  // ============================================
  // Utility Properties
  // ============================================

  /** Signer address, or null for read-only mode */
  get address(): string | null {
    if (this._signer && "address" in this._signer) {
      return (this._signer as ethers.Wallet).address;
    }
    return null;
  }

  /** Get the signer address asynchronously (works with all signer types) */
  async getAddress(): Promise<string | null> {
    if (!this._signer) return null;
    return this._signer.getAddress();
  }

  /** Configured network name */
  get network(): NetworkName {
    return this._network;
  }

  /** The underlying ethers.js provider */
  get provider(): ethers.Provider {
    return this._provider;
  }

  /** The underlying ethers.js signer (null for read-only) */
  get signer(): ethers.Signer | null {
    return this._signer;
  }

  /** Whether the client is in read-only mode (no signer) */
  isReadOnly(): boolean {
    return this._signer === null;
  }

  // ============================================
  // Protocol Safety
  // ============================================

  /**
   * Get the current circuit breaker status.
   * Returns whether the protocol is paused and the security level.
   */
  async getCircuitBreakerStatus(): Promise<{
    isPaused: boolean;
    level: number;
    monitored: number;
  }> {
    return this._telemetry.wrapAsync(
      "client.getCircuitBreakerStatus",
      async () => {
        const cb = new ethers.Contract(
          this._config.addresses.circuitBreaker,
          CircuitBreakerABI,
          this._provider,
        );

        const getStatusFn = cb.getFunction("getStatus");
        const result = await withRetry(
          () => getStatusFn(),
          this._config.retry,
        );

        return {
          isPaused: Boolean(result[0]),
          level: Number(result[1] || 0),
          monitored: Number(result[2] || 0),
        };
      },
    );
  }

  /**
   * Check if operations are allowed for a specific contract.
   *
   * @param contractName - Contract name key (e.g., "carbonCredit", "carbonMarketplace")
   * @returns Whether operations are currently allowed
   */
  async isOperationAllowed(contractName: keyof typeof CONTRACT_ADDRESSES["aethelred-testnet"]): Promise<boolean> {
    return this._telemetry.wrapAsync(
      "client.isOperationAllowed",
      async () => {
        const address =
          this._config.addresses[contractName as keyof InternalConfig["addresses"]];
        if (!address) return false;

        const cb = new ethers.Contract(
          this._config.addresses.circuitBreaker,
          CircuitBreakerABI,
          this._provider,
        );

        const isAllowedFn = cb.getFunction("isOperationAllowed");
        return withRetry(
          () => isAllowedFn(address),
          this._config.retry,
        );
      },
    );
  }

  // ============================================
  // Lifecycle
  // ============================================

  /**
   * Cleanup resources: stop webhook listeners, invalidate caches,
   * destroy idempotency store.
   *
   * Call this when you're done using the client to prevent memory leaks.
   * For serverless environments, call this at the end of each invocation.
   */
  async destroy(): Promise<void> {
    if (this._webhooks) {
      this._webhooks.stop();
    }
    if (this._checkout) {
      this._checkout.destroy();
    }
    this._gasManager.invalidateCache();
    await this._idempotency.destroy();
  }
}
