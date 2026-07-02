import {
  Activity,
  Banknote,
  Blocks,
  Cpu,
  Database,
  Factory,
  FileBarChart,
  FileCheck2,
  Gauge,
  GitBranch,
  KeyRound,
  Landmark,
  Layers3,
  LineChart,
  Lock,
  Network,
  Radio,
  Scale,
  ShieldCheck,
  WalletCards,
  Zap,
} from "lucide-react";
import type { RedesignPageProps } from "./RedesignPage";

const accent = "text-emerald-300";
const cyan = "text-cyan-300";

export const homePage: RedesignPageProps = {
  hero: {
    id: "home-heading",
    label: "TerraQura",
    title: <>Carbon markets rebuilt on evidence.</>,
    description:
      "Live facility telemetry. Satellite observation. Physics checks. Audit-ready provenance.",
    image: "satellite-mrv-layer",
    imageAlt: "TerraQura carbon verification infrastructure",
    primaryCta: { label: "Explore the platform", href: "/technology" },
    secondaryCta: {
      label: "Request access",
      href: "/solutions/enterprise",
    },
    metrics: [
      { label: "Tonnes CO2e verified", value: "93.6M+" },
      { label: "Projects monitored", value: "1,240+" },
      { label: "Countries", value: "85+" },
      { label: "Data uptime", value: "99.7%" },
      { label: "Telemetry events/day", value: "3.2B+" },
    ],
    panel: {
      title: "Proof chain",
      rows: [
        { label: "Facility input", value: "edge-signed telemetry" },
        { label: "Independent check", value: "satellite layer" },
        { label: "Validation", value: "thermodynamic bounds" },
        { label: "Market record", value: "provenance ledger" },
      ],
    },
  },
  intro: {
    eyebrow: "The TerraQura platform",
    title: <>End-to-end carbon verification infrastructure</>,
    description:
      "We combine multi-source data, physics-based models, and rigorous audits to create a trusted foundation for carbon markets.",
    bullets: [
      "Independent verification and audit trail.",
      "Immutable ledger and evidence packages.",
      "Physics checks and uncertainty quantification.",
      "Telemetry, satellite, and third-party data.",
    ],
    image: "verification-stack-architecture",
    imageAlt: "Layered TerraQura verification architecture",
  },
  capabilities: {
    eyebrow: "Platform",
    title: (
      <>
        The carbon stack, rebuilt around{" "}
        <span className={cyan}>evidence flow.</span>
      </>
    ),
    description:
      "TerraQura is a full infrastructure layer for verified removal: measurement, validation, tokenization, marketplace access, retirement, and reporting.",
    items: [
      {
        title: "Carbon truth engine",
        description:
          "IoT readings are checked against physics so implausible removals never become market assets.",
        icon: Gauge,
        image: "carbon-truth-engine",
        meta: "Verify",
      },
      {
        title: "On-chain provenance",
        description:
          "Every credit carries lineage from facility reading to retirement event through transparent contracts.",
        icon: GitBranch,
        image: "onchain-carbon-transparency",
        meta: "Trace",
      },
      {
        title: "Enterprise market access",
        description:
          "Buyers get invoice-friendly purchasing, gasless settlement, and reporting-grade certificates.",
        icon: FileBarChart,
        image: "carbon-removal-marketplace",
        meta: "Settle",
      },
    ],
  },
  process: {
    eyebrow: "Proof in every tonne",
    title: <>Proof in every tonne</>,
    description:
      "A cryptographic proof chain from operational data to retired credit.",
    steps: [
      {
        label: "Data ingest",
        title: "Telemetry and satellite data arrive",
        description:
          "Energy, flow, capture, and operating readings are signed at the edge and normalized for validation.",
      },
      {
        label: "Validation",
        title: "Automated checks verify models",
        description:
          "External observation adds a second context layer for site activity and project continuity.",
      },
      {
        label: "Evidence package",
        title: "Signed documents and model outputs",
        description:
          "The engine rejects readings outside plausible thermodynamic and operational bounds.",
      },
      {
        label: "Independent audit",
        title: "Third-party review and attestations",
        description:
          "Independent reviewers confirm that the evidence package is complete and defensible.",
      },
      {
        label: "Credit issuance",
        title: "Minted with provenance",
        description:
          "The credit is minted with provenance, available for sale, retirement, and reporting workflows.",
      },
    ],
  },
  showcase: {
    title: (
      <>
        Built for every stakeholder who has to{" "}
        <span className={accent}>stand behind the claim.</span>
      </>
    ),
    description:
      "TerraQura connects the teams who create, buy, finance, regulate, and audit carbon removal around one shared source of evidence.",
    image: "dmrv-command-center",
    imageAlt: "TerraQura digital MRV command center",
    points: [
      {
        title: "Enterprise buyers",
        description:
          "Procure verified supply with settlement and retirement workflows designed for institutional controls.",
      },
      {
        title: "Removal operators",
        description:
          "Turn measured operations into market-ready credits without waiting for slow verification cycles.",
      },
      {
        title: "Investors and regulators",
        description:
          "Review a transparent evidence graph instead of relying on fragmented claim documents.",
      },
    ],
  },
  cta: {
    title: <>Infrastructure for a credible and scalable market</>,
    description:
      "TerraQura is the trust layer connecting projects, buyers, regulators, and capital to real climate impact.",
    primary: { label: "Request access", href: "/solutions/enterprise" },
    image: "verified-restoration",
  },
};

