"use client";

import { useRef, useEffect } from "react";
import Link from "next/link";
import {
  motion,
  useScroll,
  useTransform,
  useSpring,
  useMotionValue,
  useMotionTemplate,
  useReducedMotion,
} from "framer-motion";
import { ArrowRight, Play } from "lucide-react";
import { MagneticButton } from "@/components/animations/MagneticButton";
import { OptimizedImage } from "@/components/shared/OptimizedImage";
import { HeroVerificationStack } from "./HeroVerificationStack";

const specs = [
  { label: "Evidence", value: "IoT + satellite" },
  { label: "Validation", value: "Physics bounds" },
  { label: "Ledger", value: "ERC-1155 provenance" },
  { label: "Settlement", value: "Invoice or wallet" },
];

export function Hero() {
  const containerRef = useRef<HTMLElement>(null);
  const prefersReducedMotion = useReducedMotion();
  const mouseX = useMotionValue(0.5);
  const mouseY = useMotionValue(0.5);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end start"],
  });

  // Subtle scroll parallax on the content. Disabled when reduced motion.
  // Range kept small so the content can't drift into the next section even
  // when the hero is exiting the viewport.
  const scrollY = useTransform(scrollYProgress, [0, 1], ["0%", "8%"]);
  const scrollOpacity = useTransform(scrollYProgress, [0, 0.7], [1, 0.2]);

  const springConfig = { stiffness: 80, damping: 28, mass: 1 };
  const mouseXSpring = useSpring(mouseX, springConfig);
  const mouseYSpring = useSpring(mouseY, springConfig);

  // Cursor-tracked spotlight
  const spotlight = useMotionTemplate`radial-gradient(620px circle at ${useTransform(
    mouseXSpring,
    [0, 1],
    ["0%", "100%"],
  )} ${useTransform(
    mouseYSpring,
    [0, 1],
    ["0%", "100%"],
  )}, rgba(16, 185, 129, 0.12), transparent 55%)`;

  useEffect(() => {
    if (prefersReducedMotion) return;
    const onMove = (e: MouseEvent) => {
      mouseX.set(e.clientX / window.innerWidth);
      mouseY.set(e.clientY / window.innerHeight);
    };
    window.addEventListener("mousemove", onMove, { passive: true });
    return () => window.removeEventListener("mousemove", onMove);
  }, [mouseX, mouseY, prefersReducedMotion]);

  return (
    <section
      ref={containerRef}
      className="relative min-h-screen overflow-clip"
      aria-labelledby="hero-heading"
    >
      {/* Layer 0a - base color (instant paint, hides behind image while it loads) */}
      <div className="absolute inset-0 bg-[#020408]" />

      {/* Layer 0b - hero photograph (LCP candidate). Optimized WebP via the
          image-manifest pipeline. priority + eager load. Strong dark overlay
          below ensures text contrast stays WCAG AA regardless of source image. */}
      <div className="absolute inset-0 overflow-hidden" aria-hidden>
        <OptimizedImage
          src="home"
          alt=""
          fill
          priority
          quality={75}
          sizes="100vw"
          className="object-cover object-center opacity-55"
        />
        {/* Darkening tint so the brand atmosphere reads through */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#020408]/60 via-[#020408]/45 to-[#020408]/85" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#020408] via-[#020408]/40 to-transparent" />
      </div>

      {/* Layer 1 - blueprint grid (faint) */}
      <div className="absolute inset-0 bg-blueprint opacity-70" aria-hidden />

      {/* Layer 2 - aurora */}
      <div className="absolute inset-0 bg-aurora opacity-70" aria-hidden />

      {/* Layer 3 - animated soft orbs */}
      <div
        className="absolute inset-0 overflow-hidden pointer-events-none"
        aria-hidden
      >
        <motion.div
          className="absolute -top-40 -left-40 h-[42rem] w-[42rem] rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(16,185,129,0.12) 0%, transparent 60%)",
            filter: "blur(80px)",
          }}
          animate={
            prefersReducedMotion
              ? undefined
              : { scale: [1, 1.08, 1], opacity: [0.55, 0.78, 0.55] }
          }
          transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute -bottom-32 -right-24 h-[36rem] w-[36rem] rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(6,182,212,0.08) 0%, transparent 60%)",
            filter: "blur(96px)",
          }}
          animate={
            prefersReducedMotion
              ? undefined
              : { scale: [1, 1.12, 1], opacity: [0.5, 0.7, 0.5] }
          }
          transition={{
            duration: 16,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 2,
          }}
        />
      </div>

      {/* Layer 4 - cursor spotlight (skipped on reduced motion) */}
      {!prefersReducedMotion && (
        <motion.div
          className="absolute inset-0 pointer-events-none"
          style={{ background: spotlight }}
          aria-hidden
        />
      )}

      {/* Layer 5 - film grain */}
      <div
        className="absolute inset-0 bg-grain pointer-events-none"
        aria-hidden
      />

      {/* Bottom fade-out into the next section */}
      <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-[#020408] via-[#020408]/85 to-transparent pointer-events-none" />

      {/* Content */}
      <motion.div
        style={
          prefersReducedMotion
            ? undefined
            : { y: scrollY, opacity: scrollOpacity }
        }
        className="relative z-10 mx-auto max-w-[1400px] w-full px-6 sm:px-10 lg:px-12 pt-28 pb-16 lg:pt-32 lg:pb-20"
      >
        <div className="grid lg:grid-cols-12 gap-y-12 lg:gap-x-12 items-end">
          {/* Left column - copy (without spec strip; that lives in row 2) */}
          <div className="lg:col-span-7 lg:row-start-1 max-w-2xl">
            {/* Kicker */}
            <motion.div
              className="kicker mb-8"
              initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            >
              <span className="kicker-num">TerraQura</span>
              Aethelred verification network
            </motion.div>

            {/* Title - LCP element. Statically rendered, fully visible from frame 1. */}
            <h1
              id="hero-heading"
              className="font-display text-display-lg lg:text-display-xl text-white tracking-tight leading-[1.04]"
            >
              <span className="block">Carbon markets,</span>
              <span className="block">
                <span className="accent-italic">rebuilt</span>
                <span className="text-white/95"> on evidence.</span>
              </span>
            </h1>

            {/* Subtitle */}
            <motion.p
              className="mt-7 max-w-xl text-body-lg text-white/72 font-body leading-relaxed"
              initial={prefersReducedMotion ? false : { opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: "easeOut", delay: 0.1 }}
            >
              TerraQura turns live facility telemetry, satellite context, and
              on-chain provenance into carbon-removal credits that compliance
              teams can inspect, price, and retire with confidence.
            </motion.p>

            {/* CTAs */}
            <motion.div
              className="mt-10 flex flex-col sm:flex-row gap-3.5"
              initial={prefersReducedMotion ? false : { opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: "easeOut", delay: 0.2 }}
            >
              <MagneticButton strength={0.18}>
                <Link
                  href="/technology"
                  className="group inline-flex items-center justify-center gap-2.5 rounded-xl bg-gradient-to-b from-emerald-500 to-emerald-600 px-7 py-3.5 text-[15px] font-semibold text-white shadow-[0_8px_30px_-8px_rgba(16,185,129,0.55),inset_0_1px_0_rgba(255,255,255,0.18)] ring-1 ring-emerald-400/40 transition-all hover:shadow-[0_8px_36px_-6px_rgba(16,185,129,0.7),inset_0_1px_0_rgba(255,255,255,0.22)]"
                >
                  See the verification stack
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </MagneticButton>
              <MagneticButton strength={0.18}>
                <Link
                  href="/solutions/enterprise"
                  className="group inline-flex items-center justify-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.02] px-7 py-3.5 text-[15px] font-semibold text-white/85 backdrop-blur-md transition-all hover:border-emerald-400/30 hover:bg-white/[0.04] hover:text-white"
                >
                  <Play className="h-4 w-4" />
                  Explore buyer workflow
                </Link>
              </MagneticButton>
            </motion.div>
          </div>

          {/* Right column - verification stack visualization.
              `items-end` on the grid + this being row-1 only means the stack's
              bottom (the 3rd "Mint" card) aligns with the bottom of the CTAs. */}
          <motion.div
            className="lg:col-span-5 lg:row-start-1"
            initial={prefersReducedMotion ? false : { opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7, ease: "easeOut", delay: 0.25 }}
          >
            <HeroVerificationStack />
          </motion.div>

          {/* Spec strip - row 2, left column only; sits below the CTA / stack baseline. */}
          <motion.dl
            className="lg:col-span-7 lg:row-start-2 mt-2 grid grid-cols-2 gap-x-10 gap-y-3 max-w-xl"
            initial={prefersReducedMotion ? false : { opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.5, ease: "easeOut", delay: 0.3 }}
          >
            {specs.map((s) => (
              <div key={s.label} className="spec-row">
                <dt className="spec-label">{s.label}</dt>
                <span className="spec-leader" aria-hidden />
                <dd className="spec-value">{s.value}</dd>
              </div>
            ))}
          </motion.dl>
        </div>
      </motion.div>
    </section>
  );
}
