"use client";

import { AnimatedSection } from "@/components/shared/AnimatedSection";

const tocItems = [
  { id: "what-are-cookies", label: "1. What Are Cookies" },
  { id: "essential-cookies", label: "2. Essential Cookies" },
  { id: "analytics-cookies", label: "3. Analytics Cookies" },
  { id: "functional-cookies", label: "4. Functional Cookies" },
  { id: "third-party-cookies", label: "5. Third-Party Cookies" },
  { id: "managing-cookies", label: "6. Managing Your Cookies" },
  { id: "consent", label: "7. Cookie Consent" },
  { id: "impact", label: "8. Impact of Disabling Cookies" },
  { id: "changes", label: "9. Changes to This Policy" },
  { id: "contact", label: "10. Contact Us" },
];

interface CookieEntry {
  name: string;
  purpose: string;
  duration: string;
}

const essentialCookies: CookieEntry[] = [
  { name: "__session", purpose: "Maintains your authenticated session and prevents unauthorized access to your account", duration: "Session" },
  { name: "__csrf_token", purpose: "Protects against cross-site request forgery attacks on form submissions", duration: "Session" },
  { name: "cookie_consent", purpose: "Stores your cookie consent preferences so we do not prompt you repeatedly", duration: "1 year" },
  { name: "__secure_ref", purpose: "Maintains security context for authenticated API requests", duration: "24 hours" },
  { name: "locale", purpose: "Stores your language and regional preference for content display", duration: "1 year" },
];

const analyticsCookies: CookieEntry[] = [
  { name: "_ga", purpose: "Distinguishes unique users for aggregate usage analysis (Google Analytics)", duration: "2 years" },
  { name: "_ga_*", purpose: "Maintains session state for usage analytics (Google Analytics 4)", duration: "2 years" },
  { name: "_gid", purpose: "Distinguishes users for daily aggregate reporting", duration: "24 hours" },
  { name: "ph_*", purpose: "Tracks feature usage and user flows for product improvement (PostHog)", duration: "1 year" },
];

const functionalCookies: CookieEntry[] = [
  { name: "wc_*", purpose: "Stores wallet connection state and preferred wallet provider (WalletConnect)", duration: "Session" },
  { name: "theme", purpose: "Remembers your display theme preference (dark/light mode)", duration: "1 year" },
  { name: "sidebar_state", purpose: "Preserves dashboard sidebar collapsed or expanded state", duration: "30 days" },
  { name: "explorer_filters", purpose: "Remembers your last-used filter settings on the Explorer page", duration: "30 days" },
];

