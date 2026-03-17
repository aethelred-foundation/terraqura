/**
 * TerraQura Contract Data Hooks
 *
 * Enterprise-grade React hooks for real-time blockchain data
 * with automatic refresh, error handling, and caching
 * Updated to match actual deployed contracts
 */

"use client";

import { useReadContract, useReadContracts, useWatchContractEvent } from "wagmi";
import { useQueryClient } from "@tanstack/react-query";
import { type Address } from "viem";
import { useMemo } from "react";
import { CONTRACTS, CHAIN_ID } from "@/lib/contracts";
import {
  CarbonCreditABI,
  CarbonMarketplaceABI,
  VerificationEngineABI,
  CircuitBreakerABI,
  AccessControlABI,
  MultisigABI,
  TimelockABI,
  NativeIoTOracleABI,
  ROLES,
} from "@/lib/abis";

// ============================================
// Types
// ============================================

export interface SystemStatus {
  isOperational: boolean;
  globalPause: boolean;
  emergencyLevel: number;
  monitoredContractsCount: number;
  lastUpdated: Date;
}

export interface CarbonCreditData {
  dacUnitId: string;
  sourceDataHash: string;
  captureTimestamp: number;
  co2AmountKg: bigint;
  energyConsumedKwh: bigint;
  latitude: bigint;
  longitude: bigint;
  purityPercentage: number;
  isRetired: boolean;
  ipfsMetadataUri: string;
  arweaveBackupTxId: string;
}

export interface VerificationResult {
  sourceVerified: boolean;
  logicVerified: boolean;
  mintVerified: boolean;
  efficiencyFactor: bigint;
  verifiedAt: bigint;
}

export interface MarketplaceListing {
  listingId: bigint;
  seller: Address;
  tokenId: bigint;
  amount: bigint;
  pricePerUnit: bigint;
  minPurchaseAmount: bigint;
  isActive: boolean;
  createdAt: bigint;
  expiresAt: bigint;
}

export interface GovernanceStats {
  multisigSigners: Address[];
  multisigThreshold: bigint;
  pendingTransactions: bigint;
  timelockDelay: bigint;
}

export interface PlatformStats {
  totalCreditsMinted: bigint;
  totalCreditsRetired: bigint;
  platformFeeBps: bigint;
  feeRecipient: Address;
  marketplacePaused: boolean;
  nextListingId: bigint;
}

export interface ContractEventLog {
  eventName: string;
  args: Record<string, unknown>;
  blockNumber: bigint;
  transactionHash: string;
  timestamp?: Date;
}


// ============================================
// Core Hooks
// ============================================

/**
 * Hook to get circuit breaker system status
 * Automatically refreshes every 30 seconds
 */
export function useSystemStatus(): {
  status: SystemStatus | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
} {
  const { data, isLoading, error, refetch } = useReadContract({
    address: CONTRACTS.circuitBreaker as Address,
    abi: CircuitBreakerABI,
    functionName: "getStatus",
    chainId: CHAIN_ID,
    query: {
      refetchInterval: 30000,
      staleTime: 10000,
    },
  });

  const status = useMemo<SystemStatus | null>(() => {
    if (!data) return null;
    const [isGloballyPaused, currentLevel, monitoredCount] = data as [
      boolean,
      number,
      bigint
    ];
    return {
      isOperational: !isGloballyPaused,
      globalPause: isGloballyPaused,
      emergencyLevel: currentLevel,
      monitoredContractsCount: Number(monitoredCount),
      lastUpdated: new Date(),
    };
  }, [data]);

  return {
    status,
    isLoading,
    error: error as Error | null,
    refetch,
  };
}

/**
 * Hook to check if specific contract operations are allowed
 */
export function useContractOperational(contractAddress: Address): {
  isOperational: boolean | undefined;
  isLoading: boolean;
  error: Error | null;
} {
  const { data, isLoading, error } = useReadContract({
    address: CONTRACTS.circuitBreaker as Address,
    abi: CircuitBreakerABI,
    functionName: "isOperationAllowed",
    args: [contractAddress],
    chainId: CHAIN_ID,
    query: {
      refetchInterval: 15000,
    },
  });

  return {
    isOperational: data as boolean | undefined,
    isLoading,
    error: error as Error | null,
  };
}

/**
 * Hook to get carbon credit metadata by token ID
 */
