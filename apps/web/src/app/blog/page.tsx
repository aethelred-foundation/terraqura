import type { Metadata } from "next";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { BlogContent } from "./content";

export const metadata: Metadata = {
  title: "Insights | TerraQura",
  description:
    "Data, research, and market perspectives from TerraQura for credible carbon markets.",
  openGraph: {
    title: "Insights | TerraQura",
    description:
      "Data, research, and market perspectives from TerraQura for credible carbon markets.",
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
