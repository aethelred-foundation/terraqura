import { createHmac } from "node:crypto";

import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";

import {
  createTestServer,
  generateAuthToken,
  resetStateStore,
} from "../../../test/helpers.js";

describe("webhooks routes", () => {
  let server: FastifyInstance;

  beforeAll(async () => {
    server = await createTestServer();
  });

  afterEach(() => {
    resetStateStore();
    vi.unstubAllGlobals();
    delete process.env.WEBHOOK_ALLOW_LOCAL_DELIVERY;
    delete process.env.WEBHOOK_DELIVERY_TIMEOUT_MS;
  });

  afterAll(async () => {
    await server?.close();
  });

  it("rejects localhost webhook URLs by default", async () => {
    const token = generateAuthToken(server);

    const response = await server.inject({
      method: "POST",
      url: "/v1/webhooks",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        url: "http://127.0.0.1:9000/webhook",
        events: ["credit.minted"],
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      success: false,
      error: "Webhook URL must not target localhost or private network hosts",
    });
  });

  it("sends signed test webhook deliveries to the registered URL", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 204,
    });
    vi.stubGlobal("fetch", fetchMock);
    const token = generateAuthToken(server);

    const createResponse = await server.inject({
      method: "POST",
      url: "/v1/webhooks",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        url: "https://hooks.example.com/terraqura",
        events: ["credit.minted"],
        retryConfig: { maxRetries: 0, backoffMultiplierMs: 100 },
      },
    });
    const created = createResponse.json().data;

    const testResponse = await server.inject({
      method: "POST",
      url: `/v1/webhooks/${created.id}/test`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(testResponse.statusCode).toBe(200);
    const body = testResponse.json();
    expect(body.data.delivery).toMatchObject({
      success: true,
      statusCode: 204,
      attempts: 1,
    });
    expect(body.data.note).toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://hooks.example.com/terraqura");
    const requestInit = init as RequestInit;
    const payloadJson = requestInit.body as string;
    const expectedSignature = `sha256=${createHmac("sha256", created.signingKey)
      .update(payloadJson)
      .digest("hex")}`;
    const headers = requestInit.headers as Record<string, string>;
    expect(headers["X-TerraQura-Signature"]).toBe(expectedSignature);
    expect(headers["X-TerraQura-Delivery"]).toBe(body.data.deliveryId);
    expect(headers["X-TerraQura-Event"]).toBe("test.ping");
    expect(JSON.parse(payloadJson)).toMatchObject({
      type: "test.ping",
      data: { webhookId: created.id },
    });
  });

  it("records failed test deliveries without pretending they succeeded", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      })
    );
    const token = generateAuthToken(server);

    const createResponse = await server.inject({
      method: "POST",
      url: "/v1/webhooks",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        url: "https://hooks.example.com/failing",
        events: ["credit.minted"],
        retryConfig: { maxRetries: 0, backoffMultiplierMs: 100 },
      },
    });
    const created = createResponse.json().data;

    const testResponse = await server.inject({
      method: "POST",
      url: `/v1/webhooks/${created.id}/test`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(testResponse.statusCode).toBe(200);
    expect(testResponse.json().data.delivery).toMatchObject({
      success: false,
      statusCode: 500,
      attempts: 1,
      error: "HTTP 500",
    });

    const listResponse = await server.inject({
      method: "GET",
      url: "/v1/webhooks",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(listResponse.json().data[0]).toMatchObject({
      id: created.id,
      totalDeliveries: 1,
      totalFailures: 1,
    });
  });
});
