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
        <li><a href="#uae-net-zero" className="text-emerald-400 hover:text-emerald-300 transition-colors">UAE Net Zero 2050: The National Strategy</a></li>
        <li><a href="#abu-dhabi-ecosystem" className="text-emerald-400 hover:text-emerald-300 transition-colors">Abu Dhabi&apos;s Climate Tech Ecosystem</a></li>
        <li><a href="#adgm-sandbox" className="text-emerald-400 hover:text-emerald-300 transition-colors">ADGM Regulatory Sandbox</a></li>
        <li><a href="#masdar" className="text-emerald-400 hover:text-emerald-300 transition-colors">Masdar City and Clean Energy</a></li>
        <li><a href="#dac-projects" className="text-emerald-400 hover:text-emerald-300 transition-colors">Regional DAC and CCUS Projects</a></li>
        <li><a href="#investment-data" className="text-emerald-400 hover:text-emerald-300 transition-colors">UAE Climate Investment Data</a></li>
        <li><a href="#terraqura-role" className="text-emerald-400 hover:text-emerald-300 transition-colors">TerraQura&apos;s Role in the Ecosystem</a></li>
        <li><a href="#global-positioning" className="text-emerald-400 hover:text-emerald-300 transition-colors">Global Positioning and Partnerships</a></li>
        <li><a href="#conclusion" className="text-emerald-400 hover:text-emerald-300 transition-colors">Conclusion</a></li>
      </ul>
    </nav>
  );
}

