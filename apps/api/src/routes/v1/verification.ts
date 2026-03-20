import { createHash } from "crypto";

import { VerificationStatus, calculateEfficiencyFactor } from "@terraqura/types";
import { FastifyInstance, FastifyPluginOptions } from "fastify";
import { z } from "zod";

import { mutateState, readState } from "../../lib/state-store.js";

const VerificationRequestSchema = z.object({
  dacUnitId: z.string().min(1),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
});

interface StoredVerification {
  id: string;
  dacUnitId: string;
  startTime: string;
  endTime: string;
  requestedAt: string;
  completedAt: string | null;
  status: VerificationStatus;
  sourceCheck: { status: VerificationStatus; completedAt: string | null };
  logicCheck: {
    status: VerificationStatus;
    completedAt: string | null;
    kwhPerTonne?: number;
    efficiencyFactor?: number;
  };
  mintCheck: { status: VerificationStatus; completedAt: string | null };
  sourceDataHash: string;
  efficiencyFactor: number | null;
  creditsToMint: number | null;
  readingCount: number;
  totalCo2CapturedKg: number;
  totalEnergyKwh: number;
  avgPurity: number | null;
}

interface VerificationsState {
  verifications: Record<string, StoredVerification>;
}

interface SensorsState {
  readings: Array<{
    time: string;
    dacUnitId: string;
    co2CaptureRateKgHour: number;
    energyConsumptionKwh: number;
    co2PurityPercentage: number;
  }>;
}

const VERIFICATIONS_STORE_KEY = "verification:v1";
const DEFAULT_VERIFICATIONS_STATE: VerificationsState = {
  verifications: {},
};
const SENSORS_STORE_KEY = "sensors:v1";
const DEFAULT_SENSORS_STATE: SensorsState = {
  readings: [],
};

function buildVerificationHash(dacUnitId: string, startTime: string, endTime: string): string {
  return `0x${createHash("sha256").update(`${dacUnitId}:${startTime}:${endTime}`).digest("hex")}`;
}

function computeVerificationResult(input: {
  dacUnitId: string;
  startTime: string;
  endTime: string;
  readings: SensorsState["readings"];
  existingSourceHashes: Set<string>;
}): Omit<
  StoredVerification,
  "id" | "requestedAt" | "completedAt" | "status" | "sourceCheck" | "logicCheck" | "mintCheck"
