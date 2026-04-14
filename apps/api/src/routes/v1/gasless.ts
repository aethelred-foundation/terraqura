// TerraQura Gasless Transaction Routes
// API endpoints for meta-transaction relay

import { FastifyInstance, FastifyReply } from "fastify";

import { getAuthenticatedAddress, isAdmin } from "../../lib/auth-context.js";
import { bearerAuthRateLimit, verifyBearerAuth } from "../../lib/bearer-auth.js";
import { getGaslessRelayer } from "../../services/gasless/relayer.service.js";

interface BuildRequestBody {
  from: string;
  to: string;
  data: string;
  gasLimit?: string;
}

interface RelayBody {
  request: {
    from: string;
    to: string;
    value: string;
    gas: string;
    nonce: string;
    deadline: number;
    data: string;
  };
  signature: string;
}

function ensureAuthorizedAddress(
  request: { user?: unknown },
  reply: FastifyReply,
  targetAddress: string,
): string | null {
  const callerAddress = getAuthenticatedAddress(request);
  if (!callerAddress) {
    reply.status(401).send({
      success: false,
      error: {
        code: "UNAUTHORIZED",
        message: "Missing authenticated wallet",
      },
    });
    return null;
  }

  const normalizedTarget = targetAddress.toLowerCase();
  if (!isAdmin(request) && normalizedTarget !== callerAddress) {
    reply.status(403).send({
      success: false,
      error: {
        code: "FORBIDDEN",
        message: "Gasless actions are limited to the authenticated wallet",
      },
    });
    return null;
  }

  return normalizedTarget;
}

