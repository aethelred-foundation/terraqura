export const AETHELRED_PUBLIC_TESTNET_CHAIN_ID = 7332;
export const INSECURE_TESTNET_RPC_ACKNOWLEDGEMENT =
  "acknowledge-evaluation-only-plaintext-rpc";

type DeploymentEnvironment = NodeJS.ProcessEnv;

export interface PublicTestnetRpcPolicy {
  url: string;
  expectedChainId: number;
  transport: "https" | "evaluation-http";
  anchor?: {
    blockNumber: number;
    blockHash: string;
  };
}

interface BlockProvider {
  getBlock(blockNumber: number): Promise<{ hash?: string | null } | null>;
}

interface ChainIdProvider {
  send(method: string, params: unknown[]): Promise<unknown>;
}

function requiredChainId(environment: DeploymentEnvironment): number {
  const raw = environment.AETHELRED_TESTNET_CHAIN_ID?.trim();
  if (!raw || !/^\d+$/.test(raw)) {
    throw new Error(
      "AETHELRED_TESTNET_CHAIN_ID must be configured as an integer",
    );
  }
  const chainId = Number(raw);
  if (!Number.isSafeInteger(chainId) || chainId <= 0) {
    throw new Error("AETHELRED_TESTNET_CHAIN_ID must be a positive integer");
  }
  return chainId;
}

function configuredAnchor(
  environment: DeploymentEnvironment,
): PublicTestnetRpcPolicy["anchor"] {
  const rawBlock = environment.AETHELRED_NETWORK_ANCHOR_BLOCK?.trim();
  const rawHash = environment.AETHELRED_NETWORK_ANCHOR_HASH?.trim();
  if (!rawBlock && !rawHash) {
    return undefined;
  }
  if (!rawBlock || !/^\d+$/.test(rawBlock)) {
    throw new Error(
      "AETHELRED_NETWORK_ANCHOR_BLOCK must be configured as a decimal block number when an RPC anchor is used",
    );
  }
  const blockNumber = Number(rawBlock);
  if (!Number.isSafeInteger(blockNumber) || blockNumber < 0) {
    throw new Error("AETHELRED_NETWORK_ANCHOR_BLOCK is outside the safe range");
  }
  if (!rawHash || !/^0x[a-fA-F0-9]{64}$/.test(rawHash)) {
    throw new Error(
      "AETHELRED_NETWORK_ANCHOR_HASH must be a 0x-prefixed 32-byte block hash",
    );
  }
  return { blockNumber, blockHash: rawHash.toLowerCase() };
}

export function readPublicTestnetRpcPolicy(
  environment: DeploymentEnvironment = process.env,
): PublicTestnetRpcPolicy {
  const rawUrl = environment.AETHELRED_TESTNET_RPC_URL?.trim();
  if (!rawUrl) {
    throw new Error("AETHELRED_TESTNET_RPC_URL must be configured");
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error("AETHELRED_TESTNET_RPC_URL must be a valid URL");
  }
  const expectedChainId = requiredChainId(environment);
  const anchor = configuredAnchor(environment);
  const acknowledgement = environment.ALLOW_INSECURE_TESTNET_RPC?.trim();

  if (parsed.protocol === "https:") {
    if (
      acknowledgement &&
      acknowledgement !== INSECURE_TESTNET_RPC_ACKNOWLEDGEMENT
    ) {
      throw new Error(
        "ALLOW_INSECURE_TESTNET_RPC contains an invalid acknowledgement value",
      );
    }
    return {
      url: rawUrl.replace(/\/+$/, ""),
      expectedChainId,
      transport: "https",
      anchor,
    };
  }

  if (parsed.protocol !== "http:") {
    throw new Error("AETHELRED_TESTNET_RPC_URL must use HTTPS by default");
  }
  if (expectedChainId !== AETHELRED_PUBLIC_TESTNET_CHAIN_ID) {
    throw new Error(
      `Plaintext RPC is allowed only for Aethelred public-testnet chain ID ${AETHELRED_PUBLIC_TESTNET_CHAIN_ID}`,
    );
  }
  if (acknowledgement !== INSECURE_TESTNET_RPC_ACKNOWLEDGEMENT) {
    throw new Error(
      `Plaintext public-testnet RPC requires ALLOW_INSECURE_TESTNET_RPC=${INSECURE_TESTNET_RPC_ACKNOWLEDGEMENT}`,
    );
  }
  if (!anchor) {
    throw new Error(
      "Plaintext public-testnet RPC requires AETHELRED_NETWORK_ANCHOR_BLOCK and AETHELRED_NETWORK_ANCHOR_HASH",
    );
  }

  return {
    url: rawUrl.replace(/\/+$/, ""),
    expectedChainId,
    transport: "evaluation-http",
    anchor,
  };
}

export async function assertRpcAnchor(
  provider: BlockProvider,
  policy: PublicTestnetRpcPolicy,
): Promise<void> {
  if (!policy.anchor) {
    return;
  }
  const block = await provider.getBlock(policy.anchor.blockNumber);
  if (!block?.hash) {
    throw new Error(
      `RPC did not return anchor block ${policy.anchor.blockNumber}`,
    );
  }
  if (block.hash.toLowerCase() !== policy.anchor.blockHash) {
    throw new Error(
      `RPC anchor mismatch at block ${policy.anchor.blockNumber}; expected ${policy.anchor.blockHash}, received ${block.hash.toLowerCase()}`,
    );
  }
}

export async function assertRpcChainId(
  provider: ChainIdProvider,
  policy: PublicTestnetRpcPolicy,
): Promise<void> {
  const rawChainId = await provider.send("eth_chainId", []);
  if (typeof rawChainId !== "string" || !/^0x[0-9a-fA-F]+$/.test(rawChainId)) {
    throw new Error("RPC eth_chainId returned an invalid result");
  }
  const chainId = BigInt(rawChainId);
  if (chainId !== BigInt(policy.expectedChainId)) {
    throw new Error(
      `RPC chain mismatch: expected ${policy.expectedChainId}, received ${chainId}`,
    );
  }
}
