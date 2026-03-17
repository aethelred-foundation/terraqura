"use client";

import { useRef } from "react";
import { motion } from "framer-motion";
import { Building2, Leaf, TrendingUp, Check, ArrowRight, ExternalLink } from "lucide-react";
import { ScrollReveal, StaggerContainer, StaggerItem } from "@/components/animations/ScrollReveal";
import { MagneticButton } from "@/components/animations/MagneticButton";

const solutions = [
  {
    audience: "Enterprise Buyers",
    subtitle: "ESG & Compliance",
    icon: Building2,
    description: "Streamlined carbon offset procurement for enterprises seeking verified Scope 3 emissions reduction.",
    benefits: [
      "Verified carbon offsets for Scope 3 emissions",
      "Immutable audit trail for ESG reporting",
      "Zero-touch purchase with invoice settlement",
      "Regulator-ready documentation",
    ],
    cta: "Explore Enterprise Solutions",
    color: "#10b981",
  },
  {
    audience: "DAC Suppliers",
    subtitle: "Carbon Removal Infrastructure",
    icon: Leaf,
    description: "Direct access to premium carbon credit markets with automated verification and instant issuance.",
    benefits: [
      "Verified issuance via physics-based validation",
      "Direct access to enterprise credit market",
      "Automated verification, zero manual audits",
      "Premium pricing for high-integrity credits",
    ],
    cta: "Partner With Us",
    color: "#06b6d4",
  },
  {
    audience: "Institutional Investors",
    subtitle: "Carbon Finance",
    icon: TrendingUp,
    description: "Access the emerging carbon finance ecosystem with verified, tradeable carbon instruments.",
    benefits: [
      "Commoditize carbon as a financial instrument",
      "Fully auditable blockchain provenance",
      "Futures and options on verified reserves",
      "Standardized carbon futures markets",
    ],
    cta: "Investment Inquiries",
    color: "#3b82f6",
  },
];

export function Solutions() {
  const sectionRef = useRef<HTMLElement>(null);

  return (
    <section ref={sectionRef} className="relative section-padding overflow-hidden bg-[#020408]" aria-labelledby="solutions-heading">
      {/* Background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-gradient-radial opacity-30" />
      </div>

      <div className="container-premium relative z-10">
        {/* Header */}
        <ScrollReveal className="text-center mb-20">
          <motion.div 
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass mb-8"
            whileHover={{ scale: 1.05 }}
          >
            <span className="text-[#10b981] text-sm font-mono uppercase tracking-wider">For Every Stakeholder</span>
          </motion.div>
          <h2 id="solutions-heading" className="text-display font-display text-white mb-6">
            Solutions for{" "}
            <span className="text-gradient-emerald">Carbon Markets</span>
          </h2>
          <p className="text-body-lg text-white/70 max-w-2xl mx-auto font-body leading-relaxed">
            Purpose-built solutions for every stakeholder in the carbon removal ecosystem.
          </p>
        </ScrollReveal>

        {/* Solutions Cards */}
        <StaggerContainer className="grid lg:grid-cols-3 gap-6 lg:gap-8 max-w-7xl mx-auto" staggerDelay={0.15}>
          {solutions.map((solution) => (
            <StaggerItem key={solution.audience}>
              <motion.div
                className="group relative h-full rounded-3xl glass-card overflow-hidden cursor-pointer"
                whileHover={{ y: -10, scale: 1.01 }}
                transition={{ type: "spring", stiffness: 400, damping: 25 }}
              >
                {/* Gradient Accent on Hover */}
                <div 
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none"
                  style={{ 
                    background: `radial-gradient(600px circle at 50% 0%, ${solution.color}10, transparent 50%)` 
                  }}
                />

                {/* Top Accent Line */}
                <div 
                  className="absolute top-0 left-0 right-0 h-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                  style={{ background: `linear-gradient(90deg, transparent, ${solution.color}, transparent)` }}
                />

                <div className="relative p-8 lg:p-10">
                  {/* Icon & Title Row */}
                  <div className="flex items-start gap-5 mb-6">
                    <motion.div 
                      className="w-16 h-16 rounded-2xl flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: `${solution.color}15` }}
                      whileHover={{ rotate: 5, scale: 1.05 }}
                    >
                      <solution.icon className="w-8 h-8" style={{ color: solution.color }} />
                    </motion.div>
                    <div>
                      <h3 className="text-2xl font-bold text-white mb-1 group-hover:text-gradient-emerald transition-all">
                        {solution.audience}
                      </h3>
                      <p className="text-xs font-mono uppercase tracking-wider" style={{ color: `${solution.color}99` }}>
                        {solution.subtitle}
                      </p>
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-white/70 text-base leading-relaxed mb-8 font-body">
                    {solution.description}
                  </p>

                  {/* Benefits List */}
                  <ul className="space-y-4 mb-10">
                    {solution.benefits.map((benefit, i) => (
                      <motion.li 
                        key={benefit} 
                        className="flex items-start gap-3 text-white/70"
                        initial={false}
                        whileInView={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.1 + i * 0.05 }}
                        viewport={{ once: true }}
                      >
                        <Check className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: solution.color }} />
                        <span className="text-[15px] leading-relaxed font-body">{benefit}</span>
                      </motion.li>
                    ))}
                  </ul>

                  {/* CTA Button */}
                  <MagneticButton strength={0.15}>
                    <motion.a
                      href="/contact"
                      className="inline-flex items-center gap-2 text-sm font-semibold transition-colors group/link"
                      style={{ color: solution.color }}
                      whileHover={{ x: 4 }}
                    >
                      {solution.cta}
                      <ExternalLink className="w-4 h-4 group-hover/link:translate-x-0.5 group-hover/link:-translate-y-0.5 transition-transform" />
                    </motion.a>
                  </MagneticButton>
                </div>

                {/* Corner Decoration */}
                <div 
                  className="absolute top-0 right-0 w-32 h-32 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none"
                  style={{ 
                    background: `radial-gradient(circle at top right, ${solution.color}08, transparent 70%)` 
                  }}
                />
              </motion.div>
            </StaggerItem>
          ))}
        </StaggerContainer>

        {/* Bottom CTA */}
        <ScrollReveal delay={0.3} className="mt-20 text-center">
          <div className="inline-flex flex-col sm:flex-row items-center gap-4 p-2 rounded-2xl glass">
            <span className="text-white/70 text-sm px-4">Not sure which solution fits?</span>
            <MagneticButton>
              <a 
                href="/contact" 
                className="inline-flex items-center gap-2 px-6 py-3 bg-white/[0.05] hover:bg-white/[0.08] rounded-xl text-white text-sm font-medium transition-colors"
              >
                Schedule a Consultation
                <ArrowRight className="w-4 h-4" />
              </a>
            </MagneticButton>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
