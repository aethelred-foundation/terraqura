'use client';

import { useState, useEffect, Suspense, type ComponentType } from 'react';

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

/**
 * Client-only page wrapper. Defers content import until after hydration
 * so wagmi/RainbowKit hooks are available via WagmiProvider.
 */
export function ClientPage({ loader }: { loader: () => Promise<ComponentType> }) {
  const [Component, setComponent] = useState<ComponentType | null>(null);

  useEffect(() => {
    loader().then((Comp) => {
      setComponent(() => Comp);
    });
  }, [loader]);

  if (!Component) return <LoadingSpinner />;

  return (
    <Suspense fallback={<LoadingSpinner />}>
      <Component />
    </Suspense>
  );
}
