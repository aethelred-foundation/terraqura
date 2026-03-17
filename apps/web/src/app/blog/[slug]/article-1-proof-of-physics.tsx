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
        <li><a href="#crisis-of-trust" className="text-emerald-400 hover:text-emerald-300 transition-colors">The Crisis of Trust in Carbon Markets</a></li>
        <li><a href="#what-is-pop" className="text-emerald-400 hover:text-emerald-300 transition-colors">What Is Proof-of-Physics?</a></li>
        <li><a href="#how-it-works" className="text-emerald-400 hover:text-emerald-300 transition-colors">How Proof-of-Physics Works</a></li>
        <li><a href="#mathematical-validation" className="text-emerald-400 hover:text-emerald-300 transition-colors">Mathematical Validation Framework</a></li>
        <li><a href="#comparison" className="text-emerald-400 hover:text-emerald-300 transition-colors">Traditional MRV vs Proof-of-Physics</a></li>
        <li><a href="#verification-accuracy" className="text-emerald-400 hover:text-emerald-300 transition-colors">Verification Accuracy Improvements</a></li>
        <li><a href="#implications" className="text-emerald-400 hover:text-emerald-300 transition-colors">Implications for Carbon Markets</a></li>
        <li><a href="#conclusion" className="text-emerald-400 hover:text-emerald-300 transition-colors">Conclusion</a></li>
      </ul>
    </nav>
  );
}

