import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  ErrorCategory,
  ErrorSeverity,
  getSafeCurrentUrl,
  reportClientError,
  reportError,
  type ErrorReport,
} from "./errors";

const report: ErrorReport = {
  timestamp: "2026-06-25T00:00:00.000Z",
  category: ErrorCategory.API,
  severity: ErrorSeverity.ERROR,
  code: "API_ERROR",
  message: "API request failed",
};

describe("reportError", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("skips informational reports", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("NEXT_PUBLIC_ERROR_REPORTING_URL", "https://errors.example.com/intake");

    const result = await reportError({
      ...report,
      severity: ErrorSeverity.INFO,
    });

    expect(result).toEqual({ status: "skipped", reason: "info severity" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("skips production delivery when no endpoint is configured", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await reportError(report);

    expect(result).toEqual({
      status: "skipped",
      reason: "NEXT_PUBLIC_ERROR_REPORTING_URL is not configured",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("posts reports to the configured monitoring endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 202,
      statusText: "Accepted",
    });
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("NEXT_PUBLIC_ERROR_REPORTING_URL", "https://errors.example.com/intake");

    const result = await reportError(report);

    expect(fetchMock).toHaveBeenCalledWith(
      "https://errors.example.com/intake",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(report),
        keepalive: true,
      }),
    );
    expect(result).toEqual({
      status: "sent",
      endpoint: "https://errors.example.com/intake",
      httpStatus: 202,
    });
  });

  it("returns failed when the monitoring endpoint rejects the report", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      statusText: "Service Unavailable",
    }));
    vi.stubEnv("NEXT_PUBLIC_ERROR_REPORTING_URL", "https://errors.example.com/intake");

    const result = await reportError(report);

    expect(result).toEqual({
      status: "failed",
      endpoint: "https://errors.example.com/intake",
      httpStatus: 503,
      reason: "Service Unavailable",
    });
  });

  it("rejects insecure monitoring endpoints without sending reports", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("NEXT_PUBLIC_ERROR_REPORTING_URL", "http://errors.example.com/intake");

    const result = await reportError(report);

    expect(result).toEqual({
      status: "failed",
      endpoint: "http://errors.example.com/intake",
      reason: "NEXT_PUBLIC_ERROR_REPORTING_URL must use HTTPS",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("reportClientError", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("classifies runtime errors, preserves context, and posts one report", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 202,
      statusText: "Accepted",
    });
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("NEXT_PUBLIC_ERROR_REPORTING_URL", "https://errors.example.com/intake");

    const result = await reportClientError(new Error("Wrong network detected"), {
      source: "connection-monitor",
      expectedChainId: 7331,
      actualChainId: 1,
    });

    expect(result).toEqual({
      status: "sent",
      endpoint: "https://errors.example.com/intake",
      httpStatus: 202,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(init.body));
    expect(body).toMatchObject({
      category: ErrorCategory.NETWORK,
      severity: ErrorSeverity.WARNING,
      code: "NETWORK_ERROR",
      message: "Wrong network detected",
      metadata: {
        source: "connection-monitor",
        expectedChainId: 7331,
        actualChainId: 1,
      },
    });
  });

  it("strips query strings and fragments from reported URLs", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 202,
      statusText: "Accepted",
    });
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("NEXT_PUBLIC_ERROR_REPORTING_URL", "https://errors.example.com/intake");
    window.history.pushState(
      {},
      "",
      "/dashboard/compliance?access_token=secret&applicantId=abc#kyc",
    );

    expect(getSafeCurrentUrl()).toBe("http://localhost:3000/dashboard/compliance");

    await reportClientError(new Error("KYC callback failed"), {
      source: "kyc-callback",
    });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(init.body));
    expect(body.url).toBe("http://localhost:3000/dashboard/compliance");
    expect(body.url).not.toContain("access_token");
    expect(body.url).not.toContain("applicantId");
    expect(body.url).not.toContain("#kyc");
  });

  it("skips user rejection events before delivery", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("NEXT_PUBLIC_ERROR_REPORTING_URL", "https://errors.example.com/intake");

    const result = await reportClientError(new Error("User rejected the request"), {
      source: "wallet-action",
    });

    expect(result).toEqual({ status: "skipped", reason: "info severity" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
