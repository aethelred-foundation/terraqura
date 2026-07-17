'use client';

import { useState, useMemo, useCallback } from 'react';
import { type Address } from 'viem';
import { useApp } from '@/contexts/AppContext';
import { CONTRACTS } from '@/lib/contracts';
import { getExplorerTokenUrl } from '@/lib/wagmi';
import {
  useTotalCreditsMinted,
  useTotalCreditsRetired,
  useCarbonCredit,
  useVerificationResult,
  useCreditBalance,
  useVerificationThresholds,
} from '@/hooks/useContractData';
import {
  useCreditStats,
  usePortfolio,
  useProvenance,
  useRetireCredit,
  useRetirementCertificates,
  useTransferCredit,
  useBatchRetireCredits,
} from '@/hooks/useCreditActions';
import {
  TopNav,
  DAppFooter,
  ToastContainer,
  GlassCard,
  MetricCard,
  StatusBadge,
  SectionHeader,
  Tabs,
  CopyButton,
  Skeleton,
  ConnectWalletPrompt,
} from '@/components/dapp/SharedComponents';

// ============================================
// Mock data (deterministic, seeded)
// ============================================


// Provenance event types
type ProvenanceEventType = 'CAPTURE_STARTED' | 'SOURCE_VERIFIED' | 'LOGIC_VERIFIED' | 'MINT_VERIFIED' | 'MINTED' | 'TRANSFERRED' | 'RETIRED';

// ============================================
// Verification check icon
// ============================================

function VerifyCheck({ passed, label }: { passed: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2">
      {passed ? (
        <div className="h-5 w-5 rounded-full bg-emerald-500/20 flex items-center justify-center">
          <svg className="h-3 w-3 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        </div>
      ) : (
        <div className="h-5 w-5 rounded-full bg-white/[0.06] flex items-center justify-center">
          <svg className="h-3 w-3 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
      )}
      <span className={`text-sm ${passed ? 'text-white/70' : 'text-white/60'}`}>{label}</span>
    </div>
  );
}

// ============================================
// Credit Lookup Component
// ============================================

