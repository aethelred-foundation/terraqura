"use client";

import { motion } from "framer-motion";
import { Cpu, Layers, Zap, Droplets, Network, Shield, Clock, type LucideIcon } from "lucide-react";

interface TickerItem {
  label: string;
  value: string;
  icon: LucideIcon;
}

const techSpecs: TickerItem[] = [
  { label: "Protocol", value: "Aethelred", icon: Cpu },
  { label: "Verification Engine", value: "Proof-of-Physics", icon: Shield },
  { label: "Token Standard", value: "ERC-1155", icon: Layers },
  { label: "Meta-Transactions", value: "ERC-2771 Gasless", icon: Zap },
  { label: "Validation Range", value: "200-600 kWh/tonne", icon: Droplets },
  { label: "Oracle", value: "Sovereign NativeIoT", icon: Network },
  { label: "Governance", value: "Multi-Sig Timelock", icon: Clock },
];

function TickerItemComponent({ item }: { item: TickerItem }) {
  return (
    <div className="flex items-center gap-3 px-8 border-r border-white/[0.04] last:border-r-0">
      <item.icon className="h-3.5 w-3.5 text-emerald-400/55" />
      <span className="text-[10.5px] uppercase tracking-[0.22em] text-white/45 whitespace-nowrap font-mono">
        {item.label}
      </span>
      <span className="text-[12.5px] text-emerald-300/95 whitespace-nowrap font-mono tnum">
        {item.value}
      </span>
    </div>
  );
}

export function LiveTicker() {
  return (
    <section
      className="relative -mt-12 sm:-mt-14 lg:-mt-16 z-20 bg-[#03060c] border-y border-white/[0.05] overflow-hidden"
      aria-label="Aethelred Protocol Specifications"
    >
      <div className="absolute top-0 left-0 right-0 divider-glow" />
      <div className="absolute left-0 top-0 bottom-0 w-40 bg-gradient-to-r from-[#03060c] to-transparent z-10 pointer-events-none" />
      <div className="absolute right-0 top-0 bottom-0 w-40 bg-gradient-to-l from-[#03060c] to-transparent z-10 pointer-events-none" />

      <div className="absolute left-6 top-1/2 -translate-y-1/2 z-20 hidden lg:flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.22em] text-white/40">
        <span className="pulse-dot h-1.5 w-1.5" />
        Live Spec
      </div>

      <div className="flex overflow-hidden py-4 lg:py-5 lg:pl-32">
        <motion.div
          className="flex shrink-0"
          animate={{ x: ["0%", "-50%"] }}
          transition={{ duration: 50, repeat: Infinity, ease: "linear" }}
        >
          {[...techSpecs, ...techSpecs].map((item, i) => (
            <TickerItemComponent key={`${item.label}-${i}`} item={item} />
          ))}
        </motion.div>
        <motion.div
          className="flex shrink-0"
          animate={{ x: ["0%", "-50%"] }}
          transition={{ duration: 50, repeat: Infinity, ease: "linear" }}
        >
          {[...techSpecs, ...techSpecs].map((item, i) => (
            <TickerItemComponent key={`dup-${item.label}-${i}`} item={item} />
          ))}
        </motion.div>
      </div>
    </section>
  );
}