export const aboutPage: RedesignPageProps = {
  hero: {
    id: "about-heading",
    label: "Company",
    title: <>Building the trust layer for climate markets.</>,
    description:
      "We bring together expertise in climate, engineering, data, and policy to create infrastructure that markets can depend on.",
    image: "satellite-mrv-layer",
    imageAlt: "TerraQura team and climate infrastructure planning workspace",
    primaryCta: { label: "Explore the protocol", href: "/technology" },
    secondaryCta: { label: "View projects", href: "/projects" },
    metrics: [
      { label: "Team members", value: "120+" },
      { label: "Countries represented", value: "30+" },
      { label: "Technical expertise", value: "Deep" },
      { label: "Governance", value: "Independent" },
    ],
    panel: {
      title: "Operating model",
      rows: [
        { label: "Measure", value: "facility telemetry" },
        { label: "Verify", value: "physics bounds" },
        { label: "Record", value: "ERC-1155 lineage" },
        { label: "Retire", value: "audit certificate" },
      ],
    },
  },
  intro: {
    eyebrow: "Why we exist",
    title: (
      <>
        The market has plenty of claims. It needs a{" "}
        <span className={accent}>proof layer.</span>
      </>
    ),
    description:
      "Carbon markets will not scale on PDFs, estimates, and reputation alone. They need infrastructure that can connect physical removal to financial-grade evidence without losing context along the way.",
    bullets: [
      "First-party measurement from facility systems and edge devices.",
      "Independent validation logic grounded in thermodynamic limits.",
      "Transparent lineage for buyers, operators, auditors, and regulators.",
    ],
    image: "nature-engineering-fusion",
    imageAlt:
      "Natural landscape blended with engineered climate infrastructure",
  },
  capabilities: {
    eyebrow: "Principles",
    title: (
      <>
        Designed for trust before it is designed for{" "}
        <span className={accent}>volume.</span>
      </>
    ),
    description:
      "Every product decision follows the same standard: make the evidence easier to inspect, harder to manipulate, and useful to the people accountable for the claim.",
    items: [
      {
        title: "Engineered truth",
        description:
          "Claims are anchored to measured inputs and physics constraints, not narrative alone.",
        icon: Gauge,
        image: "proof-of-physics",
        meta: "01",
      },
      {
        title: "Radical transparency",
        description:
          "Credit lineage, contract addresses, verification records, and retirement events stay visible.",
        icon: GitBranch,
        image: "onchain-carbon-transparency",
        meta: "02",
      },
      {
        title: "Institutional readiness",
        description:
          "The platform is shaped around procurement, reporting, compliance, and operational controls.",
        icon: Landmark,
        image: "institutional-climate-finance",
        meta: "03",
      },
    ],
  },
  process: {
    eyebrow: "Roadmap",
    title: (
      <>
        From testnet to <span className={cyan}>market infrastructure.</span>
      </>
    ),
    description:
      "The path is deliberately staged so the protocol earns trust before it carries meaningful market volume.",
    steps: [
      {
        label: "Phase 01",
        title: "Core verification stack",
        description:
          "Contracts, role controls, simulation engine, and the first proof-of-physics pipeline are established on testnet.",
      },
      {
        label: "Phase 02",
        title: "Enterprise readiness",
        description:
          "KYC, gasless settlement, API surfaces, security review, and reporting exports become operational.",
      },
      {
        label: "Phase 03",
        title: "Pilot facility network",
        description:
          "Instrumented DAC and durable removal projects connect live telemetry into the verification network.",
      },
      {
        label: "Phase 04",
        title: "Global issuance rails",
        description:
          "Regional operators, enterprise buyers, and regulators access one shared evidence graph.",
      },
    ],
  },
  showcase: {
    title: (
      <>
        Abu Dhabi roots.{" "}
        <span className={accent}>Global verification standard.</span>
      </>
    ),
    description:
      "TerraQura is positioned for markets where climate ambition, financial infrastructure, and industrial-scale energy systems meet.",
    image: "uae-climate",
    imageAlt: "UAE climate technology landscape",
    points: [
      {
        title: "Sovereign-grade foundation",
        description:
          "Aethelred is designed as a dedicated settlement and provenance layer for climate assets.",
      },
      {
        title: "Built for accountable teams",
        description:
          "The product language speaks to sustainability officers, project developers, finance teams, and auditors.",
      },
      {
        title: "Evidence travels with the asset",
        description:
          "Each tonne carries its verification context from issuance through retirement.",
      },
    ],
  },
  cta: {
    id: "contact",
    title: (
      <>
        Build the carbon market people can{" "}
        <span className={accent}>defend.</span>
      </>
    ),
    description:
      "Join the TerraQura pilot network as a buyer, operator, infrastructure partner, or institutional backer.",
    primary: { label: "Book a demo", href: "/solutions/enterprise" },
    secondary: { label: "Read the technology", href: "/technology" },
    image: "verified-restoration",
  },
};

