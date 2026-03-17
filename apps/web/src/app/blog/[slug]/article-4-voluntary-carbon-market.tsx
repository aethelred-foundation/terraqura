"use client";

import Link from "next/link";
import { AnimatedSection } from "@/components/shared/AnimatedSection";

function MetricCard({ value, label }: { value: string; label: string }) {
  return (
    <div className="p-5 rounded-xl bg-white/[0.02] border border-white/[0.06] text-center">
      <div className="text-2xl font-bold text-amber-400 mb-1">{value}</div>
      <div className="text-xs text-white/50 font-body">{label}</div>
    </div>
  );
}

function TableOfContents() {
  return (
    <nav className="p-5 rounded-xl bg-white/[0.02] border border-white/[0.06] mb-10" aria-label="Table of contents">
      <h2 className="text-sm font-bold text-white/80 uppercase tracking-wider mb-3">Contents</h2>
      <ul className="space-y-2 text-sm font-body">
        <li><a href="#market-overview" className="text-emerald-400 hover:text-emerald-300 transition-colors">Market Overview: State of the VCM in 2026</a></li>
        <li><a href="#demand-drivers" className="text-emerald-400 hover:text-emerald-300 transition-colors">Demand Drivers</a></li>
        <li><a href="#supply-landscape" className="text-emerald-400 hover:text-emerald-300 transition-colors">Supply Landscape</a></li>
        <li><a href="#quality-concerns" className="text-emerald-400 hover:text-emerald-300 transition-colors">The Quality Crisis and Market Response</a></li>
        <li><a href="#regulatory-developments" className="text-emerald-400 hover:text-emerald-300 transition-colors">Regulatory Developments</a></li>
        <li><a href="#technology-role" className="text-emerald-400 hover:text-emerald-300 transition-colors">The Role of Technology</a></li>
        <li><a href="#price-dynamics" className="text-emerald-400 hover:text-emerald-300 transition-colors">Price Dynamics and Bifurcation</a></li>
        <li><a href="#outlook" className="text-emerald-400 hover:text-emerald-300 transition-colors">Outlook: 2026-2030</a></li>
        <li><a href="#conclusion" className="text-emerald-400 hover:text-emerald-300 transition-colors">Conclusion</a></li>
      </ul>
    </nav>
  );
}

