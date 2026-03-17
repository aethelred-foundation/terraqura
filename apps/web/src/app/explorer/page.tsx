import type { Metadata } from "next";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { ExplorerContent } from "./content";

export const metadata: Metadata = {
  title: "Network Explorer | Live Carbon Credit Dashboard",
  description:
    "Real-time view of the TerraQura network. Live carbon credit mints, verification events, contract status, and on-chain metrics. Full transparency, no 'contact us' forms.",
  openGraph: {
    title: "Network Explorer | TerraQura Live Dashboard",
    description: "Real-time carbon credit mints, verifications, and on-chain metrics. Full transparency.",
  },
};

export default function ExplorerPage() {
  return (
    <>
      <Navbar />
      <main id="main-content" className="min-h-screen bg-midnight-950 pt-20">
        <ExplorerContent />
      </main>
      <Footer />
    </>
  );
}
