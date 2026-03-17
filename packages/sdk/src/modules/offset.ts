/**
 * @terraqura/sdk — Offset Module
 *
 * One-click carbon offset: find cheapest credits, purchase, retire,
 * and generate certificate — all in a single method call.
 */

import { ethers } from "ethers";

import { generateCertificateSVG } from "../certificate.js";
import { CarbonCreditABI, SUBGRAPH_URLS } from "../constants.js";
import {
  AuthenticationError,
  TerraQuraError,
  SubgraphError,
  InsufficientBalanceError,
  ValidationError,
} from "../errors.js";
import { OffsetFootprintSchema } from "../types.js";
import {
  createIdempotencyKey,
  formatCO2,
  shortenAddress,
} from "../utils.js";

import type { GasManager } from "../gas.js";
import type { ITelemetry } from "../telemetry.js";
import type {
  InternalConfig,
  OffsetResult,
  OffsetEstimate,
  PriceBreakdown,
  ListingSummary,
  RetirementRecord,
  CertificateData,
} from "../types.js";
import type { IdempotencyStore } from "../utils.js";
import type { AssetsModule } from "./assets.js";
import type { MarketModule } from "./market.js";

// ============================================
// Offset Module
// ============================================

/**
 * One-click carbon offset — the flagship feature.
 *
 * Automates the entire carbon offset workflow:
 * 1. Find cheapest available credits on the marketplace
 * 2. Purchase credits to cover the desired CO2 amount
 * 3. Retire credits on-chain with a reason
 * 4. Generate an SVG certificate
 *
 * @example
 * ```ts
 * const client = new TerraQuraClient({ network: "aethelred-testnet", privateKey: "0x..." });
 *
 * // One-click offset
 * const result = await client.offset.offsetFootprint(1000, "Carbon neutral Q1 2026");
 * console.log(`Retired ${result.amountRetiredKg} kg CO2`);
 * console.log(`Cost: ${ethers.formatEther(result.cost.total)} AETH`);
 *
 * // Preview cost without executing
 * const estimate = await client.offset.estimateOffset(500);
 * console.log(`Estimated cost: ${ethers.formatEther(estimate.estimatedCost.total)} AETH`);
 * ```
 */
export class OffsetModule {
  private readonly config: InternalConfig;
  private readonly telemetry: ITelemetry;
  private readonly gasManager: GasManager;
  private readonly idempotency: IdempotencyStore;
  private readonly market: MarketModule;
  private readonly assets: AssetsModule;
  private carbonCredit: ethers.Contract | null = null;

  constructor(
    config: InternalConfig,
    telemetry: ITelemetry,
    gasManager: GasManager,
    idempotency: IdempotencyStore,
    market: MarketModule,
    assets: AssetsModule,
  ) {
    this.config = config;
    this.telemetry = telemetry;
    this.gasManager = gasManager;
    this.idempotency = idempotency;
    this.market = market;
    this.assets = assets;
  }

  // ============================================
  // Public API
  // ============================================

