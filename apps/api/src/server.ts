import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import jwt from "@fastify/jwt";
import rateLimit from "@fastify/rate-limit";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import Fastify, { FastifyError } from "fastify";

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
import { marketplaceRoutes } from "./routes/v1/marketplace.js";
import { sensorsRoutes } from "./routes/v1/sensors.js";
import { verificationRoutes } from "./routes/v1/verification.js";
import { webhooksRoutes } from "./routes/v1/webhooks.js";

const apiEnv = getApiRuntimeEnv();

const PORT = parseInt(process.env.API_PORT || "4000", 10);
const HOST = process.env.API_HOST || "0.0.0.0";

function resolveJwtSecret(): string {
  return apiEnv.JWT_SECRET;
}

async function buildServer() {
  const fastify = Fastify({
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

  // Security plugins
  await fastify.register(helmet, {
    contentSecurityPolicy: false, // Disable for API
  });

  await fastify.register(cors, {
    origin: process.env.CORS_ORIGIN?.split(",") || ["http://localhost:3000"],
    credentials: true,
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

  // Swagger documentation
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
        { name: "DAC Units", description: "Direct Air Capture facility management" },
        { name: "Sensors", description: "IoT sensor data ingestion" },
        { name: "Verification", description: "Proof-of-Physics verification" },
        { name: "Credits", description: "Carbon credit management" },
        { name: "Marketplace", description: "P2P carbon credit trading" },
        { name: "KYC", description: "Identity verification and compliance" },
        { name: "Gasless", description: "Meta-transactions for gasless experience" },
        { name: "Webhooks", description: "Webhook and event notification management" },
        { name: "Activity", description: "Audit log and activity feed" },
        { name: "Analytics", description: "Portfolio, protocol, and impact analytics" },
        { name: "API Keys", description: "API key management and access control" },
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

  // Register routes
  await fastify.register(healthRoutes, { prefix: "/v1" });
  await fastify.register(authRoutes, { prefix: "/v1/auth" });
  await fastify.register(dacUnitsRoutes, { prefix: "/v1/dac-units" });
  await fastify.register(sensorsRoutes, { prefix: "/v1/sensors" });
  await fastify.register(verificationRoutes, { prefix: "/v1/verification" });
  await fastify.register(creditsRoutes, { prefix: "/v1/credits" });
  await fastify.register(marketplaceRoutes, { prefix: "/v1/marketplace" });
  await fastify.register(kycRoutes, { prefix: "/v1/kyc" });
  await fastify.register(gaslessRoutes, { prefix: "/v1/gasless" });
  await fastify.register(webhooksRoutes, { prefix: "/v1/webhooks" });
  await fastify.register(activityRoutes, { prefix: "/v1/activity" });
  await fastify.register(analyticsRoutes, { prefix: "/v1/analytics" });
  await fastify.register(apiKeysRoutes, { prefix: "/v1/api-keys" });

  // Global error handler
  fastify.setErrorHandler((error: FastifyError, _request, reply) => {
    fastify.log.error(error);

    const statusCode = error.statusCode || 500;
    const message = error.message || "Internal Server Error";

    reply.status(statusCode).send({
      success: false,
      error: {
        code: error.code || "INTERNAL_ERROR",
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

  server.log.info(`
    ╔════════════════════════════════════════════════════════╗
    ║                                                        ║
    ║   TerraQura API Server                                 ║
    ║   Institutional-Grade Carbon Asset Platform            ║
    ║                                                        ║
    ╠════════════════════════════════════════════════════════╣
    ║                                                        ║
    ║   Server running at: http://${HOST}:${PORT}               ║
    ║   API Docs:          http://${HOST}:${PORT}/docs          ║
    ║   Environment:       ${process.env.NODE_ENV || "development"}                     ║
    ║                                                        ║
    ╚════════════════════════════════════════════════════════╝
    `);
}

void start().catch((err) => {
  const message = err instanceof Error ? err.stack ?? err.message : String(err);
  process.stderr.write(`Failed to start server: ${message}\n`);
  process.exitCode = 1;
});

export { buildServer };
