/**
 * DAC Operator Portal - Platform Preview
 *
 * Clean landing page for prospective Direct Air Capture facility operators.
 * Shows the operator journey, key benefits, technology stack, and registration CTA.
 * No fabricated data - clearly labeled as an upcoming feature preview.
 *
 * @version 3.0.0 - Platform Preview
 */

"use client";

import Link from "next/link";
import { motion, useInView } from "framer-motion";
import { useRef, useState, useEffect } from "react";
import {
  Building2,
  Cpu,
  Timer,
  BadgeCheck,
  Wifi,
  Shield,
  Percent,
  Users,
  ArrowRight,
  Sparkles,
  Radio,
  Globe,
  Clock,
  Coins,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { TerraQuraLogoFull } from "@/components/ui/TerraQuraLogo";

/* ─────────────────────── Animation Variants ─────────────────────── */

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.12, duration: 0.6, ease: "easeOut" as const },
  }),
};

const scaleIn = {
  hidden: { opacity: 0, scale: 0.92 },
  visible: (i: number = 0) => ({
    opacity: 1,
    scale: 1,
    transition: { delay: i * 0.1, duration: 0.5, ease: "easeOut" as const },
  }),
};

/* ─────────────────────── Section Wrapper ─────────────────────── */

function AnimatedSection({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.1 });
  const [fallback, setFallback] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setFallback(true), 2000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <motion.section
      ref={ref}
      initial={false}
      animate={(inView || fallback) ? "visible" : "hidden"}
      className={className}
    >
      {children}
    </motion.section>
  );
}

/* ─────────────────────── Data ─────────────────────── */

const journeySteps = [
  {
    step: 1,
    title: "Register Facility",
    description:
      "Submit your DAC facility details (location, capacity, energy source, and equipment specifications) through a guided onboarding flow.",
    icon: Building2,
    accent: "emerald",
  },
  {
    step: 2,
    title: "Connect IoT Sensors",
    description:
      "Integrate your CO\u2082 capture sensors via MQTT or HTTP endpoints. Our NativeIoT Oracle ingests telemetry directly. No third-party dependency.",
    icon: Cpu,
    accent: "cyan",
  },
  {
    step: 3,
    title: "Calibration Period",
    description:
      "A 72-hour calibration window validates sensor accuracy and establishes baseline capture rates before any credits are issued.",
    icon: Timer,
    accent: "amber",
  },
  {
    step: 4,
    title: "Automatic Verification & Minting",
    description:
      "Once calibrated, verified capture data triggers autonomous ERC-1155 carbon credit minting on Aethelred. No manual intervention required.",
    icon: BadgeCheck,
    accent: "emerald",
  },
];

const benefits = [
  {
    title: "Real-Time IoT Integration",
    description:
      "Stream sensor data continuously. Our sovereign oracle processes telemetry in real time for transparent, tamper-proof verification.",
    icon: Wifi,
  },
  {
    title: "Sovereign Oracle",
    description:
      "TerraQura runs its own Proof-of-Physics oracle. No Chainlink, no external dependency. Your data stays in a trust-minimized pipeline.",
    icon: Shield,
  },
  {
    title: "2.5% Fee on Primary Sales",
    description:
      "Only pay when credits sell. A flat 2.5% marketplace fee on primary sales. No hidden charges, no subscription costs.",
    icon: Percent,
  },
  {
    title: "Direct Institutional Access",
    description:
      "Your verified credits are listed directly to institutional buyers with ESG mandates, sovereign wealth funds, and compliance desks.",
    icon: Users,
  },
];

const techStack = [
  {
    label: "Sensor Integration",
    value: "MQTT / HTTP",
    icon: Radio,
    description: "Push telemetry via MQTT broker or REST endpoints",
  },
  {
    label: "Oracle",
    value: "NativeIoT Oracle",
    icon: Globe,
    description: "Sovereign on-chain oracle. No third-party dependency",
  },
  {
    label: "Calibration",
    value: "72-Hour Window",
    icon: Clock,
    description: "Baseline validation before credit issuance begins",
  },
  {
    label: "Minting",
    value: "ERC-1155 on Aethelred",
    icon: Coins,
    description: "Automatic batch minting on verified capture events",
  },
];

/* ─────────────────────── Accent Helpers ─────────────────────── */

function accentColor(accent: string, type: "text" | "bg" | "border" | "glow") {
  const map: Record<string, Record<string, string>> = {
    emerald: {
      text: "text-emerald-400",
      bg: "bg-emerald-500/10",
      border: "border-emerald-500/20",
      glow: "shadow-emerald-500/20",
    },
    cyan: {
      text: "text-cyan-400",
      bg: "bg-cyan-500/10",
      border: "border-cyan-500/20",
      glow: "shadow-cyan-500/20",
    },
    amber: {
      text: "text-amber-400",
      bg: "bg-amber-500/10",
      border: "border-amber-500/20",
      glow: "shadow-amber-500/20",
    },
  };
  const result = map[accent]?.[type];
  const fallback = map.emerald;
  return result ?? (fallback ? fallback[type] : "");
}

/* ─────────────────────── Page Component ─────────────────────── */