function CreditLookup() {
  const [input, setInput] = useState('');
  const tokenId = useMemo(() => {
    const n = parseInt(input, 10);
    return isNaN(n) || n < 0 ? undefined : BigInt(n);
  }, [input]);

  const { creditData, isLoading: creditLoading, error: creditError } = useCarbonCredit(tokenId);
  const { verification, isLoading: verifyLoading } = useVerificationResult(tokenId);

  const hasSearched = input.length > 0 && tokenId !== undefined;

  return (
    <div>
      <div className="flex gap-3 mb-6">
        <div className="relative flex-1 max-w-sm">
          <input
            type="number"
            min="0"
            placeholder="Enter Token ID..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white placeholder-white/30 text-sm font-mono focus:outline-none focus:border-emerald-500/40 focus:bg-white/[0.06] transition-all"
          />
          <svg className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/55" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </div>

      {hasSearched && (
        <GlassCard className="p-6">
          {creditLoading || verifyLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-4 w-64" />
              <Skeleton className="h-4 w-40" />
              <div className="grid grid-cols-2 gap-4 mt-4">
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
              </div>
            </div>
          ) : creditError || !creditData ? (
            <div className="text-center py-6">
              <p className="text-white/40 text-sm">
                {creditError ? 'Error loading credit data. The contract may not be reachable.' : `No credit found for Token ID ${input}.`}
              </p>
            </div>
          ) : (
            <div>
              <div className="flex items-start justify-between mb-6">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="text-white font-display font-bold text-lg">Token #{input}</h3>
                    <StatusBadge status={creditData.isRetired ? 'retired' : 'active'} />
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="text-white/40 text-xs font-mono">{creditData.dacUnitId}</p>
                    <CopyButton text={creditData.dacUnitId} />
                  </div>
                </div>
                <a
                  href={getExplorerTokenUrl(CONTRACTS.carbonCredit, input)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-emerald-500/70 hover:text-emerald-400 text-xs font-mono transition-colors"
                >
                  View on Explorer
                </a>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                <div className="p-3 rounded-xl bg-white/[0.03]">
                  <p className="text-white/40 text-[10px] font-mono uppercase tracking-widest mb-1">CO2 Captured</p>
                  <p className="text-emerald-400 font-mono font-bold">{Number(creditData.co2AmountKg).toLocaleString()} kg</p>
                </div>
                <div className="p-3 rounded-xl bg-white/[0.03]">
                  <p className="text-white/40 text-[10px] font-mono uppercase tracking-widest mb-1">Energy Used</p>
                  <p className="text-cyan-400 font-mono font-bold">{Number(creditData.energyConsumedKwh).toLocaleString()} kWh</p>
                </div>
                <div className="p-3 rounded-xl bg-white/[0.03]">
                  <p className="text-white/40 text-[10px] font-mono uppercase tracking-widest mb-1">Purity</p>
                  <p className="text-blue-400 font-mono font-bold">{creditData.purityPercentage}%</p>
                </div>
                <div className="p-3 rounded-xl bg-white/[0.03]">
                  <p className="text-white/40 text-[10px] font-mono uppercase tracking-widest mb-1">Captured At</p>
                  <p className="text-purple-400 font-mono font-bold text-xs">
                    {new Date(creditData.captureTimestamp * 1000).toLocaleDateString()}
                  </p>
                </div>
              </div>

              {verification && (
                <div className="pt-4 border-t border-white/[0.06]">
                  <p className="text-white/50 text-xs font-mono uppercase tracking-widest mb-3">Proof-of-Physics Verification</p>
                  <div className="flex flex-wrap gap-6">
                    <VerifyCheck passed={verification.sourceVerified} label="Source Check" />
                    <VerifyCheck passed={verification.logicVerified} label="Logic Check" />
                    <VerifyCheck passed={verification.mintVerified} label="Mint Check" />
                  </div>
                  {verification.efficiencyFactor !== undefined && (
                    <p className="text-white/60 text-xs font-mono mt-3">
                      Efficiency Factor: {(Number(verification.efficiencyFactor) / 100).toFixed(2)}%
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </GlassCard>
      )}

      {!hasSearched && (
        <GlassCard className="p-8 text-center">
          <p className="text-white/60 text-sm">Enter a Token ID above to look up credit metadata and verification status.</p>
        </GlassCard>
      )}
    </div>
  );
}

// ============================================
// Overview Tab (enhanced)
// ============================================

function OverviewTab({ totalMinted, totalRetired, netActive }: {
  totalMinted: bigint | undefined;
  totalRetired: bigint | undefined;
  netActive: bigint | undefined;
}) {
  const { stats } = useCreditStats();

  // Mint volume bucketed into the last 12 calendar weeks, from real events.
  const weeklyMinted = useMemo(() => {
    const now = Math.floor(Date.now() / 1000);
    const WEEK = 7 * 86400;
    const buckets = Array.from({ length: 12 }, (_, i) => ({
      week: `W${i + 1}`,
      credits: 0,
    }));
    for (const m of stats?.mints ?? []) {
      const age = now - m.timestamp;
      if (age < 0 || age >= 12 * WEEK) continue;
      const idx = 11 - Math.floor(age / WEEK);
      const bucket = buckets[idx];
      if (bucket) bucket.credits += m.amount;
    }
    return buckets;
  }, [stats]);
  const weeklyMax = Math.max(1, ...weeklyMinted.map((w) => w.credits));

  const purityBrackets = useMemo(() => {
    const brackets = [
      { label: '90-93%', min: 90, max: 93, count: 0, color: 'bg-blue-400' },
      { label: '93-96%', min: 93, max: 96, count: 0, color: 'bg-cyan-400' },
      { label: '96-99%', min: 96, max: 99, count: 0, color: 'bg-emerald-400' },
      { label: '99%+', min: 99, max: 101, count: 0, color: 'bg-emerald-300' },
    ];
    for (const t of stats?.tokens ?? []) {
      const b = brackets.find((x) => t.purity >= x.min && t.purity < x.max);
      if (b) b.count += 1;
    }
    return brackets;
  }, [stats]);
  const purityMax = Math.max(1, ...purityBrackets.map((b) => b.count));

  const leaderboard = useMemo(() => {
    const byUnit = new Map<string, { unit: string; co2Total: number; credits: number; energy: number }>();
    for (const t of stats?.tokens ?? []) {
      const row = byUnit.get(t.dacUnit) ?? { unit: t.dacUnit, co2Total: 0, credits: 0, energy: 0 };
      row.co2Total += t.co2Kg;
      row.energy += t.energyKwh;
      byUnit.set(t.dacUnit, row);
    }
    for (const m of stats?.mints ?? []) {
      const row = byUnit.get(m.dacUnit);
      if (row) row.credits += m.amount;
    }
    return [...byUnit.values()]
      .map((r) => ({
        ...r,
        // kWh per tonne of CO2 captured.
        efficiency: r.co2Total > 0 ? Math.round(r.energy / (r.co2Total / 1000)) : 0,
      }))
      .sort((a, b) => b.co2Total - a.co2Total);
  }, [stats]);

  const avgVerificationHours = useMemo(() => {
    const tokens = stats?.tokens ?? [];
    if (tokens.length === 0) return null;
    const mean = tokens.reduce((acc, t) => acc + t.verificationSeconds, 0) / tokens.length;
    return mean / 3600;
  }, [stats]);

  return (
    <div>
      {/* Global stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-8">
        <MetricCard
          label="Total Minted"
          value={totalMinted !== undefined ? Number(totalMinted).toLocaleString() : '--'}
          unit="credits"
        />
        <MetricCard
          label="Total Retired"
          value={totalRetired !== undefined ? Number(totalRetired).toLocaleString() : '--'}
          unit="credits"
        />
        <MetricCard
          label="Net Active"
          value={netActive !== undefined ? Number(netActive).toLocaleString() : '--'}
          unit="credits"
        />
        <MetricCard
          label="Avg Verification Time"
          value={avgVerificationHours !== null ? avgVerificationHours.toFixed(1) : '--'}
          unit="hours"
        />
      </div>

      {/* Credits Minted per Week */}
      <GlassCard className="p-6 mb-8">
        <p className="text-white/50 text-xs font-mono uppercase tracking-widest mb-4">Credits Minted Per Week (12 Weeks)</p>
        <div className="flex items-end gap-2 h-48">
          {weeklyMinted.map((w) => {
            const heightPct = (w.credits / weeklyMax) * 100;
            return (
              <div key={w.week} className="flex-1 flex flex-col items-center gap-1 group">
                <span className="text-[10px] text-white/40 font-mono opacity-0 group-hover:opacity-100 transition-opacity">
                  {w.credits}
                </span>
                <div
                  className="w-full bg-emerald-500/30 hover:bg-emerald-500/50 rounded-t transition-all relative"
                  style={{ height: `${heightPct}%`, minHeight: '4px' }}
                >
                  <div className="absolute inset-0 bg-gradient-to-t from-emerald-600/40 to-emerald-400/20 rounded-t" />
                </div>
                <span className="text-[10px] text-white/60 font-mono">{w.week}</span>
              </div>
            );
          })}
        </div>
      </GlassCard>

      {/* Purity distribution */}
      <GlassCard className="p-6 mb-8">
        <p className="text-white/50 text-xs font-mono uppercase tracking-widest mb-4">Distribution by Purity Bracket</p>
        <div className="space-y-3">
          {purityBrackets.map((b) => {
            const widthPct = (b.count / purityMax) * 100;
            return (
              <div key={b.label} className="flex items-center gap-3">
                <span className="text-xs text-white/50 font-mono w-16 shrink-0">{b.label}</span>
                <div className="flex-1 h-7 bg-white/[0.03] rounded-lg overflow-hidden relative">
                  <div
                    className={`h-full ${b.color}/30 rounded-lg transition-all flex items-center`}
                    style={{ width: `${widthPct}%` }}
                  >
                    <div className={`h-full ${b.color} opacity-20 absolute inset-0 rounded-lg`} style={{ width: '100%' }} />
                  </div>
                </div>
                <span className="text-xs text-white/60 font-mono w-10 text-right">{b.count}</span>
              </div>
            );
          })}
        </div>
      </GlassCard>

      {/* DAC Unit Leaderboard */}
      <GlassCard className="p-6 mb-8">
        <p className="text-white/50 text-xs font-mono uppercase tracking-widest mb-4">DAC Unit Leaderboard</p>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="text-left text-[10px] text-white/60 font-mono uppercase tracking-widest pb-3 pr-4">Rank</th>
                <th className="text-left text-[10px] text-white/60 font-mono uppercase tracking-widest pb-3 pr-4">Unit ID</th>
                <th className="text-right text-[10px] text-white/60 font-mono uppercase tracking-widest pb-3 pr-4">Total CO2 (kg)</th>
                <th className="text-right text-[10px] text-white/60 font-mono uppercase tracking-widest pb-3 pr-4">Credits</th>
                <th className="text-right text-[10px] text-white/60 font-mono uppercase tracking-widest pb-3">Efficiency (kWh/t)</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((row, idx) => (
                <tr key={row.unit} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                  <td className="py-3 pr-4">
                    <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                      idx === 0 ? 'bg-amber-500/20 text-amber-400' :
                      idx === 1 ? 'bg-slate-400/20 text-slate-300' :
                      idx === 2 ? 'bg-orange-600/20 text-orange-400' :
                      'bg-white/[0.04] text-white/60'
                    }`}>
                      {idx + 1}
                    </span>
                  </td>
                  <td className="py-3 pr-4 text-sm text-white/80 font-mono">{row.unit}</td>
                  <td className="py-3 pr-4 text-sm text-emerald-400 font-mono text-right">{row.co2Total.toLocaleString()}</td>
                  <td className="py-3 pr-4 text-sm text-cyan-400 font-mono text-right">{row.credits}</td>
                  <td className="py-3 text-sm text-purple-400 font-mono text-right">{row.efficiency}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </GlassCard>

      {/* Credit lookup */}
      <p className="text-white/50 text-xs font-mono uppercase tracking-widest mb-3">Credit Lookup</p>
      <CreditLookup />
    </div>
  );
}

// ============================================
// Portfolio Tab (enhanced)
// ============================================

function shortTokenId(id: bigint): string {
  const s = id.toString();
  return s.length > 12 ? `${s.slice(0, 6)}…${s.slice(-4)}` : s;
}

function shortHash(hash: string): string {
  return hash.length > 14 ? `${hash.slice(0, 8)}…${hash.slice(-6)}` : hash;
}

function cleanRevertReason(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  const match = msg.match(/reason:\s*(.+)/i) ?? msg.match(/reverted[^:]*:\s*(.+)/i);
  const firstLine = (match?.[1] ?? msg).split('\n')[0] ?? msg;
  return firstLine.slice(0, 140);
}

function PortfolioTab() {
  const { wallet, addNotification } = useApp();
  const address = wallet.connected ? (wallet.address as Address) : undefined;

  const { credits, isLoading, error, refetch } = usePortfolio(address);
  const { retire, isPending: retiring } = useRetireCredit();
  const { transfer, isPending: transferring } = useTransferCredit();
  const { batchRetire, isPending: batchRetiring } = useBatchRetireCredits();
  const busy = retiring || transferring || batchRetiring;

  const [lookupId, setLookupId] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [retireFormOpen, setRetireFormOpen] = useState<string | null>(null);
  const [retireQuantity, setRetireQuantity] = useState('1');
  const [retireReason, setRetireReason] = useState('');
  const [retireBeneficiary, setRetireBeneficiary] = useState('');
  const [transferModalOpen, setTransferModalOpen] = useState<string | null>(null);
  const [transferAddress, setTransferAddress] = useState('');
  const [transferQuantity, setTransferQuantity] = useState('1');

  const lookupTokenId = useMemo(() => {
    const t = lookupId.trim();
    if (!t) return undefined;
    try {
      const v = BigInt(t);
      return v >= 0n ? v : undefined;
    } catch {
      return undefined;
    }
  }, [lookupId]);

  const { balance, isLoading: balanceLoading } = useCreditBalance(address, lookupTokenId ?? 0n);

  const activeCredits = useMemo(
    () => credits.filter(c => !c.isRetired && c.balance > 0),
    [credits]
  );

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIds(prev =>
      prev.size === activeCredits.length
        ? new Set()
        : new Set(activeCredits.map(c => c.tokenId.toString()))
    );
  }, [activeCredits]);

  const resolveReason = useCallback(() => {
    const r = retireReason.trim();
    const b = retireBeneficiary.trim();
    if (r && b) return `${r} (beneficiary: ${b})`;
    if (r) return r;
    if (b) return `Retired on behalf of ${b}`;
    return 'Voluntary retirement';
  }, [retireReason, retireBeneficiary]);

  const afterWrite = useCallback(
    (title: string, hash: string) => {
      addNotification({ type: 'success', title, message: `Tx ${shortHash(hash)}` });
      setRetireFormOpen(null);
      setTransferModalOpen(null);
      setSelectedIds(new Set());
      setTimeout(() => refetch(), 2500);
    },
    [addNotification, refetch]
  );

  const onError = useCallback(
    (title: string, err: unknown) => {
      addNotification({ type: 'error', title, message: cleanRevertReason(err) });
    },
    [addNotification]
  );

  const parseAmount = useCallback((raw: string): bigint | null => {
    try {
      const v = BigInt(raw || '0');
      return v > 0n ? v : null;
    } catch {
      return null;
    }
  }, []);

  const handleRetire = useCallback(
    async (tokenId: bigint, maxBalance: number) => {
      const amount = parseAmount(retireQuantity);
      if (!amount || Number(amount) > maxBalance) {
        onError('Invalid quantity', `Enter a whole number between 1 and ${maxBalance}`);
        return;
      }
      try {
        const hash = await retire(tokenId, amount, resolveReason());
        afterWrite('Retirement submitted', hash as string);
      } catch (e) {
        onError('Retirement failed', e);
      }
    },
    [retireQuantity, parseAmount, retire, resolveReason, afterWrite, onError]
  );

  const handleBulkRetire = useCallback(async () => {
    const amount = parseAmount(retireQuantity);
    if (!amount) {
      onError('Invalid quantity', 'Enter a positive whole number');
      return;
    }
    const chosen = activeCredits.filter(c => selectedIds.has(c.tokenId.toString()));
    if (chosen.length === 0) return;
    const overflow = chosen.find(c => Number(amount) > c.balance);
    if (overflow) {
      onError('Quantity exceeds balance', `#${shortTokenId(overflow.tokenId)} holds ${overflow.balance}`);
      return;
    }
    try {
      const hash = await batchRetire(
        chosen.map(c => c.tokenId),
        chosen.map(() => amount),
        resolveReason()
      );
      afterWrite(`Retired ${chosen.length} batch${chosen.length > 1 ? 'es' : ''}`, hash as string);
    } catch (e) {
      onError('Bulk retirement failed', e);
    }
  }, [retireQuantity, parseAmount, activeCredits, selectedIds, batchRetire, resolveReason, afterWrite, onError]);

  const handleTransfer = useCallback(
    async (tokenId: bigint, maxBalance: number) => {
      const amount = parseAmount(transferQuantity);
      if (!amount || Number(amount) > maxBalance) {
        onError('Invalid quantity', `Enter a whole number between 1 and ${maxBalance}`);
        return;
      }
      if (!/^0x[a-fA-F0-9]{40}$/.test(transferAddress.trim())) {
        onError('Invalid address', 'Enter a valid 0x… recipient address');
        return;
      }
      try {
        const hash = await transfer(transferAddress.trim() as Address, tokenId, amount);
        afterWrite('Transfer submitted', hash as string);
      } catch (e) {
        onError('Transfer failed', e);
      }
    },
    [transferQuantity, transferAddress, parseAmount, transfer, afterWrite, onError]
  );

  const handleBulkTransfer = useCallback(async () => {
    const amount = parseAmount(transferQuantity);
    if (!amount) {
      onError('Invalid quantity', 'Enter a positive whole number');
      return;
    }
    if (!/^0x[a-fA-F0-9]{40}$/.test(transferAddress.trim())) {
      onError('Invalid address', 'Enter a valid 0x… recipient address');
      return;
    }
    const chosen = activeCredits.filter(
      c => selectedIds.has(c.tokenId.toString()) && c.balance >= Number(amount)
    );
    if (chosen.length === 0) {
      onError('Nothing to transfer', 'No selected batch holds enough balance');
      return;
    }
    try {
      let last = '';
      for (const c of chosen) {
        last = (await transfer(transferAddress.trim() as Address, c.tokenId, amount)) as string;
      }
      afterWrite(`Transferred ${chosen.length} batch${chosen.length > 1 ? 'es' : ''}`, last);
    } catch (e) {
      onError('Bulk transfer failed', e);
    }
  }, [transferQuantity, transferAddress, parseAmount, activeCredits, selectedIds, transfer, afterWrite, onError]);

  if (!wallet.connected) {
    return <ConnectWalletPrompt message="Connect your wallet to view your carbon credit portfolio and balances." />;
  }

  return (
    <div>
      {/* Balance lookup */}
      <GlassCard className="p-5 mb-6">
        <p className="text-white/50 text-xs font-mono uppercase tracking-widest mb-3">Check Balance for Token ID</p>
        <div className="flex gap-3 items-center">
          <input
            type="text"
            inputMode="numeric"
            placeholder="Token ID..."
            value={lookupId}
            onChange={(e) => setLookupId(e.target.value)}
            className="px-4 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white placeholder-white/30 text-sm font-mono focus:outline-none focus:border-emerald-500/40 transition-all w-40"
          />
          {lookupTokenId !== undefined && (
            <span className="text-white/60 text-sm font-mono">
              Balance: {balanceLoading ? (
                <Skeleton className="inline-block h-4 w-12" />
              ) : (
                <span className="text-emerald-400 font-bold">{balance !== undefined ? balance.toString() : '--'}</span>
              )}
            </span>
          )}
        </div>
      </GlassCard>

      {/* Bulk actions bar */}
      {selectedIds.size > 0 && (
        <div className="mb-4 flex items-center gap-3 p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
          <span className="text-sm text-emerald-400 font-medium">{selectedIds.size} selected</span>
          <div className="flex-1" />
          <button
            onClick={() => {
              setRetireFormOpen('bulk');
              setTransferModalOpen(null);
              setRetireQuantity('1');
              setRetireReason('');
              setRetireBeneficiary('');
            }}
            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-all"
          >
            Retire Selected
          </button>
          <button
            onClick={() => {
              setTransferModalOpen('bulk');
              setRetireFormOpen(null);
              setTransferAddress('');
              setTransferQuantity('1');
            }}
            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 hover:bg-cyan-500/20 transition-all"
          >
            Transfer Selected
          </button>
          <button onClick={() => setSelectedIds(new Set())} className="px-2 py-1.5 text-xs text-white/40 hover:text-white/60 transition">
            Clear
          </button>
        </div>
      )}

      {/* Bulk retire form */}
      {retireFormOpen === 'bulk' && (
        <GlassCard className="p-5 mb-6 border-red-500/20">
          <p className="text-white/70 text-sm font-medium mb-3">Retire {selectedIds.size} Selected Credits</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
            <div>
              <label className="text-[10px] text-white/40 font-mono uppercase tracking-widest">Quantity per credit</label>
              <input type="number" min="1" value={retireQuantity} onChange={e => setRetireQuantity(e.target.value)}
                className="mt-1 w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white text-sm font-mono focus:outline-none focus:border-emerald-500/40 transition-all" />
            </div>
            <div>
              <label className="text-[10px] text-white/40 font-mono uppercase tracking-widest">Beneficiary</label>
              <input type="text" placeholder="Name or org..." value={retireBeneficiary} onChange={e => setRetireBeneficiary(e.target.value)}
                className="mt-1 w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white placeholder-white/20 text-sm focus:outline-none focus:border-emerald-500/40 transition-all" />
            </div>
            <div>
              <label className="text-[10px] text-white/40 font-mono uppercase tracking-widest">Reason</label>
              <input type="text" placeholder="Retirement reason..." value={retireReason} onChange={e => setRetireReason(e.target.value)}
                className="mt-1 w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white placeholder-white/20 text-sm focus:outline-none focus:border-emerald-500/40 transition-all" />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleBulkRetire}
              disabled={busy}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {batchRetiring ? 'Submitting…' : 'Confirm Retirement'}
            </button>
            <button onClick={() => setRetireFormOpen(null)} className="px-4 py-2 text-sm text-white/40 hover:text-white/60 transition">Cancel</button>
          </div>
        </GlassCard>
      )}

      {/* Bulk transfer modal */}
      {transferModalOpen === 'bulk' && (
        <GlassCard className="p-5 mb-6 border-cyan-500/20">
          <p className="text-white/70 text-sm font-medium mb-3">Transfer {selectedIds.size} Selected Credits</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
            <div>
              <label className="text-[10px] text-white/40 font-mono uppercase tracking-widest">Recipient Address</label>
              <input type="text" placeholder="0x..." value={transferAddress} onChange={e => setTransferAddress(e.target.value)}
                className="mt-1 w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white placeholder-white/20 text-sm font-mono focus:outline-none focus:border-emerald-500/40 transition-all" />
            </div>
            <div>
              <label className="text-[10px] text-white/40 font-mono uppercase tracking-widest">Quantity per credit</label>
              <input type="number" min="1" value={transferQuantity} onChange={e => setTransferQuantity(e.target.value)}
                className="mt-1 w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white text-sm font-mono focus:outline-none focus:border-emerald-500/40 transition-all" />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleBulkTransfer}
              disabled={busy}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {transferring ? 'Submitting…' : 'Confirm Transfer'}
            </button>
            <button onClick={() => setTransferModalOpen(null)} className="px-4 py-2 text-sm text-white/40 hover:text-white/60 transition">Cancel</button>
          </div>
        </GlassCard>
      )}

      {/* Portfolio header with select all */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-white/50 text-xs font-mono uppercase tracking-widest">
          Portfolio Overview{credits.length > 0 ? ` · ${credits.length}` : ''}
        </p>
        <div className="flex items-center gap-3">
          <button onClick={() => refetch()} className="text-xs text-white/40 hover:text-white/60 transition">Refresh</button>
          {activeCredits.length > 0 && (
            <button onClick={selectAll} className="text-xs text-white/40 hover:text-white/60 transition">
              {selectedIds.size === activeCredits.length ? 'Deselect All' : 'Select All Active'}
            </button>
          )}
        </div>
      </div>

      {error ? (
        <GlassCard className="p-8 text-center border-red-500/20">
          <p className="text-red-400 text-sm font-medium mb-1">Couldn&apos;t load your portfolio</p>
          <p className="text-white/40 text-xs font-mono break-all">{cleanRevertReason(error)}</p>
          <button onClick={() => refetch()} className="mt-4 px-4 py-2 text-xs font-medium rounded-lg bg-white/[0.06] text-white/70 hover:bg-white/[0.1] transition">Retry</button>
        </GlassCard>
      ) : isLoading && credits.length === 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => (
            <GlassCard key={i} className="p-5">
              <Skeleton className="h-5 w-24 mb-3" />
              <Skeleton className="h-3 w-32 mb-4" />
              <Skeleton className="h-24 w-full" />
            </GlassCard>
          ))}
        </div>
      ) : credits.length === 0 ? (
        <GlassCard className="p-10 text-center">
          <p className="text-white/70 text-sm font-medium mb-1">No carbon credits yet</p>
          <p className="text-white/40 text-xs max-w-md mx-auto">
            This wallet holds no CarbonCredit tokens on the connected network. Credits you are minted or receive by transfer will appear here automatically.
          </p>
        </GlassCard>
      ) : (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {credits.map((credit) => {
          const idKey = credit.tokenId.toString();
          const actionable = !credit.isRetired && credit.balance > 0;
          return (
          <GlassCard key={idKey} className={`p-5 transition-all ${selectedIds.has(idKey) ? 'border-emerald-500/30 bg-emerald-500/[0.02]' : 'hover:border-white/[0.12]'}`}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                {actionable && (
                  <button
                    onClick={() => toggleSelect(idKey)}
                    className={`w-4 h-4 rounded border transition-all flex items-center justify-center ${
                      selectedIds.has(idKey)
                        ? 'bg-emerald-500/30 border-emerald-500/50'
                        : 'border-white/20 hover:border-white/40'
                    }`}
                  >
                    {selectedIds.has(idKey) && (
                      <svg className="w-3 h-3 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                )}
                <span className="text-white font-mono font-bold" title={idKey}>#{shortTokenId(credit.tokenId)}</span>
              </div>
              <StatusBadge status={credit.isRetired ? 'retired' : 'active'} />
            </div>
            <p className="text-white/40 text-xs font-mono mb-3">{credit.dacUnitId}</p>
            <div className="space-y-1.5 mb-3">
              <div className="flex justify-between text-xs">
                <span className="text-white/40">CO2</span>
                <span className="text-emerald-400 font-mono">{credit.co2AmountKg.toLocaleString()} kg</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-white/40">Energy</span>
                <span className="text-cyan-400 font-mono">{credit.energyConsumedKwh} kWh</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-white/40">Purity</span>
                <span className="text-blue-400 font-mono">{credit.purityPercentage}%</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-white/40">Balance</span>
                <span className="text-white font-mono font-bold">{credit.balance}</span>
              </div>
            </div>

            {/* Mini verification badges */}
            <div className="flex gap-1.5 pt-2 border-t border-white/[0.06] mb-3">
              <span className={`px-2 py-0.5 rounded text-[10px] font-mono ${credit.sourceVerified ? 'bg-emerald-500/10 text-emerald-400' : 'bg-white/[0.04] text-white/60'}`}>SRC</span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-mono ${credit.logicVerified ? 'bg-emerald-500/10 text-emerald-400' : 'bg-white/[0.04] text-white/60'}`}>LOG</span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-mono ${credit.mintVerified ? 'bg-emerald-500/10 text-emerald-400' : 'bg-white/[0.04] text-white/60'}`}>MNT</span>
            </div>

            {/* Action buttons */}
            {actionable && (
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setRetireFormOpen(retireFormOpen === idKey ? null : idKey);
                    setTransferModalOpen(null);
                    setRetireQuantity('1');
                    setRetireReason('');
                    setRetireBeneficiary('');
                  }}
                  className="flex-1 px-2 py-1.5 text-[10px] font-medium rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-all"
                >
                  Retire
                </button>
                <button
                  onClick={() => {
                    setTransferModalOpen(transferModalOpen === idKey ? null : idKey);
                    setRetireFormOpen(null);
                    setTransferAddress('');
                    setTransferQuantity('1');
                  }}
                  className="flex-1 px-2 py-1.5 text-[10px] font-medium rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 hover:bg-cyan-500/20 transition-all"
                >
                  Transfer
                </button>
              </div>
            )}

            {/* Inline retire form */}
            {retireFormOpen === idKey && (
              <div className="mt-3 pt-3 border-t border-white/[0.06] space-y-2">
                <p className="text-[10px] text-white/50 font-mono uppercase tracking-widest">Retire Credits</p>
                <input type="number" min="1" max={credit.balance} value={retireQuantity} onChange={e => setRetireQuantity(e.target.value)}
                  placeholder="Quantity" className="w-full px-2.5 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white text-xs font-mono focus:outline-none focus:border-emerald-500/40 transition-all" />
                <input type="text" value={retireBeneficiary} onChange={e => setRetireBeneficiary(e.target.value)}
                  placeholder="Beneficiary..." className="w-full px-2.5 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white placeholder-white/20 text-xs focus:outline-none focus:border-emerald-500/40 transition-all" />
                <input type="text" value={retireReason} onChange={e => setRetireReason(e.target.value)}
                  placeholder="Reason..." className="w-full px-2.5 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white placeholder-white/20 text-xs focus:outline-none focus:border-emerald-500/40 transition-all" />
                <div className="flex gap-2">
                  <button
                    onClick={() => handleRetire(credit.tokenId, credit.balance)}
                    disabled={busy}
                    className="flex-1 px-2 py-1.5 text-[10px] font-medium rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {retiring ? 'Submitting…' : 'Confirm'}
                  </button>
                  <button onClick={() => setRetireFormOpen(null)} className="px-2 py-1.5 text-[10px] text-white/40 hover:text-white/60 transition">Cancel</button>
                </div>
              </div>
            )}

            {/* Inline transfer modal */}
            {transferModalOpen === idKey && (
              <div className="mt-3 pt-3 border-t border-white/[0.06] space-y-2">
                <p className="text-[10px] text-white/50 font-mono uppercase tracking-widest">Transfer Credits</p>
                <input type="text" value={transferAddress} onChange={e => setTransferAddress(e.target.value)}
                  placeholder="Recipient 0x..." className="w-full px-2.5 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white placeholder-white/20 text-xs font-mono focus:outline-none focus:border-emerald-500/40 transition-all" />
                <input type="number" min="1" max={credit.balance} value={transferQuantity} onChange={e => setTransferQuantity(e.target.value)}
                  placeholder="Quantity" className="w-full px-2.5 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white text-xs font-mono focus:outline-none focus:border-emerald-500/40 transition-all" />
                <div className="flex gap-2">
                  <button
                    onClick={() => handleTransfer(credit.tokenId, credit.balance)}
                    disabled={busy}
                    className="flex-1 px-2 py-1.5 text-[10px] font-medium rounded-lg bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {transferring ? 'Submitting…' : 'Confirm'}
                  </button>
                  <button onClick={() => setTransferModalOpen(null)} className="px-2 py-1.5 text-[10px] text-white/40 hover:text-white/60 transition">Cancel</button>
                </div>
              </div>
            )}
          </GlassCard>
          );
        })}
      </div>
      )}
    </div>
  );
}

// ============================================
// Verification Tab (enhanced with simulator)
// ============================================

function VerificationTab() {
  const { thresholds, isLoading } = useVerificationThresholds();
  const [simCo2, setSimCo2] = useState('');
  const [simEnergy, setSimEnergy] = useState('');

  const simResult = useMemo(() => {
    const co2 = parseFloat(simCo2);
    const energy = parseFloat(simEnergy);
    if (isNaN(co2) || isNaN(energy) || co2 <= 0 || energy <= 0) return null;
    const co2Tonnes = co2 / 1000;
    const ratio = energy / co2Tonnes;
    const minRatio = 200;
    const maxRatio = 600;
    const passed = ratio >= minRatio && ratio <= maxRatio;
    const gaugePosition = Math.max(0, Math.min(100, ((ratio - 100) / (700 - 100)) * 100));
    const validStart = ((minRatio - 100) / (700 - 100)) * 100;
    const validEnd = ((maxRatio - 100) / (700 - 100)) * 100;
    return { co2, energy, co2Tonnes, ratio, passed, gaugePosition, validStart, validEnd, minRatio, maxRatio };
  }, [simCo2, simEnergy]);

  const phases = [
    {
      step: 1,
      title: 'Source Check',
      description: 'Validates that IoT sensor data originates from a whitelisted DAC unit. Checks device identity, data freshness, and tamper-proof signatures.',
      color: 'emerald' as const,
      icon: (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      ),
    },
    {
      step: 2,
      title: 'Logic Check',
      description: 'Physics-based validation of CO2 capture claims. Verifies thermodynamic consistency between energy consumed and CO2 captured using DAC efficiency models.',
      color: 'cyan' as const,
      icon: (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
        </svg>
      ),
    },
    {
      step: 3,
      title: 'Mint Check',
      description: 'Final governance approval before ERC-1155 credit minting. Confirms all verification stages passed and issues the on-chain carbon credit token.',
      color: 'purple' as const,
      icon: (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
  ];

  const defaultPhaseColors = { bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', text: 'text-emerald-400', line: 'bg-emerald-500/30' };
  const phaseColors: Record<string, { bg: string; border: string; text: string; line: string }> = {
    emerald: defaultPhaseColors,
    cyan: { bg: 'bg-cyan-500/10', border: 'border-cyan-500/20', text: 'text-cyan-400', line: 'bg-cyan-500/30' },
    purple: { bg: 'bg-purple-500/10', border: 'border-purple-500/20', text: 'text-purple-400', line: 'bg-purple-500/30' },
  };

  const whatIfScenarios = [
    { title: 'Optimal Capture', co2: 1000, energy: 350, description: 'A well-tuned DAC unit capturing 1 tonne of CO2 with 350 kWh. Ratio: 350 kWh/t (well within 200-600 range). PASS.' },
    { title: 'Edge Case - Minimum', co2: 500, energy: 100, description: '500 kg CO2 with only 100 kWh energy. Ratio: 200 kWh/t - exactly at the lower boundary. PASS (barely).' },
    { title: 'Suspicious Efficiency', co2: 2000, energy: 150, description: '2 tonnes captured with only 150 kWh. Ratio: 75 kWh/t - impossibly efficient, likely fraudulent sensor data. FAIL.' },
    { title: 'Energy Waste', co2: 100, energy: 800, description: '100 kg captured using 800 kWh. Ratio: 8000 kWh/t - massive energy waste, indicates equipment malfunction. FAIL.' },
  ];

  return (
    <div>
      {/* Thresholds display */}
      <GlassCard className="p-5 mb-8">
        <p className="text-white/50 text-xs font-mono uppercase tracking-widest mb-4">Verification Thresholds</p>
        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : thresholds ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-3 rounded-xl bg-white/[0.03]">
              <p className="text-white/40 text-[10px] font-mono uppercase mb-1">Min Energy</p>
              <p className="text-emerald-400 font-mono font-bold text-sm">{Number(thresholds.minKwh)} kWh</p>
            </div>
            <div className="p-3 rounded-xl bg-white/[0.03]">
              <p className="text-white/40 text-[10px] font-mono uppercase mb-1">Max Energy</p>
              <p className="text-cyan-400 font-mono font-bold text-sm">{Number(thresholds.maxKwh)} kWh</p>
            </div>
            <div className="p-3 rounded-xl bg-white/[0.03]">
              <p className="text-white/40 text-[10px] font-mono uppercase mb-1">Optimal Energy</p>
              <p className="text-blue-400 font-mono font-bold text-sm">{Number(thresholds.optimalKwh)} kWh</p>
            </div>
            <div className="p-3 rounded-xl bg-white/[0.03]">
              <p className="text-white/40 text-[10px] font-mono uppercase mb-1">Min Purity</p>
              <p className="text-purple-400 font-mono font-bold text-sm">{thresholds.minPurity}%</p>
            </div>
          </div>
        ) : (
          <p className="text-white/60 text-sm">Threshold data not yet available from the verification engine.</p>
        )}
      </GlassCard>

      {/* Verification Simulator */}
      <GlassCard className="p-6 mb-8">
        <p className="text-white/50 text-xs font-mono uppercase tracking-widest mb-4">Verification Simulator</p>
        <p className="text-white/60 text-sm mb-4">Test how the Proof-of-Physics logic check evaluates a capture claim. Enter CO2 captured and energy consumed to see if it passes.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="text-[10px] text-white/40 font-mono uppercase tracking-widest">CO2 Captured (kg)</label>
            <input
              type="number"
              min="0"
              value={simCo2}
              onChange={e => setSimCo2(e.target.value)}
              placeholder="e.g. 1000"
              className="mt-1 w-full px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white placeholder-white/20 text-sm font-mono focus:outline-none focus:border-emerald-500/40 transition-all"
            />
          </div>
          <div>
            <label className="text-[10px] text-white/40 font-mono uppercase tracking-widest">Energy Used (kWh)</label>
            <input
              type="number"
              min="0"
              value={simEnergy}
              onChange={e => setSimEnergy(e.target.value)}
              placeholder="e.g. 350"
              className="mt-1 w-full px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white placeholder-white/20 text-sm font-mono focus:outline-none focus:border-emerald-500/40 transition-all"
            />
          </div>
        </div>

        {simResult && (
          <div className="space-y-4">
            {/* Result badge */}
            <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl border ${
              simResult.passed ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-red-500/10 border-red-500/30 text-red-400'
            }`}>
              {simResult.passed ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
              <span className="font-bold text-sm">{simResult.passed ? 'VERIFICATION PASSED' : 'VERIFICATION FAILED'}</span>
            </div>

            {/* Efficiency ratio */}
            <div className="grid grid-cols-3 gap-4">
              <div className="p-3 rounded-xl bg-white/[0.03]">
                <p className="text-white/40 text-[10px] font-mono uppercase mb-1">Efficiency Ratio</p>
                <p className={`font-mono font-bold ${simResult.passed ? 'text-emerald-400' : 'text-red-400'}`}>
                  {simResult.ratio.toFixed(1)} kWh/t
                </p>
              </div>
              <div className="p-3 rounded-xl bg-white/[0.03]">
                <p className="text-white/40 text-[10px] font-mono uppercase mb-1">Valid Range</p>
                <p className="text-cyan-400 font-mono font-bold">{simResult.minRatio}-{simResult.maxRatio} kWh/t</p>
              </div>
              <div className="p-3 rounded-xl bg-white/[0.03]">
                <p className="text-white/40 text-[10px] font-mono uppercase mb-1">CO2 in Tonnes</p>
                <p className="text-white/70 font-mono font-bold">{simResult.co2Tonnes.toFixed(3)} t</p>
              </div>
            </div>

            {/* Visual gauge */}
            <div>
              <p className="text-white/40 text-[10px] font-mono uppercase tracking-widest mb-2">Efficiency Gauge</p>
              <div className="relative h-8 rounded-full bg-white/[0.04] overflow-hidden">
                {/* Valid range highlight */}
                <div
                  className="absolute top-0 bottom-0 bg-emerald-500/15 border-l border-r border-emerald-500/30"
                  style={{ left: `${simResult.validStart}%`, width: `${simResult.validEnd - simResult.validStart}%` }}
                />
                {/* Marker */}
                <div
                  className={`absolute top-0 bottom-0 w-1 ${simResult.passed ? 'bg-emerald-400' : 'bg-red-400'} shadow-lg`}
                  style={{ left: `${simResult.gaugePosition}%` }}
                >
                  <div className={`absolute -top-6 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded text-[10px] font-mono whitespace-nowrap ${
                    simResult.passed ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                  }`}>
                    {simResult.ratio.toFixed(0)}
                  </div>
                </div>
                {/* Labels */}
                <div className="absolute bottom-0.5 left-1 text-[9px] text-white/55 font-mono">100</div>
                <div className="absolute bottom-0.5 right-1 text-[9px] text-white/55 font-mono">700</div>
                <div className="absolute bottom-0.5 text-[9px] text-emerald-400/40 font-mono" style={{ left: `${simResult.validStart}%`, transform: 'translateX(-50%)' }}>200</div>
                <div className="absolute bottom-0.5 text-[9px] text-emerald-400/40 font-mono" style={{ left: `${simResult.validEnd}%`, transform: 'translateX(-50%)' }}>600</div>
              </div>
            </div>

            {/* Explanation */}
            <p className="text-white/40 text-sm">
              {simResult.passed
                ? `The efficiency ratio of ${simResult.ratio.toFixed(1)} kWh/tonne falls within the valid range (200-600 kWh/t), indicating thermodynamically consistent capture performance. This claim would pass the Logic Check phase.`
                : simResult.ratio < simResult.minRatio
                  ? `The efficiency ratio of ${simResult.ratio.toFixed(1)} kWh/tonne is below the minimum threshold (200 kWh/t). This suggests the CO2 capture claim is implausibly high relative to energy input, possibly indicating sensor tampering or data fraud.`
                  : `The efficiency ratio of ${simResult.ratio.toFixed(1)} kWh/tonne exceeds the maximum threshold (600 kWh/t). This indicates extreme energy waste relative to CO2 captured, suggesting equipment malfunction or grossly inefficient operation.`
              }
            </p>
          </div>
        )}

        {!simResult && simCo2 === '' && simEnergy === '' && (
          <div className="text-center py-6 text-white/55 text-sm">
            Enter values above to simulate a verification check.
          </div>
        )}
      </GlassCard>

      {/* What-if scenario cards */}
      <p className="text-white/50 text-xs font-mono uppercase tracking-widest mb-4">What-If Scenarios</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        {whatIfScenarios.map((scenario) => {
          const co2Tonnes = scenario.co2 / 1000;
          const ratio = scenario.energy / co2Tonnes;
          const passed = ratio >= 200 && ratio <= 600;
          return (
            <GlassCard key={scenario.title} className={`p-5 border ${passed ? 'border-emerald-500/10' : 'border-red-500/10'}`}>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-white font-medium text-sm">{scenario.title}</h4>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${passed ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                  {passed ? 'PASS' : 'FAIL'}
                </span>
              </div>
              <div className="flex gap-4 mb-2">
                <span className="text-xs text-white/40 font-mono">CO2: {scenario.co2} kg</span>
                <span className="text-xs text-white/40 font-mono">Energy: {scenario.energy} kWh</span>
                <span className={`text-xs font-mono font-bold ${passed ? 'text-emerald-400' : 'text-red-400'}`}>{ratio.toFixed(0)} kWh/t</span>
              </div>
              <p className="text-white/60 text-xs leading-relaxed">{scenario.description}</p>
              <button
                onClick={() => { setSimCo2(String(scenario.co2)); setSimEnergy(String(scenario.energy)); }}
                className="mt-2 text-[10px] text-emerald-400/60 hover:text-emerald-400 transition font-mono"
              >
                Try in simulator
              </button>
            </GlassCard>
          );
        })}
      </div>

      {/* Verification pipeline */}
      <p className="text-white/50 text-xs font-mono uppercase tracking-widest mb-4">Proof-of-Physics Pipeline</p>
      <div className="space-y-4">
        {phases.map((phase, idx) => {
          const c = phaseColors[phase.color] ?? defaultPhaseColors;
          return (
            <div key={phase.step} className="relative">
              {idx < phases.length - 1 && (
                <div className={`absolute left-[23px] top-[60px] bottom-[-16px] w-0.5 ${c.line}`} />
              )}
              <GlassCard className="p-5">
                <div className="flex gap-4">
                  <div className={`shrink-0 h-[46px] w-[46px] rounded-xl ${c.bg} border ${c.border} flex items-center justify-center ${c.text}`}>
                    {phase.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <span className={`text-xs font-mono ${c.text}`}>Phase {phase.step}</span>
                      <h3 className="text-white font-display font-semibold">{phase.title}</h3>
                    </div>
                    <p className="text-white/40 text-sm font-body leading-relaxed">{phase.description}</p>
                  </div>
                </div>
              </GlassCard>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================
// Provenance Tab (NEW)
// ============================================

const PROVENANCE_EVENT_COLORS: Record<ProvenanceEventType, { dot: string; line: string; bg: string; text: string }> = {
  CAPTURE_STARTED: { dot: 'bg-blue-400', line: 'bg-blue-500/30', bg: 'bg-blue-500/10', text: 'text-blue-400' },
  SOURCE_VERIFIED: { dot: 'bg-emerald-400', line: 'bg-emerald-500/30', bg: 'bg-emerald-500/10', text: 'text-emerald-400' },
  LOGIC_VERIFIED: { dot: 'bg-cyan-400', line: 'bg-cyan-500/30', bg: 'bg-cyan-500/10', text: 'text-cyan-400' },
  MINT_VERIFIED: { dot: 'bg-purple-400', line: 'bg-purple-500/30', bg: 'bg-purple-500/10', text: 'text-purple-400' },
  MINTED: { dot: 'bg-emerald-400', line: 'bg-emerald-500/30', bg: 'bg-emerald-500/10', text: 'text-emerald-400' },
  TRANSFERRED: { dot: 'bg-amber-400', line: 'bg-amber-500/30', bg: 'bg-amber-500/10', text: 'text-amber-400' },
  RETIRED: { dot: 'bg-slate-400', line: 'bg-slate-500/30', bg: 'bg-slate-500/10', text: 'text-slate-400' },
};

const PROVENANCE_EVENT_LABELS: Record<ProvenanceEventType, string> = {
  CAPTURE_STARTED: 'Capture Started',
  SOURCE_VERIFIED: 'Source Verified',
  LOGIC_VERIFIED: 'Logic Verified',
  MINT_VERIFIED: 'Mint Verified',
  MINTED: 'Minted',
  TRANSFERRED: 'Transferred',
  RETIRED: 'Retired',
};

function ProvenanceTab() {
  const { wallet } = useApp();
  const [tokenInput, setTokenInput] = useState('');

  const tokenId = useMemo(() => {
    const t = tokenInput.trim();
    if (!t) return undefined;
    try {
      const v = BigInt(t);
      return v >= 0n ? v : undefined;
    } catch {
      return undefined;
    }
  }, [tokenInput]);

  const { entries: events, meta: tokenCredit, isLoading, error, notFound } = useProvenance(tokenId);
  // The wallet's own holdings double as one-click lookups (token IDs are
  // hash-derived and impractical to type by hand).
  const { credits: ownCredits } = usePortfolio(
    wallet.connected ? (wallet.address as Address) : undefined
  );

  return (
    <div>
      <GlassCard className="p-6 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-end gap-4">
          <div className="flex-1">
            <p className="text-white/50 text-xs font-mono uppercase tracking-widest mb-2">Token Provenance Tracker</p>
            <p className="text-white/60 text-sm mb-3">
              Trace the complete lifecycle of any carbon credit from DAC capture to on-chain minting and beyond. This is TerraQura&apos;s core transparency layer.
            </p>
            <div className="relative max-w-md">
              <input
                type="text"
                inputMode="numeric"
                placeholder="Paste a Token ID..."
                value={tokenInput}
                onChange={e => setTokenInput(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white placeholder-white/30 text-sm font-mono focus:outline-none focus:border-emerald-500/40 focus:bg-white/[0.06] transition-all"
              />
            </div>
            {ownCredits.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                <span className="text-white/40 text-[10px] font-mono uppercase tracking-widest self-center">Your credits:</span>
                {ownCredits.map((c) => (
                  <button
                    key={c.tokenId.toString()}
                    onClick={() => setTokenInput(c.tokenId.toString())}
                    className="px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px] font-mono hover:bg-emerald-500/20 transition-all"
                  >
                    {c.dacUnitId} · #{shortTokenId(c.tokenId)}
                  </button>
                ))}
              </div>
            )}
          </div>
          {tokenCredit && (
            <div className="flex gap-3">
              <div className="p-3 rounded-xl bg-white/[0.03]">
                <p className="text-white/40 text-[10px] font-mono uppercase mb-0.5">Unit</p>
                <p className="text-white/70 font-mono text-sm">{tokenCredit.dacUnitId}</p>
              </div>
              <div className="p-3 rounded-xl bg-white/[0.03]">
                <p className="text-white/40 text-[10px] font-mono uppercase mb-0.5">CO2</p>
                <p className="text-emerald-400 font-mono text-sm">{tokenCredit.co2AmountKg.toLocaleString()} kg</p>
              </div>
              <div className="p-3 rounded-xl bg-white/[0.03]">
                <p className="text-white/40 text-[10px] font-mono uppercase mb-0.5">Status</p>
                <StatusBadge status={tokenCredit.isRetired ? 'retired' : 'active'} />
              </div>
            </div>
          )}
        </div>
      </GlassCard>

      {isLoading && (
        <GlassCard className="p-8 text-center mb-6">
          <p className="text-white/50 text-sm font-mono">Reading provenance from chain…</p>
        </GlassCard>
      )}
      {error && (
        <GlassCard className="p-8 text-center mb-6 border-red-500/20">
          <p className="text-red-400 text-sm">Couldn&apos;t read provenance: {error.message.split('\n')[0]}</p>
        </GlassCard>
      )}

      {events ? (
        <div className="relative">
          {/* Timeline vertical line */}
          <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gradient-to-b from-emerald-500/40 via-emerald-500/20 to-transparent" />

          <div className="space-y-0">
            {events.map((evt, idx) => {
              const colors = PROVENANCE_EVENT_COLORS[evt.event];
              const isLast = idx === events.length - 1;
              const isComplete = evt.event !== 'TRANSFERRED'; // transfers are in-progress style for visual variety
              return (
                <div key={idx} className="relative pl-16 pb-8">
                  {/* Colored timeline segment */}
                  {!isLast && (
                    <div
                      className={`absolute left-[23px] top-[28px] bottom-0 w-0.5 ${
                        isComplete ? 'bg-emerald-500/40' : 'bg-amber-500/30'
                      }`}
                    />
                  )}

                  {/* Dot on timeline */}
                  <div className={`absolute left-4 top-2 w-5 h-5 rounded-full ${colors.dot} shadow-lg shadow-current/20 flex items-center justify-center`}>
                    <div className="w-2 h-2 rounded-full bg-white/80" />
                  </div>

                  {/* Event card */}
                  <GlassCard className={`p-5 border-l-2 ${isComplete ? 'border-l-emerald-500/50' : 'border-l-amber-500/50'}`}>
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${colors.bg} ${colors.text}`}>
                          {PROVENANCE_EVENT_LABELS[evt.event]}
                        </span>
                        <span className="text-white/60 text-xs font-mono">
                          {new Date(evt.timestamp * 1000).toLocaleString()}
                        </span>
                      </div>
                    </div>

                    <p className="text-white/50 text-sm mb-3">{evt.detail}</p>

                    {evt.txHash ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-white/60 text-[10px] font-mono uppercase shrink-0">TX</span>
                          <span className="text-white/50 text-xs font-mono truncate">{evt.txHash.slice(0, 18)}...{evt.txHash.slice(-8)}</span>
                          <CopyButton text={evt.txHash} />
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-white/60 text-[10px] font-mono uppercase shrink-0">Actor</span>
                          <span className="text-white/50 text-xs font-mono truncate">{evt.actor.slice(0, 10)}...{evt.actor.slice(-6)}</span>
                          <CopyButton text={evt.actor} />
                        </div>
                      </div>
                    ) : (
                      <p className="text-white/40 text-[10px] font-mono uppercase tracking-widest">
                        Read from verified contract state
                      </p>
                    )}
                  </GlassCard>
                </div>
              );
            })}
          </div>

          {/* End marker */}
          <div className="relative pl-16">
            <div className="absolute left-4 top-0 w-5 h-5 rounded-full bg-white/10 flex items-center justify-center">
              <div className="w-2 h-2 rounded-full bg-white/20" />
            </div>
            <p className="text-white/55 text-xs font-mono pt-1">End of provenance chain</p>
          </div>
        </div>
      ) : tokenInput !== '' && notFound ? (
        <GlassCard className="p-8 text-center">
          <p className="text-white/60 text-sm">No credit exists with this Token ID on the connected network.</p>
        </GlassCard>
      ) : tokenInput !== '' ? null : (
        <GlassCard className="p-12 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
            <svg className="w-8 h-8 text-emerald-400/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-white/40 text-sm mb-1">Enter a Token ID to view its full provenance chain</p>
          <p className="text-white/55 text-xs">Every carbon credit on TerraQura has a complete, immutable lifecycle record on-chain.</p>
        </GlassCard>
      )}
    </div>
  );
}

