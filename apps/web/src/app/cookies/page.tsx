import type { Metadata } from "next";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { CookiesContent } from "./content";

export const metadata: Metadata = {
  title: "Cookie Policy | How We Use Cookies",
  description:
    "Understand how TerraQura uses cookies and similar technologies to enhance your experience on our carbon credit verification platform.",
  openGraph: {
    title: "Cookie Policy | TerraQura",
    description:
      "How TerraQura uses cookies and tracking technologies on our platform.",
  },
};

export default function CookiesPage() {
  return (
    <>
      <Navbar />
      <main id="main-content" className="min-h-screen bg-midnight-950 pt-20">
        <CookiesContent />
      </main>
      <Footer />
    </>
  );
}
