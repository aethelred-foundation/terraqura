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

/** One step in a credit's real, on-chain lifecycle. */
export interface ProvenanceEntry {
  event:
    | "CAPTURE_STARTED"
    | "SOURCE_VERIFIED"
    | "LOGIC_VERIFIED"
    | "MINT_VERIFIED"
    | "MINTED"
    | "TRANSFERRED"
    | "RETIRED";
  timestamp: number;
  /** Transaction hash for event-derived steps; empty for contract-state steps. */
  txHash: string;
  /** Acting address for event-derived steps; empty for contract-state steps. */
  actor: string;
  detail: string;
}

const ZERO_ADDR = "0x0000000000000000000000000000000000000000";

/**
 * The complete, real lifecycle of one credit batch: capture + three-phase
 * verification from contract state (getMetadata / getVerificationResult) and
 * mint / transfer / retirement from the contract's own events. Everything
 * shown is read from chain — nothing is invented.
 */
export function useProvenance(tokenId?: bigint): {
  entries: ProvenanceEntry[] | null;
  meta: PortfolioCredit | null;
  isLoading: boolean;
  error: Error | null;
  notFound: boolean;
} {
  const publicClient = usePublicClient({ chainId: CHAIN_ID });
  const [entries, setEntries] = useState<ProvenanceEntry[] | null>(null);
  const [meta, setMeta] = useState<PortfolioCredit | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (tokenId === undefined || !publicClient) {
      setEntries(null);
      setMeta(null);
      setNotFound(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setIsLoading(true);
      setError(null);
      setNotFound(false);
      try {
        const [rawMeta, rawVerify] = await Promise.all([
          publicClient.readContract({
            address: CARBON_CREDIT,
            abi: CarbonCreditABI,
            functionName: "getMetadata",
            args: [tokenId],
          }) as Promise<RawMetadata>,
          publicClient.readContract({
            address: CARBON_CREDIT,
            abi: CarbonCreditABI,
            functionName: "getVerificationResult",
            args: [tokenId],
          }) as Promise<RawVerification & { efficiencyFactor: bigint; verifiedAt: bigint }>,
        ]);
        if (rawMeta.captureTimestamp === 0n) {
          if (!cancelled) {
            setEntries(null);
            setMeta(null);
            setNotFound(true);
          }
          return;
        }

        const [mintLogs, retireLogs, transferLogs] = await Promise.all([
          publicClient.getContractEvents({
            address: CARBON_CREDIT,
            abi: CarbonCreditABI,
            eventName: "CreditMinted",
            args: { tokenId },
            fromBlock: 0n,
            toBlock: "latest",
          }),
          publicClient.getContractEvents({
            address: CARBON_CREDIT,
            abi: CarbonCreditABI,
            eventName: "CreditRetired",
            args: { tokenId },
            fromBlock: 0n,
            toBlock: "latest",
          }),
          // TransferSingle's id is not indexed, so fetch and filter client-side.
          publicClient.getContractEvents({
            address: CARBON_CREDIT,
            abi: CarbonCreditABI,
            eventName: "TransferSingle",
            fromBlock: 0n,
            toBlock: "latest",
          }),
        ]);

        const wanted = transferLogs.filter((l) => {
          const a = l.args as { id?: bigint; from?: string; to?: string };
          // Mint and burn emit TransferSingle from/to the zero address; those
          // lifecycle steps are already covered by MINTED / RETIRED entries.
          return a.id === tokenId && a.from !== ZERO_ADDR && a.to !== ZERO_ADDR;
        });

        const blockNumbers = new Set<bigint>();
        for (const l of [...mintLogs, ...retireLogs, ...wanted]) blockNumbers.add(l.blockNumber);
        const blockTimes = new Map<bigint, number>();
        await Promise.all(
          [...blockNumbers].map(async (bn) => {
            const b = await publicClient.getBlock({ blockNumber: bn });
            blockTimes.set(bn, Number(b.timestamp));
          }),
        );

        const dacLabel = decodeDacUnitId(rawMeta.dacUnitId);
        const out: ProvenanceEntry[] = [];

        out.push({
          event: "CAPTURE_STARTED",
          timestamp: Number(rawMeta.captureTimestamp),
          txHash: "",
          actor: "",
          detail: `DAC unit ${dacLabel} captured ${Number(rawMeta.co2AmountKg).toLocaleString()} kg CO2 using ${Number(rawMeta.energyConsumedKwh).toLocaleString()} kWh (purity ${Number(rawMeta.purityPercentage)}%).`,
        });

        const verifiedAt = Number(rawVerify.verifiedAt);
        if (rawVerify.sourceVerified) {
          out.push({
            event: "SOURCE_VERIFIED",
            timestamp: verifiedAt,
            txHash: "",
            actor: "",
            detail: `Phase 1 passed: ${dacLabel} is whitelisted and the sensor data hash is unused.`,
          });
        }
        if (rawVerify.logicVerified) {
          out.push({
            event: "LOGIC_VERIFIED",
            timestamp: verifiedAt,
            txHash: "",
            actor: "",
            detail: `Phase 2 passed: Net-Negative proof-of-physics check, efficiency factor ${(Number(rawVerify.efficiencyFactor) / 10_000).toFixed(4)}.`,
          });
        }
        if (rawVerify.mintVerified) {
          out.push({
            event: "MINT_VERIFIED",
            timestamp: verifiedAt,
            txHash: "",
            actor: "",
            detail: "Phase 3 passed: no duplicate mint for this source data hash.",
          });
        }

        for (const l of mintLogs) {
          const a = l.args as { operator?: string; recipient?: string; creditsAmount?: bigint };
          const to = a.recipient ?? a.operator ?? "";
          out.push({
            event: "MINTED",
            timestamp: blockTimes.get(l.blockNumber) ?? 0,
            txHash: l.transactionHash,
            actor: to,
            detail: `${Number(a.creditsAmount ?? 0n).toLocaleString()} credits minted to ${to.slice(0, 10)}…`,
          });
        }
        for (const l of wanted) {
          const a = l.args as { from?: string; to?: string; value?: bigint };
          out.push({
            event: "TRANSFERRED",
            timestamp: blockTimes.get(l.blockNumber) ?? 0,
            txHash: l.transactionHash,
            actor: a.from ?? "",
            detail: `${Number(a.value ?? 0n).toLocaleString()} credits transferred ${a.from?.slice(0, 10)}… → ${a.to?.slice(0, 10)}…`,
          });
        }
        for (const l of retireLogs) {
          const a = l.args as { retiree?: string; amount?: bigint; reason?: string };
          out.push({
            event: "RETIRED",
            timestamp: blockTimes.get(l.blockNumber) ?? 0,
            txHash: l.transactionHash,
            actor: a.retiree ?? "",
            detail: `${Number(a.amount ?? 0n).toLocaleString()} credits permanently retired${a.reason ? ` — "${a.reason}"` : ""}.`,
          });
        }

        out.sort((x, y) => x.timestamp - y.timestamp);

        if (!cancelled) {
          setEntries(out);
          setMeta({
            tokenId,
            dacUnitId: dacLabel,
            co2AmountKg: Number(rawMeta.co2AmountKg),
            energyConsumedKwh: Number(rawMeta.energyConsumedKwh),
            purityPercentage: Number(rawMeta.purityPercentage),
            captureTimestamp: Number(rawMeta.captureTimestamp),
            isRetired: rawMeta.isRetired,
            sourceVerified: rawVerify.sourceVerified,
            logicVerified: rawVerify.logicVerified,
            mintVerified: rawVerify.mintVerified,
            balance: 0,
          });
        }
      } catch (err) {
        if (!cancelled) {
          // A revert here means the token does not exist on this contract.
          const msg = err instanceof Error ? err.message : String(err);
          if (/revert/i.test(msg)) {
            setNotFound(true);
            setEntries(null);
            setMeta(null);
          } else {
            setError(err as Error);
          }
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tokenId, publicClient]);

  return { entries, meta, isLoading, error, notFound };
}

/** A real retirement certificate, built from the CreditRetired event. */
export interface RetirementCertificate {
  tokenId: bigint;
  amountRetired: number;
  reason: string;
  beneficiary: string;
  txHash: string;
  retiredAt: number;
  dacUnit: string;
  vintageYear: number;
}

/** Extract the beneficiary the retire form embeds as "… (beneficiary: X)". */
function splitReason(reason: string): { reason: string; beneficiary: string } {
  const m = reason.match(/^(.*?)\s*\(beneficiary:\s*(.+?)\)\s*$/);
  if (m && m[1] !== undefined && m[2] !== undefined) {
    return { reason: m[1] || "Voluntary retirement", beneficiary: m[2] };
  }
  const alt = reason.match(/^Retired on behalf of\s+(.+)$/);
  if (alt && alt[1] !== undefined) {
    return { reason, beneficiary: alt[1] };
  }
  return { reason, beneficiary: "" };
}

/**
 * The connected wallet's retirement certificates — one per CreditRetired
 * event it emitted, enriched with the batch's real metadata.
 */
export function useRetirementCertificates(address?: Address): {
  certificates: RetirementCertificate[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
} {
  const publicClient = usePublicClient({ chainId: CHAIN_ID });
  const [certificates, setCertificates] = useState<RetirementCertificate[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!address || !publicClient) {
      setCertificates([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setIsLoading(true);
      setError(null);
      try {
        const logs = await publicClient.getContractEvents({
          address: CARBON_CREDIT,
          abi: CarbonCreditABI,
          eventName: "CreditRetired",
          args: { retiree: address },
          fromBlock: 0n,
          toBlock: "latest",
        });

        const certs = await Promise.all(
          logs.map(async (l) => {
            const a = l.args as { tokenId?: bigint; amount?: bigint; reason?: string };
            const tokenId = a.tokenId ?? 0n;
            const [block, rawMeta] = await Promise.all([
              publicClient.getBlock({ blockNumber: l.blockNumber }),
              publicClient.readContract({
                address: CARBON_CREDIT,
                abi: CarbonCreditABI,
                functionName: "getMetadata",
                args: [tokenId],
              }) as Promise<RawMetadata>,
            ]);
            const { reason, beneficiary } = splitReason(a.reason ?? "");
            return {
              tokenId,
              amountRetired: Number(a.amount ?? 0n),
              reason,
              beneficiary,
              txHash: l.transactionHash,
              retiredAt: Number(block.timestamp),
              dacUnit: decodeDacUnitId(rawMeta.dacUnitId),
              vintageYear: new Date(Number(rawMeta.captureTimestamp) * 1000).getFullYear(),
            } satisfies RetirementCertificate;
          }),
        );
        certs.sort((x, y) => y.retiredAt - x.retiredAt);
        if (!cancelled) setCertificates(certs);
      } catch (err) {
        if (!cancelled) setError(err as Error);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [address, publicClient, nonce]);

  const refetch = useCallback(() => setNonce((n) => n + 1), []);

  return { certificates, isLoading, error, refetch };
}

/** Aggregated, chain-derived statistics for the credit dashboards. */
export interface CreditStats {
  /** Every mint: when, how much, to whom, from which facility. */
  mints: { tokenId: bigint; dacUnit: string; amount: number; timestamp: number; recipient: string }[];
  /** Every retirement: when and how much. */
  retires: { tokenId: bigint; amount: number; timestamp: number }[];
  /** Wallet-to-wallet transfers (mint/burn legs excluded). */
  transfers: { tokenId: bigint; amount: number; timestamp: number }[];
  /** Current holders with a positive balance, from the event ledger. */
  holders: { address: string; balance: number }[];
  /** Per-batch physical metadata for distribution charts. */
  tokens: {
    tokenId: bigint;
    dacUnit: string;
    co2Kg: number;
    energyKwh: number;
    purity: number;
    captureYear: number;
    /** Seconds between capture and on-chain verification. */
    verificationSeconds: number;
  }[];
}

/**
 * Chain-wide credit statistics computed from the CarbonCredit contract's own
 * events and per-token state. Every number is derived from chain data — on a
 * young network the charts are sparse, and that is the honest picture.
 */
export function useCreditStats(): {
  stats: CreditStats | null;
  isLoading: boolean;
  error: Error | null;
} {
  const publicClient = usePublicClient({ chainId: CHAIN_ID });
  const [stats, setStats] = useState<CreditStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!publicClient) return;
    let cancelled = false;
    (async () => {
      setIsLoading(true);
      setError(null);
      try {
        const [mintLogs, retireLogs, transferLogs] = await Promise.all([
          publicClient.getContractEvents({
            address: CARBON_CREDIT,
            abi: CarbonCreditABI,
            eventName: "CreditMinted",
            fromBlock: 0n,
            toBlock: "latest",
          }),
          publicClient.getContractEvents({
            address: CARBON_CREDIT,
            abi: CarbonCreditABI,
            eventName: "CreditRetired",
            fromBlock: 0n,
            toBlock: "latest",
          }),
          publicClient.getContractEvents({
            address: CARBON_CREDIT,
            abi: CarbonCreditABI,
            eventName: "TransferSingle",
            fromBlock: 0n,
            toBlock: "latest",
          }),
        ]);

        const blockNumbers = new Set<bigint>();
        for (const l of [...mintLogs, ...retireLogs, ...transferLogs]) blockNumbers.add(l.blockNumber);
        const blockTimes = new Map<bigint, number>();
        await Promise.all(
          [...blockNumbers].map(async (bn) => {
            const b = await publicClient.getBlock({ blockNumber: bn });
            blockTimes.set(bn, Number(b.timestamp));
          }),
        );
        const ts = (l: { blockNumber: bigint }) => blockTimes.get(l.blockNumber) ?? 0;

        const mints = mintLogs.map((l) => {
          const a = l.args as { tokenId?: bigint; dacUnitId?: string; recipient?: string; creditsAmount?: bigint };
          return {
            tokenId: a.tokenId ?? 0n,
            dacUnit: decodeDacUnitId(a.dacUnitId),
            amount: Number(a.creditsAmount ?? 0n),
            timestamp: ts(l),
            recipient: a.recipient ?? "",
          };
        });
        const retires = retireLogs.map((l) => {
          const a = l.args as { tokenId?: bigint; amount?: bigint };
          return { tokenId: a.tokenId ?? 0n, amount: Number(a.amount ?? 0n), timestamp: ts(l) };
        });

        // Event ledger over TransferSingle covers mints (from=0) and burns
        // (to=0), so it reconstructs every current balance.
        const ledger = new Map<string, number>();
        const transfers: CreditStats["transfers"] = [];
        for (const l of transferLogs) {
          const a = l.args as { from?: string; to?: string; id?: bigint; value?: bigint };
          const value = Number(a.value ?? 0n);
          const from = (a.from ?? ZERO_ADDR).toLowerCase();
          const to = (a.to ?? ZERO_ADDR).toLowerCase();
          if (from !== ZERO_ADDR) ledger.set(from, (ledger.get(from) ?? 0) - value);
          if (to !== ZERO_ADDR) ledger.set(to, (ledger.get(to) ?? 0) + value);
          if (from !== ZERO_ADDR && to !== ZERO_ADDR) {
            transfers.push({ tokenId: a.id ?? 0n, amount: value, timestamp: ts(l) });
          }
        }
        const holders = [...ledger.entries()]
          .filter(([, balance]) => balance > 0)
          .map(([address, balance]) => ({ address, balance }))
          .sort((x, y) => y.balance - x.balance);

        const uniqueTokenIds = [...new Set(mints.map((m) => m.tokenId))];
        const tokens = await Promise.all(
          uniqueTokenIds.map(async (tokenId) => {
            const [rawMeta, rawVerify] = await Promise.all([
              publicClient.readContract({
                address: CARBON_CREDIT,
                abi: CarbonCreditABI,
                functionName: "getMetadata",
                args: [tokenId],
              }) as Promise<RawMetadata>,
              publicClient.readContract({
                address: CARBON_CREDIT,
                abi: CarbonCreditABI,
                functionName: "getVerificationResult",
                args: [tokenId],
              }) as Promise<RawVerification & { verifiedAt: bigint }>,
            ]);
            return {
              tokenId,
              dacUnit: decodeDacUnitId(rawMeta.dacUnitId),
              co2Kg: Number(rawMeta.co2AmountKg),
              energyKwh: Number(rawMeta.energyConsumedKwh),
              purity: Number(rawMeta.purityPercentage),
              captureYear: new Date(Number(rawMeta.captureTimestamp) * 1000).getFullYear(),
              verificationSeconds: Math.max(
                0,
                Number(rawVerify.verifiedAt) - Number(rawMeta.captureTimestamp),
              ),
            };
          }),
        );

        if (!cancelled) setStats({ mints, retires, transfers, holders, tokens });
      } catch (err) {
        if (!cancelled) setError(err as Error);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [publicClient]);

  return { stats, isLoading, error };
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
