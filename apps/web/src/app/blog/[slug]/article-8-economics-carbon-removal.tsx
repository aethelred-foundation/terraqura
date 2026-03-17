"use client";

import Link from "next/link";
import { AnimatedSection } from "@/components/shared/AnimatedSection";

function MetricCard({ value, label, color = "text-cyan-400" }: { value: string; label: string; color?: string }) {
  return (
    <div className="p-5 rounded-xl bg-white/[0.02] border border-white/[0.06] text-center">
      <div className={`text-2xl font-bold mb-1 ${color}`}>{value}</div>
      <div className="text-xs text-white/50 font-body">{label}</div>
    </div>
  );
}

function TableOfContents() {
  return (
    <nav className="p-5 rounded-xl bg-white/[0.02] border border-white/[0.06] mb-10" aria-label="Table of contents">
      <h2 className="text-sm font-bold text-white/80 uppercase tracking-wider mb-3">Contents</h2>
      <ul className="space-y-2 text-sm font-body">
        <li><a href="#cost-landscape" className="text-emerald-400 hover:text-emerald-300 transition-colors">The Current Cost Landscape</a></li>
        <li><a href="#cost-breakdown" className="text-emerald-400 hover:text-emerald-300 transition-colors">Cost Breakdown: Where the Money Goes</a></li>
        <li><a href="#learning-curves" className="text-emerald-400 hover:text-emerald-300 transition-colors">Learning Curves and Cost Reduction Pathways</a></li>
        <li><a href="#economies-of-scale" className="text-emerald-400 hover:text-emerald-300 transition-colors">Economies of Scale</a></li>
        <li><a href="#policy-incentives" className="text-emerald-400 hover:text-emerald-300 transition-colors">Policy Incentives: 45Q, EU ETS, and Beyond</a></li>
        <li><a href="#cost-projections" className="text-emerald-400 hover:text-emerald-300 transition-colors">Cost Projections by Technology</a></li>
        <li><a href="#investment-landscape" className="text-emerald-400 hover:text-emerald-300 transition-colors">Investment Landscape</a></li>
        <li><a href="#willingness-to-pay" className="text-emerald-400 hover:text-emerald-300 transition-colors">Buyer Willingness to Pay</a></li>
        <li><a href="#conclusion" className="text-emerald-400 hover:text-emerald-300 transition-colors">Conclusion</a></li>
      </ul>
    </nav>
  );
}

