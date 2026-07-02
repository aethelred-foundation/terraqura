import { Writable } from "node:stream";

import { describe, expect, it } from "vitest";

import {
  WORKER_LOG_REDACTION_PATHS,
  createScopedLogger,
  createWorkerLogger,
  logReference,
  serializeError,
} from "./logger.js";

function captureLogLines(): { lines: string[]; stream: Writable } {
  const lines: string[] = [];
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      lines.push(chunk.toString("utf8"));
      callback();
    },
  });

  return { lines, stream };
}

describe("worker logger", () => {
  it("redacts credential and PII fields from structured logs", () => {
    const { lines, stream } = captureLogLines();
    const logger = createWorkerLogger({
      level: "info",
      destination: stream,
      baseContext: { service: "terraqura-worker-test" },
    });
    const scopedLogger = createScopedLogger("logger.test", {}, logger);

    scopedLogger.info("sensitive event", {
      apiToken: "onfido-token",
      applicantId: "applicant-001",
      headers: {
        Authorization: "Bearer secret-token",
      },
    });

    expect(lines).toHaveLength(1);
    const payload = JSON.parse(lines[0]!) as Record<string, unknown>;
    expect(JSON.stringify(payload)).not.toContain("onfido-token");
    expect(JSON.stringify(payload)).not.toContain("applicant-001");
    expect(JSON.stringify(payload)).not.toContain("Bearer secret-token");
    expect(JSON.stringify(payload)).toContain("[REDACTED]");
  });

  it("creates deterministic references without exposing the source identifier", () => {
    const first = logReference("0xabcdef", "wallet");
    const second = logReference("0xabcdef", "wallet");

    expect(first).toBe(second);
    expect(first).toMatch(/^wallet_[a-f0-9]{12}$/);
    expect(first).not.toContain("abcdef");
  });

  it("serializes error metadata without dropping status codes", () => {
    const error = new Error("provider failed") as Error & {
      statusCode: number;
      code: string;
    };
    error.name = "ProviderHttpError";
    error.statusCode = 403;
    error.code = "E_PROVIDER";

    expect(serializeError(error)).toMatchObject({
      name: "ProviderHttpError",
      message: "provider failed",
      statusCode: 403,
      code: "E_PROVIDER",
    });
  });

  it("keeps high-risk worker fields in the redaction policy", () => {
    expect(WORKER_LOG_REDACTION_PATHS).toEqual(
      expect.arrayContaining([
        "MINTER_PRIVATE_KEY",
        "SUMSUB_SECRET_KEY",
        "ONFIDO_API_TOKEN",
        "applicantId",
        "walletAddress",
      ])
    );
  });
});
