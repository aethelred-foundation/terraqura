import { randomBytes, randomUUID } from "node:crypto";

import { FastifyInstance, FastifyPluginOptions } from "fastify";
import { z } from "zod";

import {
  API_KEYS_STORE_KEY,
  DEFAULT_API_KEYS_STATE,
  hashApiKey,
  type ApiKeyType,
  type StoredApiKey,
} from "../../lib/api-key-store.js";
import {
  ensureApprovedKyc,
  getAuthenticatedAddress,
  isAdmin,
} from "../../lib/auth-context.js";
import {
  bearerAuthRateLimit,
  verifyBearerAuth,
} from "../../lib/bearer-auth.js";
import { mutateState, readState } from "../../lib/state-store.js";

const ApiKeyTypeSchema = z.literal("sensor");

const CreateApiKeySchema = z
  .object({
    name: z.string().min(1).max(100),
    type: ApiKeyTypeSchema,
    dacUnitId: z.string().min(1).optional(),
    description: z.string().max(500).optional(),
    expiresInDays: z.number().int().min(1).max(365).optional(),
  })
  .superRefine((value, context) => {
    if (value.type === "sensor" && !value.dacUnitId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["dacUnitId"],
        message: "dacUnitId is required for sensor credentials",
      });
    }
  });

const UpdateApiKeySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
});

const DEFAULT_PERMISSIONS: Record<ApiKeyType, string[]> = {
  sensor: ["sensors:write"],
};
const DAC_UNITS_STORE_KEY = "dac-units:v1";
const DEFAULT_DAC_UNITS_STATE = {
  units: {} as Record<string, { id: string; operatorWallet: string }>,
};

function generateApiKey(type: ApiKeyType): string {
  const prefixMap: Record<ApiKeyType, string> = {
    sensor: "tqs",
  };
  const prefix = prefixMap[type];
  return `${prefix}_${randomBytes(32).toString("hex")}`;
}

function maskApiKey(prefix: string): string {
  return `${prefix}${"*".repeat(40)}`;
}

