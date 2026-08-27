import type { ApiRuntimeEnv } from "./runtime-env.js";

type RpcIdentityEnvironment = Pick<
  ApiRuntimeEnv,
  | "AETHELRED_RPC_URL"
  | "CHAIN_ID"
  | "AETHELRED_NETWORK_ANCHOR_BLOCK"
  | "AETHELRED_NETWORK_ANCHOR_HASH"
>;

async function rpcCall(
  rpcUrl: string,
  method: string,
  params: unknown[],
  requestId: number,
  fetchImplementation: typeof fetch,
): Promise<unknown> {
  const response = await fetchImplementation(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", method, params, id: requestId }),
    signal: AbortSignal.timeout(3_000),
  });
  if (!response.ok) {
    throw new Error(`RPC ${method} returned HTTP ${response.status}`);
  }
  const payload = (await response.json()) as {
    result?: unknown;
    error?: { message?: string };
  };
  if (payload.error || payload.result === undefined) {
    throw new Error(
      payload.error?.message || `RPC ${method} returned no result`,
    );
  }
  return payload.result;
}

export async function assertBlockchainRpcIdentity(
  environment: RpcIdentityEnvironment,
  fetchImplementation: typeof fetch = fetch,
): Promise<void> {
  const rawChainId = await rpcCall(
    environment.AETHELRED_RPC_URL,
    "eth_chainId",
    [],
    1,
    fetchImplementation,
  );
  if (
    typeof rawChainId !== "string" ||
    !/^0x[0-9a-fA-F]+$/.test(rawChainId) ||
    BigInt(rawChainId) !== BigInt(environment.CHAIN_ID)
  ) {
    throw new Error(
      `RPC chain identity does not match ${environment.CHAIN_ID}`,
    );
  }

  if (
    environment.AETHELRED_NETWORK_ANCHOR_BLOCK === undefined ||
    !environment.AETHELRED_NETWORK_ANCHOR_HASH
  ) {
    return;
  }
  const blockNumber = `0x${environment.AETHELRED_NETWORK_ANCHOR_BLOCK.toString(16)}`;
  const rawBlock = await rpcCall(
    environment.AETHELRED_RPC_URL,
    "eth_getBlockByNumber",
    [blockNumber, false],
    2,
    fetchImplementation,
  );
  const block = rawBlock as { hash?: unknown } | null;
  if (
    !block ||
    typeof block.hash !== "string" ||
    block.hash.toLowerCase() !==
      environment.AETHELRED_NETWORK_ANCHOR_HASH.toLowerCase()
  ) {
    throw new Error(
      `RPC anchor identity does not match block ${environment.AETHELRED_NETWORK_ANCHOR_BLOCK}`,
    );
  }
}
