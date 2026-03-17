"use client";

import Link from "next/link";
import { AnimatedSection, StaggerContainer, StaggerItem } from "@/components/shared/AnimatedSection";

const benefits = [
  {
    title: "Automated ESG Compliance",
    desc: "TerraQura tokens integrate directly into corporate ledger reporting. Generate verifiable ESG reports automatically from your portfolio of retired carbon credits.",
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    title: "Fiat On-Ramp",
    desc: "Purchase credits through standard corporate invoices and wire transfers. No cryptocurrency wallets needed. Gasless smart contract interaction will be available via ERC-2771 meta-transactions.",
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
      </svg>
    ),
  },
  {
    title: "On-Chain Retirement",
    desc: "Retire credits directly on-chain with immutable proof. Generate cryptographic retirement certificates that satisfy auditor requirements and align with ADGM regulatory standards.",
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
  },
  {
    title: "Portfolio Analytics",
    desc: "Real-time dashboard with credit pricing, portfolio valuation, retirement tracking, and carbon offset progress against your net-zero targets.",
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
      </svg>
    ),
  },
  {
    title: "API Integration",
    desc: "RESTful and GraphQL APIs for seamless integration with existing ERP, sustainability platforms, and trading infrastructure. TypeScript SDK included.",
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    title: "Institutional Custody",
    desc: "Multi-signature wallet governance, hardware security modules for key management, and Enterprise-grade security architecture for institutional-grade asset custody.",
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
      </svg>
    ),
  },
];

const purchaseSteps = [
  { num: "1", title: "KYC Onboarding", desc: "Complete institutional identity verification via Sumsub integration" },
  { num: "2", title: "Browse Marketplace", desc: "Select verified credits filtered by methodology, vintage, and facility" },
  { num: "3", title: "Invoice & Wire", desc: "Receive standard corporate invoice. Pay via wire transfer or ACH" },
  { num: "4", title: "Gasless Settlement", desc: "Credits will transfer to your custody wallet via meta-transaction. No crypto needed" },
  { num: "5", title: "Retire & Report", desc: "Retire credits on-chain with one click. Download ESG compliance reports" },
];

