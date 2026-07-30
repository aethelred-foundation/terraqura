import Fastify from "fastify";
import { describe, expect, it, vi } from "vitest";

import { analyticsRoutes } from "./analytics.js";
import { weiToUsd } from "../../lib/aethel-price.js";

vi.mock("../../lib/state-store.js", () => ({
  readState: vi.fn(async <T>(_key: string, defaultState: T): Promise<T> => {
    return structuredClone(defaultState);
  }),
}));

vi.mock("../../lib/bearer-auth.js", () => ({
  bearerAuthRateLimit: {},
  verifyBearerAuth: vi.fn(),
}));

describe("AETHEL price conversion", () => {
  it("reports USD pricing as unavailable without an authoritative value", () => {
    expect(weiToUsd("1000000000000000000", undefined)).toBeNull();
    expect(weiToUsd("1000000000000000000", "")).toBeNull();
  });

  it("uses an explicitly configured positive AETHEL/USD value", () => {
    expect(weiToUsd("2000000000000000000", "1.25")).toBe(2.5);
  });

  it("fails closed for invalid configured values", () => {
    expect(weiToUsd("1000000000000000000", "not-a-number")).toBeNull();
    expect(weiToUsd("1000000000000000000", "1.25 USD")).toBeNull();
    expect(weiToUsd("1000000000000000000", "-1")).toBeNull();
  });

  it("serializes unavailable protocol USD metrics as null", async () => {
    const originalPrice = process.env.AETHEL_USD_PRICE;
    delete process.env.AETHEL_USD_PRICE;
    const app = Fastify({ logger: false });
    await app.register(analyticsRoutes, { prefix: "/v1/analytics" });
    await app.ready();

    try {
      const response = await app.inject({
        method: "GET",
        url: "/v1/analytics/protocol",
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().data).toMatchObject({
        totalValueLockedUsd: null,
        totalTradingVolumeUsd: null,
        protocolFeeCollectedUsd: null,
      });
    } finally {
      await app.close();
      if (originalPrice === undefined) {
        delete process.env.AETHEL_USD_PRICE;
      } else {
        process.env.AETHEL_USD_PRICE = originalPrice;
      }
    }
  });
});
