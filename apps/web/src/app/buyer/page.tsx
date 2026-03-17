/**
 * TerraQura - Enterprise Buyer Landing Page
 *
 * Platform preview page for prospective carbon credit buyers.
 * Showcases the upcoming buyer journey, key benefits, and early access signup.
 *
 * @version 3.0.0
 */

"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { TerraQuraLogoFull } from "@/components/ui/TerraQuraLogo";

// ============================================================================
// ANIMATION VARIANTS
// ============================================================================

const fadeInUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.12, duration: 0.6, ease: "easeOut" as const },
  }),
};

const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
};

// ============================================================================
// DATA
// ============================================================================

const JOURNEY_STEPS = [
  {
    step: 1,
    title: "KYC Onboarding",
    description:
      "Complete institutional-grade identity verification powered by Sumsub. Accredited buyers gain full platform access within 24 hours.",
    icon: (
      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
      </svg>
    ),
  },
  {
    step: 2,
    title: "Browse Verified Credits",
    description:
      "Explore carbon credits from DAC facilities verified through our Proof-of-Physics engine. Every tonne is backed by real sensor data and on-chain attestation.",
    icon: (
      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
      </svg>
    ),
  },
  {
    step: 3,
    title: "Purchase via Fiat or Crypto",
    description:
      "Settle transactions with traditional fiat rails or on-chain via Aethelred. Gasless meta-transactions mean zero blockchain complexity for your team.",
    icon: (
      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z" />
      </svg>
    ),
  },
  {
    step: 4,
    title: "Retire & Get Certificate",
    description:
      "Retire credits on-chain and receive a tamper-proof retirement certificate with full provenance trail, ready for ESG disclosure and audit.",
    icon: (
      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
      </svg>
    ),
  },
];

const KEY_BENEFITS = [
  {
    title: "Physics-Verified Credits",
    description:
      "Every credit passes our Proof-of-Physics engine, validating energy-to-CO\u2082 ratios against thermodynamic bounds. No estimation, no guesswork.",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 0 1-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 0 1 4.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0 1 12 15a9.065 9.065 0 0 0-6.23.693L5 14.5m14.8.8 1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0 1 12 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
      </svg>
    ),
  },
  {
    title: "Gasless Settlement",
    description:
      "Meta-transactions on Aethelred mean buyers never pay gas fees. Your team interacts with verified carbon assets, not blockchain infrastructure.",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="m3.75 13.5 10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z" />
      </svg>
    ),
  },
  {
    title: "ESG Reporting Integration",
    description:
      "Export retirement data in formats aligned with GHG Protocol, CDP, and ISSB. Plug directly into your existing sustainability reporting workflow.",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
      </svg>
    ),
  },
  {
    title: "Full Provenance Trail",
    description:
      "Trace every credit from DAC sensor reading to ERC-1155 mint to retirement. Immutable on-chain history eliminates double-counting risk.",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m9.86-1.131 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" />
      </svg>
    ),
  },
];

// ============================================================================
// COMPONENT
// ============================================================================

