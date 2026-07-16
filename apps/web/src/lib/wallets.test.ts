/**
 * aethelredWallet — RainbowKit wallet definition for the first-party
 * Aethelred Wallet extension. The definition must:
 *   - carry the org.aethelred.wallet rdns so the connect modal merges it
 *     with the live EIP-6963 announcement (no duplicate entries),
 *   - detect installation via window.aethelred (set by the extension
 *     even when another wallet owns window.ethereum),
 *   - keep a download link for the not-installed state,
 *   - never touch `window` at module scope (SSR safety — see the note
 *     in wagmi.ts).
 */

import { afterEach, describe, expect, it } from "vitest";
import {
  AETHELRED_WALLET_RDNS,
  aethelredWallet,
  getAethelredProvider,
} from "./wallets";

type MutableWindow = { aethelred?: unknown };

afterEach(() => {
  delete (window as unknown as MutableWindow).aethelred;
});

describe("aethelredWallet", () => {
  it("declares the rdns that matches the extension's EIP-6963 announcement", () => {
    const wallet = aethelredWallet();
    expect(wallet.rdns).toBe(AETHELRED_WALLET_RDNS);
    expect(wallet.rdns).toBe("org.aethelred.wallet");
    expect(wallet.name).toBe("Aethelred Wallet");
    expect(wallet.id).toBe("aethelred");
  });

  it("reports not installed when the extension is absent", () => {
    expect(aethelredWallet().installed).toBe(false);
  });

  it("reports installed when window.aethelred is present", () => {
    (window as unknown as MutableWindow).aethelred = { isAethelred: true };
    expect(aethelredWallet().installed).toBe(true);
  });

  it("carries a browser-extension download link for the not-installed state", () => {
    const wallet = aethelredWallet();
    expect(wallet.downloadUrls?.browserExtension).toMatch(/^https:\/\//);
  });

  it("uses a self-contained data-URI icon (no network fetch in the modal)", () => {
    const wallet = aethelredWallet();
    expect(String(wallet.iconUrl).startsWith("data:image/svg+xml")).toBe(true);
  });

  it("exposes a createConnector factory (RainbowKit Wallet contract)", () => {
    const wallet = aethelredWallet();
    expect(typeof wallet.createConnector).toBe("function");
  });
});

describe("getAethelredProvider", () => {
  it("returns undefined when the extension is absent", () => {
    expect(getAethelredProvider()).toBeUndefined();
  });

  it("returns the injected provider when present", () => {
    const provider = { isAethelred: true };
    (window as unknown as MutableWindow).aethelred = provider;
    expect(getAethelredProvider()).toBe(provider);
  });
});
