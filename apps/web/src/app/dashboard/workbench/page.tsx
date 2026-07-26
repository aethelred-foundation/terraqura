"use client";

import { useEffect, useState, type ComponentType } from "react";

import { useApp } from "@/contexts/AppContext";
import { configError } from "@/lib/wagmi";

function LoadingWorkbench() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#020605]">
      <div className="flex items-center gap-3 text-sm text-white/40">
        <span className="h-4 w-4 animate-spin border border-emerald-400/20 border-t-emerald-400" />
        Initializing Aethelred connection…
      </div>
    </div>
  );
}

export default function WorkbenchPage() {
  const { web3Ready } = useApp();
  const [Workbench, setWorkbench] = useState<ComponentType | null>(null);

  useEffect(() => {
    if (web3Ready) {
      void import("./content").then((module) => {
        setWorkbench(() => module.TerraQuraWorkbench);
      });
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
  if (!Workbench) {
    return <LoadingWorkbench />;
  }

  return <Workbench />;
}
