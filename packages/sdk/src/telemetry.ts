/**
 * @terraqura/sdk — OpenTelemetry Integration
 *
 * Automatic span creation, error recording, and metric collection
 * for all SDK operations. Integrates with any OpenTelemetry setup
 * the consumer configures.
 */

import {
  trace,
  metrics,
  SpanStatusCode,
  type Tracer,
  type Meter,
  type Span,
  type Counter,
  type Histogram,
} from "@opentelemetry/api";

import type { TelemetryConfig } from "./types.js";

// ============================================
// Metric Names
// ============================================

export const SDK_METRICS = {
  /** Count of SDK operations by type and status */
  OPERATION_COUNT: "terraqura.sdk.operation.count",
  /** Duration of SDK operations in milliseconds */
  OPERATION_DURATION: "terraqura.sdk.operation.duration",
  /** Gas used by transactions */
  GAS_USED: "terraqura.sdk.gas.used",
  /** Credits minted via MRV */
  CREDITS_MINTED: "terraqura.sdk.credits.minted",
  /** Credits retired via offset */
  CREDITS_RETIRED: "terraqura.sdk.credits.retired",
  /** RPC call latency in milliseconds */
  RPC_LATENCY: "terraqura.sdk.rpc.latency",
  /** Error count by type */
  ERROR_COUNT: "terraqura.sdk.error.count",
} as const;

// ============================================
// Telemetry Interface
// ============================================

export interface ITelemetry {
  /** Start a new span for an operation */
  startSpan(name: string, attributes?: Record<string, string | number>): Span;
  /** End a span with success or error status */
  endSpan(span: Span, status: "ok" | "error", error?: Error): void;
  /** Record a metric value */
  recordMetric(
    name: string,
    value: number,
    attributes?: Record<string, string>,
  ): void;
  /**
   * Wrap an async function with automatic span creation,
   * error recording, and duration tracking.
   */
  wrapAsync<T>(
    name: string,
    fn: () => Promise<T>,
    attributes?: Record<string, string | number>,
  ): Promise<T>;
}

// ============================================
// SDK Telemetry Implementation
// ============================================

/**
 * OpenTelemetry integration for TerraQura SDK.
 *
 * Automatically participates in any OpenTelemetry setup the consumer
 * configures. If no tracer/meter is provided, uses the global API
 * with "terraqura-sdk" as the instrumentation scope.
 *
 * @example
 * ```ts
 * const telemetry = new SDKTelemetry({ enabled: true });
 * const result = await telemetry.wrapAsync("assets.getProvenance", async () => {
 *   return contract.getCreditProvenance(tokenId);
 * }, { tokenId: "123" });
 * ```
 */
export class SDKTelemetry implements ITelemetry {
  private readonly tracer: Tracer;
  private readonly meter: Meter;
  private readonly operationCounter: Counter;
  private readonly operationDuration: Histogram;
  private readonly errorCounter: Counter;

  constructor(config: TelemetryConfig = {}) {
    const serviceName = config.serviceName || "terraqura-sdk";

    this.tracer = config.tracer || trace.getTracer(serviceName, "0.1.0");
    this.meter = config.meter || metrics.getMeter(serviceName, "0.1.0");

    // Create metric instruments
    this.operationCounter = this.meter.createCounter(
      SDK_METRICS.OPERATION_COUNT,
      {
        description: "Count of SDK operations by type and status",
        unit: "1",
      },
    );

    this.operationDuration = this.meter.createHistogram(
      SDK_METRICS.OPERATION_DURATION,
      {
        description: "Duration of SDK operations in milliseconds",
        unit: "ms",
      },
    );

    this.errorCounter = this.meter.createCounter(
      SDK_METRICS.ERROR_COUNT,
      {
        description: "Error count by type",
        unit: "1",
      },
    );
  }

  startSpan(
    name: string,
    attributes?: Record<string, string | number>,
  ): Span {
    return this.tracer.startSpan(`terraqura.${name}`, {
      attributes: attributes as Record<string, string | number>,
    });
  }

  endSpan(span: Span, status: "ok" | "error", error?: Error): void {
    if (status === "error" && error) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
      span.recordException(error);
    } else {
      span.setStatus({ code: SpanStatusCode.OK });
    }
    span.end();
  }

  recordMetric(
    name: string,
    value: number,
    attributes?: Record<string, string>,
  ): void {
    // Route to the appropriate instrument based on metric name
    if (name === SDK_METRICS.OPERATION_COUNT) {
      this.operationCounter.add(value, attributes);
    } else if (name === SDK_METRICS.OPERATION_DURATION) {
      this.operationDuration.record(value, attributes);
    } else if (name === SDK_METRICS.ERROR_COUNT) {
      this.errorCounter.add(value, attributes);
    }
  }

  async wrapAsync<T>(
    name: string,
    fn: () => Promise<T>,
    attributes?: Record<string, string | number>,
  ): Promise<T> {
    const span = this.startSpan(name, attributes);
    const startTime = Date.now();

    try {
      const result = await fn();

      this.endSpan(span, "ok");
      this.operationCounter.add(1, {
        operation: name,
        status: "success",
      });
      this.operationDuration.record(Date.now() - startTime, {
        operation: name,
      });

      return result;
    } catch (error) {
      this.endSpan(span, "error", error as Error);
      this.errorCounter.add(1, {
        operation: name,
        error_type: (error as Error)?.name || "UnknownError",
      });
      this.operationDuration.record(Date.now() - startTime, {
        operation: name,
        status: "error",
      });

      throw error;
    }
  }
}

// ============================================
// No-op Telemetry (when disabled)
// ============================================

/** A no-op span that does nothing */
const NOOP_SPAN: Span = {
  spanContext: () => ({
    traceId: "0",
    spanId: "0",
    traceFlags: 0,
  }),
  setAttribute: () => NOOP_SPAN,
  setAttributes: () => NOOP_SPAN,
  addEvent: () => NOOP_SPAN,
  addLink: () => NOOP_SPAN,
  setStatus: () => NOOP_SPAN,
  updateName: () => NOOP_SPAN,
  end: () => {},
  isRecording: () => false,
  recordException: () => {},
} as unknown as Span;

/**
 * No-op telemetry implementation.
 * All operations pass through without overhead.
 */
export class NoopTelemetry implements ITelemetry {
  startSpan(): Span {
    return NOOP_SPAN;
  }

  endSpan(): void {
    // No-op
  }

  recordMetric(): void {
    // No-op
  }

  async wrapAsync<T>(
    _name: string,
    fn: () => Promise<T>,
  ): Promise<T> {
    return fn();
  }
}

/**
 * Create the appropriate telemetry instance based on configuration.
 */
export function createTelemetry(
  config?: TelemetryConfig,
): ITelemetry {
  if (config?.enabled === false) {
    return new NoopTelemetry();
  }
  return new SDKTelemetry(config);
}