export function useCarbonCredit(tokenId: bigint | undefined): {
  creditData: CarbonCreditData | null;
  isLoading: boolean;
  error: Error | null;
} {
  const { data, isLoading, error } = useReadContract({
    address: CONTRACTS.carbonCredit as Address,
    abi: CarbonCreditABI,
    functionName: "getMetadata",
    args: tokenId !== undefined ? [tokenId] : undefined,
    chainId: CHAIN_ID,
    query: {
      enabled: tokenId !== undefined,
    },
  });

  const creditData = useMemo<CarbonCreditData | null>(() => {
    if (!data) return null;
    // getMetadata returns a tuple struct
    const metadata = data as {
      dacUnitId: string;
      sourceDataHash: string;
      captureTimestamp: bigint;
      co2AmountKg: bigint;
      energyConsumedKwh: bigint;
      latitude: bigint;
      longitude: bigint;
      purityPercentage: number;
      isRetired: boolean;
      ipfsMetadataUri: string;
      arweaveBackupTxId: string;
    };
    return {
      dacUnitId: metadata.dacUnitId,
      sourceDataHash: metadata.sourceDataHash,
      captureTimestamp: Number(metadata.captureTimestamp),
      co2AmountKg: metadata.co2AmountKg,
      energyConsumedKwh: metadata.energyConsumedKwh,
      latitude: metadata.latitude,
      longitude: metadata.longitude,
      purityPercentage: metadata.purityPercentage,
      isRetired: metadata.isRetired,
      ipfsMetadataUri: metadata.ipfsMetadataUri,
      arweaveBackupTxId: metadata.arweaveBackupTxId,
    };
  }, [data]);

  return {
    creditData,
    isLoading,
    error: error as Error | null,
  };
}

/**
 * Hook to get verification result for a token
 */
export function useVerificationResult(tokenId: bigint | undefined): {
  verification: VerificationResult | null;
  isLoading: boolean;
  error: Error | null;
} {
  const { data, isLoading, error } = useReadContract({
    address: CONTRACTS.carbonCredit as Address,
    abi: CarbonCreditABI,
    functionName: "getVerificationResult",
    args: tokenId !== undefined ? [tokenId] : undefined,
    chainId: CHAIN_ID,
    query: {
      enabled: tokenId !== undefined,
    },
  });

  const verification = useMemo<VerificationResult | null>(() => {
    if (!data) return null;
    const result = data as {
      sourceVerified: boolean;
      logicVerified: boolean;
      mintVerified: boolean;
      efficiencyFactor: bigint;
      verifiedAt: bigint;
    };
    return {
      sourceVerified: result.sourceVerified,
      logicVerified: result.logicVerified,
      mintVerified: result.mintVerified,
      efficiencyFactor: result.efficiencyFactor,
      verifiedAt: result.verifiedAt,
    };
  }, [data]);

  return {
    verification,
    isLoading,
    error: error as Error | null,
  };
}

/**
 * Hook to get user's carbon credit balance for a specific token
 */
export function useCreditBalance(
  userAddress: Address | undefined,
  tokenId: bigint
): {
  balance: bigint | undefined;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
} {
  const { data, isLoading, error, refetch } = useReadContract({
    address: CONTRACTS.carbonCredit as Address,
    abi: CarbonCreditABI,
    functionName: "balanceOf",
    args: userAddress ? [userAddress, tokenId] : undefined,
    chainId: CHAIN_ID,
    query: {
      enabled: !!userAddress,
      refetchInterval: 30000,
    },
  });

  return {
    balance: data as bigint | undefined,
    isLoading,
    error: error as Error | null,
    refetch,
  };
}

/**
 * Hook to get total credits minted
 */
export function useTotalCreditsMinted(): {
  totalMinted: bigint | undefined;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
} {
  const { data, isLoading, error, refetch } = useReadContract({
    address: CONTRACTS.carbonCredit as Address,
    abi: CarbonCreditABI,
    functionName: "totalCreditsMinted",
    chainId: CHAIN_ID,
    query: {
      refetchInterval: 60000,
    },
  });

  return {
    totalMinted: data as bigint | undefined,
    isLoading,
    error: error as Error | null,
    refetch,
  };
}

/**
 * Hook to get total credits retired
 */
