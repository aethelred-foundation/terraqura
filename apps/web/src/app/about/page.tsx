import type { Metadata } from "next";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { AboutContent } from "./content";

export const metadata: Metadata = {
  title: "Company | TerraQura",
  description:
    "Meet TerraQura's trust layer for climate markets: independent governance, deep technical expertise, and a globally distributed team.",
  openGraph: {
    title: "Company | TerraQura",
    description:
      "Meet TerraQura's trust layer for climate markets: independent governance, deep technical expertise, and a globally distributed team.",
  },
};

export default function AboutPage() {
  return (
    <>
      <Navbar />
      <main id="main-content" className="min-h-screen bg-midnight-950 pt-20">
        <AboutContent />
      </main>
      <Footer />
    </>
  );
}
