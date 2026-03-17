"use client";

import { useRef, useState, useEffect } from "react";
import { motion, useInView } from "framer-motion";
import { Cpu, Scale, Globe } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface TechItem {
  title: string;
  subtitle: string;
}

interface Differentiator {
  title: string;
  desc: string;
  icon: LucideIcon;
}

const techStack: TechItem[] = [
  { title: "ERC-1155", subtitle: "Multi-Token" },
  { title: "ERC-2771", subtitle: "Gasless Tx" },
  { title: "UUPS", subtitle: "Upgradeable" },
  { title: "OpenZeppelin", subtitle: "Security" },
  { title: "Solidity", subtitle: "0.8.32" },
  { title: "TimescaleDB", subtitle: "Time-Series" },
];

const differentiators: Differentiator[] = [
  {
    title: "1st-Party Verification",
    desc: "No reliance on third-party oracles or external data feeds. Our sovereign NativeIoT Oracle streams sensor data directly from DAC facilities to the Aethelred chain.",
    icon: Cpu,
  },
  {
    title: "Physics, Not Promises",
    desc: "Every carbon credit is validated against the laws of thermodynamics. If the energy-to-CO2 ratio falls outside 200-600 kWh/tonne, the claim is rejected automatically.",
    icon: Scale,
  },
  {
    title: "Satellite Cross-Check",
    desc: "On-chain verification is supplemented by Earth Observation satellite imagery stored on IPFS, providing an independent visual record of facility operations.",
    icon: Globe,
  },
];

export function EnterpriseMarquee() {
  const sectionRef = useRef<HTMLElement>(null);
  const isInView = useInView(sectionRef, { once: true, amount: 0.1 });
  const [fallback, setFallback] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setFallback(true), 2000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <section ref={sectionRef} className="relative py-16 sm:py-20 lg:py-24 bg-surface-900/50 overflow-hidden" aria-labelledby="differentiators-heading">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-dot-pattern opacity-20" />
      </div>

      <div className="mx-auto max-w-[1400px] px-5 sm:px-8 lg:px-10 relative z-10">
        {/* Header */}
        <motion.div
          className="text-center mb-16 lg:mb-20"
          initial={false}
          animate={(isInView || fallback) ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8 }}
        >
          <h2 id="differentiators-heading" className="text-display font-display text-white mb-6">
            Why TerraQura Is{" "}
            <span className="text-emerald-500">Fundamentally Different</span>
          </h2>
          <p className="text-body-lg text-white/70 max-w-2xl mx-auto font-body leading-relaxed">
            Legacy carbon registries rely on self-reported data and quarterly audits.
            The Aethelred Protocol makes fraud mathematically impossible.
          </p>
        </motion.div>

        {/* Differentiator Cards */}
        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto mb-20 lg:mb-24">
          {differentiators.map((item, index) => {
            const Icon = item.icon;
            return (
              <motion.div
                key={item.title}
                initial={false}
                animate={(isInView || fallback) ? { opacity: 1, y: 0 } : {}}
                transition={{ delay: 0.2 + index * 0.1, duration: 0.6 }}
              >
                <motion.div
                  className="group p-8 rounded-2xl bg-white/[0.02] border border-white/[0.06] hover:border-emerald-500/20 transition-all duration-500 h-full"
                  whileHover={{ y: -4 }}
                >
                  <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300">
                    <Icon className="w-6 h-6" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-3">{item.title}</h3>
                  <p className="text-white/70 text-base leading-relaxed font-body">{item.desc}</p>
                </motion.div>
              </motion.div>
            );
          })}
        </div>

        {/* Technology Stack */}
        <motion.div
          initial={false}
          animate={(isInView || fallback) ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.5, duration: 0.6 }}
        >
          <p className="text-center text-white/55 text-xs uppercase tracking-[0.2em] font-mono mb-8">
            Built on Open Standards
          </p>
          <div className="flex flex-wrap justify-center gap-4 max-w-4xl mx-auto">
            {techStack.map((item, index) => (
              <motion.div
                key={item.title}
                className="flex items-center gap-3 px-5 py-3 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:border-emerald-500/20 transition-all duration-300"
                initial={false}
                animate={(isInView || fallback) ? { opacity: 1, scale: 1 } : {}}
                transition={{ delay: 0.6 + index * 0.05, duration: 0.4 }}
                whileHover={{ y: -2 }}
              >
                <div className="text-base font-bold text-white font-mono">{item.title}</div>
                <div className="text-xs text-emerald-500/60 uppercase tracking-wider font-mono">{item.subtitle}</div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
