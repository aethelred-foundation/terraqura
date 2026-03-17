"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { AnimatedSection, StaggerContainer, StaggerItem } from "@/components/shared/AnimatedSection";
import { SimulateMint } from "@/components/technology/SimulateMint";

const architectureLayers = [
  {
    title: "User Layer",
    items: ["Web Dashboard", "Enterprise API", "SDK Integration"],
    color: "emerald",
  },
  {
    title: "Application Layer",
    items: ["Next.js Frontend", "Fastify Backend", "BullMQ Workers"],
    color: "cyan",
  },
  {
    title: "Verification Layer",
    items: ["Proof-of-Physics Engine", "NativeIoT Oracle", "Satellite Imagery Verification"],
    color: "blue",
  },
  {
    title: "Blockchain Layer",
    items: ["Aethelred Sovereign Chain", "ERC-1155 Tokens", "UUPS Proxy Contracts"],
    color: "emerald",
  },
  {
    title: "Data Layer",
    items: ["TimescaleDB", "IPFS Storage", "The Graph Indexer"],
    color: "cyan",
  },
];

const smartContracts = [
  { name: "NativeIoTOracle", addr: "0x...Oracle", desc: "1st-party sovereign IoT oracle" },
  { name: "TerraQuraAccessControl", addr: "0x5569...B83b", desc: "Role-based access control" },
  { name: "VerificationEngine", addr: "0x8dad...dEA8", desc: "Proof-of-Physics validation" },
  { name: "CarbonCredit (ERC-1155)", addr: "0x29B5...F959", desc: "Carbon credit token" },
  { name: "CarbonMarketplace", addr: "0x5a4c...2Fdec", desc: "Peer-to-peer trading" },
  { name: "GaslessMarketplace", addr: "0x45a6...dA80", desc: "Meta-transaction marketplace" },
  { name: "TerraQuraMultisig", addr: "0x0805...5bAD", desc: "3-of-5 governance" },
  { name: "TerraQuraTimelock", addr: "0xb8b0...6354", desc: "Upgrade timelock" },
  { name: "TerraQuraForwarder", addr: "0x...ERC2771", desc: "Gasless transaction relay" },
];

