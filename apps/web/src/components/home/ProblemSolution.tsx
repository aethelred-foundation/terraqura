"use client";

import { useRef, useState, useEffect } from "react";
import { motion, useInView } from "framer-motion";
import { AlertTriangle, Check, X, Shield, TrendingDown, TrendingUp } from "lucide-react";
import { ScrollReveal } from "@/components/animations/ScrollReveal";

const legacyProblems = [
  { text: "No on-chain provenance. Impossible to verify", severity: "high" },
  { text: "Self-reported data with no physical validation", severity: "high" },
  { text: "Third-party audits every 3-5 years, not real-time", severity: "medium" },
  { text: "Opaque credit trading with hidden ownership", severity: "high" },
];

const terraQuraSolutions = [
  { text: "Every credit on-chain with immutable provenance", impact: "high" },
  { text: "IoT sensor data validated against physics", impact: "high" },
  { text: "Real-time verification via Aethelred Oracle", impact: "high" },
  { text: "Transparent ownership with full audit trail", impact: "medium" },
];

const metrics = [
  { label: "Verification Time", legacy: "3-5 years", aethelred: "< 2 seconds", improvement: "∞" },
  { label: "Data Transparency", legacy: "Opaque", aethelred: "100% On-Chain", improvement: "Complete" },
  { label: "Audit Cost", legacy: "$50K+ per project", aethelred: "Near Zero", improvement: "99%" },
];

