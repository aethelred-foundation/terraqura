import type { Metadata } from "next";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { BuyerContent } from "./content";

export const metadata: Metadata = {
  title: "For Buyers | TerraQura",
  description:
    "Confident carbon credit purchases with transparent evidence, risk scoring, portfolio visibility, and audit-ready provenance.",
  alternates: { canonical: "/buyer" },
  openGraph: {
    title: "For Buyers | TerraQura",
    description:
      "Confident carbon credit purchases with transparent evidence, risk scoring, portfolio visibility, and audit-ready provenance.",
    url: "/buyer",
    type: "website",
  },
  twitter: {
    title: "For Buyers | TerraQura",
    description:
      "Confident carbon credit purchases with transparent evidence and audit-ready provenance.",
  },
};

export default function BuyerPage() {
  return (
    <>
      <Navbar />
      <main id="main-content" className="min-h-screen bg-midnight-950 pt-20">
        <BuyerContent />
      </main>
      <Footer />
    </>
  );
}
