"use client";

import { useRef, useEffect } from "react";
import Link from "next/link";
import { motion, useScroll, useTransform, useSpring, useMotionValue, useMotionTemplate } from "framer-motion";
import { gsap } from "gsap";
import { ArrowRight, Play, Zap, Shield, Globe, Cpu, Sparkles } from "lucide-react";
import { MagneticButton } from "@/components/animations/MagneticButton";

const pillars = [
  { label: "Proof-of-Physics", desc: "Thermodynamic verification of every carbon credit", icon: Zap },
  { label: "Sovereign Chain", desc: "Purpose-built blockchain for carbon assets", icon: Shield },
  { label: "1st-Party Oracle", desc: "Direct IoT sensor feeds, zero third-party risk", icon: Cpu },
  { label: "Enterprise-Grade", desc: "Gasless transactions, institutional compliance", icon: Globe },
];

export function Hero() {
  const containerRef = useRef<HTMLElement>(null);
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end start"],
  });

  const y = useTransform(scrollYProgress, [0, 1], ["0%", "40%"]);
  const opacity = useTransform(scrollYProgress, [0, 0.6], [1, 0]);
  const scale = useTransform(scrollYProgress, [0, 0.5], [1, 0.9]);
  const rotateX = useTransform(mouseY, [-0.5, 0.5], [2, -2]);
  const rotateY = useTransform(mouseX, [-0.5, 0.5], [-2, 2]);

  const springConfig = { stiffness: 100, damping: 30, mass: 1 };
  const mouseXSpring = useSpring(mouseX, springConfig);
  const mouseYSpring = useSpring(mouseY, springConfig);

  const background = useMotionTemplate`
    radial-gradient(
      800px circle at ${useTransform(mouseXSpring, [0, 1], ["20%", "80%"])} ${useTransform(mouseYSpring, [0, 1], ["20%", "80%"])},
      rgba(16, 185, 129, 0.12),
      transparent 50%
    )
  `;

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const { clientX, clientY } = e;
      const { innerWidth, innerHeight } = window;
      mouseX.set(clientX / innerWidth);
      mouseY.set(clientY / innerHeight);
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [mouseX, mouseY]);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo(".hero-badge",
        { opacity: 0, y: 30, scale: 0.9 },
        { opacity: 1, y: 0, scale: 1, duration: 0.8, ease: "power3.out", delay: 0.2 }
      );
      gsap.fromTo(".hero-title",
        { opacity: 0, y: 50 },
        { opacity: 1, y: 0, duration: 1, ease: "power3.out", delay: 0.4 }
      );
      gsap.fromTo(".hero-subtitle",
        { opacity: 0, y: 40 },
        { opacity: 1, y: 0, duration: 0.9, ease: "power3.out", delay: 0.6 }
      );
      gsap.fromTo(".hero-cta",
        { opacity: 0, y: 40 },
        { opacity: 1, y: 0, duration: 0.9, ease: "power3.out", delay: 0.8 }
      );
      gsap.fromTo(".hero-pillar",
        { opacity: 0, y: 30, scale: 0.95 },
        { opacity: 1, y: 0, scale: 1, duration: 0.7, stagger: 0.1, ease: "power3.out", delay: 1 }
      );
    });
    return () => ctx.revert();
  }, []);

  return (
    <section ref={containerRef} className="relative min-h-screen flex items-center overflow-clip" aria-labelledby="hero-heading">
      {/* Dynamic Spotlight Background */}
      <motion.div className="absolute inset-0 pointer-events-none" style={{ background }} />

      {/* Animated Gradient Orbs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute inset-0 bg-[#020408]" />
        <motion.div
          className="absolute -top-1/4 -left-1/4 w-[800px] h-[800px] rounded-full"
          style={{
            background: "radial-gradient(circle, rgba(16, 185, 129, 0.18) 0%, transparent 65%)",
            filter: "blur(80px)",
            x: useTransform(mouseXSpring, [0, 1], [-50, 50]),
            y: useTransform(mouseYSpring, [0, 1], [-50, 50]),
          }}
          animate={{ scale: [1, 1.15, 1], opacity: [0.6, 0.8, 0.6] }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute -bottom-1/4 -right-1/4 w-[700px] h-[700px] rounded-full"
          style={{
            background: "radial-gradient(circle, rgba(6, 182, 212, 0.12) 0%, transparent 65%)",
            filter: "blur(80px)",
          }}
          animate={{ scale: [1, 1.2, 1], opacity: [0.4, 0.6, 0.4], x: [0, 50, 0], y: [0, -30, 0] }}
          transition={{ duration: 15, repeat: Infinity, ease: "easeInOut", delay: 2 }}
        />
        <motion.div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full"
          style={{
            background: "radial-gradient(circle, rgba(139, 92, 246, 0.08) 0%, transparent 60%)",
            filter: "blur(100px)",
          }}
          animate={{ scale: [1, 1.1, 1], rotate: [0, 180, 360] }}
          transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
        />
        <div className="absolute inset-0 bg-grid-pattern opacity-[0.02]" />
      </div>

      {/* Content */}
      <motion.div
        style={{ y, opacity, scale, rotateX, rotateY }}
        className="relative z-10 mx-auto max-w-[1400px] px-6 sm:px-10 md:px-14 lg:px-10 pt-32 pb-20 lg:pt-40 lg:pb-28 w-full"
      >
        <div className="max-w-5xl mx-auto text-center">
          {/* Badge */}
          <motion.div
            className="hero-badge inline-flex items-center gap-3 px-5 py-2.5 rounded-full glass-strong mb-10"
            whileHover={{ scale: 1.03 }}
          >
            <div className="relative flex items-center justify-center">
              <span className="absolute inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-ping opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </div>
            <span className="text-white/70 text-sm font-medium tracking-wide font-body">
              The Aethelred Protocol  --  Launching Q3 2026
            </span>
            <Sparkles className="w-4 h-4 text-emerald-500" />
          </motion.div>

          {/* Title */}
          <h1 id="hero-heading" className="hero-title text-display-lg lg:text-display-xl font-display mb-8">
            <span className="block text-white mb-1">Engineered</span>
            <span className="block text-gradient-emerald">Carbon Truth</span>
          </h1>

          {/* Subtitle */}
          <p className="hero-subtitle text-body-lg lg:text-body-xl text-white/70 mb-14 max-w-3xl mx-auto font-body leading-relaxed">
            The Aethelred Protocol powers the first verification infrastructure for physical carbon removal.{" "}
            <span className="text-white/80">Proof-of-Physics</span> verification meets{" "}
            <span className="text-white/80">enterprise-grade</span> blockchain.
          </p>

          {/* CTAs */}
          <div className="hero-cta flex flex-col sm:flex-row gap-4 justify-center mb-14 lg:mb-16">
            <MagneticButton strength={0.2}>
              <Link
                href="/technology"
                className="group inline-flex items-center justify-center gap-3 px-8 py-4 text-base font-semibold text-white bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-xl transition-all shadow-lg shadow-emerald-500/30 hover:shadow-emerald-500/50"
              >
                Explore Aethelred
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
            </MagneticButton>
            <MagneticButton strength={0.2}>
              <Link
                href="/solutions/enterprise"
                className="group inline-flex items-center justify-center gap-3 px-8 py-4 text-base font-semibold text-white/80 hover:text-white border border-white/10 hover:border-emerald-500/30 bg-white/[0.02] hover:bg-white/[0.04] rounded-xl transition-all"
              >
                <Play className="w-5 h-5" />
                Watch Demo
              </Link>
            </MagneticButton>
          </div>

          {/* Pillars Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-5 max-w-5xl mx-auto">
            {pillars.map((pillar) => (
              <motion.div
                key={pillar.label}
                className="hero-pillar relative p-6 lg:p-8 rounded-2xl glass-card group cursor-pointer"
                whileHover={{ y: -6, scale: 1.02 }}
                transition={{ type: "spring", stiffness: 400, damping: 25 }}
              >
                <motion.div
                  className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center mb-5 mx-auto group-hover:bg-emerald-500/20 transition-colors"
                  whileHover={{ rotate: 5 }}
                >
                  <pillar.icon className="w-6 h-6 text-emerald-400" />
                </motion.div>
                <div className="text-base font-semibold text-white mb-2">{pillar.label}</div>
                <div className="text-white/70 text-sm leading-relaxed font-body">{pillar.desc}</div>
                <div className="absolute inset-0 rounded-2xl bg-emerald-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
              </motion.div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Bottom Gradient */}
      <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-[#020408] to-transparent pointer-events-none" />

      {/* Scroll Indicator */}
      <motion.div
        className="absolute bottom-10 left-1/2 -translate-x-1/2"
        initial={false}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.5, duration: 0.8 }}
      >
        <motion.div
          className="w-7 h-12 rounded-full border-2 border-white/15 flex items-start justify-center p-2"
          animate={{ y: [0, 5, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        >
          <motion.div
            className="w-1.5 h-3 rounded-full bg-gradient-to-b from-emerald-500 to-cyan-500"
            animate={{ y: [0, 8, 0], opacity: [1, 0.5, 1] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          />
        </motion.div>
      </motion.div>
    </section>
  );
}
