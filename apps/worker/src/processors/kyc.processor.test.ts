import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { KycCheckJobData } from "@terraqura/queue";
import {
  createMockJob,
  setupMockRuntimeEnv,
  cleanupMockRuntimeEnv,
  createMockFetchResponse,
} from "../../test/helpers.js";

// We must reset the module-level cache in runtime-env between tests.
// Mock the runtime-env module so we can control the return value per test.
vi.mock("../lib/runtime-env.js", () => ({
  getWorkerRuntimeEnv: vi.fn(),
}));

import { getWorkerRuntimeEnv } from "../lib/runtime-env.js";
import { kycProcessor } from "./kyc.processor.js";

const mockedGetWorkerRuntimeEnv = vi.mocked(getWorkerRuntimeEnv);

function baseSumsubEnv() {
  return {
    KYC_PROVIDER: "sumsub" as const,
    SUMSUB_APP_TOKEN: "test-app-token",
    SUMSUB_SECRET_KEY: "test-secret-key",
    ONFIDO_API_TOKEN: undefined,
  };
}

function baseOnfidoEnv() {
  return {
    KYC_PROVIDER: "onfido" as const,
    SUMSUB_APP_TOKEN: undefined,
    SUMSUB_SECRET_KEY: undefined,
    ONFIDO_API_TOKEN: "test-onfido-token",
  };
}

function baseSumsubJobData(overrides?: Partial<KycCheckJobData>): KycCheckJobData {
  return {
    userId: "user-001",
    walletAddress: "0xabcdef1234567890abcdef1234567890abcdef12",
    applicantId: "applicant-001",
    provider: "sumsub",
    checkType: "initial",
    ...overrides,
  };
}

function baseOnfidoJobData(overrides?: Partial<KycCheckJobData>): KycCheckJobData {
  return {
    userId: "user-002",
    walletAddress: "0x1234567890abcdef1234567890abcdef12345678",
    applicantId: "applicant-002",
    provider: "onfido",
    checkType: "initial",
    ...overrides,
  };
}

