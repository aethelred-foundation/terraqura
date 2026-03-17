import type { Metadata } from "next";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { TechnologyContent } from "./content";

export const metadata: Metadata = {
  title: "Technology | Proof-of-Physics Engine",
  description:
    "Building the TerraQura Proof-of-Physics verification engine with IoT sensors, mathematical validation, and ERC-1155 token minting on Aethelred. Try our interactive physics simulator.",
  openGraph: {
    title: "Technology | TerraQura Proof-of-Physics Engine",
    description: "Three-phase verification: Capture, Compute, Mint. Try the interactive simulator.",
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