export function useTotalCreditsRetired(): {
  totalRetired: bigint | undefined;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
} {
  const { data, isLoading, error, refetch } = useReadContract({
    address: CONTRACTS.carbonCredit as Address,
    abi: CarbonCreditABI,
    functionName: "totalCreditsRetired",
    chainId: CHAIN_ID,
    query: {
      refetchInterval: 60000,
    },
  });

  return {
    totalRetired: data as bigint | undefined,
    isLoading,
    error: error as Error | null,
    refetch,
  };
}

/**
 * Hook to get marketplace listing details
 */
export function useMarketplaceListing(listingId: bigint | undefined): {
  listing: MarketplaceListing | null;
  isLoading: boolean;
  error: Error | null;
} {
  const { data, isLoading, error } = useReadContract({
    address: CONTRACTS.carbonMarketplace as Address,
    abi: CarbonMarketplaceABI,
    functionName: "getListing",
    args: listingId !== undefined ? [listingId] : undefined,
    chainId: CHAIN_ID,
    query: {
      enabled: listingId !== undefined,
      refetchInterval: 15000,
    },
  });

  const listing = useMemo<MarketplaceListing | null>(() => {
    if (!data || listingId === undefined) return null;
    const result = data as {
      listingId: bigint;
      seller: Address;
      tokenId: bigint;
      amount: bigint;
      pricePerUnit: bigint;
      minPurchaseAmount: bigint;
      isActive: boolean;
      createdAt: bigint;
      expiresAt: bigint;
    };
    return {
      listingId: result.listingId,
      seller: result.seller,
      tokenId: result.tokenId,
      amount: result.amount,
      pricePerUnit: result.pricePerUnit,
      minPurchaseAmount: result.minPurchaseAmount,
      isActive: result.isActive,
      createdAt: result.createdAt,
      expiresAt: result.expiresAt,
    };
  }, [data, listingId]);

  return {
    listing,
    isLoading,
    error: error as Error | null,
  };
}

/**
 * Hook to get platform statistics
 * Uses actual contract functions that exist
 */
export function usePlatformStats(): {
  stats: PlatformStats | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
} {
  const results = useReadContracts({
    contracts: [
      {
        address: CONTRACTS.carbonCredit as Address,
        abi: CarbonCreditABI,
        functionName: "totalCreditsMinted",
        chainId: CHAIN_ID,
      },
      {
        address: CONTRACTS.carbonCredit as Address,
        abi: CarbonCreditABI,
        functionName: "totalCreditsRetired",
        chainId: CHAIN_ID,
      },
      {
        address: CONTRACTS.carbonMarketplace as Address,
        abi: CarbonMarketplaceABI,
        functionName: "platformFeeBps",
        chainId: CHAIN_ID,
      },
      {
        address: CONTRACTS.carbonMarketplace as Address,
        abi: CarbonMarketplaceABI,
        functionName: "feeRecipient",
        chainId: CHAIN_ID,
      },
      {
        address: CONTRACTS.carbonMarketplace as Address,
        abi: CarbonMarketplaceABI,
        functionName: "paused",
        chainId: CHAIN_ID,
      },
      {
        address: CONTRACTS.carbonMarketplace as Address,
        abi: CarbonMarketplaceABI,
        functionName: "nextListingId",
        chainId: CHAIN_ID,
      },
    ],
    query: {
      refetchInterval: 60000,
    },
  });

  const stats = useMemo<PlatformStats | null>(() => {
    if (!results.data || results.data.some((r) => r.status === "failure")) {
      return null;
    }
    return {
      totalCreditsMinted: (results.data[0].result as bigint) ?? 0n,
      totalCreditsRetired: (results.data[1].result as bigint) ?? 0n,
      platformFeeBps: (results.data[2].result as bigint) ?? 0n,
      feeRecipient: (results.data[3].result as Address) ?? "0x0000000000000000000000000000000000000000",
      marketplacePaused: (results.data[4].result as boolean) ?? false,
      nextListingId: (results.data[5].result as bigint) ?? 1n,
    };
  }, [results.data]);

  return {
    stats,
    isLoading: results.isLoading,
    error: results.error as Error | null,
    refetch: results.refetch,
  };
}

/**
 * Hook to get governance statistics
 * Uses actual contract functions that exist
 */
