import type { Metadata } from "next";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { AboutContent } from "./content";

export const metadata: Metadata = {
  title: "About | Mission, Team & Roadmap",
  description:
    "TerraQura is decarbonizing the planet through engineered truth. Learn about our Abu Dhabi roots, global vision, founding team, and roadmap from testnet to institutional adoption.",
  openGraph: {
    title: "About TerraQura | Engineered Carbon Truth",
    description: "Abu Dhabi roots, global vision. From testnet to institutional carbon infrastructure.",
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
