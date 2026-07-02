import { describe, expect, it, vi } from "vitest";

import { GaslessRelayer, type DefenderRelayHandler } from "./relayer.service.js";

const FORWARDER = "0x1111111111111111111111111111111111111111";
const PRIVATE_KEY = `0x${"1".repeat(64)}`;
const REQUEST = {
  from: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  to: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  value: 0n,
  gas: 500000n,
  nonce: 1n,
  deadline: 4_102_444_800,
  data: "0x",
};

function buildRelayer(
  overrides: Partial<ConstructorParameters<typeof GaslessRelayer>[0]> = {},
): GaslessRelayer {
  return new GaslessRelayer({
    forwarderAddress: FORWARDER,
    rpcUrl: "http://127.0.0.1:8545",
    chainId: 7332,
    privateKey: PRIVATE_KEY,
    ...overrides,
  });
}

describe("GaslessRelayer", () => {
  it("does not fall back to direct signing when Defender handler is missing", async () => {
    const relayer = buildRelayer({
      mode: "defender",
      defenderApiKey: "defender-key",
      defenderApiSecret: "defender-secret",
    });

    const result = await relayer.relayViaDefender(REQUEST, "0xsig");

    expect(result).toMatchObject({
      success: false,
      mode: "defender",
      error: "Defender relay handler not configured; direct relay fallback is disabled",
    });
  });

  it("delegates Defender mode to the configured relay handler", async () => {
    const handler: DefenderRelayHandler = {
      relay: vi.fn().mockResolvedValue({
        success: true,
        txHash: `0x${"d".repeat(64)}`,
      }),
    };
    const relayer = buildRelayer({
      mode: "defender",
      defenderApiKey: "defender-key",
      defenderApiSecret: "defender-secret",
      defenderRelayHandler: handler,
    });

    const result = await relayer.relayViaDefender(REQUEST, "0xsig");

    expect(handler.relay).toHaveBeenCalledWith({
      forwarderAddress: FORWARDER,
      request: REQUEST,
      signature: "0xsig",
      chainId: 7332,
    });
    expect(result).toMatchObject({
      success: true,
      mode: "defender",
      txHash: `0x${"d".repeat(64)}`,
    });
  });

  it("reports direct mode and signing capability explicitly", () => {
    const relayer = buildRelayer({ mode: "direct" });

    expect(relayer.getRelayMode()).toBe("direct");
    expect(relayer.hasSigningCapability()).toBe(true);
    expect(relayer.hasDefenderCredentials()).toBe(false);
  });
});
