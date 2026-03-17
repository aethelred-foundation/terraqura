import type { Metadata } from "next";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { PrivacyContent } from "./content";

export const metadata: Metadata = {
  title: "Privacy Policy | Data Protection & Your Rights",
  description:
    "Learn how TerraQura collects, uses, and protects your personal data. Compliant with UAE data protection regulations and ADGM frameworks.",
  openGraph: {
    title: "Privacy Policy | TerraQura",
    description:
      "How TerraQura handles your data, your rights, and our commitment to privacy and UAE regulatory compliance.",
  },
};

export default function PrivacyPage() {
  return (
    <>
      <Navbar />
      <main id="main-content" className="min-h-screen bg-midnight-950 pt-20">
        <PrivacyContent />
      </main>
      <Footer />
    </>
  );
}