export const technologyPage: RedesignPageProps = {
  hero: {
    id: "technology-heading",
    label: "Platform",
    title: <>Technology</>,
    description: "Transparent by design. Verifiable by default.",
    image: "satellite-mrv-layer",
    imageAlt: "TerraQura verification stack architecture",
    primaryCta: { label: "Explore the platform", href: "#simulate" },
    secondaryCta: { label: "View documentation", href: "/developers" },
    metrics: [],
    panel: {
      title: "Verification path",
      rows: [
        { label: "Sensor cadence", value: "live stream" },
        { label: "Energy range", value: "200-600 kWh/t" },
        { label: "Oracle mode", value: "first-party" },
        { label: "Output", value: "tokenized tonne" },
      ],
    },
  },
  intro: {
    eyebrow: "Architecture thesis",
    title: (
      <>
        Measurement is the interface between climate work and{" "}
        <span className={accent}>capital.</span>
      </>
    ),
    description:
      "The protocol is not a decorative ledger. It is an evidence pipeline that keeps sensor readings, validation decisions, issuer identity, and retirement events connected.",
    bullets: [
      "Edge-signed readings reduce the gap between physical asset and digital claim.",
      "Validation rules reject impossible or duplicated removal events.",
      "Contract architecture keeps upgrades, roles, and marketplace flows inspectable.",
    ],
    image: "mrv-data-river",
    imageAlt: "Data river representing MRV telemetry",
  },
  capabilities: {
    eyebrow: "System layers",
    title: (
      <>
        One chain of custody from{" "}
        <span className={cyan}>capture to retirement.</span>
      </>
    ),
    description:
      "Each layer has a distinct job, but the user experience is one continuous evidence record.",
    items: [
      {
        title: "NativeIoT oracle",
        description:
          "Facility devices submit signed readings directly into the verification boundary.",
        icon: Radio,
        image: "sensor-field-network",
        meta: "Input",
      },
      {
        title: "Proof engine",
        description:
          "Energy, flow, pressure, and capture values are checked against physical plausibility.",
        icon: Cpu,
        image: "carbon-truth-engine",
        meta: "Check",
      },
      {
        title: "Provenance ledger",
        description:
          "Credits are minted with metadata and lineage that buyers can audit after retirement.",
        icon: Blocks,
        image: "carbon-molecule-to-ledger",
        meta: "Record",
      },
    ],
  },
  process: {
    eyebrow: "Pipeline",
    title: (
      <>
        The protocol makes every transition{" "}
        <span className={accent}>explicit.</span>
      </>
    ),
    description:
      "No opaque handoff from facility to registry. Every step leaves a useful record.",
    steps: [
      {
        label: "01 / Capture",
        title: "Readings leave the facility signed",
        description:
          "Energy meters, CO2 flow sensors, and operating data are normalized and signed before transport.",
      },
      {
        label: "02 / Validate",
        title: "Physics and anomaly checks run before issuance",
        description:
          "The verification engine rejects implausible ratios, duplicate payloads, and incomplete evidence.",
      },
      {
        label: "03 / Mint",
        title: "Verified tonnes become programmable assets",
        description:
          "ERC-1155 credits carry facility, methodology, timestamp, and verification metadata.",
      },
      {
        label: "04 / Retire",
        title: "The final claim retains its evidence trail",
        description:
          "Retirement certificates reference the original proof chain instead of becoming isolated PDFs.",
      },
    ],
  },
  showcase: {
    title: (
      <>
        Robust enough for engineers. Clear enough for{" "}
        <span className={accent}>auditors.</span>
      </>
    ),
    description:
      "The same architecture supports technical inspection, procurement workflows, and regulatory review without translating between separate systems.",
    image: "dmrv-command-center",
    imageAlt: "Digital MRV command center interface",
    points: [
      {
        title: "Upgradeable with controls",
        description:
          "Role-based permissions, timelocks, and multisig pathways keep protocol changes governed.",
      },
      {
        title: "API-first by design",
        description:
          "Enterprises can ingest credit, retirement, and verification data into their reporting systems.",
      },
      {
        title: "Purpose-built for durable removal",
        description:
          "The system favors physical evidence, permanence, and inspectable quality over broad commodity volume.",
      },
    ],
  },
  cta: {
    title: (
      <>
        See how a tonne becomes <span className={accent}>verifiable.</span>
      </>
    ),
    description:
      "Explore the live protocol surfaces or model the verification flow through the simulation engine.",
    primary: { label: "Open explorer", href: "/explorer" },
    secondary: { label: "Developer platform", href: "/developers" },
    image: "proof-cahin",
  },
};

export const enterprisePage: RedesignPageProps = {
  hero: {
    id: "enterprise-heading",
    label: "Solutions",
    title: <>For Buyers</>,
    description: "Confident purchases. Credible impact.",
    image: "carbon-removal-marketplace",
    imageAlt: "Enterprise carbon market infrastructure",
    primaryCta: { label: "Browse projects", href: "/projects" },
    secondaryCta: { label: "How it works", href: "/technology" },
    metrics: [],
    panel: {
      title: "Buyer controls",
      rows: [
        { label: "Identity", value: "KYC / AML" },
        { label: "Methodology", value: "durable CDR" },
        { label: "Settlement", value: "wire or wallet" },
        { label: "Reporting", value: "audit export" },
      ],
    },
  },
  intro: {
    eyebrow: "Buyer problem",
    title: (
      <>
        Net-zero claims fail when evidence is{" "}
        <span className={accent}>fragmented.</span>
      </>
    ),
    description:
      "Enterprise teams are asked to defend claims across procurement, finance, investor relations, and regulators. TerraQura keeps the evidence attached to the asset from source to retirement.",
    bullets: [
      "Buy credits with clear facility, vintage, verification, and retirement context.",
      "Use familiar payment paths without pushing every buyer into wallet operations.",
      "Export data for ESG systems, investor reporting, and internal audit trails.",
    ],
    image: "regulator-ready-audit-trail",
    imageAlt: "Carbon credit audit trail visualization",
  },
  capabilities: {
    eyebrow: "Buyer platform",
    title: (
      <>
        A procurement surface for{" "}
        <span className={cyan}>high-integrity tonnes.</span>
      </>
    ),
    description:
      "The interface is built for teams who need to compare, purchase, retire, and explain carbon assets with confidence.",
    items: [
      {
        title: "Evidence-first marketplace",
        description:
          "Filter supply by facility, methodology, vintage, verification status, and provenance depth.",
        icon: FileBarChart,
        image: "carbon-removal-marketplace",
        meta: "Discover",
      },
      {
        title: "Enterprise settlement",
        description:
          "Support for invoice-led purchasing and gasless transfers reduces operational friction.",
        icon: WalletCards,
        image: "institutional-climate-finance",
        meta: "Buy",
      },
      {
        title: "Retirement confidence",
        description:
          "Each certificate links back to on-chain retirement and the underlying verification record.",
        icon: ShieldCheck,
        image: "carbon-credit-integrity",
        meta: "Retire",
      },
    ],
  },
  process: {
    eyebrow: "Workflow",
    title: (
      <>
        Purchase flow built for{" "}
        <span className={accent}>enterprise reality.</span>
      </>
    ),
    description:
      "No theatrical crypto maze. Just a controlled path from due diligence to retirement.",
    steps: [
      {
        label: "01 / Qualify",
        title: "Complete organization checks",
        description:
          "Enterprise identity, sanctions screening, and buyer permissions are set before marketplace access.",
      },
      {
        label: "02 / Compare",
        title: "Inspect supply before purchase",
        description:
          "Review verification evidence, facility data, methodology notes, and pricing context.",
      },
      {
        label: "03 / Settle",
        title: "Use invoice or wallet settlement",
        description:
          "Choose the operational flow that fits treasury and compliance policy.",
      },
      {
        label: "04 / Report",
        title: "Retire with an audit trail",
        description:
          "Generate certificates and structured exports tied back to the original proof chain.",
      },
    ],
  },
  showcase: {
    title: (
      <>
        Carbon procurement should look like{" "}
        <span className={accent}>financial infrastructure.</span>
      </>
    ),
    description:
      "The TerraQura buyer experience is quiet, inspectable, and operationally useful. It makes the strongest evidence the easiest thing to find.",
    image: "carbon-removal-marketplace",
    imageAlt: "Carbon removal marketplace interface",
    points: [
      {
        title: "Built for committees",
        description:
          "Procurement, sustainability, finance, and legal teams can evaluate the same shared evidence.",
      },
      {
        title: "Designed for recurring work",
        description:
          "Portfolio views, retirement records, and exports support repeated purchasing cycles.",
      },
      {
        title: "No claim without lineage",
        description:
          "The final offset claim points back to its measurement, verification, and settlement history.",
      },
    ],
  },
  cta: {
    id: "contact",
    title: (
      <>
        Make carbon purchasing <span className={accent}>defensible.</span>
      </>
    ),
    description:
      "Start with a buyer walkthrough and see how TerraQura turns physical verification into procurement-grade evidence.",
    primary: { label: "Book a demo", href: "#contact" },
    secondary: { label: "View buyer path", href: "/buyer" },
    image: "verified-restoration",
  },
};