export function useGovernanceStats(): {
  stats: GovernanceStats | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
} {
  const results = useReadContracts({
    contracts: [
      {
        address: CONTRACTS.multisig as Address,
        abi: MultisigABI,
        functionName: "getSigners",
        chainId: CHAIN_ID,
      },
      {
        address: CONTRACTS.multisig as Address,
        abi: MultisigABI,
        functionName: "threshold",
        chainId: CHAIN_ID,
      },
      {
        address: CONTRACTS.multisig as Address,
        abi: MultisigABI,
        functionName: "nonce",
        chainId: CHAIN_ID,
      },
      {
        address: CONTRACTS.timelock as Address,
        abi: TimelockABI,
        functionName: "getMinDelay",
        chainId: CHAIN_ID,
      },
    ],
    query: {
      refetchInterval: 60000,
    },
  });

  const stats = useMemo<GovernanceStats | null>(() => {
    if (!results.data || results.data.some((r) => r.status === "failure")) {
      return null;
    }
    return {
      multisigSigners: (results.data[0].result as Address[]) ?? [],
      multisigThreshold: (results.data[1].result as bigint) ?? 0n,
      pendingTransactions: (results.data[2].result as bigint) ?? 0n,
      timelockDelay: (results.data[3].result as bigint) ?? 0n,
    };
  }, [results.data]);

  return {
    stats,
    isLoading: results.isLoading,
    error: results.error as Error | null,
    refetch: results.refetch,
  };
}

/**
 * Hook to check if user has a specific role
 */
export function useHasRole(
  userAddress: Address | undefined,
  roleName: keyof typeof ROLES
): {
  hasRole: boolean | undefined;
  isLoading: boolean;
  error: Error | null;
} {
  const { data, isLoading, error } = useReadContract({
    address: CONTRACTS.accessControl as Address,
    abi: AccessControlABI,
    functionName: "hasRole",
    args: userAddress ? [ROLES[roleName], userAddress] : undefined,
    chainId: CHAIN_ID,
    query: {
      enabled: !!userAddress,
    },
  });

  return {
    hasRole: data as boolean | undefined,
    isLoading,
    error: error as Error | null,
  };
}

/**
 * Hook to check if a DAC unit is whitelisted
 */
export function useDacWhitelisted(dacUnitId: string | undefined): {
  isWhitelisted: boolean | undefined;
  isLoading: boolean;
  error: Error | null;
} {
  const { data, isLoading, error } = useReadContract({
    address: CONTRACTS.verificationEngine as Address,
    abi: VerificationEngineABI,
    functionName: "isWhitelisted",
    args: dacUnitId ? [dacUnitId as `0x${string}`] : undefined,
    chainId: CHAIN_ID,
    query: {
      enabled: !!dacUnitId,
    },
  });

  return {
    isWhitelisted: data as boolean | undefined,
    isLoading,
    error: error as Error | null,
  };
}

/**
 * Hook to get verification thresholds
 */
export function useVerificationThresholds(): {
  thresholds: {
    minKwh: bigint;
    maxKwh: bigint;
    optimalKwh: bigint;
    minPurity: number;
  } | null;
  isLoading: boolean;
  error: Error | null;
} {
  const { data, isLoading, error } = useReadContract({
    address: CONTRACTS.verificationEngine as Address,
    abi: VerificationEngineABI,
    functionName: "getVerificationThresholds",
    chainId: CHAIN_ID,
  });

  const thresholds = useMemo(() => {
    if (!data) return null;
    const [minKwh, maxKwh, optimalKwh, minPurity] = data as [bigint, bigint, bigint, number];
    return { minKwh, maxKwh, optimalKwh, minPurity };
  }, [data]);

  return {
    thresholds,
    isLoading,
    error: error as Error | null,
  };
}

// ============================================
// Event Watching Hooks
// ============================================

/**
 * Hook to watch for new credit mints
 */
export function useWatchCreditMints(
  onMint?: (log: ContractEventLog) => void
): void {
  const queryClient = useQueryClient();

  useWatchContractEvent({
    address: CONTRACTS.carbonCredit as Address,
    abi: CarbonCreditABI,
    eventName: "CreditMinted",
    chainId: CHAIN_ID,
    onLogs: (logs) => {
      logs.forEach((log) => {
        const typedLog = log as typeof log & { args: Record<string, unknown> };
        const eventLog: ContractEventLog = {
          eventName: "CreditMinted",
          args: typedLog.args || {},
          blockNumber: log.blockNumber ?? 0n,
          transactionHash: log.transactionHash ?? "",
        };
        onMint?.(eventLog);
      });
      queryClient.invalidateQueries({ queryKey: ["readContract"] });
    },
  });
}

