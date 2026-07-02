export type QueueLogLevel = "debug" | "info" | "warn" | "error";

export interface QueueLogger {
  debug(context: Record<string, unknown>, message: string): void;
  info(context: Record<string, unknown>, message: string): void;
  warn(context: Record<string, unknown>, message: string): void;
  error(context: Record<string, unknown>, message: string): void;
}

export interface SerializedQueueError {
  name: string;
  message: string;
  stack?: string;
  code?: string | number;
}

const REDACTED = "[REDACTED]";
const SENSITIVE_KEY_PATTERN = /(password|secret|token|private[-_]?key|authorization|cookie)/i;
const LEVEL_WEIGHT: Record<QueueLogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

let activeLogger: QueueLogger = createDefaultQueueLogger();

export function setQueueLogger(logger: QueueLogger): void {
  activeLogger = logger;
}

export function resetQueueLogger(): void {
  activeLogger = createDefaultQueueLogger();
}

export function getQueueLogger(): QueueLogger {
  return activeLogger;
}

export function serializeError(error: unknown): SerializedQueueError {
  if (error instanceof Error) {
    const metadata = error as Error & { code?: unknown };
    const serialized: SerializedQueueError = {
      name: error.name,
      message: error.message,
    };

    if (error.stack) {
      serialized.stack = error.stack;
    }

    if (typeof metadata.code === "string" || typeof metadata.code === "number") {
      serialized.code = metadata.code;
    }

    return serialized;
  }

  return {
    name: typeof error,
    message: String(error),
  };
}

function createDefaultQueueLogger(): QueueLogger {
  return {
    debug: (context, message) => writeStructuredLog("debug", context, message),
    info: (context, message) => writeStructuredLog("info", context, message),
    warn: (context, message) => writeStructuredLog("warn", context, message),
    error: (context, message) => writeStructuredLog("error", context, message),
  };
}

function writeStructuredLog(
  level: QueueLogLevel,
  context: Record<string, unknown>,
  message: string
): void {
  if (!shouldEmit(level)) {
    return;
  }

  const payload = {
    time: new Date().toISOString(),
    level,
    service: "terraqura-queue",
    msg: message,
    ...redactRecord(context),
  };
  const line = `${JSON.stringify(payload)}\n`;
  const stream = level === "error" ? process.stderr : process.stdout;
  stream.write(line);
}

function shouldEmit(level: QueueLogLevel): boolean {
  if (process.env.NODE_ENV === "test" || process.env.VITEST === "true") {
    return false;
  }

  const configuredLevel = parseLogLevel(
    process.env.QUEUE_LOG_LEVEL ?? process.env.LOG_LEVEL ?? "info"
  );
  return LEVEL_WEIGHT[level] >= LEVEL_WEIGHT[configuredLevel];
}

function parseLogLevel(value: string): QueueLogLevel {
  if (value === "debug" || value === "info" || value === "warn" || value === "error") {
    return value;
  }

  return "info";
}

function redactRecord(record: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(record).map(([key, value]) => [
      key,
      redactValue(key, value, 0),
    ])
  );
}

function redactValue(key: string, value: unknown, depth: number): unknown {
  if (SENSITIVE_KEY_PATTERN.test(key)) {
    return REDACTED;
  }

  if (depth >= 5 || value === null || value === undefined) {
    return value;
  }

  if (value instanceof Error) {
    return serializeError(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactValue(key, item, depth + 1));
  }

  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([childKey, childValue]) => [
        childKey,
        redactValue(childKey, childValue, depth + 1),
      ])
    );
  }

  return value;
}
