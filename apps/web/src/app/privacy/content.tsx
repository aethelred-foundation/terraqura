"use client";

import { AnimatedSection } from "@/components/shared/AnimatedSection";

const tocItems = [
  { id: "information-collection", label: "1. Information We Collect" },
  { id: "how-we-use", label: "2. How We Use Your Information" },
  { id: "data-sharing", label: "3. Data Sharing & Disclosure" },
  { id: "blockchain-transparency", label: "4. Blockchain Transparency" },
  { id: "data-security", label: "5. Data Security" },
  { id: "your-rights", label: "6. Your Rights" },
  { id: "international-transfers", label: "7. International Data Transfers" },
  { id: "children", label: "8. Children's Privacy" },
  { id: "uae-compliance", label: "9. UAE & ADGM Compliance" },
  { id: "cookies", label: "10. Cookies & Tracking" },
  { id: "retention", label: "11. Data Retention" },
  { id: "changes", label: "12. Changes to This Policy" },
  { id: "contact", label: "13. Contact Us" },
];

export function PrivacyContent() {
  return (
    <>
      {/* Hero */}
      <section className="relative py-16 sm:py-20 lg:py-24" aria-labelledby="privacy-heading">
        <div className="container mx-auto px-6 sm:px-8 lg:px-10">
          <AnimatedSection className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 mb-6">
              <span className="text-emerald-400 text-sm font-medium tracking-wide">Legal</span>
            </div>
            <h1 id="privacy-heading" className="text-display-lg lg:text-display-xl text-white mb-6">
              Privacy Policy
            </h1>
            <p className="text-lg text-white/70 max-w-2xl mx-auto font-body leading-relaxed">
              Your privacy matters. This policy explains how TerraQura Technologies Ltd
              (&quot;TerraQura,&quot; &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;), a venture of Zhyra Holdings,
              collects, uses, and protects your personal data.
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
              <nav aria-label="Privacy policy sections">
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
            <AnimatedSection id="information-collection">
              <h2 className="text-xl font-semibold text-white mb-4">1. Information We Collect</h2>
              <p className="text-white/70 font-body leading-relaxed mb-6">
                We collect various types of information to provide, maintain, and improve the TerraQura platform.
                The categories of information we collect depend on how you interact with our services.
              </p>

              <h3 className="text-lg font-medium text-emerald-400 mb-3">1.1 Personal Information You Provide</h3>
              <p className="text-white/70 font-body leading-relaxed mb-4">
                When you create an account, complete identity verification, or interact with our platform,
                you may provide the following information:
              </p>
              <ul className="list-disc list-inside space-y-2 text-white/70 font-body leading-relaxed mb-6 ml-4">
                <li>Full legal name, date of birth, and nationality</li>
                <li>Email address and phone number</li>
                <li>Government-issued identification documents (processed through our KYC provider, Sumsub)</li>
                <li>Company or organizational information for enterprise accounts</li>
                <li>Proof of address documentation</li>
                <li>Communication preferences and correspondence with our team</li>
              </ul>

              <h3 className="text-lg font-medium text-emerald-400 mb-3">1.2 Wallet & Blockchain Data</h3>
              <p className="text-white/70 font-body leading-relaxed mb-4">
                When you connect a cryptocurrency wallet to our platform, we collect:
              </p>
              <ul className="list-disc list-inside space-y-2 text-white/70 font-body leading-relaxed mb-6 ml-4">
                <li>Public wallet addresses (Ethereum-compatible)</li>
                <li>Transaction hashes associated with carbon credit operations</li>
                <li>Token balances and transfer history related to TerraQura carbon credits (ERC-1155)</li>
                <li>Wallet connection metadata (provider type, chain ID)</li>
              </ul>

              <h3 className="text-lg font-medium text-emerald-400 mb-3">1.3 Automatically Collected Data</h3>
              <p className="text-white/70 font-body leading-relaxed mb-4">
                When you access our platform, we automatically collect:
              </p>
              <ul className="list-disc list-inside space-y-2 text-white/70 font-body leading-relaxed mb-6 ml-4">
                <li>IP address and approximate geolocation</li>
                <li>Browser type, version, and operating system</li>
                <li>Device identifiers and screen resolution</li>
                <li>Pages visited, time spent, and navigation patterns</li>
                <li>Referring URLs and exit pages</li>
                <li>Timestamps and frequency of access</li>
              </ul>

              <h3 className="text-lg font-medium text-emerald-400 mb-3">1.4 IoT & Facility Data</h3>
              <p className="text-white/70 font-body leading-relaxed">
                For Direct Air Capture (DAC) facility operators using our verification system, we collect
                sensor data including energy consumption metrics (kWh), CO2 capture volumes (tonnes),
                ambient temperature readings, equipment operational parameters, and facility geolocation
                coordinates. This data is essential for our Proof-of-Physics verification engine.
              </p>
            </AnimatedSection>

            {/* Section 2 */}
            <AnimatedSection id="how-we-use">
              <h2 className="text-xl font-semibold text-white mb-4">2. How We Use Your Information</h2>
              <p className="text-white/70 font-body leading-relaxed mb-6">
                We use the information we collect for the following purposes:
              </p>

              <h3 className="text-lg font-medium text-emerald-400 mb-3">2.1 Platform Operations</h3>
              <ul className="list-disc list-inside space-y-2 text-white/70 font-body leading-relaxed mb-6 ml-4">
                <li>Creating, maintaining, and securing your account</li>
                <li>Processing carbon credit verifications and tokenization requests</li>
                <li>Facilitating marketplace transactions and settlement</li>
                <li>Executing smart contract interactions on the Aethelred network</li>
                <li>Providing gasless transaction capabilities (ERC-2771 meta-transactions)</li>
              </ul>

              <h3 className="text-lg font-medium text-emerald-400 mb-3">2.2 Verification & Compliance</h3>
              <ul className="list-disc list-inside space-y-2 text-white/70 font-body leading-relaxed mb-6 ml-4">
                <li>Performing identity verification (KYC) and anti-money laundering (AML) checks</li>
                <li>Validating Proof-of-Physics data from DAC facilities</li>
                <li>Ensuring compliance with applicable regulations and sanctions screening</li>
                <li>Detecting, investigating, and preventing fraudulent or unauthorized activity</li>
              </ul>

              <h3 className="text-lg font-medium text-emerald-400 mb-3">2.3 Analytics & Improvement</h3>
              <ul className="list-disc list-inside space-y-2 text-white/70 font-body leading-relaxed mb-6 ml-4">
                <li>Analyzing platform usage patterns to improve features and user experience</li>
                <li>Monitoring system performance, uptime, and reliability</li>
                <li>Conducting research on carbon credit market trends (using aggregated, anonymized data)</li>
                <li>Developing new features and verification methodologies</li>
              </ul>

              <h3 className="text-lg font-medium text-emerald-400 mb-3">2.4 Communication</h3>
              <ul className="list-disc list-inside space-y-2 text-white/70 font-body leading-relaxed ml-4">
                <li>Sending transactional notifications (verification results, transaction confirmations)</li>
                <li>Providing customer support and responding to inquiries</li>
                <li>Delivering platform updates, security alerts, and policy changes</li>
                <li>Sending marketing communications (with your consent, and with opt-out available)</li>
              </ul>
            </AnimatedSection>

            {/* Section 3 */}
            <AnimatedSection id="data-sharing">
              <h2 className="text-xl font-semibold text-white mb-4">3. Data Sharing & Disclosure</h2>
              <p className="text-white/70 font-body leading-relaxed mb-6">
                We do not sell your personal data. We may share your information in the following circumstances:
              </p>

              <h3 className="text-lg font-medium text-emerald-400 mb-3">3.1 Service Providers</h3>
              <p className="text-white/70 font-body leading-relaxed mb-6">
                We engage trusted third-party service providers who process data on our behalf, including
                Sumsub (identity verification and KYC/AML), cloud infrastructure providers (data hosting
                and storage), analytics services (platform usage analysis), and communication tools
                (email delivery and customer support). All service providers are bound by data processing
                agreements that limit how they may use your information.
              </p>

              <h3 className="text-lg font-medium text-emerald-400 mb-3">3.2 Legal Obligations</h3>
              <p className="text-white/70 font-body leading-relaxed mb-6">
                We may disclose your information when required by law, regulation, legal process, or
                governmental request. This includes responding to subpoenas, court orders, or regulatory
                inquiries from authorities in the UAE, ADGM, or other applicable jurisdictions.
              </p>

              <h3 className="text-lg font-medium text-emerald-400 mb-3">3.3 Business Transfers</h3>
              <p className="text-white/70 font-body leading-relaxed mb-6">
                In the event of a merger, acquisition, reorganization, or sale of assets, your personal
                data may be transferred as part of the transaction. We will notify you of any such change
                and any choices you may have regarding your information.
              </p>

              <h3 className="text-lg font-medium text-emerald-400 mb-3">3.4 With Your Consent</h3>
              <p className="text-white/70 font-body leading-relaxed">
                We may share your information with third parties when you have given us explicit consent
                to do so, such as when integrating with partner platforms or participating in
                co-branded programs.
              </p>
            </AnimatedSection>

            {/* Section 4 */}
            <AnimatedSection id="blockchain-transparency">
              <h2 className="text-xl font-semibold text-white mb-4">4. Blockchain Transparency</h2>
              <p className="text-white/70 font-body leading-relaxed mb-4">
                TerraQura operates on public blockchain infrastructure (Aethelred, our sovereign chain). It is important
                to understand the following regarding blockchain-specific data:
              </p>
              <div className="p-6 rounded-xl bg-amber-500/[0.05] border border-amber-500/20 mb-6">
                <p className="text-white/80 font-body leading-relaxed">
                  <strong className="text-amber-400">Important:</strong> Blockchain transactions are
                  inherently public and immutable. Once data is recorded on-chain (such as wallet addresses,
                  transaction hashes, carbon credit mint records, and verification attestations), it cannot
                  be modified or deleted. Your public wallet address and associated transaction history
                  on the blockchain are visible to anyone and are outside the scope of data deletion requests.
                </p>
              </div>
              <p className="text-white/70 font-body leading-relaxed">
                We design our systems to minimize the amount of personal information stored on-chain.
                Sensitive personal data such as identity documents, contact details, and KYC information
                is stored exclusively in our off-chain databases and is never published to the blockchain.
              </p>
            </AnimatedSection>

            {/* Section 5 */}
            <AnimatedSection id="data-security">
              <h2 className="text-xl font-semibold text-white mb-4">5. Data Security</h2>
              <p className="text-white/70 font-body leading-relaxed mb-4">
                We implement robust technical and organizational measures to protect your personal data
                against unauthorized access, alteration, disclosure, or destruction:
              </p>
              <ul className="list-disc list-inside space-y-2 text-white/70 font-body leading-relaxed mb-6 ml-4">
                <li>Encryption in transit (TLS 1.3) and at rest (AES-256) for all personal data</li>
                <li>Multi-factor authentication for administrative access</li>
                <li>Regular security audits and penetration testing (including planned CertiK/Hacken smart contract audits)</li>
                <li>Role-based access controls with least-privilege principles</li>
                <li>Continuous monitoring and intrusion detection systems</li>
                <li>Secure, isolated database environments with automated backups</li>
                <li>Employee security training and strict data handling procedures</li>
              </ul>
              <p className="text-white/70 font-body leading-relaxed">
                While we take extensive measures to safeguard your data, no method of electronic storage
                or transmission is 100% secure. We encourage you to protect your wallet private keys and
                account credentials, and to report any suspected security incidents promptly.
              </p>
            </AnimatedSection>

            {/* Section 6 */}
            <AnimatedSection id="your-rights">
              <h2 className="text-xl font-semibold text-white mb-4">6. Your Rights</h2>
              <p className="text-white/70 font-body leading-relaxed mb-6">
                Depending on your jurisdiction, you may have the following rights regarding your personal data:
              </p>

              <div className="grid sm:grid-cols-2 gap-4 mb-6">
                {[
                  { title: "Access", desc: "Request a copy of the personal data we hold about you." },
                  { title: "Rectification", desc: "Request correction of inaccurate or incomplete personal data." },
                  { title: "Erasure", desc: "Request deletion of your personal data, subject to legal and blockchain limitations." },
                  { title: "Portability", desc: "Receive your personal data in a structured, machine-readable format." },
                  { title: "Restriction", desc: "Request that we limit how we process your personal data in certain circumstances." },
                  { title: "Objection", desc: "Object to processing of your personal data for direct marketing or legitimate interest purposes." },
                ].map((right) => (
                  <div key={right.title} className="p-5 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                    <h3 className="text-base font-semibold text-emerald-400 mb-2">Right to {right.title}</h3>
                    <p className="text-sm text-white/60 font-body leading-relaxed">{right.desc}</p>
                  </div>
                ))}
              </div>

              <p className="text-white/70 font-body leading-relaxed mb-4">
                To exercise any of these rights, please contact us at{" "}
                <a href="mailto:hello@terraqura.com" className="text-emerald-400 hover:text-emerald-300 transition-colors underline">
                  hello@terraqura.com
                </a>
                . We will respond to your request within 30 days. We may require identity verification
                before processing your request.
              </p>
              <p className="text-white/70 font-body leading-relaxed">
                Please note that certain data may be exempt from deletion requests due to legal retention
                obligations, ongoing dispute resolution, or the immutable nature of blockchain records.
              </p>
            </AnimatedSection>

            {/* Section 7 */}
            <AnimatedSection id="international-transfers">
              <h2 className="text-xl font-semibold text-white mb-4">7. International Data Transfers</h2>
              <p className="text-white/70 font-body leading-relaxed mb-4">
                TerraQura is headquartered in Abu Dhabi, United Arab Emirates. Your personal data may be
                transferred to and processed in countries other than your country of residence, including
                countries where our service providers operate.
              </p>
              <p className="text-white/70 font-body leading-relaxed mb-4">
                When we transfer personal data internationally, we ensure appropriate safeguards are in
                place, including:
              </p>
              <ul className="list-disc list-inside space-y-2 text-white/70 font-body leading-relaxed ml-4">
                <li>Data processing agreements with standard contractual clauses</li>
                <li>Transfers to jurisdictions recognized as providing adequate data protection</li>
                <li>Implementation of supplementary technical and organizational security measures</li>
                <li>Compliance with ADGM Data Protection Regulations 2021 requirements for cross-border transfers</li>
              </ul>
            </AnimatedSection>

            {/* Section 8 */}
            <AnimatedSection id="children">
              <h2 className="text-xl font-semibold text-white mb-4">8. Children&apos;s Privacy</h2>
              <p className="text-white/70 font-body leading-relaxed">
                TerraQura&apos;s platform is not directed at individuals under the age of 18. We do not
                knowingly collect personal data from minors. If we become aware that we have inadvertently
                collected personal data from a child under 18, we will take immediate steps to delete
                such data from our systems. If you believe that a minor has provided us with personal
                data, please contact us at{" "}
                <a href="mailto:hello@terraqura.com" className="text-emerald-400 hover:text-emerald-300 transition-colors underline">
                  hello@terraqura.com
                </a>
                .
              </p>
            </AnimatedSection>

            {/* Section 9 */}
            <AnimatedSection id="uae-compliance">
              <h2 className="text-xl font-semibold text-white mb-4">9. UAE & ADGM Compliance</h2>
              <p className="text-white/70 font-body leading-relaxed mb-4">
                TerraQura is committed to compliance with applicable data protection laws in the
                United Arab Emirates, including:
              </p>
              <ul className="list-disc list-inside space-y-2 text-white/70 font-body leading-relaxed mb-6 ml-4">
                <li>
                  <strong className="text-white/90">UAE Federal Decree-Law No. 45 of 2021</strong> on the
                  Protection of Personal Data (PDPL), as amended
                </li>
                <li>
                  <strong className="text-white/90">ADGM Data Protection Regulations 2021</strong>, which
                  govern data processing activities within the Abu Dhabi Global Market free zone
                </li>
                <li>
                  <strong className="text-white/90">ADGM Guidance on Data Protection</strong>, including
                  guidance on lawful bases for processing, data protection impact assessments, and
                  breach notification requirements
                </li>
              </ul>
              <p className="text-white/70 font-body leading-relaxed">
                Where our platform is accessed by users in the European Economic Area (EEA) or United
                Kingdom, we also respect the rights granted under the General Data Protection Regulation
                (GDPR) and UK GDPR, and process data in accordance with those frameworks.
              </p>
            </AnimatedSection>

            {/* Section 10 */}
            <AnimatedSection id="cookies">
              <h2 className="text-xl font-semibold text-white mb-4">10. Cookies & Tracking Technologies</h2>
              <p className="text-white/70 font-body leading-relaxed mb-4">
                We use cookies and similar tracking technologies to enhance your experience on our
                platform. For detailed information about the types of cookies we use, how to manage
                your cookie preferences, and the impact of disabling cookies, please refer to our{" "}
                <a href="/cookies" className="text-emerald-400 hover:text-emerald-300 transition-colors underline">
                  Cookie Policy
                </a>
                .
              </p>
            </AnimatedSection>

            {/* Section 11 */}
            <AnimatedSection id="retention">
              <h2 className="text-xl font-semibold text-white mb-4">11. Data Retention</h2>
              <p className="text-white/70 font-body leading-relaxed mb-4">
                We retain your personal data only for as long as necessary to fulfill the purposes
                described in this policy, unless a longer retention period is required or permitted
                by law. Specific retention periods include:
              </p>
              <ul className="list-disc list-inside space-y-2 text-white/70 font-body leading-relaxed mb-6 ml-4">
                <li><strong className="text-white/90">Account data:</strong> Retained for the duration of your account plus 5 years after closure</li>
                <li><strong className="text-white/90">KYC/AML records:</strong> Retained for a minimum of 5 years after the end of the business relationship, as required by UAE anti-money laundering regulations</li>
                <li><strong className="text-white/90">Transaction records:</strong> Retained for 7 years for financial reporting and audit purposes</li>
                <li><strong className="text-white/90">Verification data:</strong> Carbon credit verification records are retained indefinitely on-chain as part of the immutable blockchain record</li>
                <li><strong className="text-white/90">Analytics data:</strong> Aggregated and anonymized within 24 months of collection</li>
              </ul>
              <p className="text-white/70 font-body leading-relaxed">
                When personal data is no longer needed, it is securely deleted or anonymized in
                accordance with our data retention schedule.
              </p>
            </AnimatedSection>

            {/* Section 12 */}
            <AnimatedSection id="changes">
              <h2 className="text-xl font-semibold text-white mb-4">12. Changes to This Policy</h2>
              <p className="text-white/70 font-body leading-relaxed">
                We may update this Privacy Policy from time to time to reflect changes in our practices,
                technology, legal requirements, or other factors. When we make material changes, we will
                notify you by posting the updated policy on our platform with a revised &quot;Last Updated&quot;
                date, and where appropriate, through email notification or a prominent notice on our
                website. We encourage you to review this policy periodically. Your continued use of the
                platform after changes are posted constitutes your acknowledgment of the modified policy.
              </p>
            </AnimatedSection>

            {/* Section 13 */}
            <AnimatedSection id="contact">
              <h2 className="text-xl font-semibold text-white mb-4">13. Contact Us</h2>
              <p className="text-white/70 font-body leading-relaxed mb-6">
                If you have any questions, concerns, or requests regarding this Privacy Policy or our
                data practices, please contact us:
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
            </AnimatedSection>

          </div>
        </div>
      </section>
    </>
  );
}
