"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { Cpu, Scale, Database, ArrowRight, CheckCircle2, Cloud, Factory, Radio, Eye, Satellite, CircleDot } from "lucide-react";
import { ScrollReveal, StaggerContainer, StaggerItem } from "@/components/animations/ScrollReveal";

const steps = [
  {
    num: "01",
    title: "Capture",
    subtitle: "IoT Sensor Stream",
    desc: "DAC facilities stream energy and CO2 data to our NativeIoT Oracle, cross-verified with satellite imagery.",
    icon: Cpu,
    color: "#10b981",
  },
  {
    num: "02",
    title: "Compute",
    subtitle: "Physics Validation",
    desc: "The Aethelred VerificationEngine validates energy-to-carbon ratios. Only readings within 200-600 kWh/tonne pass.",
    icon: Scale,
    color: "#06b6d4",
  },
  {
    num: "03",
    title: "Mint",
    subtitle: "On-Chain Issuance",
    desc: "Verified events mint as ERC-1155 tokens with full provenance. Each token represents 1 tonne of verified CO2 removal.",
    icon: Database,
    color: "#3b82f6",
  },
];

const flowSteps = [
  { label: "Atmospheric CO2", Icon: Cloud },
  { label: "DAC Facility", Icon: Factory },
  { label: "IoT Sensors", Icon: Radio },
  { label: "Aethelred Oracle", Icon: Eye },
  { label: "Satellite Verify", Icon: Satellite },
  { label: "ERC-1155 Token", Icon: CircleDot },
];

