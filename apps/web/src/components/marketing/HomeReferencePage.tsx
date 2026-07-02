import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Database,
  Factory,
  FileCheck2,
  Globe2,
  Hexagon,
  Landmark,
  Linkedin,
  LockKeyhole,
  Radio,
  Satellite,
  ShieldCheck,
  TrendingUp,
  Zap,
} from "lucide-react";
import { OptimizedImage } from "@/components/shared/OptimizedImage";
import type { ImageKey } from "@/lib/image-manifest";

const navLinks = [
  { href: "/technology", label: "Platform" },
  { href: "/solutions/enterprise", label: "Solutions" },
  { href: "/projects", label: "Projects" },
  { href: "/blog", label: "Resources" },
  { href: "/about", label: "Company" },
];

const heroMetrics = [
  { value: "93.6M+", label: "Tonnes CO₂e verified" },
  { value: "1,240+", label: "Projects monitored" },
  { value: "85+", label: "Countries" },
  { value: "99.7%", label: "Data uptime" },
];

const platformLayers: Array<{
  title: string;
  body: string;
  icon: LucideIcon;
}> = [
  {
    title: "Facility Telemetry",
    body: "Continuous capture, energy, flow, and storage signals from operating assets.",
    icon: Factory,
  },
  {
    title: "Satellite Observation",
    body: "Independent land, facility, thermal, and activity checks for every project.",
    icon: Satellite,
  },
  {
    title: "Physics Models",
    body: "Quantified uncertainty, anomaly detection, and permanence validation.",
    icon: Zap,
  },
  {
    title: "Audit Provenance",
    body: "Signed evidence packages that trace each tonne from data to credit.",
    icon: ShieldCheck,
  },
];

const proofSteps: Array<{
  title: string;
  body: string;
  icon: LucideIcon;
}> = [
  {
    title: "Data Ingest",
    body: "Telemetry, satellite, and third-party feeds enter a normalized evidence graph.",
    icon: Database,
  },
  {
    title: "Validation",
    body: "Physics checks and boundary tests reject weak or inconsistent claims.",
    icon: ShieldCheck,
  },
  {
    title: "Evidence Package",
    body: "Model outputs, source documents, and signatures are bundled for review.",
    icon: FileCheck2,
  },
  {
    title: "Independent Audit",
    body: "Auditors receive a complete trail instead of disconnected spreadsheets.",
    icon: CheckCircle2,
  },
  {
    title: "Credit Issuance",
    body: "Approved credits carry provenance, confidence, and retirement history.",
    icon: LockKeyhole,
  },
];

const pathways: Array<{
  title: string;
  body: string;
  image: ImageKey;
  href: string;
  icon: LucideIcon;
}> = [
  {
    title: "For Buyers",
    body: "Procure carbon credits with evidence, confidence scores, and audit-ready portfolios.",
    image: "institutional-climate-finance",
    href: "/buyer",
    icon: BarChart3,
  },
  {
    title: "For Operators",
    body: "Turn facility data into verified performance records and faster assurance cycles.",
    image: "carbon-removal",
    href: "/operator",
    icon: Factory,
  },
  {
    title: "For Investors",
    body: "Underwrite project risk with transparent pipeline, permanence, and delivery signals.",
    image: "high-intensity-carbon-market",
    href: "/investor",
    icon: TrendingUp,
  },
  {
    title: "For Regulators",
    body: "Inspect provenance, policy alignment, and compliance evidence from one source.",
    image: "regulator-ready-audit-trail",
    href: "/regulatory",
    icon: Landmark,
  },
];

const footerSections: Array<{
  title: string;
  links: Array<[label: string, href: string]>;
}> = [
  {
    title: "Platform",
    links: [
      ["Technology", "/technology"],
      ["Data sources", "/explorer"],
      ["Security", "/technology#security"],
      ["Integrations", "/developers"],
    ],
  },
  {
    title: "Solutions",
    links: [
      ["For Buyers", "/buyer"],
      ["For Operators", "/operator"],
      ["For Investors", "/investor"],
      ["For Regulators", "/regulatory"],
    ],
  },
  {
    title: "Resources",
    links: [
      ["Documentation", "/developers"],
      ["Blog", "/blog"],
      ["Projects", "/projects"],
      ["API", "/developers"],
    ],
  },
  {
    title: "Company",
    links: [
      ["About", "/about"],
      ["Careers", "/about#careers"],
      ["News", "/blog"],
      ["Contact", "/about#contact"],
    ],
  },
];

function XIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function Brand() {
  return (
    <span className="inline-flex items-center gap-3">
      <span className="relative flex h-8 w-8 items-center justify-center text-emerald-300">
        <Hexagon className="h-full w-full" strokeWidth={1.6} />
        <span className="absolute h-3 w-3 rounded-[2px] border border-emerald-300/75" />
      </span>
      <span className="font-display text-xl font-semibold leading-none text-white">
        TerraQura
      </span>
    </span>
  );
}