/**
 * Hook to watch for marketplace purchases
 */
export function useWatchMarketplaceSales(
  onSale?: (log: ContractEventLog) => void
): void {
  const queryClient = useQueryClient();

  useWatchContractEvent({
    address: CONTRACTS.carbonMarketplace as Address,
    abi: CarbonMarketplaceABI,
    eventName: "Purchase",
    chainId: CHAIN_ID,
    onLogs: (logs) => {
      logs.forEach((log) => {
        const typedLog = log as typeof log & { args: Record<string, unknown> };
        const eventLog: ContractEventLog = {
          eventName: "Purchase",
          args: typedLog.args || {},
          blockNumber: log.blockNumber ?? 0n,
          transactionHash: log.transactionHash ?? "",
        };
        onSale?.(eventLog);
      });
      queryClient.invalidateQueries({ queryKey: ["readContract"] });
    },
  });
}

/**
 * Hook to watch for emergency events
 */
export function useWatchEmergencyEvents(
  onEmergency?: (log: ContractEventLog) => void
): void {
  useWatchContractEvent({
    address: CONTRACTS.circuitBreaker as Address,
    abi: CircuitBreakerABI,
    eventName: "GlobalPauseActivated",
    chainId: CHAIN_ID,
    onLogs: (logs) => {
      logs.forEach((log) => {
        const typedLog = log as typeof log & { args: Record<string, unknown> };
        const eventLog: ContractEventLog = {
          eventName: "GlobalPauseActivated",
          args: typedLog.args || {},
          blockNumber: log.blockNumber ?? 0n,
          transactionHash: log.transactionHash ?? "",
        };
        onEmergency?.(eventLog);
      });
    },
  });
}

// ============================================
// Utility Hooks
// ============================================

/**
 * Hook for comprehensive dashboard data
 * Combines multiple data sources for the executive dashboard
 */
export function useDashboardData(): {
  systemStatus: SystemStatus | null;
  platformStats: PlatformStats | null;
  governanceStats: GovernanceStats | null;
  isLoading: boolean;
  isReady: boolean;
} {
  const { status: systemStatus, isLoading: systemLoading } = useSystemStatus();
  const { stats: platformStats, isLoading: platformLoading } =
    usePlatformStats();
  const { stats: governanceStats, isLoading: governanceLoading } =
    useGovernanceStats();

  const isLoading =
    systemLoading || platformLoading || governanceLoading;

  return {
    systemStatus,
    platformStats,
    governanceStats,
    isLoading,
    isReady: !isLoading && !!systemStatus && !!platformStats && !!governanceStats,
  };
}

// Legacy export for backwards compatibility
export function useNextTokenId(): {
  nextTokenId: bigint | undefined;
  totalMinted: number;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
} {
  const { totalMinted, isLoading, error, refetch } = useTotalCreditsMinted();

  return {
    nextTokenId: totalMinted,
    totalMinted: totalMinted ? Number(totalMinted) : 0,
    isLoading,
    error,
    refetch,
  };
}

// ============================================
// NativeIoTOracle Hooks
// Sovereign 1st-party oracle data for Aethelred deployment
// ============================================

export interface OracleSensorData {
  co2Captured: bigint;
  energyUsed: bigint;
  timestamp: bigint;
  anomalyFlag: boolean;
  satelliteCID: string;
}

export interface OracleDeviceStatus {
  dacId: string;
  latestData: OracleSensorData | null;
  isFresh: boolean;
  age: number;
  anomalyCount: number;
  isSuspended: boolean;
  historyCount: number;
}

/**
 * Hook to get latest sensor data from NativeIoTOracle for a specific device
 * Automatically refreshes every 15 seconds for near-real-time monitoring
 */
