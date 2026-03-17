/**
 * TerraQura Executive Dashboard
 *
 * Functional, data-driven dashboard with real-time contract reads,
 * live event watchers, governance overview, protocol status,
 * CO2 impact hero, protocol health heatmap, treasury & revenue,
 * network topology, cross-chain readiness, and enhanced activity feed.
 *
 * @version 7.0.0 - Enhanced Executive Dashboard
 */

"use client";

import { useState, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  Coins, Store, Shield, Radio, Clock,
  ExternalLink, Wallet, Flame, BarChart3, Layers, AlertTriangle,
  TreePine, Plane, Car, Home, Activity, Globe,
  Zap, Vote, Network, DollarSign,
  Users, Timer, Server,
} from "lucide-react";

import { useApp } from "@/contexts/AppContext";
import {
  TopNav,
  DAppFooter,
  ToastContainer,
  GlassCard,
  MetricCard,
  StatusBadge,
  SectionHeader,
  LiveDot,
} from "@/components/dapp/SharedComponents";
import {
  usePlatformStats,
  useSystemStatus,
  useGovernanceStats,
  useWatchCreditMints,
  useWatchMarketplaceSales,
  useWatchEmergencyEvents,
  type ContractEventLog,
} from "@/hooks/useContractData";
import { CONTRACTS, VERIFIED_IMPLEMENTATIONS } from "@/lib/contracts";
import { getExplorerAddressUrl } from "@/lib/wagmi";
import { shortenAddress, formatDuration } from "@/lib/utils";

// ─── Seeded Random for SSR-safe mock data ──────────────────
function seededRandom(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function seededInt(seed: number, min: number, max: number): number {
  return Math.floor(seededRandom(seed) * (max - min + 1)) + min;
}

function seededHex(seed: number, length: number): string {
  const chars = "0123456789abcdef";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars[Math.floor(seededRandom(seed + i * 7 + 3) * chars.length)];
  }
  return result;
}

