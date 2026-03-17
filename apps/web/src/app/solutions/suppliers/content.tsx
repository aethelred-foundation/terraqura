"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { AnimatedSection, StaggerContainer, StaggerItem } from "@/components/shared/AnimatedSection";

const advantages = [
  { title: "IoT Integration", desc: "Connect your facility sensors to the TerraQura Oracle Network via standard MQTT/HTTP protocols. Real-time data streaming to the blockchain.", icon: "sensor" },
  { title: "Instant Verification", desc: "Designed to replace 3-6 month manual audit cycles. Proof-of-Physics validates your capture data against physical constraints in real-time.", icon: "zap" },
  { title: "Dramatically Faster to Market", desc: "From capture event to tradeable token in seconds, not months. Bypass legacy paper registries and auditor bottlenecks.", icon: "clock" },
  { title: "Direct Marketplace", desc: "List your verified credits directly on the TerraQura Marketplace. Connect with institutional buyers, sovereign wealth funds, and ESG-mandated corporations.", icon: "market" },
  { title: "Transparent Fees", desc: "2.5% on primary sales only. No hidden charges, no annual fees, no verification costs. All fees displayed before transaction.", icon: "percent" },
  { title: "Global Reach", desc: "Platform incorporating under ADGM, accessible to facilities worldwide. Multi-currency fiat settlement for operators in any jurisdiction.", icon: "globe" },
];

export function SuppliersContent() {
  return (
    <>
      <section className="relative py-16 sm:py-20 lg:py-24" aria-labelledby="suppliers-heading">
        <div className="absolute inset-0 bg-dot-grid opacity-20 pointer-events-none" aria-hidden="true" />
        <div className="container mx-auto px-6 sm:px-8 lg:px-10 relative z-10">
          <AnimatedSection className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-cyan-500/10 border border-cyan-500/20 mb-6">
              <span className="text-cyan-400 text-sm font-data">DAC OPERATORS</span>
            </div>
            <h1 id="suppliers-heading" className="text-display-lg lg:text-display-xl text-white mb-6">
              Connect Your Hardware.
              <br />
              <span className="text-gradient-cyan">Access Instant Liquidity.</span>
            </h1>
            <p className="text-lg text-white/70 max-w-3xl mx-auto font-body leading-relaxed mb-10">
              Integrate your DAC or biochar facility with the TerraQura Oracle Network and
              replace months-long manual audit cycles with real-time, automated verification.
              Our NativeIoT Oracle streams your sensor data directly to the Aethelred blockchain,
              where the Proof-of-Physics engine validates every capture event against thermodynamic
              constraints. Verified credits are minted instantly and listed on the marketplace,
              connecting you directly to institutional buyers worldwide.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/solutions/enterprise"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 text-base font-semibold text-white bg-cyan-600 hover:bg-cyan-500 rounded-xl transition-all shadow-lg shadow-cyan-600/20"
              >
                Get Started
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/technology"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 text-base font-semibold text-white/80 border border-white/10 hover:border-white/20 rounded-xl transition-all"
              >
                View Integration Guide
              </Link>
            </div>
          </AnimatedSection>
        </div>
      </section>

      <section className="relative py-20 bg-midnight-900/30" aria-labelledby="advantages-heading">
        <div className="container mx-auto px-6 sm:px-8 lg:px-10">
          <AnimatedSection className="text-center mb-16">
            <h2 id="advantages-heading" className="text-display text-white mb-4">Supplier Advantages</h2>
          </AnimatedSection>
          <StaggerContainer className="grid md:grid-cols-2 lg:grid-cols-3 gap-5 max-w-6xl mx-auto" staggerDelay={0.08}>
            {advantages.map((a) => (
              <StaggerItem key={a.title}>
                <div className="h-full p-6 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:border-white/10 transition-colors">
                  <div className="w-11 h-11 rounded-lg bg-cyan-500/10 text-cyan-400 flex items-center justify-center mb-4">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-bold text-white mb-2">{a.title}</h3>
                  <p className="text-white/70 text-[15px] leading-relaxed font-body">{a.desc}</p>
                </div>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>
      </section>

      {/* Facility Requirements */}
      <section className="relative py-16 sm:py-20" aria-labelledby="requirements-heading">
        <div className="container mx-auto px-6 sm:px-8 lg:px-10">
          <AnimatedSection className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 mb-6">
              <span className="text-emerald-400/70 text-sm font-data">GETTING STARTED</span>
            </div>
            <h2 id="requirements-heading" className="text-display text-white mb-4">Facility Requirements</h2>
            <p className="max-w-2xl mx-auto font-body text-white/70 text-[15px] leading-relaxed">
              Minimum specifications for onboarding a DAC facility to the TerraQura verification network.
            </p>
          </AnimatedSection>
          <StaggerContainer className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 max-w-6xl mx-auto" staggerDelay={0.08}>
            {[
              { label: "Capture Capacity", value: "500+ tCO\u2082/year", desc: "Minimum annual capture output for network eligibility" },
              { label: "Energy Metering", value: "Real-Time kWh", desc: "Continuous energy consumption monitoring at the unit level" },
              { label: "CO\u2082 Flow Sensors", value: "Calibrated Output", desc: "Calibrated sensors measuring captured CO\u2082 mass flow rates" },
              { label: "Data Connectivity", value: "MQTT / HTTPS", desc: "Reliable internet connection for real-time telemetry streaming" },
              { label: "Power Source", value: "Documented Grid/Renewable", desc: "Verified energy source documentation for emissions accounting" },
              { label: "Operational History", value: "72-Hour Baseline", desc: "Minimum calibration period before credit issuance begins" },
            ].map((req) => (
              <StaggerItem key={req.label}>
                <div className="h-full p-6 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:border-emerald-500/20 transition-colors">
                  <p className="text-sm font-mono text-white/50 uppercase tracking-wider mb-1">{req.label}</p>
                  <p className="text-base font-semibold text-emerald-400 mb-2">{req.value}</p>
                  <p className="text-white/70 text-[15px] leading-relaxed font-body">{req.desc}</p>
                </div>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>
      </section>

      {/* Integration steps */}
      <section className="relative py-20" aria-labelledby="integration-heading">
        <div className="container mx-auto px-6 sm:px-8 lg:px-10">
          <AnimatedSection className="text-center mb-16">
            <h2 id="integration-heading" className="text-display text-white mb-4">Integration Path</h2>
          </AnimatedSection>
          <StaggerContainer className="max-w-3xl mx-auto space-y-4" staggerDelay={0.1}>
            {[
              { n: "1", t: "Register Your Facility", d: "Submit facility specs, technology type, and capture capacity for KYC verification" },
              { n: "2", t: "Connect IoT Sensors", d: "Integrate energy meters and CO2 flow sensors via MQTT or HTTP REST endpoints" },
              { n: "3", t: "Calibration Period", d: "72-hour data validation period to calibrate your facility's efficiency baseline" },
              { n: "4", t: "Go Live", d: "Automatic verification and minting will begin. Credits will appear on the marketplace immediately" },
            ].map((step) => (
              <StaggerItem key={step.n}>
                <div className="flex items-start gap-5 p-5 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                  <div className="w-10 h-10 rounded-lg bg-cyan-500/10 text-cyan-400 font-bold font-data flex items-center justify-center shrink-0">
                    {step.n}
                  </div>
                  <div>
                    <h3 className="text-white font-semibold text-sm mb-1">{step.t}</h3>
                    <p className="text-white/70 text-[15px] font-body leading-relaxed">{step.d}</p>
                  </div>
                </div>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>
      </section>
    </>
  );
}