export function useOracleSensorData(dacId: string | undefined): {
  sensorData: OracleSensorData | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
} {
  const oracleAddress = CONTRACTS.nativeIoTOracle as Address;
  const isConfigured = oracleAddress !== "0x0000000000000000000000000000000000000000";

  const { data, isLoading, error, refetch } = useReadContract({
    address: oracleAddress,
    abi: NativeIoTOracleABI,
    functionName: "getLatestData",
    args: dacId ? [dacId] : undefined,
    chainId: CHAIN_ID,
    query: {
      enabled: !!dacId && isConfigured,
      refetchInterval: 15000,
      staleTime: 5000,
    },
  });

  const sensorData = useMemo<OracleSensorData | null>(() => {
    if (!data) return null;
    const d = data as {
      co2Captured: bigint;
      energyUsed: bigint;
      timestamp: bigint;
      anomalyFlag: boolean;
      satelliteCID: string;
    };
    // Return null if no data ever submitted (timestamp is 0)
    if (d.timestamp === 0n) return null;
    return {
      co2Captured: d.co2Captured,
      energyUsed: d.energyUsed,
      timestamp: d.timestamp,
      anomalyFlag: d.anomalyFlag,
      satelliteCID: d.satelliteCID,
    };
  }, [data]);

  return {
    sensorData,
    isLoading,
    error: error as Error | null,
    refetch,
  };
}

/**
 * Hook to check data freshness for a device
 */
export function useOracleDataFreshness(dacId: string | undefined): {
  isFresh: boolean | undefined;
  lastTimestamp: number;
  age: number;
  isLoading: boolean;
} {
  const oracleAddress = CONTRACTS.nativeIoTOracle as Address;
  const isConfigured = oracleAddress !== "0x0000000000000000000000000000000000000000";

  const { data, isLoading } = useReadContract({
    address: oracleAddress,
    abi: NativeIoTOracleABI,
    functionName: "isDataFresh",
    args: dacId ? [dacId] : undefined,
    chainId: CHAIN_ID,
    query: {
      enabled: !!dacId && isConfigured,
      refetchInterval: 30000,
    },
  });

  return useMemo(() => {
    if (!data) return { isFresh: undefined, lastTimestamp: 0, age: 0, isLoading };
    const [fresh, ts, a] = data as [boolean, bigint, bigint];
    return {
      isFresh: fresh,
      lastTimestamp: Number(ts),
      age: Number(a),
      isLoading,
    };
  }, [data, isLoading]);
}

/**
 * Hook to get all registered devices and their oracle stats
 */
export function useOracleDevices(): {
  devices: string[];
  totalSubmissions: bigint | undefined;
  deviceCount: number;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
} {
  const oracleAddress = CONTRACTS.nativeIoTOracle as Address;
  const isConfigured = oracleAddress !== "0x0000000000000000000000000000000000000000";

  const results = useReadContracts({
    contracts: [
      {
        address: oracleAddress,
        abi: NativeIoTOracleABI,
        functionName: "getRegisteredDevices",
        chainId: CHAIN_ID,
      },
      {
        address: oracleAddress,
        abi: NativeIoTOracleABI,
        functionName: "totalSubmissions",
        chainId: CHAIN_ID,
      },
      {
        address: oracleAddress,
        abi: NativeIoTOracleABI,
        functionName: "getDeviceCount",
        chainId: CHAIN_ID,
      },
    ],
    query: {
      enabled: isConfigured,
      refetchInterval: 30000,
    },
  });

  return useMemo(() => {
    const devices = (results.data?.[0]?.result as string[]) ?? [];
    const totalSubmissions = results.data?.[1]?.result as bigint | undefined;
    const deviceCount = Number((results.data?.[2]?.result as bigint) ?? 0n);

    return {
      devices,
      totalSubmissions,
      deviceCount,
      isLoading: results.isLoading,
      error: results.error as Error | null,
      refetch: results.refetch,
    };
  }, [results]);
}

/**
 * Hook to watch for real-time IoT data events from the oracle
 */
export function useWatchOracleData(
  onDataLogged?: (log: ContractEventLog) => void
): void {
  const queryClient = useQueryClient();
  const oracleAddress = CONTRACTS.nativeIoTOracle as Address;

  useWatchContractEvent({
    address: oracleAddress,
    abi: NativeIoTOracleABI,
    eventName: "IoTDataLogged",
    chainId: CHAIN_ID,
    onLogs: (logs) => {
      logs.forEach((log) => {
        const typedLog = log as typeof log & { args: Record<string, unknown> };
        const eventLog: ContractEventLog = {
          eventName: "IoTDataLogged",
          args: typedLog.args || {},
          blockNumber: log.blockNumber ?? 0n,
          transactionHash: log.transactionHash ?? "",
        };
        onDataLogged?.(eventLog);
      });
      queryClient.invalidateQueries({ queryKey: ["readContract"] });
    },
  });
}

