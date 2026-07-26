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

process.env.DATABASE_URL =
  "postgresql://test:test@localhost:5432/terraqura_test";
process.env.JWT_SECRET = "test-jwt-secret-that-is-at-least-32-characters-long";
process.env.SIWE_DOMAIN = "localhost";
process.env.NODE_ENV = "test";
process.env.LOG_LEVEL = "silent";
process.env.KYC_PROVIDER = "disabled";
process.env.CHAIN_ID = "7332";

// ---------------------------------------------------------------------------
// 2. In-memory state store mock
// ---------------------------------------------------------------------------

const stateMap = new Map<string, unknown>();
type TestSensorReading = {
  time: string;
  dacUnitId: string;
  sensorId: string;
  co2CaptureRateKgHour: number;
  energyConsumptionKwh: number;
  measurementDurationSeconds?: number;
  co2PurityPercentage: number;
  ambientTemperatureC?: number | null;
  ambientHumidityPercent?: number | null;
  atmosphericCo2Ppm?: number | null;
  dataHash: string;
  rawData?: Record<string, unknown> | null;
  isAnomaly: boolean;
  anomalyReason: string | null;
};
let sensorReadings: TestSensorReading[] = [];

export function resetStateStore(): void {
  stateMap.clear();
  sensorReadings = [];
}

export function seedState<T>(storeKey: string, state: T): void {
  stateMap.set(storeKey, structuredClone(state));
  if (storeKey === "sensors:v1") {
    sensorReadings = structuredClone(
      (state as { readings?: TestSensorReading[] }).readings ?? [],
    );
  }
}

export function getState<T>(storeKey: string): T | undefined {
  if (storeKey === "sensors:v1") {
    return structuredClone({ readings: sensorReadings }) as T;
  }
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

  async mutateStatePair<TFirst, TSecond, R>(
    first: { storeKey: string; defaultState: TFirst },
    second: { storeKey: string; defaultState: TSecond },
    mutator: (firstState: TFirst, secondState: TSecond) => Promise<R> | R,
  ): Promise<R> {
    const firstState = structuredClone(
      (stateMap.get(first.storeKey) as TFirst | undefined) ??
        first.defaultState,
    );
    const secondState = structuredClone(
      (stateMap.get(second.storeKey) as TSecond | undefined) ??
        second.defaultState,
    );
    const result = await mutator(firstState, secondState);
    stateMap.set(first.storeKey, structuredClone(firstState));
    stateMap.set(second.storeKey, structuredClone(secondState));
    return result;
  },
}));

vi.mock("../src/lib/sensor-reading-store.js", () => ({
  async insertSensorReadings(readings: TestSensorReading[]): Promise<boolean> {
    const existing = new Set(sensorReadings.map((reading) => reading.dataHash));
    if (readings.some((reading) => existing.has(reading.dataHash))) {
      return false;
    }
    sensorReadings.push(...structuredClone(readings));
    return true;
  },

  async listSensorReadings(
    dacUnitId: string,
    startTime: Date,
    endTime: Date,
  ): Promise<TestSensorReading[]> {
    return structuredClone(
      sensorReadings
        .filter((reading) => {
          const capturedAt = new Date(reading.time);
          return (
            reading.dacUnitId === dacUnitId &&
            capturedAt >= startTime &&
            capturedAt <= endTime
          );
        })
        .sort((left, right) => {
          const timeOrder = left.time.localeCompare(right.time);
          return timeOrder !== 0
            ? timeOrder
            : left.sensorId.localeCompare(right.sensorId);
        }),
    );
  },

  async summarizeSensorReadings(
    dacUnitId: string,
    startTime: Date,
    endTime: Date,
  ) {
    const readings = sensorReadings.filter((reading) => {
      const capturedAt = new Date(reading.time);
      return (
        reading.dacUnitId === dacUnitId &&
        capturedAt >= startTime &&
        capturedAt <= endTime
      );
    });
    return {
      totalCo2CapturedKg: readings.reduce(
        (sum, reading) =>
          sum +
          reading.co2CaptureRateKgHour *
            ((reading.measurementDurationSeconds ?? 3600) / 3600),
        0,
      ),
      totalEnergyConsumedKwh: readings.reduce(
        (sum, reading) => sum + reading.energyConsumptionKwh,
        0,
      ),
      avgCo2CaptureRateKgHour:
        readings.length === 0
          ? 0
          : readings.reduce(
              (sum, reading) => sum + reading.co2CaptureRateKgHour,
              0,
            ) / readings.length,
      avgPurityPercentage:
        readings.length === 0
          ? 0
          : readings.reduce(
              (sum, reading) => sum + reading.co2PurityPercentage,
              0,
            ) / readings.length,
      readingCount: readings.length,
      anomalyCount: readings.filter((reading) => reading.isAnomaly).length,
    };
  },
}));

// ---------------------------------------------------------------------------
// 3. Runtime-env mock
// ---------------------------------------------------------------------------

vi.mock("../src/lib/runtime-env.js", () => ({
  getApiRuntimeEnv: () => ({
    DATABASE_URL: process.env.DATABASE_URL,
    DATABASE_SSL_MODE: "disable" as const,
    JWT_SECRET: process.env.JWT_SECRET!,
    SIWE_DOMAIN: "localhost",
    ADMIN_WALLETS: [],
    AUDITOR_WALLETS: [],
    KYC_PROVIDER: "disabled" as const,
    KYC_WEBHOOK_SECRET: process.env.KYC_WEBHOOK_SECRET,
    CHAIN_ID: 7332,
    AETHELRED_RPC_URL: process.env.AETHELRED_RPC_URL,
    AETHELRED_EXPLORER_URL: "https://explorer.test.invalid",
    FORWARDER_CONTRACT: process.env.FORWARDER_CONTRACT,
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
    chainId: 7332,
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
      chainId: 7332,
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
  chainId: 7332,
  userType: "operator",
  kycStatus: "approved",
};

const DEFAULT_ADMIN: TestTokenPayload = {
  sub: "0xadmin00000000000000000000000000000000000",
  address: "0xadmin00000000000000000000000000000000000",
  chainId: 7332,
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
    gridIntensityGco2PerKwh: 50,
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
    measurementDurationSeconds: 3600,
    co2PurityPercentage: 96,
    ambientTemperatureC: 25,
    ambientHumidityPercent: 45,
    atmosphericCo2Ppm: 420,
    dataHash: "a".repeat(64),
    rawData: null,
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
    chainId: 7332,
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
