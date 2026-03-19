import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import {
  createTestServer,
  generateAuthToken,
  makeSensorReading,
  makeVerification,
  resetStateStore,
  seedState,
} from "../../../test/helpers.js";
import type { FastifyInstance } from "fastify";

const SENSORS_STORE_KEY = "sensors:v1";
const VERIFICATIONS_STORE_KEY = "verification:v1";

describe("Verification routes", () => {
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
  // POST /v1/verification/initiate
  // -----------------------------------------------------------------------

  describe("POST /v1/verification/initiate", () => {
    it("initiates verification and returns 201 with verificationId", async () => {
      // Seed readings that fall within the requested time range
      const readings = [
        makeSensorReading({
          dacUnitId: "dac-unit-001",
          time: "2026-01-15T12:00:00.000Z",
          co2CaptureRateKgHour: 100,
          energyConsumptionKwh: 35, // 350 kWh/tonne — valid
          co2PurityPercentage: 96,
        }),
      ];
      seedState(SENSORS_STORE_KEY, { readings });

      const token = generateAuthToken(server);
      const response = await server.inject({
        method: "POST",
        url: "/v1/verification/initiate",
        headers: { authorization: `Bearer ${token}` },
        payload: {
          dacUnitId: "dac-unit-001",
          startTime: "2026-01-15T00:00:00.000Z",
          endTime: "2026-01-16T00:00:00.000Z",
        },
      });

      expect(response.statusCode).toBe(201);
      const body = response.json();
      expect(body.success).toBe(true);
      expect(body.data.verificationId).toMatch(/^ver_/);
      expect(body.data).toHaveProperty("status");
      expect(body.data).toHaveProperty("estimatedCompletion");
    });

    it("returns 401 without authentication", async () => {
      const response = await server.inject({
        method: "POST",
        url: "/v1/verification/initiate",
        payload: {
          dacUnitId: "dac-unit-001",
          startTime: "2026-01-15T00:00:00.000Z",
          endTime: "2026-01-16T00:00:00.000Z",
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it("returns 400 when endTime is before startTime", async () => {
      const token = generateAuthToken(server);
      const response = await server.inject({
        method: "POST",
        url: "/v1/verification/initiate",
        headers: { authorization: `Bearer ${token}` },
        payload: {
          dacUnitId: "dac-unit-001",
          startTime: "2026-01-16T00:00:00.000Z",
          endTime: "2026-01-15T00:00:00.000Z",
        },
      });

      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.error).toBe("endTime must be after startTime");
    });

    it("fails verification (FAILED) when no sensor readings exist", async () => {
      // No readings seeded
      const token = generateAuthToken(server);
      const response = await server.inject({
        method: "POST",
        url: "/v1/verification/initiate",
        headers: { authorization: `Bearer ${token}` },
        payload: {
          dacUnitId: "dac-unit-001",
          startTime: "2026-01-15T00:00:00.000Z",
          endTime: "2026-01-16T00:00:00.000Z",
        },
      });

      expect(response.statusCode).toBe(201);
      const body = response.json();
      expect(body.data.status).toBe("FAILED");
    });

    it("passes verification with valid readings in range", async () => {
      const readings = [
        makeSensorReading({
          dacUnitId: "dac-unit-001",
          time: "2026-01-15T06:00:00.000Z",
          co2CaptureRateKgHour: 100,
          energyConsumptionKwh: 35, // 350 kWh/t
          co2PurityPercentage: 96,
        }),
        makeSensorReading({
          dacUnitId: "dac-unit-001",
          time: "2026-01-15T12:00:00.000Z",
          co2CaptureRateKgHour: 100,
          energyConsumptionKwh: 35,
          co2PurityPercentage: 96,
        }),
      ];
      seedState(SENSORS_STORE_KEY, { readings });

      const token = generateAuthToken(server);
      const response = await server.inject({
        method: "POST",
        url: "/v1/verification/initiate",
        headers: { authorization: `Bearer ${token}` },
        payload: {
          dacUnitId: "dac-unit-001",
          startTime: "2026-01-15T00:00:00.000Z",
          endTime: "2026-01-16T00:00:00.000Z",
        },
      });

      const body = response.json();
      expect(body.data.status).toBe("PASSED");
    });

    it("fails verification when readings have low purity", async () => {
      const readings = [
        makeSensorReading({
          dacUnitId: "dac-unit-001",
          time: "2026-01-15T06:00:00.000Z",
          co2CaptureRateKgHour: 100,
          energyConsumptionKwh: 35,
          co2PurityPercentage: 80, // Below 90% threshold
        }),
      ];
      seedState(SENSORS_STORE_KEY, { readings });

      const token = generateAuthToken(server);
      const response = await server.inject({
        method: "POST",
        url: "/v1/verification/initiate",
        headers: { authorization: `Bearer ${token}` },
        payload: {
          dacUnitId: "dac-unit-001",
          startTime: "2026-01-15T00:00:00.000Z",
          endTime: "2026-01-16T00:00:00.000Z",
        },
      });

      const body = response.json();
      expect(body.data.status).toBe("FAILED");
    });

    it("fails verification when energy efficiency is out of bounds", async () => {
      // kWh/tonne = energyConsumptionKwh / (co2CaptureRateKgHour / 1000)
      // 10 / (100/1000) = 100 => below MIN_KWH_PER_TONNE=200
      const readings = [
        makeSensorReading({
          dacUnitId: "dac-unit-001",
          time: "2026-01-15T06:00:00.000Z",
          co2CaptureRateKgHour: 100,
          energyConsumptionKwh: 10, // 100 kWh/tonne - too efficient
          co2PurityPercentage: 96,
        }),
      ];
      seedState(SENSORS_STORE_KEY, { readings });

      const token = generateAuthToken(server);
      const response = await server.inject({
        method: "POST",
        url: "/v1/verification/initiate",
        headers: { authorization: `Bearer ${token}` },
        payload: {
          dacUnitId: "dac-unit-001",
          startTime: "2026-01-15T00:00:00.000Z",
          endTime: "2026-01-16T00:00:00.000Z",
        },
      });

      const body = response.json();
      expect(body.data.status).toBe("FAILED");
    });

    it("ignores readings from other DAC units", async () => {
      const readings = [
        makeSensorReading({
          dacUnitId: "dac-unit-OTHER",
          time: "2026-01-15T06:00:00.000Z",
          co2CaptureRateKgHour: 100,
          energyConsumptionKwh: 35,
          co2PurityPercentage: 96,
        }),
      ];
      seedState(SENSORS_STORE_KEY, { readings });

      const token = generateAuthToken(server);
      const response = await server.inject({
        method: "POST",
        url: "/v1/verification/initiate",
        headers: { authorization: `Bearer ${token}` },
        payload: {
          dacUnitId: "dac-unit-001",
          startTime: "2026-01-15T00:00:00.000Z",
          endTime: "2026-01-16T00:00:00.000Z",
        },
      });

      const body = response.json();
      expect(body.data.status).toBe("FAILED"); // No readings for this DAC unit
    });

    it("rejects missing required fields", async () => {
      const token = generateAuthToken(server);

      const response = await server.inject({
        method: "POST",
        url: "/v1/verification/initiate",
        headers: { authorization: `Bearer ${token}` },
        payload: {
          dacUnitId: "dac-unit-001",
          // missing startTime, endTime
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  // -----------------------------------------------------------------------
  // GET /v1/verification/:id
  // -----------------------------------------------------------------------

  describe("GET /v1/verification/:id", () => {
    it("returns the verification status for a known id", async () => {
      const verification = makeVerification({ id: "ver_test_001" });
      seedState(VERIFICATIONS_STORE_KEY, {
        verifications: { ver_test_001: verification },
      });

      const response = await server.inject({
        method: "GET",
        url: "/v1/verification/ver_test_001",
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.success).toBe(true);
      expect(body.data.id).toBe("ver_test_001");
      expect(body.data.status).toBe("PASSED");
    });

    it("returns progress with three-phase check statuses", async () => {
      const verification = makeVerification({ id: "ver_progress" });
      seedState(VERIFICATIONS_STORE_KEY, {
        verifications: { ver_progress: verification },
      });

      const response = await server.inject({
        method: "GET",
        url: "/v1/verification/ver_progress",
      });

      const body = response.json();
      expect(body.data.progress).toBeDefined();
      expect(body.data.progress.sourceCheck).toBe("PASSED");
      expect(body.data.progress.logicCheck).toBe("PASSED");
      expect(body.data.progress.mintCheck).toBe("PASSED");
    });

    it("returns 404 for unknown verification id", async () => {
      const response = await server.inject({
        method: "GET",
        url: "/v1/verification/ver_nonexistent",
      });

      expect(response.statusCode).toBe(404);
      const body = response.json();
      expect(body.success).toBe(false);
      expect(body.error).toBe("Verification not found");
    });

    it("includes requestedAt and completedAt timestamps", async () => {
      const verification = makeVerification({ id: "ver_times" });
      seedState(VERIFICATIONS_STORE_KEY, {
        verifications: { ver_times: verification },
      });

      const response = await server.inject({
        method: "GET",
        url: "/v1/verification/ver_times",
      });

      const body = response.json();
      expect(body.data.requestedAt).toBeTruthy();
      expect(body.data.completedAt).toBeTruthy();
    });

    it("shows FAILED status and individual check statuses for a failed verification", async () => {
      const verification = makeVerification({
        id: "ver_failed",
        status: "FAILED",
        sourceCheck: { status: "PASSED", completedAt: new Date().toISOString() },
        logicCheck: {
          status: "FAILED",
          completedAt: new Date().toISOString(),
          kwhPerTonne: 100,
          efficiencyFactor: 0,
        },
        mintCheck: { status: "PENDING", completedAt: null },
      });
      seedState(VERIFICATIONS_STORE_KEY, {
        verifications: { ver_failed: verification },
      });

      const response = await server.inject({
        method: "GET",
        url: "/v1/verification/ver_failed",
      });

      const body = response.json();
      expect(body.data.status).toBe("FAILED");
      expect(body.data.progress.sourceCheck).toBe("PASSED");
      expect(body.data.progress.logicCheck).toBe("FAILED");
      expect(body.data.progress.mintCheck).toBe("PENDING");
    });
  });

  // -----------------------------------------------------------------------
  // GET /v1/verification/:id/result
  // -----------------------------------------------------------------------

  describe("GET /v1/verification/:id/result", () => {
    it("returns detailed result for a passed verification", async () => {
      const verification = makeVerification({
        id: "ver_result_pass",
        status: "PASSED",
        readingCount: 10,
        totalCo2CapturedKg: 500,
        totalEnergyKwh: 175,
        avgPurity: 96,
        creditsToMint: 5,
      });
      seedState(VERIFICATIONS_STORE_KEY, {
        verifications: { ver_result_pass: verification },
      });

      const response = await server.inject({
        method: "GET",
        url: "/v1/verification/ver_result_pass/result",
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.success).toBe(true);
      expect(body.data.status).toBe("PASSED");
      expect(body.data.readingCount).toBe(10);
      expect(body.data.totalCo2CapturedKg).toBe(500);
      expect(body.data.totalEnergyKwh).toBe(175);
      expect(body.data.creditsToMint).toBe(5);
    });

    it("returns 404 for unknown verification", async () => {
      const response = await server.inject({
        method: "GET",
        url: "/v1/verification/ver_unknown/result",
      });

      expect(response.statusCode).toBe(404);
    });

    it("includes sourceDataHash in result", async () => {
      const verification = makeVerification({
        id: "ver_hash",
        sourceDataHash: "0x" + "f".repeat(64),
      });
      seedState(VERIFICATIONS_STORE_KEY, {
        verifications: { ver_hash: verification },
      });

      const response = await server.inject({
        method: "GET",
        url: "/v1/verification/ver_hash/result",
      });

      const body = response.json();
      expect(body.data.sourceDataHash).toBe("0x" + "f".repeat(64));
    });

    it("includes descriptive messages for each check phase", async () => {
      const verification = makeVerification({ id: "ver_messages" });
      seedState(VERIFICATIONS_STORE_KEY, {
        verifications: { ver_messages: verification },
      });

      const response = await server.inject({
        method: "GET",
        url: "/v1/verification/ver_messages/result",
      });

      const body = response.json();
      expect(body.data.sourceCheck.message).toBe(
        "Source dataset integrity verified",
      );
      expect(body.data.logicCheck.message).toBe("Physics constraints verified");
      expect(body.data.mintCheck.message).toBe(
        "No duplicate source hash detected",
      );
    });

    it("includes failure messages for failed checks", async () => {
      const now = new Date().toISOString();
      const verification = makeVerification({
        id: "ver_fail_msgs",
        status: "FAILED",
        sourceCheck: { status: "FAILED", completedAt: now },
        logicCheck: { status: "FAILED", completedAt: now, kwhPerTonne: 100, efficiencyFactor: 0 },
        mintCheck: { status: "FAILED", completedAt: now },
      });
      seedState(VERIFICATIONS_STORE_KEY, {
        verifications: { ver_fail_msgs: verification },
      });

      const response = await server.inject({
        method: "GET",
        url: "/v1/verification/ver_fail_msgs/result",
      });

      const body = response.json();
      expect(body.data.sourceCheck.message).toBe(
        "No eligible sensor readings for the requested period",
      );
      expect(body.data.logicCheck.message).toBe(
        "Energy/purity constraints failed",
      );
      expect(body.data.mintCheck.message).toBe(
        "Duplicate source hash or prior phase failure",
      );
    });

    it("returns null creditsToMint for a failed verification", async () => {
      const verification = makeVerification({
        id: "ver_no_credits",
        status: "FAILED",
        creditsToMint: null,
        sourceCheck: { status: "FAILED", completedAt: new Date().toISOString() },
        logicCheck: { status: "PENDING", completedAt: null },
        mintCheck: { status: "PENDING", completedAt: null },
      });
      seedState(VERIFICATIONS_STORE_KEY, {
        verifications: { ver_no_credits: verification },
      });

      const response = await server.inject({
        method: "GET",
        url: "/v1/verification/ver_no_credits/result",
      });

      const body = response.json();
      expect(body.data.creditsToMint).toBeNull();
    });

    it("returns avgPurity and dacUnitId in the result", async () => {
      const verification = makeVerification({
        id: "ver_purity",
        dacUnitId: "dac-unit-007",
        avgPurity: 97.5,
      });
      seedState(VERIFICATIONS_STORE_KEY, {
        verifications: { ver_purity: verification },
      });

      const response = await server.inject({
        method: "GET",
        url: "/v1/verification/ver_purity/result",
      });

      const body = response.json();
      expect(body.data.dacUnitId).toBe("dac-unit-007");
      expect(body.data.avgPurity).toBe(97.5);
    });
  });
});
