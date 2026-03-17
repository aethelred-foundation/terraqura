"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { AnimatedSection, StaggerContainer, StaggerItem } from "@/components/shared/AnimatedSection";

const resources = [
  {
    title: "REST API",
    desc: "Full RESTful API for credit minting, marketplace operations, verification, and gasless transactions. Swagger/OpenAPI documented.",
    tags: ["REST", "JSON", "OpenAPI 3.0"],
    href: "/docs",
    color: "emerald",
  },
  {
    title: "GraphQL API",
    desc: "Query on-chain data via The Graph subgraph indexer. Real-time credit data, facility metrics, and transaction history.",
    tags: ["GraphQL", "The Graph", "Real-time"],
    href: "/docs",
    color: "cyan",
  },
  {
    title: "TypeScript SDK",
    desc: "Enterprise-grade SDK with modules for assets, marketplace, compliance, MRV, checkout, and certificate generation.",
    tags: ["TypeScript", "ESM/CJS", "Webhooks"],
    href: "/docs",
    color: "blue",
  },
  {
    title: "Smart Contracts",
    desc: "ERC-1155 carbon credits, NativeIoT oracle, verification engine, marketplace. All verified on the Aethelred Explorer.",
    tags: ["Solidity", "OpenZeppelin", "UUPS"],
    href: "/explorer",
    color: "emerald",
  },
];

const codeExample = `import { TerraQura } from '@terraqura/sdk';

const client = new TerraQura({
  apiKey: 'tq_test_...',
  network: 'aethelred-testnet',
});

// Query verified carbon credits
const credits = await client.assets.list({
  status: 'active',
  methodology: 'direct-air-capture',
  limit: 10,
});

// Purchase and retire credits
const purchase = await client.checkout.create({
  creditId: credits[0].id,
  quantity: 100, // tonnes CO2
  retireOnPurchase: true,
  retirementNote: 'Q4 2026 offset',
});

console.log(purchase.certificate.url);`;

export function DevelopersContent() {
  return (
    <>
      <section className="relative py-16 sm:py-20 lg:py-24" aria-labelledby="dev-heading">
        <div className="absolute inset-0 bg-dot-grid opacity-20 pointer-events-none" aria-hidden="true" />
        <div className="container mx-auto px-6 sm:px-8 lg:px-10 relative z-10">
          <AnimatedSection className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 mb-6">
              <span className="text-emerald-400/70 text-sm font-data">DEVELOPER PLATFORM</span>
            </div>
            <h1 id="dev-heading" className="text-display-lg lg:text-display-xl text-white mb-6">
              Build on
              <br />
              <span className="text-gradient-emerald">TerraQura</span>
            </h1>
            <p className="text-lg text-white/70 max-w-2xl mx-auto font-body leading-relaxed mb-10">
              REST API, GraphQL, TypeScript SDK, and verified smart contracts.
              Everything you need to integrate carbon credits into your application.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/explorer"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 text-base font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl transition-all shadow-lg shadow-emerald-600/20"
              >
                View Smart Contracts
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

      {/* Resources */}
      <section className="relative py-16 bg-midnight-900/30" aria-labelledby="resources-heading">
        <div className="container mx-auto px-6 sm:px-8 lg:px-10">
          <AnimatedSection className="text-center mb-12">
            <h2 id="resources-heading" className="text-display text-white mb-4">Developer Resources</h2>
          </AnimatedSection>
          <StaggerContainer className="grid md:grid-cols-2 gap-5 max-w-4xl mx-auto" staggerDelay={0.1}>
            {resources.map((r) => (
              <StaggerItem key={r.title}>
                <Link href={r.href} className="block h-full p-6 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:border-white/10 transition-all group">
                  <h3 className="text-lg font-bold text-white mb-2 group-hover:text-emerald-400 transition-colors">{r.title}</h3>
                  <p className="text-white/70 text-[15px] leading-relaxed font-body mb-4">{r.desc}</p>
                  <div className="flex flex-wrap gap-2">
                    {r.tags.map((tag) => (
                      <span key={tag} className={`text-xs font-data uppercase tracking-wider px-2 py-1 rounded-md ${
                        r.color === "emerald" ? "bg-emerald-500/10 text-emerald-400/60" :
                        r.color === "cyan" ? "bg-cyan-500/10 text-cyan-400/60" :
                        "bg-blue-500/10 text-blue-400/60"
                      }`}>{tag}</span>
                    ))}
                  </div>
                </Link>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>
      </section>

      {/* Code Example */}
      <section className="relative py-16" aria-labelledby="quickstart-heading">
        <div className="container mx-auto px-6 sm:px-8 lg:px-10">
          <div className="grid lg:grid-cols-2 gap-12 items-start max-w-6xl mx-auto">
            <AnimatedSection direction="left">
              <h2 id="quickstart-heading" className="text-display text-white mb-6">Quick Start</h2>
              <p className="text-white/70 text-[15px] font-body mb-6 leading-relaxed">
                Install the TerraQura SDK and start querying verified carbon credits in minutes.
                The SDK handles authentication, retries, and type safety out of the box.
              </p>
              <div className="space-y-3">
                <div className="p-3 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                  <p className="text-white/70 text-xs font-data mb-1">Install</p>
                  <code className="text-emerald-400 text-sm font-data">npm install @terraqura/sdk</code>
                </div>
                <div className="p-3 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                  <p className="text-white/70 text-xs font-data mb-1">API Base</p>
                  <code className="text-cyan-400 text-sm font-data">https://api.terraqura.aethelred.network/v1</code>
                  <p className="text-yellow-400/60 text-xs font-data mt-1">COMING Q3 2026</p>
                </div>
              </div>
            </AnimatedSection>

            <AnimatedSection direction="right" delay={0.2}>
              <div className="rounded-xl border border-white/[0.08] overflow-hidden">
                <div className="px-4 py-3 bg-white/[0.03] border-b border-white/[0.06] flex items-center gap-2">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-red-500/50" />
                    <div className="w-3 h-3 rounded-full bg-yellow-500/50" />
                    <div className="w-3 h-3 rounded-full bg-green-500/50" />
                  </div>
                  <span className="text-white/70 text-xs font-data ml-2">example.ts</span>
                </div>
                <pre className="p-5 overflow-x-auto text-xs leading-relaxed">
                  <code className="text-white/60 font-data">{codeExample}</code>
                </pre>
              </div>
            </AnimatedSection>
          </div>
        </div>
      </section>

      {/* Audit section */}
      <section className="relative py-16 bg-midnight-900/30">
        <div className="container mx-auto px-6 sm:px-8 lg:px-10">
          <AnimatedSection className="max-w-2xl mx-auto text-center">
            <h2 className="text-display text-white mb-4">Security Audits</h2>
            <p className="text-white/70 text-[15px] font-body mb-8 leading-relaxed">
              All smart contracts will undergo comprehensive security audits before mainnet deployment.
              Audit reports will be published publicly on this page.
            </p>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="p-5 rounded-xl bg-white/[0.02] border border-white/[0.06] text-center">
                <p className="text-white font-bold mb-1">CertiK</p>
                <p className="text-yellow-400/60 text-xs font-data">SCHEDULED</p>
              </div>
              <div className="p-5 rounded-xl bg-white/[0.02] border border-white/[0.06] text-center">
                <p className="text-white font-bold mb-1">Hacken</p>
                <p className="text-yellow-400/60 text-xs font-data">SCHEDULED</p>
              </div>
            </div>
          </AnimatedSection>
        </div>
      </section>
    </>
  );
}
