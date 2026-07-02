import {
  getActiveDeployment,
  getNetwork,
  type DeploymentDefinition,
  type NetworkDefinition,
} from "@terraqura/network-manifest";
import { FastifyInstance, FastifyPluginOptions } from "fastify";
import { Pool } from "pg";

interface NetworkRuntime {
  deployment: DeploymentDefinition;
  network: NetworkDefinition;
  rpcUrl: string | undefined;
  configuredChainId: number | null;
  chainIdMatchesManifest: boolean;
}

const NETWORK_HEALTH_SCHEMA = {
  type: "object",
  properties: {
    key: { type: "string" },
    deploymentKey: { type: "string" },
    deploymentStatus: { type: "string" },
    chainId: { type: "number" },
    configuredChainId: { type: ["number", "null"] },
    chainIdMatchesManifest: { type: "boolean" },
    rpcConfigured: { type: "boolean" },
  },
} as const;

function getNetworkRuntime(): NetworkRuntime {
  const deployment = getActiveDeployment(process.env);
  const network = getNetwork(deployment.network);
  const configuredChainId = process.env.CHAIN_ID ? parseInt(process.env.CHAIN_ID, 10) : null;

  return {
    deployment,
    network,
    rpcUrl: resolveRpcUrl(network),
    configuredChainId,
    chainIdMatchesManifest:
      configuredChainId === null || configuredChainId === network.chainId,
  };
}

function resolveRpcUrl(network: NetworkDefinition): string | undefined {
  const scopedRpcUrl =
    network.key === "polygonAmoy"
      ? process.env.POLYGON_AMOY_RPC_URL ?? process.env.POLYGON_RPC_URL
      : network.key === "aethelredTestnet"
        ? process.env.AETHELRED_TESTNET_RPC_URL ?? process.env.AETHELRED_RPC_URL
        : process.env.AETHELRED_RPC_URL;

  return process.env.TERRAQURA_RPC_URL ?? scopedRpcUrl;
}

function networkHealthPayload(runtime = getNetworkRuntime()) {
  return {
    key: runtime.network.key,
    deploymentKey: runtime.deployment.key,
    deploymentStatus: runtime.deployment.status,
    chainId: runtime.network.chainId,
    configuredChainId: runtime.configuredChainId,
    chainIdMatchesManifest: runtime.chainIdMatchesManifest,
    rpcConfigured: Boolean(runtime.rpcUrl),
  };
}

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
  const runtime = getNetworkRuntime();
  if (!runtime.rpcUrl || !runtime.chainIdMatchesManifest) {
    return false;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1500);
    try {
      const response = await fetch(runtime.rpcUrl, {
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
      return typeof payload.result === "string"
        ? parseInt(payload.result, 16) === runtime.network.chainId
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
              network: NETWORK_HEALTH_SCHEMA,
            },
          },
        },
      },
    },
    async (_request, _reply) => {
      const runtime = getNetworkRuntime();
      return {
        status: "healthy",
        timestamp: new Date().toISOString(),
        version: "1.0.0",
        uptime: process.uptime(),
        network: networkHealthPayload(runtime),
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
              network: NETWORK_HEALTH_SCHEMA,
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
              network: NETWORK_HEALTH_SCHEMA,
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
      const runtime = getNetworkRuntime();
      const [database, blockchain] = await Promise.all([
        checkDatabase(),
        checkBlockchain(),
      ]);

      const ready = database && blockchain;
      const body = {
        ready,
        network: networkHealthPayload(runtime),
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
