/**
 * @terraqura/sdk — Market Module
 *
 * Marketplace operations: create/cancel listings, purchase credits,
 * create/accept/cancel offers, price calculations.
 */

import { ethers } from "ethers";

import {
  CarbonMarketplaceABI,
  PLATFORM_CONFIG,
  SUBGRAPH_URLS,
} from "../constants.js";
import {
  AuthenticationError,
  TerraQuraError,
  SubgraphError,
} from "../errors.js";
import {
  CreateListingSchema,
  CreateOfferSchema,
  PaginationSchema,
} from "../types.js";
import {
  withRetry,
  createIdempotencyKey,
  parseEventFromReceipt,
} from "../utils.js";

import type { GasManager } from "../gas.js";
import type { ITelemetry } from "../telemetry.js";
import type {
  InternalConfig,
  TransactionResult,
  PaginatedResult,
  PriceBreakdown,
  ListingSummary,
  PaginationInput,
  CreateListingInput,
  CreateOfferInput,
} from "../types.js";
import type { IdempotencyStore } from "../utils.js";

// ============================================
// Market Module
// ============================================

/**
 * Marketplace operations for buying and selling carbon credits.
 *
 * @example
 * ```ts
 * const client = new TerraQuraClient({ network: "aethelred-testnet", privateKey: "0x..." });
 *
 * // Create a listing
 * const result = await client.market.createListing({
 *   tokenId: 42n,
 *   amount: 100n,
 *   pricePerUnit: ethers.parseEther("0.1"),
 *   duration: 30 * 24 * 60 * 60, // 30 days
 * });
 * console.log("Listing ID:", result.data.listingId);
 *
 * // Purchase from a listing
 * const purchase = await client.market.purchase(1n, 10n);
 *
 * // Get price breakdown
 * const price = client.market.calculatePrice(
 *   ethers.parseEther("0.1"),
 *   10n,
 * );
 * console.log("Total:", ethers.formatEther(price.total));
 * ```
 */
export class MarketModule {
  private readonly config: InternalConfig;
  private readonly telemetry: ITelemetry;
  private readonly gasManager: GasManager;
  private readonly idempotency: IdempotencyStore;
  private marketplace: ethers.Contract | null = null;
  private marketplaceInterface: ethers.Interface | null = null;

  constructor(
    config: InternalConfig,
    telemetry: ITelemetry,
    gasManager: GasManager,
    idempotency: IdempotencyStore,
  ) {
    this.config = config;
    this.telemetry = telemetry;
    this.gasManager = gasManager;
    this.idempotency = idempotency;
  }

  // ============================================
  // Write Operations
  // ============================================

  /**
   * Create a marketplace listing to sell carbon credits.
   */
  async createListing(
    params: CreateListingInput,
  ): Promise<TransactionResult<{ listingId: bigint }>> {
    return this.telemetry.wrapAsync("market.createListing", async () => {
      this.requireSigner();
      const input = CreateListingSchema.parse(params);

      const key = createIdempotencyKey("market", "createListing", input);
      await this.idempotency.acquire(key);

      try {
        const contract = this.getMarketplace();
        const overrides = await this.gasManager.buildGasOverrides("createListing");

        const createListingFn = contract.getFunction("createListing");
        const tx = await createListingFn(
          input.tokenId,
          input.amount,
          input.pricePerUnit,
          input.minPurchaseAmount,
          input.duration,
          overrides,
        );

        const receipt = await tx.wait();

        const event = parseEventFromReceipt(
          receipt,
          this.getMarketplaceInterface(),
          "ListingCreated",
        );

        const result: TransactionResult<{ listingId: bigint }> = {
          txHash: receipt.hash,
          blockNumber: receipt.blockNumber,
          gasUsed: receipt.gasUsed,
          data: {
            listingId: BigInt((event?.listingId as bigint | string) || 0),
          },
          receipt,
        };

        await this.idempotency.release(key, result);
        return result;
      } catch (error) {
        await this.idempotency.remove(key);
        throw this.wrapError(error);
      }
    });
  }

