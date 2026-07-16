/**
 * TerraQura carbon-credit actions + portfolio.
 *
 * Read hooks in `useContractData.ts` cover single-token lookups; this module
 * adds the two things the Credits dashboard needs to be genuinely functional:
 *
 *   1. `usePortfolio(address)` — the caller's real holdings. CarbonCredit token
 *      IDs are hash-derived (not sequential), so they can't be enumerated on
 *      chain. We discover them from the same events the indexer consumes
 *      (CreditMinted → recipient, TransferSingle → to, CreditRetired →
 *      retiree), then enrich each with a multicall of balanceOf / getMetadata /
 *      getVerificationResult. On a large network the backend indexer
 *      (/v1/analytics/portfolio) is the drop-in replacement for the log scan.
 *
 *   2. `useRetireCredit` / `useTransferCredit` / `useBatchRetireCredits` —
 *      state-changing calls routed through {@link useSafeWriteContract} so they
 *      carry a buffered gas limit (the Aethelred node under-reports gas).
 */

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { hexToString, type Address, type Hex } from "viem";
import { useAccount, usePublicClient, useReadContracts } from "wagmi";

import { CONTRACTS, CHAIN_ID } from "@/lib/contracts";
import { CarbonCreditABI } from "@/lib/abis";
import { useSafeWriteContract } from "@/hooks/useSafeWriteContract";

const CARBON_CREDIT = CONTRACTS.carbonCredit as Address;

/** A real, on-chain carbon credit held (or retired) by the connected wallet. */
export interface PortfolioCredit {
  tokenId: bigint;
  dacUnitId: string;
  co2AmountKg: number;
  energyConsumedKwh: number;
  purityPercentage: number;
  captureTimestamp: number;
  isRetired: boolean;
  sourceVerified: boolean;
  logicVerified: boolean;
  mintVerified: boolean;
  balance: number;
}

/** Decode a bytes32 dacUnitId to its human label, tolerating non-UTF8 bytes. */
function decodeDacUnitId(raw: unknown): string {
  if (typeof raw !== "string" || !raw.startsWith("0x")) return String(raw ?? "");
  try {
    const trimmed = hexToString(raw as Hex, { size: 32 }).replace(/\0+$/, "");
    return trimmed.length > 0 ? trimmed : raw.slice(0, 10);
  } catch {
    return raw.slice(0, 10);
  }
}

interface RawMetadata {
  dacUnitId: string;
  captureTimestamp: bigint;
  co2AmountKg: bigint;
  energyConsumedKwh: bigint;
  purityPercentage: number;
  isRetired: boolean;
}
interface RawVerification {
  sourceVerified: boolean;
  logicVerified: boolean;
  mintVerified: boolean;
}

/**
 * The connected wallet's carbon-credit portfolio, read live from chain.
 */
