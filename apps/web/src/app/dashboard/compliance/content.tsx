/**
 * TerraQura Compliance Dashboard
 *
 * KYC status, regulatory jurisdiction mapping, smart contract audit reports,
 * and MRV (Measurement, Reporting, Verification) standards compliance.
 *
 * @version 1.0.0
 */

"use client";

import { useState } from "react";
import {
  Shield, FileCheck, Globe, CheckCircle, Clock,
  AlertTriangle, Lock, Eye, Download, Award,
  Users, Building2, Layers, ArrowRight,
  Bug, ShieldCheck, Activity,
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
} from "@/components/dapp/SharedComponents";

// ─── Seeded Random for SSR-safe mock data ──────────────────
function seededRandom(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function seededInt(seed: number, min: number, max: number): number {
  return Math.floor(seededRandom(seed) * (max - min + 1)) + min;
}



// ─── Tab Definitions ─────────────────────────────────────────
const COMPLIANCE_TABS = [
  { id: "kyc", label: "KYC Status", icon: Shield },
  { id: "regulatory", label: "Regulatory Map", icon: Globe },
  { id: "audits", label: "Audit Reports", icon: FileCheck },
  { id: "mrv", label: "MRV Standards", icon: Activity },
];

// ─── KYC Data ────────────────────────────────────────────────
interface VerificationTier {
  name: string;
  level: number;
  requirements: string[];
  benefits: string[];
  icon: React.ElementType;
}

const VERIFICATION_TIERS: VerificationTier[] = [
  {
    name: "Basic",
    level: 1,
    requirements: ["Email verification", "Wallet connection"],
    benefits: ["Trade up to 100 credits", "View marketplace listings", "Basic portfolio tracking"],
    icon: Users,
  },
  {
    name: "Enhanced",
    level: 2,
    requirements: ["Government-issued ID", "Proof of address", "Selfie verification"],
    benefits: ["Unlimited credit trading", "Retirement certificates", "Advanced analytics access"],
    icon: ShieldCheck,
  },
  {
    name: "Institutional",
    level: 3,
    requirements: ["Corporate registration docs", "Authorized representative ID", "AML compliance declaration", "Financial statements"],
    benefits: ["API access for bulk operations", "Bulk retirement processing", "Custom ESG reporting", "Dedicated account manager"],
    icon: Building2,
  },
];

interface VerificationEvent {
  date: string;
  action: string;
  status: "completed" | "pending" | "rejected";
  detail: string;
}

const VERIFICATION_HISTORY: VerificationEvent[] = [
  {
    date: "2026-02-14",
    action: "Email Verification",
    status: "completed",
    detail: "Email address verified successfully via confirmation link",
  },
  {
    date: "2026-02-15",
    action: "Wallet Connected",
    status: "completed",
    detail: "Aethelred wallet linked to account - Basic tier achieved",
  },
  {
    date: "2026-03-01",
    action: "ID Document Submitted",
    status: "pending",
    detail: "Government-issued ID uploaded for Enhanced tier review",
  },
];

const KYC_DOCUMENTS = [
  { name: "Email Verification", status: "verified" as const },
  { name: "Wallet Connection", status: "verified" as const },
  { name: "Government ID", status: "pending" as const },
  { name: "Proof of Address", status: "not_started" as const },
  { name: "Selfie Verification", status: "not_started" as const },
];

// ─── Regulatory Data ──────────────────────────────────────────
interface Jurisdiction {
  country: string;
  flag: string;
  status: "Compliant" | "Pending" | "Review";
  creditTypes: string[];
  regulatoryBody: string;
}

const JURISDICTIONS: Jurisdiction[] = [
  { country: "UAE", flag: "AE", status: "Compliant", creditTypes: ["VCS", "Gold Standard", "ICROA"], regulatoryBody: "Securities & Commodities Authority" },
  { country: "Saudi Arabia", flag: "SA", status: "Compliant", creditTypes: ["VCS", "CDM"], regulatoryBody: "Capital Market Authority" },
  { country: "Oman", flag: "OM", status: "Pending", creditTypes: ["VCS"], regulatoryBody: "Capital Market Authority" },
  { country: "European Union", flag: "EU", status: "Compliant", creditTypes: ["EU ETS", "VCS", "Gold Standard"], regulatoryBody: "European Securities and Markets Authority" },
  { country: "United Kingdom", flag: "GB", status: "Compliant", creditTypes: ["UK ETS", "VCS", "Woodland Carbon Code"], regulatoryBody: "Financial Conduct Authority" },
  { country: "United States", flag: "US", status: "Review", creditTypes: ["CAR", "ACR", "VCS"], regulatoryBody: "Securities and Exchange Commission" },
  { country: "Singapore", flag: "SG", status: "Compliant", creditTypes: ["VCS", "Gold Standard", "ICROA"], regulatoryBody: "Monetary Authority of Singapore" },
  { country: "Japan", flag: "JP", status: "Pending", creditTypes: ["J-Credit", "VCS"], regulatoryBody: "Financial Services Agency" },
];

interface InternationalStandard {
  name: string;
  description: string;
  status: "Aligned" | "Partial" | "In Progress";
  detail: string;
}

const INTERNATIONAL_STANDARDS: InternationalStandard[] = [
  {
    name: "Article 6 (Paris Agreement)",
    description: "International transfer of mitigation outcomes under the Paris Agreement carbon market framework",
    status: "Aligned",
    detail: "Full compliance with Article 6.2 cooperative approaches and Article 6.4 mechanism for internationally transferred mitigation outcomes (ITMOs)",
  },
  {
    name: "CORSIA",
    description: "Carbon Offsetting and Reduction Scheme for International Aviation",
    status: "Aligned",
    detail: "TerraQura DAC credits eligible under CORSIA Phase 1 for airline carbon offsetting requirements",
  },
  {
    name: "ICROA Code of Best Practice",
    description: "International Carbon Reduction and Offset Alliance voluntary standards",
    status: "Aligned",
    detail: "Full adherence to ICROA principles including additionality, permanence, and robust quantification",
  },
  {
    name: "Verra VCS Equivalency",
    description: "Verified Carbon Standard methodology alignment for carbon credit issuance",
    status: "Partial",
    detail: "DAC methodology registered under VCS VM0044; awaiting final approval for enhanced purity methodology",
  },
  {
    name: "Gold Standard Equivalency",
    description: "Gold Standard for the Global Goals carbon credit certification",
    status: "In Progress",
    detail: "Application submitted for Gold Standard certification of TerraQura DAC methodology",
  },
];

// ─── Audit Data ───────────────────────────────────────────────
interface AuditEntry {
  contract: string;
  auditor: string;
  auditDate: string;
  findings: { critical: number; high: number; medium: number; low: number };
  status: "Passed" | "Remediation";
}

const AUDIT_ENTRIES: AuditEntry[] = [
  { contract: "CarbonCredit (ERC-1155)", auditor: "Halborn Security", auditDate: "2025-11-15", findings: { critical: 0, high: 0, medium: 1, low: 3 }, status: "Passed" },
  { contract: "CarbonMarketplace", auditor: "OpenZeppelin", auditDate: "2025-12-02", findings: { critical: 0, high: 0, medium: 0, low: 2 }, status: "Passed" },
  { contract: "VerificationEngine", auditor: "Independent Security Review", auditDate: "2025-10-28", findings: { critical: 0, high: 1, medium: 2, low: 1 }, status: "Passed" },
  { contract: "AccessControl", auditor: "Halborn Security", auditDate: "2025-11-20", findings: { critical: 0, high: 0, medium: 0, low: 1 }, status: "Passed" },
  { contract: "CircuitBreaker", auditor: "OpenZeppelin", auditDate: "2025-12-10", findings: { critical: 0, high: 0, medium: 1, low: 0 }, status: "Passed" },
  { contract: "MultisigWallet", auditor: "Independent Security Review", auditDate: "2025-11-05", findings: { critical: 0, high: 0, medium: 0, low: 2 }, status: "Passed" },
  { contract: "TimelockController", auditor: "Halborn Security", auditDate: "2025-12-15", findings: { critical: 0, high: 0, medium: 0, low: 0 }, status: "Passed" },
  { contract: "GaslessMarketplace", auditor: "OpenZeppelin", auditDate: "2026-01-08", findings: { critical: 0, high: 0, medium: 2, low: 3 }, status: "Remediation" },
];

interface BugBountyTier {
  severity: string;
  reward: string;
  color: string;
}

const BUG_BOUNTY_TIERS: BugBountyTier[] = [
  { severity: "Critical", reward: "Up to 25,000 AETH", color: "text-red-400" },
  { severity: "High", reward: "Up to 10,000 AETH", color: "text-orange-400" },
  { severity: "Medium", reward: "Up to 2,500 AETH", color: "text-amber-400" },
  { severity: "Low", reward: "Up to 500 AETH", color: "text-yellow-400" },
];

interface SecurityTimeline {
  date: string;
  event: string;
  type: "audit" | "pentest" | "bounty" | "insurance";
}

const SECURITY_TIMELINE: SecurityTimeline[] = [
  { date: "2025-10-01", event: "Initial security assessment commenced", type: "audit" },
  { date: "2025-11-15", event: "Phase 1 audit reports delivered by Halborn", type: "audit" },
  { date: "2025-12-02", event: "OpenZeppelin marketplace audit completed", type: "audit" },
  { date: "2025-12-20", event: "Penetration testing by NCC Group", type: "pentest" },
  { date: "2026-01-05", event: "Bug bounty program launched on Immunefi", type: "bounty" },
  { date: "2026-02-01", event: "Nexus Mutual smart contract coverage activated", type: "insurance" },
];

// ─── MRV Data ──────────────────────────────────────────────────
interface MRVStandard {
  name: string;
  status: "Compliant" | "Partial" | "In Review";
  alignment: number;
  requirementsMet: string[];
}

const MRV_STANDARDS: MRVStandard[] = [
  {
    name: "GHG Protocol",
    status: "Compliant",
    alignment: 98,
    requirementsMet: ["Scope 1/2/3 categorization", "Quantification methodology", "Third-party verification", "Annual reporting cycle"],
  },
  {
    name: "ISO 14064",
    status: "Compliant",
    alignment: 95,
    requirementsMet: ["GHG inventory design", "Quantification and monitoring", "Verification and validation", "Continuous improvement"],
  },
  {
    name: "CDM (Clean Development Mechanism)",
    status: "Partial",
    alignment: 82,
    requirementsMet: ["Baseline methodology", "Additionality demonstration", "Monitoring plan", "Stakeholder consultation"],
  },
  {
    name: "Verra VCS",
    status: "Compliant",
    alignment: 96,
    requirementsMet: ["Project description", "Quantification methodology VM0044", "Monitoring and reporting", "Validation and verification"],
  },
  {
    name: "Gold Standard",
    status: "In Review",
    alignment: 74,
    requirementsMet: ["Stakeholder engagement", "Sustainable development assessment", "MRV framework design"],
  },
];

const MRV_DATA_FLOW_STEPS = [
  { label: "Physical Measurement", description: "DAC unit sensors capture CO2 removal data, energy consumption, and purity metrics in real-time", icon: Activity },
  { label: "On-chain Recording", description: "Raw sensor data hashed and recorded to Aethelred blockchain via NativeIoT Oracle contract", icon: Layers },
  { label: "Third-party Verification", description: "Independent verifiers validate data against Proof-of-Physics algorithms and threshold checks", icon: ShieldCheck },
  { label: "Credit Issuance", description: "Verified removal data minted as ERC-1155 carbon credits with full provenance metadata", icon: Award },
];

const REPORTING_TEMPLATES = [
  { name: "Annual GHG Inventory Report", format: "PDF", size: "2.4 MB" },
  { name: "Project Monitoring Report (PMR)", format: "XLSX", size: "1.1 MB" },
  { name: "Verification Statement Template", format: "DOCX", size: "890 KB" },
  { name: "Stakeholder Consultation Log", format: "PDF", size: "1.8 MB" },
  { name: "CDM Project Design Document", format: "PDF", size: "3.2 MB" },
];

// ─── Tab Content Components ──────────────────────────────────

function KYCStatusTab() {
  const { wallet } = useApp();
  const currentTier = 1; // Basic tier (seeded mock)
  const kycStatus = wallet.connected ? "Pending" : "Not Started";

  return (
    <div className="space-y-8">
      {/* KYC Status Card */}
      <GlassCard className="p-6">
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-amber-500/10 rounded-2xl">
              <Shield className="w-8 h-8 text-amber-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">KYC Verification Status</h3>
              <p className="text-sm text-white/40 mt-0.5">
                {wallet.connected
                  ? `Wallet: ${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)}`
                  : "No wallet connected"}
              </p>
            </div>
          </div>
          <StatusBadge status={kycStatus} />
        </div>

        {/* Current Tier Progress */}
        <div className="bg-white/[0.03] rounded-xl p-5 border border-white/[0.06]">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-emerald-400" />
              <span className="text-sm font-medium text-white">Current Tier: Basic</span>
            </div>
            <span className="text-xs text-white/40">Level {currentTier} of 3</span>
          </div>
          <ProgressBar value={33} color="emerald" />
          <p className="text-xs text-white/40 mt-2">
            Complete ID verification to upgrade to Enhanced tier
          </p>
        </div>
      </GlassCard>

      {/* Verification Tiers */}
      <div>
        <SectionHeader
          title="Verification Tiers"
          description="Progressive KYC levels with increasing benefits"
        />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {VERIFICATION_TIERS.map((tier) => {
            const Icon = tier.icon;
            const isCurrentTier = tier.level === currentTier;
            const isCompleted = tier.level < currentTier;
            const borderColor = isCurrentTier
              ? "border-emerald-500/30"
              : isCompleted
              ? "border-emerald-500/10"
              : "border-white/[0.06]";

            return (
              <GlassCard key={tier.name} className={`p-5 ${borderColor} relative`}>
                {isCurrentTier && (
                  <div className="absolute top-3 right-3">
                    <StatusBadge status="Active" />
                  </div>
                )}
                {isCompleted && (
                  <div className="absolute top-3 right-3">
                    <StatusBadge status="Verified" />
                  </div>
                )}
                <div className="flex items-center gap-3 mb-4">
                  <div className={`p-2 rounded-xl ${isCurrentTier ? "bg-emerald-500/10" : "bg-white/[0.05]"}`}>
                    <Icon className={`w-5 h-5 ${isCurrentTier ? "text-emerald-400" : "text-white/40"}`} />
                  </div>
                  <div>
                    <h4 className="font-semibold text-white text-sm">{tier.name}</h4>
                    <p className="text-[10px] text-white/30 uppercase tracking-wider">Level {tier.level}</p>
                  </div>
                </div>

                <div className="mb-4">
                  <p className="text-[10px] text-white/30 uppercase tracking-wider mb-2">Requirements</p>
                  <div className="space-y-1.5">
                    {tier.requirements.map((req) => (
                      <div key={req} className="flex items-center gap-2 text-xs text-white/60">
                        <Lock className="w-3 h-3 text-white/30 shrink-0" />
                        <span>{req}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-[10px] text-white/30 uppercase tracking-wider mb-2">Benefits</p>
                  <div className="space-y-1.5">
                    {tier.benefits.map((benefit) => (
                      <div key={benefit} className="flex items-center gap-2 text-xs text-white/60">
                        <CheckCircle className="w-3 h-3 text-emerald-400/60 shrink-0" />
                        <span>{benefit}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </GlassCard>
            );
          })}
        </div>
      </div>

      {/* Documents Checklist */}
      <div>
        <SectionHeader
          title="Required Documents"
          description="Documents needed for tier progression"
        />
        <GlassCard className="divide-y divide-white/[0.04]">
          {KYC_DOCUMENTS.map((doc) => {
            const statusColors = {
              verified: { bg: "bg-emerald-500/10", text: "text-emerald-400", label: "Verified" },
              pending: { bg: "bg-amber-500/10", text: "text-amber-400", label: "Pending" },
              not_started: { bg: "bg-white/[0.05]", text: "text-white/30", label: "Not Started" },
            };
            const s = statusColors[doc.status];
            return (
              <div key={doc.name} className="flex items-center justify-between px-5 py-4">
                <div className="flex items-center gap-3">
                  {doc.status === "verified" ? (
                    <CheckCircle className="w-5 h-5 text-emerald-400" />
                  ) : doc.status === "pending" ? (
                    <Clock className="w-5 h-5 text-amber-400" />
                  ) : (
                    <div className="w-5 h-5 rounded-full border-2 border-white/20" />
                  )}
                  <span className="text-sm text-white/70">{doc.name}</span>
                </div>
                <span className={`text-xs px-2.5 py-1 rounded-full ${s.bg} ${s.text}`}>{s.label}</span>
              </div>
            );
          })}
        </GlassCard>
      </div>

      {/* Verification History Timeline */}
      <div>
        <SectionHeader
          title="Verification History"
          description="Timeline of your verification activities"
        />
        <div className="relative space-y-0">
          <div className="absolute left-[19px] top-3 bottom-3 w-px bg-white/[0.08]" />
          {VERIFICATION_HISTORY.map((event, idx) => {
            const statusColors = {
              completed: "bg-emerald-500 border-emerald-400",
              pending: "bg-amber-500 border-amber-400",
              rejected: "bg-red-500 border-red-400",
            };
            return (
              <div key={idx} className="relative flex gap-4 pb-6 last:pb-0">
                <div className={`relative z-10 w-3 h-3 mt-1.5 rounded-full border-2 ${statusColors[event.status]} shrink-0 ml-2`} />
                <GlassCard className="flex-1 p-4">
                  <div className="flex items-start justify-between mb-1">
                    <h4 className="text-sm font-medium text-white">{event.action}</h4>
                    <span className="text-[11px] text-white/30">{event.date}</span>
                  </div>
                  <p className="text-xs text-white/40">{event.detail}</p>
                </GlassCard>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function RegulatoryMapTab() {
  return (
    <div className="space-y-8">
      {/* Jurisdiction Grid */}
      <div>
        <SectionHeader
          title="Jurisdiction Compliance"
          description="Regulatory compliance status across key markets"
          badge={<StatusBadge status="8 Jurisdictions" />}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {JURISDICTIONS.map((j) => {
            const statusConfig = {
              Compliant: { border: "border-emerald-500/20", bg: "bg-emerald-500/5", dot: "bg-emerald-400" },
              Pending: { border: "border-amber-500/20", bg: "bg-amber-500/5", dot: "bg-amber-400" },
              Review: { border: "border-cyan-500/20", bg: "bg-cyan-500/5", dot: "bg-cyan-400" },
            };
            const cfg = statusConfig[j.status];
            return (
              <GlassCard key={j.country} className={`p-5 ${cfg.border} hover:bg-white/[0.02] transition-all`}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h4 className="font-semibold text-white text-sm">{j.country}</h4>
                    <p className="text-[10px] text-white/30 mt-0.5">{j.regulatoryBody}</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                    <span className="text-xs text-white/50">{j.status}</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1">
                  {j.creditTypes.map((type) => (
                    <span
                      key={type}
                      className="text-[10px] px-2 py-0.5 bg-white/[0.05] border border-white/[0.08] rounded-full text-white/50"
                    >
                      {type}
                    </span>
                  ))}
                </div>
              </GlassCard>
            );
          })}
        </div>
      </div>

      {/* International Standards Alignment */}
      <div>
        <SectionHeader
          title="International Standards"
          description="Alignment with global carbon market frameworks"
        />
        <div className="space-y-3">
          {INTERNATIONAL_STANDARDS.map((standard) => {
            const statusColors = {
              Aligned: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
              Partial: "bg-amber-500/10 text-amber-400 border-amber-500/20",
              "In Progress": "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
            };
            return (
              <GlassCard key={standard.name} className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold text-white text-sm">{standard.name}</h4>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border ${statusColors[standard.status]}`}>
                        {standard.status}
                      </span>
                    </div>
                    <p className="text-xs text-white/40">{standard.description}</p>
                  </div>
                </div>
                <p className="text-xs text-white/50 leading-relaxed">{standard.detail}</p>
              </GlassCard>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function AuditReportsTab() {
  const totalFindings = AUDIT_ENTRIES.reduce(
    (acc, e) => ({
      critical: acc.critical + e.findings.critical,
      high: acc.high + e.findings.high,
      medium: acc.medium + e.findings.medium,
      low: acc.low + e.findings.low,
    }),
    { critical: 0, high: 0, medium: 0, low: 0 }
  );

  return (
    <div className="space-y-8">
      {/* Summary Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <MetricCard label="Audits Completed" value="8" icon={FileCheck} />
        <MetricCard label="Critical Findings" value="0" icon={ShieldCheck} />
        <MetricCard label="High Findings" value={String(totalFindings.high)} icon={AlertTriangle} />
        <MetricCard label="Total Resolved" value={String(totalFindings.medium + totalFindings.low + totalFindings.high - 5)} icon={CheckCircle} />
      </div>

      {/* Audit Table */}
      <div>
        <SectionHeader
          title="Smart Contract Audits"
          description="Independent security audit results for all protocol contracts"
        />
        <GlassCard className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th className="px-5 py-3 text-[11px] text-white/40 uppercase tracking-wider font-medium text-left">Contract</th>
                  <th className="px-5 py-3 text-[11px] text-white/40 uppercase tracking-wider font-medium text-left">Auditor</th>
                  <th className="px-5 py-3 text-[11px] text-white/40 uppercase tracking-wider font-medium text-left">Date</th>
                  <th className="px-5 py-3 text-[11px] text-white/40 uppercase tracking-wider font-medium text-center">Critical</th>
                  <th className="px-5 py-3 text-[11px] text-white/40 uppercase tracking-wider font-medium text-center">High</th>
                  <th className="px-5 py-3 text-[11px] text-white/40 uppercase tracking-wider font-medium text-center">Medium</th>
                  <th className="px-5 py-3 text-[11px] text-white/40 uppercase tracking-wider font-medium text-center">Low</th>
                  <th className="px-5 py-3 text-[11px] text-white/40 uppercase tracking-wider font-medium text-right">Status</th>
                </tr>
              </thead>
              <tbody>
                {AUDIT_ENTRIES.map((entry, idx) => (
                  <tr key={idx} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition">
                    <td className="px-5 py-4 text-sm text-white/70 font-medium">{entry.contract}</td>
                    <td className="px-5 py-4 text-sm text-white/50">{entry.auditor}</td>
                    <td className="px-5 py-4 text-xs text-white/40 font-mono">{entry.auditDate}</td>
                    <td className="px-5 py-4 text-center">
                      <span className={`text-sm font-mono ${entry.findings.critical > 0 ? "text-red-400 font-bold" : "text-white/30"}`}>
                        {entry.findings.critical}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <span className={`text-sm font-mono ${entry.findings.high > 0 ? "text-orange-400 font-bold" : "text-white/30"}`}>
                        {entry.findings.high}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <span className={`text-sm font-mono ${entry.findings.medium > 0 ? "text-amber-400" : "text-white/30"}`}>
                        {entry.findings.medium}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <span className={`text-sm font-mono ${entry.findings.low > 0 ? "text-yellow-400" : "text-white/30"}`}>
                        {entry.findings.low}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <StatusBadge status={entry.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </GlassCard>
      </div>

      {/* Bug Bounty Program */}
      <div>
        <SectionHeader
          title="Bug Bounty Program"
          description="Active on Immunefi - rewarding security researchers"
        />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <GlassCard className="p-6 lg:col-span-2">
            <div className="flex items-center gap-3 mb-5">
              <div className="p-2 bg-purple-500/10 rounded-xl">
                <Bug className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <h4 className="font-semibold text-white">TerraQura Bug Bounty</h4>
                <p className="text-xs text-white/40">Hosted on Immunefi</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-5">
              <div className="bg-white/[0.03] rounded-xl p-4 border border-white/[0.06]">
                <p className="text-[10px] text-white/30 uppercase tracking-wider mb-1">Total Pool</p>
                <p className="text-xl font-bold text-white">50,000 <span className="text-sm text-white/40 font-normal">AETH</span></p>
              </div>
              <div className="bg-white/[0.03] rounded-xl p-4 border border-white/[0.06]">
                <p className="text-[10px] text-white/30 uppercase tracking-wider mb-1">Payouts to Date</p>
                <p className="text-xl font-bold text-white">8,750 <span className="text-sm text-white/40 font-normal">AETH</span></p>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-[10px] text-white/30 uppercase tracking-wider mb-2">Severity Tiers</p>
              {BUG_BOUNTY_TIERS.map((tier) => (
                <div key={tier.severity} className="flex items-center justify-between py-2 px-3 bg-white/[0.02] rounded-lg">
                  <span className={`text-sm font-medium ${tier.color}`}>{tier.severity}</span>
                  <span className="text-sm text-white/60 font-mono">{tier.reward}</span>
                </div>
              ))}
            </div>
          </GlassCard>

          {/* Penetration Testing & Insurance */}
          <div className="space-y-4">
            <GlassCard className="p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="p-2 bg-cyan-500/10 rounded-xl">
                  <Eye className="w-4 h-4 text-cyan-400" />
                </div>
                <h4 className="font-semibold text-white text-sm">Penetration Testing</h4>
              </div>
              <div className="space-y-3 text-xs">
                <div className="flex justify-between">
                  <span className="text-white/40">Testing Firm</span>
                  <span className="text-white/70">NCC Group</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/40">Last Test</span>
                  <span className="text-white/70 font-mono">2025-12-20</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/40">Scope</span>
                  <span className="text-white/70">Full Protocol</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/40">Result</span>
                  <StatusBadge status="Passed" />
                </div>
              </div>
            </GlassCard>

            <GlassCard className="p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="p-2 bg-emerald-500/10 rounded-xl">
                  <Shield className="w-4 h-4 text-emerald-400" />
                </div>
                <h4 className="font-semibold text-white text-sm">Insurance Coverage</h4>
              </div>
              <div className="space-y-3 text-xs">
                <div className="flex justify-between">
                  <span className="text-white/40">Provider</span>
                  <span className="text-white/70">Nexus Mutual</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/40">Coverage</span>
                  <span className="text-white/70 font-mono">500,000 AETH</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/40">Type</span>
                  <span className="text-white/70">Smart Contract Cover</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/40">Status</span>
                  <StatusBadge status="Active" />
                </div>
              </div>
            </GlassCard>
          </div>
        </div>
      </div>

      {/* Security Assessment Timeline */}
      <div>
        <SectionHeader
          title="Security Assessment Timeline"
          description="Chronological view of all security activities"
        />
        <div className="relative space-y-0">
          <div className="absolute left-[19px] top-3 bottom-3 w-px bg-white/[0.08]" />
          {SECURITY_TIMELINE.map((event, idx) => {
            const typeColors = {
              audit: "bg-purple-500 border-purple-400",
              pentest: "bg-cyan-500 border-cyan-400",
              bounty: "bg-amber-500 border-amber-400",
              insurance: "bg-emerald-500 border-emerald-400",
            };
            const typeLabels = {
              audit: "Audit",
              pentest: "Pen Test",
              bounty: "Bounty",
              insurance: "Insurance",
            };
            return (
              <div key={idx} className="relative flex gap-4 pb-5 last:pb-0">
                <div className={`relative z-10 w-3 h-3 mt-1.5 rounded-full border-2 ${typeColors[event.type]} shrink-0 ml-2`} />
                <GlassCard className="flex-1 p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="text-sm font-medium text-white">{event.event}</h4>
                      <p className="text-xs text-white/30 mt-0.5">{event.date}</p>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 bg-white/[0.05] border border-white/[0.08] rounded-full text-white/40">
                      {typeLabels[event.type]}
                    </span>
                  </div>
                </GlassCard>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function MRVStandardsTab() {
  const overallScore = seededInt(777, 88, 94);

  return (
    <div className="space-y-8">
      {/* MRV Overview */}
      <GlassCard className="p-6">
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-emerald-500/10 rounded-2xl">
              <Activity className="w-8 h-8 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">MRV Framework</h3>
              <p className="text-sm text-white/40 mt-0.5">
                Measurement, Reporting & Verification for carbon credit integrity
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold text-emerald-400">{overallScore}%</p>
            <p className="text-xs text-white/40">Overall MRV Score</p>
          </div>
        </div>
        <ProgressBar value={overallScore} color="emerald" />
        <p className="text-xs text-white/40 mt-2">
          Real-time compliance score based on continuous monitoring across all MRV dimensions
        </p>
      </GlassCard>

      {/* Data Flow Diagram */}
      <div>
        <SectionHeader
          title="MRV Data Flow"
          description="End-to-end data pipeline from physical measurement to credit issuance"
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {MRV_DATA_FLOW_STEPS.map((step, idx) => {
            const Icon = step.icon;
            return (
              <div key={idx} className="relative">
                <GlassCard className="p-5 h-full">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="p-2 bg-emerald-500/10 rounded-xl">
                      <Icon className="w-4 h-4 text-emerald-400" />
                    </div>
                    <div className="w-6 h-6 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                      <span className="text-[10px] font-bold text-emerald-400">{idx + 1}</span>
                    </div>
                  </div>
                  <h4 className="font-semibold text-white text-sm mb-2">{step.label}</h4>
                  <p className="text-xs text-white/40 leading-relaxed">{step.description}</p>
                </GlassCard>
                {idx < MRV_DATA_FLOW_STEPS.length - 1 && (
                  <div className="hidden lg:flex absolute top-1/2 -right-2 -translate-y-1/2 z-10">
                    <ArrowRight className="w-4 h-4 text-emerald-500/30" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Standards Compliance Matrix */}
      <div>
        <SectionHeader
          title="Standards Compliance Matrix"
          description="Alignment with global MRV and carbon accounting standards"
        />
        <div className="space-y-3">
          {MRV_STANDARDS.map((standard) => {
            const statusColors = {
              Compliant: "text-emerald-400",
              Partial: "text-amber-400",
              "In Review": "text-cyan-400",
            };
            const barColor = standard.alignment >= 90 ? "emerald" as const : standard.alignment >= 75 ? "amber" as const : "cyan" as const;

            return (
              <GlassCard key={standard.name} className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-white text-sm">{standard.name}</h4>
                      <StatusBadge status={standard.status} />
                    </div>
                  </div>
                  <span className={`text-lg font-bold ${statusColors[standard.status]}`}>
                    {standard.alignment}%
                  </span>
                </div>
                <ProgressBar value={standard.alignment} color={barColor} size="sm" className="mb-3" />
                <div className="flex flex-wrap gap-2">
                  {standard.requirementsMet.map((req) => (
                    <div key={req} className="flex items-center gap-1.5 text-xs text-white/50">
                      <CheckCircle className="w-3 h-3 text-emerald-400/60 shrink-0" />
                      <span>{req}</span>
                    </div>
                  ))}
                </div>
              </GlassCard>
            );
          })}
        </div>
      </div>

      {/* Reporting Templates */}
      <div>
        <SectionHeader
          title="Reporting Templates"
          description="Standard templates for MRV documentation and compliance reporting"
        />
        <GlassCard className="divide-y divide-white/[0.04]">
          {REPORTING_TEMPLATES.map((template) => (
            <div key={template.name} className="flex items-center justify-between px-5 py-4 hover:bg-white/[0.02] transition">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/[0.05] rounded-lg">
                  <FileCheck className="w-4 h-4 text-white/40" />
                </div>
                <div>
                  <p className="text-sm text-white/70 font-medium">{template.name}</p>
                  <p className="text-xs text-white/30">{template.format} - {template.size}</p>
                </div>
              </div>
              <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg hover:bg-emerald-500/15 transition">
                <Download className="w-3 h-3" />
                Download
              </button>
            </div>
          ))}
        </GlassCard>
      </div>

      {/* Continuous Monitoring Dashboard */}
      <div>
        <SectionHeader
          title="Continuous Monitoring"
          description="Real-time MRV compliance scoring across all dimensions"
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Data Integrity", score: seededInt(901, 94, 99), description: "On-chain data hash verification" },
            { label: "Measurement Accuracy", score: seededInt(902, 90, 97), description: "DAC sensor calibration compliance" },
            { label: "Reporting Timeliness", score: seededInt(903, 85, 95), description: "Scheduled report submission rate" },
            { label: "Verification Coverage", score: seededInt(904, 88, 96), description: "Percentage of credits verified" },
          ].map((metric) => {
            const color = metric.score >= 95 ? "emerald" as const : metric.score >= 85 ? "amber" as const : "red" as const;
            return (
              <GlassCard key={metric.label} className="p-5">
                <p className="text-xs text-white/40 uppercase tracking-wider mb-2">{metric.label}</p>
                <p className="text-2xl font-bold text-white mb-2">{metric.score}%</p>
                <ProgressBar value={metric.score} color={color} size="sm" className="mb-2" />
                <p className="text-[11px] text-white/30">{metric.description}</p>
              </GlassCard>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Main Content ──────────────────────────────────────────────
export function ComplianceDashboardContent() {
  const { wallet } = useApp();
  const [activeTab, setActiveTab] = useState("kyc");

  return (
    <div className="min-h-screen bg-midnight-950 flex flex-col">
      <TopNav />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">Compliance Dashboard</h1>
              <p className="text-sm text-white/40 mt-1">
                KYC verification, regulatory compliance, audit reports, and MRV standards
              </p>
            </div>
            <StatusBadge status="Operational" />
          </div>
        </div>

        {/* Connect Wallet prompt if not connected */}
        {!wallet.connected && (
          <section className="mb-8">
            <ConnectWalletPrompt message="Connect your wallet to view your KYC status and compliance information" />
          </section>
        )}

        {/* Tabs */}
        <div className="mb-8">
          <Tabs tabs={COMPLIANCE_TABS} activeTab={activeTab} onChange={setActiveTab} />
        </div>

        {/* Tab Content */}
        {activeTab === "kyc" && <KYCStatusTab />}
        {activeTab === "regulatory" && <RegulatoryMapTab />}
        {activeTab === "audits" && <AuditReportsTab />}
        {activeTab === "mrv" && <MRVStandardsTab />}
      </main>

      <DAppFooter />
    </div>
  );
}
