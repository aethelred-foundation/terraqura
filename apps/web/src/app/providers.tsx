/**
 * TerraQura Application Providers
 *
 * Web3 provider stack (Wagmi, RainbowKit, React Query) is loaded lazily AND
 * gated by route. Marketing routes (/, /about, /technology, /blog, /privacy,
 * /terms, etc.) never load wagmi/viem/RainbowKit - keeping the JS budget for
 * the public-facing site small.
 *
 * Routes that DO load the Web3 stack:
 *   /dashboard/*  - full dapp
 *   /buyer        - wallet-connected procurement preview
 *   /operator     - DAC operator console preview
 *   /explorer     - on-chain explorer with wallet-aware features
 */

"use client";

import React, { useState, useEffect, type ComponentType } from "react";
import { usePathname } from "next/navigation";
import { AppProvider, AppProviderSSR } from "@/contexts/AppContext";

interface ProvidersProps {
  children: React.ReactNode;
}

const WEB3_ROUTE_PREFIXES = ["/dashboard", "/buyer", "/operator", "/explorer"];

function isWeb3Route(pathname: string | null): boolean {
  if (!pathname) return false;
  return WEB3_ROUTE_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

interface Web3Bundle {
  Provider: ComponentType<{ children: React.ReactNode }>;
  hasWagmi: boolean;
}

export function Providers({ children }: ProvidersProps): React.JSX.Element {
  const pathname = usePathname();
  const needsWeb3 = isWeb3Route(pathname);
  const [bundle, setBundle] = useState<Web3Bundle | null>(null);

  useEffect(() => {
    if (!needsWeb3) return;
    let cancelled = false;
    Promise.all([import("./web3-providers"), import("@/lib/wagmi")]).then(
      ([web3Mod, wagmiMod]) => {
        if (cancelled) return;
        setBundle({
          Provider: web3Mod.default,
          hasWagmi: Boolean(wagmiMod.config) && !wagmiMod.configError,
        });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [needsWeb3]);

  if (needsWeb3 && bundle) {
    // Two paths:
    //  - hasWagmi: real WagmiProvider mounted, AppProvider can call wagmi hooks
    //  - !hasWagmi: wagmi config failed to init (e.g. missing WC projectId
    //    in dev). Web3Providers renders children without WagmiProvider, so
    //    we MUST use AppProviderSSR - calling wagmi hooks would throw.
    const AppShell = bundle.hasWagmi ? AppProvider : AppProviderSSR;
    return (
      <bundle.Provider>
        <AppShell>{children}</AppShell>
      </bundle.Provider>
    );
  }

  // SSR-safe fallback for marketing routes AND for the brief moment between
  // hydration and the Web3 module finishing its dynamic import on dapp routes.
  return <AppProviderSSR>{children}</AppProviderSSR>;
}