export const suppliersPage: RedesignPageProps = {
  hero: {
    id: "suppliers-heading",
    label: "Solutions",
    title: <>For Operators</>,
    description: "Operate transparently. Grow with confidence.",
    image: "carbon-removal-from-biomass",
    imageAlt: "Carbon removal facility and biomass infrastructure",
    primaryCta: { label: "My dashboard", href: "#contact" },
    secondaryCta: { label: "How it works", href: "/developers" },
    metrics: [],
    panel: {
      title: "Facility readiness",
      rows: [
        { label: "Energy metering", value: "required" },
        { label: "CO2 flow", value: "calibrated" },
        { label: "Telemetry", value: "edge-signed" },
        { label: "Settlement", value: "gasless path" },
      ],
    },
  },
  intro: {
    eyebrow: "Operator problem",
    title: (
      <>
        Good projects lose value when verification arrives{" "}
        <span className={accent}>too late.</span>
      </>
    ),
    description:
      "Operators need verification that moves with the facility, not after months of manual reconciliation. TerraQura turns operational data into market-ready evidence.",
    bullets: [
      "Stream device readings through a first-party oracle boundary.",
      "Establish calibration and quality controls before issuance.",
      "Reach buyers with evidence that procurement teams can understand.",
    ],
    image: "sensor-field-network",
    imageAlt: "Sensor network connected to climate infrastructure",
  },
  capabilities: {
    eyebrow: "Operator advantages",
    title: (
      <>
        The verification system works close to the{" "}
        <span className={cyan}>hardware.</span>
      </>
    ),
    description:
      "TerraQura is built for operators who want faster trust formation without weakening the integrity of the credit.",
    items: [
      {
        title: "First-party telemetry",
        description:
          "Facility readings enter the verification path through controlled ingestion, not spreadsheets.",
        icon: Activity,
        image: "dmrv-command-center",
        meta: "01",
      },
      {
        title: "Physics validation",
        description:
          "Energy and capture data are checked against expected physical constraints before minting.",
        icon: Zap,
        image: "proof-of-physics",
        meta: "02",
      },
      {
        title: "Direct market access",
        description:
          "Verified supply can be listed with provenance that institutional buyers can review.",
        icon: Banknote,
        image: "high-intensity-carbon-market",
        meta: "03",
      },
    ],
  },
  process: {
    eyebrow: "Integration path",
    title: (
      <>
        From facility onboarding to{" "}
        <span className={accent}>verified issuance.</span>
      </>
    ),
    description:
      "The onboarding sequence is designed to protect quality while getting real projects market-ready.",
    steps: [
      {
        label: "01 / Register",
        title: "Map the facility and methodology",
        description:
          "Capture capacity, equipment profile, energy source, location, and operating boundaries are reviewed.",
      },
      {
        label: "02 / Instrument",
        title: "Connect telemetry sources",
        description:
          "Sensors and facility systems stream normalized readings into the oracle ingestion path.",
      },
      {
        label: "03 / Calibrate",
        title: "Establish a verification baseline",
        description:
          "The system learns expected operating ranges and flags incomplete or anomalous data before issuance.",
      },
      {
        label: "04 / Issue",
        title: "Mint verified tonnes into the market",
        description:
          "Credits are created with provenance, methodology context, and a route to buyer settlement.",
      },
    ],
  },
  showcase: {
    title: (
      <>
        Verification should strengthen the operator, not slow the{" "}
        <span className={accent}>project.</span>
      </>
    ),
    description:
      "The product turns verification into an operating layer: live enough for facilities, structured enough for markets, and transparent enough for auditors.",
    image: "desert-biochar",
    imageAlt: "Carbon removal project in desert environment",
    points: [
      {
        title: "Built for real assets",
        description:
          "The system accounts for facility identity, physical location, energy inputs, and operational state.",
      },
      {
        title: "Designed around quality controls",
        description:
          "Not every reading becomes a credit. Validation protects both project reputation and buyer trust.",
      },
      {
        title: "Market access with less translation",
        description:
          "Enterprise buyers can read the verification story without relying only on operator narrative.",
      },
    ],
  },
  cta: {
    id: "contact",
    title: (
      <>
        Bring your facility into the{" "}
        <span className={accent}>evidence network.</span>
      </>
    ),
    description:
      "Share your operating profile and we will map the integration path from telemetry to verified issuance.",
    primary: { label: "Connect your facility", href: "#contact" },
    secondary: { label: "Developer platform", href: "/developers" },
    image: "carbon-removal",
  },
};

