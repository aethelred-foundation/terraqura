import { AnomalyReason, type SensorReadingInput } from "@terraqura/types";
import { describe, expect, it } from "vitest";

import {
  calculateAggregates,
  createDefaultConfig,
  generateReading,
  generateReadingsBatch,
  type SimulatorOutput,
} from "./simulator.js";

function buildOutput(params: {
  captureKgHour: number;
  energyKwh: number;
  purity: number;
  isAnomaly?: boolean;
}): SimulatorOutput {
  const reading: SensorReadingInput = {
    sensorId: "sensor-1",
    timestamp: new Date("2026-01-01T00:00:00.000Z"),
    co2CaptureRateKgHour: params.captureKgHour,
    energyConsumptionKwh: params.energyKwh,
    co2PurityPercentage: params.purity,
    rawData: {},
  };

  return {
    reading,
    dataHash: "0x" + "a".repeat(64),
    isAnomaly: params.isAnomaly ?? false,
    anomalyType: params.isAnomaly ? AnomalyReason.LOW_PURITY : null,
  };
}

describe("iot simulator", () => {
  it("creates a default config with expected IDs and defaults", () => {
    const config = createDefaultConfig("dac-001", "sensor-001");

    expect(config.dacUnitId).toBe("dac-001");
    expect(config.sensorId).toBe("sensor-001");
    expect(config.intervalSeconds).toBe(60);
    expect(config.injectAnomalies).toBe(false);
    expect(config.latitude).toBeCloseTo(24.453884, 6);
    expect(config.longitude).toBeCloseTo(54.377344, 6);
  });

  it("generates a single reading with stable structure and hash", () => {
    const config = createDefaultConfig("dac-001", "sensor-001");
    const fixedTimestamp = new Date("2026-01-01T00:00:00.000Z");

    const output = generateReading(config, fixedTimestamp);

    expect(output.reading.sensorId).toBe("sensor-001");
    expect(output.reading.timestamp.toISOString()).toBe(
      "2026-01-01T00:00:00.000Z",
    );
    expect(output.dataHash).toMatch(/^0x[a-f0-9]{64}$/);
    expect(output.reading.co2CaptureRateKgHour).toBeGreaterThan(0);
    expect(output.reading.energyConsumptionKwh).toBeGreaterThan(0);
    expect(output.reading.co2PurityPercentage).toBeGreaterThanOrEqual(85);
    expect(output.reading.co2PurityPercentage).toBeLessThanOrEqual(100);

    const rawTimestamp = output.reading.rawData?.timestamp;
    expect(rawTimestamp).toBe("2026-01-01T00:00:00.000Z");
  });

  it("generates batched readings using configured interval spacing", () => {
    const config = createDefaultConfig("dac-001", "sensor-001");
    const start = new Date("2026-01-01T00:00:00.000Z");

    const outputs = generateReadingsBatch(config, 3, start);

    expect(outputs).toHaveLength(3);
    expect(outputs[0]?.reading.timestamp.toISOString()).toBe(
      "2026-01-01T00:00:00.000Z",
    );
    expect(outputs[1]?.reading.timestamp.toISOString()).toBe(
      "2026-01-01T00:01:00.000Z",
    );
    expect(outputs[2]?.reading.timestamp.toISOString()).toBe(
      "2026-01-01T00:02:00.000Z",
    );
  });

  it("computes aggregate metrics and anomaly count", () => {
    const outputs: SimulatorOutput[] = [
      buildOutput({ captureKgHour: 10, energyKwh: 3, purity: 96 }),
      buildOutput({ captureKgHour: 20, energyKwh: 6, purity: 98, isAnomaly: true }),
    ];

    const aggregates = calculateAggregates(outputs);

    expect(aggregates.totalCo2Kg).toBe(30);
    expect(aggregates.totalEnergyKwh).toBe(9);
    expect(aggregates.avgPurity).toBe(97);
    expect(aggregates.kwhPerTonne).toBe(300);
    expect(aggregates.efficiencyRating).toBe("EXCELLENT");
    expect(aggregates.anomalyCount).toBe(1);
  });

  it("returns safe defaults for empty aggregate input", () => {
    const aggregates = calculateAggregates([]);

    expect(aggregates).toEqual({
      totalCo2Kg: 0,
      totalEnergyKwh: 0,
      avgPurity: 0,
      kwhPerTonne: 0,
      efficiencyRating: "N/A",
      anomalyCount: 0,
    });
  });
});
