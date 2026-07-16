/**
 * First-party wallet definitions for the RainbowKit connect modal.
 *
 * RainbowKit already surfaces every EIP-6963-announced wallet (Aethelred
 * Wallet, MetaMask, ...) at the top of the modal when the extension is
 * installed. What the default config cannot do is show a BRANDED
 * Aethelred Wallet entry when the extension is missing — users would see
 * MetaMask/Rainbow install prompts but nothing pointing at our own
 * wallet. This definition closes that gap:
 *
 *   - installed  → deduped against the live EIP-6963 connector by rdns
 *     (the modal merges entries whose `rdns` matches a discovered
 *     provider), so exactly one "Aethelred Wallet" appears.
 *   - not installed → the entry stays visible with a download link,
 *     the same treatment MetaMask gets from RainbowKit's defaults.
 */

"use client";

import { createConnector, type CreateConnectorFn } from "wagmi";
import { injected } from "wagmi/connectors";
import type { Wallet, WalletDetailsParams } from "@rainbow-me/rainbowkit";

export const AETHELRED_WALLET_RDNS = "org.aethelred.wallet";

export const AETHELRED_WALLET_DOWNLOAD_URL =
  "https://github.com/aethelred-foundation/wallet";

/** Same mark the extension announces over EIP-6963. */
export const AETHELRED_WALLET_ICON =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='20' fill='%23111a24'/%3E%3Cpath d='M17 45L31 15l16 30h-8l-2.4-5H27.5L25 45h-8zm14-12h2.8L32.4 30 31 33z' fill='%23f5efe6'/%3E%3C/svg%3E";

interface AethelredWindow {
  aethelred?: unknown;
}

/**
 * The extension exposes its provider under window.aethelred in addition
 * to EIP-6963, so detection works even when another wallet owns
 * window.ethereum.
 */
export function getAethelredProvider(): unknown {
  if (typeof window === "undefined") return undefined;
  return (window as unknown as AethelredWindow).aethelred;
}

export const aethelredWallet = (): Wallet => {
  const provider = getAethelredProvider();
  return {
    id: "aethelred",
    name: "Aethelred Wallet",
    rdns: AETHELRED_WALLET_RDNS,
    iconUrl: AETHELRED_WALLET_ICON,
    iconBackground: "#111a24",
    installed: typeof window === "undefined" ? undefined : Boolean(provider),
    downloadUrls: {
      browserExtension: AETHELRED_WALLET_DOWNLOAD_URL,
    },
    createConnector: (walletDetails: WalletDetailsParams): CreateConnectorFn => {
      // Mirror RainbowKit's own injected-wallet pattern: target the
      // wallet-specific provider when present, otherwise fall back to
      // the generic injected connector so the entry still functions.
      const injectedConfig = provider
        ? {
            target: () => ({
              id: walletDetails.rkDetails.id,
              name: walletDetails.rkDetails.name,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              provider: provider as any,
            }),
          }
        : {};
      return createConnector((config) => ({
        ...injected(injectedConfig)(config),
        ...walletDetails,
      }));
    },
  };
};
