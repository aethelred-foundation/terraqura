import type { Metadata } from "next";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { TechnologyContent } from "./content";

export const metadata: Metadata = {
  title: "Technology | TerraQura",
  description:
    "Transparent verification architecture for facility telemetry, satellite observation, environmental data, provenance, security, and APIs.",
  openGraph: {
    title: "Technology | TerraQura",
    description:
      "Transparent verification architecture for facility telemetry, satellite observation, environmental data, provenance, security, and APIs.",
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
