"use client";

import { useRef } from "react";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import {
  Zap,
  Database,
  Wallet,
  Shield,
  History,
  ArrowUpRight,
  type LucideIcon,
} from "lucide-react";
import { OptimizedImage } from "@/components/shared/OptimizedImage";
import type { ImageKey } from "@/lib/image-manifest";

interface Feature {
  icon: LucideIcon;
  title: string;
  desc: string;
  tag: string;
  image: ImageKey;
}

const secondaryFeatures: Feature[] = [
  {
    icon: Database,
    title: "On-Chain Provenance",
    desc: "Every credit carries an inspectable lineage from capture event to retirement certificate.",
    tag: "Blockchain",
    image: "onchain-carbon-transparency",
  },
  {
    icon: Wallet,
    title: "Gasless Settlement",
    desc: "Enterprise buyers can procure by invoice while the protocol handles wallet complexity behind the scenes.",
    tag: "Enterprise",
    image: "carbon-removal-marketplace",
  },
  {
    icon: Shield,
    title: "Hardened Contracts",
    desc: "Upgradeable contracts, timelocks, access controls, and circuit breakers built for serious market infrastructure.",
    tag: "Security",
    image: "sovereign-carbon-ledger",
  },
  {
    icon: History,
    title: "Auditable History",
    desc: "Signed state transitions give auditors a continuous record instead of a folder of stale PDFs.",
    tag: "Transparency",
    image: "regulator-ready-audit-trail",
  },
];

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } },
};

