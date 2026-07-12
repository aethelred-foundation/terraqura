"use client";

import { useEffect, useState } from "react";
import Script from "next/script";

/**
 * Self-hosted, cookieless web analytics (replaces Vercel Analytics).
 *
 * Wired for a self-hosted Umami instance — no third-party SaaS, no cookies,
 * no cross-site tracking. The script is loaded only when:
 *   1. the analytics host + website id are configured via env, AND
 *   2. the visitor has accepted analytics in the cookie banner.
 *
 * Env (public — the script host is not a secret):
 *   NEXT_PUBLIC_ANALYTICS_SRC         e.g. https://analytics.aethelred.network/script.js
 *   NEXT_PUBLIC_ANALYTICS_WEBSITE_ID  the Umami website UUID
 *
 * If the env is unset (dev / CI / preview), this renders nothing.
 */

const CONSENT_KEY = "terraqura_cookie_consent";
const CONSENT_EVENT = "terraqura:consent";

function hasAnalyticsConsent(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(CONSENT_KEY) === "accepted";
  } catch {
    return false;
  }
}

export function SelfHostedAnalytics() {
  const src = process.env.NEXT_PUBLIC_ANALYTICS_SRC;
  const websiteId = process.env.NEXT_PUBLIC_ANALYTICS_WEBSITE_ID;
  const [consented, setConsented] = useState(false);

  useEffect(() => {
    setConsented(hasAnalyticsConsent());

    // React to consent changes in this tab (banner dispatches CONSENT_EVENT)
    // and in other tabs (storage event).
    const onConsent = () => setConsented(hasAnalyticsConsent());
    window.addEventListener(CONSENT_EVENT, onConsent);
    window.addEventListener("storage", onConsent);
    return () => {
      window.removeEventListener(CONSENT_EVENT, onConsent);
      window.removeEventListener("storage", onConsent);
    };
  }, []);

  // Not configured, or consent not granted → do not load the tracker.
  if (!src || !websiteId || !consented) {
    return null;
  }

  return (
    <Script
      src={src}
      data-website-id={websiteId}
      strategy="afterInteractive"
      // Umami is cookieless by default; this keeps it explicit and privacy-first.
      data-do-not-track="true"
    />
  );
}
