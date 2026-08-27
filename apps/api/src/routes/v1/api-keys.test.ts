import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  createTestServer,
  generateAuthToken,
  makeDacUnit,
  resetStateStore,
  seedState,
} from "../../../test/helpers.js";

import type { FastifyInstance } from "fastify";

const DAC_UNITS_STORE_KEY = "dac-units:v1";
const OWNER = "0x1234567890abcdef1234567890abcdef12345678";
const OTHER = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

describe("Sensor credential routes", () => {
  let server: FastifyInstance;

  beforeAll(async () => {
    server = await createTestServer();
  });

  beforeEach(() => {
    resetStateStore();
    const unit = makeDacUnit({
      id: "dac_owned",
      operatorWallet: OWNER,
      status: "active",
    });
    seedState(DAC_UNITS_STORE_KEY, { units: { dac_owned: unit } });
  });

  afterAll(async () => {
    await server.close();
  });

  it("provisions a project-bound key, masks it in listings, and revokes it", async () => {
    const ownerToken = generateAuthToken(server, {
      address: OWNER,
      sub: OWNER,
    });
    const created = await server.inject({
      method: "POST",
      url: "/v1/api-keys",
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        name: "Primary capture meter",
        type: "sensor",
        dacUnitId: "dac_owned",
        expiresInDays: 30,
      },
    });

    expect(created.statusCode).toBe(201);
    const createdKey = created.json().data;
    expect(createdKey.key).toMatch(/^tqs_[a-f0-9]{64}$/);
    expect(createdKey.dacUnitId).toBe("dac_owned");
    expect(createdKey.permissions).toEqual(["sensors:write"]);

    const listed = await server.inject({
      method: "GET",
      url: "/v1/api-keys",
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    expect(listed.statusCode).toBe(200);
    expect(listed.json().data).toHaveLength(1);
    expect(listed.json().data[0].maskedKey).not.toContain(
      createdKey.key.slice(8),
    );

    const accepted = await server.inject({
      method: "POST",
      url: "/v1/sensors/readings",
      headers: { "x-sensor-api-key": createdKey.key },
      payload: {
        sensorId: "capture-meter-01",
        co2CaptureRateKgHour: 100,
        energyConsumptionKwh: 35,
        co2PurityPercentage: 96,
        measurementDurationSeconds: 3600,
      },
    });
    expect(accepted.statusCode).toBe(201);

    const revoked = await server.inject({
      method: "DELETE",
      url: `/v1/api-keys/${createdKey.id}`,
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    expect(revoked.statusCode).toBe(200);

    const rejected = await server.inject({
      method: "POST",
      url: "/v1/sensors/readings",
      headers: { "x-sensor-api-key": createdKey.key },
      payload: {
        sensorId: "capture-meter-01",
        co2CaptureRateKgHour: 100,
        energyConsumptionKwh: 35,
        co2PurityPercentage: 96,
        measurementDurationSeconds: 3600,
      },
    });
    expect(rejected.statusCode).toBe(401);
  });

  it("rejects unsupported credential types and cross-operator provisioning", async () => {
    const ownerToken = generateAuthToken(server, {
      address: OWNER,
      sub: OWNER,
    });
    const unsupported = await server.inject({
      method: "POST",
      url: "/v1/api-keys",
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { name: "Unsupported", type: "full-access" },
    });
    expect(unsupported.statusCode).toBe(400);

    const otherToken = generateAuthToken(server, {
      address: OTHER,
      sub: OTHER,
    });
    const crossOperator = await server.inject({
      method: "POST",
      url: "/v1/api-keys",
      headers: { authorization: `Bearer ${otherToken}` },
      payload: {
        name: "Wrong operator",
        type: "sensor",
        dacUnitId: "dac_owned",
      },
    });
    expect(crossOperator.statusCode).toBe(403);
  });
});
