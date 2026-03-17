/**
 * TerraQura NativeIoT Oracle Dashboard
 *
 * Comprehensive oracle monitoring interface with seeded mock data.
 * Live IoT telemetry, device fleet management, anomaly investigation,
 * deep telemetry, compliance tracking, and architecture overview.
 *
 * 7 tabs: Live Feed, Device Status, Architecture, Fleet Analytics,
 * Anomaly Lab, Telemetry, Compliance
 *
 * @version 5.0.0 - Full Oracle Intelligence Suite
 */

"use client";

import { useState, useCallback, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  useOracleSensorData,
  useOracleDataFreshness,
  useOracleDevices,
  useWatchOracleData,
  useWatchOracleAnomalies,
  type ContractEventLog,
} from "@/hooks/useContractData";
import { CONTRACTS } from "@/lib/contracts";
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

function seededFloat(seed: number, min: number, max: number, decimals: number = 2): number {
  const val = seededRandom(seed) * (max - min) + min;
  const factor = Math.pow(10, decimals);
  return Math.round(val * factor) / factor;
}

function seededChoice<T>(seed: number, arr: T[]): T {
  return arr[seededInt(seed, 0, arr.length - 1)]!;
}

// ============================================
// Mock Data
// ============================================

interface MockDevice {
  dacId: string;
  label: string;
  location: string;
  region: string;
  co2Captured: number;
  energyUsed: number;
  minutesAgo: number;
  anomalyFlag: boolean;
  anomalyCount: number;
  satelliteCID: string;
  status: "Active" | "Suspended" | "Offline";
  lat: number;
  lon: number;
  uptimePercent: number;
  firmwareVersion: string;
  calibrationDate: string;
}

const MOCK_DEVICES: MockDevice[] = [
  {
    dacId: "DAC-MASDAR-001",
    label: "Masdar City Alpha",
    location: "Abu Dhabi, UAE",
    region: "UAE",
    co2Captured: seededInt(1, 15000, 45000),
    energyUsed: seededInt(2, 3000, 12000),
    minutesAgo: seededInt(3, 1, 8),
    anomalyFlag: false,
    anomalyCount: 0,
    satelliteCID: "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi",
    status: "Active",
    lat: 24.4539,
    lon: 54.3773,
    uptimePercent: seededFloat(101, 97.5, 99.9),
    firmwareVersion: "v3.2.1",
    calibrationDate: "2026-01-15",
  },
  {
    dacId: "DAC-NEOM-002",
    label: "NEOM Green Hub",
    location: "Tabuk, Saudi Arabia",
    region: "Saudi Arabia",
    co2Captured: seededInt(4, 20000, 42000),
    energyUsed: seededInt(5, 4000, 11000),
    minutesAgo: seededInt(6, 2, 12),
    anomalyFlag: false,
    anomalyCount: 1,
    satelliteCID: "bafybeihkoviema7g3gxyt6la7vd5ho32ictqbilu3ez7cne55flkepjwsa",
    status: "Active",
    lat: 26.5742,
    lon: 36.2653,
    uptimePercent: seededFloat(102, 96.0, 99.5),
    firmwareVersion: "v3.2.1",
    calibrationDate: "2026-02-01",
  },
  {
    dacId: "DAC-JUBAIL-003",
    label: "Jubail Industrial",
    location: "Jubail, Saudi Arabia",
    region: "Saudi Arabia",
    co2Captured: seededInt(7, 18000, 38000),
    energyUsed: seededInt(8, 5000, 10000),
    minutesAgo: seededInt(9, 1, 5),
    anomalyFlag: false,
    anomalyCount: 0,
    satelliteCID: "bafybeic5ch3zltge3aijhqpsokr5h3komhpkrdvyi6w7yre3lg5ciwxhwi",
    status: "Active",
    lat: 27.0046,
    lon: 49.6606,
    uptimePercent: seededFloat(103, 98.0, 99.9),
    firmwareVersion: "v3.2.0",
    calibrationDate: "2025-12-20",
  },
  {
    dacId: "DAC-LIWA-004",
    label: "Liwa Desert Station",
    location: "Liwa, UAE",
    region: "UAE",
    co2Captured: seededInt(10, 12000, 35000),
    energyUsed: seededInt(11, 3500, 9000),
    minutesAgo: seededInt(12, 5, 25),
    anomalyFlag: true,
    anomalyCount: 3,
    satelliteCID: "bafybeifoylb3mrzr5osm3sinf6lkphi3dact63soi5vwqxm3s3y2neyhka",
    status: "Active",
    lat: 23.1382,
    lon: 53.7615,
    uptimePercent: seededFloat(104, 88.0, 94.0),
    firmwareVersion: "v3.1.4",
    calibrationDate: "2025-11-10",
  },
  {
    dacId: "DAC-DUQM-005",
    label: "Duqm Coastal Unit",
    location: "Duqm, Oman",
    region: "Oman",
    co2Captured: seededInt(13, 10000, 30000),
    energyUsed: seededInt(14, 3000, 8500),
    minutesAgo: seededInt(15, 3, 15),
    anomalyFlag: false,
    anomalyCount: 0,
    satelliteCID: "bafybeifx7yeb55armcsxwwitkymga5xf53dxd2h4yrcqm6za6th3bhe7ry",
    status: "Suspended",
    lat: 19.6618,
    lon: 57.7038,
    uptimePercent: seededFloat(105, 70.0, 82.0),
    firmwareVersion: "v3.2.1",
    calibrationDate: "2026-01-05",
  },
  {
    dacId: "DAC-RABIGH-006",
    label: "Rabigh Solar DAC",
    location: "Rabigh, Saudi Arabia",
    region: "Saudi Arabia",
    co2Captured: 0,
    energyUsed: 0,
    minutesAgo: 120,
    anomalyFlag: false,
    anomalyCount: 0,
    satelliteCID: "",
    status: "Offline",
    lat: 22.7996,
    lon: 39.0300,
    uptimePercent: 0,
    firmwareVersion: "v3.1.4",
    calibrationDate: "2025-10-22",
  },
  {
    dacId: "DAC-SHARJAH-007",
    label: "Sharjah Research Unit",
    location: "Sharjah, UAE",
    region: "UAE",
    co2Captured: seededInt(16, 14000, 36000),
    energyUsed: seededInt(17, 3200, 9500),
    minutesAgo: seededInt(18, 1, 7),
    anomalyFlag: false,
    anomalyCount: 0,
    satelliteCID: "bafybeig6xv5nwphfmvcnektpnojts33jqcuam7bmye2pb54adnrtccmaai",
    status: "Active",
    lat: 25.3463,
    lon: 55.4209,
    uptimePercent: seededFloat(106, 97.0, 99.8),
    firmwareVersion: "v3.2.1",
    calibrationDate: "2026-02-10",
  },
  {
    dacId: "DAC-SALALAH-008",
    label: "Salalah Monsoon Station",
    location: "Salalah, Oman",
    region: "Oman",
    co2Captured: seededInt(19, 11000, 32000),
    energyUsed: seededInt(20, 2800, 8200),
    minutesAgo: seededInt(21, 2, 10),
    anomalyFlag: false,
    anomalyCount: 0,
    satelliteCID: "bafybeihw33lucwhnuzqhsgervycplsv4ylp2eqgbwfuztir5njzsdctpae",
    status: "Active",
    lat: 17.0151,
    lon: 54.0924,
    uptimePercent: seededFloat(107, 95.0, 99.5),
    firmwareVersion: "v3.2.0",
    calibrationDate: "2026-01-28",
  },
];

// ============================================
// Mock Anomaly Data
// ============================================

type AnomalySeverity = "Low" | "Medium" | "High" | "Critical";
type AnomalyStatus = "Open" | "Investigating" | "Resolved" | "DeviceSuspended";

interface MockAnomaly {
  id: string;
  dacId: string;
  timestamp: string;
  severity: AnomalySeverity;
  status: AnomalyStatus;
  sensorReading: number;
  expectedMin: number;
  expectedMax: number;
  metric: string;
  rootCause: string;
  dayIndex: number;
}

const ANOMALY_ROOT_CAUSES = [
  "Energy spike detected",
  "CO2 reading below threshold",
  "Sensor calibration drift",
  "Network timeout",
  "Pressure differential anomaly",
  "Temperature sensor offset",
  "Humidity spike interference",
  "Power supply fluctuation",
];

const MOCK_ANOMALIES: MockAnomaly[] = Array.from({ length: 12 }, (_, i) => {
  const seed = 500 + i * 7;
  const deviceIdx = seededInt(seed, 0, MOCK_DEVICES.length - 1);
  const device = MOCK_DEVICES[deviceIdx]!;
  const severities: AnomalySeverity[] = ["Low", "Medium", "High", "Critical"];
  const statuses: AnomalyStatus[] = ["Open", "Investigating", "Resolved", "DeviceSuspended"];
  const metrics = ["CO2 Capture Rate", "Energy Consumption", "Temperature", "Pressure", "Humidity", "Efficiency"];
  const metric = seededChoice(seed + 1, metrics);
  const expectedMin = seededInt(seed + 2, 100, 300);
  const expectedMax = expectedMin + seededInt(seed + 3, 100, 400);
  const actualVal =
    seededRandom(seed + 4) > 0.5
      ? expectedMax + seededInt(seed + 5, 10, 200)
      : expectedMin - seededInt(seed + 6, 10, 150);
  const dayOffset = seededInt(seed + 7, 0, 29);
  const hour = seededInt(seed + 8, 0, 23);
  const minute = seededInt(seed + 9, 0, 59);
  return {
    id: `ANM-${String(1000 + i)}`,
    dacId: device.dacId,
    timestamp: `2026-${String(3 - Math.floor(dayOffset / 28)).padStart(2, "0")}-${String((dayOffset % 28) + 1).padStart(2, "0")}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00Z`,
    severity: seededChoice(seed + 10, severities),
    status: seededChoice(seed + 11, statuses),
    sensorReading: Math.max(0, actualVal),
    expectedMin,
    expectedMax,
    metric,
    rootCause: seededChoice(seed + 12, ANOMALY_ROOT_CAUSES),
    dayIndex: dayOffset,
  };
});