  /**
   * Purchase carbon credits from a listing.
   *
   * @param listingId - The listing ID
   * @param amount - Number of credits to purchase
   */
  async purchase(
    listingId: bigint | string | number,
    amount: bigint | string | number,
  ): Promise<TransactionResult<{ tokenId: bigint; totalPaid: bigint }>> {
    return this.telemetry.wrapAsync("market.purchase", async () => {
      this.requireSigner();

      const lid = BigInt(listingId);
      const amt = BigInt(amount);

      const key = createIdempotencyKey("market", "purchase", {
        listingId: lid.toString(),
        amount: amt.toString(),
      });
      await this.idempotency.acquire(key);

      try {
        const contract = this.getMarketplace();

        // Get the listing to determine price
        const getListingFn = contract.getFunction("getListing");
        const listing = await withRetry(
          () => getListingFn(lid),
          this.config.retry,
        );

        // Calculate total price with platform fee
        const calculateTotalPriceFn = contract.getFunction("calculateTotalPrice");
        const [, , total] = await withRetry(
          () => calculateTotalPriceFn(listing.pricePerUnit, amt),
          this.config.retry,
        );

        const overrides = await this.gasManager.buildGasOverrides("purchase");

        const purchaseFn = contract.getFunction("purchase");
        const tx = await purchaseFn(lid, amt, {
          ...overrides,
          value: total,
        });

        const receipt = await tx.wait();

        const event = parseEventFromReceipt(
          receipt,
          this.getMarketplaceInterface(),
          "Purchase",
        );

        const result: TransactionResult<{ tokenId: bigint; totalPaid: bigint }> = {
          txHash: receipt.hash,
          blockNumber: receipt.blockNumber,
          gasUsed: receipt.gasUsed,
          data: {
            tokenId: BigInt((event?.tokenId as bigint | string) || 0),
            totalPaid: total as bigint,
          },
          receipt,
        };

        await this.idempotency.release(key, result);
        return result;
      } catch (error) {
        await this.idempotency.remove(key);
        throw this.wrapError(error);
      }
    });
  }

  /**
   * Create a buy offer for a specific credit type.
   */
  async createOffer(
    params: CreateOfferInput,
  ): Promise<TransactionResult<{ offerId: bigint }>> {
    return this.telemetry.wrapAsync("market.createOffer", async () => {
      this.requireSigner();
      const input = CreateOfferSchema.parse(params);

      const key = createIdempotencyKey("market", "createOffer", input);
      await this.idempotency.acquire(key);

      try {
        const contract = this.getMarketplace();

        // Calculate deposit (pricePerUnit * amount + fee)
        const calculateTotalPriceFn = contract.getFunction("calculateTotalPrice");
        const [, , total] = await withRetry(
          () => calculateTotalPriceFn(input.pricePerUnit, input.amount),
          this.config.retry,
        );

        const overrides = await this.gasManager.buildGasOverrides("createOffer");

        const createOfferFn = contract.getFunction("createOffer");
        const tx = await createOfferFn(
          input.tokenId,
          input.amount,
          input.pricePerUnit,
          input.duration,
          { ...overrides, value: total },
        );

        const receipt = await tx.wait();

        const event = parseEventFromReceipt(
          receipt,
          this.getMarketplaceInterface(),
          "OfferCreated",
        );

        const result: TransactionResult<{ offerId: bigint }> = {
          txHash: receipt.hash,
          blockNumber: receipt.blockNumber,
          gasUsed: receipt.gasUsed,
          data: {
            offerId: BigInt((event?.offerId as bigint | string) || 0),
          },
          receipt,
        };

        await this.idempotency.release(key, result);
        return result;
      } catch (error) {
        await this.idempotency.remove(key);
        throw this.wrapError(error);
      }
    });
  }

  /**
   * Accept a buy offer.
   */
  async acceptOffer(
    offerId: bigint | string | number,
  ): Promise<TransactionResult<void>> {
    return this.telemetry.wrapAsync("market.acceptOffer", async () => {
      this.requireSigner();
      const oid = BigInt(offerId);

      const contract = this.getMarketplace();
      const overrides = await this.gasManager.buildGasOverrides("acceptOffer");

      const acceptOfferFn = contract.getFunction("acceptOffer");
      const tx = await acceptOfferFn(oid, overrides);
      const receipt = await tx.wait();

      return {
        txHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed,
        data: undefined as void,
        receipt,
      };
    });
  }

  /**
   * Cancel an offer (only by the offer creator).
   */
  async cancelOffer(
    offerId: bigint | string | number,
  ): Promise<TransactionResult<void>> {
    return this.telemetry.wrapAsync("market.cancelOffer", async () => {
      this.requireSigner();
      const contract = this.getMarketplace();
      const overrides = await this.gasManager.buildGasOverrides("cancelOffer");

      const cancelOfferFn = contract.getFunction("cancelOffer");
      const tx = await cancelOfferFn(BigInt(offerId), overrides);
      const receipt = await tx.wait();

      return {
        txHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed,
        data: undefined as void,
        receipt,
      };
    });
  }