export default function BuyerPage() {
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // In production, this would POST to an API endpoint.
    setSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-midnight-950 text-white">
      {/* ================================================================ */}
      {/* HEADER / NAV                                                     */}
      {/* ================================================================ */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-midnight-950/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <Link href="/" className="flex items-center">
            <TerraQuraLogoFull imageHeight={32} />
          </Link>
          <nav className="flex items-center gap-6">
            <Link
              href="/technology"
              className="text-sm text-white/70 transition-colors hover:text-emerald-400"
            >
              Technology
            </Link>
            <Link
              href="/explorer"
              className="text-sm text-white/70 transition-colors hover:text-emerald-400"
            >
              Explorer
            </Link>
            <Link
              href="/developers"
              className="text-sm text-white/70 transition-colors hover:text-emerald-400"
            >
              Developers
            </Link>
          </nav>
        </div>
      </header>

      <main className="pt-16">
        {/* ================================================================ */}
        {/* HERO SECTION                                                    */}
        {/* ================================================================ */}
        <section className="relative overflow-hidden">
          {/* Subtle gradient backdrop */}
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute left-1/2 top-0 -translate-x-1/2 h-[600px] w-[900px] rounded-full bg-emerald-500/[0.04] blur-[120px]" />
          </div>

          <div className="relative mx-auto max-w-4xl px-6 pb-20 pt-24 text-center sm:pt-32">
            {/* Badge */}
            <motion.div
              initial={false}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="mb-8 inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/[0.06] px-4 py-1.5"
            >
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              <span className="text-sm font-semibold uppercase tracking-widest text-emerald-400">
                Platform Preview
              </span>
            </motion.div>

            <motion.h1
              initial={false}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="font-display text-display-lg lg:text-display-xl"
            >
              Institutional-Grade{" "}
              <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
                Carbon Credit
              </span>{" "}
              Marketplace
            </motion.h1>

            <motion.p
              initial={false}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="mx-auto mt-6 max-w-2xl text-body-lg font-body leading-relaxed text-white/70"
            >
              Purchase physics-verified carbon removal credits from DAC
              facilities worldwide. Settle via fiat or on-chain, with full
              provenance from sensor to retirement certificate.
            </motion.p>

            <motion.div
              initial={false}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.35 }}
              className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row"
            >
              <a
                href="#early-access"
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-6 py-3 text-sm font-semibold text-midnight-950 shadow-lg shadow-emerald-500/20 transition-all hover:bg-emerald-400 hover:shadow-emerald-500/30"
              >
                Request Early Access
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                </svg>
              </a>
              <Link
                href="/technology"
                className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-6 py-3 text-sm font-medium text-white/60 transition-colors hover:border-white/20 hover:text-white"
              >
                Explore the Technology
              </Link>
            </motion.div>
          </div>
        </section>

        {/* ================================================================ */}
        {/* BUYER JOURNEY                                                   */}
        {/* ================================================================ */}
        <section className="border-t border-white/5 bg-midnight-950">
          <div className="mx-auto max-w-6xl px-6 py-16 sm:py-20 lg:py-24">
            <motion.div
              initial={false}
              whileInView="visible"
              viewport={{ once: true, amount: 0.2 }}
              variants={staggerContainer}
              className="text-center"
            >
              <motion.p
                variants={fadeInUp}
                custom={0}
                className="text-sm font-mono font-semibold uppercase tracking-widest text-emerald-400"
              >
                How It Works
              </motion.p>
              <motion.h2
                variants={fadeInUp}
                custom={1}
                className="mt-3 font-display text-display-sm"
              >
                The Buyer Journey
              </motion.h2>
              <motion.p
                variants={fadeInUp}
                custom={2}
                className="mx-auto mt-4 max-w-xl font-body text-[15px] leading-relaxed text-white/70"
              >
                From onboarding to retirement certificate: a streamlined path
                to verifiable carbon removal.
              </motion.p>
            </motion.div>

            <motion.div
              initial={false}
              whileInView="visible"
              viewport={{ once: true, amount: 0.15 }}
              variants={staggerContainer}
              className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-4"
            >
              {JOURNEY_STEPS.map((item, idx) => (
                <motion.div
                  key={item.step}
                  variants={fadeInUp}
                  custom={idx}
                  className="group relative rounded-2xl border border-white/5 bg-white/[0.02] p-6 transition-colors hover:border-emerald-500/20 hover:bg-emerald-500/[0.03]"
                >
                  {/* Step number */}
                  <div className="absolute -top-3.5 left-6 flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/10 text-xs font-bold text-emerald-400 ring-1 ring-emerald-500/30">
                    {item.step}
                  </div>

                  <div className="mt-3 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
                    {item.icon}
                  </div>

                  <h3 className="mt-5 text-lg font-semibold tracking-tight">
                    {item.title}
                  </h3>
                  <p className="mt-2 text-[15px] font-body leading-relaxed text-white/70">
                    {item.description}
                  </p>
                </motion.div>
              ))}
            </motion.div>

            {/* Connecting line (visible on lg only) */}
            <div className="mt-2 hidden lg:block">
              <div className="mx-auto h-px w-3/4 bg-gradient-to-r from-transparent via-emerald-500/20 to-transparent" />
            </div>
          </div>
        </section>

        {/* ================================================================ */}
        {/* KEY BENEFITS                                                    */}
        {/* ================================================================ */}
        <section className="border-t border-white/5 bg-gradient-to-b from-midnight-950 to-midnight-950/95">
          <div className="mx-auto max-w-6xl px-6 py-16 sm:py-20 lg:py-24">
            <motion.div
              initial={false}
              whileInView="visible"
              viewport={{ once: true, amount: 0.2 }}
              variants={staggerContainer}
              className="text-center"
            >
              <motion.p
                variants={fadeInUp}
                custom={0}
                className="text-sm font-mono font-semibold uppercase tracking-widest text-emerald-400"
              >
                Why TerraQura
              </motion.p>
              <motion.h2
                variants={fadeInUp}
                custom={1}
                className="mt-3 font-display text-display-sm"
              >
                Built for Institutional Buyers
              </motion.h2>
              <motion.p
                variants={fadeInUp}
                custom={2}
                className="mx-auto mt-4 max-w-xl font-body text-[15px] leading-relaxed text-white/70"
              >
                Every layer of the platform is designed for compliance,
                transparency, and trust at enterprise scale.
              </motion.p>
            </motion.div>

            <motion.div
              initial={false}
              whileInView="visible"
              viewport={{ once: true, amount: 0.15 }}
              variants={staggerContainer}
              className="mt-16 grid gap-8 sm:grid-cols-2"
            >
              {KEY_BENEFITS.map((benefit, idx) => (
                <motion.div
                  key={benefit.title}
                  variants={fadeInUp}
                  custom={idx}
                  className="flex gap-5 rounded-2xl border border-white/5 bg-white/[0.02] p-6 transition-colors hover:border-emerald-500/20"
                >
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
                    {benefit.icon}
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold tracking-tight">
                      {benefit.title}
                    </h3>
                    <p className="mt-2 text-[15px] font-body leading-relaxed text-white/70">
                      {benefit.description}
                    </p>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* ================================================================ */}
        {/* EARLY ACCESS CTA                                                */}
        {/* ================================================================ */}
        <section
          id="early-access"
          className="border-t border-white/5 bg-midnight-950"
        >
          <div className="mx-auto max-w-2xl px-6 py-16 sm:py-20 lg:py-24">
            <motion.div
              initial={false}
              whileInView="visible"
              viewport={{ once: true, amount: 0.3 }}
              variants={staggerContainer}
              className="rounded-2xl border border-emerald-500/10 bg-emerald-500/[0.03] p-8 text-center sm:p-12"
            >
              <motion.div
                variants={fadeInUp}
                custom={0}
                className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10"
              >
                <svg
                  className="h-7 w-7 text-emerald-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15.59 14.37a6 6 0 0 1-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 0 0 6.16-12.12A14.98 14.98 0 0 0 9.631 8.41m5.96 5.96a14.926 14.926 0 0 1-5.841 2.58m-.119-8.54a6 6 0 0 0-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 0 0-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 0 1-2.448-2.448 14.9 14.9 0 0 1 .06-.312m-2.24 2.39a4.493 4.493 0 0 0-1.757 4.306 4.493 4.493 0 0 0 4.306-1.758M16.5 9a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Z"
                  />
                </svg>
              </motion.div>

              <motion.h2
                variants={fadeInUp}
                custom={1}
                className="mt-6 font-display text-display-sm"
              >
                Join the Pilot Program
              </motion.h2>

              <motion.p
                variants={fadeInUp}
                custom={2}
                className="mt-3 text-[15px] font-body leading-relaxed text-white/70"
              >
                We are onboarding a limited cohort of enterprise buyers for our
                inaugural marketplace launch. Secure your position and shape the
                platform alongside us.
              </motion.p>

              {submitted ? (
                <motion.div
                  initial={false}
                  animate={{ opacity: 1, scale: 1 }}
                  className="mt-8 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-6"
                >
                  <svg
                    className="mx-auto h-10 w-10 text-emerald-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
                    />
                  </svg>
                  <p className="mt-3 font-semibold text-emerald-300">
                    Request Received
                  </p>
                  <p className="mt-1 text-sm font-body text-white/70">
                    Our team will reach out within 48 hours to discuss next
                    steps.
                  </p>
                </motion.div>
              ) : (
                <motion.form
                  variants={fadeInUp}
                  custom={3}
                  onSubmit={handleSubmit}
                  className="mt-8 space-y-4"
                >
                  <div className="grid gap-4 sm:grid-cols-2">
                    <input
                      type="text"
                      required
                      placeholder="Company name"
                      value={company}
                      onChange={(e) => setCompany(e.target.value)}
                      className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-gray-500 outline-none transition-colors focus:border-emerald-500/40 focus:ring-1 focus:ring-emerald-500/20"
                    />
                    <input
                      type="email"
                      required
                      placeholder="Work email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-gray-500 outline-none transition-colors focus:border-emerald-500/40 focus:ring-1 focus:ring-emerald-500/20"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full rounded-lg bg-emerald-500 px-6 py-3 text-sm font-semibold text-midnight-950 shadow-lg shadow-emerald-500/20 transition-all hover:bg-emerald-400 hover:shadow-emerald-500/30 sm:w-auto"
                  >
                    Request Early Access
                  </button>
                </motion.form>
              )}
            </motion.div>

            {/* Disclaimer */}
            <motion.p
              initial={false}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.4 }}
              className="mt-6 text-center text-sm font-body leading-relaxed text-white/70"
            >
              This page represents an upcoming platform feature. The TerraQura
              marketplace is currently in development. No credits are available
              for purchase at this time. Smart contracts are deployed on the
              Aethelred Network for demonstration purposes only.
            </motion.p>
          </div>
        </section>
      </main>

      {/* ================================================================ */}
      {/* FOOTER                                                           */}
      {/* ================================================================ */}
      <footer className="border-t border-white/5 bg-midnight-950">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 py-8 sm:flex-row">
          <div className="flex items-center gap-2 text-sm text-white/70">
            <TerraQuraLogoFull imageHeight={18} />
            <span>&copy; {new Date().getFullYear()} Zhyra Holdings. All rights reserved.</span>
          </div>
          <div className="flex items-center gap-6">
            <Link
              href="/about"
              className="text-sm text-white/70 transition-colors hover:text-gray-300"
            >
              About
            </Link>
            <Link
              href="/developers"
              className="text-sm text-white/70 transition-colors hover:text-gray-300"
            >
              Developers
            </Link>
            <Link
              href="/explorer"
              className="text-sm text-white/70 transition-colors hover:text-gray-300"
            >
              Explorer
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