// ============================================
// Telemetry Data Generation (7 days x 24 hours = 168 data points per metric)
// ============================================

function generateTelemetryData(dacId: string, metricIndex: number): number[] {
  const baseSeed = dacId.split("").reduce((a, c) => a + c.charCodeAt(0), 0) + metricIndex * 1000;
  return Array.from({ length: 168 }, (_, hour) => {
    const seed = baseSeed + hour * 3;
    const baseValues = [
      seededFloat(seed, 800, 2200, 1),   // CO2 capture rate (kg/hr)
      seededFloat(seed, 150, 550, 1),     // Energy consumption (kWh)
      seededFloat(seed, 2.5, 6.0, 2),     // Capture efficiency (kg/kWh)
      seededFloat(seed, 28, 52, 1),       // Temperature (C)
      seededFloat(seed, 15, 65, 1),       // Humidity (%)
      seededFloat(seed, 980, 1040, 1),    // Pressure (hPa)
    ];
    return baseValues[metricIndex] ?? 0;
  });
}

function computeStats(data: number[]): { min: number; max: number; avg: number; stdDev: number } {
  const n = data.length;
  if (n === 0) return { min: 0, max: 0, avg: 0, stdDev: 0 };
  const min = Math.min(...data);
  const max = Math.max(...data);
  const avg = data.reduce((a, b) => a + b, 0) / n;
  const variance = data.reduce((sum, val) => sum + (val - avg) * (val - avg), 0) / n;
  const stdDev = Math.sqrt(variance);
  return {
    min: Math.round(min * 100) / 100,
    max: Math.round(max * 100) / 100,
    avg: Math.round(avg * 100) / 100,
    stdDev: Math.round(stdDev * 100) / 100,
  };
}

// ============================================
// Utility Functions
// ============================================

