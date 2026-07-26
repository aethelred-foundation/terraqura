"use client";

import Link from "next/link";
import {
  ArrowRight,
  Database,
  Fingerprint,
  Radio,
  ShieldCheck,
  WalletCards,
} from "lucide-react";

import {
  AnimatedSection,
  StaggerContainer,
  StaggerItem,
} from "@/components/shared/AnimatedSection";

const lifecycle = [
  {
    title: "Measured evidence",
    detail:
      "Provisioned sensors submit capture, energy, purity, and timestamp evidence. The API rejects replayed commitments and records every accepted reading in durable storage.",
    icon: Radio,
  },
  {
    title: "Deterministic verification",
    detail:
      "Source continuity, measurement bounds, energy intensity, anomaly rate, and issuance eligibility are calculated from the stored evidence window.",
    icon: ShieldCheck,
  },
  {
    title: "Wallet-owned units",
    detail:
      "Approved verification results can be issued to the operator wallet, listed in contract escrow, purchased, and permanently retired by the current owner.",
    icon: WalletCards,
  },
] as const;

const controls = [
  {
    title: "PostgreSQL registry",
    detail:
      "Projects, readings, verification state, holdings, listings, purchases, and retirement records survive process and host restarts.",
    icon: Database,
  },
  {
    title: "Receipt verification",
    detail:
      "The backend checks chain ID, contract target, signer, calldata, receipt status, and emitted event before changing indexed balances.",
    icon: Fingerprint,
  },
  {
    title: "Fail-closed operations",
    detail:
      "Missing RPC, contract, signer, KYC, or database configuration disables mutations instead of fabricating records.",
    icon: ShieldCheck,
  },
] as const;

export function TechnologyContent() {
  return (
    <>
      <section
        className="relative py-20 sm:py-24"
        aria-labelledby="tech-heading"
      >
        <div
          className="pointer-events-none absolute inset-0 bg-dot-grid opacity-25"
          aria-hidden="true"
        />
        <div className="container mx-auto px-6 sm:px-8 lg:px-10">
          <AnimatedSection className="relative mx-auto max-w-4xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-400/75">
              TerraQura architecture
            </p>
            <h1
              id="tech-heading"
              className="mt-5 text-display-lg text-white lg:text-display-xl"
            >
              Carbon operations with a verifiable state transition at every step
            </h1>
            <p className="mx-auto mt-6 max-w-3xl text-lg leading-relaxed text-white/60">
              TerraQura joins measured project evidence, deterministic
              verification, wallet-signed settlement, and durable audit records
              into one testnet workflow.
            </p>
            <Link
              href="/dashboard"
              className="mt-9 inline-flex items-center gap-2 bg-emerald-400 px-7 py-3.5 font-semibold text-[#03100c] transition hover:bg-emerald-300"
            >
              Open the operations workbench
              <ArrowRight className="h-4 w-4" />
            </Link>
          </AnimatedSection>
        </div>
      </section>

      <section className="border-y border-white/[0.07] bg-white/[0.015] py-20">
        <div className="container mx-auto px-6 sm:px-8 lg:px-10">
          <AnimatedSection className="mb-12 max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200/70">
              Operational lifecycle
            </p>
            <h2 className="mt-3 text-display text-white">
              Evidence becomes inventory only after verification
            </h2>
          </AnimatedSection>
          <StaggerContainer
            className="grid gap-px border border-white/[0.08] bg-white/[0.08] lg:grid-cols-3"
            staggerDelay={0.08}
          >
            {lifecycle.map((item, index) => (
              <StaggerItem key={item.title}>
                <article className="h-full bg-[#050b0a] p-7">
                  <div className="flex items-center justify-between">
                    <item.icon className="h-5 w-5 text-emerald-300" />
                    <span className="font-mono text-xs text-white/25">
                      0{index + 1}
                    </span>
                  </div>
                  <h3 className="mt-8 text-lg font-semibold text-white">
                    {item.title}
                  </h3>
                  <p className="mt-3 text-sm leading-6 text-white/50">
                    {item.detail}
                  </p>
                </article>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>
      </section>

      <section className="py-20">
        <div className="container mx-auto px-6 sm:px-8 lg:px-10">
          <AnimatedSection className="mb-12 max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300/70">
              Production controls
            </p>
            <h2 className="mt-3 text-display text-white">
              No synthetic balances or fabricated receipts
            </h2>
          </AnimatedSection>
          <div className="grid gap-5 lg:grid-cols-3">
            {controls.map((item) => (
              <article
                key={item.title}
                className="border border-white/[0.08] bg-white/[0.02] p-6"
              >
                <item.icon className="h-5 w-5 text-cyan-200" />
                <h3 className="mt-6 text-lg font-semibold text-white">
                  {item.title}
                </h3>
                <p className="mt-3 text-sm leading-6 text-white/50">
                  {item.detail}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
