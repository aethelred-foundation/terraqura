import Link from "next/link";
import type { Metadata } from "next";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";

export const metadata: Metadata = {
  title: "Page Not Found",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <>
      <Navbar />
      <main id="main-content" className="min-h-screen bg-midnight-950 flex items-center">
        <div className="container mx-auto px-6 sm:px-8 lg:px-10 py-32 text-center">
          <p className="text-emerald-400/70 text-sm font-data uppercase tracking-[0.2em] mb-6">
            404 - Off-Chain
          </p>
          <h1 className="text-display-lg lg:text-display-xl text-white mb-6">
            This page can&apos;t be verified.
          </h1>
          <p className="text-lg text-white/70 max-w-2xl mx-auto font-body leading-relaxed mb-10">
            The route you requested isn&apos;t in our pipeline. Head back to the homepage
            or explore the protocol.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 text-base font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl transition-all shadow-lg shadow-emerald-600/20"
            >
              Return Home
            </Link>
            <Link
              href="/technology"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 text-base font-semibold text-white/80 border border-white/10 hover:border-white/20 rounded-xl transition-all"
            >
              Explore the Protocol
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