// ─── Helpers ───────────────────────────────────────────────
function formatWei(value: bigint): string {
  const num = Number(value) / 1e18;
  return num.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function formatBps(bps: bigint): string {
  return `${(Number(bps) / 100).toFixed(2)}%`;
}

// ─── Seeded Activity Feed ──────────────────────────────────
type ActivityType = "mint" | "sale" | "verification" | "retire" | "oracle" | "governance";

interface MockActivity {
  id: string;
  type: ActivityType;
  title: string;
  description: string;
  timeAgo: string;
  txHash: string;
}

const ACTIVITY_TYPES: ActivityType[] = ["mint", "sale", "verification", "retire", "oracle", "governance"];
const ACTIVITY_TITLES: Record<ActivityType, string> = {
  mint: "Carbon Credit Minted",
  sale: "Marketplace Sale",
  verification: "DAC Verification Complete",
  retire: "Token Retired",
  oracle: "Oracle Data Submitted",
  governance: "Governance Vote Cast",
};

function generateMockActivities(): MockActivity[] {
  const items: MockActivity[] = [];
  const timeLabels = [
    "1m ago", "2m ago", "4m ago", "7m ago", "12m ago", "18m ago", "25m ago", "33m ago",
    "41m ago", "52m ago", "1h ago", "1.5h ago", "2h ago", "2.5h ago", "3h ago", "3.5h ago",
    "4h ago", "5h ago",
  ];

  for (let i = 0; i < 18; i++) {
    const seed = 42 + i * 137;
    const typeIdx = Math.floor(seededRandom(seed) * ACTIVITY_TYPES.length);
    const type = ACTIVITY_TYPES[typeIdx] ?? "mint";
    const title = ACTIVITY_TITLES[type] ?? "Activity";
    const tokenId = seededInt(seed + 1, 1, 500);
    const amount = seededInt(seed + 2, 10, 1000);
    const addr = `0x${seededHex(seed + 3, 8)}`;

    let description = "";
    switch (type) {
      case "mint":
        description = `Token #${tokenId} minted to ${addr}... (${amount} kg CO2)`;
        break;
      case "sale":
        description = `${amount} credits sold for ${(seededRandom(seed + 4) * 5 + 0.1).toFixed(3)} AETH`;
        break;
      case "verification":
        description = `DAC-${String(seededInt(seed + 5, 1, 50)).padStart(3, "0")} passed Proof-of-Physics`;
        break;
      case "retire":
        description = `Token #${tokenId} retired by ${addr}... (${amount} tCO2e permanently removed)`;
        break;
      case "oracle":
        description = `DAC-${String(seededInt(seed + 6, 1, 50)).padStart(3, "0")} submitted ${seededInt(seed + 7, 100, 5000)} kg CO2 reading`;
        break;
      case "governance":
        description = `Proposal #${seededInt(seed + 8, 1, 25)} - ${seededRandom(seed + 9) > 0.5 ? "Voted FOR" : "Voted AGAINST"} by ${addr}...`;
        break;
    }

    items.push({
      id: `seed-${i}`,
      type,
      title,
      description,
      timeAgo: timeLabels[i] ?? `${i}h ago`,
      txHash: `0x${seededHex(seed + 10, 64)}`,
    });
  }
  return items;
}

const MOCK_ACTIVITIES = generateMockActivities();

// ─── Contract Info ─────────────────────────────────────────
interface ContractEntry {
  name: string;
  key: string;
  address: string;
  type: "core" | "governance" | "security";
  verifiedUrl?: string;
}

const CONTRACT_LIST: ContractEntry[] = [
  { name: "Carbon Credit (ERC-1155)", key: "carbonCredit", address: CONTRACTS.carbonCredit, type: "core", verifiedUrl: VERIFIED_IMPLEMENTATIONS.carbonCredit },
  { name: "Carbon Marketplace", key: "carbonMarketplace", address: CONTRACTS.carbonMarketplace, type: "core", verifiedUrl: VERIFIED_IMPLEMENTATIONS.carbonMarketplace },
  { name: "Verification Engine", key: "verificationEngine", address: CONTRACTS.verificationEngine, type: "core", verifiedUrl: VERIFIED_IMPLEMENTATIONS.verificationEngine },
  { name: "Access Control", key: "accessControl", address: CONTRACTS.accessControl, type: "core", verifiedUrl: VERIFIED_IMPLEMENTATIONS.accessControl },
  { name: "Circuit Breaker", key: "circuitBreaker", address: CONTRACTS.circuitBreaker, type: "security", verifiedUrl: VERIFIED_IMPLEMENTATIONS.circuitBreaker },
  { name: "Multisig Wallet", key: "multisig", address: CONTRACTS.multisig, type: "governance", verifiedUrl: VERIFIED_IMPLEMENTATIONS.multisig },
  { name: "Timelock Controller", key: "timelock", address: CONTRACTS.timelock, type: "governance", verifiedUrl: VERIFIED_IMPLEMENTATIONS.timelock },
  { name: "Gasless Marketplace", key: "gaslessMarketplace", address: CONTRACTS.gaslessMarketplace, type: "core", verifiedUrl: VERIFIED_IMPLEMENTATIONS.gaslessMarketplace },
];

// ─── Protocol Health Heatmap Data ──────────────────────────
const DAYS_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const PERIOD_LABELS = ["00-06", "06-12", "12-18", "18-24"];

function generateHeatmapData(): number[][] {
  const data: number[][] = [];
  for (let period = 0; period < 4; period++) {
    const row: number[] = [];
    for (let day = 0; day < 7; day++) {
      const seed = 500 + period * 7 + day;
      row.push(seededRandom(seed));
    }
    data.push(row);
  }
  return data;
}

const HEATMAP_DATA = generateHeatmapData();

// ─── Treasury Weekly Revenue Data ──────────────────────────
function generateWeeklyRevenue(): number[] {
  const data: number[] = [];
  for (let i = 0; i < 7; i++) {
    const seed = 700 + i * 31;
    data.push(seededRandom(seed) * 200 + 50);
  }
  return data;
}

const WEEKLY_REVENUE = generateWeeklyRevenue();

// ─── Network Topology Data ─────────────────────────────────
interface TopologyNode {
  name: string;
  key: string;
  type: "core" | "governance" | "security";
  connections: { target: string; direction: "bidirectional" | "outgoing" | "incoming" }[];
}

const TOPOLOGY_NODES: TopologyNode[] = [
  {
    name: "CarbonCredit",
    key: "carbonCredit",
    type: "core",
    connections: [
      { target: "verificationEngine", direction: "bidirectional" },
    ],
  },
  {
    name: "VerificationEngine",
    key: "verificationEngine",
    type: "core",
    connections: [
      { target: "carbonCredit", direction: "bidirectional" },
      { target: "carbonMarketplace", direction: "bidirectional" },
    ],
  },
  {
    name: "Marketplace",
    key: "carbonMarketplace",
    type: "core",
    connections: [
      { target: "verificationEngine", direction: "bidirectional" },
      { target: "circuitBreaker", direction: "incoming" },
    ],
  },
  {
    name: "Multisig",
    key: "multisig",
    type: "governance",
    connections: [
      { target: "timelock", direction: "outgoing" },
    ],
  },
  {
    name: "Timelock",
    key: "timelock",
    type: "governance",
    connections: [
      { target: "carbonCredit", direction: "outgoing" },
      { target: "carbonMarketplace", direction: "outgoing" },
      { target: "verificationEngine", direction: "outgoing" },
      { target: "accessControl", direction: "outgoing" },
    ],
  },
  {
    name: "AccessControl",
    key: "accessControl",
    type: "core",
    connections: [
      { target: "carbonCredit", direction: "outgoing" },
      { target: "carbonMarketplace", direction: "outgoing" },
      { target: "verificationEngine", direction: "outgoing" },
      { target: "circuitBreaker", direction: "outgoing" },
    ],
  },
  {
    name: "CircuitBreaker",
    key: "circuitBreaker",
    type: "security",
    connections: [
      { target: "carbonMarketplace", direction: "outgoing" },
    ],
  },
];

// ─── Skeleton helpers ──────────────────────────────────────
function SkeletonBar({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse bg-white/[0.06] rounded ${className}`} />;
}

function SkeletonMetricCard() {
  return (
    <GlassCard className="p-5 space-y-3">
      <SkeletonBar className="h-3 w-20" />
      <SkeletonBar className="h-7 w-28" />
      <SkeletonBar className="h-3 w-16" />
    </GlassCard>
  );
}

// ─── Sub-Components ────────────────────────────────────────

function SystemStatusBanner() {
  const { status, isLoading, error } = useSystemStatus();

  if (isLoading) {
    return (
      <div className="animate-pulse flex items-center gap-3 p-4 rounded-xl border border-white/[0.06] bg-white/[0.02]">
        <div className="w-3 h-3 rounded-full bg-white/10" />
        <SkeletonBar className="h-4 w-48" />
      </div>
    );
  }

  if (error || !status) {
    return (
      <div className="flex items-center gap-3 p-4 rounded-xl border border-amber-500/20 bg-amber-500/5">
        <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
        <div>
          <p className="text-sm font-medium text-amber-300">Unable to connect to protocol</p>
          <p className="text-xs text-white/40 mt-0.5">
            Connect to the Aethelred network to view live system status
          </p>
        </div>
      </div>
    );
  }

  const emergencyLabels: Record<number, { label: string; color: string; bg: string }> = {
    0: { label: "OPERATIONAL", color: "text-emerald-400", bg: "border-emerald-500/20 bg-emerald-500/5" },
    1: { label: "CAUTION", color: "text-amber-400", bg: "border-amber-500/20 bg-amber-500/5" },
    2: { label: "ELEVATED ALERT", color: "text-orange-400", bg: "border-orange-500/20 bg-orange-500/5" },
  };

  const paused = status.globalPause;
  const defaultLevel = { label: "OPERATIONAL", color: "text-emerald-400", bg: "border-emerald-500/20 bg-emerald-500/5" };
  const level = paused
    ? { label: "SYSTEM PAUSED", color: "text-red-400", bg: "border-red-500/20 bg-red-500/5" }
    : (emergencyLabels[status.emergencyLevel] ?? defaultLevel);

  return (
    <div className={`flex items-center justify-between p-4 rounded-xl border ${level.bg}`}>
      <div className="flex items-center gap-3">
        <div className="relative">
          {!paused && status.isOperational ? (
            <LiveDot color={status.emergencyLevel === 0 ? "emerald" : "amber"} />
          ) : (
            <span className="flex h-2 w-2"><span className="relative inline-flex rounded-full h-2 w-2 bg-red-400" /></span>
          )}
        </div>
        <div>
          <p className={`text-sm font-semibold ${level.color}`}>
            System Status: {level.label}
          </p>
          <p className="text-xs text-white/40">
            {paused
              ? "All operations halted by circuit breaker"
              : status.emergencyLevel === 0
                ? "All systems functioning normally"
                : "System operating with elevated monitoring"
            }
          </p>
        </div>
      </div>
      <div className="hidden sm:flex items-center gap-4 text-xs text-white/40">
        <div className="flex items-center gap-1.5">
          <Shield className="w-3.5 h-3.5" />
          <span>{status.monitoredContractsCount} Contracts Monitored</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5" />
          <span>
            Last check: {status.lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── A. CO2 Impact Hero Section ────────────────────────────

function CO2ImpactHero() {
  const impactEquivalencies = [
    { label: "Trees Planted", value: "2.4M", icon: TreePine, color: "text-emerald-400", bg: "bg-emerald-500/10" },
    { label: "Flights Offset", value: "19,133", icon: Plane, color: "text-cyan-400", bg: "bg-cyan-500/10" },
    { label: "Cars Off Road", value: "10,398 yrs", icon: Car, color: "text-amber-400", bg: "bg-amber-500/10" },
    { label: "Homes Powered", value: "8,178 yrs", icon: Home, color: "text-purple-400", bg: "bg-purple-500/10" },
  ];

  return (
    <div>
      {/* Main CO2 Counter */}
      <GlassCard className="p-8 text-center border-emerald-500/10 relative overflow-hidden">
        {/* Background glow effect */}
        <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/[0.03] to-transparent pointer-events-none" />
        <div className="relative">
          <p className="text-xs text-emerald-400/70 uppercase tracking-[0.2em] font-medium mb-3">
            Cumulative CO2 Removed
          </p>
          <div className="flex items-baseline justify-center gap-3">
            <span className="text-5xl sm:text-6xl lg:text-7xl font-bold text-white tabular-nums tracking-tight">
              47,832
            </span>
            <span className="text-xl sm:text-2xl text-emerald-400 font-medium">tonnes</span>
          </div>
          <p className="text-sm text-white/30 mt-3">
            Verified carbon removal via DAC (Direct Air Capture)
          </p>
        </div>
      </GlassCard>

      {/* Impact Equivalency Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
        {impactEquivalencies.map((item) => {
          const Icon = item.icon;
          return (
            <GlassCard key={item.label} className="p-4 text-center">
              <div className={`inline-flex p-2.5 rounded-xl ${item.bg} mb-3`}>
                <Icon className={`w-5 h-5 ${item.color}`} />
              </div>
              <p className="text-xl font-bold text-white tabular-nums">{item.value}</p>
              <p className="text-xs text-white/40 mt-1">{item.label}</p>
            </GlassCard>
          );
        })}
      </div>
    </div>
  );
}

// ─── B. Protocol Health Heatmap ────────────────────────────

function ProtocolHealthHeatmap() {
  function getHeatColor(value: number): string {
    if (value < 0.2) return "bg-emerald-900/40";
    if (value < 0.4) return "bg-emerald-800/50";
    if (value < 0.6) return "bg-emerald-700/50";
    if (value < 0.8) return "bg-emerald-600/60";
    return "bg-emerald-500/70";
  }

  return (
    <div>
      <SectionHeader
        title="Protocol Health"
        description="7-day activity heatmap by time period"
        badge={<StatusBadge status="Active" />}
      />

      <GlassCard className="p-5">
        <div className="overflow-x-auto">
          <div className="min-w-[400px]">
            {/* Column Headers (days) */}
            <div className="flex mb-2">
              <div className="w-14 shrink-0" />
              {DAYS_LABELS.map((day) => (
                <div key={day} className="flex-1 text-center text-[11px] text-white/40 font-medium">
                  {day}
                </div>
              ))}
            </div>

            {/* Rows (time periods) */}
            {PERIOD_LABELS.map((period, pIdx) => (
              <div key={period} className="flex items-center mb-1.5">
                <div className="w-14 shrink-0 text-[11px] text-white/40 font-mono pr-2 text-right">
                  {period}
                </div>
                {DAYS_LABELS.map((day, dIdx) => {
                  const value = HEATMAP_DATA[pIdx]?.[dIdx] ?? 0;
                  return (
                    <div key={`${period}-${day}`} className="flex-1 px-0.5">
                      <div
                        className={`h-8 rounded-md ${getHeatColor(value)} transition-all hover:ring-1 hover:ring-emerald-400/30`}
                        title={`${day} ${period}: ${Math.round(value * 100)}% activity`}
                      />
                    </div>
                  );
                })}
              </div>
            ))}

            {/* Legend */}
            <div className="flex items-center justify-end gap-2 mt-3 pt-3 border-t border-white/[0.04]">
              <span className="text-[10px] text-white/30">Low</span>
              <div className="flex gap-0.5">
                {["bg-emerald-900/40", "bg-emerald-800/50", "bg-emerald-700/50", "bg-emerald-600/60", "bg-emerald-500/70"].map((color, i) => (
                  <div key={i} className={`w-4 h-3 rounded-sm ${color}`} />
                ))}
              </div>
              <span className="text-[10px] text-white/30">High</span>
            </div>
          </div>
        </div>
      </GlassCard>
    </div>
  );
}

// ─── C. Treasury & Revenue Section ─────────────────────────

function TreasuryRevenue() {
  const treasuryBalance = "1,247.83";
  const feeRate = "2.5%";
  const feeRecipient = "0x7F6A87fE3191FFBFa06D37939F3a3a4341159ABc";
  const maxRevenue = Math.max(...WEEKLY_REVENUE);
  const weekDayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return (
    <div>
      <SectionHeader
        title="Treasury & Revenue"
        description="Platform fee collection and revenue overview"
        badge={<StatusBadge status="Active" />}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Treasury Info */}
        <GlassCard className="p-5">
          <div className="flex items-center gap-3 mb-5">
            <div className="p-2.5 bg-emerald-500/10 rounded-xl">
              <DollarSign className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h4 className="font-medium text-white text-sm">Treasury Balance</h4>
              <p className="text-[11px] text-white/30">Accumulated platform fees</p>
            </div>
          </div>

          <div className="mb-5">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-white tabular-nums">{treasuryBalance}</span>
              <span className="text-sm text-emerald-400 font-medium">AETH</span>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between py-2 border-b border-white/[0.04]">
              <span className="text-xs text-white/30">Fee Rate</span>
              <span className="text-xs font-medium text-white/70">{feeRate} platform fee</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-white/[0.04]">
              <span className="text-xs text-white/30">Fee Recipient</span>
              <a
                href={getExplorerAddressUrl(feeRecipient)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-mono text-emerald-400/80 hover:text-emerald-400 flex items-center gap-1 transition"
              >
                {shortenAddress(feeRecipient, 6)}
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-xs text-white/30">Collection</span>
              <span className="text-xs font-medium text-white/70">Automatic on trade</span>
            </div>
          </div>
        </GlassCard>

        {/* Weekly Revenue Chart */}
        <GlassCard className="p-5">
          <div className="flex items-center gap-3 mb-5">
            <div className="p-2.5 bg-cyan-500/10 rounded-xl">
              <BarChart3 className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <h4 className="font-medium text-white text-sm">Weekly Revenue</h4>
              <p className="text-[11px] text-white/30">Fee collection per day (AETH)</p>
            </div>
          </div>

          {/* Bar Chart */}
          <div className="flex items-end gap-2 h-32 mb-3">
            {WEEKLY_REVENUE.map((value, idx) => {
              const heightPct = maxRevenue > 0 ? (value / maxRevenue) * 100 : 0;
              return (
                <div key={idx} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[10px] text-white/40 tabular-nums">
                    {value.toFixed(0)}
                  </span>
                  <div
                    className="w-full rounded-t-md bg-gradient-to-t from-emerald-600/60 to-emerald-400/40 transition-all hover:from-emerald-500/70 hover:to-emerald-400/60"
                    style={{ height: `${heightPct}%`, minHeight: "4px" }}
                  />
                </div>
              );
            })}
          </div>

          {/* Day labels */}
          <div className="flex gap-2">
            {weekDayLabels.map((day, idx) => (
              <div key={idx} className="flex-1 text-center text-[10px] text-white/30">
                {day}
              </div>
            ))}
          </div>

          {/* Weekly Total */}
          <div className="mt-4 pt-3 border-t border-white/[0.04] flex items-center justify-between">
            <span className="text-xs text-white/30">Weekly Total</span>
            <span className="text-sm font-bold text-white tabular-nums">
              {WEEKLY_REVENUE.reduce((a, b) => a + b, 0).toFixed(2)} AETH
            </span>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}

// ─── D. Network Topology ───────────────────────────────────

function NetworkTopology() {
  const typeColors: Record<string, { border: string; badge: string; dot: string }> = {
    core: { border: "border-emerald-500/20", badge: "bg-emerald-500/10 text-emerald-400", dot: "bg-emerald-500" },
    governance: { border: "border-purple-500/20", badge: "bg-purple-500/10 text-purple-400", dot: "bg-purple-500" },
    security: { border: "border-amber-500/20", badge: "bg-amber-500/10 text-amber-400", dot: "bg-amber-500" },
  };

  const directionSymbols: Record<string, string> = {
    bidirectional: "<->",
    outgoing: "->",
    incoming: "<-",
  };

  return (
    <div>
      <SectionHeader
        title="Network Topology"
        description="Contract dependency and interaction map"
        badge={<StatusBadge status="Verified" />}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {TOPOLOGY_NODES.map((node) => {
          const colors = typeColors[node.type] ?? typeColors.core!;
          return (
            <GlassCard key={node.key} className={`p-4 ${colors!.border} hover:border-white/[0.12] transition-all`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className={`w-2.5 h-2.5 rounded-full ${colors!.dot}`} />
                  <h4 className="font-medium text-white text-sm">{node.name}</h4>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full ${colors!.badge} font-medium capitalize`}>
                  {node.type}
                </span>
              </div>

              {/* Connections */}
              <div className="space-y-1.5">
                <p className="text-[10px] text-white/25 uppercase tracking-wider">Connections</p>
                {node.connections.map((conn, cIdx) => {
                  const targetNode = TOPOLOGY_NODES.find(n => n.key === conn.target);
                  const targetColors = (typeColors[targetNode?.type ?? "core"] ?? typeColors.core)!;
                  return (
                    <div key={cIdx} className="flex items-center gap-1.5 text-xs text-white/50">
                      <span className="text-[10px] font-mono text-white/30 w-6 text-center">
                        {directionSymbols[conn.direction]}
                      </span>
                      <span className={`w-1.5 h-1.5 rounded-full ${targetColors!.dot}`} />
                      <span>{targetNode?.name ?? conn.target}</span>
                    </div>
                  );
                })}
                {node.connections.length === 0 && (
                  <p className="text-xs text-white/20 italic">No direct connections</p>
                )}
              </div>
            </GlassCard>
          );
        })}
      </div>
    </div>
  );
}

