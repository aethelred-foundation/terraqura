import type { Metadata } from "next";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { ProjectsContent } from "./content";

export const metadata: Metadata = {
  title: "Projects | TerraQura",
  description:
    "Explore high-integrity carbon projects verified at scale across countries, project types, and evidence-backed portfolios.",
  openGraph: {
    title: "Projects | TerraQura",
    description:
      "Explore high-integrity carbon projects verified at scale across countries, project types, and evidence-backed portfolios.",
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
