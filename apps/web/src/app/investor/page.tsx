/**
 * Investor Page - Vision & Investment Case
 *
 * Clean, honest page presenting:
 * - Market opportunity in verified carbon
 * - TerraQura's approach and differentiation
 * - Planned tokenomics (clearly labeled as planned)
 * - Backing and regulatory context
 * - Investor inquiry CTA
 *
 * NO fake metrics, NO fabricated revenue, NO false audit claims.
 */

"use client";

import { useRef, useState, useEffect } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { motion, useInView, type Variants } from "framer-motion";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";

/* ─── animation helpers ─── */
const fadeUp: Variants = {
  hidden: { opacity: 0, y: 32 },
  visible: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.6,
      delay: i * 0.12,
      ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
    },
  }),
};

const staggerContainer: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
};

function Section({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.1 });
  const [fallback, setFallback] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setFallback(true), 2000);
    return () => clearTimeout(timer);
  }, []);
  return (
    <motion.section
      ref={ref}
      initial="hidden"
      animate={(inView || fallback) ? "visible" : "hidden"}
      variants={staggerContainer}
      className={className}
    >
      {children}
    </motion.section>
  );
}

/* ─── data ─── */
const marketStats = [
  { label: "Voluntary Carbon Market (2023)", value: "$2 B+" },
  { label: "Projected Market (2030)", value: "$50 B+" },
  { label: "Credits Questioned for Integrity", value: "~90%" },
  { label: "Enterprise Net-Zero Commitments", value: "4,000+" },
];

const approachPillars = [
  {
    icon: (
      <svg className="h-8 w-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
      </svg>
    ),
    title: "Proof-of-Physics Verification",
    description:
      "Every carbon credit is backed by real-time IoT sensor data: energy input, CO\u2082 output, thermodynamic validation. No self-reported estimates. No manual audits. Physics cannot be lobbied.",
  },
  {
    icon: (
      <svg className="h-8 w-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0012 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75z" />
      </svg>
    ),
    title: "Sovereign Infrastructure",
    description:
      "Purpose-built blockchain (Aethelred L1) designed for carbon asset compliance, with ADGM (Abu Dhabi) regulatory alignment. Institutional-grade custody and settlement.",
  },
  {
    icon: (
      <svg className="h-8 w-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z" />
      </svg>
    ),
    title: "Enterprise-First Go-to-Market",
    description:
      "Targeting enterprise ESG buyers and sovereign wealth mandates first, not retail speculation. Fiat on-ramp, compliance-ready reporting, and API integration from day one.",
  },
  {
    icon: (
      <svg className="h-8 w-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
      </svg>
    ),
    title: "DAC Facility Network",
    description:
      "Onboarding Direct Air Capture facilities as first-party suppliers. Each facility is IoT-instrumented and continuously verified, creating an auditable chain of custody from capture to retirement.",
  },
];

const plannedTokenomics = [
  {
    token: "AETH",
    role: "Network Gas & Governance",
    description:
      "Native token of the Aethelred L1 chain. Used for transaction fees, staking, and on-chain governance votes. Planned distribution includes ecosystem development, team vesting, and community allocation.",
  },
  {
    token: "TQC",
    role: "Carbon Credit Token (ERC-1155)",
    description:
      "Each TQC token represents one verified tonne of CO\u2082 removed via Direct Air Capture. Minted only after Proof-of-Physics validation. Tradeable, retirable, and fully traceable on-chain.",
  },
  {
    token: "DAO",
    role: "Governance Roadmap",
    description:
      "Progressive decentralization toward community governance. Protocol parameters, verification thresholds, and treasury allocation will transition to token-holder governance over time.",
  },
];

const backingPoints = [
  {
    title: "Zhyra Holdings",
    detail:
      "Parent company headquartered in Abu Dhabi. Provides operational backing, strategic direction, and access to Gulf-region climate finance networks.",
  },
  {
    title: "Abu Dhabi & ADGM",
    detail:
      "Pursuing regulatory registration through Abu Dhabi Global Market (ADGM), one of the world\u2019s leading financial free zones with a progressive digital asset framework.",
  },
  {
    title: "Aethelred Network (Live)",
    detail:
      "Smart contracts deployed and operational on the Aethelred Network. AccessControl, VerificationEngine, CarbonCredit (ERC-1155), Marketplace, and GaslessMarketplace contracts are live for testing and validation.",
  },
];

