import type { Metadata } from "next";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { ProjectsContent } from "./content";

export const metadata: Metadata = {
  title: "Projects | DAC Project Development Pipeline | TerraQura",
  description:
    "Explore TerraQura's Direct Air Capture project development pipeline. Partner with us to build, instrument, and verify carbon removal facilities worldwide.",
  openGraph: {
    title: "Projects | DAC Project Development Pipeline | TerraQura",
    description:
      "Explore TerraQura's Direct Air Capture project development pipeline. Partner with us to build, instrument, and verify carbon removal facilities worldwide.",
  },
};

export default function ProjectsPage() {
  return (
    <>
      <Navbar />
      <main id="main-content" className="min-h-screen bg-midnight-950 pt-20">
        <ProjectsContent />
      </main>
      <Footer />
    </>
  );
}
