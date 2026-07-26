"use client";

import { useState, useEffect, type ComponentType } from "react";
import { useApp } from "@/contexts/AppContext";
import { configError } from "@/lib/wagmi";

function LoadingSpinner() {
  return (
    <div className="min-h-screen bg-[#060A13] flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
        <p className="text-white/30 text-sm font-mono">Loading TerraQura...</p>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { web3Ready } = useApp();
  const [Component, setComponent] = useState<ComponentType | null>(null);

  useEffect(() => {
    if (web3Ready) {
      import("./workbench/content").then((m) =>
        setComponent(() => m.TerraQuraWorkbench),
      );
    }
  }, [web3Ready]);

  if (configError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#020605] px-6 text-white">
        <div className="max-w-xl border border-amber-300/20 bg-amber-300/[0.04] p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-200">
            Network configuration required
          </p>
          <h1 className="mt-3 text-2xl font-semibold">
            TerraQura is unavailable for transactions
          </h1>
          <p className="mt-3 text-sm leading-6 text-white/55">
            {configError.message} Operations remain disabled until the published
            Aethelred testnet RPC and TerraQura contract deployment are
            configured.
          </p>
        </div>
      </div>
    );
  }
  if (!Component) return <LoadingSpinner />;
  return <Component />;
}
