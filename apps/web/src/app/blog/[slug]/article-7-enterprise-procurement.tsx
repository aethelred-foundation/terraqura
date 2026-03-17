"use client";

import Link from "next/link";
import { AnimatedSection } from "@/components/shared/AnimatedSection";

function TableOfContents() {
  return (
    <nav className="p-5 rounded-xl bg-white/[0.02] border border-white/[0.06] mb-10" aria-label="Table of contents">
      <h2 className="text-sm font-bold text-white/80 uppercase tracking-wider mb-3">Contents</h2>
      <ul className="space-y-2 text-sm font-body">
        <li><a href="#evolving-landscape" className="text-emerald-400 hover:text-emerald-300 transition-colors">The Evolving Carbon Procurement Landscape</a></li>
        <li><a href="#esg-requirements" className="text-emerald-400 hover:text-emerald-300 transition-colors">ESG Reporting Requirements</a></li>
        <li><a href="#quality-framework" className="text-emerald-400 hover:text-emerald-300 transition-colors">Credit Quality Assessment Framework</a></li>
        <li><a href="#due-diligence" className="text-emerald-400 hover:text-emerald-300 transition-colors">Due Diligence Checklist</a></li>
        <li><a href="#procurement-strategy" className="text-emerald-400 hover:text-emerald-300 transition-colors">Building a Procurement Strategy</a></li>
        <li><a href="#net-zero-integration" className="text-emerald-400 hover:text-emerald-300 transition-colors">Integration with Net-Zero Strategy</a></li>
        <li><a href="#common-mistakes" className="text-emerald-400 hover:text-emerald-300 transition-colors">Common Procurement Mistakes</a></li>
        <li><a href="#conclusion" className="text-emerald-400 hover:text-emerald-300 transition-colors">Conclusion</a></li>
      </ul>
    </nav>
  );
}