const roadmapSteps = [
  {
    status: "complete" as const,
    label: "Smart Contracts on Aethelred Network",
    detail:
      "AccessControl, VerificationEngine, CarbonCredit (ERC-1155), Marketplace, and GaslessMarketplace deployed and functional.",
  },
  {
    status: "complete" as const,
    label: "Proof-of-Physics Simulation Engine",
    detail:
      "Interactive physics simulator validating energy-to-CO\u2082 ratios (200\u2013600 kWh/tonne) live on the website.",
  },
  {
    status: "active" as const,
    label: "IoT Sensor Integration & Facility Onboarding",
    detail:
      "Developing the hardware-software bridge to connect real DAC facility sensors to the on-chain verification pipeline.",
  },
  {
    status: "upcoming" as const,
    label: "Mainnet Launch (Aethelred L1)",
    detail:
      "Sovereign chain deployment with full Proof-of-Physics consensus and institutional custody integrations.",
  },
  {
    status: "upcoming" as const,
    label: "First Enterprise Pilot",
    detail:
      "Onboarding initial enterprise buyer and DAC supplier for live, physics-verified credit issuance and retirement.",
  },
];

/* ─── page ─── */
export default function InvestorPage() {
  return (
    <>
      <Navbar />
      <main id="main-content" className="min-h-screen bg-midnight-950 pt-20">
        {/* ══════════════ HERO ══════════════ */}
        <Section className="relative overflow-hidden px-4 py-16 sm:py-20 lg:py-24">
          {/* subtle gradient glow */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 h-[600px] w-[900px] rounded-full bg-emerald-500/5 blur-[160px]"
          />

          <div className="relative mx-auto max-w-4xl text-center">
            {/* badge */}
            <motion.div variants={fadeUp} custom={0}>
              <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1.5 text-sm font-semibold uppercase tracking-widest text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Vision: Pre-Revenue
              </span>
            </motion.div>

            {/* title */}
            <motion.h1
              variants={fadeUp}
              custom={1}
              className="mt-8 font-display text-display-lg lg:text-display-xl text-white"
            >
              The Investment Case for{" "}
              <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
                Verified Carbon
              </span>
            </motion.h1>

            {/* subtitle */}
            <motion.p
              variants={fadeUp}
              custom={2}
              className="mx-auto mt-6 max-w-3xl text-body-lg font-body leading-relaxed text-white/70"
            >
              The voluntary carbon market is broken by a trust crisis. TerraQura
              is building the physics-verified infrastructure layer to restore
              integrity, and unlock institutional capital at scale.
            </motion.p>

            {/* hero buttons */}
            <motion.div
              variants={fadeUp}
              custom={2.5}
              className="mt-8 flex flex-col sm:flex-row gap-4 justify-center"
            >
              <Link
                href="#cta"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 text-base font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl transition-all shadow-lg shadow-emerald-600/20"
              >
                Contact Investor Relations
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/technology"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 text-base font-semibold text-white/80 border border-white/10 hover:border-white/20 rounded-xl transition-all"
              >
                Explore the Protocol
              </Link>
            </motion.div>

            {/* disclaimer */}
            <motion.div
              variants={fadeUp}
              custom={3}
              className="mx-auto mt-8 max-w-xl rounded-lg border border-amber-500/20 bg-amber-500/5 px-5 py-3 text-sm font-body leading-relaxed text-amber-300/80"
            >
              <strong className="text-amber-300">Disclaimer:</strong> TerraQura
              is a pre-revenue, pre-funding startup. All figures on this page
              represent market research and forward-looking plans, not
              current platform metrics. Nothing here constitutes a securities
              offering or investment advice.
            </motion.div>
          </div>
        </Section>

        {/* ══════════════ MARKET OPPORTUNITY ══════════════ */}
        <Section className="px-4 py-20">
          <div className="mx-auto max-w-6xl">
            <motion.div variants={fadeUp} custom={0} className="text-center">
              <h2 className="font-display text-display-sm text-white">
                Market Opportunity
              </h2>
              <p className="mx-auto mt-4 max-w-2xl font-body text-[15px] leading-relaxed text-white/70">
                The voluntary carbon market is projected to grow 25x this decade
                , but only if the integrity crisis is solved. That crisis
                is TerraQura&rsquo;s opportunity.
              </p>
            </motion.div>

            {/* stat cards */}
            <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {marketStats.map((stat, i) => (
                <motion.div
                  key={stat.label}
                  variants={fadeUp}
                  custom={i + 1}
                  className="rounded-xl border border-white/5 bg-white/[0.02] p-6 text-center backdrop-blur-sm"
                >
                  <p className="font-display text-3xl font-bold text-emerald-400">
                    {stat.value}
                  </p>
                  <p className="mt-2 text-sm font-body text-white/70">{stat.label}</p>
                </motion.div>
              ))}
            </div>

            <motion.p
              variants={fadeUp}
              custom={5}
              className="mt-6 text-center text-sm font-body text-white/70"
            >
              Sources: McKinsey (2023), MSCI Carbon Markets, BloombergNEF, The
              Guardian investigation into Verra credits.
            </motion.p>

            {/* integrity crisis callout */}
            <motion.div
              variants={fadeUp}
              custom={6}
              className="mx-auto mt-14 max-w-3xl rounded-2xl border border-red-500/10 bg-red-500/[0.03] p-8"
            >
              <h3 className="font-display text-xl font-semibold text-red-400">
                The Integrity Crisis
              </h3>
              <p className="mt-3 font-body leading-relaxed text-white/70">
                Investigations by The Guardian, Die Zeit, and SourceMaterial
                revealed that over 90% of rainforest carbon offsets certified by
                the largest registry may be &ldquo;phantom credits&rdquo;,
                not representing real emission reductions. Enterprise buyers are
                pulling back. Regulators are tightening. The market needs a new
                verification paradigm.
              </p>
            </motion.div>
          </div>
        </Section>

        {/* ══════════════ THE TERRAQURA APPROACH ══════════════ */}
        <Section className="px-4 py-20">
          <div className="mx-auto max-w-6xl">
            <motion.div variants={fadeUp} custom={0} className="text-center">
              <h2 className="font-display text-display-sm text-white">
                The TerraQura Approach
              </h2>
              <p className="mx-auto mt-4 max-w-2xl font-body text-[15px] leading-relaxed text-white/70">
                We replace trust-based verification with physics-based proof.
                Every carbon credit is validated by thermodynamics, not
                third-party auditors with conflicts of interest.
              </p>
            </motion.div>

            <div className="mt-14 grid gap-6 sm:grid-cols-2">
              {approachPillars.map((pillar, i) => (
                <motion.div
                  key={pillar.title}
                  variants={fadeUp}
                  custom={i + 1}
                  className="group rounded-2xl border border-white/5 bg-white/[0.02] p-8 transition-colors hover:border-emerald-500/20 hover:bg-emerald-500/[0.03]"
                >
                  <div aria-hidden="true">{pillar.icon}</div>
                  <h3 className="mt-4 font-display text-xl font-semibold text-white">
                    {pillar.title}
                  </h3>
                  <p className="mt-3 font-body leading-relaxed text-white/70">
                    {pillar.description}
                  </p>
                </motion.div>
              ))}
            </div>
          </div>
        </Section>

        {/* ══════════════ PLANNED TOKENOMICS ══════════════ */}
        <Section className="px-4 py-20">
          <div className="mx-auto max-w-5xl">
            <motion.div variants={fadeUp} custom={0} className="text-center">
              <span className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-sm font-semibold uppercase tracking-widest text-cyan-400">
                Planned: Subject to Change
              </span>
              <h2 className="mt-6 font-display text-display-sm text-white">
                Token Architecture
              </h2>
              <p className="mx-auto mt-4 max-w-2xl font-body text-[15px] leading-relaxed text-white/70">
                A dual-token model separating network utility from carbon asset
                value. Final tokenomics will be published prior to any public
                distribution event.
              </p>
            </motion.div>

            <div className="mt-14 grid gap-6 lg:grid-cols-3">
              {plannedTokenomics.map((item, i) => (
                <motion.div
                  key={item.token}
                  variants={fadeUp}
                  custom={i + 1}
                  className="rounded-2xl border border-white/5 bg-white/[0.02] p-8"
                >
                  <div className="inline-flex items-center gap-2">
                    <span className="rounded-md bg-emerald-500/10 px-2.5 py-1 font-mono text-sm font-bold text-emerald-400">
                      {item.token}
                    </span>
                  </div>
                  <p className="mt-1 text-sm font-mono font-semibold uppercase tracking-wide text-white/70">
                    {item.role}
                  </p>
                  <p className="mt-4 text-[15px] font-body leading-relaxed text-white/70">
                    {item.description}
                  </p>
                </motion.div>
              ))}
            </div>

            <motion.p
              variants={fadeUp}
              custom={4}
              className="mt-8 text-center text-sm font-body text-white/70"
            >
              Token distribution details, vesting schedules, and allocation
              percentages will be finalized and published in a formal whitepaper
              prior to any token generation event.
            </motion.p>
          </div>
        </Section>

        {/* ══════════════ BACKING & REGULATORY ══════════════ */}
        <Section className="px-4 py-20">
          <div className="mx-auto max-w-5xl">
            <motion.div variants={fadeUp} custom={0} className="text-center">
              <h2 className="font-display text-display-sm text-white">
                Backing &amp; Regulatory Path
              </h2>
              <p className="mx-auto mt-4 max-w-2xl font-body text-[15px] leading-relaxed text-white/70">
                Rooted in Abu Dhabi&rsquo;s emerging climate finance ecosystem,
                with a clear path to regulated operation.
              </p>
            </motion.div>

            <div className="mt-14 space-y-6">
              {backingPoints.map((point, i) => (
                <motion.div
                  key={point.title}
                  variants={fadeUp}
                  custom={i + 1}
                  className="rounded-xl border border-white/5 bg-white/[0.02] p-6 sm:p-8"
                >
                  <h3 className="font-display text-lg font-semibold text-white">
                    {point.title}
                  </h3>
                  <p className="mt-2 font-body leading-relaxed text-white/70">
                    {point.detail}
                  </p>
                </motion.div>
              ))}
            </div>
          </div>
        </Section>

        {/* ══════════════ COMPETITIVE LANDSCAPE ══════════════ */}
        <Section className="px-4 py-20">
          <div className="mx-auto max-w-6xl">
            <motion.div variants={fadeUp} custom={0} className="text-center">
              <h2 className="font-display text-display-sm text-white">
                Competitive Landscape
              </h2>
              <p className="mx-auto mt-4 max-w-2xl font-body text-[15px] leading-relaxed text-white/70">
                How TerraQura compares to existing carbon market infrastructure
                across the key dimensions that matter to institutional buyers.
              </p>
            </motion.div>

            {/* Mobile: Card layout */}
            <motion.div variants={fadeUp} custom={1} className="mt-14 sm:hidden space-y-4">
              {[
                { dim: "Verification Method", legacy: "Self-reported data, quarterly manual audits", tq: "Real-time IoT sensors + thermodynamic validation" },
                { dim: "Data Integrity", legacy: "PDF submissions, no tamper detection", tq: "Edge-signed telemetry, on-chain attestation" },
                { dim: "Settlement", legacy: "Manual transfers, weeks to settle", tq: "On-chain settlement, gasless enterprise transactions" },
                { dim: "Audit Trail", legacy: "Fragmented, paper-based records", tq: "Full on-chain provenance, publicly verifiable" },
                { dim: "Credit Scope", legacy: "Nature-based offsets (estimates)", tq: "DAC removal credits (measured)" },
              ].map((row, i) => (
                <div key={i} className="p-5 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                  <p className="text-sm font-semibold text-white mb-3">{row.dim}</p>
                  <div className="space-y-2">
                    <div>
                      <span className="text-[11px] font-data text-white/40 uppercase tracking-wider">Legacy</span>
                      <p className="text-sm text-white/50 leading-relaxed">{row.legacy}</p>
                    </div>
                    <div>
                      <span className="text-[11px] font-data text-emerald-400/60 uppercase tracking-wider">TerraQura</span>
                      <p className="text-sm text-emerald-400/80 leading-relaxed">{row.tq}</p>
                    </div>
                  </div>
                </div>
              ))}
            </motion.div>

            {/* Desktop: Table layout */}
            <motion.div
              variants={fadeUp}
              custom={1}
              className="mt-14 hidden sm:block"
            >
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="py-4 pr-6 text-sm font-data text-white/50 uppercase tracking-wider">Dimension</th>
                    <th className="py-4 px-6 text-sm font-data text-white/50 uppercase tracking-wider">Legacy Registries</th>
                    <th className="py-4 px-6 text-sm font-data text-emerald-400/70 uppercase tracking-wider">TerraQura</th>
                  </tr>
                </thead>
                <tbody className="text-[15px] font-body">
                  {[
                    { dim: "Verification Method", legacy: "Self-reported data, quarterly manual audits", tq: "Real-time IoT sensors + thermodynamic validation" },
                    { dim: "Data Integrity", legacy: "PDF submissions, no tamper detection", tq: "Edge-signed telemetry, on-chain attestation" },
                    { dim: "Settlement", legacy: "Manual transfers, weeks to settle", tq: "On-chain settlement, gasless enterprise transactions" },
                    { dim: "Audit Trail", legacy: "Fragmented, paper-based records", tq: "Full on-chain provenance, publicly verifiable" },
                    { dim: "Credit Scope", legacy: "Nature-based offsets (estimates)", tq: "DAC removal credits (measured)" },
                  ].map((row, i) => (
                    <tr key={i} className="border-b border-white/5">
                      <td className="py-4 pr-6 text-white/90 font-semibold text-sm">{row.dim}</td>
                      <td className="py-4 px-6 text-white/50">{row.legacy}</td>
                      <td className="py-4 px-6 text-emerald-400/80">{row.tq}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </motion.div>
          </div>
        </Section>

        {/* ══════════════ CURRENT STATUS / ROADMAP ══════════════ */}
        <Section className="px-4 py-20">
          <div className="mx-auto max-w-4xl">
            <motion.div variants={fadeUp} custom={0} className="text-center">
              <h2 className="font-display text-display-sm text-white">
                Current Status
              </h2>
            </motion.div>

            <motion.div
              variants={fadeUp}
              custom={1}
              className="mx-auto mt-14 max-w-2xl"
            >
              <ol className="relative border-l border-emerald-500/20 pl-8 space-y-10">
                {roadmapSteps.map((step, i) => (
                  <li key={i} className="relative">
                    <span
                      className={`absolute -left-[41px] flex h-5 w-5 items-center justify-center rounded-full border-2 ${
                        step.status === "complete"
                          ? "border-emerald-500 bg-emerald-500"
                          : step.status === "active"
                            ? "border-emerald-500 bg-midnight-950"
                            : "border-slate-600 bg-midnight-950"
                      }`}
                    >
                      {step.status === "complete" && (
                        <svg
                          className="h-3 w-3 text-white"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={3}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      )}
                      {step.status === "active" && (
                        <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                      )}
                    </span>
                    <h4 className="font-display text-base font-semibold text-white">
                      {step.label}
                    </h4>
                    <p className="mt-1 text-[15px] font-body leading-relaxed text-white/70">
                      {step.detail}
                    </p>
                  </li>
                ))}
              </ol>
            </motion.div>
          </div>
        </Section>

        {/* ══════════════ CTA ══════════════ */}
        <Section className="px-4 py-16 sm:py-20 lg:py-24">
          <motion.div
            variants={fadeUp}
            custom={0}
            className="mx-auto max-w-3xl rounded-3xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/[0.06] to-cyan-500/[0.04] p-10 text-center sm:p-14"
          >
            <h2 className="font-display text-display-sm text-white">
              Investor Inquiries
            </h2>
            <p className="mx-auto mt-4 max-w-xl font-body text-[15px] leading-relaxed text-white/70">
              We are currently in conversations with aligned investors who share
              our conviction that carbon markets must be rebuilt on physical
              truth. If that resonates, we would like to hear from you.
            </p>

            <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
              <a
                href="mailto:invest@terraqura.com"
                className="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-8 py-3.5 text-sm font-semibold text-midnight-950 transition-colors hover:bg-emerald-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-midnight-950"
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                  />
                </svg>
                invest@terraqura.com
              </a>

              <Link
                href="/about"
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-8 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-midnight-950"
              >
                Learn About Us
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M17 8l4 4m0 0l-4 4m4-4H3"
                  />
                </svg>
              </Link>
            </div>

            <p className="mt-8 text-sm font-body text-white/70">
              This page is for informational purposes only and does not
              constitute an offer to sell or solicitation of an offer to buy any
              securities, tokens, or financial instruments. All forward-looking
              statements are subject to change.
            </p>
          </motion.div>
        </Section>
      </main>
      <Footer />
    </>
  );
}
