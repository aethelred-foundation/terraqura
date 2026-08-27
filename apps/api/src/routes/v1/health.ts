import { FastifyInstance, FastifyPluginOptions } from "fastify";

import { assertBlockchainRpcIdentity } from "../../lib/blockchain-rpc-identity.js";
import { ensureDatabaseSchema } from "../../lib/database-schema.js";
import { databasePool } from "../../lib/database.js";
import { getApiRuntimeEnv } from "../../lib/runtime-env.js";

async function checkDatabase(): Promise<boolean> {
  try {
    await ensureDatabaseSchema();
    await databasePool.query("SELECT 1");
    return true;
  } catch {
    return false;
  }
}

async function checkBlockchain(): Promise<boolean> {
  const env = getApiRuntimeEnv();
  if (!env.AETHELRED_RPC_URL) {
    return false;
  }

  try {
    await assertBlockchainRpcIdentity(env);
    return true;
  } catch {
    return false;
  }
}

export async function healthRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions,
) {
  fastify.get(
    "/health",
    {
      schema: {
        tags: ["Health"],
        summary: "Health check",
        description: "Returns the health status of the API",
        response: {
          200: {
            type: "object",
            properties: {
              status: { type: "string" },
              timestamp: { type: "string" },
              version: { type: "string" },
              uptime: { type: "number" },
            },
          },
        },
      },
    },
    async (_request, _reply) => {
      return {
        status: "healthy",
        timestamp: new Date().toISOString(),
        version: "1.0.0",
        uptime: process.uptime(),
      };
    },
  );

  fastify.get(
    "/health/ready",
    {
      schema: {
        tags: ["Health"],
        summary: "Readiness check",
        description: "Returns whether the API is ready to accept requests",
        response: {
          200: {
            type: "object",
            properties: {
              ready: { type: "boolean" },
              checks: {
                type: "object",
                properties: {
                  database: { type: "boolean" },
                  blockchain: { type: "boolean" },
                },
              },
            },
          },
          503: {
            type: "object",
            properties: {
              ready: { type: "boolean" },
              checks: {
                type: "object",
                properties: {
                  database: { type: "boolean" },
                  blockchain: { type: "boolean" },
                },
              },
            },
          },
        },
      },
    },
    async (_request, reply) => {
      const [database, blockchain] = await Promise.all([
        checkDatabase(),
        checkBlockchain(),
      ]);

      const ready = database && blockchain;
      const body = {
        ready,
        checks: {
          database,
          blockchain,
        },
      };

      if (!ready) {
        return reply.status(503).send(body);
      }

      return body;
    },
  );
}
