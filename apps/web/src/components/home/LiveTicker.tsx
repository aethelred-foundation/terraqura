"use client";

import { motion } from "framer-motion";
import { Cpu, Layers, Zap, Droplets, Network, Shield, Clock, Globe, type LucideIcon } from "lucide-react";

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
  { label: "Headquarters", value: "Abu Dhabi, UAE", icon: Globe },
];

function TickerItemComponent({ item }: { item: TickerItem }) {
  return (
    <div className="flex items-center gap-3 px-8 border-r border-white/[0.06] last:border-r-0">
      <item.icon className="w-4 h-4 text-emerald-500/50" />
      <span className="text-white/45 text-sm font-medium whitespace-nowrap font-body">{item.label}</span>
      <span className="text-emerald-400 text-sm font-semibold whitespace-nowrap font-mono">{item.value}</span>
    </div>
  );
}

export function LiveTicker() {
  return (
    <section className="relative py-5 bg-surface-900/50 border-y border-white/[0.06] overflow-hidden" aria-label="Technology specifications">
      <div className="absolute left-0 top-0 bottom-0 w-32 bg-gradient-to-r from-[#020408] to-transparent z-10 pointer-events-none" />
      <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-[#020408] to-transparent z-10 pointer-events-none" />

      <div className="flex overflow-hidden">
        <motion.div className="flex shrink-0" animate={{ x: ["0%", "-50%"] }} transition={{ duration: 40, repeat: Infinity, ease: "linear" }}>
          {[...techSpecs, ...techSpecs].map((item, i) => (
            <TickerItemComponent key={`${item.label}-${i}`} item={item} />
          ))}
        </motion.div>
        <motion.div className="flex shrink-0" animate={{ x: ["0%", "-50%"] }} transition={{ duration: 40, repeat: Infinity, ease: "linear" }}>
          {[...techSpecs, ...techSpecs].map((item, i) => (
            <TickerItemComponent key={`dup-${item.label}-${i}`} item={item} />
          ))}
        </motion.div>
      </div>
    </section>
  );
}
