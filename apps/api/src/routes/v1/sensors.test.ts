import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import {
  createTestServer,
  makeSensorReading,
  resetStateStore,
  seedState,
} from "../../../test/helpers.js";
import type { FastifyInstance } from "fastify";

const SENSORS_STORE_KEY = "sensors:v1";
const VALID_API_KEY = "test-sensor-key-1"; // Maps to dac-unit-001

describe("Sensors routes", () => {
  let server: FastifyInstance;

  beforeAll(async () => {
    server = await createTestServer();
  });

  afterEach(() => {
    resetStateStore();
  });

  afterAll(async () => {
    await server?.close();
  });

  // -----------------------------------------------------------------------
  // POST /v1/sensors/readings
  // -----------------------------------------------------------------------

  describe("POST /v1/sensors/readings", () => {
    it("accepts a valid sensor reading with API key auth", async () => {
      const response = await server.inject({
        method: "POST",
        url: "/v1/sensors/readings",
        headers: { "x-sensor-api-key": VALID_API_KEY },
        payload: {
          sensorId: "sensor-001",
          co2CaptureRateKgHour: 50,
          energyConsumptionKwh: 15,
        },
      });

      expect(response.statusCode).toBe(201);
      const body = response.json();
      expect(body.success).toBe(true);
      expect(body.data.dataHash).toMatch(/^0x[a-f0-9]{64}$/);
      expect(typeof body.data.isAnomaly).toBe("boolean");
      expect(body.data).toHaveProperty("timestamp");
    });

    it("returns 401 without API key", async () => {
      const response = await server.inject({
        method: "POST",
        url: "/v1/sensors/readings",
        payload: {
          sensorId: "sensor-001",
          co2CaptureRateKgHour: 50,
          energyConsumptionKwh: 15,
        },
      });

      expect(response.statusCode).toBe(401);
      const body = response.json();
      expect(body.success).toBe(false);
      expect(body.error).toBe("Invalid sensor API key");
    });

    it("returns 401 for an invalid API key", async () => {
      const response = await server.inject({
        method: "POST",
        url: "/v1/sensors/readings",
        headers: { "x-sensor-api-key": "invalid-key-999" },
        payload: {
          sensorId: "sensor-001",
          co2CaptureRateKgHour: 50,
          energyConsumptionKwh: 15,
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it("detects suspicious efficiency anomaly (too efficient)", async () => {
      // kWh/tonne < 200 triggers SUSPICIOUS_EFFICIENCY
      // co2 = 100 kg/h => 0.1 tonnes, energy = 10 kWh => 100 kWh/tonne
      const response = await server.inject({
        method: "POST",
        url: "/v1/sensors/readings",
        headers: { "x-sensor-api-key": VALID_API_KEY },
        payload: {
          sensorId: "sensor-001",
          co2CaptureRateKgHour: 100,
          energyConsumptionKwh: 10,
        },
      });

      expect(response.statusCode).toBe(201);
      const body = response.json();
      expect(body.data.isAnomaly).toBe(true);
      expect(body.data.anomalyReason).toBe("SUSPICIOUS_EFFICIENCY");
    });

    it("detects excessive energy anomaly (too inefficient)", async () => {
      // kWh/tonne > 600 triggers EXCESSIVE_ENERGY
      // co2 = 10 kg/h => 0.01 tonnes, energy = 10 kWh => 1000 kWh/tonne
      const response = await server.inject({
        method: "POST",
        url: "/v1/sensors/readings",
        headers: { "x-sensor-api-key": VALID_API_KEY },
        payload: {
          sensorId: "sensor-001",
          co2CaptureRateKgHour: 10,
          energyConsumptionKwh: 10,
        },
      });

      expect(response.statusCode).toBe(201);
      const body = response.json();
      expect(body.data.isAnomaly).toBe(true);
      expect(body.data.anomalyReason).toBe("EXCESSIVE_ENERGY");
    });

    it("detects low purity anomaly", async () => {
      // Purity < 90% triggers LOW_PURITY (only if energy is in valid range)
      // co2 = 100, energy = 30 => kWh/tonne = 300 (valid range)
      const response = await server.inject({
        method: "POST",
        url: "/v1/sensors/readings",
        headers: { "x-sensor-api-key": VALID_API_KEY },
        payload: {
          sensorId: "sensor-001",
          co2CaptureRateKgHour: 100,
          energyConsumptionKwh: 30,
          co2PurityPercentage: 85,
        },
      });

      expect(response.statusCode).toBe(201);
      const body = response.json();
      expect(body.data.isAnomaly).toBe(true);
      expect(body.data.anomalyReason).toBe("LOW_PURITY");
    });

    it("reports no anomaly for normal readings", async () => {
      // co2 = 100, energy = 30, purity = 96 => kWh/tonne = 300 (within 200-600)
      const response = await server.inject({
        method: "POST",
        url: "/v1/sensors/readings",
        headers: { "x-sensor-api-key": VALID_API_KEY },
        payload: {
          sensorId: "sensor-001",
          co2CaptureRateKgHour: 100,
          energyConsumptionKwh: 30,
          co2PurityPercentage: 96,
        },
      });

      const body = response.json();
      expect(body.data.isAnomaly).toBe(false);
      expect(body.data.anomalyReason).toBeNull();
    });

    it("uses current time when timestamp is omitted", async () => {
      const before = new Date().toISOString();

      const response = await server.inject({
        method: "POST",
        url: "/v1/sensors/readings",
        headers: { "x-sensor-api-key": VALID_API_KEY },
        payload: {
          sensorId: "sensor-001",
          co2CaptureRateKgHour: 50,
          energyConsumptionKwh: 15,
        },
      });

      const body = response.json();
      expect(body.data.timestamp >= before).toBe(true);
    });

    it("generates a deterministic hash for the same input data", async () => {
      const payload = {
        sensorId: "sensor-hash-test",
        timestamp: "2026-01-01T00:00:00.000Z",
        co2CaptureRateKgHour: 50,
        energyConsumptionKwh: 15,
        co2PurityPercentage: 96,
      };

      const r1 = await server.inject({
        method: "POST",
        url: "/v1/sensors/readings",
        headers: { "x-sensor-api-key": VALID_API_KEY },
        payload,
      });

      const r2 = await server.inject({
        method: "POST",
        url: "/v1/sensors/readings",
        headers: { "x-sensor-api-key": VALID_API_KEY },
        payload,
      });

      expect(r1.json().data.dataHash).toBe(r2.json().data.dataHash);
    });
  });

  // -----------------------------------------------------------------------
  // POST /v1/sensors/readings/batch
  // -----------------------------------------------------------------------

  describe("POST /v1/sensors/readings/batch", () => {
    it("processes a batch of valid readings", async () => {
      const response = await server.inject({
        method: "POST",
        url: "/v1/sensors/readings/batch",
        headers: { "x-sensor-api-key": VALID_API_KEY },
        payload: {
          readings: [
            {
              sensorId: "sensor-001",
              co2CaptureRateKgHour: 100,
              energyConsumptionKwh: 30,
            },
            {
              sensorId: "sensor-001",
              co2CaptureRateKgHour: 120,
              energyConsumptionKwh: 40,
            },
          ],
        },
      });

      expect(response.statusCode).toBe(201);
      const body = response.json();
      expect(body.success).toBe(true);
      expect(body.data.processed).toBe(2);
      expect(body.data.batchHash).toMatch(/^0x[a-f0-9]{64}$/);
    });

    it("counts anomalies in the batch", async () => {
      const response = await server.inject({
        method: "POST",
        url: "/v1/sensors/readings/batch",
        headers: { "x-sensor-api-key": VALID_API_KEY },
        payload: {
          readings: [
            {
              sensorId: "sensor-001",
              co2CaptureRateKgHour: 100,
              energyConsumptionKwh: 30,
              co2PurityPercentage: 96,
            },
            {
              sensorId: "sensor-001",
              co2CaptureRateKgHour: 100,
              energyConsumptionKwh: 10, // Suspicious efficiency
            },
          ],
        },
      });

      const body = response.json();
      expect(body.data.anomalies).toBe(1);
    });

    it("returns 401 without API key", async () => {
      const response = await server.inject({
        method: "POST",
        url: "/v1/sensors/readings/batch",
        payload: {
          readings: [
            {
              sensorId: "s1",
              co2CaptureRateKgHour: 50,
              energyConsumptionKwh: 15,
            },
          ],
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it("produces a consistent batch hash for same input data", async () => {
      const readings = [
        {
          sensorId: "sensor-batch",
          timestamp: "2026-01-01T00:00:00.000Z",
          co2CaptureRateKgHour: 100,
          energyConsumptionKwh: 30,
          co2PurityPercentage: 96,
        },
      ];

      const r1 = await server.inject({
        method: "POST",
        url: "/v1/sensors/readings/batch",
        headers: { "x-sensor-api-key": VALID_API_KEY },
        payload: { readings },
      });

      const r2 = await server.inject({
        method: "POST",
        url: "/v1/sensors/readings/batch",
        headers: { "x-sensor-api-key": VALID_API_KEY },
        payload: { readings },
      });

      expect(r1.json().data.batchHash).toBe(r2.json().data.batchHash);
    });
  });

  // -----------------------------------------------------------------------
  // GET /v1/sensors/:dacUnitId/summary
  // -----------------------------------------------------------------------

  describe("GET /v1/sensors/:dacUnitId/summary", () => {
    it("returns zeroed summary when no readings exist", async () => {
      const response = await server.inject({
        method: "GET",
        url: "/v1/sensors/dac-unit-001/summary",
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.success).toBe(true);
      expect(body.data.readingCount).toBe(0);
      expect(body.data.totalCo2CapturedKg).toBe(0);
      expect(body.data.efficiencyRating).toBe("N/A");
    });

    it("computes summary for seeded readings within time range", async () => {
      const now = new Date();
      const readings = [
        makeSensorReading({
          dacUnitId: "dac-unit-001",
          time: new Date(now.getTime() - 3600000).toISOString(), // 1h ago
          co2CaptureRateKgHour: 100,
          energyConsumptionKwh: 30,
          co2PurityPercentage: 96,
          isAnomaly: false,
        }),
        makeSensorReading({
          dacUnitId: "dac-unit-001",
          time: new Date(now.getTime() - 1800000).toISOString(), // 30m ago
          co2CaptureRateKgHour: 120,
          energyConsumptionKwh: 40,
          co2PurityPercentage: 98,
          isAnomaly: false,
        }),
      ];
      seedState(SENSORS_STORE_KEY, { readings });

      const response = await server.inject({
        method: "GET",
        url: "/v1/sensors/dac-unit-001/summary",
      });

      const body = response.json();
      expect(body.data.readingCount).toBe(2);
      expect(body.data.totalCo2CapturedKg).toBe(220);
      expect(body.data.totalEnergyConsumedKwh).toBe(70);
      expect(body.data.avgPurityPercentage).toBeCloseTo(97, 0);
    });

    it("filters by custom startTime and endTime", async () => {
      const readings = [
        makeSensorReading({
          dacUnitId: "dac-unit-001",
          time: "2026-01-01T00:00:00.000Z",
          co2CaptureRateKgHour: 100,
          energyConsumptionKwh: 30,
        }),
        makeSensorReading({
          dacUnitId: "dac-unit-001",
          time: "2026-01-02T00:00:00.000Z",
          co2CaptureRateKgHour: 200,
          energyConsumptionKwh: 60,
        }),
        makeSensorReading({
          dacUnitId: "dac-unit-001",
          time: "2026-01-03T00:00:00.000Z",
          co2CaptureRateKgHour: 300,
          energyConsumptionKwh: 90,
        }),
      ];
      seedState(SENSORS_STORE_KEY, { readings });

      const response = await server.inject({
        method: "GET",
        url: "/v1/sensors/dac-unit-001/summary?startTime=2026-01-01T12:00:00.000Z&endTime=2026-01-02T12:00:00.000Z",
      });

      const body = response.json();
      expect(body.data.readingCount).toBe(1);
      expect(body.data.totalCo2CapturedKg).toBe(200);
    });

    it("excludes readings from other DAC units", async () => {
      const now = new Date();
      const readings = [
        makeSensorReading({
          dacUnitId: "dac-unit-001",
          time: new Date(now.getTime() - 3600000).toISOString(),
          co2CaptureRateKgHour: 100,
          energyConsumptionKwh: 30,
        }),
        makeSensorReading({
          dacUnitId: "dac-unit-999",
          time: new Date(now.getTime() - 3600000).toISOString(),
          co2CaptureRateKgHour: 500,
          energyConsumptionKwh: 150,
        }),
      ];
      seedState(SENSORS_STORE_KEY, { readings });

      const response = await server.inject({
        method: "GET",
        url: "/v1/sensors/dac-unit-001/summary",
      });

      const body = response.json();
      expect(body.data.readingCount).toBe(1);
      expect(body.data.totalCo2CapturedKg).toBe(100);
    });

    it("computes correct efficiency rating EXCELLENT (kWh/t <= 300)", async () => {
      const now = new Date();
      // co2 = 100 kg => 0.1 tonne, energy = 30 kWh => 300 kWh/tonne
      const readings = [
        makeSensorReading({
          dacUnitId: "dac-unit-001",
          time: new Date(now.getTime() - 1000).toISOString(),
          co2CaptureRateKgHour: 100,
          energyConsumptionKwh: 30,
          co2PurityPercentage: 96,
        }),
      ];
      seedState(SENSORS_STORE_KEY, { readings });

      const response = await server.inject({
        method: "GET",
        url: "/v1/sensors/dac-unit-001/summary",
      });

      const body = response.json();
      expect(body.data.efficiencyRating).toBe("EXCELLENT");
    });

    it("computes correct efficiency rating POOR (kWh/t > 500)", async () => {
      const now = new Date();
      // co2 = 10 kg => 0.01 tonne, energy = 5.5 kWh => 550 kWh/tonne
      const readings = [
        makeSensorReading({
          dacUnitId: "dac-unit-001",
          time: new Date(now.getTime() - 1000).toISOString(),
          co2CaptureRateKgHour: 10,
          energyConsumptionKwh: 5.5,
          co2PurityPercentage: 96,
        }),
      ];
      seedState(SENSORS_STORE_KEY, { readings });

      const response = await server.inject({
        method: "GET",
        url: "/v1/sensors/dac-unit-001/summary",
      });

      const body = response.json();
      expect(body.data.efficiencyRating).toBe("POOR");
    });

    it("counts anomalies in the summary", async () => {
      const now = new Date();
      const readings = [
        makeSensorReading({
          dacUnitId: "dac-unit-001",
          time: new Date(now.getTime() - 1000).toISOString(),
          isAnomaly: false,
        }),
        makeSensorReading({
          dacUnitId: "dac-unit-001",
          time: new Date(now.getTime() - 500).toISOString(),
          isAnomaly: true,
          anomalyReason: "SUSPICIOUS_EFFICIENCY",
        }),
      ];
      seedState(SENSORS_STORE_KEY, { readings });

      const response = await server.inject({
        method: "GET",
        url: "/v1/sensors/dac-unit-001/summary",
      });

      const body = response.json();
      expect(body.data.anomalyCount).toBe(1);
    });
  });
});
