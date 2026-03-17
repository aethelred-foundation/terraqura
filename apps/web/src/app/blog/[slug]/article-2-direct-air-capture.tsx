"use client";

import Link from "next/link";
import { AnimatedSection } from "@/components/shared/AnimatedSection";

function MetricCard({ value, label }: { value: string; label: string }) {
  return (
    <div className="p-5 rounded-xl bg-white/[0.02] border border-white/[0.06] text-center">
      <div className="text-2xl font-bold text-cyan-400 mb-1">{value}</div>
      <div className="text-xs text-white/50 font-body">{label}</div>
    </div>
  );
}

function TableOfContents() {
  return (
    <nav className="p-5 rounded-xl bg-white/[0.02] border border-white/[0.06] mb-10" aria-label="Table of contents">
      <h2 className="text-sm font-bold text-white/80 uppercase tracking-wider mb-3">Contents</h2>
      <ul className="space-y-2 text-sm font-body">
        <li><a href="#why-dac" className="text-emerald-400 hover:text-emerald-300 transition-colors">Why Direct Air Capture Matters</a></li>
        <li><a href="#how-dac-works" className="text-emerald-400 hover:text-emerald-300 transition-colors">How DAC Works: Fundamental Principles</a></li>
        <li><a href="#solid-sorbent" className="text-emerald-400 hover:text-emerald-300 transition-colors">Solid Sorbent DAC</a></li>
        <li><a href="#liquid-solvent" className="text-emerald-400 hover:text-emerald-300 transition-colors">Liquid Solvent DAC</a></li>
        <li><a href="#energy-requirements" className="text-emerald-400 hover:text-emerald-300 transition-colors">Energy Requirements and Thermodynamics</a></li>
        <li><a href="#technology-comparison" className="text-emerald-400 hover:text-emerald-300 transition-colors">Technology Comparison</a></li>
        <li><a href="#global-capacity" className="text-emerald-400 hover:text-emerald-300 transition-colors">Current Global Capacity</a></li>
        <li><a href="#cost-trajectory" className="text-emerald-400 hover:text-emerald-300 transition-colors">Cost Trajectory and Projections</a></li>
        <li><a href="#verification-challenge" className="text-emerald-400 hover:text-emerald-300 transition-colors">The Verification Challenge</a></li>
        <li><a href="#conclusion" className="text-emerald-400 hover:text-emerald-300 transition-colors">Conclusion</a></li>
      </ul>
    </nav>
  );
}

