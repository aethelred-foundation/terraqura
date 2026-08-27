import { expect } from "chai";

import {
  assertRpcAnchor,
  assertRpcChainId,
  INSECURE_TESTNET_RPC_ACKNOWLEDGEMENT,
  readPublicTestnetRpcPolicy,
} from "../scripts/lib/public-testnet-rpc-policy";

const anchorHash = `0x${"a".repeat(64)}`;
const httpsEnvironment = {
  AETHELRED_TESTNET_RPC_URL: "https://rpc.example.test/",
  AETHELRED_TESTNET_CHAIN_ID: "7332",
};
const evaluationEnvironment = {
  AETHELRED_TESTNET_RPC_URL: "http://54.165.44.130:8545",
  AETHELRED_TESTNET_CHAIN_ID: "7332",
  ALLOW_INSECURE_TESTNET_RPC: INSECURE_TESTNET_RPC_ACKNOWLEDGEMENT,
  AETHELRED_NETWORK_ANCHOR_BLOCK: "450000",
  AETHELRED_NETWORK_ANCHOR_HASH: anchorHash,
};

describe("public-testnet RPC policy", function () {
  it("uses HTTPS by default", function () {
    expect(readPublicTestnetRpcPolicy(httpsEnvironment)).to.deep.equal({
      url: "https://rpc.example.test",
      expectedChainId: 7332,
      transport: "https",
      anchor: undefined,
    });
  });

  it("rejects plaintext RPC without the exact evaluation acknowledgement", function () {
    expect(() =>
      readPublicTestnetRpcPolicy({
        ...evaluationEnvironment,
        ALLOW_INSECURE_TESTNET_RPC: "true",
      }),
    ).to.throw(INSECURE_TESTNET_RPC_ACKNOWLEDGEMENT);
  });

  it("rejects plaintext RPC outside the fixed public-testnet chain", function () {
    expect(() =>
      readPublicTestnetRpcPolicy({
        ...evaluationEnvironment,
        AETHELRED_TESTNET_CHAIN_ID: "1",
      }),
    ).to.throw("only for Aethelred public-testnet chain ID 7332");
  });

  it("requires a complete anchor for plaintext RPC", function () {
    expect(() =>
      readPublicTestnetRpcPolicy({
        ...evaluationEnvironment,
        AETHELRED_NETWORK_ANCHOR_BLOCK: "",
        AETHELRED_NETWORK_ANCHOR_HASH: "",
      }),
    ).to.throw("requires AETHELRED_NETWORK_ANCHOR_BLOCK");
  });

  it("accepts the explicit anchored evaluation profile", function () {
    expect(readPublicTestnetRpcPolicy(evaluationEnvironment)).to.deep.equal({
      url: "http://54.165.44.130:8545",
      expectedChainId: 7332,
      transport: "evaluation-http",
      anchor: { blockNumber: 450000, blockHash: anchorHash },
    });
  });

  it("verifies the configured block anchor", async function () {
    const policy = readPublicTestnetRpcPolicy(evaluationEnvironment);
    await assertRpcAnchor(
      { getBlock: async () => ({ hash: anchorHash.toUpperCase() }) },
      policy,
    );

    let error: Error | undefined;
    try {
      await assertRpcAnchor(
        { getBlock: async () => ({ hash: `0x${"b".repeat(64)}` }) },
        policy,
      );
    } catch (caught) {
      error = caught as Error;
    }
    expect(error?.message).to.include("RPC anchor mismatch");
  });

  it("queries and verifies eth_chainId instead of trusting provider configuration", async function () {
    const policy = readPublicTestnetRpcPolicy(evaluationEnvironment);
    await assertRpcChainId({ send: async () => "0x1ca4" }, policy);

    let error: Error | undefined;
    try {
      await assertRpcChainId({ send: async () => "0x1" }, policy);
    } catch (caught) {
      error = caught as Error;
    }
    expect(error?.message).to.include(
      "RPC chain mismatch: expected 7332, received 1",
    );
  });
});
