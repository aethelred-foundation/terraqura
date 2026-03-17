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
        <li><a href="#double-counting-crisis" className="text-emerald-400 hover:text-emerald-300 transition-colors">The Double-Counting Crisis</a></li>
        <li><a href="#how-double-counting" className="text-emerald-400 hover:text-emerald-300 transition-colors">How Double-Counting Happens</a></li>
        <li><a href="#blockchain-solution" className="text-emerald-400 hover:text-emerald-300 transition-colors">The Blockchain Solution</a></li>
        <li><a href="#immutable-records" className="text-emerald-400 hover:text-emerald-300 transition-colors">Immutable Records and Transparent Ownership</a></li>
        <li><a href="#erc-1155" className="text-emerald-400 hover:text-emerald-300 transition-colors">ERC-1155: The Multi-Token Standard</a></li>
        <li><a href="#credit-lifecycle" className="text-emerald-400 hover:text-emerald-300 transition-colors">Traditional vs Blockchain Credit Lifecycle</a></li>
        <li><a href="#aethelred-benefits" className="text-emerald-400 hover:text-emerald-300 transition-colors">Aethelred Sovereign Chain Benefits</a></li>
        <li><a href="#challenges" className="text-emerald-400 hover:text-emerald-300 transition-colors">Challenges and Considerations</a></li>
        <li><a href="#conclusion" className="text-emerald-400 hover:text-emerald-300 transition-colors">Conclusion</a></li>
      </ul>
    </nav>
  );
}

