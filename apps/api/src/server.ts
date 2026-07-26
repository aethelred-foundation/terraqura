import { fileURLToPath } from "node:url";

import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import jwt from "@fastify/jwt";
import rateLimit from "@fastify/rate-limit";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import Fastify, { FastifyError } from "fastify";

import { ensureDatabaseSchema } from "./lib/database-schema.js";
import { getApiRuntimeEnv } from "./lib/runtime-env.js";
import { activityRoutes } from "./routes/v1/activity.js";
import { analyticsRoutes } from "./routes/v1/analytics.js";
import { apiKeysRoutes } from "./routes/v1/api-keys.js";
import { authRoutes } from "./routes/v1/auth.js";
import { creditsRoutes } from "./routes/v1/credits.js";
import { dacUnitsRoutes } from "./routes/v1/dac-units.js";
import { gaslessRoutes } from "./routes/v1/gasless.js";
import { healthRoutes } from "./routes/v1/health.js";
import { kycRoutes } from "./routes/v1/kyc.js";
import { legalRoutes } from "./routes/v1/legal.js";
import { marketplaceRoutes } from "./routes/v1/marketplace.js";
import { sensorsRoutes } from "./routes/v1/sensors.js";
import { verificationRoutes } from "./routes/v1/verification.js";
import { webhooksRoutes } from "./routes/v1/webhooks.js";

const apiEnv = getApiRuntimeEnv();

function parsePort(rawPort: string): number {
  const port = Number(rawPort);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error("API_PORT must be an integer between 1 and 65535");
  }
  return port;
}

function parseTrustProxy(rawValue: string | undefined): false | number {
  if (!rawValue || rawValue === "false" || rawValue === "0") {
    return false;
  }

  const hops = Number(rawValue);
  if (!Number.isInteger(hops) || hops < 1 || hops > 10) {
    throw new Error(
      "TRUST_PROXY must be false or an integer hop count between 1 and 10",
    );
  }
  return hops;
}

function getCorsOrigins(): string[] {
  const configuredOrigins =
    process.env.CORS_ORIGIN ||
    (process.env.NODE_ENV === "production" ? "" : "http://localhost:3007");
  const origins = configuredOrigins
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (origins.length === 0) {
    throw new Error("CORS_ORIGIN must be configured in production");
  }
  if (process.env.NODE_ENV === "production" && origins.includes("*")) {
    throw new Error("CORS_ORIGIN cannot use a wildcard in production");
  }

  return origins;
}

const PORT = parsePort(process.env.API_PORT || "4000");
const HOST = process.env.API_HOST || "0.0.0.0";
const isProduction = process.env.NODE_ENV === "production";
const docsEnabled =
  process.env.API_DOCS_ENABLED !== undefined
    ? process.env.API_DOCS_ENABLED === "true"
    : !isProduction;

function resolveJwtSecret(): string {
  return apiEnv.JWT_SECRET;
}

