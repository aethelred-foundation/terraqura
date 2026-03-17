/**
 * TerraQura Protocol Analytics Dashboard
 *
 * Comprehensive analytics with 5 tabs: Protocol KPIs, Carbon Intelligence,
 * Environmental Impact, Verification Metrics, and Network Health.
 * All mock data uses seeded random for SSR-safe rendering.
 *
 * @version 1.0.0
 */

"use client";

import { useState, useMemo } from "react";
import {
  BarChart3, Activity, Leaf, ShieldCheck, Server,
  TrendingUp, Users, Zap, TreePine, Plane,
  Car, Home, Award, Globe, Clock, CheckCircle,
  XCircle, AlertTriangle, Cpu, Gauge, Target,
} from "lucide-react";

import {
  TopNav,
  DAppFooter,
  GlassCard,
  MetricCard,
  SectionHeader,
  Tabs,
  StatusBadge,
} from "@/components/dapp/SharedComponents";
import { usePlatformStats } from "@/hooks/useContractData";

// ─── Seeded Random for SSR-safe mock data ──────────────────
function seededRandom(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function seededInt(seed: number, min: number, max: number): number {
  return Math.floor(seededRandom(seed) * (max - min + 1)) + min;
}

function seededFloat(seed: number, min: number, max: number, decimals: number = 1): number {
  const val = seededRandom(seed) * (max - min) + min;
  const factor = Math.pow(10, decimals);
  return Math.round(val * factor) / factor;
}

function seededHex(seed: number, length: number): string {
  const chars = "0123456789abcdef";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars[Math.floor(seededRandom(seed + i * 7 + 3) * chars.length)];
  }
  return result;
}

