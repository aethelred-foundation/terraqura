import type { Metadata } from "next";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { TechnologyContent } from "./content";

export const metadata: Metadata = {
  title: "Technology | Proof-of-Physics Engine",
  description:
    "How TerraQura turns measured project evidence into verified, wallet-owned carbon inventory on Aethelred.",
  openGraph: {
    title: "Technology | TerraQura Proof-of-Physics Engine",
    description:
      "Measured evidence, deterministic verification, wallet settlement, and durable audit records.",
  },
};

export default function TechnologyPage() {
  return (
    <>
      <Navbar />
      <main id="main-content" className="min-h-screen bg-midnight-950 pt-20">
        <TechnologyContent />
      </main>
      <Footer />
    </>
  );
}
