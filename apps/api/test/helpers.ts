/**
 * Shared test infrastructure for TerraQura API tests.
 *
 * Sets environment variables, mocks the state store and runtime-env modules,
 * and provides helpers for building a test server and generating JWT tokens.
 */

import { vi } from "vitest";

// ---------------------------------------------------------------------------
// 1. Environment variables (must be set before any source module is imported)
// ---------------------------------------------------------------------------

process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/terraqura_test";
process.env.JWT_SECRET = "test-jwt-secret-that-is-at-least-32-characters-long";
process.env.SIWE_DOMAIN = "localhost";
process.env.NODE_ENV = "test";
process.env.LOG_LEVEL = "silent";
process.env.KYC_PROVIDER = "disabled";
process.env.SENSOR_API_KEYS = "test-sensor-key-1:dac-unit-001,test-sensor-key-2:dac-unit-002";

// ---------------------------------------------------------------------------
// 2. In-memory state store mock
// ---------------------------------------------------------------------------

const stateMap = new Map<string, unknown>();

export function resetStateStore(): void {
  stateMap.clear();
}

export function seedState<T>(storeKey: string, state: T): void {
  stateMap.set(storeKey, structuredClone(state));
}

export function getState<T>(storeKey: string): T | undefined {
  const value = stateMap.get(storeKey);
  return value === undefined ? undefined : (structuredClone(value) as T);
}

vi.mock("../src/lib/state-store.js", () => ({
  async readState<T>(storeKey: string, defaultState: T): Promise<T> {
    const stored = stateMap.get(storeKey);
    if (stored !== undefined) {
      return structuredClone(stored) as T;
    }
    return structuredClone(defaultState);
  },

  async mutateState<T, R>(
    storeKey: string,
    defaultState: T,
    mutator: (state: T) => Promise<R> | R,
  ): Promise<R> {
    const stored = stateMap.get(storeKey);
    const current =
      stored !== undefined
        ? (structuredClone(stored) as T)
        : structuredClone(defaultState);
    const result = await mutator(current);
    stateMap.set(storeKey, structuredClone(current));
    return result;
  },
}));

// ---------------------------------------------------------------------------
// 3. Runtime-env mock
// ---------------------------------------------------------------------------

vi.mock("../src/lib/runtime-env.js", () => ({
  getApiRuntimeEnv: () => ({
    DATABASE_URL: process.env.DATABASE_URL,
    JWT_SECRET: process.env.JWT_SECRET!,
    SIWE_DOMAIN: "localhost",
    KYC_PROVIDER: "disabled" as const,
  }),
}));

// ---------------------------------------------------------------------------
// 4. Mock pg Pool so the auth route module-level `new Pool()` doesn't connect
// ---------------------------------------------------------------------------

vi.mock("pg", () => {
  const query = vi.fn().mockResolvedValue({ rows: [], rowCount: 1 });
  const release = vi.fn();
  const connect = vi.fn().mockResolvedValue({ query, release });
  const end = vi.fn().mockResolvedValue(undefined);

  class Pool {
    query = query;
    connect = connect;
    end = end;
  }

  return { Pool };
});

// ---------------------------------------------------------------------------
// 5. Mock siwe so we can control verification results in auth tests
// ---------------------------------------------------------------------------

let siweVerifyResult: {
  success: boolean;
  data: {
    address: string;
    chainId: number;
    domain: string;
    nonce: string;
  };
} = {
  success: true,
  data: {
    address: "0x1234567890abcdef1234567890abcdef12345678",
    chainId: 78432,
    domain: "localhost",
    nonce: "mock-nonce",
  },
};

export function setSiweVerifyResult(result: typeof siweVerifyResult): void {
  siweVerifyResult = result;
}

export function resetSiweVerifyResult(): void {
  siweVerifyResult = {
    success: true,
    data: {
      address: "0x1234567890abcdef1234567890abcdef12345678",
      chainId: 78432,
      domain: "localhost",
      nonce: "mock-nonce",
    },
  };
}

vi.mock("siwe", () => ({
  generateNonce: () => "mock-nonce-" + Math.random().toString(36).slice(2, 10),
  SiweMessage: class {
    constructor(_message: string) {
      // no-op
    }
    async verify(_opts: { signature: string }) {
      if (!siweVerifyResult.success) {
        throw new Error("Invalid signature");
      }
      return { data: siweVerifyResult.data };
    }
  },
}));

// ---------------------------------------------------------------------------
// 6. Build test server helper
// ---------------------------------------------------------------------------

import type { FastifyInstance } from "fastify";

let _buildServer: (() => Promise<FastifyInstance>) | null = null;

