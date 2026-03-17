"use client";

import { useState, useEffect, type ComponentType } from "react";
import { useApp } from "@/contexts/AppContext";

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
      import("./content").then((m) => setComponent(() => m.DashboardContent));
    }
  }, [web3Ready]);

  if (!Component) return <LoadingSpinner />;
  return <Component />;
}