> & {
  status: VerificationStatus;
  sourceCheck: { status: VerificationStatus; completedAt: string | null };
  logicCheck: {
    status: VerificationStatus;
    completedAt: string | null;
    kwhPerTonne?: number;
    efficiencyFactor?: number;
  };
  mintCheck: { status: VerificationStatus; completedAt: string | null };
} {
  const start = new Date(input.startTime);
  const end = new Date(input.endTime);
  const sourceDataHash = buildVerificationHash(input.dacUnitId, input.startTime, input.endTime);
  const nowIso = new Date().toISOString();

  const scopedReadings = input.readings.filter((reading) => {
    if (reading.dacUnitId !== input.dacUnitId) {
      return false;
    }
    const readingTime = new Date(reading.time);
    return readingTime >= start && readingTime <= end;
  });

  const sourcePassed = scopedReadings.length > 0;
  if (!sourcePassed) {
    return {
      dacUnitId: input.dacUnitId,
      startTime: input.startTime,
      endTime: input.endTime,
      sourceDataHash,
      efficiencyFactor: null,
      creditsToMint: null,
      readingCount: 0,
      totalCo2CapturedKg: 0,
      totalEnergyKwh: 0,
      avgPurity: null,
      status: VerificationStatus.FAILED,
      sourceCheck: { status: VerificationStatus.FAILED, completedAt: nowIso },
      logicCheck: { status: VerificationStatus.PENDING, completedAt: null },
      mintCheck: { status: VerificationStatus.PENDING, completedAt: null },
    };
  }

  const totalCo2CapturedKg = scopedReadings.reduce(
    (sum, reading) => sum + reading.co2CaptureRateKgHour,
    0
  );
  const totalEnergyKwh = scopedReadings.reduce(
    (sum, reading) => sum + reading.energyConsumptionKwh,
    0
  );
  const avgPurity =
    scopedReadings.reduce((sum, reading) => sum + reading.co2PurityPercentage, 0) /
    scopedReadings.length;

  const co2Tonnes = totalCo2CapturedKg / 1000;
  const kwhPerTonne = co2Tonnes > 0 ? totalEnergyKwh / co2Tonnes : 0;
  const logicResult = calculateEfficiencyFactor(kwhPerTonne, avgPurity);
  const logicPassed = logicResult.isValid;
  const mintPassed = logicPassed && !input.existingSourceHashes.has(sourceDataHash);

  const finalStatus =
    sourcePassed && logicPassed && mintPassed ? VerificationStatus.PASSED : VerificationStatus.FAILED;
  const creditsToMint = logicPassed
    ? Math.max(0, Math.floor((totalCo2CapturedKg * logicResult.factor) / 10000))
    : null;

  return {
    dacUnitId: input.dacUnitId,
    startTime: input.startTime,
    endTime: input.endTime,
    sourceDataHash,
    efficiencyFactor: logicPassed ? logicResult.factor : null,
    creditsToMint,
    readingCount: scopedReadings.length,
    totalCo2CapturedKg,
    totalEnergyKwh,
    avgPurity,
    status: finalStatus,
    sourceCheck: {
      status: VerificationStatus.PASSED,
      completedAt: nowIso,
    },
    logicCheck: {
      status: logicPassed ? VerificationStatus.PASSED : VerificationStatus.FAILED,
      completedAt: nowIso,
      kwhPerTonne,
      efficiencyFactor: logicResult.factor,
    },
    mintCheck: {
      status: mintPassed ? VerificationStatus.PASSED : VerificationStatus.FAILED,
      completedAt: nowIso,
    },
  };
}