  /**
   * Cancel a listing (only by the listing creator).
   */
  async cancelListing(
    listingId: bigint | string | number,
  ): Promise<TransactionResult<void>> {
    return this.telemetry.wrapAsync("market.cancelListing", async () => {
      this.requireSigner();
      const contract = this.getMarketplace();
      const overrides = await this.gasManager.buildGasOverrides("cancelListing");

      const cancelListingFn = contract.getFunction("cancelListing");
      const tx = await cancelListingFn(BigInt(listingId), overrides);
      const receipt = await tx.wait();

      return {
        txHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed,
        data: undefined as void,
        receipt,
      };
    });
  }

  // ============================================
  // Batch Operations
  // ============================================

  /**
   * Purchase from multiple listings in a single pass.
   *
   * Executes purchases concurrently using `Promise.allSettled` to maximize
   * throughput. Each purchase is an independent on-chain transaction.
   *
   * When a future MarketplaceBatcher contract is deployed, this method
   * will automatically use atomic multicall to batch all purchases into
   * a single transaction (1 signature instead of N).
   *
   * @param purchases - Array of { listingId, amount } to buy
   * @returns Array of results for each purchase (settled)
   */
  async batchPurchase(
    purchases: Array<{ listingId: bigint; amount: bigint }>,
  ): Promise<{
    results: Array<{
      listingId: bigint;
      success: boolean;
      txHash?: string;
      tokenId?: bigint;
      totalPaid?: bigint;
      error?: string;
    }>;
    successCount: number;
    failCount: number;
    totalPaid: bigint;
  }> {
    return this.telemetry.wrapAsync("market.batchPurchase", async () => {
      this.requireSigner();

      if (purchases.length === 0) {
        return { results: [], successCount: 0, failCount: 0, totalPaid: 0n };
      }

      // Single purchase: fast path
      if (purchases.length === 1) {
        const p = purchases[0];
        if (!p) {
          return { results: [], successCount: 0, failCount: 0, totalPaid: 0n };
        }
        try {
          const result = await this.purchase(p.listingId, p.amount);
          return {
            results: [{
              listingId: p.listingId,
              success: true,
              txHash: result.txHash,
              tokenId: result.data.tokenId,
              totalPaid: result.data.totalPaid,
            }],
            successCount: 1,
            failCount: 0,
            totalPaid: result.data.totalPaid,
          };
        } catch (error) {
          return {
            results: [{
              listingId: p.listingId,
              success: false,
              error: (error as Error).message,
            }],
            successCount: 0,
            failCount: 1,
            totalPaid: 0n,
          };
        }
      }

      // Multiple purchases: execute concurrently with nonce management
      // We serialize to avoid nonce conflicts on the same signer
      const results: Array<{
        listingId: bigint;
        success: boolean;
        txHash?: string;
        tokenId?: bigint;
        totalPaid?: bigint;
        error?: string;
      }> = [];

      let totalPaid = 0n;
      let successCount = 0;
      let failCount = 0;

      for (const p of purchases) {
        try {
          const result = await this.purchase(p.listingId, p.amount);
          results.push({
            listingId: p.listingId,
            success: true,
            txHash: result.txHash,
            tokenId: result.data.tokenId,
            totalPaid: result.data.totalPaid,
          });
          totalPaid += result.data.totalPaid;
          successCount++;
        } catch (error) {
          results.push({
            listingId: p.listingId,
            success: false,
            error: (error as Error).message,
          });
          failCount++;
          // Continue with remaining purchases — don't fail the whole batch
        }
      }

      return { results, successCount, failCount, totalPaid };
    });
  }

  // ============================================
  // Read Operations
  // ============================================

  /**
   * Get a listing by ID (on-chain read).
   */
  async getListing(listingId: bigint | string | number): Promise<Record<string, unknown>> {
    return this.telemetry.wrapAsync("market.getListing", async () => {
      const contract = this.getMarketplace();
      const getListingFn = contract.getFunction("getListing");
      const result = await withRetry(
        () => getListingFn(BigInt(listingId)),
        this.config.retry,
      );
      return {
        listingId: BigInt(result.listingId || 0),
        seller: result.seller as string,
        tokenId: BigInt(result.tokenId || 0),
        amount: BigInt(result.amount || 0),
        pricePerUnit: BigInt(result.pricePerUnit || 0),
        minPurchaseAmount: BigInt(result.minPurchaseAmount || 0),
        isActive: Boolean(result.isActive),
        createdAt: Number(result.createdAt || 0),
        expiresAt: Number(result.expiresAt || 0),
      };
    });
  }

