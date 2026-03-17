"use client";

import { useRef } from "react";
import { motion } from "framer-motion";
import { Zap, Database, Scale, Wallet, Shield, History, ArrowUpRight, type LucideIcon } from "lucide-react";
import { ScrollReveal, StaggerContainer, StaggerItem } from "@/components/animations/ScrollReveal";

interface Feature {
  icon: LucideIcon;
  title: string;
  desc: string;
  tag: string;
  highlight?: boolean;
}

const features: Feature[] = [
  {
    icon: Zap,
    title: "Proof-of-Physics",
    desc: "Our verification engine validates energy-to-CO2 ratios against physical constraints. Anomalous data is rejected mathematically. No human judgment.",
    tag: "Core Innovation",
    highlight: true,
  },
  {
    icon: Database,
    title: "On-Chain Transparency",
    desc: "Every credit is traceable on the Aethelred sovereign chain with immutable provenance from capture to retirement.",
    tag: "Blockchain",
  },
  {
    icon: Scale,
    title: "UAE Regulatory Path",
    desc: "Incorporating under Abu Dhabi Global Market with KYC/AML compliance and UAE data residency.",
    tag: "Compliance",
  },
  {
    icon: Wallet,
    title: "Gasless Settlement",
    desc: "Corporate buyers never need crypto. ERC-2771 meta-transactions enable standard invoice payments.",
    tag: "Enterprise",
  },
  {
    icon: Shield,
    title: "Enterprise Security",
    desc: "UUPS upgradeable proxy pattern with OpenZeppelin contracts, multi-sig governance, and circuit breakers.",
    tag: "Security",
  },
  {
    icon: History,
    title: "Full Provenance",
    desc: "Complete audit trail from atmospheric capture to credit retirement with cryptographic timestamps.",
    tag: "Transparency",
  },
];

export function Features() {
  const sectionRef = useRef<HTMLElement>(null);

  return (
    <section ref={sectionRef} className="relative section-padding overflow-hidden bg-[#020408]" aria-labelledby="features-heading">
      {/* Background Effects */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1200px] h-[600px] bg-gradient-radial opacity-40" />
        <div className="absolute inset-0 bg-lines-pattern opacity-[0.015]" />
      </div>

      <div className="container-premium relative z-10">
        {/* Header */}
        <ScrollReveal className="text-center mb-20">
          <motion.div 
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass mb-8"
            whileHover={{ scale: 1.05 }}
          >
            <span className="w-2 h-2 rounded-full bg-[#10b981] animate-pulse" />
            <span className="text-[#10b981] text-sm font-medium">Platform Features</span>
          </motion.div>
          <h2 id="features-heading" className="text-display font-display text-white mb-6">
            Powered by the{" "}
            <span className="text-gradient-emerald">Aethelred Protocol</span>
          </h2>
          <p className="text-body-lg text-white/70 max-w-2xl mx-auto font-body leading-relaxed">
            Enterprise-grade infrastructure engineered for institutional requirements and regulatory compliance.
          </p>
        </ScrollReveal>

        {/* Bento Grid Features */}
        <StaggerContainer className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 lg:gap-6 max-w-7xl mx-auto" staggerDelay={0.1}>
          {features.map((feature) => (
            <StaggerItem key={feature.title}>
              <motion.div
                className={`group relative h-full p-7 rounded-3xl overflow-hidden cursor-pointer ${
                  feature.highlight 
                    ? "lg:col-span-1 bg-gradient-to-br from-[#10b981]/10 via-[#020408] to-[#020408] border border-[#10b981]/20" 
                    : "glass-card"
                }`}
                whileHover={{ y: -8, scale: 1.01 }}
                transition={{ type: "spring", stiffness: 400, damping: 25 }}
              >
                {/* Hover Gradient Background */}
                <div className="absolute inset-0 bg-gradient-to-br from-[#10b981]/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                
                {/* Shine Effect */}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none">
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.03] to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
                </div>

                <div className="relative">
                  {/* Header Row */}
                  <div className="flex items-start justify-between mb-6">
                    <motion.div 
                      className={`w-14 h-14 rounded-2xl flex items-center justify-center ${
                        feature.highlight 
                          ? "bg-[#10b981]/20" 
                          : "bg-[#10b981]/10 group-hover:bg-[#10b981]/15"
                      } transition-colors`}
                      whileHover={{ rotate: 5, scale: 1.05 }}
                    >
                      <feature.icon className={`w-7 h-7 ${feature.highlight ? "text-[#10b981]" : "text-[#10b981]"}`} />
                    </motion.div>
                    
                    <span className={`text-xs uppercase tracking-wider px-3 py-1.5 rounded-full ${
                      feature.highlight
                        ? "bg-emerald-500/20 text-emerald-400"
                        : "bg-white/[0.03] text-white/55 group-hover:text-emerald-400 group-hover:bg-emerald-500/10"
                    } transition-colors`}>
                      {feature.tag}
                    </span>
                  </div>

                  {/* Content */}
                  <h3 className="text-xl font-bold text-white mb-3 group-hover:text-gradient-emerald transition-all duration-300">
                    {feature.title}
                  </h3>
                  <p className="text-white/70 text-[15px] leading-relaxed group-hover:text-white/60 transition-colors font-body">
                    {feature.desc}
                  </p>

                  {/* Arrow Indicator */}
                  <div className="absolute bottom-7 right-7 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-x-2 group-hover:translate-x-0">
                    <ArrowUpRight className="w-5 h-5 text-[#10b981]" />
                  </div>
                </div>

                {/* Border Glow on Hover */}
                <div className="absolute inset-0 rounded-3xl border border-[#10b981]/0 group-hover:border-[#10b981]/30 transition-colors duration-500 pointer-events-none" />
              </motion.div>
            </StaggerItem>
          ))}
        </StaggerContainer>

        {/* Stats Row */}
        <ScrollReveal delay={0.4} className="mt-20">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-4xl mx-auto">
            {[
              { value: "99.9%", label: "Uptime SLA" },
              { value: "<2s", label: "Verification Time" },
              { value: "24/7", label: "Monitoring" },
              { value: "ISO 27001", label: "Certified" },
            ].map((stat) => (
              <motion.div 
                key={stat.label}
                className="text-center p-6 rounded-2xl glass"
                whileHover={{ y: -4 }}
              >
                <div className="text-2xl sm:text-3xl font-bold text-gradient-emerald mb-1">{stat.value}</div>
                <div className="text-sm text-white/55 uppercase tracking-wider">{stat.label}</div>
              </motion.div>
            ))}
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
