import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import {
  createTestServer,
  generateAdminToken,
  generateAuthToken,
  makeDacUnit,
  resetStateStore,
  seedState,
} from "../../../test/helpers.js";
import type { FastifyInstance } from "fastify";

const DAC_UNITS_STORE_KEY = "dac-units:v1";

describe("DAC Units routes", () => {
  let server: FastifyInstance;

  beforeAll(async () => {
    server = await createTestServer();
  });

  afterEach(() => {
    resetStateStore();
  });

  afterAll(async () => {
    await server.close();
  });

  // -----------------------------------------------------------------------
  // GET /v1/dac-units
  // -----------------------------------------------------------------------

  describe("GET /v1/dac-units", () => {
    it("returns an empty list when no units exist", async () => {
      const response = await server.inject({
        method: "GET",
        url: "/v1/dac-units",
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.success).toBe(true);
      expect(body.data).toEqual([]);
      expect(body.pagination.total).toBe(0);
    });

    it("returns seeded units", async () => {
      const unit = makeDacUnit({ id: "dac_001" });
      seedState(DAC_UNITS_STORE_KEY, { units: { dac_001: unit } });

      const response = await server.inject({
        method: "GET",
        url: "/v1/dac-units",
      });

      const body = response.json();
      expect(body.data).toHaveLength(1);
      expect(body.data[0].id).toBe("dac_001");
      expect(body.data[0].name).toBe("Test DAC Facility");
      expect(body.pagination.total).toBe(1);
    });

    it("filters units by status query parameter", async () => {
      const activeUnit = makeDacUnit({ id: "dac_active", status: "active" });
      const pendingUnit = makeDacUnit({ id: "dac_pending", status: "pending" });
      seedState(DAC_UNITS_STORE_KEY, {
        units: { dac_active: activeUnit, dac_pending: pendingUnit },
      });

      const response = await server.inject({
        method: "GET",
        url: "/v1/dac-units?status=active",
      });

      const body = response.json();
      expect(body.data).toHaveLength(1);
      expect(body.data[0].id).toBe("dac_active");
    });

    it("filters units by operatorId", async () => {
      const unit1 = makeDacUnit({ id: "dac_op1", operatorId: "operator_aaa" });
      const unit2 = makeDacUnit({ id: "dac_op2", operatorId: "operator_bbb" });
      seedState(DAC_UNITS_STORE_KEY, {
        units: { dac_op1: unit1, dac_op2: unit2 },
      });

      const response = await server.inject({
        method: "GET",
        url: "/v1/dac-units?operatorId=operator_aaa",
      });

      const body = response.json();
      expect(body.data).toHaveLength(1);
      expect(body.data[0].id).toBe("dac_op1");
    });

    it("respects limit pagination parameter", async () => {
      const units: Record<string, ReturnType<typeof makeDacUnit>> = {};
      for (let i = 0; i < 5; i++) {
        const id = `dac_${i}`;
        units[id] = makeDacUnit({ id });
      }
      seedState(DAC_UNITS_STORE_KEY, { units });

      const response = await server.inject({
        method: "GET",
        url: "/v1/dac-units?limit=2",
      });

      const body = response.json();
      expect(body.data).toHaveLength(2);
      expect(body.pagination.limit).toBe(2);
      expect(body.pagination.total).toBe(5);
    });

    it("respects offset pagination parameter", async () => {
      const units: Record<string, ReturnType<typeof makeDacUnit>> = {};
      for (let i = 0; i < 5; i++) {
        const id = `dac_${i}`;
        units[id] = makeDacUnit({ id, name: `Unit ${i}` });
      }
      seedState(DAC_UNITS_STORE_KEY, { units });

      const response = await server.inject({
        method: "GET",
        url: "/v1/dac-units?limit=2&offset=3",
      });

      const body = response.json();
      expect(body.data).toHaveLength(2);
      expect(body.pagination.offset).toBe(3);
    });

    it("returns default pagination when no params given", async () => {
      const response = await server.inject({
        method: "GET",
        url: "/v1/dac-units",
      });

      const body = response.json();
      expect(body.pagination.limit).toBe(50);
      expect(body.pagination.offset).toBe(0);
    });
  });

  // -----------------------------------------------------------------------
  // POST /v1/dac-units
  // -----------------------------------------------------------------------

  describe("POST /v1/dac-units", () => {
    it("creates a new DAC unit with valid auth", async () => {
      const token = generateAuthToken(server);

      const response = await server.inject({
        method: "POST",
        url: "/v1/dac-units",
        headers: { authorization: `Bearer ${token}` },
        payload: {
          name: "New Facility",
          latitude: 25.0,
          longitude: 55.0,
          countryCode: "AE",
        },
      });

      expect(response.statusCode).toBe(201);
      const body = response.json();
      expect(body.success).toBe(true);
      expect(body.data.id).toMatch(/^dac_/);
      expect(body.data.status).toBe("pending");
    });

    it("returns 401 without authentication", async () => {
      const response = await server.inject({
        method: "POST",
        url: "/v1/dac-units",
        payload: {
          name: "Facility",
          latitude: 25.0,
          longitude: 55.0,
          countryCode: "AE",
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it("returns a unitId that looks like a hex string", async () => {
      const token = generateAuthToken(server);

      const response = await server.inject({
        method: "POST",
        url: "/v1/dac-units",
        headers: { authorization: `Bearer ${token}` },
        payload: {
          name: "Hex Test",
          latitude: 10.0,
          longitude: 20.0,
          countryCode: "US",
        },
      });

      const body = response.json();
      expect(body.data.unitId).toMatch(/^0x[a-f0-9]+$/);
    });

    it("rejects invalid latitude (out of range)", async () => {
      const token = generateAuthToken(server);

      const response = await server.inject({
        method: "POST",
        url: "/v1/dac-units",
        headers: { authorization: `Bearer ${token}` },
        payload: {
          name: "Bad Lat",
          latitude: 200,
          longitude: 55.0,
          countryCode: "AE",
        },
      });

      // Zod validation will cause a 400 or 500
      expect(response.statusCode).toBeGreaterThanOrEqual(400);
    });

    it("rejects missing required field (name)", async () => {
      const token = generateAuthToken(server);

      const response = await server.inject({
        method: "POST",
        url: "/v1/dac-units",
        headers: { authorization: `Bearer ${token}` },
        payload: {
          latitude: 25.0,
          longitude: 55.0,
          countryCode: "AE",
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it("accepts optional fields (capacityTonnesPerYear, technologyType)", async () => {
      const token = generateAuthToken(server);

      const response = await server.inject({
        method: "POST",
        url: "/v1/dac-units",
        headers: { authorization: `Bearer ${token}` },
        payload: {
          name: "Full Facility",
          latitude: 25.0,
          longitude: 55.0,
          countryCode: "AE",
          capacityTonnesPerYear: 5000,
          technologyType: "Solid Sorbent",
        },
      });

      expect(response.statusCode).toBe(201);
    });
  });

  // -----------------------------------------------------------------------
  // GET /v1/dac-units/:id
  // -----------------------------------------------------------------------

  describe("GET /v1/dac-units/:id", () => {
    it("returns the unit when it exists", async () => {
      const unit = makeDacUnit({ id: "dac_existing" });
      seedState(DAC_UNITS_STORE_KEY, { units: { dac_existing: unit } });

      const response = await server.inject({
        method: "GET",
        url: "/v1/dac-units/dac_existing",
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.success).toBe(true);
      expect(body.data.id).toBe("dac_existing");
      expect(body.data.name).toBe("Test DAC Facility");
    });

    it("returns 404 for a non-existent unit", async () => {
      const response = await server.inject({
        method: "GET",
        url: "/v1/dac-units/does_not_exist",
      });

      expect(response.statusCode).toBe(404);
      const body = response.json();
      expect(body.success).toBe(false);
      expect(body.error).toBe("DAC unit not found");
    });

    it("returns full unit details including coordinates and technology", async () => {
      const unit = makeDacUnit({
        id: "dac_detail",
        latitude: 30.0,
        longitude: 40.0,
        technologyType: "Liquid Solvent",
      });
      seedState(DAC_UNITS_STORE_KEY, { units: { dac_detail: unit } });

      const response = await server.inject({
        method: "GET",
        url: "/v1/dac-units/dac_detail",
      });

      const body = response.json();
      expect(body.data.latitude).toBe(30.0);
      expect(body.data.longitude).toBe(40.0);
      expect(body.data.technologyType).toBe("Liquid Solvent");
    });
  });

  // -----------------------------------------------------------------------
  // POST /v1/dac-units/:id/whitelist
  // -----------------------------------------------------------------------

  describe("POST /v1/dac-units/:id/whitelist", () => {
    it("whitelists a unit when called by an admin", async () => {
      const unit = makeDacUnit({ id: "dac_wl" });
      seedState(DAC_UNITS_STORE_KEY, { units: { dac_wl: unit } });

      const adminToken = generateAdminToken(server);

      const response = await server.inject({
        method: "POST",
        url: "/v1/dac-units/dac_wl/whitelist",
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.success).toBe(true);
      expect(body.data.status).toBe("active");
      expect(body.data.whitelistedAt).toBeTruthy();
      expect(body.data.txHash).toMatch(/^0x[a-f0-9]{64}$/);
    });

    it("returns 403 when called by a non-admin operator", async () => {
      const unit = makeDacUnit({ id: "dac_wl_op" });
      seedState(DAC_UNITS_STORE_KEY, { units: { dac_wl_op: unit } });

      const operatorToken = generateAuthToken(server, { userType: "operator" });

      const response = await server.inject({
        method: "POST",
        url: "/v1/dac-units/dac_wl_op/whitelist",
        headers: { authorization: `Bearer ${operatorToken}` },
      });

      expect(response.statusCode).toBe(403);
      const body = response.json();
      expect(body.error).toBe("Admin role required");
    });

    it("returns 401 without authentication", async () => {
      const response = await server.inject({
        method: "POST",
        url: "/v1/dac-units/some_id/whitelist",
      });

      expect(response.statusCode).toBe(401);
    });

    it("returns 404 when the unit does not exist", async () => {
      const adminToken = generateAdminToken(server);

      const response = await server.inject({
        method: "POST",
        url: "/v1/dac-units/nonexistent/whitelist",
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(response.statusCode).toBe(404);
      const body = response.json();
      expect(body.error).toBe("DAC unit not found");
    });

    it("returns 403 for an auditor role", async () => {
      const unit = makeDacUnit({ id: "dac_wl_aud" });
      seedState(DAC_UNITS_STORE_KEY, { units: { dac_wl_aud: unit } });

      const auditorToken = generateAuthToken(server, { userType: "auditor" });

      const response = await server.inject({
        method: "POST",
        url: "/v1/dac-units/dac_wl_aud/whitelist",
        headers: { authorization: `Bearer ${auditorToken}` },
      });

      expect(response.statusCode).toBe(403);
    });
  });
});