export async function verificationRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions
) {
  fastify.post(
    "/initiate",
    {
      schema: {
        tags: ["Verification"],
        summary: "Initiate verification",
        description: "Start the Proof-of-Physics verification process for a capture period",
        security: [{ bearerAuth: [] }],
        body: {
          type: "object",
          required: ["dacUnitId", "startTime", "endTime"],
          properties: {
            dacUnitId: { type: "string" },
            startTime: { type: "string", format: "date-time" },
            endTime: { type: "string", format: "date-time" },
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
                  verificationId: { type: "string" },
                  status: { type: "string" },
                  estimatedCompletion: { type: "string" },
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
        },
      },
    },
    async (request, reply) => {
      const body = VerificationRequestSchema.parse(request.body);
      if (new Date(body.endTime) <= new Date(body.startTime)) {
        return reply.status(400).send({
          success: false,
          error: "endTime must be after startTime",
        });
      }

      const sensorsState = await readState(SENSORS_STORE_KEY, DEFAULT_SENSORS_STATE);
      const verification = await mutateState(
        VERIFICATIONS_STORE_KEY,
        DEFAULT_VERIFICATIONS_STATE,
        async (state) => {
          const existingSourceHashes = new Set(
            Object.values(state.verifications)
              .filter((entry) => entry.status === VerificationStatus.PASSED)
              .map((entry) => entry.sourceDataHash)
          );

          const id = `ver_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
          const requestedAt = new Date().toISOString();
          const result = computeVerificationResult({
            dacUnitId: body.dacUnitId,
            startTime: body.startTime,
            endTime: body.endTime,
            readings: sensorsState.readings,
            existingSourceHashes,
          });

          const stored: StoredVerification = {
            id,
            requestedAt,
            completedAt: new Date().toISOString(),
            ...result,
          };

          state.verifications[id] = stored;
          return stored;
        }
      );

      return reply.status(201).send({
        success: true,
        data: {
          verificationId: verification.id,
          status: verification.status,
          estimatedCompletion: verification.completedAt || new Date().toISOString(),
        },
      });
    }
  );

  fastify.get(
    "/:id",
    {
      schema: {
        tags: ["Verification"],
        summary: "Get verification status",
        description: "Returns the current status of a verification request",
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
                  progress: {
                    type: "object",
                    properties: {
                      sourceCheck: { type: "string" },
                      logicCheck: { type: "string" },
                      mintCheck: { type: "string" },
                    },
                  },
                  requestedAt: { type: "string" },
                  completedAt: { type: "string", nullable: true },
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
      const state = await readState(VERIFICATIONS_STORE_KEY, DEFAULT_VERIFICATIONS_STATE);
      const verification = state.verifications[params.id];

      if (!verification) {
        return reply.status(404).send({
          success: false,
          error: "Verification not found",
        });
      }

      return {
        success: true,
        data: {
          id: verification.id,
          status: verification.status,
          progress: {
            sourceCheck: verification.sourceCheck.status,
            logicCheck: verification.logicCheck.status,
            mintCheck: verification.mintCheck.status,
          },
          requestedAt: verification.requestedAt,
          completedAt: verification.completedAt,
        },
      };
    }
  );

  fastify.get(
    "/:id/result",
    {
      schema: {
        tags: ["Verification"],
        summary: "Get verification result",
        description: "Returns detailed results of a completed verification",
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
                  dacUnitId: { type: "string" },
                  status: { type: "string" },
                  sourceCheck: {
                    type: "object",
                    properties: {
                      status: { type: "string" },
                      message: { type: "string" },
                    },
                  },
                  logicCheck: {
                    type: "object",
                    properties: {
                      status: { type: "string" },
                      kwhPerTonne: { type: "number" },
                      efficiencyFactor: { type: "number" },
                      message: { type: "string" },
                    },
                  },
                  mintCheck: {
                    type: "object",
                    properties: {
                      status: { type: "string" },
                      message: { type: "string" },
                    },
                  },
                  sourceDataHash: { type: "string" },
                  creditsToMint: { type: "number", nullable: true },
                  readingCount: { type: "integer" },
                  totalCo2CapturedKg: { type: "number" },
                  totalEnergyKwh: { type: "number" },
                  avgPurity: { type: "number", nullable: true },
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
      const state = await readState(VERIFICATIONS_STORE_KEY, DEFAULT_VERIFICATIONS_STATE);
      const verification = state.verifications[params.id];

      if (!verification) {
        return reply.status(404).send({
          success: false,
          error: "Verification not found",
        });
      }

      return {
        success: true,
        data: {
          id: verification.id,
          dacUnitId: verification.dacUnitId,
          status: verification.status,
          sourceCheck: {
            status: verification.sourceCheck.status,
            message:
              verification.sourceCheck.status === VerificationStatus.PASSED
                ? "Source dataset integrity verified"
                : "No eligible sensor readings for the requested period",
          },
          logicCheck: {
            status: verification.logicCheck.status,
            kwhPerTonne: verification.logicCheck.kwhPerTonne || 0,
            efficiencyFactor: verification.logicCheck.efficiencyFactor || 0,
            message:
              verification.logicCheck.status === VerificationStatus.PASSED
                ? "Physics constraints verified"
                : "Energy/purity constraints failed",
          },
          mintCheck: {
            status: verification.mintCheck.status,
            message:
              verification.mintCheck.status === VerificationStatus.PASSED
                ? "No duplicate source hash detected"
                : "Duplicate source hash or prior phase failure",
          },
          sourceDataHash: verification.sourceDataHash,
          creditsToMint: verification.creditsToMint,
          readingCount: verification.readingCount,
          totalCo2CapturedKg: verification.totalCo2CapturedKg,
          totalEnergyKwh: verification.totalEnergyKwh,
          avgPurity: verification.avgPurity,
        },
      };
    }
  );
}
