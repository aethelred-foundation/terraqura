"use client";

import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { resolvePublicTestnetRpcPolicy } from "@terraqura/types";
import { defineChain } from "viem";
import { http } from "wagmi";

import { aethelredWallet } from "./aethelredWallet";
import { BLOCKCHAIN_CONFIGURATION_ERROR, CHAIN_ID } from "./contracts";
import { metaMaskInjectedWallet } from "./metaMaskWallet";
import { TERRAQURA_PUBLIC_URL } from "./publicUrl";

const rpcUrl = process.env.NEXT_PUBLIC_AETHELRED_TESTNET_RPC_URL?.trim() || "";
const explorerUrl =
  process.env.NEXT_PUBLIC_AETHELRED_TESTNET_EXPLORER_URL?.trim().replace(
    /\/+$/,
    "",
  ) || "";
const walletConnectProjectId =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID?.trim() || "";
const deploymentProfile =
  process.env.NEXT_PUBLIC_TERRAQURA_DEPLOYMENT_PROFILE?.trim() ||
  (process.env.NODE_ENV === "production" ? "production" : "development");
const insecureRpcAcknowledgement =
  process.env.NEXT_PUBLIC_ALLOW_INSECURE_TESTNET_RPC?.trim() || "";
const anchorBlock =
  process.env.NEXT_PUBLIC_AETHELRED_NETWORK_ANCHOR_BLOCK?.trim() || "";
const anchorHash =
  process.env.NEXT_PUBLIC_AETHELRED_NETWORK_ANCHOR_HASH?.trim() || "";

let rpcPolicy: ReturnType<typeof resolvePublicTestnetRpcPolicy> | null = null;
let rpcPolicyError: Error | null = null;
if (rpcUrl) {
  try {
    if (
      !["development", "production", "public-testnet-evaluation"].includes(
        deploymentProfile,
      )
    ) {
      throw new Error("Wallet deployment profile is invalid");
    }
    rpcPolicy = resolvePublicTestnetRpcPolicy({
      production: process.env.NODE_ENV === "production",
      publicTestnetEvaluation:
        deploymentProfile === "public-testnet-evaluation",
      rpcUrl,
      chainId: CHAIN_ID,
      acknowledgement: insecureRpcAcknowledgement,
      anchorBlock,
      anchorHash,
    });
  } catch (cause) {
    rpcPolicyError =
      cause instanceof Error
        ? cause
        : new Error("Wallet RPC policy is invalid");
  }
}

function configurationFailure(): Error | null {
  if (!rpcUrl) {
    return new Error(
      "NEXT_PUBLIC_AETHELRED_TESTNET_RPC_URL is required for wallet operations.",
    );
  }
  if (rpcPolicyError) {
    return rpcPolicyError;
  }
  if (BLOCKCHAIN_CONFIGURATION_ERROR) {
    return new Error(BLOCKCHAIN_CONFIGURATION_ERROR);
  }
  if (!walletConnectProjectId) {
    return new Error(
      "NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID is required for wallet operations.",
    );
  }
  return null;
}

export const aethelredTestnet = defineChain({
  id: CHAIN_ID,
  name: "Aethelred Testnet",
  nativeCurrency: {
    decimals: 18,
    name: "Aethelred",
    symbol: "AETH",
  },
  rpcUrls: {
    default: {
      http: [rpcUrl || "http://127.0.0.1:8545"],
    },
  },
  ...(explorerUrl
    ? {
        blockExplorers: {
          default: {
            name: "Aethelred Testnet Explorer",
            url: explorerUrl,
          },
        },
      }
    : {}),
  testnet: true,
});

let configError = configurationFailure();
let config: ReturnType<typeof getDefaultConfig> | null = null;

if (!configError) {
  try {
    config = getDefaultConfig({
      appName: "TerraQura",
      appDescription:
        "Carbon project, MRV, verification, issuance, trading, and retirement on Aethelred",
      appUrl: TERRAQURA_PUBLIC_URL,
      wallets: [
        {
          groupName: "Aethelred ecosystem",
          wallets: [aethelredWallet],
        },
        {
          groupName: "Other compatible wallets",
          wallets: [metaMaskInjectedWallet],
        },
      ],
      projectId: walletConnectProjectId,
      chains: [aethelredTestnet],
      transports: {
        [aethelredTestnet.id]: http(rpcUrl, {
          batch: { batchSize: 20, wait: 50 },
          retryCount: 3,
          retryDelay: 500,
          timeout: 12_000,
        }),
      },
      ssr: true,
    });
  } catch (cause) {
    configError =
      cause instanceof Error ? cause : new Error("Wallet setup failed");
  }
}

