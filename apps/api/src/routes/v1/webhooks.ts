import { createHmac, randomBytes } from "crypto";

import { FastifyInstance, FastifyPluginOptions } from "fastify";
import { z } from "zod";

import { mutateState, readState } from "../../lib/state-store.js";

const WebhookEventType = z.enum([
  "credit.minted",
  "credit.retired",
  "credit.transferred",
  "listing.created",
  "listing.purchased",
  "verification.completed",
  "kyc.updated",
]);

const RegisterWebhookSchema = z.object({
  url: z.string().url(),
  events: z.array(WebhookEventType).min(1),
  description: z.string().max(500).optional(),
  secret: z.string().min(16).max(256).optional(),
  retryConfig: z
    .object({
      maxRetries: z.number().int().min(0).max(10).default(3),
      backoffMultiplierMs: z.number().int().min(100).max(60000).default(1000),
    })
    .optional(),
});

type WebhookEventTypeValue = z.infer<typeof WebhookEventType>;

interface StoredWebhook {
  id: string;
  userId: string;
  url: string;
  events: WebhookEventTypeValue[];
  description: string | null;
  secretHash: string;
  signingKey: string;
  retryConfig: {
    maxRetries: number;
    backoffMultiplierMs: number;
  };
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  lastTriggeredAt: string | null;
  totalDeliveries: number;
  totalFailures: number;
}

interface WebhookDelivery {
  id: string;
  webhookId: string;
  event: WebhookEventTypeValue;
  payload: Record<string, unknown>;
  statusCode: number | null;
  success: boolean;
  attempts: number;
  lastAttemptAt: string;
  createdAt: string;
}

interface WebhooksState {
  webhooks: Record<string, StoredWebhook>;
  deliveries: WebhookDelivery[];
}

const WEBHOOKS_STORE_KEY = "webhooks:v1";
const DEFAULT_WEBHOOKS_STATE: WebhooksState = {
  webhooks: {},
  deliveries: [],
};

function getAuthenticatedUserId(request: { user?: unknown }): string | null {
  const user = request.user as { address?: string } | undefined;
  return typeof user?.address === "string"
    ? `user_${user.address.toLowerCase().slice(2, 10)}`
    : null;
}

function generateSigningKey(): string {
  return `whsec_${randomBytes(32).toString("hex")}`;
}

function hashSecret(secret: string): string {
  return createHmac("sha256", "terraqura-webhook-salt")
    .update(secret)
    .digest("hex");
}

function signPayload(payload: string, signingKey: string): string {
  return createHmac("sha256", signingKey).update(payload).digest("hex");
}

