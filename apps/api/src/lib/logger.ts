import { createHash } from "node:crypto";

import {
  pino as createPino,
  stdTimeFunctions,
  type DestinationStream,
  type Logger,
  type LoggerOptions,
} from "pino";

const REDACTED = "[REDACTED]";

export const API_LOG_REDACTION_PATHS = [
  "authorization",
  "Authorization",
  "headers.authorization",
  "headers.Authorization",
  "cookie",
  "cookies",
  "token",
  "accessToken",
  "refreshToken",
  "apiKey",
  "appToken",
  "secretKey",
  "webhookSecret",
  "password",
  "privateKey",
  "applicantId",
  "externalUserId",
  "walletAddress",
  "email",
  "phone",
  "*.authorization",
  "*.Authorization",
  "*.token",
  "*.accessToken",
  "*.refreshToken",
  "*.apiKey",
  "*.appToken",
  "*.secretKey",
  "*.webhookSecret",
  "*.password",
  "*.privateKey",
  "*.applicantId",
  "*.externalUserId",
  "*.walletAddress",
  "*.email",
  "*.phone",
];

export interface ApiLoggerConfig {
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

export function buildApiLoggerOptions(
  config: Omit<ApiLoggerConfig, "destination"> = {}
): LoggerOptions {
  return {
    name: "terraqura-api",
    level:
      config.level ??
      process.env.API_LOG_LEVEL ??
      process.env.LOG_LEVEL ??
      (process.env.NODE_ENV === "test" ? "silent" : "info"),
    base: {
      service: "terraqura-api",
      ...config.baseContext,
    },
    timestamp: stdTimeFunctions.isoTime,
    redact: {
      paths: API_LOG_REDACTION_PATHS,
      censor: REDACTED,
    },
  };
}

export function createApiLogger(config: ApiLoggerConfig = {}): Logger {
  const options = buildApiLoggerOptions(config);
  if (config.destination) {
    return createPino(options, config.destination);
  }

  return createPino(options);
}

export const apiLogger = createApiLogger();

export function createScopedLogger(
  scope: string,
  context: Record<string, unknown> = {},
  parentLogger: Logger = apiLogger
): Logger {
  return parentLogger.child({ scope, ...context });
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
