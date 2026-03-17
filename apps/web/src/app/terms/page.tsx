import type { Metadata } from "next";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { TermsContent } from "./content";

export const metadata: Metadata = {
  title: "Terms of Service | Platform Usage Agreement",
  description:
    "Terms governing the use of TerraQura's carbon credit verification platform, tokenization services, and marketplace. Governed by ADGM law.",
  openGraph: {
    title: "Terms of Service | TerraQura",
    description:
      "Platform usage agreement for TerraQura's carbon credit verification and tokenization services.",
  },
};

export default function TermsPage() {
  return (
    <>
      <Navbar />
      <main id="main-content" className="min-h-screen bg-midnight-950 pt-20">
        <TermsContent />
      </main>
      <Footer />
    </>
  );
}
