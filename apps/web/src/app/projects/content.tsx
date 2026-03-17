"use client";

import Link from "next/link";
import {
  MapPin,
  Zap,
  Wind,
  Factory,
  Globe,
  ArrowRight,
  Radio,
  ShieldCheck,
  Coins,
  Handshake,
} from "lucide-react";
import { AnimatedSection, StaggerContainer, StaggerItem } from "@/components/shared/AnimatedSection";

type ProjectStatus = "engineering" | "site-assessment" | "planning";

interface Project {
  name: string;
  region: string;
  flag: string;
  capacity: string;
  technology: string;
  status: ProjectStatus;
  statusLabel: string;
  description: string;
  highlights: string[];
}

const projects: Project[] = [
  {
    name: "Abu Dhabi DAC-1",
    region: "Abu Dhabi, UAE",
    flag: "🇦🇪",
    capacity: "5,000 tCO₂/year",
    technology: "Solid Sorbent DAC",
    status: "planning",
    statusLabel: "Planning",
    description:
      "Flagship pilot facility in partnership with UAE clean energy infrastructure. First deployment of the full Proof-of-Physics verification stack including NativeIoT Oracle sensors and satellite cross-verification.",
    highlights: [
      "Full IoT sensor instrumentation",
      "Satellite imagery verification",
      "First Aethelred Protocol deployment",
    ],
  },
  {
    name: "Abu Dhabi Masdar DAC Hub",
    region: "Masdar City, Abu Dhabi",
    flag: "🇦🇪",
    capacity: "15,000 tCO₂/year",
    technology: "Liquid Solvent DAC",
    status: "planning",
    statusLabel: "Planning",
    description:
      "Clean energy-powered DAC facility co-located within Masdar City's sustainable infrastructure zone. Leveraging concentrated solar thermal energy for solvent regeneration and integrated district cooling waste heat.",
    highlights: [
      "Solar thermal energy integration",
      "Masdar City infrastructure partnership",
      "ADGM regulatory sandbox participation",
    ],
  },
  {
    name: "Abu Dhabi Industrial Cluster",
    region: "KIZAD, Abu Dhabi",
    flag: "🇦🇪",
    capacity: "30,000 tCO₂/year",
    technology: "Multi-Technology DAC",
    status: "planning",
    statusLabel: "Planning",
    description:
      "Large-scale industrial carbon removal cluster within Khalifa Industrial Zone. Multiple DAC technology providers connected through a unified TerraQura verification layer, with direct pipeline access to geological sequestration sites.",
    highlights: [
      "Multi-vendor technology integration",
      "Geological sequestration pipeline",
      "Sovereign wealth fund partnership",
    ],
  },
  {
    name: "Arabian Gulf Industrial Hub",
    region: "Eastern Province, KSA",
    flag: "🇸🇦",
    capacity: "25,000 tCO₂/year",
    technology: "Liquid Solvent DAC",
    status: "planning",
    statusLabel: "Planning",
    description:
      "Large-scale industrial deployment leveraging co-located renewable energy and waste heat from existing petrochemical infrastructure. Designed for enterprise-grade credit issuance.",
    highlights: [
      "Co-located renewable energy",
      "Waste heat integration",
      "Enterprise off-take agreements",
    ],
  },
  {
    name: "GCC Multi-Facility Network",
    region: "Gulf Cooperation Council",
    flag: "🌍",
    capacity: "50,000 tCO₂/year",
    technology: "Multi-Technology",
    status: "planning",
    statusLabel: "Planning",
    description:
      "Distributed network of DAC facilities across the GCC region, connected through a unified verification layer. Designed to demonstrate cross-facility Proof-of-Physics at scale.",
    highlights: [
      "Multi-facility orchestration",
      "Cross-border verification",
      "Unified credit issuance",
    ],
  },
  {
    name: "Southeast Asia Pilot",
    region: "Southeast Asia",
    flag: "🌏",
    capacity: "10,000 tCO₂/year",
    technology: "Hybrid DAC",
    status: "planning",
    statusLabel: "Planning",
    description:
      "Regional expansion node extending the Aethelred verification network to tropical climates. Validating Proof-of-Physics under diverse environmental conditions.",
    highlights: [
      "Tropical climate validation",
      "Regional partner network",
      "Multi-chain bridge testing",
    ],
  },
];

const statusConfig: Record<ProjectStatus, { dot: string; badge: string }> = {
  engineering: {
    dot: "bg-amber-500 animate-pulse",
    badge: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  },
  "site-assessment": {
    dot: "bg-cyan-500 animate-pulse",
    badge: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20",
  },
  planning: {
    dot: "bg-emerald-500/40",
    badge: "text-emerald-400/70 bg-emerald-500/[0.06] border-emerald-500/15",
  },
};

