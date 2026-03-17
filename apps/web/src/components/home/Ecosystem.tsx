"use client";

import Link from "next/link";
import { Factory, Building2, Cpu, TrendingUp, ArrowRight } from "lucide-react";
import { ScrollReveal, StaggerContainer, StaggerItem } from "@/components/animations/ScrollReveal";
import type { LucideIcon } from "lucide-react";

interface EcosystemPartner {
  title: string;
  role: string;
  description: string;
  icon: LucideIcon;
  href: string;
  cta: string;
  color: string;
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
  },
];

export function Ecosystem() {
  return (
    <section
      className="relative py-16 sm:py-20 lg:py-24 overflow-hidden"
      aria-labelledby="ecosystem-heading"
    >
      {/* Background */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        <div className="absolute inset-0 bg-dot-pattern opacity-20" />
      </div>

      <div className="container-premium relative z-10">
        {/* Header */}
        <ScrollReveal className="text-center mb-16 lg:mb-20">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.03] border border-white/10 mb-6">
            <span className="text-emerald-500 text-sm font-mono uppercase tracking-wider">
              Open Ecosystem
            </span>
          </div>
          <h2
            id="ecosystem-heading"
            className="text-display font-display text-white mb-6"
          >
            Join the{" "}
            <span className="text-gradient-emerald">Verification Network</span>
          </h2>
          <p className="text-body-lg text-white/70 max-w-3xl mx-auto font-body leading-relaxed">
            TerraQura is building an open ecosystem for verified carbon removal.
            We&apos;re actively seeking partners across the value chain.
          </p>
        </ScrollReveal>

        {/* Partner Cards */}
        <StaggerContainer
          className="grid md:grid-cols-2 lg:grid-cols-4 gap-5 max-w-6xl mx-auto"
          staggerDelay={0.1}
        >
          {partners.map((partner) => {
            const Icon = partner.icon;
            return (
              <StaggerItem key={partner.title}>
                <div className="group h-full p-6 rounded-2xl bg-white/[0.02] border border-white/[0.06] hover:border-emerald-500/20 transition-all duration-300">
                  {/* Icon */}
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center mb-5 transition-transform duration-300 group-hover:scale-110"
                    style={{ backgroundColor: `${partner.color}15` }}
                  >
                    <Icon
                      className="w-6 h-6"
                      style={{ color: partner.color }}
                    />
                  </div>

                  {/* Role Badge */}
                  <div
                    className="text-[11px] font-mono uppercase tracking-widest mb-2"
                    style={{ color: `${partner.color}80` }}
                  >
                    {partner.role}
                  </div>

                  {/* Title */}
                  <h3 className="text-lg font-bold text-white mb-3">
                    {partner.title}
                  </h3>

                  {/* Description */}
                  <p className="text-white/70 text-[15px] leading-relaxed font-body mb-6">
                    {partner.description}
                  </p>

                  {/* CTA */}
                  <Link
                    href={partner.href}
                    className="inline-flex items-center gap-1.5 text-sm font-semibold transition-colors group/link"
                    style={{ color: partner.color }}
                  >
                    {partner.cta}
                    <ArrowRight className="w-3.5 h-3.5 group-hover/link:translate-x-1 transition-transform" />
                  </Link>
                </div>
              </StaggerItem>
            );
          })}
        </StaggerContainer>

        {/* Bottom CTA */}
        <ScrollReveal className="mt-16 text-center">
          <Link
            href="/projects"
            className="inline-flex items-center gap-2 px-8 py-4 text-base font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl transition-all shadow-lg shadow-emerald-600/20"
          >
            View Project Pipeline
            <ArrowRight className="w-4 h-4" />
          </Link>
        </ScrollReveal>
      </div>
    </section>
  );
}
