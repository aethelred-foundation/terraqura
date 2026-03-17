"use client";

import { AnimatedSection } from "@/components/shared/AnimatedSection";

const tocItems = [
  { id: "adgm-framework", label: "1. ADGM Regulatory Framework" },
  { id: "compliance-approach", label: "2. Compliance Approach" },
  { id: "kyc-aml", label: "3. KYC & AML Procedures" },
  { id: "securities-disclaimer", label: "4. Securities Disclaimer" },
  { id: "environmental-claims", label: "5. Environmental Claims Disclaimer" },
  { id: "sanctions", label: "6. Sanctions Compliance" },
  { id: "regulatory-updates", label: "7. Regulatory Updates" },
  { id: "contact", label: "8. Contact Us" },
];

export function RegulatoryContent() {
  return (
    <>
      {/* Hero */}
      <section className="relative py-16 sm:py-20 lg:py-24" aria-labelledby="regulatory-heading">
        <div className="container mx-auto px-6 sm:px-8 lg:px-10">
          <AnimatedSection className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 mb-6">
              <span className="text-emerald-400 text-sm font-medium tracking-wide">Legal</span>
            </div>
            <h1 id="regulatory-heading" className="text-display-lg lg:text-display-xl text-white mb-6">
              Regulatory Compliance
            </h1>
            <p className="text-lg text-white/70 max-w-2xl mx-auto font-body leading-relaxed">
              TerraQura is committed to operating within applicable regulatory frameworks. This page
              outlines our approach to compliance, important disclaimers, and the regulatory
              environment in which we operate.
            </p>
            <p className="text-sm text-white/40 mt-4 font-body">
              Last updated: February 27, 2026
            </p>
          </AnimatedSection>
        </div>
      </section>

      {/* Table of Contents */}
      <section className="relative py-12 bg-midnight-900/30">
        <div className="container mx-auto px-6 sm:px-8 lg:px-10">
          <AnimatedSection className="max-w-4xl mx-auto">
            <div className="p-6 sm:p-8 rounded-xl bg-white/[0.02] border border-white/[0.06]">
              <h2 className="text-lg font-semibold text-white mb-4">Table of Contents</h2>
              <nav aria-label="Regulatory compliance sections">
                <ol className="grid sm:grid-cols-2 gap-2">
                  {tocItems.map((item) => (
                    <li key={item.id}>
                      <a
                        href={`#${item.id}`}
                        className="text-sm text-white/60 hover:text-emerald-400 transition-colors font-body leading-relaxed"
                      >
                        {item.label}
                      </a>
                    </li>
                  ))}
                </ol>
              </nav>
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* Content */}
      <section className="relative py-16 sm:py-20 lg:py-24">
        <div className="container mx-auto px-6 sm:px-8 lg:px-10">
          <div className="max-w-4xl mx-auto space-y-16">

            {/* Section 1 */}
            <AnimatedSection id="adgm-framework">
              <h2 className="text-xl font-semibold text-white mb-4">1. ADGM Regulatory Framework</h2>
              <p className="text-white/70 font-body leading-relaxed mb-4">
                TerraQura Technologies Ltd is structured to operate within the Abu Dhabi Global Market
                (ADGM) regulatory framework. ADGM is an international financial center located in Abu
                Dhabi, United Arab Emirates, with its own civil and commercial laws based on common law
                principles, and an independent regulatory authority -- the Financial Services Regulatory
                Authority (FSRA).
              </p>

              <h3 className="text-lg font-medium text-emerald-400 mb-3">1.1 ADGM Overview</h3>
              <p className="text-white/70 font-body leading-relaxed mb-4">
                The ADGM provides a comprehensive and internationally recognized regulatory environment
                that includes:
              </p>
              <ul className="list-disc list-inside space-y-2 text-white/70 font-body leading-relaxed mb-6 ml-4">
                <li>A dedicated framework for digital assets and virtual asset service providers</li>
                <li>Data protection regulations aligned with international standards (ADGM Data Protection Regulations 2021)</li>
                <li>Anti-money laundering and counter-terrorism financing rules</li>
                <li>A principles-based regulatory approach that supports innovation while maintaining market integrity</li>
              </ul>

              <h3 className="text-lg font-medium text-emerald-400 mb-3">1.2 Our Regulatory Status</h3>
              <p className="text-white/70 font-body leading-relaxed mb-4">
                TerraQura is in the process of establishing its formal regulatory presence within ADGM.
                Our platform is currently in a pre-commercial, testnet phase. As we progress toward
                mainnet launch and commercial operations, we are working to obtain applicable licenses
                and registrations within the ADGM framework.
              </p>
              <div className="p-6 rounded-xl bg-cyan-500/[0.05] border border-cyan-500/20">
                <p className="text-white/80 font-body leading-relaxed">
                  <strong className="text-cyan-400">Note:</strong> This page will be updated as our
                  regulatory status evolves. The information provided here represents our current
                  approach and intentions, which are subject to change based on regulatory guidance
                  and requirements.
                </p>
              </div>
            </AnimatedSection>

            {/* Section 2 */}
            <AnimatedSection id="compliance-approach">
              <h2 className="text-xl font-semibold text-white mb-4">2. Compliance Approach</h2>
              <p className="text-white/70 font-body leading-relaxed mb-6">
                TerraQura adopts a compliance-first approach to building our carbon asset platform.
                Our compliance program is built on the following pillars:
              </p>

              <div className="grid sm:grid-cols-2 gap-4">
                {[
                  {
                    title: "Regulatory Engagement",
                    desc: "Proactive engagement with ADGM regulators, UAE authorities, and international bodies to ensure our platform design meets regulatory expectations.",
                  },
                  {
                    title: "Identity Verification",
                    desc: "Robust KYC/AML processes powered by Sumsub, ensuring all marketplace participants are properly identified and screened.",
                  },
                  {
                    title: "Transparency",
                    desc: "On-chain verification records, public smart contracts, and auditable transaction histories that provide full transparency to regulators and users.",
                  },
                  {
                    title: "Data Protection",
                    desc: "Compliance with ADGM Data Protection Regulations 2021 and UAE PDPL, with strong privacy-by-design principles.",
                  },
                  {
                    title: "Smart Contract Security",
                    desc: "Planned independent security audits (CertiK/Hacken) of all smart contracts prior to mainnet deployment.",
                  },
                  {
                    title: "Continuous Monitoring",
                    desc: "Ongoing transaction monitoring, sanctions screening, and suspicious activity reporting procedures.",
                  },
                ].map((pillar) => (
                  <div key={pillar.title} className="p-5 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                    <h3 className="text-base font-semibold text-emerald-400 mb-2">{pillar.title}</h3>
                    <p className="text-sm text-white/60 font-body leading-relaxed">{pillar.desc}</p>
                  </div>
                ))}
              </div>
            </AnimatedSection>

            {/* Section 3 */}
            <AnimatedSection id="kyc-aml">
              <h2 className="text-xl font-semibold text-white mb-4">3. KYC & AML Procedures</h2>
              <p className="text-white/70 font-body leading-relaxed mb-6">
                TerraQura implements Know Your Customer (KYC) and Anti-Money Laundering (AML)
                procedures in accordance with applicable UAE regulations and international standards.
              </p>

              <h3 className="text-lg font-medium text-emerald-400 mb-3">3.1 Identity Verification (KYC)</h3>
              <p className="text-white/70 font-body leading-relaxed mb-4">
                All users who wish to participate in marketplace transactions must complete identity
                verification through our KYC provider, Sumsub. The verification process includes:
              </p>
              <ul className="list-disc list-inside space-y-2 text-white/70 font-body leading-relaxed mb-6 ml-4">
                <li>Government-issued photo ID verification (passport, national ID, or driving license)</li>
                <li>Liveness detection to confirm the applicant is a real person</li>
                <li>Proof of address verification (utility bill, bank statement, or government letter dated within 3 months)</li>
                <li>Enhanced due diligence for enterprise accounts and high-value transactions</li>
                <li>Politically Exposed Person (PEP) screening</li>
              </ul>

              <h3 className="text-lg font-medium text-emerald-400 mb-3">3.2 Anti-Money Laundering (AML)</h3>
              <p className="text-white/70 font-body leading-relaxed mb-4">
                Our AML program includes the following measures:
              </p>
              <ul className="list-disc list-inside space-y-2 text-white/70 font-body leading-relaxed mb-6 ml-4">
                <li>Real-time sanctions screening against OFAC, EU, UN, and UAE sanctions lists</li>
                <li>Transaction monitoring for unusual patterns or suspicious activity</li>
                <li>Suspicious Activity Report (SAR) filing with relevant authorities when required</li>
                <li>Record keeping in accordance with UAE AML regulations (minimum 5-year retention)</li>
                <li>Regular staff training on AML obligations and red-flag identification</li>
              </ul>

              <h3 className="text-lg font-medium text-emerald-400 mb-3">3.3 Ongoing Monitoring</h3>
              <p className="text-white/70 font-body leading-relaxed">
                KYC verification is not a one-time event. We conduct periodic reviews of user
                accounts, re-screening against updated sanctions lists, and enhanced monitoring for
                users whose risk profiles change over time. Users may be asked to provide updated
                documentation as part of our ongoing due diligence obligations.
              </p>
            </AnimatedSection>

            {/* Section 4 */}
            <AnimatedSection id="securities-disclaimer">
              <h2 className="text-xl font-semibold text-white mb-4">4. Securities Disclaimer</h2>
              <div className="p-6 rounded-xl bg-red-500/[0.05] border border-red-500/20 mb-6">
                <p className="text-white/80 font-body leading-relaxed mb-4">
                  <strong className="text-red-400">Important Securities Disclaimer</strong>
                </p>
                <p className="text-white/70 font-body leading-relaxed mb-4">
                  TerraQura carbon credit tokens (ERC-1155) are utility tokens that represent verified
                  units of carbon dioxide removal. They are designed and intended solely for use within
                  the TerraQura ecosystem for the purpose of carbon offsetting, ESG compliance, and
                  environmental reporting.
                </p>
                <p className="text-white/70 font-body leading-relaxed mb-4">
                  TerraQura carbon credit tokens are <strong className="text-white/90">NOT</strong>:
                </p>
                <ul className="list-disc list-inside space-y-2 text-white/70 font-body leading-relaxed mb-4 ml-4">
                  <li>Securities, investment contracts, or financial instruments under any applicable jurisdiction</li>
                  <li>Equity interests, ownership stakes, or profit-sharing instruments in TerraQura or Zhyra Holdings</li>
                  <li>Debt instruments, bonds, or promissory notes</li>
                  <li>Derivatives, options, futures, or swaps</li>
                  <li>Collective investment scheme units or fund interests</li>
                  <li>Currency, legal tender, or money</li>
                </ul>
                <p className="text-white/70 font-body leading-relaxed">
                  The purchase of carbon credit tokens should not be undertaken with the expectation
                  of profit derived from the entrepreneurial or managerial efforts of TerraQura or
                  any third party. Carbon credit tokens are functional utility tokens for environmental
                  offset purposes. Any market price fluctuation is incidental to their utility function.
                </p>
              </div>
              <p className="text-white/70 font-body leading-relaxed">
                Nothing on the TerraQura platform, website, documentation, or communications
                constitutes an offer to sell securities or a solicitation of an offer to buy securities
                in any jurisdiction. If you are uncertain about the regulatory classification of carbon
                credit tokens in your jurisdiction, you should consult a qualified legal advisor before
                using the Platform.
              </p>
            </AnimatedSection>

            {/* Section 5 */}
            <AnimatedSection id="environmental-claims">
              <h2 className="text-xl font-semibold text-white mb-4">5. Environmental Claims Disclaimer</h2>
              <div className="p-6 rounded-xl bg-amber-500/[0.05] border border-amber-500/20 mb-6">
                <p className="text-white/80 font-body leading-relaxed mb-4">
                  <strong className="text-amber-400">Important Notice Regarding Environmental Claims</strong>
                </p>
                <p className="text-white/70 font-body leading-relaxed">
                  While TerraQura&apos;s Proof-of-Physics verification engine employs rigorous
                  thermodynamic validation models to verify carbon removal claims, the following
                  limitations apply:
                </p>
              </div>

              <ul className="list-disc list-inside space-y-3 text-white/70 font-body leading-relaxed mb-6 ml-4">
                <li>
                  <strong className="text-white/90">Data Source Dependency:</strong> Verification results
                  are based on sensor data submitted by DAC facility operators. TerraQura does not
                  independently operate capture facilities and relies on the accuracy of submitted data,
                  subject to our anomaly detection and validation procedures.
                </li>
                <li>
                  <strong className="text-white/90">Methodology Evolution:</strong> Carbon removal
                  measurement and verification methodologies are evolving. Our Proof-of-Physics models
                  represent our current best understanding and are subject to updates as scientific
                  knowledge advances.
                </li>
                <li>
                  <strong className="text-white/90">No Guarantee of Permanence:</strong> While DAC-based
                  carbon removal is considered highly durable, TerraQura does not guarantee the permanent
                  sequestration of captured CO2 beyond the verified removal event.
                </li>
                <li>
                  <strong className="text-white/90">Not a Carbon Standard:</strong> TerraQura is a
                  technology platform and verification engine, not an accredited carbon standard body.
                  While our verification process is rigorous, TerraQura carbon credits may not be
                  recognized by all voluntary or compliance carbon markets without additional
                  certification.
                </li>
                <li>
                  <strong className="text-white/90">Regulatory Classification:</strong> The regulatory
                  treatment of tokenized carbon credits varies by jurisdiction. Users are responsible
                  for determining whether TerraQura carbon credits meet the requirements for carbon
                  offsetting, ESG reporting, or compliance purposes in their specific jurisdiction.
                </li>
              </ul>

              <p className="text-white/70 font-body leading-relaxed">
                TerraQura strives for the highest standards of verification integrity and transparently
                publishes its methodology and smart contract code. Users should conduct their own due
                diligence when using carbon credits for compliance or reporting purposes.
              </p>
            </AnimatedSection>

            {/* Section 6 */}
            <AnimatedSection id="sanctions">
              <h2 className="text-xl font-semibold text-white mb-4">6. Sanctions Compliance</h2>
              <p className="text-white/70 font-body leading-relaxed mb-4">
                TerraQura maintains a comprehensive sanctions compliance program. The Platform is not
                available to, and must not be used by:
              </p>
              <ul className="list-disc list-inside space-y-2 text-white/70 font-body leading-relaxed mb-6 ml-4">
                <li>Individuals or entities listed on OFAC&apos;s Specially Designated Nationals (SDN) list</li>
                <li>Individuals or entities listed on EU, UN, or UAE sanctions lists</li>
                <li>Residents of comprehensively sanctioned jurisdictions (including but not limited to North Korea, Iran, Syria, Cuba, and the Crimea, Donetsk, and Luhansk regions)</li>
                <li>Any person or entity acting on behalf of or owned/controlled by a sanctioned party</li>
              </ul>
              <p className="text-white/70 font-body leading-relaxed">
                We screen all users during onboarding and on an ongoing basis. If we determine that a
                user is subject to sanctions, we will immediately restrict their account and report
                as required by law.
              </p>
            </AnimatedSection>

            {/* Section 7 */}
            <AnimatedSection id="regulatory-updates">
              <h2 className="text-xl font-semibold text-white mb-4">7. Regulatory Updates</h2>
              <p className="text-white/70 font-body leading-relaxed mb-6">
                The regulatory landscape for digital assets, carbon markets, and blockchain technology
                is evolving. TerraQura monitors regulatory developments across key jurisdictions and
                will update this page as our regulatory status and approach evolves.
              </p>
              <div className="p-6 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                <h3 className="text-base font-semibold text-white mb-3">Key Regulatory Developments We Monitor</h3>
                <ul className="list-disc list-inside space-y-2 text-white/60 font-body leading-relaxed ml-4">
                  <li>ADGM virtual asset regulatory framework updates</li>
                  <li>UAE federal digital asset and fintech regulations</li>
                  <li>International carbon market regulations (Article 6 of the Paris Agreement)</li>
                  <li>EU Markets in Crypto-Assets Regulation (MiCA)</li>
                  <li>Voluntary carbon market integrity initiatives (ICVCM, VCMI)</li>
                  <li>UAE Net Zero 2050 strategy and carbon market development</li>
                </ul>
              </div>
            </AnimatedSection>

            {/* Section 8 */}
            <AnimatedSection id="contact">
              <h2 className="text-xl font-semibold text-white mb-4">8. Contact Us</h2>
              <p className="text-white/70 font-body leading-relaxed mb-6">
                For regulatory inquiries or compliance-related questions, please contact us:
              </p>
              <div className="p-6 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                <div className="space-y-3">
                  <p className="text-white/70 font-body">
                    <strong className="text-white/90">TerraQura Technologies Ltd</strong>
                  </p>
                  <p className="text-white/70 font-body">A venture of Zhyra Holdings</p>
                  <p className="text-white/70 font-body">Abu Dhabi, United Arab Emirates</p>
                  <p className="text-white/70 font-body">
                    Email:{" "}
                    <a href="mailto:hello@terraqura.com" className="text-emerald-400 hover:text-emerald-300 transition-colors underline">
                      hello@terraqura.com
                    </a>
                  </p>
                </div>
              </div>
              <p className="text-white/50 text-sm font-body mt-6">
                See also our{" "}
                <a href="/terms" className="text-emerald-400 hover:text-emerald-300 transition-colors underline">Terms of Service</a>,{" "}
                <a href="/privacy" className="text-emerald-400 hover:text-emerald-300 transition-colors underline">Privacy Policy</a>, and{" "}
                <a href="/cookies" className="text-emerald-400 hover:text-emerald-300 transition-colors underline">Cookie Policy</a>{" "}
                for additional legal information.
              </p>
            </AnimatedSection>

          </div>
        </div>
      </section>
    </>
  );
}
