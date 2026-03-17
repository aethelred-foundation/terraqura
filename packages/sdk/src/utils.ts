/**
 * @terraqura/sdk — Utilities
 *
 * Retry logic, idempotency store, provider management,
 * address validation, and formatting helpers.
 */

import { ethers } from "ethers";

import { NETWORK_CONFIGS, type NetworkName } from "./constants.js";
import {
  ValidationError,
  IdempotencyError,
  TimeoutError,
} from "./errors.js";

import type { RetryConfig } from "./types.js";

// ============================================
// Default Configurations
// ============================================

export const DEFAULT_RETRY_CONFIG: Required<RetryConfig> = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30_000,
  retryableErrors: [
    "NETWORK_ERROR",
    "SERVER_ERROR",
    "TIMEOUT",
    "ECONNREFUSED",
    "ECONNRESET",
    "ETIMEDOUT",
    "NONCE_EXPIRED",
    "REPLACEMENT_UNDERPRICED",
  ],
};

// ============================================
// Retry with Exponential Backoff
// ============================================

/**
 * Execute an async function with exponential backoff retry.
 *
 * @param fn - The async function to execute
 * @param config - Retry configuration
 * @returns The result of the function
 * @throws The last error if all retries are exhausted
 *
 * @example
 * ```ts
 * const result = await withRetry(
 *   () => provider.getBlock("latest"),
 *   { maxRetries: 3, baseDelayMs: 1000 }
 * );
 * ```
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  config: Partial<RetryConfig> = {},
): Promise<T> {
  const resolved: Required<RetryConfig> = {
    ...DEFAULT_RETRY_CONFIG,
    ...config,
  };

  let lastError: unknown;

  for (let attempt = 0; attempt <= resolved.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Check if error is retryable
      const errorCode =
        (error as Record<string, unknown>)?.code?.toString() || "";
      const errorMessage =
        (error as Error)?.message || "";
      const isRetryable = resolved.retryableErrors.some(
        (code) =>
          errorCode.includes(code) || errorMessage.includes(code),
      );

      if (!isRetryable || attempt === resolved.maxRetries) {
        throw error;
      }

      // Exponential backoff with jitter
      const baseDelay = resolved.baseDelayMs * Math.pow(2, attempt);
      const jitter = Math.random() * resolved.baseDelayMs;
      const delay = Math.min(baseDelay + jitter, resolved.maxDelayMs);

      await sleep(delay);
    }
  }

  throw lastError;
}

// ============================================
// Idempotency Store — Pluggable Backend
// ============================================

/** Serializable idempotency entry (safe for external stores like Redis/DynamoDB) */
export interface IdempotencyEntry {
  status: "pending" | "completed";
  result?: unknown;
  createdAt: number;
  expiresAt: number;
}