export function ProofEngine() {
  const sectionRef = useRef<HTMLElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  
  const { scrollYProgress } = useScroll({
    target: timelineRef,
    offset: ["start end", "end start"],
  });

  const lineHeight = useTransform(scrollYProgress, [0, 0.5], ["0%", "100%"]);

  return (
    <section ref={sectionRef} className="relative section-padding overflow-hidden bg-[#03060c]" aria-labelledby="proof-engine-heading">
      {/* Background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-dot-pattern opacity-10" />
        <motion.div 
          className="absolute top-1/4 right-0 w-[600px] h-[600px] rounded-full"
          style={{ background: "radial-gradient(circle, rgba(16, 185, 129, 0.08) 0%, transparent 60%)", filter: "blur(80px)" }}
          animate={{ x: [0, 30, 0], opacity: [0.5, 0.7, 0.5] }}
          transition={{ duration: 12, repeat: Infinity }}
        />
      </div>

      <div className="container-premium relative z-10">
        {/* Header */}
        <ScrollReveal className="text-center mb-20">
          <motion.div 
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass mb-8"
            whileHover={{ scale: 1.05 }}
          >
            <span className="text-[#10b981] text-sm font-mono uppercase tracking-wider">Aethelred Protocol</span>
          </motion.div>
          <h2 id="proof-engine-heading" className="text-display font-display text-white mb-6">
            Three Steps to{" "}
            <span className="text-gradient-emerald">Mathematical Truth</span>
          </h2>
          <p className="text-body-lg text-white/70 max-w-2xl mx-auto font-body leading-relaxed">
            Every carbon credit passes through our three-phase verification engine.
            No human judgment. No manual audits. Just physics.
          </p>
        </ScrollReveal>

        {/* Interactive Timeline */}
        <div ref={timelineRef} className="relative max-w-6xl mx-auto">
          {/* Connecting Line - Desktop */}
          <div className="hidden lg:block absolute top-1/2 left-0 right-0 h-0.5 bg-white/5 -translate-y-1/2">
            <motion.div 
              className="h-full bg-gradient-to-r from-[#10b981] via-[#06b6d4] to-[#3b82f6]"
              style={{ width: lineHeight }}
            />
          </div>

          {/* Steps Grid */}
          <StaggerContainer className="grid lg:grid-cols-3 gap-8 lg:gap-12" staggerDelay={0.2}>
            {steps.map((step, index) => (
              <StaggerItem key={step.num}>
                <motion.div
                  className="group relative"
                  whileHover={{ y: -8 }}
                  transition={{ type: "spring", stiffness: 400, damping: 25 }}
                >
                  {/* Card */}
                  <div className="relative p-8 rounded-3xl glass-card overflow-hidden">
                    {/* Gradient Top Border */}
                    <div 
                      className="absolute top-0 left-0 right-0 h-1 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                      style={{ background: `linear-gradient(90deg, ${step.color}, transparent)` }}
                    />

                    {/* Number Badge */}
                    <div className="flex items-center justify-between mb-8">
                      <span 
                        className="text-6xl font-bold font-mono opacity-20"
                        style={{ color: step.color }}
                      >
                        {step.num}
                      </span>
                      <motion.div 
                        className="w-14 h-14 rounded-2xl flex items-center justify-center"
                        style={{ backgroundColor: `${step.color}15` }}
                        whileHover={{ rotate: 10, scale: 1.1 }}
                      >
                        <step.icon className="w-7 h-7" style={{ color: step.color }} />
                      </motion.div>
                    </div>

                    {/* Content */}
                    <h3 className="text-2xl lg:text-3xl font-bold text-white mb-2">{step.title}</h3>
                    <p className="text-sm font-mono uppercase tracking-wider mb-4" style={{ color: step.color }}>
                      {step.subtitle}
                    </p>
                    <p className="text-white/70 text-base leading-relaxed font-body">{step.desc}</p>

                    {/* Step Connector - Mobile */}
                    {index < steps.length - 1 && (
                      <div className="lg:hidden absolute -bottom-4 left-1/2 -translate-x-1/2">
                        <ArrowRight className="w-5 h-5 text-white/20 rotate-90" />
                      </div>
                    )}
                  </div>

                  {/* Pulse Effect */}
                  <motion.div
                    className="absolute top-8 right-8 w-3 h-3 rounded-full"
                    style={{ backgroundColor: step.color }}
                    animate={{ scale: [1, 1.5, 1], opacity: [1, 0.5, 1] }}
                    transition={{ duration: 2, repeat: Infinity, delay: index * 0.3 }}
                  />
                </motion.div>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>

        {/* Process Flow Visualization */}
        <ScrollReveal delay={0.4} className="mt-20">
          <div className="p-8 rounded-3xl glass max-w-5xl mx-auto">
            <h4 className="text-center text-white/70 text-sm font-mono uppercase tracking-wider mb-8">
              End-to-End Verification Flow
            </h4>
            
            <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4">
              {flowSteps.map((step, index) => (
                <div key={step.label} className="flex items-center">
                  <motion.div 
                    className={`flex items-center gap-2 sm:gap-3 px-4 sm:px-5 py-3 rounded-xl border text-sm font-medium transition-all duration-300 ${
                      index === flowSteps.length - 1 
                        ? "bg-[#10b981]/10 border-[#10b981]/30 text-[#10b981]" 
                        : "bg-white/[0.02] border-white/[0.05] text-white/70 hover:border-white/10 hover:text-white/70"
                    }`}
                    whileHover={{ scale: 1.05, y: -2 }}
                  >
                    <step.Icon className="w-5 h-5" />
                    <span className="hidden sm:inline">{step.label}</span>
                  </motion.div>
                  
                  {index < flowSteps.length - 1 && (
                    <motion.div 
                      className="mx-2 sm:mx-3"
                      animate={{ x: [0, 3, 0] }}
                      transition={{ duration: 1.5, repeat: Infinity, delay: index * 0.2 }}
                    >
                      <ArrowRight className="w-4 h-4 text-white/10" />
                    </motion.div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </ScrollReveal>

        {/* Trust Indicators */}
        <ScrollReveal delay={0.5} className="mt-16">
          <div className="flex flex-wrap items-center justify-center gap-6 text-white/30 text-sm">
            {[
              { icon: CheckCircle2, text: "Cryptographically Verified" },
              { icon: CheckCircle2, text: "Tamper-Proof Records" },
              { icon: CheckCircle2, text: "Real-Time Monitoring" },
            ].map((item) => (
              <div key={item.text} className="flex items-center gap-2">
                <item.icon className="w-4 h-4 text-[#10b981]" />
                <span>{item.text}</span>
              </div>
            ))}
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
