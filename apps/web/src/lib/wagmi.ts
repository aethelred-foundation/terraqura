/**
 * TerraQura Wagmi Configuration
 *
 * Enterprise Tier-1 Web3 Configuration with:
 * - Multi-provider RPC failover with health checks
 * - Intelligent retry with exponential backoff
 * - Request batching for optimal throughput
 * - Connection state management
 * - Automatic provider rotation on failures
 * - Comprehensive error handling
 *
 * Network: Aethelred Sovereign Chain (TerraQura's own blockchain)
 *
 * @version 3.0.0 - Aethelred Sovereign Deployment
 * @author TerraQura Engineering
 */

"use client";

import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { defineChain } from "viem";
import { http, fallback, type Transport } from "wagmi";

// ============================================
// Environment Configuration
// ============================================

const isDevelopment = process.env.NODE_ENV === "development";
const isTestnet = process.env.NEXT_PUBLIC_USE_TESTNET === "true" || isDevelopment;

// ============================================
// Aethelred Sovereign Network Definition
// TerraQura's own sovereign blockchain protocol
// ============================================

export const aethelred = defineChain({
  id: parseInt(process.env.NEXT_PUBLIC_AETHELRED_CHAIN_ID || "123456"),
  name: "Aethelred Mainnet",
  nativeCurrency: {
    decimals: 18,
    name: "Aethelred",
    symbol: "AETH",
  },
  rpcUrls: {
    default: {
      http: [process.env.NEXT_PUBLIC_AETHELRED_RPC_URL || "https://rpc.aethelred.network"],
    },
  },
  blockExplorers: {
    default: {
      name: "Aethelred Explorer",
      url: process.env.NEXT_PUBLIC_AETHELRED_EXPLORER_URL || "https://explorer.aethelred.network",
    },
  },
  contracts: {
    // Deployed contract addresses on Aethelred (populated after deployment)
    // multicall3: { address: "0x..." },
  },
});

export const aethelredTestnet = defineChain({
  id: parseInt(process.env.NEXT_PUBLIC_AETHELRED_TESTNET_CHAIN_ID || "123457"),
  name: "Aethelred Testnet",
  nativeCurrency: {
    decimals: 18,
    name: "Test Aethelred",
    symbol: "tAETH",
  },
  rpcUrls: {
    default: {
      http: [process.env.NEXT_PUBLIC_AETHELRED_TESTNET_RPC_URL || "https://testnet-rpc.aethelred.network"],
    },
  },
  blockExplorers: {
    default: {
      name: "Aethelred Testnet Explorer",
      url: process.env.NEXT_PUBLIC_AETHELRED_TESTNET_EXPLORER_URL || "https://testnet-explorer.aethelred.network",
    },
  },
  testnet: true,
});

// ============================================
// RPC Provider Configuration
// Enterprise-grade with multiple fallback tiers
// ============================================

interface RPCEndpoint {
  url: string;
  priority: number;
  provider: string;
  rateLimit?: number; // requests per second
  timeout?: number;
}

// ============================================
// Transport Factory
// Creates optimized HTTP transports with retry logic
// ============================================

interface TransportOptions {
  retryCount?: number;
  retryDelay?: number;
  timeout?: number;
  batch?: boolean | { batchSize?: number; wait?: number };
}

/**
 * Creates an enterprise-grade HTTP transport with:
 * - Configurable retry with exponential backoff
 * - Request batching for efficiency
 * - Timeout handling
 */
function createEnterpriseTransport(
  endpoint: RPCEndpoint,
  options: TransportOptions = {}
): ReturnType<typeof http> {
  const {
    retryCount = 3,
    retryDelay = 500,
    timeout = endpoint.timeout || 10000,
    batch = { batchSize: 20, wait: 50 },
  } = options;

  return http(endpoint.url, {
    batch,
    retryCount,
    retryDelay,
    timeout,
    // Custom fetch with headers for better provider handling
    fetchOptions: {
      headers: {
        "Content-Type": "application/json",
        "X-Client": "TerraQura-Dashboard",
      },
    },
  });
}