function CookieTable({ cookies, category }: { cookies: CookieEntry[]; category: string }) {
  return (
    <div className="overflow-x-auto -mx-2">
      <table className="w-full text-left" aria-label={`${category} cookies`}>
        <thead>
          <tr className="border-b border-white/[0.08]">
            <th className="py-3 px-3 text-sm font-semibold text-white/90 font-body">Cookie Name</th>
            <th className="py-3 px-3 text-sm font-semibold text-white/90 font-body">Purpose</th>
            <th className="py-3 px-3 text-sm font-semibold text-white/90 font-body whitespace-nowrap">Duration</th>
          </tr>
        </thead>
        <tbody>
          {cookies.map((cookie) => (
            <tr key={cookie.name} className="border-b border-white/[0.04]">
              <td className="py-3 px-3 text-sm text-emerald-400 font-mono whitespace-nowrap">{cookie.name}</td>
              <td className="py-3 px-3 text-sm text-white/60 font-body leading-relaxed">{cookie.purpose}</td>
              <td className="py-3 px-3 text-sm text-white/50 font-body whitespace-nowrap">{cookie.duration}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function CookiesContent() {
  return (
    <>
      {/* Hero */}
      <section className="relative py-16 sm:py-20 lg:py-24" aria-labelledby="cookies-heading">
        <div className="container mx-auto px-6 sm:px-8 lg:px-10">
          <AnimatedSection className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 mb-6">
              <span className="text-emerald-400 text-sm font-medium tracking-wide">Legal</span>
            </div>
            <h1 id="cookies-heading" className="text-display-lg lg:text-display-xl text-white mb-6">
              Cookie Policy
            </h1>
            <p className="text-lg text-white/70 max-w-2xl mx-auto font-body leading-relaxed">
              This Cookie Policy explains how TerraQura Technologies Ltd (&quot;TerraQura,&quot;
              &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) uses cookies and similar tracking
              technologies when you visit our platform.
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
              <nav aria-label="Cookie policy sections">
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
            <AnimatedSection id="what-are-cookies">
              <h2 className="text-xl font-semibold text-white mb-4">1. What Are Cookies</h2>
              <p className="text-white/70 font-body leading-relaxed mb-4">
                Cookies are small text files that are stored on your device (computer, tablet, or
                mobile phone) when you visit a website. They are widely used to make websites work
                more efficiently, provide a better user experience, and give website operators
                information about how their sites are being used.
              </p>
              <p className="text-white/70 font-body leading-relaxed mb-4">
                Cookies can be &quot;session cookies&quot; (which are deleted when you close your
                browser) or &quot;persistent cookies&quot; (which remain on your device for a set
                period or until you delete them manually).
              </p>
              <p className="text-white/70 font-body leading-relaxed">
                In addition to cookies, we may use similar technologies such as local storage (including
                browser localStorage and sessionStorage), which function similarly to cookies but may
                store larger amounts of data. References to &quot;cookies&quot; in this policy include
                these similar technologies unless otherwise noted.
              </p>
            </AnimatedSection>

            {/* Section 2 */}
            <AnimatedSection id="essential-cookies">
              <h2 className="text-xl font-semibold text-white mb-4">2. Essential Cookies</h2>
              <p className="text-white/70 font-body leading-relaxed mb-4">
                Essential cookies are strictly necessary for the operation of our platform. They enable
                core functionality such as user authentication, security protection, and session
                management. Without these cookies, the Platform cannot function properly. These cookies
                do not require your consent as they are essential to provide you with the services
                you have requested.
              </p>
              <div className="p-6 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                <CookieTable cookies={essentialCookies} category="Essential" />
              </div>
            </AnimatedSection>

            {/* Section 3 */}
            <AnimatedSection id="analytics-cookies">
              <h2 className="text-xl font-semibold text-white mb-4">3. Analytics Cookies</h2>
              <p className="text-white/70 font-body leading-relaxed mb-4">
                Analytics cookies help us understand how visitors interact with our platform by
                collecting and reporting information about usage patterns, page views, and feature
                engagement. This data is aggregated and anonymized, meaning it does not directly
                identify individual users. We use this information to improve the Platform&apos;s
                performance, user experience, and content.
              </p>
              <div className="p-6 rounded-xl bg-white/[0.02] border border-white/[0.06] mb-6">
                <CookieTable cookies={analyticsCookies} category="Analytics" />
              </div>
              <p className="text-white/70 font-body leading-relaxed">
                Analytics cookies are only placed after you provide consent through our cookie
                consent mechanism. You may withdraw consent at any time, and we will stop setting
                these cookies on subsequent visits.
              </p>
            </AnimatedSection>

            {/* Section 4 */}
            <AnimatedSection id="functional-cookies">
              <h2 className="text-xl font-semibold text-white mb-4">4. Functional Cookies</h2>
              <p className="text-white/70 font-body leading-relaxed mb-4">
                Functional cookies enable enhanced features and personalization. They remember choices
                you make (such as your wallet connection, theme preference, or dashboard layout) to
                provide a more personalized experience. While the Platform will work without these
                cookies, some features may not function as expected.
              </p>
              <div className="p-6 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                <CookieTable cookies={functionalCookies} category="Functional" />
              </div>
            </AnimatedSection>

            {/* Section 5 */}
            <AnimatedSection id="third-party-cookies">
              <h2 className="text-xl font-semibold text-white mb-4">5. Third-Party Cookies</h2>
              <p className="text-white/70 font-body leading-relaxed mb-4">
                Some cookies on our platform are set by third-party services that we integrate with.
                We do not control these cookies and their use is governed by the respective third
                party&apos;s privacy policies.
              </p>

              <div className="space-y-4">
                <div className="p-5 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                  <h3 className="text-base font-semibold text-emerald-400 mb-2">WalletConnect</h3>
                  <p className="text-sm text-white/60 font-body leading-relaxed">
                    Used to facilitate secure wallet connections between your cryptocurrency wallet and
                    our platform. WalletConnect may set session cookies and use local storage to maintain
                    the connection state during your visit.
                  </p>
                </div>

                <div className="p-5 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                  <h3 className="text-base font-semibold text-emerald-400 mb-2">Google Analytics</h3>
                  <p className="text-sm text-white/60 font-body leading-relaxed">
                    Used for aggregate website analytics and performance monitoring. Google Analytics
                    collects anonymized usage data to help us understand traffic patterns and improve
                    the Platform. We have configured Google Analytics with IP anonymization enabled
                    and data sharing disabled.
                  </p>
                </div>

                <div className="p-5 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                  <h3 className="text-base font-semibold text-emerald-400 mb-2">PostHog</h3>
                  <p className="text-sm text-white/60 font-body leading-relaxed">
                    Used for product analytics and feature usage tracking. PostHog helps us understand
                    how users interact with specific Platform features to guide product development.
                    Data is processed with privacy controls enabled.
                  </p>
                </div>

                <div className="p-5 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                  <h3 className="text-base font-semibold text-emerald-400 mb-2">Sumsub</h3>
                  <p className="text-sm text-white/60 font-body leading-relaxed">
                    Used during the identity verification (KYC) process. Sumsub may set temporary
                    cookies and use local storage during the verification flow to maintain session
                    state and prevent fraud. These cookies are only active during KYC sessions.
                  </p>
                </div>
              </div>
            </AnimatedSection>

            {/* Section 6 */}
            <AnimatedSection id="managing-cookies">
              <h2 className="text-xl font-semibold text-white mb-4">6. Managing Your Cookies</h2>
              <p className="text-white/70 font-body leading-relaxed mb-6">
                You can control and manage cookies through several methods:
              </p>

              <h3 className="text-lg font-medium text-emerald-400 mb-3">6.1 Browser Settings</h3>
              <p className="text-white/70 font-body leading-relaxed mb-4">
                Most web browsers allow you to manage cookie preferences through their settings. You
                can typically configure your browser to:
              </p>
              <ul className="list-disc list-inside space-y-2 text-white/70 font-body leading-relaxed mb-6 ml-4">
                <li>View and delete existing cookies</li>
                <li>Block all cookies or only third-party cookies</li>
                <li>Allow cookies from specific websites only</li>
                <li>Set your browser to notify you when a cookie is being set</li>
                <li>Automatically delete cookies when you close your browser</li>
              </ul>
              <p className="text-white/70 font-body leading-relaxed mb-6">
                The process for managing cookies varies by browser. Consult your browser&apos;s help
                documentation for specific instructions. Common browsers include Chrome, Firefox,
                Safari, Edge, and Brave.
              </p>

              <h3 className="text-lg font-medium text-emerald-400 mb-3">6.2 Platform Cookie Settings</h3>
              <p className="text-white/70 font-body leading-relaxed mb-6">
                You can manage your cookie preferences directly on our platform through the cookie
                consent banner that appears on your first visit, or by updating your preferences in
                your account settings at any time.
              </p>

              <h3 className="text-lg font-medium text-emerald-400 mb-3">6.3 Opt-Out Links</h3>
              <p className="text-white/70 font-body leading-relaxed">
                For specific third-party analytics services, you can opt out using the following methods:
                Google Analytics provides a browser opt-out add-on. PostHog honors Do Not Track (DNT)
                browser signals when enabled. You may also use industry-standard opt-out mechanisms
                such as the Digital Advertising Alliance (DAA) opt-out page or the Network Advertising
                Initiative (NAI) opt-out page.
              </p>
            </AnimatedSection>

            {/* Section 7 */}
            <AnimatedSection id="consent">
              <h2 className="text-xl font-semibold text-white mb-4">7. Cookie Consent</h2>
              <p className="text-white/70 font-body leading-relaxed mb-4">
                When you first visit the TerraQura platform, you will be presented with a cookie consent
                banner that allows you to:
              </p>
              <ul className="list-disc list-inside space-y-2 text-white/70 font-body leading-relaxed mb-6 ml-4">
                <li><strong className="text-white/90">Accept All:</strong> Consent to all categories of cookies (essential, analytics, and functional)</li>
                <li><strong className="text-white/90">Essential Only:</strong> Allow only strictly necessary cookies required for Platform operation</li>
                <li><strong className="text-white/90">Customize:</strong> Choose which categories of non-essential cookies you wish to allow</li>
              </ul>
              <p className="text-white/70 font-body leading-relaxed mb-4">
                Your consent preference is stored in a persistent cookie (cookie_consent) so that we
                can respect your choices on subsequent visits. You may change your consent at any time
                through the cookie settings accessible in the Platform footer.
              </p>
              <p className="text-white/70 font-body leading-relaxed">
                Essential cookies do not require consent as they are necessary for the Platform to
                function. We will never set analytics or functional cookies without your prior consent.
              </p>
            </AnimatedSection>

            {/* Section 8 */}
            <AnimatedSection id="impact">
              <h2 className="text-xl font-semibold text-white mb-4">8. Impact of Disabling Cookies</h2>
              <p className="text-white/70 font-body leading-relaxed mb-4">
                Disabling certain cookies may affect your experience on the TerraQura platform:
              </p>

              <div className="space-y-4 mb-6">
                <div className="p-5 rounded-xl bg-red-500/[0.03] border border-red-500/10">
                  <h3 className="text-base font-semibold text-red-400 mb-2">Disabling Essential Cookies</h3>
                  <p className="text-sm text-white/60 font-body leading-relaxed">
                    The Platform will not function correctly. You will be unable to log in, complete
                    transactions, or access authenticated features. We strongly recommend keeping
                    essential cookies enabled.
                  </p>
                </div>

                <div className="p-5 rounded-xl bg-amber-500/[0.03] border border-amber-500/10">
                  <h3 className="text-base font-semibold text-amber-400 mb-2">Disabling Analytics Cookies</h3>
                  <p className="text-sm text-white/60 font-body leading-relaxed">
                    No impact on Platform functionality. We will be unable to collect anonymized usage
                    data, which helps us improve features and performance. Your experience will not
                    be degraded.
                  </p>
                </div>

                <div className="p-5 rounded-xl bg-amber-500/[0.03] border border-amber-500/10">
                  <h3 className="text-base font-semibold text-amber-400 mb-2">Disabling Functional Cookies</h3>
                  <p className="text-sm text-white/60 font-body leading-relaxed">
                    Some personalization features may not work. For example, you may need to reconnect
                    your wallet on each visit, your theme preference may reset, and dashboard layout
                    preferences may not be preserved between sessions.
                  </p>
                </div>
              </div>
            </AnimatedSection>

            {/* Section 9 */}
            <AnimatedSection id="changes">
              <h2 className="text-xl font-semibold text-white mb-4">9. Changes to This Policy</h2>
              <p className="text-white/70 font-body leading-relaxed">
                We may update this Cookie Policy periodically to reflect changes in the cookies we
                use, our technology, or applicable regulations. When we make material changes, we will
                update the &quot;Last Updated&quot; date at the top of this policy and, where
                appropriate, re-request your cookie consent so you can review and approve the updated
                categories. We encourage you to review this policy periodically for any changes.
              </p>
            </AnimatedSection>

            {/* Section 10 */}
            <AnimatedSection id="contact">
              <h2 className="text-xl font-semibold text-white mb-4">10. Contact Us</h2>
              <p className="text-white/70 font-body leading-relaxed mb-6">
                If you have any questions about our use of cookies or this Cookie Policy, please
                contact us:
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
                For more information about how we handle your personal data, please refer to our{" "}
                <a href="/privacy" className="text-emerald-400 hover:text-emerald-300 transition-colors underline">
                  Privacy Policy
                </a>
                .
              </p>
            </AnimatedSection>

          </div>
        </div>
      </section>
    </>
  );
}
