"use client";

import Link from "next/link";
import { useRef, useState, useEffect } from "react";
import { motion, useInView, type Variants } from "framer-motion";
import { 
  Layers, 
  Database, 
  Shield, 
  CheckCircle2, 
  Clock, 
  ArrowRight,
  ExternalLink,
  Activity,
  Globe
} from "lucide-react";

const contracts = [
  {
    name: "AccessControl",
    address: "0x55695aAAEC30AB495074c57e85Ae2E1A4866B83b",
    description: "Role-based access management for all protocol operations",
    status: "deployed" as const,
  },
  {
    name: "VerificationEngine",
    address: "0x8dad7E87646e9607Fae225e3A7EAD17ce179dEA8",
    description: "Proof-of-Physics validation engine for IoT sensor data",
    status: "deployed" as const,
  },
  {
    name: "CarbonCredit",
    address: "0x29B58064fD95b175e5824767d3B18bACFafaF959",
    description: "ERC-1155 carbon credit token with on-chain metadata",
    status: "deployed" as const,
  },
  {
    name: "CarbonMarketplace",
    address: "0x5a4cb32709AB829E2918F0a914FBa1e0Dab2Fdec",
    description: "Primary and secondary market for carbon credit trading",
    status: "deployed" as const,
  },
  {
    name: "GaslessMarketplace",
    address: "0x45a65e46e8C1D588702cB659b7d3786476Be0A80",
    description: "Meta-transaction marketplace for gasless user experience",
    status: "deployed" as const,
  },
  {
    name: "NativeIoTOracle",
    address: "Pending deployment",
    description: "On-chain oracle bridging IoT sensor readings to verification",
    status: "pending" as const,
  },
];

const architectureLayers = [
  {
    layer: "01",
    name: "IoT Layer",
    subtitle: "Physical Measurement",
    description:
      "Industrial sensors at DAC facilities capture real-time energy consumption, CO2 flow rates, temperature, and pressure. Data is signed at the edge before transmission.",
    icon: Activity,
    color: "emerald" as const,
    items: ["Energy meters (kWh)", "CO2 flow sensors", "Temperature & pressure", "Edge-signed telemetry"],
  },
  {
    layer: "02",
    name: "Oracle Layer",
    subtitle: "Data Bridge",
    description:
      "The NativeIoTOracle contract receives signed sensor payloads and publishes them on-chain, creating a tamper-proof record that links physical measurements to blockchain state.",
    icon: Globe,
    color: "cyan" as const,
    items: ["Signed data ingestion", "On-chain attestation", "Tamper-proof timestamps", "Facility registry"],
  },
  {
    layer: "03",
    name: "Verification Layer",
    subtitle: "Proof-of-Physics",
    description:
      "The VerificationEngine validates energy-to-CO2 ratios (200-600 kWh per tonne) against known DAC thermodynamic bounds. Only physically plausible removals pass verification.",
    icon: Shield,
    color: "emerald" as const,
    items: ["Thermodynamic validation", "Energy/CO2 ratio checks", "Anomaly detection", "Multi-source correlation"],
  },
  {
    layer: "04",
    name: "Token Layer",
    subtitle: "Credit Issuance",
    description:
      "Verified removals are minted as ERC-1155 tokens with full provenance metadata. Each credit is traceable from the sensor reading through verification to the token.",
    icon: Database,
    color: "emerald" as const,
    items: ["ERC-1155 minting", "On-chain provenance", "Marketplace listing", "Retirement tracking"],
  },
];

const statusCards = [
  { title: "Smart Contracts", status: "complete" as const, detail: "5 of 6 contracts deployed on Aethelred" },
  { title: "IoT Oracle", status: "in-progress" as const, detail: "NativeIoTOracle integration under development" },
  { title: "Proof-of-Physics", status: "in-progress" as const, detail: "Verification engine calibration with DAC partners" },
  { title: "Marketplace", status: "complete" as const, detail: "Primary and gasless marketplace contracts live" },
  { title: "Testnet Launch", status: "planned" as const, detail: "Full pipeline testing targeted for Q3 2026" },
  { title: "Mainnet", status: "planned" as const, detail: "Production deployment pending testnet validation" },
];

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: "easeOut" },
  },
};

