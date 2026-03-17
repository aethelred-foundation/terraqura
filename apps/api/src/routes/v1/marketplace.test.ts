import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock state-store
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

import Fastify from "fastify";
import jwt from "@fastify/jwt";
import { marketplaceRoutes } from "./marketplace.js";

const SELLER = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const BUYER = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const THIRD_PARTY = "0xcccccccccccccccccccccccccccccccccccccccc";
const JWT_SECRET = "a]ks8d7f6g5h4j3k2l1m0n9b8v7c6x5z4";

async function buildApp() {
  const app = Fastify({ logger: false });
  await app.register(jwt, { secret: JWT_SECRET });

  app.addHook("preHandler", async (request, reply) => {
    const routeSchema = request.routeOptions.schema as
      | { security?: Array<Record<string, unknown>> }
      | undefined;
    const security = routeSchema?.security || [];
    const requiresBearerAuth = security.some((s) =>
      Object.prototype.hasOwnProperty.call(s, "bearerAuth"),
    );
    if (!requiresBearerAuth) return;
    try {
      await request.jwtVerify();
    } catch {
      return reply.status(401).send({
        success: false,
        error: { code: "UNAUTHORIZED", message: "Missing or invalid bearer token" },
      });
    }
  });

  await app.register(marketplaceRoutes, { prefix: "/v1/marketplace" });
  await app.ready();
  return app;
}

function sign(app: ReturnType<typeof Fastify>, payload: object) {
  return (app as unknown as { jwt: { sign: (p: object) => string } }).jwt.sign(payload);
}

/** Creates a listing via the API and returns the parsed response body */
async function createListing(
  app: Awaited<ReturnType<typeof buildApp>>,
  wallet: string,
  overrides: Record<string, unknown> = {},
) {
  const token = sign(app, { address: wallet });
  const res = await app.inject({
    method: "POST",
    url: "/v1/marketplace/listings",
    headers: { authorization: `Bearer ${token}` },
    payload: {
      tokenId: "token_1",
      amount: 100,
      pricePerUnit: "1000000000000000000", // 1 ether in wei
      ...overrides,
    },
  });
  return res;
}

