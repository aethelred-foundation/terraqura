import { vi } from "vitest";
import type { Job } from "bullmq";

/**
 * Creates a mock BullMQ Job object with the given data.
 * Includes stubs for updateProgress, log, and other Job methods.
 */
export function createMockJob<T>(
  data: T,
  overrides?: Partial<Job<T>>
): Job<T> {
  return {
    id: "test-job-1",
    name: "test-job",
    data,
    attemptsMade: 0,
    opts: {},
    timestamp: Date.now(),
    returnvalue: undefined,
    failedReason: undefined,
    stacktrace: [],
    progress: 0,
    updateProgress: vi.fn().mockResolvedValue(undefined),
    log: vi.fn().mockResolvedValue(undefined),
    moveToCompleted: vi.fn().mockResolvedValue(undefined),
    moveToFailed: vi.fn().mockResolvedValue(undefined),
    isCompleted: vi.fn().mockResolvedValue(false),
    isFailed: vi.fn().mockResolvedValue(false),
    isActive: vi.fn().mockResolvedValue(true),
    isWaiting: vi.fn().mockResolvedValue(false),
    isDelayed: vi.fn().mockResolvedValue(false),
    getState: vi.fn().mockResolvedValue("active"),
    remove: vi.fn().mockResolvedValue(undefined),
    retry: vi.fn().mockResolvedValue(undefined),
    discard: vi.fn().mockResolvedValue(undefined),
    extendLock: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as Job<T>;
}

/**
 * Sets up the runtime environment variables needed by processors.
 * Call in beforeEach and clean up in afterEach.
 */
export function setupMockRuntimeEnv(overrides?: Record<string, string>): void {
  const defaults: Record<string, string> = {
    KYC_PROVIDER: "sumsub",
    SUMSUB_APP_TOKEN: "test-sumsub-app-token",
    SUMSUB_SECRET_KEY: "test-sumsub-secret-key",
    ONFIDO_API_TOKEN: "test-onfido-api-token",
    AETHELRED_RPC_URL: "https://rpc-testnet.aethelred.network",
    MINTER_PRIVATE_KEY:
      "0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    CARBON_CREDIT_CONTRACT: "0x1234567890123456789012345678901234567890",
    VERIFICATION_ENGINE_CONTRACT:
      "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
  };

  const merged = { ...defaults, ...overrides };
  for (const [key, value] of Object.entries(merged)) {
    process.env[key] = value;
  }
}

/**
 * Clears the runtime environment variables set by setupMockRuntimeEnv.
 */
export function cleanupMockRuntimeEnv(): void {
  const keys = [
    "KYC_PROVIDER",
    "SUMSUB_APP_TOKEN",
    "SUMSUB_SECRET_KEY",
    "ONFIDO_API_TOKEN",
    "AETHELRED_RPC_URL",
    "MINTER_PRIVATE_KEY",
    "CARBON_CREDIT_CONTRACT",
    "VERIFICATION_ENGINE_CONTRACT",
  ];
  for (const key of keys) {
    delete process.env[key];
  }
}

/**
 * Creates a mock ethers provider with common methods stubbed.
 */
export function createMockProvider() {
  return {
    getNetwork: vi.fn().mockResolvedValue({ chainId: 1n, name: "aethelred" }),
    getBlockNumber: vi.fn().mockResolvedValue(1000),
    getFeeData: vi.fn().mockResolvedValue({
      maxFeePerGas: 50000000000n, // 50 gwei
      maxPriorityFeePerGas: 2000000000n, // 2 gwei
      gasPrice: 50000000000n,
    }),
    getBalance: vi.fn().mockResolvedValue(1000000000000000000n),
    getTransactionReceipt: vi.fn(),
    waitForTransaction: vi.fn(),
  };
}

/**
 * Creates a mock ethers contract with configurable method stubs.
 */
export function createMockContract(methods?: Record<string, unknown>) {
  const contract: Record<string, unknown> = {
    target: "0x1234567890123456789012345678901234567890",
    interface: {
      parseLog: vi.fn(),
    },
    ...methods,
  };
  return contract;
}

/**
 * Creates a mock transaction response from ethers.
 */
export function createMockTxResponse(overrides?: Record<string, unknown>) {
  return {
    hash: "0xmocktxhash123456789",
    wait: vi.fn().mockResolvedValue({
      status: 1,
      gasUsed: 150000n,
      logs: [],
      ...overrides,
    }),
    ...overrides,
  };
}

/**
 * Helper to create a mock fetch response.
 */
export function createMockFetchResponse(
  body: unknown,
  options?: { ok?: boolean; status?: number }
) {
  return {
    ok: options?.ok ?? true,
    status: options?.status ?? 200,
    json: vi.fn().mockResolvedValue(body),
    text: vi.fn().mockResolvedValue(JSON.stringify(body)),
    headers: new Headers(),
  } as unknown as Response;
}