export const buyerPage: RedesignPageProps = {
  ...enterprisePage,
  hero: {
    ...enterprisePage.hero,
    id: "buyer-heading",
    label: "Platform preview",
    title: <>For Buyers</>,
    description: "Confident purchases. Credible impact.",
    image: "carbon-removal-marketplace",
    primaryCta: { label: "Request buyer access", href: "#early-access" },
    secondaryCta: { label: "Open explorer", href: "/explorer" },
  },
  cta: {
    ...enterprisePage.cta,
    id: "early-access",
    primary: { label: "Request buyer access", href: "#early-access" },
    secondary: {
      label: "Explore enterprise solution",
      href: "/solutions/enterprise",
    },
  },
};

export const operatorPage: RedesignPageProps = {
  ...suppliersPage,
  hero: {
    ...suppliersPage.hero,
    id: "operator-heading",
    label: "Platform preview",
    title: <>For Operators</>,
    description: "Operate transparently. Grow with confidence.",
    image: "dmrv-command-center",
    primaryCta: { label: "Become an operator", href: "#register" },
    secondaryCta: { label: "Read integration guide", href: "/developers" },
  },
  cta: {
    ...suppliersPage.cta,
    id: "register",
    primary: { label: "Become an operator", href: "#register" },
    secondary: {
      label: "Explore operator solution",
      href: "/solutions/suppliers",
    },
  },
};

export const investorPage: RedesignPageProps = {
  hero: {
    id: "investor-heading",
    label: "Company",
    title: <>For Investors</>,
    description: "Underwrite integrity. Drive durable returns.",
    image: "verified-restoration",
    imageAlt: "Institutional climate finance and infrastructure",
    primaryCta: { label: "See opportunities", href: "#cta" },
    secondaryCta: { label: "How it works", href: "/technology" },
    metrics: [],
    panel: {
      title: "Investment lens",
      rows: [
        { label: "Problem", value: "integrity gap" },
        { label: "Wedge", value: "facility proof" },
        { label: "Network", value: "Aethelred L1" },
        { label: "Expansion", value: "buyers + operators" },
      ],
    },
  },
  intro: {
    eyebrow: "Market thesis",
    title: (
      <>
        Carbon markets need infrastructure before they can become{" "}
        <span className={accent}>credible scale.</span>
      </>
    ),
    description:
      "Demand for high-integrity removal is growing, but the market still relies on fragmented evidence and slow trust formation. TerraQura is building the rails for higher-confidence supply.",
    bullets: [
      "Enterprise demand increasingly requires defensible, auditable environmental claims.",
      "Durable removal supply needs a faster route from project operation to verified market access.",
      "Protocol-native provenance can compound as a defensible data advantage.",
    ],
    image: "sovereign-carbon-ledger",
    imageAlt: "Sovereign carbon ledger visualization",
  },
  capabilities: {
    eyebrow: "Differentiation",
    title: (
      <>
        The company is not selling credits. It is building{" "}
        <span className={cyan}>trust infrastructure.</span>
      </>
    ),
    description:
      "The opportunity expands across verification, marketplace liquidity, settlement, reporting, and data infrastructure.",
    items: [
      {
        title: "Evidence graph",
        description:
          "A proprietary record of facility telemetry, validation events, and credit lifecycle data.",
        icon: Network,
        image: "mrv-data-river",
        meta: "Data",
      },
      {
        title: "Settlement layer",
        description:
          "A dedicated path for tokenized carbon assets, gasless enterprise UX, and public provenance.",
        icon: Layers3,
        image: "onchain-carbon-transparency",
        meta: "Rails",
      },
      {
        title: "Market interface",
        description:
          "Buyer and operator products that turn integrity into an everyday workflow.",
        icon: LineChart,
        image: "carbon-removal-marketplace",
        meta: "Demand",
      },
    ],
  },
  process: {
    eyebrow: "Build path",
    title: (
      <>
        A staged route from protocol proof to{" "}
        <span className={accent}>commercial network.</span>
      </>
    ),
    description: "The plan prioritizes credible milestones over vanity claims.",
    steps: [
      {
        label: "01 / Protocol",
        title: "Testnet contracts and verification model",
        description:
          "Core primitives establish the architecture and demonstrate the proof chain.",
      },
      {
        label: "02 / Supply",
        title: "Operator instrumentation and facility pilots",
        description:
          "Qualified projects connect data streams and validate operational evidence.",
      },
      {
        label: "03 / Demand",
        title: "Enterprise buyer workflows",
        description:
          "Procurement, settlement, retirement, and reporting surfaces become repeatable.",
      },
      {
        label: "04 / Network",
        title: "Scaled issuance and ecosystem integrations",
        description:
          "APIs, reporting partners, and regional operators extend the evidence graph.",
      },
    ],
  },
  showcase: {
    title: (
      <>
        Built for a market where integrity becomes the{" "}
        <span className={accent}>scarce asset.</span>
      </>
    ),
    description:
      "TerraQura’s architecture turns verification into defensible infrastructure instead of a one-time certification expense.",
    image: "carbon-credit-integrity",
    imageAlt: "Carbon credit integrity system visualization",
    points: [
      {
        title: "Pre-revenue clarity",
        description:
          "The thesis is infrastructure-first and depends on pilot validation, not fabricated traction claims.",
      },
      {
        title: "Enterprise wedge",
        description:
          "The first customers are the teams with the strongest incentive to prove claims under scrutiny.",
      },
      {
        title: "Network effects in evidence",
        description:
          "More connected facilities and buyers improve comparability, liquidity, and confidence.",
      },
    ],
  },
  cta: {
    id: "cta",
    title: (
      <>
        Back the verification layer, not another{" "}
        <span className={accent}>offset storefront.</span>
      </>
    ),
    description:
      "Request the investor brief and review the protocol roadmap, risk profile, and commercial sequencing.",
    primary: { label: "Contact investor relations", href: "#cta" },
    secondary: { label: "Explore protocol", href: "/technology" },
    image: "institutional-climate-finance",
  },
};