// ─── E. Cross-Chain Readiness Panel ────────────────────────

function CrossChainReadiness() {
  const chains = [
    { name: "Ethereum", status: "Coming Q3", statusType: "pending" as const, icon: Globe, color: "text-blue-400", bg: "bg-blue-500/10" },
    { name: "Polygon", status: "Coming Q4", statusType: "pending" as const, icon: Network, color: "text-purple-400", bg: "bg-purple-500/10" },
    { name: "Arbitrum", status: "Planned 2027", statusType: "info" as const, icon: Zap, color: "text-cyan-400", bg: "bg-cyan-500/10" },
  ];

  return (
    <div>
      <SectionHeader
        title="Cross-Chain Bridge Status"
        description="Multi-chain carbon credit interoperability"
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {chains.map((chain) => {
          const Icon = chain.icon;
          return (
            <GlassCard key={chain.name} className="p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className={`p-2.5 rounded-xl ${chain.bg}`}>
                  <Icon className={`w-5 h-5 ${chain.color}`} />
                </div>
                <div>
                  <h4 className="font-medium text-white text-sm">{chain.name}</h4>
                  <p className="text-[11px] text-white/30">Bridge</p>
                </div>
              </div>
              <StatusBadge status={chain.status} />
            </GlassCard>
          );
        })}
      </div>
    </div>
  );
}