function formatNumber(n: number): string {
  return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function formatDecimal(n: number, digits: number = 1): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

// ─── TAB DEFINITIONS ───────────────────────────────────────
const ANALYTICS_TABS = [
  { id: "kpis", label: "Protocol KPIs", icon: BarChart3 },
  { id: "carbon", label: "Carbon Intelligence", icon: Leaf },
  { id: "impact", label: "Environmental Impact", icon: Globe },
  { id: "verification", label: "Verification Metrics", icon: ShieldCheck },
  { id: "network", label: "Network Health", icon: Server },
];

// ═══════════════════════════════════════════════════════════
// TAB 1: PROTOCOL KPIs
// ═══════════════════════════════════════════════════════════

function ProtocolKPIsTab() {
  const { stats: _stats } = usePlatformStats();

  // Seeded KPI values
  const tvl = 12847.3;
  const dailyActive = 47;
  const weeklyActive = 189;
  const monthlyActive = 634;
  const totalTx = 8247;
  const avgTxPerBlock = seededFloat(901, 1.2, 3.8, 1);
  const protocolRevenue = seededFloat(902, 284.5, 284.5, 1);
  const uniqueHolders = seededInt(903, 312, 312);

  // 30-day activity chart data
  const dailyTxData = useMemo(() => {
    return Array.from({ length: 30 }, (_, i) => ({
      day: i + 1,
      count: seededInt(1000 + i * 31, 120, 420),
    }));
  }, []);

  const maxDailyTx = useMemo(() => Math.max(...dailyTxData.map(d => d.count)), [dailyTxData]);

  // 12-week new addresses data
  const weeklyNewAddresses = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => ({
      week: i + 1,
      count: seededInt(2000 + i * 47, 18, 72),
    }));
  }, []);

  const maxWeeklyAddr = useMemo(() => Math.max(...weeklyNewAddresses.map(w => w.count)), [weeklyNewAddresses]);

  return (
    <div className="space-y-8">
      {/* KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Total Value Locked"
          value={formatDecimal(tvl)}
          unit="AETH"
          icon={TrendingUp}
          trend={{ value: 12.4, label: "vs last month" }}
        />
        <MetricCard
          label="Daily Active Addresses"
          value={formatNumber(dailyActive)}
          icon={Users}
          trend={{ value: 8.2, label: "vs yesterday" }}
        />
        <MetricCard
          label="Weekly Active Addresses"
          value={formatNumber(weeklyActive)}
          icon={Users}
          trend={{ value: 5.7, label: "vs last week" }}
        />
        <MetricCard
          label="Monthly Active Addresses"
          value={formatNumber(monthlyActive)}
          icon={Users}
          trend={{ value: 14.1, label: "vs last month" }}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Total Transactions"
          value={formatNumber(totalTx)}
          icon={Activity}
          trend={{ value: 22.3, label: "all time" }}
        />
        <MetricCard
          label="Avg Tx per Block"
          value={formatDecimal(avgTxPerBlock)}
          icon={Zap}
        />
        <MetricCard
          label="Protocol Revenue"
          value={formatDecimal(protocolRevenue)}
          unit="AETH"
          icon={BarChart3}
          trend={{ value: 6.8, label: "vs last month" }}
        />
        <MetricCard
          label="Unique Token Holders"
          value={formatNumber(uniqueHolders)}
          icon={Users}
          trend={{ value: 18.9, label: "vs last month" }}
        />
      </div>

      {/* 30-Day Activity Chart */}
      <GlassCard className="p-6">
        <SectionHeader
          title="30-Day Transaction Activity"
          description="Daily transaction counts across all protocol contracts"
          badge={<StatusBadge status="Active" />}
        />
        <div className="flex items-end gap-[3px] h-48 mt-4">
          {dailyTxData.map((d, i) => {
            const height = (d.count / maxDailyTx) * 100;
            return (
              <div key={i} className="flex-1 group relative flex flex-col items-center justify-end h-full">
                <div
                  className="w-full bg-emerald-500/40 hover:bg-emerald-500/70 rounded-t transition-all cursor-pointer min-h-[2px]"
                  style={{ height: `${height}%` }}
                />
                <div className="absolute -top-8 left-1/2 -translate-x-1/2 hidden group-hover:block bg-midnight-900 border border-white/10 rounded-lg px-2 py-1 text-[10px] text-white whitespace-nowrap z-10">
                  Day {d.day}: {d.count} txs
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex justify-between mt-2 text-[10px] text-white/30">
          <span>Day 1</span>
          <span>Day 15</span>
          <span>Day 30</span>
        </div>
      </GlassCard>

      {/* Network Growth - New Addresses per Week */}
      <GlassCard className="p-6">
        <SectionHeader
          title="Network Growth"
          description="New unique addresses per week (12 weeks)"
        />
        <div className="space-y-3 mt-4">
          {weeklyNewAddresses.map((w, i) => {
            const width = (w.count / maxWeeklyAddr) * 100;
            return (
              <div key={i} className="flex items-center gap-3">
                <span className="text-xs text-white/40 w-14 shrink-0 font-mono">W{String(w.week).padStart(2, "0")}</span>
                <div className="flex-1 h-5 bg-white/[0.03] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500/60 to-emerald-400/40 rounded-full transition-all"
                    style={{ width: `${width}%` }}
                  />
                </div>
                <span className="text-xs text-white/60 w-10 text-right font-mono">{w.count}</span>
              </div>
            );
          })}
        </div>
      </GlassCard>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// TAB 2: CARBON INTELLIGENCE
// ═══════════════════════════════════════════════════════════

function CarbonIntelligenceTab() {
  // 90-day price history
  const priceHistory = useMemo(() => {
    return Array.from({ length: 90 }, (_, i) => ({
      day: i + 1,
      price: seededFloat(3000 + i * 19, 14.2, 28.7, 2),
    }));
  }, []);

  const minPrice = useMemo(() => Math.min(...priceHistory.map(p => p.price)), [priceHistory]);
  const maxPrice = useMemo(() => Math.max(...priceHistory.map(p => p.price)), [priceHistory]);
  const avgPrice = useMemo(() => priceHistory.reduce((s, p) => s + p.price, 0) / priceHistory.length, [priceHistory]);

  // Volume by vintage
  const vintages = useMemo(() => [
    { year: 2022, volume: seededInt(4001, 2800, 4200) },
    { year: 2023, volume: seededInt(4002, 5400, 8100) },
    { year: 2024, volume: seededInt(4003, 9200, 14000) },
    { year: 2025, volume: seededInt(4004, 12000, 18500) },
    { year: 2026, volume: seededInt(4005, 4200, 7800) },
  ], []);

  const maxVintageVol = useMemo(() => Math.max(...vintages.map(v => v.volume)), [vintages]);

  // Supply / demand
  const totalMinted = 47832;
  const totalRetired = 18294;
  const totalListed = 12847;
  const totalActive = totalMinted - totalRetired - totalListed;

  // Flow percentages
  const activePct = ((totalActive / totalMinted) * 100).toFixed(1);
  const listedPct = ((totalListed / totalMinted) * 100).toFixed(1);
  const retiredPct = ((totalRetired / totalMinted) * 100).toFixed(1);

  // Market cap
  const marketCap = totalMinted * avgPrice;

  return (
    <div className="space-y-8">
      {/* Price per tonne header metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MetricCard label="Min Price (90d)" value={formatDecimal(minPrice, 2)} unit="AETH/tCO2" icon={TrendingUp} />
        <MetricCard label="Avg Price (90d)" value={formatDecimal(avgPrice, 2)} unit="AETH/tCO2" icon={BarChart3} />
        <MetricCard label="Max Price (90d)" value={formatDecimal(maxPrice, 2)} unit="AETH/tCO2" icon={TrendingUp} />
      </div>

      {/* 90-day price chart */}
      <GlassCard className="p-6">
        <SectionHeader
          title="Price per Tonne CO2 (90 Days)"
          description="Historical price tracking for carbon credits on TerraQura"
        />
        <div className="flex items-end gap-[2px] h-52 mt-4">
          {priceHistory.map((p, i) => {
            const height = ((p.price - minPrice) / (maxPrice - minPrice)) * 100;
            const clampedHeight = Math.max(height, 3);
            return (
              <div key={i} className="flex-1 group relative flex flex-col items-center justify-end h-full">
                <div
                  className="w-full bg-cyan-500/40 hover:bg-cyan-500/70 rounded-t transition-all cursor-pointer min-h-[2px]"
                  style={{ height: `${clampedHeight}%` }}
                />
                <div className="absolute -top-8 left-1/2 -translate-x-1/2 hidden group-hover:block bg-midnight-900 border border-white/10 rounded-lg px-2 py-1 text-[10px] text-white whitespace-nowrap z-10">
                  Day {p.day}: {p.price} AETH
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex justify-between mt-2 text-[10px] text-white/30">
          <span>90 days ago</span>
          <span>45 days ago</span>
          <span>Today</span>
        </div>
      </GlassCard>

      {/* Volume by Vintage */}
      <GlassCard className="p-6">
        <SectionHeader
          title="Volume Distribution by Credit Vintage"
          description="Total credits issued per vintage year"
        />
        <div className="space-y-4 mt-4">
          {vintages.map((v) => {
            const width = (v.volume / maxVintageVol) * 100;
            return (
              <div key={v.year} className="flex items-center gap-4">
                <span className="text-sm text-white/70 w-12 font-mono font-medium">{v.year}</span>
                <div className="flex-1 h-8 bg-white/[0.03] rounded-lg overflow-hidden relative">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-600/60 to-teal-500/40 rounded-lg transition-all"
                    style={{ width: `${width}%` }}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-white/60 font-mono">
                    {formatNumber(v.volume)} tCO2
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </GlassCard>

      {/* Supply / Demand & Credit Flow */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Supply metrics */}
        <GlassCard className="p-6">
          <SectionHeader title="Supply & Demand" description="Credit lifecycle overview" />
          <div className="space-y-4 mt-2">
            <div className="flex items-center justify-between py-3 border-b border-white/[0.06]">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-emerald-500" />
                <span className="text-sm text-white/70">Total Minted</span>
              </div>
              <span className="text-sm font-bold text-white font-mono">{formatNumber(totalMinted)} tCO2</span>
            </div>
            <div className="flex items-center justify-between py-3 border-b border-white/[0.06]">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-orange-500" />
                <span className="text-sm text-white/70">Total Retired</span>
              </div>
              <span className="text-sm font-bold text-white font-mono">{formatNumber(totalRetired)} tCO2</span>
            </div>
            <div className="flex items-center justify-between py-3 border-b border-white/[0.06]">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-cyan-500" />
                <span className="text-sm text-white/70">Total Listed</span>
              </div>
              <span className="text-sm font-bold text-white font-mono">{formatNumber(totalListed)} tCO2</span>
            </div>
            <div className="flex items-center justify-between py-3">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-purple-500" />
                <span className="text-sm text-white/70">Active (Unlisted)</span>
              </div>
              <span className="text-sm font-bold text-white font-mono">{formatNumber(totalActive)} tCO2</span>
            </div>
          </div>
        </GlassCard>

        {/* Credit Flow */}
        <GlassCard className="p-6">
          <SectionHeader title="Credit Flow" description="Minted to lifecycle stage" />
          <div className="mt-4 space-y-3">
            {/* Source */}
            <div className="text-center">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                <Leaf className="w-4 h-4 text-emerald-400" />
                <span className="text-sm font-medium text-emerald-400">Minted: {formatNumber(totalMinted)}</span>
              </div>
            </div>
            {/* Arrow */}
            <div className="flex justify-center">
              <div className="w-px h-6 bg-white/20" />
            </div>
            {/* Destinations */}
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center p-3 bg-purple-500/5 border border-purple-500/10 rounded-xl">
                <p className="text-lg font-bold text-purple-400">{activePct}%</p>
                <p className="text-[10px] text-white/40 uppercase tracking-wider mt-1">Active</p>
                <p className="text-xs text-white/50 font-mono mt-0.5">{formatNumber(totalActive)}</p>
              </div>
              <div className="text-center p-3 bg-cyan-500/5 border border-cyan-500/10 rounded-xl">
                <p className="text-lg font-bold text-cyan-400">{listedPct}%</p>
                <p className="text-[10px] text-white/40 uppercase tracking-wider mt-1">Listed</p>
                <p className="text-xs text-white/50 font-mono mt-0.5">{formatNumber(totalListed)}</p>
              </div>
              <div className="text-center p-3 bg-orange-500/5 border border-orange-500/10 rounded-xl">
                <p className="text-lg font-bold text-orange-400">{retiredPct}%</p>
                <p className="text-[10px] text-white/40 uppercase tracking-wider mt-1">Retired</p>
                <p className="text-xs text-white/50 font-mono mt-0.5">{formatNumber(totalRetired)}</p>
              </div>
            </div>
          </div>

          {/* Market Cap */}
          <div className="mt-6 pt-4 border-t border-white/[0.06]">
            <div className="flex items-center justify-between">
              <span className="text-xs text-white/40 uppercase tracking-wider">Market Cap Equivalent</span>
              <span className="text-lg font-bold text-white font-mono">{formatNumber(Math.round(marketCap))} <span className="text-sm text-white/40 font-normal">AETH</span></span>
            </div>
          </div>
        </GlassCard>
      </div>

      {/* Comparison vs Traditional Registries */}
      <GlassCard className="p-6">
        <SectionHeader title="TerraQura vs Traditional Registries" description="Comparing on-chain verification to legacy systems" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          {[
            { metric: "Verification Time", terraqura: "4.2 hours", traditional: "6-18 months", improvement: "99.7% faster" },
            { metric: "Cost per Credit", terraqura: "0.003 AETH", traditional: "$0.15-0.50", improvement: "~95% cheaper" },
            { metric: "Transparency", terraqura: "Full on-chain", traditional: "PDF reports", improvement: "100% auditable" },
          ].map((row) => (
            <GlassCard key={row.metric} className="p-4 bg-white/[0.01]">
              <p className="text-[10px] text-white/30 uppercase tracking-wider mb-3">{row.metric}</p>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-emerald-400">TerraQura</span>
                  <span className="text-xs text-white font-mono">{row.terraqura}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-white/40">Traditional</span>
                  <span className="text-xs text-white/40 font-mono">{row.traditional}</span>
                </div>
                <div className="pt-2 border-t border-white/[0.06]">
                  <span className="text-xs font-medium text-emerald-400">{row.improvement}</span>
                </div>
              </div>
            </GlassCard>
          ))}
        </div>
      </GlassCard>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// TAB 3: ENVIRONMENTAL IMPACT
// ═══════════════════════════════════════════════════════════

function EnvironmentalImpactTab() {
  const totalCO2Removed = 47832;

  // Milestones
  const milestones = [
    { target: 1000, label: "1,000 t", achieved: true, progress: 100 },
    { target: 10000, label: "10,000 t", achieved: true, progress: 100 },
    { target: 50000, label: "50,000 t", achieved: false, progress: 96 },
    { target: 100000, label: "100,000 t", achieved: false, progress: 48 },
  ];

  // Impact equivalencies
  const equivalencies = [
    { icon: TreePine, label: "Trees Planted Equivalent", value: formatNumber(seededInt(5001, 2148000, 2148000)), unit: "trees", color: "emerald" },
    { icon: Plane, label: "Flights Offset", value: formatNumber(seededInt(5002, 19127, 19127)), unit: "transatlantic flights", color: "cyan" },
    { icon: Car, label: "Cars Removed (1yr)", value: formatNumber(seededInt(5003, 10398, 10398)), unit: "vehicles", color: "amber" },
    { icon: Home, label: "Homes Powered (1yr)", value: formatNumber(seededInt(5004, 5783, 5783)), unit: "households", color: "purple" },
    { icon: Globe, label: "Olympic Pools of CO2", value: formatNumber(seededInt(5005, 23916, 23916)), unit: "pools", color: "blue" },
    { icon: Target, label: "Blue Whale Weights", value: formatNumber(seededInt(5006, 319, 319)), unit: "whale equivalents", color: "teal" },
    { icon: TreePine, label: "Football Fields of Forest", value: formatNumber(seededInt(5007, 1594, 1594)), unit: "fields", color: "green" },
    { icon: Zap, label: "Years of Electricity", value: formatNumber(seededInt(5008, 6748, 6748)), unit: "household-years", color: "yellow" },
  ];

  const iconBgMap: Record<string, string> = {
    emerald: "bg-emerald-500/10",
    cyan: "bg-cyan-500/10",
    amber: "bg-amber-500/10",
    purple: "bg-purple-500/10",
    blue: "bg-blue-500/10",
    teal: "bg-teal-500/10",
    green: "bg-green-500/10",
    yellow: "bg-yellow-500/10",
  };

  const iconTextMap: Record<string, string> = {
    emerald: "text-emerald-400",
    cyan: "text-cyan-400",
    amber: "text-amber-400",
    purple: "text-purple-400",
    blue: "text-blue-400",
    teal: "text-teal-400",
    green: "text-green-400",
    yellow: "text-yellow-400",
  };

  // Monthly impact (12 months)
  const monthlyImpact = useMemo(() => {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return months.map((m, i) => ({
      month: m,
      tonnes: seededInt(6000 + i * 53, 2200, 5800),
    }));
  }, []);

  const maxMonthly = useMemo(() => Math.max(...monthlyImpact.map(m => m.tonnes)), [monthlyImpact]);

  return (
    <div className="space-y-8">
      {/* Hero Counter */}
      <GlassCard className="p-8 text-center bg-gradient-to-br from-emerald-500/5 to-teal-500/5 border-emerald-500/10">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Leaf className="w-6 h-6 text-emerald-400" />
          <span className="text-xs text-emerald-400 uppercase tracking-widest font-medium">Total CO2 Removed</span>
        </div>
        <p className="text-6xl sm:text-7xl font-black text-white tabular-nums tracking-tight">
          {formatNumber(totalCO2Removed)}
        </p>
        <p className="text-lg text-white/40 mt-2">tonnes of CO2 permanently removed</p>
        <div className="mt-4 flex items-center justify-center gap-2">
          <StatusBadge status="Verified" />
          <span className="text-xs text-white/30">On-chain verified via Proof-of-Physics</span>
        </div>
      </GlassCard>

      {/* Milestone Progress */}
      <GlassCard className="p-6">
        <SectionHeader title="Impact Milestones" description="Progress toward removal targets" />
        <div className="space-y-5 mt-4">
          {milestones.map((ms) => (
            <div key={ms.target}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {ms.achieved ? (
                    <CheckCircle className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <Clock className="w-4 h-4 text-white/30" />
                  )}
                  <span className={`text-sm font-medium ${ms.achieved ? "text-emerald-400" : "text-white/60"}`}>
                    {ms.label}
                  </span>
                </div>
                <span className="text-xs text-white/40 font-mono">{ms.progress}%</span>
              </div>
              <div className="h-3 bg-white/[0.04] rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${ms.achieved ? "bg-emerald-500/70" : "bg-emerald-500/30"}`}
                  style={{ width: `${ms.progress}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </GlassCard>

      {/* Impact Equivalencies Grid */}
      <div>
        <SectionHeader title="Impact Equivalencies" description="What does removing 47,832 tonnes of CO2 look like?" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {equivalencies.map((eq) => {
            const Icon = eq.icon;
            return (
              <GlassCard key={eq.label} className="p-5">
                <div className={`p-2.5 rounded-xl ${iconBgMap[eq.color]} w-fit mb-3`}>
                  <Icon className={`w-5 h-5 ${iconTextMap[eq.color]}`} />
                </div>
                <p className="text-2xl font-bold text-white tabular-nums">{eq.value}</p>
                <p className="text-xs text-white/40 mt-1">{eq.unit}</p>
                <p className="text-[10px] text-white/25 mt-0.5 uppercase tracking-wider">{eq.label}</p>
              </GlassCard>
            );
          })}
        </div>
      </div>

      {/* UN SDG Alignment */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <GlassCard className="p-6 border-amber-500/10">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-amber-500/10 rounded-xl">
              <Zap className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">SDG 7</h3>
              <p className="text-xs text-white/40">Affordable and Clean Energy</p>
            </div>
          </div>
          <div className="mb-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-white/50">Alignment Score</span>
              <span className="text-xs text-amber-400 font-mono">87%</span>
            </div>
            <div className="h-2 bg-white/[0.04] rounded-full overflow-hidden">
              <div className="h-full bg-amber-500/60 rounded-full" style={{ width: "87%" }} />
            </div>
          </div>
          <p className="text-xs text-white/30 leading-relaxed">
            DAC-powered carbon removal incentivizes renewable energy adoption. Protocol fees fund clean energy infrastructure on Aethelred.
          </p>
        </GlassCard>

        <GlassCard className="p-6 border-emerald-500/10">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-emerald-500/10 rounded-xl">
              <Globe className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">SDG 13</h3>
              <p className="text-xs text-white/40">Climate Action</p>
            </div>
          </div>
          <div className="mb-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-white/50">Alignment Score</span>
              <span className="text-xs text-emerald-400 font-mono">94%</span>
            </div>
            <div className="h-2 bg-white/[0.04] rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500/60 rounded-full" style={{ width: "94%" }} />
            </div>
          </div>
          <p className="text-xs text-white/30 leading-relaxed">
            Direct atmospheric CO2 removal with on-chain verification ensures measurable, permanent climate impact with full transparency.
          </p>
        </GlassCard>
      </div>

      {/* Monthly Impact Chart */}
      <GlassCard className="p-6">
        <SectionHeader title="Monthly Impact" description="Tonnes of CO2 removed per month (trailing 12 months)" />
        <div className="flex items-end gap-2 h-48 mt-4">
          {monthlyImpact.map((m, i) => {
            const height = (m.tonnes / maxMonthly) * 100;
            return (
              <div key={i} className="flex-1 group relative flex flex-col items-center justify-end h-full">
                <div
                  className="w-full bg-gradient-to-t from-emerald-600/50 to-emerald-400/30 hover:from-emerald-600/70 hover:to-emerald-400/50 rounded-t transition-all cursor-pointer min-h-[2px]"
                  style={{ height: `${height}%` }}
                />
                <div className="absolute -top-8 left-1/2 -translate-x-1/2 hidden group-hover:block bg-midnight-900 border border-white/10 rounded-lg px-2 py-1 text-[10px] text-white whitespace-nowrap z-10">
                  {m.month}: {formatNumber(m.tonnes)} t
                </div>
                <span className="text-[9px] text-white/30 mt-1">{m.month}</span>
              </div>
            );
          })}
        </div>
      </GlassCard>

      {/* Impact Certificate */}
      <GlassCard className="p-8 bg-gradient-to-br from-emerald-500/5 to-cyan-500/5 border-emerald-500/10">
        <div className="text-center">
          <Award className="w-12 h-12 text-emerald-400 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-white mb-2">Protocol Impact Certificate</h3>
          <p className="text-sm text-white/50 max-w-lg mx-auto mb-6">
            This certificate confirms that the TerraQura protocol has facilitated the verified removal
            of {formatNumber(totalCO2Removed)} tonnes of CO2 from the atmosphere via Direct Air Capture technology,
            permanently recorded on the Aethelred blockchain.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-2xl mx-auto">
            <div className="text-center">
              <p className="text-xs text-white/30 uppercase tracking-wider">Total Removed</p>
              <p className="text-lg font-bold text-emerald-400 font-mono">{formatNumber(totalCO2Removed)} t</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-white/30 uppercase tracking-wider">Verification</p>
              <p className="text-lg font-bold text-emerald-400">On-Chain</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-white/30 uppercase tracking-wider">Method</p>
              <p className="text-lg font-bold text-emerald-400">DAC</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-white/30 uppercase tracking-wider">Status</p>
              <p className="text-lg font-bold text-emerald-400">Permanent</p>
            </div>
          </div>
        </div>
      </GlassCard>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// TAB 4: VERIFICATION METRICS
// ═══════════════════════════════════════════════════════════

function VerificationMetricsTab() {
  const avgTimeToMint = "4.2 hours";
  const passRate = 94.7;
  const totalVerifications = seededInt(7001, 8721, 8721);
  const totalPassed = Math.round(totalVerifications * (passRate / 100));
  const totalFailed = totalVerifications - totalPassed;

  // Rejection reasons
  const rejections = [
    { reason: "Physics Check Failed", pct: 42, count: Math.round(totalFailed * 0.42), color: "bg-red-500/50" },
    { reason: "Source Mismatch", pct: 28, count: Math.round(totalFailed * 0.28), color: "bg-orange-500/50" },
    { reason: "Energy Anomaly", pct: 18, count: Math.round(totalFailed * 0.18), color: "bg-amber-500/50" },
    { reason: "Duplicate Submission", pct: 12, count: Math.round(totalFailed * 0.12), color: "bg-yellow-500/50" },
  ];

  // 30-day verification volume
  const verificationVolume = useMemo(() => {
    return Array.from({ length: 30 }, (_, i) => ({
      day: i + 1,
      total: seededInt(8000 + i * 29, 180, 380),
      passed: 0,
    })).map(d => ({ ...d, passed: Math.round(d.total * (seededFloat(8500 + d.day * 13, 0.90, 0.98, 2))) }));
  }, []);

  const maxVerVol = useMemo(() => Math.max(...verificationVolume.map(v => v.total)), [verificationVolume]);

  // Physics check distribution (efficiency histogram)
  const efficiencyBuckets = useMemo(() => {
    const buckets = [
      { range: "200-250", label: "200-250 kWh/t" },
      { range: "250-300", label: "250-300 kWh/t" },
      { range: "300-350", label: "300-350 kWh/t" },
      { range: "350-400", label: "350-400 kWh/t" },
      { range: "400-450", label: "400-450 kWh/t" },
      { range: "450-500", label: "450-500 kWh/t" },
      { range: "500-550", label: "500-550 kWh/t" },
      { range: "550-600", label: "550-600 kWh/t" },
    ];
    return buckets.map((b, i) => ({
      ...b,
      count: seededInt(9000 + i * 41, i === 3 || i === 4 ? 1800 : i === 2 || i === 5 ? 1200 : 400, i === 3 || i === 4 ? 2400 : i === 2 || i === 5 ? 1600 : 800),
    }));
  }, []);

  const maxBucketCount = useMemo(() => Math.max(...efficiencyBuckets.map(b => b.count)), [efficiencyBuckets]);

  // Timing comparison
  const fastestVerification = "0.8 hours";
  const slowestVerification = "11.4 hours";
  const averageVerification = avgTimeToMint;

  // Verifier performance table
  const verifiers = useMemo(() => {
    return Array.from({ length: 8 }, (_, i) => ({
      address: `0x${seededHex(10000 + i * 67, 40)}`,
      passRate: seededFloat(10500 + i * 31, 88.5, 99.2, 1),
      volume: seededInt(10800 + i * 43, 340, 1820),
      avgTime: seededFloat(11000 + i * 29, 2.1, 7.8, 1),
    }));
  }, []);

  return (
    <div className="space-y-8">
      {/* Top metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard label="Avg Time to Mint" value={avgTimeToMint} icon={Clock} />
        <MetricCard
          label="Verification Pass Rate"
          value={`${passRate}%`}
          icon={CheckCircle}
          trend={{ value: 1.2, label: "vs last month" }}
        />
        <MetricCard label="Total Verifications" value={formatNumber(totalVerifications)} icon={ShieldCheck} />
        <MetricCard label="Failed Verifications" value={formatNumber(totalFailed)} icon={XCircle} />
      </div>

      {/* Rejection Reasons */}
      <GlassCard className="p-6">
        <SectionHeader
          title="Rejection Reasons Breakdown"
          description={`${totalFailed} total rejections analyzed`}
        />
        <div className="space-y-4 mt-4">
          {rejections.map((r) => (
            <div key={r.reason}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm text-white/70">{r.reason}</span>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-white/40 font-mono">{r.count}</span>
                  <span className="text-xs text-white/60 font-mono font-medium w-10 text-right">{r.pct}%</span>
                </div>
              </div>
              <div className="h-4 bg-white/[0.03] rounded-full overflow-hidden">
                <div
                  className={`h-full ${r.color} rounded-full transition-all`}
                  style={{ width: `${r.pct}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </GlassCard>

      {/* Verification volume 30 days */}
      <GlassCard className="p-6">
        <SectionHeader
          title="Verification Volume (30 Days)"
          description="Daily verification submissions and outcomes"
        />
        <div className="flex items-end gap-[3px] h-48 mt-4">
          {verificationVolume.map((v, i) => {
            const totalHeight = (v.total / maxVerVol) * 100;
            const passedHeight = (v.passed / maxVerVol) * 100;
            return (
              <div key={i} className="flex-1 group relative flex flex-col items-center justify-end h-full">
                {/* Total bar (background) */}
                <div className="w-full relative" style={{ height: `${totalHeight}%` }}>
                  <div className="absolute inset-0 bg-red-500/20 rounded-t" />
                  <div
                    className="absolute bottom-0 left-0 right-0 bg-emerald-500/40 rounded-t"
                    style={{ height: `${totalHeight > 0 ? (passedHeight / totalHeight) * 100 : 0}%` }}
                  />
                </div>
                <div className="absolute -top-8 left-1/2 -translate-x-1/2 hidden group-hover:block bg-midnight-900 border border-white/10 rounded-lg px-2 py-1 text-[10px] text-white whitespace-nowrap z-10">
                  Day {v.day}: {v.passed}/{v.total}
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex justify-between mt-2 text-[10px] text-white/30">
          <span>Day 1</span>
          <span>Day 15</span>
          <span>Day 30</span>
        </div>
        <div className="flex items-center gap-4 mt-3">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-emerald-500/40" />
            <span className="text-[10px] text-white/40">Passed</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-red-500/20" />
            <span className="text-[10px] text-white/40">Failed</span>
          </div>
        </div>
      </GlassCard>

      {/* Physics Check Distribution */}
      <GlassCard className="p-6">
        <SectionHeader
          title="Physics Check Distribution"
          description="Credits per energy efficiency bucket (kWh per tonne CO2)"
        />
        <div className="flex items-end gap-2 h-48 mt-4">
          {efficiencyBuckets.map((b, i) => {
            const height = (b.count / maxBucketCount) * 100;
            return (
              <div key={i} className="flex-1 group relative flex flex-col items-center justify-end h-full">
                <div
                  className="w-full bg-purple-500/40 hover:bg-purple-500/60 rounded-t transition-all cursor-pointer min-h-[2px]"
                  style={{ height: `${height}%` }}
                />
                <div className="absolute -top-8 left-1/2 -translate-x-1/2 hidden group-hover:block bg-midnight-900 border border-white/10 rounded-lg px-2 py-1 text-[10px] text-white whitespace-nowrap z-10">
                  {b.label}: {formatNumber(b.count)}
                </div>
                <span className="text-[8px] text-white/25 mt-1 leading-tight text-center">{b.range}</span>
              </div>
            );
          })}
        </div>
      </GlassCard>

      {/* Timing Comparison */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <GlassCard className="p-5 text-center border-emerald-500/10">
          <Gauge className="w-6 h-6 text-emerald-400 mx-auto mb-2" />
          <p className="text-xs text-white/30 uppercase tracking-wider mb-1">Fastest</p>
          <p className="text-2xl font-bold text-emerald-400 font-mono">{fastestVerification}</p>
        </GlassCard>
        <GlassCard className="p-5 text-center border-cyan-500/10">
          <Clock className="w-6 h-6 text-cyan-400 mx-auto mb-2" />
          <p className="text-xs text-white/30 uppercase tracking-wider mb-1">Average</p>
          <p className="text-2xl font-bold text-cyan-400 font-mono">{averageVerification}</p>
        </GlassCard>
        <GlassCard className="p-5 text-center border-amber-500/10">
          <AlertTriangle className="w-6 h-6 text-amber-400 mx-auto mb-2" />
          <p className="text-xs text-white/30 uppercase tracking-wider mb-1">Slowest</p>
          <p className="text-2xl font-bold text-amber-400 font-mono">{slowestVerification}</p>
        </GlassCard>
      </div>

      {/* Verifier Performance Table */}
      <GlassCard className="p-6">
        <SectionHeader title="Verifier Performance" description="Top verifier nodes by volume" />
        <div className="overflow-x-auto mt-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="text-left py-3 px-3 text-[10px] text-white/30 uppercase tracking-wider font-medium">Verifier Address</th>
                <th className="text-right py-3 px-3 text-[10px] text-white/30 uppercase tracking-wider font-medium">Pass Rate</th>
                <th className="text-right py-3 px-3 text-[10px] text-white/30 uppercase tracking-wider font-medium">Volume</th>
                <th className="text-right py-3 px-3 text-[10px] text-white/30 uppercase tracking-wider font-medium">Avg Time</th>
              </tr>
            </thead>
            <tbody>
              {verifiers.map((v, i) => (
                <tr key={i} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition">
                  <td className="py-3 px-3">
                    <code className="text-xs text-emerald-400/70 font-mono">
                      {v.address.slice(0, 6)}...{v.address.slice(-4)}
                    </code>
                  </td>
                  <td className="py-3 px-3 text-right">
                    <span className={`text-xs font-mono ${v.passRate >= 95 ? "text-emerald-400" : v.passRate >= 90 ? "text-amber-400" : "text-red-400"}`}>
                      {v.passRate}%
                    </span>
                  </td>
                  <td className="py-3 px-3 text-right">
                    <span className="text-xs text-white/60 font-mono">{formatNumber(v.volume)}</span>
                  </td>
                  <td className="py-3 px-3 text-right">
                    <span className="text-xs text-white/50 font-mono">{v.avgTime}h</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </GlassCard>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// TAB 5: NETWORK HEALTH
// ═══════════════════════════════════════════════════════════

function NetworkHealthTab() {
  // Block production (24 hours, hourly)
  const blockProduction = useMemo(() => {
    return Array.from({ length: 24 }, (_, i) => ({
      hour: i,
      blocks: seededInt(12000 + i * 37, 280, 360),
    }));
  }, []);

  const maxBlocks = useMemo(() => Math.max(...blockProduction.map(b => b.blocks)), [blockProduction]);

  // Gas usage per tx type
  const gasPerTxType = [
    { type: "Mint", gas: seededInt(13001, 142000, 142000), color: "bg-emerald-500/50" },
    { type: "Transfer", gas: seededInt(13002, 65000, 65000), color: "bg-cyan-500/50" },
    { type: "Retire", gas: seededInt(13003, 98000, 98000), color: "bg-orange-500/50" },
    { type: "Trade", gas: seededInt(13004, 185000, 185000), color: "bg-purple-500/50" },
    { type: "Verify", gas: seededInt(13005, 224000, 224000), color: "bg-amber-500/50" },
  ];

  const maxGas = Math.max(...gasPerTxType.map(g => g.gas));

  // Contract call frequency
  const contractCalls = useMemo(() => {
    return [
      { name: "CarbonMarketplace", calls: seededInt(14001, 3842, 3842), pct: 0 },
      { name: "CarbonCredit (ERC-1155)", calls: seededInt(14002, 2917, 2917), pct: 0 },
      { name: "VerificationEngine", calls: seededInt(14003, 1648, 1648), pct: 0 },
      { name: "NativeIoTOracle", calls: seededInt(14004, 1247, 1247), pct: 0 },
      { name: "AccessControl", calls: seededInt(14005, 842, 842), pct: 0 },
      { name: "CircuitBreaker", calls: seededInt(14006, 324, 324), pct: 0 },
      { name: "MultisigWallet", calls: seededInt(14007, 187, 187), pct: 0 },
      { name: "TimelockController", calls: seededInt(14008, 92, 92), pct: 0 },
    ].map((c, _, arr) => {
      const total = arr.reduce((s, x) => s + x.calls, 0);
      return { ...c, pct: parseFloat(((c.calls / total) * 100).toFixed(1)) };
    });
  }, []);

  // Error rate
  const failedTxPct = seededFloat(15001, 0.28, 0.28, 2);
  const totalTxToday = seededInt(15002, 847, 847);
  const failedTxCount = Math.round(totalTxToday * failedTxPct / 100);

  // Uptime
  const uptimePct = 99.97;
  const uptimeDays = 847;

  // Peer count & validators
  const peerCount = seededInt(16001, 142, 142);
  const validatorCount = seededInt(16002, 21, 21);
  const activeValidators = seededInt(16003, 19, 19);

  // Mempool
  const mempoolSize = seededInt(17001, 23, 23);
  const mempoolGas = seededFloat(17002, 4.7, 4.7, 1);
  const avgBlockTime = seededFloat(17003, 2.1, 2.1, 1);

  return (
    <div className="space-y-8">
      {/* Uptime & Top Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <GlassCard className="p-5 border-emerald-500/10">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-white/40 uppercase tracking-wider">Uptime</p>
            <StatusBadge status="Operational" />
          </div>
          <p className="text-3xl font-bold text-emerald-400 font-mono">{uptimePct}%</p>
          <p className="text-xs text-white/30 mt-1">{formatNumber(uptimeDays)} consecutive days</p>
        </GlassCard>
        <MetricCard label="Peer Count" value={formatNumber(peerCount)} icon={Server} />
        <MetricCard label="Active Validators" value={`${activeValidators}/${validatorCount}`} icon={ShieldCheck} />
        <MetricCard label="Avg Block Time" value={`${avgBlockTime}s`} icon={Clock} />
      </div>

      {/* Block Production Chart */}
      <GlassCard className="p-6">
        <SectionHeader
          title="Block Production (24h)"
          description="Blocks produced per hour over the last 24 hours"
        />
        <div className="flex items-end gap-1.5 h-48 mt-4">
          {blockProduction.map((b, i) => {
            const height = (b.blocks / maxBlocks) * 100;
            return (
              <div key={i} className="flex-1 group relative flex flex-col items-center justify-end h-full">
                <div
                  className="w-full bg-blue-500/40 hover:bg-blue-500/60 rounded-t transition-all cursor-pointer min-h-[2px]"
                  style={{ height: `${height}%` }}
                />
                <div className="absolute -top-8 left-1/2 -translate-x-1/2 hidden group-hover:block bg-midnight-900 border border-white/10 rounded-lg px-2 py-1 text-[10px] text-white whitespace-nowrap z-10">
                  {String(b.hour).padStart(2, "0")}:00 - {b.blocks} blocks
                </div>
                {i % 6 === 0 && (
                  <span className="text-[9px] text-white/25 mt-1">{String(b.hour).padStart(2, "0")}h</span>
                )}
              </div>
            );
          })}
        </div>
      </GlassCard>

      {/* Gas Usage & Contract Calls - two columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gas Usage */}
        <GlassCard className="p-6">
          <SectionHeader title="Gas Usage by Tx Type" description="Average gas consumed per transaction type" />
          <div className="space-y-4 mt-4">
            {gasPerTxType.map((g) => {
              const width = (g.gas / maxGas) * 100;
              return (
                <div key={g.type}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm text-white/70">{g.type}</span>
                    <span className="text-xs text-white/50 font-mono">{formatNumber(g.gas)} gas</span>
                  </div>
                  <div className="h-4 bg-white/[0.03] rounded-full overflow-hidden">
                    <div
                      className={`h-full ${g.color} rounded-full transition-all`}
                      style={{ width: `${width}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </GlassCard>

        {/* Contract Call Frequency */}
        <GlassCard className="p-6">
          <SectionHeader title="Contract Call Frequency" description="Most called contracts (30-day window)" />
          <div className="overflow-x-auto mt-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th className="text-left py-2 px-2 text-[10px] text-white/30 uppercase tracking-wider font-medium">#</th>
                  <th className="text-left py-2 px-2 text-[10px] text-white/30 uppercase tracking-wider font-medium">Contract</th>
                  <th className="text-right py-2 px-2 text-[10px] text-white/30 uppercase tracking-wider font-medium">Calls</th>
                  <th className="text-right py-2 px-2 text-[10px] text-white/30 uppercase tracking-wider font-medium">Share</th>
                </tr>
              </thead>
              <tbody>
                {contractCalls.map((c, i) => (
                  <tr key={i} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition">
                    <td className="py-2.5 px-2 text-xs text-white/30">{i + 1}</td>
                    <td className="py-2.5 px-2 text-xs text-white/70">{c.name}</td>
                    <td className="py-2.5 px-2 text-right text-xs text-white/60 font-mono">{formatNumber(c.calls)}</td>
                    <td className="py-2.5 px-2 text-right text-xs text-emerald-400/70 font-mono">{c.pct}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </GlassCard>
      </div>

      {/* Error Rate & Mempool */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Error Rate */}
        <GlassCard className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-2 bg-red-500/10 rounded-xl">
              <XCircle className="w-4 h-4 text-red-400" />
            </div>
            <div>
              <p className="text-xs text-white/40 uppercase tracking-wider">Failed Tx Rate</p>
            </div>
          </div>
          <p className="text-2xl font-bold text-white font-mono">{failedTxPct}%</p>
          <p className="text-xs text-white/30 mt-1">{failedTxCount} of {formatNumber(totalTxToday)} today</p>
          <div className="mt-3 h-2 bg-white/[0.04] rounded-full overflow-hidden">
            <div className="h-full bg-emerald-500/60 rounded-full" style={{ width: `${100 - failedTxPct}%` }} />
          </div>
          <div className="flex justify-between mt-1 text-[10px] text-white/25">
            <span>Success</span>
            <span>Failed</span>
          </div>
        </GlassCard>

        {/* Mempool */}
        <GlassCard className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-2 bg-purple-500/10 rounded-xl">
              <Cpu className="w-4 h-4 text-purple-400" />
            </div>
            <div>
              <p className="text-xs text-white/40 uppercase tracking-wider">Memory Pool</p>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-white/50">Pending Txs</span>
              <span className="text-sm font-bold text-white font-mono">{mempoolSize}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-white/50">Total Gas</span>
              <span className="text-sm font-bold text-white font-mono">{mempoolGas}M</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-white/50">Status</span>
              <StatusBadge status="Active" />
            </div>
          </div>
        </GlassCard>

        {/* Validator Stats */}
        <GlassCard className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-2 bg-cyan-500/10 rounded-xl">
              <ShieldCheck className="w-4 h-4 text-cyan-400" />
            </div>
            <div>
              <p className="text-xs text-white/40 uppercase tracking-wider">Validator Network</p>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-white/50">Total Validators</span>
              <span className="text-sm font-bold text-white font-mono">{validatorCount}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-white/50">Active</span>
              <span className="text-sm font-bold text-emerald-400 font-mono">{activeValidators}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-white/50">Inactive</span>
              <span className="text-sm font-bold text-amber-400 font-mono">{validatorCount - activeValidators}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-white/50">Consensus</span>
              <span className="text-xs text-emerald-400">Aethelred PoS</span>
            </div>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// MAIN EXPORT
// ═══════════════════════════════════════════════════════════

export function AnalyticsDashboardContent() {
  const [activeTab, setActiveTab] = useState("kpis");

  return (
    <div className="min-h-screen bg-midnight-950 flex flex-col">
      <TopNav />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">Protocol Analytics</h1>
              <p className="text-sm text-white/40 mt-1">
                Comprehensive on-chain analytics for the TerraQura carbon credit protocol
              </p>
            </div>
            <StatusBadge status="Active" />
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-8">
          <Tabs tabs={ANALYTICS_TABS} activeTab={activeTab} onChange={setActiveTab} />
        </div>

        {/* Tab Content */}
        {activeTab === "kpis" && <ProtocolKPIsTab />}
        {activeTab === "carbon" && <CarbonIntelligenceTab />}
        {activeTab === "impact" && <EnvironmentalImpactTab />}
        {activeTab === "verification" && <VerificationMetricsTab />}
        {activeTab === "network" && <NetworkHealthTab />}
      </main>

      <DAppFooter />
    </div>
  );
}
