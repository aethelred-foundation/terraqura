"use client";

import { useRef } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import {
  Building2,
  Leaf,
  TrendingUp,
  ArrowRight,
  type LucideIcon,
} from "lucide-react";
import { MagneticButton } from "@/components/animations/MagneticButton";
import { OptimizedImage } from "@/components/shared/OptimizedImage";
import type { ImageKey } from "@/lib/image-manifest";

interface Solution {
  audience: string;
  subtitle: string;
  icon: LucideIcon;
  description: string;
  benefits: string[];
  cta: string;
  href: string;
  accent: string;
  image: ImageKey;
}

const solutions: Solution[] = [
  {
    audience: "Enterprise Buyers",
    subtitle: "ESG · Compliance",
    icon: Building2,
    description:
      "Procure verified Scope-3 carbon removal credits with audit-ready provenance. Wallet-free settlement, regulator-ready documentation.",
    benefits: [
      "Verified Scope 3 offsets",
      "Immutable ESG audit trail",
      "Invoice settlement, no crypto required",
      "Regulator-ready documentation",
    ],
    cta: "For Buyers",
    href: "/buyer",
    accent: "#10b981",
    image: "high-intensity-carbon-market",
  },
  {
    audience: "DAC Operators",
    subtitle: "Removal Infrastructure",
    icon: Leaf,
    description:
      "Onboard your facility, instrument with NativeIoT sensors, issue physics-verified credits direct to enterprise buyers.",
    benefits: [
      "Physics-validated issuance",
      "Direct enterprise market access",
      "Zero manual audits",
      "Premium pricing for high-integrity credits",
    ],
    cta: "For Operators",
    href: "/operator",
    accent: "#06b6d4",
    image: "carbon-removal-from-biomass",
  },
  {
    audience: "Institutional Investors",
    subtitle: "Carbon Finance",
    icon: TrendingUp,
    description:
      "Tradeable, standardized carbon removal instruments with cryptographic provenance and on-chain liquidity.",
    benefits: [
      "Carbon as an institutional asset",
      "Auditable on-chain provenance",
      "Roadmap: futures on verified reserves",
      "Standardized contract primitives",
    ],
    cta: "For Investors",
    href: "/investor",
    accent: "#3b82f6",
    image: "institutional-climate-finance",
  },
];

