"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Activity, Cpu, BadgeCheck } from "lucide-react";

/**
 * Hero Verification Stack - animated visualization of the Proof-of-Physics
 * pipeline. Renders 3 connected stages: Capture → Validate → Mint.
 *
 * Design intent: looks like a fragment of an actual product dashboard, not a
 * marketing illustration. Mono labels, tabular nums, refined glass surfaces,
 * subtle live-data motion. This is the visual proof that "we built the thing."
 */
export function HeroVerificationStack() {
  const prefersReducedMotion = useReducedMotion();
  const animate = !prefersReducedMotion;

  return (
    <div
      aria-hidden="true"
      className="relative w-full max-w-md mx-auto lg:max-w-none lg:mx-0"
    >
      {/* Outer glow */}
      <div className="absolute -inset-8 rounded-[2.5rem] bg-emerald-500/[0.06] blur-3xl pointer-events-none" />

      <div className="relative">
        {/* Stage 1 - Capture */}
        <Stage
          step="01"
          icon={<Activity className="h-3.5 w-3.5" />}
          label="DAC Capture · Live"
          tone="emerald"
        >
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-[11px] font-mono">
            <div className="flex justify-between text-white/55">
              <span className="uppercase tracking-wider">Energy</span>
              <span className="text-white/95 tnum">412 <span className="text-white/40">kWh</span></span>
            </div>
            <div className="flex justify-between text-white/55">
              <span className="uppercase tracking-wider">CO₂</span>
              <span className="text-white/95 tnum">1.07 <span className="text-white/40">t</span></span>
            </div>
            <div className="flex justify-between text-white/55">
              <span className="uppercase tracking-wider">Site</span>
              <span className="text-white/85">Abu Dhabi</span>
            </div>
            <div className="flex justify-between text-white/55">
              <span className="uppercase tracking-wider">Sat-Verify</span>
              <span className="text-emerald-300/90 inline-flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                ok
              </span>
            </div>
          </div>
          {/* Faint sparkline */}
          <div className="mt-4 flex h-8 items-end gap-[3px]">
            {SPARKLINE.map((v, i) => (
              <motion.span
                key={i}
                className="flex-1 rounded-sm bg-emerald-400/30"
                style={{ height: `${v}%` }}
                animate={animate ? { opacity: [0.5, 0.9, 0.5] } : undefined}
                transition={{
                  duration: 2.4,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: i * 0.06,
                }}
              />
            ))}
          </div>
        </Stage>

        <Connector animate={animate} />

        {/* Stage 2 - Physics validation */}
        <Stage
          step="02"
          icon={<Cpu className="h-3.5 w-3.5" />}
          label="Proof-of-Physics · Validate"
          tone="cyan"
        >
          <div className="text-[11px] font-mono uppercase tracking-wider text-white/55 mb-3">
            Energy / Tonne · Bound 200–600 kWh
          </div>
          {/* Range bar */}
          <div className="relative h-2 rounded-full bg-white/[0.06]">
            <div
              className="absolute inset-y-0 left-[18%] right-[18%] rounded-full bg-gradient-to-r from-emerald-500/40 via-cyan-400/45 to-emerald-500/40"
              aria-hidden
            />
            <motion.div
              className="absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.8)]"
              style={{ left: "calc(45% - 6px)" }}
              animate={
                animate
                  ? { left: ["calc(38% - 6px)", "calc(52% - 6px)", "calc(45% - 6px)"] }
                  : undefined
              }
              transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
            />
          </div>
          {/* Tick labels BELOW the bar so they never collide with the caption above */}
          <div className="mt-2 flex justify-between text-[10px] font-mono text-white/45 tnum">
            <span className="ml-[18%]">200</span>
            <span className="mr-[18%]">600</span>
          </div>
          <div className="mt-4 flex items-center justify-between text-[11px] font-mono">
            <span className="text-white/55 uppercase tracking-wider">Result</span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-emerald-300 ring-1 ring-emerald-500/20">
              <BadgeCheck className="h-3 w-3" />
              within bounds
            </span>
          </div>
        </Stage>

        <Connector animate={animate} />

        {/* Stage 3 - Mint */}
        <Stage
          step="03"
          icon={<BadgeCheck className="h-3.5 w-3.5" />}
          label="On-Chain Mint · ERC-1155"
          tone="emerald"
          highlight
        >
          <div className="flex items-end justify-between gap-3">
            <div>
              <div className="font-display text-3xl text-white tnum num-glow">
                +1.07
              </div>
              <div className="text-[11px] font-mono uppercase tracking-wider text-emerald-300/80 mt-1">
                tCO₂ · token issued
              </div>
            </div>
            <div className="text-right text-[10.5px] font-mono leading-tight text-white/55">
              <div className="text-white/85">tx</div>
              <div className="text-white/65">0x9c14·a1bf</div>
            </div>
          </div>
        </Stage>
      </div>
    </div>
  );
}

interface StageProps {
  step: string;
  icon: React.ReactNode;
  label: string;
  tone: "emerald" | "cyan";
  highlight?: boolean;
  children: React.ReactNode;
}

function Stage({ step, icon, label, tone, highlight, children }: StageProps) {
  const toneRing =
    tone === "cyan"
      ? "ring-cyan-400/15"
      : highlight
        ? "ring-emerald-500/30"
        : "ring-emerald-500/15";
  const toneIconBg =
    tone === "cyan"
      ? "bg-cyan-400/10 text-cyan-300"
      : "bg-emerald-500/12 text-emerald-300";
  const surface = highlight ? "card-bento-hero" : "card-bento";

  return (
    <div
      className={`relative ${surface} rounded-2xl px-5 py-4 ring-1 ${toneRing}`}
    >
      <div className="flex items-center gap-2.5">
        <span
          className={`inline-flex h-6 w-6 items-center justify-center rounded-md ${toneIconBg}`}
        >
          {icon}
        </span>
        <span className="text-[10.5px] font-mono uppercase tracking-[0.18em] text-white/65">
          <span className="text-white/40 mr-1">{step}</span>
          {label}
        </span>
        <span className="ml-auto pulse-dot" aria-hidden />
      </div>
      <div className="mt-3.5 pt-3.5 border-t border-white/[0.05]">
        {children}
      </div>
    </div>
  );
}

function Connector({ animate }: { animate: boolean }) {
  return (
    <div className="relative mx-auto h-7 w-px overflow-hidden bg-white/[0.06]">
      <motion.span
        className="absolute left-1/2 -translate-x-1/2 h-3 w-px bg-gradient-to-b from-transparent via-emerald-300 to-transparent"
        animate={animate ? { y: ["-100%", "200%"] } : undefined}
        transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
      />
    </div>
  );
}

const SPARKLINE = [
  35, 48, 42, 60, 55, 72, 68, 80, 76, 88, 82, 92, 86, 94, 90, 96, 88, 82, 76, 70,
];
