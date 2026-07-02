"use client";

import { useRef } from "react";
import {
  motion,
  useScroll,
  useTransform,
  useReducedMotion,
} from "framer-motion";
import {
  Cpu,
  Scale,
  Database,
  CheckCircle2,
  Cloud,
  Factory,
  Radio,
  Eye,
  Satellite,
  CircleDot,
  ArrowRight,
} from "lucide-react";
import { OptimizedImage } from "@/components/shared/OptimizedImage";

const steps = [
  {
    num: "01",
    title: "Capture",
    subtitle: "Sensor stream",
    desc: "Facilities stream energy, flow, temperature, pressure, and operating state to the NativeIoT Oracle. Each reading is signed at the edge.",
    icon: Cpu,
    color: "#10b981",
    spec: [
      ["Cadence", "1 Hz · live"],
      ["Signed", "Edge ECDSA"],
      ["Cross-check", "Satellite imagery"],
    ],
  },
  {
    num: "02",
    title: "Validate",
    subtitle: "Physics engine",
    desc: "Aethelred evaluates each claim against thermodynamic bounds and operating context. Out-of-range readings are stopped before issuance.",
    icon: Scale,
    color: "#06b6d4",
    spec: [
      ["Range", "200–600 kWh / t"],
      ["Logic", "Pure on-chain"],
      ["Decision", "< 2 s"],
    ],
  },
  {
    num: "03",
    title: "Mint",
    subtitle: "Issuance",
    desc: "Accepted removals mint as ERC-1155 credits with provenance metadata, creating an auditable path from capture to retirement.",
    icon: Database,
    color: "#3b82f6",
    spec: [
      ["Standard", "ERC-1155"],
      ["Settlement", "Gasless · ERC-2771"],
      ["Provenance", "Full lineage"],
    ],
  },
];

const flowSteps = [
  { label: "Atmospheric CO₂", Icon: Cloud },
  { label: "DAC Facility", Icon: Factory },
  { label: "IoT Sensors", Icon: Radio },
  { label: "Aethelred Oracle", Icon: Eye },
  { label: "Satellite Verify", Icon: Satellite },
  { label: "ERC-1155 Token", Icon: CircleDot },
];