describe("marketplace routes", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeEach(async () => {
    store.clear();
    app = await buildApp();
  });

  // ---------- Listings ----------

  it("creates a listing successfully", async () => {
    const res = await createListing(app, SELLER);
    expect(res.statusCode).toBe(201);
    const data = res.json().data;
    expect(data.status).toBe("active");
    expect(data.txHash).toMatch(/^0x/);
  });

  it("returns 401 when creating listing without auth", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/marketplace/listings",
      payload: { tokenId: "t", amount: 1, pricePerUnit: "100" },
    });
    expect(res.statusCode).toBe(401);
  });

  it("lists active listings by default", async () => {
    await createListing(app, SELLER);
    await createListing(app, SELLER, { tokenId: "token_2" });

    const res = await app.inject({
      method: "GET",
      url: "/v1/marketplace/listings",
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data).toHaveLength(2);
  });

  it("returns listing details by id", async () => {
    const created = await createListing(app, SELLER);
    const listingId = created.json().data.listingId;

    const res = await app.inject({
      method: "GET",
      url: `/v1/marketplace/listings/${listingId}`,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.tokenId).toBe("token_1");
  });

  it("returns 404 for non-existent listing", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/v1/marketplace/listings/nope",
    });
    expect(res.statusCode).toBe(404);
  });

  // ---------- Cancel listing ----------

  it("cancels own listing", async () => {
    const created = await createListing(app, SELLER);
    const listingId = created.json().data.listingId;

    const token = sign(app, { address: SELLER });
    const res = await app.inject({
      method: "DELETE",
      url: `/v1/marketplace/listings/${listingId}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.status).toBe("cancelled");
  });

  it("returns 403 when non-owner cancels listing", async () => {
    const created = await createListing(app, SELLER);
    const listingId = created.json().data.listingId;

    const token = sign(app, { address: BUYER });
    const res = await app.inject({
      method: "DELETE",
      url: `/v1/marketplace/listings/${listingId}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(403);
  });

  // ---------- Purchase ----------

  it("purchases credits from a listing", async () => {
    const created = await createListing(app, SELLER, { minPurchaseAmount: 1 });
    const listingId = created.json().data.listingId;

    const token = sign(app, { address: BUYER });
    const res = await app.inject({
      method: "POST",
      url: `/v1/marketplace/listings/${listingId}/purchase`,
      headers: { authorization: `Bearer ${token}` },
      payload: { amount: 10 },
    });
    expect(res.statusCode).toBe(201);
    const data = res.json().data;
    expect(data.amount).toBe(10);
    expect(data.totalPrice).toBe("10000000000000000000"); // 10 * 1e18
    // platform fee 2.5%
    expect(data.platformFee).toBe("250000000000000000"); // 2.5% of 10e18
  });

  it("prevents self-purchase", async () => {
    const created = await createListing(app, SELLER);
    const listingId = created.json().data.listingId;

    const token = sign(app, { address: SELLER });
    const res = await app.inject({
      method: "POST",
      url: `/v1/marketplace/listings/${listingId}/purchase`,
      headers: { authorization: `Bearer ${token}` },
      payload: { amount: 1 },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toMatch(/own listing/i);
  });

  it("enforces minimum purchase amount", async () => {
    const created = await createListing(app, SELLER, { minPurchaseAmount: 50 });
    const listingId = created.json().data.listingId;

    const token = sign(app, { address: BUYER });
    const res = await app.inject({
      method: "POST",
      url: `/v1/marketplace/listings/${listingId}/purchase`,
      headers: { authorization: `Bearer ${token}` },
      payload: { amount: 5 },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toMatch(/minimum/i);
  });

  it("rejects purchase exceeding remaining amount", async () => {
    const created = await createListing(app, SELLER, { amount: 10 });
    const listingId = created.json().data.listingId;

    const token = sign(app, { address: BUYER });
    const res = await app.inject({
      method: "POST",
      url: `/v1/marketplace/listings/${listingId}/purchase`,
      headers: { authorization: `Bearer ${token}` },
      payload: { amount: 999 },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toMatch(/insufficient/i);
  });

  it("marks listing as sold when fully purchased", async () => {
    const created = await createListing(app, SELLER, { amount: 10 });
    const listingId = created.json().data.listingId;

    const token = sign(app, { address: BUYER });
    await app.inject({
      method: "POST",
      url: `/v1/marketplace/listings/${listingId}/purchase`,
      headers: { authorization: `Bearer ${token}` },
      payload: { amount: 10 },
    });

    const detail = await app.inject({
      method: "GET",
      url: `/v1/marketplace/listings/${listingId}`,
    });
    expect(detail.json().data.status).toBe("sold");
  });

  // ---------- Offers ----------

  it("creates an offer", async () => {
    const token = sign(app, { address: BUYER });
    const res = await app.inject({
      method: "POST",
      url: "/v1/marketplace/offers",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        tokenId: "token_1",
        amount: 10,
        pricePerUnit: "500000000000000000",
        durationDays: 7,
      },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().data.status).toBe("active");
    expect(res.json().data.depositAmount).toBe("5000000000000000000");
  });

  it("accepts an offer", async () => {
    // Create offer as buyer
    const buyerToken = sign(app, { address: BUYER });
    const offerRes = await app.inject({
      method: "POST",
      url: "/v1/marketplace/offers",
      headers: { authorization: `Bearer ${buyerToken}` },
      payload: {
        tokenId: "token_1",
        amount: 5,
        pricePerUnit: "1000000000000000000",
        durationDays: 7,
      },
    });
    const offerId = offerRes.json().data.offerId;

    // Accept as seller
    const sellerToken = sign(app, { address: SELLER });
    const acceptRes = await app.inject({
      method: "POST",
      url: `/v1/marketplace/offers/${offerId}/accept`,
      headers: { authorization: `Bearer ${sellerToken}` },
    });
    expect(acceptRes.statusCode).toBe(200);
    expect(acceptRes.json().data.status).toBe("accepted");
    expect(acceptRes.json().data.txHash).toMatch(/^0x/);
  });

  it("prevents buyer from accepting their own offer", async () => {
    const buyerToken = sign(app, { address: BUYER });
    const offerRes = await app.inject({
      method: "POST",
      url: "/v1/marketplace/offers",
      headers: { authorization: `Bearer ${buyerToken}` },
      payload: {
        tokenId: "t",
        amount: 1,
        pricePerUnit: "100",
        durationDays: 1,
      },
    });
    const offerId = offerRes.json().data.offerId;

    const acceptRes = await app.inject({
      method: "POST",
      url: `/v1/marketplace/offers/${offerId}/accept`,
      headers: { authorization: `Bearer ${buyerToken}` },
    });
    expect(acceptRes.statusCode).toBe(400);
    expect(acceptRes.json().error).toMatch(/own offer/i);
  });

  it("cancels an offer", async () => {
    const buyerToken = sign(app, { address: BUYER });
    const offerRes = await app.inject({
      method: "POST",
      url: "/v1/marketplace/offers",
      headers: { authorization: `Bearer ${buyerToken}` },
      payload: {
        tokenId: "t",
        amount: 1,
        pricePerUnit: "100",
        durationDays: 1,
      },
    });
    const offerId = offerRes.json().data.offerId;

    const cancelRes = await app.inject({
      method: "DELETE",
      url: `/v1/marketplace/offers/${offerId}`,
      headers: { authorization: `Bearer ${buyerToken}` },
    });
    expect(cancelRes.statusCode).toBe(200);
    expect(cancelRes.json().data.status).toBe("cancelled");
    expect(cancelRes.json().data.refundAmount).toBeTruthy();
  });

  it("returns 403 when third party cancels offer", async () => {
    const buyerToken = sign(app, { address: BUYER });
    const offerRes = await app.inject({
      method: "POST",
      url: "/v1/marketplace/offers",
      headers: { authorization: `Bearer ${buyerToken}` },
      payload: {
        tokenId: "t",
        amount: 1,
        pricePerUnit: "100",
        durationDays: 1,
      },
    });
    const offerId = offerRes.json().data.offerId;

    const thirdToken = sign(app, { address: THIRD_PARTY });
    const res = await app.inject({
      method: "DELETE",
      url: `/v1/marketplace/offers/${offerId}`,
      headers: { authorization: `Bearer ${thirdToken}` },
    });
    expect(res.statusCode).toBe(403);
  });

  // ---------- Platform fee calculation ----------

  it("calculates 2.5% platform fee correctly", async () => {
    const created = await createListing(app, SELLER, {
      amount: 4,
      pricePerUnit: "2000000000000000000", // 2 ether
    });
    const listingId = created.json().data.listingId;

    const token = sign(app, { address: BUYER });
    const res = await app.inject({
      method: "POST",
      url: `/v1/marketplace/listings/${listingId}/purchase`,
      headers: { authorization: `Bearer ${token}` },
      payload: { amount: 4 },
    });
    const data = res.json().data;
    // total = 4 * 2e18 = 8e18
    // fee = 8e18 * 250 / 10000 = 2e17
    expect(data.totalPrice).toBe("8000000000000000000");
    expect(data.platformFee).toBe("200000000000000000");
  });

  // ---------- Stats ----------

  it("returns market stats with zero values when empty", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/v1/marketplace/stats",
    });
    expect(res.statusCode).toBe(200);
    const data = res.json().data;
    expect(data.activeListings).toBe(0);
    expect(data.totalTransactions24h).toBe(0);
    expect(data.totalCreditsMinted).toBe(0);
  });

  it("returns aggregate stats after listings and purchases", async () => {
    // Create and purchase
    const created = await createListing(app, SELLER, { amount: 10 });
    const listingId = created.json().data.listingId;

    const token = sign(app, { address: BUYER });
    await app.inject({
      method: "POST",
      url: `/v1/marketplace/listings/${listingId}/purchase`,
      headers: { authorization: `Bearer ${token}` },
      payload: { amount: 5 },
    });

    const res = await app.inject({
      method: "GET",
      url: "/v1/marketplace/stats",
    });
    const data = res.json().data;
    expect(data.activeListings).toBe(1); // 5 remaining
    expect(data.totalCreditsTraded).toBe(5);
    expect(data.totalTransactions24h).toBe(1);
  });

  // ---------- Purchases ----------

  it("returns purchase history", async () => {
    const created = await createListing(app, SELLER, { amount: 20 });
    const listingId = created.json().data.listingId;

    const token = sign(app, { address: BUYER });
    await app.inject({
      method: "POST",
      url: `/v1/marketplace/listings/${listingId}/purchase`,
      headers: { authorization: `Bearer ${token}` },
      payload: { amount: 3 },
    });

    const res = await app.inject({
      method: "GET",
      url: "/v1/marketplace/purchases",
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data).toHaveLength(1);
    expect(res.json().data[0].amount).toBe(3);
  });
});