export function Article4Content() {
  return (
    <>
      {/* Hero */}
      <section className="relative py-16 sm:py-20 lg:py-24" aria-labelledby="article-heading">
        <div className="container mx-auto px-6 sm:px-8 lg:px-10 max-w-4xl">
          <AnimatedSection>
            <div className="mb-6 flex items-center gap-3">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-medium border bg-amber-500/10 text-amber-400 border-amber-500/20">
                Industry
              </span>
              <span className="text-sm text-white/40 font-body">13 min read</span>
              <span className="text-sm text-white/40 font-body">February 15, 2026</span>
            </div>
            <h1 id="article-heading" className="text-display-lg lg:text-display-xl text-white mb-6 leading-tight">
              The Voluntary Carbon Market in 2026: Trends, Challenges, and Opportunities
            </h1>
            <p className="text-lg text-white/70 font-body leading-relaxed mb-8">
              The voluntary carbon market has grown past $2 billion, but quality concerns and regulatory fragmentation threaten
              its trajectory. We analyze the forces reshaping carbon credit demand and supply.
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
            <h2 id="market-overview" className="text-2xl font-bold text-white mt-12 mb-4">
              Market Overview: State of the VCM in 2026
            </h2>
            <p className="text-white/70 font-body leading-relaxed mb-4">
              The voluntary carbon market (VCM) entered 2026 at a crossroads. After a turbulent 2023 that saw market volume
              contract by nearly 30 percent in the wake of quality scandals affecting major registries, 2024 and 2025 brought
              a cautious recovery. Market participants became more discriminating, gravitating toward higher-quality credits
              with robust verification and, increasingly, toward engineered removal credits over nature-based avoidance credits.
            </p>
            <p className="text-white/70 font-body leading-relaxed mb-6">
              Total VCM transaction volume in 2025 was estimated at $2.1 to $2.4 billion, representing approximately 500
              million tonnes of CO2-equivalent credits traded. This represents recovery from the 2023 low but remains below
              the 2022 peak of approximately $2.7 billion. More significantly, the composition of the market has shifted
              dramatically. Removal credits now represent over 20 percent of market value (up from less than 5 percent in
              2021), despite representing only about 3 percent of total volume, reflecting a substantial price premium for
              high-quality removal.
            </p>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 my-8">
              <MetricCard value="$2.3B" label="Estimated VCM value (2025)" />
              <MetricCard value="500M" label="Tonnes CO2e traded (2025)" />
              <MetricCard value="20%+" label="Removal share of market value" />
              <MetricCard value="$150+" label="Premium removal credit price per tonne" />
            </div>

            <h2 id="demand-drivers" className="text-2xl font-bold text-white mt-12 mb-4">
              Demand Drivers
            </h2>
            <p className="text-white/70 font-body leading-relaxed mb-4">
              Corporate net-zero commitments remain the primary demand driver. As of early 2026, over 4,000 companies have
              set science-based targets through the SBTi (Science Based Targets initiative), up from roughly 2,500 in 2023.
              These commitments increasingly distinguish between emission reduction targets (which companies must achieve
              through operational changes) and residual emission neutralization (where carbon credits play a role).
            </p>
            <p className="text-white/70 font-body leading-relaxed mb-4">
              The SBTi&apos;s 2024 revision of its corporate net-zero standard clarified the role of carbon credits: companies
              should use high-quality removal credits to neutralize residual emissions that cannot be eliminated through
              decarbonization. This clarity has been a net positive for the VCM, focusing demand on the highest-quality
              segment of the market while discouraging the use of low-quality avoidance credits as a substitute for
              genuine emission reductions.
            </p>
            <p className="text-white/70 font-body leading-relaxed mb-4">
              Regulatory drivers are also emerging. The EU&apos;s Corporate Sustainability Reporting Directive (CSRD) requires
              large companies to disclose their use of carbon credits and the quality standards applied. While the CSRD
              does not mandate credit purchases, the transparency requirement has increased corporate scrutiny of credit
              quality. Several jurisdictions are developing regulations that would formally recognize high-quality removal
              credits in compliance contexts.
            </p>
            <p className="text-white/70 font-body leading-relaxed mb-6">
              Perhaps most significantly, the insurance and financial sectors have begun to engage with carbon markets as both
              buyers and intermediaries. Major reinsurers are exploring carbon removal credits as part of climate risk
              management strategies, and several banks have launched carbon credit trading desks and structured products.
            </p>

            <h2 id="supply-landscape" className="text-2xl font-bold text-white mt-12 mb-4">
              Supply Landscape
            </h2>
            <p className="text-white/70 font-body leading-relaxed mb-4">
              The supply side of the VCM is undergoing a structural shift. Historically dominated by nature-based avoidance
              projects (primarily REDD+ forest conservation and improved cookstove programs), the market is seeing rapid
              growth in engineered removal supply. DAC, biochar, enhanced rock weathering, and bioenergy with carbon capture
              and storage (BECCS) projects are scaling from pilot to commercial scale.
            </p>
            <p className="text-white/70 font-body leading-relaxed mb-6">
              Nature-based removal (reforestation, afforestation) continues to represent the largest removal volume, but
              growth is constrained by land availability, permanence concerns, and the long time horizons required for forests
              to sequester meaningful quantities of carbon. Engineered removal, while currently more expensive per tonne,
              offers greater scalability and permanence, making it increasingly attractive to sophisticated buyers.
            </p>

            {/* Market data table */}
            <div className="my-8 overflow-x-auto">
              <table className="w-full text-sm font-body">
                <thead>
                  <tr className="border-b border-white/[0.1]">
                    <th className="text-left py-3 px-4 text-white/80 font-bold">Credit Category</th>
                    <th className="text-left py-3 px-4 text-white/80 font-bold">Volume Share</th>
                    <th className="text-left py-3 px-4 text-white/80 font-bold">Value Share</th>
                    <th className="text-left py-3 px-4 text-white/80 font-bold">Avg Price ($/t)</th>
                    <th className="text-left py-3 px-4 text-white/80 font-bold">Growth Trend</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["Nature-Based Avoidance (REDD+)", "45%", "25%", "$4-12", "Declining"],
                    ["Renewable Energy", "18%", "8%", "$2-6", "Declining"],
                    ["Nature-Based Removal", "15%", "18%", "$15-40", "Stable"],
                    ["Improved Cookstoves", "10%", "5%", "$4-8", "Stable"],
                    ["Engineered Removal (DAC, Biochar)", "3%", "22%", "$100-600", "Rapid growth"],
                    ["Other (Methane, Industrial)", "9%", "22%", "$10-50", "Growing"],
                  ].map(([cat, vol, val, price, trend], i) => (
                    <tr key={cat} className={`border-b border-white/[0.06] ${i % 2 === 0 ? "bg-white/[0.01]" : ""}`}>
                      <td className="py-3 px-4 text-white/80 font-medium">{cat}</td>
                      <td className="py-3 px-4 text-white/50">{vol}</td>
                      <td className="py-3 px-4 text-white/50">{val}</td>
                      <td className="py-3 px-4 text-white/50">{price}</td>
                      <td className="py-3 px-4 text-white/50">{trend}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h2 id="quality-concerns" className="text-2xl font-bold text-white mt-12 mb-4">
              The Quality Crisis and Market Response
            </h2>
            <p className="text-white/70 font-body leading-relaxed mb-4">
              The quality crisis that erupted in 2023 has not been fully resolved, but the market&apos;s response has been
              constructive. The Integrity Council for the Voluntary Carbon Market (ICVCM) launched its Core Carbon Principles
              (CCP) assessment framework in late 2023, with the first CCP-eligible credit categories approved in 2024.
              While adoption has been slower than hoped, the CCP framework provides a common quality benchmark that the
              market previously lacked.
            </p>
            <p className="text-white/70 font-body leading-relaxed mb-4">
              Major registries have responded to quality concerns with methodological updates. Verra retired its most
              controversial REDD+ methodology and introduced stricter additionality requirements for new projects. Gold
              Standard strengthened its monitoring requirements. New registries with technology-first approaches (Puro.earth
              for removal credits, Isometric for engineered removal) have gained market share by offering higher-integrity
              verification from the start.
            </p>
            <p className="text-white/70 font-body leading-relaxed mb-6">
              On the demand side, the Voluntary Carbon Markets Integrity Initiative (VCMI) released its Claims Code of
              Practice, providing guidance on how companies should use credits within their broader climate strategies. The
              code explicitly discourages using credits as a substitute for emission reductions and recommends using the
              highest-quality credits available for residual emission neutralization.
            </p>

            <h2 id="regulatory-developments" className="text-2xl font-bold text-white mt-12 mb-4">
              Regulatory Developments
            </h2>
            <p className="text-white/70 font-body leading-relaxed mb-4">
              The regulatory landscape for voluntary carbon markets is evolving rapidly but remains fragmented. Key
              developments include: the operationalization of Article 6 of the Paris Agreement, with the first authorized
              transfers of internationally transferred mitigation outcomes (ITMOs) occurring in 2025; the EU Carbon Removal
              Certification Framework (CRCF), which establishes quality standards for removal activities within the EU;
              the US Principles for High-Integrity Voluntary Carbon Markets, released by the Biden administration in 2024
              and maintained under current policy; and Singapore&apos;s International Carbon Credit Framework, which allows
              companies to use high-quality international credits for compliance purposes.
            </p>
            <p className="text-white/70 font-body leading-relaxed mb-6">
              The overall regulatory trend is toward convergence on quality standards and interoperability between voluntary
              and compliance markets. This is broadly positive for the VCM, as it creates a pathway for high-quality
              voluntary credits to gain compliance value over time.
            </p>

            <h2 id="technology-role" className="text-2xl font-bold text-white mt-12 mb-4">
              The Role of Technology
            </h2>
            <p className="text-white/70 font-body leading-relaxed mb-4">
              Technology is reshaping every layer of the carbon market stack. On the MRV side, satellite monitoring, IoT
              sensors, and AI-powered analysis are replacing manual audits for many project types. For nature-based projects,
              satellite-derived biomass estimates provide more frequent and objective baseline data. For engineered removal,
              continuous sensor monitoring (as implemented by TerraQura&apos;s Proof-of-Physics) provides real-time verification
              that is more accurate and less expensive than periodic audits.
            </p>
            <p className="text-white/70 font-body leading-relaxed mb-4">
              On the infrastructure side, blockchain-based registries are gaining traction for new credit categories,
              particularly engineered removal. The transparency, traceability, and programmability of tokenized credits
              enable new market mechanisms including automated settlement, real-time pricing, and derivative instruments
              that are impossible in traditional registry systems.
            </p>
            <p className="text-white/70 font-body leading-relaxed mb-6">
              Market platforms are also evolving. Traditional broker-mediated OTC trading is being supplemented by electronic
              exchanges and marketplaces that provide price discovery, standardized contracts, and clearing services.
              These platforms are essential for attracting institutional capital to the market.
            </p>

            <h2 id="price-dynamics" className="text-2xl font-bold text-white mt-12 mb-4">
              Price Dynamics and Bifurcation
            </h2>
            <p className="text-white/70 font-body leading-relaxed mb-4">
              The VCM is experiencing a pronounced price bifurcation. Low-quality avoidance credits (particularly REDD+
              credits from projects with questionable additionality) have seen prices decline from $8 to $12 per tonne in
              2022 to $3 to $6 per tonne in 2026, reflecting buyer reluctance post quality scandals. Meanwhile, high-quality
              removal credits have maintained or increased in price, with DAC credits trading at $150 to $600 per tonne and
              premium biochar credits at $80 to $150 per tonne.
            </p>
            <p className="text-white/70 font-body leading-relaxed mb-6">
              This bifurcation is likely to persist and deepen. As corporate sustainability teams become more sophisticated
              and regulatory scrutiny increases, demand will continue shifting toward credits that can withstand rigorous
              due diligence. Credits with physics-based verification, on-chain traceability, and quantified permanence
              guarantees will command premium prices, while credits lacking these attributes will face declining demand.
            </p>

            <h2 id="outlook" className="text-2xl font-bold text-white mt-12 mb-4">
              Outlook: 2026-2030
            </h2>
            <p className="text-white/70 font-body leading-relaxed mb-4">
              The VCM is projected to reach $10 to $40 billion in annual transaction value by 2030, depending on the pace
              of corporate net-zero commitment execution, regulatory integration of voluntary credits, and the availability
              of high-quality supply. The wide range reflects genuine uncertainty about how these factors will interact.
            </p>
            <p className="text-white/70 font-body leading-relaxed mb-6">
              Several structural trends are likely to persist through this period: continued shift from avoidance to removal
              credits, increasing price differentiation based on quality and verification rigor, growing institutional and
              financial sector participation, convergence between voluntary and compliance market standards, and the
              increasing role of technology in MRV, registry, and trading infrastructure. Organizations that position
              themselves on the right side of these trends, prioritizing quality, transparency, and technological
              sophistication, will be well placed to capture value as the market matures.
            </p>

            <h2 id="conclusion" className="text-2xl font-bold text-white mt-12 mb-4">
              Conclusion
            </h2>
            <p className="text-white/70 font-body leading-relaxed mb-4">
              The voluntary carbon market in 2026 is a market in transition. The quality crisis of 2023 was painful but
              ultimately constructive, forcing the market to confront fundamental questions about credit integrity that
              had been deferred for too long. The result is a market that is more discerning, more transparent, and
              increasingly grounded in measurable, verifiable climate impact.
            </p>
            <p className="text-white/70 font-body leading-relaxed mb-8">
              For the VCM to fulfill its potential as a mechanism for channeling private capital to climate solutions, it
              must continue on this trajectory toward higher quality and greater transparency. Technologies like
              Proof-of-Physics, blockchain-based registries, and continuous digital MRV are not optional upgrades to the
              existing system. They are the foundation of the system the market needs to become.
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