export function Features() {
  const sectionRef = useRef<HTMLElement>(null);
  const prefersReducedMotion = useReducedMotion();
  const animate = !prefersReducedMotion;

  return (
    <section
      ref={sectionRef}
      className="relative section-padding overflow-hidden bg-[#020408]"
      aria-labelledby="features-heading"
    >
      {/* Background - fine blueprint + soft glow up top */}
      <div
        className="absolute inset-0 bg-blueprint-fine opacity-[0.6] pointer-events-none"
        aria-hidden
      />
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 h-[36rem] w-[80rem] pointer-events-none"
        style={{
          background:
            "radial-gradient(60% 60% at 50% 0%, rgba(16,185,129,0.12), transparent 70%)",
        }}
        aria-hidden
      />
      <div className="absolute top-0 left-0 right-0 divider-glow" />

      <div className="container-premium relative z-10">
        {/* Header - editorial */}
        <div className="mb-10 lg:mb-12 max-w-3xl">
          <span className="kicker mb-6">
            <span className="kicker-num">04</span>
            Platform Capabilities
          </span>
          <h2
            id="features-heading"
            className="font-display text-display lg:text-display-lg text-white leading-[1.08]"
          >
            Built for <span className="accent-italic">evidence-grade</span>{" "}
            <span className="text-white/85">carbon markets.</span>
          </h2>
          <p className="mt-6 max-w-xl text-body text-white/70 font-body leading-relaxed">
            TerraQura is designed as a verification fabric, not a new wrapper
            around legacy registries: sensor evidence, physics checks,
            provenance, compliance records, and settlement rails operating as
            one system.
          </p>
        </div>

        {/* Bento grid: hero card spans 2x2, secondary cards mosaic. */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-5">
          {/* HERO - Proof-of-Physics. Spans 2 cols x 2 rows on lg. */}
          <motion.article
            className="group relative md:col-span-2 lg:col-span-2 lg:row-span-2 rounded-3xl card-bento-hero p-7 lg:p-9 overflow-hidden"
            initial={animate ? "hidden" : false}
            whileInView={animate ? "visible" : undefined}
            viewport={{ once: true, amount: 0.25 }}
            variants={cardVariants}
          >
            <div className="absolute inset-0 pointer-events-none bg-gradient-to-br from-emerald-500/[0.05] via-transparent to-cyan-400/[0.04]" />
            <div className="relative h-full flex flex-col">
              <div className="relative mb-7 aspect-[16/10] overflow-hidden rounded-2xl border border-emerald-400/15 bg-black/40">
                <OptimizedImage
                  src="carbon-truth-engine"
                  alt="Carbon removal material moving through a transparent verification apparatus"
                  fill
                  sizes="(min-width: 1024px) 50vw, 100vw"
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#020408]/75 via-transparent to-transparent" />
                <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between gap-4">
                  <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-emerald-200/90">
                    Live evidence loop
                  </span>
                  <span className="hidden sm:inline-flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-[0.18em] text-white/70">
                    <span className="pulse-dot h-1.5 w-1.5" />
                    in bounds
                  </span>
                </div>
              </div>

              <div className="flex items-start justify-between mb-6">
                <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30">
                  <Zap className="h-5 w-5" />
                </span>
                <span className="rounded-full bg-emerald-500/12 px-2.5 py-1 text-[10px] font-mono uppercase tracking-[0.18em] text-emerald-300 ring-1 ring-emerald-500/25">
                  Core innovation
                </span>
              </div>

              <h3 className="font-display text-2xl lg:text-3xl text-white tracking-tight">
                Proof-of-Physics
              </h3>
              <p className="mt-3 text-white/72 font-body leading-relaxed text-[15px]">
                Our verification engine validates energy-to-CO<sub>2</sub>{" "}
                ratios against thermodynamic bounds before credits can enter the
                ledger. Impossible claims are rejected before they become
                financial instruments.
              </p>

              {/* Live range visualization */}
              <div className="mt-7 lg:mt-auto lg:pt-10">
                <div className="flex items-center justify-between mb-3 text-[11px] font-mono uppercase tracking-[0.18em] text-white/55">
                  <span>kWh / Tonne · Bound</span>
                  <span className="text-emerald-300/85">live · ok</span>
                </div>
                <div className="relative h-2 rounded-full bg-white/[0.05] overflow-visible">
                  <div
                    className="absolute inset-y-0 left-[18%] right-[18%] rounded-full bg-gradient-to-r from-emerald-500/45 via-cyan-400/55 to-emerald-500/45"
                    aria-hidden
                  />
                  <motion.div
                    className="absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full bg-emerald-400 shadow-[0_0_14px_rgba(16,185,129,0.85)]"
                    style={{ left: "calc(46% - 6px)" }}
                    animate={
                      animate
                        ? {
                            left: [
                              "calc(36% - 6px)",
                              "calc(58% - 6px)",
                              "calc(46% - 6px)",
                            ],
                          }
                        : undefined
                    }
                    transition={{
                      duration: 6,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                  />
                </div>
                <div className="mt-2 flex justify-between text-[10.5px] font-mono text-white/45 tnum">
                  <span>200</span>
                  <span>400</span>
                  <span>600</span>
                </div>
              </div>

              <ArrowUpRight className="absolute bottom-7 right-7 h-5 w-5 text-emerald-300/60 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
            </div>
          </motion.article>

          {/* Secondary cards */}
          {secondaryFeatures.map((f, i) => (
            <motion.article
              key={f.title}
              className="group relative rounded-3xl card-bento p-6 overflow-hidden"
              initial={animate ? "hidden" : false}
              whileInView={animate ? "visible" : undefined}
              viewport={{ once: true, amount: 0.25 }}
              variants={cardVariants}
              transition={{ delay: 0.05 * i }}
              whileHover={{ y: -4 }}
            >
              {/* Hover sheen */}
              <div
                aria-hidden
                className="absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100 pointer-events-none"
                style={{
                  background:
                    "radial-gradient(120% 120% at 0% 0%, rgba(16,185,129,0.08), transparent 50%)",
                }}
              />
              <div className="relative">
                <div className="relative mb-5 aspect-[16/10] overflow-hidden rounded-xl border border-white/[0.06] bg-black/30">
                  <OptimizedImage
                    src={f.image}
                    alt=""
                    fill
                    sizes="(min-width: 1024px) 25vw, (min-width: 768px) 50vw, 100vw"
                    className="object-cover opacity-85 transition-transform duration-700 group-hover:scale-[1.04]"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#020408]/75 via-transparent to-transparent" />
                </div>
                <div className="flex items-start justify-between mb-5">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-white/[0.04] text-emerald-300 ring-1 ring-white/[0.06] transition-colors group-hover:bg-emerald-500/12 group-hover:ring-emerald-500/25">
                    <f.icon className="h-4.5 w-4.5" />
                  </span>
                  <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-white/45 group-hover:text-emerald-300/80 transition-colors">
                    {f.tag}
                  </span>
                </div>
                <h3 className="font-display text-lg text-white tracking-tight">
                  {f.title}
                </h3>
                <p className="mt-2 text-[14px] text-white/65 font-body leading-relaxed">
                  {f.desc}
                </p>
              </div>
              <ArrowUpRight className="absolute bottom-6 right-6 h-4 w-4 text-emerald-300/50 opacity-0 transition-all duration-300 -translate-x-1 group-hover:translate-x-0 group-hover:opacity-100" />
            </motion.article>
          ))}
        </div>

        {/* Stats row - refined as an editorial spec strip */}
        <motion.div
          className="mt-10 lg:mt-14 grid grid-cols-2 lg:grid-cols-4 gap-x-12 gap-y-8 max-w-4xl mx-auto"
          initial={animate ? { opacity: 0, y: 14 } : false}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          {[
            { value: "99.9%", label: "Target uptime SLA" },
            { value: "<2s", label: "Verification latency" },
            { value: "24/7", label: "Real-time monitoring" },
            { value: "ISO 27001", label: "Roadmap target" },
          ].map((s) => (
            <div key={s.label}>
              <div className="font-display text-2xl lg:text-3xl text-white tnum num-glow">
                {s.value}
              </div>
              <div className="mt-1.5 text-[11px] font-mono uppercase tracking-[0.18em] text-white/55">
                {s.label}
              </div>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
