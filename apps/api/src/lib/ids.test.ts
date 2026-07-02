import { describe, expect, it } from "vitest";

import {
  generateBytes32,
  generateId,
  generateSimulatedBlockNumber,
  generateTxHash,
  isHexIdentifier,
} from "./ids.js";

describe("crypto-backed identifiers", () => {
  it("generates prefixed identifiers with the requested entropy width", () => {
    const id = generateId("listing", 6);

    expect(id).toMatch(/^listing_[a-f0-9]{12}$/);
    expect(isHexIdentifier(id.split("_")[1] ?? "", 6)).toBe(true);
  });

  it("does not expose timestamp-shaped route identifiers", () => {
    const first = generateId("purchase");
    const second = generateId("purchase");

    expect(first).toMatch(/^purchase_[a-f0-9]{24}$/);
    expect(second).toMatch(/^purchase_[a-f0-9]{24}$/);
    expect(first).not.toBe(second);
  });

  it("rejects unsafe identifier prefixes", () => {
    expect(() => generateId("../key")).toThrow(/Invalid identifier prefix/);
    expect(() => generateId("")).toThrow(/Invalid identifier prefix/);
  });

  it("generates bytes32 values for transaction and on-chain identifiers", () => {
    expect(generateTxHash()).toMatch(/^0x[a-f0-9]{64}$/);
    expect(generateBytes32()).toMatch(/^0x[a-f0-9]{64}$/);
  });

  it("generates simulated block numbers inside explicit safe bounds", () => {
    for (let i = 0; i < 25; i += 1) {
      const blockNumber = generateSimulatedBlockNumber(123_000, 50);

      expect(blockNumber).toBeGreaterThanOrEqual(123_000);
      expect(blockNumber).toBeLessThan(123_050);
    }
  });

  it("rejects unsafe simulated block configuration", () => {
    expect(() => generateSimulatedBlockNumber(-1, 10)).toThrow(/baseBlock/);
    expect(() => generateSimulatedBlockNumber(1, 0)).toThrow(/range/);
  });
});