export function Article8Content() {
  return (
    <>
      {/* Hero */}
      <section className="relative py-16 sm:py-20 lg:py-24" aria-labelledby="article-heading">
        <div className="container mx-auto px-6 sm:px-8 lg:px-10 max-w-4xl">
          <AnimatedSection>
            <div className="mb-6 flex items-center gap-3">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-medium border bg-cyan-500/10 text-cyan-400 border-cyan-500/20">
                Research
              </span>
              <span className="text-sm text-white/40 font-body">14 min read</span>
              <span className="text-sm text-white/40 font-body">February 3, 2026</span>
            </div>
            <h1 id="article-heading" className="text-display-lg lg:text-display-xl text-white mb-6 leading-tight">
              The Economics of Carbon Removal: From $600/tonne to $100/tonne
            </h1>
            <p className="text-lg text-white/70 font-body leading-relaxed mb-8">
              Carbon removal costs are following a learning curve similar to solar PV. We analyze the economics, cost
              drivers, policy incentives, and investment thesis behind the path to affordable carbon removal.
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
            <h2 id="cost-landscape" className="text-2xl font-bold text-white mt-12 mb-4">
              The Current Cost Landscape
            </h2>
            <p className="text-white/70 font-body leading-relaxed mb-4">
              Carbon removal today is expensive. The most established engineered removal technology, Direct Air Capture (DAC),
              currently costs between $400 and $600 per tonne of CO2, depending on the technology variant, energy source,
              and facility scale. This compares to voluntary carbon market prices of $4 to $12 per tonne for nature-based
              avoidance credits and $15 to $40 per tonne for nature-based removal credits. The cost gap is enormous, and
              closing it is essential for carbon removal to scale to climate-relevant volumes.
            </p>
            <p className="text-white/70 font-body leading-relaxed mb-6">
              The good news is that these costs are declining, and they are declining for well-understood reasons that can be
              projected forward with reasonable confidence. The path from $600 per tonne to $100 per tonne is not speculative.
              It follows the same economic patterns observed in solar photovoltaics, lithium-ion batteries, and other
              technologies that have traversed steep learning curves.
            </p>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 my-8">
              <MetricCard value="$400-600" label="Current DAC cost per tonne" color="text-red-400" />
              <MetricCard value="$150-250" label="Projected 2030 cost" color="text-amber-400" />
              <MetricCard value="$80-150" label="Projected 2035 cost" color="text-cyan-400" />
              <MetricCard value="$50-100" label="Long-term target (2040+)" color="text-emerald-400" />
            </div>

            <h2 id="cost-breakdown" className="text-2xl font-bold text-white mt-12 mb-4">
              Cost Breakdown: Where the Money Goes
            </h2>
            <p className="text-white/70 font-body leading-relaxed mb-4">
              Understanding the cost structure of carbon removal is essential for assessing which cost components are likely
              to decline and how quickly. For a typical solid-sorbent DAC facility, costs break down into several major
              categories.
            </p>
            <p className="text-white/70 font-body leading-relaxed mb-4">
              Energy costs represent 30 to 40 percent of the total cost per tonne. DAC systems require both electrical energy
              (for fans, pumps, and control systems) and thermal energy (for sorbent regeneration). The total energy
              requirement is typically 1,500 to 2,200 kWh per tonne for solid-sorbent systems. At current renewable energy
              prices of $0.03 to $0.06 per kWh (electrical) and $0.02 to $0.04 per kWh (waste heat), energy costs per tonne
              range from $60 to $120.
            </p>
            <p className="text-white/70 font-body leading-relaxed mb-4">
              Capital costs (the amortized cost of building the facility) represent another 30 to 40 percent. Current DAC
              facilities require capital investment of approximately $800 to $1,200 per annual tonne of capacity. For a
              facility capturing 100,000 tonnes per year, this translates to $80 to $120 million in capital expenditure.
              Amortized over a 20-year facility life at a 10 percent weighted average cost of capital, this contributes
              roughly $100 to $180 per tonne.
            </p>
            <p className="text-white/70 font-body leading-relaxed mb-4">
              Sorbent and materials costs represent 10 to 20 percent. Solid sorbents degrade over time and must be replaced
              periodically. Current sorbent lifetimes are 3,000 to 10,000 thermal cycles, and sorbent costs range from $30
              to $80 per kilogram. For a system requiring approximately 10 to 20 tonnes of sorbent per annual tonne of
              capacity, this contributes $30 to $80 per tonne of CO2 captured.
            </p>
            <p className="text-white/70 font-body leading-relaxed mb-6">
              Operations and maintenance, including labor, monitoring, calibration, and general facility upkeep, represent
              the remaining 10 to 15 percent, contributing $40 to $80 per tonne.
            </p>

            <h2 id="learning-curves" className="text-2xl font-bold text-white mt-12 mb-4">
              Learning Curves and Cost Reduction Pathways
            </h2>
            <p className="text-white/70 font-body leading-relaxed mb-4">
              Learning curves describe the empirical relationship between cumulative production volume and unit cost. For
              most manufactured goods and industrial processes, each doubling of cumulative production reduces unit costs
              by a consistent percentage called the learning rate. Solar PV has demonstrated a learning rate of approximately
              24 percent (costs decline 24 percent for every doubling of cumulative installed capacity). Lithium-ion
              batteries have shown a learning rate of approximately 18 percent. Wind energy has shown approximately 15
              percent.
            </p>
            <p className="text-white/70 font-body leading-relaxed mb-4">
              DAC is too early in its deployment to have a well-established empirical learning rate, but analogous industrial
              processes and expert elicitation suggest a learning rate of 15 to 20 percent is plausible. At a 15 percent
              learning rate, costs would decline from $500 to approximately $200 per tonne after 10 doublings of cumulative
              installed capacity (from approximately 25,000 tonnes per year to approximately 25 million tonnes per year).
              At a 20 percent learning rate, the same 10 doublings would bring costs to approximately $135 per tonne.
            </p>
            <p className="text-white/70 font-body leading-relaxed mb-6">
              Each major cost component has independent cost reduction pathways. Energy costs decline as renewable energy
              continues its own learning curve and as DAC systems become more energy-efficient through process optimization
              and heat integration. Capital costs decline through manufacturing scale-up (producing contactors and sorbent
              modules in automated factories rather than custom fabrication), standardized plant designs, and reduced
              engineering and construction costs through repetition. Sorbent costs decline through materials science
              breakthroughs that increase cycle life and reduce manufacturing cost per kilogram.
            </p>

            <h2 id="economies-of-scale" className="text-2xl font-bold text-white mt-12 mb-4">
              Economies of Scale
            </h2>
            <p className="text-white/70 font-body leading-relaxed mb-4">
              Beyond learning-by-doing, DAC benefits from classical economies of scale. Current facilities are small by
              industrial standards, with the largest operational plant (Climeworks Mammoth) at 36,000 tonnes per year.
              The under-construction STRATOS plant in Texas is designed for 500,000 tonnes per year, a 14-fold increase
              that should yield significant per-tonne cost reductions through larger equipment, shared infrastructure,
              and more efficient operations.
            </p>
            <p className="text-white/70 font-body leading-relaxed mb-6">
              Megaton-scale facilities (1 million tonnes per year and above) are expected to achieve further cost reductions
              through dedicated sorbent manufacturing co-located with the capture facility, optimized heat integration
              with industrial processes or geothermal sources, amortization of fixed costs (site development, permitting,
              monitoring infrastructure) over a larger production base, and more efficient utilization of skilled operating
              personnel.
            </p>

            <h2 id="policy-incentives" className="text-2xl font-bold text-white mt-12 mb-4">
              Policy Incentives: 45Q, EU ETS, and Beyond
            </h2>
            <p className="text-white/70 font-body leading-relaxed mb-4">
              Policy incentives are currently bridging the gap between DAC costs and buyer willingness to pay, enabling
              early deployments that move the technology down its learning curve.
            </p>

            <div className="my-8 overflow-x-auto">
              <table className="w-full text-sm font-body">
                <thead>
                  <tr className="border-b border-white/[0.1]">
                    <th className="text-left py-3 px-4 text-white/80 font-bold">Policy Mechanism</th>
                    <th className="text-left py-3 px-4 text-white/80 font-bold">Jurisdiction</th>
                    <th className="text-left py-3 px-4 text-white/80 font-bold">Value ($/tonne)</th>
                    <th className="text-left py-3 px-4 text-white/80 font-bold">Eligibility</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["45Q Tax Credit (IRA enhanced)", "United States", "$180", "DAC with geological storage"],
                    ["DOE DAC Hub Program", "United States", "$100-200 (grant)", "Large-scale DAC facilities"],
                    ["EU ETS (allowance price)", "European Union", "$60-80 (market)", "Included via CDR integration (planned)"],
                    ["EU Innovation Fund", "European Union", "$50-150 (grant)", "Innovative carbon removal projects"],
                    ["UK Carbon Removal Market", "United Kingdom", "$100-200 (target)", "Engineered removal (under development)"],
                    ["Canada CCUS Tax Credit", "Canada", "$60 (CAD)", "DAC with storage"],
                    ["Japan GX Investment", "Japan", "TBD", "Carbon removal technologies"],
                    ["UAE Carbon Credit Framework", "UAE / ADGM", "Market-based", "Verified removal credits"],
                  ].map(([policy, juris, val, elig], i) => (
                    <tr key={policy} className={`border-b border-white/[0.06] ${i % 2 === 0 ? "bg-white/[0.01]" : ""}`}>
                      <td className="py-3 px-4 text-white/80 font-medium">{policy}</td>
                      <td className="py-3 px-4 text-white/50">{juris}</td>
                      <td className="py-3 px-4 text-emerald-400/80">{val}</td>
                      <td className="py-3 px-4 text-white/50">{elig}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="text-white/70 font-body leading-relaxed mb-4">
              The US 45Q tax credit at $180 per tonne is the most significant policy driver globally. For a DAC facility
              with costs of $400 to $500 per tonne, the 45Q credit covers approximately 36 to 45 percent of the cost.
              Combined with voluntary market credit sales at $200 to $400 per tonne, early DAC projects can achieve economic
              viability even at current cost levels. This policy-market combination is enabling the first wave of commercial-scale
              deployments that will drive learning-curve cost reductions.
            </p>
            <p className="text-white/70 font-body leading-relaxed mb-6">
              The EU is developing its own framework for integrating carbon removal into the EU Emissions Trading System.
              When implemented, this would create additional demand from compliance buyers, potentially at prices that
              converge with or exceed voluntary market prices as allowance prices continue to rise.
            </p>

            <h2 id="cost-projections" className="text-2xl font-bold text-white mt-12 mb-4">
              Cost Projections by Technology
            </h2>

            <div className="my-8 overflow-x-auto">
              <table className="w-full text-sm font-body">
                <thead>
                  <tr className="border-b border-white/[0.1]">
                    <th className="text-left py-3 px-4 text-white/80 font-bold">Technology</th>
                    <th className="text-left py-3 px-4 text-white/80 font-bold">Current (2026)</th>
                    <th className="text-left py-3 px-4 text-white/80 font-bold">2030</th>
                    <th className="text-left py-3 px-4 text-white/80 font-bold">2035</th>
                    <th className="text-left py-3 px-4 text-white/80 font-bold">2040</th>
                    <th className="text-left py-3 px-4 text-white/80 font-bold">Permanence</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["DAC (Solid Sorbent)", "$400-600", "$150-250", "$80-150", "$50-100", "10,000+ years"],
                    ["DAC (Liquid Solvent)", "$350-500", "$130-200", "$70-130", "$40-90", "10,000+ years"],
                    ["Biochar", "$100-200", "$60-120", "$40-80", "$30-60", "100-1,000 years"],
                    ["Enhanced Weathering", "$75-200", "$50-120", "$30-80", "$20-50", "10,000+ years"],
                    ["BECCS", "$150-300", "$100-200", "$60-120", "$40-80", "10,000+ years"],
                    ["Ocean Alkalinity Enhancement", "$50-200", "$40-150", "$25-80", "$15-50", "10,000+ years"],
                  ].map(([tech, cur, y30, y35, y40, perm], i) => (
                    <tr key={tech} className={`border-b border-white/[0.06] ${i % 2 === 0 ? "bg-white/[0.01]" : ""}`}>
                      <td className="py-3 px-4 text-white/80 font-medium">{tech}</td>
                      <td className="py-3 px-4 text-red-400/80">{cur}</td>
                      <td className="py-3 px-4 text-amber-400/80">{y30}</td>
                      <td className="py-3 px-4 text-cyan-400/80">{y35}</td>
                      <td className="py-3 px-4 text-emerald-400/80">{y40}</td>
                      <td className="py-3 px-4 text-white/50">{perm}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h2 id="investment-landscape" className="text-2xl font-bold text-white mt-12 mb-4">
              Investment Landscape
            </h2>
            <p className="text-white/70 font-body leading-relaxed mb-4">
              Investment in carbon removal has accelerated dramatically. Total venture capital and growth equity investment
              in CDR companies exceeded $3 billion cumulatively through 2025, with significant participation from major
              climate-focused funds (Breakthrough Energy Ventures, Lowercarbon Capital), corporate venture arms (Microsoft
              Climate Innovation Fund, Stripe Climate), and sovereign wealth funds (including UAE&apos;s Masdar and ADIA).
            </p>
            <p className="text-white/70 font-body leading-relaxed mb-4">
              Project finance for DAC facilities is also emerging, though at an earlier stage. The combination of 45Q tax
              credits, long-term offtake agreements from corporate buyers (Frontier, NextGen), and government grants (DOE
              DAC Hubs) provides sufficient revenue certainty for project finance structures. Several DAC projects have
              secured debt financing in 2025, a milestone that indicates the sector is moving from venture to infrastructure.
            </p>
            <p className="text-white/70 font-body leading-relaxed mb-6">
              The investment thesis is straightforward: carbon removal is a market that does not exist at scale today but
              that science and policy mandate must exist at enormous scale within 25 years. Companies that achieve cost
              leadership through early deployment and learning-curve advancement will capture a disproportionate share of
              a market that could be worth hundreds of billions of dollars annually by mid-century.
            </p>

            <h2 id="willingness-to-pay" className="text-2xl font-bold text-white mt-12 mb-4">
              Buyer Willingness to Pay
            </h2>
            <p className="text-white/70 font-body leading-relaxed mb-4">
              The critical question for the economics of carbon removal is whether buyer willingness to pay will keep pace
              with the declining but still-elevated costs during the transition period. Current evidence is cautiously
              positive. Corporate advance purchase commitments through vehicles like Frontier (backed by Stripe, Alphabet,
              Meta, and others) have committed over $1 billion to purchase permanent carbon removal at prices up to $600
              per tonne. Microsoft has independently committed to purchasing sufficient removal credits to become carbon
              negative by 2030.
            </p>
            <p className="text-white/70 font-body leading-relaxed mb-6">
              As costs decline toward $100 to $200 per tonne, the addressable market expands dramatically. At $100 per
              tonne, the cost of offsetting a round-trip transatlantic flight (approximately 1 tonne of CO2) would be $100,
              a price point at which individual consumer and small-business demand becomes meaningful. At the corporate level,
              a company with 1 million tonnes of residual emissions would face a $100 million annual removal bill at $100
              per tonne, substantial but manageable for large multinationals already spending billions on sustainability
              initiatives.
            </p>

            <h2 id="conclusion" className="text-2xl font-bold text-white mt-12 mb-4">
              Conclusion
            </h2>
            <p className="text-white/70 font-body leading-relaxed mb-4">
              The economics of carbon removal are following a path that, while still early, is consistent with historical
              patterns of technology cost decline. Current costs are high but declining. Policy incentives are bridging
              the gap during the critical early-deployment phase. Investment capital is flowing in. And buyer demand at
              premium prices is providing the revenue needed to fund the deployments that will drive further cost reductions.
            </p>
            <p className="text-white/70 font-body leading-relaxed mb-8">
              The path from $600 per tonne to $100 per tonne is not guaranteed, but it is economically plausible and
              historically precedented. What the industry needs to traverse this path is exactly what it is beginning to
              receive: sustained investment, supportive policy, growing demand, and crucially, robust verification
              infrastructure that gives buyers confidence that every dollar spent on carbon removal produces a real,
              measurable, and permanent climate benefit.
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
