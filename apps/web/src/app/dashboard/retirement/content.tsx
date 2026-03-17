/**
 * TerraQura Retirement Center
 *
 * Certificate gallery, credit retirement wizard, corporate offsetting portal,
 * and public verification for retired carbon credits.
 *
 * @version 1.0.0
 */

"use client";

import { useState } from "react";
import {
  Award, Flame, FileCheck, Globe, CheckCircle,
  Search, Download, QrCode, Share2,
  Building2, BarChart3, Target, Leaf, ArrowRight, ArrowLeft,
  TrendingDown, ShieldCheck, Hash, Layers,
} from "lucide-react";

import { useApp } from "@/contexts/AppContext";
import {
  TopNav,
  DAppFooter,
  GlassCard,
  MetricCard,
  StatusBadge,
  SectionHeader,
  Tabs,
  ConnectWalletPrompt,
  ProgressBar,
  StepWizard,
  CopyButton,
  SelectFilter,
} from "@/components/dapp/SharedComponents";

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

function seededFloat(seed: number, min: number, max: number, decimals: number): string {
  const val = min + seededRandom(seed) * (max - min);
  return val.toFixed(decimals);
}

// ─── Tab Definitions ─────────────────────────────────────────
const RETIREMENT_TABS = [
  { id: "certificates", label: "Certificate Gallery", icon: Award },
  { id: "retire", label: "Retire Credits", icon: Flame },
  { id: "corporate", label: "Corporate Portal", icon: Building2 },
  { id: "verify", label: "Public Verification", icon: Globe },
];

// ─── Certificate Data ────────────────────────────────────────
interface RetirementCertificate {
  tokenId: number;
  co2Amount: number;
  retiredAt: string;
  beneficiary: string;
  organization: string;
  reason: string;
  dacUnit: string;
  vintage: number;
  txHash: string;
}

const MOCK_CERTIFICATES: RetirementCertificate[] = [
  {
    tokenId: seededInt(101, 100, 500),
    co2Amount: Number(seededFloat(102, 1.2, 3.8, 2)),
    retiredAt: "2026-01-15",
    beneficiary: "Ahmad Al-Rashid",
    organization: "Green Gulf Holdings",
    reason: "Corporate Offsetting",
    dacUnit: `DAC-${String(seededInt(103, 1, 50)).padStart(3, "0")}`,
    vintage: 2025,
    txHash: `0x${seededHex(104, 64)}`,
  },
  {
    tokenId: seededInt(201, 100, 500),
    co2Amount: Number(seededFloat(202, 0.8, 2.5, 2)),
    retiredAt: "2026-01-28",
    beneficiary: "Sara Chen",
    organization: "Pacific Sustainability Corp",
    reason: "Voluntary Offset",
    dacUnit: `DAC-${String(seededInt(203, 1, 50)).padStart(3, "0")}`,
    vintage: 2025,
    txHash: `0x${seededHex(204, 64)}`,
  },
  {
    tokenId: seededInt(301, 100, 500),
    co2Amount: Number(seededFloat(302, 2.0, 4.5, 2)),
    retiredAt: "2026-02-05",
    beneficiary: "Marcus Weber",
    organization: "Lufthansa Cargo AG",
    reason: "Regulatory Compliance",
    dacUnit: `DAC-${String(seededInt(303, 1, 50)).padStart(3, "0")}`,
    vintage: 2025,
    txHash: `0x${seededHex(304, 64)}`,
  },
  {
    tokenId: seededInt(401, 100, 500),
    co2Amount: Number(seededFloat(402, 0.5, 1.5, 2)),
    retiredAt: "2026-02-14",
    beneficiary: "Yuki Tanaka",
    organization: "Personal",
    reason: "Gift/Donation",
    dacUnit: `DAC-${String(seededInt(403, 1, 50)).padStart(3, "0")}`,
    vintage: 2026,
    txHash: `0x${seededHex(404, 64)}`,
  },
  {
    tokenId: seededInt(501, 100, 500),
    co2Amount: Number(seededFloat(502, 1.8, 3.2, 2)),
    retiredAt: "2026-02-28",
    beneficiary: "Elena Kowalski",
    organization: "Nordic Green Fund",
    reason: "Voluntary Offset",
    dacUnit: `DAC-${String(seededInt(503, 1, 50)).padStart(3, "0")}`,
    vintage: 2025,
    txHash: `0x${seededHex(504, 64)}`,
  },
  {
    tokenId: seededInt(601, 100, 500),
    co2Amount: Number(seededFloat(602, 1.0, 2.8, 2)),
    retiredAt: "2026-03-10",
    beneficiary: "James Okafor",
    organization: "West Africa Carbon Initiative",
    reason: "Corporate Offsetting",
    dacUnit: `DAC-${String(seededInt(603, 1, 50)).padStart(3, "0")}`,
    vintage: 2026,
    txHash: `0x${seededHex(604, 64)}`,
  },
];

const TOTAL_RETIRED = MOCK_CERTIFICATES.reduce((sum, c) => sum + c.co2Amount, 0);

// ─── Portfolio Data (for retire step) ────────────────────────
interface PortfolioToken {
  tokenId: number;
  balance: number;
  purity: number;
  dacUnit: string;
  vintage: number;
}

