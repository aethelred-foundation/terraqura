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
// Deterministic seeded random utilities
// ============================================

function seededRandom(seed: number): number {
  let s = seed;
  s = ((s * 1103515245 + 12345) & 0x7fffffff);
  return (s % 10000) / 10000;
}

function seededInt(seed: number, min: number, max: number): number {
  return Math.floor(seededRandom(seed) * (max - min + 1)) + min;
}

function seededHex(seed: number, length: number): string {
  const chars = '0123456789abcdef';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars[seededInt(seed + i * 7, 0, 15)];
  }
  return result;
}

function seededAddress(seed: number): string {
  return '0x' + seededHex(seed, 40);
}

function seededTxHash(seed: number): string {
  return '0x' + seededHex(seed * 31, 64);
}

// ============================================
// Mock data (deterministic, seeded)
// ============================================

interface MockCredit {
  tokenId: number;
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

const MOCK_PORTFOLIO: MockCredit[] = [
  { tokenId: 1, dacUnitId: 'DAC-AUH-001', co2AmountKg: 1250, energyConsumedKwh: 420, purityPercentage: 97, captureTimestamp: 1770000000, isRetired: false, sourceVerified: true, logicVerified: true, mintVerified: true, balance: 15 },
  { tokenId: 2, dacUnitId: 'DAC-AUH-002', co2AmountKg: 980, energyConsumedKwh: 340, purityPercentage: 95, captureTimestamp: 1770086400, isRetired: false, sourceVerified: true, logicVerified: true, mintVerified: true, balance: 8 },
  { tokenId: 3, dacUnitId: 'DAC-DXB-001', co2AmountKg: 2100, energyConsumedKwh: 680, purityPercentage: 99, captureTimestamp: 1770172800, isRetired: true, sourceVerified: true, logicVerified: true, mintVerified: true, balance: 0 },
  { tokenId: 5, dacUnitId: 'DAC-AUH-003', co2AmountKg: 750, energyConsumedKwh: 260, purityPercentage: 93, captureTimestamp: 1770259200, isRetired: false, sourceVerified: true, logicVerified: true, mintVerified: false, balance: 22 },
  { tokenId: 8, dacUnitId: 'DAC-RYD-001', co2AmountKg: 1800, energyConsumedKwh: 590, purityPercentage: 96, captureTimestamp: 1770345600, isRetired: false, sourceVerified: true, logicVerified: true, mintVerified: true, balance: 5 },
  { tokenId: 13, dacUnitId: 'DAC-DXB-002', co2AmountKg: 3200, energyConsumedKwh: 1050, purityPercentage: 98, captureTimestamp: 1770432000, isRetired: false, sourceVerified: true, logicVerified: true, mintVerified: true, balance: 40 },
];

// Weekly minted data (12 weeks)
const WEEKLY_MINTED = Array.from({ length: 12 }, (_, i) => ({
  week: `W${i + 1}`,
  label: `Week ${i + 1}`,
  credits: seededInt(100 + i, 80, 340),
}));

const WEEKLY_MAX = Math.max(...WEEKLY_MINTED.map(w => w.credits));

// Purity bracket distribution
const PURITY_BRACKETS = [
  { label: '90-93%', count: seededInt(200, 12, 35), color: 'bg-blue-400' },
  { label: '93-96%', count: seededInt(201, 25, 55), color: 'bg-cyan-400' },
  { label: '96-99%', count: seededInt(202, 30, 65), color: 'bg-emerald-400' },
  { label: '99%+', count: seededInt(203, 8, 22), color: 'bg-purple-400' },
];
const PURITY_MAX = Math.max(...PURITY_BRACKETS.map(b => b.count));

// DAC unit leaderboard
const DAC_LEADERBOARD = [
  { unit: 'DAC-DXB-002', co2Total: 32400, credits: 40, efficiency: 328 },
  { unit: 'DAC-DXB-001', co2Total: 28100, credits: 34, efficiency: 324 },
  { unit: 'DAC-AUH-001', co2Total: 22500, credits: 27, efficiency: 336 },
  { unit: 'DAC-RYD-001', co2Total: 18900, credits: 21, efficiency: 328 },
  { unit: 'DAC-AUH-002', co2Total: 15200, credits: 18, efficiency: 347 },
  { unit: 'DAC-AUH-003', co2Total: 9800, credits: 12, efficiency: 347 },
];

// Provenance event types
type ProvenanceEventType = 'CAPTURE_STARTED' | 'SOURCE_VERIFIED' | 'LOGIC_VERIFIED' | 'MINT_VERIFIED' | 'MINTED' | 'TRANSFERRED' | 'RETIRED';

interface ProvenanceEvent {
  event: ProvenanceEventType;
  timestamp: number;
  txHash: string;
  actor: string;
  detail: string;
}

function generateProvenance(tokenId: number): ProvenanceEvent[] {
  const base = 1769900000 + tokenId * 86400;
  const seed = tokenId * 1000;
  const events: ProvenanceEvent[] = [
    {
      event: 'CAPTURE_STARTED',
      timestamp: base,
      txHash: seededTxHash(seed + 1),
      actor: seededAddress(seed + 2),
      detail: `DAC unit ${MOCK_PORTFOLIO.find(c => c.tokenId === tokenId)?.dacUnitId || 'DAC-AUH-001'} initiated CO2 capture cycle`,
    },
    {
      event: 'SOURCE_VERIFIED',
      timestamp: base + seededInt(seed + 3, 3600, 7200),
      txHash: seededTxHash(seed + 4),
      actor: seededAddress(seed + 5),
      detail: `IoT sensor data validated. Device identity confirmed, data freshness: ${seededInt(seed + 6, 12, 58)}s`,
    },
    {
      event: 'LOGIC_VERIFIED',
      timestamp: base + seededInt(seed + 7, 10800, 18000),
      txHash: seededTxHash(seed + 8),
      actor: seededAddress(seed + 9),
      detail: `Thermodynamic consistency check passed. Efficiency factor: ${(seededInt(seed + 10, 280, 420) / 100).toFixed(2)}`,
    },
    {
      event: 'MINT_VERIFIED',
      timestamp: base + seededInt(seed + 11, 21600, 28800),
      txHash: seededTxHash(seed + 12),
      actor: seededAddress(seed + 13),
      detail: 'Governance multisig approval confirmed (3/5 signers)',
    },
    {
      event: 'MINTED',
      timestamp: base + seededInt(seed + 14, 32400, 43200),
      txHash: seededTxHash(seed + 15),
      actor: CONTRACTS.carbonCredit,
      detail: `ERC-1155 token minted. Amount: ${seededInt(seed + 16, 5, 50)} credits`,
    },
  ];

  // Some tokens have transfers
  if (tokenId % 3 === 0 || tokenId === 8) {
    events.push({
      event: 'TRANSFERRED',
      timestamp: base + seededInt(seed + 17, 50000, 72000),
      txHash: seededTxHash(seed + 18),
      actor: seededAddress(seed + 19),
      detail: `Transferred ${seededInt(seed + 20, 2, 15)} credits to ${seededAddress(seed + 21).slice(0, 10)}...`,
    });
  }

  // Token 3 is retired
  if (tokenId === 3) {
    events.push({
      event: 'RETIRED',
      timestamp: base + seededInt(seed + 22, 86400, 172800),
      txHash: seededTxHash(seed + 23),
      actor: seededAddress(seed + 24),
      detail: 'Credits permanently retired. Beneficiary: Aethelred Climate Fund',
    });
  }

  return events;
}

// Pre-generate provenance for tokens 1-13
const PROVENANCE_DATA: Record<number, ProvenanceEvent[]> = {};
[1, 2, 3, 5, 8, 13].forEach(id => {
  PROVENANCE_DATA[id] = generateProvenance(id);
});
// Fill in 4, 6, 7, 9, 10, 11, 12
[4, 6, 7, 9, 10, 11, 12].forEach(id => {
  PROVENANCE_DATA[id] = generateProvenance(id);
});

// Analytics data: total supply over 90 days
const SUPPLY_OVER_TIME = Array.from({ length: 90 }, (_, i) => {
  const base = 120;
  const growth = Math.floor(seededRandom(300 + i) * 8);
  return {
    day: i + 1,
    supply: base + i * 3 + growth,
  };
});
const SUPPLY_MAX = Math.max(...SUPPLY_OVER_TIME.map(s => s.supply));

// Top 5 holders
const TOP_HOLDERS = [
  { address: seededAddress(500), balance: seededInt(501, 120, 280), percentage: 0 },
  { address: seededAddress(502), balance: seededInt(503, 80, 160), percentage: 0 },
  { address: seededAddress(504), balance: seededInt(505, 50, 110), percentage: 0 },
  { address: seededAddress(506), balance: seededInt(507, 30, 70), percentage: 0 },
  { address: seededAddress(508), balance: seededInt(509, 15, 45), percentage: 0 },
];
const TOTAL_HOLDER_BALANCE = TOP_HOLDERS.reduce((a, b) => a + b.balance, 0);
TOP_HOLDERS.forEach(h => { h.percentage = Math.round((h.balance / TOTAL_HOLDER_BALANCE) * 100); });

// Vintage distribution
const VINTAGES = [
  { year: 2024, credits: seededInt(600, 40, 90), color: 'bg-blue-500' },
  { year: 2025, credits: seededInt(601, 120, 240), color: 'bg-emerald-500' },
  { year: 2026, credits: seededInt(602, 60, 150), color: 'bg-cyan-500' },
];
const VINTAGE_MAX = Math.max(...VINTAGES.map(v => v.credits));

// Mock certificates
interface MockCertificate {
  tokenId: number;
  co2AmountKg: number;
  retirementDate: string;
  beneficiary: string;
  reason: string;
  dacUnit: string;
  vintageYear: number;
  verificationHash: string;
}

const MOCK_CERTIFICATES: MockCertificate[] = [
  {
    tokenId: 3,
    co2AmountKg: 2100,
    retirementDate: '2026-02-14',
    beneficiary: 'Aethelred Climate Fund',
    reason: 'Corporate carbon neutrality pledge Q1 2026',
    dacUnit: 'DAC-DXB-001',
    vintageYear: 2025,
    verificationHash: seededHex(700, 64),
  },
  {
    tokenId: 14,
    co2AmountKg: 1450,
    retirementDate: '2026-01-28',
    beneficiary: 'Gulf Sustainability Alliance',
    reason: 'Voluntary offset for aviation emissions',
    dacUnit: 'DAC-AUH-001',
    vintageYear: 2025,
    verificationHash: seededHex(701, 64),
  },
  {
    tokenId: 19,
    co2AmountKg: 3800,
    retirementDate: '2026-03-02',
    beneficiary: 'Abu Dhabi Green Initiative',
    reason: 'Municipal building carbon offset program',
    dacUnit: 'DAC-AUH-002',
    vintageYear: 2026,
    verificationHash: seededHex(702, 64),
  },
  {
    tokenId: 22,
    co2AmountKg: 920,
    retirementDate: '2025-12-19',
    beneficiary: 'Personal - Ahmed Al-Rashidi',
    reason: 'Personal carbon footprint offset 2025',
    dacUnit: 'DAC-RYD-001',
    vintageYear: 2025,
    verificationHash: seededHex(703, 64),
  },
  {
    tokenId: 27,
    co2AmountKg: 5200,
    retirementDate: '2026-03-10',
    beneficiary: 'Dubai Future Foundation',
    reason: 'Event carbon neutrality - Future Summit 2026',
    dacUnit: 'DAC-DXB-002',
    vintageYear: 2026,
    verificationHash: seededHex(704, 64),
  },
  {
    tokenId: 31,
    co2AmountKg: 1670,
    retirementDate: '2026-02-22',
    beneficiary: 'Riyadh Tech Campus',
    reason: 'Data center emissions offset - Q4 2025',
    dacUnit: 'DAC-RYD-001',
    vintageYear: 2025,
    verificationHash: seededHex(705, 64),
  },
];

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
          <svg className="h-3 w-3 text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
      )}
      <span className={`text-sm ${passed ? 'text-white/70' : 'text-white/30'}`}>{label}</span>
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
          <svg className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                    <p className="text-white/30 text-xs font-mono mt-3">
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
          <p className="text-white/30 text-sm">Enter a Token ID above to look up credit metadata and verification status.</p>
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
          value="4.2"
          unit="hours"
        />
      </div>

      {/* Credits Minted per Week */}
      <GlassCard className="p-6 mb-8">
        <p className="text-white/50 text-xs font-mono uppercase tracking-widest mb-4">Credits Minted Per Week (12 Weeks)</p>
        <div className="flex items-end gap-2 h-48">
          {WEEKLY_MINTED.map((w) => {
            const heightPct = WEEKLY_MAX > 0 ? (w.credits / WEEKLY_MAX) * 100 : 0;
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
                <span className="text-[10px] text-white/30 font-mono">{w.week}</span>
              </div>
            );
          })}
        </div>
      </GlassCard>

      {/* Purity distribution */}
      <GlassCard className="p-6 mb-8">
        <p className="text-white/50 text-xs font-mono uppercase tracking-widest mb-4">Distribution by Purity Bracket</p>
        <div className="space-y-3">
          {PURITY_BRACKETS.map((b) => {
            const widthPct = PURITY_MAX > 0 ? (b.count / PURITY_MAX) * 100 : 0;
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
                <th className="text-left text-[10px] text-white/30 font-mono uppercase tracking-widest pb-3 pr-4">Rank</th>
                <th className="text-left text-[10px] text-white/30 font-mono uppercase tracking-widest pb-3 pr-4">Unit ID</th>
                <th className="text-right text-[10px] text-white/30 font-mono uppercase tracking-widest pb-3 pr-4">Total CO2 (kg)</th>
                <th className="text-right text-[10px] text-white/30 font-mono uppercase tracking-widest pb-3 pr-4">Credits</th>
                <th className="text-right text-[10px] text-white/30 font-mono uppercase tracking-widest pb-3">Efficiency (kWh/t)</th>
              </tr>
            </thead>
            <tbody>
              {DAC_LEADERBOARD.map((row, idx) => (
                <tr key={row.unit} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                  <td className="py-3 pr-4">
                    <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                      idx === 0 ? 'bg-amber-500/20 text-amber-400' :
                      idx === 1 ? 'bg-slate-400/20 text-slate-300' :
                      idx === 2 ? 'bg-orange-600/20 text-orange-400' :
                      'bg-white/[0.04] text-white/30'
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

function PortfolioTab() {
  const { wallet } = useApp();
  const [lookupId, setLookupId] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [retireFormOpen, setRetireFormOpen] = useState<number | null>(null);
  const [retireQuantity, setRetireQuantity] = useState('1');
  const [retireReason, setRetireReason] = useState('');
  const [retireBeneficiary, setRetireBeneficiary] = useState('');
  const [transferModalOpen, setTransferModalOpen] = useState<number | null>(null);
  const [transferAddress, setTransferAddress] = useState('');
  const [transferQuantity, setTransferQuantity] = useState('1');

  const tokenIdBigInt = useMemo(() => {
    const n = parseInt(lookupId, 10);
    return isNaN(n) || n < 0 ? undefined : BigInt(n);
  }, [lookupId]);

  const { balance, isLoading: balanceLoading } = useCreditBalance(
    wallet.connected ? (wallet.address as Address) : undefined,
    tokenIdBigInt ?? 0n
  );

  const toggleSelect = useCallback((id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    const active = MOCK_PORTFOLIO.filter(c => !c.isRetired);
    if (selectedIds.size === active.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(active.map(c => c.tokenId)));
    }
  }, [selectedIds.size]);

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
            type="number"
            min="0"
            placeholder="Token ID..."
            value={lookupId}
            onChange={(e) => setLookupId(e.target.value)}
            className="px-4 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white placeholder-white/30 text-sm font-mono focus:outline-none focus:border-emerald-500/40 transition-all w-40"
          />
          {tokenIdBigInt !== undefined && (
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
              setRetireFormOpen(-1);
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
              setTransferModalOpen(-1);
              setTransferAddress('');
              setTransferQuantity('1');
            }}
            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 hover:bg-cyan-500/20 transition-all"
          >
            Transfer Selected
          </button>
          <button className="px-3 py-1.5 text-xs font-medium rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20 hover:bg-purple-500/20 transition-all">
            List on Marketplace
          </button>
          <button onClick={() => setSelectedIds(new Set())} className="px-2 py-1.5 text-xs text-white/40 hover:text-white/60 transition">
            Clear
          </button>
        </div>
      )}

      {/* Bulk retire form */}
      {retireFormOpen === -1 && (
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
            <button className="px-4 py-2 text-sm font-medium rounded-lg bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 transition-all">
              Confirm Retirement
            </button>
            <button onClick={() => setRetireFormOpen(null)} className="px-4 py-2 text-sm text-white/40 hover:text-white/60 transition">Cancel</button>
          </div>
        </GlassCard>
      )}

      {/* Bulk transfer modal */}
      {transferModalOpen === -1 && (
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
            <button className="px-4 py-2 text-sm font-medium rounded-lg bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/30 transition-all">
              Confirm Transfer
            </button>
            <button onClick={() => setTransferModalOpen(null)} className="px-4 py-2 text-sm text-white/40 hover:text-white/60 transition">Cancel</button>
          </div>
        </GlassCard>
      )}

      {/* Portfolio header with select all */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-white/50 text-xs font-mono uppercase tracking-widest">Portfolio Overview</p>
        <button onClick={selectAll} className="text-xs text-white/40 hover:text-white/60 transition">
          {selectedIds.size === MOCK_PORTFOLIO.filter(c => !c.isRetired).length ? 'Deselect All' : 'Select All Active'}
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {MOCK_PORTFOLIO.map((credit) => (
          <GlassCard key={credit.tokenId} className={`p-5 transition-all ${selectedIds.has(credit.tokenId) ? 'border-emerald-500/30 bg-emerald-500/[0.02]' : 'hover:border-white/[0.12]'}`}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                {!credit.isRetired && (
                  <button
                    onClick={() => toggleSelect(credit.tokenId)}
                    className={`w-4 h-4 rounded border transition-all flex items-center justify-center ${
                      selectedIds.has(credit.tokenId)
                        ? 'bg-emerald-500/30 border-emerald-500/50'
                        : 'border-white/20 hover:border-white/40'
                    }`}
                  >
                    {selectedIds.has(credit.tokenId) && (
                      <svg className="w-3 h-3 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                )}
                <span className="text-white font-mono font-bold">#{credit.tokenId}</span>
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
              <span className={`px-2 py-0.5 rounded text-[10px] font-mono ${credit.sourceVerified ? 'bg-emerald-500/10 text-emerald-400' : 'bg-white/[0.04] text-white/30'}`}>SRC</span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-mono ${credit.logicVerified ? 'bg-emerald-500/10 text-emerald-400' : 'bg-white/[0.04] text-white/30'}`}>LOG</span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-mono ${credit.mintVerified ? 'bg-emerald-500/10 text-emerald-400' : 'bg-white/[0.04] text-white/30'}`}>MNT</span>
            </div>

            {/* Action buttons */}
            {!credit.isRetired && (
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setRetireFormOpen(retireFormOpen === credit.tokenId ? null : credit.tokenId);
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
                    setTransferModalOpen(transferModalOpen === credit.tokenId ? null : credit.tokenId);
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
            {retireFormOpen === credit.tokenId && (
              <div className="mt-3 pt-3 border-t border-white/[0.06] space-y-2">
                <p className="text-[10px] text-white/50 font-mono uppercase tracking-widest">Retire Credits</p>
                <input type="number" min="1" max={credit.balance} value={retireQuantity} onChange={e => setRetireQuantity(e.target.value)}
                  placeholder="Quantity" className="w-full px-2.5 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white text-xs font-mono focus:outline-none focus:border-emerald-500/40 transition-all" />
                <input type="text" value={retireBeneficiary} onChange={e => setRetireBeneficiary(e.target.value)}
                  placeholder="Beneficiary..." className="w-full px-2.5 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white placeholder-white/20 text-xs focus:outline-none focus:border-emerald-500/40 transition-all" />
                <input type="text" value={retireReason} onChange={e => setRetireReason(e.target.value)}
                  placeholder="Reason..." className="w-full px-2.5 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white placeholder-white/20 text-xs focus:outline-none focus:border-emerald-500/40 transition-all" />
                <div className="flex gap-2">
                  <button className="flex-1 px-2 py-1.5 text-[10px] font-medium rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-all">Confirm</button>
                  <button onClick={() => setRetireFormOpen(null)} className="px-2 py-1.5 text-[10px] text-white/40 hover:text-white/60 transition">Cancel</button>
                </div>
              </div>
            )}

            {/* Inline transfer modal */}
            {transferModalOpen === credit.tokenId && (
              <div className="mt-3 pt-3 border-t border-white/[0.06] space-y-2">
                <p className="text-[10px] text-white/50 font-mono uppercase tracking-widest">Transfer Credits</p>
                <input type="text" value={transferAddress} onChange={e => setTransferAddress(e.target.value)}
                  placeholder="Recipient 0x..." className="w-full px-2.5 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white placeholder-white/20 text-xs font-mono focus:outline-none focus:border-emerald-500/40 transition-all" />
                <input type="number" min="1" max={credit.balance} value={transferQuantity} onChange={e => setTransferQuantity(e.target.value)}
                  placeholder="Quantity" className="w-full px-2.5 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white text-xs font-mono focus:outline-none focus:border-emerald-500/40 transition-all" />
                <div className="flex gap-2">
                  <button className="flex-1 px-2 py-1.5 text-[10px] font-medium rounded-lg bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 transition-all">Confirm</button>
                  <button onClick={() => setTransferModalOpen(null)} className="px-2 py-1.5 text-[10px] text-white/40 hover:text-white/60 transition">Cancel</button>
                </div>
              </div>
            )}
          </GlassCard>
        ))}
      </div>
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

  const phaseColors: Record<string, { bg: string; border: string; text: string; line: string }> = {
    emerald: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', text: 'text-emerald-400', line: 'bg-emerald-500/30' },
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
          <p className="text-white/30 text-sm">Threshold data not yet available from the verification engine.</p>
        )}
      </GlassCard>

      {/* Verification Simulator */}
      <GlassCard className="p-6 mb-8">
        <p className="text-white/50 text-xs font-mono uppercase tracking-widest mb-4">Verification Simulator</p>
        <p className="text-white/30 text-sm mb-4">Test how the Proof-of-Physics logic check evaluates a capture claim. Enter CO2 captured and energy consumed to see if it passes.</p>
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
                <div className="absolute bottom-0.5 left-1 text-[9px] text-white/20 font-mono">100</div>
                <div className="absolute bottom-0.5 right-1 text-[9px] text-white/20 font-mono">700</div>
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
          <div className="text-center py-6 text-white/20 text-sm">
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
              <p className="text-white/30 text-xs leading-relaxed">{scenario.description}</p>
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
          const c = phaseColors[phase.color]!;
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
  const [tokenInput, setTokenInput] = useState('');

  const events = useMemo(() => {
    const id = parseInt(tokenInput, 10);
    if (isNaN(id) || id < 1 || id > 13) return null;
    return PROVENANCE_DATA[id] || null;
  }, [tokenInput]);

  const tokenCredit = useMemo(() => {
    const id = parseInt(tokenInput, 10);
    return MOCK_PORTFOLIO.find(c => c.tokenId === id) || null;
  }, [tokenInput]);

  return (
    <div>
      <GlassCard className="p-6 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-end gap-4">
          <div className="flex-1">
            <p className="text-white/50 text-xs font-mono uppercase tracking-widest mb-2">Token Provenance Tracker</p>
            <p className="text-white/30 text-sm mb-3">
              Trace the complete lifecycle of any carbon credit from DAC capture to on-chain minting and beyond. This is TerraQura&apos;s core transparency layer.
            </p>
            <div className="relative max-w-xs">
              <input
                type="number"
                min="1"
                max="13"
                placeholder="Enter Token ID (1-13)..."
                value={tokenInput}
                onChange={e => setTokenInput(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white placeholder-white/30 text-sm font-mono focus:outline-none focus:border-emerald-500/40 focus:bg-white/[0.06] transition-all"
              />
            </div>
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
                        <span className="text-white/30 text-xs font-mono">
                          {new Date(evt.timestamp * 1000).toLocaleString()}
                        </span>
                      </div>
                    </div>

                    <p className="text-white/50 text-sm mb-3">{evt.detail}</p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-white/30 text-[10px] font-mono uppercase shrink-0">TX</span>
                        <span className="text-white/50 text-xs font-mono truncate">{evt.txHash.slice(0, 18)}...{evt.txHash.slice(-8)}</span>
                        <CopyButton text={evt.txHash} />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-white/30 text-[10px] font-mono uppercase shrink-0">Actor</span>
                        <span className="text-white/50 text-xs font-mono truncate">{evt.actor.slice(0, 10)}...{evt.actor.slice(-6)}</span>
                        <CopyButton text={evt.actor} />
                      </div>
                    </div>
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
            <p className="text-white/20 text-xs font-mono pt-1">End of provenance chain</p>
          </div>
        </div>
      ) : tokenInput !== '' ? (
        <GlassCard className="p-8 text-center">
          <p className="text-white/30 text-sm">No provenance data found for Token ID {tokenInput}. Try a value between 1 and 13.</p>
        </GlassCard>
      ) : (
        <GlassCard className="p-12 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
            <svg className="w-8 h-8 text-emerald-400/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-white/40 text-sm mb-1">Enter a Token ID to view its full provenance chain</p>
          <p className="text-white/20 text-xs">Every carbon credit on TerraQura has a complete, immutable lifecycle record on-chain.</p>
        </GlassCard>
      )}
    </div>
  );
}

// ============================================
// Analytics Tab (NEW)
// ============================================

function AnalyticsTab() {
  const totalMintedNum = SUPPLY_OVER_TIME[SUPPLY_OVER_TIME.length - 1]!.supply;
  const totalRetiredNum = seededInt(400, 45, 85);
  const retirementRate = ((totalRetiredNum / totalMintedNum) * 100).toFixed(1);
  const avgTransfersPerCredit = (seededInt(401, 12, 28) / 10).toFixed(1);

  return (
    <div>
      {/* Key metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-8">
        <MetricCard label="Total Supply" value={totalMintedNum.toLocaleString()} unit="credits" />
        <MetricCard label="Retirement Rate" value={retirementRate} unit="%" />
        <MetricCard label="Credit Velocity" value={avgTransfersPerCredit} unit="transfers/credit" />
        <MetricCard label="Active Holders" value={seededInt(402, 38, 92).toString()} unit="wallets" />
      </div>

      {/* Supply over time (90 days) */}
      <GlassCard className="p-6 mb-8">
        <p className="text-white/50 text-xs font-mono uppercase tracking-widest mb-4">Total Supply Over 90 Days</p>
        <div className="flex items-end gap-px h-40">
          {SUPPLY_OVER_TIME.map((d) => {
            const heightPct = SUPPLY_MAX > 0 ? (d.supply / SUPPLY_MAX) * 100 : 0;
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
          <span className="text-[10px] text-white/20 font-mono">Day 1</span>
          <span className="text-[10px] text-white/20 font-mono">Day 90</span>
        </div>
      </GlassCard>

      {/* Top holders */}
      <GlassCard className="p-6 mb-8">
        <p className="text-white/50 text-xs font-mono uppercase tracking-widest mb-4">Top 5 Holders</p>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="text-left text-[10px] text-white/30 font-mono uppercase tracking-widest pb-3 pr-4">Rank</th>
                <th className="text-left text-[10px] text-white/30 font-mono uppercase tracking-widest pb-3 pr-4">Address</th>
                <th className="text-right text-[10px] text-white/30 font-mono uppercase tracking-widest pb-3 pr-4">Balance</th>
                <th className="text-right text-[10px] text-white/30 font-mono uppercase tracking-widest pb-3">Share</th>
              </tr>
            </thead>
            <tbody>
              {TOP_HOLDERS.map((holder, idx) => (
                <tr key={idx} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                  <td className="py-3 pr-4">
                    <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                      idx === 0 ? 'bg-amber-500/20 text-amber-400' : 'bg-white/[0.04] text-white/30'
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
          {VINTAGES.map((v) => {
            const widthPct = VINTAGE_MAX > 0 ? (v.credits / VINTAGE_MAX) * 100 : 0;
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
          {[
            { label: 'Minted', count: totalMintedNum, color: 'bg-emerald-500', percentage: 100 },
            { label: 'Transferred (at least once)', count: seededInt(403, 120, 250), color: 'bg-cyan-500', percentage: 0 },
            { label: 'Listed on Marketplace', count: seededInt(404, 60, 130), color: 'bg-purple-500', percentage: 0 },
            { label: 'Retired', count: totalRetiredNum, color: 'bg-slate-500', percentage: 0 },
          ].map((step, idx, arr) => {
            const pct = idx === 0 ? 100 : Math.round((step.count / arr[0]!.count) * 100);
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

  if (!wallet.connected) {
    return <ConnectWalletPrompt message="Connect your wallet to view your retirement certificates." />;
  }

  return (
    <div>
      <p className="text-white/50 text-xs font-mono uppercase tracking-widest mb-2">Retirement Certificates</p>
      <p className="text-white/30 text-sm mb-6">
        Each retired carbon credit generates a permanent, verifiable certificate. These certificates are proof that carbon has been permanently removed from the atmosphere and the corresponding credits can never be re-used.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {MOCK_CERTIFICATES.map((cert) => (
          <div
            key={cert.tokenId}
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
                <p className="text-3xl font-bold text-emerald-400 font-mono">{cert.co2AmountKg.toLocaleString()}</p>
                <p className="text-white/40 text-xs font-mono uppercase tracking-widest mt-0.5">Kilograms of CO2 Permanently Retired</p>
              </div>

              {/* Certificate details grid */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="p-2.5 rounded-lg bg-white/[0.02]">
                  <p className="text-white/30 text-[9px] font-mono uppercase tracking-widest mb-0.5">Token ID</p>
                  <p className="text-white/70 font-mono text-sm">#{cert.tokenId}</p>
                </div>
                <div className="p-2.5 rounded-lg bg-white/[0.02]">
                  <p className="text-white/30 text-[9px] font-mono uppercase tracking-widest mb-0.5">Retirement Date</p>
                  <p className="text-white/70 font-mono text-sm">{cert.retirementDate}</p>
                </div>
                <div className="p-2.5 rounded-lg bg-white/[0.02]">
                  <p className="text-white/30 text-[9px] font-mono uppercase tracking-widest mb-0.5">DAC Unit</p>
                  <p className="text-white/70 font-mono text-sm">{cert.dacUnit}</p>
                </div>
                <div className="p-2.5 rounded-lg bg-white/[0.02]">
                  <p className="text-white/30 text-[9px] font-mono uppercase tracking-widest mb-0.5">Vintage Year</p>
                  <p className="text-white/70 font-mono text-sm">{cert.vintageYear}</p>
                </div>
              </div>

              {/* Beneficiary and reason */}
              <div className="space-y-2 mb-4">
                <div className="p-2.5 rounded-lg bg-white/[0.02]">
                  <p className="text-white/30 text-[9px] font-mono uppercase tracking-widest mb-0.5">Beneficiary</p>
                  <p className="text-white/70 text-sm">{cert.beneficiary}</p>
                </div>
                <div className="p-2.5 rounded-lg bg-white/[0.02]">
                  <p className="text-white/30 text-[9px] font-mono uppercase tracking-widest mb-0.5">Retirement Reason</p>
                  <p className="text-white/50 text-xs leading-relaxed">{cert.reason}</p>
                </div>
              </div>

              {/* Verification chain hash */}
              <div className="p-2.5 rounded-lg bg-white/[0.02] mb-4">
                <p className="text-white/30 text-[9px] font-mono uppercase tracking-widest mb-0.5">Verification Chain Hash</p>
                <p className="text-white/40 text-[10px] font-mono break-all">{cert.verificationHash}</p>
              </div>

              {/* Decorative line */}
              <div className="h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent mb-3" />

              {/* Verify link */}
              <div className="flex justify-center">
                <a
                  href={getExplorerTokenUrl(CONTRACTS.carbonCredit, String(cert.tokenId))}
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