  /**
   * Get an offer by ID (on-chain read).
   */
  async getOffer(offerId: bigint | string | number): Promise<Record<string, unknown>> {
    return this.telemetry.wrapAsync("market.getOffer", async () => {
      const contract = this.getMarketplace();
      const getOfferFn = contract.getFunction("getOffer");
      const result = await withRetry(
        () => getOfferFn(BigInt(offerId)),
        this.config.retry,
      );
      return {
        offerId: BigInt(result.offerId || 0),
        buyer: result.buyer as string,
        tokenId: BigInt(result.tokenId || 0),
        amount: BigInt(result.amount || 0),
        pricePerUnit: BigInt(result.pricePerUnit || 0),
        depositAmount: BigInt(result.depositAmount || 0),
        isActive: Boolean(result.isActive),
        createdAt: Number(result.createdAt || 0),
        expiresAt: Number(result.expiresAt || 0),
      };
    });
  }

  /**
   * Get paginated listing details for a token ID (on-chain).
   */
  async getListings(
    tokenId: bigint | string | number,
    options?: Partial<PaginationInput>,
  ): Promise<PaginatedResult<ListingSummary>> {
    return this.telemetry.wrapAsync("market.getListings", async () => {
      const contract = this.getMarketplace();
      const pagination = PaginationSchema.parse(options || {});

      const getPaginatedListingDetailsFn = contract.getFunction("getPaginatedListingDetails");
      const [items, totalCount, hasMore] = await withRetry(
        () =>
          getPaginatedListingDetailsFn(
            BigInt(tokenId),
            BigInt(pagination.offset),
            BigInt(pagination.limit),
          ),
        this.config.retry,
      );

      return {
        items: (items as Array<Record<string, unknown>>).map((item) => ({
          listingId: BigInt((item.listingId as bigint | string | number) || 0),
          tokenId: BigInt((item.tokenId as bigint | string | number) || 0),
          amount: BigInt((item.amount as bigint | string | number) || 0),
          pricePerUnit: BigInt((item.pricePerUnit as bigint | string | number) || 0),
          seller: item.seller as string,
        })),
        total: Number(totalCount),
        offset: pagination.offset,
        limit: pagination.limit,
        hasMore: Boolean(hasMore),
      };
    });
  }

  /**
   * Get market statistics (from subgraph).
   */
  async getMarketStats(): Promise<Record<string, unknown>> {
    return this.telemetry.wrapAsync("market.getMarketStats", async () => {
      const url =
        this.config.subgraphUrl ||
        SUBGRAPH_URLS[this.config.network] ||
        "";

      if (!url) {
        throw new SubgraphError("No subgraph URL configured");
      }

      const query = `{
        marketStats(id: "global") {
          totalVolume
          totalTransactions
          totalListings
          activeListings
          averagePrice
          floorPrice
        }
      }`;

      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });

      const json = (await response.json()) as {
        data?: { marketStats?: Record<string, unknown> };
      };
      return json.data?.marketStats || {};
    });
  }

  // ============================================
  // Pure Calculations
  // ============================================

  /**
   * Calculate price breakdown for a purchase (pure, no RPC call).
   *
   * @param pricePerUnit - Price per credit in wei
   * @param amount - Number of credits
   * @returns Price breakdown with subtotal, platform fee, and total
   */
  calculatePrice(
    pricePerUnit: bigint,
    amount: bigint,
  ): PriceBreakdown {
    const subtotal = pricePerUnit * amount;
    const platformFee =
      (subtotal * BigInt(PLATFORM_CONFIG.platformFeeBps)) /
      BigInt(PLATFORM_CONFIG.BPS_SCALE);
    const total = subtotal + platformFee;

    return {
      subtotal,
      platformFee,
      total,
      feeBps: PLATFORM_CONFIG.platformFeeBps,
    };
  }

  // ============================================
  // Private Helpers
  // ============================================

  private getMarketplace(): ethers.Contract {
    if (!this.marketplace) {
      this.marketplace = new ethers.Contract(
        this.config.addresses.carbonMarketplace,
        CarbonMarketplaceABI,
        this.config.signer || this.config.provider,
      );
    }
    return this.marketplace;
  }

  private getMarketplaceInterface(): ethers.Interface {
    if (!this.marketplaceInterface) {
      this.marketplaceInterface = new ethers.Interface(CarbonMarketplaceABI);
    }
    return this.marketplaceInterface;
  }

  private requireSigner(): void {
    if (!this.config.signer) {
      throw new AuthenticationError();
    }
  }

  private wrapError(error: unknown): TerraQuraError {
    if (error instanceof TerraQuraError) return error;
    return TerraQuraError.fromContractRevert(error);
  }
}