export function Article2Content() {
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
              <span className="text-sm text-white/40 font-body">February 21, 2026</span>
            </div>
            <h1 id="article-heading" className="text-display-lg lg:text-display-xl text-white mb-6 leading-tight">
              Understanding Direct Air Capture: The Science Behind Pulling CO2 from Thin Air
            </h1>
            <p className="text-lg text-white/70 font-body leading-relaxed mb-8">
              Direct Air Capture technology removes CO2 directly from the atmosphere using chemical processes. We examine the science,
              energy requirements, costs, and the path to gigaton-scale deployment.
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
            <h2 id="why-dac" className="text-2xl font-bold text-white mt-12 mb-4">
              Why Direct Air Capture Matters
            </h2>
            <p className="text-white/70 font-body leading-relaxed mb-4">
              The Intergovernmental Panel on Climate Change (IPCC) has made it clear: limiting global warming to 1.5 degrees
              Celsius is not achievable through emissions reductions alone. Every modeled pathway to 1.5 degrees requires some
              form of carbon dioxide removal (CDR), with most scenarios requiring 5 to 16 gigatonnes of CO2 removal per year
              by 2050. Direct Air Capture is one of the few CDR technologies capable of scaling to meet that demand.
            </p>
            <p className="text-white/70 font-body leading-relaxed mb-4">
              Unlike nature-based removal (reforestation, soil carbon), DAC offers several distinct advantages. It requires
              minimal land area per tonne of CO2 removed. It can be located anywhere with access to energy, not constrained
              by geography or growing seasons. The CO2 it captures can be permanently stored in geological formations, unlike
              biogenic carbon which can be re-released through fire, disease, or land-use change. And its removal volumes
              are precisely measurable, a property that matters enormously for carbon credit integrity.
            </p>
            <p className="text-white/70 font-body leading-relaxed mb-6">
              The challenge, of course, is cost and energy. Capturing CO2 from ambient air, where it exists at a concentration
              of only about 420 parts per million (0.042%), is thermodynamically expensive. Understanding why requires examining
              the fundamental science.
            </p>

            <h2 id="how-dac-works" className="text-2xl font-bold text-white mt-12 mb-4">
              How DAC Works: Fundamental Principles
            </h2>
            <p className="text-white/70 font-body leading-relaxed mb-4">
              All DAC systems work on the same basic principle: they use a chemical sorbent that binds with CO2 molecules
              when exposed to ambient air, then they apply energy to release the captured CO2 in a concentrated stream that
              can be compressed and stored. The process is analogous to a sponge absorbing and then being wrung out, except
              the &quot;sponge&quot; is a chemical compound and the &quot;wringing&quot; is done with heat or pressure changes.
            </p>
            <p className="text-white/70 font-body leading-relaxed mb-4">
              The thermodynamic minimum energy required to separate CO2 from air is governed by the entropy of mixing. At
              atmospheric concentrations (approximately 420 ppm), this theoretical minimum is about 130 kWh per tonne of CO2.
              This is an absolute lower bound dictated by the second law of thermodynamics and cannot be reduced by any
              engineering improvement. In practice, real systems require 2 to 5 times this minimum, depending on the specific
              technology and operating conditions.
            </p>
            <p className="text-white/70 font-body leading-relaxed mb-6">
              Two primary approaches dominate the DAC landscape: solid sorbent systems and liquid solvent systems. Each has
              distinct chemical mechanisms, energy profiles, and scaling characteristics.
            </p>

            <h2 id="solid-sorbent" className="text-2xl font-bold text-white mt-12 mb-4">
              Solid Sorbent DAC
            </h2>
            <p className="text-white/70 font-body leading-relaxed mb-4">
              Solid sorbent systems, pioneered commercially by companies like Climeworks, use amine-functionalized solid
              materials that chemically bond with CO2 at ambient temperatures. Air is drawn through contactor units filled
              with these sorbent materials using large fans. Once the sorbent is saturated with CO2, the contactor is sealed
              and heated to 80 to 120 degrees Celsius, causing the CO2 to desorb in a concentrated stream. The sorbent is
              then cooled and exposed to air again, completing the cycle.
            </p>
            <p className="text-white/70 font-body leading-relaxed mb-4">
              The advantages of solid sorbent systems include relatively low regeneration temperatures (enabling the use of
              waste heat or low-grade geothermal energy), modular design that allows incremental scaling, and the ability to
              produce high-purity CO2 streams. The disadvantages include sorbent degradation over thousands of cycles,
              sensitivity to humidity (water competes with CO2 for binding sites on some sorbents), and the current high
              cost of manufacturing large quantities of sorbent material.
            </p>
            <p className="text-white/70 font-body leading-relaxed mb-6">
              Typical energy requirements for current commercial solid sorbent systems are 250 to 400 kWh of electrical energy
              and 1,200 to 1,800 kWh of thermal energy per tonne of CO2, for a total energy input of approximately 1,500 to
              2,200 kWh per tonne. The thermal component dominates, and the effective total depends heavily on the source
              and cost of thermal energy available at the site.
            </p>

            <h2 id="liquid-solvent" className="text-2xl font-bold text-white mt-12 mb-4">
              Liquid Solvent DAC
            </h2>
            <p className="text-white/70 font-body leading-relaxed mb-4">
              Liquid solvent systems, exemplified by Carbon Engineering (now part of Occidental Petroleum&apos;s 1PointFive
              subsidiary), use an aqueous solution of potassium hydroxide (KOH) to capture CO2 from air. Air contacts the
              solvent in large cooling-tower-like structures called air contactors. The KOH reacts with CO2 to form potassium
              carbonate (K2CO3). The carbonate solution is then processed through a causticization loop that regenerates
              the KOH and produces a solid calcium carbonate (CaCO3) precipitate. This precipitate is heated in a calciner
              to approximately 900 degrees Celsius, releasing concentrated CO2 and regenerating the calcium oxide.
            </p>
            <p className="text-white/70 font-body leading-relaxed mb-4">
              The primary advantage of liquid solvent systems is their potential for very large scale. The air contactor
              design can be scaled to enormous sizes, and the high-temperature calcination step, while energy-intensive, is
              well-understood industrial chemistry used in cement and lime production for over a century. The disadvantages
              include the very high regeneration temperatures required (necessitating natural gas or clean hydrogen combustion),
              water requirements for the solvent loop, and the capital intensity of the chemical processing plant.
            </p>
            <p className="text-white/70 font-body leading-relaxed mb-6">
              Energy requirements for liquid solvent systems are typically 200 to 350 kWh of electrical energy and 1,500 to
              2,400 kWh of thermal energy per tonne of CO2. The total energy input ranges from approximately 1,700 to 2,750
              kWh per tonne. The higher thermal requirement compared to solid sorbent systems is offset by the potential for
              larger individual plant capacity.
            </p>

            <h2 id="energy-requirements" className="text-2xl font-bold text-white mt-12 mb-4">
              Energy Requirements and Thermodynamics
            </h2>
            <p className="text-white/70 font-body leading-relaxed mb-4">
              Understanding why DAC requires so much energy begins with thermodynamics. CO2 in the atmosphere is extremely
              dilute, at 420 ppm, making up only 0.042% of air by volume. Separating a dilute component from a mixture
              always requires energy proportional to the logarithm of the dilution factor. This is why capturing CO2 from
              flue gas (where it exists at 10 to 15% concentration) requires roughly 10 times less energy per tonne than
              capturing it from ambient air.
            </p>
            <p className="text-white/70 font-body leading-relaxed mb-4">
              The gap between theoretical minimum (130 kWh/tonne) and practical requirement (1,500 to 2,750 kWh/tonne) is
              driven by several factors: the thermodynamics of the specific chemical reaction used (forming and breaking
              chemical bonds), heat losses in the regeneration step, fan energy to move enormous volumes of air through
              contactors (processing roughly 1.4 million cubic meters of air to capture one tonne of CO2), compression
              energy to pressurize the captured CO2 for pipeline transport or injection, and auxiliary energy for pumps,
              controls, and facility operations.
            </p>
            <p className="text-white/70 font-body leading-relaxed mb-6">
              The ratio of energy consumed to CO2 captured, typically expressed in kWh per tonne, is the single most
              important parameter in TerraQura&apos;s Proof-of-Physics verification system. This ratio, validated against
              thermodynamic models and measured by independent sensors, forms the backbone of the verification confidence
              score for every DAC-derived carbon credit.
            </p>

            {/* Technology comparison table */}
            <h2 id="technology-comparison" className="text-2xl font-bold text-white mt-12 mb-4">
              Technology Comparison
            </h2>

            <div className="my-8 overflow-x-auto">
              <table className="w-full text-sm font-body">
                <thead>
                  <tr className="border-b border-white/[0.1]">
                    <th className="text-left py-3 px-4 text-white/80 font-bold">Parameter</th>
                    <th className="text-left py-3 px-4 text-white/80 font-bold">Solid Sorbent</th>
                    <th className="text-left py-3 px-4 text-white/80 font-bold">Liquid Solvent</th>
                    <th className="text-left py-3 px-4 text-white/80 font-bold">Electrochemical (Emerging)</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["Sorbent/Solvent", "Amine-functionalized solids", "Potassium hydroxide (KOH)", "Ion exchange membranes"],
                    ["Regeneration Temperature", "80-120 C", "~900 C (calciner)", "Ambient (electrical)"],
                    ["Electrical Energy", "250-400 kWh/t", "200-350 kWh/t", "400-800 kWh/t"],
                    ["Thermal Energy", "1,200-1,800 kWh/t", "1,500-2,400 kWh/t", "Near zero"],
                    ["Total Energy", "1,500-2,200 kWh/t", "1,700-2,750 kWh/t", "400-800 kWh/t"],
                    ["Water Requirement", "Low to moderate", "Moderate to high", "Low"],
                    ["Plant Scale (Current)", "4,000-36,000 t/yr", "500,000-1,000,000 t/yr", "Lab to pilot scale"],
                    ["Sorbent Lifetime", "3,000-10,000 cycles", "Not applicable (liquid)", "Under development"],
                    ["CO2 Purity", "> 99%", "> 99%", "> 95%"],
                    ["Technology Readiness", "TRL 7-9 (commercial)", "TRL 6-8 (demonstration)", "TRL 3-5 (pilot)"],
                    ["Key Players", "Climeworks, Global Thermostat", "Carbon Engineering / 1PointFive", "Verdox, Mission Zero"],
                  ].map(([param, solid, liquid, electro], i) => (
                    <tr key={param} className={`border-b border-white/[0.06] ${i % 2 === 0 ? "bg-white/[0.01]" : ""}`}>
                      <td className="py-3 px-4 text-white/80 font-medium">{param}</td>
                      <td className="py-3 px-4 text-white/50">{solid}</td>
                      <td className="py-3 px-4 text-white/50">{liquid}</td>
                      <td className="py-3 px-4 text-white/50">{electro}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h2 id="global-capacity" className="text-2xl font-bold text-white mt-12 mb-4">
              Current Global Capacity
            </h2>
            <p className="text-white/70 font-body leading-relaxed mb-4">
              As of early 2026, global operational DAC capacity is approximately 25,000 to 30,000 tonnes of CO2 per year. This
              is distributed across roughly 30 facilities worldwide, with the majority of capacity concentrated in a handful
              of larger plants. Climeworks&apos; Mammoth plant in Iceland, which began operations in mid-2024, has a design
              capacity of 36,000 tonnes per year (though it operated at partial capacity through its first year). Several smaller
              Climeworks plants in Switzerland and Iceland add an additional 5,000 to 8,000 tonnes of combined capacity.
            </p>
            <p className="text-white/70 font-body leading-relaxed mb-4">
              The pipeline of announced projects is substantially larger. Occidental Petroleum&apos;s STRATOS project in Texas,
              under construction since 2022, is designed for 500,000 tonnes per year and represents a step-change in scale
              for the industry. Several additional megaton-scale projects have been announced in the United States (supported
              by the 45Q tax credit and DOE DAC Hub program), the Middle East, and northern Europe.
            </p>
            <p className="text-white/70 font-body leading-relaxed mb-6">
              If all announced projects are built on schedule, global DAC capacity could reach 5 to 10 million tonnes per year
              by 2030. This is still less than 0.1% of the removal needed by 2050, illustrating the enormous scale-up required.
            </p>

            {/* Cost metrics */}
            <h2 id="cost-trajectory" className="text-2xl font-bold text-white mt-12 mb-4">
              Cost Trajectory and Projections
            </h2>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 my-8">
              <MetricCard value="$400-600" label="Current cost per tonne (2026)" />
              <MetricCard value="$150-250" label="Projected cost by 2030" />
              <MetricCard value="$80-150" label="Projected cost by 2035" />
              <MetricCard value="$50-100" label="Long-term target (2040+)" />
            </div>

            <p className="text-white/70 font-body leading-relaxed mb-4">
              The cost of DAC has been declining steadily, following a learning curve with a learning rate of approximately
              15 to 20 percent (meaning costs decline 15 to 20 percent for every doubling of cumulative installed capacity).
              This is comparable to the early-stage learning rates observed for solar PV and lithium-ion batteries, though
              DAC is still far earlier on its learning curve.
            </p>
            <p className="text-white/70 font-body leading-relaxed mb-4">
              Current costs are dominated by three factors: energy (30 to 40 percent of total cost), capital equipment
              (30 to 40 percent), and sorbent/solvent replacement (10 to 20 percent). Each of these components has independent
              reduction pathways. Energy costs decline as renewable energy gets cheaper and waste heat integration improves.
              Capital costs decline through manufacturing optimization and economies of scale. Sorbent costs decline through
              materials science breakthroughs and longer sorbent lifetimes.
            </p>
            <p className="text-white/70 font-body leading-relaxed mb-6">
              Policy support, particularly the US 45Q tax credit (which provides $180 per tonne of CO2 permanently stored
              through DAC) and emerging EU mechanisms, is bridging the gap between current costs and market willingness to
              pay. This support is critical for the industry to move down the learning curve quickly enough to meet climate
              targets.
            </p>

            <h2 id="verification-challenge" className="text-2xl font-bold text-white mt-12 mb-4">
              The Verification Challenge
            </h2>
            <p className="text-white/70 font-body leading-relaxed mb-4">
              As DAC scales, so does the verification challenge. A single megaton-scale plant processes roughly 1.4 billion
              cubic meters of air per year and consumes hundreds of gigawatt-hours of energy. Verifying that the claimed CO2
              removal is real, additional, and permanent requires continuous monitoring of energy inputs, CO2 outputs, and
              storage integrity.
            </p>
            <p className="text-white/70 font-body leading-relaxed mb-4">
              Traditional MRV approaches were not designed for this scale or complexity. They were developed for nature-based
              projects where annual field visits and satellite imagery were sufficient. DAC verification requires real-time
              monitoring of industrial processes, thermodynamic validation of energy-CO2 relationships, and continuous
              assurance that the captured CO2 is being permanently stored rather than used in applications where it might
              be re-emitted.
            </p>
            <p className="text-white/70 font-body leading-relaxed mb-6">
              This is precisely the problem Proof-of-Physics was designed to solve. By instrumenting DAC facilities with
              sensor arrays and validating capture claims against thermodynamic models in real time, TerraQura provides
              the verification infrastructure that DAC needs to scale with market confidence.
            </p>

            <h2 id="conclusion" className="text-2xl font-bold text-white mt-12 mb-4">
              Conclusion
            </h2>
            <p className="text-white/70 font-body leading-relaxed mb-4">
              Direct Air Capture is not a silver bullet for climate change. It is one tool among many, and it will be most
              effective when combined with aggressive emissions reductions, nature-based solutions, and other removal
              technologies. But it is a uniquely powerful tool because of its scalability, permanence, and measurability.
            </p>
            <p className="text-white/70 font-body leading-relaxed mb-8">
              The path from today&apos;s 25,000 tonnes per year to the gigatonnes per year needed by mid-century will require
              sustained investment, continued technological innovation, supportive policy frameworks, and crucially, robust
              verification systems that ensure every tonne claimed is a tonne removed. TerraQura is building the verification
              layer that makes this scale-up trustworthy.
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
