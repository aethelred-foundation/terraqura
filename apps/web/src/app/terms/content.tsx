"use client";

import { AnimatedSection } from "@/components/shared/AnimatedSection";

const tocItems = [
  { id: "acceptance", label: "1. Acceptance of Terms" },
  { id: "platform-description", label: "2. Platform Description" },
  { id: "eligibility", label: "3. Eligibility & Registration" },
  { id: "wallet-connection", label: "4. Wallet Connection & Blockchain" },
  { id: "carbon-credit-tokens", label: "5. Carbon Credit Tokens" },
  { id: "marketplace", label: "6. Marketplace & Transactions" },
  { id: "fees", label: "7. Platform Fees" },
  { id: "prohibited-conduct", label: "8. Prohibited Conduct" },
  { id: "intellectual-property", label: "9. Intellectual Property" },
  { id: "disclaimers", label: "10. Disclaimers" },
  { id: "limitation-liability", label: "11. Limitation of Liability" },
  { id: "indemnification", label: "12. Indemnification" },
  { id: "governing-law", label: "13. Governing Law & Jurisdiction" },
  { id: "dispute-resolution", label: "14. Dispute Resolution" },
  { id: "modification", label: "15. Modification of Terms" },
  { id: "termination", label: "16. Termination" },
  { id: "severability", label: "17. Severability" },
  { id: "contact", label: "18. Contact Us" },
];

