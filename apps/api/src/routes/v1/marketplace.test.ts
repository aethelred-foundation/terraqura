import jwt from "@fastify/jwt";
import rateLimit from "@fastify/rate-limit";
import Fastify from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";

const store = new Map<string, unknown>();

vi.mock("../../lib/state-store.js", () => ({
  readState: vi.fn(async <T>(key: string, defaultState: T): Promise<T> => {
    return structuredClone((store.get(key) as T) ?? defaultState);
  }),
  mutateState: vi.fn(
    async <T, R>(
      key: string,
      defaultState: T,
      mutator: (state: T) => Promise<R> | R,
    ): Promise<R> => {
      const state = structuredClone((store.get(key) as T) ?? defaultState);
      const result = await mutator(state);
      store.set(key, structuredClone(state));
      return result;
    },
  ),
  mutateStatePair: vi.fn(
    async <TFirst, TSecond, R>(
      first: { storeKey: string; defaultState: TFirst },
      second: { storeKey: string; defaultState: TSecond },
      mutator: (firstState: TFirst, secondState: TSecond) => Promise<R> | R,
    ): Promise<R> => {
      const firstState = structuredClone(
        (store.get(first.storeKey) as TFirst) ?? first.defaultState,
      );
      const secondState = structuredClone(
        (store.get(second.storeKey) as TSecond) ?? second.defaultState,
      );
      const result = await mutator(firstState, secondState);
      store.set(first.storeKey, structuredClone(firstState));
      store.set(second.storeKey, structuredClone(secondState));
      return result;
    },
  ),
}));

vi.mock("../../lib/runtime-env.js", () => ({
  getApiRuntimeEnv: () => ({
    DATABASE_URL: "postgres://localhost:5432/test",
    DATABASE_SSL_MODE: "disable",
    JWT_SECRET: "a]ks8d7f6g5h4j3k2l1m0n9b8v7c6x5z4",
    SIWE_DOMAIN: "localhost",
    KYC_PROVIDER: "disabled",
  }),
}));

vi.mock("../../services/blockchain/contracts.js", () => ({
  getExplorerTxLink: (txHash: string) => `https://explorer.test/tx/${txHash}`,
  verifyListingOnChain: vi.fn(
    async ({ txHash, seller }: { txHash: string; seller: string }) => {
      if (txHash === transactionHash("f")) {
        throw new Error(
          "Listing receipt did not confirm the requested operation",
        );
      }
      return {
        txHash,
        blockNumber: 101,
        listingId: BigInt(`0x${txHash.slice(-8)}`).toString(),
        seller: seller.toLowerCase(),
      };
    },
  ),
  verifyPurchaseOnChain: vi.fn(
    async ({
      txHash,
      buyer,
      totalPrice,
    }: {
      txHash: string;
      buyer: string;
      totalPrice: string;
    }) => ({
      txHash,
      blockNumber: 102,
      buyer: buyer.toLowerCase(),
      seller: SELLER,
      platformFee: ((BigInt(totalPrice) * 250n) / 10_000n).toString(),
    }),
  ),
  verifyListingCancellationOnChain: vi.fn(
    async ({ txHash, seller }: { txHash: string; seller: string }) => ({
      txHash,
      blockNumber: 103,
      seller: seller.toLowerCase(),
    }),
  ),
}));

import { marketplaceRoutes } from "./marketplace.js";

const SELLER = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const BUYER = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const JWT_SECRET = "a]ks8d7f6g5h4j3k2l1m0n9b8v7c6x5z4";
const CREDIT_STORE_KEY = "credits:v1";

function transactionHash(character: string): string {
  return `0x${character.repeat(64)}`;
}

function seedSellerCredit(amount = 100): void {
  const now = new Date().toISOString();
  store.set(CREDIT_STORE_KEY, {
    credits: {
      credit_seller: {
        id: "credit_seller",
        tokenId: "1",
        verificationId: "verification_1",
        dacUnitId: "dac_1",
        captureStartTime: now,
        captureEndTime: now,
        co2CapturedKg: amount * 1000,
        energyConsumedKwh: amount * 200,
        creditsIssued: amount,
        escrowedAmount: 0,
        initialCreditsIssued: amount,
        retiredAmount: 0,
        sourceDataHash: `0x${"1".repeat(64)}`,
        verificationStatus: "minted",
        efficiencyFactor: 9000,
        mintTxHash: transactionHash("9"),
        ipfsMetadataCid: null,
        arweaveTxId: null,
        currentOwnerId: "user_aaaaaaaa",
        currentOwnerWallet: SELLER,
        isRetired: false,
        retiredAt: null,
        retirementReason: null,
        retirementTxHash: null,
        retirementTxHashes: [],
        createdAt: now,
        updatedAt: now,
      },
    },
    verificationToCredit: { verification_1: "credit_seller" },
    nextTokenId: 2,
  });
}

