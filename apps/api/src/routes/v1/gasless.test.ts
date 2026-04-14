import { describe, it, expect, vi, beforeEach } from "vitest";
import jwt from "@fastify/jwt";

// ---------------------------------------------------------------------------
// Mock relayer service before importing the route
// ---------------------------------------------------------------------------

const mockGetNonce = vi.fn();
const mockBuildForwardRequest = vi.fn();
const mockRelay = vi.fn();
const mockRelayViaDefender = vi.fn();
const mockGetSigningTypes = vi.fn();

let mockRelayerInstance: object | null = {
  getNonce: mockGetNonce,
  buildForwardRequest: mockBuildForwardRequest,
  relay: mockRelay,
  relayViaDefender: mockRelayViaDefender,
  getSigningTypes: mockGetSigningTypes,
};

vi.mock("../../services/gasless/relayer.service.js", () => ({
  getGaslessRelayer: () => mockRelayerInstance,
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
import { gaslessRoutes } from "./gasless.js";

const ADDRESS = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const TARGET = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const JWT_SECRET = "gasless-test-secret-that-is-at-least-32-characters";

async function buildApp() {
  const app = Fastify({ logger: false });
  await app.register(jwt, { secret: JWT_SECRET });
  await app.register(gaslessRoutes, { prefix: "/v1/gasless" });
  await app.ready();
  return app;
}

function signToken(
  app: Awaited<ReturnType<typeof buildApp>>,
  overrides: { address?: string; userType?: string } = {},
) {
  return app.jwt.sign({
    sub: overrides.address ?? ADDRESS,
    address: overrides.address ?? ADDRESS,
    chainId: 78432,
    userType: overrides.userType ?? "operator",
    kycStatus: "approved",
  });
}

describe("gasless routes", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Reset relayer instance to enabled
    mockRelayerInstance = {
      getNonce: mockGetNonce,
      buildForwardRequest: mockBuildForwardRequest,
      relay: mockRelay,
      relayViaDefender: mockRelayViaDefender,
      getSigningTypes: mockGetSigningTypes,
    };

    // Clear env vars that affect relay path
    delete process.env.DEFENDER_RELAYER_API_KEY;

    app = await buildApp();
  });

  // ---------- GET /nonce/:address ----------

  it("returns nonce for a valid address", async () => {
    mockGetNonce.mockResolvedValue(BigInt(42));
    const token = signToken(app);

    const res = await app.inject({
      method: "GET",
      url: `/v1/gasless/nonce/${ADDRESS}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.nonce).toBe("42");
  });

  it("returns 503 when relayer is not configured (nonce)", async () => {
    mockRelayerInstance = null;
    const disabledApp = await buildApp();
    const token = signToken(disabledApp);

    const res = await disabledApp.inject({
      method: "GET",
      url: `/v1/gasless/nonce/${ADDRESS}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(503);
    expect(res.json().error.code).toBe("GASLESS_NOT_CONFIGURED");
  });

  it("returns 500 when nonce fetch throws", async () => {
    mockGetNonce.mockRejectedValue(new Error("RPC error"));
    const token = signToken(app);

    const res = await app.inject({
      method: "GET",
      url: `/v1/gasless/nonce/${ADDRESS}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(500);
    expect(res.json().error.code).toBe("NONCE_FETCH_FAILED");
  });

  // ---------- POST /build-request ----------

  it("builds a forward request", async () => {
    mockBuildForwardRequest.mockResolvedValue({
      request: {
        from: ADDRESS,
        to: TARGET,
        value: BigInt(0),
        gas: BigInt(500000),
        nonce: BigInt(1),
        deadline: 1700000000,
        data: "0xabcdef",
      },
      domain: {
        name: "MinimalForwarder",
        version: "0.0.1",
        chainId: 78432,
        verifyingContract: TARGET,
      },
    });
    mockGetSigningTypes.mockReturnValue({
      ForwardRequest: [
        { name: "from", type: "address" },
        { name: "to", type: "address" },
      ],
    });
    const token = signToken(app);

    const res = await app.inject({
      method: "POST",
      url: "/v1/gasless/build-request",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        from: ADDRESS,
        to: TARGET,
        data: "0xabcdef",
      },
    });
    expect(res.statusCode).toBe(200);
    const data = res.json().data;
    expect(data.request.from).toBe(ADDRESS);
    expect(data.request.gas).toBe("500000");
    expect(data.request.value).toBe("0");
    expect(data.domain).toBeTruthy();
    expect(data.types).toBeTruthy();
  });

  it("passes gasLimit to buildForwardRequest when provided", async () => {
    mockBuildForwardRequest.mockResolvedValue({
      request: {
        from: ADDRESS,
        to: TARGET,
        value: BigInt(0),
        gas: BigInt(200000),
        nonce: BigInt(0),
        deadline: 1700000000,
        data: "0x",
      },
      domain: {},
    });
    mockGetSigningTypes.mockReturnValue({});
    const token = signToken(app);

    await app.inject({
      method: "POST",
      url: "/v1/gasless/build-request",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        from: ADDRESS,
        to: TARGET,
        data: "0x",
        gasLimit: "200000",
      },
    });

    expect(mockBuildForwardRequest).toHaveBeenCalledWith(
      ADDRESS,
      TARGET,
      "0x",
      BigInt(200000),
    );
  });

  it("returns 503 when relayer is not configured (build-request)", async () => {
    mockRelayerInstance = null;
    const disabledApp = await buildApp();
    const token = signToken(disabledApp);

    const res = await disabledApp.inject({
      method: "POST",
      url: "/v1/gasless/build-request",
      headers: { authorization: `Bearer ${token}` },
      payload: { from: ADDRESS, to: TARGET, data: "0x" },
    });
    expect(res.statusCode).toBe(503);
  });

  it("returns 500 when build-request throws", async () => {
    mockBuildForwardRequest.mockRejectedValue(new Error("Contract call failed"));
    const token = signToken(app);

    const res = await app.inject({
      method: "POST",
      url: "/v1/gasless/build-request",
      headers: { authorization: `Bearer ${token}` },
      payload: { from: ADDRESS, to: TARGET, data: "0x" },
    });
    expect(res.statusCode).toBe(500);
    expect(res.json().error.code).toBe("BUILD_REQUEST_FAILED");
  });

  // ---------- POST /relay ----------

  it("relays a signed transaction successfully", async () => {
    mockRelay.mockResolvedValue({
      success: true,
      txHash: "0x" + "a".repeat(64),
    });
    const token = signToken(app);

    const res = await app.inject({
      method: "POST",
      url: "/v1/gasless/relay",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        request: {
          from: ADDRESS,
          to: TARGET,
          value: "0",
          gas: "500000",
          nonce: "1",
          deadline: 1700000000,
          data: "0xabcdef",
        },
        signature: "0x" + "f".repeat(130),
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.txHash).toBe("0x" + "a".repeat(64));
  });

  it("returns 400 when relay fails", async () => {
    mockRelay.mockResolvedValue({
      success: false,
      error: "Invalid signature or request",
    });
    const token = signToken(app);

    const res = await app.inject({
      method: "POST",
      url: "/v1/gasless/relay",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        request: {
          from: ADDRESS,
          to: TARGET,
          value: "0",
          gas: "500000",
          nonce: "1",
          deadline: 1700000000,
          data: "0x",
        },
        signature: "0xbad",
      },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe("RELAY_FAILED");
  });

  it("returns 503 when relayer is not configured (relay)", async () => {
    mockRelayerInstance = null;
    const disabledApp = await buildApp();
    const token = signToken(disabledApp);

    const res = await disabledApp.inject({
      method: "POST",
      url: "/v1/gasless/relay",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        request: {
          from: ADDRESS,
          to: TARGET,
          value: "0",
          gas: "100000",
          nonce: "0",
          deadline: 9999999999,
          data: "0x",
        },
        signature: "0x",
      },
    });
    expect(res.statusCode).toBe(503);
  });

  it("uses Defender relay when DEFENDER_RELAYER_API_KEY is set", async () => {
    process.env.DEFENDER_RELAYER_API_KEY = "defender_key";
    mockRelayViaDefender.mockResolvedValue({
      success: true,
      txHash: "0x" + "d".repeat(64),
    });

    // Rebuild app so env is picked up at route registration time
    const defenderApp = await buildApp();
    const token = signToken(defenderApp);

    const res = await defenderApp.inject({
      method: "POST",
      url: "/v1/gasless/relay",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        request: {
          from: ADDRESS,
          to: TARGET,
          value: "0",
          gas: "500000",
          nonce: "0",
          deadline: 1700000000,
          data: "0x",
        },
        signature: "0xsig",
      },
    });
    expect(res.statusCode).toBe(200);
    expect(mockRelayViaDefender).toHaveBeenCalled();
    expect(mockRelay).not.toHaveBeenCalled();

    delete process.env.DEFENDER_RELAYER_API_KEY;
  });

  it("returns 500 when relay throws an unexpected error", async () => {
    mockRelay.mockRejectedValue(new Error("Unexpected RPC failure"));
    const token = signToken(app);

    const res = await app.inject({
      method: "POST",
      url: "/v1/gasless/relay",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        request: {
          from: ADDRESS,
          to: TARGET,
          value: "0",
          gas: "100000",
          nonce: "0",
          deadline: 9999999999,
          data: "0x",
        },
        signature: "0x",
      },
    });
    expect(res.statusCode).toBe(500);
    expect(res.json().error.code).toBe("RELAY_ERROR");
  });

  // ---------- GET /status ----------

  it("returns relayer status when enabled", async () => {
    process.env.FORWARDER_CONTRACT = "0x1234567890abcdef1234567890abcdef12345678";
    process.env.CHAIN_ID = "78432";
    const token = signToken(app);

    const res = await app.inject({
      method: "GET",
      url: "/v1/gasless/status",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const data = res.json().data;
    expect(data.enabled).toBe(true);
    expect(data.chainId).toBe(78432);
  });

  it("returns enabled=false when relayer is null", async () => {
    mockRelayerInstance = null;
    const disabledApp = await buildApp();
    const token = signToken(disabledApp);

    const res = await disabledApp.inject({
      method: "GET",
      url: "/v1/gasless/status",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.enabled).toBe(false);
  });

  it("returns 403 when the requested nonce belongs to another wallet", async () => {
    const token = signToken(app, { address: TARGET });

    const res = await app.inject({
      method: "GET",
      url: `/v1/gasless/nonce/${ADDRESS}`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(403);
  });

  it("returns 403 when build-request.from does not match the authenticated wallet", async () => {
    const token = signToken(app, { address: TARGET });

    const res = await app.inject({
      method: "POST",
      url: "/v1/gasless/build-request",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        from: ADDRESS,
        to: TARGET,
        data: "0x",
      },
    });

    expect(res.statusCode).toBe(403);
  });
});
