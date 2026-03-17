import type { Metadata } from "next";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { EnterpriseContent } from "./content";

export const metadata: Metadata = {
  title: "Enterprise Solutions | Automated ESG Compliance",
  description:
    "Purchase verified carbon credits with automated ESG reporting, fiat on-ramp, and gasless blockchain settlement. Built for sustainability officers, ESG teams, and sovereign wealth funds.",
  openGraph: {
    title: "Enterprise Solutions | TerraQura",
    description: "Automated ESG compliance. Fiat on-ramp. Gasless settlement. Built for the enterprise.",
  },
};

export default function EnterprisePage() {
  return (
    <>
      <Navbar />
      <main id="main-content" className="min-h-screen bg-midnight-950 pt-20">
        <EnterpriseContent />
      </main>
      <Footer />
    </>
  );
}
