import { randomUUID } from "node:crypto";

import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import type {
  SensorEvidenceReading,
  SensorEvidenceSummary,
} from "../../src/lib/sensor-reading-store.js";

const runDatabaseTests = process.env.RUN_DATABASE_INTEGRATION_TESTS === "true";

if (runDatabaseTests) {
  process.env.NODE_ENV = "test";
  process.env.DATABASE_URL ??=
    "postgresql://terraqura:terraqura@localhost:5432/terraqura_test";
  process.env.DATABASE_SSL_MODE = "disable";
  process.env.JWT_SECRET =
    "database-integration-secret-at-least-thirty-two-characters";
  process.env.SIWE_DOMAIN = "localhost";
  process.env.ADMIN_WALLETS = "";
  process.env.AUDITOR_WALLETS = "";
  process.env.CHAIN_ID = "7332";
  process.env.AETHELRED_RPC_URL = "http://127.0.0.1:8545";
  process.env.AETHELRED_EXPLORER_URL = "http://127.0.0.1:3000";
  process.env.ACCESS_CONTROL_ADDRESS =
    "0x1111111111111111111111111111111111111111";
  process.env.VERIFICATION_ENGINE_ADDRESS =
    "0x2222222222222222222222222222222222222222";
  process.env.CARBON_CREDIT_ADDRESS =
    "0x3333333333333333333333333333333333333333";
  process.env.CARBON_MARKETPLACE_ADDRESS =
    "0x4444444444444444444444444444444444444444";
  process.env.CIRCUIT_BREAKER_ADDRESS =
    "0x5555555555555555555555555555555555555555";
  process.env.KYC_PROVIDER = "disabled";
}

type SensorStore = typeof import("../../src/lib/sensor-reading-store.js");
type DatabaseModule = typeof import("../../src/lib/database.js");

function makeReading(
  dacUnitId: string,
  overrides: Partial<SensorEvidenceReading> = {},
): SensorEvidenceReading {
  return {
    time: new Date().toISOString(),
    dacUnitId,
    sensorId: "integration-sensor",
    co2CaptureRateKgHour: 100,
    energyConsumptionKwh: 30,
    measurementDurationSeconds: 3600,
    co2PurityPercentage: 96,
    ambientTemperatureC: 25,
    ambientHumidityPercent: 45,
    atmosphericCo2Ppm: 420,
    dataHash: randomUUID().replaceAll("-", "").padEnd(64, "0"),
    rawData: { calibrationId: "calibration-001" },
    isAnomaly: false,
    anomalyReason: null,
    ...overrides,
  };
}

describe.runIf(runDatabaseTests)("sensor reading PostgreSQL store", () => {
  let sensorStore: SensorStore;
  let database: DatabaseModule;

  beforeAll(async () => {
    sensorStore = await import("../../src/lib/sensor-reading-store.js");
    database = await import("../../src/lib/database.js");
    const { ensureDatabaseSchema } =
      await import("../../src/lib/database-schema.js");
    await ensureDatabaseSchema();
  });

  afterEach(async () => {
    await database.databasePool.query(
      "DELETE FROM sensor_readings WHERE dac_unit_id LIKE 'integration-%'",
    );
  });

  afterAll(async () => {
    await database.closeDatabasePool();
  });

  it("persists raw evidence and rejects a replayed hash", async () => {
    const dacUnitId = `integration-${randomUUID()}`;
    const reading = makeReading(dacUnitId, {
      rawData: { calibrationId: "calibration-verified", sequence: 42 },
    });

    await expect(sensorStore.insertSensorReadings([reading])).resolves.toBe(
      true,
    );
    await expect(sensorStore.insertSensorReadings([reading])).resolves.toBe(
      false,
    );

    const stored = await sensorStore.listSensorReadings(
      dacUnitId,
      new Date(Date.now() - 60_000),
      new Date(Date.now() + 60_000),
    );
    expect(stored).toHaveLength(1);
    expect(stored[0]?.dataHash).toBe(reading.dataHash);
    expect(stored[0]?.rawData).toEqual(reading.rawData);
  });

  it("rolls back the entire batch when any hash already exists", async () => {
    const dacUnitId = `integration-${randomUUID()}`;
    const existing = makeReading(dacUnitId);
    const newReading = makeReading(dacUnitId);
    await sensorStore.insertSensorReadings([existing]);

    await expect(
      sensorStore.insertSensorReadings([newReading, existing]),
    ).resolves.toBe(false);

    const stored = await sensorStore.listSensorReadings(
      dacUnitId,
      new Date(Date.now() - 60_000),
      new Date(Date.now() + 60_000),
    );
    expect(stored.map((reading) => reading.dataHash)).toEqual([
      existing.dataHash,
    ]);
  });

  it("aggregates duration-aware capture, energy, purity, and anomalies", async () => {
    const dacUnitId = `integration-${randomUUID()}`;
    const start = new Date("2026-07-26T10:00:00.000Z");
    const end = new Date("2026-07-26T12:00:00.000Z");
    const readings = [
      makeReading(dacUnitId, {
        time: "2026-07-26T10:30:00.000Z",
        co2CaptureRateKgHour: 100,
        energyConsumptionKwh: 10,
        measurementDurationSeconds: 1800,
        co2PurityPercentage: 94,
      }),
      makeReading(dacUnitId, {
        time: "2026-07-26T11:30:00.000Z",
        co2CaptureRateKgHour: 200,
        energyConsumptionKwh: 20,
        measurementDurationSeconds: 3600,
        co2PurityPercentage: 96,
        isAnomaly: true,
        anomalyReason: "EXCESSIVE_ENERGY",
      }),
    ];
    await sensorStore.insertSensorReadings(readings);

    const summary: SensorEvidenceSummary =
      await sensorStore.summarizeSensorReadings(dacUnitId, start, end);
    expect(summary).toEqual({
      totalCo2CapturedKg: 250,
      totalEnergyConsumedKwh: 30,
      avgCo2CaptureRateKgHour: 150,
      avgPurityPercentage: 95,
      readingCount: 2,
      anomalyCount: 1,
    });
  });
});