async function buildApp() {
  const app = Fastify({ logger: false });
  await app.register(rateLimit, { max: 100, timeWindow: "1 minute" });
  await app.register(jwt, { secret: JWT_SECRET });
  await app.register(marketplaceRoutes, { prefix: "/v1/marketplace" });
  await app.ready();
  return app;
}

function sign(
  app: Awaited<ReturnType<typeof buildApp>>,
  wallet: string,
  kycStatus: "approved" | "pending" = "approved",
) {
  return app.jwt.sign({
    sub: wallet,
    address: wallet,
    chainId: 7332,
    userType: "operator",
    kycStatus,
  });
}

async function createListing(
  app: Awaited<ReturnType<typeof buildApp>>,
  overrides: Record<string, unknown> = {},
) {
  return app.inject({
    method: "POST",
    url: "/v1/marketplace/listings",
    headers: { authorization: `Bearer ${sign(app, SELLER)}` },
    payload: {
      tokenId: "1",
      amount: 20,
      pricePerUnit: "1000000000000000000",
      minPurchaseAmount: 1,
      durationDays: 30,
      txHash: transactionHash("1"),
      ...overrides,
    },
  });
}

describe("marketplace routes", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeEach(async () => {
    store.clear();
    seedSellerCredit();
    app = await buildApp();
  });

  it("indexes a confirmed wallet-signed listing and moves credits to escrow", async () => {
    const response = await createListing(app);

    expect(response.statusCode).toBe(201);
    expect(response.json().data).toMatchObject({
      tokenId: "1",
      amount: 20,
      remainingAmount: 20,
      sellerWallet: SELLER,
      status: "active",
      txHash: transactionHash("1"),
      blockNumber: 101,
    });

    const credits = store.get(CREDIT_STORE_KEY) as {
      credits: Record<
        string,
        { creditsIssued: number; escrowedAmount: number }
      >;
    };
    expect(credits.credits.credit_seller).toMatchObject({
      creditsIssued: 80,
      escrowedAmount: 20,
    });
  });

  it("requires authentication and approved KYC", async () => {
    const payload = {
      tokenId: "1",
      amount: 1,
      pricePerUnit: "1",
      txHash: transactionHash("2"),
    };
    const unauthenticated = await app.inject({
      method: "POST",
      url: "/v1/marketplace/listings",
      payload,
    });
    expect(unauthenticated.statusCode).toBe(401);

    const pendingKyc = await app.inject({
      method: "POST",
      url: "/v1/marketplace/listings",
      headers: { authorization: `Bearer ${sign(app, SELLER, "pending")}` },
      payload,
    });
    expect(pendingKyc.statusCode).toBe(403);
  });

  it("rejects an unconfirmed or mismatched listing receipt", async () => {
    const response = await createListing(app, {
      txHash: transactionHash("f"),
    });
    expect(response.statusCode).toBe(422);
    expect(response.json().error).toMatch(/receipt/i);
  });

  it("does not index more credits than the authenticated wallet owns", async () => {
    const response = await createListing(app, {
      amount: 101,
      txHash: transactionHash("2"),
    });
    expect(response.statusCode).toBe(409);
    expect(response.json().error).toMatch(/available balance/i);
  });

  it("treats a repeated listing transaction as an idempotent retry", async () => {
    const first = await createListing(app);
    const second = await createListing(app);
    expect(first.statusCode).toBe(201);
    expect(second.statusCode).toBe(200);
    expect(second.json().data.id).toBe(first.json().data.id);
  });

  it("indexes a confirmed purchase and transfers the indexed holding", async () => {
    const created = await createListing(app);
    const listingId = created.json().data.id as string;
    const response = await app.inject({
      method: "POST",
      url: `/v1/marketplace/listings/${listingId}/purchase`,
      headers: { authorization: `Bearer ${sign(app, BUYER)}` },
      payload: { amount: 5, txHash: transactionHash("3") },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json().data).toMatchObject({
      listingId,
      buyerWallet: BUYER,
      sellerWallet: SELLER,
      amount: 5,
      totalPrice: "5000000000000000000",
      platformFee: "125000000000000000",
      sellerProceeds: "4875000000000000000",
      txHash: transactionHash("3"),
      blockNumber: 102,
    });

    const credits = store.get(CREDIT_STORE_KEY) as {
      credits: Record<
        string,
        {
          creditsIssued: number;
          escrowedAmount: number;
          currentOwnerWallet: string;
        }
      >;
    };
    expect(credits.credits.credit_seller.escrowedAmount).toBe(15);
    expect(
      Object.values(credits.credits).find(
        (credit) => credit.currentOwnerWallet === BUYER,
      )?.creditsIssued,
    ).toBe(5);
  });

  it("enforces listing ownership, availability, and purchase limits", async () => {
    const created = await createListing(app, { minPurchaseAmount: 5 });
    const listingId = created.json().data.id as string;

    const selfPurchase = await app.inject({
      method: "POST",
      url: `/v1/marketplace/listings/${listingId}/purchase`,
      headers: { authorization: `Bearer ${sign(app, SELLER)}` },
      payload: { amount: 5, txHash: transactionHash("4") },
    });
    expect(selfPurchase.statusCode).toBe(409);
    expect(selfPurchase.json().error).toMatch(/own listing/i);

    const belowMinimum = await app.inject({
      method: "POST",
      url: `/v1/marketplace/listings/${listingId}/purchase`,
      headers: { authorization: `Bearer ${sign(app, BUYER)}` },
      payload: { amount: 4, txHash: transactionHash("5") },
    });
    expect(belowMinimum.statusCode).toBe(409);
    expect(belowMinimum.json().error).toMatch(/listing limits/i);
  });

  it("indexes a confirmed cancellation and releases unsold escrow", async () => {
    const created = await createListing(app);
    const listingId = created.json().data.id as string;

    const forbidden = await app.inject({
      method: "POST",
      url: `/v1/marketplace/listings/${listingId}/cancel`,
      headers: { authorization: `Bearer ${sign(app, BUYER)}` },
      payload: { txHash: transactionHash("6") },
    });
    expect(forbidden.statusCode).toBe(403);

    const response = await app.inject({
      method: "POST",
      url: `/v1/marketplace/listings/${listingId}/cancel`,
      headers: { authorization: `Bearer ${sign(app, SELLER)}` },
      payload: { txHash: transactionHash("7") },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().data).toMatchObject({
      status: "cancelled",
      cancellationTxHash: transactionHash("7"),
    });

    const credits = store.get(CREDIT_STORE_KEY) as {
      credits: Record<
        string,
        { creditsIssued: number; escrowedAmount: number }
      >;
    };
    expect(credits.credits.credit_seller).toMatchObject({
      creditsIssued: 100,
      escrowedAmount: 0,
    });
  });

  it("returns only receipt-backed listings, purchases, and native-denominated stats", async () => {
    const created = await createListing(app);
    const listingId = created.json().data.id as string;
    await app.inject({
      method: "POST",
      url: `/v1/marketplace/listings/${listingId}/purchase`,
      headers: { authorization: `Bearer ${sign(app, BUYER)}` },
      payload: { amount: 5, txHash: transactionHash("8") },
    });

    const [listings, detail, purchases, stats] = await Promise.all([
      app.inject({ method: "GET", url: "/v1/marketplace/listings" }),
      app.inject({
        method: "GET",
        url: `/v1/marketplace/listings/${listingId}`,
      }),
      app.inject({ method: "GET", url: "/v1/marketplace/purchases" }),
      app.inject({ method: "GET", url: "/v1/marketplace/stats" }),
    ]);

    expect(listings.json().data).toHaveLength(1);
    expect(detail.json().data.remainingAmount).toBe(15);
    expect(purchases.json().data).toHaveLength(1);
    expect(stats.json().data).toMatchObject({
      activeListings: 1,
      totalCreditsListed: 15,
      totalCreditsTraded: 5,
      totalTransactions24h: 1,
      denomination: "AETH_WEI",
      usdConversion: null,
    });
  });
});
