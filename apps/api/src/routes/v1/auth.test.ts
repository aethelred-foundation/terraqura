import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import {
  createTestServer,
  generateAuthToken,
  resetSiweVerifyResult,
  resetStateStore,
  setSiweVerifyResult,
} from "../../../test/helpers.js";
import type { FastifyInstance } from "fastify";

describe("Auth routes", () => {
  let server: FastifyInstance;

  beforeAll(async () => {
    server = await createTestServer();
  });

  afterEach(() => {
    resetStateStore();
    resetSiweVerifyResult();
  });

  afterAll(async () => {
    await server?.close();
  });

  // -----------------------------------------------------------------------
  // GET /v1/auth/nonce
  // -----------------------------------------------------------------------

  describe("GET /v1/auth/nonce", () => {
    it("returns 200 with a nonce string", async () => {
      const response = await server.inject({
        method: "GET",
        url: "/v1/auth/nonce",
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body).toHaveProperty("nonce");
      expect(typeof body.nonce).toBe("string");
      expect(body.nonce.length).toBeGreaterThan(0);
    });

    it("returns an expiresAt field as ISO 8601 datetime", async () => {
      const response = await server.inject({
        method: "GET",
        url: "/v1/auth/nonce",
      });

      const body = response.json();
      expect(body).toHaveProperty("expiresAt");
      const parsed = new Date(body.expiresAt);
      expect(parsed.toISOString()).toBe(body.expiresAt);
    });

    it("generates unique nonces on successive calls", async () => {
      const r1 = await server.inject({ method: "GET", url: "/v1/auth/nonce" });
      const r2 = await server.inject({ method: "GET", url: "/v1/auth/nonce" });

      expect(r1.json().nonce).not.toBe(r2.json().nonce);
    });

    it("returns an expiry time in the future", async () => {
      const before = Date.now();
      const response = await server.inject({
        method: "GET",
        url: "/v1/auth/nonce",
      });

      const body = response.json();
      const expiresAt = new Date(body.expiresAt).getTime();
      expect(expiresAt).toBeGreaterThan(before);
    });
  });

  // -----------------------------------------------------------------------
  // POST /v1/auth/verify
  // -----------------------------------------------------------------------

  describe("POST /v1/auth/verify", () => {
    it("returns a JWT token for a valid SIWE signature", async () => {
      const response = await server.inject({
        method: "POST",
        url: "/v1/auth/verify",
        payload: {
          message: "mock-siwe-message",
          signature: "0xvalidsignature",
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.success).toBe(true);
      expect(typeof body.token).toBe("string");
      expect(body.token.split(".")).toHaveLength(3); // JWT structure
    });

    it("returns user address and chainId on successful verify", async () => {
      const response = await server.inject({
        method: "POST",
        url: "/v1/auth/verify",
        payload: {
          message: "mock-siwe-message",
          signature: "0xvalidsignature",
        },
      });

      const body = response.json();
      expect(body.user).toBeDefined();
      expect(body.user.address).toBe(
        "0x1234567890abcdef1234567890abcdef12345678",
      );
      expect(body.user.chainId).toBe(78432);
    });

    it("normalizes the returned address to lowercase", async () => {
      setSiweVerifyResult({
        success: true,
        data: {
          address: "0xABCDef1234567890ABCDEF1234567890abcdef12",
          chainId: 78432,
          domain: "localhost",
          nonce: "test-nonce",
        },
      });

      const response = await server.inject({
        method: "POST",
        url: "/v1/auth/verify",
        payload: {
          message: "mock-siwe-message",
          signature: "0xvalidsignature",
        },
      });

      const body = response.json();
      expect(body.user.address).toBe(
        "0xabcdef1234567890abcdef1234567890abcdef12",
      );
    });

    it("returns 401 for an invalid signature", async () => {
      setSiweVerifyResult({
        success: false,
        data: {
          address: "",
          chainId: 0,
          domain: "",
          nonce: "",
        },
      });

      const response = await server.inject({
        method: "POST",
        url: "/v1/auth/verify",
        payload: {
          message: "bad-message",
          signature: "0xinvalid",
        },
      });

      expect(response.statusCode).toBe(401);
      const body = response.json();
      expect(body.success).toBe(false);
    });

    it("returns 401 when the SIWE domain does not match", async () => {
      setSiweVerifyResult({
        success: true,
        data: {
          address: "0x1234567890abcdef1234567890abcdef12345678",
          chainId: 78432,
          domain: "evil-site.com",
          nonce: "test-nonce",
        },
      });

      const response = await server.inject({
        method: "POST",
        url: "/v1/auth/verify",
        payload: {
          message: "mock-siwe-message",
          signature: "0xvalidsignature",
        },
      });

      expect(response.statusCode).toBe(401);
      const body = response.json();
      expect(body.success).toBe(false);
      expect(body.error).toBe("Invalid SIWE domain");
    });

    it("rejects request with missing message field", async () => {
      const response = await server.inject({
        method: "POST",
        url: "/v1/auth/verify",
        payload: {
          signature: "0xvalidsignature",
        },
      });

      // Fastify schema validation will return 400
      expect(response.statusCode).toBe(400);
    });

    it("rejects request with missing signature field", async () => {
      const response = await server.inject({
        method: "POST",
        url: "/v1/auth/verify",
        payload: {
          message: "mock-siwe-message",
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  // -----------------------------------------------------------------------
  // GET /v1/auth/session
  // -----------------------------------------------------------------------

  describe("GET /v1/auth/session", () => {
    it("returns authenticated:true with valid JWT", async () => {
      const token = generateAuthToken(server);

      const response = await server.inject({
        method: "GET",
        url: "/v1/auth/session",
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.authenticated).toBe(true);
      expect(body.user).toBeDefined();
      expect(body.user.address).toBe(
        "0x1234567890abcdef1234567890abcdef12345678",
      );
    });

    it("returns user id derived from address", async () => {
      const token = generateAuthToken(server);

      const response = await server.inject({
        method: "GET",
        url: "/v1/auth/session",
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      const body = response.json();
      // id is user_ + first 8 hex chars after 0x
      expect(body.user.id).toBe("user_12345678");
    });

    it("returns userType and kycStatus in session", async () => {
      const token = generateAuthToken(server, {
        userType: "admin",
        kycStatus: "approved",
      });

      const response = await server.inject({
        method: "GET",
        url: "/v1/auth/session",
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      const body = response.json();
      expect(body.user.userType).toBe("admin");
      expect(body.user.kycStatus).toBe("approved");
    });

    it("returns 401 when no authorization header is provided", async () => {
      const response = await server.inject({
        method: "GET",
        url: "/v1/auth/session",
      });

      // The session route has security: [{ bearerAuth: [] }], so the
      // preHandler hook should reject with 401.
      expect(response.statusCode).toBe(401);
    });

    it("returns 401 for an expired or malformed token", async () => {
      const response = await server.inject({
        method: "GET",
        url: "/v1/auth/session",
        headers: {
          authorization: "Bearer invalid.token.here",
        },
      });

      expect(response.statusCode).toBe(401);
    });
  });
});