export default function OperatorPage() {
  return (
    <div className="relative min-h-screen bg-midnight-950 text-white overflow-hidden">
      {/* Subtle gradient background */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-emerald-500/[0.04] rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-0 w-[600px] h-[400px] bg-cyan-500/[0.03] rounded-full blur-[100px]" />
      </div>

      {/* ───── Navigation Bar ───── */}
      <nav className="relative z-10 flex items-center justify-between px-6 md:px-12 py-5 border-b border-white/5">
        <Link href="/" aria-label="Home">
          <TerraQuraLogoFull imageHeight={32} />
        </Link>
        <div className="flex items-center gap-4">
          <Link
            href="/technology"
            className="hidden sm:inline-block text-sm text-white/70 hover:text-white transition-colors"
          >
            Technology
          </Link>
          <Link
            href="/explorer"
            className="hidden sm:inline-block text-sm text-white/70 hover:text-white transition-colors"
          >
            Explorer
          </Link>
          <Link
            href="#register"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-sm font-semibold transition-colors"
          >
            Become an Operator
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </nav>

      <main className="relative z-10 max-w-6xl mx-auto px-6 md:px-12 pb-32">
        {/* ───── Hero / Platform Preview Badge ───── */}
        <AnimatedSection className="pt-20 md:pt-28 text-center">
          <motion.div variants={fadeUp} custom={0} className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-sm font-semibold tracking-widest uppercase mb-8">
            <Sparkles className="h-3.5 w-3.5" />
            Platform Preview
          </motion.div>

          <motion.h1
            variants={fadeUp}
            custom={1}
            className="font-display text-display-lg lg:text-display-xl mb-6"
          >
            DAC Operator Portal
          </motion.h1>

          <motion.p
            variants={fadeUp}
            custom={2}
            className="max-w-2xl mx-auto text-body-lg font-body text-white/70 leading-relaxed mb-4"
          >
            Register your Direct Air Capture facility, connect IoT sensors, and
            let TerraQura&rsquo;s Proof-of-Physics engine automatically verify
            capture data and mint carbon credits on-chain.
          </motion.p>

          <motion.p
            variants={fadeUp}
            custom={3}
            className="text-sm font-body text-white/70 italic"
          >
            This portal is under active development. Early registration is open below.
          </motion.p>
        </AnimatedSection>

        {/* ───── Operator Journey ───── */}
        <AnimatedSection className="mt-28 md:mt-36">
          <motion.div variants={fadeUp} custom={0} className="text-center mb-14">
            <p className="text-sm font-mono tracking-[0.25em] uppercase text-emerald-400 font-semibold mb-3">
              How It Works
            </p>
            <h2 className="font-display text-display-sm">
              The Operator Journey
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {journeySteps.map((step, i) => {
              const Icon = step.icon;
              return (
                <motion.div
                  key={step.step}
                  variants={scaleIn}
                  custom={i}
                  className={cn(
                    "relative rounded-2xl border p-7 backdrop-blur-sm transition-shadow hover:shadow-lg",
                    accentColor(step.accent, "border"),
                    accentColor(step.accent, "glow"),
                    "bg-white/[0.02]"
                  )}
                >
                  {/* Step number */}
                  <span
                    className={cn(
                      "absolute -top-3.5 -left-3.5 flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold border",
                      accentColor(step.accent, "bg"),
                      accentColor(step.accent, "border"),
                      accentColor(step.accent, "text")
                    )}
                  >
                    {step.step}
                  </span>

                  <div className="flex items-start gap-4">
                    <div
                      className={cn(
                        "flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center",
                        accentColor(step.accent, "bg")
                      )}
                    >
                      <Icon
                        className={cn("h-5 w-5", accentColor(step.accent, "text"))}
                      />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold mb-1.5">
                        {step.title}
                      </h3>
                      <p className="text-[15px] font-body text-white/70 leading-relaxed">
                        {step.description}
                      </p>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </AnimatedSection>

        {/* ───── Key Benefits ───── */}
        <AnimatedSection className="mt-28 md:mt-36">
          <motion.div variants={fadeUp} custom={0} className="text-center mb-14">
            <p className="text-sm font-mono tracking-[0.25em] uppercase text-cyan-400 font-semibold mb-3">
              Why TerraQura
            </p>
            <h2 className="font-display text-display-sm">
              Key Benefits for Operators
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {benefits.map((benefit, i) => {
              const Icon = benefit.icon;
              return (
                <motion.div
                  key={benefit.title}
                  variants={fadeUp}
                  custom={i}
                  className="group rounded-2xl border border-white/[0.06] bg-white/[0.02] p-7 hover:border-emerald-500/20 transition-colors"
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                      <Icon className="h-5 w-5 text-emerald-400" />
                    </div>
                    <h3 className="text-base font-semibold">{benefit.title}</h3>
                  </div>
                  <p className="text-[15px] font-body text-white/70 leading-relaxed">
                    {benefit.description}
                  </p>
                </motion.div>
              );
            })}
          </div>
        </AnimatedSection>

        {/* ───── Technology Stack ───── */}
        <AnimatedSection className="mt-28 md:mt-36">
          <motion.div variants={fadeUp} custom={0} className="text-center mb-14">
            <p className="text-sm font-mono tracking-[0.25em] uppercase text-emerald-400 font-semibold mb-3">
              Under the Hood
            </p>
            <h2 className="font-display text-display-sm">
              Operator Technology Stack
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {techStack.map((tech, i) => {
              const Icon = tech.icon;
              return (
                <motion.div
                  key={tech.label}
                  variants={scaleIn}
                  custom={i}
                  className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 text-center hover:border-cyan-500/20 transition-colors"
                >
                  <div className="w-12 h-12 mx-auto rounded-xl bg-cyan-500/10 flex items-center justify-center mb-4">
                    <Icon className="h-5 w-5 text-cyan-400" />
                  </div>
                  <p className="text-sm font-mono text-white/70 uppercase tracking-wider mb-1">
                    {tech.label}
                  </p>
                  <p className="text-base font-semibold text-white mb-2">
                    {tech.value}
                  </p>
                  <p className="text-sm font-body text-white/70 leading-relaxed">
                    {tech.description}
                  </p>
                </motion.div>
              );
            })}
          </div>
        </AnimatedSection>

        {/* ───── Facility Requirements ───── */}
        <AnimatedSection className="mt-28 md:mt-36">
          <motion.div variants={fadeUp} custom={0} className="text-center mb-14">
            <p className="text-sm font-mono tracking-[0.25em] uppercase text-emerald-400 font-semibold mb-3">
              Getting Started
            </p>
            <h2 className="font-display text-display-sm">
              Facility Requirements
            </h2>
            <p className="max-w-2xl mx-auto font-body text-[15px] text-white/70 leading-relaxed mt-4">
              Minimum specifications for onboarding a DAC facility to the TerraQura verification network.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              {
                label: "Capture Capacity",
                value: "500+ tCO\u2082/year",
                desc: "Minimum annual capture output for network eligibility",
              },
              {
                label: "Energy Metering",
                value: "Real-Time kWh",
                desc: "Continuous energy consumption monitoring at the unit level",
              },
              {
                label: "CO\u2082 Flow Sensors",
                value: "Calibrated Output",
                desc: "Calibrated sensors measuring captured CO\u2082 mass flow rates",
              },
              {
                label: "Data Connectivity",
                value: "MQTT / HTTPS",
                desc: "Reliable internet connection for real-time telemetry streaming",
              },
              {
                label: "Power Source",
                value: "Documented Grid/Renewable",
                desc: "Verified energy source documentation for emissions accounting",
              },
              {
                label: "Operational History",
                value: "72-Hour Baseline",
                desc: "Minimum calibration period before credit issuance begins",
              },
            ].map((req, i) => (
              <motion.div
                key={req.label}
                variants={scaleIn}
                custom={i}
                className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 hover:border-emerald-500/20 transition-colors"
              >
                <p className="text-sm font-mono text-white/70 uppercase tracking-wider mb-1">
                  {req.label}
                </p>
                <p className="text-base font-semibold text-emerald-400 mb-2">
                  {req.value}
                </p>
                <p className="text-sm font-body text-white/70 leading-relaxed">
                  {req.desc}
                </p>
              </motion.div>
            ))}
          </div>
        </AnimatedSection>

        {/* ───── CTA: Register Your Facility ───── */}
        <AnimatedSection className="mt-28 md:mt-36" >
          <motion.div
            id="register"
            variants={fadeUp}
            custom={0}
            className="relative rounded-3xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/[0.06] to-cyan-500/[0.04] p-10 md:p-16 text-center overflow-hidden"
          >
            {/* Decorative glow */}
            <div className="pointer-events-none absolute -top-20 left-1/2 -translate-x-1/2 w-[500px] h-[300px] bg-emerald-500/[0.07] rounded-full blur-[100px]" />

            <div className="relative z-10">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-400 text-sm font-semibold tracking-widest uppercase mb-6">
                <Clock className="h-3.5 w-3.5" />
                Coming Soon
              </div>

              <h2 className="font-display text-display-sm mb-4">
                Register Your Facility
              </h2>
              <p className="max-w-xl mx-auto font-body text-[15px] text-white/70 leading-relaxed mb-8">
                Early access is opening for DAC facility operators. Join the
                waitlist to be among the first to onboard when the Operator
                Portal launches.
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link
                  href="mailto:operators@terraqura.com?subject=DAC%20Operator%20Early%20Access"
                  className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold transition-colors shadow-lg shadow-emerald-500/20"
                >
                  Become an Operator
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/technology"
                  className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl border border-white/10 hover:border-white/20 text-white/60 hover:text-white font-medium transition-colors"
                >
                  Explore Technology
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </motion.div>
        </AnimatedSection>

        {/* ───── Footer Note ───── */}
        <motion.p
          initial={false}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2, duration: 0.8 }}
          className="mt-16 text-center text-sm font-body text-white/70"
        >
          TerraQura Operator Portal is in active development. All features shown
          represent planned functionality and are subject to change.
        </motion.p>
      </main>
    </div>
  );
}
