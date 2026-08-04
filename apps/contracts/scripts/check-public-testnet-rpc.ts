import { JsonRpcProvider } from "ethers";

import {
  assertRpcAnchor,
  assertRpcChainId,
  readPublicTestnetRpcPolicy,
} from "./lib/public-testnet-rpc-policy";

async function main(): Promise<void> {
  const policy = readPublicTestnetRpcPolicy();
  const provider = new JsonRpcProvider(policy.url, policy.expectedChainId, {
    staticNetwork: true,
  });
  try {
    await assertRpcChainId(provider, policy);
    await assertRpcAnchor(provider, policy);
    const anchorMessage = policy.anchor
      ? ` and anchor block ${policy.anchor.blockNumber}`
      : "";
    console.log(
      `RPC identity check passed for chain ${policy.expectedChainId}${anchorMessage} using ${policy.transport}.`,
    );
  } finally {
    provider.destroy();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
