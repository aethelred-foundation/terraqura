"use client";

import type { Wallet } from "@rainbow-me/rainbowkit";
import { createConnector } from "wagmi";
import { injected } from "wagmi/connectors";
import type { EIP1193Provider } from "viem";

export const AETHELRED_WALLET_RDNS = "org.aethelred.wallet";

type AethelredWindow = Window & {
  aethelred?: EIP1193Provider & {
    isAethelred?: boolean;
  };
};

function getAethelredProvider(): EIP1193Provider | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  return (window as AethelredWindow).aethelred;
}

/**
 * First-party RainbowKit entry for the Aethelred Wallet.
 *
 * The extension announces itself through EIP-6963 and also exposes a stable
 * `window.aethelred` namespace. Targeting that namespace prevents MetaMask
 * from winning the legacy `window.ethereum` race when both extensions are
 * installed.
 */
export const aethelredWallet = (): Wallet => ({
  id: AETHELRED_WALLET_RDNS,
  rdns: AETHELRED_WALLET_RDNS,
  name: "Aethelred Wallet",
  shortName: "Aethelred",
  iconUrl: "/favicon.svg",
  iconBackground: "#06120f",
  installed: typeof window !== "undefined" && Boolean(getAethelredProvider()),
  downloadUrls: {
    browserExtension: "https://github.com/aethelred-foundation/wallet/releases",
    chrome: "https://github.com/aethelred-foundation/wallet/releases",
  },
  extension: {
    instructions: {
      learnMoreUrl: "https://github.com/aethelred-foundation/wallet",
      steps: [
        {
          step: "install",
          title: "Install Aethelred Wallet",
          description:
            "Install the signed browser extension from the Aethelred Wallet release page.",
        },
        {
          step: "create",
          title: "Create or import an account",
          description: "Open the extension and finish the secure wallet setup.",
        },
        {
          step: "refresh",
          title: "Refresh TerraQura",
          description:
            "Reload this page so the wallet can announce its provider.",
        },
      ],
    },
  },
  createConnector: (walletDetails) =>
    createConnector((config) => ({
      ...injected({
        shimDisconnect: true,
        target: {
          id: AETHELRED_WALLET_RDNS,
          name: "Aethelred Wallet",
          provider: getAethelredProvider,
        },
      })(config),
      ...walletDetails,
    })),
});
