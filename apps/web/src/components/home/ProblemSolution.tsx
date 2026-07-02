"use client";

import { useRef } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  AlertTriangle,
  Check,
  X,
  Shield,
  Clock,
  ArrowRight,
} from "lucide-react";
import { OptimizedImage } from "@/components/shared/OptimizedImage";

const legacyProblems = [
  "Fragmented provenance across registries, spreadsheets, and PDFs",
  "Self-reported data separated from physical operating evidence",
  "Periodic audits that arrive after market decisions are made",
  "Opaque ownership chains that raise double-counting risk",
];

const terraQuraSolutions = [
  "Every credit issued with an on-chain chain of custody",
  "IoT telemetry validated against thermodynamic bounds",
  "Near-real-time verification through the Aethelred Oracle",
  "Transparent ownership, transfer, and retirement history",
];

const metrics = [
  {
    label: "Verification time",
    legacy: "3–5 years",
    aethelred: "< 2 seconds",
    delta: "real-time",
  },
  {
    label: "Data transparency",
    legacy: "Opaque",
    aethelred: "100% on-chain",
    delta: "complete",
  },
  {
    label: "Audit cost / project",
    legacy: "$50K+",
    aethelred: "Near zero",
    delta: "−99%",
  },
  {
    label: "Confidence interval",
    legacy: "Disputed",
    aethelred: "Cryptographic",
    delta: "provable",
  },
];