export { config, configError };

export const RPC_EVALUATION_MODE =
  deploymentProfile === "public-testnet-evaluation";
export const RPC_PLAINTEXT_EVALUATION_MODE =
  rpcPolicy?.transport === "evaluation-http";

async function rpcRequest(method: string, params: unknown[]): Promise<unknown> {
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", method, params, id: 1 }),
    signal: AbortSignal.timeout(5_000),
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

export async function verifyConfiguredRpcIdentity(): Promise<void> {
  if (!rpcUrl || !rpcPolicy) {
    throw configError || new Error("Wallet RPC is not configured");
  }
  const rawChainId = await rpcRequest("eth_chainId", []);
  if (
    typeof rawChainId !== "string" ||
    !/^0x[0-9a-fA-F]+$/.test(rawChainId) ||
    BigInt(rawChainId) !== BigInt(CHAIN_ID)
  ) {
    throw new Error(`Wallet RPC chain identity does not match ${CHAIN_ID}`);
  }
  if (!rpcPolicy.anchor) {
    return;
  }
  const rawBlock = await rpcRequest("eth_getBlockByNumber", [
    `0x${rpcPolicy.anchor.blockNumber.toString(16)}`,
    false,
  ]);
  const block = rawBlock as { hash?: unknown } | null;
  if (
    !block ||
    typeof block.hash !== "string" ||
    block.hash.toLowerCase() !== rpcPolicy.anchor.blockHash
  ) {
    throw new Error(
      `Wallet RPC anchor identity does not match block ${rpcPolicy.anchor.blockNumber}`,
    );
  }
}

export const SUPPORTED_CHAINS = {
  aethelredTestnet: {
    id: aethelredTestnet.id,
    name: aethelredTestnet.name,
    isTestnet: true,
    explorerUrl,
    nativeCurrency: aethelredTestnet.nativeCurrency,
    rpcEndpoints: rpcUrl ? 1 : 0,
  },
} as const;

export const ACTIVE_NETWORK = SUPPORTED_CHAINS.aethelredTestnet;

export function getExplorerTxUrl(txHash: string, _chainId?: number): string {
  return explorerUrl ? `${explorerUrl}/tx/${txHash}` : "";
}

export function getExplorerAddressUrl(
  address: string,
  _chainId?: number,
): string {
  return explorerUrl ? `${explorerUrl}/address/${address}` : "";
}

export function getExplorerTokenUrl(
  address: string,
  tokenId?: string,
  _chainId?: number,
): string {
  if (!explorerUrl) return "";
  const url = new URL(`/token/${address}`, explorerUrl);
  if (tokenId) {
    url.searchParams.set("a", tokenId);
  }
  return url.toString();
}

export interface RPCHealthStatus {
  url: string;
  provider: string;
  healthy: boolean;
  latency?: number;
  blockNumber?: number;
  error?: string;
}

export async function checkChainRPCHealth(
  chainId: number,
): Promise<RPCHealthStatus[]> {
  if (chainId !== CHAIN_ID || !rpcUrl) return [];
  const startTime = Date.now();
  try {
    await verifyConfiguredRpcIdentity();
    const blockNumber = await rpcRequest("eth_blockNumber", []);
    if (typeof blockNumber !== "string") {
      throw new Error("RPC returned no block number");
    }
    return [
      {
        url: rpcUrl,
        provider: "Aethelred Testnet",
        healthy: true,
        latency: Date.now() - startTime,
        blockNumber: Number.parseInt(blockNumber, 16),
      },
    ];
  } catch (cause) {
    return [
      {
        url: rpcUrl,
        provider: "Aethelred Testnet",
        healthy: false,
        latency: Date.now() - startTime,
        error: cause instanceof Error ? cause.message : "RPC request failed",
      },
    ];
  }
}

export async function getBestRPC(
  chainId: number,
): Promise<RPCHealthStatus | null> {
  const statuses = await checkChainRPCHealth(chainId);
  return statuses.find((status) => status.healthy) || null;
}

export type SupportedChainId = typeof aethelredTestnet.id;