export function ProofEngine() {
  const sectionRef = useRef<HTMLElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = useReducedMotion();
  const animate = !prefersReducedMotion;

  const { scrollYProgress } = useScroll({
    target: timelineRef,
    offset: ["start 0.85", "end 0.55"],
  });

  // Drives the gradient line between the three stages.
  const lineWidth = useTransform(scrollYProgress, [0, 1], ["0%", "100%"]);

  return (
    <section
      ref={sectionRef}
      className="relative section-padding overflow-hidden bg-[#03060c]"
      aria-labelledby="proof-engine-heading"
    >
      {/* Background - denser blueprint + corner aurora */}
      <div
        className="absolute inset-0 bg-blueprint pointer-events-none opacity-90"
        aria-hidden
      />
      <div
        className="absolute inset-0 pointer-events-none bg-aurora opacity-60"
        aria-hidden
      />

      <div className="container-premium relative z-10">
        {/* Header */}
        <div className="mb-10 lg:mb-12 max-w-3xl">
          <span className="kicker mb-6">
            <span className="kicker-num">03</span>
            Aethelred Protocol &middot; Verification Pipeline
          </span>
          <h2
            id="proof-engine-heading"
            className="font-display text-display lg:text-display-lg text-white leading-[1.06]"
          >
            Three steps to{" "}
            <span className="accent-italic">mathematical truth.</span>
          </h2>
          <p className="mt-6 max-w-xl text-body text-white/70 font-body leading-relaxed">
            Every credit passes through a three-phase engine that ties facility
            data, physics validation, and token issuance into one inspectable
            record.
          </p>
        </div>

        <motion.div
          className="mb-12 overflow-hidden rounded-3xl border border-white/[0.07] bg-black/30"
          initial={animate ? { opacity: 0, y: 18 } : false}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.25 }}
          transition={{ duration: 0.55 }}
        >
          <div className="relative min-h-[300px] lg:min-h-[420px]">
            <OptimizedImage
              src="mrv-data-river"
              alt="Measurement, reporting, and verification data flowing from sensors to carbon infrastructure"
              fill
              sizes="100vw"
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#03060c] via-[#03060c]/15 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 grid gap-4 p-5 sm:grid-cols-3 lg:p-7">
              {[
                ["Source", "Signed facility telemetry"],
                ["Check", "Physics-bound validation"],
                ["Output", "Tokenized removal claim"],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="rounded-2xl border border-white/[0.08] bg-[#020408]/65 p-4 backdrop-blur-md"
                >
                  <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-emerald-300/80">
                    {label}
                  </div>
                  <div className="mt-2 text-sm font-semibold text-white">
                    {value}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Timeline - desktop horizontal, mobile vertical */}
        <div ref={timelineRef} className="relative">
          {/* Connecting line - desktop */}
          <div className="hidden lg:block absolute left-[6%] right-[6%] top-[52%] -translate-y-1/2 h-px bg-white/[0.05]">
            <motion.div
              className="h-full bg-gradient-to-r from-emerald-500 via-cyan-400 to-blue-500"
              style={animate ? { width: lineWidth } : { width: "100%" }}
            />
          </div>

          <div className="grid gap-y-10 lg:grid-cols-3 lg:gap-x-8">
            {steps.map((step, idx) => {
              const Icon = step.icon;
              return (
                <motion.div
                  key={step.num}
                  className="relative"
                  initial={animate ? { opacity: 0, y: 22 } : false}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.3 }}
                  transition={{ duration: 0.55, delay: idx * 0.08 }}
                >
                  {/* Step number - huge, editorial */}
                  <div className="flex items-end justify-between mb-4 lg:mb-6">
                    <span
                      className="font-display text-[5rem] lg:text-[6.5rem] leading-none tracking-tighter tnum"
                      style={{ color: step.color, opacity: 0.18 }}
                    >
                      {step.num}
                    </span>
                    {/* Step dot on the timeline (desktop) */}
                    <div className="hidden lg:flex items-center justify-center">
                      <span
                        className="relative h-3.5 w-3.5 rounded-full ring-4 ring-[#03060c]"
                        style={{ background: step.color }}
                      >
                        <span
                          className="absolute inset-[-6px] rounded-full opacity-40 blur-sm"
                          style={{ background: step.color }}
                        />
                      </span>
                    </div>
                    <span
                      className="lg:hidden inline-flex h-9 w-9 items-center justify-center rounded-lg ring-1"
                      style={{
                        background: `${step.color}1c`,
                        color: step.color,
                        borderColor: `${step.color}30`,
                      }}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                  </div>

                  {/* Card */}
                  <div className="rounded-2xl card-bento p-6 lg:p-7 relative">
                    {/* Top accent bar */}
                    <div
                      className="absolute top-0 left-0 right-0 h-px"
                      style={{
                        background: `linear-gradient(90deg, ${step.color}, transparent 80%)`,
                      }}
                    />
                    <div className="flex items-center gap-2.5 mb-2">
                      <span
                        className="hidden lg:inline-flex h-9 w-9 items-center justify-center rounded-lg ring-1"
                        style={{
                          background: `${step.color}18`,
                          borderColor: `${step.color}30`,
                          color: step.color,
                        }}
                      >
                        <Icon className="h-4 w-4" />
                      </span>
                      <span
                        className="text-[10.5px] font-mono uppercase tracking-[0.22em]"
                        style={{ color: step.color }}
                      >
                        {step.subtitle}
                      </span>
                    </div>
                    <h3 className="font-display text-2xl lg:text-3xl text-white tracking-tight">
                      {step.title}
                    </h3>
                    <p className="mt-3 text-[14.5px] text-white/70 font-body leading-relaxed">
                      {step.desc}
                    </p>

                    {/* Spec rows */}
                    <dl className="mt-5 pt-4 border-t border-white/[0.05] space-y-1.5">
                      {step.spec.map(([label, value]) => (
                        <div key={label} className="spec-row">
                          <dt className="spec-label">{label}</dt>
                          <span className="spec-leader" aria-hidden />
                          <dd className="spec-value">{value}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* End-to-end flow visualization */}
        <motion.div
          className="mt-10 lg:mt-14 rounded-2xl card-bento p-6 lg:p-8"
          initial={animate ? { opacity: 0, y: 16 } : false}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.55, delay: 0.1 }}
        >
          <div className="flex items-center justify-between mb-7">
            <span className="kicker">
              <span className="kicker-num">flow</span>
              End-to-end Verification Path
            </span>
            <span className="hidden sm:inline-flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-[0.18em] text-emerald-300/85">
              <span className="pulse-dot h-1.5 w-1.5" />
              Continuous
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4">
            {flowSteps.map((step, index) => {
              const StepIcon = step.Icon;
              const isLast = index === flowSteps.length - 1;
              return (
                <div key={step.label} className="flex items-center">
                  <div
                    className={`flex items-center gap-2 sm:gap-3 px-3.5 sm:px-4 py-2.5 rounded-xl border text-[13px] font-medium transition-colors ${
                      isLast
                        ? "bg-emerald-500/12 border-emerald-500/30 text-emerald-300"
                        : "bg-white/[0.025] border-white/[0.06] text-white/72 hover:border-white/12"
                    }`}
                  >
                    <StepIcon className="h-4 w-4" />
                    <span className="hidden sm:inline">{step.label}</span>
                  </div>
                  {!isLast && (
                    <motion.div
                      className="mx-1.5 sm:mx-2 text-white/25"
                      animate={animate ? { x: [0, 3, 0] } : undefined}
                      transition={{
                        duration: 1.6,
                        repeat: Infinity,
                        delay: index * 0.18,
                        ease: "easeInOut",
                      }}
                    >
                      <ArrowRight className="h-4 w-4" />
                    </motion.div>
                  )}
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* Trust indicators */}
        <motion.div
          className="mt-12 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-[13px] text-white/65"
          initial={animate ? { opacity: 0 } : false}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          {[
            "Cryptographically verified",
            "Tamper-proof records",
            "Real-time monitoring",
          ].map((label) => (
            <div key={label} className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-300/85" />
              <span>{label}</span>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