export function ProblemSolution() {
  const sectionRef = useRef<HTMLElement>(null);
  const isInView = useInView(sectionRef, { once: true, amount: 0.1 });
  const [fallback, setFallback] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setFallback(true), 2000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <section ref={sectionRef} className="relative section-padding overflow-hidden bg-[#03060c]" aria-labelledby="comparison-heading">
      {/* Background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-0 w-[500px] h-[500px] bg-red-500/5 rounded-full blur-[120px] -translate-y-1/2" />
        <div className="absolute top-1/2 right-0 w-[500px] h-[500px] bg-[#10b981]/5 rounded-full blur-[120px] -translate-y-1/2" />
      </div>

      <div className="container-premium relative z-10">
        {/* Header */}
        <ScrollReveal className="text-center mb-20">
          <motion.div 
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass mb-8"
            whileHover={{ scale: 1.05 }}
          >
            <span className="text-[#10b981] text-sm font-mono uppercase tracking-wider">Industry Comparison</span>
          </motion.div>
          <h2 id="comparison-heading" className="text-display font-display text-white mb-6">
            Why Carbon Credits Fail{" "}
            <span className="text-gradient-emerald">And How We Fix Them</span>
          </h2>
          <p className="text-body-lg text-white/70 max-w-2xl mx-auto font-body leading-relaxed">
            The voluntary carbon market is plagued by integrity issues. The Aethelred Protocol provides the mathematical foundation for trust.
          </p>
        </ScrollReveal>

        {/* Comparison Cards */}
        <div className="grid lg:grid-cols-2 gap-8 max-w-6xl mx-auto mb-20">
          {/* Legacy Side */}
          <ScrollReveal direction="left" delay={0.1}>
            <motion.div 
              className="h-full rounded-3xl bg-red-500/[0.03] border border-red-500/10 p-8 lg:p-10 relative overflow-hidden group"
              whileHover={{ scale: 1.01 }}
            >
              {/* Background Gradient */}
              <div className="absolute inset-0 bg-gradient-to-br from-red-500/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />

              {/* Header */}
              <div className="relative flex items-center gap-4 mb-10">
                <motion.div 
                  className="w-14 h-14 rounded-2xl bg-red-500/10 flex items-center justify-center"
                  animate={{ rotate: [0, -5, 0] }}
                  transition={{ duration: 4, repeat: Infinity }}
                >
                  <AlertTriangle className="w-7 h-7 text-red-400" />
                </motion.div>
                <div>
                  <h3 className="text-2xl font-bold text-white">Legacy Carbon Markets</h3>
                  <p className="text-sm text-red-400/70">The current broken system</p>
                </div>
              </div>

              {/* Problems List */}
              <ul className="relative space-y-4">
                {legacyProblems.map((problem, index) => (
                  <motion.li 
                    key={problem.text}
                    className="flex items-start gap-4 p-4 rounded-2xl bg-red-500/[0.03] border border-red-500/10 group/item"
                    initial={false}
                    animate={(isInView || fallback) ? { opacity: 1, x: 0 } : {}}
                    transition={{ delay: 0.2 + index * 0.1 }}
                    whileHover={{ x: 4 }}
                  >
                    <div className="w-6 h-6 rounded-full bg-red-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <X className="w-4 h-4 text-red-400" />
                    </div>
                    <div className="flex-1">
                      <span className="text-white/60 text-[15px] font-body leading-relaxed">{problem.text}</span>
                      {problem.severity === "high" && (
                        <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs bg-red-500/20 text-red-400">
                          Critical
                        </span>
                      )}
                    </div>
                  </motion.li>
                ))}
              </ul>

              {/* Trend Indicator */}
              <div className="mt-8 flex items-center gap-3 text-red-400/60">
                <TrendingDown className="w-5 h-5" />
                <span className="text-sm">Market confidence declining</span>
              </div>
            </motion.div>
          </ScrollReveal>

          {/* TerraQura Side */}
          <ScrollReveal direction="right" delay={0.2}>
            <motion.div 
              className="h-full rounded-3xl bg-[#10b981]/[0.05] border border-[#10b981]/20 p-8 lg:p-10 relative overflow-hidden group glow-emerald"
              whileHover={{ scale: 1.01 }}
            >
              {/* Background Effects */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-[#10b981]/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
              <div className="absolute inset-0 bg-gradient-to-br from-[#10b981]/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />

              {/* Badge */}
              <div className="absolute top-6 right-6">
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#10b981]/20 text-[#10b981] text-xs font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#10b981] animate-pulse" />
                  Our Solution
                </span>
              </div>

              {/* Header */}
              <div className="relative flex items-center gap-4 mb-10">
                <motion.div 
                  className="w-14 h-14 rounded-2xl bg-[#10b981]/10 flex items-center justify-center"
                  animate={{ rotate: [0, 5, 0] }}
                  transition={{ duration: 4, repeat: Infinity }}
                >
                  <Shield className="w-7 h-7 text-[#10b981]" />
                </motion.div>
                <div>
                  <h3 className="text-2xl font-bold text-white">The Aethelred Standard</h3>
                  <p className="text-sm text-[#10b981]/70">Engineered carbon truth</p>
                </div>
              </div>

              {/* Solutions List */}
              <ul className="relative space-y-4">
                {terraQuraSolutions.map((solution, index) => (
                  <motion.li 
                    key={solution.text}
                    className="flex items-start gap-4 p-4 rounded-2xl bg-[#10b981]/[0.05] border border-[#10b981]/10 group/item"
                    initial={false}
                    animate={(isInView || fallback) ? { opacity: 1, x: 0 } : {}}
                    transition={{ delay: 0.3 + index * 0.1 }}
                    whileHover={{ x: 4 }}
                  >
                    <div className="w-6 h-6 rounded-full bg-[#10b981]/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Check className="w-4 h-4 text-[#10b981]" />
                    </div>
                    <div className="flex-1">
                      <span className="text-white/80 text-[15px] font-medium font-body leading-relaxed">{solution.text}</span>
                      {solution.impact === "high" && (
                        <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs bg-emerald-500/20 text-emerald-400">
                          High Impact
                        </span>
                      )}
                    </div>
                  </motion.li>
                ))}
              </ul>

              {/* Trend Indicator */}
              <div className="mt-8 flex items-center gap-3 text-[#10b981]/60">
                <TrendingUp className="w-5 h-5" />
                <span className="text-sm">Market adoption accelerating</span>
              </div>
            </motion.div>
          </ScrollReveal>
        </div>

        {/* Metrics Comparison */}
        <ScrollReveal delay={0.3}>
          <div className="max-w-4xl mx-auto">
            <h4 className="text-center text-white/55 text-xs font-mono uppercase tracking-[0.2em] mb-8">
              Performance Comparison
            </h4>
            
            <div className="space-y-4">
              {metrics.map((metric, index) => (
                <motion.div
                  key={metric.label}
                  className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4 p-5 sm:p-6 rounded-2xl glass items-start sm:items-center"
                  initial={false}
                  animate={(isInView || fallback) ? { opacity: 1, y: 0 } : {}}
                  transition={{ delay: 0.4 + index * 0.1 }}
                  whileHover={{ scale: 1.01 }}
                >
                  <div className="text-white font-medium text-[15px]">{metric.label}</div>
                  <div className="text-red-400/70 text-[15px] line-through">{metric.legacy}</div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-[#10b981] font-semibold">{metric.aethelred}</span>
                    <span className="text-xs px-2 py-1 rounded-full bg-[#10b981]/10 text-[#10b981] whitespace-nowrap">
                      {metric.improvement} better
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