export async function gaslessRoutes(fastify: FastifyInstance) {
  const relayer = getGaslessRelayer();

  // ============================================
  // GET NONCE
  // ============================================

  fastify.get<{ Params: { address: string } }>(
    "/nonce/:address",
    {
      schema: {
        description: "Get current nonce for gasless transactions",
        tags: ["Gasless"],
        params: {
          type: "object",
          required: ["address"],
          properties: {
            address: { type: "string", pattern: "^0x[a-fA-F0-9]{40}$" },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              data: {
                type: "object",
                properties: {
                  nonce: { type: "string" },
                },
              },
            },
          },
          401: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              error: {
                type: "object",
                properties: {
                  code: { type: "string" },
                  message: { type: "string" },
                },
              },
            },
          },
          403: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              error: {
                type: "object",
                properties: {
                  code: { type: "string" },
                  message: { type: "string" },
                },
              },
            },
          },
          500: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              error: {
                type: "object",
                properties: {
                  code: { type: "string" },
                  message: { type: "string" },
                },
              },
            },
          },
          503: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              error: {
                type: "object",
                properties: {
                  code: { type: "string" },
                  message: { type: "string" },
                },
              },
            },
          },
        },
      },
      config: bearerAuthRateLimit,
      preHandler: verifyBearerAuth,
    },
    async (request, reply) => {
      if (!ensureAuthorizedAddress(request, reply, request.params.address)) {
        return;
      }

      if (!relayer) {
        return reply.status(503).send({
          success: false,
          error: {
            code: "GASLESS_NOT_CONFIGURED",
            message: "Gasless transactions are not available",
          },
        });
      }

      try {
        const nonce = await relayer.getNonce(request.params.address);

        return {
          success: true,
          data: {
            nonce: nonce.toString(),
          },
        };
      } catch (error) {
        fastify.log.error(error, "Failed to get nonce");
        return reply.status(500).send({
          success: false,
          error: {
            code: "NONCE_FETCH_FAILED",
            message: "Failed to fetch nonce",
          },
        });
      }
    }
  );

  // ============================================
  // BUILD FORWARD REQUEST
  // ============================================

  fastify.post<{ Body: BuildRequestBody }>(
    "/build-request",
    {
      schema: {
        description: "Build a forward request for gasless transaction signing",
        tags: ["Gasless"],
        body: {
          type: "object",
          required: ["from", "to", "data"],
          properties: {
            from: { type: "string", pattern: "^0x[a-fA-F0-9]{40}$" },
            to: { type: "string", pattern: "^0x[a-fA-F0-9]{40}$" },
            data: { type: "string" },
            gasLimit: { type: "string" },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              data: {
                type: "object",
                properties: {
                  request: {
                    type: "object",
                    properties: {
                      from: { type: "string" },
                      to: { type: "string" },
                      value: { type: "string" },
                      gas: { type: "string" },
                      nonce: { type: "string" },
                      deadline: { type: "number" },
                      data: { type: "string" },
                    },
                  },
                  domain: { type: "object" },
                  types: { type: "object" },
                },
              },
            },
          },
          401: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              error: {
                type: "object",
                properties: {
                  code: { type: "string" },
                  message: { type: "string" },
                },
              },
            },
          },
          403: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              error: {
                type: "object",
                properties: {
                  code: { type: "string" },
                  message: { type: "string" },
                },
              },
            },
          },
          500: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              error: {
                type: "object",
                properties: {
                  code: { type: "string" },
                  message: { type: "string" },
                },
              },
            },
          },
          503: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              error: {
                type: "object",
                properties: {
                  code: { type: "string" },
                  message: { type: "string" },
                },
              },
            },
          },
        },
      },
      config: bearerAuthRateLimit,
      preHandler: verifyBearerAuth,
    },
    async (request, reply) => {
      if (!ensureAuthorizedAddress(request, reply, request.body.from)) {
        return;
      }

      if (!relayer) {
        return reply.status(503).send({
          success: false,
          error: {
            code: "GASLESS_NOT_CONFIGURED",
            message: "Gasless transactions are not available",
          },
        });
      }

      const { from, to, data, gasLimit } = request.body;

      try {
        const { request: forwardRequest, domain } = await relayer.buildForwardRequest(
          from,
          to,
          data,
          gasLimit ? BigInt(gasLimit) : undefined
        );

        return {
          success: true,
          data: {
            request: {
              from: forwardRequest.from,
              to: forwardRequest.to,
              value: forwardRequest.value.toString(),
              gas: forwardRequest.gas.toString(),
              nonce: forwardRequest.nonce.toString(),
              deadline: forwardRequest.deadline,
              data: forwardRequest.data,
            },
            domain,
            types: relayer.getSigningTypes(),
          },
        };
      } catch (error) {
        fastify.log.error(error, "Failed to build forward request");
        return reply.status(500).send({
          success: false,
          error: {
            code: "BUILD_REQUEST_FAILED",
            message: "Failed to build forward request",
          },
        });
      }
    }
  );

  // ============================================
  // RELAY TRANSACTION
  // ============================================

  fastify.post<{ Body: RelayBody }>(
    "/relay",
    {
      schema: {
        description: "Relay a signed gasless transaction",
        tags: ["Gasless"],
        body: {
          type: "object",
          required: ["request", "signature"],
          properties: {
            request: {
              type: "object",
              required: ["from", "to", "value", "gas", "nonce", "deadline", "data"],
              properties: {
                from: { type: "string" },
                to: { type: "string" },
                value: { type: "string" },
                gas: { type: "string" },
                nonce: { type: "string" },
                deadline: { type: "number" },
                data: { type: "string" },
              },
            },
            signature: { type: "string" },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              data: {
                type: "object",
                properties: {
                  txHash: { type: "string" },
                },
              },
            },
          },
          400: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              error: {
                type: "object",
                properties: {
                  code: { type: "string" },
                  message: { type: "string" },
                },
              },
            },
          },
          401: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              error: {
                type: "object",
                properties: {
                  code: { type: "string" },
                  message: { type: "string" },
                },
              },
            },
          },
          403: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              error: {
                type: "object",
                properties: {
                  code: { type: "string" },
                  message: { type: "string" },
                },
              },
            },
          },
          500: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              error: {
                type: "object",
                properties: {
                  code: { type: "string" },
                  message: { type: "string" },
                },
              },
            },
          },
          503: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              error: {
                type: "object",
                properties: {
                  code: { type: "string" },
                  message: { type: "string" },
                },
              },
            },
          },
        },
      },
      config: bearerAuthRateLimit,
      preHandler: verifyBearerAuth,
    },
    async (request, reply) => {
      if (!ensureAuthorizedAddress(request, reply, request.body.request.from)) {
        return;
      }

      if (!relayer) {
        return reply.status(503).send({
          success: false,
          error: {
            code: "GASLESS_NOT_CONFIGURED",
            message: "Gasless transactions are not available",
          },
        });
      }

      const { request: forwardRequest, signature } = request.body;

      try {
        // Convert string values to BigInt
        const typedRequest = {
          from: forwardRequest.from,
          to: forwardRequest.to,
          value: BigInt(forwardRequest.value),
          gas: BigInt(forwardRequest.gas),
          nonce: BigInt(forwardRequest.nonce),
          deadline: forwardRequest.deadline,
          data: forwardRequest.data,
        };

        // Use Defender relay in production, direct relay otherwise
        const result = process.env.DEFENDER_RELAYER_API_KEY
          ? await relayer.relayViaDefender(typedRequest, signature)
          : await relayer.relay(typedRequest, signature);

        if (!result.success) {
          return reply.status(400).send({
            success: false,
            error: {
              code: "RELAY_FAILED",
              message: result.error || "Transaction relay failed",
            },
          });
        }

        return {
          success: true,
          data: {
            txHash: result.txHash,
          },
        };
      } catch (error) {
        fastify.log.error(error, "Failed to relay transaction");
        return reply.status(500).send({
          success: false,
          error: {
            code: "RELAY_ERROR",
            message: "Failed to relay transaction",
          },
        });
      }
    }
  );

  // ============================================
  // GET RELAYER STATUS
  // ============================================

  fastify.get(
    "/status",
    {
      schema: {
        description: "Get gasless relayer status",
        tags: ["Gasless"],
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              data: {
                type: "object",
                properties: {
                  enabled: { type: "boolean" },
                  forwarderAddress: { type: "string" },
                  chainId: { type: "number" },
                },
              },
            },
          },
          401: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              error: {
                type: "object",
                properties: {
                  code: { type: "string" },
                  message: { type: "string" },
                },
              },
            },
          },
        },
      },
      config: bearerAuthRateLimit,
      preHandler: verifyBearerAuth,
    },
    async (_request, _reply) => {
      return {
        success: true,
        data: {
          enabled: relayer !== null,
          forwarderAddress: process.env.FORWARDER_CONTRACT || null,
          chainId: parseInt(process.env.CHAIN_ID || "137", 10),
        },
      };
    }
  );
}

export default gaslessRoutes;