/**
 * Hook to watch for anomaly detection events
 */
export function useWatchOracleAnomalies(
  onAnomaly?: (log: ContractEventLog) => void
): void {
  const oracleAddress = CONTRACTS.nativeIoTOracle as Address;

  useWatchContractEvent({
    address: oracleAddress,
    abi: NativeIoTOracleABI,
    eventName: "AnomalyDetected",
    chainId: CHAIN_ID,
    onLogs: (logs) => {
      logs.forEach((log) => {
        const typedLog = log as typeof log & { args: Record<string, unknown> };
        const eventLog: ContractEventLog = {
          eventName: "AnomalyDetected",
          args: typedLog.args || {},
          blockNumber: log.blockNumber ?? 0n,
          transactionHash: log.transactionHash ?? "",
        };
        onAnomaly?.(eventLog);
      });
    },
  });
}

// ============================================
// Timelock Hooks
// ============================================

/**
 * Hook to get the minimum timelock delay
 */
export function useTimelockOperations(): {
  minDelay: bigint | undefined;
  isLoading: boolean;
} {
  const { data, isLoading } = useReadContract({
    address: CONTRACTS.timelock as Address,
    abi: TimelockABI,
    functionName: "getMinDelay",
    chainId: CHAIN_ID,
    query: {
      refetchInterval: 60000,
    },
  });

  return {
    minDelay: data as bigint | undefined,
    isLoading,
  };
}

// ============================================
// Oracle Heartbeat Hook
// ============================================

/**
 * Hook to get the oracle heartbeat timeout configuration
 */
export function useOracleHeartbeat(): {
  heartbeatTimeout: bigint | undefined;
  isLoading: boolean;
} {
  const oracleAddress = CONTRACTS.nativeIoTOracle as Address;
  const isConfigured = oracleAddress !== "0x0000000000000000000000000000000000000000";

  const { data, isLoading } = useReadContract({
    address: oracleAddress,
    abi: NativeIoTOracleABI,
    functionName: "heartbeatTimeout",
    chainId: CHAIN_ID,
    query: {
      enabled: isConfigured,
      refetchInterval: 60000,
    },
  });

  return {
    heartbeatTimeout: data as bigint | undefined,
    isLoading,
  };
}

// ============================================
// KYC Verification Hook
// ============================================

/**
 * Hook to check if an address is KYC verified
 */
export function useKycVerified(address: Address | undefined): {
  isVerified: boolean | undefined;
  isLoading: boolean;
} {
  const { data, isLoading } = useReadContract({
    address: CONTRACTS.accessControl as Address,
    abi: AccessControlABI,
    functionName: "isKycVerified",
    args: address ? [address] : undefined,
    chainId: CHAIN_ID,
    query: {
      enabled: !!address,
    },
  });

  return {
    isVerified: data as boolean | undefined,
    isLoading,
  };
}

// ============================================
// Credit Total Supply Hook
// ============================================

/**
 * Hook to get total supply for a specific credit token ID
 */
export function useCreditTotalSupply(tokenId: number): {
  totalSupply: bigint | undefined;
  isLoading: boolean;
} {
  const { data, isLoading } = useReadContract({
    address: CONTRACTS.carbonCredit as Address,
    abi: CarbonCreditABI,
    functionName: "totalSupply",
    args: [BigInt(tokenId)],
    chainId: CHAIN_ID,
    query: {
      refetchInterval: 30000,
    },
  });

  return {
    totalSupply: data as bigint | undefined,
    isLoading,
  };
}

// ============================================
// Role Change Watch Hook
// ============================================

/**
 * Hook to watch for role granted and revoked events
 */