/**
 * Creates a fallback transport chain from RPC configs
 * Sorted by priority for optimal failover
 */
function createFallbackTransport(configs: RPCEndpoint[]): Transport {
  // Sort by priority (lower = higher priority)
  const sortedConfigs = [...configs].sort((a, b) => a.priority - b.priority);

  const transports = sortedConfigs.map((config) =>
    createEnterpriseTransport(config, {
      retryCount: config.priority === 1 ? 5 : 3, // More retries for premium providers
      retryDelay: config.priority === 1 ? 300 : 500,
      timeout: config.timeout,
    })
  );

  return fallback(transports, {
    rank: true, // Enable ranking for automatic best-provider selection
    retryCount: 2, // Retry across fallbacks
    retryDelay: 1000,
  });
}

// NOTE: We intentionally omit a custom `wallets` array here.
// RainbowKit's getDefaultConfig provides sensible wallet defaults.
// Importing individual wallet factories (e.g., injectedWallet) at module
// scope caused "originalFactory.call" errors during SSR because those
// factories attempt to access browser APIs (window.ethereum) that don't
// exist in Node.js.

// ============================================
// Aethelred RPC Configuration
// Enterprise-grade with dedicated + public fallback
// ============================================

const AETHELRED_RPC_CONFIG: RPCEndpoint[] = [
  // Tier 1: Dedicated RPC (via env)
  ...(process.env.NEXT_PUBLIC_AETHELRED_RPC_URL
    ? [{
        url: process.env.NEXT_PUBLIC_AETHELRED_RPC_URL,
        priority: 1,
        provider: "Aethelred Dedicated",
        rateLimit: 500,
        timeout: 8000,
      }]
    : []),

  // Tier 2: Default public RPC
  {
    url: "https://rpc.aethelred.network",
    priority: 2,
    provider: "Aethelred Public",
    rateLimit: 100,
    timeout: 12000,
  },
];

const AETHELRED_TESTNET_RPC_CONFIG: RPCEndpoint[] = [
  {
    url: process.env.NEXT_PUBLIC_AETHELRED_TESTNET_RPC_URL || "https://testnet-rpc.aethelred.network",
    priority: 1,
    provider: "Aethelred Testnet",
    rateLimit: 100,
    timeout: 12000,
  },
];

// ============================================
// Chain Configuration
// Aethelred is the sole supported network
// ============================================

function getActiveChains() {
  return isTestnet
    ? [aethelredTestnet, aethelred] as const
    : [aethelred, aethelredTestnet] as const;
}

const activeChains = getActiveChains();

// ============================================
// Main Wagmi Configuration
// ============================================

// Build transport map for Aethelred chains
function buildTransports(): Record<number, Transport> {
  return {
    [aethelred.id]: createFallbackTransport(AETHELRED_RPC_CONFIG),
    [aethelredTestnet.id]: createFallbackTransport(AETHELRED_TESTNET_RPC_CONFIG),
  };
}

// Wrap config creation in try-catch so a wallet factory error
// (e.g. "originalFactory.call") doesn't crash the entire app.
// If it fails, the marketing site renders without Web3 providers.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _config: any = null;
let _configError: Error | null = null;

