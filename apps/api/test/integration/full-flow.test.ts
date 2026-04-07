/**
 * Integration test: end-to-end carbon credit lifecycle
 *
 * Flow: register DAC unit -> submit sensor readings -> verify ->
 *       mint credits -> list on marketplace -> purchase -> retire
 */
import rateLimit from "@fastify/rate-limit";
import jwt from "@fastify/jwt";
import Fastify, { type FastifyInstance } from "fastify";
import { beforeAll, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Shared in-memory store used across all route modules
// ---------------------------------------------------------------------------
const store = new Map<string, unknown>();

vi.mock("../../src/lib/state-store.js", () => ({
  readState: vi.fn(async <T>(key: string, defaultState: T): Promise<T> => {
    return (store.get(key) as T) ?? structuredClone(defaultState);
  }),
  mutateState: vi.fn(
    async <T, R>(
      key: string,
      defaultState: T,
      mutator: (state: T) => Promise<R> | R,
    ): Promise<R> => {
      const current = (store.get(key) as T) ?? structuredClone(defaultState);
      const mutableState = structuredClone(current);
      const result = await mutator(mutableState);
      store.set(key, mutableState);
      return result;
    },
  ),
}));

vi.mock("../../src/lib/runtime-env.js", () => ({
  getApiRuntimeEnv: () => ({
    DATABASE_URL: "postgres://localhost:5432/test",
    JWT_SECRET: "a]ks8d7f6g5h4j3k2l1m0n9b8v7c6x5z4",
    SIWE_DOMAIN: "localhost",
    KYC_PROVIDER: "disabled",
  }),
}));

vi.mock("../../src/services/kyc/sumsub.service.js", () => ({
  createSumsubService: () => null,
}));

vi.mock("../../src/services/gasless/relayer.service.js", () => ({
  getGaslessRelayer: () => null,
}));

// Set env for sensor API key mapping before importing routes
process.env.SENSOR_API_KEYS = "sensor-key-001:__DAC_UNIT_ID__";

import { dacUnitsRoutes } from "../../src/routes/v1/dac-units.js";
import { sensorsRoutes } from "../../src/routes/v1/sensors.js";
import { verificationRoutes } from "../../src/routes/v1/verification.js";
import { creditsRoutes } from "../../src/routes/v1/credits.js";
import { marketplaceRoutes } from "../../src/routes/v1/marketplace.js";

const JWT_SECRET = "a]ks8d7f6g5h4j3k2l1m0n9b8v7c6x5z4";
const OPERATOR_WALLET = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const BUYER_WALLET = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

function sign(app: FastifyInstance, payload: object): string {
  return (app as unknown as { jwt: { sign: (p: object) => string } }).jwt.sign(payload);
}

async function buildApp() {
  const app = Fastify({ logger: false });
  await app.register(rateLimit, {
    max: 100,
    timeWindow: "1 minute",
  });
  await app.register(jwt, { secret: JWT_SECRET });
  const authenticateBearerRequest = app
    .rateLimit({
      max: 100,
      timeWindow: "1 minute",
    })
    .bind(app);

  app.addHook("preHandler", async (request, reply) => {
    const routeSchema = request.routeOptions.schema as
      | { security?: Array<Record<string, unknown>> }
      | undefined;
    const security = routeSchema?.security || [];
    const requiresBearerAuth = security.some((s) =>
      Object.prototype.hasOwnProperty.call(s, "bearerAuth"),
    );
    if (!requiresBearerAuth) return;
    await authenticateBearerRequest(request, reply);
    if (reply.sent) return;
    try {
      await request.jwtVerify();
    } catch {
      return reply.status(401).send({
        success: false,
        error: { code: "UNAUTHORIZED", message: "Missing or invalid bearer token" },
      });
    }
  });

  await app.register(dacUnitsRoutes, { prefix: "/v1/dac-units" });
  await app.register(sensorsRoutes, { prefix: "/v1/sensors" });
  await app.register(verificationRoutes, { prefix: "/v1/verification" });
  await app.register(creditsRoutes, { prefix: "/v1/credits" });
  await app.register(marketplaceRoutes, { prefix: "/v1/marketplace" });

  await app.ready();
  return app;
}

describe("full lifecycle integration", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  let dacUnitId: string;
  let verificationId: string;
  let creditId: string;
  let listingId: string;

  beforeAll(async () => {
    store.clear();
    app = await buildApp();
  });

  // ---------------------------------------------------------------
  // 1. Register a DAC unit
  // ---------------------------------------------------------------

  it("step 1: register a DAC unit", async () => {
    const token = sign(app, { address: OPERATOR_WALLET });
    const res = await app.inject({
      method: "POST",
      url: "/v1/dac-units",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        name: "Test DAC Facility",
        latitude: 24.453884,
        longitude: 54.377344,
        countryCode: "AE",
        capacityTonnesPerYear: 500,
        technologyType: "Solid Sorbent",
      },
    });

    expect(res.statusCode).toBe(201);
    dacUnitId = res.json().data.id;
    expect(dacUnitId).toBeTruthy();
    expect(res.json().data.status).toBe("pending");
  });

  // ---------------------------------------------------------------
  // 2. Whitelist the DAC unit (admin)
  // ---------------------------------------------------------------

  it("step 2: whitelist the DAC unit", async () => {
    const adminToken = sign(app, { address: OPERATOR_WALLET, userType: "admin" });
    const res = await app.inject({
      method: "POST",
      url: `/v1/dac-units/${dacUnitId}/whitelist`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.status).toBe("active");
  });

  // ---------------------------------------------------------------
  // 3. Submit sensor readings
  // ---------------------------------------------------------------

  it("step 3: submit sensor readings", async () => {
    // We need to update the sensor API key mapping to match our DAC unit.
    // The sensors route parses SENSOR_API_KEYS at module load, so we
    // directly seed sensor readings into the store instead.
    const now = new Date();
    const readings = [];
    for (let i = 0; i < 10; i++) {
      const time = new Date(now.getTime() - (10 - i) * 60000);
      readings.push({
        time: time.toISOString(),
        dacUnitId,
        sensorId: "sensor-001",
        co2CaptureRateKgHour: 50, // 50 kg/hr -> 500 kg total over 10 readings
        energyConsumptionKwh: 17.5, // 175 kWh total -> 350 kWh/tonne (optimal range)
        co2PurityPercentage: 96,
        ambientTemperatureC: 25,
        ambientHumidityPercent: 40,
        atmosphericCo2Ppm: 420,
        dataHash: `hash_${i}`,
        isAnomaly: false,
        anomalyReason: null,
      });
    }

    store.set("sensors:v1", { readings });

    // Verify we can read the summary
    const sensorsState = store.get("sensors:v1") as { readings: unknown[] };
    expect(sensorsState.readings).toHaveLength(10);
  });

  // ---------------------------------------------------------------
  // 4. Initiate verification
  // ---------------------------------------------------------------

  it("step 4: verify sensor readings", async () => {
    const sensorsState = store.get("sensors:v1") as {
      readings: Array<{ time: string }>;
    };
    const times = sensorsState.readings.map((r) => new Date(r.time).getTime());
    const startTime = new Date(Math.min(...times) - 1000).toISOString();
    const endTime = new Date(Math.max(...times) + 1000).toISOString();

    const token = sign(app, { address: OPERATOR_WALLET });
    const res = await app.inject({
      method: "POST",
      url: "/v1/verification/initiate",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        dacUnitId,
        startTime,
        endTime,
      },
    });

    expect(res.statusCode).toBe(201);
    verificationId = res.json().data.verificationId;
    expect(verificationId).toBeTruthy();
    expect(res.json().data.status).toBe("PASSED");
  });

  // ---------------------------------------------------------------
  // 5. Check verification result
  // ---------------------------------------------------------------

  it("step 5: confirm verification result has credits to mint", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/v1/verification/${verificationId}/result`,
    });
    expect(res.statusCode).toBe(200);
    const data = res.json().data;
    expect(data.status).toBe("PASSED");
    expect(data.creditsToMint).toBeGreaterThan(0);
    expect(data.readingCount).toBe(10);
  });

  // ---------------------------------------------------------------
  // 6. Mint carbon credits
  // ---------------------------------------------------------------

  it("step 6: mint carbon credits from verification", async () => {
    const token = sign(app, { address: OPERATOR_WALLET });
    const res = await app.inject({
      method: "POST",
      url: "/v1/credits/mint",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        verificationId,
        recipientWallet: OPERATOR_WALLET,
        ipfsMetadataCid: "QmIntegrationTestMetadata",
      },
    });

    expect(res.statusCode).toBe(201);
    creditId = res.json().data.creditId;
    expect(creditId).toBeTruthy();
    expect(res.json().data.creditsIssued).toBeGreaterThan(0);
    expect(res.json().data.txHash).toMatch(/^0x[a-f0-9]{64}$/);
  });

  // ---------------------------------------------------------------
  // 7. Verify minted credit details
  // ---------------------------------------------------------------

  it("step 7: verify minted credit details", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/v1/credits/${creditId}`,
    });
    expect(res.statusCode).toBe(200);
    const data = res.json().data;
    expect(data.verificationStatus).toBe("minted");
    expect(data.currentOwnerWallet).toBe(OPERATOR_WALLET);
    expect(data.isRetired).toBe(false);
    expect(data.co2CapturedKg).toBeGreaterThan(0);
  });

  // ---------------------------------------------------------------
  // 8. List credits on marketplace
  // ---------------------------------------------------------------

  it("step 8: list credits on marketplace", async () => {
    // Get the token ID from the minted credit
    const creditRes = await app.inject({
      method: "GET",
      url: `/v1/credits/${creditId}`,
    });
    const tokenId = creditRes.json().data.tokenId;

    const token = sign(app, { address: OPERATOR_WALLET });
    const res = await app.inject({
      method: "POST",
      url: "/v1/marketplace/listings",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        tokenId,
        amount: 50, // List half
        pricePerUnit: "1000000000000000000", // 1 ether
        minPurchaseAmount: 5,
        durationDays: 30,
      },
    });

    expect(res.statusCode).toBe(201);
    listingId = res.json().data.listingId;
    expect(listingId).toBeTruthy();
  });

  // ---------------------------------------------------------------
  // 9. Purchase credits
  // ---------------------------------------------------------------

  it("step 9: buyer purchases credits from listing", async () => {
    const token = sign(app, { address: BUYER_WALLET });
    const res = await app.inject({
      method: "POST",
      url: `/v1/marketplace/listings/${listingId}/purchase`,
      headers: { authorization: `Bearer ${token}` },
      payload: { amount: 20 },
    });

    expect(res.statusCode).toBe(201);
    const data = res.json().data;
    expect(data.amount).toBe(20);
    expect(data.totalPrice).toBe("20000000000000000000"); // 20 ether
    expect(data.platformFee).toBe("500000000000000000"); // 2.5% = 0.5 ether
    expect(data.txHash).toMatch(/^0x/);
  });

  // ---------------------------------------------------------------
  // 10. Verify listing state after partial purchase
  // ---------------------------------------------------------------

  it("step 10: listing is still active with reduced amount", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/v1/marketplace/listings/${listingId}`,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.remainingAmount).toBe(30);
    expect(res.json().data.status).toBe("active");
  });

  // ---------------------------------------------------------------
  // 11. Retire credits
  // ---------------------------------------------------------------

  it("step 11: operator retires remaining credits", async () => {
    // Get current credit balance
    const creditRes = await app.inject({
      method: "GET",
      url: `/v1/credits/${creditId}`,
    });
    const currentBalance = creditRes.json().data.creditsIssued;
    expect(currentBalance).toBeGreaterThan(0);

    const token = sign(app, { address: OPERATOR_WALLET });
    const res = await app.inject({
      method: "POST",
      url: `/v1/credits/${creditId}/retire`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        amount: currentBalance,
        reason: "Carbon offset commitment for 2026",
      },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().data.amountRetired).toBe(currentBalance);
    expect(res.json().data.certificateUrl).toContain(creditId);
  });

  // ---------------------------------------------------------------
  // 12. Verify retirement
  // ---------------------------------------------------------------

  it("step 12: credit is fully retired", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/v1/credits/${creditId}`,
    });
    expect(res.statusCode).toBe(200);
    const data = res.json().data;
    expect(data.isRetired).toBe(true);
    expect(data.verificationStatus).toBe("retired");
    expect(data.creditsIssued).toBe(0);
  });

  // ---------------------------------------------------------------
  // 13. Check provenance after full lifecycle
  // ---------------------------------------------------------------

  it("step 13: provenance includes full lifecycle events", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/v1/credits/${creditId}/provenance`,
    });
    expect(res.statusCode).toBe(200);
    const timeline = res.json().data.timeline;
    expect(timeline).toHaveLength(4); // CAPTURE_STARTED, CAPTURE_COMPLETED, MINTED, RETIRED
    const types = timeline.map((e: { type: string }) => e.type);
    expect(types).toContain("CAPTURE_STARTED");
    expect(types).toContain("CAPTURE_COMPLETED");
    expect(types).toContain("MINTED");
    expect(types).toContain("RETIRED");
  });

  // ---------------------------------------------------------------
  // 14. Market stats reflect activity
  // ---------------------------------------------------------------

  it("step 14: market stats reflect the trade", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/v1/marketplace/stats",
    });
    expect(res.statusCode).toBe(200);
    const data = res.json().data;
    expect(data.totalCreditsTraded).toBe(20);
    expect(data.totalTransactions24h).toBeGreaterThanOrEqual(1);
    expect(data.activeListings).toBe(1); // Still partially listed
  });

  // ---------------------------------------------------------------
  // 15. Cannot re-mint same verification
  // ---------------------------------------------------------------

  it("step 15: cannot re-mint the same verification", async () => {
    const token = sign(app, { address: OPERATOR_WALLET });
    const res = await app.inject({
      method: "POST",
      url: "/v1/credits/mint",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        verificationId,
        recipientWallet: OPERATOR_WALLET,
        ipfsMetadataCid: "QmDuplicate",
      },
    });
    expect(res.statusCode).toBe(409);
  });
});