  /**
   * One-click carbon offset.
   *
   * Finds the cheapest credits, purchases them, retires them on-chain,
   * and optionally generates an SVG certificate.
   *
   * @param amountKg - Amount of CO2 to offset in kilograms
   * @param reason - Retirement reason (stored on-chain)
   * @param options - Additional options
   * @returns Offset result with transaction hashes, cost, and certificate
   */
  async offsetFootprint(
    amountKg: number,
    reason: string,
    options?: { generateCertificate?: boolean },
  ): Promise<OffsetResult> {
    return this.telemetry.wrapAsync("offset.offsetFootprint", async () => {
      const signer = this.requireSigner();

      const input = OffsetFootprintSchema.parse({
        amountKg,
        reason,
        generateCertificate: options?.generateCertificate ?? true,
      });

      const key = createIdempotencyKey("offset", "offsetFootprint", {
        amountKg: input.amountKg,
        reason: input.reason,
        timestamp: Math.floor(Date.now() / 60000), // 1-minute window
      });
      await this.idempotency.acquire(key);

      try {
        // Step 1: Find cheapest available listings
        const bestListings = await this.findBestListings(input.amountKg);

        if (bestListings.length === 0) {
          throw new InsufficientBalanceError(
            `No active listings available to offset ${formatCO2(input.amountKg)}`,
          );
        }

        // Step 2: Build purchase plan — determine exactly how much from each listing
        const purchasePlan: Array<{ listingId: bigint; amount: bigint; pricePerUnit: bigint }> = [];
        let remainingKg = BigInt(input.amountKg);

        for (const listing of bestListings) {
          if (remainingKg <= 0n) break;
          const purchaseAmount = remainingKg < listing.amount ? remainingKg : listing.amount;
          purchasePlan.push({
            listingId: listing.listingId,
            amount: purchaseAmount,
            pricePerUnit: listing.pricePerUnit,
          });
          remainingKg -= purchaseAmount;
        }

        // Step 3: Execute batch purchase (uses batchPurchase for throughput)
        const batchResult = await this.market.batchPurchase(
          purchasePlan.map((p) => ({ listingId: p.listingId, amount: p.amount })),
        );

        if (batchResult.successCount === 0) {
          throw new InsufficientBalanceError(
            `All ${batchResult.failCount} purchase(s) failed during offset`,
          );
        }

        // Calculate actual cost from the purchase plan (only successful ones)
        let totalCost: PriceBreakdown = { subtotal: 0n, platformFee: 0n, total: 0n, feeBps: 250 };
        const successfulPurchases = batchResult.results.filter((r) => r.success);

        for (let i = 0; i < successfulPurchases.length; i++) {
          const plan = purchasePlan[i];
          if (!plan) {
            continue;
          }
          const cost = this.market.calculatePrice(plan.pricePerUnit, plan.amount);
          totalCost = {
            subtotal: totalCost.subtotal + cost.subtotal,
            platformFee: totalCost.platformFee + cost.platformFee,
            total: totalCost.total + cost.total,
            feeBps: cost.feeBps,
          };
        }

        // Step 4: Retire all purchased credits
        const retireTxHashes: string[] = [];
        const cc = this.getCarbonCredit();

        for (const purchase of successfulPurchases) {
          if (!purchase.tokenId) continue;
          const overrides = await this.gasManager.buildGasOverrides("retire");
          const retireFn = cc.getFunction("retireCredits");
          const tx = await retireFn(
            purchase.tokenId,
            purchasePlan.find((p) => p.listingId === purchase.listingId)?.amount ?? 0n,
            input.reason,
            overrides,
          );
          const receipt = await tx.wait();
          retireTxHashes.push(receipt.hash);
        }

        // Step 5: Generate certificate (optional)
        let certificate: string | undefined;
        if (input.generateCertificate && successfulPurchases.length > 0) {
          const firstPurchase = successfulPurchases.find((purchase) => purchase.tokenId);

          if (firstPurchase?.tokenId) {
            try {
            const provenance = await this.assets.getProvenance(
              firstPurchase.tokenId.toString(),
            );

              const signerAddress = await signer.getAddress();

              const certData: CertificateData = {
                certificateId: `TQ-${Date.now().toString(36).toUpperCase()}`,
                tokenId: firstPurchase.tokenId.toString(),
                co2AmountKg: input.amountKg,
                retirementDate: new Date(),
                retiredBy: signerAddress,
                reason: input.reason,
                dacUnitName: shortenAddress(provenance.dacUnit.dacUnitId),
                verificationStatus: provenance.verification.sourceVerified
                  ? "Fully Verified (3/3 Phases)"
                  : "Partially Verified",
                efficiencyFactor: provenance.efficiencyFactor,
                gps: provenance.gps,
                txHash: retireTxHashes[0] || "",
                gridIntensity: provenance.gridIntensity,
                network: this.config.network,
              };

              certificate = generateCertificateSVG(certData);
            } catch {
              // Certificate generation failure should not fail the offset
            }
          }
        }

        const purchaseTxHashes = successfulPurchases
          .map((purchase) => purchase.txHash)
          .filter((txHash): txHash is string => typeof txHash === "string");

        const allTxHashes = [...purchaseTxHashes, ...retireTxHashes];

        const result: OffsetResult = {
          tokenIds: successfulPurchases
            .map((purchase) => purchase.tokenId)
            .filter((tokenId): tokenId is bigint => typeof tokenId === "bigint")
            .map((tokenId) => tokenId.toString()),
          amountRetiredKg: input.amountKg,
          txHashes: allTxHashes,
          certificate,
          retirementReason: input.reason,
          cost: totalCost,
        };

        await this.idempotency.release(key, result);
        return result;
      } catch (error) {
        await this.idempotency.remove(key);
        if (error instanceof TerraQuraError) throw error;
        throw TerraQuraError.fromContractRevert(error);
      }
    });
  }

  /**
   * Estimate the cost of offsetting without executing.
   *
   * @param amountKg - Amount of CO2 to offset in kilograms
   * @returns Estimated cost and listing details
   */
  async estimateOffset(amountKg: number): Promise<OffsetEstimate> {
    return this.telemetry.wrapAsync("offset.estimateOffset", async () => {
      if (amountKg <= 0) {
        throw new ValidationError("Amount must be positive", {
          field: "amountKg",
          value: amountKg,
        });
      }

      const bestListings = await this.findBestListings(amountKg);

      let totalCost: PriceBreakdown = {
        subtotal: 0n,
        platformFee: 0n,
        total: 0n,
        feeBps: 250,
      };

      let remainingKg = BigInt(amountKg);
      let sufficientSupply = true;

      for (const listing of bestListings) {
        if (remainingKg <= 0n) break;

        const purchaseAmount =
          remainingKg < listing.amount ? remainingKg : listing.amount;

        const cost = this.market.calculatePrice(
          listing.pricePerUnit,
          purchaseAmount,
        );

        totalCost = {
          subtotal: totalCost.subtotal + cost.subtotal,
          platformFee: totalCost.platformFee + cost.platformFee,
          total: totalCost.total + cost.total,
          feeBps: cost.feeBps,
        };

        remainingKg -= purchaseAmount;
      }

      if (remainingKg > 0n) {
        sufficientSupply = false;
      }

      return {
        amountKg,
        estimatedCost: totalCost,
        bestListings,
        sufficientSupply,
      };
    });
  }

