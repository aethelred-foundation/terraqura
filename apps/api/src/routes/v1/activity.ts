import { FastifyInstance, FastifyPluginOptions } from "fastify";
import { z } from "zod";

import { bearerAuthRateLimit, verifyBearerAuth } from "../../lib/bearer-auth.js";
import { readState } from "../../lib/state-store.js";

const ActivityActionType = z.enum([
  "credit.minted",
  "credit.retired",
  "credit.transferred",
  "listing.created",
  "listing.cancelled",
  "listing.purchased",
  "offer.created",
  "offer.accepted",
  "offer.cancelled",
  "verification.started",
  "verification.completed",
  "verification.failed",
  "kyc.submitted",
  "kyc.approved",
  "kyc.rejected",
  "webhook.registered",
  "webhook.deleted",
  "api_key.created",
  "api_key.revoked",
  "sensor.reading_submitted",
  "dac_unit.registered",
  "dac_unit.updated",
]);

const ResourceType = z.enum([
  "credit",
  "listing",
  "offer",
  "verification",
  "kyc",
  "webhook",
  "api_key",
  "sensor",
  "dac_unit",
]);

type ActivityActionValue = z.infer<typeof ActivityActionType>;
type ResourceTypeValue = z.infer<typeof ResourceType>;

interface StoredActivityEntry {
  id: string;
  actor: string;
  actorWallet: string | null;
  action: ActivityActionValue;
  resourceType: ResourceTypeValue;
  resourceId: string;
  metadata: Record<string, unknown>;
  timestamp: string;
  ipAddress: string | null;
}

interface ActivityState {
  entries: StoredActivityEntry[];
}

const ACTIVITY_STORE_KEY = "activity:v1";
const DEFAULT_ACTIVITY_STATE: ActivityState = {
  entries: [],
};

function getAuthenticatedUserId(request: { user?: unknown }): string | null {
  const user = request.user as { address?: string } | undefined;
  return typeof user?.address === "string"
    ? `user_${user.address.toLowerCase().slice(2, 10)}`
    : null;
}

function escapeCSVField(field: string): string {
  if (field.includes(",") || field.includes('"') || field.includes("\n")) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}

function entriesToCSV(entries: StoredActivityEntry[]): string {
  const headers = [
    "id",
    "actor",
    "actorWallet",
    "action",
    "resourceType",
    "resourceId",
    "metadata",
    "timestamp",
  ];
  const rows = entries.map((entry) =>
    [
      escapeCSVField(entry.id),
      escapeCSVField(entry.actor),
      escapeCSVField(entry.actorWallet || ""),
      escapeCSVField(entry.action),
      escapeCSVField(entry.resourceType),
      escapeCSVField(entry.resourceId),
      escapeCSVField(JSON.stringify(entry.metadata)),
      escapeCSVField(entry.timestamp),
    ].join(",")
  );

  return [headers.join(","), ...rows].join("\n");
}

