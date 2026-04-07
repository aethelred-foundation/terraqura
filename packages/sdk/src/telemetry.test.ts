import { describe, expect, it, vi } from "vitest";

import {
  NoopTelemetry,
  SDKTelemetry,
  SDK_METRICS,
  createTelemetry,
} from "./telemetry.js";

describe("SDKTelemetry", () => {
  it("starts and ends spans with telemetry instruments", async () => {
    const setStatus = vi.fn();
    const recordException = vi.fn();
    const end = vi.fn();
    const span = {
      setStatus,
      recordException,
      end,
    };

    const startSpan = vi.fn(() => span);
    const addCounter = vi.fn();
    const recordHistogram = vi.fn();
    const meter = {
      createCounter: vi.fn(() => ({ add: addCounter })),
      createHistogram: vi.fn(() => ({ record: recordHistogram })),
    };

    const telemetry = new SDKTelemetry({
      tracer: { startSpan } as never,
      meter: meter as never,
      serviceName: "sdk-test",
    });

    const created = telemetry.startSpan("operation", { tokenId: 7 });
    expect(created).toBe(span);
    expect(startSpan).toHaveBeenCalledWith("terraqura.operation", {
      attributes: { tokenId: 7 },
    });

    telemetry.endSpan(span as never, "ok");
    expect(setStatus).toHaveBeenCalledWith({ code: 1 });
    expect(end).toHaveBeenCalled();

    const err = new Error("boom");
    telemetry.endSpan(span as never, "error", err);
    expect(recordException).toHaveBeenCalledWith(err);
    expect(setStatus).toHaveBeenCalledWith({ code: 2, message: "boom" });
  });

  it("routes metrics and wraps async success and failure", async () => {
    const span = {
      setStatus: vi.fn(),
      recordException: vi.fn(),
      end: vi.fn(),
    };
    const startSpan = vi.fn(() => span);
    const operationAdds: Array<[number, Record<string, string>?]> = [];
    const errorAdds: Array<[number, Record<string, string>?]> = [];
    const durations: Array<[number, Record<string, string>?]> = [];

    let counterCall = 0;
    const meter = {
      createCounter: vi.fn(() => {
        counterCall += 1;
        if (counterCall === 1) {
          return {
            add: (value: number, attrs?: Record<string, string>) => operationAdds.push([value, attrs]),
          };
        }
        return {
          add: (value: number, attrs?: Record<string, string>) => errorAdds.push([value, attrs]),
        };
      }),
      createHistogram: vi.fn(() => ({
        record: (value: number, attrs?: Record<string, string>) => durations.push([value, attrs]),
      })),
    };

    const telemetry = new SDKTelemetry({
      tracer: { startSpan } as never,
      meter: meter as never,
    });

    telemetry.recordMetric(SDK_METRICS.OPERATION_COUNT, 1, { operation: "mint" });
    telemetry.recordMetric(SDK_METRICS.OPERATION_DURATION, 25, { operation: "mint" });
    telemetry.recordMetric(SDK_METRICS.ERROR_COUNT, 1, { operation: "mint" });

    expect(operationAdds[0]).toEqual([1, { operation: "mint" }]);
    expect(durations[0]).toEqual([25, { operation: "mint" }]);
    expect(errorAdds[0]).toEqual([1, { operation: "mint" }]);

    await expect(
      telemetry.wrapAsync("mint", async () => "ok"),
    ).resolves.toBe("ok");
    expect(operationAdds.some(([, attrs]) => attrs?.status === "success")).toBe(true);
    expect(durations.some(([, attrs]) => attrs?.operation === "mint")).toBe(true);

    await expect(
      telemetry.wrapAsync("mint", async () => {
        throw new TypeError("network");
      }),
    ).rejects.toThrow("network");
    expect(errorAdds.some(([, attrs]) => attrs?.error_type === "TypeError")).toBe(true);
  });
});

describe("NoopTelemetry and factory", () => {
  it("returns a noop implementation when disabled", async () => {
    const telemetry = createTelemetry({ enabled: false });
    expect(telemetry).toBeInstanceOf(NoopTelemetry);
    await expect(telemetry.wrapAsync("noop", async () => 42)).resolves.toBe(42);
    expect(telemetry.startSpan("noop")).toBeDefined();
  });

  it("returns the sdk telemetry when enabled", () => {
    const telemetry = createTelemetry({ enabled: true });
    expect(telemetry).toBeInstanceOf(SDKTelemetry);
  });
});
