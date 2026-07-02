import { afterEach, describe, expect, it, vi } from "vitest";

import {
  cryptoRandomChar,
  cryptoRandomFloat,
  cryptoRandomHex,
  cryptoRandomInt,
  cryptoRandomUint32,
} from "./random";

describe("web crypto random helpers", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses browser crypto when available", () => {
    const getRandomValues = vi.fn((values: Uint32Array) => {
      values[0] = 0x80000000;
      return values;
    });
    vi.stubGlobal("crypto", { getRandomValues });

    expect(cryptoRandomUint32()).toBe(0x80000000);
    expect(getRandomValues).toHaveBeenCalledTimes(1);
  });

  it("produces bounded float and integer values without Math.random", () => {
    vi.stubGlobal("crypto", undefined);

    const value = cryptoRandomFloat();
    expect(value).toBeGreaterThanOrEqual(0);
    expect(value).toBeLessThan(1);

    const integer = cryptoRandomInt(7);
    expect(integer).toBeGreaterThanOrEqual(0);
    expect(integer).toBeLessThan(7);
  });

  it("generates hex with the requested byte length", () => {
    vi.stubGlobal("crypto", {
      getRandomValues: vi.fn((bytes: Uint8Array) => {
        bytes.fill(0xab);
        return bytes;
      }),
    });

    expect(cryptoRandomHex(4)).toBe("abababab");
  });

  it("selects a character from the provided alphabet", () => {
    vi.stubGlobal("crypto", {
      getRandomValues: vi.fn((values: Uint32Array) => {
        values[0] = 0;
        return values;
      }),
    });

    expect(cryptoRandomChar("abc")).toBe("a");
  });

  it("rejects invalid bounds", () => {
    expect(() => cryptoRandomInt(0)).toThrow(RangeError);
    expect(() => cryptoRandomHex(0)).toThrow(RangeError);
    expect(() => cryptoRandomChar("")).toThrow(RangeError);
  });
});
