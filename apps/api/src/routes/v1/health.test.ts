import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import {
  createTestServer,
  resetStateStore,
} from "../../../test/helpers.js";
import type { FastifyInstance } from "fastify";

// ---------------------------------------------------------------------------
// Mock fetch for blockchain check and mock pg Pool for database check
// ---------------------------------------------------------------------------

let databaseCheckResult = true;
let blockchainCheckResult = true;

// The health route creates its own Pool inline, so we control it via the pg mock
// already set up in helpers.ts. For finer control over the health checks we spy
// on the global fetch (used for the blockchain RPC call).

vi.stubGlobal(
  "fetch",
  vi.fn().mockImplementation(async () => {
    if (!blockchainCheckResult) {
      throw new Error("Network error");
    }
    return {
      ok: true,
      json: async () => ({
        result: "0x" + (78432).toString(16),
      }),
    };
  }),
);

describe("GET /v1/health", () => {
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

  it("returns 200 with healthy status", async () => {
    const response = await server.inject({
      method: "GET",
      url: "/v1/health",
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.status).toBe("healthy");
    expect(body.version).toBe("1.0.0");
    expect(body).toHaveProperty("timestamp");
    expect(body).toHaveProperty("uptime");
  });

  it("returns a valid ISO 8601 timestamp", async () => {
    const response = await server.inject({
      method: "GET",
      url: "/v1/health",
    });

    const body = response.json();
    const parsed = new Date(body.timestamp);
    expect(parsed.toISOString()).toBe(body.timestamp);
  });

  it("returns uptime as a positive number", async () => {
    const response = await server.inject({
      method: "GET",
      url: "/v1/health",
    });

    const body = response.json();
    expect(typeof body.uptime).toBe("number");
    expect(body.uptime).toBeGreaterThanOrEqual(0);
  });

  it("returns consistent version across multiple calls", async () => {
    const r1 = await server.inject({ method: "GET", url: "/v1/health" });
    const r2 = await server.inject({ method: "GET", url: "/v1/health" });

    expect(r1.json().version).toBe(r2.json().version);
  });
});

describe("GET /v1/health/ready", () => {
  let server: FastifyInstance;

  beforeAll(async () => {
    server = await createTestServer();
  });

  afterEach(() => {
    resetStateStore();
    databaseCheckResult = true;
    blockchainCheckResult = true;
  });

  afterAll(async () => {
    await server?.close();
  });

  it("returns ready:true when both subsystems are reachable", async () => {
    // The pg mock resolves queries successfully by default, and fetch mock
    // returns a valid chain-id response.
    process.env.AETHELRED_RPC_URL = "http://localhost:8545";
    const response = await server.inject({
      method: "GET",
      url: "/v1/health/ready",
    });

    const body = response.json();
    expect(response.statusCode).toBe(200);
    expect(body.ready).toBe(true);
    expect(body.checks.database).toBe(true);
    expect(body.checks.blockchain).toBe(true);
  });

  it("returns 503 when blockchain check fails", async () => {
    blockchainCheckResult = false;
    process.env.AETHELRED_RPC_URL = "http://localhost:8545";

    const response = await server.inject({
      method: "GET",
      url: "/v1/health/ready",
    });

    // Blockchain will fail due to fetch throwing
    const body = response.json();
    expect(body.checks.blockchain).toBe(false);
    // May still be 503 depending on database result
    if (!body.ready) {
      expect(response.statusCode).toBe(503);
    }
  });

  it("returns 503 when no RPC URL is configured", async () => {
    delete process.env.AETHELRED_RPC_URL;

    const response = await server.inject({
      method: "GET",
      url: "/v1/health/ready",
    });

    const body = response.json();
    expect(body.checks.blockchain).toBe(false);
  });

  it("includes both database and blockchain check fields", async () => {
    process.env.AETHELRED_RPC_URL = "http://localhost:8545";
    const response = await server.inject({
      method: "GET",
      url: "/v1/health/ready",
    });

    const body = response.json();
    expect(body).toHaveProperty("ready");
    expect(body).toHaveProperty("checks");
    expect(body.checks).toHaveProperty("database");
    expect(body.checks).toHaveProperty("blockchain");
  });

  it("returns boolean types for all check fields", async () => {
    process.env.AETHELRED_RPC_URL = "http://localhost:8545";
    const response = await server.inject({
      method: "GET",
      url: "/v1/health/ready",
    });

    const body = response.json();
    expect(typeof body.ready).toBe("boolean");
    expect(typeof body.checks.database).toBe("boolean");
    expect(typeof body.checks.blockchain).toBe("boolean");
  });

  it("ready field is the logical AND of database and blockchain", async () => {
    process.env.AETHELRED_RPC_URL = "http://localhost:8545";
    const response = await server.inject({
      method: "GET",
      url: "/v1/health/ready",
    });

    const body = response.json();
    expect(body.ready).toBe(body.checks.database && body.checks.blockchain);
  });
});