export async function createTestServer(): Promise<FastifyInstance> {
  if (!_buildServer) {
    const mod = await import("../src/server.js");
    _buildServer = mod.buildServer;
  }
  const server = await _buildServer();
  await server.ready();
  return server;
}

// ---------------------------------------------------------------------------
// 7. JWT token generation helpers
// ---------------------------------------------------------------------------

export interface TestTokenPayload {
  sub: string;
  address: string;
  chainId: number;
  userType: "operator" | "admin" | "auditor";
  kycStatus: "pending" | "approved" | "rejected";
}

const DEFAULT_OPERATOR: TestTokenPayload = {
  sub: "0x1234567890abcdef1234567890abcdef12345678",
  address: "0x1234567890abcdef1234567890abcdef12345678",
  chainId: 78432,
  userType: "operator",
  kycStatus: "approved",
};

const DEFAULT_ADMIN: TestTokenPayload = {
  sub: "0xadmin00000000000000000000000000000000000",
  address: "0xadmin00000000000000000000000000000000000",
  chainId: 78432,
  userType: "admin",
  kycStatus: "approved",
};

export function generateAuthToken(
  server: FastifyInstance,
  overrides: Partial<TestTokenPayload> = {},
): string {
  const payload = { ...DEFAULT_OPERATOR, ...overrides };
  return server.jwt.sign(payload);
}

export function generateAdminToken(
  server: FastifyInstance,
  overrides: Partial<TestTokenPayload> = {},
): string {
  const payload = { ...DEFAULT_ADMIN, ...overrides };
  return server.jwt.sign(payload);
}

// ---------------------------------------------------------------------------
// 8. Mock data factories
// ---------------------------------------------------------------------------

export function makeDacUnit(overrides: Record<string, unknown> = {}) {
  return {
    id: `dac_${Date.now()}_test`,
    unitId: "0x" + "a".repeat(64),
    operatorId: "operator_12345678",
    operatorWallet: "0x1234567890abcdef1234567890abcdef12345678",
    name: "Test DAC Facility",
    latitude: 24.453884,
    longitude: 54.377344,
    countryCode: "AE",
    status: "pending",
    capacityTonnesPerYear: 1000,
    technologyType: "DAC",
    createdAt: new Date().toISOString(),
    whitelistedAt: null,
    whitelistTxHash: null,
    ...overrides,
  };
}

export function makeSensorReading(overrides: Record<string, unknown> = {}) {
  return {
    time: new Date().toISOString(),
    dacUnitId: "dac-unit-001",
    sensorId: "sensor-001",
    co2CaptureRateKgHour: 50,
    energyConsumptionKwh: 15,
    co2PurityPercentage: 96,
    ambientTemperatureC: 25,
    ambientHumidityPercent: 45,
    atmosphericCo2Ppm: 420,
    dataHash: "a".repeat(64),
    isAnomaly: false,
    anomalyReason: null,
    ...overrides,
  };
}

export function makeVerification(overrides: Record<string, unknown> = {}) {
  const now = new Date().toISOString();
  return {
    id: `ver_${Date.now()}_test`,
    dacUnitId: "dac-unit-001",
    startTime: new Date(Date.now() - 86400000).toISOString(),
    endTime: now,
    requestedAt: now,
    completedAt: now,
    status: "PASSED",
    sourceCheck: { status: "PASSED", completedAt: now },
    logicCheck: {
      status: "PASSED",
      completedAt: now,
      kwhPerTonne: 300,
      efficiencyFactor: 10000,
    },
    mintCheck: { status: "PASSED", completedAt: now },
    sourceDataHash: "0x" + "b".repeat(64),
    efficiencyFactor: 10000,
    creditsToMint: 5,
    readingCount: 10,
    totalCo2CapturedKg: 500,
    totalEnergyKwh: 150,
    avgPurity: 96,
    ...overrides,
  };
}

export function makeUser(overrides: Record<string, unknown> = {}) {
  return {
    address: "0x1234567890abcdef1234567890abcdef12345678",
    chainId: 78432,
    userType: "operator" as const,
    kycStatus: "approved" as const,
    ...overrides,
  };
}

export function makeCarbonCredit(overrides: Record<string, unknown> = {}) {
  return {
    id: `credit_${Date.now()}_test`,
    dacUnitId: "dac-unit-001",
    verificationId: `ver_${Date.now()}_test`,
    amount: 5,
    vintage: "2026-Q1",
    status: "minted",
    mintedAt: new Date().toISOString(),
    tokenId: "0x" + "c".repeat(64),
    ownerAddress: "0x1234567890abcdef1234567890abcdef12345678",
    ...overrides,
  };
}