export function EnterpriseContent() {
  return (
    <>
      {/* Hero */}
      <section className="relative py-16 sm:py-20 lg:py-24" aria-labelledby="enterprise-heading">
        <div className="absolute inset-0 bg-dot-grid opacity-20 pointer-events-none" aria-hidden="true" />
        <div className="container mx-auto px-6 sm:px-8 lg:px-10 relative z-10">
          <AnimatedSection className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 mb-6">
              <span className="text-emerald-400 text-sm font-data">ENTERPRISE BUYERS</span>
            </div>
            <h1 id="enterprise-heading" className="text-display-lg lg:text-display-xl text-white mb-6">
              Carbon Credits
              <br />
              <span className="text-gradient-emerald">Without Complexity</span>
            </h1>
            <p className="text-lg text-white/70 max-w-3xl mx-auto font-body leading-relaxed mb-10">
              Purchase high-integrity, physics-verified carbon removal credits through standard
              corporate invoices and wire transfers. No cryptocurrency wallets or blockchain
              expertise required. Every credit is backed by real-time IoT sensor data, validated
              against thermodynamic constraints by our Proof-of-Physics engine, and stored on-chain
              with full provenance metadata on the Aethelred sovereign network. Automated ESG
              compliance reporting, retirement certificates, and audit trails are included as
              standard. Designed for multinational corporations, sovereign wealth funds, and
              governments pursuing verified net-zero commitments with institutional-grade integrity.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="#contact"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 text-base font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl transition-all shadow-lg shadow-emerald-600/20"
              >
                Book a Demo
              </Link>
              <Link
                href="/technology"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 text-base font-semibold text-white/80 border border-white/10 hover:border-white/20 rounded-xl transition-all"
              >
                Learn the Technology
              </Link>
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* Benefits */}
      <section className="relative py-20 bg-midnight-900/30" aria-labelledby="benefits-heading">
        <div className="container mx-auto px-6 sm:px-8 lg:px-10">
          <AnimatedSection className="text-center mb-16">
            <h2 id="benefits-heading" className="text-display text-white mb-4">Enterprise Capabilities</h2>
          </AnimatedSection>
          <StaggerContainer className="grid md:grid-cols-2 lg:grid-cols-3 gap-5 max-w-6xl mx-auto" staggerDelay={0.08}>
            {benefits.map((b) => (
              <StaggerItem key={b.title}>
                <div className="h-full p-6 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:border-white/10 transition-colors">
                  <div className="w-11 h-11 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-4">
                    {b.icon}
                  </div>
                  <h3 className="text-lg font-bold text-white mb-2">{b.title}</h3>
                  <p className="text-white/70 text-[15px] leading-relaxed font-body">{b.desc}</p>
                </div>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>
      </section>

      {/* Purchase Flow */}
      <section className="relative py-20" aria-labelledby="flow-heading">
        <div className="container mx-auto px-6 sm:px-8 lg:px-10">
          <AnimatedSection className="text-center mb-16">
            <h2 id="flow-heading" className="text-display text-white mb-4">
              Purchase Flow
            </h2>
            <p className="text-white/70 text-[15px] max-w-xl mx-auto font-body leading-relaxed">
              Five steps from onboarding to ESG reporting. Standard corporate workflow, powered by blockchain.
            </p>
          </AnimatedSection>
          <StaggerContainer className="max-w-3xl mx-auto space-y-4" staggerDelay={0.1}>
            {purchaseSteps.map((step) => (
              <StaggerItem key={step.num}>
                <div className="flex items-start gap-5 p-5 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                  <div className="w-10 h-10 rounded-lg bg-emerald-500/10 text-emerald-400 font-bold font-data flex items-center justify-center shrink-0">
                    {step.num}
                  </div>
                  <div>
                    <h3 className="text-white font-semibold text-sm mb-1">{step.title}</h3>
                    <p className="text-white/70 text-[15px] font-body leading-relaxed">{step.desc}</p>
                  </div>
                </div>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>
      </section>

      {/* Compliance & Reporting */}
      <section className="relative py-16 sm:py-20 lg:py-24 bg-midnight-900/30" aria-labelledby="compliance-heading">
        <div className="container mx-auto px-6 sm:px-8 lg:px-10">
          <AnimatedSection className="text-center mb-16">
            <h2 id="compliance-heading" className="text-display text-white mb-4">
              Compliance &amp; Reporting
            </h2>
            <p className="text-white/70 text-[15px] max-w-2xl mx-auto font-body leading-relaxed">
              Built-in compliance tools that satisfy institutional audit requirements and align with global ESG reporting frameworks.
            </p>
          </AnimatedSection>

          <StaggerContainer className="grid md:grid-cols-2 gap-5 max-w-4xl mx-auto" staggerDelay={0.1}>
            {[
              {
                title: "IFRS S2 Climate Disclosure",
                desc: "Auto-generated reports aligned with IFRS Sustainability Disclosure Standards for climate-related financial reporting to regulators and investors.",
              },
              {
                title: "GHG Protocol Scope 3",
                desc: "Automated mapping of retired credits to Scope 3 emission categories with full audit trail from sensor data through verification to retirement.",
              },
              {
                title: "Cryptographic Retirement Certificates",
                desc: "On-chain retirement receipts with immutable timestamps, transaction hashes, and facility provenance that satisfy third-party auditor requirements.",
              },
              {
                title: "ADGM Regulatory Alignment",
                desc: "Platform architecture designed for Abu Dhabi Global Market compliance, including KYC/AML via Sumsub, UAE data residency, and institutional custody standards.",
              },
            ].map((item) => (
              <StaggerItem key={item.title}>
                <div className="h-full p-6 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:border-white/10 transition-colors">
                  <h3 className="text-lg font-bold text-white mb-2">{item.title}</h3>
                  <p className="text-white/70 text-[15px] leading-relaxed font-body">{item.desc}</p>
                </div>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>
      </section>

      {/* Contact form */}
      <section id="contact" className="relative py-20 bg-midnight-900/30" aria-labelledby="contact-heading">
        <div className="container mx-auto px-6 sm:px-8 lg:px-10">
          <div className="max-w-2xl mx-auto">
            <AnimatedSection className="text-center mb-12">
              <h2 id="contact-heading" className="text-display text-white mb-4">Book a Demo</h2>
              <p className="text-white/70 text-[15px] font-body leading-relaxed">
                Schedule a personalized walkthrough of the TerraQura platform with our enterprise team.
              </p>
            </AnimatedSection>
            <AnimatedSection delay={0.2}>
              <div className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <input type="text" placeholder="First name" className="w-full px-4 py-3.5 bg-white/[0.03] border border-white/[0.08] rounded-lg text-white font-body text-sm placeholder-white/40 focus:outline-none focus:border-emerald-500/30 transition-colors" aria-label="First name" />
                  <input type="text" placeholder="Last name" className="w-full px-4 py-3.5 bg-white/[0.03] border border-white/[0.08] rounded-lg text-white font-body text-sm placeholder-white/40 focus:outline-none focus:border-emerald-500/30 transition-colors" aria-label="Last name" />
                </div>
                <input type="email" placeholder="Work email" className="w-full px-4 py-3.5 bg-white/[0.03] border border-white/[0.08] rounded-lg text-white font-body text-sm placeholder-white/40 focus:outline-none focus:border-emerald-500/30 transition-colors" aria-label="Work email" />
                <input type="text" placeholder="Company name" className="w-full px-4 py-3.5 bg-white/[0.03] border border-white/[0.08] rounded-lg text-white font-body text-sm placeholder-white/40 focus:outline-none focus:border-emerald-500/30 transition-colors" aria-label="Company name" />
                <textarea placeholder="Tell us about your carbon offset needs..." rows={4} className="w-full px-4 py-3.5 bg-white/[0.03] border border-white/[0.08] rounded-lg text-white font-body text-sm placeholder-white/40 focus:outline-none focus:border-emerald-500/30 transition-colors resize-none" aria-label="Message" />
                <button className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg transition-colors text-sm">
                  Request Demo
                </button>
              </div>
            </AnimatedSection>
          </div>
        </div>
      </section>
    </>
  );
}
