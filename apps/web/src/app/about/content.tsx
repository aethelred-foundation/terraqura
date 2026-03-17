"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { AnimatedSection, StaggerContainer, StaggerItem } from "@/components/shared/AnimatedSection";

const values = [
  { title: "Engineered Truth", desc: "We believe carbon markets should be governed by physics, not paper. Every claim must be mathematically verifiable." },
  { title: "Radical Transparency", desc: "All smart contracts are public. All verifications are on-chain. All data is auditable. We have nothing to hide." },
  { title: "Enterprise-First", desc: "Designed for the institutions that will drive global decarbonization: sovereign wealth funds, multinational corporations, and governments." },
  { title: "Global by Design", desc: "Built for worldwide deployment from day one. Our protocol-level verification infrastructure is jurisdiction-agnostic, connecting facilities, buyers, and regulators across every carbon market." },
];

const roadmap = [
  { phase: "Phase 1", title: "Foundation", status: "in-progress", items: ["Core smart contracts deployed on testnet", "Proof-of-Physics Engine v1", "Executive dashboard MVP", "IoT simulator for testing"] },
  { phase: "Phase 2", title: "Enterprise Readiness", status: "active", items: ["CertiK/Hacken security audit", "Gasless settlement (ERC-2771)", "Enterprise API & SDK", "KYC/AML integration (Sumsub)"] },
  { phase: "Phase 3", title: "Mainnet Launch", status: "upcoming", items: ["Aethelred sovereign chain deployment", "First institutional pilot partners", "Fiat on-ramp infrastructure", "NativeIoT Oracle + satellite verification"] },
  { phase: "Phase 4", title: "Global Scale", status: "upcoming", items: ["Multi-chain bridge expansion", "Carbon index products", "DAO governance transition", "100+ facility network"] },
];

export function AboutContent() {
  return (
    <>
      {/* Hero */}
      <section className="relative py-16 sm:py-20 lg:py-24" aria-labelledby="about-heading">
        <div className="container mx-auto px-6 sm:px-8 lg:px-10">
          <AnimatedSection className="max-w-4xl mx-auto text-center">
            <h1 id="about-heading" className="text-display-lg lg:text-display-xl text-white mb-6">
              Decarbonizing Through
              <br />
              <span className="text-gradient-emerald">Engineered Truth</span>
            </h1>
            <p className="text-lg text-white/70 max-w-3xl mx-auto font-body leading-relaxed mb-10">
              TerraQura was founded on a simple premise: if carbon credits are going to drive
              global decarbonization, they must be backed by physics, not promises. We are
              building the verification infrastructure that makes this possible: the Aethelred
              sovereign blockchain protocol, a real-time IoT oracle network, and a Proof-of-Physics
              engine that validates every tonne of captured CO₂ against thermodynamic constraints
              before a single credit is issued. Headquartered in Abu Dhabi and backed by Zhyra
              Holdings, we are connecting DAC facility operators, enterprise buyers, and regulators
              through a single transparent verification layer designed for institutional trust.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/solutions/enterprise"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 text-base font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl transition-all shadow-lg shadow-emerald-600/20"
              >
                Book a Demo
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/technology"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 text-base font-semibold text-white/80 border border-white/10 hover:border-white/20 rounded-xl transition-all"
              >
                Explore the Protocol
              </Link>
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* Values */}
      <section className="relative py-20 bg-midnight-900/30" aria-labelledby="values-heading">
        <div className="container mx-auto px-6 sm:px-8 lg:px-10">
          <AnimatedSection className="text-center mb-16">
            <h2 id="values-heading" className="text-display text-white mb-4">Our Principles</h2>
          </AnimatedSection>
          <StaggerContainer className="grid md:grid-cols-2 gap-5 max-w-4xl mx-auto" staggerDelay={0.1}>
            {values.map((v) => (
              <StaggerItem key={v.title}>
                <div className="p-6 rounded-xl bg-white/[0.02] border border-white/[0.06] h-full">
                  <h3 className="text-lg font-bold text-white mb-2">{v.title}</h3>
                  <p className="text-white/70 text-[15px] leading-relaxed font-body">{v.desc}</p>
                </div>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>
      </section>

      {/* Roadmap */}
      <section id="roadmap" className="relative py-20" aria-labelledby="roadmap-heading">
        <div className="container mx-auto px-6 sm:px-8 lg:px-10">
          <AnimatedSection className="text-center mb-16">
            <h2 id="roadmap-heading" className="text-display text-white mb-4">Roadmap</h2>
            <p className="text-white/70 max-w-2xl mx-auto font-body leading-relaxed">
              From testnet to sovereign Aethelred deployment and global institutional adoption.
            </p>
          </AnimatedSection>
          <StaggerContainer className="max-w-4xl mx-auto space-y-4" staggerDelay={0.12}>
            {roadmap.map((r) => (
              <StaggerItem key={r.phase}>
                <div className={`p-6 rounded-xl border ${
                  r.status === "completed" ? "border-emerald-500/20 bg-emerald-500/[0.03]" : r.status === "in-progress" ? "border-amber-500/20 bg-amber-500/[0.03]" :
                  r.status === "active" ? "border-cyan-500/20 bg-cyan-500/[0.03] glow-cyan" :
                  "border-white/[0.06] bg-white/[0.02]"
                }`}>
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`w-3 h-3 rounded-full ${
                      r.status === "completed" ? "bg-emerald-500" : r.status === "in-progress" ? "bg-amber-500 animate-pulse" :
                      r.status === "active" ? "bg-cyan-500 animate-pulse" :
                      "bg-white/20"
                    }`} />
                    <span className="text-sm font-data uppercase tracking-wider text-white/70">{r.phase}</span>
                    <span className="text-white font-bold text-lg">{r.title}</span>
                    {r.status === "in-progress" && (
                      <span className="text-xs font-data text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded">IN PROGRESS</span>
                    )}
                    {r.status === "active" && (
                      <span className="text-xs font-data text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded">CURRENT</span>
                    )}
                  </div>
                  <div className="grid sm:grid-cols-2 gap-2 pl-6">
                    {r.items.map((item) => (
                      <div key={item} className="flex items-center gap-2 text-sm">
                        <svg className={`w-3.5 h-3.5 shrink-0 ${r.status === "completed" ? "text-emerald-400" : "text-white/20"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                        <span className="text-white/70 font-body">{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>
      </section>

      {/* Backing */}
      <section className="relative py-20 bg-midnight-900/30">
        <div className="container mx-auto px-6 sm:px-8 lg:px-10">
          <AnimatedSection className="max-w-2xl mx-auto text-center">
            <p className="text-white/70 text-sm uppercase tracking-[0.2em] font-body mb-4">A Venture of</p>
            <p className="text-white text-2xl font-bold mb-4">Zhyra Holdings</p>
            <p className="text-white/70 text-[15px] font-body leading-relaxed">
              TerraQura is backed by Zhyra Holdings, with deep expertise in UAE regulatory frameworks,
              institutional finance, and climate technology infrastructure.
            </p>
          </AnimatedSection>
        </div>
      </section>
    </>
  );
}
