import rateLimit from "@fastify/rate-limit";
import jwt from "@fastify/jwt";
import Fastify from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mock state-store with in-memory Maps before any route code is imported
// ---------------------------------------------------------------------------
const store = new Map<string, unknown>();

vi.mock("../../lib/state-store.js", () => ({
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

vi.mock("../../lib/runtime-env.js", () => ({
  getApiRuntimeEnv: () => ({
    DATABASE_URL: "postgres://localhost:5432/test",
    JWT_SECRET: "a]ks8d7f6g5h4j3k2l1m0n9b8v7c6x5z4",
    SIWE_DOMAIN: "localhost",
    KYC_PROVIDER: "disabled",
  }),
}));

import { creditsRoutes } from "./credits.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const WALLET_A = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const WALLET_B = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const JWT_SECRET = "a]ks8d7f6g5h4j3k2l1m0n9b8v7c6x5z4";

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

  // Replicate the auth preHandler from server.ts
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

  await app.register(creditsRoutes, { prefix: "/v1/credits" });
  await app.ready();
  return app;
}

function signToken(
  app: ReturnType<typeof Fastify>,
  payload: { address: string; userType?: string },
) {
  return (app as unknown as { jwt: { sign: (p: object) => string } }).jwt.sign(payload);
}

/** Seed a passed verification into the store */
function seedVerification(
  id: string,
  overrides: Record<string, unknown> = {},
) {
  const verState = (store.get("verification:v1") as Record<string, unknown>) || {
    verifications: {},
  };
  const verifications =
    (verState.verifications as Record<string, unknown>) || {};
  verifications[id] = {
    id,
    dacUnitId: "dac_001",
    startTime: "2026-01-01T00:00:00.000Z",
    endTime: "2026-01-02T00:00:00.000Z",
    status: "PASSED",
    sourceDataHash: "0xabc123",
    efficiencyFactor: 10000,
    creditsToMint: 100,
    totalCo2CapturedKg: 500,
    totalEnergyKwh: 175,
    completedAt: "2026-01-02T01:00:00.000Z",
    ...overrides,
  };
  verState.verifications = verifications;
  store.set("verification:v1", verState);
}

/** Seed a minted credit directly */
function seedCredit(
  id: string,
  overrides: Record<string, unknown> = {},
) {
  const credState = (store.get("credits:v1") as Record<string, unknown>) || {
    credits: {},
    verificationToCredit: {},
    nextTokenId: 2,
  };
  const credits = (credState.credits as Record<string, unknown>) || {};
  credits[id] = {
    id,
    tokenId: "0x0000000000000000000000000000000000000000000000000000000000000001",
    verificationId: "ver_seed",
    dacUnitId: "dac_001",
    captureStartTime: "2026-01-01T00:00:00.000Z",
    captureEndTime: "2026-01-02T00:00:00.000Z",
    co2CapturedKg: 500,
    energyConsumedKwh: 175,
    creditsIssued: 100,
    initialCreditsIssued: 100,
    retiredAmount: 0,
    sourceDataHash: "0xabc123",
    verificationStatus: "minted",
    efficiencyFactor: 10000,
    mintTxHash: "0x" + "f".repeat(64),
    ipfsMetadataCid: "QmTest",
    arweaveTxId: null,
    currentOwnerId: `user_${WALLET_A.slice(2, 10)}`,
    currentOwnerWallet: WALLET_A,
    isRetired: false,
    retiredAt: null,
    retirementReason: null,
    createdAt: "2026-01-02T02:00:00.000Z",
    updatedAt: "2026-01-02T02:00:00.000Z",
    ...overrides,
  };
  credState.credits = credits;
  store.set("credits:v1", credState);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("credits routes", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeEach(async () => {
    store.clear();
    app = await buildApp();
  });

  // ---------- GET / ----------

  it("returns an empty list when no credits exist", async () => {
    const res = await app.inject({ method: "GET", url: "/v1/credits" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data).toEqual([]);
    expect(body.pagination.total).toBe(0);
  });

  it("lists credits and supports status filter", async () => {
    seedCredit("cred_1");
    seedCredit("cred_2", { verificationStatus: "retired", isRetired: true });

    const all = await app.inject({ method: "GET", url: "/v1/credits" });
    expect(all.json().pagination.total).toBe(2);

    const minted = await app.inject({
      method: "GET",
      url: "/v1/credits?status=minted",
    });
    expect(minted.json().data).toHaveLength(1);
    expect(minted.json().data[0].id).toBe("cred_1");
  });

  it("supports ownerId filter", async () => {
    seedCredit("cred_1", { currentOwnerId: "user_alice" });
    seedCredit("cred_2", { currentOwnerId: "user_bob" });

    const res = await app.inject({
      method: "GET",
      url: "/v1/credits?ownerId=user_alice",
    });
    expect(res.json().data).toHaveLength(1);
    expect(res.json().data[0].id).toBe("cred_1");
  });

  it("paginates results with limit and offset", async () => {
    seedCredit("cred_1");
    seedCredit("cred_2");
    seedCredit("cred_3");

    const res = await app.inject({
      method: "GET",
      url: "/v1/credits?limit=2&offset=1",
    });
    const body = res.json();
    expect(body.data).toHaveLength(2);
    expect(body.pagination).toEqual({ total: 3, limit: 2, offset: 1 });
  });

  // ---------- GET /:id ----------

  it("returns 404 for a non-existent credit", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/v1/credits/nonexistent",
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().success).toBe(false);
  });

  it("returns credit details for an existing credit", async () => {
    seedCredit("cred_detail");
    const res = await app.inject({
      method: "GET",
      url: "/v1/credits/cred_detail",
    });
    expect(res.statusCode).toBe(200);
    const data = res.json().data;
    expect(data.id).toBe("cred_detail");
    expect(data.co2CapturedKg).toBe(500);
  });

  // ---------- GET /:id/provenance ----------

  it("returns provenance timeline for a minted credit", async () => {
    seedCredit("cred_prov");
    const res = await app.inject({
      method: "GET",
      url: "/v1/credits/cred_prov/provenance",
    });
    expect(res.statusCode).toBe(200);
    const data = res.json().data;
    expect(data.creditId).toBe("cred_prov");
    expect(data.timeline).toHaveLength(3); // CAPTURE_STARTED, CAPTURE_COMPLETED, MINTED
    expect(data.timeline.map((e: { type: string }) => e.type)).toEqual([
      "CAPTURE_STARTED",
      "CAPTURE_COMPLETED",
      "MINTED",
    ]);
  });

  it("includes RETIRED event in provenance when credit is retired", async () => {
    seedCredit("cred_ret_prov", {
      isRetired: true,
      retiredAt: "2026-02-01T00:00:00.000Z",
      retirementReason: "Offset",
    });
    const res = await app.inject({
      method: "GET",
      url: "/v1/credits/cred_ret_prov/provenance",
    });
    const timeline = res.json().data.timeline;
    expect(timeline).toHaveLength(4);
    expect(timeline[3].type).toBe("RETIRED");
  });

  it("returns 404 for provenance of non-existent credit", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/v1/credits/nope/provenance",
    });
    expect(res.statusCode).toBe(404);
  });

  // ---------- POST /mint ----------

  it("returns 401 when minting without auth", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/credits/mint",
      payload: {
        verificationId: "ver_1",
        recipientWallet: WALLET_A,
        ipfsMetadataCid: "QmTest",
      },
    });
    expect(res.statusCode).toBe(401);
  });

  it("returns 404 when verification does not exist", async () => {
    const token = signToken(app, { address: WALLET_A });
    const res = await app.inject({
      method: "POST",
      url: "/v1/credits/mint",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        verificationId: "ver_missing",
        recipientWallet: WALLET_A,
        ipfsMetadataCid: "QmTest",
      },
    });
    expect(res.statusCode).toBe(404);
  });

  it("returns 400 when verification is not PASSED", async () => {
    seedVerification("ver_fail", { status: "FAILED" });
    const token = signToken(app, { address: WALLET_A });
    const res = await app.inject({
      method: "POST",
      url: "/v1/credits/mint",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        verificationId: "ver_fail",
        recipientWallet: WALLET_A,
        ipfsMetadataCid: "QmTest",
      },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toMatch(/pass/i);
  });

  it("mints credits successfully from a passed verification", async () => {
    seedVerification("ver_ok");
    const token = signToken(app, { address: WALLET_A });
    const res = await app.inject({
      method: "POST",
      url: "/v1/credits/mint",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        verificationId: "ver_ok",
        recipientWallet: WALLET_A,
        ipfsMetadataCid: "QmMinted",
      },
    });
    expect(res.statusCode).toBe(201);
    const data = res.json().data;
    expect(data.creditsIssued).toBe(100);
    expect(data.txHash).toMatch(/^0x[a-f0-9]{64}$/);
    expect(data.explorerUrl).toContain(data.txHash);
  });

  it("returns 409 when minting the same verification twice", async () => {
    seedVerification("ver_dup");
    const token = signToken(app, { address: WALLET_A });
    await app.inject({
      method: "POST",
      url: "/v1/credits/mint",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        verificationId: "ver_dup",
        recipientWallet: WALLET_A,
        ipfsMetadataCid: "QmFirst",
      },
    });

    const res2 = await app.inject({
      method: "POST",
      url: "/v1/credits/mint",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        verificationId: "ver_dup",
        recipientWallet: WALLET_A,
        ipfsMetadataCid: "QmSecond",
      },
    });
    expect(res2.statusCode).toBe(409);
  });

  it("returns 403 when non-admin mints to another wallet", async () => {
    seedVerification("ver_other");
    const token = signToken(app, { address: WALLET_A });
    const res = await app.inject({
      method: "POST",
      url: "/v1/credits/mint",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        verificationId: "ver_other",
        recipientWallet: WALLET_B,
        ipfsMetadataCid: "QmOther",
      },
    });
    expect(res.statusCode).toBe(403);
  });

  // ---------- POST /:id/retire ----------

  it("returns 401 when retiring without auth", async () => {
    seedCredit("cred_no_auth");
    const res = await app.inject({
      method: "POST",
      url: "/v1/credits/cred_no_auth/retire",
      payload: { amount: 10, reason: "Offset" },
    });
    expect(res.statusCode).toBe(401);
  });

  it("returns 404 when retiring a non-existent credit", async () => {
    const token = signToken(app, { address: WALLET_A });
    const res = await app.inject({
      method: "POST",
      url: "/v1/credits/missing/retire",
      headers: { authorization: `Bearer ${token}` },
      payload: { amount: 10, reason: "Offset" },
    });
    expect(res.statusCode).toBe(404);
  });

  it("returns 403 when non-owner tries to retire", async () => {
    seedCredit("cred_owned", { currentOwnerWallet: WALLET_A });
    const token = signToken(app, { address: WALLET_B });
    const res = await app.inject({
      method: "POST",
      url: "/v1/credits/cred_owned/retire",
      headers: { authorization: `Bearer ${token}` },
      payload: { amount: 10, reason: "Offset" },
    });
    expect(res.statusCode).toBe(403);
  });

  it("partially retires credits (reduces balance, not fully retired)", async () => {
    seedCredit("cred_partial", { creditsIssued: 100, currentOwnerWallet: WALLET_A });
    const token = signToken(app, { address: WALLET_A });
    const res = await app.inject({
      method: "POST",
      url: "/v1/credits/cred_partial/retire",
      headers: { authorization: `Bearer ${token}` },
      payload: { amount: 40, reason: "Partial offset" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.amountRetired).toBe(40);

    // Verify remaining balance
    const detail = await app.inject({
      method: "GET",
      url: "/v1/credits/cred_partial",
    });
    expect(detail.json().data.creditsIssued).toBe(60);
    expect(detail.json().data.isRetired).toBe(false);
  });

  it("fully retires credit when amount equals balance", async () => {
    seedCredit("cred_full", { creditsIssued: 50, currentOwnerWallet: WALLET_A });
    const token = signToken(app, { address: WALLET_A });
    const res = await app.inject({
      method: "POST",
      url: "/v1/credits/cred_full/retire",
      headers: { authorization: `Bearer ${token}` },
      payload: { amount: 50, reason: "Full offset" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.certificateUrl).toContain("cred_full");

    const detail = await app.inject({
      method: "GET",
      url: "/v1/credits/cred_full",
    });
    expect(detail.json().data.isRetired).toBe(true);
    expect(detail.json().data.verificationStatus).toBe("retired");
  });

  it("returns 400 when retire amount exceeds available balance", async () => {
    seedCredit("cred_over", { creditsIssued: 10, currentOwnerWallet: WALLET_A });
    const token = signToken(app, { address: WALLET_A });
    const res = await app.inject({
      method: "POST",
      url: "/v1/credits/cred_over/retire",
      headers: { authorization: `Bearer ${token}` },
      payload: { amount: 999, reason: "Too much" },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toMatch(/exceed/i);
  });
});
