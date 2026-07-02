import { createHash } from "node:crypto";

import {
  pino as createPino,
  stdTimeFunctions,
  type DestinationStream,
  type Logger,
  type LoggerOptions,
} from "pino";

const REDACTED = "[REDACTED]";

export const WORKER_LOG_REDACTION_PATHS = [
  "authorization",
  "Authorization",
  "headers.authorization",
  "headers.Authorization",
  "apiToken",
  "appToken",
  "secretKey",
  "password",
  "privateKey",
  "walletPrivateKey",
  "MINTER_PRIVATE_KEY",
  "SUMSUB_APP_TOKEN",
  "SUMSUB_SECRET_KEY",
  "ONFIDO_API_TOKEN",
  "applicantId",
  "walletAddress",
  "userId",
  "*.authorization",
  "*.Authorization",
  "*.apiToken",
  "*.appToken",
  "*.secretKey",
  "*.password",
  "*.privateKey",
  "*.walletPrivateKey",
  "*.applicantId",
  "*.walletAddress",
  "*.userId",
];

export interface WorkerLoggerConfig {
  level?: string;
  destination?: DestinationStream;
  baseContext?: Record<string, unknown>;
}

export interface SerializedError {
  name: string;
  message: string;
  stack?: string;
  code?: string | number;
  status?: string | number;
  statusCode?: string | number;
  cause?: SerializedError;
}

export interface WorkerScopedLogger {
  log(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
}

export function buildWorkerLoggerOptions(
  config: Omit<WorkerLoggerConfig, "destination"> = {}
): LoggerOptions {
  return {
    name: "terraqura-worker",
    level:
      config.level ??
      process.env.WORKER_LOG_LEVEL ??
      process.env.LOG_LEVEL ??
      (process.env.NODE_ENV === "test" ? "silent" : "info"),
    base: {
      service: "terraqura-worker",
      ...config.baseContext,
    },
    timestamp: stdTimeFunctions.isoTime,
    redact: {
      paths: WORKER_LOG_REDACTION_PATHS,
      censor: REDACTED,
    },
  };
}

export function createWorkerLogger(config: WorkerLoggerConfig = {}): Logger {
  const options = buildWorkerLoggerOptions(config);
  if (config.destination) {
    return createPino(options, config.destination);
  }

  return createPino(options);
}

export const workerLogger = createWorkerLogger();

export function createScopedLogger(
  scope: string,
  context: Record<string, unknown> = {},
  parentLogger: Logger = workerLogger
): WorkerScopedLogger {
  const scopedLogger = parentLogger.child({ scope, ...context });

  return {
    log: (message, ...args) => writeLog(scopedLogger, "info", message, args),
    info: (message, ...args) => writeLog(scopedLogger, "info", message, args),
    warn: (message, ...args) => writeLog(scopedLogger, "warn", message, args),
    error: (message, ...args) => writeLog(scopedLogger, "error", message, args),
  };
}

export function serializeError(error: unknown): SerializedError {
  if (error instanceof Error) {
    const metadata = error as Error & {
      cause?: unknown;
      code?: unknown;
      status?: unknown;
      statusCode?: unknown;
    };

    const serialized: SerializedError = {
      name: error.name,
      message: error.message,
    };

    if (error.stack) {
      serialized.stack = error.stack;
    }

    if (typeof metadata.code === "string" || typeof metadata.code === "number") {
      serialized.code = metadata.code;
    }

    if (
      typeof metadata.status === "string" ||
      typeof metadata.status === "number"
    ) {
      serialized.status = metadata.status;
    }

    if (
      typeof metadata.statusCode === "string" ||
      typeof metadata.statusCode === "number"
    ) {
      serialized.statusCode = metadata.statusCode;
    }

    if (metadata.cause !== undefined) {
      serialized.cause = serializeError(metadata.cause);
    }

    return serialized;
  }

  return {
    name: typeof error,
    message: String(error),
  };
}

export function logReference(
  value: string | number | null | undefined,
  prefix: string
): string | undefined {
  if (value === null || value === undefined || value === "") {
    return undefined;
  }

  const digest = createHash("sha256").update(String(value)).digest("hex");
  return `${prefix}_${digest.slice(0, 12)}`;
}

function writeLog(
  logger: Logger,
  level: "info" | "warn" | "error",
  message: string,
  args: unknown[]
): void {
  const context = normalizeLogArgs(args);
  if (context) {
    logger[level](context, message);
  } else {
    logger[level](message);
  }
}

function normalizeLogArgs(args: unknown[]): Record<string, unknown> | undefined {
  if (args.length === 0) {
    return undefined;
  }

  const context: Record<string, unknown> = {};
  const extra: unknown[] = [];

  for (const arg of args) {
    if (arg instanceof Error) {
      context.err = serializeError(arg);
    } else if (isPlainRecord(arg)) {
      Object.assign(context, arg);
    } else {
      extra.push(arg);
    }
  }

  if (extra.length > 0) {
    context.args = extra.map((value) =>
      value instanceof Error ? serializeError(value) : value
    );
  }

  return Object.keys(context).length > 0 ? context : undefined;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === "object" &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}
