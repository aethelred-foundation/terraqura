import { afterEach, describe, expect, it, vi } from "vitest";

import { createClientId } from "./clientIds";

describe("createClientId", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses crypto.randomUUID when available", () => {
    vi.stubGlobal("crypto", {
      randomUUID: () => "123e4567-e89b-12d3-a456-426614174000",
    });

    expect(createClientId("notification")).toBe(
      "notification-123e4567-e89b-12d3-a456-426614174000",
    );
  });

  it("uses crypto.getRandomValues when randomUUID is unavailable", () => {
    vi.stubGlobal("crypto", {
      getRandomValues: (bytes: Uint8Array) => {
        bytes.fill(0xab);
        return bytes;
      },
    });

    expect(createClientId("activity")).toBe(
      "activity-abababababababababababababababab",
    );
  });

  it("falls back to monotonic IDs without using Math.random", () => {
    vi.stubGlobal("crypto", undefined);

    const first = createClientId("fallback");
    const second = createClientId("fallback");

    expect(first).toMatch(/^fallback-[a-z0-9]+-[a-z0-9]+$/);
    expect(second).toMatch(/^fallback-[a-z0-9]+-[a-z0-9]+$/);
    expect(first).not.toBe(second);
  });
});
