"use client";

import { useEffect } from "react";
import Link from "next/link";

import { reportClientError } from "@/lib/errors";

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    void reportClientError(error, {
      source: "next-route-error",
      digest: error.digest,
    });
  }, [error]);

  return (
    <main className="min-h-screen bg-midnight-950 flex items-center">
      <div className="container mx-auto px-6 sm:px-8 lg:px-10 py-32 text-center">
        <p className="text-amber-400/70 text-sm font-data uppercase tracking-[0.2em] mb-6">
          Verification Failure
        </p>
        <h1 className="text-display lg:text-display-lg text-white mb-6">
          Something didn&apos;t add up.
        </h1>
        <p className="text-lg text-white/70 max-w-2xl mx-auto font-body leading-relaxed mb-10">
          We hit an unexpected error rendering this page. The team has been notified.
          You can try again or head home.
        </p>
        {error.digest && (
          <p className="text-xs text-white/60 font-mono mb-10">Reference: {error.digest}</p>
        )}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center justify-center gap-2 px-8 py-4 text-base font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl transition-all shadow-lg shadow-emerald-600/20"
          >
            Try Again
          </button>
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 px-8 py-4 text-base font-semibold text-white/80 border border-white/10 hover:border-white/20 rounded-xl transition-all"
          >
            Return Home
          </Link>
        </div>
      </div>
    </main>
  );
}
