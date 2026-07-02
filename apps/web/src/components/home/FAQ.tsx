"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence, useInView } from "framer-motion";
import { ChevronDown, ArrowRight } from "lucide-react";
import { homeFaqs as faqs, type FAQItem } from "./faqs";

function FAQCard({
  item,
  index,
  isVisible,
}: {
  item: FAQItem;
  index: number;
  isVisible: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <motion.div
      className={`rounded-xl bg-white/[0.02] border overflow-hidden transition-colors duration-300 ${
        isOpen
          ? "border-emerald-500/20 bg-emerald-500/[0.02]"
          : "border-white/[0.06] hover:border-white/10"
      }`}
      initial={false}
      animate={isVisible ? { opacity: 1, y: 0 } : {}}
      transition={{ delay: 0.05 + index * 0.04, duration: 0.4 }}
    >
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-start justify-between gap-3 px-5 py-4 text-left transition-colors"
        aria-expanded={isOpen}
      >
        <span className="text-white/90 font-semibold text-sm leading-snug">
          {item.q}
        </span>
        <motion.div
          className="w-6 h-6 rounded-md bg-white/[0.04] flex items-center justify-center shrink-0 mt-0.5"
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.25 }}
        >
          <ChevronDown className="w-3.5 h-3.5 text-emerald-400/70" />
        </motion.div>
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            <div className="px-5 pb-4 text-white/60 text-[13px] leading-relaxed font-body">
              {item.a}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export function FAQ() {
  const sectionRef = useRef<HTMLElement>(null);
  const isInView = useInView(sectionRef, { once: true, amount: 0.1 });
  const [fallback, setFallback] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setFallback(true), 2000);
    return () => clearTimeout(timer);
  }, []);

  const visible = isInView || fallback;
  const leftColumn = faqs.filter((_, i) => i % 2 === 0);
  const rightColumn = faqs.filter((_, i) => i % 2 === 1);

  return (
    <section
      ref={sectionRef}
      className="relative section-padding overflow-hidden"
      aria-labelledby="faq-heading"
    >
      {/* Background - soft top glow + blueprint */}
      <div
        className="absolute inset-0 bg-blueprint-fine opacity-[0.4] pointer-events-none"
        aria-hidden
      />
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 h-[28rem] w-[60rem] pointer-events-none"
        aria-hidden
        style={{
          background:
            "radial-gradient(60% 60% at 50% 0%, rgba(16,185,129,0.06), transparent 70%)",
        }}
      />

      <div className="container-premium relative z-10">
        {/* Header - editorial */}
        <div className="mb-10 lg:mb-12 max-w-3xl">
          <span className="kicker mb-6">
            <span className="kicker-num">08</span>
            Common Questions
          </span>
          <h2
            id="faq-heading"
            className="font-display text-display lg:text-display-lg text-white leading-[1.06]"
          >
            What you actually want to know,{" "}
            <span className="accent-italic">in plain English.</span>
          </h2>
          <p className="mt-5 max-w-xl text-body text-white/70 font-body leading-relaxed">
            Everything you need to know about the Aethelred Protocol,
            Proof-of-Physics, and what makes a TerraQura credit different.
          </p>
        </div>

        {/* 2-Column FAQ Grid */}
        <div className="max-w-6xl grid md:grid-cols-2 gap-3">
          <div className="space-y-3">
            {leftColumn.map((faq, index) => (
              <FAQCard
                key={index * 2}
                item={faq}
                index={index * 2}
                isVisible={visible}
              />
            ))}
          </div>
          <div className="space-y-3">
            {rightColumn.map((faq, index) => (
              <FAQCard
                key={index * 2 + 1}
                item={faq}
                index={index * 2 + 1}
                isVisible={visible}
              />
            ))}
          </div>
        </div>

        {/* Contact CTA */}
        <motion.div
          className="mt-12 inline-flex items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-md px-5 py-3.5"
          initial={false}
          animate={visible ? { opacity: 1 } : {}}
          transition={{ delay: 0.45 }}
        >
          <span className="text-[13px] text-white/65 font-body">
            Need something else?
          </span>
          <a
            href="mailto:hello@terraqura.com"
            className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-emerald-300 hover:text-emerald-200 transition-colors"
          >
            hello@terraqura.com
            <ArrowRight className="h-3.5 w-3.5" />
          </a>
        </motion.div>
      </div>
    </section>
  );
}
