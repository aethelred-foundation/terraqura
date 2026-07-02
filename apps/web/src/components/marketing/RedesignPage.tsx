import type { ReactNode } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  CheckCircle2,
  Database,
  FileCheck2,
  Hexagon,
  Radio,
  ShieldCheck,
} from "lucide-react";
import { OptimizedImage } from "@/components/shared/OptimizedImage";
import type { ImageKey } from "@/lib/image-manifest";

type CTA = {
  label: string;
  href: string;
  variant?: "primary" | "secondary";
};

type Metric = {
  label: string;
  value: string;
};

type HeroPanel = {
  title: string;
  rows: Array<{ label: string; value: string }>;
};

export type Capability = {
  title: string;
  description: string;
  icon: LucideIcon;
  image?: ImageKey;
  meta?: string;
};

export type ProcessStep = {
  label: string;
  title: string;
  description: string;
};

type Showcase = {
  title: ReactNode;
  description: string;
  image: ImageKey;
  imageAlt: string;
  points: Array<{ title: string; description: string }>;
};

export type RedesignPageProps = {
  hero: {
    id: string;
    label: string;
    title: ReactNode;
    description: string;
    image: ImageKey;
    imageAlt: string;
    primaryCta: CTA;
    secondaryCta?: CTA;
    metrics: Metric[];
    panel: HeroPanel;
  };
  intro: {
    eyebrow: string;
    title: ReactNode;
    description: string;
    bullets: string[];
    image: ImageKey;
    imageAlt: string;
  };
  capabilities: {
    eyebrow: string;
    title: ReactNode;
    description: string;
    items: Capability[];
  };
  process: {
    eyebrow: string;
    title: ReactNode;
    description: string;
    steps: ProcessStep[];
  };
  showcase: Showcase;
  cta: {
    id?: string;
    title: ReactNode;
    description: string;
    primary: CTA;
    secondary?: CTA;
    image: ImageKey;
  };
  children?: ReactNode;
};

function ButtonLink({ cta }: { cta: CTA }) {
  const primary = cta.variant !== "secondary";

  return (
    <Link
      href={cta.href}
      className={
        primary
          ? "inline-flex min-h-11 items-center justify-center gap-2 rounded-[6px] bg-emerald-400 px-5 py-3 text-[13px] font-semibold text-[#03120d] transition-colors hover:bg-emerald-300 focus-visible:ring-2 focus-visible:ring-emerald-300"
          : "inline-flex min-h-11 items-center justify-center gap-2 rounded-[6px] border border-white/[0.16] bg-white/[0.035] px-5 py-3 text-[13px] font-semibold text-white/[0.82] transition-colors hover:border-emerald-300/[0.45] hover:text-white focus-visible:ring-2 focus-visible:ring-emerald-300"
      }
    >
      {cta.label}
      <ArrowRight className="h-4 w-4" />
    </Link>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="mb-4 text-[11px] font-semibold uppercase leading-none tracking-[0.18em] text-emerald-300/[0.74]">
      {children}
    </p>
  );
}