function formatTimeAgo(minutes: number): string {
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`;
  return `${Math.floor(minutes / 1440)}d ago`;
}

function formatNumber(n: number): string {
  return n.toLocaleString("en-US");
}

function getFreshnessColor(minutesAgo: number): string {
  if (minutesAgo <= 5) return "bg-emerald-500";
  if (minutesAgo <= 10) return "bg-emerald-400";
  if (minutesAgo <= 15) return "bg-amber-400";
  if (minutesAgo <= 30) return "bg-amber-500";
  if (minutesAgo <= 60) return "bg-orange-500";
  return "bg-red-500";
}

function getFreshnessTextColor(minutesAgo: number): string {
  if (minutesAgo <= 10) return "text-emerald-400";
  if (minutesAgo <= 30) return "text-amber-400";
  return "text-red-400";
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
        <span className="text-white/30 text-xs font-mono">TerraQura NativeIoT Oracle</span>
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

function StatusBadge({ status }: { status: "Active" | "Suspended" | "Offline" | string }) {
  const styles: Record<string, string> = {
    Active: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    Suspended: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    Offline: "bg-red-500/10 text-red-400 border-red-500/20",
  };
  return (
    <span className={`text-xs font-mono px-2.5 py-1 rounded-full border ${styles[status] || styles.Offline}`}>
      {status}
    </span>
  );
}

function SeverityBadge({ severity }: { severity: AnomalySeverity }) {
  const styles: Record<AnomalySeverity, string> = {
    Low: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    Medium: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    High: "bg-orange-500/10 text-orange-400 border-orange-500/20",
    Critical: "bg-red-500/10 text-red-400 border-red-500/20",
  };
  return (
    <span className={`text-xs font-mono px-2.5 py-1 rounded-full border ${styles[severity]}`}>
      {severity}
    </span>
  );
}

function AnomalyStatusBadge({ status }: { status: AnomalyStatus }) {
  const styles: Record<AnomalyStatus, string> = {
    Open: "bg-red-500/10 text-red-400 border-red-500/20",
    Investigating: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    Resolved: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    DeviceSuspended: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  };
  return (
    <span className={`text-xs font-mono px-2.5 py-1 rounded-full border ${styles[status]}`}>
      {status === "DeviceSuspended" ? "Suspended" : status}
    </span>
  );
}

function LiveDot({ isFresh }: { isFresh: boolean }) {
  if (isFresh) {
    return (
      <span className="relative flex h-2.5 w-2.5">
        <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
      </span>
    );
  }
  return <span className="inline-flex h-2.5 w-2.5 rounded-full bg-amber-500" />;
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

function MiniBarChart({
  data,
  maxVal,
  barColor = "bg-emerald-500",
  height = 48,
  label,
}: {
  data: number[];
  maxVal?: number;
  barColor?: string;
  height?: number;
  label?: string;
}) {
  const max = maxVal ?? Math.max(...data, 1);
  return (
    <div>
      {label && <p className="text-white/30 text-[10px] font-mono uppercase tracking-wider mb-1">{label}</p>}
      <div className="flex items-end gap-px" style={{ height }}>
        {data.map((val, i) => {
          const h = Math.max(1, (val / max) * 100);
          return (
            <div
              key={i}
              className={`flex-1 rounded-t-sm ${barColor} opacity-70 hover:opacity-100 transition-opacity`}
              style={{ height: `${h}%` }}
              title={`${val}`}
            />
          );
        })}
      </div>
    </div>
  );
}

function ProgressBar({ value, max, colorClass = "bg-emerald-500" }: { value: number; max: number; colorClass?: string }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div className="w-full h-2 bg-white/[0.06] rounded-full overflow-hidden">
      <div className={`h-full rounded-full ${colorClass} transition-all`} style={{ width: `${pct}%` }} />
    </div>
  );
}

// ============================================
// Tab Content: Live Feed
// ============================================

function LiveFeedTab() {
  const [events, setEvents] = useState<ContractEventLog[]>([]);
  const [expandedDevice, setExpandedDevice] = useState<string | null>(null);

  useWatchOracleData(
    useCallback((log: ContractEventLog) => {
      setEvents((prev) => [log, ...prev].slice(0, 20));
    }, [])
  );

  useWatchOracleAnomalies(
    useCallback((log: ContractEventLog) => {
      setEvents((prev) => [log, ...prev].slice(0, 20));
    }, [])
  );

  const { devices: onChainDevices } = useOracleDevices();

  const activeDevices = MOCK_DEVICES.filter((d) => d.status !== "Offline");
  const totalCO2 = MOCK_DEVICES.reduce((sum, d) => sum + d.co2Captured, 0);
  const totalEnergy = MOCK_DEVICES.reduce((sum, d) => sum + d.energyUsed, 0);

  return (
    <div className="space-y-6">
      {/* Summary Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <MetricCard
          label="Total CO2 Captured"
          value={formatNumber(totalCO2)}
          unit="kg"
          colorClass="text-emerald-400"
        />
        <MetricCard
          label="Total Energy Used"
          value={formatNumber(totalEnergy)}
          unit="kWh"
          colorClass="text-cyan-400"
        />
        <MetricCard
          label="Active Devices"
          value={String(activeDevices.length)}
          unit={`/ ${MOCK_DEVICES.length}`}
          colorClass="text-blue-400"
        />
        <MetricCard
          label="On-Chain Devices"
          value={String(onChainDevices.length || 0)}
          unit="registered"
          colorClass="text-purple-400"
        />
      </div>

      {/* Oracle Health Monitor */}
      <GlassCard className="p-6">
        <div className="flex items-center gap-3 mb-5">
          <LiveDot isFresh={true} />
          <h3 className="text-white/80 font-semibold text-sm">Oracle Health Monitor</h3>
          <span className="text-white/30 text-xs font-mono ml-auto">Heartbeat Timeout: 900s (15 min)</span>
        </div>

        {/* Heartbeat Timeline */}
        <div className="space-y-3 mb-5">
          {MOCK_DEVICES.map((device) => {
            const secondsAgo = device.minutesAgo * 60;
            const countdownRemaining = Math.max(0, 900 - secondsAgo);
            const freshnessWidth = Math.min(100, (secondsAgo / 900) * 100);
            return (
              <div key={device.dacId} className="flex items-center gap-3">
                <span className="text-white/50 text-xs font-mono w-36 flex-shrink-0 truncate">{device.dacId}</span>
                <div className="flex-1 h-3 bg-white/[0.04] rounded-full overflow-hidden relative">
                  <div
                    className={`h-full rounded-full transition-all ${getFreshnessColor(device.minutesAgo)}`}
                    style={{ width: `${100 - freshnessWidth}%` }}
                  />
                </div>
                <span className={`text-xs font-mono w-16 text-right flex-shrink-0 ${getFreshnessTextColor(device.minutesAgo)}`}>
                  {device.status === "Offline" ? "OFFLINE" : formatTimeAgo(device.minutesAgo)}
                </span>
                <span className="text-white/20 text-[10px] font-mono w-20 text-right flex-shrink-0">
                  {device.status === "Offline" ? "--" : `${countdownRemaining}s left`}
                </span>
              </div>
            );
          })}
        </div>

        {/* Batch Submission Indicator */}
        <div className="flex items-center gap-3 pt-3 border-t border-white/[0.04]">
          <div className="h-2 w-2 rounded-full bg-cyan-500 animate-pulse" />
          <span className="text-white/40 text-xs font-mono">Batch submission mode: Multi-device single-tx enabled</span>
          <span className="text-cyan-400/60 text-xs font-mono ml-auto">
            Last batch: {seededInt(200, 2, 6)} devices, {seededInt(201, 1, 4)}m ago
          </span>
        </div>
      </GlassCard>

      {/* Clickable Device Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {activeDevices.map((device) => (
          <DeviceCardExpanded
            key={device.dacId}
            device={device}
            isExpanded={expandedDevice === device.dacId}
            onToggle={() => setExpandedDevice(expandedDevice === device.dacId ? null : device.dacId)}
          />
        ))}
      </div>

      {/* Real-time Event Feed */}
      <GlassCard className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <LiveDot isFresh={true} />
          <h3 className="text-white/80 font-semibold text-sm">Real-time Event Feed</h3>
          <span className="text-white/30 text-xs font-mono ml-auto">
            Listening for IoTDataLogged events
          </span>
        </div>
        {events.length > 0 ? (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {events.map((evt, i) => (
              <div
                key={`${evt.transactionHash}-${i}`}
                className="flex items-center gap-3 text-xs font-mono text-white/50 py-1.5 border-b border-white/[0.04] last:border-0"
              >
                <span className={evt.eventName === "AnomalyDetected" ? "text-amber-400" : "text-emerald-400"}>
                  {evt.eventName}
                </span>
                <span className="text-white/30 truncate">
                  Block #{evt.blockNumber.toString()}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-white/30 text-sm">
              No live events yet. Events will appear here when oracle submits data on-chain.
            </p>
            <p className="text-white/20 text-xs mt-2 font-mono">
              Monitoring: IoTDataLogged, AnomalyDetected
            </p>
          </div>
        )}
      </GlassCard>
    </div>
  );
}

function DeviceCardExpanded({
  device,
  isExpanded,
  onToggle,
}: {
  device: MockDevice;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const isFresh = device.minutesAgo <= 10;

  const { sensorData } = useOracleSensorData(device.dacId);
  const { isFresh: onChainFresh } = useOracleDataFreshness(device.dacId);

  const co2 = sensorData ? Number(sensorData.co2Captured) : device.co2Captured;
  const energy = sensorData ? Number(sensorData.energyUsed) : device.energyUsed;
  const anomaly = sensorData ? sensorData.anomalyFlag : device.anomalyFlag;
  const fresh = onChainFresh !== undefined ? onChainFresh : isFresh;
  const cid = sensorData?.satelliteCID || device.satelliteCID;

  // Generate 24-hour telemetry history
  const baseSeed = device.dacId.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const co2History = useMemo(
    () => Array.from({ length: 24 }, (_, h) => seededInt(baseSeed + h * 5, 600, 2200)),
    [baseSeed]
  );
  const energyHistory = useMemo(
    () => Array.from({ length: 24 }, (_, h) => seededInt(baseSeed + h * 5 + 1, 150, 520)),
    [baseSeed]
  );
  const efficiencyHistory = useMemo(
    () => Array.from({ length: 24 }, (_, h) => seededFloat(baseSeed + h * 5 + 2, 2.5, 5.5, 2)),
    [baseSeed]
  );

  // Per-device anomaly log
  const deviceAnomalies = useMemo(
    () => MOCK_ANOMALIES.filter((a) => a.dacId === device.dacId),
    [device.dacId]
  );

  return (
    <GlassCard className="overflow-hidden">
      {/* Clickable header */}
      <button onClick={onToggle} className="w-full text-left p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <LiveDot isFresh={fresh} />
            <div>
              <h3 className="text-white/90 font-semibold text-sm">{device.dacId}</h3>
              <p className="text-white/40 text-xs">{device.location}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {anomaly && (
              <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20">
                ANOMALY
              </span>
            )}
            <StatusBadge status={device.status} />
            <svg
              className={`h-4 w-4 text-white/30 transition-transform ${isExpanded ? "rotate-180" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-3">
          <div className="bg-white/[0.03] rounded-lg p-3">
            <p className="text-white/40 text-[10px] font-mono uppercase tracking-wider mb-1">CO2 Captured</p>
            <p className="text-emerald-400 font-bold text-lg">
              {formatNumber(co2)}<span className="text-xs text-white/30 ml-1">kg</span>
            </p>
          </div>
          <div className="bg-white/[0.03] rounded-lg p-3">
            <p className="text-white/40 text-[10px] font-mono uppercase tracking-wider mb-1">Energy Used</p>
            <p className="text-cyan-400 font-bold text-lg">
              {formatNumber(energy)}<span className="text-xs text-white/30 ml-1">kWh</span>
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs">
          <span className={`font-mono ${fresh ? "text-emerald-400/70" : "text-amber-400/70"}`}>
            {formatTimeAgo(device.minutesAgo)}
          </span>
          {cid && (
            <span className="text-purple-400/60 font-mono truncate max-w-[140px]" title={cid}>
              IPFS: {cid.slice(0, 12)}...
            </span>
          )}
        </div>
      </button>

      {/* Expanded Detail View */}
      {isExpanded && (
        <div className="border-t border-white/[0.06] p-5 space-y-5">
          {/* 24-hour CO2 Capture Rate Trend */}
          <div>
            <p className="text-white/50 text-xs font-mono uppercase tracking-wider mb-2">
              CO2 Capture Rate (24h) -- kg/hr
            </p>
            <MiniBarChart data={co2History} barColor="bg-emerald-500" height={56} />
            <div className="flex justify-between text-[10px] text-white/20 font-mono mt-1">
              <span>-24h</span>
              <span>-12h</span>
              <span>Now</span>
            </div>
          </div>

          {/* Energy Efficiency Over Time */}
          <div>
            <p className="text-white/50 text-xs font-mono uppercase tracking-wider mb-2">
              Capture Efficiency (24h) -- kg CO2 / kWh
            </p>
            <MiniBarChart data={efficiencyHistory} barColor="bg-cyan-500" height={48} />
            <div className="flex justify-between text-[10px] text-white/20 font-mono mt-1">
              <span>-24h</span>
              <span>Now</span>
            </div>
          </div>

          {/* Energy Consumption */}
          <div>
            <p className="text-white/50 text-xs font-mono uppercase tracking-wider mb-2">
              Energy Consumption (24h) -- kWh
            </p>
            <MiniBarChart data={energyHistory} barColor="bg-blue-500" height={48} />
          </div>

          {/* Per-device Anomaly Log */}
          <div>
            <p className="text-white/50 text-xs font-mono uppercase tracking-wider mb-2">
              Anomaly Log ({deviceAnomalies.length} events)
            </p>
            {deviceAnomalies.length > 0 ? (
              <div className="space-y-1.5 max-h-32 overflow-y-auto">
                {deviceAnomalies.map((a) => (
                  <div key={a.id} className="flex items-center justify-between text-xs py-1 border-b border-white/[0.03] last:border-0">
                    <div className="flex items-center gap-2">
                      <SeverityBadge severity={a.severity} />
                      <span className="text-white/40 font-mono">{a.metric}</span>
                    </div>
                    <span className="text-white/30 font-mono">{a.timestamp.slice(0, 10)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-white/20 text-xs font-mono">No anomalies recorded</p>
            )}
          </div>
        </div>
      )}
    </GlassCard>
  );
}

// ============================================
// Tab Content: Device Status
// ============================================

function DeviceStatusTab() {
  const { devices: onChainDevices, totalSubmissions, deviceCount } = useOracleDevices();

  const oracleAddress = CONTRACTS.nativeIoTOracle;
  const explorerUrl = getExplorerAddressUrl(oracleAddress);

  return (
    <div className="space-y-6">
      {/* Oracle Contract Info */}
      <GlassCard className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-white/40 text-xs font-mono uppercase tracking-wider mb-1">Oracle Contract</p>
            <div className="flex items-center gap-2">
              <a
                href={explorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-cyan-400 hover:text-cyan-300 font-mono text-sm transition-colors"
              >
                {oracleAddress.slice(0, 6)}...{oracleAddress.slice(-4)}
              </a>
              <CopyButton text={oracleAddress} />
            </div>
          </div>
          <div className="text-right">
            <p className="text-white/40 text-xs font-mono uppercase tracking-wider mb-1">Total Submissions</p>
            <p className="text-white/80 font-bold text-lg font-mono">
              {totalSubmissions !== undefined ? totalSubmissions.toString() : "--"}
            </p>
          </div>
        </div>
      </GlassCard>

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-4">
        <MetricCard
          label="Registered Devices"
          value={String(deviceCount || MOCK_DEVICES.length)}
          colorClass="text-blue-400"
        />
        <MetricCard
          label="Active"
          value={String(MOCK_DEVICES.filter((d) => d.status === "Active").length)}
          colorClass="text-emerald-400"
        />
        <MetricCard
          label="With Anomalies"
          value={String(MOCK_DEVICES.filter((d) => d.anomalyCount > 0).length)}
          colorClass="text-amber-400"
        />
      </div>

      {/* Enhanced Device Grid with coordinates, uptime, firmware, calibration */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {MOCK_DEVICES.map((device) => {
          const devFresh = device.minutesAgo <= 10;
          return (
            <GlassCard key={device.dacId} className="p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-white/90 font-semibold text-sm">{device.dacId}</h3>
                <StatusBadge status={device.status} />
              </div>
              <p className="text-white/40 text-xs mb-4">{device.label} -- {device.location}</p>

              <div className="space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-white/40 font-mono">Heartbeat</span>
                  <div className="flex items-center gap-2">
                    <LiveDot isFresh={devFresh && device.status === "Active"} />
                    <span className={devFresh && device.status === "Active" ? "text-emerald-400" : "text-amber-400"}>
                      {device.status === "Offline" ? "No signal" : formatTimeAgo(device.minutesAgo)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-white/40 font-mono">Anomalies</span>
                  <span className={device.anomalyCount > 0 ? "text-amber-400 font-bold" : "text-white/60"}>
                    {device.anomalyCount}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-white/40 font-mono">CO2 (latest)</span>
                  <span className="text-emerald-400">
                    {device.co2Captured > 0 ? `${formatNumber(device.co2Captured)} kg` : "--"}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-white/40 font-mono">Energy (latest)</span>
                  <span className="text-cyan-400">
                    {device.energyUsed > 0 ? `${formatNumber(device.energyUsed)} kWh` : "--"}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-white/40 font-mono">Coordinates</span>
                  <span className="text-white/50 font-mono">
                    {device.lat.toFixed(4)}, {device.lon.toFixed(4)}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-white/40 font-mono">Uptime</span>
                  <span className={device.uptimePercent >= 95 ? "text-emerald-400" : device.uptimePercent >= 80 ? "text-amber-400" : "text-red-400"}>
                    {device.uptimePercent > 0 ? `${device.uptimePercent}%` : "--"}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-white/40 font-mono">Firmware</span>
                  <span className="text-white/50 font-mono">{device.firmwareVersion}</span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-white/40 font-mono">Calibrated</span>
                  <span className="text-white/50 font-mono">{device.calibrationDate}</span>
                </div>
              </div>
            </GlassCard>
          );
        })}
      </div>

      {/* Satellite Verification Gallery */}
      <GlassCard className="p-6">
        <h3 className="text-white/80 font-semibold text-sm mb-4">Satellite Verification Gallery</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {MOCK_DEVICES.map((device) => {
            const hasCID = device.satelliteCID.length > 0;
            const verifiedSeed = device.dacId.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
            const isVerified = hasCID && seededRandom(verifiedSeed + 300) > 0.2;
            const captureDay = seededInt(verifiedSeed + 301, 1, 15);
            return (
              <div key={device.dacId} className="bg-white/[0.03] rounded-xl p-4 border border-white/[0.04]">
                {/* Placeholder satellite image */}
                <div className="w-full h-28 bg-gradient-to-br from-emerald-900/20 to-cyan-900/20 rounded-lg mb-3 flex items-center justify-center border border-white/[0.06]">
                  {hasCID ? (
                    <svg className="h-8 w-8 text-emerald-500/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  ) : (
                    <span className="text-white/20 text-xs font-mono">No imagery</span>
                  )}
                </div>
                <p className="text-white/70 text-xs font-semibold mb-1">{device.dacId}</p>
                <p className="text-white/30 text-[10px] font-mono mb-2">
                  {device.lat.toFixed(4)}, {device.lon.toFixed(4)}
                </p>
                {hasCID ? (
                  <div className="space-y-1">
                    <div className="flex items-center gap-1">
                      <span className="text-white/30 text-[10px] font-mono">CID:</span>
                      <a
                        href={`https://ipfs.io/ipfs/${device.satelliteCID}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-purple-400/60 hover:text-purple-400 text-[10px] font-mono truncate transition-colors"
                      >
                        {device.satelliteCID.slice(0, 20)}...
                      </a>
                    </div>
                    <p className="text-white/30 text-[10px] font-mono">Captured: 2026-03-{String(captureDay).padStart(2, "0")}</p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className={`h-1.5 w-1.5 rounded-full ${isVerified ? "bg-emerald-500" : "bg-amber-500"}`} />
                      <span className={`text-[10px] font-mono ${isVerified ? "text-emerald-400" : "text-amber-400"}`}>
                        {isVerified ? "Verified" : "Pending Review"}
                      </span>
                    </div>
                  </div>
                ) : (
                  <p className="text-white/20 text-[10px] font-mono">Device offline -- no satellite data</p>
                )}
              </div>
            );
          })}
        </div>
      </GlassCard>

      {/* On-chain devices (if any loaded) */}
      {onChainDevices.length > 0 && (
        <GlassCard className="p-5">
          <h3 className="text-white/80 font-semibold text-sm mb-3">On-Chain Registered Devices</h3>
          <div className="space-y-1.5">
            {onChainDevices.map((deviceId) => (
              <div key={deviceId} className="flex items-center gap-2 text-xs font-mono text-white/60 py-1 border-b border-white/[0.04] last:border-0">
                <LiveDot isFresh={true} />
                <span>{deviceId}</span>
              </div>
            ))}
          </div>
        </GlassCard>
      )}
    </div>
  );
}

// ============================================
// Tab Content: Architecture
// ============================================

function ArchitectureTab() {
  const layers = [
    {
      id: 1,
      name: "IoT Sensors",
      description:
        "Industrial-grade sensors at each DAC facility measure CO2 extraction rates, energy consumption, temperature, pressure, and airflow in real-time. Data is cryptographically signed at the hardware level.",
      color: "emerald",
      icon: (
        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
        </svg>
      ),
    },
    {
      id: 2,
      name: "NativeIoT Oracle",
      description:
        "TerraQura's sovereign 1st-party oracle. Sensor readings are submitted directly on-chain by authorized IoT gateway nodes. No Chainlink or 3rd-party oracle dependency -- data integrity is guaranteed by hardware attestation.",
      color: "cyan",
      icon: (
        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
        </svg>
      ),
    },
    {
      id: 3,
      name: "Verification Engine",
      description:
        "Smart contract validates energy-to-CO2 ratios against thermodynamic bounds (200-600 kWh/tonne). Anomalous readings are auto-flagged, devices get suspended after 3 consecutive anomalies, and minting is blocked.",
      color: "blue",
      icon: (
        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      ),
    },
    {
      id: 4,
      name: "Carbon Credit Mint",
      description:
        "Verified readings trigger ERC-1155 carbon credit minting. Each credit is backed by real, physics-verified CO2 removal with full provenance metadata (DAC unit, timestamp, energy, satellite CID) stored on-chain.",
      color: "purple",
      icon: (
        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
      ),
    },
  ];

  const colorMap: Record<string, { border: string; bg: string; text: string }> = {
    emerald: { border: "border-l-emerald-500/50", bg: "bg-emerald-500/10", text: "text-emerald-400" },
    cyan: { border: "border-l-cyan-500/50", bg: "bg-cyan-500/10", text: "text-cyan-400" },
    blue: { border: "border-l-blue-500/50", bg: "bg-blue-500/10", text: "text-blue-400" },
    purple: { border: "border-l-purple-500/50", bg: "bg-purple-500/10", text: "text-purple-400" },
  };

  // Throughput and latency stats
  const submissionsPerHour = seededInt(700, 28, 48);
  const avgLatencyMs = seededInt(701, 120, 340);
  const p99LatencyMs = seededInt(702, 500, 900);
  const successRate = seededFloat(703, 99.2, 99.9);

  return (
    <div className="space-y-6">
      {/* Throughput & Latency Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <MetricCard label="Submissions / Hour" value={String(submissionsPerHour)} colorClass="text-emerald-400" />
        <MetricCard label="Avg Latency" value={String(avgLatencyMs)} unit="ms" colorClass="text-cyan-400" />
        <MetricCard label="P99 Latency" value={String(p99LatencyMs)} unit="ms" colorClass="text-blue-400" />
        <MetricCard label="Success Rate" value={String(successRate)} unit="%" colorClass="text-purple-400" />
      </div>

      {/* Architecture Diagram with animated arrows */}
      <div className="space-y-3">
        {layers.map((layer, i) => {
          const colors = colorMap[layer.color]!;
          return (
            <div key={layer.id}>
              <GlassCard className={`p-6 border-l-4 ${colors.border}`}>
                <div className="flex items-start gap-4">
                  <div className={`flex-shrink-0 p-2.5 rounded-xl ${colors.bg} ${colors.text}`}>
                    {layer.icon}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-white/30 text-xs font-mono">LAYER {layer.id}</span>
                      <h3 className="text-white/90 font-semibold">{layer.name}</h3>
                    </div>
                    <p className="text-white/50 text-sm leading-relaxed">{layer.description}</p>
                  </div>
                </div>
              </GlassCard>
              {i < layers.length - 1 && (
                <div className="flex justify-center py-1.5">
                  <div className="flex flex-col items-center gap-0.5">
                    <div className="w-0.5 h-2 bg-emerald-500/30 rounded-full animate-pulse" />
                    <svg className="h-4 w-4 text-emerald-500/40 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ animationDuration: "2s" }}>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                    </svg>
                    <div className="w-0.5 h-2 bg-emerald-500/30 rounded-full animate-pulse" />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Data Flow Summary */}
      <GlassCard className="p-5">
        <div className="flex items-center justify-center gap-3 sm:gap-5 text-xs font-mono text-white/50 flex-wrap">
          <span className="text-emerald-400">Sensor</span>
          <div className="flex items-center gap-1">
            <div className="w-3 h-0.5 bg-emerald-500/40 rounded animate-pulse" />
            <svg className="h-4 w-4 text-emerald-500/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
            <div className="w-3 h-0.5 bg-emerald-500/40 rounded animate-pulse" />
          </div>
          <span className="text-cyan-400">Oracle</span>
          <div className="flex items-center gap-1">
            <div className="w-3 h-0.5 bg-cyan-500/40 rounded animate-pulse" />
            <svg className="h-4 w-4 text-cyan-500/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
            <div className="w-3 h-0.5 bg-cyan-500/40 rounded animate-pulse" />
          </div>
          <span className="text-blue-400">Verify</span>
          <div className="flex items-center gap-1">
            <div className="w-3 h-0.5 bg-blue-500/40 rounded animate-pulse" />
            <svg className="h-4 w-4 text-blue-500/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
            <div className="w-3 h-0.5 bg-blue-500/40 rounded animate-pulse" />
          </div>
          <span className="text-purple-400">Mint</span>
        </div>
      </GlassCard>

      {/* Sovereign Oracle Advantage */}
      <GlassCard className="p-6">
        <h3 className="text-white/80 font-semibold mb-3">Sovereign Oracle Advantage</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <span className="text-emerald-400 text-sm mt-0.5">+</span>
              <div>
                <p className="text-white/70 text-sm font-medium">1st-Party Data</p>
                <p className="text-white/40 text-xs">No 3rd-party oracle dependency. Data comes directly from hardware-attested IoT gateways.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-emerald-400 text-sm mt-0.5">+</span>
              <div>
                <p className="text-white/70 text-sm font-medium">No Chainlink Fees</p>
                <p className="text-white/40 text-xs">Zero LINK token costs. Oracle operates natively on the Aethelred sovereign network.</p>
              </div>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <span className="text-emerald-400 text-sm mt-0.5">+</span>
              <div>
                <p className="text-white/70 text-sm font-medium">Hardware Attestation</p>
                <p className="text-white/40 text-xs">Sensor readings are cryptographically signed at the device level before submission.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-emerald-400 text-sm mt-0.5">+</span>
              <div>
                <p className="text-white/70 text-sm font-medium">Configurable Heartbeat</p>
                <p className="text-white/40 text-xs">Custom heartbeat timeout (default 15 min), anomaly thresholds, and auto-suspension after 3 flags.</p>
              </div>
            </div>
          </div>
        </div>
      </GlassCard>

      {/* Contract Configuration */}
      <GlassCard className="p-6">
        <h3 className="text-white/80 font-semibold mb-4">Oracle Contract Configuration</h3>
        <div className="space-y-2">
          {[
            { label: "Heartbeat Timeout", value: "900 seconds (15 min)" },
            { label: "Anomaly Threshold", value: "3 consecutive flags = auto-suspend" },
            { label: "Data Retention", value: "Full history on-chain, paginated access" },
            { label: "Batch Submissions", value: "Supported (multi-device in single tx)" },
            { label: "Device Registration", value: "Admin-gated (OPERATOR role required)" },
            { label: "Satellite Verification", value: "IPFS CID attached per submission" },
          ].map((item) => (
            <div
              key={item.label}
              className="flex items-center justify-between py-2 border-b border-white/[0.04] last:border-0"
            >
              <span className="text-white/40 text-sm font-mono">{item.label}</span>
              <span className="text-white/70 text-sm">{item.value}</span>
            </div>
          ))}
        </div>
      </GlassCard>
    </div>
  );
}

// ============================================
// Tab Content: Fleet Analytics
// ============================================

function FleetAnalyticsTab() {
  const activeDevices = MOCK_DEVICES.filter((d) => d.status === "Active");
  const totalFleetCO2 = MOCK_DEVICES.reduce((sum, d) => sum + d.co2Captured, 0);
  const totalFleetEnergy = MOCK_DEVICES.reduce((sum, d) => sum + d.energyUsed, 0);
  const avgUptime = activeDevices.length > 0
    ? Math.round((activeDevices.reduce((sum, d) => sum + d.uptimePercent, 0) / activeDevices.length) * 100) / 100
    : 0;
  const fleetEfficiency = totalFleetEnergy > 0 ? Math.round((totalFleetCO2 / totalFleetEnergy) * 100) / 100 : 0;

  // Regional breakdown
  const regions = useMemo(() => {
    const map = new Map<string, { devices: MockDevice[]; totalCO2: number; totalEnergy: number }>();
    MOCK_DEVICES.forEach((d) => {
      const existing = map.get(d.region) || { devices: [], totalCO2: 0, totalEnergy: 0 };
      existing.devices.push(d);
      existing.totalCO2 += d.co2Captured;
      existing.totalEnergy += d.energyUsed;
      map.set(d.region, existing);
    });
    return Array.from(map.entries()).sort((a, b) => b[1].totalCO2 - a[1].totalCO2);
  }, []);

  // Device performance ranking by efficiency (CO2/kWh)
  const ranked = useMemo(() => {
    return MOCK_DEVICES
      .filter((d) => d.energyUsed > 0)
      .map((d) => ({
        ...d,
        efficiency: Math.round((d.co2Captured / d.energyUsed) * 100) / 100,
      }))
      .sort((a, b) => b.efficiency - a.efficiency);
  }, []);

  // Monthly fleet growth (12 months, seeded)
  const monthlyGrowth = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const seed = 800 + i * 13;
      return {
        month: ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"][i]!,
        co2: seededInt(seed, 20000, 180000),
        devices: seededInt(seed + 1, 3, 8),
      };
    });
  }, []);

  const maxMonthlyCO2 = Math.max(...monthlyGrowth.map((m) => m.co2));

  // Fleet capacity utilization
  const maxCapacity = MOCK_DEVICES.length * 45000; // max CO2 per device
  const utilization = Math.round((totalFleetCO2 / maxCapacity) * 1000) / 10;

  return (
    <div className="space-y-6">
      {/* Fleet Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <MetricCard label="Fleet CO2 Captured" value={formatNumber(totalFleetCO2)} unit="kg" colorClass="text-emerald-400" />
        <MetricCard label="Avg Fleet Uptime" value={String(avgUptime)} unit="%" colorClass="text-cyan-400" />
        <MetricCard label="Fleet Efficiency" value={String(fleetEfficiency)} unit="kg/kWh" colorClass="text-blue-400" />
        <MetricCard label="Active / Total" value={`${activeDevices.length} / ${MOCK_DEVICES.length}`} colorClass="text-purple-400" />
      </div>

      {/* Fleet Capacity Utilization Gauge */}
      <GlassCard className="p-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-white/80 font-semibold text-sm">Fleet Capacity Utilization</h3>
          <span className="text-emerald-400 font-bold text-lg">{utilization}%</span>
        </div>
        <div className="w-full h-4 bg-white/[0.06] rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-600 to-emerald-400 transition-all"
            style={{ width: `${Math.min(100, utilization)}%` }}
          />
        </div>
        <div className="flex justify-between mt-2">
          <span className="text-white/30 text-[10px] font-mono">0%</span>
          <span className="text-white/30 text-[10px] font-mono">Max Capacity: {formatNumber(maxCapacity)} kg</span>
          <span className="text-white/30 text-[10px] font-mono">100%</span>
        </div>
      </GlassCard>

      {/* Regional Breakdown */}
      <GlassCard className="p-6">
        <h3 className="text-white/80 font-semibold text-sm mb-4">Regional Breakdown</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="text-left text-white/40 font-mono text-xs uppercase tracking-wider py-2 pr-4">Region</th>
                <th className="text-right text-white/40 font-mono text-xs uppercase tracking-wider py-2 px-4">Devices</th>
                <th className="text-right text-white/40 font-mono text-xs uppercase tracking-wider py-2 px-4">Total CO2 (kg)</th>
                <th className="text-right text-white/40 font-mono text-xs uppercase tracking-wider py-2 px-4">Total Energy (kWh)</th>
                <th className="text-right text-white/40 font-mono text-xs uppercase tracking-wider py-2 pl-4">Efficiency</th>
              </tr>
            </thead>
            <tbody>
              {regions.map(([region, data]) => {
                const eff = data.totalEnergy > 0 ? (data.totalCO2 / data.totalEnergy).toFixed(2) : "--";
                return (
                  <tr key={region} className="border-b border-white/[0.03]">
                    <td className="py-3 pr-4 text-white/70 font-medium">{region}</td>
                    <td className="py-3 px-4 text-right text-blue-400 font-mono">{data.devices.length}</td>
                    <td className="py-3 px-4 text-right text-emerald-400 font-mono">{formatNumber(data.totalCO2)}</td>
                    <td className="py-3 px-4 text-right text-cyan-400 font-mono">{formatNumber(data.totalEnergy)}</td>
                    <td className="py-3 pl-4 text-right text-purple-400 font-mono">{eff}</td>
                  </tr>
                );
              })}
              <tr className="border-t border-white/[0.08]">
                <td className="py-3 pr-4 text-white/90 font-bold">Total</td>
                <td className="py-3 px-4 text-right text-blue-400 font-mono font-bold">{MOCK_DEVICES.length}</td>
                <td className="py-3 px-4 text-right text-emerald-400 font-mono font-bold">{formatNumber(totalFleetCO2)}</td>
                <td className="py-3 px-4 text-right text-cyan-400 font-mono font-bold">{formatNumber(totalFleetEnergy)}</td>
                <td className="py-3 pl-4 text-right text-purple-400 font-mono font-bold">{fleetEfficiency}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </GlassCard>

      {/* Device Performance Ranking */}
      <GlassCard className="p-6">
        <h3 className="text-white/80 font-semibold text-sm mb-4">Device Performance Ranking (by Efficiency)</h3>
        <div className="space-y-3">
          {ranked.map((device, idx) => {
            const maxEff = ranked[0]?.efficiency ?? 1;
            const barPct = (device.efficiency / maxEff) * 100;
            return (
              <div key={device.dacId} className="flex items-center gap-3">
                <span className="text-white/30 text-xs font-mono w-6 flex-shrink-0">#{idx + 1}</span>
                <span className="text-white/60 text-xs font-mono w-36 flex-shrink-0 truncate">{device.dacId}</span>
                <div className="flex-1 h-5 bg-white/[0.04] rounded-full overflow-hidden relative">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-600/60 to-emerald-400/80"
                    style={{ width: `${barPct}%` }}
                  />
                  <span className="absolute right-2 top-0.5 text-[10px] font-mono text-white/60">
                    {device.efficiency} kg/kWh
                  </span>
                </div>
                <StatusBadge status={device.status} />
              </div>
            );
          })}
        </div>
      </GlassCard>

      {/* Monthly Fleet Growth Chart */}
      <GlassCard className="p-6">
        <h3 className="text-white/80 font-semibold text-sm mb-4">Monthly Fleet CO2 Capture (12 Months)</h3>
        <div className="flex items-end gap-2" style={{ height: 160 }}>
          {monthlyGrowth.map((m, i) => {
            const h = Math.max(2, (m.co2 / maxMonthlyCO2) * 100);
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-[9px] font-mono text-white/30">{formatNumber(m.co2)}</span>
                <div
                  className="w-full rounded-t-md bg-gradient-to-t from-emerald-600/60 to-emerald-400/80 hover:from-emerald-500 hover:to-emerald-300 transition-colors"
                  style={{ height: `${h}%` }}
                  title={`${m.month}: ${formatNumber(m.co2)} kg CO2, ${m.devices} devices`}
                />
                <span className="text-[10px] font-mono text-white/40">{m.month}</span>
              </div>
            );
          })}
        </div>
      </GlassCard>
    </div>
  );
}

// ============================================
// Tab Content: Anomaly Lab
// ============================================

function AnomalyLabTab() {
  const [severityFilter, setSeverityFilter] = useState<AnomalySeverity | "All">("All");
  const [statusFilter, setStatusFilter] = useState<AnomalyStatus | "All">("All");
  const [expandedAnomaly, setExpandedAnomaly] = useState<string | null>(null);

  const filteredAnomalies = useMemo(() => {
    return MOCK_ANOMALIES.filter((a) => {
      if (severityFilter !== "All" && a.severity !== severityFilter) return false;
      if (statusFilter !== "All" && a.status !== statusFilter) return false;
      return true;
    });
  }, [severityFilter, statusFilter]);

  // 3-strike rule visualization per device
  const deviceStrikeCounts = useMemo(() => {
    const counts = new Map<string, number>();
    MOCK_DEVICES.forEach((d) => counts.set(d.dacId, d.anomalyCount));
    // Also count from anomalies
    MOCK_ANOMALIES.forEach((a) => {
      if (a.status === "Open" || a.status === "Investigating") {
        counts.set(a.dacId, (counts.get(a.dacId) || 0));
      }
    });
    return counts;
  }, []);

  // Anomaly trend chart (30 days)
  const anomalyTrend = useMemo(() => {
    return Array.from({ length: 30 }, (_, i) => {
      const count = MOCK_ANOMALIES.filter((a) => a.dayIndex === i).length;
      return { day: i, count };
    });
  }, []);

  const maxTrendCount = Math.max(...anomalyTrend.map((d) => d.count), 1);

  // Summary stats
  const openCount = MOCK_ANOMALIES.filter((a) => a.status === "Open").length;
  const investigatingCount = MOCK_ANOMALIES.filter((a) => a.status === "Investigating").length;
  const criticalCount = MOCK_ANOMALIES.filter((a) => a.severity === "Critical").length;
  const resolvedCount = MOCK_ANOMALIES.filter((a) => a.status === "Resolved").length;

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <MetricCard label="Open Anomalies" value={String(openCount)} colorClass="text-red-400" />
        <MetricCard label="Investigating" value={String(investigatingCount)} colorClass="text-amber-400" />
        <MetricCard label="Critical" value={String(criticalCount)} colorClass="text-orange-400" />
        <MetricCard label="Resolved" value={String(resolvedCount)} colorClass="text-emerald-400" />
      </div>

      {/* 3-Strike Auto-Suspension Rule */}
      <GlassCard className="p-6">
        <h3 className="text-white/80 font-semibold text-sm mb-4">3-Strike Auto-Suspension Rule</h3>
        <p className="text-white/40 text-xs mb-4">Devices are automatically suspended after 3 consecutive anomaly flags. Strike count resets after manual review.</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {MOCK_DEVICES.map((device) => {
            const strikes = deviceStrikeCounts.get(device.dacId) || 0;
            return (
              <div key={device.dacId} className="bg-white/[0.03] rounded-xl p-3 border border-white/[0.04]">
                <p className="text-white/60 text-xs font-mono mb-2 truncate">{device.dacId}</p>
                <div className="flex items-center gap-1.5 mb-1">
                  {[0, 1, 2].map((s) => (
                    <div
                      key={s}
                      className={`h-3 w-3 rounded-full border ${
                        s < strikes
                          ? strikes >= 3
                            ? "bg-red-500 border-red-400"
                            : "bg-amber-500 border-amber-400"
                          : "bg-white/[0.06] border-white/[0.1]"
                      }`}
                    />
                  ))}
                  <span className="text-white/30 text-[10px] font-mono ml-1">{strikes}/3</span>
                </div>
                <p className={`text-[10px] font-mono ${strikes >= 3 ? "text-red-400" : strikes > 0 ? "text-amber-400" : "text-emerald-400"}`}>
                  {strikes >= 3 ? "AUTO-SUSPENDED" : strikes > 0 ? `${3 - strikes} strikes remaining` : "Clear"}
                </p>
              </div>
            );
          })}
        </div>
      </GlassCard>

      {/* Anomaly Trend (30 days) */}
      <GlassCard className="p-6">
        <h3 className="text-white/80 font-semibold text-sm mb-4">Anomaly Trend (30 Days)</h3>
        <div className="flex items-end gap-1" style={{ height: 80 }}>
          {anomalyTrend.map((d, i) => {
            const h = d.count > 0 ? Math.max(8, (d.count / maxTrendCount) * 100) : 2;
            return (
              <div
                key={i}
                className={`flex-1 rounded-t-sm transition-opacity hover:opacity-100 ${
                  d.count > 0 ? "bg-red-500/70 opacity-80" : "bg-white/[0.06] opacity-40"
                }`}
                style={{ height: `${h}%` }}
                title={`Day -${29 - i}: ${d.count} anomalies`}
              />
            );
          })}
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-white/20 text-[10px] font-mono">-30d</span>
          <span className="text-white/20 text-[10px] font-mono">-15d</span>
          <span className="text-white/20 text-[10px] font-mono">Today</span>
        </div>
      </GlassCard>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-white/40 text-xs font-mono">Filters:</span>
        <select
          value={severityFilter}
          onChange={(e) => setSeverityFilter(e.target.value as AnomalySeverity | "All")}
          className="bg-white/[0.04] border border-white/[0.08] rounded-lg text-white/70 text-xs px-3 py-1.5 font-mono focus:outline-none focus:border-emerald-500/30"
        >
          <option value="All">All Severity</option>
          <option value="Low">Low</option>
          <option value="Medium">Medium</option>
          <option value="High">High</option>
          <option value="Critical">Critical</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as AnomalyStatus | "All")}
          className="bg-white/[0.04] border border-white/[0.08] rounded-lg text-white/70 text-xs px-3 py-1.5 font-mono focus:outline-none focus:border-emerald-500/30"
        >
          <option value="All">All Status</option>
          <option value="Open">Open</option>
          <option value="Investigating">Investigating</option>
          <option value="Resolved">Resolved</option>
          <option value="DeviceSuspended">DeviceSuspended</option>
        </select>
        <span className="text-white/30 text-xs font-mono ml-auto">{filteredAnomalies.length} results</span>
      </div>

      {/* Anomaly List */}
      <div className="space-y-3">
        {filteredAnomalies.map((anomaly) => {
          const isExp = expandedAnomaly === anomaly.id;
          return (
            <GlassCard key={anomaly.id} className="overflow-hidden">
              <button
                onClick={() => setExpandedAnomaly(isExp ? null : anomaly.id)}
                className="w-full text-left p-4"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-white/30 text-xs font-mono">{anomaly.id}</span>
                    <SeverityBadge severity={anomaly.severity} />
                    <AnomalyStatusBadge status={anomaly.status} />
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-white/40 text-xs font-mono">{anomaly.dacId}</span>
                    <svg
                      className={`h-4 w-4 text-white/30 transition-transform ${isExp ? "rotate-180" : ""}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
                <div className="flex items-center gap-4 mt-2">
                  <span className="text-white/50 text-xs">{anomaly.metric}</span>
                  <span className="text-white/30 text-xs font-mono">{anomaly.timestamp.slice(0, 16).replace("T", " ")}</span>
                </div>
              </button>

              {isExp && (
                <div className="border-t border-white/[0.06] p-4 space-y-3">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-white/[0.03] rounded-lg p-3">
                      <p className="text-white/40 text-[10px] font-mono uppercase mb-1">Sensor Reading</p>
                      <p className="text-red-400 font-bold text-lg">{anomaly.sensorReading}</p>
                    </div>
                    <div className="bg-white/[0.03] rounded-lg p-3">
                      <p className="text-white/40 text-[10px] font-mono uppercase mb-1">Expected Min</p>
                      <p className="text-emerald-400 font-bold text-lg">{anomaly.expectedMin}</p>
                    </div>
                    <div className="bg-white/[0.03] rounded-lg p-3">
                      <p className="text-white/40 text-[10px] font-mono uppercase mb-1">Expected Max</p>
                      <p className="text-emerald-400 font-bold text-lg">{anomaly.expectedMax}</p>
                    </div>
                    <div className="bg-white/[0.03] rounded-lg p-3">
                      <p className="text-white/40 text-[10px] font-mono uppercase mb-1">Deviation</p>
                      <p className="text-amber-400 font-bold text-lg">
                        {anomaly.sensorReading > anomaly.expectedMax
                          ? `+${anomaly.sensorReading - anomaly.expectedMax}`
                          : `-${anomaly.expectedMin - anomaly.sensorReading}`}
                      </p>
                    </div>
                  </div>
                  <div className="bg-white/[0.03] rounded-lg p-3">
                    <p className="text-white/40 text-[10px] font-mono uppercase mb-1">Root Cause Analysis</p>
                    <p className="text-white/70 text-sm">{anomaly.rootCause}</p>
                  </div>
                  <div className="flex items-center gap-4 text-xs">
                    <span className="text-white/30 font-mono">Device: {anomaly.dacId}</span>
                    <span className="text-white/30 font-mono">Metric: {anomaly.metric}</span>
                    <span className="text-white/30 font-mono">Time: {anomaly.timestamp}</span>
                  </div>
                </div>
              )}
            </GlassCard>
          );
        })}
      </div>
    </div>
  );
}

// ============================================
// Tab Content: Telemetry
// ============================================

const TELEMETRY_METRICS = [
  { id: 0, name: "CO2 Capture Rate", unit: "kg/hr", color: "bg-emerald-500" },
  { id: 1, name: "Energy Consumption", unit: "kWh", color: "bg-cyan-500" },
  { id: 2, name: "Capture Efficiency", unit: "kg/kWh", color: "bg-blue-500" },
  { id: 3, name: "Temperature", unit: "C", color: "bg-orange-500" },
  { id: 4, name: "Humidity", unit: "%", color: "bg-purple-500" },
  { id: 5, name: "Pressure", unit: "hPa", color: "bg-pink-500" },
];

function TelemetryTab() {
  const [selectedDevice, setSelectedDevice] = useState(MOCK_DEVICES[0]!.dacId);

  const device = MOCK_DEVICES.find((d) => d.dacId === selectedDevice) || MOCK_DEVICES[0]!;

  // Generate 7-day telemetry for each metric
  const telemetryData = useMemo(() => {
    return TELEMETRY_METRICS.map((metric) => {
      const data = generateTelemetryData(selectedDevice, metric.id);
      const stats = computeStats(data);
      return { metric, data, stats };
    });
  }, [selectedDevice]);

  // Data quality score
  const qualitySeed = device.dacId.split("").reduce((a, c) => a + c.charCodeAt(0), 0) + 999;
  const dataQualityScore = device.status === "Offline" ? 0 : seededFloat(qualitySeed, 92, 99.8);

  return (
    <div className="space-y-6">
      {/* Device Selector */}
      <div className="flex items-center gap-4 flex-wrap">
        <span className="text-white/40 text-xs font-mono uppercase tracking-wider">Select Device:</span>
        <select
          value={selectedDevice}
          onChange={(e) => setSelectedDevice(e.target.value)}
          className="bg-white/[0.04] border border-white/[0.08] rounded-lg text-white/70 text-sm px-4 py-2 font-mono focus:outline-none focus:border-emerald-500/30 min-w-[220px]"
        >
          {MOCK_DEVICES.map((d) => (
            <option key={d.dacId} value={d.dacId}>
              {d.dacId} ({d.location})
            </option>
          ))}
        </select>
        <StatusBadge status={device.status} />
        <div className="ml-auto flex items-center gap-2">
          <span className="text-white/30 text-xs font-mono">Data Quality:</span>
          <span className={`text-sm font-bold font-mono ${dataQualityScore >= 95 ? "text-emerald-400" : dataQualityScore >= 85 ? "text-amber-400" : "text-red-400"}`}>
            {dataQualityScore > 0 ? `${dataQualityScore}%` : "--"}
          </span>
        </div>
      </div>

      {/* Device Info Bar */}
      <GlassCard className="p-4">
        <div className="flex items-center gap-6 flex-wrap text-xs">
          <div className="flex items-center gap-2">
            <LiveDot isFresh={device.minutesAgo <= 10 && device.status === "Active"} />
            <span className="text-white/60 font-mono">{device.label}</span>
          </div>
          <span className="text-white/30 font-mono">Location: {device.location}</span>
          <span className="text-white/30 font-mono">Lat: {device.lat.toFixed(4)}, Lon: {device.lon.toFixed(4)}</span>
          <span className="text-white/30 font-mono">Firmware: {device.firmwareVersion}</span>
          <span className="text-white/30 font-mono">Last seen: {formatTimeAgo(device.minutesAgo)}</span>
        </div>
      </GlassCard>

      {/* Telemetry Charts for Each Metric */}
      {telemetryData.map(({ metric, data, stats }) => (
        <GlassCard key={metric.id} className="p-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-white/80 font-semibold text-sm">
              {metric.name}
              <span className="text-white/30 font-normal ml-2 text-xs">({metric.unit})</span>
            </h3>
            <span className="text-white/30 text-[10px] font-mono">7 days, 168 data points</span>
          </div>

          {/* CSS Bar Chart */}
          <div className="flex items-end gap-px" style={{ height: 64 }}>
            {data.map((val, i) => {
              const maxV = stats.max || 1;
              const h = Math.max(1, (val / maxV) * 100);
              return (
                <div
                  key={i}
                  className={`flex-1 rounded-t-sm ${metric.color} opacity-60 hover:opacity-100 transition-opacity`}
                  style={{ height: `${h}%` }}
                  title={`Hour ${i}: ${val} ${metric.unit}`}
                />
              );
            })}
          </div>
          <div className="flex justify-between mt-1 mb-4">
            <span className="text-white/20 text-[10px] font-mono">-7d</span>
            <span className="text-white/20 text-[10px] font-mono">-3.5d</span>
            <span className="text-white/20 text-[10px] font-mono">Now</span>
          </div>

          {/* Statistical Summary */}
          <div className="grid grid-cols-4 gap-3">
            <div className="bg-white/[0.03] rounded-lg p-2.5">
              <p className="text-white/40 text-[10px] font-mono uppercase mb-0.5">Min</p>
              <p className="text-white/70 font-bold text-sm font-mono">{stats.min}</p>
            </div>
            <div className="bg-white/[0.03] rounded-lg p-2.5">
              <p className="text-white/40 text-[10px] font-mono uppercase mb-0.5">Max</p>
              <p className="text-white/70 font-bold text-sm font-mono">{stats.max}</p>
            </div>
            <div className="bg-white/[0.03] rounded-lg p-2.5">
              <p className="text-white/40 text-[10px] font-mono uppercase mb-0.5">Average</p>
              <p className="text-emerald-400 font-bold text-sm font-mono">{stats.avg}</p>
            </div>
            <div className="bg-white/[0.03] rounded-lg p-2.5">
              <p className="text-white/40 text-[10px] font-mono uppercase mb-0.5">Std Dev</p>
              <p className="text-amber-400 font-bold text-sm font-mono">{stats.stdDev}</p>
            </div>
          </div>
        </GlassCard>
      ))}
    </div>
  );
}

// ============================================
// Tab Content: Compliance
// ============================================

function ComplianceTab() {
  // SLA target: every 15 minutes
  const slaTarget = 15; // minutes
  const totalExpectedDaily = Math.floor(1440 / slaTarget); // 96 per device per day
  const totalDevicesActive = MOCK_DEVICES.filter((d) => d.status === "Active").length;

  // Per-device compliance data
  const deviceCompliance = useMemo(() => {
    return MOCK_DEVICES.map((device, idx) => {
      const seed = 900 + idx * 17;
      const isActive = device.status === "Active";
      const last30DaysSubmissions = isActive ? seededInt(seed, 2600, 2880) : device.status === "Suspended" ? seededInt(seed, 1200, 1800) : 0;
      const expected30Days = 2880; // 96 per day * 30
      const availability = isActive ? Math.round((last30DaysSubmissions / expected30Days) * 10000) / 100 : device.status === "Suspended" ? Math.round((last30DaysSubmissions / expected30Days) * 10000) / 100 : 0;
      const missedSubmissions = expected30Days - last30DaysSubmissions;
      const integrityVerified = isActive && seededRandom(seed + 1) > 0.1;
      const avgFrequencyMin = isActive ? seededFloat(seed + 2, 13.5, 16.0) : 0;
      return {
        ...device,
        last30DaysSubmissions,
        expected30Days,
        availability,
        missedSubmissions: Math.max(0, missedSubmissions),
        integrityVerified,
        avgFrequencyMin,
      };
    });
  }, []);

  const totalSubmissions30d = deviceCompliance.reduce((s, d) => s + d.last30DaysSubmissions, 0);
  const totalExpected30d = deviceCompliance.reduce((s, d) => s + d.expected30Days, 0);
  const overallAvailability = totalExpected30d > 0 ? Math.round((totalSubmissions30d / totalExpected30d) * 10000) / 100 : 0;
  const slaCompliantDevices = deviceCompliance.filter((d) => d.availability >= 95).length;
  const avgFrequencyAll = deviceCompliance.filter((d) => d.avgFrequencyMin > 0).reduce((s, d) => s + d.avgFrequencyMin, 0) / (totalDevicesActive || 1);

  return (
    <div className="space-y-6">
      {/* Summary Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <MetricCard label="Overall Availability" value={`${overallAvailability}`} unit="%" colorClass="text-emerald-400" />
        <MetricCard label="SLA Compliant" value={`${slaCompliantDevices}/${MOCK_DEVICES.length}`} unit="devices" colorClass="text-cyan-400" />
        <MetricCard label="Avg Frequency" value={`${Math.round(avgFrequencyAll * 10) / 10}`} unit="min" colorClass="text-blue-400" />
        <MetricCard label="SLA Target" value={String(slaTarget)} unit="min" colorClass="text-purple-400" />
      </div>

      {/* Data Submission Frequency Stats */}
      <GlassCard className="p-6">
        <h3 className="text-white/80 font-semibold text-sm mb-4">Data Submission Frequency</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
          <div className="bg-white/[0.03] rounded-lg p-3">
            <p className="text-white/40 text-[10px] font-mono uppercase mb-1">Target Interval</p>
            <p className="text-white/70 font-bold text-lg">15 <span className="text-xs text-white/30">min</span></p>
          </div>
          <div className="bg-white/[0.03] rounded-lg p-3">
            <p className="text-white/40 text-[10px] font-mono uppercase mb-1">Daily per Device</p>
            <p className="text-white/70 font-bold text-lg">{totalExpectedDaily}</p>
          </div>
          <div className="bg-white/[0.03] rounded-lg p-3">
            <p className="text-white/40 text-[10px] font-mono uppercase mb-1">30-Day Total</p>
            <p className="text-emerald-400 font-bold text-lg">{formatNumber(totalSubmissions30d)}</p>
          </div>
          <div className="bg-white/[0.03] rounded-lg p-3">
            <p className="text-white/40 text-[10px] font-mono uppercase mb-1">30-Day Expected</p>
            <p className="text-white/70 font-bold text-lg">{formatNumber(totalExpected30d)}</p>
          </div>
        </div>
      </GlassCard>

      {/* Per-Device Compliance Tracking */}
      <GlassCard className="p-6">
        <h3 className="text-white/80 font-semibold text-sm mb-4">Per-Device Compliance</h3>
        <div className="space-y-4">
          {deviceCompliance.map((device) => (
            <div key={device.dacId} className="bg-white/[0.02] rounded-xl p-4 border border-white/[0.04]">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span className="text-white/70 text-sm font-mono font-semibold">{device.dacId}</span>
                  <StatusBadge status={device.status} />
                </div>
                <div className="flex items-center gap-2">
                  {device.integrityVerified ? (
                    <span className="text-emerald-400 text-[10px] font-mono flex items-center gap-1">
                      <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Integrity Verified
                    </span>
                  ) : (
                    <span className="text-red-400 text-[10px] font-mono">Unverified</span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-3">
                <div>
                  <p className="text-white/30 text-[10px] font-mono uppercase">Availability</p>
                  <p className={`font-bold text-sm ${device.availability >= 95 ? "text-emerald-400" : device.availability >= 80 ? "text-amber-400" : "text-red-400"}`}>
                    {device.availability}%
                  </p>
                </div>
                <div>
                  <p className="text-white/30 text-[10px] font-mono uppercase">Submissions</p>
                  <p className="text-white/70 font-bold text-sm">{formatNumber(device.last30DaysSubmissions)}</p>
                </div>
                <div>
                  <p className="text-white/30 text-[10px] font-mono uppercase">Missed</p>
                  <p className={`font-bold text-sm ${device.missedSubmissions > 100 ? "text-red-400" : "text-white/50"}`}>
                    {formatNumber(device.missedSubmissions)}
                  </p>
                </div>
                <div>
                  <p className="text-white/30 text-[10px] font-mono uppercase">Avg Freq</p>
                  <p className="text-white/70 font-bold text-sm">
                    {device.avgFrequencyMin > 0 ? `${device.avgFrequencyMin} min` : "--"}
                  </p>
                </div>
                <div>
                  <p className="text-white/30 text-[10px] font-mono uppercase">SLA Status</p>
                  <p className={`font-bold text-sm ${device.availability >= 95 ? "text-emerald-400" : "text-red-400"}`}>
                    {device.availability >= 95 ? "PASS" : "FAIL"}
                  </p>
                </div>
              </div>

              <ProgressBar
                value={device.last30DaysSubmissions}
                max={device.expected30Days}
                colorClass={device.availability >= 95 ? "bg-emerald-500" : device.availability >= 80 ? "bg-amber-500" : "bg-red-500"}
              />
            </div>
          ))}
        </div>
      </GlassCard>

      {/* Certificate of Compliance (Mock) */}
      <GlassCard className="p-6">
        <h3 className="text-white/80 font-semibold text-sm mb-4">Certificates of Compliance</h3>
        <p className="text-white/40 text-xs mb-4">Each device's 30-day data availability report, aligned with MRV (Measurement, Reporting, Verification) standards.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {deviceCompliance.map((device) => {
            const certSeed = device.dacId.split("").reduce((a, c) => a + c.charCodeAt(0), 0) + 1500;
            const certId = `CERT-TQ-${seededInt(certSeed, 100000, 999999)}`;
            const issuedDate = "2026-03-17";
            const periodStart = "2026-02-15";
            const periodEnd = "2026-03-16";
            return (
              <div
                key={device.dacId}
                className="bg-gradient-to-br from-white/[0.03] to-white/[0.01] rounded-xl p-5 border border-white/[0.06] relative overflow-hidden"
              >
                {/* Watermark */}
                <div className="absolute top-2 right-2 text-white/[0.03] text-6xl font-extrabold pointer-events-none select-none rotate-[-15deg]">
                  MRV
                </div>

                <div className="flex items-center justify-between mb-3">
                  <span className="text-white/50 text-[10px] font-mono">{certId}</span>
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                    device.availability >= 95
                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                      : "bg-red-500/10 text-red-400 border-red-500/20"
                  }`}>
                    {device.availability >= 95 ? "COMPLIANT" : "NON-COMPLIANT"}
                  </span>
                </div>

                <h4 className="text-white/80 font-semibold text-sm mb-1">{device.dacId}</h4>
                <p className="text-white/40 text-xs mb-3">{device.label} -- {device.location}</p>

                <div className="space-y-1.5 mb-3">
                  <div className="flex justify-between text-xs">
                    <span className="text-white/30 font-mono">Period</span>
                    <span className="text-white/50 font-mono">{periodStart} to {periodEnd}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-white/30 font-mono">Data Availability</span>
                    <span className={`font-mono font-bold ${device.availability >= 95 ? "text-emerald-400" : "text-red-400"}`}>
                      {device.availability}%
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-white/30 font-mono">Submissions</span>
                    <span className="text-white/50 font-mono">{formatNumber(device.last30DaysSubmissions)} / {formatNumber(device.expected30Days)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-white/30 font-mono">Integrity</span>
                    <span className={`font-mono ${device.integrityVerified ? "text-emerald-400" : "text-red-400"}`}>
                      {device.integrityVerified ? "Verified" : "Unverified"}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-white/30 font-mono">Issued</span>
                    <span className="text-white/50 font-mono">{issuedDate}</span>
                  </div>
                </div>

                <div className="border-t border-white/[0.06] pt-2.5">
                  <p className="text-white/20 text-[10px] font-mono">
                    MRV Framework: ISO 14064-2 aligned | Verification: Hardware-attested IoT telemetry
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </GlassCard>

      {/* Regulatory Framework Alignment */}
      <GlassCard className="p-6">
        <h3 className="text-white/80 font-semibold text-sm mb-4">Regulatory Framework Alignment</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="h-2 w-2 rounded-full bg-emerald-500 mt-1.5 flex-shrink-0" />
              <div>
                <p className="text-white/70 text-sm font-medium">Measurement</p>
                <p className="text-white/40 text-xs">Real-time IoT sensor data from hardware-attested DAC devices. 6 metrics captured per reading: CO2, energy, temperature, humidity, pressure, efficiency.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="h-2 w-2 rounded-full bg-cyan-500 mt-1.5 flex-shrink-0" />
              <div>
                <p className="text-white/70 text-sm font-medium">Reporting</p>
                <p className="text-white/40 text-xs">Automated on-chain submission every 15 minutes. Full audit trail with block numbers, transaction hashes, and IPFS satellite verification CIDs.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="h-2 w-2 rounded-full bg-blue-500 mt-1.5 flex-shrink-0" />
              <div>
                <p className="text-white/70 text-sm font-medium">Verification</p>
                <p className="text-white/40 text-xs">Smart contract validates energy-to-CO2 ratios against thermodynamic bounds. Anomaly detection with 3-strike auto-suspension. Satellite imagery cross-reference.</p>
              </div>
            </div>
          </div>
          <div className="space-y-3">
            <div className="bg-white/[0.03] rounded-lg p-4 space-y-2">
              <p className="text-white/50 text-xs font-mono uppercase tracking-wider">Standards Alignment</p>
              {[
                { standard: "ISO 14064-2", status: "Aligned", ok: true },
                { standard: "Verra VCS (VM0044)", status: "Aligned", ok: true },
                { standard: "Gold Standard CDM", status: "Aligned", ok: true },
                { standard: "ICAO CORSIA", status: "In Progress", ok: false },
                { standard: "EU ETS MRV", status: "Aligned", ok: true },
                { standard: "Article 6.4 (Paris Agreement)", status: "In Progress", ok: false },
              ].map((item) => (
                <div key={item.standard} className="flex items-center justify-between text-xs">
                  <span className="text-white/50">{item.standard}</span>
                  <span className={`font-mono ${item.ok ? "text-emerald-400" : "text-amber-400"}`}>
                    {item.status}
                  </span>
                </div>
              ))}
            </div>
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
  { id: "live", label: "Live Feed" },
  { id: "devices", label: "Device Status" },
  { id: "architecture", label: "Architecture" },
  { id: "fleet", label: "Fleet Analytics" },
  { id: "anomaly", label: "Anomaly Lab" },
  { id: "telemetry", label: "Telemetry" },
  { id: "compliance", label: "Compliance" },
];

export function OracleDashboardContent() {
  const [activeTab, setActiveTab] = useState("live");

  return (
    <div className="min-h-screen bg-[#060A13] flex flex-col">
      <TopNav />
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-8">
        <SectionHeader
          title="NativeIoT Oracle"
          description="Sovereign 1st-party oracle streaming live IoT telemetry from DAC facilities. Physics-validated, hardware-attested, no Chainlink dependency."
        />
        <Tabs tabs={TABS} activeTab={activeTab} onChange={setActiveTab} />
        <div className="mt-6">
          {activeTab === "live" && <LiveFeedTab />}
          {activeTab === "devices" && <DeviceStatusTab />}
          {activeTab === "architecture" && <ArchitectureTab />}
          {activeTab === "fleet" && <FleetAnalyticsTab />}
          {activeTab === "anomaly" && <AnomalyLabTab />}
          {activeTab === "telemetry" && <TelemetryTab />}
          {activeTab === "compliance" && <ComplianceTab />}
        </div>
      </main>
      <DAppFooter />
    </div>
  );
}