export function TermsContent() {
  return (
    <>
      {/* Hero */}
      <section className="relative py-16 sm:py-20 lg:py-24" aria-labelledby="terms-heading">
        <div className="container mx-auto px-6 sm:px-8 lg:px-10">
          <AnimatedSection className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 mb-6">
              <span className="text-emerald-400 text-sm font-medium tracking-wide">Legal</span>
            </div>
            <h1 id="terms-heading" className="text-display-lg lg:text-display-xl text-white mb-6">
              Terms of Service
            </h1>
            <p className="text-lg text-white/70 max-w-2xl mx-auto font-body leading-relaxed">
              These Terms of Service (&quot;Terms&quot;) govern your access to and use of the TerraQura
              platform, operated by TerraQura Technologies Ltd (&quot;TerraQura,&quot; &quot;we,&quot;
              &quot;us,&quot; or &quot;our&quot;), a venture of Zhyra Holdings, Abu Dhabi, UAE.
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
              <nav aria-label="Terms of service sections">
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
            <AnimatedSection id="acceptance">
              <h2 className="text-xl font-semibold text-white mb-4">1. Acceptance of Terms</h2>
              <p className="text-white/70 font-body leading-relaxed mb-4">
                By accessing or using the TerraQura platform, including our website, APIs, smart contracts,
                marketplace, and any associated services (collectively, the &quot;Platform&quot;), you
                agree to be bound by these Terms. If you do not agree to all provisions of these Terms,
                you must not access or use the Platform.
              </p>
              <p className="text-white/70 font-body leading-relaxed mb-4">
                These Terms constitute a legally binding agreement between you (whether individually or
                on behalf of an entity you represent) and TerraQura Technologies Ltd. By connecting a
                cryptocurrency wallet, completing Sign-In With Ethereum (SIWE) authentication, or
                otherwise interacting with the Platform, you confirm that you have read, understood, and
                agree to be bound by these Terms.
              </p>
              <p className="text-white/70 font-body leading-relaxed">
                These Terms should be read in conjunction with our{" "}
                <a href="/privacy" className="text-emerald-400 hover:text-emerald-300 transition-colors underline">Privacy Policy</a>,{" "}
                <a href="/cookies" className="text-emerald-400 hover:text-emerald-300 transition-colors underline">Cookie Policy</a>, and{" "}
                <a href="/regulatory" className="text-emerald-400 hover:text-emerald-300 transition-colors underline">Regulatory Compliance</a>{" "}
                page, which are incorporated herein by reference.
              </p>
            </AnimatedSection>

            {/* Section 2 */}
            <AnimatedSection id="platform-description">
              <h2 className="text-xl font-semibold text-white mb-4">2. Platform Description</h2>
              <p className="text-white/70 font-body leading-relaxed mb-4">
                TerraQura is an institutional-grade carbon asset platform that provides:
              </p>
              <ul className="list-disc list-inside space-y-2 text-white/70 font-body leading-relaxed mb-6 ml-4">
                <li>
                  <strong className="text-white/90">Proof-of-Physics Verification:</strong> A physics-based
                  verification engine that validates carbon dioxide removal claims from Direct Air Capture
                  (DAC) facilities by analyzing energy consumption, CO2 capture volumes, and operational
                  parameters against thermodynamic models
                </li>
                <li>
                  <strong className="text-white/90">Carbon Credit Tokenization:</strong> Conversion of
                  verified carbon removal data into blockchain-based tokens (ERC-1155 standard) on the
                  Aethelred network, creating a transparent and auditable record of each carbon credit
                </li>
                <li>
                  <strong className="text-white/90">Carbon Marketplace:</strong> A platform for the purchase,
                  sale, and retirement of verified carbon credit tokens, including gasless settlement
                  options for enterprise participants
                </li>
                <li>
                  <strong className="text-white/90">Enterprise API & SDK:</strong> Developer tools for
                  integrating carbon credit verification and transaction capabilities into third-party
                  applications and enterprise systems
                </li>
              </ul>
              <p className="text-white/70 font-body leading-relaxed">
                The Platform operates on the Aethelred blockchain network (TerraQura&apos;s sovereign chain,
                currently in the testnet phase with planned migration to mainnet). The Platform is designed
                for institutional participants, including enterprise carbon buyers, DAC facility operators,
                and environmental compliance teams.
              </p>
            </AnimatedSection>

            {/* Section 3 */}
            <AnimatedSection id="eligibility">
              <h2 className="text-xl font-semibold text-white mb-4">3. Eligibility & Registration</h2>

              <h3 className="text-lg font-medium text-emerald-400 mb-3">3.1 Eligibility Requirements</h3>
              <p className="text-white/70 font-body leading-relaxed mb-4">
                To use the Platform, you must:
              </p>
              <ul className="list-disc list-inside space-y-2 text-white/70 font-body leading-relaxed mb-6 ml-4">
                <li>Be at least 18 years of age (or the age of majority in your jurisdiction)</li>
                <li>Have the legal capacity to enter into binding agreements</li>
                <li>Not be a resident of, or located in, any jurisdiction subject to comprehensive sanctions (including but not limited to OFAC, EU, and UN sanctions lists)</li>
                <li>Not be listed on any applicable sanctions or restricted persons lists</li>
                <li>Complete applicable identity verification (KYC) requirements for marketplace participation</li>
              </ul>

              <h3 className="text-lg font-medium text-emerald-400 mb-3">3.2 Account Responsibilities</h3>
              <p className="text-white/70 font-body leading-relaxed mb-4">
                You are responsible for:
              </p>
              <ul className="list-disc list-inside space-y-2 text-white/70 font-body leading-relaxed ml-4">
                <li>Providing accurate, current, and complete information during registration and KYC processes</li>
                <li>Maintaining the security and confidentiality of your account credentials and wallet private keys</li>
                <li>All activities that occur under your account or through your connected wallet</li>
                <li>Promptly notifying TerraQura of any unauthorized use of your account or any security breach</li>
                <li>Ensuring that any entity-level account is operated by authorized representatives</li>
              </ul>
            </AnimatedSection>

            {/* Section 4 */}
            <AnimatedSection id="wallet-connection">
              <h2 className="text-xl font-semibold text-white mb-4">4. Wallet Connection & Blockchain Interactions</h2>
              <p className="text-white/70 font-body leading-relaxed mb-4">
                Certain Platform features require connecting an Ethereum-compatible cryptocurrency wallet.
                By connecting your wallet, you acknowledge and agree:
              </p>
              <ul className="list-disc list-inside space-y-2 text-white/70 font-body leading-relaxed mb-6 ml-4">
                <li>You are the sole owner of and have full control over the connected wallet</li>
                <li>You are solely responsible for the security of your wallet, private keys, and seed phrases</li>
                <li>Blockchain transactions are irreversible once confirmed on the network; TerraQura cannot reverse, cancel, or modify completed transactions</li>
                <li>You are responsible for maintaining sufficient network tokens (e.g., AETH) to cover gas fees, unless using gasless transaction features</li>
                <li>TerraQura is not a wallet provider and does not hold, custody, or control your digital assets</li>
              </ul>
              <div className="p-6 rounded-xl bg-amber-500/[0.05] border border-amber-500/20">
                <p className="text-white/80 font-body leading-relaxed">
                  <strong className="text-amber-400">Warning:</strong> TerraQura will never ask for your
                  wallet private keys or seed phrase. Any request for this information is fraudulent.
                  Always verify you are interacting with official TerraQura smart contracts.
                </p>
              </div>
            </AnimatedSection>

            {/* Section 5 */}
            <AnimatedSection id="carbon-credit-tokens">
              <h2 className="text-xl font-semibold text-white mb-4">5. Carbon Credit Tokens</h2>

              <h3 className="text-lg font-medium text-emerald-400 mb-3">5.1 Nature of Tokens</h3>
              <p className="text-white/70 font-body leading-relaxed mb-4">
                Carbon credit tokens issued on the TerraQura platform are ERC-1155 multi-token standard
                tokens on the Aethelred blockchain. Each token represents a verified unit of carbon dioxide
                removal as validated by our Proof-of-Physics verification engine.
              </p>

              <div className="p-6 rounded-xl bg-red-500/[0.05] border border-red-500/20 mb-6">
                <p className="text-white/80 font-body leading-relaxed">
                  <strong className="text-red-400">Securities Disclaimer:</strong> TerraQura carbon credit
                  tokens are utility tokens representing verified carbon removal units. They are NOT
                  securities, investment contracts, equity interests, debt instruments, derivatives,
                  or any form of financial instrument. Carbon credit tokens do not confer any ownership
                  interest in TerraQura or Zhyra Holdings, do not entitle holders to dividends, profits,
                  or voting rights, and are not intended as investments. The purchase of carbon credit
                  tokens should not be undertaken with any expectation of profit from the efforts of
                  TerraQura or any third party.
                </p>
              </div>

              <h3 className="text-lg font-medium text-emerald-400 mb-3">5.2 Verification & Minting</h3>
              <p className="text-white/70 font-body leading-relaxed mb-4">
                Carbon credit tokens are minted only after successful completion of the Proof-of-Physics
                verification process. The verification process evaluates IoT sensor data from DAC
                facilities, including energy consumption (valid range: 200-600 kWh per tonne of CO2),
                capture volumes, and operational parameters. Tokens are minted through the CarbonCredit
                smart contract following on-chain attestation from the VerificationEngine contract.
              </p>

              <h3 className="text-lg font-medium text-emerald-400 mb-3">5.3 Token Retirement</h3>
              <p className="text-white/70 font-body leading-relaxed">
                Carbon credit tokens may be retired (permanently removed from circulation) to claim
                the underlying carbon removal offset. Once retired, tokens cannot be re-minted,
                transferred, or reactivated. Retirement is recorded immutably on the blockchain,
                creating a permanent audit trail for ESG reporting purposes.
              </p>
            </AnimatedSection>

            {/* Section 6 */}
            <AnimatedSection id="marketplace">
              <h2 className="text-xl font-semibold text-white mb-4">6. Marketplace & Transactions</h2>
              <p className="text-white/70 font-body leading-relaxed mb-4">
                The TerraQura Marketplace facilitates the buying, selling, and retirement of verified
                carbon credit tokens. By using the Marketplace, you acknowledge:
              </p>
              <ul className="list-disc list-inside space-y-2 text-white/70 font-body leading-relaxed mb-4 ml-4">
                <li>All marketplace transactions are executed through smart contracts and are subject to blockchain network conditions</li>
                <li>Token prices are determined by market participants; TerraQura does not set or guarantee prices</li>
                <li>Transaction confirmation times depend on blockchain network congestion and are not guaranteed</li>
                <li>Gasless transactions are facilitated through ERC-2771 meta-transactions but remain subject to smart contract execution conditions</li>
                <li>Completed marketplace transactions are final and irreversible</li>
              </ul>
              <p className="text-white/70 font-body leading-relaxed">
                TerraQura reserves the right to suspend or restrict marketplace access for any user
                who violates these Terms, fails KYC/AML requirements, or is subject to sanctions.
              </p>
            </AnimatedSection>

            {/* Section 7 */}
            <AnimatedSection id="fees">
              <h2 className="text-xl font-semibold text-white mb-4">7. Platform Fees</h2>
              <p className="text-white/70 font-body leading-relaxed mb-4">
                The following fees apply to Platform usage:
              </p>
              <div className="p-6 rounded-xl bg-white/[0.02] border border-white/[0.06] mb-6">
                <div className="space-y-4">
                  <div className="flex justify-between items-center pb-3 border-b border-white/[0.06]">
                    <span className="text-white/70 font-body">Marketplace Transaction Fee</span>
                    <span className="text-emerald-400 font-semibold">2.5%</span>
                  </div>
                  <div className="flex justify-between items-center pb-3 border-b border-white/[0.06]">
                    <span className="text-white/70 font-body">Carbon Credit Verification</span>
                    <span className="text-white/50 font-body text-sm">See enterprise pricing</span>
                  </div>
                  <div className="flex justify-between items-center pb-3 border-b border-white/[0.06]">
                    <span className="text-white/70 font-body">Token Minting</span>
                    <span className="text-white/50 font-body text-sm">Blockchain gas + platform fee</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-white/70 font-body">API Access (Enterprise)</span>
                    <span className="text-white/50 font-body text-sm">Custom pricing</span>
                  </div>
                </div>
              </div>
              <p className="text-white/70 font-body leading-relaxed mb-4">
                The 2.5% marketplace transaction fee is deducted automatically from the sale proceeds at the
                time of each transaction. Blockchain gas fees are separate and vary based on network conditions.
              </p>
              <p className="text-white/70 font-body leading-relaxed">
                TerraQura reserves the right to modify its fee schedule with 30 days&apos; prior notice.
                Updated fees will be published on the Platform and communicated to registered users.
              </p>
            </AnimatedSection>

            {/* Section 8 */}
            <AnimatedSection id="prohibited-conduct">
              <h2 className="text-xl font-semibold text-white mb-4">8. Prohibited Conduct</h2>
              <p className="text-white/70 font-body leading-relaxed mb-4">
                You agree not to engage in any of the following activities:
              </p>
              <ul className="list-disc list-inside space-y-2 text-white/70 font-body leading-relaxed mb-4 ml-4">
                <li>Submitting fraudulent, falsified, or manipulated sensor data or verification claims</li>
                <li>Market manipulation, wash trading, or any form of artificial price inflation or deflation</li>
                <li>Using the Platform for money laundering, terrorist financing, or sanctions evasion</li>
                <li>Accessing or attempting to access another user&apos;s account or wallet without authorization</li>
                <li>Exploiting smart contract vulnerabilities or conducting any form of blockchain-based attacks</li>
                <li>Reverse engineering, decompiling, or disassembling any Platform technology (except as permitted by applicable law)</li>
                <li>Using automated bots, scrapers, or similar tools to access the Platform without prior authorization</li>
                <li>Circumventing or attempting to circumvent KYC/AML controls, access restrictions, or rate limits</li>
                <li>Creating multiple accounts to evade restrictions or manipulate verification outcomes</li>
                <li>Misrepresenting the nature, origin, or characteristics of carbon credits</li>
                <li>Any activity that violates applicable laws, regulations, or third-party rights</li>
              </ul>
              <p className="text-white/70 font-body leading-relaxed">
                Violation of these restrictions may result in immediate account suspension, permanent
                ban, forfeiture of tokens, and referral to appropriate regulatory or law enforcement
                authorities.
              </p>
            </AnimatedSection>

            {/* Section 9 */}
            <AnimatedSection id="intellectual-property">
              <h2 className="text-xl font-semibold text-white mb-4">9. Intellectual Property</h2>
              <p className="text-white/70 font-body leading-relaxed mb-4">
                All intellectual property rights in and to the Platform, including but not limited to
                the TerraQura name, logo, branding, website design, Proof-of-Physics verification
                methodology, smart contract architecture, API specifications, SDK code, and all
                associated documentation (collectively, &quot;TerraQura IP&quot;), are owned exclusively
                by TerraQura Technologies Ltd or its licensors.
              </p>
              <p className="text-white/70 font-body leading-relaxed mb-4">
                You are granted a limited, non-exclusive, non-transferable, revocable license to access
                and use the Platform in accordance with these Terms. This license does not include the
                right to:
              </p>
              <ul className="list-disc list-inside space-y-2 text-white/70 font-body leading-relaxed mb-4 ml-4">
                <li>Copy, modify, or create derivative works of any TerraQura IP</li>
                <li>Use TerraQura trademarks or branding without prior written consent</li>
                <li>Sublicense, sell, or redistribute access to Platform features or tools</li>
                <li>Use Platform technology to build competing products or services</li>
              </ul>
              <p className="text-white/70 font-body leading-relaxed">
                Smart contracts deployed by TerraQura are published on public blockchains. The public
                availability of smart contract bytecode does not constitute a license to copy, modify,
                or deploy derivative contracts.
              </p>
            </AnimatedSection>

            {/* Section 10 */}
            <AnimatedSection id="disclaimers">
              <h2 className="text-xl font-semibold text-white mb-4">10. Disclaimers</h2>

              <div className="space-y-6">
                <div className="p-6 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                  <h3 className="text-lg font-medium text-emerald-400 mb-3">10.1 &quot;As Is&quot; Basis</h3>
                  <p className="text-white/70 font-body leading-relaxed">
                    THE PLATFORM IS PROVIDED ON AN &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; BASIS WITHOUT
                    WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO
                    WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE, AND
                    NON-INFRINGEMENT. TERRAQURA DOES NOT WARRANT THAT THE PLATFORM WILL BE UNINTERRUPTED,
                    ERROR-FREE, SECURE, OR FREE FROM VIRUSES OR OTHER HARMFUL COMPONENTS.
                  </p>
                </div>

                <div className="p-6 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                  <h3 className="text-lg font-medium text-emerald-400 mb-3">10.2 No Financial or Investment Advice</h3>
                  <p className="text-white/70 font-body leading-relaxed">
                    Nothing on the Platform constitutes financial, investment, legal, or tax advice.
                    TerraQura does not recommend, endorse, or provide guidance on the purchase, sale,
                    or retirement of carbon credit tokens as investment vehicles. The value of carbon
                    credits may fluctuate, and past performance does not indicate future results. You
                    should consult qualified professional advisors before making any decisions related
                    to carbon credit transactions.
                  </p>
                </div>

                <div className="p-6 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                  <h3 className="text-lg font-medium text-emerald-400 mb-3">10.3 Blockchain Risks</h3>
                  <p className="text-white/70 font-body leading-relaxed">
                    You acknowledge the inherent risks of blockchain technology, including but not limited
                    to: smart contract vulnerabilities, network congestion or downtime, regulatory
                    uncertainty, hard forks or protocol changes, private key loss, and the irreversible
                    nature of blockchain transactions. TerraQura is not responsible for any losses arising
                    from blockchain network failures, smart contract bugs (despite audit efforts), or
                    changes in blockchain protocol governance.
                  </p>
                </div>

                <div className="p-6 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                  <h3 className="text-lg font-medium text-emerald-400 mb-3">10.4 Verification Limitations</h3>
                  <p className="text-white/70 font-body leading-relaxed">
                    While TerraQura&apos;s Proof-of-Physics verification engine employs advanced
                    thermodynamic validation models, verification results are based on the sensor data
                    provided by facility operators. TerraQura does not independently operate DAC
                    facilities and cannot guarantee the accuracy of source data submitted to the
                    verification system.
                  </p>
                </div>
              </div>
            </AnimatedSection>

            {/* Section 11 */}
            <AnimatedSection id="limitation-liability">
              <h2 className="text-xl font-semibold text-white mb-4">11. Limitation of Liability</h2>
              <p className="text-white/70 font-body leading-relaxed mb-4">
                TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, TERRAQURA, ITS PARENT COMPANY
                (ZHYRA HOLDINGS), AFFILIATES, OFFICERS, DIRECTORS, EMPLOYEES, AGENTS, AND LICENSORS
                SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE
                DAMAGES, INCLUDING BUT NOT LIMITED TO LOSS OF PROFITS, DATA, GOODWILL, OR OTHER
                INTANGIBLE LOSSES, ARISING FROM OR RELATED TO:
              </p>
              <ul className="list-disc list-inside space-y-2 text-white/70 font-body leading-relaxed mb-6 ml-4">
                <li>Your use of or inability to use the Platform</li>
                <li>Any unauthorized access to or alteration of your data or transactions</li>
                <li>Loss of digital assets, tokens, or cryptocurrency due to wallet compromise, smart contract failures, or blockchain network issues</li>
                <li>Errors, inaccuracies, or omissions in verification data or carbon credit records</li>
                <li>Actions or omissions of third-party service providers</li>
                <li>Regulatory actions or changes in applicable law affecting carbon credit markets or blockchain technology</li>
              </ul>
              <p className="text-white/70 font-body leading-relaxed">
                IN NO EVENT SHALL TERRAQURA&apos;S TOTAL AGGREGATE LIABILITY EXCEED THE GREATER OF
                (A) THE TOTAL FEES PAID BY YOU TO TERRAQURA IN THE TWELVE (12) MONTHS PRECEDING THE
                CLAIM, OR (B) ONE HUNDRED US DOLLARS (USD $100). THIS LIMITATION APPLIES REGARDLESS
                OF THE LEGAL THEORY UPON WHICH THE CLAIM IS BASED.
              </p>
            </AnimatedSection>

            {/* Section 12 */}
            <AnimatedSection id="indemnification">
              <h2 className="text-xl font-semibold text-white mb-4">12. Indemnification</h2>
              <p className="text-white/70 font-body leading-relaxed">
                You agree to indemnify, defend, and hold harmless TerraQura, Zhyra Holdings, and their
                respective officers, directors, employees, agents, affiliates, and licensors from and
                against any and all claims, damages, losses, liabilities, costs, and expenses (including
                reasonable attorneys&apos; fees) arising from or related to: (a) your use of the Platform;
                (b) your violation of these Terms; (c) your violation of any applicable law, regulation,
                or third-party rights; (d) any fraudulent, misleading, or inaccurate data you submit to
                the Platform; or (e) any dispute between you and a third party arising from a marketplace
                transaction.
              </p>
            </AnimatedSection>

            {/* Section 13 */}
            <AnimatedSection id="governing-law">
              <h2 className="text-xl font-semibold text-white mb-4">13. Governing Law & Jurisdiction</h2>
              <p className="text-white/70 font-body leading-relaxed mb-4">
                These Terms are governed by and construed in accordance with the laws of the Abu Dhabi
                Global Market (ADGM), Abu Dhabi, United Arab Emirates, without regard to its conflict
                of law provisions.
              </p>
              <p className="text-white/70 font-body leading-relaxed">
                You agree that any legal action or proceeding arising out of or relating to these Terms
                or your use of the Platform shall be brought exclusively in the courts of the ADGM or
                the Abu Dhabi courts, as applicable. You consent to the personal jurisdiction of such
                courts and waive any objection to the laying of venue in such courts.
              </p>
            </AnimatedSection>

            {/* Section 14 */}
            <AnimatedSection id="dispute-resolution">
              <h2 className="text-xl font-semibold text-white mb-4">14. Dispute Resolution</h2>

              <h3 className="text-lg font-medium text-emerald-400 mb-3">14.1 Informal Resolution</h3>
              <p className="text-white/70 font-body leading-relaxed mb-6">
                Before initiating any formal dispute resolution process, you agree to first contact
                TerraQura at{" "}
                <a href="mailto:hello@terraqura.com" className="text-emerald-400 hover:text-emerald-300 transition-colors underline">
                  hello@terraqura.com
                </a>{" "}
                and attempt to resolve the dispute informally for a period of at least thirty (30) days.
                Most disputes can be resolved through good-faith communication.
              </p>

              <h3 className="text-lg font-medium text-emerald-400 mb-3">14.2 Arbitration</h3>
              <p className="text-white/70 font-body leading-relaxed mb-6">
                If a dispute cannot be resolved informally, either party may submit the dispute to
                binding arbitration administered by the Abu Dhabi Commercial Conciliation and Arbitration
                Centre (ADCCAC), or another mutually agreed arbitration institution within ADGM. The
                arbitration shall be conducted in English, and the seat of arbitration shall be Abu Dhabi,
                UAE. The arbitrator&apos;s decision shall be final and binding, and judgment on the award
                may be entered in any court of competent jurisdiction.
              </p>

              <h3 className="text-lg font-medium text-emerald-400 mb-3">14.3 Class Action Waiver</h3>
              <p className="text-white/70 font-body leading-relaxed">
                To the maximum extent permitted by applicable law, you agree that any dispute resolution
                proceedings will be conducted on an individual basis and not as part of a class,
                consolidated, or representative action.
              </p>
            </AnimatedSection>

            {/* Section 15 */}
            <AnimatedSection id="modification">
              <h2 className="text-xl font-semibold text-white mb-4">15. Modification of Terms</h2>
              <p className="text-white/70 font-body leading-relaxed mb-4">
                TerraQura reserves the right to modify these Terms at any time. When we make material
                changes, we will:
              </p>
              <ul className="list-disc list-inside space-y-2 text-white/70 font-body leading-relaxed mb-4 ml-4">
                <li>Update the &quot;Last Updated&quot; date at the top of these Terms</li>
                <li>Post the revised Terms on the Platform</li>
                <li>Provide at least 30 days&apos; notice before material changes take effect</li>
                <li>Send email notification to registered users for significant changes</li>
              </ul>
              <p className="text-white/70 font-body leading-relaxed">
                Your continued use of the Platform after the effective date of any modifications
                constitutes your acceptance of the updated Terms. If you do not agree to the modified
                Terms, you must stop using the Platform and may request account closure.
              </p>
            </AnimatedSection>

            {/* Section 16 */}
            <AnimatedSection id="termination">
              <h2 className="text-xl font-semibold text-white mb-4">16. Termination</h2>
              <p className="text-white/70 font-body leading-relaxed mb-4">
                Either party may terminate this agreement at any time. You may close your account by
                contacting us at{" "}
                <a href="mailto:hello@terraqura.com" className="text-emerald-400 hover:text-emerald-300 transition-colors underline">
                  hello@terraqura.com
                </a>
                . TerraQura may suspend or terminate your access to the Platform immediately, without
                prior notice, if:
              </p>
              <ul className="list-disc list-inside space-y-2 text-white/70 font-body leading-relaxed mb-4 ml-4">
                <li>You breach any provision of these Terms</li>
                <li>You fail to complete or pass KYC/AML verification</li>
                <li>We are required to do so by law or regulatory order</li>
                <li>We reasonably believe your account is being used for fraudulent or illegal activity</li>
                <li>We discontinue the Platform or any material part thereof</li>
              </ul>
              <p className="text-white/70 font-body leading-relaxed">
                Upon termination, your right to access the Platform ceases immediately. However,
                carbon credit tokens held in your wallet remain under your control on the blockchain,
                and applicable provisions of these Terms (including disclaimers, limitation of liability,
                indemnification, and governing law) survive termination.
              </p>
            </AnimatedSection>

            {/* Section 17 */}
            <AnimatedSection id="severability">
              <h2 className="text-xl font-semibold text-white mb-4">17. Severability</h2>
              <p className="text-white/70 font-body leading-relaxed">
                If any provision of these Terms is held to be invalid, illegal, or unenforceable by a
                court of competent jurisdiction, such provision shall be modified to the minimum extent
                necessary to make it valid and enforceable, or if modification is not possible, it shall
                be severed from these Terms. The invalidity or unenforceability of any provision shall
                not affect the validity or enforceability of the remaining provisions, which shall
                continue in full force and effect.
              </p>
            </AnimatedSection>

            {/* Section 18 */}
            <AnimatedSection id="contact">
              <h2 className="text-xl font-semibold text-white mb-4">18. Contact Us</h2>
              <p className="text-white/70 font-body leading-relaxed mb-6">
                For questions or concerns about these Terms of Service, please contact us:
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
