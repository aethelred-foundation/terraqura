import { describe, expect, it, vi } from "vitest";
import { ethers } from "ethers";

import {
  DEFAULT_GAS_LIMITS,
  GasManager,
} from "./gas.js";

describe("GasManager", () => {
  it("caches gas price data and raises the priority fee floor", async () => {
    const getFeeData = vi.fn().mockResolvedValue({
      maxFeePerGas: ethers.parseUnits("40", "gwei"),
      maxPriorityFeePerGas: ethers.parseUnits("1", "gwei"),
      gasPrice: null,
    });

    const provider = {
      getFeeData,
      estimateGas: vi.fn(),
    };

    const manager = new GasManager(provider as never, {
      maxPriorityFee: ethers.parseUnits("2", "gwei"),
      cacheTtlMs: 60_000,
    });

    const first = await manager.getGasPrice();
    const second = await manager.getGasPrice();

    expect(getFeeData).toHaveBeenCalledTimes(1);
    expect(first.maxPriorityFeePerGas).toBe(ethers.parseUnits("2", "gwei"));
    expect(second.maxFeePerGas).toBe(first.maxFeePerGas);

    manager.invalidateCache();
    await manager.getGasPrice();
    expect(getFeeData).toHaveBeenCalledTimes(2);
  });

  it("estimates gas and builds overrides from defaults", async () => {
    const provider = {
      getFeeData: vi.fn().mockResolvedValue({
        maxFeePerGas: ethers.parseUnits("20", "gwei"),
        maxPriorityFeePerGas: ethers.parseUnits("2", "gwei"),
        gasPrice: null,
      }),
      estimateGas: vi.fn().mockResolvedValue(100_000n),
    };

    const manager = new GasManager(provider as never, { multiplier: 1.5 });

    const estimate = await manager.estimateGas({ to: "0x1234" });
    expect(estimate.gasLimit).toBe(150_000n);
    expect(estimate.maxFeePerGas).toBe(ethers.parseUnits("48", "gwei"));
    expect(estimate.estimatedCostWei).toBe(
      150_000n * ethers.parseUnits("48", "gwei"),
    );

    const overrides = await manager.buildGasOverrides("purchase");
    expect(overrides.maxFeePerGas).toBe(ethers.parseUnits("48", "gwei"));
    expect(overrides.gasLimit).toBe(DEFAULT_GAS_LIMITS.purchase);
    expect(manager.getConfig().multiplier).toBe(1.5);
  });

  it("falls back to legacy gasPrice data when eip1559 values are unavailable", async () => {
    const provider = {
      getFeeData: vi.fn().mockResolvedValue({
        maxFeePerGas: null,
        maxPriorityFeePerGas: null,
        gasPrice: ethers.parseUnits("12", "gwei"),
      }),
      estimateGas: vi.fn().mockResolvedValue(90_000n),
    };

    const manager = new GasManager(provider as never);
    const gas = await manager.getGasPrice();

    expect(gas.maxFeePerGas).toBe(ethers.parseUnits("12", "gwei"));
    expect(gas.maxPriorityFeePerGas).toBe(ethers.parseUnits("30", "gwei"));
    expect(gas.baseFee).toBe(0n);
  });
});