export const projectsPage: RedesignPageProps = {
  hero: {
    id: "projects-heading",
    label: "Supply network",
    title: <>Projects</>,
    description: "High-integrity projects. Verified at scale.",
    image: "verified-restoration",
    imageAlt: "Carbon removal project in arid landscape",
    primaryCta: { label: "Explore the map", href: "#partner" },
    secondaryCta: {
      label: "How we verify",
      href: "/solutions/suppliers",
    },
    metrics: [
      { label: "Projects", value: "1,240+" },
      { label: "Tonnes verified", value: "93.6M+" },
      { label: "Countries", value: "85+" },
      { label: "Project types", value: "12" },
    ],
    panel: {
      title: "Project screen",
      rows: [
        { label: "Facility profile", value: "capacity + method" },
        { label: "Instrumentation", value: "sensor coverage" },
        { label: "Verification", value: "physics model" },
        { label: "Buyer fit", value: "portfolio demand" },
      ],
    },
  },
  intro: {
    eyebrow: "Development lens",
    title: (
      <>
        The strongest projects deserve evidence that keeps up with{" "}
        <span className={accent}>operations.</span>
      </>
    ),
    description:
      "Project development is not just site selection. It is the construction of a verification story that can travel from facility team to buyer committee.",
    bullets: [
      "Assess measurement readiness before credits are offered to the market.",
      "Use calibration and data quality checks to reduce post-issuance disputes.",
      "Package projects with the evidence buyers need for diligence.",
    ],
    image: "carbon-removal",
    imageAlt: "Large-scale carbon removal infrastructure",
  },
  capabilities: {
    eyebrow: "Project development",
    title: (
      <>
        A partner model built around{" "}
        <span className={cyan}>verified operations.</span>
      </>
    ),
    description:
      "The goal is not to list every project. It is to help credible operators reach a higher integrity bar.",
    items: [
      {
        title: "Facility assessment",
        description:
          "Review method, energy source, expected capture profile, and instrument coverage.",
        icon: Factory,
        image: "carbon-removal-from-biomass",
        meta: "Assess",
      },
      {
        title: "Verification design",
        description:
          "Define telemetry requirements, calibration windows, and evidence outputs early.",
        icon: FileCheck2,
        image: "verification-stack-architecture",
        meta: "Design",
      },
      {
        title: "Market packaging",
        description:
          "Prepare verified supply for enterprise buyers who require diligence-ready data.",
        icon: LineChart,
        image: "verified-restoration",
        meta: "Launch",
      },
    ],
  },
  process: {
    eyebrow: "Project path",
    title: (
      <>
        From site profile to <span className={accent}>market-ready tonne.</span>
      </>
    ),
    description:
      "A clean sequence protects both project reputation and buyer confidence.",
    steps: [
      {
        label: "01 / Screen",
        title: "Evaluate method and measurement readiness",
        description:
          "Project fundamentals, energy inputs, measurement points, and data access are reviewed.",
      },
      {
        label: "02 / Instrument",
        title: "Connect the operating evidence",
        description:
          "Sensors, facility systems, and satellite references are mapped into the verification flow.",
      },
      {
        label: "03 / Verify",
        title: "Run calibration and proof checks",
        description:
          "The system validates whether project data can support reliable issuance.",
      },
      {
        label: "04 / Offer",
        title: "Bring supply to enterprise buyers",
        description:
          "Verified projects enter marketplace and procurement workflows with inspectable lineage.",
      },
    ],
  },
  showcase: {
    title: (
      <>
        GCC first, with architecture that can travel{" "}
        <span className={accent}>globally.</span>
      </>
    ),
    description:
      "The initial focus pairs regional climate ambition with industrial energy capability and a strong need for credible carbon infrastructure.",
    image: "uae-climate",
    imageAlt: "UAE climate infrastructure and desert landscape",
    points: [
      {
        title: "Regional operating advantage",
        description:
          "The GCC combines clean energy investment, industrial sites, and sovereign climate ambition.",
      },
      {
        title: "Methodology discipline",
        description:
          "Projects are evaluated through the lens of durability, measurement quality, and buyer fit.",
      },
      {
        title: "Global repeatability",
        description:
          "The same evidence pattern can apply across future geographies and removal methods.",
      },
    ],
  },
  cta: {
    id: "partner",
    title: (
      <>
        Build your project on a stronger{" "}
        <span className={accent}>verification foundation.</span>
      </>
    ),
    description:
      "Partner with TerraQura to evaluate, instrument, verify, and prepare durable removal supply for institutional buyers.",
    primary: { label: "Become a partner", href: "#partner" },
    secondary: { label: "Operator solution", href: "/solutions/suppliers" },
    image: "desert-biochar",
  },
};