export function useWatchRoleChanges(
  onRoleChange?: (log: ContractEventLog) => void
): void {
  const queryClient = useQueryClient();

  useWatchContractEvent({
    address: CONTRACTS.accessControl as Address,
    abi: AccessControlABI,
    eventName: "RoleGranted",
    chainId: CHAIN_ID,
    onLogs: (logs) => {
      logs.forEach((log) => {
        const typedLog = log as typeof log & { args: Record<string, unknown> };
        const eventLog: ContractEventLog = {
          eventName: "RoleGranted",
          args: typedLog.args || {},
          blockNumber: log.blockNumber ?? 0n,
          transactionHash: log.transactionHash ?? "",
        };
        onRoleChange?.(eventLog);
      });
      queryClient.invalidateQueries({ queryKey: ["readContract"] });
    },
  });

  useWatchContractEvent({
    address: CONTRACTS.accessControl as Address,
    abi: AccessControlABI,
    eventName: "RoleRevoked",
    chainId: CHAIN_ID,
    onLogs: (logs) => {
      logs.forEach((log) => {
        const typedLog = log as typeof log & { args: Record<string, unknown> };
        const eventLog: ContractEventLog = {
          eventName: "RoleRevoked",
          args: typedLog.args || {},
          blockNumber: log.blockNumber ?? 0n,
          transactionHash: log.transactionHash ?? "",
        };
        onRoleChange?.(eventLog);
      });
      queryClient.invalidateQueries({ queryKey: ["readContract"] });
    },
  });
}

// ============================================
// Timelock Event Watch Hook
// ============================================

/**
 * Hook to watch for timelock schedule and execute events
 */
export function useWatchTimelockEvents(
  onSchedule?: (log: ContractEventLog) => void,
  onExecute?: (log: ContractEventLog) => void
): void {
  const queryClient = useQueryClient();

  useWatchContractEvent({
    address: CONTRACTS.timelock as Address,
    abi: TimelockABI,
    eventName: "CallScheduled",
    chainId: CHAIN_ID,
    onLogs: (logs) => {
      logs.forEach((log) => {
        const typedLog = log as typeof log & { args: Record<string, unknown> };
        const eventLog: ContractEventLog = {
          eventName: "CallScheduled",
          args: typedLog.args || {},
          blockNumber: log.blockNumber ?? 0n,
          transactionHash: log.transactionHash ?? "",
        };
        onSchedule?.(eventLog);
      });
      queryClient.invalidateQueries({ queryKey: ["readContract"] });
    },
  });

  useWatchContractEvent({
    address: CONTRACTS.timelock as Address,
    abi: TimelockABI,
    eventName: "CallExecuted",
    chainId: CHAIN_ID,
    onLogs: (logs) => {
      logs.forEach((log) => {
        const typedLog = log as typeof log & { args: Record<string, unknown> };
        const eventLog: ContractEventLog = {
          eventName: "CallExecuted",
          args: typedLog.args || {},
          blockNumber: log.blockNumber ?? 0n,
          transactionHash: log.transactionHash ?? "",
        };
        onExecute?.(eventLog);
      });
      queryClient.invalidateQueries({ queryKey: ["readContract"] });
    },
  });
}

// ============================================
// Multisig Event Watch Hook
// ============================================

/**
 * Hook to watch for multisig transaction submitted and executed events
 */
export function useWatchMultisigEvents(
  onSubmit?: (log: ContractEventLog) => void,
  onExecute?: (log: ContractEventLog) => void
): void {
  const queryClient = useQueryClient();

  useWatchContractEvent({
    address: CONTRACTS.multisig as Address,
    abi: MultisigABI,
    eventName: "TransactionSubmitted",
    chainId: CHAIN_ID,
    onLogs: (logs) => {
      logs.forEach((log) => {
        const typedLog = log as typeof log & { args: Record<string, unknown> };
        const eventLog: ContractEventLog = {
          eventName: "TransactionSubmitted",
          args: typedLog.args || {},
          blockNumber: log.blockNumber ?? 0n,
          transactionHash: log.transactionHash ?? "",
        };
        onSubmit?.(eventLog);
      });
      queryClient.invalidateQueries({ queryKey: ["readContract"] });
    },
  });

  useWatchContractEvent({
    address: CONTRACTS.multisig as Address,
    abi: MultisigABI,
    eventName: "TransactionExecuted",
    chainId: CHAIN_ID,
    onLogs: (logs) => {
      logs.forEach((log) => {
        const typedLog = log as typeof log & { args: Record<string, unknown> };
        const eventLog: ContractEventLog = {
          eventName: "TransactionExecuted",
          args: typedLog.args || {},
          blockNumber: log.blockNumber ?? 0n,
          transactionHash: log.transactionHash ?? "",
        };
        onExecute?.(eventLog);
      });
      queryClient.invalidateQueries({ queryKey: ["readContract"] });
    },
  });
}
