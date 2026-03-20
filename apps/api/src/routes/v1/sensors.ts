import { createHash } from "crypto";

import { AnomalyReason } from "@terraqura/types";
import { FastifyInstance, FastifyPluginOptions, FastifyRequest } from "fastify";
import { z } from "zod";

import { mutateState, readState } from "../../lib/state-store.js";

const SensorReadingSchema = z.object({
  sensorId: z.string().min(1),
  timestamp: z.string().datetime().optional(),
  co2CaptureRateKgHour: z.number().min(0),
  energyConsumptionKwh: z.number().min(0),
  co2PurityPercentage: z.number().min(0).max(100).optional(),
  ambientTemperatureC: z.number().optional(),
  ambientHumidityPercent: z.number().min(0).max(100).optional(),
  atmosphericCo2Ppm: z.number().min(0).optional(),
  rawData: z.record(z.unknown()).optional(),
});

// Verification constants (matching smart contract)
const MIN_KWH_PER_TONNE = 200;
const MAX_KWH_PER_TONNE = 600;
const MIN_PURITY_PERCENTAGE = 90;

function parseSensorApiKeyConfig(rawConfig?: string): Map<string, string> {
  const mappings = new Map<string, string>();

  if (!rawConfig) {
    return mappings;
  }

  for (const pair of rawConfig.split(",")) {
    const [apiKey, dacUnitId] = pair.split(":").map((value) => value?.trim());
    if (!apiKey || !dacUnitId) {
      continue;
    }

    mappings.set(apiKey, dacUnitId);
  }

  return mappings;
}

const sensorApiKeys = parseSensorApiKeyConfig(process.env.SENSOR_API_KEYS);

function resolveSensorApiKey(
  headers: FastifyRequest["headers"]
): { apiKey: string; dacUnitId: string } | null {
  const headerValue = headers["x-sensor-api-key"];
  const keyCandidate = Array.isArray(headerValue) ? headerValue[0] : headerValue;

  if (typeof keyCandidate !== "string") {
    return null;
  }

  const apiKey = keyCandidate.trim();
  if (!apiKey) {
    return null;
  }

  const dacUnitId = sensorApiKeys.get(apiKey);
  if (!dacUnitId) {
    return null;
  }

  return { apiKey, dacUnitId };
}

/**
 * Detect anomalies in sensor reading
 */