/**
 * Pluggable backend interface for idempotency persistence.
 *
 * Implement this interface to use Redis, DynamoDB, Upstash, or any
 * other persistent store. This solves the serverless cold-start problem
 * where in-memory state is lost between AWS Lambda / Cloud Function invocations.
 *
 * @example Redis adapter
 * ```ts
 * import Redis from "ioredis";
 *
 * class RedisIdempotencyBackend implements IIdempotencyBackend {
 *   constructor(private redis: Redis) {}
 *
 *   async get(key: string) {
 *     const raw = await this.redis.get(`idempotency:${key}`);
 *     return raw ? JSON.parse(raw) : undefined;
 *   }
 *
 *   async set(key: string, entry: IdempotencyEntry) {
 *     const ttlMs = entry.expiresAt - Date.now();
 *     if (ttlMs > 0) {
 *       await this.redis.set(
 *         `idempotency:${key}`,
 *         JSON.stringify(entry),
 *         "PX", ttlMs,
 *       );
 *     }
 *   }
 *
 *   async delete(key: string) {
 *     await this.redis.del(`idempotency:${key}`);
 *   }
 *
 *   async destroy() {
 *     // Optional: disconnect Redis if owned by the store
 *   }
 * }
 * ```
 *
 * @example DynamoDB adapter
 * ```ts
 * import { DynamoDBClient, GetItemCommand, PutItemCommand, DeleteItemCommand } from "@aws-sdk/client-dynamodb";
 *
 * class DynamoIdempotencyBackend implements IIdempotencyBackend {
 *   constructor(private client: DynamoDBClient, private table: string) {}
 *
 *   async get(key: string) {
 *     const result = await this.client.send(new GetItemCommand({
 *       TableName: this.table,
 *       Key: { pk: { S: key } },
 *     }));
 *     if (!result.Item) return undefined;
 *     return JSON.parse(result.Item.data.S!) as IdempotencyEntry;
 *   }
 *
 *   async set(key: string, entry: IdempotencyEntry) {
 *     await this.client.send(new PutItemCommand({
 *       TableName: this.table,
 *       Item: {
 *         pk: { S: key },
 *         data: { S: JSON.stringify(entry) },
 *         ttl: { N: String(Math.floor(entry.expiresAt / 1000)) },
 *       },
 *     }));
 *   }
 *
 *   async delete(key: string) {
 *     await this.client.send(new DeleteItemCommand({
 *       TableName: this.table,
 *       Key: { pk: { S: key } },
 *     }));
 *   }
 * }
 * ```
 */
export interface IIdempotencyBackend {
  /** Get an entry by key. Return undefined if not found or expired. */
  get(key: string): Promise<IdempotencyEntry | undefined> | IdempotencyEntry | undefined;
  /** Set an entry with TTL (backend should auto-expire based on expiresAt). */
  set(key: string, entry: IdempotencyEntry): Promise<void> | void;
  /** Delete an entry (e.g., on failure, so retry is allowed). */
  delete(key: string): Promise<void> | void;
  /** Optional: cleanup resources (disconnect connections, clear timers). */
  destroy?(): Promise<void> | void;
}

/**
 * Default in-memory idempotency backend.
 * Suitable for long-running servers, CLI tools, and development.
 *
 * ⚠️ NOT suitable for serverless (Lambda, Cloud Functions).
 * For serverless, provide a Redis or DynamoDB backend via the
 * `idempotencyBackend` config option.
 */
export class InMemoryIdempotencyBackend implements IIdempotencyBackend {
  private readonly store = new Map<string, IdempotencyEntry>();
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    // Periodic cleanup every 5 minutes
    this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000);
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }

  get(key: string): IdempotencyEntry | undefined {
    const entry = this.store.get(key);
    if (entry && entry.expiresAt > Date.now()) {
      return entry;
    }
    // Auto-clean expired entries on read
    if (entry) this.store.delete(key);
    return undefined;
  }

  set(key: string, entry: IdempotencyEntry): void {
    this.store.set(key, entry);
  }

  delete(key: string): void {
    this.store.delete(key);
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.store.clear();
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store) {
      if (entry.expiresAt <= now) {
        this.store.delete(key);
      }
    }
  }
}

/**
 * Idempotency store with pluggable persistence backend.
 *
 * Prevents duplicate transactions. Supports both in-memory (default)
 * and external stores (Redis, DynamoDB, etc.) for serverless environments.
 *
 * @example In-memory (default — long-running server)
 * ```ts
 * const store = new IdempotencyStore();
 * ```
 *
 * @example Redis (serverless-safe)
 * ```ts
 * const store = new IdempotencyStore(15 * 60 * 1000, new RedisIdempotencyBackend(redis));
 * ```
 *
 * @example DynamoDB (AWS Lambda)
 * ```ts
 * const store = new IdempotencyStore(15 * 60 * 1000, new DynamoIdempotencyBackend(client, "idempotency-table"));
 * ```
 */
export class IdempotencyStore {
  private readonly backend: IIdempotencyBackend;
  private readonly ttlMs: number;

  constructor(
    ttlMs: number = 15 * 60 * 1000,
    backend?: IIdempotencyBackend,
  ) {
    this.ttlMs = ttlMs;
    this.backend = backend ?? new InMemoryIdempotencyBackend();
  }

