"use client";

import { useRef, useState, useEffect } from "react";
import { motion, useInView } from "framer-motion";
import { Cpu, Scale, Globe } from "lucide-react";
import { OptimizedImage } from "@/components/shared/OptimizedImage";
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
    desc: "NativeIoT streams signed operating data directly from project infrastructure into the Aethelred verification layer.",
    icon: Cpu,
  },
  {
    title: "Physics, Not Promises",
    desc: "Claims are checked against thermodynamic ranges before issuance, so evidence quality is enforced by the protocol itself.",
    icon: Scale,
  },
  {
    title: "Satellite Cross-Check",
    desc: "Earth-observation context complements facility telemetry, giving buyers and auditors a richer operating record.",
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
    <section
      ref={sectionRef}
      className="relative py-16 sm:py-20 lg:py-24 bg-[#03060c] overflow-hidden"
      aria-labelledby="differentiators-heading"
    >
      <div className="absolute inset-0 pointer-events-none" aria-hidden>
        <div className="absolute inset-0 bg-dot-pattern opacity-20" />
        <div className="absolute inset-x-0 top-0 h-[28rem] opacity-45">
          <OptimizedImage
            src="terraqura-section-divider"
            alt=""
            fill
            sizes="100vw"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#03060c]/10 via-[#03060c]/60 to-[#03060c]" />
        </div>
      </div>

      <div className="mx-auto max-w-[1400px] px-5 sm:px-8 lg:px-10 relative z-10">
        {/* Header */}
        <motion.div
          className="mb-10 grid items-center gap-8 lg:mb-14 lg:grid-cols-12"
          initial={false}
          animate={isInView || fallback ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8 }}
        >
          <div className="lg:col-span-6">
            <span className="kicker mb-6">
              <span className="kicker-num">06</span>
              Assurance Layer
            </span>
            <h2
              id="differentiators-heading"
              className="text-display font-display text-white leading-[1.08]"
            >
              Institutional credibility requires{" "}
              <span className="accent-italic">continuous evidence.</span>
            </h2>
            <p className="mt-6 text-body-lg text-white/70 max-w-2xl font-body leading-relaxed">
              Legacy registries publish snapshots. TerraQura is designed for a
              market where every claim can be traced back to the physical system
              that produced it.
            </p>
          </div>
          <div className="relative min-h-[260px] overflow-hidden rounded-3xl border border-white/[0.07] bg-black/30 lg:col-span-6">
            <OptimizedImage
              src="nature-engineering-fusion"
              alt="Nature and engineered carbon infrastructure connected by luminous data"
              fill
              sizes="(min-width: 1024px) 50vw, 100vw"
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#03060c]/85 via-transparent to-transparent" />
            <div className="absolute bottom-5 left-5 right-5 flex flex-wrap items-center justify-between gap-3">
              <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-emerald-200/90">
                Measurement to market
              </span>
              <span className="rounded-full border border-emerald-400/25 bg-emerald-500/10 px-3 py-1 text-[10px] font-mono uppercase tracking-[0.18em] text-emerald-200">
                Audit-ready
              </span>
            </div>
          </div>
        </motion.div>

        {/* Differentiator Cards */}
        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto mb-20 lg:mb-24">
          {differentiators.map((item, index) => {
            const Icon = item.icon;
            return (
              <motion.div
                key={item.title}
                initial={false}
                animate={isInView || fallback ? { opacity: 1, y: 0 } : {}}
                transition={{ delay: 0.2 + index * 0.1, duration: 0.6 }}
              >
                <motion.div
                  className="group card-bento p-8 rounded-2xl transition-all duration-500 h-full"
                  whileHover={{ y: -4 }}
                >
                  <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300">
                    <Icon className="w-6 h-6" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-3">
                    {item.title}
                  </h3>
                  <p className="text-white/70 text-base leading-relaxed font-body">
                    {item.desc}
                  </p>
                </motion.div>
              </motion.div>
            );
          })}
        </div>

        {/* Technology Stack */}
        <motion.div
          initial={false}
          animate={isInView || fallback ? { opacity: 1, y: 0 } : {}}
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
                animate={isInView || fallback ? { opacity: 1, scale: 1 } : {}}
                transition={{ delay: 0.6 + index * 0.05, duration: 0.4 }}
                whileHover={{ y: -2 }}
              >
                <div className="text-base font-bold text-white font-mono">
                  {item.title}
                </div>
                <div className="text-xs text-emerald-500/60 uppercase tracking-wider font-mono">
                  {item.subtitle}
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
