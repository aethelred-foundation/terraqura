import { describe, expect, it } from "vitest";

import { bufferGasLimit, GAS_FLOOR, GAS_CEILING } from "./gas";

describe("bufferGasLimit", () => {
  it("floors a near-intrinsic estimate to the contract-call floor", () => {
    // The Aethelred node returns ~intrinsic gas for state-changing calls;
    // 23,690 * 8 = 189,520, which is below the floor, so we floor it.
    expect(bufferGasLimit(23_690n)).toBe(GAS_FLOOR);
  });

  it("applies the 8x multiplier once the estimate clears the floor", () => {
    // 150,000 * 8 = 1,200,000 (> floor, < ceiling).
    expect(bufferGasLimit(150_000n)).toBe(1_200_000n);
  });

  it("caps a pathological estimate at the ceiling", () => {
    // 5,000,000 * 8 = 40,000,000 -> capped to the block-safe ceiling.
    expect(bufferGasLimit(5_000_000n)).toBe(GAS_CEILING);
  });

  it("returns the floor for a zero estimate", () => {
    expect(bufferGasLimit(0n)).toBe(GAS_FLOOR);
  });

  it("keeps the exact floor at the multiplier boundary", () => {
    // 87,500 * 8 = 700,000 exactly — equals the floor, not below it.
    expect(bufferGasLimit(87_500n)).toBe(GAS_FLOOR);
  });
});
