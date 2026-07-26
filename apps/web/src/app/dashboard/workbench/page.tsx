"use client";

import { useEffect, useState, type ComponentType } from "react";

import { useApp } from "@/contexts/AppContext";

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

  if (!Workbench) {
    return <LoadingWorkbench />;
  }

  return <Workbench />;
}