  /**
   * Get retirement history for an address from the subgraph.
   */
  async getRetirementHistory(
    address: string,
  ): Promise<RetirementRecord[]> {
    return this.telemetry.wrapAsync(
      "offset.getRetirementHistory",
      async () => {
        const url =
          this.config.subgraphUrl ||
          SUBGRAPH_URLS[this.config.network] ||
          "";

        if (!url) {
          throw new SubgraphError("No subgraph URL configured");
        }

        const query = `{
          retirements(
            where: { retiree: "${address.toLowerCase()}" }
            orderBy: timestamp
            orderDirection: desc
            first: 100
          ) {
            tokenId
            amount
            reason
            retiree
            transactionHash
            blockNumber
            timestamp
          }
        }`;

        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query }),
        });

        const json = (await response.json()) as {
          data?: { retirements?: Array<Record<string, unknown>> };
        };

        const retirements = json.data?.retirements || [];

        return retirements.map((r) => ({
          tokenId: (r.tokenId as string) || "",
          amount: BigInt((r.amount as string) || "0"),
          reason: (r.reason as string) || "",
          retiree: (r.retiree as string) || "",
          txHash: (r.transactionHash as string) || "",
          blockNumber: Number(r.blockNumber || 0),
          timestamp: Number(r.timestamp || 0),
        }));
      },
    );
  }

  /**
   * Generate an SVG certificate for an existing retirement.
   */
  async generateCertificate(
    tokenId: string,
    retirementTxHash: string,
  ): Promise<string> {
    return this.telemetry.wrapAsync(
      "offset.generateCertificate",
      async () => {
        const provenance = await this.assets.getProvenance(tokenId);
        const signerAddress = this.config.signer
          ? await this.config.signer.getAddress()
          : "Unknown";

        const certData: CertificateData = {
          certificateId: `TQ-${Date.now().toString(36).toUpperCase()}`,
          tokenId,
          co2AmountKg: provenance.metadata.co2AmountKg,
          retirementDate: new Date(),
          retiredBy: signerAddress,
          reason: "Carbon offset",
          dacUnitName: shortenAddress(provenance.dacUnit.dacUnitId),
          verificationStatus: provenance.verification.sourceVerified
            ? "Fully Verified (3/3 Phases)"
            : "Partially Verified",
          efficiencyFactor: provenance.efficiencyFactor,
          gps: provenance.gps,
          txHash: retirementTxHash,
          gridIntensity: provenance.gridIntensity,
          network: this.config.network,
        };

        return generateCertificateSVG(certData);
      },
    );
  }

  // ============================================
  // Private Helpers
  // ============================================

  /**
   * Find the best (cheapest) active listings to cover the required amount.
   * Greedy algorithm: cheapest first.
   */
  private async findBestListings(
    _amountKg: number,
  ): Promise<ListingSummary[]> {
    const url =
      this.config.subgraphUrl ||
      SUBGRAPH_URLS[this.config.network] ||
      "";

    if (!url) {
      return [];
    }

    const query = `{
      listings(
        where: { isActive: true, amount_gt: "0" }
        orderBy: pricePerUnit
        orderDirection: asc
        first: 50
      ) {
        listingId
        tokenId
        amount
        pricePerUnit
        seller
      }
    }`;

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });

      const json = (await response.json()) as {
        data?: { listings?: Array<Record<string, unknown>> };
      };

      const listings = json.data?.listings || [];

      return listings.map((l) => ({
        listingId: BigInt((l.listingId as string) || "0"),
        tokenId: BigInt((l.tokenId as string) || "0"),
        amount: BigInt((l.amount as string) || "0"),
        pricePerUnit: BigInt((l.pricePerUnit as string) || "0"),
        seller: (l.seller as string) || "",
      }));
    } catch {
      return [];
    }
  }

  private getCarbonCredit(): ethers.Contract {
    if (!this.carbonCredit) {
      this.carbonCredit = new ethers.Contract(
        this.config.addresses.carbonCredit,
        CarbonCreditABI,
        this.config.signer || this.config.provider,
      );
    }
    return this.carbonCredit;
  }

  private requireSigner(): ethers.Signer {
    const signer = this.config.signer;
    if (!signer) {
      throw new AuthenticationError();
    }
    return signer;
  }
}