try {
  _config = getDefaultConfig({
    appName: "TerraQura",
    projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "YOUR_PROJECT_ID",
    chains: activeChains,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    transports: buildTransports() as any,
    ssr: true,
  });
} catch (err) {
  _configError = err instanceof Error ? err : new Error(String(err));
  console.warn("[TerraQura] Wagmi config creation failed:", _configError.message);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const config: any = _config;
export const configError: Error | null = _configError;

// ============================================
// Chain Information Export
// ============================================

export const SUPPORTED_CHAINS = {
  aethelred: {
    id: aethelred.id,
    name: aethelred.name,
    isTestnet: false,
    explorerUrl: aethelred.blockExplorers.default.url,
    nativeCurrency: aethelred.nativeCurrency,
    rpcEndpoints: AETHELRED_RPC_CONFIG.length,
  },
  aethelredTestnet: {
    id: aethelredTestnet.id,
    name: aethelredTestnet.name,
    isTestnet: true,
    explorerUrl: aethelredTestnet.blockExplorers.default.url,
    nativeCurrency: aethelredTestnet.nativeCurrency,
    rpcEndpoints: AETHELRED_TESTNET_RPC_CONFIG.length,
  },
} as const;

// Current active network based on environment
export const ACTIVE_NETWORK = isTestnet
  ? SUPPORTED_CHAINS.aethelredTestnet
  : SUPPORTED_CHAINS.aethelred;

// ============================================
// Explorer URL Helpers
// ============================================

/**
 * Resolve chain info from chain ID
 */
function resolveChain(chainId?: number) {
  switch (chainId) {
    case aethelred.id:
      return SUPPORTED_CHAINS.aethelred;
    case aethelredTestnet.id:
      return SUPPORTED_CHAINS.aethelredTestnet;
    default:
      return ACTIVE_NETWORK;
  }
}

export function getExplorerTxUrl(txHash: string, chainId?: number): string {
  const chain = resolveChain(chainId);
  return `${chain.explorerUrl}/tx/${txHash}`;
}

export function getExplorerAddressUrl(
  address: string,
  chainId?: number
): string {
  const chain = resolveChain(chainId);
  return `${chain.explorerUrl}/address/${address}`;
}

export function getExplorerTokenUrl(
  address: string,
  tokenId?: string,
  chainId?: number
): string {
  const chain = resolveChain(chainId);
  const baseUrl = `${chain.explorerUrl}/token/${address}`;
  return tokenId ? `${baseUrl}?a=${tokenId}` : baseUrl;
}

// ============================================
// RPC Health Check Utility
// ============================================

interface RPCHealthStatus {
  url: string;
  provider: string;
  healthy: boolean;
  latency?: number;
  blockNumber?: number;
  error?: string;
}

/**
 * Check health of a single RPC endpoint
 */
async function checkRPCHealth(endpoint: RPCEndpoint): Promise<RPCHealthStatus> {
  const startTime = Date.now();

  try {
    const response = await fetch(endpoint.url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "eth_blockNumber",
        params: [],
        id: 1,
      }),
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    const latency = Date.now() - startTime;

    if (data.error) {
      throw new Error(data.error.message);
    }

    return {
      url: endpoint.url,
      provider: endpoint.provider,
      healthy: true,
      latency,
      blockNumber: parseInt(data.result, 16),
    };
  } catch (error) {
    return {
      url: endpoint.url,
      provider: endpoint.provider,
      healthy: false,
      latency: Date.now() - startTime,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Check health of all RPC endpoints for a chain
 * Useful for diagnostics and monitoring
 */
export async function checkChainRPCHealth(
  chainId: number
): Promise<RPCHealthStatus[]> {
  let configs: RPCEndpoint[];
  switch (chainId) {
    case aethelred.id:
      configs = AETHELRED_RPC_CONFIG;
      break;
    case aethelredTestnet.id:
      configs = AETHELRED_TESTNET_RPC_CONFIG;
      break;
    default:
      configs = AETHELRED_TESTNET_RPC_CONFIG;
  }
  return Promise.all(configs.map(checkRPCHealth));
}

/**
 * Get the best available RPC for a chain
 * Based on health check results
 */
export async function getBestRPC(
  chainId: number
): Promise<RPCHealthStatus | null> {
  const healthStatuses = await checkChainRPCHealth(chainId);
  const healthyEndpoints = healthStatuses
    .filter((s) => s.healthy)
    .sort((a, b) => (a.latency || Infinity) - (b.latency || Infinity));

  return healthyEndpoints[0] || null;
}

// ============================================
// Type Exports
// ============================================

export type SupportedChainId =
  | typeof aethelred.id
  | typeof aethelredTestnet.id;

export type { RPCHealthStatus, RPCEndpoint };