export function Article7Content() {
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
              <span className="text-sm text-white/40 font-body">11 min read</span>
              <span className="text-sm text-white/40 font-body">February 6, 2026</span>
            </div>
            <h1 id="article-heading" className="text-display-lg lg:text-display-xl text-white mb-6 leading-tight">
              Enterprise Carbon Procurement: A Guide for Corporate Sustainability Officers
            </h1>
            <p className="text-lg text-white/70 font-body leading-relaxed mb-8">
              Navigating the carbon credit landscape as a corporate buyer requires understanding quality frameworks,
              due diligence processes, and integration with ESG reporting. A practical guide for procurement teams.
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
            <h2 id="evolving-landscape" className="text-2xl font-bold text-white mt-12 mb-4">
              The Evolving Carbon Procurement Landscape
            </h2>
            <p className="text-white/70 font-body leading-relaxed mb-4">
              Corporate carbon credit procurement has undergone a fundamental transformation in the past three years. What
              was once a relatively simple exercise in purchasing low-cost offsets to make green claims has evolved into a
              sophisticated procurement function with significant financial, reputational, and regulatory implications.
            </p>
            <p className="text-white/70 font-body leading-relaxed mb-4">
              Several factors have driven this transformation. The quality crisis of 2023 demonstrated the reputational
              risk of purchasing low-quality credits. Companies like Shell, Gucci, and Delta Air Lines faced public backlash
              and regulatory scrutiny over their use of credits that were later found to represent questionable climate
              benefits. The lesson was clear: the cheapest credits carry the highest risk.
            </p>
            <p className="text-white/70 font-body leading-relaxed mb-4">
              Regulatory developments have raised the stakes further. The EU Corporate Sustainability Reporting Directive
              (CSRD) requires companies to disclose their use of carbon credits, the standards applied, and how credits
              integrate with their broader climate strategy. The SEC&apos;s climate disclosure rules in the United States,
              while subject to legal challenges, signal a global trend toward mandatory transparency in corporate climate
              claims.
            </p>
            <p className="text-white/70 font-body leading-relaxed mb-6">
              For sustainability officers, this means that carbon procurement decisions are no longer delegated to junior
              staff or included as a line item in the marketing budget. They are strategic decisions with C-suite visibility
              and board-level accountability.
            </p>

            <h2 id="esg-requirements" className="text-2xl font-bold text-white mt-12 mb-4">
              ESG Reporting Requirements
            </h2>
            <p className="text-white/70 font-body leading-relaxed mb-4">
              Understanding the reporting landscape is essential for informed procurement. The major frameworks and
              regulations that affect carbon credit disclosure include the Greenhouse Gas Protocol (the foundation for
              corporate emissions accounting, which has issued supplementary guidance on how credits should and should
              not be used in corporate inventories), the SBTi Corporate Net-Zero Standard (which requires companies to
              reduce value chain emissions by at least 90 percent before using credits to neutralize residual emissions),
              the CSRD and European Sustainability Reporting Standards (ESRS) which require disclosure of credit
              quality, vintage, methodology, and integration with the company&apos;s transition plan, and the IFRS S2
              Climate-related Disclosures standard issued by the ISSB (International Sustainability Standards Board).
            </p>
            <p className="text-white/70 font-body leading-relaxed mb-6">
              The common thread across all these frameworks is that carbon credits are appropriate for residual emissions
              that cannot be eliminated through operational changes, not as a substitute for genuine decarbonization.
              Companies that use credits to claim carbon neutrality without demonstrating emissions reductions face
              increasing regulatory and reputational risk.
            </p>

            <h2 id="quality-framework" className="text-2xl font-bold text-white mt-12 mb-4">
              Credit Quality Assessment Framework
            </h2>
            <p className="text-white/70 font-body leading-relaxed mb-4">
              Not all carbon credits are equal. A robust quality assessment should evaluate credits across seven dimensions,
              each of which affects the credit&apos;s integrity and the buyer&apos;s risk exposure.
            </p>

            <div className="my-8 space-y-3">
              {[
                { dim: "Additionality", desc: "Would the emission reduction or removal have happened without carbon credit revenue? Credits from activities that would have occurred anyway (for example, renewable energy projects in markets where renewables are already the cheapest option) have weak additionality.", score: "Critical" },
                { dim: "Permanence", desc: "How long will the CO2 remain out of the atmosphere? Geological storage (10,000+ years) is more permanent than forest carbon (reversible through fire or disease). Credits should quantify permanence risk and ideally include buffer pool or insurance mechanisms.", score: "Critical" },
                { dim: "Measurability", desc: "How accurately is the emission reduction or removal measured? Credits backed by continuous sensor monitoring and physics-based validation have lower measurement uncertainty than those based on modeling or periodic sampling.", score: "High" },
                { dim: "Verification Standard", desc: "Which standard or methodology governs the credit? ICVCM Core Carbon Principles provide a minimum quality benchmark. Look for credits that meet or exceed CCP requirements.", score: "High" },
                { dim: "Vintage", desc: "When did the reduction or removal occur? Older vintages may reflect outdated baselines or methodologies. Best practice is to purchase credits from the most recent available vintage.", score: "Medium" },
                { dim: "Co-benefits", desc: "Does the project deliver benefits beyond carbon (biodiversity, community development, clean water)? Co-benefits add value but should not substitute for carbon integrity.", score: "Medium" },
                { dim: "Registry Transparency", desc: "Is the full lifecycle of the credit (issuance, transfer, retirement) publicly auditable? Blockchain-based registries provide maximum transparency; traditional registries vary.", score: "High" },
              ].map((item) => (
                <div key={item.dim} className="p-5 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-white font-bold text-sm">{item.dim}</h3>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${
                      item.score === "Critical" ? "bg-red-500/10 text-red-400 border-red-500/20" :
                      item.score === "High" ? "bg-amber-500/10 text-amber-400 border-amber-500/20" :
                      "bg-white/[0.06] text-white/60 border-white/[0.1]"
                    }`}>{item.score} Priority</span>
                  </div>
                  <p className="text-white/60 font-body text-sm leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>

            <h2 id="due-diligence" className="text-2xl font-bold text-white mt-12 mb-4">
              Due Diligence Checklist
            </h2>
            <p className="text-white/70 font-body leading-relaxed mb-4">
              Before purchasing carbon credits, corporate buyers should conduct thorough due diligence. The following
              checklist provides a structured framework for evaluating credit quality and supplier reliability.
            </p>

            {/* Compliance checklist table */}
            <div className="my-8 overflow-x-auto">
              <table className="w-full text-sm font-body">
                <thead>
                  <tr className="border-b border-white/[0.1]">
                    <th className="text-left py-3 px-4 text-white/80 font-bold">Category</th>
                    <th className="text-left py-3 px-4 text-white/80 font-bold">Due Diligence Item</th>
                    <th className="text-left py-3 px-4 text-white/80 font-bold">Why It Matters</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["Methodology", "Is the methodology peer-reviewed and publicly available?", "Ensures scientific basis for credit claims"],
                    ["Methodology", "Does it meet ICVCM Core Carbon Principles?", "Provides minimum quality assurance"],
                    ["Verification", "Who performed the verification? Are they accredited?", "Reduces risk of compromised audits"],
                    ["Verification", "Is verification data publicly auditable?", "Enables independent quality assessment"],
                    ["Verification", "How frequently is the project re-verified?", "Ensures ongoing performance"],
                    ["Permanence", "What is the permanence guarantee (years)?", "Longer permanence = higher quality"],
                    ["Permanence", "Is there a buffer pool or insurance for reversal risk?", "Protects against non-delivery"],
                    ["Registry", "Which registry holds the credits?", "Established registries have quality controls"],
                    ["Registry", "Can credit serial numbers be independently verified?", "Prevents double-counting exposure"],
                    ["Legal", "Is there clear legal title to the credits?", "Protects against ownership disputes"],
                    ["Legal", "Are corresponding adjustments applied (for international credits)?", "Prevents sovereign double-claiming"],
                    ["Supplier", "What is the supplier's track record and reputation?", "Reduces counterparty risk"],
                  ].map(([cat, item, why], i) => (
                    <tr key={`${cat}-${i}`} className={`border-b border-white/[0.06] ${i % 2 === 0 ? "bg-white/[0.01]" : ""}`}>
                      <td className="py-3 px-4 text-white/60 font-medium">{cat}</td>
                      <td className="py-3 px-4 text-white/80">{item}</td>
                      <td className="py-3 px-4 text-white/50">{why}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h2 id="procurement-strategy" className="text-2xl font-bold text-white mt-12 mb-4">
              Building a Procurement Strategy
            </h2>
            <p className="text-white/70 font-body leading-relaxed mb-4">
              Effective carbon procurement is not a one-time purchase. It is an ongoing strategy that should align with the
              company&apos;s broader decarbonization roadmap. A well-structured procurement strategy addresses several dimensions.
            </p>
            <p className="text-white/70 font-body leading-relaxed mb-4">
              Volume planning starts with estimating residual emissions, those that will remain after all feasible
              decarbonization measures are implemented. This should be based on a detailed emissions inventory (Scope 1,
              2, and material Scope 3 categories) and a realistic decarbonization timeline. The volume of credits needed
              each year should decline as decarbonization progresses.
            </p>
            <p className="text-white/70 font-body leading-relaxed mb-4">
              Portfolio construction involves diversifying across credit types, geographies, and vintages to manage risk.
              A typical institutional portfolio might allocate 40 to 60 percent to high-quality removal credits (DAC,
              biochar), 20 to 30 percent to nature-based removal (reforestation with long-term monitoring), and 10 to
              20 percent to high-integrity avoidance credits (industrial gas destruction, methane capture). The mix should
              shift toward removal over time as corporate net-zero standards converge on removal-only neutralization.
            </p>
            <p className="text-white/70 font-body leading-relaxed mb-4">
              Forward contracting secures future supply at known prices. As demand for high-quality removal credits
              grows faster than supply, prices are expected to increase. Long-term offtake agreements (3 to 10 years)
              with DAC operators or other removal project developers can provide price certainty and supply assurance.
            </p>
            <p className="text-white/70 font-body leading-relaxed mb-6">
              Budget allocation should recognize that high-quality credits are more expensive per tonne but carry
              lower risk per tonne. A $500,000 budget spent on 100,000 low-quality avoidance credits at $5 per tonne
              carries significantly more reputational and regulatory risk than the same budget spent on 1,000 tonnes
              of physics-verified DAC removal credits at $500 per tonne.
            </p>

            <h2 id="net-zero-integration" className="text-2xl font-bold text-white mt-12 mb-4">
              Integration with Net-Zero Strategy
            </h2>
            <p className="text-white/70 font-body leading-relaxed mb-4">
              Carbon credits should be one component of a comprehensive net-zero strategy, not a standalone initiative.
              The SBTi net-zero standard provides a clear hierarchy: companies should first reduce their own emissions
              through operational changes, supply chain engagement, and technology adoption. Only residual emissions that
              cannot be feasibly eliminated should be addressed through carbon removal credits.
            </p>
            <p className="text-white/70 font-body leading-relaxed mb-4">
              Reporting should clearly distinguish between emission reductions (achieved through operational changes) and
              emission neutralization (achieved through credit retirement). Conflating the two invites accusations of
              greenwashing and undermines credibility with stakeholders, regulators, and rating agencies.
            </p>
            <p className="text-white/70 font-body leading-relaxed mb-6">
              Internal governance should establish clear policies on credit quality standards, approved suppliers, approval
              workflows for large purchases, and retirement protocols. These policies should be reviewed annually as
              market standards and regulatory requirements evolve.
            </p>

            <h2 id="common-mistakes" className="text-2xl font-bold text-white mt-12 mb-4">
              Common Procurement Mistakes
            </h2>
            <p className="text-white/70 font-body leading-relaxed mb-4">
              Based on observations of corporate procurement practices, several common mistakes recur. Optimizing on
              price alone leads buyers to the lowest-quality segment of the market, maximizing volume while maximizing
              risk. Making one-time purchases rather than building an ongoing program creates supply discontinuity and
              misses the opportunity to develop supplier relationships. Failing to involve legal and compliance teams
              exposes the company to regulatory and contractual risk. Treating carbon credits as a marketing expense
              rather than a sustainability investment leads to superficial engagement and poor outcomes.
            </p>
            <p className="text-white/70 font-body leading-relaxed mb-6">
              Perhaps the most consequential mistake is purchasing credits without a credible emissions reduction plan.
              Credits are meant to address the residual, not replace the effort. Companies that buy credits instead of
              reducing emissions face increasing exposure to greenwashing allegations and regulatory action.
            </p>

            <h2 id="conclusion" className="text-2xl font-bold text-white mt-12 mb-4">
              Conclusion
            </h2>
            <p className="text-white/70 font-body leading-relaxed mb-4">
              Enterprise carbon procurement in 2026 requires the same rigor applied to any significant corporate
              investment. Quality, verification integrity, regulatory compliance, and strategic alignment with the
              company&apos;s net-zero pathway are non-negotiable requirements. The era of cheap, low-quality offsets
              as a substitute for genuine climate action is over.
            </p>
            <p className="text-white/70 font-body leading-relaxed mb-8">
              For sustainability officers navigating this landscape, the key is to work with suppliers and platforms
              that provide transparent, verifiable, and high-integrity credits. Physics-verified removal credits,
              with full on-chain traceability and quantified measurement uncertainty, represent the gold standard
              for corporate carbon procurement.
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
