"use client";

import Link from "next/link";
import { Factory, Building2, Cpu, TrendingUp, ArrowRight } from "lucide-react";
import {
  ScrollReveal,
  StaggerContainer,
  StaggerItem,
} from "@/components/animations/ScrollReveal";
import { OptimizedImage } from "@/components/shared/OptimizedImage";
import type { ImageKey } from "@/lib/image-manifest";
import type { LucideIcon } from "lucide-react";

interface EcosystemPartner {
  title: string;
  role: string;
  description: string;
  icon: LucideIcon;
  href: string;
  cta: string;
  color: string;
  image: ImageKey;
}

const partners: EcosystemPartner[] = [
  {
    title: "DAC Facility Operators",
    role: "Carbon Removal",
    description:
      "Connect your Direct Air Capture facility to the Aethelred verification network. Instrument with IoT sensors, validate with Proof-of-Physics, and issue premium verified credits.",
    icon: Factory,
    href: "/projects#partner",
    cta: "Join as Operator",
    color: "#10b981",
    image: "desert-biochar",
  },
  {
    title: "Enterprise Buyers",
    role: "Carbon Off-take",
    description:
      "Secure physics-verified carbon removal credits for your net-zero targets. Purchase through standard corporate invoices with full ESG compliance reporting built in.",
    icon: Building2,
    href: "/solutions/enterprise",
    cta: "Explore Enterprise",
    color: "#06b6d4",
    image: "verified-restoration",
  },
  {
    title: "Technology Partners",
    role: "Infrastructure",
    description:
      "Integrate IoT sensor networks, satellite imagery systems, or energy monitoring infrastructure into the TerraQura verification stack.",
    icon: Cpu,
    href: "/projects#partner",
    cta: "Partner With Us",
    color: "#8b5cf6",
    image: "satellite-mrv-layer",
  },
  {
    title: "Institutional Investors",
    role: "Carbon Finance",
    description:
      "Back the infrastructure layer of the carbon removal economy. Invest in verified DAC project development with transparent, on-chain provenance.",
    icon: TrendingUp,
    href: "/investor",
    cta: "Learn More",
    color: "#3b82f6",
    image: "institutional-climate-finance",
  },
];

export function Ecosystem() {
  return (
    <section
      className="relative section-padding overflow-hidden"
      aria-labelledby="ecosystem-heading"
    >
      {/* Background */}
      <div
        className="absolute inset-0 bg-blueprint-fine opacity-[0.45] pointer-events-none"
        aria-hidden
      />
      <div
        className="absolute inset-0 pointer-events-none"
        aria-hidden
        style={{
          background:
            "radial-gradient(70% 50% at 50% 0%, rgba(6,182,212,0.08), transparent 70%)",
        }}
      />

      <div className="container-premium relative z-10">
        {/* Header - editorial, left aligned */}
        <ScrollReveal className="mb-10 lg:mb-12 max-w-3xl">
          <span className="kicker mb-6">
            <span className="kicker-num">07</span>
            Ecosystem · Open Network
          </span>
          <h2
            id="ecosystem-heading"
            className="font-display text-display lg:text-display-lg text-white leading-[1.06]"
          >
            Build the verification layer{" "}
            <span className="accent-italic">together.</span>
          </h2>
          <p className="mt-5 max-w-xl text-body text-white/70 font-body leading-relaxed">
            The strongest carbon markets will be built by operators, buyers,
            verification technology, and capital moving from the same evidence
            layer instead of reconciling separate systems after the fact.
          </p>
        </ScrollReveal>

        {/* Partner Cards */}
        <StaggerContainer
          className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-5"
          staggerDelay={0.08}
        >
          {partners.map((partner) => {
            const Icon = partner.icon;
            return (
              <StaggerItem key={partner.title}>
                <div className="group relative h-full rounded-2xl card-bento p-6 overflow-hidden">
                  {/* Top accent on hover */}
                  <div
                    aria-hidden
                    className="absolute top-0 left-0 right-0 h-px opacity-0 transition-opacity duration-500 group-hover:opacity-100"
                    style={{
                      background: `linear-gradient(90deg, transparent, ${partner.color}, transparent)`,
                    }}
                  />
                  {/* Hover glow corner */}
                  <div
                    aria-hidden
                    className="absolute -top-12 -right-12 h-40 w-40 rounded-full opacity-0 transition-opacity duration-500 group-hover:opacity-100 pointer-events-none"
                    style={{
                      background: `radial-gradient(closest-side, ${partner.color}24, transparent 70%)`,
                      filter: "blur(28px)",
                    }}
                  />

                  <div className="relative">
                    <div className="relative mb-5 aspect-[4/3] overflow-hidden rounded-xl border border-white/[0.06] bg-black/30">
                      <OptimizedImage
                        src={partner.image}
                        alt=""
                        fill
                        sizes="(min-width: 1024px) 25vw, (min-width: 768px) 50vw, 100vw"
                        className="object-cover opacity-85 transition-transform duration-700 group-hover:scale-[1.05]"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#020408]/80 via-transparent to-transparent" />
                    </div>

                    {/* Icon */}
                    <div
                      className="inline-flex h-11 w-11 items-center justify-center rounded-lg mb-5 ring-1"
                      style={{
                        background: `${partner.color}1a`,
                        color: partner.color,
                        borderColor: `${partner.color}30`,
                      }}
                    >
                      <Icon className="h-4.5 w-4.5" />
                    </div>

                    {/* Role kicker */}
                    <div
                      className="text-[10.5px] font-mono uppercase tracking-[0.2em] mb-2"
                      style={{ color: `${partner.color}c0` }}
                    >
                      {partner.role}
                    </div>

                    {/* Title */}
                    <h3 className="font-display text-lg text-white tracking-tight">
                      {partner.title}
                    </h3>

                    {/* Description */}
                    <p className="mt-2.5 text-[14px] text-white/65 leading-relaxed font-body">
                      {partner.description}
                    </p>

                    {/* CTA */}
                    <Link
                      href={partner.href}
                      className="mt-5 inline-flex items-center gap-1.5 text-[13px] font-semibold transition-colors group/link"
                      style={{ color: partner.color }}
                    >
                      {partner.cta}
                      <ArrowRight className="h-3.5 w-3.5 group-hover/link:translate-x-0.5 transition-transform" />
                    </Link>
                  </div>
                </div>
              </StaggerItem>
            );
          })}
        </StaggerContainer>

        {/* Bottom CTA */}
        <ScrollReveal className="mt-10 lg:mt-14 flex justify-center">
          <Link
            href="/projects"
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-b from-emerald-500 to-emerald-600 px-7 py-3.5 text-[15px] font-semibold text-white shadow-[0_8px_30px_-8px_rgba(16,185,129,0.55),inset_0_1px_0_rgba(255,255,255,0.18)] ring-1 ring-emerald-400/40 transition-all hover:shadow-[0_8px_36px_-6px_rgba(16,185,129,0.7),inset_0_1px_0_rgba(255,255,255,0.22)]"
          >
            See active projects
            <ArrowRight className="h-4 w-4" />
          </Link>
        </ScrollReveal>
      </div>
    </section>
  );
}
