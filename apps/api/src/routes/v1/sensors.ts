import { createHash } from "node:crypto";

import { AnomalyReason } from "@terraqura/types";
import { FastifyInstance, FastifyPluginOptions, FastifyRequest } from "fastify";
import { z } from "zod";

import { authenticateSensorApiKey } from "../../lib/api-key-store.js";
import {
  insertSensorReadings,
  summarizeSensorReadings,
  type SensorEvidenceReading,
} from "../../lib/sensor-reading-store.js";

const SensorReadingSchema = z.object({
  sensorId: z.string().min(1),
  timestamp: z.string().datetime().optional(),
  co2CaptureRateKgHour: z.number().min(0),
  energyConsumptionKwh: z.number().min(0),
  co2PurityPercentage: z.number().min(0).max(100).optional(),
  ambientTemperatureC: z.number().optional(),
  ambientHumidityPercent: z.number().min(0).max(100).optional(),
  atmosphericCo2Ppm: z.number().min(0).optional(),
  measurementDurationSeconds: z.number().positive().max(86400).default(3600),
  rawData: z.record(z.unknown()).optional(),
});

// Verification constants (matching smart contract)
const MIN_KWH_PER_TONNE = 200;
const MAX_KWH_PER_TONNE = 600;
const MIN_PURITY_PERCENTAGE = 90;

async function resolveSensorApiKey(
  headers: FastifyRequest["headers"],
): Promise<{ dacUnitId: string } | null> {
  const headerValue = headers["x-sensor-api-key"];
  const keyCandidate = Array.isArray(headerValue)
    ? headerValue[0]
    : headerValue;

  if (typeof keyCandidate !== "string") {
    return null;
  }

  const apiKey = keyCandidate.trim();
  if (!apiKey) {
    return null;
  }

  const identity = await authenticateSensorApiKey(apiKey);
  return identity ? { dacUnitId: identity.dacUnitId } : null;
}

/**
 * Detect anomalies in sensor reading
 */
function detectAnomaly(reading: {
  co2CaptureRateKgHour: number;
  energyConsumptionKwh: number;
  co2PurityPercentage?: number;
  measurementDurationSeconds: number;
}): { isAnomaly: boolean; reason: AnomalyReason | null } {
  const co2Kg =
    reading.co2CaptureRateKgHour * (reading.measurementDurationSeconds / 3600);
  const co2Tonnes = co2Kg / 1000;

  if (co2Tonnes > 0) {
    const kwhPerTonne = reading.energyConsumptionKwh / co2Tonnes;

    // Too efficient - potential fraud
    if (kwhPerTonne < MIN_KWH_PER_TONNE) {
      return { isAnomaly: true, reason: AnomalyReason.SUSPICIOUS_EFFICIENCY };
    }

    // Too inefficient
    if (kwhPerTonne > MAX_KWH_PER_TONNE) {
      return { isAnomaly: true, reason: AnomalyReason.EXCESSIVE_ENERGY };
    }
  }

  // Low purity
  if (
    reading.co2PurityPercentage !== undefined &&
    reading.co2PurityPercentage < MIN_PURITY_PERCENTAGE
  ) {
    return { isAnomaly: true, reason: AnomalyReason.LOW_PURITY };
  }

  return { isAnomaly: false, reason: null };
}

/**
 * Generate SHA-256 hash of sensor data
 */
function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, canonicalize(nested)]),
    );
  }
  return value;
}

function hashSensorData(data: Record<string, unknown>): string {
  const jsonString = JSON.stringify(canonicalize(data));
  // This is a content-integrity digest. API credentials are authenticated
  // with scrypt in api-key-store.ts; no credential is hashed here.
  // codeql[js/insufficient-password-hash]
  return createHash("sha256").update(jsonString).digest("hex");
}