const PORTFOLIO_TOKENS: PortfolioToken[] = [
  { tokenId: seededInt(710, 100, 500), balance: seededInt(711, 50, 200), purity: seededInt(712, 92, 99), dacUnit: `DAC-${String(seededInt(713, 1, 50)).padStart(3, "0")}`, vintage: 2025 },
  { tokenId: seededInt(720, 100, 500), balance: seededInt(721, 30, 150), purity: seededInt(722, 90, 98), dacUnit: `DAC-${String(seededInt(723, 1, 50)).padStart(3, "0")}`, vintage: 2025 },
  { tokenId: seededInt(730, 100, 500), balance: seededInt(731, 80, 300), purity: seededInt(732, 94, 99), dacUnit: `DAC-${String(seededInt(733, 1, 50)).padStart(3, "0")}`, vintage: 2026 },
  { tokenId: seededInt(740, 100, 500), balance: seededInt(741, 20, 100), purity: seededInt(742, 88, 96), dacUnit: `DAC-${String(seededInt(743, 1, 50)).padStart(3, "0")}`, vintage: 2025 },
  { tokenId: seededInt(750, 100, 500), balance: seededInt(751, 60, 250), purity: seededInt(752, 91, 97), dacUnit: `DAC-${String(seededInt(753, 1, 50)).padStart(3, "0")}`, vintage: 2026 },
];

// ─── Recent Retirements ──────────────────────────────────────
interface RecentRetirement {
  txHash: string;
  amount: number;
  date: string;
  beneficiary: string;
  reason: string;
}

const RECENT_RETIREMENTS: RecentRetirement[] = [
  { txHash: `0x${seededHex(810, 64)}`, amount: Number(seededFloat(811, 0.5, 3.0, 2)), date: "2026-03-15", beneficiary: "TerraGreen Ltd", reason: "Corporate Offsetting" },
  { txHash: `0x${seededHex(820, 64)}`, amount: Number(seededFloat(821, 0.2, 1.5, 2)), date: "2026-03-14", beneficiary: "Personal Offset", reason: "Voluntary Offset" },
  { txHash: `0x${seededHex(830, 64)}`, amount: Number(seededFloat(831, 1.0, 4.0, 2)), date: "2026-03-12", beneficiary: "AeroCarbon Inc", reason: "Regulatory Compliance" },
  { txHash: `0x${seededHex(840, 64)}`, amount: Number(seededFloat(841, 0.3, 1.0, 2)), date: "2026-03-10", beneficiary: "Climate Gift Fund", reason: "Gift/Donation" },
  { txHash: `0x${seededHex(850, 64)}`, amount: Number(seededFloat(851, 0.8, 2.5, 2)), date: "2026-03-08", beneficiary: "NordicStar Energy", reason: "Voluntary Offset" },
];

// ─── Retirement Reasons ──────────────────────────────────────
const RETIREMENT_REASONS = [
  { value: "corporate", label: "Corporate Offsetting" },
  { value: "voluntary", label: "Voluntary Offset" },
  { value: "regulatory", label: "Regulatory Compliance" },
  { value: "gift", label: "Gift/Donation" },
  { value: "custom", label: "Custom Reason" },
];

// ─── Tab Content Components ──────────────────────────────────