function ProofConsole({ panel }: { panel: HeroPanel }) {
  return (
    <div className="relative overflow-hidden rounded-[8px] border border-white/[0.12] bg-[#041017]/[0.82] p-4 shadow-[0_24px_80px_-42px_rgba(0,0,0,0.85)] backdrop-blur-xl">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-300/70 to-transparent" />
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[6px] border border-emerald-300/25 bg-emerald-300/10 text-emerald-200">
            <Radio className="h-4 w-4" />
          </span>
          <p className="truncate text-[13px] font-semibold text-white/88">
            {panel.title}
          </p>
        </div>
        <span className="inline-flex shrink-0 items-center gap-2 rounded-[6px] border border-emerald-300/20 bg-emerald-300/10 px-2.5 py-1 text-[10px] font-semibold text-emerald-200">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
          Live
        </span>
      </div>

      <div className="mt-5 grid gap-2 sm:grid-cols-2">
        {panel.rows.map((row) => (
          <div
            key={`${row.label}-${row.value}`}
            className="rounded-[6px] border border-white/10 bg-white/[0.025] p-3"
          >
            <p className="text-[10px] uppercase leading-none tracking-[0.14em] text-white/[0.38]">
              {row.label}
            </p>
            <p className="mt-2 break-words font-mono text-[12px] text-emerald-100/90">
              {row.value}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-5 rounded-[6px] border border-white/10 bg-[#020509]/70 p-3">
        <div className="flex h-24 items-end gap-1.5">
          {[24, 38, 34, 48, 44, 58, 53, 66, 61, 73, 69, 82].map(
            (height, index) => (
              <span
                key={`${height}-${index}`}
                className="flex-1 rounded-t-[2px] bg-emerald-400/[0.64]"
                style={{ height: `${height}%` }}
              />
            ),
          )}
        </div>
      </div>
    </div>
  );
}

function MetricRail({ metrics }: { metrics: Metric[] }) {
  if (!metrics.length) return null;

  return (
    <div className="border-y border-white/10 bg-[#020509]">
      <div className="mx-auto grid max-w-[1500px] grid-cols-2 px-4 sm:grid-cols-3 lg:grid-cols-5 lg:px-6">
        {metrics.map((metric) => (
          <div
            key={`${metric.label}-${metric.value}`}
            className="min-w-0 border-r border-white/10 px-4 py-6 last:border-r-0 sm:px-6"
          >
            <p className="font-display text-2xl leading-none text-emerald-300 sm:text-3xl">
              {metric.value}
            </p>
            <p className="mt-3 text-[12px] leading-relaxed text-white/[0.58]">
              {metric.label}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function Hero({ hero }: { hero: RedesignPageProps["hero"] }) {
  return (
    <section
      className="relative min-h-[650px] overflow-hidden border-b border-white/10"
      aria-labelledby={hero.id}
    >
      <div className="absolute inset-0" aria-hidden>
        <OptimizedImage
          src={hero.image}
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-center opacity-[0.9]"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#020509] via-[#020509]/[0.76] to-[#020509]/[0.12]" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#020509] via-[#020509]/[0.1] to-[#020509]/[0.4]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.034)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px)] bg-[size:72px_72px] opacity-45" />
      </div>

      <div className="relative z-10 mx-auto grid min-h-[650px] max-w-[1500px] gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[0.95fr_0.72fr] lg:items-center lg:py-20">
        <div className="max-w-4xl">
          <h1
            id={hero.id}
            className="font-display text-5xl font-semibold leading-[0.98] tracking-normal text-white sm:text-6xl lg:text-[72px]"
          >
            {hero.title}
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-relaxed text-white/[0.78] sm:text-lg">
            {hero.description}
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <ButtonLink cta={hero.primaryCta} />
            {hero.secondaryCta ? (
              <ButtonLink cta={{ ...hero.secondaryCta, variant: "secondary" }} />
            ) : null}
          </div>
        </div>

        <div className="lg:pl-6">
          <ProofConsole panel={hero.panel} />
        </div>
      </div>
    </section>
  );
}

function IntroSection({
  intro,
}: {
  intro: RedesignPageProps["intro"];
}) {
  return (
    <section className="border-b border-white/10 bg-[#020509] px-4 py-16 sm:px-6 lg:py-20">
      <div className="mx-auto grid max-w-[1500px] gap-10 lg:grid-cols-[0.78fr_1.05fr] lg:items-center">
        <div>
          <SectionLabel>{intro.eyebrow}</SectionLabel>
          <h2 className="max-w-3xl font-display text-3xl font-semibold leading-tight text-white sm:text-5xl">
            {intro.title}
          </h2>
          <p className="mt-6 max-w-2xl text-[15px] leading-relaxed text-white/[0.66]">
            {intro.description}
          </p>
          <div className="mt-7 grid gap-3">
            {intro.bullets.map((bullet) => (
              <div
                key={bullet}
                className="flex items-start gap-3 text-sm leading-relaxed text-white/[0.7]"
              >
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
                <span>{bullet}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="relative min-h-[420px] overflow-hidden rounded-[8px] border border-white/10 bg-[#061017]">
          <OptimizedImage
            src={intro.image}
            alt={intro.imageAlt}
            fill
            sizes="(min-width: 1024px) 52vw, 100vw"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#020509]/82 via-transparent to-transparent" />
          <div className="absolute bottom-5 left-5 right-5 grid gap-3 sm:grid-cols-2">
            {["Source data", "Model checks", "Provenance", "Audit export"].map(
              (label, index) => (
                <div
                  key={label}
                  className="rounded-[6px] border border-white/[0.12] bg-[#020509]/[0.72] p-3 backdrop-blur-md"
                >
                  <p className="text-[10px] uppercase tracking-[0.14em] text-emerald-200/70">
                    0{index + 1}
                  </p>
                  <p className="mt-2 text-[12px] font-semibold text-white/86">
                    {label}
                  </p>
                </div>
              ),
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function CapabilityDeck({
  capabilities,
}: {
  capabilities: RedesignPageProps["capabilities"];
}) {
  return (
    <section className="border-b border-white/10 bg-[#03070b] px-4 py-16 sm:px-6 lg:py-20">
      <div className="mx-auto max-w-[1500px]">
        <div className="grid gap-7 lg:grid-cols-[0.62fr_1fr] lg:items-end">
          <div>
            <SectionLabel>{capabilities.eyebrow}</SectionLabel>
            <h2 className="max-w-3xl font-display text-3xl font-semibold leading-tight text-white sm:text-5xl">
              {capabilities.title}
            </h2>
          </div>
          <p className="max-w-2xl text-[15px] leading-relaxed text-white/[0.64] lg:justify-self-end">
            {capabilities.description}
          </p>
        </div>

        <div className="mt-10 grid gap-4 lg:grid-cols-3">
          {capabilities.items.map((item) => {
            const Icon = item.icon;

            return (
              <article
                key={item.title}
                className="group overflow-hidden rounded-[8px] border border-white/10 bg-[#061017] transition-colors hover:border-emerald-300/[0.3]"
              >
                {item.image ? (
                  <div className="relative h-56 border-b border-white/10">
                    <OptimizedImage
                      src={item.image}
                      alt=""
                      fill
                      sizes="(min-width: 1024px) 33vw, 100vw"
                      className="object-cover opacity-[0.86] transition-transform duration-700 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#061017] via-transparent to-transparent" />
                  </div>
                ) : null}
                <div className="p-5 sm:p-6">
                  <div className="flex items-start justify-between gap-4">
                    <span className="flex h-10 w-10 items-center justify-center rounded-[6px] border border-emerald-300/[0.24] bg-emerald-300/10 text-emerald-200">
                      <Icon className="h-4 w-4" />
                    </span>
                    {item.meta ? (
                      <span className="text-[10px] uppercase tracking-[0.16em] text-white/[0.36]">
                        {item.meta}
                      </span>
                    ) : null}
                  </div>
                  <h3 className="mt-8 font-display text-2xl leading-tight text-white">
                    {item.title}
                  </h3>
                  <p className="mt-3 text-[13px] leading-relaxed text-white/[0.6]">
                    {item.description}
                  </p>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function ProcessTimeline({ process }: { process: RedesignPageProps["process"] }) {
  return (
    <section className="border-b border-white/10 bg-[#020509] px-4 py-16 sm:px-6 lg:py-20">
      <div className="mx-auto max-w-[1500px]">
        <div className="max-w-3xl">
          <SectionLabel>{process.eyebrow}</SectionLabel>
          <h2 className="font-display text-3xl font-semibold leading-tight text-white sm:text-5xl">
            {process.title}
          </h2>
          <p className="mt-5 text-[15px] leading-relaxed text-white/[0.64]">
            {process.description}
          </p>
        </div>

        <div className="mt-10 grid border-y border-white/10 lg:grid-cols-4">
          {process.steps.map((step, index) => (
            <article
              key={`${step.label}-${step.title}`}
              className="relative min-h-[230px] border-b border-white/10 px-4 py-6 last:border-b-0 lg:border-b-0 lg:border-r lg:last:border-r-0"
            >
              <div className="mb-8 flex items-center justify-between gap-4">
                <span className="flex h-10 w-10 items-center justify-center rounded-[6px] border border-emerald-300/[0.24] bg-emerald-300/10 text-emerald-200">
                  {index === 0 ? (
                    <Database className="h-4 w-4" />
                  ) : index === 1 ? (
                    <ShieldCheck className="h-4 w-4" />
                  ) : index === 2 ? (
                    <FileCheck2 className="h-4 w-4" />
                  ) : (
                    <Hexagon className="h-4 w-4" />
                  )}
                </span>
                <span className="text-[10px] uppercase tracking-[0.16em] text-emerald-200/68">
                  {step.label}
                </span>
              </div>
              <h3 className="font-display text-xl leading-tight text-white">
                {step.title}
              </h3>
              <p className="mt-3 text-[13px] leading-relaxed text-white/[0.58]">
                {step.description}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function ShowcaseSection({ showcase }: { showcase: Showcase }) {
  return (
    <section className="border-b border-white/10 bg-[#03070b] px-4 py-16 sm:px-6 lg:py-20">
      <div className="mx-auto grid max-w-[1500px] gap-10 lg:grid-cols-[1.05fr_0.78fr] lg:items-center">
        <div className="relative min-h-[520px] overflow-hidden rounded-[8px] border border-white/10 bg-[#061017]">
          <OptimizedImage
            src={showcase.image}
            alt={showcase.imageAlt}
            fill
            sizes="(min-width: 1024px) 55vw, 100vw"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#020509]/90 via-[#020509]/10 to-transparent" />
          <div className="absolute bottom-5 left-5 right-5 grid gap-3 md:grid-cols-3">
            {showcase.points.map((point) => (
              <div
                key={point.title}
                className="rounded-[6px] border border-white/[0.12] bg-[#020509]/[0.74] p-4 backdrop-blur-md"
              >
                <h3 className="font-display text-base leading-tight text-white">
                  {point.title}
                </h3>
                <p className="mt-2 line-clamp-3 text-[12px] leading-relaxed text-white/[0.58]">
                  {point.description}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div>
          <SectionLabel>Market proof</SectionLabel>
          <h2 className="font-display text-3xl font-semibold leading-tight text-white sm:text-5xl">
            {showcase.title}
          </h2>
          <p className="mt-6 text-[15px] leading-relaxed text-white/[0.64]">
            {showcase.description}
          </p>
          <div className="mt-8 rounded-[8px] border border-white/10 bg-[#061017] p-5">
            <div className="flex items-center gap-3 text-[13px] font-semibold text-emerald-100">
              <ShieldCheck className="h-4 w-4 text-emerald-300" />
              Evidence stays attached from source to claim.
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function ClosingCta({ cta }: { cta: RedesignPageProps["cta"] }) {
  return (
    <section
      id={cta.id}
      className="relative overflow-hidden bg-[#020509] px-4 py-16 sm:px-6 lg:py-20"
    >
      <div className="absolute inset-0" aria-hidden>
        <OptimizedImage
          src={cta.image}
          alt=""
          fill
          sizes="100vw"
          className="object-cover opacity-[0.58]"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#020509] via-[#020509]/[0.84] to-[#020509]/[0.34]" />
      </div>
      <div className="relative z-10 mx-auto flex max-w-[1500px] flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          <h2 className="font-display text-3xl font-semibold leading-tight text-white sm:text-5xl">
            {cta.title}
          </h2>
          <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-white/[0.68]">
            {cta.description}
          </p>
        </div>
        <div className="flex shrink-0 flex-col gap-3 sm:flex-row">
          <ButtonLink cta={cta.primary} />
          {cta.secondary ? (
            <ButtonLink cta={{ ...cta.secondary, variant: "secondary" }} />
          ) : null}
        </div>
      </div>
    </section>
  );
}

export function RedesignPage({
  hero,
  intro,
  capabilities,
  process,
  showcase,
  cta,
  children,
}: RedesignPageProps) {
  return (
    <div className="overflow-x-hidden bg-[#020509] text-white">
      <Hero hero={hero} />
      <MetricRail metrics={hero.metrics} />
      <IntroSection intro={intro} />
      <CapabilityDeck capabilities={capabilities} />
      <ProcessTimeline process={process} />
      <ShowcaseSection showcase={showcase} />
      {children}
      <ClosingCta cta={cta} />
    </div>
  );
}
