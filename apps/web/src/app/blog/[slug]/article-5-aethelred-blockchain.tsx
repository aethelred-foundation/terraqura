"use client";

import Link from "next/link";
import { AnimatedSection } from "@/components/shared/AnimatedSection";

function MetricCard({ value, label }: { value: string; label: string }) {
  return (
    <div className="p-5 rounded-xl bg-white/[0.02] border border-white/[0.06] text-center">
      <div className="text-2xl font-bold text-emerald-400 mb-1">{value}</div>
      <div className="text-xs text-white/50 font-body">{label}</div>
    </div>
  );
}

function TableOfContents() {
  return (
    <nav className="p-5 rounded-xl bg-white/[0.02] border border-white/[0.06] mb-10" aria-label="Table of contents">
      <h2 className="text-sm font-bold text-white/80 uppercase tracking-wider mb-3">Contents</h2>
      <ul className="space-y-2 text-sm font-body">
        <li><a href="#why-sovereign" className="text-emerald-400 hover:text-emerald-300 transition-colors">Why Build a Sovereign Chain?</a></li>
        <li><a href="#design-principles" className="text-emerald-400 hover:text-emerald-300 transition-colors">Design Principles</a></li>
        <li><a href="#architecture" className="text-emerald-400 hover:text-emerald-300 transition-colors">Architecture Overview</a></li>
        <li><a href="#consensus" className="text-emerald-400 hover:text-emerald-300 transition-colors">Consensus Mechanism</a></li>
        <li><a href="#evm-compatibility" className="text-emerald-400 hover:text-emerald-300 transition-colors">EVM Compatibility</a></li>
        <li><a href="#specs-comparison" className="text-emerald-400 hover:text-emerald-300 transition-colors">Specifications Comparison</a></li>
        <li><a href="#governance" className="text-emerald-400 hover:text-emerald-300 transition-colors">Governance Model</a></li>
        <li><a href="#identity" className="text-emerald-400 hover:text-emerald-300 transition-colors">Identity and Compliance</a></li>
        <li><a href="#roadmap" className="text-emerald-400 hover:text-emerald-300 transition-colors">Deployment Roadmap</a></li>
        <li><a href="#conclusion" className="text-emerald-400 hover:text-emerald-300 transition-colors">Conclusion</a></li>
      </ul>
    </nav>
  );
}