export const developersPage: RedesignPageProps = {
  hero: {
    id: "developers-heading",
    label: "Resources",
    title: <>Developers</>,
    description:
      "APIs, contract surfaces, webhooks, and SDKs for teams that want verified carbon data inside applications, reporting systems, marketplaces, and internal tools.",
    image: "ai-carbon-verification",
    imageAlt: "AI assisted carbon verification and developer infrastructure",
    primaryCta: { label: "Read API docs", href: "/docs" },
    secondaryCta: { label: "View contracts", href: "/explorer" },
    metrics: [
      { label: "API", value: "REST" },
      { label: "Index", value: "GraphQL" },
      { label: "SDK", value: "TypeScript" },
      { label: "Events", value: "Webhooks" },
    ],
    panel: {
      title: "Developer surface",
      rows: [
        { label: "Auth", value: "scoped keys" },
        { label: "Writes", value: "idempotent" },
        { label: "Payloads", value: "signed" },
        { label: "Contracts", value: "verified source" },
      ],
    },
  },
  intro: {
    eyebrow: "Developer thesis",
    title: (
      <>
        Carbon data should be composable without becoming{" "}
        <span className={accent}>unverifiable.</span>
      </>
    ),
    description:
      "TerraQura exposes verification and lifecycle data as structured infrastructure so developers can integrate carbon assets without flattening the evidence behind them.",
    bullets: [
      "Query assets, provenance, verification events, and retirement status.",
      "Create checkout and retirement workflows without brittle marketplace scraping.",
      "Receive signed webhooks for mint, sale, verification, and retirement events.",
    ],
    image: "onchain-carbon-transparency",
    imageAlt: "On-chain carbon transparency visualization",
  },
  capabilities: {
    eyebrow: "Developer surfaces",
    title: (
      <>
        Every surface maps back to the same{" "}
        <span className={cyan}>proof record.</span>
      </>
    ),
    description:
      "The platform is designed for product teams, data teams, and infrastructure teams that need a reliable integration boundary.",
    items: [
      {
        title: "REST API",
        description:
          "Create checkout flows, retrieve assets, verify status, and generate retirement data.",
        icon: KeyRound,
        image: "ai-carbon-verification",
        meta: "HTTPS",
      },
      {
        title: "GraphQL index",
        description:
          "Query block-level events, contract state, credit lineage, and marketplace activity.",
        icon: Database,
        image: "sovereign-carbon-ledger",
        meta: "Index",
      },
      {
        title: "Contract layer",
        description:
          "Integrate directly with ERC-1155 credit, marketplace, and verification contracts.",
        icon: Blocks,
        image: "proof-cahin",
        meta: "On-chain",
      },
    ],
  },
  process: {
    eyebrow: "Integration model",
    title: (
      <>
        Designed for production integrations, not demo{" "}
        <span className={accent}>scripts.</span>
      </>
    ),
    description:
      "The developer path emphasizes scoped credentials, idempotency, clear events, and contract transparency.",
    steps: [
      {
        label: "01 / Authenticate",
        title: "Create scoped API credentials",
        description:
          "Separate environments and permissions for read, write, checkout, and retirement operations.",
      },
      {
        label: "02 / Query",
        title: "Read verified carbon assets",
        description:
          "Use API or indexed contract data to retrieve supply, provenance, and status.",
      },
      {
        label: "03 / Act",
        title: "Create checkout or facility events",
        description:
          "Submit idempotent purchase, retirement, or telemetry actions with structured payloads.",
      },
      {
        label: "04 / Listen",
        title: "Receive signed lifecycle webhooks",
        description:
          "Update downstream systems when verification, minting, transfer, or retirement changes state.",
      },
    ],
  },
  showcase: {
    title: (
      <>
        Integration should make evidence easier to use, not easier to{" "}
        <span className={accent}>lose.</span>
      </>
    ),
    description:
      "Every developer surface preserves the link between the carbon asset and the physical verification event that created it.",
    image: "mrv-data-river",
    imageAlt: "MRV data flowing through developer infrastructure",
    points: [
      {
        title: "Stable data model",
        description:
          "Assets, facilities, verifications, and retirements are represented as explicit domain objects.",
      },
      {
        title: "Operational safeguards",
        description:
          "Idempotency, scoped access, signed events, and contract verification are core integration assumptions.",
      },
      {
        title: "Composable proof",
        description:
          "Third-party products can surface carbon data while preserving lineage back to the protocol.",
      },
    ],
  },
  cta: {
    title: (
      <>
        Start building with evidence-grade{" "}
        <span className={accent}>carbon primitives.</span>
      </>
    ),
    description:
      "Review the contract surfaces, API model, and event lifecycle before integrating TerraQura into your product.",
    primary: { label: "View docs", href: "/docs" },
    secondary: { label: "Open explorer", href: "/explorer" },
    image: "ai-carbon-verification",
  },
};

export const explorerPage: RedesignPageProps = {
  hero: {
    id: "explorer-heading",
    label: "Resources",
    title: <>Explorer</>,
    description:
      "The explorer makes TerraQura’s verification architecture visible: contracts, facility proofs, oracle events, mint records, marketplace state, and retirement lineage.",
    image: "satellite-mrv-layer",
    imageAlt: "Satellite MRV layer visualization",
    primaryCta: { label: "Explore architecture", href: "/technology" },
    secondaryCta: { label: "Developer platform", href: "/developers" },
    metrics: [
      { label: "Contracts", value: "public" },
      { label: "Events", value: "indexed" },
      { label: "Network", value: "Aethelred" },
      { label: "Status", value: "testnet" },
    ],
    panel: {
      title: "Explorer lens",
      rows: [
        { label: "AccessControl", value: "deployed" },
        { label: "VerificationEngine", value: "deployed" },
        { label: "CarbonCredit", value: "deployed" },
        { label: "NativeIoTOracle", value: "in progress" },
      ],
    },
  },
  intro: {
    eyebrow: "Transparency model",
    title: (
      <>
        Public infrastructure should be easy to{" "}
        <span className={accent}>inspect.</span>
      </>
    ),
    description:
      "The explorer is not a marketing dashboard. It is the public surface for contracts, proof events, and the state transitions that determine whether a credit can be trusted.",
    bullets: [
      "Show contract addresses, deployment state, and verification responsibilities.",
      "Trace a credit from telemetry submission to mint, sale, retirement, and certificate.",
      "Make the protocol understandable to technical and non-technical reviewers.",
    ],
    image: "proof-cahin",
    imageAlt: "Proof chain architecture visualization",
  },
  capabilities: {
    eyebrow: "Explorer surfaces",
    title: (
      <>
        A live map of the <span className={cyan}>verification stack.</span>
      </>
    ),
    description:
      "The explorer gives each stakeholder a way to interrogate the same shared evidence.",
    items: [
      {
        title: "Contract registry",
        description:
          "Core, marketplace, governance, and security contracts with status and source references.",
        icon: Blocks,
        image: "sovereign-carbon-ledger",
        meta: "Chain",
      },
      {
        title: "Protocol state",
        description:
          "Read verification status, marketplace activity, and operational network health.",
        icon: Activity,
        image: "dmrv-command-center",
        meta: "Live",
      },
      {
        title: "Credit provenance",
        description:
          "Follow each credit through minting, ownership, retirement, and evidence history.",
        icon: GitBranch,
        image: "carbon-molecule-to-ledger",
        meta: "Lineage",
      },
    ],
  },
  process: {
    eyebrow: "Inspection flow",
    title: (
      <>
        Find the claim. Follow the <span className={accent}>evidence.</span>
      </>
    ),
    description:
      "The explorer is structured around the questions buyers and auditors actually ask.",
    steps: [
      {
        label: "01 / Locate",
        title: "Find the asset or contract",
        description:
          "Search by credit ID, transaction, address, project, or contract category.",
      },
      {
        label: "02 / Verify",
        title: "Review validation context",
        description:
          "Inspect methodology, verification state, telemetry reference, and anomaly results.",
      },
      {
        label: "03 / Trace",
        title: "Follow lifecycle events",
        description:
          "See mint, transfer, listing, sale, retirement, and certificate references.",
      },
      {
        label: "04 / Export",
        title: "Use the evidence elsewhere",
        description:
          "Send structured proof records into procurement, compliance, or reporting systems.",
      },
    ],
  },
  showcase: {
    title: (
      <>
        Transparency only matters when it is{" "}
        <span className={accent}>usable.</span>
      </>
    ),
    description:
      "The explorer organizes protocol complexity into a readable hierarchy so stakeholders can answer trust questions quickly.",
    image: "satellite-mrv-layer",
    imageAlt: "Satellite monitoring and carbon verification layer",
    points: [
      {
        title: "Technical truth",
        description:
          "Contract addresses, roles, events, and network state remain visible for direct inspection.",
      },
      {
        title: "Buyer clarity",
        description:
          "Verification details are presented in language that procurement and ESG teams can use.",
      },
      {
        title: "Audit continuity",
        description:
          "The public record supports later review without reconstructing the claim from separate files.",
      },
    ],
  },
  cta: {
    title: (
      <>
        Make the protocol easier to <span className={accent}>interrogate.</span>
      </>
    ),
    description:
      "Use the explorer as the public record for TerraQura’s contracts, proof events, and carbon asset lifecycle.",
    primary: { label: "Study technology", href: "/technology" },
    secondary: { label: "Build with APIs", href: "/developers" },
    image: "satellite-mrv-layer",
  },
};

