import { randomBytes, scryptSync } from "crypto";

import { FastifyInstance, FastifyPluginOptions } from "fastify";
import { z } from "zod";

import { bearerAuthRateLimit, verifyBearerAuth } from "../../lib/bearer-auth.js";
import { mutateState, readState } from "../../lib/state-store.js";

const ApiKeyType = z.enum(["sensor", "read-only", "full-access"]);

const CreateApiKeySchema = z.object({
  name: z.string().min(1).max(100),
  type: ApiKeyType,
  description: z.string().max(500).optional(),
  permissions: z
    .array(
      z.enum([
        "credits:read",
        "credits:write",
        "marketplace:read",
        "marketplace:write",
        "sensors:write",
        "verification:read",
        "analytics:read",
        "activity:read",
        "webhooks:manage",
      ])
    )
    .optional(),
  expiresInDays: z.number().int().min(1).max(365).optional(),
});

const UpdateApiKeySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  permissions: z
    .array(
      z.enum([
        "credits:read",
        "credits:write",
        "marketplace:read",
        "marketplace:write",
        "sensors:write",
        "verification:read",
        "analytics:read",
        "activity:read",
        "webhooks:manage",
      ])
    )
    .optional(),
  rateLimitOverride: z
    .object({
      maxRequests: z.number().int().min(1).max(100000),
      windowMs: z.number().int().min(1000).max(3600000),
    })
    .optional(),
  isActive: z.boolean().optional(),
});

type ApiKeyTypeValue = z.infer<typeof ApiKeyType>;

interface StoredApiKey {
  id: string;
  userId: string;
  name: string;
  type: ApiKeyTypeValue;
  description: string | null;
  keyHash: string;
  keySalt: string;
  keyPrefix: string;
  permissions: string[];
  rateLimit: {
    maxRequests: number;
    windowMs: number;
  };
  isActive: boolean;
  expiresAt: string | null;
  lastUsedAt: string | null;
  totalRequests: number;
  createdAt: string;
  updatedAt: string;
}

interface ApiKeysState {
  keys: Record<string, StoredApiKey>;
}

const API_KEYS_STORE_KEY = "api-keys:v1";
const DEFAULT_API_KEYS_STATE: ApiKeysState = {
  keys: {},
};

const DEFAULT_RATE_LIMITS: Record<
  ApiKeyTypeValue,
  { maxRequests: number; windowMs: number }
> = {
  sensor: { maxRequests: 10000, windowMs: 60000 },
  "read-only": { maxRequests: 1000, windowMs: 60000 },
  "full-access": { maxRequests: 5000, windowMs: 60000 },
};

const DEFAULT_PERMISSIONS: Record<ApiKeyTypeValue, string[]> = {
  sensor: ["sensors:write"],
  "read-only": [
    "credits:read",
    "marketplace:read",
    "verification:read",
    "analytics:read",
    "activity:read",
  ],
  "full-access": [
    "credits:read",
    "credits:write",
    "marketplace:read",
    "marketplace:write",
    "sensors:write",
    "verification:read",
    "analytics:read",
    "activity:read",
    "webhooks:manage",
  ],
};

function getAuthenticatedUserId(request: { user?: unknown }): string | null {
  const user = request.user as { address?: string } | undefined;
  return typeof user?.address === "string"
    ? `user_${user.address.toLowerCase().slice(2, 10)}`
    : null;
}

function generateApiKey(type: ApiKeyTypeValue): string {
  const prefixMap: Record<ApiKeyTypeValue, string> = {
    sensor: "tqs",
    "read-only": "tqr",
    "full-access": "tqf",
  };
  const prefix = prefixMap[type];
  return `${prefix}_${randomBytes(32).toString("hex")}`;
}

function hashApiKey(key: string, salt: string): string {
  return scryptSync(key, salt, 64).toString("hex");
}

function maskApiKey(prefix: string): string {
  return `${prefix}${"*".repeat(40)}`;
}

