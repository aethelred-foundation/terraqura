import type { Metadata } from "next";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { OperatorContent } from "./content";

export const metadata: Metadata = {
  title: "For Operators | TerraQura",
  description:
    "Operate transparently with facility performance, monitoring, MRV workflows, audit readiness, and credit issuance visibility.",
  alternates: { canonical: "/operator" },
  openGraph: {
    title: "For Operators | TerraQura",
    description:
      "Operate transparently with facility performance, monitoring, MRV workflows, audit readiness, and credit issuance visibility.",
    url: "/operator",
    type: "website",
  },
  twitter: {
    title: "For Operators | TerraQura",
    description:
      "Operate transparently with facility performance and audit readiness.",
  },
};

export default function OperatorPage() {
  return (
    <>
      <Navbar />
      <main id="main-content" className="min-h-screen bg-midnight-950 pt-20">
        <OperatorContent />
      </main>
      <Footer />
    </>
  );
}
