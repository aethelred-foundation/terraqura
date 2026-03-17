/**
 * TerraQura Application Providers
 *
 * The Web3 provider stack (Wagmi, RainbowKit, React Query) is lazily loaded
 * on the client only. Children always render during SSR so page content
 * is server-rendered for SEO and fast first paint. Once the Web3 module
 * loads on the client, it wraps children with blockchain providers.
 *
 * @version 5.0.0
 * @author TerraQura Engineering
 */

"use client";

import React, { useState, useEffect, type ComponentType } from "react";
import { AppProvider, AppProviderSSR } from "@/contexts/AppContext";

interface ProvidersProps {
  children: React.ReactNode;
}

export function Providers({ children }: ProvidersProps): React.JSX.Element {
  const [Web3Module, setWeb3Module] = useState<ComponentType<{
    children: React.ReactNode;
  }> | null>(null);

  useEffect(() => {
    // Dynamically import the Web3 provider stack on the client only.
    // This prevents RainbowKit's getDefaultConfig from running during SSR
    // where window.ethereum and localStorage don't exist.
    import("./web3-providers").then((mod) => {
      setWeb3Module(() => mod.default);
    });
  }, []);

  if (Web3Module) {
    return <Web3Module><AppProvider>{children}</AppProvider></Web3Module>;
  }

  // During SSR and initial client render, provide a static SSR-safe context
  // so useApp() doesn't throw. Web3 features activate after load.
  return <AppProviderSSR>{children}</AppProviderSSR>;
}