export function Article1Content() {
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
              <span className="text-sm text-white/40 font-body">12 min read</span>
              <span className="text-sm text-white/40 font-body">February 24, 2026</span>
            </div>
            <h1 id="article-heading" className="text-display-lg lg:text-display-xl text-white mb-6 leading-tight">
              What Is Proof-of-Physics? The Verification Standard Carbon Markets Need
            </h1>
            <p className="text-lg text-white/70 font-body leading-relaxed mb-8">
              Traditional MRV systems rely on manual audits and self-reported data, creating a trust deficit in carbon markets.
              Proof-of-Physics replaces estimation with mathematical certainty through real-time IoT sensor validation.
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
            {/* Section 1 */}
            <h2 id="crisis-of-trust" className="text-2xl font-bold text-white mt-12 mb-4">
              The Crisis of Trust in Carbon Markets
            </h2>
            <p className="text-white/70 font-body leading-relaxed mb-4">
              The voluntary carbon market was built on a foundational assumption: that third-party auditors could reliably verify
              whether a carbon credit represents a genuine tonne of CO2 removed or avoided. For decades, this assumption has gone
              largely unchallenged, despite mounting evidence that the system is deeply flawed.
            </p>
            <p className="text-white/70 font-body leading-relaxed mb-4">
              In 2023, a series of investigative reports revealed that major carbon credit registries had certified millions of
              credits tied to projects with questionable or exaggerated climate benefits. Forest conservation projects claimed
              reductions in deforestation that were never at risk. Cookstove projects reported emission reductions based on
              theoretical usage patterns rather than actual deployment data. The problem was not fraud in most cases, but something
              more systemic: Measurement, Reporting, and Verification (MRV) systems that were structurally incapable of producing
              reliable data at scale.
            </p>
            <p className="text-white/70 font-body leading-relaxed mb-4">
              Traditional MRV depends on periodic site visits, self-reported data from project developers, and desktop reviews
              by auditing firms. Verification cycles take 12 to 18 months. Data is sampled rather than continuously monitored.
              And the entire process creates a principal-agent problem: the entities generating credits are the same entities
              reporting the data that validates those credits.
            </p>
            <p className="text-white/70 font-body leading-relaxed mb-6">
              The result is a market where buyers cannot independently verify the quality of what they are purchasing. This
              uncertainty suppresses demand, depresses prices, and ultimately undermines the capital flows needed to fund real
              climate solutions. The carbon market does not need incremental improvement to its verification processes. It needs a
              fundamentally different approach.
            </p>

            {/* Section 2 */}
            <h2 id="what-is-pop" className="text-2xl font-bold text-white mt-12 mb-4">
              What Is Proof-of-Physics?
            </h2>
            <p className="text-white/70 font-body leading-relaxed mb-4">
              Proof-of-Physics (PoP) is a verification methodology that replaces human-mediated auditing with continuous,
              sensor-driven validation grounded in thermodynamic principles. Rather than asking &quot;did someone report that this
              carbon was removed?&quot; it asks &quot;do the physical measurements from independent sensors confirm that the laws of
              thermodynamics were satisfied for the claimed removal?&quot;
            </p>
            <p className="text-white/70 font-body leading-relaxed mb-4">
              The core insight is straightforward: carbon capture and removal processes are governed by well-understood physics.
              Direct Air Capture (DAC) systems, for example, must consume a minimum amount of energy per tonne of CO2 captured,
              dictated by the thermodynamic minimum of separating CO2 from ambient air (roughly 130 kWh/tonne at the theoretical
              limit, with real-world systems requiring 200 to 600 kWh/tonne depending on the technology). The relationship between
              energy consumed, CO2 concentration differentials, temperature, pressure, and flow rates follows predictable equations.
            </p>
            <p className="text-white/70 font-body leading-relaxed mb-4">
              If a DAC facility claims to have captured 1,000 tonnes of CO2 but its energy consumption records show only enough
              energy to capture 400 tonnes, no amount of paperwork can reconcile that discrepancy. Physics does not negotiate.
              Proof-of-Physics leverages this principle by instrumenting capture facilities with arrays of calibrated IoT sensors
              that continuously measure the physical parameters governing the capture process. These measurements are then validated
              against thermodynamic models in real time, and only when the physics checks out is a credit eligible for minting.
            </p>
            <p className="text-white/70 font-body leading-relaxed mb-6">
              This approach shifts verification from a trust-based system (trusting reports and auditors) to an evidence-based
              system (trusting measurements and physics). It is not an incremental improvement over traditional MRV. It is a
              category change in how verification works.
            </p>

            {/* Section 3 */}
            <h2 id="how-it-works" className="text-2xl font-bold text-white mt-12 mb-4">
              How Proof-of-Physics Works: The Three Phases
            </h2>
            <p className="text-white/70 font-body leading-relaxed mb-6">
              TerraQura&apos;s implementation of Proof-of-Physics operates across three distinct phases: Capture, Compute, and Mint.
              Each phase has specific technical requirements and verification gates.
            </p>

            {/* Phase diagram */}
            <div className="my-8 p-6 rounded-xl bg-white/[0.02] border border-white/[0.06]">
              <div className="text-sm font-bold text-white/80 mb-4 uppercase tracking-wider">Verification Pipeline</div>
              <div className="grid md:grid-cols-3 gap-4">
                <div className="p-4 rounded-lg bg-emerald-500/[0.05] border border-emerald-500/20">
                  <div className="text-emerald-400 font-bold text-sm mb-2">Phase 1: CAPTURE</div>
                  <ul className="text-xs text-white/60 font-body space-y-1">
                    <li>IoT sensor data collection</li>
                    <li>CO2 flow, temp, pressure, humidity</li>
                    <li>Edge node aggregation</li>
                    <li>Tamper detection checksums</li>
                    <li>Real-time telemetry streaming</li>
                  </ul>
                </div>
                <div className="p-4 rounded-lg bg-cyan-500/[0.05] border border-cyan-500/20">
                  <div className="text-cyan-400 font-bold text-sm mb-2">Phase 2: COMPUTE</div>
                  <ul className="text-xs text-white/60 font-body space-y-1">
                    <li>Thermodynamic model validation</li>
                    <li>Energy-to-CO2 ratio verification</li>
                    <li>Cross-sensor consistency checks</li>
                    <li>Anomaly detection algorithms</li>
                    <li>Confidence score calculation</li>
                  </ul>
                </div>
                <div className="p-4 rounded-lg bg-amber-500/[0.05] border border-amber-500/20">
                  <div className="text-amber-400 font-bold text-sm mb-2">Phase 3: MINT</div>
                  <ul className="text-xs text-white/60 font-body space-y-1">
                    <li>Verification proof generation</li>
                    <li>On-chain attestation</li>
                    <li>ERC-1155 token minting</li>
                    <li>Metadata IPFS anchoring</li>
                    <li>Registry cross-reference</li>
                  </ul>
                </div>
              </div>
            </div>

            <h3 className="text-xl font-bold text-white mt-8 mb-3">Phase 1: Capture</h3>
            <p className="text-white/70 font-body leading-relaxed mb-4">
              The Capture phase instruments the physical removal process with calibrated sensor arrays. For a DAC facility,
              this typically includes: mass flow meters measuring CO2-enriched airflow at the inlet and outlet, temperature and
              pressure sensors at key points in the capture cycle, energy meters tracking electricity consumption in real time,
              humidity sensors monitoring ambient conditions, and concentration analyzers measuring CO2 purity in the output stream.
            </p>
            <p className="text-white/70 font-body leading-relaxed mb-4">
              Sensors report data to tamper-resistant edge computing nodes every 30 seconds. Each reading is cryptographically
              signed at the sensor level and timestamped using GPS-synchronized clocks. The edge nodes perform initial data
              validation, checking for sensor drift, impossible values, and communication anomalies, before transmitting
              aggregated data packets to the TerraQura verification engine.
            </p>

            <h3 className="text-xl font-bold text-white mt-8 mb-3">Phase 2: Compute</h3>
            <p className="text-white/70 font-body leading-relaxed mb-4">
              The Compute phase runs the collected sensor data through a battery of thermodynamic validation models. The
              primary validation checks whether the energy consumed is consistent with the CO2 captured, given the ambient
              conditions and the known efficiency characteristics of the capture technology being used. Secondary validations
              cross-reference individual sensor readings against each other to detect inconsistencies.
            </p>
            <p className="text-white/70 font-body leading-relaxed mb-4">
              For example, if a temperature sensor at the absorption column reports 85 degrees Celsius but the energy consumption
              data implies the column should be at 120 degrees Celsius for the claimed capture rate, the system flags a discrepancy.
              These cross-checks create a web of mutually reinforcing measurements that is extremely difficult to fabricate.
            </p>
            <p className="text-white/70 font-body leading-relaxed mb-4">
              The output of the Compute phase is a verification confidence score between 0 and 1. Only batches achieving a
              confidence score above 0.95 are eligible for credit minting. Batches scoring between 0.85 and 0.95 are flagged
              for secondary review. Anything below 0.85 is rejected.
            </p>

            <h3 className="text-xl font-bold text-white mt-8 mb-3">Phase 3: Mint</h3>
            <p className="text-white/70 font-body leading-relaxed mb-6">
              Verified batches trigger the Mint phase, where the computed verification proof is committed to the Aethelred
              blockchain. The proof includes a cryptographic hash of all sensor data, the computed CO2 quantity, the confidence
              score, and references to the validation models used. An ERC-1155 token is minted representing the verified carbon
              credit, with all verification metadata embedded in the token&apos;s URI (stored on IPFS for immutability). The entire
              chain of evidence, from raw sensor readings to minted credit, is auditable by any party with blockchain access.
            </p>

            {/* Section 4 */}
            <h2 id="mathematical-validation" className="text-2xl font-bold text-white mt-12 mb-4">
              Mathematical Validation Framework
            </h2>
            <p className="text-white/70 font-body leading-relaxed mb-4">
              The mathematical foundation of Proof-of-Physics rests on energy balance equations derived from the first and
              second laws of thermodynamics. For a DAC system, the minimum thermodynamic work required to separate CO2 from
              ambient air is defined by the Gibbs free energy of mixing. At standard conditions with an atmospheric CO2
              concentration of approximately 420 ppm, this theoretical minimum is roughly 130 kWh per tonne of CO2.
            </p>
            <p className="text-white/70 font-body leading-relaxed mb-4">
              Real-world systems operate far above this minimum due to irreversibilities, heat losses, and mechanical
              inefficiencies. Current solid-sorbent DAC systems typically require 250 to 400 kWh of electrical energy and
              1,200 to 1,800 kWh of thermal energy per tonne of CO2. Liquid-solvent systems require 200 to 350 kWh of
              electrical energy and 1,500 to 2,400 kWh of thermal energy. These ranges are well-characterized for each
              technology type and provide the basis for validation bounds.
            </p>
            <p className="text-white/70 font-body leading-relaxed mb-4">
              The PoP engine maintains calibrated models for each supported capture technology. When sensor data arrives, the
              engine computes the expected CO2 capture given the measured energy input, ambient conditions, and known system
              parameters. If the reported capture falls within the expected range (accounting for measurement uncertainty), the
              batch passes validation. If it falls outside the expected range, it is flagged or rejected.
            </p>

            {/* Formula display */}
            <div className="my-8 p-6 rounded-xl bg-white/[0.02] border border-white/[0.06]">
              <div className="text-sm font-bold text-white/80 mb-3 uppercase tracking-wider">Core Validation Equation</div>
              <div className="font-mono text-emerald-400 text-sm mb-4 overflow-x-auto">
                <div className="mb-2">C_verified = E_measured / (SHR_technology * (1 + uncertainty_margin))</div>
                <div className="mb-2">where:</div>
                <div className="ml-4 text-white/60 space-y-1">
                  <div>C_verified = verified CO2 capture (tonnes)</div>
                  <div>E_measured = total measured energy input (kWh)</div>
                  <div>SHR_technology = specific heat requirement for technology type (kWh/tonne)</div>
                  <div>uncertainty_margin = sensor uncertainty factor (typically 0.03 to 0.05)</div>
                </div>
              </div>
              <p className="text-xs text-white/50 font-body">
                This simplified equation represents the primary validation check. The full model includes corrections for ambient
                temperature, pressure, humidity, and technology-specific parameters.
              </p>
            </div>

            <p className="text-white/70 font-body leading-relaxed mb-6">
              The critical advantage of this approach is that it is falsifiable. Any claimed CO2 capture that violates known
              thermodynamic relationships is automatically rejected, regardless of who submitted it or what documentation
              accompanies it. This makes the system resistant to both intentional fraud and unintentional over-estimation.
            </p>

            {/* Section 5: Comparison Table */}
            <h2 id="comparison" className="text-2xl font-bold text-white mt-12 mb-4">
              Traditional MRV vs Proof-of-Physics
            </h2>
            <p className="text-white/70 font-body leading-relaxed mb-6">
              The differences between traditional MRV and Proof-of-Physics are not merely procedural. They represent
              fundamentally different epistemic approaches to verification.
            </p>

            <div className="my-8 overflow-x-auto">
              <table className="w-full text-sm font-body">
                <thead>
                  <tr className="border-b border-white/[0.1]">
                    <th className="text-left py-3 px-4 text-white/80 font-bold">Dimension</th>
                    <th className="text-left py-3 px-4 text-white/80 font-bold">Traditional MRV</th>
                    <th className="text-left py-3 px-4 text-emerald-400 font-bold">Proof-of-Physics</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["Data Source", "Self-reported by project developer", "Independent IoT sensor arrays"],
                    ["Verification Frequency", "Annual or biennial audits", "Continuous (30-second intervals)"],
                    ["Time to Verification", "12-18 months", "Near real-time (< 24 hours)"],
                    ["Basis of Trust", "Auditor reputation", "Thermodynamic laws"],
                    ["Fraud Detection", "Post-hoc investigation", "Real-time anomaly detection"],
                    ["Data Transparency", "Reports available to registries", "All data on-chain, publicly auditable"],
                    ["Cost of Verification", "$15,000-50,000 per audit cycle", "$0.50-2.00 per tonne (amortized sensor cost)"],
                    ["Scalability", "Limited by auditor availability", "Limited only by sensor deployment"],
                    ["Measurement Uncertainty", "Often unquantified", "Quantified per-sensor, propagated through model"],
                    ["Cross-validation", "Single auditor opinion", "Multi-sensor redundancy with consistency checks"],
                  ].map(([dim, trad, pop], i) => (
                    <tr key={dim} className={`border-b border-white/[0.06] ${i % 2 === 0 ? "bg-white/[0.01]" : ""}`}>
                      <td className="py-3 px-4 text-white/80 font-medium">{dim}</td>
                      <td className="py-3 px-4 text-white/50">{trad}</td>
                      <td className="py-3 px-4 text-emerald-400/80">{pop}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Section 6: Metrics */}
            <h2 id="verification-accuracy" className="text-2xl font-bold text-white mt-12 mb-4">
              Verification Accuracy Improvements
            </h2>
            <p className="text-white/70 font-body leading-relaxed mb-6">
              Internal testing and simulation data from TerraQura&apos;s pilot deployments demonstrate significant improvements
              in verification accuracy and speed compared to traditional approaches.
            </p>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 my-8">
              <MetricCard value="99.2%" label="Sensor data uptime in pilot deployments" />
              <MetricCard value="< 24h" label="Time from capture to verified credit" />
              <MetricCard value="3-5%" label="Measurement uncertainty (vs 20-40% for traditional MRV)" />
              <MetricCard value="0" label="Undetected anomalies in adversarial testing" />
            </div>

            <p className="text-white/70 font-body leading-relaxed mb-4">
              The reduction in measurement uncertainty from a typical 20 to 40 percent range in traditional MRV to 3 to 5 percent
              in Proof-of-Physics is perhaps the most consequential improvement. High measurement uncertainty means that a credit
              claiming to represent one tonne of CO2 might actually represent anywhere from 0.6 to 1.4 tonnes. This uncertainty
              is priced into the market, depressing credit values. By narrowing uncertainty to known sensor tolerances,
              Proof-of-Physics enables carbon credits that buyers can trust at face value.
            </p>
            <p className="text-white/70 font-body leading-relaxed mb-6">
              The speed improvement is equally important. Traditional MRV cycles of 12 to 18 months create a massive lag
              between carbon removal and credit issuance. This lag ties up capital, creates financing challenges for project
              developers, and introduces vintage risk for buyers. Near-real-time verification eliminates this friction, making
              carbon removal projects more bankable and credits more liquid.
            </p>

            {/* Section 7 */}
            <h2 id="implications" className="text-2xl font-bold text-white mt-12 mb-4">
              Implications for Carbon Markets
            </h2>
            <p className="text-white/70 font-body leading-relaxed mb-4">
              Proof-of-Physics does not merely improve verification accuracy. It changes the economic structure of carbon
              markets in several important ways. First, it eliminates the information asymmetry between credit sellers and
              buyers. When all verification data is on-chain and all validation logic is auditable, buyers can independently
              assess credit quality without relying on the seller or a third-party auditor. This transparency should, over time,
              create a price premium for physics-verified credits.
            </p>
            <p className="text-white/70 font-body leading-relaxed mb-4">
              Second, it reduces verification costs at scale. The primary cost of Proof-of-Physics is the sensor infrastructure,
              which is a capital expenditure that amortizes over the life of the facility. Marginal verification costs per tonne
              are near zero, unlike traditional MRV where each audit cycle incurs significant consulting fees. This makes
              Proof-of-Physics particularly advantageous for large-scale facilities.
            </p>
            <p className="text-white/70 font-body leading-relaxed mb-4">
              Third, it enables new financial instruments. Continuous verification data can support real-time carbon pricing,
              streaming payments tied to verified removal rates, and derivatives based on verified removal volumes. These
              instruments cannot exist in a world where verification takes 18 months and has 40 percent uncertainty.
            </p>
            <p className="text-white/70 font-body leading-relaxed mb-6">
              Finally, it creates a pathway to regulatory acceptance. Compliance carbon markets have historically resisted
              accepting voluntary market credits due to quality concerns. A verification standard grounded in physics and
              producing quantified uncertainty bounds is far more compatible with regulatory requirements than one based on
              auditor judgment calls.
            </p>

            {/* Conclusion */}
            <h2 id="conclusion" className="text-2xl font-bold text-white mt-12 mb-4">
              Conclusion
            </h2>
            <p className="text-white/70 font-body leading-relaxed mb-4">
              The carbon market&apos;s credibility problem is not a communication problem or a branding problem. It is a
              measurement problem. And measurement problems require measurement solutions. Proof-of-Physics provides that
              solution by anchoring carbon credit verification to the one authority that cannot be corrupted, lobbied, or
              influenced: the laws of thermodynamics.
            </p>
            <p className="text-white/70 font-body leading-relaxed mb-8">
              As carbon removal scales from thousands of tonnes per year to millions and eventually billions, the verification
              infrastructure must scale with it. Manual auditing cannot scale. Physics-based, sensor-driven, automated
              verification can. TerraQura is building that infrastructure, and Proof-of-Physics is its foundation.
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

          {/* Back link */}
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