export async function apiKeysRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions,
) {
  // POST /v1/api-keys — Create new API key
  fastify.post(
    "/",
    {
      schema: {
        tags: ["API Keys"],
        summary: "Create a new API key",
        description:
          "Generate a new API key. The full key is returned only once in this response; store it securely.",
        security: [{ bearerAuth: [] }],
        body: {
          type: "object",
          required: ["name", "type"],
          properties: {
            name: { type: "string" },
            dacUnitId: { type: "string" },
            type: {
              type: "string",
              enum: ["sensor"],
            },
            description: { type: "string" },
            expiresInDays: { type: "integer" },
          },
        },
        response: {
          400: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              error: { type: "string" },
            },
          },
          201: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              data: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  key: { type: "string" },
                  name: { type: "string" },
                  type: { type: "string" },
                  dacUnitId: { type: "string", nullable: true },
                  permissions: {
                    type: "array",
                    items: { type: "string" },
                  },
                  expiresAt: { type: "string", nullable: true },
                  createdAt: { type: "string" },
                  warning: { type: "string" },
                },
              },
            },
          },
          401: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              error: { type: "string" },
            },
          },
          403: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              error: { type: "string" },
            },
          },
          404: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              error: { type: "string" },
            },
          },
        },
      },
      config: bearerAuthRateLimit,
      preHandler: verifyBearerAuth,
    },
    async (request, reply) => {
      const walletAddress = getAuthenticatedAddress(request);
      if (!walletAddress) {
        return reply.status(401).send({
          success: false,
          error: "Missing authenticated wallet",
        });
      }
      if (!ensureApprovedKyc(request, reply)) return;

      const body = CreateApiKeySchema.parse(request.body);
      const dacUnitId = body.dacUnitId;
      if (!dacUnitId) {
        return reply.status(400).send({
          success: false,
          error: "dacUnitId is required for sensor credentials",
        });
      }
      const units = await readState(
        DAC_UNITS_STORE_KEY,
        DEFAULT_DAC_UNITS_STATE,
      );
      const unit = units.units[dacUnitId];
      if (!unit) {
        return reply.status(404).send({
          success: false,
          error: "DAC unit not found",
        });
      }
      if (
        !isAdmin(request) &&
        unit.operatorWallet.toLowerCase() !== walletAddress
      ) {
        return reply.status(403).send({
          success: false,
          error:
            "Only the facility operator can provision its sensor credential",
        });
      }
      const rawKey = generateApiKey(body.type);
      const keySalt = randomBytes(16).toString("hex");
      const keyHash = hashApiKey(rawKey, keySalt);
      const keyPrefix = rawKey.slice(0, 8);

      const permissions = DEFAULT_PERMISSIONS[body.type];

      const apiKey = await mutateState(
        API_KEYS_STORE_KEY,
        DEFAULT_API_KEYS_STATE,
        async (state) => {
          const id = `key_${randomUUID()}`;
          const nowIso = new Date().toISOString();

          const expiresAt = body.expiresInDays
            ? new Date(
                Date.now() + body.expiresInDays * 24 * 60 * 60 * 1000,
              ).toISOString()
            : null;

          const created: StoredApiKey = {
            id,
            walletAddress,
            dacUnitId,
            name: body.name,
            type: body.type,
            description: body.description || null,
            keyHash,
            keySalt,
            keyPrefix,
            permissions,
            isActive: true,
            expiresAt,
            lastUsedAt: null,
            totalRequests: 0,
            createdAt: nowIso,
            updatedAt: nowIso,
          };

          state.keys[id] = created;
          return created;
        },
      );

      return reply.status(201).send({
        success: true,
        data: {
          id: apiKey.id,
          key: rawKey,
          name: apiKey.name,
          type: apiKey.type,
          dacUnitId: apiKey.dacUnitId,
          permissions: apiKey.permissions,
          expiresAt: apiKey.expiresAt,
          createdAt: apiKey.createdAt,
          warning: "Store this key securely. It will not be shown again.",
        },
      });
    },
  );

  // GET /v1/api-keys — List API keys (masked)
  fastify.get(
    "/",
    {
      schema: {
        tags: ["API Keys"],
        summary: "List API keys",
        description:
          "Returns all API keys for the authenticated user with masked key values",
        security: [{ bearerAuth: [] }],
        querystring: {
          type: "object",
          properties: {
            type: {
              type: "string",
              enum: ["sensor"],
            },
            isActive: { type: "boolean" },
            limit: { type: "integer", default: 50 },
            offset: { type: "integer", default: 0 },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              data: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "string" },
                    name: { type: "string" },
                    type: { type: "string" },
                    dacUnitId: { type: "string", nullable: true },
                    maskedKey: { type: "string" },
                    permissions: {
                      type: "array",
                      items: { type: "string" },
                    },
                    isActive: { type: "boolean" },
                    expiresAt: { type: "string", nullable: true },
                    lastUsedAt: { type: "string", nullable: true },
                    totalRequests: { type: "integer" },
                    createdAt: { type: "string" },
                  },
                },
              },
              pagination: {
                type: "object",
                properties: {
                  total: { type: "integer" },
                  limit: { type: "integer" },
                  offset: { type: "integer" },
                },
              },
            },
          },
          401: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              error: { type: "string" },
            },
          },
        },
      },
      config: bearerAuthRateLimit,
      preHandler: verifyBearerAuth,
    },
    async (request, reply) => {
      const walletAddress = getAuthenticatedAddress(request);
      if (!walletAddress) {
        return reply.status(401).send({
          success: false,
          error: "Missing authenticated wallet",
        });
      }

      const query = request.query as {
        type?: string;
        isActive?: boolean;
        limit?: number;
        offset?: number;
      };

      const state = await readState(API_KEYS_STORE_KEY, DEFAULT_API_KEYS_STATE);
      let keys = Object.values(state.keys).filter(
        (key) => key.walletAddress.toLowerCase() === walletAddress,
      );

      if (query.type) {
        keys = keys.filter((key) => key.type === query.type);
      }

      if (query.isActive !== undefined) {
        keys = keys.filter((key) => key.isActive === query.isActive);
      }

      keys.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );

      const total = keys.length;
      const limit = query.limit || 50;
      const offset = query.offset || 0;
      keys = keys.slice(offset, offset + limit);

      return {
        success: true,
        data: keys.map((key) => ({
          id: key.id,
          name: key.name,
          type: key.type,
          dacUnitId: key.dacUnitId,
          maskedKey: maskApiKey(key.keyPrefix),
          permissions: key.permissions,
          isActive: key.isActive,
          expiresAt: key.expiresAt,
          lastUsedAt: key.lastUsedAt,
          totalRequests: key.totalRequests,
          createdAt: key.createdAt,
        })),
        pagination: { total, limit, offset },
      };
    },
  );

  // DELETE /v1/api-keys/:id — Revoke an API key
  fastify.delete(
    "/:id",
    {
      schema: {
        tags: ["API Keys"],
        summary: "Revoke an API key",
        description: "Permanently deactivate an API key by ID",
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          properties: {
            id: { type: "string" },
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
                  id: { type: "string" },
                  name: { type: "string" },
                  revokedAt: { type: "string" },
                },
              },
            },
          },
          400: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              error: { type: "string" },
            },
          },
          401: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              error: { type: "string" },
            },
          },
          403: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              error: { type: "string" },
            },
          },
          404: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              error: { type: "string" },
            },
          },
        },
      },
      config: bearerAuthRateLimit,
      preHandler: verifyBearerAuth,
    },
    async (request, reply) => {
      const walletAddress = getAuthenticatedAddress(request);
      if (!walletAddress) {
        return reply.status(401).send({
          success: false,
          error: "Missing authenticated wallet",
        });
      }

      const params = request.params as { id: string };

      const result = await mutateState(
        API_KEYS_STORE_KEY,
        DEFAULT_API_KEYS_STATE,
        async (state) => {
          const keys = new Map(Object.entries(state.keys));
          const key = keys.get(params.id);
          if (!key) {
            return { kind: "not_found" as const };
          }

          if (key.walletAddress.toLowerCase() !== walletAddress) {
            return { kind: "forbidden" as const };
          }

          if (!key.isActive) {
            return { kind: "already_revoked" as const };
          }

          key.isActive = false;
          key.updatedAt = new Date().toISOString();
          keys.set(params.id, key);
          state.keys = Object.fromEntries(keys);
          return { kind: "success" as const, key };
        },
      );

      if (result.kind === "not_found") {
        return reply.status(404).send({
          success: false,
          error: "API key not found",
        });
      }

      if (result.kind === "forbidden") {
        return reply.status(403).send({
          success: false,
          error: "You can only revoke your own API keys",
        });
      }

      if (result.kind === "already_revoked") {
        return reply.status(400).send({
          success: false,
          error: "API key is already revoked",
        });
      }

      return {
        success: true,
        data: {
          id: params.id,
          name: result.key.name,
          revokedAt: new Date().toISOString(),
        },
      };
    },
  );

  // PUT /v1/api-keys/:id — Update sensor credential metadata
  fastify.put(
    "/:id",
    {
      schema: {
        tags: ["API Keys"],
        summary: "Update an API key",
        description: "Update a sensor credential name or description",
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          properties: {
            id: { type: "string" },
          },
        },
        body: {
          type: "object",
          properties: {
            name: { type: "string" },
            description: { type: "string" },
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
                  id: { type: "string" },
                  name: { type: "string" },
                  type: { type: "string" },
                  permissions: {
                    type: "array",
                    items: { type: "string" },
                  },
                  isActive: { type: "boolean" },
                  updatedAt: { type: "string" },
                },
              },
            },
          },
          401: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              error: { type: "string" },
            },
          },
          403: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              error: { type: "string" },
            },
          },
          404: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              error: { type: "string" },
            },
          },
        },
      },
      config: bearerAuthRateLimit,
      preHandler: verifyBearerAuth,
    },
    async (request, reply) => {
      const walletAddress = getAuthenticatedAddress(request);
      if (!walletAddress) {
        return reply.status(401).send({
          success: false,
          error: "Missing authenticated wallet",
        });
      }

      const params = request.params as { id: string };
      const body = UpdateApiKeySchema.parse(request.body);

      const result = await mutateState(
        API_KEYS_STORE_KEY,
        DEFAULT_API_KEYS_STATE,
        async (state) => {
          const keys = new Map(Object.entries(state.keys));
          const key = keys.get(params.id);
          if (!key) {
            return { kind: "not_found" as const };
          }

          if (key.walletAddress.toLowerCase() !== walletAddress) {
            return { kind: "forbidden" as const };
          }

          const nowIso = new Date().toISOString();

          if (body.name !== undefined) {
            key.name = body.name;
          }

          if (body.description !== undefined) {
            key.description = body.description;
          }

          key.updatedAt = nowIso;
          keys.set(params.id, key);
          state.keys = Object.fromEntries(keys);
          return { kind: "success" as const, key };
        },
      );

      if (result.kind === "not_found") {
        return reply.status(404).send({
          success: false,
          error: "API key not found",
        });
      }

      if (result.kind === "forbidden") {
        return reply.status(403).send({
          success: false,
          error: "You can only update your own API keys",
        });
      }

      return {
        success: true,
        data: {
          id: params.id,
          name: result.key.name,
          type: result.key.type,
          permissions: result.key.permissions,
          isActive: result.key.isActive,
          updatedAt: result.key.updatedAt,
        },
      };
    },
  );
}