const devProcess = [
  {
    step: "01",
    title: "Connect",
    desc: "Onboard your DAC facility to the TerraQura network. We assess site specifications, energy sources, and capture technology.",
    icon: Handshake,
  },
  {
    step: "02",
    title: "Instrument",
    desc: "Deploy NativeIoT Oracle sensors (energy meters, CO₂ flow sensors, temperature and pressure monitors) with edge-signed telemetry.",
    icon: Radio,
  },
  {
    step: "03",
    title: "Verify",
    desc: "The Proof-of-Physics engine validates every capture event against thermodynamic bounds (200–600 kWh/tonne). Satellite imagery provides independent cross-verification.",
    icon: ShieldCheck,
  },
  {
    step: "04",
    title: "Tokenize",
    desc: "Verified removals are minted as ERC-1155 carbon credits with full provenance metadata, traceable from sensor reading to token.",
    icon: Coins,
  },
];

export function ProjectsContent() {
  return (
    <>
      {/* Hero */}
      <section className="relative py-16 sm:py-20 lg:py-24" aria-labelledby="projects-heading">
        <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
          <div className="absolute inset-0 bg-dot-pattern opacity-20" />
        </div>
        <div className="container mx-auto px-6 sm:px-8 lg:px-10 relative z-10">
          <AnimatedSection className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 mb-6">
              <Factory className="w-4 h-4 text-emerald-400" />
              <span className="text-emerald-400 text-sm font-data uppercase tracking-wider">
                Project Development
              </span>
            </div>
            <h1
              id="projects-heading"
              className="text-display-lg lg:text-display-xl text-white mb-6"
            >
              Building the Carbon
              <br />
              <span className="text-gradient-emerald">Removal Pipeline</span>
            </h1>
            <p className="text-lg text-white/70 max-w-3xl mx-auto font-body leading-relaxed mb-10">
              TerraQura is actively developing a network of Direct Air Capture facilities
              verified through the Aethelred Protocol. We partner with facility operators,
              energy providers, sovereign entities, and governments across the GCC and beyond
              to bring Proof-of-Physics verification to every tonne of captured carbon.
              Each project in our pipeline will be fully instrumented with NativeIoT Oracle
              sensors, validated by thermodynamic models, and cross-verified with satellite imagery.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="#partner"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 text-base font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl transition-all shadow-lg shadow-emerald-600/20"
              >
                Become a Project Partner
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/technology"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 text-base font-semibold text-white/80 border border-white/10 hover:border-white/20 rounded-xl transition-all"
              >
                Explore the Technology
              </Link>
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* Project Pipeline */}
      <section
        className="relative py-16 sm:py-20 lg:py-24 bg-midnight-900/30"
        aria-labelledby="pipeline-heading"
      >
        <div className="container mx-auto px-6 sm:px-8 lg:px-10">
          <AnimatedSection className="text-center mb-16">
            <h2
              id="pipeline-heading"
              className="text-display text-white mb-4"
            >
              Project Pipeline
            </h2>
            <p className="text-white/70 text-[15px] max-w-2xl mx-auto font-body leading-relaxed">
              Active and planned DAC facilities in our development pipeline.
              Each project will be fully instrumented with IoT sensors and verified
              through the Proof-of-Physics engine.
            </p>
          </AnimatedSection>

          <StaggerContainer
            className="grid md:grid-cols-2 gap-6 max-w-5xl mx-auto"
            staggerDelay={0.1}
          >
            {projects.map((project) => {
              const config = statusConfig[project.status];
              return (
                <StaggerItem key={project.name}>
                  <div className="h-full p-6 lg:p-8 rounded-2xl bg-white/[0.02] border border-white/[0.06] hover:border-emerald-500/20 transition-all duration-300">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-5">
                      <div className="flex items-center gap-3">
                        <div className={`w-2.5 h-2.5 rounded-full ${config.dot}`} />
                        <span
                          className={`text-xs font-data uppercase tracking-wider px-2.5 py-1 rounded-full border ${config.badge}`}
                        >
                          {project.statusLabel}
                        </span>
                      </div>
                      <span className="text-2xl">{project.flag}</span>
                    </div>

                    {/* Title & Location */}
                    <h3 className="text-xl font-bold text-white mb-1">
                      {project.name}
                    </h3>
                    <div className="flex items-center gap-1.5 text-white/50 text-sm mb-4">
                      <MapPin className="w-3.5 h-3.5" />
                      <span className="font-body">{project.region}</span>
                    </div>

                    {/* Specs Row */}
                    <div className="flex flex-wrap gap-3 mb-5">
                      <div className="flex items-center gap-1.5 text-xs text-emerald-400/70 bg-emerald-500/[0.06] px-3 py-1.5 rounded-lg font-mono">
                        <Wind className="w-3.5 h-3.5" />
                        {project.capacity}
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-white/50 bg-white/[0.03] px-3 py-1.5 rounded-lg font-mono">
                        <Zap className="w-3.5 h-3.5" />
                        {project.technology}
                      </div>
                    </div>

                    {/* Description */}
                    <p className="text-white/70 text-[15px] leading-relaxed font-body mb-5">
                      {project.description}
                    </p>

                    {/* Highlights */}
                    <ul className="space-y-2">
                      {project.highlights.map((h) => (
                        <li
                          key={h}
                          className="flex items-center gap-2.5 text-sm text-white/60 font-body"
                        >
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500/50" />
                          {h}
                        </li>
                      ))}
                    </ul>
                  </div>
                </StaggerItem>
              );
            })}
          </StaggerContainer>

          {/* Pipeline Summary */}
          <AnimatedSection className="mt-12">
            <div className="flex flex-wrap justify-center gap-8 max-w-3xl mx-auto">
              <div className="text-center">
                <div className="text-3xl font-bold text-white font-mono">
                  135,000
                </div>
                <div className="text-xs text-white/50 uppercase tracking-wider font-data mt-1">
                  tCO₂/year pipeline
                </div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-white font-mono">6</div>
                <div className="text-xs text-white/50 uppercase tracking-wider font-data mt-1">
                  Projects in development
                </div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-white font-mono">4</div>
                <div className="text-xs text-white/50 uppercase tracking-wider font-data mt-1">
                  Regions targeted
                </div>
              </div>
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* Development Process */}
      <section
        className="relative py-16 sm:py-20 lg:py-24"
        aria-labelledby="process-heading"
      >
        <div className="container mx-auto px-6 sm:px-8 lg:px-10">
          <AnimatedSection className="text-center mb-16">
            <h2
              id="process-heading"
              className="text-display text-white mb-4"
            >
              How We Develop Projects
            </h2>
            <p className="text-white/70 text-[15px] max-w-2xl mx-auto font-body leading-relaxed">
              From facility onboarding to verified carbon credit issuance, a
              four-step process powered by the Aethelred Protocol.
            </p>
          </AnimatedSection>

          <StaggerContainer
            className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto"
            staggerDelay={0.1}
          >
            {devProcess.map((step) => {
              const Icon = step.icon;
              return (
                <StaggerItem key={step.step}>
                  <div className="text-center p-6 rounded-2xl bg-white/[0.02] border border-white/[0.06] h-full">
                    <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto mb-4">
                      <Icon className="w-6 h-6" />
                    </div>
                    <div className="text-xs text-emerald-500/50 font-mono uppercase tracking-widest mb-2">
                      Step {step.step}
                    </div>
                    <h3 className="text-lg font-bold text-white mb-3">
                      {step.title}
                    </h3>
                    <p className="text-white/70 text-[15px] leading-relaxed font-body">
                      {step.desc}
                    </p>
                  </div>
                </StaggerItem>
              );
            })}
          </StaggerContainer>
        </div>
      </section>

      {/* Regional Strategy */}
      <section
        className="relative py-16 sm:py-20 lg:py-24 bg-midnight-900/30"
        aria-labelledby="strategy-heading"
      >
        <div className="container mx-auto px-6 sm:px-8 lg:px-10">
          <AnimatedSection className="text-center mb-16">
            <h2
              id="strategy-heading"
              className="text-display text-white mb-4"
            >
              Regional Strategy
            </h2>
            <p className="text-white/70 text-[15px] max-w-2xl mx-auto font-body leading-relaxed">
              Our phased geographic expansion follows energy infrastructure,
              regulatory readiness, and climate finance demand across key markets.
            </p>
          </AnimatedSection>

          <StaggerContainer
            className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto"
            staggerDelay={0.1}
          >
            {[
              {
                phase: "Phase 1",
                region: "Abu Dhabi & UAE",
                flag: "\ud83c\udde6\ud83c\uddea",
                timeline: "2026\u20132027",
                points: [
                  "Flagship DAC-1 pilot facility deployment",
                  "ADGM regulatory sandbox participation",
                  "Masdar City clean energy integration",
                  "Sovereign wealth fund partnerships",
                ],
              },
              {
                phase: "Phase 2",
                region: "GCC Expansion",
                flag: "\ud83c\udf0d",
                timeline: "2027\u20132028",
                points: [
                  "Saudi Arabia industrial zone deployment",
                  "Multi-facility verification orchestration",
                  "Cross-border credit issuance framework",
                  "Regional enterprise buyer onboarding",
                ],
              },
              {
                phase: "Phase 3",
                region: "Global Scale",
                flag: "\ud83c\udf10",
                timeline: "2028+",
                points: [
                  "Southeast Asia tropical climate validation",
                  "Multi-chain bridge for global settlement",
                  "Technology licensing to regional operators",
                  "Integration with international carbon markets",
                ],
              },
            ].map((phase) => (
              <StaggerItem key={phase.phase}>
                <div className="h-full p-6 lg:p-8 rounded-2xl bg-white/[0.02] border border-white/[0.06] hover:border-emerald-500/20 transition-all duration-300">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="text-xs font-data text-emerald-400/70 bg-emerald-500/[0.06] px-2.5 py-1 rounded-full border border-emerald-500/15 uppercase tracking-wider">
                      {phase.phase}
                    </span>
                    <span className="text-xs font-data text-white/40">{phase.timeline}</span>
                  </div>
                  <div className="flex items-center gap-2 mb-4">
                    <span className="text-xl">{phase.flag}</span>
                    <h3 className="text-lg font-bold text-white">{phase.region}</h3>
                  </div>
                  <ul className="space-y-2.5">
                    {phase.points.map((point) => (
                      <li
                        key={point}
                        className="flex items-start gap-2.5 text-sm text-white/60 font-body"
                      >
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500/50 mt-1.5 shrink-0" />
                        {point}
                      </li>
                    ))}
                  </ul>
                </div>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>
      </section>

      {/* Become a Partner CTA */}
      <section
        id="partner"
        className="relative py-16 sm:py-20 lg:py-24 bg-midnight-900/30"
        aria-labelledby="partner-heading"
      >
        <div className="container mx-auto px-6 sm:px-8 lg:px-10">
          <div className="max-w-3xl mx-auto">
            <AnimatedSection className="text-center mb-12">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 mb-6">
                <Globe className="w-4 h-4 text-emerald-400" />
                <span className="text-emerald-400 text-sm font-data uppercase tracking-wider">
                  Open for Partners
                </span>
              </div>
              <h2
                id="partner-heading"
                className="text-display text-white mb-4"
              >
                Develop a Project With Us
              </h2>
              <p className="text-white/70 text-[15px] font-body leading-relaxed max-w-xl mx-auto">
                Whether you operate a DAC facility, provide renewable energy
                infrastructure, or represent a government carbon initiative,
                we want to hear from you.
              </p>
            </AnimatedSection>

            <AnimatedSection>
              <div className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <input
                    type="text"
                    placeholder="Organization name"
                    className="w-full px-4 py-3.5 bg-white/[0.03] border border-white/[0.08] rounded-lg text-white font-body text-sm placeholder-white/40 focus:outline-none focus:border-emerald-500/30 transition-colors"
                    aria-label="Organization name"
                  />
                  <input
                    type="text"
                    placeholder="Contact name"
                    className="w-full px-4 py-3.5 bg-white/[0.03] border border-white/[0.08] rounded-lg text-white font-body text-sm placeholder-white/40 focus:outline-none focus:border-emerald-500/30 transition-colors"
                    aria-label="Contact name"
                  />
                </div>
                <input
                  type="email"
                  placeholder="Email address"
                  className="w-full px-4 py-3.5 bg-white/[0.03] border border-white/[0.08] rounded-lg text-white font-body text-sm placeholder-white/40 focus:outline-none focus:border-emerald-500/30 transition-colors"
                  aria-label="Email address"
                />
                <select
                  className="w-full px-4 py-3.5 bg-white/[0.03] border border-white/[0.08] rounded-lg text-white/40 font-body text-sm focus:outline-none focus:border-emerald-500/30 transition-colors appearance-none"
                  aria-label="Partnership type"
                  defaultValue=""
                >
                  <option value="" disabled>
                    Partnership type
                  </option>
                  <option value="facility">DAC Facility Operator</option>
                  <option value="energy">Energy Infrastructure Provider</option>
                  <option value="government">Government / Sovereign Entity</option>
                  <option value="technology">Technology / IoT Partner</option>
                  <option value="investor">Institutional Investor</option>
                  <option value="other">Other</option>
                </select>
                <textarea
                  placeholder="Tell us about your project or partnership interest..."
                  rows={4}
                  className="w-full px-4 py-3.5 bg-white/[0.03] border border-white/[0.08] rounded-lg text-white font-body text-sm placeholder-white/40 focus:outline-none focus:border-emerald-500/30 transition-colors resize-none"
                  aria-label="Message"
                />
                <button className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg transition-colors text-sm">
                  Submit Partnership Inquiry
                </button>
              </div>
            </AnimatedSection>
          </div>
        </div>
      </section>
    </>
  );
}
