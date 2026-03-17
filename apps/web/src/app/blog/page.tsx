import type { Metadata } from "next";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { BlogContent } from "./content";

export const metadata: Metadata = {
  title: "Blog | Carbon Market Insights & Research",
  description:
    "Technical deep dives, industry analysis, and research on carbon verification, blockchain infrastructure, Direct Air Capture, and the future of climate markets. By TerraQura Research.",
  openGraph: {
    title: "Blog | TerraQura Carbon Market Insights & Research",
    description:
      "Technical deep dives, industry analysis, and research on carbon verification and climate markets.",
  },
};

export default function BlogPage() {
  return (
    <>
      <Navbar />
      <main id="main-content" className="min-h-screen bg-midnight-950 pt-20">
        <BlogContent />
      </main>
      <Footer />
    </>
  );
}
