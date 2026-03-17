/**
 * Shared test helpers for TerraQura SDK tests.
 *
 * Provides mock factories for ethers Provider, Contract, fetch,
 * and a buildTestClient() function that constructs module instances
 * with fully mocked internals.
 */

import { vi } from "vitest";
import { ethers } from "ethers";

import type { InternalConfig } from "../types.js";
import type { ITelemetry } from "../telemetry.js";
import type { GasManager } from "../gas.js";
import type { IdempotencyStore } from "../utils.js";

// ============================================
// Test Constants
// ============================================

export const TEST_ADDRESSES = {
  carbonCredit: "0x29B58064fD95b175e5824767d3B18bACFafaF959",
  carbonMarketplace: "0x5a4cb32709AB829E2918F0a914FBa1e0Dab2Fdec",
  gaslessMarketplace: "0x45a65e46e8C1D588702cB659b7d3786476Be0A80",
  verificationEngine: "0x8dad7E87646e9607Fae225e3A7EAD17ce179dEA8",
  accessControl: "0x55695aAAEC30AB495074c57e85Ae2E1A4866B83b",
  circuitBreaker: "0x24192ecf06aA782F1dF69878413D217d9319e257",
  user: "0x1234567890abcdef1234567890abcdef12345678",
  operator: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
} as const;

export const TEST_DAC_UNIT_ID =
  "0x1111111111111111111111111111111111111111111111111111111111111111";

export const TEST_SOURCE_DATA_HASH =
  "0x2222222222222222222222222222222222222222222222222222222222222222";

export const TEST_TX_HASH =
  "0x3333333333333333333333333333333333333333333333333333333333333333";

// ============================================
// Mock Telemetry
// ============================================

export function mockTelemetry(): ITelemetry {
  return {
    startSpan: vi.fn().mockReturnValue({}),
    endSpan: vi.fn(),
    recordMetric: vi.fn(),
    wrapAsync: vi.fn().mockImplementation(
      async <T>(_name: string, fn: () => Promise<T>) => fn(),
    ),
  };
}

// ============================================
// Mock Provider
// ============================================

export function mockProvider(): ethers.Provider {
  return {
    getNetwork: vi.fn().mockResolvedValue({ chainId: 78432n, name: "aethelred-testnet" }),
    getBlockNumber: vi.fn().mockResolvedValue(1000),
    getBlock: vi.fn().mockResolvedValue({ timestamp: Math.floor(Date.now() / 1000) }),
    getFeeData: vi.fn().mockResolvedValue({
      gasPrice: ethers.parseUnits("50", "gwei"),
      maxFeePerGas: ethers.parseUnits("100", "gwei"),
      maxPriorityFeePerGas: ethers.parseUnits("2", "gwei"),
    }),
    estimateGas: vi.fn().mockResolvedValue(100000n),
    getBalance: vi.fn().mockResolvedValue(ethers.parseEther("10")),
    call: vi.fn().mockResolvedValue("0x"),
    getTransactionReceipt: vi.fn().mockResolvedValue(null),
  } as unknown as ethers.Provider;
}

// ============================================
// Mock Signer
// ============================================

export function mockSigner(): ethers.Signer {
  return {
    getAddress: vi.fn().mockResolvedValue(TEST_ADDRESSES.user),
    signMessage: vi.fn().mockResolvedValue("0xsignature"),
    signTransaction: vi.fn().mockResolvedValue("0xsignedtx"),
    provider: mockProvider(),
  } as unknown as ethers.Signer;
}

// ============================================
// Mock Contract
// ============================================

/**
 * Creates a mock ethers.Contract that intercepts getFunction() calls.
 * Callers can configure return values per function name via the returned
 * `functions` map.
 */
export function mockContract(
  overrides: Record<string, (...args: unknown[]) => unknown> = {},
): ethers.Contract & { __functions: Record<string, ReturnType<typeof vi.fn>> } {
  const functions: Record<string, ReturnType<typeof vi.fn>> = {};

  const getFunction = vi.fn().mockImplementation((name: string) => {
    if (overrides[name]) {
      if (!functions[name]) {
        functions[name] = vi.fn().mockImplementation(overrides[name]!);
      }
      return functions[name];
    }
    if (!functions[name]) {
      functions[name] = vi.fn().mockResolvedValue(undefined);
    }
    return functions[name];
  });

  const contract = {
    getFunction,
    getAddress: vi.fn().mockResolvedValue(TEST_ADDRESSES.carbonCredit),
    target: TEST_ADDRESSES.carbonCredit,
    interface: new ethers.Interface([]),
    __functions: functions,
  } as unknown as ethers.Contract & { __functions: Record<string, ReturnType<typeof vi.fn>> };

  return contract;
}

// ============================================
// Mock Fetch (for subgraph queries)
// ============================================

/**
 * Creates a mock global fetch that returns configured subgraph responses.
 * Returns the mock function for assertions.
 */
export function mockFetch(responseData: Record<string, unknown> = {}): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    statusText: "OK",
    json: vi.fn().mockResolvedValue({ data: responseData }),
    headers: new Headers(),
  });

  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

/**
 * Creates a mock fetch that returns an error response.
 */
export function mockFetchError(status: number = 500, statusText: string = "Internal Server Error"): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: false,
    status,
    statusText,
    json: vi.fn().mockResolvedValue({}),
    headers: new Headers(),
  });

  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

/**
 * Creates a mock fetch that returns GraphQL errors.
 */
export function mockFetchGraphQLError(errors: unknown[] = [{ message: "Query failed" }]): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    statusText: "OK",
    json: vi.fn().mockResolvedValue({ data: null, errors }),
    headers: new Headers(),
  });

  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

// ============================================
// Mock Gas Manager
// ============================================