function CertificateGalleryTab() {
  const [yearFilter, setYearFilter] = useState("all");
  const [dacFilter, setDacFilter] = useState("all");

  const uniqueYears = [...new Set(MOCK_CERTIFICATES.map((c) => String(c.vintage)))];
  const uniqueDacs = [...new Set(MOCK_CERTIFICATES.map((c) => c.dacUnit))];

  const filtered = MOCK_CERTIFICATES.filter((c) => {
    if (yearFilter !== "all" && String(c.vintage) !== yearFilter) return false;
    if (dacFilter !== "all" && c.dacUnit !== dacFilter) return false;
    return true;
  });

  return (
    <div className="space-y-8">
      {/* Total Retired Banner */}
      <GlassCard className="p-6 border-emerald-500/20 bg-gradient-to-r from-emerald-500/[0.04] to-transparent">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-emerald-500/10 rounded-2xl">
              <Leaf className="w-8 h-8 text-emerald-400" />
            </div>
            <div>
              <p className="text-sm text-white/40">Total CO2 Permanently Removed</p>
              <p className="text-3xl font-bold text-emerald-400">
                {TOTAL_RETIRED.toFixed(1)} <span className="text-lg text-emerald-400/60 font-normal">tonnes CO2</span>
              </p>
            </div>
          </div>
          <StatusBadge status="Verified" />
        </div>
      </GlassCard>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 p-3 bg-white/[0.03] backdrop-blur-sm border border-white/[0.06] rounded-xl">
        <SelectFilter
          label="Year"
          options={[{ value: "all", label: "All Years" }, ...uniqueYears.map((y) => ({ value: y, label: y }))]}
          value={yearFilter}
          onChange={setYearFilter}
        />
        <SelectFilter
          label="DAC Unit"
          options={[{ value: "all", label: "All DAC Units" }, ...uniqueDacs.map((d) => ({ value: d, label: d }))]}
          value={dacFilter}
          onChange={setDacFilter}
        />
      </div>

      {/* Certificate Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((cert) => (
          <div
            key={cert.txHash}
            className="relative bg-gradient-to-br from-emerald-500/[0.04] to-white/[0.02] border-2 border-emerald-500/20 rounded-2xl p-6 overflow-hidden hover:border-emerald-500/30 transition-all"
          >
            {/* Watermark */}
            <div className="absolute top-4 right-4 text-emerald-500/[0.07] text-6xl font-black select-none pointer-events-none">
              TQ
            </div>

            {/* Header */}
            <div className="flex items-center gap-3 mb-5">
              <div className="p-2 bg-emerald-500/10 rounded-xl">
                <CheckCircle className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Carbon Retirement Certificate</h3>
                <p className="text-[10px] text-white/30 uppercase tracking-wider">TerraQura Verified</p>
              </div>
            </div>

            <div className="space-y-2.5">
              <div className="flex justify-between">
                <span className="text-xs text-white/40">Token ID</span>
                <span className="text-xs text-white/70 font-mono">#{cert.tokenId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-white/40">CO2 Retired</span>
                <span className="text-sm font-bold text-emerald-400">{cert.co2Amount} tonnes</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-white/40">Retirement Date</span>
                <span className="text-xs text-white/70">{cert.retiredAt}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-white/40">Beneficiary</span>
                <span className="text-xs text-white/70">{cert.beneficiary}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-white/40">Organization</span>
                <span className="text-xs text-white/70">{cert.organization}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-white/40">Reason</span>
                <span className="text-xs text-white/70">{cert.reason}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-white/40">DAC Unit</span>
                <span className="text-xs text-white/70 font-mono">{cert.dacUnit}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-white/40">Vintage</span>
                <span className="text-xs text-white/70">{cert.vintage}</span>
              </div>

              <hr className="border-white/[0.06]" />

              <div className="flex items-center justify-between">
                <span className="text-[10px] text-white/30 font-mono">
                  {cert.txHash.slice(0, 10)}...{cert.txHash.slice(-8)}
                </span>
                <CopyButton text={cert.txHash} />
              </div>

              {/* Verified Badge */}
              <div className="flex items-center justify-center gap-1.5 py-2 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-[11px] text-emerald-400 font-medium">Verified on Aethelred Blockchain</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RetireCreditsTab() {
  const [step, setStep] = useState(0);
  const [selectedTokens, setSelectedTokens] = useState<Record<number, number>>({});
  const [beneficiaryName, setBeneficiaryName] = useState("");
  const [organization, setOrganization] = useState("");
  const [reason, setReason] = useState("corporate");
  const [customReason, setCustomReason] = useState("");
  const [isRetired, setIsRetired] = useState(false);

  const totalSelected = Object.entries(selectedTokens).reduce((sum, [, qty]) => sum + qty, 0);
  const totalCO2 = Object.entries(selectedTokens).reduce((sum, [tokenIdStr, qty]) => {
    const token = PORTFOLIO_TOKENS.find((t) => t.tokenId === Number(tokenIdStr));
    return sum + (token ? qty * 0.01 : 0); // each unit ~0.01 tCO2
  }, 0);

  const retirementFee = totalCO2 * 0.025; // 2.5% fee
  const reasonLabel = reason === "custom" ? customReason : RETIREMENT_REASONS.find((r) => r.value === reason)?.label || reason;

  function handleTokenSelect(tokenId: number, qty: number) {
    setSelectedTokens((prev) => {
      const updated = { ...prev };
      if (qty <= 0) {
        delete updated[tokenId];
      } else {
        updated[tokenId] = qty;
      }
      return updated;
    });
  }

  function handleRetire() {
    setIsRetired(true);
  }

  function handleReset() {
    setStep(0);
    setSelectedTokens({});
    setBeneficiaryName("");
    setOrganization("");
    setReason("corporate");
    setCustomReason("");
    setIsRetired(false);
  }

  return (
    <div className="space-y-8">
      {/* Step Wizard */}
      <div className="flex justify-center">
        <StepWizard
          steps={["Select Credits", "Details", "Review", "Confirmation"]}
          currentStep={isRetired ? 3 : step}
        />
      </div>

      {/* Step 1: Select Credits */}
      {step === 0 && !isRetired && (
        <div className="space-y-4">
          <SectionHeader
            title="Select Credits from Portfolio"
            description="Choose carbon credits to retire permanently"
          />
          <div className="space-y-3">
            {PORTFOLIO_TOKENS.map((token) => {
              const selected = selectedTokens[token.tokenId] || 0;
              return (
                <GlassCard
                  key={token.tokenId}
                  className={`p-5 transition-all ${selected > 0 ? "border-emerald-500/30" : ""}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`p-2 rounded-xl ${selected > 0 ? "bg-emerald-500/10" : "bg-white/[0.05]"}`}>
                        <Layers className={`w-5 h-5 ${selected > 0 ? "text-emerald-400" : "text-white/40"}`} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium text-white text-sm">Token #{token.tokenId}</h4>
                          <span className="text-[10px] px-2 py-0.5 bg-white/[0.05] border border-white/[0.08] rounded-full text-white/40 font-mono">
                            {token.dacUnit}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-xs text-white/40">Balance: <span className="text-white/60 font-mono">{token.balance}</span></span>
                          <span className="text-xs text-white/40">Purity: <span className="text-emerald-400/80 font-mono">{token.purity}%</span></span>
                          <span className="text-xs text-white/40">Vintage: <span className="text-white/60">{token.vintage}</span></span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <input
                        type="number"
                        min={0}
                        max={token.balance}
                        value={selected}
                        onChange={(e) => handleTokenSelect(token.tokenId, Math.min(Number(e.target.value), token.balance))}
                        className="w-24 px-3 py-2 bg-white/[0.05] border border-white/[0.08] rounded-lg text-sm text-white/70 font-mono text-right focus:outline-none focus:border-emerald-500/30"
                        placeholder="0"
                      />
                    </div>
                  </div>
                </GlassCard>
              );
            })}
          </div>

          {totalSelected > 0 && (
            <GlassCard className="p-4 border-emerald-500/20">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-white/60">Selected: <span className="text-white font-medium">{totalSelected} credits</span></p>
                  <p className="text-xs text-white/40">Estimated CO2 impact: <span className="text-emerald-400">{totalCO2.toFixed(3)} tonnes</span></p>
                </div>
                <button
                  onClick={() => setStep(1)}
                  className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-xl text-sm font-medium hover:bg-emerald-500/15 transition"
                >
                  Continue
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </GlassCard>
          )}
        </div>
      )}

      {/* Step 2: Retirement Details */}
      {step === 1 && !isRetired && (
        <div className="space-y-6">
          <SectionHeader
            title="Retirement Details"
            description="Provide information for your retirement certificate"
          />
          <GlassCard className="p-6 space-y-5">
            <div>
              <label className="block text-xs text-white/40 uppercase tracking-wider mb-2">Beneficiary Name</label>
              <input
                type="text"
                value={beneficiaryName}
                onChange={(e) => setBeneficiaryName(e.target.value)}
                placeholder="Enter beneficiary name"
                className="w-full px-4 py-3 bg-white/[0.05] border border-white/[0.08] rounded-xl text-sm text-white/80 placeholder-white/30 focus:outline-none focus:border-emerald-500/30 transition"
              />
            </div>
            <div>
              <label className="block text-xs text-white/40 uppercase tracking-wider mb-2">Organization</label>
              <input
                type="text"
                value={organization}
                onChange={(e) => setOrganization(e.target.value)}
                placeholder="Enter organization name (optional)"
                className="w-full px-4 py-3 bg-white/[0.05] border border-white/[0.08] rounded-xl text-sm text-white/80 placeholder-white/30 focus:outline-none focus:border-emerald-500/30 transition"
              />
            </div>
            <div>
              <label className="block text-xs text-white/40 uppercase tracking-wider mb-2">Retirement Reason</label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full px-4 py-3 bg-white/[0.05] border border-white/[0.08] rounded-xl text-sm text-white/80 focus:outline-none focus:border-emerald-500/30 transition appearance-none cursor-pointer"
              >
                {RETIREMENT_REASONS.map((r) => (
                  <option key={r.value} value={r.value} className="bg-midnight-900 text-white">{r.label}</option>
                ))}
              </select>
            </div>
            {reason === "custom" && (
              <div>
                <label className="block text-xs text-white/40 uppercase tracking-wider mb-2">Custom Reason</label>
                <input
                  type="text"
                  value={customReason}
                  onChange={(e) => setCustomReason(e.target.value)}
                  placeholder="Describe your retirement reason"
                  className="w-full px-4 py-3 bg-white/[0.05] border border-white/[0.08] rounded-xl text-sm text-white/80 placeholder-white/30 focus:outline-none focus:border-emerald-500/30 transition"
                />
              </div>
            )}
          </GlassCard>

          <div className="flex items-center justify-between">
            <button
              onClick={() => setStep(0)}
              className="flex items-center gap-2 px-5 py-2.5 text-white/50 hover:text-white/70 text-sm transition"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
            <button
              onClick={() => setStep(2)}
              disabled={!beneficiaryName.trim()}
              className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-xl text-sm font-medium hover:bg-emerald-500/15 transition disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Review
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Review */}
      {step === 2 && !isRetired && (
        <div className="space-y-6">
          <SectionHeader
            title="Review Retirement"
            description="Confirm the details of your carbon credit retirement"
          />
          <GlassCard className="p-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-white/[0.03] rounded-xl p-4 border border-white/[0.06]">
                <p className="text-[10px] text-white/30 uppercase tracking-wider mb-1">Credits to Retire</p>
                <p className="text-xl font-bold text-white">{totalSelected} <span className="text-sm text-white/40 font-normal">credits</span></p>
              </div>
              <div className="bg-white/[0.03] rounded-xl p-4 border border-white/[0.06]">
                <p className="text-[10px] text-white/30 uppercase tracking-wider mb-1">Total CO2 Impact</p>
                <p className="text-xl font-bold text-emerald-400">{totalCO2.toFixed(3)} <span className="text-sm text-emerald-400/60 font-normal">tonnes</span></p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between py-2 border-b border-white/[0.04]">
                <span className="text-xs text-white/40">Beneficiary</span>
                <span className="text-sm text-white/70">{beneficiaryName}</span>
              </div>
              {organization && (
                <div className="flex justify-between py-2 border-b border-white/[0.04]">
                  <span className="text-xs text-white/40">Organization</span>
                  <span className="text-sm text-white/70">{organization}</span>
                </div>
              )}
              <div className="flex justify-between py-2 border-b border-white/[0.04]">
                <span className="text-xs text-white/40">Reason</span>
                <span className="text-sm text-white/70">{reasonLabel}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-white/[0.04]">
                <span className="text-xs text-white/40">Retirement Fee (2.5%)</span>
                <span className="text-sm text-white/70 font-mono">{retirementFee.toFixed(4)} tCO2</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-xs text-white/40">Net CO2 Retired</span>
                <span className="text-sm font-bold text-emerald-400">{(totalCO2 - retirementFee).toFixed(4)} tonnes</span>
              </div>
            </div>

            {/* Environmental Equivalencies */}
            <div className="bg-emerald-500/5 border border-emerald-500/15 rounded-xl p-4">
              <p className="text-xs text-emerald-400 font-medium mb-3">Environmental Equivalencies</p>
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center">
                  <p className="text-lg font-bold text-white">{Math.round(totalCO2 * 2481)}</p>
                  <p className="text-[10px] text-white/40">Miles not driven</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-white">{Math.round(totalCO2 * 16.5)}</p>
                  <p className="text-[10px] text-white/40">Trees planted</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-white">{Math.round(totalCO2 * 113)}</p>
                  <p className="text-[10px] text-white/40">Gallons of gas saved</p>
                </div>
              </div>
            </div>
          </GlassCard>

          <div className="flex items-center justify-between">
            <button
              onClick={() => setStep(1)}
              className="flex items-center gap-2 px-5 py-2.5 text-white/50 hover:text-white/70 text-sm transition"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
            <button
              onClick={handleRetire}
              className="flex items-center gap-2 px-6 py-3 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-xl text-sm font-semibold hover:bg-emerald-500/25 transition"
            >
              <Flame className="w-4 h-4" />
              Confirm Retirement
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Confirmation */}
      {isRetired && (
        <div className="space-y-6">
          <GlassCard className="p-8 text-center border-emerald-500/20">
            <div className="flex flex-col items-center">
              <div className="p-4 bg-emerald-500/10 rounded-full mb-4">
                <CheckCircle className="w-12 h-12 text-emerald-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Credits Successfully Retired</h3>
              <p className="text-sm text-white/40 max-w-md mb-6">
                {totalSelected} carbon credits have been permanently retired, removing {totalCO2.toFixed(3)} tonnes of CO2 from circulation.
              </p>

              {/* Certificate Preview */}
              <div className="w-full max-w-md">
                <div className="relative bg-gradient-to-br from-emerald-500/[0.04] to-white/[0.02] border-2 border-emerald-500/20 rounded-2xl p-6 overflow-hidden">
                  <div className="absolute top-4 right-4 text-emerald-500/[0.07] text-5xl font-black select-none pointer-events-none">
                    TQ
                  </div>
                  <div className="flex items-center gap-2 mb-4">
                    <CheckCircle className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-bold text-white uppercase tracking-wider">Retirement Certificate</span>
                  </div>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-white/40">Beneficiary</span>
                      <span className="text-white/70">{beneficiaryName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/40">CO2 Retired</span>
                      <span className="text-emerald-400 font-bold">{totalCO2.toFixed(3)} tonnes</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/40">Reason</span>
                      <span className="text-white/70">{reasonLabel}</span>
                    </div>
                    <hr className="border-white/[0.06]" />
                    <div className="flex items-center justify-center gap-1.5 py-2 bg-emerald-500/10 rounded-lg">
                      <ShieldCheck className="w-3 h-3 text-emerald-400" />
                      <span className="text-[10px] text-emerald-400">Verified on Aethelred Blockchain</span>
                    </div>
                  </div>
                </div>
              </div>

              <button
                onClick={handleReset}
                className="mt-6 flex items-center gap-2 px-5 py-2.5 bg-white/[0.05] border border-white/[0.08] rounded-xl text-sm text-white/60 hover:text-white/80 hover:bg-white/[0.08] transition"
              >
                Retire More Credits
              </button>
            </div>
          </GlassCard>
        </div>
      )}

      {/* Recent Retirements */}
      <div>
        <SectionHeader
          title="Recent Retirements"
          description="Latest credit retirements across the protocol"
        />
        <GlassCard className="divide-y divide-white/[0.04]">
          {RECENT_RETIREMENTS.map((r) => (
            <div key={r.txHash} className="flex items-center justify-between px-5 py-4 hover:bg-white/[0.02] transition">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-500/10 rounded-lg">
                  <Flame className="w-4 h-4 text-emerald-400" />
                </div>
                <div>
                  <p className="text-sm text-white/70 font-medium">{r.beneficiary}</p>
                  <p className="text-xs text-white/30">{r.reason} - {r.date}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-emerald-400">{r.amount} tCO2</p>
                <p className="text-[10px] text-white/30 font-mono">{r.txHash.slice(0, 10)}...</p>
              </div>
            </div>
          ))}
        </GlassCard>
      </div>
    </div>
  );
}

function CorporatePortalTab() {
  const [reportingPeriod, setReportingPeriod] = useState("q1-2026");

  const scopeData = {
    scope1: { label: "Scope 1 (Direct)", emissions: 245, retired: seededInt(910, 100, 200), color: "emerald" as const },
    scope2: { label: "Scope 2 (Energy)", emissions: 189, retired: seededInt(911, 80, 160), color: "cyan" as const },
    scope3: { label: "Scope 3 (Supply Chain)", emissions: 1247, retired: seededInt(912, 200, 600), color: "amber" as const },
  };

  const totalEmissions = scopeData.scope1.emissions + scopeData.scope2.emissions + scopeData.scope3.emissions;
  const totalRetired = scopeData.scope1.retired + scopeData.scope2.retired + scopeData.scope3.retired;
  const coveragePercent = Math.round((totalRetired / totalEmissions) * 100);

  // Net-zero target data (seeded)
  const currentYear = 2026;
  const targetYear = 2035;
  const baselineEmissions = 1681;
  const yearlyReduction = seededInt(920, 120, 180);

  return (
    <div className="space-y-8">
      {/* Reporting Period Selector */}
      <div className="flex items-center justify-between">
        <SectionHeader
          title="Corporate Offsetting Dashboard"
          description="Enterprise emissions management and offset tracking"
        />
        <select
          value={reportingPeriod}
          onChange={(e) => setReportingPeriod(e.target.value)}
          className="px-4 py-2 bg-white/[0.05] border border-white/[0.08] rounded-xl text-sm text-white/70 focus:outline-none focus:border-emerald-500/30 appearance-none cursor-pointer"
        >
          <option value="q1-2026" className="bg-midnight-900 text-white">Q1 2026</option>
          <option value="q2-2026" className="bg-midnight-900 text-white">Q2 2026</option>
          <option value="q3-2026" className="bg-midnight-900 text-white">Q3 2026</option>
          <option value="q4-2026" className="bg-midnight-900 text-white">Q4 2026</option>
        </select>
      </div>

      {/* Summary Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <MetricCard label="Total Emissions" value={`${totalEmissions}`} unit="tCO2e" icon={BarChart3} />
        <MetricCard label="Credits Retired" value={`${totalRetired}`} unit="tCO2e" icon={Flame} />
        <MetricCard label="Offset Coverage" value={`${coveragePercent}%`} icon={Target} />
        <MetricCard label="Net Remaining" value={`${totalEmissions - totalRetired}`} unit="tCO2e" icon={TrendingDown} />
      </div>

      {/* Scope Breakdown */}
      <div>
        <SectionHeader
          title="Emissions by Scope"
          description="GHG Protocol scope classification with offset coverage"
        />
        <div className="space-y-4">
          {Object.entries(scopeData).map(([key, scope]) => {
            const coverage = Math.round((scope.retired / scope.emissions) * 100);
            return (
              <GlassCard key={key} className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h4 className="font-semibold text-white text-sm">{scope.label}</h4>
                    <p className="text-xs text-white/40">
                      {scope.retired} of {scope.emissions} tCO2e offset
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-white">{coverage}%</p>
                    <p className="text-[10px] text-white/30">Coverage</p>
                  </div>
                </div>
                <ProgressBar value={coverage} color={scope.color} />
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs text-white/30">Emissions: {scope.emissions} tCO2e</span>
                  <span className="text-xs text-emerald-400/70">Retired: {scope.retired} tCO2e</span>
                </div>
              </GlassCard>
            );
          })}
        </div>
      </div>

      {/* ESG Report Data */}
      <div>
        <SectionHeader
          title="ESG Report Data"
          description="Key metrics formatted for ESG and sustainability reporting"
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <GlassCard className="p-5">
            <p className="text-[10px] text-white/30 uppercase tracking-wider mb-3">Environmental Metrics</p>
            <div className="space-y-3">
              {[
                { label: "Total GHG Emissions", value: `${totalEmissions} tCO2e` },
                { label: "Carbon Credits Retired", value: `${totalRetired} tCO2e` },
                { label: "Net Carbon Footprint", value: `${totalEmissions - totalRetired} tCO2e` },
                { label: "Offset Methodology", value: "DAC (Direct Air Capture)" },
                { label: "Credit Standard", value: "Verra VCS VM0044" },
              ].map((item) => (
                <div key={item.label} className="flex justify-between py-1.5 border-b border-white/[0.03]">
                  <span className="text-xs text-white/40">{item.label}</span>
                  <span className="text-xs text-white/70 font-medium">{item.value}</span>
                </div>
              ))}
            </div>
          </GlassCard>
          <GlassCard className="p-5">
            <p className="text-[10px] text-white/30 uppercase tracking-wider mb-3">Reporting Standards</p>
            <div className="space-y-3">
              {[
                { label: "Framework", value: "GHG Protocol Corporate Standard" },
                { label: "Verification", value: "On-chain (Aethelred)" },
                { label: "Registry", value: "TerraQura Carbon Registry" },
                { label: "Reporting Period", value: "Q1 2026" },
                { label: "Audit Status", value: "Third-party Verified" },
              ].map((item) => (
                <div key={item.label} className="flex justify-between py-1.5 border-b border-white/[0.03]">
                  <span className="text-xs text-white/40">{item.label}</span>
                  <span className="text-xs text-white/70 font-medium">{item.value}</span>
                </div>
              ))}
            </div>
          </GlassCard>
        </div>
      </div>

      {/* Net-Zero Pathway */}
      <div>
        <SectionHeader
          title="Net-Zero Pathway"
          description="Progress toward net-zero emissions target"
        />
        <GlassCard className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <p className="text-sm text-white/40">Target Year</p>
              <p className="text-2xl font-bold text-white">{targetYear}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-white/40">Current Progress</p>
              <p className="text-2xl font-bold text-emerald-400">{Math.round((totalRetired / baselineEmissions) * 100)}%</p>
            </div>
          </div>

          {/* Pathway visualization */}
          <div className="relative mb-4">
            <div className="flex items-end justify-between h-32 gap-1">
              {Array.from({ length: targetYear - currentYear + 1 }).map((_, idx) => {
                const year = currentYear + idx;
                const projected = Math.max(0, baselineEmissions - yearlyReduction * idx);
                const height = (projected / baselineEmissions) * 100;
                const isCurrentYear = year === currentYear;
                return (
                  <div key={year} className="flex-1 flex flex-col items-center gap-1">
                    <div
                      className={`w-full rounded-t-sm transition-all ${isCurrentYear ? "bg-emerald-400" : "bg-emerald-500/20"}`}
                      style={{ height: `${height}%` }}
                    />
                    <span className="text-[8px] text-white/30">{String(year).slice(-2)}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-white/40">
            <span>Baseline: {baselineEmissions} tCO2e ({currentYear})</span>
            <span>Target: Net Zero ({targetYear})</span>
          </div>
        </GlassCard>
      </div>

      {/* Generate Report */}
      <GlassCard className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-purple-500/10 rounded-2xl">
              <FileCheck className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <h4 className="font-semibold text-white">Generate ESG Report</h4>
              <p className="text-xs text-white/40">Export comprehensive sustainability report for {reportingPeriod.toUpperCase().replace("-", " ")}</p>
            </div>
          </div>
          <button className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-xl text-sm font-medium hover:bg-emerald-500/15 transition">
            <Download className="w-4 h-4" />
            Generate Report
          </button>
        </div>
      </GlassCard>
    </div>
  );
}

function PublicVerificationTab() {
  const [searchInput, setSearchInput] = useState("");
  const [showResult, setShowResult] = useState(false);

  const mockTxHash = `0x${seededHex(950, 64)}`;
  const mockCertId = `TQ-CERT-${seededInt(951, 10000, 99999)}`;

  function handleVerify() {
    if (searchInput.trim()) {
      setShowResult(true);
    }
  }

  const provenanceSteps = [
    { step: "DAC Capture", timestamp: "2025-12-14 08:23:41 UTC", detail: `DAC-${String(seededInt(960, 1, 50)).padStart(3, "0")} captured 2.45 tonnes CO2 at 97.3% purity`, hash: `0x${seededHex(961, 12)}...` },
    { step: "Physics Verification", timestamp: "2025-12-14 08:24:12 UTC", detail: "Proof-of-Physics algorithm validated sensor readings against energy consumption model", hash: `0x${seededHex(962, 12)}...` },
    { step: "Credit Minting", timestamp: "2025-12-14 08:25:03 UTC", detail: "ERC-1155 token minted with full metadata and IPFS backup", hash: `0x${seededHex(963, 12)}...` },
    { step: "Trade History", timestamp: "2026-01-22 14:11:28 UTC", detail: "Transferred via CarbonMarketplace - Listing #247", hash: `0x${seededHex(964, 12)}...` },
    { step: "Retirement", timestamp: "2026-02-14 10:05:17 UTC", detail: "Permanently retired by Green Gulf Holdings for corporate offsetting", hash: `0x${seededHex(965, 12)}...` },
  ];

  return (
    <div className="space-y-8">
      {/* Verification Search */}
      <GlassCard className="p-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="p-3 bg-cyan-500/10 rounded-2xl">
            <Globe className="w-8 h-8 text-cyan-400" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Public Verification Portal</h3>
            <p className="text-sm text-white/40">
              Verify any retirement certificate or transaction on the Aethelred blockchain
            </p>
          </div>
        </div>

        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => { setSearchInput(e.target.value); setShowResult(false); }}
              placeholder="Enter retirement tx hash or certificate ID (e.g., 0x... or TQ-CERT-...)"
              className="w-full pl-11 pr-4 py-3 bg-white/[0.05] border border-white/[0.08] rounded-xl text-sm text-white/80 placeholder-white/30 focus:outline-none focus:border-emerald-500/30 transition"
            />
          </div>
          <button
            onClick={handleVerify}
            disabled={!searchInput.trim()}
            className="flex items-center gap-2 px-6 py-3 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-xl text-sm font-medium hover:bg-emerald-500/15 transition disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Search className="w-4 h-4" />
            Verify
          </button>
        </div>

        <div className="flex items-center gap-4 mt-3 text-xs text-white/30">
          <span>Try:</span>
          <button
            onClick={() => { setSearchInput(mockTxHash); setShowResult(false); }}
            className="font-mono text-emerald-400/60 hover:text-emerald-400 transition"
          >
            {mockTxHash.slice(0, 14)}...
          </button>
          <button
            onClick={() => { setSearchInput(mockCertId); setShowResult(false); }}
            className="font-mono text-emerald-400/60 hover:text-emerald-400 transition"
          >
            {mockCertId}
          </button>
        </div>
      </GlassCard>

      {/* Verification Result */}
      {showResult && (
        <div className="space-y-6">
          {/* Status Banner */}
          <GlassCard className="p-6 border-emerald-500/20 bg-gradient-to-r from-emerald-500/[0.04] to-transparent">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-emerald-500/10 rounded-full">
                <ShieldCheck className="w-8 h-8 text-emerald-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-emerald-400">Cryptographically Verified on Aethelred Blockchain</h3>
                <p className="text-sm text-white/40 mt-0.5">
                  This retirement has been verified through the complete provenance chain
                </p>
              </div>
            </div>
          </GlassCard>

          {/* Full Provenance Chain */}
          <div>
            <SectionHeader
              title="Full Provenance Chain"
              description="Complete lifecycle from capture to retirement"
            />
            <div className="relative space-y-0">
              <div className="absolute left-[19px] top-3 bottom-3 w-px bg-emerald-500/20" />
              {provenanceSteps.map((pStep, idx) => (
                <div key={idx} className="relative flex gap-4 pb-5 last:pb-0">
                  <div className="relative z-10 w-3 h-3 mt-1.5 rounded-full border-2 bg-emerald-500 border-emerald-400 shrink-0 ml-2" />
                  <GlassCard className="flex-1 p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-semibold text-white">{pStep.step}</h4>
                          <span className="text-[10px] px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-emerald-400">
                            Step {idx + 1}
                          </span>
                        </div>
                        <p className="text-[11px] text-white/30 font-mono mt-0.5">{pStep.timestamp}</p>
                      </div>
                      <span className="text-[10px] text-white/30 font-mono">{pStep.hash}</span>
                    </div>
                    <p className="text-xs text-white/50 leading-relaxed">{pStep.detail}</p>
                  </GlassCard>
                </div>
              ))}
            </div>
          </div>

          {/* Shareable Verification */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <GlassCard className="p-5">
              <div className="flex items-center gap-2 mb-4">
                <Share2 className="w-4 h-4 text-cyan-400" />
                <h4 className="font-semibold text-white text-sm">Shareable Verification Link</h4>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 px-3 py-2 bg-white/[0.05] border border-white/[0.08] rounded-lg">
                  <p className="text-xs text-white/50 font-mono truncate">
                    https://terraqura.app/verify/{searchInput.slice(0, 16)}...
                  </p>
                </div>
                <CopyButton text={`https://terraqura.app/verify/${searchInput}`} />
              </div>
              <p className="text-[10px] text-white/30 mt-2">
                Share this link to allow anyone to verify this retirement certificate
              </p>
            </GlassCard>

            <GlassCard className="p-5">
              <div className="flex items-center gap-2 mb-4">
                <QrCode className="w-4 h-4 text-purple-400" />
                <h4 className="font-semibold text-white text-sm">Physical Certificate QR Code</h4>
              </div>
              <div className="flex items-center justify-center py-6 bg-white/[0.03] rounded-xl border border-dashed border-white/[0.1]">
                <div className="text-center">
                  <QrCode className="w-16 h-16 text-white/10 mx-auto mb-2" />
                  <p className="text-xs text-white/30">QR Code for physical certificate</p>
                  <p className="text-[10px] text-white/20">Links to on-chain verification</p>
                </div>
              </div>
            </GlassCard>
          </div>
        </div>
      )}

      {/* Information Section */}
      {!showResult && (
        <div>
          <SectionHeader
            title="How Verification Works"
            description="Understanding TerraQura's on-chain verification process"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              {
                icon: Hash,
                title: "Transaction Hash",
                description: "Every retirement is recorded as an immutable transaction on the Aethelred blockchain with a unique hash identifier.",
              },
              {
                icon: Layers,
                title: "Provenance Chain",
                description: "Full lifecycle tracking from DAC capture through physics verification, credit minting, trading, and final retirement.",
              },
              {
                icon: ShieldCheck,
                title: "Cryptographic Proof",
                description: "Each step is cryptographically signed and linked, creating an unbreakable chain of custody for every carbon credit.",
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <GlassCard key={item.title} className="p-5">
                  <div className="p-2 bg-emerald-500/10 rounded-xl w-fit mb-3">
                    <Icon className="w-5 h-5 text-emerald-400" />
                  </div>
                  <h4 className="font-semibold text-white text-sm mb-2">{item.title}</h4>
                  <p className="text-xs text-white/40 leading-relaxed">{item.description}</p>
                </GlassCard>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Content ──────────────────────────────────────────────
export function RetirementDashboardContent() {
  const { wallet } = useApp();
  const [activeTab, setActiveTab] = useState("certificates");

  return (
    <div className="min-h-screen bg-midnight-950 flex flex-col">
      <TopNav />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">Retirement Center</h1>
              <p className="text-sm text-white/40 mt-1">
                Retire carbon credits, view certificates, and verify retirements on-chain
              </p>
            </div>
            <div className="flex items-center gap-3">
              <GlassCard className="px-4 py-2">
                <div className="flex items-center gap-2">
                  <Flame className="w-4 h-4 text-emerald-400" />
                  <span className="text-sm font-bold text-emerald-400">{TOTAL_RETIRED.toFixed(1)}</span>
                  <span className="text-xs text-white/40">tCO2 retired</span>
                </div>
              </GlassCard>
            </div>
          </div>
        </div>

        {/* Connect Wallet prompt if not connected */}
        {!wallet.connected && (
          <section className="mb-8">
            <ConnectWalletPrompt message="Connect your wallet to retire credits and view your certificates" />
          </section>
        )}

        {/* Tabs */}
        <div className="mb-8">
          <Tabs tabs={RETIREMENT_TABS} activeTab={activeTab} onChange={setActiveTab} />
        </div>

        {/* Tab Content */}
        {activeTab === "certificates" && <CertificateGalleryTab />}
        {activeTab === "retire" && <RetireCreditsTab />}
        {activeTab === "corporate" && <CorporatePortalTab />}
        {activeTab === "verify" && <PublicVerificationTab />}
      </main>

      <DAppFooter />
    </div>
  );
}
