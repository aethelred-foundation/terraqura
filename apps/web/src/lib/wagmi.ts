"use client";

import { getDefaultConfig } from "@rainbow-me/rainbowkit";
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

function configurationFailure(): Error | null {
  if (!rpcUrl) {
    return new Error(
      "NEXT_PUBLIC_AETHELRED_TESTNET_RPC_URL is required for wallet operations.",
    );
  }
  if (process.env.NODE_ENV === "production" && !rpcUrl.startsWith("https://")) {
    return new Error("Production wallet RPC must use HTTPS.");
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
    const response = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "eth_blockNumber",
        params: [],
        id: 1,
      }),
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const body = (await response.json()) as {
      result?: string;
      error?: { message?: string };
    };
    if (!body.result || body.error) {
      throw new Error(body.error?.message || "RPC returned no block number");
    }
    return [
      {
        url: rpcUrl,
        provider: "Aethelred Testnet",
        healthy: true,
        latency: Date.now() - startTime,
        blockNumber: Number.parseInt(body.result, 16),
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
