import { randomBytes } from "crypto";

import { DACStatus } from "@terraqura/types";
import { FastifyInstance, FastifyPluginOptions } from "fastify";
import { z } from "zod";

import { mutateState, readState } from "../../lib/state-store.js";

const CreateDACUnitSchema = z.object({
  name: z.string().min(1).max(255),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  countryCode: z.string().length(2),
  region: z.string().optional(),
  capacityTonnesPerYear: z.number().positive().optional(),
  technologyType: z.string().optional(),
});

function getAuthenticatedAddress(
  request: { user?: unknown }
): string | null {
  const user = request.user as { address?: string } | undefined;
  return typeof user?.address === "string" ? user.address.toLowerCase() : null;
}

function isAdmin(request: { user?: unknown }): boolean {
  const user = request.user as { userType?: string } | undefined;
  return user?.userType === "admin";
}

interface StoredDacUnit {
  id: string;
  unitId: string;
  operatorId: string;
  operatorWallet: string;
  name: string;
  latitude: number;
  longitude: number;
  countryCode: string;
  status: DACStatus;
  capacityTonnesPerYear: number;
  technologyType: string;
  createdAt: string;
  whitelistedAt: string | null;
  whitelistTxHash: string | null;
}

interface DacUnitsState {
  units: Record<string, StoredDacUnit>;
}

const DAC_UNITS_STORE_KEY = "dac-units:v1";
const DEFAULT_DAC_UNITS_STATE: DacUnitsState = {
  units: {},
};

function generateTxHash(): string {
  return `0x${randomBytes(32).toString("hex")}`;
}

