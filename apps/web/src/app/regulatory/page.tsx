import type { Metadata } from "next";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { RegulatoryContent } from "./content";

export const metadata: Metadata = {
  title: "Regulatory | TerraQura",
  description:
    "TerraQura aligns carbon market infrastructure with evolving standards, policy frameworks, compliance tools, and audit readiness.",
  openGraph: {
    title: "Regulatory | TerraQura",
    description:
      "TerraQura aligns carbon market infrastructure with evolving standards, policy frameworks, compliance tools, and audit readiness.",
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