export function ProblemSolution() {
  const sectionRef = useRef<HTMLElement>(null);
  const prefersReducedMotion = useReducedMotion();
  const animate = !prefersReducedMotion;

  return (
    <section
      ref={sectionRef}
      className="relative section-padding overflow-hidden bg-[#03060c]"
      aria-labelledby="comparison-heading"
    >
      {/* Background - blueprint + softer aurora at low opacity */}
      <div
        className="absolute inset-0 bg-blueprint-fine opacity-[0.5] pointer-events-none"
        aria-hidden
      />
      <div
        className="absolute inset-0 pointer-events-none"
        aria-hidden
        style={{
          background:
            "radial-gradient(60% 50% at 0% 50%, rgba(220, 38, 38, 0.045), transparent 60%), radial-gradient(60% 50% at 100% 50%, rgba(16, 185, 129, 0.08), transparent 60%)",
        }}
      />

      <div className="container-premium relative z-10">
        {/* Header */}
        <div className="mb-10 lg:mb-12 max-w-3xl">
          <span className="kicker mb-6">
            <span className="kicker-num">02</span>
            Industry Divide
          </span>
          <h2
            id="comparison-heading"
            className="font-display text-display lg:text-display-lg text-white leading-[1.08]"
          >
            Why carbon markets break.{" "}
            <span className="text-white/85">And how </span>
            <span className="accent-italic">Aethelred</span>
            <span className="text-white/85"> repairs them.</span>
          </h2>
          <p className="mt-6 max-w-xl text-body text-white/70 font-body leading-relaxed">
            Carbon markets do not fail because buyers stopped caring. They fail
            because the evidence arrives too late, too manually, and too far
            from the asset it is meant to support.
          </p>
        </div>

        <motion.div
          className="mb-10 lg:mb-14 grid items-stretch gap-6 lg:grid-cols-12"
          initial={animate ? { opacity: 0, y: 18 } : false}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.25 }}
          transition={{ duration: 0.55 }}
        >
          <div className="relative min-h-[280px] overflow-hidden rounded-3xl border border-white/[0.07] bg-black/30 lg:col-span-7">
            <OptimizedImage
              src="regulator-ready-audit-trail"
              alt="Regulator-ready carbon audit trail rendered as a luminous data architecture"
              fill
              sizes="(min-width: 1024px) 58vw, 100vw"
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-[#03060c]/75 via-[#03060c]/25 to-transparent" />
            <div className="absolute left-5 top-5 rounded-xl border border-emerald-400/20 bg-[#020408]/70 px-4 py-3 backdrop-blur-md">
              <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-emerald-300">
                Audit trail
              </div>
              <div className="mt-1 text-sm font-semibold text-white">
                Live evidence, not annual paperwork
              </div>
            </div>
          </div>

          <div className="card-bento-hero rounded-3xl p-7 lg:col-span-5 lg:p-8">
            <span className="kicker mb-5">
              <span className="kicker-num">market</span>
              Trust gap
            </span>
            <h3 className="font-display text-2xl lg:text-3xl text-white tracking-tight">
              The winning registry will feel less like a database and more like
              an evidence network.
            </h3>
            <p className="mt-4 text-[15px] leading-relaxed text-white/70 font-body">
              TerraQura connects measurement, validation, issuance, and
              retirement into a single chain of custody. Buyers see why a credit
              exists, operators see what was accepted, and auditors see the
              evidence behind every state change.
            </p>
          </div>
        </motion.div>

        {/* Comparison panels - deliberate asymmetry: legacy is muted, ours dominates */}
        <div className="grid lg:grid-cols-12 gap-6 lg:gap-8 mb-20">
          {/* Legacy column - compressed, desaturated */}
          <motion.div
            className="lg:col-span-5 self-start"
            initial={animate ? { opacity: 0, x: -20 } : false}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.5 }}
          >
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.015] p-6 lg:p-7 relative overflow-hidden">
              {/* Mute overlay (visual: grayscale-ish via desat tint) */}
              <div
                className="absolute inset-0 bg-white/[0.005] pointer-events-none"
                aria-hidden
              />

              <div className="relative">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-red-500/10 text-red-300 ring-1 ring-red-500/20">
                      <AlertTriangle className="h-4 w-4" />
                    </span>
                    <div>
                      <div className="text-xs font-mono uppercase tracking-[0.18em] text-red-400/80">
                        Before
                      </div>
                      <h3 className="font-display text-base text-white/85 tracking-tight mt-0.5">
                        Legacy market records
                      </h3>
                    </div>
                  </div>
                </div>

                {/* Mock "spec" block - registry record fragment */}
                <div className="mb-5 rounded-lg border border-white/[0.06] bg-black/30 p-3 font-mono text-[11px] leading-relaxed text-white/55 grayscale">
                  <div className="flex justify-between">
                    <span className="text-white/40">project</span>
                    <span>VCS-2417 (static record)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/40">credits</span>
                    <span className="line-through opacity-70">
                      10,000 claimed
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/40">last audit</span>
                    <span>periodic · pdf</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/40">provenance</span>
                    <span className="text-red-300/80">unverifiable</span>
                  </div>
                </div>

                <ul className="space-y-2.5">
                  {legacyProblems.map((p) => (
                    <li
                      key={p}
                      className="flex items-start gap-2.5 text-[14px] text-white/60 font-body"
                    >
                      <span className="mt-1.5 inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-red-500/12 text-red-300 ring-1 ring-red-500/15">
                        <X className="h-2.5 w-2.5" />
                      </span>
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </motion.div>

          {/* Arrow connector - desktop only */}
          <div className="hidden lg:flex lg:col-span-1 items-center justify-center">
            <motion.div
              className="flex flex-col items-center gap-2 text-emerald-300/70"
              animate={animate ? { x: [-4, 4, -4] } : undefined}
              transition={{
                duration: 2.6,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            >
              <ArrowRight className="h-5 w-5" />
              <span className="text-[10px] font-mono uppercase tracking-[0.22em] rotate-90 origin-center">
                upgrade
              </span>
            </motion.div>
          </div>

          {/* TerraQura column - dominant, glowing, larger */}
          <motion.div
            className="lg:col-span-6"
            initial={animate ? { opacity: 0, x: 20 } : false}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.55, delay: 0.1 }}
          >
            <div className="rounded-3xl card-bento-hero p-7 lg:p-9 relative overflow-hidden">
              {/* Glow corner */}
              <div
                aria-hidden
                className="absolute -top-32 -right-32 h-[28rem] w-[28rem] rounded-full pointer-events-none"
                style={{
                  background:
                    "radial-gradient(closest-side, rgba(16,185,129,0.30), transparent 70%)",
                  filter: "blur(60px)",
                }}
              />
              <div className="relative">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30">
                      <Shield className="h-4.5 w-4.5" />
                    </span>
                    <div>
                      <div className="text-xs font-mono uppercase tracking-[0.18em] text-emerald-300/85">
                        After · Aethelred
                      </div>
                      <h3 className="font-display text-lg text-white tracking-tight mt-0.5">
                        Engineered carbon truth
                      </h3>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-mono uppercase tracking-[0.16em] text-emerald-300 ring-1 ring-emerald-500/25">
                    <span className="pulse-dot h-1.5 w-1.5" /> Live
                  </span>
                </div>

                {/* Mock "spec" block - token / verification record */}
                <div className="mb-6 rounded-xl border border-emerald-500/15 bg-black/30 p-4 font-mono text-[11.5px] leading-relaxed text-white/70">
                  <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
                    <div className="flex justify-between">
                      <span className="text-white/45">project</span>
                      <span className="text-white/95">DAC-AUH-001</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/45">credits</span>
                      <span className="text-emerald-300 tnum">
                        10,000 / 10,000
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/45">verification</span>
                      <span className="text-white/95">phys-bound</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/45">last block</span>
                      <span className="text-white/95">2.1s ago</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/45">satellite</span>
                      <span className="text-emerald-300">ok</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/45">provenance</span>
                      <span className="text-emerald-300">on-chain</span>
                    </div>
                  </div>
                </div>

                <ul className="space-y-3">
                  {terraQuraSolutions.map((s) => (
                    <li
                      key={s}
                      className="flex items-start gap-3 text-[14.5px] text-white/85 font-body"
                    >
                      <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30">
                        <Check className="h-3 w-3" />
                      </span>
                      <span>{s}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Comparison strip - full-width, dramatic numbers */}
        <motion.div
          className="rounded-2xl card-bento p-6 lg:p-8"
          initial={animate ? { opacity: 0, y: 16 } : false}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.5, delay: 0.15 }}
        >
          <div className="flex items-center gap-2.5 mb-7 text-[11px] font-mono uppercase tracking-[0.2em] text-white/50">
            <Clock className="h-3.5 w-3.5" />
            <span>Performance comparison</span>
          </div>

          <div className="grid gap-x-8 lg:grid-cols-4 gap-y-7">
            {metrics.map((m) => (
              <div
                key={m.label}
                className="flex flex-col gap-1.5 border-l border-white/[0.06] pl-5 first:border-l-0 first:pl-0 lg:border-l lg:pl-5 lg:first:border-l-0 lg:first:pl-0"
              >
                <span className="text-[10.5px] font-mono uppercase tracking-[0.18em] text-white/45">
                  {m.label}
                </span>
                <span className="text-[13px] font-mono text-red-300/55 line-through tnum">
                  {m.legacy}
                </span>
                <span className="font-display text-xl text-white tracking-tight tnum">
                  {m.aethelred}
                </span>
                <span className="inline-flex w-fit items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-mono uppercase tracking-[0.18em] text-emerald-300 ring-1 ring-emerald-500/20">
                  {m.delta}
                </span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
