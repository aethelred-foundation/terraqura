"use client";

import type { Wallet } from "@rainbow-me/rainbowkit";
import type { EIP1193Provider } from "viem";
import { createConnector } from "wagmi";
import { injected } from "wagmi/connectors";

type MetaMaskProvider = EIP1193Provider & {
  isMetaMask?: true;
};

type MetaMaskWindow = Window & {
  ethereum?: MetaMaskProvider;
};

function getMetaMaskProvider(): MetaMaskProvider | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  const provider = (window as MetaMaskWindow).ethereum;
  return provider?.isMetaMask ? provider : undefined;
}

/**
 * Browser-extension-only MetaMask connector.
 *
 * RainbowKit's default MetaMask factory creates a WalletConnect client during
 * server rendering when MetaMask is not installed. That touches IndexedDB in
 * Node and pollutes production builds. TerraQura intentionally uses the
 * injected connector here; mobile WalletConnect can be added later through a
 * genuinely client-only connector boundary.
 */
export const metaMaskInjectedWallet = (): Wallet => ({
  id: "io.metamask",
  rdns: "io.metamask",
  name: "MetaMask",
  iconUrl: "/wallets/metamask.svg",
  iconBackground: "#ffffff",
  installed: typeof window !== "undefined" && Boolean(getMetaMaskProvider()),
  downloadUrls: {
    browserExtension: "https://metamask.io/download/",
    chrome:
      "https://chromewebstore.google.com/detail/metamask/nkbihfbeogaeaoehlefnkodbefgpgknn",
    firefox: "https://addons.mozilla.org/firefox/addon/ether-metamask/",
  },
  createConnector: (walletDetails) =>
    createConnector((config) => ({
      ...injected({
        shimDisconnect: true,
        target: {
          id: "io.metamask",
          name: "MetaMask",
          provider: getMetaMaskProvider,
        },
      })(config),
      ...walletDetails,
    })),
});
