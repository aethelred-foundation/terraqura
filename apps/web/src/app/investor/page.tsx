import type { Metadata } from "next";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { InvestorContent } from "./content";

export const metadata: Metadata = {
  title: "For Investors | TerraQura",
  description:
    "Underwrite integrity with portfolio pipeline visibility, due diligence signals, market confidence, and performance data.",
  alternates: { canonical: "/investor" },
  openGraph: {
    title: "For Investors | TerraQura",
    description:
      "Underwrite integrity with portfolio pipeline visibility, due diligence signals, market confidence, and performance data.",
    url: "/investor",
    type: "website",
  },
  twitter: {
    title: "For Investors | TerraQura",
    description:
      "Underwrite integrity with portfolio pipeline visibility and performance data.",
  },
};

export default function InvestorPage() {
  return (
    <>
      <Navbar />
      <main id="main-content" className="min-h-screen bg-midnight-950 pt-20">
        <InvestorContent />
      </main>
      <Footer />
    </>
  );
}