export function Article10Content() {
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
              <span className="text-sm text-white/40 font-body">12 min read</span>
              <span className="text-sm text-white/40 font-body">January 27, 2026</span>
            </div>
            <h1 id="article-heading" className="text-display-lg lg:text-display-xl text-white mb-6 leading-tight">
              Abu Dhabi&apos;s Climate Tech Vision: How the UAE Is Leading Carbon Innovation
            </h1>
            <p className="text-lg text-white/70 font-body leading-relaxed mb-8">
              From the UAE Net Zero 2050 strategy to ADGM regulatory sandboxes and Masdar City, Abu Dhabi is positioning
              itself as the global hub for climate technology and carbon market infrastructure.
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
            <h2 id="uae-net-zero" className="text-2xl font-bold text-white mt-12 mb-4">
              UAE Net Zero 2050: The National Strategy
            </h2>
            <p className="text-white/70 font-body leading-relaxed mb-4">
              In October 2021, the UAE became the first Middle Eastern nation to announce a net-zero emissions target for
              2050. This commitment, made just weeks before the UAE was confirmed as host of COP28, signaled a fundamental
              strategic pivot for one of the world&apos;s largest oil-producing nations. The net-zero strategy was not merely
              a diplomatic gesture. It was backed by a detailed implementation roadmap spanning energy, industry, transport,
              waste, and agriculture, with over $160 billion in planned investments.
            </p>
            <p className="text-white/70 font-body leading-relaxed mb-4">
              The strategy recognizes that the UAE&apos;s economic diversification and its energy transition are not separate
              goals but interconnected imperatives. By building world-class capabilities in clean energy, carbon management,
              and climate technology, the UAE is positioning itself to remain a global energy leader in a decarbonizing world,
              not despite the energy transition but because of the capabilities it develops in managing it.
            </p>
            <p className="text-white/70 font-body leading-relaxed mb-6">
              Carbon capture, utilization, and storage (CCUS) features prominently in the strategy. The UAE plans to capture
              and store over 10 million tonnes of CO2 annually by 2030, rising to 60 million tonnes by 2040 and over 100
              million tonnes by 2050. These volumes would make the UAE one of the largest CCUS operators in the world, and
              they create an enormous demand for robust verification infrastructure, exactly the kind of infrastructure
              TerraQura is building.
            </p>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 my-8">
              <MetricCard value="$163B" label="Planned clean energy investment by 2050" />
              <MetricCard value="100Mt" label="Annual CO2 capture target by 2050" />
              <MetricCard value="2050" label="Net Zero target year" />
              <MetricCard value="COP28" label="Hosted in Dubai, 2023" />
            </div>

            <h2 id="abu-dhabi-ecosystem" className="text-2xl font-bold text-white mt-12 mb-4">
              Abu Dhabi&apos;s Climate Tech Ecosystem
            </h2>
            <p className="text-white/70 font-body leading-relaxed mb-4">
              Abu Dhabi has built one of the most comprehensive climate technology ecosystems in the world, combining
              sovereign wealth capital, regulatory innovation, research institutions, and physical infrastructure. The
              emirate&apos;s approach is distinctive in several respects.
            </p>
            <p className="text-white/70 font-body leading-relaxed mb-4">
              Capital availability is perhaps the most obvious advantage. Abu Dhabi&apos;s sovereign wealth funds, notably
              the Abu Dhabi Investment Authority (ADIA) and Mubadala Investment Company, have allocated increasing
              portions of their portfolios to climate technology. Mubadala&apos;s subsidiary Masdar has become one of the
              world&apos;s largest clean energy developers, with over 20 GW of renewable capacity globally. ADIA has invested
              in carbon capture technology through both direct investments and fund commitments.
            </p>
            <p className="text-white/70 font-body leading-relaxed mb-4">
              The regulatory environment is equally important. The Abu Dhabi Global Market (ADGM), the emirate&apos;s
              international financial center, has established itself as one of the most progressive regulatory bodies
              for digital assets and climate finance. ADGM&apos;s regulatory sandbox allows companies to test innovative
              financial products, including tokenized carbon credits and blockchain-based registries, in a controlled
              environment with regulatory guidance.
            </p>
            <p className="text-white/70 font-body leading-relaxed mb-6">
              Physical infrastructure, including Masdar City (the world&apos;s first planned sustainable city), the
              Mohammed bin Zayed University of Artificial Intelligence (MBZUAI), the Khalifa University Center for
              Catalysis and Separation, and the International Renewable Energy Agency (IRENA) headquarters, provides the
              research, talent, and operational base for climate technology development.
            </p>

            <h2 id="adgm-sandbox" className="text-2xl font-bold text-white mt-12 mb-4">
              ADGM Regulatory Sandbox
            </h2>
            <p className="text-white/70 font-body leading-relaxed mb-4">
              The Abu Dhabi Global Market has been a pioneer in creating regulatory frameworks for digital assets and
              climate finance. ADGM&apos;s approach is characterized by engagement rather than restriction. Rather than
              waiting for established frameworks from other jurisdictions, ADGM has proactively developed rules tailored
              to emerging technologies, including a comprehensive Virtual Asset Framework, a Carbon Credit Trading Framework,
              and a Sustainable Finance Regulatory Framework.
            </p>
            <p className="text-white/70 font-body leading-relaxed mb-4">
              The regulatory sandbox, called RegLab, allows companies to operate with real customers under a limited license
              while developing their product and demonstrating compliance readiness. For a company like TerraQura, operating
              at the intersection of blockchain, carbon markets, and financial services, the sandbox provides a pathway to
              full regulatory compliance that does not require the years-long process typical in other jurisdictions.
            </p>
            <p className="text-white/70 font-body leading-relaxed mb-6">
              ADGM&apos;s carbon credit framework is particularly relevant. It establishes standards for the issuance,
              trading, and retirement of carbon credits within the ADGM jurisdiction, including provisions for digital
              and tokenized credits. The framework requires verification by approved methodologies, transparent registry
              systems, and clear retirement procedures, all of which align with TerraQura&apos;s Proof-of-Physics approach.
            </p>

            <h2 id="masdar" className="text-2xl font-bold text-white mt-12 mb-4">
              Masdar City and Clean Energy
            </h2>
            <p className="text-white/70 font-body leading-relaxed mb-4">
              Masdar City, launched in 2006, was conceived as a testbed for sustainable urban development. Located adjacent
              to Abu Dhabi International Airport, the city is powered entirely by renewable energy and serves as a hub for
              clean technology companies, research institutions, and government initiatives. While early expectations for
              the city were perhaps overly ambitious, it has evolved into a genuine innovation cluster with over 900
              companies, 46,000 workers, and 4,000 residents.
            </p>
            <p className="text-white/70 font-body leading-relaxed mb-4">
              Masdar Clean Energy, a subsidiary of Mubadala, has become one of the world&apos;s five largest renewable energy
              companies by capacity. With projects across 40 countries and a target of 100 GW of installed capacity by
              2030, Masdar provides the clean energy infrastructure that carbon removal technologies require. The availability
              of cheap, clean electricity is a prerequisite for cost-effective DAC, and the UAE&apos;s solar irradiance
              (among the highest globally at 2,000+ kWh/m2/year) makes it an ideal location for solar-powered carbon removal.
            </p>
            <p className="text-white/70 font-body leading-relaxed mb-6">
              Masdar City also hosts IRENA, the International Renewable Energy Agency, whose presence brings global
              policy expertise and networking opportunities. For climate technology companies based in Abu Dhabi, proximity
              to IRENA provides access to policymakers, data, and thought leadership that is not available in most other
              locations.
            </p>

            <h2 id="dac-projects" className="text-2xl font-bold text-white mt-12 mb-4">
              Regional DAC and CCUS Projects
            </h2>
            <p className="text-white/70 font-body leading-relaxed mb-4">
              The UAE and broader Gulf region are emerging as a major hub for carbon capture projects. ADNOC (Abu Dhabi
              National Oil Company) operates one of the largest CCUS networks in the Middle East, with current capacity
              of approximately 2.3 million tonnes per year of CO2 captured and injected for enhanced oil recovery or
              dedicated storage. ADNOC has announced plans to expand this to 10 million tonnes per year by 2030.
            </p>
            <p className="text-white/70 font-body leading-relaxed mb-4">
              Direct Air Capture is receiving increasing attention in the region. The abundant solar energy, availability
              of suitable geological storage formations (depleted oil and gas reservoirs, saline aquifers), and low-cost
              land create favorable conditions for large-scale DAC deployment. Several DAC feasibility studies are
              underway in the UAE and Saudi Arabia, with pilot projects expected to begin operations in 2027 to 2028.
            </p>
            <p className="text-white/70 font-body leading-relaxed mb-6">
              The geological storage potential of the Arabian Peninsula is enormous. The region&apos;s extensive sedimentary
              basins, well-characterized through decades of hydrocarbon exploration, offer hundreds of billions of tonnes
              of CO2 storage capacity in depleted reservoirs and deep saline formations. This geological advantage,
              combined with the energy infrastructure and capital availability, positions the Gulf region as a potential
              global leader in permanent carbon storage.
            </p>

            {/* Investment data table */}
            <h2 id="investment-data" className="text-2xl font-bold text-white mt-12 mb-4">
              UAE Climate Investment Data
            </h2>

            <div className="my-8 overflow-x-auto">
              <table className="w-full text-sm font-body">
                <thead>
                  <tr className="border-b border-white/[0.1]">
                    <th className="text-left py-3 px-4 text-white/80 font-bold">Initiative</th>
                    <th className="text-left py-3 px-4 text-white/80 font-bold">Investment</th>
                    <th className="text-left py-3 px-4 text-white/80 font-bold">Timeline</th>
                    <th className="text-left py-3 px-4 text-white/80 font-bold">Focus Area</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["UAE Net Zero 2050 Strategy", "$163 billion", "2021-2050", "Economy-wide decarbonization"],
                    ["Masdar Clean Energy", "$30+ billion deployed", "2006-present", "Renewable energy (100 GW target)"],
                    ["ADNOC CCUS Expansion", "$15 billion", "2024-2030", "10 Mt/yr CO2 capture and storage"],
                    ["Abu Dhabi Catalyst Partners", "$1 billion", "2024-2030", "Climate technology ventures"],
                    ["ALTERRA (COP28)", "$30 billion", "2023-2030", "Climate finance vehicle"],
                    ["Hub71 Climate Tech", "$500 million", "2023-2028", "Startup ecosystem support"],
                    ["Masdar Green Hydrogen", "$5 billion", "2024-2030", "Green hydrogen production"],
                    ["ADGM Carbon Markets", "Regulatory framework", "2024-ongoing", "Carbon credit trading standards"],
                  ].map(([init, inv, time, focus], i) => (
                    <tr key={init} className={`border-b border-white/[0.06] ${i % 2 === 0 ? "bg-white/[0.01]" : ""}`}>
                      <td className="py-3 px-4 text-white/80 font-medium">{init}</td>
                      <td className="py-3 px-4 text-emerald-400/80">{inv}</td>
                      <td className="py-3 px-4 text-white/50">{time}</td>
                      <td className="py-3 px-4 text-white/50">{focus}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h2 id="terraqura-role" className="text-2xl font-bold text-white mt-12 mb-4">
              TerraQura&apos;s Role in the Ecosystem
            </h2>
            <p className="text-white/70 font-body leading-relaxed mb-4">
              TerraQura, founded by Zhyra Holdings in Abu Dhabi, is positioned at the intersection of several converging
              trends in the UAE&apos;s climate strategy: the scaling of carbon capture and storage infrastructure, the
              development of blockchain-based financial infrastructure through ADGM, the deployment of IoT and sensor
              technologies for industrial monitoring, and the growing global demand for high-integrity carbon credits.
            </p>
            <p className="text-white/70 font-body leading-relaxed mb-4">
              As the UAE scales its CCUS capacity from 2 million to 100 million tonnes per year, the verification
              infrastructure must scale in parallel. Traditional MRV approaches cannot handle this volume. A 100 million
              tonne per year program would require hundreds of individual facility audits annually, with each audit
              costing $15,000 to $50,000 and taking months to complete. Proof-of-Physics, with its continuous sensor-based
              monitoring and automated verification, is designed precisely for this scale.
            </p>
            <p className="text-white/70 font-body leading-relaxed mb-6">
              TerraQura&apos;s location in Abu Dhabi provides strategic advantages: proximity to ADNOC and Masdar (potential
              partners and customers for verification services), access to ADGM&apos;s regulatory frameworks for tokenized
              carbon credits, availability of capital from climate-focused investors in the region, and a talent pool
              drawn from the UAE&apos;s growing technology sector and international recruitment.
            </p>

            <h2 id="global-positioning" className="text-2xl font-bold text-white mt-12 mb-4">
              Global Positioning and Partnerships
            </h2>
            <p className="text-white/70 font-body leading-relaxed mb-4">
              The UAE&apos;s climate technology strategy is not inward-looking. The hosting of COP28 in Dubai in 2023 was a
              deliberate statement of global leadership ambition. The establishment of ALTERRA, a $30 billion climate
              finance vehicle announced at COP28, demonstrated the scale of the UAE&apos;s financial commitment. And the
              country&apos;s bilateral partnerships with major carbon market jurisdictions (the EU, Singapore, Japan, the UK)
              are creating the interoperability frameworks that will be essential for global carbon credit markets.
            </p>
            <p className="text-white/70 font-body leading-relaxed mb-4">
              For TerraQura, this global positioning creates opportunities beyond the regional market. Carbon credits
              verified through Proof-of-Physics on the Aethelred blockchain can be traded globally, with ADGM regulatory
              approval providing credibility in international markets. The UAE&apos;s bilateral climate agreements provide
              a framework for cross-border credit recognition, and the country&apos;s neutral geopolitical positioning
              makes it an attractive domicile for a global carbon verification platform.
            </p>
            <p className="text-white/70 font-body leading-relaxed mb-6">
              The convergence of sovereign commitment, institutional capital, regulatory innovation, physical
              infrastructure, and geographic advantage makes Abu Dhabi one of the most compelling locations in the world
              for building carbon market infrastructure. TerraQura is building at the center of this convergence.
            </p>

            <h2 id="conclusion" className="text-2xl font-bold text-white mt-12 mb-4">
              Conclusion
            </h2>
            <p className="text-white/70 font-body leading-relaxed mb-4">
              Abu Dhabi&apos;s transformation from an oil-dependent economy to a diversified climate technology hub is one of
              the most significant economic transitions underway globally. The scale of investment, the sophistication of
              the regulatory environment, and the ambition of the national strategy create an ecosystem that is uniquely
              suited to nurturing the next generation of climate infrastructure companies.
            </p>
            <p className="text-white/70 font-body leading-relaxed mb-8">
              Carbon verification is a critical piece of this puzzle. As the UAE and the broader region scale carbon
              capture from millions to hundreds of millions of tonnes per year, the integrity of every tonne must be
              assured through rigorous, physics-based verification. TerraQura, rooted in Abu Dhabi and built on the
              emirate&apos;s regulatory and technological infrastructure, is developing the verification platform that
              this ambition demands.
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