export function usePortfolio(address?: Address): {
  credits: PortfolioCredit[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
} {
  const publicClient = usePublicClient({ chainId: CHAIN_ID });
  const [tokenIds, setTokenIds] = useState<bigint[]>([]);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [discoverError, setDiscoverError] = useState<Error | null>(null);
  const [nonce, setNonce] = useState(0);

  // Step 1: discover the token IDs this wallet has ever touched.
  useEffect(() => {
    if (!address || !publicClient) {
      setTokenIds([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setIsDiscovering(true);
      setDiscoverError(null);
      try {
        const [minted, received, retired] = await Promise.all([
          publicClient.getContractEvents({
            address: CARBON_CREDIT,
            abi: CarbonCreditABI,
            eventName: "CreditMinted",
            args: { recipient: address },
            fromBlock: 0n,
            toBlock: "latest",
          }),
          publicClient.getContractEvents({
            address: CARBON_CREDIT,
            abi: CarbonCreditABI,
            eventName: "TransferSingle",
            args: { to: address },
            fromBlock: 0n,
            toBlock: "latest",
          }),
          publicClient.getContractEvents({
            address: CARBON_CREDIT,
            abi: CarbonCreditABI,
            eventName: "CreditRetired",
            args: { retiree: address },
            fromBlock: 0n,
            toBlock: "latest",
          }),
        ]);
        const ids = new Set<bigint>();
        for (const log of minted) {
          const id = (log.args as { tokenId?: bigint }).tokenId;
          if (id !== undefined) ids.add(id);
        }
        for (const log of received) {
          const id = (log.args as { id?: bigint }).id;
          if (id !== undefined) ids.add(id);
        }
        for (const log of retired) {
          const id = (log.args as { tokenId?: bigint }).tokenId;
          if (id !== undefined) ids.add(id);
        }
        if (!cancelled) setTokenIds([...ids].sort((a, b) => (a < b ? -1 : 1)));
      } catch (err) {
        if (!cancelled) setDiscoverError(err as Error);
      } finally {
        if (!cancelled) setIsDiscovering(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [address, publicClient, nonce]);

  // Step 2: enrich each discovered token with balance + metadata + verification.
  const contracts = useMemo(() => {
    if (!address) return [];
    return tokenIds.flatMap((id) => [
      {
        address: CARBON_CREDIT,
        abi: CarbonCreditABI,
        functionName: "balanceOf",
        args: [address, id],
        chainId: CHAIN_ID,
      },
      {
        address: CARBON_CREDIT,
        abi: CarbonCreditABI,
        functionName: "getMetadata",
        args: [id],
        chainId: CHAIN_ID,
      },
      {
        address: CARBON_CREDIT,
        abi: CarbonCreditABI,
        functionName: "getVerificationResult",
        args: [id],
        chainId: CHAIN_ID,
      },
    ]);
  }, [tokenIds, address]);

  const {
    data,
    isLoading: isEnriching,
    error: enrichError,
    refetch: refetchEnrich,
  } = useReadContracts({
    contracts,
    query: { enabled: contracts.length > 0, refetchInterval: 30000 },
  });

  const credits = useMemo<PortfolioCredit[]>(() => {
    if (!data) return [];
    const out: PortfolioCredit[] = [];
    tokenIds.forEach((id, i) => {
      const balanceRes = data[i * 3];
      const metaRes = data[i * 3 + 1];
      const verifyRes = data[i * 3 + 2];
      if (metaRes?.status !== "success") return;
      const meta = metaRes.result as unknown as RawMetadata;
      const verify =
        verifyRes?.status === "success"
          ? (verifyRes.result as unknown as RawVerification)
          : undefined;
      const balance =
        balanceRes?.status === "success" ? Number(balanceRes.result as bigint) : 0;
      // Keep active holdings and credits the wallet has retired (balance 0 but
      // isRetired) — both belong in the portfolio history.
      if (balance <= 0 && !meta.isRetired) return;
      out.push({
        tokenId: id,
        dacUnitId: decodeDacUnitId(meta.dacUnitId),
        co2AmountKg: Number(meta.co2AmountKg),
        energyConsumedKwh: Number(meta.energyConsumedKwh),
        purityPercentage: Number(meta.purityPercentage),
        captureTimestamp: Number(meta.captureTimestamp),
        isRetired: meta.isRetired,
        sourceVerified: verify?.sourceVerified ?? false,
        logicVerified: verify?.logicVerified ?? false,
        mintVerified: verify?.mintVerified ?? false,
        balance,
      });
    });
    return out;
  }, [data, tokenIds]);

  const refetch = useCallback(() => {
    setNonce((n) => n + 1);
    void refetchEnrich();
  }, [refetchEnrich]);

  return {
    credits,
    isLoading: isDiscovering || (contracts.length > 0 && isEnriching),
    error: discoverError ?? (enrichError as Error | null) ?? null,
    refetch,
  };
}

/** Retire (burn) a quantity of one credit batch, recording an on-chain reason. */
export function useRetireCredit() {
  const { writeContractAsync, isPending, ...rest } = useSafeWriteContract();
  const retire = useCallback(
    (tokenId: bigint, amount: bigint, reason: string) =>
      writeContractAsync({
        address: CARBON_CREDIT,
        abi: CarbonCreditABI,
        functionName: "retireCredits",
        args: [tokenId, amount, reason],
        chainId: CHAIN_ID,
      }),
    [writeContractAsync],
  );
  return { retire, isPending, ...rest };
}

/** Retire quantities across several credit batches in one transaction. */
export function useBatchRetireCredits() {
  const { writeContractAsync, isPending, ...rest } = useSafeWriteContract();
  const batchRetire = useCallback(
    (tokenIds: bigint[], amounts: bigint[], reason: string) =>
      writeContractAsync({
        address: CARBON_CREDIT,
        abi: CarbonCreditABI,
        functionName: "batchRetireCredits",
        args: [tokenIds, amounts, reason],
        chainId: CHAIN_ID,
      }),
    [writeContractAsync],
  );
  return { batchRetire, isPending, ...rest };
}

/** Transfer a quantity of a credit batch to another wallet (ERC-1155). */
export function useTransferCredit() {
  const { address } = useAccount();
  const { writeContractAsync, isPending, ...rest } = useSafeWriteContract();
  const transfer = useCallback(
    (to: Address, tokenId: bigint, amount: bigint) => {
      if (!address) throw new Error("Wallet not connected");
      return writeContractAsync({
        address: CARBON_CREDIT,
        abi: CarbonCreditABI,
        functionName: "safeTransferFrom",
        args: [address, to, tokenId, amount, "0x"],
        chainId: CHAIN_ID,
      });
    },
    [writeContractAsync, address],
  );
  return { transfer, isPending, ...rest };
}