export function Article5Content() {
  return (
    <>
      {/* Hero */}
      <section className="relative py-16 sm:py-20 lg:py-24" aria-labelledby="article-heading">
        <div className="container mx-auto px-6 sm:px-8 lg:px-10 max-w-4xl">
          <AnimatedSection>
            <div className="mb-6 flex items-center gap-3">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-medium border bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                Technology
              </span>
              <span className="text-sm text-white/40 font-body">15 min read</span>
              <span className="text-sm text-white/40 font-body">February 12, 2026</span>
            </div>
            <h1 id="article-heading" className="text-display-lg lg:text-display-xl text-white mb-6 leading-tight">
              Aethelred: Building a Sovereign Blockchain for Carbon Verification
            </h1>
            <p className="text-lg text-white/70 font-body leading-relaxed mb-8">
              Why did TerraQura build its own sovereign chain? We detail the architectural decisions behind
              Aethelred, our EVM-compatible blockchain purpose-built for institutional carbon verification.
            </p>
            <div className="flex items-center gap-3 pb-8 border-b border-white/[0.06]">
              <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <span className="text-emerald-400 text-sm font-bold">TR</span>
              </div>
              <div>
                <div className="text-sm text-white font-medium">TerraQura Research</div>
                <div className="text-xs text-white/40 font-body">Carbon Verification &amp; Blockchain Infrastructure</div>
              </div>
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* Content */}
      <section className="relative pb-16 sm:pb-20 lg:pb-24">
        <div className="container mx-auto px-6 sm:px-8 lg:px-10 max-w-4xl">
          <TableOfContents />

          <div className="prose-custom">
            <h2 id="why-sovereign" className="text-2xl font-bold text-white mt-12 mb-4">
              Why Build a Sovereign Chain?
            </h2>
            <p className="text-white/70 font-body leading-relaxed mb-4">
              The question we are asked most frequently is: why not just deploy on Ethereum, or Polygon, or any of the
              existing Layer 2 networks? It is a fair question. The Ethereum ecosystem offers mature tooling, a large
              developer community, and established security guarantees. Polygon provides low-cost transactions and
              reasonable throughput. Building a new chain is expensive and time-consuming. The decision was not made lightly.
            </p>
            <p className="text-white/70 font-body leading-relaxed mb-4">
              The answer comes down to three requirements that public chains cannot satisfy for institutional carbon
              markets: governance sovereignty, performance predictability, and regulatory compliance at the protocol level.
            </p>
            <p className="text-white/70 font-body leading-relaxed mb-4">
              Governance sovereignty means that the rules governing carbon credit issuance, transfer, and retirement are
              controlled by stakeholders in the carbon market, not by anonymous token holders voting in an Ethereum
              Improvement Proposal process or a Polygon governance forum. When a sovereign wealth fund is committing hundreds
              of millions of dollars to carbon credit portfolios, it needs assurance that the rules will not change overnight
              because a DeFi governance proposal passed with $50 million in token-weighted votes.
            </p>
            <p className="text-white/70 font-body leading-relaxed mb-4">
              Performance predictability means that transaction costs and confirmation times are stable and known in advance.
              Public chains experience gas price volatility that can make per-tonne verification costs range from $0.10 to
              $50.00 depending on network congestion. Carbon credit settlement cannot operate with that level of cost
              uncertainty.
            </p>
            <p className="text-white/70 font-body leading-relaxed mb-6">
              Regulatory compliance means that KYC/AML verification, sanctions screening, and transaction monitoring can be
              enforced at the protocol level rather than bolted on as application-layer workarounds. Institutional carbon
              markets operate under the same financial regulatory frameworks as other commodity markets, and the underlying
              infrastructure must be compatible with these requirements.
            </p>

            <h2 id="design-principles" className="text-2xl font-bold text-white mt-12 mb-4">
              Design Principles
            </h2>
            <p className="text-white/70 font-body leading-relaxed mb-4">
              Aethelred was designed around five core principles, each derived from the specific requirements of institutional
              carbon verification and trading.
            </p>
            <div className="my-8 space-y-4">
              {[
                { title: "Physics-First Architecture", desc: "The chain is optimized for the specific data patterns of carbon verification: high-frequency sensor data ingestion, batch verification computations, and tokenization events. Block structure, gas metering, and state management are tuned for these workloads." },
                { title: "Institutional-Grade Governance", desc: "Validator selection, protocol upgrades, and parameter changes are governed by a transparent process involving identified institutional stakeholders. No anonymous governance. No token-weighted voting that can be captured by whale wallets." },
                { title: "Regulatory Compatibility", desc: "KYC-verified identity is a first-class primitive. Transaction visibility supports compliance monitoring. The chain can implement jurisdiction-specific rules (sanctions lists, transfer restrictions) at the consensus layer." },
                { title: "EVM Compatibility", desc: "Full compatibility with the Ethereum Virtual Machine, allowing Solidity smart contracts to deploy without modification. This preserves access to the Ethereum development ecosystem while providing sovereign chain benefits." },
                { title: "Bridge-Native Design", desc: "Interoperability with Ethereum, Polygon, and other EVM chains is built into the protocol from genesis, not added as an afterthought. Credits minted on Aethelred can be bridged to public chains for DeFi integration." },
              ].map((item) => (
                <div key={item.title} className="p-5 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                  <h3 className="text-white font-bold text-sm mb-2">{item.title}</h3>
                  <p className="text-white/60 font-body text-sm leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>

            <h2 id="architecture" className="text-2xl font-bold text-white mt-12 mb-4">
              Architecture Overview
            </h2>
            <p className="text-white/70 font-body leading-relaxed mb-4">
              Aethelred is built on a modified proof-of-authority (PoA) consensus layer with an EVM-compatible execution
              environment. The architecture consists of four primary layers: the networking layer handles peer-to-peer
              communication between validator nodes using libp2p; the consensus layer implements a Byzantine Fault Tolerant
              (BFT) consensus protocol with deterministic finality; the execution layer runs an EVM-compatible virtual machine
              for smart contract execution; and the data availability layer manages state storage and historical data
              availability for verification proofs.
            </p>
            <p className="text-white/70 font-body leading-relaxed mb-6">
              A key architectural decision was the separation of verification data ingestion from general-purpose smart
              contract execution. Sensor data is ingested through a dedicated high-throughput data channel that bypasses
              the normal transaction mempool, ensuring that verification data flow is not affected by marketplace activity
              or other contract interactions. This data is validated at the consensus layer and made available to the
              verification smart contracts through specialized precompiled contracts that provide efficient access to
              time-series sensor data.
            </p>

            {/* Architecture diagram */}
            <div className="my-8 p-6 rounded-xl bg-white/[0.02] border border-white/[0.06]">
              <div className="text-sm font-bold text-white/80 mb-4 uppercase tracking-wider">Aethelred Layer Architecture</div>
              <div className="space-y-3">
                {[
                  { layer: "Layer 4", name: "Application", items: "Carbon Marketplace | Credit Manager | Bridge Interface", color: "border-emerald-500/30 bg-emerald-500/[0.05]" },
                  { layer: "Layer 3", name: "Smart Contracts", items: "ERC-1155 Credits | Verification Engine | Access Control | Gasless Forwarder", color: "border-cyan-500/30 bg-cyan-500/[0.05]" },
                  { layer: "Layer 2", name: "Execution", items: "EVM Runtime | Precompiled Contracts | State Management | Gas Metering", color: "border-amber-500/30 bg-amber-500/[0.05]" },
                  { layer: "Layer 1", name: "Consensus", items: "BFT Consensus | Validator Management | Data Ingestion Channel | Finality", color: "border-purple-500/30 bg-purple-500/[0.05]" },
                  { layer: "Layer 0", name: "Network", items: "libp2p Networking | Peer Discovery | Block Propagation | Gossip Protocol", color: "border-white/10 bg-white/[0.02]" },
                ].map((l) => (
                  <div key={l.layer} className={`p-4 rounded-lg border ${l.color}`}>
                    <div className="flex items-center gap-3 mb-1">
                      <span className="text-xs text-white/40 font-mono">{l.layer}</span>
                      <span className="text-sm font-bold text-white">{l.name}</span>
                    </div>
                    <span className="text-xs text-white/50 font-body">{l.items}</span>
                  </div>
                ))}
              </div>
            </div>

            <h2 id="consensus" className="text-2xl font-bold text-white mt-12 mb-4">
              Consensus Mechanism
            </h2>
            <p className="text-white/70 font-body leading-relaxed mb-4">
              Aethelred uses a modified Istanbul Byzantine Fault Tolerant (IBFT) 2.0 consensus protocol. IBFT provides
              deterministic finality (once a block is committed, it is final and cannot be reverted), which is essential for
              carbon credit settlement. In contrast, probabilistic finality chains like Ethereum require waiting for multiple
              block confirmations, introducing latency and the theoretical possibility of chain reorganizations.
            </p>
            <p className="text-white/70 font-body leading-relaxed mb-4">
              The validator set is permissioned, consisting of identified institutional nodes operated by entities with a
              direct stake in carbon market integrity: verification bodies, large facility operators, institutional investors,
              and regulatory observers. Validator addition and removal follows a governance process requiring supermajority
              approval from existing validators. This permissioned model sacrifices the censorship resistance of public PoS
              systems but provides the accountability and governance stability that institutional participants require.
            </p>
            <p className="text-white/70 font-body leading-relaxed mb-6">
              The protocol tolerates up to f = (n-1)/3 Byzantine validators, where n is the total validator count. With a
              target validator set of 21 nodes, the network can tolerate up to 6 malicious or offline validators while
              maintaining liveness and safety.
            </p>

            <h2 id="evm-compatibility" className="text-2xl font-bold text-white mt-12 mb-4">
              EVM Compatibility
            </h2>
            <p className="text-white/70 font-body leading-relaxed mb-4">
              Full EVM compatibility was a non-negotiable design requirement. The Ethereum ecosystem represents the
              largest smart contract development community in the world, with mature tooling (Hardhat, Foundry, OpenZeppelin),
              extensive auditing expertise, and a deep talent pool. Building on a non-EVM execution environment would
              have required developing all of this infrastructure from scratch.
            </p>
            <p className="text-white/70 font-body leading-relaxed mb-4">
              Aethelred supports all standard EVM opcodes and precompiled contracts, plus a set of carbon-specific
              precompiled contracts that provide efficient access to verification data, sensor time-series queries, and
              batch validation operations. These precompiles are accessible from standard Solidity contracts using standard
              call interfaces, meaning developers do not need to learn new paradigms to interact with carbon-specific
              functionality.
            </p>
            <p className="text-white/70 font-body leading-relaxed mb-6">
              This compatibility means that TerraQura&apos;s smart contracts, now deployed on the Aethelred testnet,
              leverage the full EVM toolchain without modification. It also means that third-party developers
              can build on Aethelred using familiar tools and languages, lowering the barrier to ecosystem development.
            </p>

            {/* Specs comparison table */}
            <h2 id="specs-comparison" className="text-2xl font-bold text-white mt-12 mb-4">
              Specifications Comparison
            </h2>

            <div className="my-8 overflow-x-auto">
              <table className="w-full text-sm font-body">
                <thead>
                  <tr className="border-b border-white/[0.1]">
                    <th className="text-left py-3 px-4 text-white/80 font-bold">Specification</th>
                    <th className="text-left py-3 px-4 text-white/80 font-bold">Ethereum L1</th>
                    <th className="text-left py-3 px-4 text-white/80 font-bold">Polygon PoS</th>
                    <th className="text-left py-3 px-4 text-emerald-400 font-bold">Aethelred</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["Consensus", "Gasper (PoS)", "PoS + Heimdall/Bor", "IBFT 2.0 (PoA)"],
                    ["Throughput (TPS)", "~15-30", "~65-100", "~2,000+ (target)"],
                    ["Block Time", "12 seconds", "2 seconds", "2 seconds"],
                    ["Finality", "~15 minutes (probabilistic)", "~4 minutes", "Instant (deterministic)"],
                    ["Transaction Cost", "$0.50-$50+ (variable)", "$0.01-$0.10", "< $0.01 (stable)"],
                    ["Validator Set", "~900,000+ (open)", "~100 (semi-open)", "21 (permissioned)"],
                    ["EVM Compatible", "Native", "Yes", "Yes + carbon precompiles"],
                    ["Governance", "EIP process (open)", "Foundation-led", "Institutional validator council"],
                    ["Identity Layer", "Pseudonymous", "Pseudonymous", "KYC-verified (selective disclosure)"],
                    ["Data Availability", "On-chain (expensive)", "On-chain + checkpoints", "Dedicated DA layer"],
                    ["Carbon-Specific Features", "None", "None", "Sensor data ingestion, verification precompiles"],
                  ].map(([spec, eth, poly, aeth], i) => (
                    <tr key={spec} className={`border-b border-white/[0.06] ${i % 2 === 0 ? "bg-white/[0.01]" : ""}`}>
                      <td className="py-3 px-4 text-white/80 font-medium">{spec}</td>
                      <td className="py-3 px-4 text-white/50">{eth}</td>
                      <td className="py-3 px-4 text-white/50">{poly}</td>
                      <td className="py-3 px-4 text-emerald-400/80">{aeth}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h2 id="governance" className="text-2xl font-bold text-white mt-12 mb-4">
              Governance Model
            </h2>
            <p className="text-white/70 font-body leading-relaxed mb-4">
              Aethelred&apos;s governance model is designed for institutional stakeholders who require predictability, transparency,
              and accountability. The governance structure has three tiers: a Validator Council that manages day-to-day protocol
              operations and parameter adjustments, a Technical Committee that reviews and approves protocol upgrades, and a
              Stakeholder Assembly that provides strategic direction and approves major changes to the governance rules themselves.
            </p>
            <p className="text-white/70 font-body leading-relaxed mb-4">
              Protocol changes follow a structured process: proposal submission with technical specification, a 30-day public
              comment period, Technical Committee review and recommendation, and Validator Council vote (requiring two-thirds
              supermajority for approval). Emergency patches for security vulnerabilities can bypass the comment period but
              still require supermajority validator approval.
            </p>
            <p className="text-white/70 font-body leading-relaxed mb-6">
              This governance model intentionally trades the censorship resistance and permissionlessness of public chain
              governance for the stability and accountability that institutional users demand. We believe this trade-off
              is appropriate for carbon market infrastructure, which operates in a regulated environment where participant
              identity and governance accountability are legal requirements.
            </p>

            <h2 id="identity" className="text-2xl font-bold text-white mt-12 mb-4">
              Identity and Compliance
            </h2>
            <p className="text-white/70 font-body leading-relaxed mb-4">
              Aethelred implements a privacy-preserving identity layer based on verifiable credentials. Every address on
              the network is associated with a KYC-verified identity, but the identity details are not stored on-chain.
              Instead, addresses hold verifiable credentials issued by trusted KYC providers (initially Sumsub) that attest
              to the identity of the address holder without revealing personal data on the public ledger.
            </p>
            <p className="text-white/70 font-body leading-relaxed mb-4">
              This approach satisfies regulatory requirements for participant identification while preserving the privacy
              benefits of pseudonymous transactions. Regulatory authorities with appropriate legal authorization can request
              identity disclosure from the KYC providers, but casual observers of the blockchain see only verified addresses,
              not personal information.
            </p>
            <p className="text-white/70 font-body leading-relaxed mb-6">
              Transaction monitoring for sanctions compliance and anti-money-laundering is performed at the consensus layer.
              Transactions involving sanctioned addresses are rejected at the validator level before inclusion in blocks. This
              is a significant departure from public chains, where compliance is typically enforced at the application layer
              (if at all), and represents a conscious design choice for a regulated commodity market.
            </p>

            <h2 id="roadmap" className="text-2xl font-bold text-white mt-12 mb-4">
              Deployment Roadmap
            </h2>
            <p className="text-white/70 font-body leading-relaxed mb-4">
              Aethelred&apos;s deployment follows a phased approach. Currently (Q1 2026), TerraQura&apos;s smart contracts are
              deployed on the Aethelred testnet, validating contract logic and marketplace mechanics. Phase 2 (Q2-Q3 2026)
              focuses on security audits, IoT oracle integration, and institutional onboarding. Phase 3
              (Q4 2026-Q1 2027) will bring the mainnet launch with the first institutional validators and production
              traffic. Phase 4 (2027) will expand to cross-chain bridges, enabling credits minted on Aethelred to be
              tradeable on Ethereum and other EVM-compatible networks.
            </p>
            <p className="text-white/70 font-body leading-relaxed mb-6">
              Throughout this process, backward compatibility is maintained. All credits verified on the Aethelred testnet
              will carry forward to mainnet with full preservation of verification history and metadata.
            </p>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 my-8">
              <MetricCard value="2,000+" label="Target TPS throughput" />
              <MetricCard value="2s" label="Block finality time" />
              <MetricCard value="21" label="Institutional validators" />
              <MetricCard value="< $0.01" label="Per-transaction cost" />
            </div>

            <h2 id="conclusion" className="text-2xl font-bold text-white mt-12 mb-4">
              Conclusion
            </h2>
            <p className="text-white/70 font-body leading-relaxed mb-4">
              Building a sovereign blockchain is not a vanity project. It is a response to specific, unsolvable limitations
              of existing public chains for institutional carbon market infrastructure. Aethelred provides the governance
              sovereignty, performance predictability, and regulatory compatibility that the carbon market requires, while
              maintaining EVM compatibility to leverage the Ethereum ecosystem&apos;s tooling and talent.
            </p>
            <p className="text-white/70 font-body leading-relaxed mb-8">
              The carbon market needs infrastructure that is as reliable, regulated, and accountable as the commodity markets
              it will eventually rival in scale. Aethelred is being built to be that infrastructure. Not a general-purpose
              blockchain with carbon features bolted on, but a purpose-built chain designed from the consensus layer up for
              the specific requirements of verified carbon removal.
            </p>
          </div>

          {/* About blurb */}
          <div className="mt-16 p-6 rounded-xl bg-white/[0.02] border border-white/[0.06]">
            <h3 className="text-sm font-bold text-white/80 uppercase tracking-wider mb-2">About TerraQura</h3>
            <p className="text-sm text-white/60 font-body leading-relaxed">
              TerraQura is building institutional-grade carbon verification infrastructure powered by Proof-of-Physics on the
              Aethelred sovereign blockchain. Founded by Zhyra Holdings in Abu Dhabi, TerraQura provides real-time,
              physics-verified carbon credits for enterprise buyers, DAC operators, and institutional investors.
            </p>
          </div>

          <div className="mt-8">
            <Link href="/blog" className="text-emerald-400 hover:text-emerald-300 transition-colors text-sm font-medium">
              &larr; Back to all articles
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
