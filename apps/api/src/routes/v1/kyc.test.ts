import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock runtime-env and sumsub service BEFORE importing the route
// ---------------------------------------------------------------------------

let mockKycProvider = "sumsub";
let mockSumsubAppToken: string | undefined = "test-app-token";
let mockSumsubSecretKey: string | undefined = "test-secret-key";

vi.mock("../../lib/runtime-env.js", () => ({
  getApiRuntimeEnv: () => ({
    DATABASE_URL: "postgres://localhost:5432/test",
    JWT_SECRET: "a]ks8d7f6g5h4j3k2l1m0n9b8v7c6x5z4",
    SIWE_DOMAIN: "localhost",
    KYC_PROVIDER: mockKycProvider,
    SUMSUB_APP_TOKEN: mockSumsubAppToken,
    SUMSUB_SECRET_KEY: mockSumsubSecretKey,
  }),
}));

const mockCreateApplicant = vi.fn();
const mockGetApplicantByExternalId = vi.fn();
const mockGenerateAccessToken = vi.fn();
const mockGetVerificationStatus = vi.fn();
const mockVerifyWebhookSignature = vi.fn();
const mockHandleWebhook = vi.fn();
const mockRequestSanctionsCheck = vi.fn();

let mockSumsubServiceInstance: object | null = {
  createApplicant: mockCreateApplicant,
  getApplicantByExternalId: mockGetApplicantByExternalId,
  generateAccessToken: mockGenerateAccessToken,
  getVerificationStatus: mockGetVerificationStatus,
  verifyWebhookSignature: mockVerifyWebhookSignature,
  handleWebhook: mockHandleWebhook,
  requestSanctionsCheck: mockRequestSanctionsCheck,
};

vi.mock("../../services/kyc/sumsub.service.js", () => ({
  createSumsubService: () => mockSumsubServiceInstance,
}));

import Fastify from "fastify";
import jwt from "@fastify/jwt";
import { kycRoutes } from "./kyc.js";

const WALLET_A = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const WALLET_B = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
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

  await app.register(kycRoutes, { prefix: "/v1/kyc" });
  await app.ready();
  return app;
}

function sign(app: ReturnType<typeof Fastify>, payload: object) {
  return (app as unknown as { jwt: { sign: (p: object) => string } }).jwt.sign(payload);
}

