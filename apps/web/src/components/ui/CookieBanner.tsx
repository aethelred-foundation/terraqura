"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { X, Cookie } from "lucide-react";

const COOKIE_CONSENT_KEY = "terraqura_cookie_consent";

export function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem(COOKIE_CONSENT_KEY);
    if (!consent) {
      const timer = setTimeout(() => setVisible(true), 1500);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, []);

  function accept() {
    localStorage.setItem(COOKIE_CONSENT_KEY, "accepted");
    setVisible(false);
  }

  function decline() {
    localStorage.setItem(COOKIE_CONSENT_KEY, "declined");
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[60] p-4 sm:p-6 pointer-events-none">
      <div className="max-w-2xl mx-auto pointer-events-auto">
        <div className="relative rounded-2xl bg-[#0c1220]/95 backdrop-blur-xl border border-white/[0.08] shadow-2xl shadow-black/40 p-5 sm:p-6">
          {/* Close button */}
          <button
            onClick={decline}
            className="absolute top-3 right-3 w-7 h-7 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] flex items-center justify-center text-white/40 hover:text-white/70 transition-colors"
            aria-label="Dismiss cookie notice"
          >
            <X className="w-3.5 h-3.5" />
          </button>

          <div className="flex items-start gap-4">
            <div className="hidden sm:flex w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 items-center justify-center flex-shrink-0 mt-0.5">
              <Cookie className="w-5 h-5 text-emerald-400" />
            </div>

            <div className="flex-1 min-w-0">
              <h3 className="text-white font-semibold text-sm mb-1.5">
                We use cookies
              </h3>
              <p className="text-white/55 text-sm leading-relaxed mb-4">
                We use essential cookies to make our site work and analytics cookies to understand how you interact with it. Read our{" "}
                <Link href="/cookies" className="text-emerald-400 hover:text-emerald-300 underline underline-offset-2 transition-colors">
                  Cookie Policy
                </Link>{" "}
                for details.
              </p>

              <div className="flex items-center gap-2.5">
                <button
                  onClick={accept}
                  className="px-5 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors shadow-lg shadow-emerald-500/15"
                >
                  Accept All
                </button>
                <button
                  onClick={decline}
                  className="px-5 py-2 text-sm font-medium text-white/60 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] hover:border-white/[0.12] rounded-lg transition-all"
                >
                  Essential Only
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
