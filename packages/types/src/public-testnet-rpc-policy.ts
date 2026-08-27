export const AETHELRED_PUBLIC_TESTNET_CHAIN_ID = 7332;
export const INSECURE_TESTNET_RPC_ACKNOWLEDGEMENT =
  "acknowledge-evaluation-only-plaintext-rpc";

export interface PublicTestnetRpcPolicyInput {
  production: boolean;
  publicTestnetEvaluation: boolean;
  rpcUrl: string;
  chainId: number;
  acknowledgement?: string;
  anchorBlock?: string;
  anchorHash?: string;
}

export interface PublicTestnetRpcPolicy {
  transport: "https" | "development-http" | "evaluation-http";
  anchor?: {
    blockNumber: number;
    blockHash: string;
  };
}

function configuredAnchor(
  rawBlock: string | undefined,
  rawHash: string | undefined,
): PublicTestnetRpcPolicy["anchor"] {
  const block = rawBlock?.trim();
  const hash = rawHash?.trim();
  if (!block && !hash) {
    return undefined;
  }
  if (!block || !/^\d+$/.test(block)) {
    throw new Error(
      "AETHELRED_NETWORK_ANCHOR_BLOCK must be a decimal block number",
    );
  }
  const blockNumber = Number(block);
  if (!Number.isSafeInteger(blockNumber) || blockNumber < 0) {
    throw new Error("AETHELRED_NETWORK_ANCHOR_BLOCK is outside the safe range");
  }
  if (!hash || !/^0x[a-fA-F0-9]{64}$/.test(hash)) {
    throw new Error(
      "AETHELRED_NETWORK_ANCHOR_HASH must be a 0x-prefixed 32-byte block hash",
    );
  }
  return { blockNumber, blockHash: hash.toLowerCase() };
}

export function resolvePublicTestnetRpcPolicy({
  production,
  publicTestnetEvaluation,
  rpcUrl,
  chainId,
  acknowledgement,
  anchorBlock,
  anchorHash,
}: PublicTestnetRpcPolicyInput): PublicTestnetRpcPolicy {
  let parsed: URL;
  try {
    parsed = new URL(rpcUrl);
  } catch {
    throw new Error("Aethelred RPC URL must be a valid URL");
  }
  const anchor = configuredAnchor(anchorBlock, anchorHash);

  if (production && publicTestnetEvaluation) {
    if (chainId !== AETHELRED_PUBLIC_TESTNET_CHAIN_ID) {
      throw new Error(
        `The public-testnet evaluation profile is restricted to chain ID ${AETHELRED_PUBLIC_TESTNET_CHAIN_ID}`,
      );
    }
    if (!anchor) {
      throw new Error(
        "The public-testnet evaluation profile requires AETHELRED_NETWORK_ANCHOR_BLOCK and AETHELRED_NETWORK_ANCHOR_HASH",
      );
    }
  }

  if (parsed.protocol === "https:") {
    return { transport: "https", anchor };
  }
  if (parsed.protocol !== "http:") {
    throw new Error("Aethelred RPC URL must use HTTP or HTTPS");
  }
  if (!production) {
    return { transport: "development-http", anchor };
  }
  if (!publicTestnetEvaluation) {
    throw new Error(
      "Plaintext RPC is allowed in production only for the explicit public-testnet evaluation profile",
    );
  }
  if (chainId !== AETHELRED_PUBLIC_TESTNET_CHAIN_ID) {
    throw new Error(
      `Plaintext RPC is allowed only for Aethelred public-testnet chain ID ${AETHELRED_PUBLIC_TESTNET_CHAIN_ID}`,
    );
  }
  if (acknowledgement !== INSECURE_TESTNET_RPC_ACKNOWLEDGEMENT) {
    throw new Error(
      `Plaintext public-testnet RPC requires the exact evaluation acknowledgement ${INSECURE_TESTNET_RPC_ACKNOWLEDGEMENT}`,
    );
  }
  if (!anchor) {
    throw new Error(
      "Plaintext public-testnet RPC requires AETHELRED_NETWORK_ANCHOR_BLOCK and AETHELRED_NETWORK_ANCHOR_HASH",
    );
  }
  return { transport: "evaluation-http", anchor };
}