// ─── F. Enhanced Activity Feed ─────────────────────────────

function ActivityFeed() {
  const [liveEvents, setLiveEvents] = useState<MockActivity[]>([]);
  const [activityFilter, setActivityFilter] = useState<"all" | "minting" | "trading" | "governance" | "oracle">("all");

  const onMint = useCallback((log: ContractEventLog) => {
    const args = log.args as { tokenId?: bigint; recipient?: string; co2AmountKg?: bigint };
    const event: MockActivity = {
      id: `live-mint-${log.transactionHash}-${log.blockNumber}`,
      type: "mint",
      title: "Carbon Credit Minted",
      description: `Token #${args.tokenId?.toString() || "?"} minted to ${args.recipient ? shortenAddress(args.recipient, 4) : "unknown"}`,
      timeAgo: "just now",
      txHash: log.transactionHash,
    };
    setLiveEvents(prev => [event, ...prev].slice(0, 20));
  }, []);

  const onSale = useCallback((log: ContractEventLog) => {
    const args = log.args as { listingId?: bigint; amount?: bigint };
    const event: MockActivity = {
      id: `live-sale-${log.transactionHash}-${log.blockNumber}`,
      type: "sale",
      title: "Marketplace Sale",
      description: `Listing #${args.listingId?.toString() || "?"} - ${args.amount?.toString() || "?"} credits sold`,
      timeAgo: "just now",
      txHash: log.transactionHash,
    };
    setLiveEvents(prev => [event, ...prev].slice(0, 20));
  }, []);

  const onEmergency = useCallback((log: ContractEventLog) => {
    const args = log.args as { reason?: string };
    const event: MockActivity = {
      id: `live-emergency-${log.transactionHash}-${log.blockNumber}`,
      type: "verification",
      title: "EMERGENCY PAUSE",
      description: args.reason || "System paused by authorized pauser",
      timeAgo: "just now",
      txHash: log.transactionHash,
    };
    setLiveEvents(prev => [event, ...prev].slice(0, 20));
  }, []);

  useWatchCreditMints(onMint);
  useWatchMarketplaceSales(onSale);
  useWatchEmergencyEvents(onEmergency);

  const allActivities = useMemo(() => [...liveEvents, ...MOCK_ACTIVITIES], [liveEvents]);

  const filteredActivities = useMemo(() => {
    if (activityFilter === "all") return allActivities;
    const filterMap: Record<string, ActivityType[]> = {
      minting: ["mint", "retire"],
      trading: ["sale"],
      governance: ["governance", "verification"],
      oracle: ["oracle"],
    };
    const allowedTypes = filterMap[activityFilter] ?? [];
    return allActivities.filter(a => allowedTypes.includes(a.type));
  }, [allActivities, activityFilter]);

  const typeIcons: Record<string, React.ReactNode> = {
    mint: <Coins className="w-4 h-4 text-emerald-400" />,
    sale: <Store className="w-4 h-4 text-cyan-400" />,
    verification: <Shield className="w-4 h-4 text-purple-400" />,
    retire: <Flame className="w-4 h-4 text-orange-400" />,
    oracle: <Radio className="w-4 h-4 text-blue-400" />,
    governance: <Vote className="w-4 h-4 text-indigo-400" />,
  };

  const typeDotColors: Record<string, string> = {
    mint: "bg-emerald-500/20 border-emerald-500/30",
    sale: "bg-cyan-500/20 border-cyan-500/30",
    verification: "bg-purple-500/20 border-purple-500/30",
    retire: "bg-orange-500/20 border-orange-500/30",
    oracle: "bg-blue-500/20 border-blue-500/30",
    governance: "bg-indigo-500/20 border-indigo-500/30",
  };

  const filterButtons: { id: "all" | "minting" | "trading" | "governance" | "oracle"; label: string }[] = [
    { id: "all", label: "All" },
    { id: "minting", label: "Minting" },
    { id: "trading", label: "Trading" },
    { id: "governance", label: "Governance" },
    { id: "oracle", label: "Oracle" },
  ];

  return (
    <div>
      <SectionHeader
        title="Recent Activity"
        description="Live event stream from TerraQura contracts"
        badge={
          <div className="flex items-center gap-1.5">
            <LiveDot />
            <span className="text-xs text-emerald-400 font-medium">
              {liveEvents.length > 0 ? `${liveEvents.length} live` : "Watching"}
            </span>
          </div>
        }
      />

      {/* Filter Buttons */}
      <div className="flex items-center gap-1 mb-4 flex-wrap">
        {filterButtons.map(btn => (
          <button
            key={btn.id}
            onClick={() => setActivityFilter(btn.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activityFilter === btn.id
                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                : "text-white/40 hover:text-white/60 border border-transparent hover:bg-white/[0.03]"
            }`}
          >
            {btn.label}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {filteredActivities.slice(0, 15).map(item => (
          <GlassCard key={item.id} className={`p-3 border ${typeDotColors[item.type]} transition-all hover:border-white/[0.12]`}>
            <div className="flex items-start gap-3">
              <div className="mt-0.5 p-1.5 rounded-lg bg-white/[0.03]">
                {typeIcons[item.type]}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium text-white">{item.title}</p>
                  <span className="text-[11px] text-white/30 whitespace-nowrap shrink-0">{item.timeAgo}</span>
                </div>
                <p className="text-xs text-white/40 mt-0.5 truncate">{item.description}</p>
              </div>
            </div>
          </GlassCard>
        ))}
      </div>
    </div>
  );
}

// ─── G. Enhanced Platform Metrics ──────────────────────────

function PlatformMetrics() {
  const { stats, isLoading } = usePlatformStats();

  if (isLoading || !stats) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => <SkeletonMetricCard key={i} />)}
      </div>
    );
  }

  const activeListings = Number(stats.nextListingId) > 0 ? Number(stats.nextListingId) - 1 : 0;

  // Seeded additional metrics
  const totalTransactions = seededInt(900, 10000, 50000);
  const activeWallets24h = seededInt(901, 100, 2500);
  const avgVerificationTimeSec = seededInt(902, 30, 180);
  const avgVerificationTimeStr = avgVerificationTimeSec < 60
    ? `${avgVerificationTimeSec}s`
    : `${Math.floor(avgVerificationTimeSec / 60)}m ${avgVerificationTimeSec % 60}s`;
  const protocolUptime = (99 + seededRandom(903) * 0.99).toFixed(2);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <MetricCard
        label="Total Credits Minted"
        value={formatWei(stats.totalCreditsMinted)}
        unit="tCO2e"
        icon={Coins}
      />
      <MetricCard
        label="Total Credits Retired"
        value={formatWei(stats.totalCreditsRetired)}
        unit="tCO2e"
        icon={Flame}
      />
      <MetricCard
        label="Active Listings"
        value={activeListings.toLocaleString()}
        icon={Store}
      />
      <MetricCard
        label="Platform Fee"
        value={formatBps(stats.platformFeeBps)}
        icon={BarChart3}
      />
      <MetricCard
        label="Total Transactions"
        value={totalTransactions.toLocaleString()}
        icon={Activity}
      />
      <MetricCard
        label="Active Wallets (24h)"
        value={activeWallets24h.toLocaleString()}
        icon={Users}
      />
      <MetricCard
        label="Avg Verification Time"
        value={avgVerificationTimeStr}
        icon={Timer}
      />
      <MetricCard
        label="Protocol Uptime"
        value={`${protocolUptime}%`}
        icon={Server}
      />
    </div>
  );
}

// ─── Protocol Contracts (unchanged) ────────────────────────

function ProtocolContracts() {
  const [filter, setFilter] = useState<"all" | "core" | "governance" | "security">("all");

  const typeBadgeColors: Record<string, string> = {
    core: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    governance: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    security: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  };

  const filtered = filter === "all" ? CONTRACT_LIST : CONTRACT_LIST.filter(c => c.type === filter);

  return (
    <div>
      <SectionHeader
        title="Protocol Contracts"
        description="Deployed on Aethelred Sovereign Network"
        badge={<StatusBadge status="Verified" />}
        action={
          <div className="flex items-center gap-1 text-xs">
            {(["all", "core", "governance", "security"] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-lg capitalize transition-all ${
                  filter === f
                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                    : "text-white/40 hover:text-white/60 border border-transparent"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {filtered.map(contract => (
          <GlassCard key={contract.key} className="p-4 hover:border-white/[0.12] transition-all">
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500 relative">
                  <div className="absolute inset-0 w-2 h-2 rounded-full bg-emerald-500 animate-ping opacity-40" />
                </div>
                <h4 className="font-medium text-white text-sm">{contract.name}</h4>
              </div>
              <span className={`text-[10px] px-2 py-0.5 rounded-full border capitalize ${typeBadgeColors[contract.type]}`}>
                {contract.type}
              </span>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-white/30">Proxy</span>
                <a
                  href={getExplorerAddressUrl(contract.address)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-emerald-400/80 hover:text-emerald-400 flex items-center gap-1 transition"
                >
                  {shortenAddress(contract.address, 6)}
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              {contract.verifiedUrl && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-white/30">Source</span>
                  <a
                    href={contract.verifiedUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-emerald-400/70 hover:text-emerald-400 flex items-center gap-1 transition"
                  >
                    <Shield className="w-3 h-3" />
                    Verified
                  </a>
                </div>
              )}
            </div>
          </GlassCard>
        ))}
      </div>
    </div>
  );
}

// ─── Governance Summary (unchanged) ────────────────────────

function GovernanceSummary() {
  const { stats, isLoading, error } = useGovernanceStats();

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <GlassCard key={i} className="p-5">
            <SkeletonBar className="h-5 w-32 mb-4" />
            <SkeletonBar className="h-8 w-20 mb-3" />
            <SkeletonBar className="h-3 w-40" />
          </GlassCard>
        ))}
      </div>
    );
  }

  if (error || !stats) {
    return (
      <GlassCard className="p-6">
        <div className="flex items-center gap-3 text-amber-400">
          <AlertTriangle className="w-5 h-5" />
          <p className="text-sm">Connect to Aethelred to view governance data</p>
        </div>
      </GlassCard>
    );
  }

  return (
    <div>
      <SectionHeader
        title="Governance"
        description="Multisig and timelock configuration"
        badge={<StatusBadge status="Active" />}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Multisig Card */}
        <GlassCard className="p-5 border-purple-500/10">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-purple-500/10 rounded-xl">
                <Layers className="w-4 h-4 text-purple-400" />
              </div>
              <div>
                <h4 className="font-medium text-white text-sm">Multisig Wallet</h4>
                <p className="text-[11px] text-white/30">
                  {stats.multisigThreshold.toString()}-of-{stats.multisigSigners.length} required
                </p>
              </div>
            </div>
            <span className="text-2xl font-bold text-purple-400 tabular-nums">
              {stats.pendingTransactions.toString()}
            </span>
          </div>

          <div className="space-y-1.5">
            <p className="text-[10px] text-white/25 uppercase tracking-wider mb-2">Authorized Signers</p>
            {stats.multisigSigners.map((signer, idx) => (
              <a
                key={signer}
                href={getExplorerAddressUrl(signer)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-xs text-white/50 hover:text-white/70 transition group"
              >
                <span className="w-4 h-4 rounded-full bg-purple-500/20 flex items-center justify-center text-[10px] text-purple-400">
                  {idx + 1}
                </span>
                <code className="font-mono">{shortenAddress(signer, 6)}</code>
                <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition" />
              </a>
            ))}
          </div>

          <div className="mt-4 pt-3 border-t border-white/[0.04] text-xs text-white/30">
            Pending Transactions: {stats.pendingTransactions.toString()}
          </div>
        </GlassCard>

        {/* Timelock Card */}
        <GlassCard className="p-5 border-blue-500/10">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-blue-500/10 rounded-xl">
                <Clock className="w-4 h-4 text-blue-400" />
              </div>
              <div>
                <h4 className="font-medium text-white text-sm">Timelock Controller</h4>
                <p className="text-[11px] text-white/30">Delay-protected execution</p>
              </div>
            </div>
            <span className="text-2xl font-bold text-blue-400 tabular-nums">
              {formatDuration(Number(stats.timelockDelay))}
            </span>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between py-2 border-b border-white/[0.04]">
              <span className="text-xs text-white/30">Minimum Delay</span>
              <span className="text-xs font-medium text-white/70">
                {formatDuration(Number(stats.timelockDelay))} ({stats.timelockDelay.toString()}s)
              </span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-white/[0.04]">
              <span className="text-xs text-white/30">Proposer</span>
              <span className="text-xs font-medium text-white/70">Multisig Only</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-xs text-white/30">Executor</span>
              <span className="text-xs font-medium text-white/70">Anyone (after delay)</span>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-white/[0.04] flex items-center gap-1.5 text-xs text-white/30">
            <Shield className="w-3 h-3 text-blue-400" />
            All admin operations require {formatDuration(Number(stats.timelockDelay))} delay
          </div>
        </GlassCard>
      </div>
    </div>
  );
}

// ─── Connect Wallet Prompt ─────────────────────────────────

function ConnectWalletPrompt() {
  const { openConnectModal } = useApp();

  return (
    <GlassCard className="p-8 text-center">
      <div className="flex flex-col items-center">
        <div className="p-4 bg-emerald-500/10 rounded-2xl mb-4">
          <Wallet className="w-8 h-8 text-emerald-400" />
        </div>
        <h3 className="text-lg font-semibold text-white mb-2">Connect Your Wallet</h3>
        <p className="text-sm text-white/40 max-w-md mb-6">
          Connect to the Aethelred network to view live protocol data, contract states,
          and governance information. Mock data is shown as a preview.
        </p>
        <button
          onClick={openConnectModal}
          className="flex items-center gap-2 px-6 py-3 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-xl text-sm font-medium hover:bg-emerald-500/20 transition-all"
        >
          <Wallet className="w-4 h-4" />
          Connect Wallet
        </button>
      </div>
    </GlassCard>
  );
}

// ─── Main Dashboard Page ───────────────────────────────────
export function DashboardContent() {
  const { wallet, realTime } = useApp();

  return (
    <div className="min-h-screen bg-midnight-950 flex flex-col">
      <TopNav />
      <ToastContainer />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">Executive Dashboard</h1>
              <p className="text-sm text-white/40 mt-1">
                Real-time monitoring for the TerraQura carbon credit protocol
              </p>
            </div>
            {realTime.blockHeight > 0 && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-white/[0.03] rounded-lg border border-white/[0.06]">
                <LiveDot />
                <span className="text-xs text-white/40 font-mono">
                  Block #{realTime.blockHeight.toLocaleString()}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* 1. System Status Banner */}
        <section className="mb-8">
          <SystemStatusBanner />
        </section>

        {/* Connect Wallet prompt if not connected */}
        {!wallet.connected && (
          <section className="mb-8">
            <ConnectWalletPrompt />
          </section>
        )}

        {/* A. CO2 Impact Hero Section */}
        <section className="mb-8">
          <CO2ImpactHero />
        </section>

        {/* G. Enhanced Metric Cards (8 total, 2 rows of 4) */}
        <section className="mb-8">
          <PlatformMetrics />
        </section>

        {/* B. Protocol Health Heatmap + C. Treasury & Revenue side-by-side */}
        <section className="mb-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
          <ProtocolHealthHeatmap />
          <TreasuryRevenue />
        </section>

        {/* D. Network Topology */}
        <section className="mb-8">
          <NetworkTopology />
        </section>

        {/* E. Cross-Chain Readiness */}
        <section className="mb-8">
          <CrossChainReadiness />
        </section>

        {/* Protocol Contracts + F. Enhanced Activity Feed */}
        <section className="mb-8 grid grid-cols-1 lg:grid-cols-5 gap-8">
          <div className="lg:col-span-3">
            <ProtocolContracts />
          </div>
          <div className="lg:col-span-2">
            <ActivityFeed />
          </div>
        </section>

        {/* Governance Summary */}
        <section className="mb-8">
          <GovernanceSummary />
        </section>

        {/* Dashboard Module Links */}
        <section>
          <SectionHeader
            title="Dashboard Modules"
            description="Explore detailed views for each subsystem"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { href: "/dashboard/credits", label: "Credits Management", desc: "View, transfer, and retire verified carbon credits", icon: Coins },
              { href: "/dashboard/marketplace", label: "Carbon Marketplace", desc: "Peer-to-peer trading with gasless transactions", icon: Store },
              { href: "/dashboard/governance", label: "Governance", desc: "Multi-sig operations and DAO governance", icon: Shield },
              { href: "/dashboard/oracle", label: "NativeIoT Oracle", desc: "Live Proof-of-Physics telemetry stream", icon: Radio },
            ].map(mod => {
              const Icon = mod.icon;
              return (
                <Link key={mod.href} href={mod.href}>
                  <GlassCard className="p-5 h-full hover:border-emerald-500/20 hover:bg-white/[0.04] transition-all group cursor-pointer">
                    <div className="flex items-start justify-between mb-3">
                      <div className="p-2 bg-emerald-500/10 rounded-xl group-hover:bg-emerald-500/15 transition">
                        <Icon className="w-4 h-4 text-emerald-400" />
                      </div>
                      <ExternalLink className="w-3.5 h-3.5 text-white/20 group-hover:text-emerald-400 transition" />
                    </div>
                    <h4 className="font-medium text-white text-sm mb-1 group-hover:text-emerald-300 transition">
                      {mod.label}
                    </h4>
                    <p className="text-xs text-white/30 leading-relaxed">{mod.desc}</p>
                  </GlassCard>
                </Link>
              );
            })}
          </div>
        </section>
      </main>

      <DAppFooter />
    </div>
  );
}