export function Solutions() {
  const sectionRef = useRef<HTMLElement>(null);
  const prefersReducedMotion = useReducedMotion();
  const animate = !prefersReducedMotion;

  return (
    <section
      ref={sectionRef}
      className="relative section-padding overflow-hidden bg-[#020408]"
      aria-labelledby="solutions-heading"
    >
      {/* Background */}
      <div
        className="absolute inset-0 pointer-events-none"
        aria-hidden
        style={{
          background:
            "radial-gradient(70% 60% at 50% 100%, rgba(16,185,129,0.08), transparent 70%)",
        }}
      />
      <div
        className="absolute inset-0 bg-blueprint-fine opacity-[0.4] pointer-events-none"
        aria-hidden
      />

      <div className="container-premium relative z-10">
        {/* Header */}
        <div className="mb-10 lg:mb-12 max-w-3xl">
          <span className="kicker mb-6">
            <span className="kicker-num">05</span>
            For Every Stakeholder
          </span>
          <h2
            id="solutions-heading"
            className="font-display text-display lg:text-display-lg text-white leading-[1.06]"
          >
            One protocol. <span className="accent-italic">Three lanes</span>
            <span className="text-white/85"> into the carbon stack.</span>
          </h2>
          <p className="mt-6 max-w-xl text-body text-white/70 font-body leading-relaxed">
            The same evidence layer serves different jobs: procurement teams
            need assurance, operators need trusted issuance, and investors need
            durable market infrastructure.
          </p>
        </div>

        {/* Solutions cards */}
        <div className="grid lg:grid-cols-3 gap-5">
          {solutions.map((s, idx) => {
            const Icon = s.icon;
            return (
              <motion.article
                key={s.audience}
                className="group relative rounded-3xl card-bento p-7 lg:p-8 overflow-hidden"
                initial={animate ? { opacity: 0, y: 20 } : false}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: 0.55, delay: idx * 0.08 }}
                whileHover={{ y: -6 }}
              >
                {/* Top accent bar appearing on hover */}
                <div
                  aria-hidden
                  className="absolute top-0 left-0 right-0 h-px opacity-0 transition-opacity duration-500 group-hover:opacity-100"
                  style={{
                    background: `linear-gradient(90deg, transparent, ${s.accent}, transparent)`,
                  }}
                />
                {/* Hover aurora glow */}
                <div
                  aria-hidden
                  className="absolute -top-20 -right-20 h-72 w-72 rounded-full opacity-0 transition-opacity duration-700 group-hover:opacity-100 pointer-events-none"
                  style={{
                    background: `radial-gradient(closest-side, ${s.accent}26, transparent 70%)`,
                    filter: "blur(50px)",
                  }}
                />

                <div className="relative">
                  <div className="relative -mx-2 mb-6 aspect-[16/10] overflow-hidden rounded-2xl border border-white/[0.06] bg-black/30">
                    <OptimizedImage
                      src={s.image}
                      alt=""
                      fill
                      sizes="(min-width: 1024px) 33vw, 100vw"
                      className="object-cover opacity-90 transition-transform duration-700 group-hover:scale-[1.04]"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#020408]/78 via-transparent to-transparent" />
                  </div>

                  {/* Header */}
                  <div className="flex items-start justify-between mb-6">
                    <span
                      className="inline-flex h-12 w-12 items-center justify-center rounded-xl ring-1"
                      style={{
                        background: `${s.accent}1a`,
                        color: s.accent,
                        borderColor: `${s.accent}30`,
                      }}
                    >
                      <Icon className="h-5 w-5" />
                    </span>
                    <span
                      className="text-[10.5px] font-mono uppercase tracking-[0.2em]"
                      style={{ color: `${s.accent}d0` }}
                    >
                      0{idx + 1}
                    </span>
                  </div>

                  {/* Audience */}
                  <h3 className="font-display text-xl lg:text-2xl text-white tracking-tight">
                    {s.audience}
                  </h3>
                  <div
                    className="mt-1 text-[11px] font-mono uppercase tracking-[0.2em]"
                    style={{ color: `${s.accent}c0` }}
                  >
                    {s.subtitle}
                  </div>
                  <p className="mt-4 text-[14.5px] text-white/72 font-body leading-relaxed">
                    {s.description}
                  </p>

                  {/* Benefits */}
                  <ul className="mt-6 space-y-2 text-[13.5px] text-white/70 font-body">
                    {s.benefits.map((b) => (
                      <li key={b} className="flex items-start gap-2.5">
                        <span
                          className="mt-1.5 inline-block h-1 w-1 rounded-full"
                          style={{ background: s.accent }}
                          aria-hidden
                        />
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>

                  {/* CTA */}
                  <div className="mt-7 pt-5 border-t border-white/[0.05]">
                    <Link
                      href={s.href}
                      className="inline-flex items-center gap-1.5 text-[13px] font-semibold transition-colors group/link"
                      style={{ color: s.accent }}
                    >
                      {s.cta}
                      <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover/link:translate-x-0.5" />
                    </Link>
                  </div>
                </div>
              </motion.article>
            );
          })}
        </div>

        {/* Bottom CTA - refined */}
        <motion.div
          className="mt-10 lg:mt-14 flex justify-center"
          initial={animate ? { opacity: 0 } : false}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.5, delay: 0.15 }}
        >
          <div className="inline-flex flex-col sm:flex-row items-center gap-3 sm:gap-5 rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-md px-5 py-3.5">
            <span className="text-[13px] text-white/70 font-body">
              Not sure which lane fits?
            </span>
            <MagneticButton strength={0.15}>
              <Link
                href="/solutions/enterprise"
                className="inline-flex items-center gap-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] px-4 py-2 text-[13px] font-semibold text-white transition-colors"
              >
                Talk to us
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </MagneticButton>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