describe("kyc routes", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeEach(async () => {
    vi.clearAllMocks();

    mockKycProvider = "sumsub";
    mockSumsubAppToken = "test-app-token";
    mockSumsubSecretKey = "test-secret-key";
    mockSumsubServiceInstance = {
      createApplicant: mockCreateApplicant,
      getApplicantByExternalId: mockGetApplicantByExternalId,
      generateAccessToken: mockGenerateAccessToken,
      getVerificationStatus: mockGetVerificationStatus,
      verifyWebhookSignature: mockVerifyWebhookSignature,
      handleWebhook: mockHandleWebhook,
      requestSanctionsCheck: mockRequestSanctionsCheck,
    };

    app = await buildApp();
  });

  // ---------- POST /initiate ----------

  it("initiates KYC for a new applicant", async () => {
    mockGetApplicantByExternalId.mockResolvedValue(null);
    mockCreateApplicant.mockResolvedValue({
      id: "app_123",
      review: null,
    });
    mockGenerateAccessToken.mockResolvedValue({
      token: "sdk_token_abc",
      userId: WALLET_A,
    });

    const token = sign(app, { address: WALLET_A });
    const res = await app.inject({
      method: "POST",
      url: "/v1/kyc/initiate",
      headers: { authorization: `Bearer ${token}` },
      payload: { walletAddress: WALLET_A, email: "test@example.com" },
    });

    expect(res.statusCode).toBe(200);
    const data = res.json().data;
    expect(data.applicantId).toBe("app_123");
    expect(data.accessToken).toBe("sdk_token_abc");
    expect(data.status).toBe("pending");
  });

  it("reuses existing applicant on initiate", async () => {
    mockGetApplicantByExternalId.mockResolvedValue({
      id: "app_existing",
      review: { reviewStatus: "completed" },
    });
    mockGenerateAccessToken.mockResolvedValue({
      token: "sdk_token_reuse",
      userId: WALLET_A,
    });

    const token = sign(app, { address: WALLET_A });
    const res = await app.inject({
      method: "POST",
      url: "/v1/kyc/initiate",
      headers: { authorization: `Bearer ${token}` },
      payload: { walletAddress: WALLET_A },
    });

    expect(res.statusCode).toBe(200);
    expect(mockCreateApplicant).not.toHaveBeenCalled();
    expect(res.json().data.applicantId).toBe("app_existing");
  });

  it("returns 403 when wallet does not match authenticated identity", async () => {
    const token = sign(app, { address: WALLET_B });
    const res = await app.inject({
      method: "POST",
      url: "/v1/kyc/initiate",
      headers: { authorization: `Bearer ${token}` },
      payload: { walletAddress: WALLET_A },
    });
    expect(res.statusCode).toBe(403);
  });

  it("returns 401 without authentication", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/kyc/initiate",
      payload: { walletAddress: WALLET_A },
    });
    expect(res.statusCode).toBe(401);
  });

  // ---------- GET /status/:walletAddress ----------

  it("returns not_started when no applicant exists", async () => {
    mockGetApplicantByExternalId.mockResolvedValue(null);

    const token = sign(app, { address: WALLET_A });
    const res = await app.inject({
      method: "GET",
      url: `/v1/kyc/status/${WALLET_A}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.status).toBe("not_started");
    expect(res.json().data.verified).toBe(false);
  });

  it("returns verified status when applicant is verified", async () => {
    mockGetApplicantByExternalId.mockResolvedValue({
      id: "app_verified",
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    mockGetVerificationStatus.mockResolvedValue({
      status: "verified",
      rejectLabels: [],
    });

    const token = sign(app, { address: WALLET_A });
    const res = await app.inject({
      method: "GET",
      url: `/v1/kyc/status/${WALLET_A}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.verified).toBe(true);
    expect(res.json().data.applicantId).toBe("app_verified");
  });

  it("returns 403 when checking status for another wallet", async () => {
    const token = sign(app, { address: WALLET_B });
    const res = await app.inject({
      method: "GET",
      url: `/v1/kyc/status/${WALLET_A}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(403);
  });

  // ---------- POST /refresh-token/:walletAddress ----------

  it("refreshes access token", async () => {
    mockGenerateAccessToken.mockResolvedValue({
      token: "new_sdk_token",
      userId: WALLET_A,
    });

    const token = sign(app, { address: WALLET_A });
    const res = await app.inject({
      method: "POST",
      url: `/v1/kyc/refresh-token/${WALLET_A}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.accessToken).toBe("new_sdk_token");
    expect(res.json().data.expiresAt).toBeTruthy();
  });

  it("returns 403 when refreshing token for another wallet", async () => {
    const token = sign(app, { address: WALLET_B });
    const res = await app.inject({
      method: "POST",
      url: `/v1/kyc/refresh-token/${WALLET_A}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(403);
  });

  // ---------- POST /webhook/sumsub ----------

  it("processes valid webhook with correct signature", async () => {
    mockVerifyWebhookSignature.mockReturnValue(true);
    mockHandleWebhook.mockResolvedValue({
      action: "update_status",
      status: "verified",
    });

    const res = await app.inject({
      method: "POST",
      url: "/v1/kyc/webhook/sumsub",
      headers: { "x-payload-digest": "valid_signature" },
      payload: {
        applicantId: "app_123",
        externalUserId: WALLET_A,
        type: "applicantReviewed",
        reviewResult: { reviewAnswer: "GREEN" },
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().success).toBe(true);
    expect(res.json().action).toBe("update_status");
  });

  it("rejects webhook with invalid signature", async () => {
    mockVerifyWebhookSignature.mockReturnValue(false);

    const res = await app.inject({
      method: "POST",
      url: "/v1/kyc/webhook/sumsub",
      headers: { "x-payload-digest": "bad_sig" },
      payload: {
        applicantId: "app_123",
        externalUserId: WALLET_A,
        type: "applicantReviewed",
      },
    });
    expect(res.statusCode).toBe(401);
  });

  // ---------- POST /sanctions-check/:walletAddress ----------

  it("returns cleared sanctions check", async () => {
    mockGetApplicantByExternalId.mockResolvedValue({ id: "app_123" });
    mockRequestSanctionsCheck.mockResolvedValue({
      hit: false,
      matchedLists: [],
    });

    const token = sign(app, { address: WALLET_A });
    const res = await app.inject({
      method: "POST",
      url: `/v1/kyc/sanctions-check/${WALLET_A}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.cleared).toBe(true);
    expect(res.json().data.matchedLists).toEqual([]);
  });

  it("returns sanctions hit with matched lists", async () => {
    mockGetApplicantByExternalId.mockResolvedValue({ id: "app_hit" });
    mockRequestSanctionsCheck.mockResolvedValue({
      hit: true,
      matchedLists: ["OFAC SDN", "EU Sanctions"],
    });

    const token = sign(app, { address: WALLET_A });
    const res = await app.inject({
      method: "POST",
      url: `/v1/kyc/sanctions-check/${WALLET_A}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.cleared).toBe(false);
    expect(res.json().data.matchedLists).toContain("OFAC SDN");
  });

  it("returns 404 when no KYC record for sanctions check", async () => {
    mockGetApplicantByExternalId.mockResolvedValue(null);

    const token = sign(app, { address: WALLET_A });
    const res = await app.inject({
      method: "POST",
      url: `/v1/kyc/sanctions-check/${WALLET_A}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(404);
  });

  // ---------- 503 when KYC disabled ----------

  it("returns 503 on initiate when sumsub service is null", async () => {
    // Rebuild app with disabled service
    mockSumsubServiceInstance = null;
    const disabledApp = await buildApp();

    const token = sign(disabledApp, { address: WALLET_A });
    const res = await disabledApp.inject({
      method: "POST",
      url: "/v1/kyc/initiate",
      headers: { authorization: `Bearer ${token}` },
      payload: { walletAddress: WALLET_A },
    });
    expect(res.statusCode).toBe(503);
  });

  it("returns 503 on status when sumsub service is null", async () => {
    mockSumsubServiceInstance = null;
    const disabledApp = await buildApp();

    const token = sign(disabledApp, { address: WALLET_A });
    const res = await disabledApp.inject({
      method: "GET",
      url: `/v1/kyc/status/${WALLET_A}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(503);
  });

  it("returns 503 on refresh-token when sumsub service is null", async () => {
    mockSumsubServiceInstance = null;
    const disabledApp = await buildApp();

    const token = sign(disabledApp, { address: WALLET_A });
    const res = await disabledApp.inject({
      method: "POST",
      url: `/v1/kyc/refresh-token/${WALLET_A}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(503);
  });

  it("returns 503 on webhook when sumsub service is null", async () => {
    mockSumsubServiceInstance = null;
    const disabledApp = await buildApp();

    const res = await disabledApp.inject({
      method: "POST",
      url: "/v1/kyc/webhook/sumsub",
      payload: { applicantId: "a", externalUserId: "b", type: "test" },
    });
    expect(res.statusCode).toBe(503);
  });

  it("returns 503 on sanctions-check when sumsub service is null", async () => {
    mockSumsubServiceInstance = null;
    const disabledApp = await buildApp();

    const token = sign(disabledApp, { address: WALLET_A });
    const res = await disabledApp.inject({
      method: "POST",
      url: `/v1/kyc/sanctions-check/${WALLET_A}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(503);
  });
});
