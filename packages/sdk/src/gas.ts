/**
 * @terraqura/sdk — Gas Manager
 *
 * Automatic gas estimation and management for Aethelred (EIP-1559).
 * Includes configurable multiplier, priority fee defaults, and caching.
 */

import { ethers } from "ethers";

import type { GasConfig, GasEstimate, GasPriceInfo } from "./types.js";

// ============================================
// Default Gas Limits per Operation
// ============================================

/** Pre-configured gas limits per operation type */
export const DEFAULT_GAS_LIMITS: Record<string, bigint> = {
  mint: 350_000n,
  retire: 150_000n,
  createListing: 200_000n,
  purchase: 250_000n,
  createOffer: 200_000n,
  acceptOffer: 200_000n,
  cancelOffer: 100_000n,
  cancelListing: 100_000n,
} as const;

/** Default gas configuration */
export const DEFAULT_GAS_CONFIG: Required<GasConfig> = {
  multiplier: 1.2,
  maxGasPrice: ethers.parseUnits("500", "gwei"),
  maxPriorityFee: ethers.parseUnits("30", "gwei"), // Aethelred recommended
  cacheTtlMs: 15_000,
  gasLimits: {},
};

// ============================================
// Gas Manager
// ============================================

/**
 * Gas estimation and management for Aethelred EIP-1559 transactions.
 *
 * Features:
 * - Cached gas prices with configurable TTL
 * - Configurable gas estimate multiplier
 * - Per-operation gas limit defaults
 * - maxPriorityFeePerGas support for Aethelred
 *
 * @example
 * ```ts
 * const gasManager = new GasManager(provider, { multiplier: 1.3 });
 * const overrides = await gasManager.buildGasOverrides("purchase");
 * const tx = await marketplace.purchase(listingId, amount, overrides);
 * ```
 */
export class GasManager {
  private readonly provider: ethers.Provider;
  private readonly config: Required<GasConfig>;
  private cachedGasPrice: GasPriceInfo | null = null;

  constructor(provider: ethers.Provider, config: Partial<GasConfig> = {}) {
    this.provider = provider;
    this.config = { ...DEFAULT_GAS_CONFIG, ...config };
  }

  /**
   * Get the current gas price with caching.
   * Falls back to legacy gasPrice if EIP-1559 data is unavailable.
   */
  async getGasPrice(): Promise<GasPriceInfo> {
    // Return cached value if still fresh
    if (
      this.cachedGasPrice &&
      Date.now() - this.cachedGasPrice.fetchedAt < this.config.cacheTtlMs
    ) {
      return this.cachedGasPrice;
    }

    const feeData = await this.provider.getFeeData();

    let maxFeePerGas: bigint;
    let maxPriorityFeePerGas: bigint;
    let baseFee: bigint;

    if (feeData.maxFeePerGas && feeData.maxPriorityFeePerGas) {
      // EIP-1559 available
      maxFeePerGas = feeData.maxFeePerGas;
      maxPriorityFeePerGas = feeData.maxPriorityFeePerGas;

      // Use configured priority fee if it's higher (Aethelred needs higher priority)
      if (maxPriorityFeePerGas < this.config.maxPriorityFee) {
        maxPriorityFeePerGas = this.config.maxPriorityFee;
        // Adjust maxFeePerGas to account for higher priority
        const extraPriority =
          this.config.maxPriorityFee - feeData.maxPriorityFeePerGas;
        maxFeePerGas = maxFeePerGas + extraPriority;
      }

      baseFee = feeData.maxFeePerGas - feeData.maxPriorityFeePerGas;
    } else if (feeData.gasPrice) {
      // Legacy gas pricing fallback
      maxFeePerGas = feeData.gasPrice;
      maxPriorityFeePerGas = this.config.maxPriorityFee;
      baseFee = feeData.gasPrice - maxPriorityFeePerGas;
    } else {
      // Absolute fallback
      maxFeePerGas = ethers.parseUnits("50", "gwei");
      maxPriorityFeePerGas = this.config.maxPriorityFee;
      baseFee = maxFeePerGas - maxPriorityFeePerGas;
    }

    // Cap at max gas price
    if (maxFeePerGas > this.config.maxGasPrice) {
      maxFeePerGas = this.config.maxGasPrice;
    }

    this.cachedGasPrice = {
      maxFeePerGas,
      maxPriorityFeePerGas,
      baseFee: baseFee < 0n ? 0n : baseFee,
      fetchedAt: Date.now(),
    };

    return this.cachedGasPrice;
  }

  /**
   * Estimate gas for a transaction with configurable multiplier.
   */
  async estimateGas(
    tx: ethers.TransactionRequest,
  ): Promise<GasEstimate> {
    const [gasEstimate, gasPrice] = await Promise.all([
      this.provider.estimateGas(tx),
      this.getGasPrice(),
    ]);

    // Apply multiplier for safety margin
    const multiplied = BigInt(
      Math.ceil(Number(gasEstimate) * this.config.multiplier),
    );

    const estimatedCostWei = multiplied * gasPrice.maxFeePerGas;

    return {
      gasLimit: multiplied,
      maxFeePerGas: gasPrice.maxFeePerGas,
      maxPriorityFeePerGas: gasPrice.maxPriorityFeePerGas,
      estimatedCostWei,
      estimatedCostAeth: ethers.formatEther(estimatedCostWei),
    };
  }

  /**
   * Build gas override parameters ready to spread into a contract call.
   *
   * @param operation - Optional operation name to look up default gas limit
   * @returns ethers.Overrides with gas parameters
   *
   * @example
   * ```ts
   * const overrides = await gasManager.buildGasOverrides("purchase");
   * const tx = await marketplace.purchase(listingId, amount, overrides);
   * ```
   */
  async buildGasOverrides(
    operation?: string,
  ): Promise<ethers.Overrides> {
    const gasPrice = await this.getGasPrice();

    const overrides: ethers.Overrides = {
      maxFeePerGas: gasPrice.maxFeePerGas,
      maxPriorityFeePerGas: gasPrice.maxPriorityFeePerGas,
    };

    // Apply operation-specific gas limit if available
    if (operation) {
      const customLimit = this.config.gasLimits[operation];
      const defaultLimit = DEFAULT_GAS_LIMITS[operation];
      const limit = customLimit || defaultLimit;

      if (limit) {
        overrides.gasLimit = limit;
      }
    }

    return overrides;
  }

  /** Force-invalidate the gas price cache */
  invalidateCache(): void {
    this.cachedGasPrice = null;
  }

  /** Get the current configuration */
  getConfig(): Required<GasConfig> {
    return { ...this.config };
  }
}