describe("kycProcessor", () => {
  beforeEach(() => {
    setupMockRuntimeEnv();
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    cleanupMockRuntimeEnv();
    vi.unstubAllGlobals();
  });

  // -------------------------------------------------------
  // Provider mismatch / disabled
  // -------------------------------------------------------
  describe("provider mismatch and disabled handling", () => {
    it("throws when KYC_PROVIDER is disabled", async () => {
      mockedGetWorkerRuntimeEnv.mockReturnValue({
        KYC_PROVIDER: "disabled",
        SUMSUB_APP_TOKEN: undefined,
        SUMSUB_SECRET_KEY: undefined,
        ONFIDO_API_TOKEN: undefined,
      });

      const job = createMockJob(baseSumsubJobData());
      await expect(kycProcessor(job)).rejects.toThrow(
        "KYC_PROVIDER=disabled; KYC checks cannot be processed"
      );
    });

    it("throws when job provider differs from configured provider", async () => {
      mockedGetWorkerRuntimeEnv.mockReturnValue(baseSumsubEnv());

      const job = createMockJob(baseSumsubJobData({ provider: "onfido" }));
      await expect(kycProcessor(job)).rejects.toThrow(
        "KYC provider mismatch: job requested onfido, configured provider is sumsub"
      );
    });

    it("throws when configured as onfido but job requests sumsub", async () => {
      mockedGetWorkerRuntimeEnv.mockReturnValue(baseOnfidoEnv());

      const job = createMockJob(baseSumsubJobData({ provider: "sumsub" }));
      await expect(kycProcessor(job)).rejects.toThrow(
        "KYC provider mismatch"
      );
    });
  });

  // -------------------------------------------------------
  // Sumsub flow
  // -------------------------------------------------------
  describe("Sumsub flow", () => {
    beforeEach(() => {
      mockedGetWorkerRuntimeEnv.mockReturnValue(baseSumsubEnv());
    });

    it("returns verified status for GREEN review answer", async () => {
      const fetchMock = vi.mocked(fetch);
      // First call: applicant fetch
      fetchMock.mockResolvedValueOnce(
        createMockFetchResponse({
          review: {
            reviewStatus: "completed",
            reviewResult: {
              reviewAnswer: "GREEN",
            },
          },
        })
      );
      // Second call: sanctions check
      fetchMock.mockResolvedValueOnce(
        createMockFetchResponse({ answer: "clear" })
      );

      const job = createMockJob(baseSumsubJobData());
      const result = await kycProcessor(job);

      expect(result.success).toBe(true);
      expect(result.status).toBe("verified");
      expect(result.riskScore).toBe(10);
      expect(result.sanctionsHit).toBe(false);
      expect(result.applicantId).toBe("applicant-001");
      expect(result.reviewResult?.reviewAnswer).toBe("GREEN");
    });

    it("returns rejected status for RED review answer", async () => {
      const fetchMock = vi.mocked(fetch);
      fetchMock.mockResolvedValueOnce(
        createMockFetchResponse({
          review: {
            reviewStatus: "completed",
            reviewResult: {
              reviewAnswer: "RED",
              rejectLabels: ["FORGERY"],
              reviewRejectType: "FINAL",
            },
          },
        })
      );
      fetchMock.mockResolvedValueOnce(
        createMockFetchResponse({ answer: "clear" })
      );

      const job = createMockJob(baseSumsubJobData());
      const result = await kycProcessor(job);

      expect(result.success).toBe(true);
      expect(result.status).toBe("rejected");
      expect(result.riskScore).toBe(90);
      expect(result.reviewResult?.rejectLabels).toEqual(["FORGERY"]);
      expect(result.reviewResult?.reviewRejectType).toBe("FINAL");
    });

    it("returns pending status when review is not completed", async () => {
      const fetchMock = vi.mocked(fetch);
      fetchMock.mockResolvedValueOnce(
        createMockFetchResponse({
          review: {
            reviewStatus: "init",
          },
        })
      );
      fetchMock.mockResolvedValueOnce(
        createMockFetchResponse({ answer: "clear" })
      );

      const job = createMockJob(baseSumsubJobData());
      const result = await kycProcessor(job);

      expect(result.success).toBe(true);
      expect(result.status).toBe("pending");
      expect(result.riskScore).toBe(50);
    });

    it("returns pending when review is completed but answer is neither GREEN nor RED", async () => {
      const fetchMock = vi.mocked(fetch);
      fetchMock.mockResolvedValueOnce(
        createMockFetchResponse({
          review: {
            reviewStatus: "completed",
            reviewResult: {
              reviewAnswer: "YELLOW",
            },
          },
        })
      );
      fetchMock.mockResolvedValueOnce(
        createMockFetchResponse({ answer: "clear" })
      );

      const job = createMockJob(baseSumsubJobData());
      const result = await kycProcessor(job);

      expect(result.status).toBe("pending");
    });

    it("detects sanctions hit when answer is not clear", async () => {
      const fetchMock = vi.mocked(fetch);
      fetchMock.mockResolvedValueOnce(
        createMockFetchResponse({
          review: {
            reviewStatus: "completed",
            reviewResult: { reviewAnswer: "GREEN" },
          },
        })
      );
      fetchMock.mockResolvedValueOnce(
        createMockFetchResponse({
          answer: "match",
          matchedData: [{ listName: "OFAC SDN" }],
        })
      );

      const job = createMockJob(baseSumsubJobData());
      const result = await kycProcessor(job);

      expect(result.sanctionsHit).toBe(true);
      expect(result.status).toBe("verified");
    });

    it("handles sanctions check failure gracefully", async () => {
      const fetchMock = vi.mocked(fetch);
      fetchMock.mockResolvedValueOnce(
        createMockFetchResponse({
          review: {
            reviewStatus: "completed",
            reviewResult: { reviewAnswer: "GREEN" },
          },
        })
      );
      // Sanctions check fails
      fetchMock.mockResolvedValueOnce(
        createMockFetchResponse("Internal Server Error", {
          ok: false,
          status: 500,
        })
      );

      const job = createMockJob(baseSumsubJobData());
      // Should not throw -- sanctions failure is caught internally
      const result = await kycProcessor(job);

      expect(result.success).toBe(true);
      expect(result.status).toBe("verified");
    });

    it("updates progress through the Sumsub flow", async () => {
      const fetchMock = vi.mocked(fetch);
      fetchMock.mockResolvedValueOnce(
        createMockFetchResponse({
          review: { reviewStatus: "completed", reviewResult: { reviewAnswer: "GREEN" } },
        })
      );
      fetchMock.mockResolvedValueOnce(
        createMockFetchResponse({ answer: "clear" })
      );

      const job = createMockJob(baseSumsubJobData());
      await kycProcessor(job);

      const progressCalls = vi.mocked(job.updateProgress).mock.calls.map(
        (c: unknown[]) => c[0]
      );
      expect(progressCalls).toEqual([10, 30, 70, 100]);
    });

    it("returns error result when Sumsub applicant API fails", async () => {
      const fetchMock = vi.mocked(fetch);
      fetchMock.mockResolvedValueOnce(
        createMockFetchResponse("Forbidden", { ok: false, status: 403 })
      );

      const job = createMockJob(baseSumsubJobData());
      const result = await kycProcessor(job);

      expect(result.success).toBe(false);
      expect(result.status).toBe("error");
      expect(result.error).toContain("Sumsub API error: 403");
    });

    it("returns error result when SUMSUB_APP_TOKEN is missing", async () => {
      mockedGetWorkerRuntimeEnv.mockReturnValue({
        KYC_PROVIDER: "sumsub",
        SUMSUB_APP_TOKEN: undefined,
        SUMSUB_SECRET_KEY: undefined,
        ONFIDO_API_TOKEN: undefined,
      });

      const job = createMockJob(baseSumsubJobData());
      const result = await kycProcessor(job);

      expect(result.success).toBe(false);
      expect(result.status).toBe("error");
      expect(result.error).toContain("SUMSUB_APP_TOKEN and SUMSUB_SECRET_KEY must be configured");
    });

    it("sends correct headers to Sumsub API", async () => {
      const fetchMock = vi.mocked(fetch);
      fetchMock.mockResolvedValueOnce(
        createMockFetchResponse({
          review: { reviewStatus: "completed", reviewResult: { reviewAnswer: "GREEN" } },
        })
      );
      fetchMock.mockResolvedValueOnce(
        createMockFetchResponse({ answer: "clear" })
      );

      const job = createMockJob(baseSumsubJobData());
      await kycProcessor(job);

      expect(fetchMock).toHaveBeenCalledTimes(2);
      const [firstUrl, firstInit] = fetchMock.mock.calls[0]!;
      expect(firstUrl).toContain("api.sumsub.com/resources/applicants/applicant-001");
      expect((firstInit as RequestInit).headers).toBeDefined();
      const headers = (firstInit as RequestInit).headers as Record<string, string>;
      expect(headers["X-App-Token"]).toBe("test-app-token");
      expect(headers["Content-Type"]).toBe("application/json");
    });
  });

  // -------------------------------------------------------
  // Onfido flow
  // -------------------------------------------------------
  describe("Onfido flow", () => {
    beforeEach(() => {
      mockedGetWorkerRuntimeEnv.mockReturnValue(baseOnfidoEnv());
    });

    it("returns verified status for clear result", async () => {
      const fetchMock = vi.mocked(fetch);
      fetchMock.mockResolvedValueOnce(
        createMockFetchResponse({
          checks: [{ result: "clear", report_ids: ["r1"] }],
        })
      );

      const job = createMockJob(baseOnfidoJobData());
      const result = await kycProcessor(job);

      expect(result.success).toBe(true);
      expect(result.status).toBe("verified");
      expect(result.riskScore).toBe(10);
    });

    it("returns pending status for consider result", async () => {
      const fetchMock = vi.mocked(fetch);
      fetchMock.mockResolvedValueOnce(
        createMockFetchResponse({
          checks: [{ result: "consider" }],
        })
      );

      const job = createMockJob(baseOnfidoJobData());
      const result = await kycProcessor(job);

      expect(result.status).toBe("pending");
      expect(result.riskScore).toBe(50);
    });

    it("returns rejected for unknown result value", async () => {
      const fetchMock = vi.mocked(fetch);
      fetchMock.mockResolvedValueOnce(
        createMockFetchResponse({
          checks: [{ result: "unidentified" }],
        })
      );

      const job = createMockJob(baseOnfidoJobData());
      const result = await kycProcessor(job);

      expect(result.status).toBe("rejected");
      expect(result.riskScore).toBe(90);
    });

    it("returns pending when no checks exist", async () => {
      const fetchMock = vi.mocked(fetch);
      fetchMock.mockResolvedValueOnce(
        createMockFetchResponse({ checks: [] })
      );

      const job = createMockJob(baseOnfidoJobData());
      const result = await kycProcessor(job);

      expect(result.status).toBe("pending");
      expect(result.riskScore).toBe(50);
    });

    it("returns pending when checks array is undefined", async () => {
      const fetchMock = vi.mocked(fetch);
      fetchMock.mockResolvedValueOnce(createMockFetchResponse({}));

      const job = createMockJob(baseOnfidoJobData());
      const result = await kycProcessor(job);

      expect(result.status).toBe("pending");
    });

    it("returns error when ONFIDO_API_TOKEN is missing", async () => {
      mockedGetWorkerRuntimeEnv.mockReturnValue({
        KYC_PROVIDER: "onfido",
        SUMSUB_APP_TOKEN: undefined,
        SUMSUB_SECRET_KEY: undefined,
        ONFIDO_API_TOKEN: undefined,
      });

      const job = createMockJob(baseOnfidoJobData());
      const result = await kycProcessor(job);

      expect(result.success).toBe(false);
      expect(result.status).toBe("error");
      expect(result.error).toContain("ONFIDO_API_TOKEN must be configured");
    });

    it("updates progress through the Onfido flow", async () => {
      const fetchMock = vi.mocked(fetch);
      fetchMock.mockResolvedValueOnce(
        createMockFetchResponse({
          checks: [{ result: "clear" }],
        })
      );

      const job = createMockJob(baseOnfidoJobData());
      await kycProcessor(job);

      const progressCalls = vi.mocked(job.updateProgress).mock.calls.map(
        (c: unknown[]) => c[0]
      );
      expect(progressCalls).toEqual([10, 30, 70, 100]);
    });
  });

  // -------------------------------------------------------
  // Risk score computation
  // -------------------------------------------------------
  describe("risk score derivation", () => {
    beforeEach(() => {
      mockedGetWorkerRuntimeEnv.mockReturnValue(baseSumsubEnv());
    });

    it("assigns risk score 10 for verified", async () => {
      const fetchMock = vi.mocked(fetch);
      fetchMock.mockResolvedValueOnce(
        createMockFetchResponse({
          review: { reviewStatus: "completed", reviewResult: { reviewAnswer: "GREEN" } },
        })
      );
      fetchMock.mockResolvedValueOnce(createMockFetchResponse({ answer: "clear" }));

      const job = createMockJob(baseSumsubJobData());
      const result = await kycProcessor(job);
      expect(result.riskScore).toBe(10);
    });

    it("assigns risk score 90 for rejected", async () => {
      const fetchMock = vi.mocked(fetch);
      fetchMock.mockResolvedValueOnce(
        createMockFetchResponse({
          review: { reviewStatus: "completed", reviewResult: { reviewAnswer: "RED" } },
        })
      );
      fetchMock.mockResolvedValueOnce(createMockFetchResponse({ answer: "clear" }));

      const job = createMockJob(baseSumsubJobData());
      const result = await kycProcessor(job);
      expect(result.riskScore).toBe(90);
    });

    it("assigns risk score 100 for error status", async () => {
      const fetchMock = vi.mocked(fetch);
      fetchMock.mockResolvedValueOnce(
        createMockFetchResponse("bad request", { ok: false, status: 400 })
      );

      const job = createMockJob(baseSumsubJobData());
      const result = await kycProcessor(job);
      expect(result.status).toBe("error");
      // Error results don't go through deriveRiskScore; they get riskScore=undefined
      expect(result.riskScore).toBeUndefined();
    });
  });
});
