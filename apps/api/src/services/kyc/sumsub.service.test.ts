import { afterEach, describe, expect, it, vi } from "vitest";

import { SumsubService } from "./sumsub.service.js";

function createService(): SumsubService {
  return new SumsubService({
    appToken: "app-token",
    secretKey: "secret-key",
    webhookSecret: "webhook-secret",
  });
}

describe("SumsubService", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("does not copy provider response bodies into thrown API errors", async () => {
    const text = vi.fn().mockResolvedValue("Forbidden applicant PII payload");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        text,
      })
    );

    let caught: unknown;
    try {
      await createService().getApplicant("applicant-001");
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toBe("Sumsub API error: 403");
    expect((caught as Error).message).not.toContain("Forbidden applicant PII");
    expect(text).not.toHaveBeenCalled();
  });

  it("fails sanctions checks closed to a safe negative result when provider calls fail", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
      })
    );

    await expect(createService().requestSanctionsCheck("applicant-001")).resolves.toEqual({
      hit: false,
    });
  });

  it("returns null for invalid webhook signatures without parsing the payload", () => {
    const payload = JSON.stringify({
      applicantId: "applicant-001",
      externalUserId: "0xabc",
      type: "applicantReviewed",
      createdAt: "2026-06-25T00:00:00.000Z",
    });

    expect(createService().parseWebhook(payload, "invalid-signature")).toBeNull();
  });
});