  /**
   * Attempt to acquire an idempotency lock.
   * @returns true if the lock was acquired
   * @throws IdempotencyError if a pending/completed entry exists
   */
  async acquire(key: string): Promise<boolean> {
    const existing = await this.backend.get(key);

    if (existing && existing.expiresAt > Date.now()) {
      if (existing.status === "pending") {
        throw new IdempotencyError(key, { status: "pending" });
      }
      if (existing.status === "completed") {
        throw new IdempotencyError(key, {
          status: "completed",
          result: existing.result,
        });
      }
      return false;
    }

    await this.backend.set(key, {
      status: "pending",
      createdAt: Date.now(),
      expiresAt: Date.now() + this.ttlMs,
    });
    return true;
  }

  /** Mark an operation as completed with its result */
  async release(key: string, result?: unknown): Promise<void> {
    const entry = await this.backend.get(key);
    if (entry) {
      entry.status = "completed";
      entry.result = result;
      await this.backend.set(key, entry);
    }
  }

  /** Remove an entry (e.g., on failure, so retry is allowed) */
  async remove(key: string): Promise<void> {
    await this.backend.delete(key);
  }

  /** Check if a key exists and is not expired */
  async check(key: string): Promise<IdempotencyEntry | undefined> {
    const entry = await this.backend.get(key);
    if (entry && entry.expiresAt > Date.now()) {
      return entry;
    }
    return undefined;
  }

  /** Destroy the store and cleanup resources */
  async destroy(): Promise<void> {
    if (this.backend.destroy) {
      await this.backend.destroy();
    }
  }
}

// ============================================
// Idempotency Key Generation
// ============================================

/**
 * Generate a deterministic idempotency key from operation parameters.
 *
 * @param module - Module name (e.g., "market", "offset")
 * @param operation - Operation name (e.g., "purchase", "retire")
 * @param params - Operation parameters to hash
 * @returns Idempotency key in format `tq_{module}_{operation}_{hash}`
 *
 * @example
 * ```ts
 * const key = createIdempotencyKey("market", "purchase", { listingId: 1, amount: 100 });
 * // "tq_market_purchase_a1b2c3d4..."
 * ```
 */
export function createIdempotencyKey(
  module: string,
  operation: string,
  params: unknown,
): string {
  const canonical = JSON.stringify(params, (_key, value) =>
    typeof value === "bigint" ? value.toString() : value,
  );
  const hash = ethers.keccak256(ethers.toUtf8Bytes(canonical)).slice(2, 18);
  return `tq_${module}_${operation}_${hash}`;
}

// ============================================
// Provider Management
// ============================================

/**
 * Create an ethers v6 FallbackProvider with tiered RPC endpoints.
 *
 * @param rpcUrls - Ordered array of RPC URLs (first = highest priority)
 * @param chainId - Target chain ID
 * @returns ethers.FallbackProvider with ranked providers
 */
export function createFallbackProvider(
  rpcUrls: readonly string[],
  chainId: number,
): ethers.FallbackProvider {
  const providers = rpcUrls.map((url, index) => ({
    provider: new ethers.JsonRpcProvider(url, chainId, {
      staticNetwork: true,
      batchMaxCount: 10,
    }),
    priority: index + 1,
    stallTimeout: 2000 + index * 1000,
    weight: 1,
  }));

  return new ethers.FallbackProvider(providers, chainId, {
    quorum: 1,
    eventQuorum: 1,
  });
}

/**
 * Create a provider based on SDK configuration.
 *
 * @param config - Network name and optional custom RPC URL
 * @returns ethers.Provider instance
 */
export function createProvider(config: {
  rpcUrl?: string;
  network: NetworkName;
}): ethers.Provider {
  const networkConfig = NETWORK_CONFIGS[config.network];

  if (config.rpcUrl) {
    return new ethers.JsonRpcProvider(config.rpcUrl, networkConfig.chainId, {
      staticNetwork: true,
    });
  }

  return createFallbackProvider(
    networkConfig.rpcUrls,
    networkConfig.chainId,
  );
}