export function ExplorerContent() {
  const headerRef = useRef<HTMLElement>(null);
  const isInView = useInView(headerRef, { once: true, amount: 0.1 });
  const [fallback, setFallback] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setFallback(true), 2000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <>
      {/* Header Section */}
      <section ref={headerRef} className="relative pt-24 pb-16 lg:pt-32 lg:pb-20" aria-labelledby="explorer-heading">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 xl:px-12">
          <motion.div
            className="text-center max-w-3xl mx-auto"
            initial={false}
            animate={(isInView || fallback) ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          >
            {/* Badge */}
            <motion.div
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.03] border border-white/10 mb-8"
              initial={false}
              animate={(isInView || fallback) ? { opacity: 1, scale: 1 } : {}}
              transition={{ delay: 0.1, duration: 0.4 }}
            >
              <Layers className="w-4 h-4 text-emerald-500" />
              <span className="text-white/60 text-sm font-medium uppercase tracking-wider">Architecture & Contracts</span>
            </motion.div>

            {/* Title */}
            <h1 id="explorer-heading" className="text-display font-display text-white mb-6">
              Network{" "}
              <span className="text-emerald-500">Explorer</span>
            </h1>

            {/* Description */}
            <p className="text-lg text-white/70 mb-8 max-w-3xl mx-auto leading-relaxed font-body">
              Explore TerraQura&apos;s complete verification infrastructure built on the Aethelred
              sovereign blockchain. Our Proof-of-Physics pipeline connects physical DAC facility
              measurements to on-chain carbon credits through a four-layer architecture: IoT
              sensors capture real-time energy and CO₂ data, the NativeIoT Oracle bridges it
              on-chain, the VerificationEngine validates thermodynamic feasibility against known
              DAC bounds, and verified removals are minted as traceable ERC-1155 tokens with full
              provenance metadata. All smart contracts are publicly deployed and verifiable on
              the Aethelred Network.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-10">
              <Link
                href="/technology"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 text-base font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl transition-all shadow-lg shadow-emerald-600/20"
              >
                Explore Architecture
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/developers"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 text-base font-semibold text-white/80 border border-white/10 hover:border-white/20 rounded-xl transition-all"
              >
                Developer Docs
              </Link>
            </div>

            {/* Testnet Status Banner */}
            <motion.div
              className="relative overflow-hidden rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.03] p-6 lg:p-8"
              initial={false}
              animate={(isInView || fallback) ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: 0.3, duration: 0.5 }}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 via-transparent to-emerald-500/5" />
              <div className="relative flex flex-col sm:flex-row items-center justify-center gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-emerald-400 font-semibold uppercase tracking-wider text-sm">Aethelred Network</span>
                </div>
                <span className="hidden sm:block text-white/20">|</span>
                <p className="text-white/70 text-sm">
                  Testnet launching Q3 2026
                </p>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Architecture Section */}
      <section className="relative py-16 lg:py-24 bg-white/[0.02]" aria-labelledby="architecture-heading">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 xl:px-12">
          {/* Section Header */}
          <motion.div
            className="text-center mb-12 lg:mb-16"
            initial={false}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <h2 id="architecture-heading" className="text-display font-display text-white mb-4">
              Verification Pipeline
            </h2>
            <p className="text-white/70 text-lg max-w-2xl mx-auto font-body leading-relaxed">
              Four layers transform physical sensor data into verified, tradeable carbon credits
            </p>
          </motion.div>

          {/* Architecture Grid */}
          <motion.div
            className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 max-w-5xl mx-auto"
            variants={containerVariants}
            initial={false}
            whileInView="visible"
            viewport={{ once: true }}
          >
            {architectureLayers.map((layer, index) => {
              const Icon = layer.icon;
              return (
                <motion.div
                  key={layer.name}
                  variants={itemVariants}
                  className="group relative"
                >
                  <div className="relative p-6 lg:p-8 rounded-2xl bg-white/[0.02] border border-white/[0.08] hover:border-emerald-500/30 transition-all duration-300 h-full">
                    {/* Layer Number */}
                    <div className="flex items-start justify-between mb-6">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                          <Icon className="w-6 h-6 text-emerald-500" />
                        </div>
                        <div>
                          <h3 className="text-xl font-bold text-white">{layer.name}</h3>
                          <p className="text-emerald-500/70 text-sm font-medium uppercase tracking-wider">{layer.subtitle}</p>
                        </div>
                      </div>
                      <span className="text-4xl font-bold text-white/5 font-mono">{layer.layer}</span>
                    </div>

                    {/* Description */}
                    <p className="text-white/70 leading-relaxed mb-6 font-body">
                      {layer.description}
                    </p>

                    {/* Items List */}
                    <ul className="space-y-3">
                      {layer.items.map((item) => (
                        <li key={item} className="flex items-center gap-3 text-sm text-white/70 font-body">
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500/60" />
                          {item}
                        </li>
                      ))}
                    </ul>

                    {/* Connector Arrow (hidden on last item) */}
                    {index < architectureLayers.length - 1 && (
                      <div className="hidden lg:flex absolute -bottom-4 left-1/2 -translate-x-1/2 z-10">
                        <div className="w-8 h-8 rounded-full bg-midnight-950 border border-white/10 flex items-center justify-center">
                          <ArrowRight className="w-4 h-4 text-emerald-500 rotate-90" />
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </motion.div>

          {/* Flow Summary */}
          <motion.div
            className="mt-12 flex items-center justify-center"
            initial={false}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.4 }}
          >
            <div className="flex items-center gap-4 text-sm">
              <span className="text-emerald-500/60 font-medium">IoT</span>
              <ArrowRight className="w-4 h-4 text-white/20" />
              <span className="text-cyan-500/60 font-medium">Oracle</span>
              <ArrowRight className="w-4 h-4 text-white/20" />
              <span className="text-emerald-500/60 font-medium">Verification</span>
              <ArrowRight className="w-4 h-4 text-white/20" />
              <span className="text-emerald-500/60 font-medium">Token</span>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Contract Directory Section */}
      <section className="relative py-16 lg:py-24" aria-labelledby="contracts-heading">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 xl:px-12">
          {/* Section Header */}
          <motion.div
            className="text-center mb-12"
            initial={false}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <h2 id="contracts-heading" className="text-display font-display text-white mb-4">
              Contract Directory
            </h2>
            <p className="text-white/70 text-lg mx-auto font-body leading-relaxed">
              Deployed on Aethelred Sovereign Network
            </p>
          </motion.div>

          {/* Contracts Grid */}
          <motion.div
            className="grid grid-cols-1 gap-4 max-w-5xl mx-auto"
            variants={containerVariants}
            initial={false}
            whileInView="visible"
            viewport={{ once: true }}
          >
            {contracts.map((contract) => (
              <motion.div
                key={contract.name}
                variants={itemVariants}
                className="group"
              >
                <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.08] hover:border-emerald-500/20 transition-all duration-300">
                  <div className="flex flex-col lg:flex-row lg:items-center gap-4 lg:gap-6">
                    {/* Status & Name */}
                    <div className="flex items-center gap-4 min-w-[200px]">
                      <div className={`w-3 h-3 rounded-full ${contract.status === "deployed" ? "bg-emerald-500" : "bg-white/20"}`} />
                      <div>
                        <h3 className="text-lg font-semibold text-white">{contract.name}</h3>
                        <span className={`text-xs uppercase tracking-wider font-medium ${contract.status === "deployed" ? "text-emerald-500/70" : "text-white/70"}`}>
                          {contract.status === "deployed" ? "Deployed" : "Pending"}
                        </span>
                      </div>
                    </div>

                    {/* Description */}
                    <p className="text-white/70 text-[15px] flex-1 lg:px-4 lg:border-l lg:border-white/10 font-body leading-relaxed">
                      {contract.description}
                    </p>

                    {/* Address */}
                    <div className="min-w-[280px] lg:text-right">
                      {contract.status === "deployed" ? (
                        <a
                          href={`https://explorer.aethelred.network/address/${contract.address}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 text-emerald-500/60 hover:text-emerald-400 text-sm font-mono transition-colors group/link"
                        >
                          <span className="truncate max-w-[200px]">{contract.address}</span>
                          <ExternalLink className="w-3.5 h-3.5 opacity-0 group-hover/link:opacity-100 transition-opacity" />
                        </a>
                      ) : (
                        <span className="text-white/20 text-sm font-mono italic">{contract.address}</span>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Verification Standards */}
      <section className="relative py-16 lg:py-24" aria-labelledby="standards-heading">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 xl:px-12">
          <motion.div
            className="text-center mb-12 lg:mb-16"
            initial={false}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <h2 id="standards-heading" className="text-display font-display text-white mb-4">
              Verification Standards
            </h2>
            <p className="text-white/70 text-lg max-w-2xl mx-auto font-body leading-relaxed">
              The rules that govern every credit issued on the Aethelred network
            </p>
          </motion.div>

          <motion.div
            className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto"
            variants={containerVariants}
            initial={false}
            whileInView="visible"
            viewport={{ once: true }}
          >
            {[
              {
                title: "Thermodynamic Bounds",
                detail: "Energy-to-CO\u2082 ratio must fall within 200\u2013600 kWh per tonne. Readings outside this range are automatically rejected as physically implausible for current DAC technologies.",
                badge: "Physics",
                badgeColor: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20",
              },
              {
                title: "Duplicate Detection",
                detail: "Every sensor payload is hashed and checked against historical records. Duplicate data submissions are rejected to prevent double-counting of capture events.",
                badge: "Integrity",
                badgeColor: "text-cyan-500 bg-cyan-500/10 border-cyan-500/20",
              },
              {
                title: "Satellite Cross-Verification",
                detail: "Independent satellite imagery confirms facility operational status, thermal signatures, and environmental conditions to corroborate IoT sensor telemetry.",
                badge: "Multi-Source",
                badgeColor: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20",
              },
              {
                title: "Edge-Signed Telemetry",
                detail: "Sensor data is cryptographically signed at the edge device before transmission. Any tampering between sensor and oracle is detectable and results in rejection.",
                badge: "Security",
                badgeColor: "text-cyan-500 bg-cyan-500/10 border-cyan-500/20",
              },
              {
                title: "Continuous Monitoring",
                detail: "Unlike quarterly manual audits, TerraQura validates every capture event in real-time. Anomalous patterns trigger automatic hold on credit issuance pending investigation.",
                badge: "Real-Time",
                badgeColor: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20",
              },
              {
                title: "On-Chain Provenance",
                detail: "Every minted credit carries full metadata: facility ID, sensor readings, verification timestamp, satellite CID, and efficiency ratio. Fully auditable by any third party.",
                badge: "Transparency",
                badgeColor: "text-cyan-500 bg-cyan-500/10 border-cyan-500/20",
              },
            ].map((standard) => (
              <motion.div
                key={standard.title}
                variants={itemVariants}
                className="p-6 lg:p-8 rounded-2xl bg-white/[0.02] border border-white/[0.08] hover:border-emerald-500/20 transition-all duration-300"
              >
                <div className="flex items-start justify-between mb-4">
                  <h3 className="text-lg font-semibold text-white">{standard.title}</h3>
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${standard.badgeColor}`}>
                    {standard.badge}
                  </span>
                </div>
                <p className="text-white/70 text-[15px] leading-relaxed font-body">{standard.detail}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Development Status Section */}
      <section className="relative py-16 lg:py-24 bg-white/[0.02]" aria-labelledby="status-heading">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 xl:px-12">
          {/* Section Header */}
          <motion.div
            className="text-center mb-12"
            initial={false}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <h2 id="status-heading" className="text-display font-display text-white mb-4">
              Development Status
            </h2>
            <p className="text-white/70 text-lg mx-auto font-body leading-relaxed">
              Current progress toward testnet launch
            </p>
          </motion.div>

          {/* Status Cards Grid */}
          <motion.div
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto"
            variants={containerVariants}
            initial={false}
            whileInView="visible"
            viewport={{ once: true }}
          >
            {statusCards.map((card) => (
              <StatusCard key={card.title} {...card} />
            ))}
          </motion.div>
        </div>
      </section>
    </>
  );
}

function StatusCard({
  title,
  status,
  detail,
}: {
  title: string;
  status: "complete" | "in-progress" | "planned";
  detail: string;
}) {
  const config = {
    complete: {
      icon: CheckCircle2,
      label: "Complete",
      dotColor: "bg-emerald-500",
      labelColor: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20",
    },
    "in-progress": {
      icon: Clock,
      label: "In Progress",
      dotColor: "bg-amber-500",
      labelColor: "text-amber-500 bg-amber-500/10 border-amber-500/20",
    },
    planned: {
      icon: Activity,
      label: "Planned",
      dotColor: "bg-white/30",
      labelColor: "text-white/70 bg-white/[0.03] border-white/10",
    },
  }[status];

  const Icon = config.icon;

  return (
    <motion.div
      variants={itemVariants}
      className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.08] hover:border-emerald-500/20 transition-all duration-300 h-full"
    >
      <div className="flex items-start justify-between mb-4">
        <div className={`w-10 h-10 rounded-xl ${config.labelColor.split(' ')[1]} flex items-center justify-center`}>
          <Icon className={`w-5 h-5 ${config.labelColor.split(' ')[0]}`} />
        </div>
        <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${config.labelColor}`}>
          {config.label}
        </span>
      </div>
      <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
      <p className="text-white/70 text-[15px] leading-relaxed font-body">{detail}</p>
    </motion.div>
  );
}