export const regulatoryPage: RedesignPageProps = {
  hero: {
    id: "regulatory-heading",
    label: "Resources",
    title: <>Regulatory</>,
    description: "Aligned with evolving standards and policy.",
    image: "regulator-ready-audit-trail",
    imageAlt: "Regulator-ready audit trail for climate assets",
    primaryCta: {
      label: "View frameworks",
      href: "#compliance-approach",
    },
    secondaryCta: { label: "Download data", href: "/explorer" },
    metrics: [],
    panel: {
      title: "Compliance controls",
      rows: [
        { label: "Participant checks", value: "KYC / AML" },
        { label: "Sanctions", value: "screened" },
        { label: "Environmental claims", value: "qualified" },
        { label: "Smart contracts", value: "audit path" },
      ],
    },
  },
  intro: {
    eyebrow: "Compliance thesis",
    title: (
      <>
        Carbon claims need the same discipline as financial{" "}
        <span className={accent}>claims.</span>
      </>
    ),
    description:
      "Regulatory readiness starts in the product architecture: who can transact, what evidence is recorded, how data is protected, and what claims the platform allows.",
    bullets: [
      "Identity, sanctions, and transaction monitoring are part of marketplace access.",
      "Environmental claims are framed around verified removal and documented limitations.",
      "On-chain records support inspection without replacing legal obligations.",
    ],
    image: "carbon-credit-integrity",
    imageAlt: "Verified carbon credit integrity interface",
  },
  capabilities: {
    eyebrow: "Compliance pillars",
    title: (
      <>
        Controls that make verification{" "}
        <span className={cyan}>operational.</span>
      </>
    ),
    description:
      "The platform combines financial controls, data protection, and environmental claim discipline.",
    items: [
      {
        title: "KYC and AML",
        description:
          "Participant access is governed through identity verification and risk screening.",
        icon: ShieldCheck,
        image: "regulator-ready-audit-trail",
        meta: "Access",
      },
      {
        title: "Data protection",
        description:
          "Facility and participant data are handled with privacy-by-design principles.",
        icon: Lock,
        image: "sovereign-carbon-ledger",
        meta: "Privacy",
      },
      {
        title: "Claim governance",
        description:
          "Credits, retirements, and certificates preserve evidence and limitations.",
        icon: Scale,
        image: "carbon-credit-integrity",
        meta: "Claims",
      },
    ],
  },
  process: {
    eyebrow: "Compliance flow",
    title: (
      <>
        Market access follows <span className={accent}>control gates.</span>
      </>
    ),
    description:
      "The goal is a market where verification, identity, and disclosure reinforce each other.",
    steps: [
      {
        label: "01 / Identify",
        title: "Know the participant",
        description:
          "Corporate and user identity checks determine marketplace eligibility and permissions.",
      },
      {
        label: "02 / Verify",
        title: "Know the asset",
        description:
          "Credits are linked to method, facility, data inputs, and verification outcomes.",
      },
      {
        label: "03 / Monitor",
        title: "Watch the transaction lifecycle",
        description:
          "Marketplace, transfer, and retirement activity can be reviewed for policy compliance.",
      },
      {
        label: "04 / Disclose",
        title: "Export the claim with context",
        description:
          "Environmental claims retain evidence, assumptions, and qualifications.",
      },
    ],
  },
  showcase: {
    title: (
      <>
        Regulation should see the evidence, not chase the{" "}
        <span className={accent}>paper trail.</span>
      </>
    ),
    description:
      "TerraQura’s compliance posture is built around auditable records and explicit limitations. This page remains the source for legal and regulatory disclosures.",
    image: "regulator-ready-audit-trail",
    imageAlt: "Audit trail and regulatory controls",
    points: [
      {
        title: "ADGM-aligned operating posture",
        description:
          "TerraQura is structured around a UAE and ADGM-aware compliance environment.",
      },
      {
        title: "Environmental claim caution",
        description:
          "Verification improves evidence quality but does not remove the need for careful claim language.",
      },
      {
        title: "Transparent updates",
        description:
          "Disclosures are expected to evolve as product, licensing, and market rules mature.",
      },
    ],
  },
  cta: {
    title: (
      <>
        Keep the rules close to the <span className={accent}>product.</span>
      </>
    ),
    description:
      "Review TerraQura’s compliance approach, platform terms, privacy policy, and cookie disclosures.",
    primary: { label: "Read legal terms", href: "/terms" },
    secondary: { label: "Privacy policy", href: "/privacy" },
    image: "regulator-ready-audit-trail",
  },
};