export function TechnologyContent() {
  return (
    <>
      {/* Hero */}
      <section className="relative py-16 sm:py-20 lg:py-24" aria-labelledby="tech-heading">
        <div className="absolute inset-0 bg-dot-grid opacity-30 pointer-events-none" aria-hidden="true" />
        <div className="container mx-auto px-6 sm:px-8 lg:px-10 relative z-10">
          <AnimatedSection className="text-center max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 mb-6">
              <span className="text-emerald-400/70 text-sm font-data">AETHELRED PROTOCOL</span>
            </div>
            <h1 id="tech-heading" className="text-display-lg lg:text-display-xl text-white mb-6">
              The Aethelred Protocol &
              <br />
              <span className="text-gradient-emerald">Proof-of-Physics Engine</span>
            </h1>
            <p className="text-lg text-white/70 max-w-3xl mx-auto font-body leading-relaxed mb-10">
              We don&apos;t sell carbon credits. We are engineering mathematical truth. The
              Aethelred Protocol is our sovereign blockchain infrastructure purpose-built
              for carbon verification, powering a Proof-of-Physics engine that cross-references
              real-time IoT sensor data against thermodynamic models, satellite imagery,
              and on-chain attestation. Every claim is validated against physical
              constraints before a single token is minted on{' '}<span className="whitespace-nowrap">the Aethelred chain.</span>
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="#simulate"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 text-base font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl transition-all shadow-lg shadow-emerald-600/20"
              >
                Simulate a Mint
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/explorer"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 text-base font-semibold text-white/80 border border-white/10 hover:border-white/20 rounded-xl transition-all"
              >
                View Smart Contracts
              </Link>
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* Three-step lifecycle */}
      <section className="relative py-20 bg-midnight-900/30" aria-labelledby="lifecycle-heading">
        <div className="container mx-auto px-6 sm:px-8 lg:px-10">
          <AnimatedSection className="text-center mb-16">
            <h2 id="lifecycle-heading" className="text-display text-white mb-4">
              Three-Phase Lifecycle
            </h2>
            <p className="text-white/70 max-w-2xl mx-auto font-body leading-relaxed">
              From atmospheric capture to on-chain Aethelred token, every step is auditable and immutable.
            </p>
          </AnimatedSection>

          <StaggerContainer className="grid lg:grid-cols-3 gap-6 max-w-5xl mx-auto" staggerDelay={0.15}>
            <StaggerItem>
              <LifecycleCard
                num="01"
                title="Capture"
                subtitle="IoT Sensor Stream"
                desc="DAC units will be equipped with industrial IoT sensors that stream energy consumption, CO₂ flow rates, and ambient conditions in real-time to our sovereign NativeIoT Oracle."
                color="cyan"
              />
            </StaggerItem>
            <StaggerItem>
              <LifecycleCard
                num="02"
                title="Compute"
                subtitle="EfficiencyCalculator"
                desc="The Aethelred on-chain EfficiencyCalculator validates energy-to-carbon ratios. Only readings within 200-600 kWh/tonne will pass. Duplicate data hashes are rejected. Physics cannot be faked."
                color="emerald"
              />
            </StaggerItem>
            <StaggerItem>
              <LifecycleCard
                num="03"
                title="Mint"
                subtitle="ERC-1155 Issuance"
                desc="Verified capture events mint ERC-1155 tokens on the Aethelred sovereign chain with full provenance metadata, satellite CID verification, and facility attribution. 1 token = 1 tonne of verified CO2 removal."
                color="blue"
              />
            </StaggerItem>
          </StaggerContainer>
        </div>
      </section>

      {/* Simulate a Mint - the "Unfair Advantage" */}
      <section className="relative py-16 sm:py-20 lg:py-24" aria-labelledby="simulator-heading">
        <div className="container mx-auto px-6 sm:px-8 lg:px-10">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-start max-w-6xl mx-auto">
            <AnimatedSection direction="left">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 mb-6">
                <span className="text-emerald-400 text-sm font-data">INTERACTIVE</span>
              </div>
              <h2 id="simulator-heading" className="text-display text-white mb-6">
                Try It Yourself:
                <br />
                <span className="text-gradient-emerald">Simulate a Mint</span>
              </h2>
              <p className="text-white/70 font-body mb-6 leading-relaxed">
                Enter an energy reading and CO2 capture amount. If the physics are impossible,
                the verification engine will reject it. If the data is valid, watch a simulated
                ERC-1155 token get minted.
              </p>
              <p className="text-white/70 font-body text-[15px] leading-relaxed">
                This is the core innovation that makes TerraQura credits unforgeable. Legacy registries
                accept self-reported PDFs. We demand mathematical proof that the claimed carbon capture
                is thermodynamically possible.
              </p>
              <div className="mt-8 p-4 rounded-lg bg-white/[0.02] border border-white/[0.06]">
                <p className="text-white/70 text-xs font-data uppercase tracking-wider mb-2">Hint</p>
                <p className="text-white/70 text-sm font-body leading-relaxed">
                  Try <span className="text-cyan-400 font-data">400 kWh + 1 tonne</span> for a valid result, or <span className="text-red-400 font-data">1 kWh + 100 tonnes</span> for a physics violation.
                </p>
              </div>
            </AnimatedSection>

            <AnimatedSection direction="right" delay={0.2}>
              <SimulateMint />
            </AnimatedSection>
          </div>
        </div>
      </section>

      {/* Enterprise Architecture */}
      <section className="relative py-20 bg-midnight-900/30" aria-labelledby="arch-heading">
        <div className="container mx-auto px-6 sm:px-8 lg:px-10">
          <AnimatedSection className="text-center mb-16">
            <h2 id="arch-heading" className="text-display text-white mb-4">
              Aethelred Architecture
            </h2>
            <p className="text-white/70 max-w-4xl mx-auto font-body leading-relaxed">
              Five-layer Aethelred Protocol architecture designed for institutional reliability, security, and scalability.
            </p>
          </AnimatedSection>

          <AnimatedSection delay={0.2} className="max-w-5xl mx-auto space-y-4">
            {architectureLayers.map((layer, i) => (
              <div key={layer.title} className="flex items-center gap-5">
                <span className="text-white/30 font-data text-sm w-10 text-right shrink-0 font-semibold">{`L${i + 1}`}</span>
                <div className={`flex-1 p-5 sm:p-6 rounded-xl border ${
                  layer.color === "emerald" ? "border-emerald-500/10 bg-emerald-500/[0.03]" :
                  layer.color === "cyan" ? "border-cyan-500/10 bg-cyan-500/[0.03]" :
                  "border-blue-500/10 bg-blue-500/[0.03]"
                }`}>
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <span className={`text-base font-semibold ${
                      layer.color === "emerald" ? "text-emerald-400/80" :
                      layer.color === "cyan" ? "text-cyan-400/80" :
                      "text-blue-400/80"
                    }`}>{layer.title}</span>
                    <div className="flex flex-wrap gap-2.5">
                      {layer.items.map((item) => (
                        <span key={item} className="px-3 py-1.5 rounded-md bg-white/[0.05] text-white/70 text-sm font-data">
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </AnimatedSection>
        </div>
      </section>

      {/* Security & Governance */}
      <section className="relative py-16 sm:py-20 lg:py-24" aria-labelledby="security-heading">
        <div className="container mx-auto px-6 sm:px-8 lg:px-10">
          <AnimatedSection className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 mb-6">
              <span className="text-cyan-400/70 text-sm font-data">SECURITY</span>
            </div>
            <h2 id="security-heading" className="text-display text-white mb-4">
              Security &amp; Governance
            </h2>
            <p className="text-white/70 max-w-2xl mx-auto font-body leading-relaxed">
              Enterprise-grade security architecture with multi-layered governance controls protecting every protocol operation.
            </p>
          </AnimatedSection>

          <StaggerContainer className="grid md:grid-cols-2 lg:grid-cols-3 gap-5 max-w-5xl mx-auto" staggerDelay={0.08}>
            {[
              {
                title: "UUPS Proxy Pattern",
                desc: "Upgradeable smart contracts following OpenZeppelin UUPS standard with transparent proxy architecture for safe, auditable protocol evolution.",
                color: "emerald",
              },
              {
                title: "Multi-Signature Governance",
                desc: "3-of-5 multi-sig wallet controls all critical protocol operations. No single key can execute upgrades, parameter changes, or treasury movements.",
                color: "cyan",
              },
              {
                title: "Timelock Delays",
                desc: "All governance actions pass through a mandatory timelock contract, giving stakeholders visibility and time to respond before changes take effect.",
                color: "blue",
              },
              {
                title: "Circuit Breakers",
                desc: "Automated pause mechanisms halt minting and trading if anomalous activity is detected, protecting the protocol from oracle failures or attacks.",
                color: "emerald",
              },
              {
                title: "Role-Based Access Control",
                desc: "Granular permission system separates operator, verifier, admin, and marketplace roles. Principle of least privilege enforced at the contract level.",
                color: "cyan",
              },
              {
                title: "Tier-1 Security Audit",
                desc: "Full audit by a leading blockchain security firm planned before mainnet launch. All findings will be published publicly for complete transparency.",
                color: "blue",
              },
            ].map((item) => (
              <StaggerItem key={item.title}>
                <div className="h-full p-6 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:border-white/10 transition-colors">
                  <div className={`w-2 h-2 rounded-full mb-4 ${
                    item.color === "emerald" ? "bg-emerald-500" :
                    item.color === "cyan" ? "bg-cyan-500" :
                    "bg-blue-500"
                  }`} />
                  <h3 className="text-lg font-bold text-white mb-2">{item.title}</h3>
                  <p className="text-white/70 text-[15px] leading-relaxed font-body">{item.desc}</p>
                </div>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>
      </section>

      {/* Smart Contract Directory */}
      <section className="relative py-20" aria-labelledby="contracts-heading">
        <div className="container mx-auto px-6 sm:px-8 lg:px-10">
          <AnimatedSection className="text-center mb-16">
            <h2 id="contracts-heading" className="text-display text-white mb-4">
              Verified Contracts
            </h2>
            <p className="text-white/70 max-w-xl mx-auto font-body leading-relaxed">
              All smart contracts are publicly verified on the Aethelred Explorer. Transparency is the ultimate credential.
            </p>
            <p className="text-white/55 text-sm font-data mt-4 uppercase tracking-wider">
              Network: Aethelred Sovereign Chain
            </p>
          </AnimatedSection>

          <StaggerContainer className="max-w-4xl mx-auto space-y-2" staggerDelay={0.05}>
            {smartContracts.map((contract) => (
              <StaggerItem key={contract.name}>
                <div className="flex items-center gap-4 p-4 rounded-lg bg-white/[0.02] border border-white/[0.06] hover:border-white/10 transition-colors">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="text-white/80 font-semibold text-sm">{contract.name}</span>
                    <span className="text-white/55 mx-2 hidden sm:inline">&middot;</span>
                    <span className="text-white/70 text-sm font-body hidden sm:inline">{contract.desc}</span>
                  </div>
                  <span className="text-emerald-400/60 text-xs font-data shrink-0">{contract.addr}</span>
                </div>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>
      </section>
    </>
  );
}

function LifecycleCard({
  num,
  title,
  subtitle,
  desc,
  color,
}: {
  num: string;
  title: string;
  subtitle: string;
  desc: string;
  color: string;
}) {
  return (
    <div className="relative h-full p-8 rounded-2xl bg-white/[0.02] border border-white/[0.06] hover:border-white/10 transition-all duration-300 group">
      <span className={`text-5xl font-bold font-data ${
        color === "cyan" ? "text-cyan-500/15" :
        color === "emerald" ? "text-emerald-500/15" :
        "text-blue-500/15"
      }`}>{num}</span>
      <h3 className="text-2xl font-bold text-white mt-4 mb-1">{title}</h3>
      <p className={`text-sm font-data uppercase tracking-wider mb-4 ${
        color === "cyan" ? "text-cyan-400/50" :
        color === "emerald" ? "text-emerald-400/50" :
        "text-blue-400/50"
      }`}>{subtitle}</p>
      <p className="text-white/70 text-[15px] leading-relaxed font-body">{desc}</p>
    </div>
  );
}