export async function apiKeysRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions
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
            type: {
              type: "string",
              enum: ["sensor", "read-only", "full-access"],
            },
            description: { type: "string" },
            permissions: {
              type: "array",
              items: {
                type: "string",
                enum: [
                  "credits:read",
                  "credits:write",
                  "marketplace:read",
                  "marketplace:write",
                  "sensors:write",
                  "verification:read",
                  "analytics:read",
                  "activity:read",
                  "webhooks:manage",
                ],
              },
            },
            expiresInDays: { type: "integer" },
          },
        },
        response: {
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
                  permissions: {
                    type: "array",
                    items: { type: "string" },
                  },
                  rateLimit: {
                    type: "object",
                    properties: {
                      maxRequests: { type: "integer" },
                      windowMs: { type: "integer" },
                    },
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
        },
      },
      config: bearerAuthRateLimit,
      preHandler: verifyBearerAuth,
    },
    async (request, reply) => {
      const userId = getAuthenticatedUserId(request);
      if (!userId) {
        return reply.status(401).send({
          success: false,
          error: "Missing authenticated wallet",
        });
      }

      const body = CreateApiKeySchema.parse(request.body);
      const rawKey = generateApiKey(body.type);
      const keySalt = randomBytes(16).toString("hex");
      const keyHash = hashApiKey(rawKey, keySalt);
      const keyPrefix = rawKey.slice(0, 8);

      const permissions = body.permissions || DEFAULT_PERMISSIONS[body.type];
      const rateLimit = DEFAULT_RATE_LIMITS[body.type];

      const apiKey = await mutateState(
        API_KEYS_STORE_KEY,
        DEFAULT_API_KEYS_STATE,
        async (state) => {
          const id = `key_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
          const nowIso = new Date().toISOString();

          const expiresAt = body.expiresInDays
            ? new Date(
                Date.now() + body.expiresInDays * 24 * 60 * 60 * 1000
              ).toISOString()
            : null;

          const created: StoredApiKey = {
            id,
            userId,
            name: body.name,
            type: body.type,
            description: body.description || null,
            keyHash,
            keySalt,
            keyPrefix,
            permissions,
            rateLimit,
            isActive: true,
            expiresAt,
            lastUsedAt: null,
            totalRequests: 0,
            createdAt: nowIso,
            updatedAt: nowIso,
          };

          state.keys[id] = created;
          return created;
        }
      );

      return reply.status(201).send({
        success: true,
        data: {
          id: apiKey.id,
          key: rawKey,
          name: apiKey.name,
          type: apiKey.type,
          permissions: apiKey.permissions,
          rateLimit: apiKey.rateLimit,
          expiresAt: apiKey.expiresAt,
          createdAt: apiKey.createdAt,
          warning:
            "Store this key securely. It will not be shown again.",
        },
      });
    }
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
              enum: ["sensor", "read-only", "full-access"],
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
                    maskedKey: { type: "string" },
                    permissions: {
                      type: "array",
                      items: { type: "string" },
                    },
                    rateLimit: {
                      type: "object",
                      properties: {
                        maxRequests: { type: "integer" },
                        windowMs: { type: "integer" },
                      },
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
      const userId = getAuthenticatedUserId(request);
      if (!userId) {
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
        (key) => key.userId === userId
      );

      if (query.type) {
        keys = keys.filter((key) => key.type === query.type);
      }

      if (query.isActive !== undefined) {
        keys = keys.filter((key) => key.isActive === query.isActive);
      }

      keys.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
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
          maskedKey: maskApiKey(key.keyPrefix),
          permissions: key.permissions,
          rateLimit: key.rateLimit,
          isActive: key.isActive,
          expiresAt: key.expiresAt,
          lastUsedAt: key.lastUsedAt,
          totalRequests: key.totalRequests,
          createdAt: key.createdAt,
        })),
        pagination: { total, limit, offset },
      };
    }
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
      const userId = getAuthenticatedUserId(request);
      if (!userId) {
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

          if (key.userId !== userId) {
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
        }
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
    }
  );

  // PUT /v1/api-keys/:id — Update key permissions/rate limits
  fastify.put(
    "/:id",
    {
      schema: {
        tags: ["API Keys"],
        summary: "Update an API key",
        description:
          "Update the name, description, permissions, or rate limits of an API key",
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
            permissions: {
              type: "array",
              items: {
                type: "string",
                enum: [
                  "credits:read",
                  "credits:write",
                  "marketplace:read",
                  "marketplace:write",
                  "sensors:write",
                  "verification:read",
                  "analytics:read",
                  "activity:read",
                  "webhooks:manage",
                ],
              },
            },
            rateLimitOverride: {
              type: "object",
              properties: {
                maxRequests: { type: "integer" },
                windowMs: { type: "integer" },
              },
            },
            isActive: { type: "boolean" },
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
                  rateLimit: {
                    type: "object",
                    properties: {
                      maxRequests: { type: "integer" },
                      windowMs: { type: "integer" },
                    },
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
      const userId = getAuthenticatedUserId(request);
      if (!userId) {
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

          if (key.userId !== userId) {
            return { kind: "forbidden" as const };
          }

          const nowIso = new Date().toISOString();

          if (body.name !== undefined) {
            key.name = body.name;
          }

          if (body.description !== undefined) {
            key.description = body.description;
          }

          if (body.permissions !== undefined) {
            key.permissions = body.permissions;
          }

          if (body.rateLimitOverride !== undefined) {
            key.rateLimit = body.rateLimitOverride;
          }

          if (body.isActive !== undefined) {
            key.isActive = body.isActive;
          }

          key.updatedAt = nowIso;
          keys.set(params.id, key);
          state.keys = Object.fromEntries(keys);
          return { kind: "success" as const, key };
        }
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
          rateLimit: result.key.rateLimit,
          isActive: result.key.isActive,
          updatedAt: result.key.updatedAt,
        },
      };
    }
  );
}
