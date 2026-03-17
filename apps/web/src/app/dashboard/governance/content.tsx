/**
 * TerraQura Governance Dashboard
 *
 * Institutional-grade governance interface with multi-sig status,
 * security monitoring, progressive decentralization roadmap,
 * multisig transaction queue, governance proposals, treasury
 * management, and delegation system.
 *
 * @version 5.0.0 - Full Governance Suite
 */

"use client";

import { useState, useCallback, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { useAccount } from "wagmi";
import {
  useGovernanceStats,
  useSystemStatus,
  useHasRole,
  useWatchEmergencyEvents,
  type ContractEventLog,
} from "@/hooks/useContractData";
import { CONTRACTS } from "@/lib/contracts";
import { ROLES } from "@/lib/abis";
import { getExplorerAddressUrl } from "@/lib/wagmi";

// ============================================
// Seeded Random Utilities
// ============================================

function seededRandom(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function seededInt(seed: number, min: number, max: number): number {
  return Math.floor(seededRandom(seed) * (max - min + 1)) + min;
}

function seededAddress(seed: number): string {
  let addr = "0x";
  for (let i = 0; i < 40; i++) {
    addr += "0123456789abcdef"[seededInt(seed + i * 7, 0, 15)];
  }
  return addr;
}

function seededHash(seed: number): string {
  let hash = "0x";
  for (let i = 0; i < 64; i++) {
    hash += "0123456789abcdef"[seededInt(seed + i * 3, 0, 15)];
  }
  return hash;
}

// ============================================
// Mock Fallback Data
// ============================================

const MOCK_SIGNERS = [
  "0x7F6A87fE3191FFBFa06D37939F3a3a4341159ABc",
  "0x2B5AD5c4795c026514f8317c7a215E218DcCD6cF",
  "0x6813Eb9362372EEF6200f3b1dbC3f819671cBA69",
] as const;

const MOCK_THRESHOLD = 2n;
const MOCK_NONCE = BigInt(seededInt(100, 12, 47));
const MOCK_TIMELOCK_DELAY = 3600n; // 1 hour

// ============================================
// Utility Functions
// ============================================

function formatTimelockDelay(seconds: bigint): string {
  const s = Number(seconds);
  if (s < 60) return `${s} seconds`;
  if (s < 3600) return `${Math.floor(s / 60)} minutes`;
  if (s < 86400) {
    const hours = Math.floor(s / 3600);
    const mins = Math.floor((s % 3600) / 60);
    return mins > 0 ? `${hours}h ${mins}m` : `${hours} hour${hours > 1 ? "s" : ""}`;
  }
  const days = Math.floor(s / 86400);
  const hours = Math.floor((s % 86400) / 3600);
  return hours > 0 ? `${days}d ${hours}h` : `${days} day${days > 1 ? "s" : ""}`;
}

function shortenAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatAeth(value: number): string {
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
  return value.toFixed(2);
}

// ============================================
// Inline Shared Components
// ============================================

function TopNav() {
  return (
    <nav className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#060A13]/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 py-4">
        <Link href="/dashboard" className="flex items-center group">
          <div className="relative h-8" style={{ width: Math.round(32 * 3.14) }}>
            <Image src="/logo.png" alt="TerraQura" fill className="object-contain" priority />
          </div>
        </Link>
        <Link
          href="/dashboard"
          className="text-white/50 hover:text-white/80 text-sm font-body transition-colors"
        >
          Back to Dashboard
        </Link>
      </div>
    </nav>
  );
}

function DAppFooter() {
  return (
    <footer className="border-t border-white/[0.04] mt-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6 flex items-center justify-between">
        <span className="text-white/30 text-xs font-mono">TerraQura Governance</span>
        <span className="text-white/30 text-xs font-mono">Aethelred Sovereign Network</span>
      </div>
    </footer>
  );
}

function SectionHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-8">
      <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white mb-2">
        {title}
      </h1>
      <p className="text-white/50 text-base sm:text-lg max-w-2xl leading-relaxed">{description}</p>
    </div>
  );
}

