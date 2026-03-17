/**
 * Web3 Provider Stack (client-only)
 *
 * This module is dynamically imported with ssr:false from providers.tsx
 * so that RainbowKit / Wagmi module-scope initialisation only happens
 * in the browser where window.ethereum and localStorage exist.
 */

"use client";

import React, { useState, useEffect } from "react";
import {
  QueryClient,
  QueryClientProvider,
  QueryCache,
  MutationCache,
} from "@tanstack/react-query";
import { WagmiProvider, useAccount, useChainId } from "wagmi";
import { RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit";
import "@rainbow-me/rainbowkit/styles.css";
import { config, ACTIVE_NETWORK, configError } from "@/lib/wagmi";

// ============================================
// Query Client Configuration
// ============================================

function handleQueryError(error: Error): void {
  const ignoredErrors = [
    "could not coalesce",
    "network changed",
    "user rejected",
    "User denied",
    "underlying network changed",
  ];

  const shouldIgnore = ignoredErrors.some((msg) =>
    error.message?.toLowerCase().includes(msg.toLowerCase())
  );

  if (!shouldIgnore) {
    console.error("[TerraQura Query Error]", error.message);
  }
}

function shouldRetryQuery(failureCount: number, error: Error): boolean {
  if (
    error.message?.includes("user rejected") ||
    error.message?.includes("User denied")
  ) {
    return false;
  }

  if (
    error.message?.includes("execution reverted") ||
    error.message?.includes("call revert")
  ) {
    return false;
  }

  return failureCount < 3;
}

function createQueryClient(): QueryClient {
  return new QueryClient({
    queryCache: new QueryCache({
      onError: handleQueryError,
    }),
    mutationCache: new MutationCache({
      onError: handleQueryError,
    }),
    defaultOptions: {
      queries: {
        staleTime: 1000 * 20,
        gcTime: 1000 * 60 * 5,
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
        refetchOnMount: true,
        networkMode: "online",
        retry: shouldRetryQuery,
        retryDelay: (attemptIndex) =>
          Math.min(1000 * 2 ** attemptIndex, 10000),
        structuralSharing: true,
      },
      mutations: {
        retry: false,
        networkMode: "online",
      },
    },
  });
}

// ============================================
// RainbowKit Theme
// ============================================

const terraQuaTheme = darkTheme({
  accentColor: "#22c55e",
  accentColorForeground: "white",
  borderRadius: "medium",
  fontStack: "system",
  overlayBlur: "small",
});

const customTheme = {
  ...terraQuaTheme,
  colors: {
    ...terraQuaTheme.colors,
    modalBackground: "#0f172a",
    modalBorder: "#1e3a5f",
    profileForeground: "#0f172a",
    closeButton: "#94a3b8",
    closeButtonBackground: "#1e293b",
    actionButtonBorder: "#22c55e33",
    actionButtonBorderMobile: "#22c55e33",
    generalBorder: "#1e3a5f",
    generalBorderDim: "#1e3a5f66",
  },
  shadows: {
    ...terraQuaTheme.shadows,
    connectButton: "0 4px 12px rgba(34, 197, 94, 0.15)",
    dialog: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
  },
};

// ============================================
// Connection Monitor
// ============================================

function ConnectionMonitor(): null {
  const { isConnected, address } = useAccount();
  const chainId = useChainId();

  useEffect(() => {
    if (isConnected && address) {
      if (chainId !== ACTIVE_NETWORK.id) {
        console.warn(
          `[TerraQura] Wrong network detected. Expected ${ACTIVE_NETWORK.name} (${ACTIVE_NETWORK.id}), got ${chainId}`
        );
      }
    }
  }, [isConnected, address, chainId]);

  return null;
}

// ============================================
// Error Boundary
// ============================================

interface ProviderErrorBoundaryProps {
  children: React.ReactNode;
  fallback: React.ReactNode;
}

interface ProviderErrorBoundaryState {
  hasError: boolean;
}

class ProviderErrorBoundary extends React.Component<
  ProviderErrorBoundaryProps,
  ProviderErrorBoundaryState
> {
  constructor(props: ProviderErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ProviderErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error("[TerraQura Provider Error]", error, errorInfo);
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      return <>{this.props.fallback}</>;
    }
    return this.props.children;
  }
}

// ============================================
// Main Web3 Provider Component
// ============================================

interface Web3ProvidersProps {
  children: React.ReactNode;
}

export default function Web3Providers({ children }: Web3ProvidersProps): React.JSX.Element {
  const [queryClient] = useState(() => createQueryClient());

  // If wagmi config failed to initialise, render without Web3 providers.
  // The marketing site works fine without blockchain connectivity.
  if (configError || !config) {
    return <>{children}</>;
  }

  return (
    <ProviderErrorBoundary fallback={children}>
      <WagmiProvider config={config}>
        <QueryClientProvider client={queryClient}>
          <RainbowKitProvider
            theme={customTheme}
            modalSize="compact"
            showRecentTransactions={true}
            appInfo={{
              appName: "TerraQura",
              learnMoreUrl: "https://terraqura.aethelred.network",
              disclaimer: ({ Text, Link }) => (
                <Text>
                  By connecting your wallet, you agree to TerraQura&apos;s{" "}
                  <Link href="https://terraqura.aethelred.network/terms">Terms of Service</Link> and{" "}
                  <Link href="https://terraqura.aethelred.network/privacy">Privacy Policy</Link>
                </Text>
              ),
            }}
          >
            <ConnectionMonitor />
            {children}
          </RainbowKitProvider>
        </QueryClientProvider>
      </WagmiProvider>
    </ProviderErrorBoundary>
  );
}
