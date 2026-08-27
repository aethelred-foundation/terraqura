import { describe, expect, it, vi } from "vitest";

import { assertBlockchainRpcIdentity } from "./blockchain-rpc-identity.js";

const anchorHash =
  "0x1057a62d12eed50d8740fcf51be0cd784db9a4f8f98c9312eee8b8bc7e543ddc";
const environment = {
  AETHELRED_RPC_URL: "http://54.165.44.130:8545",
  CHAIN_ID: 7332,
  AETHELRED_NETWORK_ANCHOR_BLOCK: 450000,
  AETHELRED_NETWORK_ANCHOR_HASH: anchorHash,
};

function rpcFetch(chainId = "0x1ca4", blockHash = anchorHash): typeof fetch {
  return vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
    const request = JSON.parse(String(init?.body)) as { method: string };
    const result =
      request.method === "eth_chainId" ? chainId : { hash: blockHash };
    return new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, result }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;
}

describe("blockchain RPC identity", () => {
  it("verifies chain ID and the configured public-testnet anchor", async () => {
    const request = rpcFetch();
    await expect(
      assertBlockchainRpcIdentity(environment, request),
    ).resolves.toBeUndefined();
    expect(request).toHaveBeenCalledTimes(2);
  });

  it("fails closed when the chain ID differs", async () => {
    await expect(
      assertBlockchainRpcIdentity(environment, rpcFetch("0x1")),
    ).rejects.toThrow("RPC chain identity does not match 7332");
  });

  it("fails closed when eth_chainId is not a canonical hexadecimal quantity", async () => {
    await expect(
      assertBlockchainRpcIdentity(environment, rpcFetch("0x1ca4junk")),
    ).rejects.toThrow("RPC chain identity does not match 7332");
  });

  it("fails closed when the anchor hash differs", async () => {
    await expect(
      assertBlockchainRpcIdentity(
        environment,
        rpcFetch("0x1ca4", `0x${"f".repeat(64)}`),
      ),
    ).rejects.toThrow("RPC anchor identity does not match block 450000");
  });
});
