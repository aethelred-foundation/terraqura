import { describe, it, expect } from "vitest";
import {
  seededRandom,
  seededInt,
  seededFloat,
  seededPick,
  seededAddress,
  seededTxHash,
} from "./mockData";

describe("mockData seeded helpers", () => {
  describe("seededRandom", () => {
    it("returns a value in [0, 1) for any seed", () => {
      for (let s = 0; s < 100; s++) {
        const v = seededRandom(s);
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThan(1);
      }
    });

    it("is deterministic for the same seed", () => {
      expect(seededRandom(42)).toBe(seededRandom(42));
      expect(seededRandom(0)).toBe(seededRandom(0));
      expect(seededRandom(-7)).toBe(seededRandom(-7));
    });

    it("returns different values for different seeds", () => {
      const a = seededRandom(1);
      const b = seededRandom(2);
      const c = seededRandom(3);
      expect(a).not.toBe(b);
      expect(b).not.toBe(c);
      expect(a).not.toBe(c);
    });
  });

  describe("seededInt", () => {
    it("returns integers within [min, max]", () => {
      for (let s = 0; s < 200; s++) {
        const v = seededInt(s, 5, 12);
        expect(Number.isInteger(v)).toBe(true);
        expect(v).toBeGreaterThanOrEqual(5);
        expect(v).toBeLessThanOrEqual(12);
      }
    });

    it("is deterministic for the same seed and bounds", () => {
      expect(seededInt(99, 0, 100)).toBe(seededInt(99, 0, 100));
    });

    it("handles a single-value range correctly", () => {
      expect(seededInt(42, 7, 7)).toBe(7);
    });
  });

  describe("seededFloat", () => {
    it("returns values within [min, max)", () => {
      for (let s = 0; s < 200; s++) {
        const v = seededFloat(s, -5, 5);
        expect(v).toBeGreaterThanOrEqual(-5);
        expect(v).toBeLessThan(5);
      }
    });
  });

  describe("seededPick", () => {
    it("picks a value from the provided array deterministically", () => {
      const items = ["a", "b", "c", "d"];
      const a = seededPick(1, items);
      const b = seededPick(1, items);
      expect(a).toBe(b);
      expect(items).toContain(a);
    });
  });

  describe("seededAddress / seededTxHash", () => {
    it("generates a valid 0x-prefixed 40-char address", () => {
      const addr = seededAddress(123);
      expect(addr).toMatch(/^0x[0-9a-f]{40}$/);
    });

    it("generates a valid 0x-prefixed 64-char tx hash", () => {
      const hash = seededTxHash(123);
      expect(hash).toMatch(/^0x[0-9a-f]{64}$/);
    });

    it("is deterministic for both", () => {
      expect(seededAddress(7)).toBe(seededAddress(7));
      expect(seededTxHash(7)).toBe(seededTxHash(7));
    });
  });
});