export function mockGasManager(): GasManager {
  return {
    buildGasOverrides: vi.fn().mockResolvedValue({
      maxFeePerGas: ethers.parseUnits("100", "gwei"),
      maxPriorityFeePerGas: ethers.parseUnits("2", "gwei"),
      gasLimit: 300000n,
    }),
    getGasPrice: vi.fn().mockResolvedValue({
      maxFeePerGas: ethers.parseUnits("100", "gwei"),
      maxPriorityFeePerGas: ethers.parseUnits("2", "gwei"),
      baseFee: ethers.parseUnits("50", "gwei"),
      fetchedAt: Date.now(),
    }),
    estimateGas: vi.fn().mockResolvedValue({
      gasLimit: 300000n,
      maxFeePerGas: ethers.parseUnits("100", "gwei"),
      maxPriorityFeePerGas: ethers.parseUnits("2", "gwei"),
      estimatedCostWei: ethers.parseEther("0.03"),
      estimatedCostAeth: "0.03",
    }),
    invalidateCache: vi.fn(),
  } as unknown as GasManager;
}

// ============================================
// Mock Idempotency Store
// ============================================

export function mockIdempotencyStore(): IdempotencyStore {
  return {
    acquire: vi.fn().mockResolvedValue(true),
    release: vi.fn().mockResolvedValue(undefined),
    remove: vi.fn().mockResolvedValue(undefined),
    check: vi.fn().mockResolvedValue(undefined),
    destroy: vi.fn().mockResolvedValue(undefined),
  } as unknown as IdempotencyStore;
}

// ============================================
// Build Test Config
// ============================================

export function buildTestConfig(overrides: Partial<InternalConfig> = {}): InternalConfig {
  return {
    network: "aethelred-testnet",
    provider: mockProvider(),
    signer: mockSigner(),
    addresses: {
      accessControl: TEST_ADDRESSES.accessControl,
      verificationEngine: TEST_ADDRESSES.verificationEngine,
      carbonCredit: TEST_ADDRESSES.carbonCredit,
      carbonMarketplace: TEST_ADDRESSES.carbonMarketplace,
      gaslessMarketplace: TEST_ADDRESSES.gaslessMarketplace,
      circuitBreaker: TEST_ADDRESSES.circuitBreaker,
    },
    subgraphUrl: "https://api.studio.thegraph.com/query/terraqura/carbon-credits-testnet/version/latest",
    gas: {
      multiplier: 1.2,
      maxGasPrice: ethers.parseUnits("500", "gwei"),
      maxPriorityFee: ethers.parseUnits("30", "gwei"),
      cacheTtlMs: 15000,
      gasLimits: {},
    },
    retry: {
      maxRetries: 0, // No retries in tests
      baseDelayMs: 0,
      maxDelayMs: 0,
      retryableErrors: [],
    },
    telemetryEnabled: false,
    ...overrides,
  };
}

/**
 * Build a config with no signer (read-only mode).
 */
export function buildReadOnlyTestConfig(overrides: Partial<InternalConfig> = {}): InternalConfig {
  return buildTestConfig({
    signer: null,
    ...overrides,
  });
}

// ============================================
// Mock Provenance Data
// ============================================

export function buildMockRawMetadata(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    dacUnitId: TEST_DAC_UNIT_ID,
    sourceDataHash: TEST_SOURCE_DATA_HASH,
    captureTimestamp: 1700000000,
    co2AmountKg: 1000,
    energyConsumedKwh: 350,
    latitude: 24500000, // 24.5 degrees
    longitude: 54700000, // 54.7 degrees
    purityPercentage: 95,
    gridIntensityGCO2PerKwh: 50,
    isRetired: false,
    ipfsMetadataUri: "ipfs://QmTest123",
    arweaveBackupTxId: "ar_tx_123",
    ...overrides,
  };
}

export function buildMockRawVerification(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    sourceVerified: true,
    logicVerified: true,
    mintVerified: true,
    efficiencyFactor: 9500n,
    verifiedAt: 1700000100,
    ...overrides,
  };
}

export function buildMockProvenance(tokenId: string = "42") {
  return {
    tokenId,
    metadata: {
      dacUnitId: TEST_DAC_UNIT_ID,
      sourceDataHash: TEST_SOURCE_DATA_HASH,
      captureTimestamp: 1700000000,
      co2AmountKg: 1000,
      energyConsumedKwh: 350,
      latitude: 24.5,
      longitude: 54.7,
      purityPercentage: 95,
      gridIntensityGCO2PerKwh: 50,
      isRetired: false,
      ipfsMetadataUri: "ipfs://QmTest123",
      arweaveBackupTxId: "ar_tx_123",
    },
    verification: {
      sourceVerified: true,
      logicVerified: true,
      mintVerified: true,
      efficiencyFactor: 9500n,
      verifiedAt: 1700000100,
    },
    gps: { lat: 24.5, lng: 54.7 },
    efficiencyFactor: 95,
    gridIntensity: 50,
    netNegativeBreakdown: {
      grossCreditsKg: 950,
      energyDebtKg: 17.5,
      netCreditsKg: 932.5,
      co2AmountKg: 1000,
      energyConsumedKwh: 350,
      purityPercentage: 95,
      gridIntensityGCO2PerKwh: 50,
    },
    dacUnit: {
      dacUnitId: TEST_DAC_UNIT_ID,
      operator: TEST_ADDRESSES.operator,
      isWhitelisted: true,
    },
    transferHistory: [],
  };
}

// ============================================
// Mock Transaction Receipt
// ============================================

export function buildMockReceipt(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    hash: TEST_TX_HASH,
    blockNumber: 1000,
    gasUsed: 200000n,
    logs: [],
    status: 1,
    ...overrides,
  };
}