function detectAnomaly(reading: {
  co2CaptureRateKgHour: number;
  energyConsumptionKwh: number;
  co2PurityPercentage?: number;
}): { isAnomaly: boolean; reason: AnomalyReason | null } {
  // Calculate kWh per tonne
  const co2Kg = reading.co2CaptureRateKgHour; // Per hour
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
function hashSensorData(data: Record<string, unknown>): string {
  const jsonString = JSON.stringify(data, Object.keys(data).sort());
  return createHash("sha256").update(jsonString).digest("hex");
}

interface StoredSensorReading {
  time: string;
  dacUnitId: string;
  sensorId: string;
  co2CaptureRateKgHour: number;
  energyConsumptionKwh: number;
  co2PurityPercentage: number;
  ambientTemperatureC: number | null;
  ambientHumidityPercent: number | null;
  atmosphericCo2Ppm: number | null;
  dataHash: string;
  isAnomaly: boolean;
  anomalyReason: string | null;
}

interface SensorsState {
  readings: StoredSensorReading[];
}

const SENSORS_STORE_KEY = "sensors:v1";
const DEFAULT_SENSORS_STATE: SensorsState = {
  readings: [],
};

export async function sensorsRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions
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
          required: ["sensorId", "co2CaptureRateKgHour", "energyConsumptionKwh"],
          properties: {
            sensorId: { type: "string" },
            timestamp: { type: "string", format: "date-time" },
            co2CaptureRateKgHour: { type: "number" },
            energyConsumptionKwh: { type: "number" },
            co2PurityPercentage: { type: "number" },
            ambientTemperatureC: { type: "number" },
            ambientHumidityPercent: { type: "number" },
            atmosphericCo2Ppm: { type: "number" },
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
        },
      },
    },
    async (request, reply) => {
      const sensorIdentity = resolveSensorApiKey(request.headers);
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
        sensorId: body.sensorId,
        timestamp: timestamp.toISOString(),
        co2CaptureRateKgHour: body.co2CaptureRateKgHour,
        energyConsumptionKwh: body.energyConsumptionKwh,
        co2PurityPercentage: body.co2PurityPercentage,
      });

      // Detect anomalies
      const { isAnomaly, reason } = detectAnomaly({
        co2CaptureRateKgHour: body.co2CaptureRateKgHour,
        energyConsumptionKwh: body.energyConsumptionKwh,
        co2PurityPercentage: body.co2PurityPercentage,
      });

      await mutateState(SENSORS_STORE_KEY, DEFAULT_SENSORS_STATE, async (state) => {
        state.readings.push({
          time: timestamp.toISOString(),
          dacUnitId: sensorIdentity.dacUnitId,
          sensorId: body.sensorId,
          co2CaptureRateKgHour: body.co2CaptureRateKgHour,
          energyConsumptionKwh: body.energyConsumptionKwh,
          co2PurityPercentage: body.co2PurityPercentage || 95,
          ambientTemperatureC: body.ambientTemperatureC || null,
          ambientHumidityPercent: body.ambientHumidityPercent || null,
          atmosphericCo2Ppm: body.atmosphericCo2Ppm || null,
          dataHash,
          isAnomaly,
          anomalyReason: reason,
        });
      });

      return reply.status(201).send({
        success: true,
        data: {
          dataHash: `0x${dataHash}`,
          isAnomaly,
          anomalyReason: reason,
          timestamp: timestamp.toISOString(),
        },
      });
    }
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
                required: ["sensorId", "co2CaptureRateKgHour", "energyConsumptionKwh"],
                properties: {
                  sensorId: { type: "string" },
                  timestamp: { type: "string" },
                  co2CaptureRateKgHour: { type: "number" },
                  energyConsumptionKwh: { type: "number" },
                  co2PurityPercentage: { type: "number" },
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
        },
      },
    },
    async (request, reply) => {
      const sensorIdentity = resolveSensorApiKey(request.headers);
      if (!sensorIdentity) {
        return reply.status(401).send({
          success: false,
          error: "Invalid sensor API key",
        });
      }

      const body = request.body as { readings: unknown[] };
      const readings = z.array(SensorReadingSchema).parse(body.readings);

      const batchResult = await mutateState(
        SENSORS_STORE_KEY,
        DEFAULT_SENSORS_STATE,
        async (state) => {
          let anomalyCount = 0;
          const hashes: string[] = [];

          for (const reading of readings) {
            const timestamp = reading.timestamp ? new Date(reading.timestamp) : new Date();
            const dataHash = hashSensorData({
              sensorId: reading.sensorId,
              timestamp: timestamp.toISOString(),
              co2CaptureRateKgHour: reading.co2CaptureRateKgHour,
              energyConsumptionKwh: reading.energyConsumptionKwh,
              co2PurityPercentage: reading.co2PurityPercentage,
            });

            hashes.push(dataHash);

            const { isAnomaly, reason } = detectAnomaly({
              co2CaptureRateKgHour: reading.co2CaptureRateKgHour,
              energyConsumptionKwh: reading.energyConsumptionKwh,
              co2PurityPercentage: reading.co2PurityPercentage,
            });

            if (isAnomaly) {
              anomalyCount += 1;
            }

            state.readings.push({
              time: timestamp.toISOString(),
              dacUnitId: sensorIdentity.dacUnitId,
              sensorId: reading.sensorId,
              co2CaptureRateKgHour: reading.co2CaptureRateKgHour,
              energyConsumptionKwh: reading.energyConsumptionKwh,
              co2PurityPercentage: reading.co2PurityPercentage || 95,
              ambientTemperatureC: reading.ambientTemperatureC || null,
              ambientHumidityPercent: reading.ambientHumidityPercent || null,
              atmosphericCo2Ppm: reading.atmosphericCo2Ppm || null,
              dataHash,
              isAnomaly,
              anomalyReason: reason,
            });
          }

          const batchHash = createHash("sha256")
            .update(hashes.join(""))
            .digest("hex");

          return {
            anomalyCount,
            batchHash,
          };
        }
      );

      return reply.status(201).send({
        success: true,
        data: {
          processed: readings.length,
          anomalies: batchResult.anomalyCount,
          batchHash: `0x${batchResult.batchHash}`,
        },
      });
    }
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

      // Filter readings
      const state = await readState(SENSORS_STORE_KEY, DEFAULT_SENSORS_STATE);
      const readings = state.readings.filter((r) => {
        const readingTime = new Date(r.time);
        return (
          r.dacUnitId === params.dacUnitId &&
          readingTime >= startTime &&
          readingTime <= endTime
        );
      });

      if (readings.length === 0) {
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

      // Calculate aggregates
      const totalCo2CapturedKg = readings.reduce(
        (sum, r) => sum + r.co2CaptureRateKgHour,
        0
      );
      const totalEnergyConsumedKwh = readings.reduce(
        (sum, r) => sum + r.energyConsumptionKwh,
        0
      );
      const avgCo2CaptureRateKgHour = totalCo2CapturedKg / readings.length;
      const avgPurityPercentage =
        readings.reduce((sum, r) => sum + r.co2PurityPercentage, 0) /
        readings.length;
      const anomalyCount = readings.filter((r) => r.isAnomaly).length;

      const co2Tonnes = totalCo2CapturedKg / 1000;
      const kwhPerTonne = co2Tonnes > 0 ? totalEnergyConsumedKwh / co2Tonnes : 0;

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
          totalCo2CapturedKg,
          totalEnergyConsumedKwh,
          avgCo2CaptureRateKgHour,
          avgPurityPercentage,
          kwhPerTonne,
          efficiencyRating,
          readingCount: readings.length,
          anomalyCount,
        },
      };
    }
  );
}