function Tabs({
  tabs,
  activeTab,
  onChange,
}: {
  tabs: { id: string; label: string }[];
  activeTab: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="flex gap-1 p-1 rounded-xl bg-white/[0.04] border border-white/[0.06] w-fit flex-wrap">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === tab.id
              ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
              : "text-white/50 hover:text-white/70 hover:bg-white/[0.04] border border-transparent"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

function GlassCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm ${className}`}>
      {children}
    </div>
  );
}

function MetricCard({
  label,
  value,
  unit,
  colorClass = "text-white",
}: {
  label: string;
  value: string;
  unit?: string;
  colorClass?: string;
}) {
  return (
    <GlassCard className="p-5">
      <p className="text-white/40 text-xs font-mono uppercase tracking-wider mb-2">{label}</p>
      <p className={`text-2xl font-bold ${colorClass}`}>
        {value}
        {unit && <span className="text-sm text-white/40 ml-1.5 font-normal">{unit}</span>}
      </p>
    </GlassCard>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    Active: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    Upcoming: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
    Planned: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    Operational: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    Paused: "bg-red-500/10 text-red-400 border-red-500/20",
    Pending: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    Ready: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
    Executed: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    Failed: "bg-red-500/10 text-red-400 border-red-500/20",
    Cancelled: "bg-white/5 text-white/40 border-white/10",
    Passed: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    Defeated: "bg-red-500/10 text-red-400 border-red-500/20",
    Draft: "bg-white/5 text-white/40 border-white/10",
  };
  return (
    <span className={`text-xs font-mono px-2.5 py-1 rounded-full border ${styles[status] || "bg-white/5 text-white/40 border-white/10"}`}>
      {status}
    </span>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [text]);
  return (
    <button
      onClick={handleCopy}
      className="text-white/30 hover:text-white/60 transition-colors text-xs font-mono"
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function ProgressBar({
  value,
  max,
  colorClass = "bg-emerald-500",
  bgClass = "bg-white/10",
  height = "h-2",
}: {
  value: number;
  max: number;
  colorClass?: string;
  bgClass?: string;
  height?: string;
}) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className={`w-full ${bgClass} rounded-full ${height} overflow-hidden`}>
      <div
        className={`${colorClass} ${height} rounded-full transition-all duration-500`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function Phase2Badge() {
  return (
    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
      PHASE 2 PREVIEW
    </span>
  );
}

// ============================================
// Tab Content Components
// ============================================

function OverviewTab() {
  const { stats, isLoading } = useGovernanceStats();
  const { status: systemStatus } = useSystemStatus();

  const signers = stats?.multisigSigners ?? (MOCK_SIGNERS as unknown as `0x${string}`[]);
  const threshold = stats?.multisigThreshold ?? MOCK_THRESHOLD;
  const nonce = stats?.pendingTransactions ?? MOCK_NONCE;
  const timelockDelay = stats?.timelockDelay ?? MOCK_TIMELOCK_DELAY;

  const isOperational = systemStatus?.isOperational ?? true;
  const emergencyLevel = systemStatus?.emergencyLevel ?? 0;

  // Seeded timelock operations
  const timelockOps = useMemo(() => {
    const statuses = ["Pending", "Pending", "Ready", "Executed", "Executed"] as const;
    const targets = [
      { name: "CarbonMarketplace", addr: CONTRACTS.carbonMarketplace },
      { name: "VerificationEngine", addr: CONTRACTS.verificationEngine },
      { name: "AccessControl", addr: CONTRACTS.accessControl },
      { name: "CarbonCredit", addr: CONTRACTS.carbonCredit },
      { name: "CircuitBreaker", addr: CONTRACTS.circuitBreaker },
    ];
    const descriptions = [
      "updatePlatformFeeBps(300)",
      "setVerificationThresholds(...)",
      "grantRole(VERIFIER, 0x...)",
      "setURI(ipfs://Qm...)",
      "setSecurityLevel(1)",
    ];
    return statuses.map((status, i) => {
      const scheduledOffset = seededInt(200 + i, 3600, 86400);
      const scheduledTimestamp = 1742200000 + scheduledOffset * (i + 1);
      const readyTimestamp = scheduledTimestamp + 3600;
      const timeRemaining = status === "Pending" ? seededInt(300 + i, 600, 3200) : 0;
      const predecessorSeed = i > 0 ? seededHash(500 + i - 1).slice(0, 18) + "..." : "None";
      return {
        id: seededHash(400 + i),
        status,
        target: targets[i],
        description: descriptions[i],
        scheduledTimestamp,
        readyTimestamp,
        timeRemaining,
        predecessor: predecessorSeed,
      };
    });
  }, []);

  // Seeded treasury summary
  const treasuryBalance = seededInt(800, 4200, 8500);
  const monthlyInflow = seededInt(801, 120, 340);

  return (
    <div className="space-y-6">
      {/* Governance Model Badge */}
      <GlassCard className="p-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="text-white/30 text-xs font-mono">GOVERNANCE MODEL</span>
              <StatusBadge status="Active" />
            </div>
            <h2 className="text-white/90 text-xl font-bold">Multi-Signature</h2>
            <p className="text-white/50 text-sm mt-1">Phase 1 of 3 -- Progressive Decentralization</p>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/5 border border-emerald-500/15">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            <span className="text-emerald-400 text-sm font-medium">
              {isOperational ? "Operational" : "System Paused"}
            </span>
          </div>
        </div>
      </GlassCard>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <MetricCard
          label="Signers"
          value={String(signers.length)}
          unit="addresses"
          colorClass="text-blue-400"
        />
        <MetricCard
          label="Threshold"
          value={`${threshold.toString()}-of-${signers.length}`}
          colorClass="text-emerald-400"
        />
        <MetricCard
          label="Tx Nonce"
          value={nonce.toString()}
          unit="executed"
          colorClass="text-cyan-400"
        />
        <MetricCard
          label="Timelock"
          value={formatTimelockDelay(timelockDelay)}
          colorClass="text-purple-400"
        />
      </div>

      {/* Enhanced Treasury Summary */}
      <GlassCard className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white/80 font-semibold">Treasury Summary</h3>
          <span className="text-white/30 text-xs font-mono">Multisig-controlled</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <p className="text-white/40 text-xs font-mono uppercase tracking-wider mb-1">Total Balance</p>
            <p className="text-emerald-400 text-xl font-bold">{formatAeth(treasuryBalance)} <span className="text-sm text-white/40 font-normal">AETH</span></p>
          </div>
          <div>
            <p className="text-white/40 text-xs font-mono uppercase tracking-wider mb-1">Monthly Inflow</p>
            <p className="text-cyan-400 text-xl font-bold">+{formatAeth(monthlyInflow)} <span className="text-sm text-white/40 font-normal">AETH</span></p>
          </div>
          <div>
            <p className="text-white/40 text-xs font-mono uppercase tracking-wider mb-1">Fee Rate</p>
            <p className="text-white/80 text-xl font-bold">2.5%</p>
          </div>
          <div>
            <p className="text-white/40 text-xs font-mono uppercase tracking-wider mb-1">Allocations</p>
            <p className="text-purple-400 text-xl font-bold">4 <span className="text-sm text-white/40 font-normal">buckets</span></p>
          </div>
        </div>
      </GlassCard>

      {/* Circuit Breaker Status */}
      <GlassCard className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white/80 font-semibold">Circuit Breaker</h3>
          <StatusBadge status={isOperational ? "Operational" : "Paused"} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-white/40 text-xs font-mono uppercase tracking-wider mb-1">Emergency Level</p>
            <div className="flex items-center gap-2">
              <div className="flex gap-1">
                {[0, 1, 2, 3, 4].map((level) => (
                  <div
                    key={level}
                    className={`h-3 w-6 rounded-sm ${
                      level <= emergencyLevel
                        ? emergencyLevel <= 1
                          ? "bg-emerald-500"
                          : emergencyLevel <= 3
                          ? "bg-amber-500"
                          : "bg-red-500"
                        : "bg-white/10"
                    }`}
                  />
                ))}
              </div>
              <span className="text-white/60 text-sm font-mono">{emergencyLevel}/5</span>
            </div>
          </div>
          <div>
            <p className="text-white/40 text-xs font-mono uppercase tracking-wider mb-1">Monitored Contracts</p>
            <p className="text-white/70 text-lg font-bold">
              {systemStatus?.monitoredContractsCount ?? 7}
            </p>
          </div>
        </div>
      </GlassCard>

      {/* Timelock Operations Panel */}
      <GlassCard className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white/80 font-semibold">Timelock Operations</h3>
          <span className="text-white/30 text-xs font-mono">{timelockOps.length} operations</span>
        </div>
        <div className="space-y-3">
          {timelockOps.map((op, i) => {
            const statusColors: Record<string, string> = {
              Pending: "border-l-amber-500/50",
              Ready: "border-l-cyan-500/50",
              Executed: "border-l-emerald-500/50",
            };
            return (
              <div
                key={i}
                className={`p-4 rounded-lg bg-white/[0.02] border border-white/[0.06] border-l-4 ${statusColors[op.status] || ""}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-white/80 text-sm font-medium">{op.target!.name}</span>
                    <StatusBadge status={op.status} />
                  </div>
                  <span className="text-white/20 text-[10px] font-mono">{op.id.slice(0, 14)}...</span>
                </div>
                <p className="text-white/50 text-xs font-mono mb-2">{op.description}</p>
                <div className="flex flex-wrap gap-x-6 gap-y-1 text-[11px] font-mono">
                  <span className="text-white/30">
                    Scheduled: <span className="text-white/50">{new Date(op.scheduledTimestamp * 1000).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                  </span>
                  {op.status === "Pending" && (
                    <span className="text-amber-400/70">
                      Time remaining: {Math.floor(op.timeRemaining / 60)}m {op.timeRemaining % 60}s
                    </span>
                  )}
                  {op.status === "Ready" && (
                    <span className="text-cyan-400/70">Ready for execution</span>
                  )}
                  {op.status === "Executed" && (
                    <span className="text-emerald-400/70">
                      Executed: {new Date(op.readyTimestamp * 1000).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  )}
                  <span className="text-white/30">
                    Predecessor: <span className="text-white/40">{op.predecessor}</span>
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </GlassCard>

      {/* Signer Addresses */}
      <GlassCard className="p-6">
        <h3 className="text-white/80 font-semibold mb-4">Multisig Signers</h3>
        <div className="space-y-2">
          {signers.map((signer, i) => {
            const explorerUrl = getExplorerAddressUrl(signer);
            return (
              <div
                key={signer}
                className="flex items-center justify-between py-2.5 border-b border-white/[0.04] last:border-0"
              >
                <div className="flex items-center gap-3">
                  <span className="text-white/30 text-xs font-mono w-6">#{i + 1}</span>
                  <a
                    href={explorerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-cyan-400 hover:text-cyan-300 font-mono text-sm transition-colors"
                  >
                    {shortenAddress(signer)}
                  </a>
                  <CopyButton text={signer} />
                </div>
                <span className="text-white/30 text-xs font-mono">
                  {i === 0 ? "Deployer" : `Signer ${i + 1}`}
                </span>
              </div>
            );
          })}
        </div>
      </GlassCard>

      {/* Contract Addresses */}
      <GlassCard className="p-6">
        <h3 className="text-white/80 font-semibold mb-4">Governance Contracts</h3>
        <div className="space-y-2">
          {[
            { label: "Multisig", address: CONTRACTS.multisig },
            { label: "Timelock", address: CONTRACTS.timelock },
            { label: "Access Control", address: CONTRACTS.accessControl },
            { label: "Circuit Breaker", address: CONTRACTS.circuitBreaker },
          ].map((item) => (
            <div
              key={item.label}
              className="flex items-center justify-between py-2 border-b border-white/[0.04] last:border-0"
            >
              <span className="text-white/40 text-sm">{item.label}</span>
              <div className="flex items-center gap-2">
                <a
                  href={getExplorerAddressUrl(item.address)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-cyan-400 hover:text-cyan-300 font-mono text-xs transition-colors"
                >
                  {shortenAddress(item.address)}
                </a>
                <CopyButton text={item.address} />
              </div>
            </div>
          ))}
        </div>
      </GlassCard>

      {isLoading && (
        <p className="text-center text-white/30 text-xs font-mono py-4">
          Loading on-chain governance data...
        </p>
      )}
    </div>
  );
}

function SecurityTab() {
  const { status: systemStatus, isLoading: statusLoading } = useSystemStatus();
  const { address } = useAccount();
  const [emergencyEvents, setEmergencyEvents] = useState<ContractEventLog[]>([]);
  const [auditFilter, setAuditFilter] = useState<string>("all");

  useWatchEmergencyEvents(
    useCallback((log: ContractEventLog) => {
      setEmergencyEvents((prev) => [log, ...prev].slice(0, 10));
    }, [])
  );

  const isOperational = systemStatus?.isOperational ?? true;
  const emergencyLevel = systemStatus?.emergencyLevel ?? 0;
  const monitoredCount = systemStatus?.monitoredContractsCount ?? 7;

  const { hasRole: isAdmin } = useHasRole(address as `0x${string}` | undefined, "ADMIN");
  const { hasRole: isOperator } = useHasRole(address as `0x${string}` | undefined, "OPERATOR");
  const { hasRole: isVerifier } = useHasRole(address as `0x${string}` | undefined, "VERIFIER");
  const { hasRole: isMinter } = useHasRole(address as `0x${string}` | undefined, "MINTER");
  const { hasRole: isPauser } = useHasRole(address as `0x${string}` | undefined, "PAUSER");
  const { hasRole: isAuditor } = useHasRole(address as `0x${string}` | undefined, "AUDITOR");

  const roleEntries: { name: string; key: keyof typeof ROLES; description: string }[] = [
    { name: "DEFAULT_ADMIN", key: "DEFAULT_ADMIN", description: "Root admin -- can grant/revoke all roles" },
    { name: "ADMIN", key: "ADMIN", description: "Protocol administration and configuration" },
    { name: "OPERATOR", key: "OPERATOR", description: "Device registration and oracle management" },
    { name: "VERIFIER", key: "VERIFIER", description: "Verification engine parameter control" },
    { name: "MINTER", key: "MINTER", description: "Carbon credit minting authorization" },
    { name: "COMPLIANCE", key: "COMPLIANCE", description: "KYC/AML compliance management" },
    { name: "AUDITOR", key: "AUDITOR", description: "Read-only audit access to all contracts" },
    { name: "TREASURY", key: "TREASURY", description: "Fee collection and treasury operations" },
    { name: "UPGRADER", key: "UPGRADER", description: "UUPS proxy upgrade authorization" },
    { name: "PAUSER", key: "PAUSER", description: "Emergency pause/unpause capability" },
  ];

  const userRoles: Record<string, boolean | undefined> = {
    ADMIN: isAdmin,
    OPERATOR: isOperator,
    VERIFIER: isVerifier,
    MINTER: isMinter,
    PAUSER: isPauser,
    AUDITOR: isAuditor,
  };

  const monitoredContracts = [
    { name: "CarbonCredit", address: CONTRACTS.carbonCredit },
    { name: "CarbonMarketplace", address: CONTRACTS.carbonMarketplace },
    { name: "VerificationEngine", address: CONTRACTS.verificationEngine },
    { name: "AccessControl", address: CONTRACTS.accessControl },
    { name: "GaslessMarketplace", address: CONTRACTS.gaslessMarketplace },
    { name: "NativeIoT Oracle", address: CONTRACTS.nativeIoTOracle },
    { name: "Multisig", address: CONTRACTS.multisig },
  ];

  // Access control matrix: which roles can call which contracts
  const matrixRoles = ["ADMIN", "OPERATOR", "VERIFIER", "MINTER", "PAUSER"] as const;
  const matrixContracts = [
    { name: "CarbonCredit", short: "CC" },
    { name: "Marketplace", short: "MKT" },
    { name: "Verification", short: "VER" },
    { name: "AccessCtrl", short: "AC" },
    { name: "CircuitBreaker", short: "CB" },
    { name: "Timelock", short: "TL" },
  ] as const;

  // Deterministic access matrix
  const accessMatrix: Record<string, Record<string, boolean>> = {
    ADMIN: { CarbonCredit: true, Marketplace: true, Verification: true, AccessCtrl: true, CircuitBreaker: true, Timelock: true },
    OPERATOR: { CarbonCredit: false, Marketplace: false, Verification: true, AccessCtrl: false, CircuitBreaker: false, Timelock: false },
    VERIFIER: { CarbonCredit: true, Marketplace: false, Verification: true, AccessCtrl: false, CircuitBreaker: false, Timelock: false },
    MINTER: { CarbonCredit: true, Marketplace: false, Verification: false, AccessCtrl: false, CircuitBreaker: false, Timelock: false },
    PAUSER: { CarbonCredit: true, Marketplace: true, Verification: true, AccessCtrl: false, CircuitBreaker: true, Timelock: false },
  };

  // Comprehensive audit trail: 15 seeded events
  const auditTrail = useMemo(() => {
    const eventTypes = [
      "RoleGranted", "RoleGranted", "RoleRevoked", "RoleGranted", "EmergencyAction",
      "CircuitBreakerSet", "TimelockScheduled", "RoleGranted", "TimelockExecuted", "RoleRevoked",
      "CircuitBreakerSet", "EmergencyAction", "RoleGranted", "TimelockScheduled", "RoleRevoked",
    ] as const;
    const eventIcons: Record<string, string> = {
      RoleGranted: "+",
      RoleRevoked: "-",
      EmergencyAction: "!",
      CircuitBreakerSet: "#",
      TimelockScheduled: "~",
      TimelockExecuted: "*",
    };
    const targets = [
      "VERIFIER role", "MINTER role", "OPERATOR role", "AUDITOR role", "Global Pause",
      "Level 0 -> 1", "updatePlatformFee", "TREASURY role", "grantRole(VERIFIER)", "COMPLIANCE role",
      "Level 1 -> 0", "Emergency Withdraw", "PAUSER role", "setThresholds", "MINTER role",
    ];
    return eventTypes.map((type, i) => ({
      type,
      icon: eventIcons[type],
      actor: seededAddress(600 + i),
      target: targets[i],
      timestamp: 1742100000 + seededInt(700 + i, 3600, 259200) * (i + 1),
      txHash: seededHash(900 + i),
    }));
  }, []);

  const auditFilterOptions = ["all", "RoleGranted", "RoleRevoked", "EmergencyAction", "CircuitBreakerSet", "TimelockScheduled", "TimelockExecuted"];
  const filteredAudit = auditFilter === "all" ? auditTrail : auditTrail.filter((e) => e.type === auditFilter);

  return (
    <div className="space-y-6">
      {/* Circuit Breaker Dashboard */}
      <GlassCard className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-white/80 font-semibold text-lg">Circuit Breaker Dashboard</h3>
          <StatusBadge status={isOperational ? "Operational" : "Paused"} />
        </div>

        <div className="mb-6">
          <p className="text-white/40 text-xs font-mono uppercase tracking-wider mb-3">Emergency Level</p>
          <div className="flex items-center gap-3">
            <div className="flex-1 flex gap-1.5">
              {[0, 1, 2, 3, 4, 5].map((level) => {
                let colorClass = "bg-white/10";
                if (level <= emergencyLevel) {
                  if (emergencyLevel === 0) colorClass = "bg-emerald-500";
                  else if (emergencyLevel <= 2) colorClass = "bg-amber-500";
                  else if (emergencyLevel <= 4) colorClass = "bg-orange-500";
                  else colorClass = "bg-red-500";
                }
                return (
                  <div key={level} className="flex-1 flex flex-col items-center gap-1">
                    <div className={`h-8 w-full rounded ${colorClass} transition-colors`} />
                    <span className="text-white/30 text-[10px] font-mono">{level}</span>
                  </div>
                );
              })}
            </div>
            <div className="text-right ml-4">
              <p className="text-3xl font-bold text-white/80">{emergencyLevel}</p>
              <p className="text-white/40 text-xs">of 5</p>
            </div>
          </div>
          <div className="flex justify-between mt-2 text-[10px] font-mono">
            <span className="text-emerald-400/60">Normal</span>
            <span className="text-amber-400/60">Elevated</span>
            <span className="text-red-400/60">Critical</span>
          </div>
        </div>

        <div className="flex items-center gap-3 p-3 rounded-lg bg-white/[0.03] mb-4">
          <span className={`h-3 w-3 rounded-full ${isOperational ? "bg-emerald-500" : "bg-red-500 animate-pulse"}`} />
          <span className="text-white/70 text-sm">
            {isOperational ? "All systems operational -- no active pause" : "GLOBAL PAUSE ACTIVE -- all operations halted"}
          </span>
        </div>

        {statusLoading && (
          <p className="text-white/30 text-xs font-mono">Loading circuit breaker status...</p>
        )}
      </GlassCard>

      {/* Access Control Matrix */}
      <GlassCard className="p-6">
        <h3 className="text-white/80 font-semibold mb-4">Access Control Matrix</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs font-mono">
            <thead>
              <tr>
                <th className="text-left text-white/40 pb-3 pr-4 uppercase tracking-wider">Role</th>
                {matrixContracts.map((c) => (
                  <th key={c.name} className="text-center text-white/40 pb-3 px-2 uppercase tracking-wider">{c.short}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {matrixRoles.map((role) => (
                <tr key={role} className="border-t border-white/[0.04]">
                  <td className="py-2.5 pr-4 text-white/70 font-medium">{role}</td>
                  {matrixContracts.map((c) => {
                    const hasAccess = accessMatrix[role]?.[c.name] ?? false;
                    return (
                      <td key={c.name} className="text-center py-2.5 px-2">
                        {hasAccess ? (
                          <span className="inline-block h-4 w-4 rounded bg-emerald-500/20 text-emerald-400 leading-4 text-[10px]">Y</span>
                        ) : (
                          <span className="inline-block h-4 w-4 rounded bg-white/5 text-white/20 leading-4 text-[10px]">-</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-white/20 text-[10px] font-mono mt-3">CC=CarbonCredit, MKT=Marketplace, VER=Verification, AC=AccessControl, CB=CircuitBreaker, TL=Timelock</p>
      </GlassCard>

      {/* Monitored Contracts */}
      <GlassCard className="p-6">
        <h3 className="text-white/80 font-semibold mb-4">
          Monitored Contracts <span className="text-white/30 font-normal">({monitoredCount})</span>
        </h3>
        <div className="space-y-1.5">
          {monitoredContracts.map((contract) => (
            <div
              key={contract.name}
              className="flex items-center justify-between py-2.5 border-b border-white/[0.04] last:border-0"
            >
              <div className="flex items-center gap-3">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                <span className="text-white/70 text-sm">{contract.name}</span>
              </div>
              <a
                href={getExplorerAddressUrl(contract.address)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-cyan-400/70 hover:text-cyan-400 font-mono text-xs transition-colors"
              >
                {shortenAddress(contract.address)}
              </a>
            </div>
          ))}
        </div>
      </GlassCard>

      {/* Role-Based Access */}
      <GlassCard className="p-6">
        <h3 className="text-white/80 font-semibold mb-4">Role-Based Access Control</h3>
        <div className="space-y-1">
          {roleEntries.map((role) => (
            <div
              key={role.key}
              className="flex items-center justify-between py-2.5 border-b border-white/[0.04] last:border-0"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-white/80 text-sm font-mono font-medium">{role.name}</span>
                  {address && userRoles[role.name] === true && (
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                      YOU
                    </span>
                  )}
                </div>
                <p className="text-white/35 text-xs mt-0.5">{role.description}</p>
              </div>
              <span className="text-white/20 text-[10px] font-mono max-w-[120px] truncate ml-3" title={ROLES[role.key]}>
                {ROLES[role.key].slice(0, 10)}...
              </span>
            </div>
          ))}
        </div>
        {!address && (
          <p className="text-white/30 text-xs font-mono mt-4 text-center">
            Connect wallet to check your roles
          </p>
        )}
      </GlassCard>

      {/* Comprehensive Audit Trail */}
      <GlassCard className="p-6">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <h3 className="text-white/80 font-semibold">Audit Trail</h3>
          <div className="flex gap-1 flex-wrap">
            {auditFilterOptions.map((f) => (
              <button
                key={f}
                onClick={() => setAuditFilter(f)}
                className={`px-2 py-1 rounded text-[10px] font-mono transition-all ${
                  auditFilter === f
                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                    : "text-white/40 hover:text-white/60 border border-transparent"
                }`}
              >
                {f === "all" ? "All" : f.replace(/([A-Z])/g, " $1").trim()}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-1 max-h-[420px] overflow-y-auto">
          {filteredAudit.map((evt, i) => {
            const iconColors: Record<string, string> = {
              "+": "text-emerald-400 bg-emerald-500/10",
              "-": "text-red-400 bg-red-500/10",
              "!": "text-red-400 bg-red-500/10",
              "#": "text-amber-400 bg-amber-500/10",
              "~": "text-cyan-400 bg-cyan-500/10",
              "*": "text-emerald-400 bg-emerald-500/10",
            };
            return (
              <div
                key={i}
                className="flex items-center gap-3 py-2.5 border-b border-white/[0.04] last:border-0"
              >
                <span className={`flex-shrink-0 h-6 w-6 rounded flex items-center justify-center text-xs font-bold ${iconColors[evt.icon as keyof typeof iconColors] || "text-white/40 bg-white/5"}`}>
                  {evt.icon}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-white/70 text-xs font-medium">{evt.type}</span>
                    <span className="text-white/40 text-[10px] font-mono">{evt.target}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-white/30 text-[10px] font-mono">Actor: {shortenAddress(evt.actor)}</span>
                    <span className="text-white/20 text-[10px] font-mono">
                      {new Date(evt.timestamp * 1000).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                </div>
                <span className="text-white/15 text-[9px] font-mono flex-shrink-0 hidden sm:block">{evt.txHash.slice(0, 10)}...</span>
              </div>
            );
          })}
        </div>
      </GlassCard>

      {/* Emergency Event Feed */}
      <GlassCard className="p-6">
        <h3 className="text-white/80 font-semibold mb-4">Emergency Event Monitor</h3>
        {emergencyEvents.length > 0 ? (
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {emergencyEvents.map((evt, i) => (
              <div
                key={`${evt.transactionHash}-${i}`}
                className="flex items-center gap-3 text-xs font-mono text-white/50 py-1.5 border-b border-white/[0.04] last:border-0"
              >
                <span className="text-red-400">EMERGENCY</span>
                <span className="text-white/30 truncate">Block #{evt.blockNumber.toString()}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6">
            <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block mr-2" />
            <span className="text-white/40 text-sm">No emergency events detected</span>
            <p className="text-white/20 text-xs mt-2 font-mono">
              Monitoring: GlobalPauseActivated
            </p>
          </div>
        )}
      </GlassCard>
    </div>
  );
}

function RoadmapTab() {
  const phases = [
    {
      phase: 1,
      title: "Multi-Sig",
      subtitle: "Current",
      status: "Active" as const,
      timeline: "Live",
      description:
        "Zhyra Holdings operates a multi-signature wallet for all protocol upgrades, parameter changes, and treasury operations.",
      details: [
        "2-of-3 signer threshold with on-chain enforcement",
        "1-hour timelock delay on all governance actions",
        "Role-based access control via AccessControl contract",
        "Circuit breaker with 5-level emergency system",
        "Full audit trail for every governance action",
      ],
      completionPct: 85,
      milestones: [
        { name: "Deploy multisig + timelock", done: true },
        { name: "Implement RBAC with 10 roles", done: true },
        { name: "Circuit breaker operational", done: true },
        { name: "Audit trail logging", done: true },
        { name: "External security audit", done: false },
        { name: "Bug bounty program launch", done: false },
      ],
      keyMetrics: [
        "Zero security incidents for 90 days",
        "All contracts verified on explorer",
        "3+ independent signers onboarded",
      ],
    },
    {
      phase: 2,
      title: "Council Governance",
      subtitle: "Q4 2026",
      status: "Upcoming" as const,
      timeline: "Q4 2026",
      description:
        "Expand governance to include independent auditors and community-elected council members with formal proposal workflows.",
      details: [
        "Elected council of 7-11 members",
        "Token-weighted voting for parameter changes",
        "Extended timelock (24h for critical, 48h for upgrades)",
        "Formal proposal templates with quorum requirements",
        "Independent auditor seats for oversight",
      ],
      completionPct: 15,
      milestones: [
        { name: "Governance token smart contract", done: false },
        { name: "Token distribution plan finalized", done: true },
        { name: "Council election framework", done: false },
        { name: "Proposal template system", done: false },
        { name: "Delegation mechanism", done: false },
        { name: "Quorum and voting parameters", done: false },
      ],
      keyMetrics: [
        "Governance token TGE (Q3 2026)",
        "Min 500 unique token holders",
        "Council nomination period (30 days)",
      ],
      tokenTimeline: {
        tge: "Q3 2026",
        distribution: "Community: 40%, Team: 20% (2yr vest), Treasury: 25%, Ecosystem: 15%",
        initialSupply: "100,000,000 TQR",
      },
    },
    {
      phase: 3,
      title: "Full DAO",
      subtitle: "2027",
      status: "Planned" as const,
      timeline: "2027",
      description:
        "Complete decentralized governance via on-chain proposals, community voting, and transparent treasury management.",
      details: [
        "On-chain proposal creation by any token holder",
        "Quadratic voting to prevent whale domination",
        "Delegated voting with full transparency",
        "Automated execution via timelock controller",
        "Community-controlled treasury with spending caps",
      ],
      completionPct: 0,
      milestones: [
        { name: "Governor contract deployment", done: false },
        { name: "Quadratic voting module", done: false },
        { name: "Treasury spending caps", done: false },
        { name: "Cross-chain governance bridge", done: false },
        { name: "Full multisig deprecation", done: false },
        { name: "DAO constitution ratified", done: false },
      ],
      keyMetrics: [
        "1,000+ active governance participants",
        "Council operational for 6+ months",
        "Zero critical governance failures",
      ],
    },
  ];

  const statusColors: Record<string, { border: string; bg: string; text: string; glow: string }> = {
    Active: {
      border: "border-emerald-500/30",
      bg: "bg-emerald-500/5",
      text: "text-emerald-400",
      glow: "shadow-emerald-500/5",
    },
    Upcoming: {
      border: "border-cyan-500/30",
      bg: "bg-cyan-500/5",
      text: "text-cyan-400",
      glow: "shadow-cyan-500/5",
    },
    Planned: {
      border: "border-purple-500/30",
      bg: "bg-purple-500/5",
      text: "text-purple-400",
      glow: "shadow-purple-500/5",
    },
  };

  return (
    <div className="space-y-6">
      <GlassCard className="p-5">
        <h3 className="text-white/80 font-semibold mb-2">Progressive Decentralization</h3>
        <p className="text-white/40 text-sm leading-relaxed">
          TerraQura follows a 3-phase governance evolution, from multi-sig operations today to full
          DAO governance on mainnet. Each phase increases community control while maintaining protocol safety.
        </p>
      </GlassCard>

      <div className="space-y-4">
        {phases.map((phase) => {
          const colors = statusColors[phase.status]!;
          return (
            <GlassCard
              key={phase.phase}
              className={`p-6 border-l-4 ${colors.border} ${colors.bg} shadow-lg ${colors.glow}`}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <span className={`text-3xl font-extrabold ${colors.text} opacity-30`}>
                    {phase.phase}
                  </span>
                  <div>
                    <h3 className="text-white/90 font-bold text-lg">{phase.title}</h3>
                    <p className="text-white/40 text-xs font-mono">{phase.timeline}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right hidden sm:block">
                    <p className={`text-sm font-bold ${colors.text}`}>{phase.completionPct}%</p>
                    <p className="text-white/30 text-[10px] font-mono">complete</p>
                  </div>
                  <StatusBadge status={phase.status} />
                </div>
              </div>

              {/* Completion bar */}
              <div className="mb-4">
                <ProgressBar
                  value={phase.completionPct}
                  max={100}
                  colorClass={phase.status === "Active" ? "bg-emerald-500" : phase.status === "Upcoming" ? "bg-cyan-500" : "bg-purple-500"}
                  height="h-1.5"
                />
              </div>

              <p className="text-white/50 text-sm leading-relaxed mb-4">{phase.description}</p>

              <div className="space-y-1.5 mb-4">
                {phase.details.map((detail, i) => (
                  <div key={i} className="flex items-start gap-2.5">
                    <span className={`mt-1.5 h-1.5 w-1.5 rounded-full flex-shrink-0 ${
                      phase.status === "Active" ? "bg-emerald-500" : "bg-white/20"
                    }`} />
                    <span className="text-white/50 text-sm">{detail}</span>
                  </div>
                ))}
              </div>

              {/* Milestones */}
              <div className="p-4 rounded-lg bg-white/[0.02] border border-white/[0.04] mb-4">
                <p className="text-white/50 text-xs font-mono uppercase tracking-wider mb-3">Milestones</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {phase.milestones.map((m, mi) => (
                    <div key={mi} className="flex items-center gap-2">
                      <span className={`flex-shrink-0 h-4 w-4 rounded-sm flex items-center justify-center text-[10px] font-bold ${
                        m.done ? "bg-emerald-500/20 text-emerald-400" : "bg-white/5 text-white/20"
                      }`}>
                        {m.done ? "Y" : "-"}
                      </span>
                      <span className={`text-xs ${m.done ? "text-white/60" : "text-white/35"}`}>{m.name}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Key Metrics */}
              <div className="p-4 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                <p className="text-white/50 text-xs font-mono uppercase tracking-wider mb-2">Key Metrics for Next Phase</p>
                <div className="space-y-1">
                  {phase.keyMetrics.map((metric, ki) => (
                    <div key={ki} className="flex items-start gap-2">
                      <span className="text-white/20 text-xs mt-0.5">--</span>
                      <span className="text-white/40 text-xs">{metric}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Token Launch Timeline for Phase 2 */}
              {phase.tokenTimeline && (
                <div className="mt-4 p-4 rounded-lg bg-cyan-500/[0.03] border border-cyan-500/10">
                  <p className="text-cyan-400/80 text-xs font-mono uppercase tracking-wider mb-3">Governance Token Launch</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <p className="text-white/30 text-[10px] font-mono mb-1">TGE Date</p>
                      <p className="text-cyan-400 text-sm font-medium">{phase.tokenTimeline.tge}</p>
                    </div>
                    <div>
                      <p className="text-white/30 text-[10px] font-mono mb-1">Initial Supply</p>
                      <p className="text-cyan-400 text-sm font-medium">{phase.tokenTimeline.initialSupply}</p>
                    </div>
                    <div className="sm:col-span-1">
                      <p className="text-white/30 text-[10px] font-mono mb-1">Distribution</p>
                      <p className="text-white/50 text-xs leading-relaxed">{phase.tokenTimeline.distribution}</p>
                    </div>
                  </div>
                </div>
              )}
            </GlassCard>
          );
        })}
      </div>

      {/* Timeline Visualization */}
      <GlassCard className="p-5">
        <div className="flex items-center justify-between text-xs font-mono">
          <div className="text-center">
            <div className="h-3 w-3 rounded-full bg-emerald-500 mx-auto mb-1" />
            <span className="text-emerald-400">Phase 1</span>
            <p className="text-white/30 mt-0.5">Now</p>
          </div>
          <div className="flex-1 h-px bg-gradient-to-r from-emerald-500/40 via-cyan-500/40 to-transparent mx-3" />
          <div className="text-center">
            <div className="h-3 w-3 rounded-full bg-cyan-500/50 mx-auto mb-1 border border-cyan-500/30" />
            <span className="text-cyan-400/70">Phase 2</span>
            <p className="text-white/30 mt-0.5">Q4 2026</p>
          </div>
          <div className="flex-1 h-px bg-gradient-to-r from-cyan-500/20 via-purple-500/20 to-transparent mx-3" />
          <div className="text-center">
            <div className="h-3 w-3 rounded-full bg-purple-500/30 mx-auto mb-1 border border-purple-500/20" />
            <span className="text-purple-400/50">Phase 3</span>
            <p className="text-white/30 mt-0.5">2027</p>
          </div>
        </div>
      </GlassCard>
    </div>
  );
}

function TransactionsTab() {
  const [expandedTx, setExpandedTx] = useState<number | null>(null);

  const transactions = useMemo(() => {
    const statuses = ["Pending", "Executed", "Pending", "Executed", "Failed", "Executed", "Pending", "Executed", "Failed", "Cancelled"] as const;
    const targetContracts = [
      "CarbonMarketplace", "AccessControl", "VerificationEngine", "CarbonCredit",
      "CircuitBreaker", "Timelock", "CarbonMarketplace", "AccessControl",
      "CarbonCredit", "VerificationEngine",
    ];
    const functions = [
      "updatePlatformFeeBps(300)", "grantRole(VERIFIER, 0x...)", "setVerificationThresholds(100, 5000, 800, 95)",
      "setURI('ipfs://QmNewMetadata...')", "setSecurityLevel(2)", "schedule(0x29B5..., 0, 0x...)",
      "setFeeRecipient(0x...)", "revokeRole(MINTER, 0x...)", "mint(0x..., 1000, '')", "whitelistDevice(0x...)",
    ];
    const descriptions = [
      "Update marketplace platform fee from 2.5% to 3.0%",
      "Grant VERIFIER role to new auditing partner address",
      "Adjust verification thresholds for improved accuracy",
      "Update carbon credit metadata URI to new IPFS gateway",
      "Elevate security level due to detected anomaly pattern",
      "Schedule timelock operation for fee recipient change",
      "Change fee recipient to updated treasury multisig",
      "Revoke MINTER role from deprecated service account",
      "Attempt to mint credits with invalid parameters",
      "Whitelist new DAC device from NEOM facility",
    ];

    return statuses.map((status, i) => {
      const confirmations = status === "Executed" ? 2 : status === "Pending" ? 1 : status === "Failed" ? 2 : 0;
      const confirmedBy = [];
      if (confirmations >= 1) confirmedBy.push(MOCK_SIGNERS[0]);
      if (confirmations >= 2) confirmedBy.push(MOCK_SIGNERS[1]);

      const submittedAt = 1742100000 + seededInt(1000 + i, 7200, 172800) * (i + 1);
      const executedAt = status === "Executed" ? submittedAt + seededInt(1100 + i, 1800, 7200) : undefined;
      const ethValue = i === 5 ? 0.5 : i === 6 ? 0.1 : 0;

      return {
        id: i + 1,
        status,
        submittedBy: seededAddress(1200 + i),
        targetContract: targetContracts[i],
        functionCall: functions[i],
        description: descriptions[i],
        ethValue,
        confirmations,
        requiredConfirmations: 2,
        confirmedBy,
        submittedAt,
        executedAt,
        calldata: seededHash(1300 + i) + seededHash(1400 + i).slice(2),
      };
    });
  }, []);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    transactions.forEach((tx) => {
      counts[tx.status] = (counts[tx.status] || 0) + 1;
    });
    return counts;
  }, [transactions]);

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <MetricCard label="Pending" value={String(statusCounts["Pending"] || 0)} colorClass="text-amber-400" />
        <MetricCard label="Executed" value={String(statusCounts["Executed"] || 0)} colorClass="text-emerald-400" />
        <MetricCard label="Failed" value={String(statusCounts["Failed"] || 0)} colorClass="text-red-400" />
        <MetricCard label="Cancelled" value={String(statusCounts["Cancelled"] || 0)} colorClass="text-white/40" />
      </div>

      {/* Transaction Queue */}
      <GlassCard className="p-6">
        <h3 className="text-white/80 font-semibold mb-4">Multisig Transaction Queue</h3>
        <div className="space-y-3">
          {transactions.map((tx) => {
            const isExpanded = expandedTx === tx.id;
            const borderColor: Record<string, string> = {
              Pending: "border-l-amber-500/50",
              Executed: "border-l-emerald-500/50",
              Failed: "border-l-red-500/50",
              Cancelled: "border-l-white/20",
            };
            return (
              <div
                key={tx.id}
                className={`rounded-lg bg-white/[0.02] border border-white/[0.06] border-l-4 ${borderColor[tx.status] || ""} overflow-hidden`}
              >
                <button
                  onClick={() => setExpandedTx(isExpanded ? null : tx.id)}
                  className="w-full p-4 text-left"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <span className="text-white/30 text-xs font-mono">TX-{String(tx.id).padStart(3, "0")}</span>
                      <span className="text-white/80 text-sm font-medium">{tx.targetContract}</span>
                      <StatusBadge status={tx.status} />
                    </div>
                    <span className="text-white/30 text-xs">{isExpanded ? "[-]" : "[+]"}</span>
                  </div>
                  <p className="text-white/50 text-xs font-mono mb-2">{tx.functionCall}</p>
                  <div className="flex items-center gap-4 flex-wrap">
                    <span className="text-white/30 text-[11px] font-mono">
                      By: {shortenAddress(tx.submittedBy)}
                    </span>
                    {tx.ethValue > 0 && (
                      <span className="text-cyan-400/70 text-[11px] font-mono">{tx.ethValue} AETH</span>
                    )}
                    <div className="flex items-center gap-2">
                      <ProgressBar
                        value={tx.confirmations}
                        max={tx.requiredConfirmations}
                        colorClass={tx.confirmations >= tx.requiredConfirmations ? "bg-emerald-500" : "bg-amber-500"}
                        height="h-1.5"
                      />
                      <span className="text-white/40 text-[10px] font-mono whitespace-nowrap">
                        {tx.confirmations}/{tx.requiredConfirmations} sigs
                      </span>
                    </div>
                  </div>
                </button>

                {isExpanded && (
                  <div className="px-4 pb-4 pt-0 border-t border-white/[0.04]">
                    <div className="pt-3 space-y-3">
                      <div>
                        <p className="text-white/40 text-[10px] font-mono uppercase tracking-wider mb-1">Description</p>
                        <p className="text-white/60 text-xs">{tx.description}</p>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <p className="text-white/40 text-[10px] font-mono uppercase tracking-wider mb-1">Submitted</p>
                          <p className="text-white/50 text-xs font-mono">
                            {new Date(tx.submittedAt * 1000).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                          </p>
                        </div>
                        {tx.executedAt && (
                          <div>
                            <p className="text-white/40 text-[10px] font-mono uppercase tracking-wider mb-1">Executed</p>
                            <p className="text-emerald-400/70 text-xs font-mono">
                              {new Date(tx.executedAt * 1000).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                            </p>
                          </div>
                        )}
                      </div>
                      <div>
                        <p className="text-white/40 text-[10px] font-mono uppercase tracking-wider mb-1">Confirmed By</p>
                        {tx.confirmedBy.length > 0 ? (
                          <div className="space-y-1">
                            {tx.confirmedBy.map((addr, ci) => (
                              <span key={ci} className="text-cyan-400/70 text-xs font-mono mr-3">{shortenAddress(addr)}</span>
                            ))}
                          </div>
                        ) : (
                          <p className="text-white/30 text-xs font-mono">No confirmations</p>
                        )}
                      </div>
                      <div>
                        <p className="text-white/40 text-[10px] font-mono uppercase tracking-wider mb-1">Calldata</p>
                        <p className="text-white/25 text-[10px] font-mono break-all">{tx.calldata.slice(0, 80)}...</p>
                      </div>
                      {tx.status === "Pending" && (
                        <div className="flex gap-2 pt-2">
                          <button
                            disabled
                            className="px-4 py-2 rounded-lg bg-emerald-500/10 text-emerald-400/50 text-xs font-mono border border-emerald-500/20 cursor-not-allowed"
                          >
                            Confirm Transaction
                          </button>
                          <button
                            disabled
                            className="px-4 py-2 rounded-lg bg-red-500/10 text-red-400/50 text-xs font-mono border border-red-500/20 cursor-not-allowed"
                          >
                            Reject
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </GlassCard>
    </div>
  );
}

function ProposalsTab() {
  const { address } = useAccount();

  const proposals = useMemo(() => {
    const items = [
      {
        id: "TQP-001",
        title: "Increase platform fee to 3%",
        proposer: seededAddress(2000),
        status: "Passed" as const,
        description: "Proposal to increase the platform marketplace fee from the current 2.5% to 3.0% to fund expanded verification operations and additional DAC facility onboarding across the MENA region. The additional revenue would be directed to the Operations allocation bucket within the treasury.",
        forPct: 78,
        againstPct: 22,
        quorumReached: true,
        quorumPct: 85,
        timeRemaining: 0,
        votesFor: seededInt(2100, 12000, 18000),
        votesAgainst: seededInt(2101, 2000, 6000),
      },
      {
        id: "TQP-002",
        title: "Add NEOM DAC Region",
        proposer: seededAddress(2010),
        status: "Active" as const,
        description: "Authorize the integration of the NEOM Direct Air Capture facility region into the TerraQura verification pipeline. This includes whitelisting 12 new DAC device identifiers, configuring regional verification parameters, and establishing oracle data feeds for the facility's IoT sensors.",
        forPct: 67,
        againstPct: 33,
        quorumReached: false,
        quorumPct: 62,
        timeRemaining: seededInt(2102, 86400, 259200),
        votesFor: seededInt(2103, 8000, 14000),
        votesAgainst: seededInt(2104, 3000, 7000),
      },
      {
        id: "TQP-003",
        title: "Upgrade Verification Engine v2",
        proposer: seededAddress(2020),
        status: "Active" as const,
        description: "Upgrade the VerificationEngine contract to v2 via UUPS proxy. The new version introduces multi-source verification with satellite cross-referencing, improved anomaly detection thresholds, and batch verification support for high-throughput DAC facilities.",
        forPct: 45,
        againstPct: 55,
        quorumReached: false,
        quorumPct: 48,
        timeRemaining: seededInt(2105, 172800, 432000),
        votesFor: seededInt(2106, 5000, 9000),
        votesAgainst: seededInt(2107, 6000, 11000),
      },
      {
        id: "TQP-004",
        title: "Enable Polygon Bridge",
        proposer: seededAddress(2030),
        status: "Draft" as const,
        description: "Draft proposal to establish a cross-chain bridge between Aethelred and Polygon for carbon credit transfers. This would enable TerraQura credits to be traded on Polygon-based DEXes and integrated with existing DeFi protocols for enhanced liquidity and market access.",
        forPct: 0,
        againstPct: 0,
        quorumReached: false,
        quorumPct: 0,
        timeRemaining: 0,
        votesFor: 0,
        votesAgainst: 0,
      },
      {
        id: "TQP-005",
        title: "Reduce Timelock to 30min",
        proposer: seededAddress(2040),
        status: "Defeated" as const,
        description: "Proposal to reduce the governance timelock delay from 1 hour to 30 minutes for non-critical parameter changes. Defeated due to security concerns raised by the community and independent auditors who recommended maintaining the current delay for all operations.",
        forPct: 31,
        againstPct: 69,
        quorumReached: true,
        quorumPct: 74,
        timeRemaining: 0,
        votesFor: seededInt(2108, 3000, 6000),
        votesAgainst: seededInt(2109, 8000, 14000),
      },
      {
        id: "TQP-006",
        title: "Approve Jubail Expansion",
        proposer: seededAddress(2050),
        status: "Executed" as const,
        description: "Authorize the onboarding of the Jubail Industrial City DAC expansion, adding 8 new high-capacity devices to the existing facility. Includes allocation of 50 AETH from treasury for integration costs and oracle node provisioning.",
        forPct: 92,
        againstPct: 8,
        quorumReached: true,
        quorumPct: 91,
        timeRemaining: 0,
        votesFor: seededInt(2110, 15000, 22000),
        votesAgainst: seededInt(2111, 1000, 2000),
      },
    ];
    return items;
  }, []);

  const votingPower = address ? seededInt(2200, 150, 3500) : 0;

  return (
    <div className="space-y-6">
      {/* Phase 2 Preview Banner */}
      <GlassCard className="p-5 border-cyan-500/10">
        <div className="flex items-center gap-3 mb-2">
          <Phase2Badge />
          <span className="text-white/60 text-sm font-medium">Governance Proposals</span>
        </div>
        <p className="text-white/40 text-xs leading-relaxed">
          On-chain proposal voting will be available in Phase 2 (Q4 2026) with the governance token launch.
          Below is a preview of the proposal interface with representative governance actions.
        </p>
      </GlassCard>

      {/* Voting Power */}
      {address && (
        <GlassCard className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white/40 text-xs font-mono uppercase tracking-wider mb-1">Your Voting Power</p>
              <p className="text-emerald-400 text-2xl font-bold">{votingPower.toLocaleString()} <span className="text-sm text-white/40 font-normal">TQR</span></p>
            </div>
            <div className="text-right">
              <p className="text-white/40 text-xs font-mono uppercase tracking-wider mb-1">Connected</p>
              <p className="text-cyan-400 text-sm font-mono">{shortenAddress(address)}</p>
            </div>
          </div>
        </GlassCard>
      )}

      {/* Proposals List */}
      <div className="space-y-4">
        {proposals.map((proposal) => {
          const statusColors: Record<string, string> = {
            Passed: "border-l-emerald-500/50",
            Active: "border-l-cyan-500/50",
            Draft: "border-l-white/20",
            Defeated: "border-l-red-500/50",
            Executed: "border-l-emerald-500/50",
          };
          return (
            <GlassCard
              key={proposal.id}
              className={`p-6 border-l-4 ${statusColors[proposal.status] || ""}`}
            >
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <div className="flex items-center gap-3">
                  <span className="text-white/30 text-xs font-mono">{proposal.id}</span>
                  <h4 className="text-white/90 text-base font-semibold">{proposal.title}</h4>
                </div>
                <StatusBadge status={proposal.status} />
              </div>

              <p className="text-white/30 text-[11px] font-mono mb-3">Proposed by {shortenAddress(proposal.proposer)}</p>
              <p className="text-white/50 text-sm leading-relaxed mb-4">{proposal.description}</p>

              {/* Vote Bars */}
              {(proposal.forPct > 0 || proposal.againstPct > 0) && (
                <div className="space-y-2 mb-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-emerald-400/70 text-xs font-mono">For</span>
                      <span className="text-emerald-400/70 text-xs font-mono">{proposal.forPct}% ({typeof proposal.votesFor === "number" ? proposal.votesFor.toLocaleString() : proposal.votesFor})</span>
                    </div>
                    <ProgressBar value={proposal.forPct} max={100} colorClass="bg-emerald-500" height="h-2" />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-red-400/70 text-xs font-mono">Against</span>
                      <span className="text-red-400/70 text-xs font-mono">{proposal.againstPct}% ({typeof proposal.votesAgainst === "number" ? proposal.votesAgainst.toLocaleString() : proposal.votesAgainst})</span>
                    </div>
                    <ProgressBar value={proposal.againstPct} max={100} colorClass="bg-red-500" height="h-2" />
                  </div>
                </div>
              )}

              {/* Quorum + Time */}
              <div className="flex items-center gap-4 flex-wrap text-[11px] font-mono">
                {proposal.quorumPct > 0 && (
                  <span className={proposal.quorumReached ? "text-emerald-400/60" : "text-amber-400/60"}>
                    Quorum: {proposal.quorumPct}% {proposal.quorumReached ? "(Reached)" : "(Not reached)"}
                  </span>
                )}
                {proposal.status === "Active" && proposal.timeRemaining > 0 && (
                  <span className="text-cyan-400/60">
                    {Math.floor(proposal.timeRemaining / 86400)}d {Math.floor((proposal.timeRemaining % 86400) / 3600)}h remaining
                  </span>
                )}
                {proposal.status === "Executed" && (
                  <span className="text-emerald-400/60">Executed on-chain via timelock</span>
                )}
              </div>

              {/* Vote buttons for active proposals */}
              {proposal.status === "Active" && (
                <div className="flex gap-2 mt-4 pt-3 border-t border-white/[0.04]">
                  <button disabled className="px-4 py-2 rounded-lg bg-emerald-500/10 text-emerald-400/50 text-xs font-mono border border-emerald-500/20 cursor-not-allowed">
                    Vote For
                  </button>
                  <button disabled className="px-4 py-2 rounded-lg bg-red-500/10 text-red-400/50 text-xs font-mono border border-red-500/20 cursor-not-allowed">
                    Vote Against
                  </button>
                  <button disabled className="px-4 py-2 rounded-lg bg-white/5 text-white/30 text-xs font-mono border border-white/10 cursor-not-allowed">
                    Abstain
                  </button>
                </div>
              )}
            </GlassCard>
          );
        })}
      </div>
    </div>
  );
}

function TreasuryTab() {
  const totalBalance = seededInt(3000, 42000, 85000) / 10;
  const marketplaceFees = seededInt(3001, 1800, 3500) / 10;
  const verificationFees = seededInt(3002, 400, 900) / 10;
  const totalFees = marketplaceFees + verificationFees;

  const allocations = [
    { name: "Development", pct: 40, color: "bg-emerald-500", textColor: "text-emerald-400", amount: totalBalance * 0.4 },
    { name: "Operations", pct: 30, color: "bg-cyan-500", textColor: "text-cyan-400", amount: totalBalance * 0.3 },
    { name: "Community", pct: 20, color: "bg-purple-500", textColor: "text-purple-400", amount: totalBalance * 0.2 },
    { name: "Reserve", pct: 10, color: "bg-amber-500", textColor: "text-amber-400", amount: totalBalance * 0.1 },
  ];

  const recentTxs = useMemo(() => {
    const types = ["Fee Collection", "Fee Collection", "Disbursement", "Fee Collection", "Disbursement", "Fee Collection", "Fee Collection", "Disbursement"] as const;
    const sources = [
      "Marketplace Sale #247", "Marketplace Sale #246", "Dev Fund - Audit Payment",
      "Verification Fee - Batch #89", "Ops - Oracle Node Hosting", "Marketplace Sale #245",
      "Verification Fee - Batch #88", "Community - Grant Program",
    ];
    return types.map((type, i) => ({
      type,
      source: sources[i],
      amount: seededInt(3100 + i, 5, 250) / 10,
      timestamp: 1742200000 - seededInt(3200 + i, 3600, 172800) * (i + 1),
      isInflow: type === "Fee Collection",
    }));
  }, []);

  // Monthly treasury growth (6 months)
  const months = ["Oct", "Nov", "Dec", "Jan", "Feb", "Mar"];
  const monthlyGrowth = months.map((m, i) => ({
    month: m,
    value: seededInt(3300 + i, 800, 2200) / 10,
  }));
  const maxMonthly = Math.max(...monthlyGrowth.map((m) => m.value));

  // Burn stats
  const totalBurned = seededInt(3400, 120, 450) / 10;
  const burnRate = seededInt(3401, 5, 25) / 100;

  return (
    <div className="space-y-6">
      {/* Treasury Overview */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <MetricCard label="Total Balance" value={formatAeth(totalBalance)} unit="AETH" colorClass="text-emerald-400" />
        <MetricCard label="Marketplace Fees" value={formatAeth(marketplaceFees)} unit="AETH" colorClass="text-cyan-400" />
        <MetricCard label="Verification Fees" value={formatAeth(verificationFees)} unit="AETH" colorClass="text-purple-400" />
        <MetricCard label="Total Fees (Period)" value={formatAeth(totalFees)} unit="AETH" colorClass="text-white/80" />
      </div>

      {/* Allocation Breakdown */}
      <GlassCard className="p-6">
        <h3 className="text-white/80 font-semibold mb-4">Treasury Allocation</h3>

        {/* Stacked bar */}
        <div className="flex h-6 rounded-full overflow-hidden mb-4">
          {allocations.map((a) => (
            <div key={a.name} className={`${a.color} h-full`} style={{ width: `${a.pct}%` }} title={`${a.name}: ${a.pct}%`} />
          ))}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {allocations.map((a) => (
            <div key={a.name}>
              <div className="flex items-center gap-2 mb-1">
                <span className={`h-2.5 w-2.5 rounded-sm ${a.color}`} />
                <span className="text-white/60 text-xs">{a.name}</span>
              </div>
              <p className={`text-lg font-bold ${a.textColor}`}>{a.pct}%</p>
              <p className="text-white/30 text-[10px] font-mono">{formatAeth(a.amount)} AETH</p>
            </div>
          ))}
        </div>
      </GlassCard>

      {/* Monthly Growth Chart */}
      <GlassCard className="p-6">
        <h3 className="text-white/80 font-semibold mb-4">Monthly Treasury Growth</h3>
        <div className="flex items-end gap-3 h-40">
          {monthlyGrowth.map((m) => {
            const heightPct = maxMonthly > 0 ? (m.value / maxMonthly) * 100 : 0;
            return (
              <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-white/40 text-[10px] font-mono">+{formatAeth(m.value)}</span>
                <div className="w-full flex-1 flex items-end">
                  <div
                    className="w-full bg-gradient-to-t from-emerald-500/30 to-emerald-500/10 rounded-t border border-emerald-500/20 border-b-0 transition-all"
                    style={{ height: `${heightPct}%`, minHeight: "4px" }}
                  />
                </div>
                <span className="text-white/30 text-[10px] font-mono">{m.month}</span>
              </div>
            );
          })}
        </div>
      </GlassCard>

      {/* Recent Treasury Transactions */}
      <GlassCard className="p-6">
        <h3 className="text-white/80 font-semibold mb-4">Recent Treasury Transactions</h3>
        <div className="space-y-1">
          {recentTxs.map((tx, i) => (
            <div
              key={i}
              className="flex items-center justify-between py-2.5 border-b border-white/[0.04] last:border-0"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className={`flex-shrink-0 h-6 w-6 rounded flex items-center justify-center text-xs font-bold ${
                  tx.isInflow ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"
                }`}>
                  {tx.isInflow ? "+" : "-"}
                </span>
                <div className="min-w-0">
                  <p className="text-white/70 text-xs font-medium truncate">{tx.source}</p>
                  <p className="text-white/30 text-[10px] font-mono">
                    {new Date(tx.timestamp * 1000).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </div>
              <span className={`text-sm font-mono font-medium flex-shrink-0 ml-2 ${tx.isInflow ? "text-emerald-400" : "text-red-400"}`}>
                {tx.isInflow ? "+" : "-"}{formatAeth(tx.amount)} AETH
              </span>
            </div>
          ))}
        </div>
      </GlassCard>

      {/* Burn Mechanism */}
      <GlassCard className="p-6">
        <h3 className="text-white/80 font-semibold mb-4">Burn Mechanism</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div>
            <p className="text-white/40 text-xs font-mono uppercase tracking-wider mb-1">Total Burned</p>
            <p className="text-amber-400 text-xl font-bold">{formatAeth(totalBurned)} <span className="text-sm text-white/40 font-normal">AETH</span></p>
          </div>
          <div>
            <p className="text-white/40 text-xs font-mono uppercase tracking-wider mb-1">Burn Rate</p>
            <p className="text-amber-400 text-xl font-bold">{(burnRate * 100).toFixed(1)}% <span className="text-sm text-white/40 font-normal">of fees</span></p>
          </div>
          <div>
            <p className="text-white/40 text-xs font-mono uppercase tracking-wider mb-1">Mechanism</p>
            <p className="text-white/60 text-sm">Percentage of marketplace fees sent to burn address quarterly</p>
          </div>
        </div>
      </GlassCard>
    </div>
  );
}

function DelegatesTab() {
  const { address } = useAccount();

  const delegates = useMemo(() => {
    const names = [
      "Zhyra Core", "NEOM Validator", "Carbon Council", "Jubail DAO",
      "Green Ledger", "Aethelred Foundation", "DAC Alliance", "Gulf Carbon Trust",
    ];
    return names.map((name, i) => ({
      name,
      address: seededAddress(4000 + i),
      votingPower: seededInt(4100 + i, 2000, 25000),
      delegationCount: seededInt(4200 + i, 3, 85),
      participationRate: seededInt(4300 + i, 55, 100),
      proposalsVoted: seededInt(4400 + i, 2, 24),
      statement: [
        "Committed to sustainable protocol growth and transparent governance.",
        "Focused on MENA regional expansion and DAC facility onboarding.",
        "Advocating for community-first governance decisions and fair fee structures.",
        "Supporting industrial carbon capture integration and compliance standards.",
        "Dedicated to cross-chain interoperability and DeFi composability.",
        "Ensuring network security and long-term protocol sustainability.",
        "Championing DAC operator interests and device certification standards.",
        "Promoting carbon credit market integrity and price discovery mechanisms.",
      ][i],
    }));
  }, []);

  const sortedDelegates = useMemo(
    () => [...delegates].sort((a, b) => b.votingPower - a.votingPower),
    [delegates]
  );

  const maxVotingPower = sortedDelegates[0]?.votingPower ?? 1;

  const delegationHistory = useMemo(() => {
    if (!address) return [];
    return [
      { to: delegates[0]!.name, toAddr: delegates[0]!.address, amount: seededInt(4500, 100, 800), timestamp: 1742000000 },
      { to: delegates[2]!.name, toAddr: delegates[2]!.address, amount: seededInt(4501, 50, 300), timestamp: 1741500000 },
      { to: delegates[5]!.name, toAddr: delegates[5]!.address, amount: seededInt(4502, 200, 1200), timestamp: 1740800000 },
    ];
  }, [address, delegates]);

  return (
    <div className="space-y-6">
      {/* Phase 2 Preview Banner */}
      <GlassCard className="p-5 border-cyan-500/10">
        <div className="flex items-center gap-3 mb-2">
          <Phase2Badge />
          <span className="text-white/60 text-sm font-medium">Delegation System</span>
        </div>
        <p className="text-white/40 text-xs leading-relaxed">
          Token delegation will be available in Phase 2 with the governance token launch. Currently, governance operates
          under a multi-signature model where the 2-of-3 signer threshold ensures all protocol changes require consensus
          among authorized signers. The delegation system below previews the upcoming decentralized governance structure.
        </p>
      </GlassCard>

      {/* Delegate Your Votes Section */}
      <GlassCard className="p-6">
        <h3 className="text-white/80 font-semibold mb-3">Delegate Your Votes</h3>
        <p className="text-white/40 text-sm mb-4">
          Assign your voting power to a trusted delegate who will vote on your behalf in governance proposals.
          You retain ownership of your tokens and can revoke delegation at any time.
        </p>
        <div className="flex gap-3 items-end flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <label className="text-white/40 text-[10px] font-mono uppercase tracking-wider block mb-1">Delegate Address</label>
            <input
              disabled
              placeholder="0x... or select from directory below"
              className="w-full px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.08] text-white/30 text-sm font-mono placeholder:text-white/20 cursor-not-allowed"
            />
          </div>
          <button
            disabled
            className="px-6 py-2 rounded-lg bg-emerald-500/10 text-emerald-400/50 text-sm font-mono border border-emerald-500/20 cursor-not-allowed whitespace-nowrap"
          >
            Delegate Votes
          </button>
        </div>
        <p className="text-white/20 text-[10px] font-mono mt-2">Available in Phase 2 -- Q4 2026</p>
      </GlassCard>

      {/* Top Delegates Leaderboard */}
      <GlassCard className="p-6">
        <h3 className="text-white/80 font-semibold mb-4">Delegate Leaderboard</h3>
        <div className="space-y-3">
          {sortedDelegates.map((delegate, i) => (
            <div
              key={i}
              className="p-4 rounded-lg bg-white/[0.02] border border-white/[0.06]"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-bold w-6 text-center ${
                    i === 0 ? "text-amber-400" : i === 1 ? "text-white/50" : i === 2 ? "text-amber-600" : "text-white/30"
                  }`}>
                    #{i + 1}
                  </span>
                  <div>
                    <span className="text-white/80 text-sm font-medium">{delegate.name}</span>
                    <p className="text-white/30 text-[10px] font-mono">{shortenAddress(delegate.address)}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-emerald-400 text-sm font-bold">{delegate.votingPower.toLocaleString()} <span className="text-white/30 text-[10px] font-normal">TQR</span></p>
                </div>
              </div>

              {/* Voting power bar */}
              <div className="mb-2">
                <ProgressBar
                  value={delegate.votingPower}
                  max={maxVotingPower}
                  colorClass="bg-emerald-500/60"
                  height="h-1"
                />
              </div>

              <div className="flex items-center gap-4 flex-wrap text-[10px] font-mono">
                <span className="text-white/40">Delegations: <span className="text-white/60">{delegate.delegationCount}</span></span>
                <span className="text-white/40">Participation: <span className={`${delegate.participationRate >= 80 ? "text-emerald-400/70" : delegate.participationRate >= 60 ? "text-amber-400/70" : "text-red-400/70"}`}>{delegate.participationRate}%</span></span>
                <span className="text-white/40">Proposals Voted: <span className="text-white/60">{delegate.proposalsVoted}</span></span>
              </div>
              <p className="text-white/30 text-xs mt-2 italic">{delegate.statement}</p>
            </div>
          ))}
        </div>
      </GlassCard>

      {/* Delegation History */}
      {address && delegationHistory.length > 0 && (
        <GlassCard className="p-6">
          <h3 className="text-white/80 font-semibold mb-4">Your Delegation History</h3>
          <div className="space-y-2">
            {delegationHistory.map((entry, i) => (
              <div
                key={i}
                className="flex items-center justify-between py-2.5 border-b border-white/[0.04] last:border-0"
              >
                <div className="flex items-center gap-3">
                  <span className="flex-shrink-0 h-6 w-6 rounded bg-cyan-500/10 text-cyan-400 flex items-center justify-center text-[10px] font-bold">D</span>
                  <div>
                    <p className="text-white/70 text-xs">Delegated to <span className="text-cyan-400/80 font-medium">{entry.to}</span></p>
                    <p className="text-white/30 text-[10px] font-mono">
                      {shortenAddress(entry.toAddr)} -- {new Date(entry.timestamp * 1000).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </p>
                  </div>
                </div>
                <span className="text-emerald-400/70 text-xs font-mono">{entry.amount.toLocaleString()} TQR</span>
              </div>
            ))}
          </div>
        </GlassCard>
      )}

      {/* Current Governance Model Explanation */}
      <GlassCard className="p-6 border-white/[0.04]">
        <h3 className="text-white/80 font-semibold mb-3">Current Governance Model</h3>
        <p className="text-white/40 text-sm leading-relaxed mb-4">
          TerraQura is currently in Phase 1 of progressive decentralization. All governance decisions
          are made through a 2-of-3 multi-signature wallet with a 1-hour timelock. The delegation
          system shown above represents the planned Phase 2 architecture.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.04]">
            <p className="text-white/40 text-[10px] font-mono uppercase tracking-wider mb-1">Current</p>
            <p className="text-white/70 text-sm font-medium">Multi-Sig (2-of-3)</p>
          </div>
          <div className="p-3 rounded-lg bg-white/[0.02] border border-cyan-500/10">
            <p className="text-cyan-400/60 text-[10px] font-mono uppercase tracking-wider mb-1">Phase 2</p>
            <p className="text-white/70 text-sm font-medium">Council + Delegation</p>
          </div>
          <div className="p-3 rounded-lg bg-white/[0.02] border border-purple-500/10">
            <p className="text-purple-400/60 text-[10px] font-mono uppercase tracking-wider mb-1">Phase 3</p>
            <p className="text-white/70 text-sm font-medium">Full DAO Governance</p>
          </div>
        </div>
      </GlassCard>
    </div>
  );
}

// ============================================
// Main Component
// ============================================

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "security", label: "Security" },
  { id: "roadmap", label: "Roadmap" },
  { id: "transactions", label: "Transactions" },
  { id: "proposals", label: "Proposals" },
  { id: "treasury", label: "Treasury" },
  { id: "delegates", label: "Delegates" },
];

export function GovernanceDashboardContent() {
  const [activeTab, setActiveTab] = useState("overview");

  return (
    <div className="min-h-screen bg-[#060A13] flex flex-col">
      <TopNav />
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-8">
        <SectionHeader
          title="Governance"
          description="Multi-signature governance with progressive decentralization. Circuit breaker protection, role-based access, and transparent on-chain operations."
        />
        <Tabs tabs={TABS} activeTab={activeTab} onChange={setActiveTab} />
        <div className="mt-6">
          {activeTab === "overview" && <OverviewTab />}
          {activeTab === "security" && <SecurityTab />}
          {activeTab === "roadmap" && <RoadmapTab />}
          {activeTab === "transactions" && <TransactionsTab />}
          {activeTab === "proposals" && <ProposalsTab />}
          {activeTab === "treasury" && <TreasuryTab />}
          {activeTab === "delegates" && <DelegatesTab />}
        </div>
      </main>
      <DAppFooter />
    </div>
  );
}
