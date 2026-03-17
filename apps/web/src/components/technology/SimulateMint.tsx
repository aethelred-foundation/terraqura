"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

type MintState = "idle" | "validating" | "success" | "failed";

export function SimulateMint() {
  const [energyInput, setEnergyInput] = useState("");
  const [co2Input, setCo2Input] = useState("");
  const [state, setState] = useState<MintState>("idle");
  const [efficiency, setEfficiency] = useState<number | null>(null);
  const [hash, setHash] = useState("");

  const generateHash = useCallback(() => {
    const chars = "0123456789abcdef";
    let result = "0x";
    for (let i = 0; i < 64; i++) {
      result += chars[Math.floor(Math.random() * chars.length)];
    }
    return result;
  }, []);

  const handleSimulate = useCallback(() => {
    const energy = parseFloat(energyInput);
    const co2 = parseFloat(co2Input);

    if (isNaN(energy) || isNaN(co2) || energy <= 0 || co2 <= 0) return;

    setState("validating");
    const ratio = energy / co2;
    setEfficiency(ratio);

    setTimeout(() => {
      // Valid range: 200-600 kWh per tonne CO2
      if (ratio >= 200 && ratio <= 600) {
        setHash(generateHash());
        setState("success");
      } else {
        setState("failed");
      }
    }, 1500);
  }, [energyInput, co2Input, generateHash]);

  const handleReset = useCallback(() => {
    setState("idle");
    setEnergyInput("");
    setCo2Input("");
    setEfficiency(null);
    setHash("");
  }, []);

  return (
    <div className="relative">
      <div
        className={`relative rounded-2xl border overflow-hidden transition-all duration-500 ${
          state === "failed"
            ? "border-red-500/30 bg-red-500/[0.03]"
            : state === "success"
            ? "border-emerald-500/30 bg-emerald-500/[0.03] glow-emerald"
            : "border-white/[0.08] bg-white/[0.02]"
        }`}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/[0.06] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-2.5 h-2.5 rounded-full ${
              state === "failed" ? "bg-red-500" :
              state === "success" ? "bg-emerald-500" :
              state === "validating" ? "bg-yellow-500 animate-pulse" :
              "bg-white/20"
            }`} />
            <span className="text-white/60 text-sm font-data">PROOF-OF-PHYSICS SIMULATOR</span>
          </div>
          {state !== "idle" && (
            <button
              onClick={handleReset}
              className="text-white/30 hover:text-white/60 text-xs font-data transition-colors"
            >
              RESET
            </button>
          )}
        </div>

        {/* Terminal-style body */}
        <div className="p-6 space-y-6">
          {/* Input fields */}
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="energy-input" className="block text-white/55 text-xs font-data uppercase tracking-wider mb-2">
                Energy Consumed (kWh)
              </label>
              <input
                id="energy-input"
                type="number"
                value={energyInput}
                onChange={(e) => setEnergyInput(e.target.value)}
                placeholder="e.g. 400"
                disabled={state !== "idle"}
                className="w-full px-4 py-3 bg-white/[0.03] border border-white/[0.08] rounded-lg text-white font-data placeholder-white/20 focus:outline-none focus:border-emerald-500/30 transition-colors disabled:opacity-50"
                min="0"
                step="any"
              />
            </div>
            <div>
              <label htmlFor="co2-input" className="block text-white/55 text-xs font-data uppercase tracking-wider mb-2">
                CO2 Captured (tonnes)
              </label>
              <input
                id="co2-input"
                type="number"
                value={co2Input}
                onChange={(e) => setCo2Input(e.target.value)}
                placeholder="e.g. 1"
                disabled={state !== "idle"}
                className="w-full px-4 py-3 bg-white/[0.03] border border-white/[0.08] rounded-lg text-white font-data placeholder-white/20 focus:outline-none focus:border-emerald-500/30 transition-colors disabled:opacity-50"
                min="0"
                step="any"
              />
            </div>
          </div>

          {/* Simulate button */}
          {state === "idle" && (
            <button
              onClick={handleSimulate}
              disabled={!energyInput || !co2Input}
              className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-white/5 disabled:text-white/20 text-white font-semibold rounded-lg transition-all duration-200 disabled:cursor-not-allowed font-data text-sm"
            >
              RUN VERIFICATION
            </button>
          )}

          {/* Validating state */}
          <AnimatePresence mode="wait">
            {state === "validating" && (
              <motion.div
                initial={false}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-3"
              >
                <TerminalLine text="Initializing Proof-of-Physics Engine..." delay={0} />
                <TerminalLine text={`Energy input: ${energyInput} kWh`} delay={0.3} />
                <TerminalLine text={`CO2 captured: ${co2Input} tonnes`} delay={0.5} />
                <TerminalLine text={`Computing efficiency ratio: ${efficiency?.toFixed(1)} kWh/tonne`} delay={0.8} />
                <TerminalLine text="Validating against physical constraints [200-600 kWh/t]..." delay={1.1} />
                <div className="flex items-center gap-2 mt-4">
                  <div className="w-4 h-4 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin" />
                  <span className="text-yellow-400/60 text-xs font-data">VERIFYING...</span>
                </div>
              </motion.div>
            )}

            {/* Success state */}
            {state === "success" && (
              <motion.div
                initial={false}
                animate={{ opacity: 1, scale: 1 }}
                className="space-y-4"
              >
                <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                  <div className="flex items-center gap-2 mb-3">
                    <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-emerald-400 font-bold text-sm font-data">VERIFICATION PASSED</span>
                  </div>
                  <div className="space-y-2 text-xs font-data">
                    <div className="flex justify-between">
                      <span className="text-white/55">Efficiency Ratio</span>
                      <span className="text-emerald-400">{efficiency?.toFixed(1)} kWh/tonne</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/55">Status</span>
                      <span className="text-emerald-400">Within Physical Bounds</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/55">Token Standard</span>
                      <span className="text-white/70">ERC-1155</span>
                    </div>
                  </div>
                </div>

                {/* Simulated NFT */}
                <div className="p-4 rounded-lg bg-white/[0.03] border border-white/[0.08]">
                  <p className="text-white/30 text-xs font-data mb-2 uppercase tracking-wider">Simulated Token Hash</p>
                  <p className="text-emerald-400 text-xs font-data break-all leading-relaxed">
                    {hash}
                  </p>
                </div>

                <div className="text-center">
                  <p className="text-white/20 text-xs font-body italic">
                    This is a simulation. No real tokens were minted.
                  </p>
                </div>
              </motion.div>
            )}

            {/* Failed state */}
            {state === "failed" && (
              <motion.div
                initial={false}
                animate={{ opacity: 1, x: [0, -5, 5, -5, 5, 0] }}
                transition={{ x: { duration: 0.4 } }}
                className="space-y-4"
              >
                <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20">
                  <div className="flex items-center gap-2 mb-3">
                    <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <span className="text-red-400 font-bold text-sm font-data">VERIFICATION FAILED</span>
                  </div>
                  <p className="text-red-400/70 text-xs font-data leading-relaxed">
                    ANOMALOUS PHYSICS DETECTED: Efficiency ratio of{" "}
                    <span className="text-red-300 font-bold">{efficiency?.toFixed(1)} kWh/tonne</span>{" "}
                    falls outside acceptable range [200-600 kWh/tonne].
                    {efficiency !== null && efficiency < 200
                      ? " Energy input too low for claimed CO2 capture. Thermodynamically impossible."
                      : " Energy input too high. Indicates equipment malfunction or data manipulation."}
                  </p>
                </div>

                <div className="text-center">
                  <p className="text-white/30 text-xs font-body">
                    This is why TerraQura credits can never be forged. The physics must add up.
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

function TerminalLine({ text, delay }: { text: string; delay: number }) {
  return (
    <motion.div
      initial={false}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay, duration: 0.3 }}
      className="flex items-center gap-2"
    >
      <span className="text-emerald-500/50 font-data text-xs" aria-hidden="true">&gt;</span>
      <span className="text-white/70 text-xs font-data">{text}</span>
    </motion.div>
  );
}
