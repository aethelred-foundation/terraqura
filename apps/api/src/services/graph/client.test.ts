import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GraphClient } from "./client.js";

describe("GraphClient", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("rejects empty subgraph URLs at construction time", () => {
    expect(() => new GraphClient({ subgraphUrl: "   " })).toThrow(
      "GraphClient requires a non-empty subgraph URL",
    );
  });

  it("ignores blank fallback URLs and queries the next configured endpoint", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        statusText: "Unavailable",
      })
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          data: {
            carbonCredit: null,
          },
        }),
      });
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const client = new GraphClient({
      subgraphUrl: "https://primary.example.com/subgraph",
      fallbackUrls: ["", "   ", "https://fallback.example.com/subgraph"],
      timeout: 1000,
    });

    const result = await client.getCreditById("1");

    expect(result).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://primary.example.com/subgraph");
    expect(fetchMock.mock.calls[1]?.[0]).toBe("https://fallback.example.com/subgraph");
  });
});