// ============================================
// Analytics Tab (NEW)
// ============================================

function AnalyticsTab() {
  const { stats } = useCreditStats();

  const totalMintedNum = useMemo(
    () => (stats?.mints ?? []).reduce((acc, m) => acc + m.amount, 0),
    [stats],
  );
  const totalRetiredNum = useMemo(
    () => (stats?.retires ?? []).reduce((acc, r) => acc + r.amount, 0),
    [stats],
  );
  const retirementRate = totalMintedNum > 0
    ? ((totalRetiredNum / totalMintedNum) * 100).toFixed(1)
    : '0.0';
  const avgTransfersPerCredit = (stats?.tokens.length ?? 0) > 0
    ? ((stats?.transfers.length ?? 0) / (stats?.tokens.length ?? 1)).toFixed(1)
    : '0.0';

  // Cumulative net supply per day over the last 90 days, from real events.
  const supplyOverTime = useMemo(() => {
    const now = Math.floor(Date.now() / 1000);
    const DAY = 86400;
    const start = now - 89 * DAY;
    const deltas = new Array<number>(90).fill(0);
    let baseline = 0;
    const bump = (timestamp: number, delta: number) => {
      const idx = Math.min(89, Math.floor((timestamp - start) / DAY));
      deltas[idx] = (deltas[idx] ?? 0) + delta;
    };
    for (const m of stats?.mints ?? []) {
      if (m.timestamp < start) baseline += m.amount;
      else bump(m.timestamp, m.amount);
    }
    for (const r of stats?.retires ?? []) {
      if (r.timestamp < start) baseline -= r.amount;
      else bump(r.timestamp, -r.amount);
    }
    let running = baseline;
    return deltas.map((d, i) => {
      running += d;
      return { day: i + 1, supply: running };
    });
  }, [stats]);
  const supplyMax = Math.max(1, ...supplyOverTime.map((d) => d.supply));

  const topHolders = useMemo(() => {
    const holders = (stats?.holders ?? []).slice(0, 5);
    const total = (stats?.holders ?? []).reduce((acc, h) => acc + h.balance, 0);
    return holders.map((h) => ({
      ...h,
      percentage: total > 0 ? Math.round((h.balance / total) * 100) : 0,
    }));
  }, [stats]);

  const vintages = useMemo(() => {
    const byYear = new Map<number, number>();
    for (const m of stats?.mints ?? []) {
      const token = stats?.tokens.find((t) => t.tokenId === m.tokenId);
      if (!token) continue;
      byYear.set(token.captureYear, (byYear.get(token.captureYear) ?? 0) + m.amount);
    }
    const palette = ['bg-emerald-500', 'bg-cyan-500', 'bg-blue-500', 'bg-purple-500'];
    return [...byYear.entries()]
      .sort(([a], [b]) => a - b)
      .map(([year, credits], i) => ({
        year,
        credits,
        color: palette[i % palette.length] ?? 'bg-emerald-500',
      }));
  }, [stats]);
  const vintageMax = Math.max(1, ...vintages.map((v) => v.credits));

  const funnel = useMemo(() => {
    const tokenCount = stats?.tokens.length ?? 0;
    const transferredTokens = new Set((stats?.transfers ?? []).map((t) => t.tokenId.toString())).size;
    const retiredTokens = new Set((stats?.retires ?? []).map((r) => r.tokenId.toString())).size;
    return [
      { label: 'Batches minted', count: tokenCount, color: 'bg-emerald-500' },
      { label: 'Transferred (at least once)', count: transferredTokens, color: 'bg-cyan-500' },
      { label: 'Retired (at least once)', count: retiredTokens, color: 'bg-slate-500' },
    ];
  }, [stats]);

  return (
    <div>
      {/* Key metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-8">
        <MetricCard label="Total Supply" value={totalMintedNum.toLocaleString()} unit="credits" />
        <MetricCard label="Retirement Rate" value={retirementRate} unit="%" />
        <MetricCard label="Credit Velocity" value={avgTransfersPerCredit} unit="transfers/credit" />
        <MetricCard label="Active Holders" value={(stats?.holders.length ?? 0).toString()} unit="wallets" />
      </div>

      {/* Supply over time (90 days) */}
      <GlassCard className="p-6 mb-8">
        <p className="text-white/50 text-xs font-mono uppercase tracking-widest mb-4">Total Supply Over 90 Days</p>
        <div className="flex items-end gap-px h-40">
          {supplyOverTime.map((d) => {
            const heightPct = (d.supply / supplyMax) * 100;
            return (
              <div key={d.day} className="flex-1 group relative">
                <div
                  className="w-full bg-emerald-500/20 hover:bg-emerald-500/40 transition-all rounded-t"
                  style={{ height: `${heightPct}%`, minHeight: '1px' }}
                />
                <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                  <div className="px-1.5 py-0.5 rounded bg-white/10 text-[9px] text-white/60 font-mono whitespace-nowrap">
                    D{d.day}: {d.supply}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex justify-between mt-2">
          <span className="text-[10px] text-white/55 font-mono">Day 1</span>
          <span className="text-[10px] text-white/55 font-mono">Day 90</span>
        </div>
      </GlassCard>

      {/* Top holders */}
      <GlassCard className="p-6 mb-8">
        <p className="text-white/50 text-xs font-mono uppercase tracking-widest mb-4">Top 5 Holders</p>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="text-left text-[10px] text-white/60 font-mono uppercase tracking-widest pb-3 pr-4">Rank</th>
                <th className="text-left text-[10px] text-white/60 font-mono uppercase tracking-widest pb-3 pr-4">Address</th>
                <th className="text-right text-[10px] text-white/60 font-mono uppercase tracking-widest pb-3 pr-4">Balance</th>
                <th className="text-right text-[10px] text-white/60 font-mono uppercase tracking-widest pb-3">Share</th>
              </tr>
            </thead>
            <tbody>
              {topHolders.map((holder, idx) => (
                <tr key={idx} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                  <td className="py-3 pr-4">
                    <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                      idx === 0 ? 'bg-amber-500/20 text-amber-400' : 'bg-white/[0.04] text-white/60'
                    }`}>{idx + 1}</span>
                  </td>
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-white/70 font-mono">{holder.address.slice(0, 8)}...{holder.address.slice(-6)}</span>
                      <CopyButton text={holder.address} />
                    </div>
                  </td>
                  <td className="py-3 pr-4 text-sm text-emerald-400 font-mono text-right">{holder.balance}</td>
                  <td className="py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-16 h-2 bg-white/[0.04] rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500/40 rounded-full" style={{ width: `${holder.percentage}%` }} />
                      </div>
                      <span className="text-xs text-white/50 font-mono w-10 text-right">{holder.percentage}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </GlassCard>

      {/* Vintage distribution */}
      <GlassCard className="p-6 mb-8">
        <p className="text-white/50 text-xs font-mono uppercase tracking-widest mb-4">Vintage Distribution (by Capture Year)</p>
        <div className="space-y-4">
          {vintages.map((v) => {
            const widthPct = (v.credits / vintageMax) * 100;
            return (
              <div key={v.year}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-white/60 font-mono">{v.year}</span>
                  <span className="text-sm text-white/40 font-mono">{v.credits} credits</span>
                </div>
                <div className="h-6 bg-white/[0.03] rounded-lg overflow-hidden">
                  <div className={`h-full ${v.color}/30 rounded-lg relative`} style={{ width: `${widthPct}%` }}>
                    <div className={`absolute inset-0 ${v.color} opacity-10 rounded-lg`} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </GlassCard>

      {/* Retirement funnel */}
      <GlassCard className="p-6">
        <p className="text-white/50 text-xs font-mono uppercase tracking-widest mb-4">Credit Lifecycle Funnel</p>
        <div className="space-y-3">
          {funnel.map((step, idx, arr) => {
            const baseCount = arr[0]?.count ?? 1;
            const pct = idx === 0 ? 100 : Math.round((step.count / baseCount) * 100);
            return (
              <div key={step.label} className="flex items-center gap-4">
                <span className="text-xs text-white/50 w-44 shrink-0">{step.label}</span>
                <div className="flex-1 h-5 bg-white/[0.03] rounded overflow-hidden">
                  <div className={`h-full ${step.color}/30 rounded`} style={{ width: `${pct}%` }} />
                </div>
                <span className="text-xs text-white/40 font-mono w-20 text-right">{step.count} ({pct}%)</span>
              </div>
            );
          })}
        </div>
      </GlassCard>
    </div>
  );
}

// ============================================
// Certificates Tab (NEW)
// ============================================

function CertificatesTab() {
  const { wallet } = useApp();
  const address = wallet.connected ? (wallet.address as Address) : undefined;
  const { certificates, isLoading, error } = useRetirementCertificates(address);

  if (!wallet.connected) {
    return <ConnectWalletPrompt message="Connect your wallet to view your retirement certificates." />;
  }

  return (
    <div>
      <p className="text-white/50 text-xs font-mono uppercase tracking-widest mb-2">Retirement Certificates</p>
      <p className="text-white/60 text-sm mb-6">
        Each retired carbon credit generates a permanent, verifiable certificate. These certificates are proof that carbon has been permanently removed from the atmosphere and the corresponding credits can never be re-used.
      </p>

      {error && (
        <GlassCard className="p-8 text-center border-red-500/20 mb-6">
          <p className="text-red-400 text-sm">Couldn&apos;t load certificates: {error.message.split('\n')[0]}</p>
        </GlassCard>
      )}
      {isLoading && certificates.length === 0 && (
        <GlassCard className="p-8 text-center mb-6">
          <p className="text-white/50 text-sm font-mono">Reading retirements from chain…</p>
        </GlassCard>
      )}
      {!isLoading && !error && certificates.length === 0 && (
        <GlassCard className="p-10 text-center">
          <p className="text-white/70 text-sm font-medium mb-1">No retirements yet</p>
          <p className="text-white/40 text-xs max-w-md mx-auto">
            Retire credits from your portfolio to mint a permanent, on-chain-verifiable retirement certificate.
          </p>
        </GlassCard>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {certificates.map((cert) => (
          <div
            key={cert.txHash}
            className="relative rounded-2xl overflow-hidden"
          >
            {/* Decorative border - double border effect */}
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-emerald-500/20 via-transparent to-cyan-500/20 p-px">
              <div className="absolute inset-[1px] rounded-2xl bg-[#060A13]" />
            </div>

            <div className="relative p-6">
              {/* Certificate header */}
              <div className="text-center mb-5">
                <div className="inline-flex items-center gap-2 mb-2">
                  <div className="h-px w-8 bg-gradient-to-r from-transparent to-emerald-500/40" />
                  <svg className="w-6 h-6 text-emerald-400/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" />
                  </svg>
                  <div className="h-px w-8 bg-gradient-to-l from-transparent to-emerald-500/40" />
                </div>
                <h3 className="text-white font-display font-bold text-sm uppercase tracking-widest">Carbon Retirement Certificate</h3>
                <p className="text-emerald-400/60 text-[10px] font-mono uppercase tracking-[0.2em] mt-0.5">TerraQura / Aethelred Network</p>
              </div>

              {/* Decorative line */}
              <div className="h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent mb-5" />

              {/* Main CO2 amount */}
              <div className="text-center mb-5">
                <p className="text-3xl font-bold text-emerald-400 font-mono">{cert.amountRetired.toLocaleString()}</p>
                <p className="text-white/40 text-xs font-mono uppercase tracking-widest mt-0.5">Verified Credits Permanently Retired</p>
              </div>

              {/* Certificate details grid */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="p-2.5 rounded-lg bg-white/[0.02]">
                  <p className="text-white/60 text-[9px] font-mono uppercase tracking-widest mb-0.5">Token ID</p>
                  <p className="text-white/70 font-mono text-sm" title={cert.tokenId.toString()}>#{shortTokenId(cert.tokenId)}</p>
                </div>
                <div className="p-2.5 rounded-lg bg-white/[0.02]">
                  <p className="text-white/60 text-[9px] font-mono uppercase tracking-widest mb-0.5">Retirement Date</p>
                  <p className="text-white/70 font-mono text-sm">{new Date(cert.retiredAt * 1000).toLocaleDateString()}</p>
                </div>
                <div className="p-2.5 rounded-lg bg-white/[0.02]">
                  <p className="text-white/60 text-[9px] font-mono uppercase tracking-widest mb-0.5">DAC Unit</p>
                  <p className="text-white/70 font-mono text-sm">{cert.dacUnit}</p>
                </div>
                <div className="p-2.5 rounded-lg bg-white/[0.02]">
                  <p className="text-white/60 text-[9px] font-mono uppercase tracking-widest mb-0.5">Vintage Year</p>
                  <p className="text-white/70 font-mono text-sm">{cert.vintageYear}</p>
                </div>
              </div>

              {/* Beneficiary and reason */}
              <div className="space-y-2 mb-4">
                <div className="p-2.5 rounded-lg bg-white/[0.02]">
                  <p className="text-white/60 text-[9px] font-mono uppercase tracking-widest mb-0.5">Beneficiary</p>
                  <p className="text-white/70 text-sm">{cert.beneficiary || '—'}</p>
                </div>
                <div className="p-2.5 rounded-lg bg-white/[0.02]">
                  <p className="text-white/60 text-[9px] font-mono uppercase tracking-widest mb-0.5">Retirement Reason</p>
                  <p className="text-white/50 text-xs leading-relaxed">{cert.reason}</p>
                </div>
              </div>

              {/* Verification chain hash */}
              <div className="p-2.5 rounded-lg bg-white/[0.02] mb-4">
                <p className="text-white/60 text-[9px] font-mono uppercase tracking-widest mb-0.5">Retirement Transaction</p>
                <p className="text-white/40 text-[10px] font-mono break-all">{cert.txHash}</p>
              </div>

              {/* Decorative line */}
              <div className="h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent mb-3" />

              {/* Verify link */}
              <div className="flex justify-center">
                <a
                  href={getExplorerTokenUrl(CONTRACTS.carbonCredit, cert.tokenId.toString())}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-mono hover:bg-emerald-500/20 transition-all"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  Verify On-Chain
                </a>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================
// Main Page
// ============================================

const TAB_LIST = [
  { id: 'overview', label: 'Overview' },
  { id: 'portfolio', label: 'Portfolio' },
  { id: 'verification', label: 'Verification' },
  { id: 'provenance', label: 'Provenance' },
  { id: 'analytics', label: 'Analytics' },
  { id: 'certificates', label: 'Certificates' },
];

export function CreditsDashboardContent() {
  const [activeTab, setActiveTab] = useState('overview');

  const { totalMinted } = useTotalCreditsMinted();
  const { totalRetired } = useTotalCreditsRetired();

  const netActive = useMemo(() => {
    if (totalMinted === undefined || totalRetired === undefined) return undefined;
    return totalMinted - totalRetired;
  }, [totalMinted, totalRetired]);

  return (
    <div className="min-h-screen bg-[#060A13] flex flex-col">
      <TopNav />
      <ToastContainer />
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-8">
        <SectionHeader
          title="Credits Management"
          description="View, verify, and manage Proof-of-Physics carbon credits on the Aethelred network."
        />
        <Tabs tabs={TAB_LIST} activeTab={activeTab} onChange={setActiveTab} />

        <div className="mt-6">
          {activeTab === 'overview' && (
            <OverviewTab totalMinted={totalMinted} totalRetired={totalRetired} netActive={netActive} />
          )}
          {activeTab === 'portfolio' && <PortfolioTab />}
          {activeTab === 'verification' && <VerificationTab />}
          {activeTab === 'provenance' && <ProvenanceTab />}
          {activeTab === 'analytics' && <AnalyticsTab />}
          {activeTab === 'certificates' && <CertificatesTab />}
        </div>
      </main>
      <DAppFooter />
    </div>
  );
}
