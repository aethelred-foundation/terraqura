import { readFileSync } from "node:fs";

import { afterEach, describe, expect, it, vi } from "vitest";

import { withRetry } from "./utils.js";

describe("SDK utilities", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("retries retryable failures and resolves on a later attempt", async () => {
    vi.useFakeTimers();
    const operation = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error("TRANSIENT network failure"))
      .mockResolvedValueOnce("ok");

    const resultPromise = withRetry(operation, {
      maxRetries: 1,
      baseDelayMs: 0,
      maxDelayMs: 0,
      retryableErrors: ["TRANSIENT"],
    });
    await vi.runAllTimersAsync();

    await expect(resultPromise).resolves.toBe("ok");
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it("does not use predictable Math.random in production utility code", () => {
    const source = readFileSync(new URL("./utils.ts", import.meta.url), "utf8");
    expect(source).not.toContain("Math.random");
    expect(source).toContain("ethers.randomBytes");
    expect(source).toContain("0x100000000");
    expect(source).not.toContain("0xffffffff");
  });
});