export async function sensorsRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions,
) {
  /**
   * Submit a sensor reading
   */
  fastify.post(
    "/readings",
    {
      schema: {
        tags: ["Sensors"],
        summary: "Submit sensor reading",
        description: "Submit a single sensor reading from a whitelisted sensor",
        security: [{ apiKeyAuth: [] }],
        body: {
          type: "object",
          required: [
            "sensorId",
            "co2CaptureRateKgHour",
            "energyConsumptionKwh",
          ],
          properties: {
            sensorId: { type: "string" },
            timestamp: { type: "string", format: "date-time" },
            co2CaptureRateKgHour: { type: "number" },
            energyConsumptionKwh: { type: "number" },
            co2PurityPercentage: { type: "number" },
            ambientTemperatureC: { type: "number" },
            ambientHumidityPercent: { type: "number" },
            atmosphericCo2Ppm: { type: "number" },
            measurementDurationSeconds: {
              type: "number",
              minimum: 1,
              maximum: 86400,
              default: 3600,
            },
            rawData: { type: "object" },
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
                  dataHash: { type: "string" },
                  isAnomaly: { type: "boolean" },
                  anomalyReason: { type: "string", nullable: true },
                  timestamp: { type: "string" },
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
          409: {
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
      const sensorIdentity = await resolveSensorApiKey(request.headers);
      if (!sensorIdentity) {
        return reply.status(401).send({
          success: false,
          error: "Invalid sensor API key",
        });
      }

      const body = SensorReadingSchema.parse(request.body);
      const timestamp = body.timestamp ? new Date(body.timestamp) : new Date();

      // Generate data hash
      const dataHash = hashSensorData({
        dacUnitId: sensorIdentity.dacUnitId,
        sensorId: body.sensorId,
        timestamp: timestamp.toISOString(),
        co2CaptureRateKgHour: body.co2CaptureRateKgHour,
        energyConsumptionKwh: body.energyConsumptionKwh,
        co2PurityPercentage: body.co2PurityPercentage,
        ambientTemperatureC: body.ambientTemperatureC,
        ambientHumidityPercent: body.ambientHumidityPercent,
        atmosphericCo2Ppm: body.atmosphericCo2Ppm,
        measurementDurationSeconds: body.measurementDurationSeconds,
        rawData: body.rawData,
      });

      // Detect anomalies
      const { isAnomaly, reason } = detectAnomaly({
        co2CaptureRateKgHour: body.co2CaptureRateKgHour,
        energyConsumptionKwh: body.energyConsumptionKwh,
        co2PurityPercentage: body.co2PurityPercentage,
        measurementDurationSeconds: body.measurementDurationSeconds,
      });

      const evidence: SensorEvidenceReading = {
        time: timestamp.toISOString(),
        dacUnitId: sensorIdentity.dacUnitId,
        sensorId: body.sensorId,
        co2CaptureRateKgHour: body.co2CaptureRateKgHour,
        energyConsumptionKwh: body.energyConsumptionKwh,
        measurementDurationSeconds: body.measurementDurationSeconds,
        co2PurityPercentage: body.co2PurityPercentage ?? 95,
        ambientTemperatureC: body.ambientTemperatureC ?? null,
        ambientHumidityPercent: body.ambientHumidityPercent ?? null,
        atmosphericCo2Ppm: body.atmosphericCo2Ppm ?? null,
        dataHash,
        rawData: body.rawData ?? null,
        isAnomaly,
        anomalyReason: reason,
      };
      const inserted = await insertSensorReadings([evidence]);

      if (!inserted) {
        return reply.status(409).send({
          success: false,
          error: "This sensor evidence has already been accepted",
        });
      }

      return reply.status(201).send({
        success: true,
        data: {
          dataHash: `0x${dataHash}`,
          isAnomaly,
          anomalyReason: reason,
          timestamp: timestamp.toISOString(),
        },
      });
    },
  );

  /**
   * Submit batch of sensor readings
   */
  fastify.post(
    "/readings/batch",
    {
      schema: {
        tags: ["Sensors"],
        summary: "Submit batch of sensor readings",
        description: "Submit multiple sensor readings at once",
        security: [{ apiKeyAuth: [] }],
        body: {
          type: "object",
          required: ["readings"],
          properties: {
            readings: {
              type: "array",
              items: {
                type: "object",
                required: [
                  "sensorId",
                  "co2CaptureRateKgHour",
                  "energyConsumptionKwh",
                ],
                properties: {
                  sensorId: { type: "string" },
                  timestamp: { type: "string" },
                  co2CaptureRateKgHour: { type: "number" },
                  energyConsumptionKwh: { type: "number" },
                  co2PurityPercentage: { type: "number" },
                  ambientTemperatureC: { type: "number" },
                  ambientHumidityPercent: { type: "number" },
                  atmosphericCo2Ppm: { type: "number" },
                  measurementDurationSeconds: {
                    type: "number",
                    minimum: 1,
                    maximum: 86400,
                    default: 3600,
                  },
                  rawData: { type: "object" },
                },
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
                  processed: { type: "integer" },
                  anomalies: { type: "integer" },
                  batchHash: { type: "string" },
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
          409: {
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
      const sensorIdentity = await resolveSensorApiKey(request.headers);
      if (!sensorIdentity) {
        return reply.status(401).send({
          success: false,
          error: "Invalid sensor API key",
        });
      }

      const body = request.body as { readings: unknown[] };
      const readings = z
        .array(SensorReadingSchema)
        .min(1)
        .max(1000)
        .parse(body.readings);

      const prepared = readings.map((reading) => {
        const timestamp = reading.timestamp
          ? new Date(reading.timestamp)
          : new Date();
        const dataHash = hashSensorData({
          dacUnitId: sensorIdentity.dacUnitId,
          sensorId: reading.sensorId,
          timestamp: timestamp.toISOString(),
          co2CaptureRateKgHour: reading.co2CaptureRateKgHour,
          energyConsumptionKwh: reading.energyConsumptionKwh,
          co2PurityPercentage: reading.co2PurityPercentage,
          ambientTemperatureC: reading.ambientTemperatureC,
          ambientHumidityPercent: reading.ambientHumidityPercent,
          atmosphericCo2Ppm: reading.atmosphericCo2Ppm,
          measurementDurationSeconds: reading.measurementDurationSeconds,
          rawData: reading.rawData,
        });
        const anomaly = detectAnomaly(reading);
        return { reading, timestamp, dataHash, anomaly };
      });
      if (
        new Set(prepared.map(({ dataHash }) => dataHash)).size !==
        prepared.length
      ) {
        return reply.status(409).send({
          success: false,
          error: "The batch contains duplicate sensor evidence",
        });
      }

      const evidence = prepared.map(
        ({ reading, timestamp, dataHash, anomaly }): SensorEvidenceReading => ({
          time: timestamp.toISOString(),
          dacUnitId: sensorIdentity.dacUnitId,
          sensorId: reading.sensorId,
          co2CaptureRateKgHour: reading.co2CaptureRateKgHour,
          energyConsumptionKwh: reading.energyConsumptionKwh,
          measurementDurationSeconds: reading.measurementDurationSeconds,
          co2PurityPercentage: reading.co2PurityPercentage ?? 95,
          ambientTemperatureC: reading.ambientTemperatureC ?? null,
          ambientHumidityPercent: reading.ambientHumidityPercent ?? null,
          atmosphericCo2Ppm: reading.atmosphericCo2Ppm ?? null,
          dataHash,
          rawData: reading.rawData ?? null,
          isAnomaly: anomaly.isAnomaly,
          anomalyReason: anomaly.reason,
        }),
      );
      const inserted = await insertSensorReadings(evidence);
      if (!inserted) {
        return reply.status(409).send({
          success: false,
          error: "At least one sensor evidence item has already been accepted",
        });
      }
      const batchHash = createHash("sha256")
        .update(prepared.map(({ dataHash }) => dataHash).join(""))
        .digest("hex");

      return reply.status(201).send({
        success: true,
        data: {
          processed: readings.length,
          anomalies: prepared.filter(({ anomaly }) => anomaly.isAnomaly).length,
          batchHash: `0x${batchHash}`,
        },
      });
    },
  );

  /**
   * Get sensor readings summary
   */
  fastify.get(
    "/:dacUnitId/summary",
    {
      schema: {
        tags: ["Sensors"],
        summary: "Get sensor readings summary",
        description: "Returns aggregated sensor metrics for a DAC unit",
        params: {
          type: "object",
          properties: {
            dacUnitId: { type: "string" },
          },
        },
        querystring: {
          type: "object",
          properties: {
            startTime: { type: "string", format: "date-time" },
            endTime: { type: "string", format: "date-time" },
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
                  dacUnitId: { type: "string" },
                  startTime: { type: "string" },
                  endTime: { type: "string" },
                  totalCo2CapturedKg: { type: "number" },
                  totalEnergyConsumedKwh: { type: "number" },
                  avgCo2CaptureRateKgHour: { type: "number" },
                  avgPurityPercentage: { type: "number" },
                  kwhPerTonne: { type: "number" },
                  efficiencyRating: { type: "string" },
                  readingCount: { type: "integer" },
                  anomalyCount: { type: "integer" },
                },
              },
            },
          },
        },
      },
    },
    async (request, _reply) => {
      const params = request.params as { dacUnitId: string };
      const query = request.query as { startTime?: string; endTime?: string };

      const startTime = query.startTime
        ? new Date(query.startTime)
        : new Date(Date.now() - 24 * 60 * 60 * 1000); // Last 24 hours
      const endTime = query.endTime ? new Date(query.endTime) : new Date();

      const summary = await summarizeSensorReadings(
        params.dacUnitId,
        startTime,
        endTime,
      );

      if (summary.readingCount === 0) {
        return {
          success: true,
          data: {
            dacUnitId: params.dacUnitId,
            startTime: startTime.toISOString(),
            endTime: endTime.toISOString(),
            totalCo2CapturedKg: 0,
            totalEnergyConsumedKwh: 0,
            avgCo2CaptureRateKgHour: 0,
            avgPurityPercentage: 0,
            kwhPerTonne: 0,
            efficiencyRating: "N/A",
            readingCount: 0,
            anomalyCount: 0,
          },
        };
      }

      const co2Tonnes = summary.totalCo2CapturedKg / 1000;
      const kwhPerTonne =
        co2Tonnes > 0 ? summary.totalEnergyConsumedKwh / co2Tonnes : 0;

      let efficiencyRating = "N/A";
      if (kwhPerTonne > 0) {
        if (kwhPerTonne <= 300) efficiencyRating = "EXCELLENT";
        else if (kwhPerTonne <= 400) efficiencyRating = "GOOD";
        else if (kwhPerTonne <= 500) efficiencyRating = "ACCEPTABLE";
        else efficiencyRating = "POOR";
      }

      return {
        success: true,
        data: {
          dacUnitId: params.dacUnitId,
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          totalCo2CapturedKg: summary.totalCo2CapturedKg,
          totalEnergyConsumedKwh: summary.totalEnergyConsumedKwh,
          avgCo2CaptureRateKgHour: summary.avgCo2CaptureRateKgHour,
          avgPurityPercentage: summary.avgPurityPercentage,
          kwhPerTonne,
          efficiencyRating,
          readingCount: summary.readingCount,
          anomalyCount: summary.anomalyCount,
        },
      };
    },
  );
}
