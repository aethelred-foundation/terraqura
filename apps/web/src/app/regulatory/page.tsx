import type { Metadata } from "next";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { RegulatoryContent } from "./content";

export const metadata: Metadata = {
  title: "Regulatory Compliance | ADGM Framework & Compliance",
  description:
    "TerraQura's regulatory framework, ADGM compliance approach, KYC/AML procedures, and important disclaimers regarding carbon credit tokens.",
  openGraph: {
    title: "Regulatory Compliance | TerraQura",
    description:
      "Our approach to regulatory compliance, ADGM frameworks, and important legal disclaimers.",
  },
};

export default function RegulatoryPage() {
  return (
    <>
      <Navbar />
      <main id="main-content" className="min-h-screen bg-midnight-950 pt-20">
        <RegulatoryContent />
      </main>
      <Footer />
    </>
  );
}