// ============================================
// Address & Input Validation
// ============================================

/**
 * Validate and checksum an Ethereum address.
 * @throws ValidationError if the address is invalid
 */
export function validateAddress(address: string): string {
  try {
    return ethers.getAddress(address);
  } catch {
    throw new ValidationError(`Invalid Ethereum address: ${address}`, {
      field: "address",
      value: address,
    });
  }
}

/**
 * Encode a human-readable string to a bytes32 hex value.
 *
 * @example
 * ```ts
 * const dacId = encodeBytes32("DAC-001");
 * ```
 */
export function encodeBytes32(value: string): string {
  return ethers.keccak256(ethers.toUtf8Bytes(value));
}

/**
 * Check if a string is already a valid bytes32 hex value.
 */
export function isBytes32(value: string): boolean {
  return /^0x[a-fA-F0-9]{64}$/.test(value);
}

/**
 * Ensure a value is a proper bytes32. If it's already a hex string, return as-is.
 * If it's a human-readable name, keccak256 hash it.
 */
export function toBytes32(value: string): string {
  if (isBytes32(value)) {
    return value;
  }
  return encodeBytes32(value);
}

// ============================================
// Formatting Helpers
// ============================================

/**
 * Format wei to a human-readable string.
 *
 * @param wei - Amount in wei
 * @param decimals - Number of decimals (default: 18)
 * @returns Formatted string (e.g., "1.5")
 */
export function formatWei(wei: bigint, decimals: number = 18): string {
  return ethers.formatUnits(wei, decimals);
}

/**
 * Parse a human-readable amount to wei.
 *
 * @param value - Human-readable amount (e.g., "1.5")
 * @param decimals - Number of decimals (default: 18)
 * @returns Amount in wei
 */
export function parseWei(value: string, decimals: number = 18): bigint {
  return ethers.parseUnits(value, decimals);
}

/**
 * Shorten an Ethereum address for display.
 *
 * @example
 * ```ts
 * shortenAddress("0x1234...abcd"); // "0x1234...abcd"
 * ```
 */
export function shortenAddress(address: string, chars: number = 4): string {
  if (!address) return "";
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
}

/**
 * Format CO2 amount for human-readable display.
 *
 * @param kg - Amount in kilograms
 * @returns Formatted string (e.g., "1.5 tonnes", "500 kg")
 */
export function formatCO2(kg: number): string {
  if (kg >= 1000) {
    const tonnes = kg / 1000;
    return `${tonnes.toFixed(tonnes % 1 === 0 ? 0 : 2)} tonnes CO\u2082`;
  }
  return `${kg} kg CO\u2082`;
}

// ============================================
// General Utilities
// ============================================

/** Sleep for a given number of milliseconds */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Execute a function with a timeout.
 * @throws TimeoutError if the function doesn't complete within the timeout
 */
export async function withTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number,
  operationName: string = "operation",
): Promise<T> {
  return Promise.race([
    fn(),
    new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new TimeoutError(operationName, timeoutMs)),
        timeoutMs,
      ),
    ),
  ]);
}

/**
 * Parse a transaction receipt for a specific event.
 *
 * @param receipt - The transaction receipt
 * @param contract - The contract interface
 * @param eventName - The event name to search for
 * @returns The parsed event arguments, or null if not found
 */
export function parseEventFromReceipt(
  receipt: ethers.TransactionReceipt,
  contractInterface: ethers.Interface,
  eventName: string,
): Record<string, unknown> | null {
  for (const log of receipt.logs) {
    try {
      const parsed = contractInterface.parseLog({
        topics: log.topics as string[],
        data: log.data,
      });
      if (parsed?.name === eventName) {
        const result: Record<string, unknown> = {};
        for (const key of Object.keys(parsed.args)) {
          if (isNaN(Number(key))) {
            result[key] = parsed.args[key];
          }
        }
        return result;
      }
    } catch {
      // Skip logs that don't match this contract's interface
      continue;
    }
  }
  return null;
}