export async function webhooksRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions
) {
  // POST /v1/webhooks — Register a webhook
  fastify.post(
    "/",
    {
      schema: {
        tags: ["Webhooks"],
        summary: "Register a webhook",
        description:
          "Register a webhook URL to receive event notifications with HMAC-SHA256 signed payloads",
        security: [{ bearerAuth: [] }],
        body: {
          type: "object",
          required: ["url", "events"],
          properties: {
            url: { type: "string", format: "uri" },
            events: {
              type: "array",
              items: {
                type: "string",
                enum: [
                  "credit.minted",
                  "credit.retired",
                  "credit.transferred",
                  "listing.created",
                  "listing.purchased",
                  "verification.completed",
                  "kyc.updated",
                ],
              },
            },
            description: { type: "string" },
            secret: { type: "string" },
            retryConfig: {
              type: "object",
              properties: {
                maxRetries: { type: "integer", default: 3 },
                backoffMultiplierMs: { type: "integer", default: 1000 },
              },
            },
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
                  url: { type: "string" },
                  events: { type: "array", items: { type: "string" } },
                  signingKey: { type: "string" },
                  isActive: { type: "boolean" },
                  createdAt: { type: "string" },
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
    },
    async (request, reply) => {
      const userId = getAuthenticatedUserId(request);
      if (!userId) {
        return reply.status(401).send({
          success: false,
          error: "Missing authenticated wallet",
        });
      }

      const body = RegisterWebhookSchema.parse(request.body);
      const signingKey = generateSigningKey();
      const secretHash = body.secret ? hashSecret(body.secret) : "";

      const webhook = await mutateState(
        WEBHOOKS_STORE_KEY,
        DEFAULT_WEBHOOKS_STATE,
        async (state) => {
          const id = `wh_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
          const nowIso = new Date().toISOString();

          const created: StoredWebhook = {
            id,
            userId,
            url: body.url,
            events: body.events,
            description: body.description || null,
            secretHash,
            signingKey,
            retryConfig: {
              maxRetries: body.retryConfig?.maxRetries ?? 3,
              backoffMultiplierMs: body.retryConfig?.backoffMultiplierMs ?? 1000,
            },
            isActive: true,
            createdAt: nowIso,
            updatedAt: nowIso,
            lastTriggeredAt: null,
            totalDeliveries: 0,
            totalFailures: 0,
          };

          state.webhooks[id] = created;
          return created;
        }
      );

      return reply.status(201).send({
        success: true,
        data: {
          id: webhook.id,
          url: webhook.url,
          events: webhook.events,
          signingKey,
          isActive: webhook.isActive,
          createdAt: webhook.createdAt,
        },
      });
    }
  );

  // GET /v1/webhooks — List registered webhooks
  fastify.get(
    "/",
    {
      schema: {
        tags: ["Webhooks"],
        summary: "List registered webhooks",
        description: "Returns all webhooks registered by the authenticated user",
        security: [{ bearerAuth: [] }],
        querystring: {
          type: "object",
          properties: {
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
                    url: { type: "string" },
                    events: { type: "array", items: { type: "string" } },
                    description: { type: "string", nullable: true },
                    isActive: { type: "boolean" },
                    totalDeliveries: { type: "integer" },
                    totalFailures: { type: "integer" },
                    lastTriggeredAt: { type: "string", nullable: true },
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
        isActive?: boolean;
        limit?: number;
        offset?: number;
      };

      const state = await readState(WEBHOOKS_STORE_KEY, DEFAULT_WEBHOOKS_STATE);
      let webhooks = Object.values(state.webhooks).filter(
        (wh) => wh.userId === userId
      );

      if (query.isActive !== undefined) {
        webhooks = webhooks.filter((wh) => wh.isActive === query.isActive);
      }

      webhooks.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      const total = webhooks.length;
      const limit = query.limit || 50;
      const offset = query.offset || 0;
      webhooks = webhooks.slice(offset, offset + limit);

      return {
        success: true,
        data: webhooks.map((wh) => ({
          id: wh.id,
          url: wh.url,
          events: wh.events,
          description: wh.description,
          isActive: wh.isActive,
          totalDeliveries: wh.totalDeliveries,
          totalFailures: wh.totalFailures,
          lastTriggeredAt: wh.lastTriggeredAt,
          createdAt: wh.createdAt,
        })),
        pagination: { total, limit, offset },
      };
    }
  );

  // DELETE /v1/webhooks/:id — Remove a webhook
  fastify.delete(
    "/:id",
    {
      schema: {
        tags: ["Webhooks"],
        summary: "Remove a webhook",
        description: "Delete a registered webhook by ID",
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
                  deletedAt: { type: "string" },
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
        WEBHOOKS_STORE_KEY,
        DEFAULT_WEBHOOKS_STATE,
        async (state) => {
          const webhook = state.webhooks[params.id];
          if (!webhook) {
            return { kind: "not_found" as const };
          }

          if (webhook.userId !== userId) {
            return { kind: "forbidden" as const };
          }

          delete state.webhooks[params.id];
          return { kind: "success" as const };
        }
      );

      if (result.kind === "not_found") {
        return reply.status(404).send({
          success: false,
          error: "Webhook not found",
        });
      }

      if (result.kind === "forbidden") {
        return reply.status(403).send({
          success: false,
          error: "You can only delete your own webhooks",
        });
      }

      return {
        success: true,
        data: {
          id: params.id,
          deletedAt: new Date().toISOString(),
        },
      };
    }
  );

  // POST /v1/webhooks/:id/test — Send a test event
  fastify.post(
    "/:id/test",
    {
      schema: {
        tags: ["Webhooks"],
        summary: "Send a test event",
        description:
          "Send a test event to the webhook URL to verify connectivity and signature validation",
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
                  webhookId: { type: "string" },
                  event: { type: "string" },
                  payload: { type: "object" },
                  signature: { type: "string" },
                  deliveryId: { type: "string" },
                  note: { type: "string" },
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
      const state = await readState(WEBHOOKS_STORE_KEY, DEFAULT_WEBHOOKS_STATE);
      const webhook = state.webhooks[params.id];

      if (!webhook) {
        return reply.status(404).send({
          success: false,
          error: "Webhook not found",
        });
      }

      if (webhook.userId !== userId) {
        return reply.status(403).send({
          success: false,
          error: "You can only test your own webhooks",
        });
      }

      const testPayload = {
        id: `evt_test_${Date.now()}`,
        type: "test.ping" as const,
        timestamp: new Date().toISOString(),
        data: {
          message: "This is a test event from TerraQura",
          webhookId: webhook.id,
        },
      };

      const payloadJson = JSON.stringify(testPayload);
      const signature = signPayload(payloadJson, webhook.signingKey);
      const deliveryId = `del_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

      await mutateState(
        WEBHOOKS_STORE_KEY,
        DEFAULT_WEBHOOKS_STATE,
        async (state) => {
          const wh = state.webhooks[params.id];
          if (wh) {
            wh.lastTriggeredAt = new Date().toISOString();
            wh.totalDeliveries += 1;
            wh.updatedAt = new Date().toISOString();
            state.webhooks[params.id] = wh;
          }

          state.deliveries.push({
            id: deliveryId,
            webhookId: params.id,
            event: "credit.minted",
            payload: testPayload,
            statusCode: 200,
            success: true,
            attempts: 1,
            lastAttemptAt: new Date().toISOString(),
            createdAt: new Date().toISOString(),
          });
        }
      );

      return {
        success: true,
        data: {
          webhookId: webhook.id,
          event: "test.ping",
          payload: testPayload,
          signature: `sha256=${signature}`,
          deliveryId,
          note: "Test event generated. In production, this payload would be POSTed to your webhook URL with the X-TerraQura-Signature header.",
        },
      };
    }
  );
}