function PrimaryLink({
  href,
  children,
  variant = "primary",
}: {
  href: string;
  children: string;
  variant?: "primary" | "secondary";
}) {
  const classes =
    variant === "primary"
      ? "border-emerald-300 bg-emerald-300 text-[#02110d] hover:bg-emerald-200"
      : "border-white/18 bg-white/[0.03] text-white hover:border-emerald-300/55 hover:text-emerald-100";

  return (
    <Link
      href={href}
      className={`inline-flex h-11 items-center justify-center gap-2 rounded-md border px-5 text-sm font-semibold leading-none transition-colors ${classes}`}
    >
      {children}
      <ArrowRight className="h-4 w-4" strokeWidth={1.8} />
    </Link>
  );
}

function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#020509]/86 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between px-5 sm:px-8">
        <Link href="/" aria-label="TerraQura home" className="shrink-0">
          <Brand />
        </Link>

        <nav
          aria-label="Primary navigation"
          className="hidden items-center gap-8 lg:flex"
        >
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm font-medium leading-none text-white/72 transition-colors hover:text-white"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="hidden text-sm font-medium text-white/70 transition-colors hover:text-white sm:inline-flex"
          >
            Sign in
          </Link>
          <Link
            href="/solutions/enterprise"
            className="hidden h-9 items-center justify-center rounded-md border border-emerald-300/45 bg-emerald-300/10 px-4 text-sm font-semibold text-emerald-100 transition-colors hover:border-emerald-200 hover:text-white sm:inline-flex"
          >
            Request access
          </Link>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="relative min-h-[780px] overflow-hidden border-b border-white/10">
      <div className="absolute inset-0">
        <OptimizedImage
          src="satellite-mrv-layer"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-[58%_42%] opacity-85"
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,#020509_0%,rgba(2,5,9,0.92)_32%,rgba(2,5,9,0.42)_68%,rgba(2,5,9,0.72)_100%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(2,5,9,0.42)_0%,rgba(2,5,9,0)_42%,#020509_100%)]" />
      </div>

      <div className="relative mx-auto grid min-h-[780px] max-w-[1440px] items-center gap-12 px-5 py-16 sm:px-8 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="max-w-4xl pt-8">
          <h1 className="font-display text-[44px] font-medium leading-[1.05] text-white sm:text-7xl sm:leading-[1.02] lg:text-[86px]">
            <span className="sm:hidden">
              Carbon markets
              <br />
              rebuilt on
              <br />
              evidence.
            </span>
            <span className="hidden sm:inline">
              Carbon markets
              <br />
              rebuilt on evidence.
            </span>
          </h1>
          <p className="mt-7 max-w-[330px] text-base leading-7 text-white/76 sm:max-w-2xl sm:text-xl sm:leading-8">
            Live facility telemetry, satellite observation, physics checks, and
            audit-ready provenance for every verified tonne.
          </p>
          <div className="mt-9 flex max-w-[330px] flex-col gap-3 sm:max-w-none sm:flex-row">
            <PrimaryLink href="/technology">Explore the platform</PrimaryLink>
            <PrimaryLink href="/solutions/enterprise" variant="secondary">
              Request access
            </PrimaryLink>
          </div>

          <div className="mt-14 grid max-w-[330px] grid-cols-2 overflow-hidden rounded-lg border border-white/12 bg-[#061017]/78 backdrop-blur-md sm:max-w-4xl lg:grid-cols-4">
            {heroMetrics.map((metric) => (
              <div
                key={metric.label}
                className="border-b border-white/10 px-5 py-5 last:border-b-0 even:border-l even:border-white/10 lg:border-b-0 lg:border-l lg:first:border-l-0"
              >
                <p className="font-display text-3xl font-medium leading-none text-emerald-300">
                  {metric.value}
                </p>
                <p className="mt-2 text-sm leading-5 text-white/60">
                  {metric.label}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="relative hidden min-h-[520px] lg:block">
          <div className="absolute inset-x-6 top-4 h-px bg-gradient-to-r from-transparent via-emerald-300/45 to-transparent" />
          <div className="absolute right-0 top-16 w-full max-w-[520px] rounded-lg border border-white/12 bg-[#051017]/76 p-5 shadow-[0_24px_90px_-50px_rgba(0,0,0,0.95)] backdrop-blur-xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <p className="text-sm font-semibold text-white">
                  Live assurance layer
                </p>
                <p className="mt-1 text-sm text-white/54">
                  Evidence stream · verified now
                </p>
              </div>
              <span className="inline-flex items-center gap-2 rounded-md border border-emerald-300/35 bg-emerald-300/10 px-3 py-2 text-sm font-semibold text-emerald-200">
                <span className="h-2 w-2 rounded-full bg-emerald-300" />
                Online
              </span>
            </div>
            <div className="grid gap-3 py-5">
              {[
                ["Telemetry packets", "3.2B/day"],
                ["Independent checks", "99.7% uptime"],
                ["Projects under watch", "1,240+"],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="flex items-center justify-between rounded-md border border-white/10 bg-white/[0.025] px-4 py-3"
                >
                  <span className="text-sm text-white/62">{label}</span>
                  <span className="font-display text-lg text-white">
                    {value}
                  </span>
                </div>
              ))}
            </div>
            <div className="relative h-40 overflow-hidden rounded-md border border-white/10">
              <OptimizedImage
                src="mrv-data-river"
                alt="Multi-source MRV data flowing into TerraQura"
                fill
                sizes="520px"
                className="object-cover opacity-85"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#061017] to-transparent" />
              <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between text-sm">
                <span className="text-white/72">Evidence graph synced</span>
                <span className="font-semibold text-emerald-200">
                  Audit ready
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function PlatformSection() {
  return (
    <section className="border-b border-white/10 bg-[#020509] py-24">
      <div className="mx-auto grid max-w-[1440px] gap-14 px-5 sm:px-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
        <div className="relative min-h-[520px] overflow-hidden rounded-lg border border-white/10 bg-[#050b10]">
          <OptimizedImage
            src="verification-stack-architecture"
            alt="TerraQura layered verification architecture"
            fill
            sizes="(min-width: 1024px) 48vw, 100vw"
            className="object-contain p-8 [mask-image:radial-gradient(ellipse_at_center,black_62%,transparent_82%)]"
          />
        </div>

        <div>
          <h2 className="max-w-2xl font-display text-4xl font-medium leading-tight text-white sm:text-5xl">
            End-to-end carbon verification infrastructure.
          </h2>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-white/64">
            TerraQura connects multi-source data, physics-based models, evidence
            packages, and independent assurance into one trusted foundation for
            carbon markets.
          </p>

          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            {platformLayers.map((layer) => {
              const Icon = layer.icon;

              return (
                <article
                  key={layer.title}
                  className="rounded-lg border border-white/10 bg-white/[0.025] p-5"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-md border border-emerald-300/35 bg-emerald-300/10 text-emerald-200">
                    <Icon className="h-5 w-5" strokeWidth={1.7} />
                  </span>
                  <h3 className="mt-5 text-lg font-semibold text-white">
                    {layer.title}
                  </h3>
                  <p className="mt-3 text-sm leading-6 text-white/58">
                    {layer.body}
                  </p>
                </article>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

function ProofSection() {
  return (
    <section className="relative overflow-hidden border-b border-white/10 py-24">
      <div className="absolute inset-0">
        <OptimizedImage
          src="mrv-data-river"
          alt=""
          fill
          sizes="100vw"
          className="object-cover opacity-36"
        />
        <div className="absolute inset-0 bg-[#020509]/72" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#020509] via-transparent to-[#020509]" />
      </div>

      <div className="relative mx-auto max-w-[1440px] px-5 sm:px-8">
        <div className="max-w-3xl">
          <h2 className="font-display text-4xl font-medium leading-tight text-white sm:text-5xl">
            Proof in every tonne.
          </h2>
          <p className="mt-5 text-lg leading-8 text-white/66">
            A transparent proof chain turns raw project data into credits that
            can be inspected, underwritten, purchased, and retired with
            confidence.
          </p>
        </div>

        <div className="mt-12 grid gap-4 lg:grid-cols-5">
          {proofSteps.map((step) => {
            const Icon = step.icon;

            return (
              <article
                key={step.title}
                className="rounded-lg border border-white/10 bg-[#051017]/78 p-5 backdrop-blur-md"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-md border border-emerald-300/35 bg-emerald-300/10 text-emerald-200">
                  <Icon className="h-5 w-5" strokeWidth={1.7} />
                </span>
                <h3 className="mt-5 text-lg font-semibold text-white">
                  {step.title}
                </h3>
                <p className="mt-3 text-sm leading-6 text-white/60">
                  {step.body}
                </p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function PathwaysSection() {
  return (
    <section className="border-b border-white/10 bg-[#020509] py-24">
      <div className="mx-auto max-w-[1440px] px-5 sm:px-8">
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div>
            <h2 className="max-w-3xl font-display text-4xl font-medium leading-tight text-white sm:text-5xl">
              Built for every participant in the carbon economy.
            </h2>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-white/62">
              Buyers, operators, investors, and regulators work from the same
              evidence layer instead of reconciling separate systems.
            </p>
          </div>
          <PrimaryLink href="/projects" variant="secondary">
            View projects
          </PrimaryLink>
        </div>

        <div className="mt-12 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {pathways.map((pathway) => {
            const Icon = pathway.icon;

            return (
              <Link
                key={pathway.title}
                href={pathway.href}
                className="group overflow-hidden rounded-lg border border-white/10 bg-white/[0.025] transition-colors hover:border-emerald-300/35"
              >
                <div className="relative h-56 overflow-hidden">
                  <OptimizedImage
                    src={pathway.image}
                    alt=""
                    fill
                    sizes="(min-width: 1280px) 25vw, (min-width: 768px) 50vw, 100vw"
                    className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#020509] via-[#020509]/20 to-transparent" />
                </div>
                <div className="p-5">
                  <span className="flex h-10 w-10 items-center justify-center rounded-md border border-emerald-300/30 bg-emerald-300/10 text-emerald-200">
                    <Icon className="h-5 w-5" strokeWidth={1.7} />
                  </span>
                  <h3 className="mt-5 text-xl font-semibold text-white">
                    {pathway.title}
                  </h3>
                  <p className="mt-3 text-sm leading-6 text-white/60">
                    {pathway.body}
                  </p>
                  <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-emerald-200">
                    Explore
                    <ArrowRight className="h-4 w-4" strokeWidth={1.8} />
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function ClosingCta() {
  return (
    <section className="relative overflow-hidden border-b border-white/10 py-24">
      <div className="absolute inset-0">
        <OptimizedImage
          src="verified-restoration"
          alt=""
          fill
          sizes="100vw"
          className="object-cover opacity-58"
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,#020509_0%,rgba(2,5,9,0.84)_42%,rgba(2,5,9,0.35)_100%)]" />
      </div>

      <div className="relative mx-auto max-w-[1440px] px-5 sm:px-8">
        <div className="max-w-2xl">
          <h2 className="font-display text-4xl font-medium leading-tight text-white sm:text-5xl">
            Infrastructure for a credible and scalable market.
          </h2>
          <p className="mt-5 text-lg leading-8 text-white/68">
            Connect projects, buyers, regulators, and capital to climate impact
            that can be inspected from source data to final retirement.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <PrimaryLink href="/solutions/enterprise">
              Request access
            </PrimaryLink>
            <PrimaryLink href="/technology" variant="secondary">
              See how it works
            </PrimaryLink>
          </div>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="bg-[#020509]">
      <div className="mx-auto grid max-w-[1440px] gap-12 px-5 py-14 sm:px-8 lg:grid-cols-[1fr_1.55fr]">
        <div>
          <Link href="/" aria-label="TerraQura home">
            <Brand />
          </Link>
          <p className="mt-5 max-w-sm text-sm leading-6 text-white/56">
            The verification infrastructure for a credible carbon economy.
          </p>
          <div className="mt-6 flex gap-2">
            {[
              { label: "LinkedIn", icon: Linkedin },
              { label: "X", icon: XIcon },
              { label: "YouTube", icon: Radio },
              { label: "Network", icon: Globe2 },
            ].map((social) => (
              <a
                key={social.label}
                href="/"
                aria-label={social.label}
                className="flex h-9 w-9 items-center justify-center rounded-md border border-white/10 bg-white/[0.025] text-white/58 transition-colors hover:border-emerald-300/35 hover:text-emerald-200"
              >
                <social.icon className="h-4 w-4" strokeWidth={1.7} />
              </a>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
          {footerSections.map((section) => (
            <div key={section.title}>
              <h3 className="text-sm font-semibold leading-none text-white">
                {section.title}
              </h3>
              <ul className="mt-4 space-y-3">
                {section.links.map(([label, href]) => (
                  <li key={`${section.title}-${label}`}>
                    <Link
                      href={href}
                      className="text-sm leading-none text-white/52 transition-colors hover:text-emerald-200"
                    >
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <div className="mx-auto flex max-w-[1440px] flex-col gap-4 border-t border-white/10 px-5 py-6 text-sm text-white/46 sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <p>© 2025 TerraQura. All rights reserved.</p>
        <div className="flex flex-wrap gap-x-8 gap-y-2">
          <Link href="/privacy" className="hover:text-white">
            Privacy
          </Link>
          <Link href="/terms" className="hover:text-white">
            Terms
          </Link>
          <Link href="/technology#security" className="hover:text-white">
            Security
          </Link>
          <span className="inline-flex items-center gap-2 text-emerald-200/78">
            <span className="h-1.5 w-1.5 rounded-full border border-emerald-300" />
            SOC 2 Type II
          </span>
        </div>
      </div>
    </footer>
  );
}

export function HomeReferencePage() {
  return (
    <main
      id="main-content"
      className="min-h-screen overflow-x-hidden bg-[#020509] text-white"
    >
      <Header />
      <Hero />
      <PlatformSection />
      <ProofSection />
      <PathwaysSection />
      <ClosingCta />
      <Footer />
    </main>
  );
}