export async function dacUnitsRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions
) {
  /**
   * List all DAC units
   */
  fastify.get(
    "/",
    {
      schema: {
        tags: ["DAC Units"],
        summary: "List all DAC units",
        description: "Returns a list of all registered DAC facilities",
        querystring: {
          type: "object",
          properties: {
            status: {
              type: "string",
              enum: ["pending", "active", "suspended", "decommissioned"],
            },
            operatorId: { type: "string" },
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
                    status: { type: "string" },
                    latitude: { type: "number" },
                    longitude: { type: "number" },
                    countryCode: { type: "string" },
                    capacityTonnesPerYear: { type: "number" },
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
        },
      },
    },
    async (request, _reply) => {
      const query = request.query as {
        status?: string;
        operatorId?: string;
        limit?: number;
        offset?: number;
      };

      const state = await readState(DAC_UNITS_STORE_KEY, DEFAULT_DAC_UNITS_STATE);
      let units = Object.values(state.units);

      // Filter by status
      if (query.status) {
        units = units.filter((u) => u.status === query.status);
      }

      // Filter by operator
      if (query.operatorId) {
        units = units.filter((u) => u.operatorId === query.operatorId);
      }

      const total = units.length;
      const limit = query.limit || 50;
      const offset = query.offset || 0;

      // Paginate
      units = units.slice(offset, offset + limit);

      return {
        success: true,
        data: units.map((u) => ({
          id: u.id,
          name: u.name,
          status: u.status,
          latitude: u.latitude,
          longitude: u.longitude,
          countryCode: u.countryCode,
          capacityTonnesPerYear: u.capacityTonnesPerYear,
        })),
        pagination: {
          total,
          limit,
          offset,
        },
      };
    }
  );

  /**
   * Register a new DAC unit
   */
  fastify.post(
    "/",
    {
      schema: {
        tags: ["DAC Units"],
        summary: "Register a new DAC unit",
        description: "Registers a new Direct Air Capture facility",
        security: [{ bearerAuth: [] }],
        body: {
          type: "object",
          required: ["name", "latitude", "longitude", "countryCode"],
          properties: {
            name: { type: "string" },
            latitude: { type: "number" },
            longitude: { type: "number" },
            countryCode: { type: "string" },
            region: { type: "string" },
            capacityTonnesPerYear: { type: "number" },
            technologyType: { type: "string" },
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
                  unitId: { type: "string" },
                  status: { type: "string" },
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
      const body = CreateDACUnitSchema.parse(request.body);
      const operatorWallet = getAuthenticatedAddress(request);

      if (!operatorWallet) {
        return reply.status(401).send({
          success: false,
          error: "Missing authenticated operator wallet",
        });
      }

      const dacUnit = await mutateState(
        DAC_UNITS_STORE_KEY,
        DEFAULT_DAC_UNITS_STATE,
        async (state) => {
          const id = `dac_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
          const unitId = `0x${Buffer.from(id).toString("hex").padEnd(64, "0")}`;
          const createdAt = new Date().toISOString();

          const createdUnit: StoredDacUnit = {
            id,
            unitId,
            operatorId: `operator_${operatorWallet.slice(2, 10)}`,
            operatorWallet,
            name: body.name,
            latitude: body.latitude,
            longitude: body.longitude,
            countryCode: body.countryCode,
            status: DACStatus.PENDING,
            capacityTonnesPerYear: body.capacityTonnesPerYear || 0,
            technologyType: body.technologyType || "DAC",
            createdAt,
            whitelistedAt: null,
            whitelistTxHash: null,
          };

          state.units[id] = createdUnit;
          return createdUnit;
        }
      );

      return reply.status(201).send({
        success: true,
        data: {
          id: dacUnit.id,
          unitId: dacUnit.unitId,
          status: dacUnit.status,
        },
      });
    }
  );

  /**
   * Get DAC unit details
   */
  fastify.get(
    "/:id",
    {
      schema: {
        tags: ["DAC Units"],
        summary: "Get DAC unit details",
        description: "Returns detailed information about a specific DAC facility",
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
                  unitId: { type: "string" },
                  name: { type: "string" },
                  status: { type: "string" },
                  latitude: { type: "number" },
                  longitude: { type: "number" },
                  countryCode: { type: "string" },
                  capacityTonnesPerYear: { type: "number" },
                  technologyType: { type: "string" },
                  createdAt: { type: "string" },
                },
              },
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
      const params = request.params as { id: string };
      const state = await readState(DAC_UNITS_STORE_KEY, DEFAULT_DAC_UNITS_STATE);
      const dacUnit = state.units[params.id];

      if (!dacUnit) {
        return reply.status(404).send({
          success: false,
          error: "DAC unit not found",
        });
      }

      return {
        success: true,
        data: {
          ...dacUnit,
        },
      };
    }
  );

  /**
   * Whitelist a DAC unit (Admin only)
   */
  fastify.post(
    "/:id/whitelist",
    {
      schema: {
        tags: ["DAC Units"],
        summary: "Whitelist a DAC unit",
        description: "Approves a DAC facility for carbon credit minting (Admin only)",
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
                  status: { type: "string" },
                  whitelistedAt: { type: "string" },
                  txHash: { type: "string" },
                },
              },
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
      if (!isAdmin(request)) {
        return reply.status(403).send({
          success: false,
          error: "Admin role required",
        });
      }

      const params = request.params as { id: string };
      const whitelistedUnit = await mutateState(
        DAC_UNITS_STORE_KEY,
        DEFAULT_DAC_UNITS_STATE,
        async (state) => {
          const existing = state.units[params.id];
          if (!existing) {
            return null;
          }

          const whitelistedAt = new Date().toISOString();
          const txHash = generateTxHash();
          const updated: StoredDacUnit = {
            ...existing,
            status: DACStatus.ACTIVE,
            whitelistedAt,
            whitelistTxHash: txHash,
          };

          state.units[params.id] = updated;
          return updated;
        }
      );

      if (!whitelistedUnit) {
        return reply.status(404).send({
          success: false,
          error: "DAC unit not found",
        });
      }

      return {
        success: true,
        data: {
          id: whitelistedUnit.id,
          status: whitelistedUnit.status,
          whitelistedAt: whitelistedUnit.whitelistedAt,
          txHash: whitelistedUnit.whitelistTxHash,
        },
      };
    }
  );
}