export function Article3Content() {
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
              <span className="text-sm text-white/40 font-body">11 min read</span>
              <span className="text-sm text-white/40 font-body">February 18, 2026</span>
            </div>
            <h1 id="article-heading" className="text-display-lg lg:text-display-xl text-white mb-6 leading-tight">
              Why Blockchain Matters for Carbon Credits: Solving the Double-Counting Problem
            </h1>
            <p className="text-lg text-white/70 font-body leading-relaxed mb-8">
              Double-counting has undermined billions of dollars in carbon offsets. Blockchain-based registries create an
              immutable, transparent ledger that makes every credit uniquely traceable from creation to retirement.
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
            <h2 id="double-counting-crisis" className="text-2xl font-bold text-white mt-12 mb-4">
              The Double-Counting Crisis
            </h2>
            <p className="text-white/70 font-body leading-relaxed mb-4">
              In September 2023, a comprehensive analysis of Article 6 of the Paris Agreement revealed a systemic problem
              that had been simmering for years: the same emission reduction or carbon removal was being claimed by multiple
              parties simultaneously. A forest conservation project in Southeast Asia might generate credits sold to a
              European corporation, while the host country also counted the same emission reductions toward its Nationally
              Determined Contribution (NDC). The emission reduction happened once. The accounting claimed it happened twice.
            </p>
            <p className="text-white/70 font-body leading-relaxed mb-4">
              This is double-counting, and it comes in three flavors. Double-issuance occurs when the same reduction
              activity is registered with multiple registries, each issuing credits for the same underlying activity. Double-claiming
              occurs when both the host country and the credit buyer count the same reduction (the Article 6 problem).
              Double-use occurs when the same credit is used to offset emissions by more than one entity, typically through
              inadequate retirement tracking.
            </p>
            <p className="text-white/70 font-body leading-relaxed mb-6">
              The scale of the problem is difficult to quantify precisely, but estimates suggest that double-counting affects
              anywhere from 15 to 30 percent of credits in certain project categories. For a market that traded over $2
              billion in volume in 2025, even the lower end of that range represents hundreds of millions of dollars in
              credits that do not represent unique, real-world climate benefits. Beyond the financial impact, double-counting
              directly undermines the environmental integrity of carbon markets. If 100 million tonnes of reductions are
              claimed but only 70 million actually occurred, the atmosphere notices the difference.
            </p>

            <h2 id="how-double-counting" className="text-2xl font-bold text-white mt-12 mb-4">
              How Double-Counting Happens
            </h2>
            <p className="text-white/70 font-body leading-relaxed mb-4">
              The root cause of double-counting is architectural: the carbon market runs on disconnected, siloed registry
              systems with no shared state. Verra, Gold Standard, the American Carbon Registry, and the Climate Action Reserve
              each maintain independent databases. There is no technical mechanism preventing the same project from being
              registered with multiple standards, or the same credit serial number from being retired against multiple offset
              claims in different systems.
            </p>
            <p className="text-white/70 font-body leading-relaxed mb-4">
              Cross-registry reconciliation is performed manually, if at all. When a project developer registers with Verra
              and then registers a similar (or identical) project with another registry, detection depends on human reviewers
              catching the overlap during desk-based assessment. At scale, with thousands of projects across dozens of
              countries, this manual detection is unreliable.
            </p>
            <p className="text-white/70 font-body leading-relaxed mb-6">
              The Corresponding Adjustments mechanism introduced under Article 6.2 of the Paris Agreement was designed to
              address the double-claiming problem by requiring host countries to adjust their national emissions accounts when
              credits are transferred internationally. But implementation has been slow, and the mechanism depends on country-level
              accounting integrity that varies widely across jurisdictions.
            </p>

            <h2 id="blockchain-solution" className="text-2xl font-bold text-white mt-12 mb-4">
              The Blockchain Solution
            </h2>
            <p className="text-white/70 font-body leading-relaxed mb-4">
              Blockchain technology addresses the architectural root cause of double-counting by providing a single, shared,
              immutable ledger that all participants can read and verify. When a carbon credit exists as a token on a blockchain,
              it has exactly one owner at any point in time, enforced not by policy or procedure but by the consensus rules of
              the network. Transferring a token to a new owner means the previous owner no longer has it. Retiring a token
              means it is permanently burned and can never be used again. These properties are not policy choices that can be
              overridden. They are mathematical guarantees enforced by cryptography.
            </p>
            <p className="text-white/70 font-body leading-relaxed mb-4">
              This does not solve all forms of double-counting automatically. Double-issuance (the same physical activity being
              registered as two different tokens) still requires off-chain validation against the physical world. But blockchain
              eliminates double-use by design and provides the transparency infrastructure needed to detect and prevent
              double-issuance through cross-referencing of project metadata, location coordinates, and temporal boundaries.
            </p>
            <p className="text-white/70 font-body leading-relaxed mb-6">
              More broadly, blockchain introduces a property that carbon markets have never had: global, permissionless
              auditability. Anyone can verify the total supply of credits, the ownership history of any individual credit,
              and whether a credit has been retired. This transparency creates market discipline that centralized registries,
              where data access is typically restricted, cannot provide.
            </p>

            <h2 id="immutable-records" className="text-2xl font-bold text-white mt-12 mb-4">
              Immutable Records and Transparent Ownership
            </h2>
            <p className="text-white/70 font-body leading-relaxed mb-4">
              Every carbon credit on the Aethelred blockchain carries an immutable record of its entire lifecycle. When a
              credit is minted, the minting transaction permanently records: the project identifier and location, the
              verification methodology used, the quantity of CO2 represented, the verification confidence score, cryptographic
              hashes of the underlying sensor data, the timestamp and block number of verification, and the initial owner
              (typically the project developer or facility operator).
            </p>
            <p className="text-white/70 font-body leading-relaxed mb-6">
              Every subsequent transfer is recorded as a new transaction, creating an unbroken chain of custody. When a credit
              is retired to offset emissions, the retirement transaction records the retiring entity, the emissions being
              offset, and the retirement timestamp. The credit token is then burned, removing it permanently from circulation.
              This complete lifecycle record is publicly visible to anyone querying the blockchain.
            </p>

            <h2 id="erc-1155" className="text-2xl font-bold text-white mt-12 mb-4">
              ERC-1155: The Multi-Token Standard for Carbon Credits
            </h2>
            <p className="text-white/70 font-body leading-relaxed mb-4">
              TerraQura chose the ERC-1155 multi-token standard for carbon credit tokenization over more common standards like
              ERC-20 (fungible tokens) or ERC-721 (non-fungible tokens). This choice was driven by the unique characteristics
              of carbon credits.
            </p>
            <p className="text-white/70 font-body leading-relaxed mb-4">
              Carbon credits are semi-fungible. Credits from the same project, vintage, and methodology are interchangeable
              with each other (fungible within a class), but credits from different projects or vintages are not equivalent
              (non-fungible across classes). ERC-1155 handles this naturally by supporting multiple token types (each
              representing a specific project-vintage-methodology combination) within a single contract, where tokens of
              the same type are fungible with each other.
            </p>
            <p className="text-white/70 font-body leading-relaxed mb-4">
              ERC-1155 also provides significant gas efficiency advantages. Batch transfers (moving multiple credit types
              in a single transaction) cost roughly 50 to 70 percent less gas than the equivalent operations using separate
              ERC-20 or ERC-721 contracts. For a marketplace handling thousands of transactions per day, this efficiency
              translates directly to lower settlement costs.
            </p>
            <p className="text-white/70 font-body leading-relaxed mb-6">
              Additionally, ERC-1155 supports metadata URIs per token type, allowing each credit class to reference its
              complete verification data on IPFS without bloating the on-chain storage. The token ID encodes the project
              identifier, vintage year, and verification batch, creating a structured identifier space that is both
              human-readable and machine-parseable.
            </p>

            {/* Lifecycle diagram */}
            <h2 id="credit-lifecycle" className="text-2xl font-bold text-white mt-12 mb-4">
              Traditional vs Blockchain Credit Lifecycle
            </h2>

            <div className="my-8 grid md:grid-cols-2 gap-6">
              <div className="p-5 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                <div className="text-sm font-bold text-white/60 mb-4 uppercase tracking-wider">Traditional Registry</div>
                <div className="space-y-3 text-sm font-body">
                  {[
                    { step: "1", text: "Project registered with registry", color: "text-white/40" },
                    { step: "2", text: "Third-party auditor reviews (12-18 months)", color: "text-white/40" },
                    { step: "3", text: "Credits issued to developer account", color: "text-white/40" },
                    { step: "4", text: "Over-the-counter trade (opaque pricing)", color: "text-white/40" },
                    { step: "5", text: "Buyer claims offset (private records)", color: "text-white/40" },
                    { step: "6", text: "Retirement marked in registry database", color: "text-white/40" },
                    { step: "7", text: "No cross-registry reconciliation", color: "text-red-400/60" },
                  ].map((item) => (
                    <div key={item.step} className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-white/[0.06] flex items-center justify-center flex-shrink-0">
                        <span className="text-xs text-white/40">{item.step}</span>
                      </div>
                      <span className={item.color}>{item.text}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="p-5 rounded-xl bg-emerald-500/[0.03] border border-emerald-500/20">
                <div className="text-sm font-bold text-emerald-400 mb-4 uppercase tracking-wider">Blockchain (TerraQura)</div>
                <div className="space-y-3 text-sm font-body">
                  {[
                    { step: "1", text: "Facility instrumented with IoT sensors", color: "text-emerald-400/70" },
                    { step: "2", text: "Continuous sensor data streamed to chain", color: "text-emerald-400/70" },
                    { step: "3", text: "PoP verification engine validates physics", color: "text-emerald-400/70" },
                    { step: "4", text: "ERC-1155 token minted with proof metadata", color: "text-emerald-400/70" },
                    { step: "5", text: "On-chain marketplace (transparent pricing)", color: "text-emerald-400/70" },
                    { step: "6", text: "Token burned on retirement (permanent)", color: "text-emerald-400/70" },
                    { step: "7", text: "Complete lifecycle auditable by anyone", color: "text-emerald-400" },
                  ].map((item) => (
                    <div key={item.step} className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs text-emerald-400">{item.step}</span>
                      </div>
                      <span className={item.color}>{item.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <h2 id="aethelred-benefits" className="text-2xl font-bold text-white mt-12 mb-4">
              Aethelred Sovereign Chain Benefits
            </h2>
            <p className="text-white/70 font-body leading-relaxed mb-4">
              TerraQura is building its own sovereign blockchain, Aethelred, rather than deploying on existing public chains.
              This decision was driven by several requirements specific to institutional carbon markets. First, carbon credit
              verification requires high throughput and low, predictable transaction costs. Public chains like Ethereum
              experience gas price volatility that makes per-tonne verification costs unpredictable. Aethelred&apos;s permissioned
              validator set provides stable, low-cost transactions.
            </p>
            <p className="text-white/70 font-body leading-relaxed mb-4">
              Second, institutional participants require governance certainty. The rules governing carbon credit issuance,
              transfer, and retirement should not be subject to unilateral changes by anonymous token holders in a public
              chain&apos;s governance process. Aethelred&apos;s governance is managed by a defined set of institutional validators,
              providing the predictability that enterprise users require.
            </p>
            <p className="text-white/70 font-body leading-relaxed mb-4">
              Third, regulatory compliance requires the ability to implement identity verification and transaction monitoring
              at the protocol level. Public chains, by design, support pseudonymous transactions. Aethelred supports
              KYC-verified identities while maintaining data privacy through selective disclosure mechanisms.
            </p>
            <p className="text-white/70 font-body leading-relaxed mb-6">
              Critically, Aethelred is EVM-compatible, meaning it can run Solidity smart contracts and interface with
              Ethereum-based tooling. This provides the development ecosystem benefits of Ethereum while offering the
              performance and governance characteristics needed for institutional carbon markets.
            </p>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 my-8">
              <MetricCard value="2,000+" label="Transactions per second (Aethelred target)" />
              <MetricCard value="< $0.01" label="Per-transaction cost" />
              <MetricCard value="2s" label="Block finality time" />
            </div>

            <h2 id="challenges" className="text-2xl font-bold text-white mt-12 mb-4">
              Challenges and Considerations
            </h2>
            <p className="text-white/70 font-body leading-relaxed mb-4">
              Blockchain is not a panacea for carbon market integrity. Several challenges remain. The oracle problem, bridging
              physical-world data to on-chain records, requires trusted data sources. TerraQura addresses this through
              Proof-of-Physics sensor infrastructure, but the integrity of the entire system depends on the integrity of the
              sensors. Tamper-resistant hardware, calibration protocols, and redundant sensor arrays are necessary safeguards.
            </p>
            <p className="text-white/70 font-body leading-relaxed mb-4">
              Interoperability with existing registries is another challenge. The vast majority of carbon credits currently
              exist in traditional registries. A complete transition to blockchain-based registries will take years. In the
              interim, bridge mechanisms are needed to allow credits to move between traditional and blockchain systems without
              creating double-counting risk during the transition.
            </p>
            <p className="text-white/70 font-body leading-relaxed mb-6">
              Regulatory acceptance is progressing but not yet universal. Some jurisdictions have embraced blockchain-based
              carbon registries (Singapore, Abu Dhabi), while others remain cautious. Building regulatory confidence requires
              demonstrating that blockchain-based systems meet or exceed the integrity standards of traditional registries.
            </p>

            <h2 id="conclusion" className="text-2xl font-bold text-white mt-12 mb-4">
              Conclusion
            </h2>
            <p className="text-white/70 font-body leading-relaxed mb-4">
              The double-counting problem in carbon markets is not a bug in the current system. It is a feature of
              disconnected, opaque, centralized registries operating without shared state. Blockchain provides the shared
              state. Tokenization provides the unique, traceable, non-duplicable credit representation. Smart contracts
              provide automated lifecycle management. And Proof-of-Physics provides the bridge between physical reality
              and digital representation.
            </p>
            <p className="text-white/70 font-body leading-relaxed mb-8">
              Together, these technologies do not merely improve carbon markets. They rebuild them on a foundation of
              mathematical certainty rather than institutional trust. For a market that needs to mobilize trillions of
              dollars to fund global decarbonization, that foundation matters enormously.
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