async function buildServer() {
  await ensureDatabaseSchema();

  const fastify = Fastify({
    // A bounded hop count prevents clients from supplying an arbitrary
    // X-Forwarded-For chain while still supporting a controlled reverse proxy.
    trustProxy: parseTrustProxy(process.env.TRUST_PROXY),
    logger: {
      level: process.env.LOG_LEVEL || "info",
      transport:
        process.env.NODE_ENV === "development"
          ? {
              target: "pino-pretty",
              options: {
                translateTime: "HH:MM:ss Z",
                ignore: "pid,hostname",
              },
            }
          : undefined,
    },
  });

  fastify.removeContentTypeParser("application/json");
  fastify.addContentTypeParser(
    "application/json",
    { parseAs: "buffer" },
    (request, body, done) => {
      Object.defineProperty(request, "rawBody", {
        value: body,
        enumerable: false,
      });
      try {
        done(null, JSON.parse(body.toString("utf8")));
      } catch (error) {
        done(error as Error, undefined);
      }
    },
  );

  // Security plugins
  await fastify.register(helmet, {
    contentSecurityPolicy: false, // Disable for API
  });

  await fastify.register(cors, {
    origin: getCorsOrigins(),
    // TerraQura authenticates API calls with explicit bearer/API-key headers,
    // not browser cookies, so credentialed cross-origin requests stay disabled.
    credentials: false,
  });

  await fastify.register(rateLimit, {
    max: 100,
    timeWindow: "1 minute",
  });

  await fastify.register(jwt, {
    secret: resolveJwtSecret(),
    sign: {
      expiresIn: process.env.JWT_EXPIRES_IN || "24h",
    },
  });

  // Swagger is disabled by default in production. Enable it only behind
  // upstream access controls for approved developers.
  if (docsEnabled) {
    await fastify.register(swagger, {
      openapi: {
        info: {
          title: "TerraQura API",
          description:
            "Institutional-Grade Carbon Asset Platform with Proof-of-Physics Verification",
          version: "1.0.0",
        },
        servers: [
          {
            url: `http://localhost:${PORT}`,
            description: "Development server",
          },
        ],
        tags: [
          { name: "Health", description: "Health check endpoints" },
          { name: "Auth", description: "Authentication endpoints" },
          {
            name: "DAC Units",
            description: "Direct Air Capture facility management",
          },
          { name: "Sensors", description: "IoT sensor data ingestion" },
          {
            name: "Verification",
            description: "Proof-of-Physics verification",
          },
          { name: "Credits", description: "Carbon credit management" },
          { name: "Marketplace", description: "P2P carbon credit trading" },
          { name: "KYC", description: "Identity verification and compliance" },
          { name: "Legal", description: "Wallet-signed legal consent records" },
          {
            name: "Gasless",
            description: "Meta-transactions for gasless experience",
          },
          {
            name: "Webhooks",
            description: "Webhook and event notification management",
          },
          { name: "Activity", description: "Audit log and activity feed" },
          {
            name: "Analytics",
            description: "Portfolio, protocol, and impact analytics",
          },
          {
            name: "API Keys",
            description: "API key management and access control",
          },
        ],
        components: {
          securitySchemes: {
            bearerAuth: {
              type: "http",
              scheme: "bearer",
              bearerFormat: "JWT",
            },
            apiKeyAuth: {
              type: "apiKey",
              in: "header",
              name: "X-Sensor-API-Key",
            },
          },
        },
      },
    });

    await fastify.register(swaggerUi, {
      routePrefix: "/docs",
      uiConfig: {
        docExpansion: "list",
        deepLinking: true,
      },
    });
  }

  // Register routes
  await fastify.register(healthRoutes, { prefix: "/v1" });
  await fastify.register(authRoutes, { prefix: "/v1/auth" });
  await fastify.register(dacUnitsRoutes, { prefix: "/v1/dac-units" });
  await fastify.register(sensorsRoutes, { prefix: "/v1/sensors" });
  await fastify.register(verificationRoutes, { prefix: "/v1/verification" });
  await fastify.register(creditsRoutes, { prefix: "/v1/credits" });
  await fastify.register(marketplaceRoutes, { prefix: "/v1/marketplace" });
  await fastify.register(kycRoutes, { prefix: "/v1/kyc" });
  await fastify.register(legalRoutes, { prefix: "/v1/legal" });
  await fastify.register(gaslessRoutes, { prefix: "/v1/gasless" });
  await fastify.register(webhooksRoutes, { prefix: "/v1/webhooks" });
  await fastify.register(activityRoutes, { prefix: "/v1/activity" });
  await fastify.register(analyticsRoutes, { prefix: "/v1/analytics" });
  await fastify.register(apiKeysRoutes, { prefix: "/v1/api-keys" });

  // Global error handler
  fastify.setErrorHandler((error: FastifyError, _request, reply) => {
    fastify.log.error(error);

    const statusCode = error.statusCode || 500;
    const message =
      isProduction && statusCode >= 500
        ? "Internal Server Error"
        : error.message || "Internal Server Error";
    const code =
      isProduction && statusCode >= 500
        ? "INTERNAL_ERROR"
        : error.code || "INTERNAL_ERROR";

    reply.status(statusCode).send({
      success: false,
      error: {
        code,
        message,
        ...(process.env.NODE_ENV === "development" && { stack: error.stack }),
      },
    });
  });

  return fastify;
}

async function start() {
  const server = await buildServer();
  await server.listen({ port: PORT, host: HOST });

  server.log.info(
    {
      host: HOST,
      port: PORT,
      environment: process.env.NODE_ENV || "development",
      apiDocsEnabled: docsEnabled,
    },
    "TerraQura API server started",
  );
}

const isEntrypoint = process.argv[1]
  ? fileURLToPath(import.meta.url) === process.argv[1]
  : false;

if (isEntrypoint) {
  void start().catch((err) => {
    const message =
      err instanceof Error ? (err.stack ?? err.message) : String(err);
    process.stderr.write(`Failed to start server: ${message}\n`);
    process.exitCode = 1;
  });
}

export { buildServer };
