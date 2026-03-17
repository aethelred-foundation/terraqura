"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence, useInView } from "framer-motion";
import { ChevronDown, ArrowRight } from "lucide-react";

interface FAQItem {
  q: string;
  a: string;
}

const faqs: FAQItem[] = [
  {
    q: "What is the Aethelred Protocol?",
    a: "TerraQura's sovereign blockchain infrastructure purpose-built for enterprise carbon verification. Sub-second finality, gasless transactions, and full data sovereignty powering our Proof-of-Physics engine.",
  },
  {
    q: "What is Proof-of-Physics?",
    a: "Our proprietary verification engine that validates carbon capture claims against physical constraints. It checks energy consumption (200-600 kWh/tonne range), flow rates, and conditions. If the physics don't add up, the credit is rejected.",
  },
  {
    q: "How is TerraQura different?",
    a: "Legacy registries rely on self-reported data and quarterly manual audits. TerraQura uses real-time IoT sensors, a sovereign oracle, satellite cross-verification, and on-chain mathematical validation. Every credit is publicly verifiable.",
  },
  {
    q: "Can enterprises buy without crypto?",
    a: "Yes. Our gasless settlement system using ERC-2771 meta-transactions enables purchase via standard invoices and wire transfers. The blockchain interaction is fully abstracted.",
  },
  {
    q: "Why build a sovereign chain?",
    a: "Aethelred's security, performance, and governance are optimized specifically for carbon verification. Sub-second finality, gasless transactions, and full data sovereignty, purpose-built for enterprise carbon assets.",
  },
  {
    q: "What is the regulatory status?",
    a: "TerraQura is a Zhyra Holdings venture headquartered in Abu Dhabi. Incorporating under ADGM with full KYC/AML compliance via Sumsub and UAE data residency.",
  },
  {
    q: "How are smart contracts secured?",
    a: "UUPS upgradeable proxy pattern with OpenZeppelin standards, multi-sig wallet with timelock delays, and circuit breakers. Tier-1 security audit before mainnet launch.",
  },
  {
    q: "When does the protocol launch?",
    a: "Testnet targeted for Q3 2026. Currently in smart contract development. Mainnet with institutional pilots follows the validation period. Actively engaging enterprise partners.",
  },
  {
    q: "What types of carbon credits does TerraQura support?",
    a: "TerraQura focuses exclusively on Direct Air Capture (DAC) carbon removal credits. Unlike nature-based offsets that rely on estimates and projections, DAC produces measurable, verifiable removal data that our Proof-of-Physics engine can validate in real-time.",
  },
  {
    q: "How does satellite cross-verification work?",
    a: "Satellite imagery provides an independent verification layer alongside IoT sensor data. We cross-reference facility operational status, thermal signatures, and environmental conditions against reported capture data to detect anomalies and ensure data integrity.",
  },
];

function FAQCard({ item, index, isVisible }: { item: FAQItem; index: number; isVisible: boolean }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <motion.div
      className={`rounded-xl bg-white/[0.02] border overflow-hidden transition-colors duration-300 ${
        isOpen ? "border-emerald-500/20 bg-emerald-500/[0.02]" : "border-white/[0.06] hover:border-white/10"
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
        <span className="text-white/90 font-semibold text-sm leading-snug">{item.q}</span>
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
    <section ref={sectionRef} className="relative py-16 sm:py-20 overflow-hidden" aria-labelledby="faq-heading">
      <div className="container mx-auto px-6 sm:px-8 lg:px-10 relative z-10">
        {/* Header */}
        <motion.div className="text-center mb-10" initial={false} animate={visible ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.6 }}>
          <h2 id="faq-heading" className="text-display-sm font-display text-white mb-3">
            Frequently Asked{" "}
            <span className="text-emerald-500">Questions</span>
          </h2>
          <p className="text-white/50 text-sm font-body max-w-2xl mx-auto">
            Everything you need to know about the Aethelred Protocol and Proof-of-Physics verification.
          </p>
        </motion.div>

        {/* 2-Column FAQ Grid */}
        <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-3">
          <div className="space-y-3">
            {leftColumn.map((faq, index) => (
              <FAQCard key={index * 2} item={faq} index={index * 2} isVisible={visible} />
            ))}
          </div>
          <div className="space-y-3">
            {rightColumn.map((faq, index) => (
              <FAQCard key={index * 2 + 1} item={faq} index={index * 2 + 1} isVisible={visible} />
            ))}
          </div>
        </div>

        {/* Contact CTA */}
        <motion.div className="text-center mt-8" initial={false} animate={visible ? { opacity: 1 } : {}} transition={{ delay: 0.5 }}>
          <a href="mailto:hello@terraqura.com" className="inline-flex items-center gap-2 text-emerald-500/70 hover:text-emerald-400 text-sm font-medium transition-colors">
            Have more questions? Contact our team
            <ArrowRight className="w-3.5 h-3.5" />
          </a>
        </motion.div>
      </div>
    </section>
  );
}
