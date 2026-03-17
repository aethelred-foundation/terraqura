import { FastifyInstance, FastifyPluginOptions } from "fastify";
import { Pool } from "pg";

async function checkDatabase(): Promise<boolean> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    return false;
  }

  const pool = new Pool({
    connectionString,
    max: 1,
    connectionTimeoutMillis: 1500,
    idleTimeoutMillis: 1500,
  });

  try {
    await pool.query("SELECT 1");
    return true;
  } catch {
    return false;
  } finally {
    await pool.end();
  }
}

async function checkBlockchain(): Promise<boolean> {
  const rpcUrl = process.env.AETHELRED_RPC_URL;
  if (!rpcUrl) {
    return false;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1500);
    try {
      const response = await fetch(rpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "eth_chainId",
          params: [],
          id: 1,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        return false;
      }

      const payload = (await response.json()) as { result?: string };
      const expectedChainId = parseInt(process.env.CHAIN_ID || "78432", 10);
      return typeof payload.result === "string"
        ? parseInt(payload.result, 16) === expectedChainId
        : false;
    } finally {
      clearTimeout(timeout);
    }
  } catch {
    return false;
  }
}

export async function healthRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions
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
    }
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
    }
  );
}