export async function activityRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions
) {
  // GET /v1/activity — Paginated activity feed with filters
  fastify.get(
    "/",
    {
      schema: {
        tags: ["Activity"],
        summary: "Get activity feed",
        description:
          "Returns a paginated, filterable audit log of all state mutations in the platform",
        security: [{ bearerAuth: [] }],
        querystring: {
          type: "object",
          properties: {
            actor: { type: "string" },
            action: {
              type: "string",
              enum: [
                "credit.minted",
                "credit.retired",
                "credit.transferred",
                "listing.created",
                "listing.cancelled",
                "listing.purchased",
                "offer.created",
                "offer.accepted",
                "offer.cancelled",
                "verification.started",
                "verification.completed",
                "verification.failed",
                "kyc.submitted",
                "kyc.approved",
                "kyc.rejected",
                "webhook.registered",
                "webhook.deleted",
                "api_key.created",
                "api_key.revoked",
                "sensor.reading_submitted",
                "dac_unit.registered",
                "dac_unit.updated",
              ],
            },
            resourceType: {
              type: "string",
              enum: [
                "credit",
                "listing",
                "offer",
                "verification",
                "kyc",
                "webhook",
                "api_key",
                "sensor",
                "dac_unit",
              ],
            },
            resourceId: { type: "string" },
            startDate: { type: "string", format: "date-time" },
            endDate: { type: "string", format: "date-time" },
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
                    actor: { type: "string" },
                    actorWallet: { type: "string", nullable: true },
                    action: { type: "string" },
                    resourceType: { type: "string" },
                    resourceId: { type: "string" },
                    metadata: { type: "object" },
                    timestamp: { type: "string" },
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
        actor?: string;
        action?: string;
        resourceType?: string;
        resourceId?: string;
        startDate?: string;
        endDate?: string;
        limit?: number;
        offset?: number;
      };

      const state = await readState(ACTIVITY_STORE_KEY, DEFAULT_ACTIVITY_STATE);
      let entries = [...state.entries];

      if (query.actor) {
        entries = entries.filter((entry) => entry.actor === query.actor);
      }

      if (query.action) {
        entries = entries.filter((entry) => entry.action === query.action);
      }

      if (query.resourceType) {
        entries = entries.filter(
          (entry) => entry.resourceType === query.resourceType
        );
      }

      if (query.resourceId) {
        entries = entries.filter(
          (entry) => entry.resourceId === query.resourceId
        );
      }

      if (query.startDate) {
        const startTime = new Date(query.startDate).getTime();
        entries = entries.filter(
          (entry) => new Date(entry.timestamp).getTime() >= startTime
        );
      }

      if (query.endDate) {
        const endTime = new Date(query.endDate).getTime();
        entries = entries.filter(
          (entry) => new Date(entry.timestamp).getTime() <= endTime
        );
      }

      // Sort by timestamp descending (newest first) — append-only log
      entries.sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );

      const total = entries.length;
      const limit = query.limit || 50;
      const offset = query.offset || 0;
      entries = entries.slice(offset, offset + limit);

      return {
        success: true,
        data: entries.map((entry) => ({
          id: entry.id,
          actor: entry.actor,
          actorWallet: entry.actorWallet,
          action: entry.action,
          resourceType: entry.resourceType,
          resourceId: entry.resourceId,
          metadata: entry.metadata,
          timestamp: entry.timestamp,
        })),
        pagination: { total, limit, offset },
      };
    }
  );

  // GET /v1/activity/export — CSV/JSON export
  fastify.get(
    "/export",
    {
      schema: {
        tags: ["Activity"],
        summary: "Export activity log",
        description:
          "Export the activity log in CSV or JSON format with the same filter options as the activity feed",
        security: [{ bearerAuth: [] }],
        querystring: {
          type: "object",
          properties: {
            format: { type: "string", enum: ["csv", "json"], default: "json" },
            actor: { type: "string" },
            action: { type: "string" },
            resourceType: { type: "string" },
            resourceId: { type: "string" },
            startDate: { type: "string", format: "date-time" },
            endDate: { type: "string", format: "date-time" },
            limit: { type: "integer", default: 1000 },
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
        format?: string;
        actor?: string;
        action?: string;
        resourceType?: string;
        resourceId?: string;
        startDate?: string;
        endDate?: string;
        limit?: number;
      };

      const state = await readState(ACTIVITY_STORE_KEY, DEFAULT_ACTIVITY_STATE);
      let entries = [...state.entries];

      if (query.actor) {
        entries = entries.filter((entry) => entry.actor === query.actor);
      }

      if (query.action) {
        entries = entries.filter((entry) => entry.action === query.action);
      }

      if (query.resourceType) {
        entries = entries.filter(
          (entry) => entry.resourceType === query.resourceType
        );
      }

      if (query.resourceId) {
        entries = entries.filter(
          (entry) => entry.resourceId === query.resourceId
        );
      }

      if (query.startDate) {
        const startTime = new Date(query.startDate).getTime();
        entries = entries.filter(
          (entry) => new Date(entry.timestamp).getTime() >= startTime
        );
      }

      if (query.endDate) {
        const endTime = new Date(query.endDate).getTime();
        entries = entries.filter(
          (entry) => new Date(entry.timestamp).getTime() <= endTime
        );
      }

      entries.sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );

      const limit = query.limit || 1000;
      entries = entries.slice(0, limit);

      const exportFormat = query.format || "json";

      if (exportFormat === "csv") {
        const csv = entriesToCSV(entries);
        return reply
          .header("Content-Type", "text/csv; charset=utf-8")
          .header(
            "Content-Disposition",
            `attachment; filename="terraqura-activity-${new Date().toISOString().slice(0, 10)}.csv"`
          )
          .send(csv);
      }

      return {
        success: true,
        data: entries,
        exportedAt: new Date().toISOString(),
        totalExported: entries.length,
      };
    }
  );
}
