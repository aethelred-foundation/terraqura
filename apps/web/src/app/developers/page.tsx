import type { Metadata } from "next";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { DevelopersContent } from "./content";

export const metadata: Metadata = {
  title: "Developers | API Docs, SDK & Smart Contracts",
  description:
    "Build on TerraQura. RESTful API, GraphQL, TypeScript SDK, and verified smart contract documentation. Integrate carbon credits into your application.",
  openGraph: {
    title: "Developers | Build on TerraQura",
    description: "API documentation, TypeScript SDK, and smart contract integration guides.",
  },
};

export default function DevelopersPage() {
  return (
    <>
      <Navbar />
      <main id="main-content" className="min-h-screen bg-midnight-950 pt-20">
        <DevelopersContent />
      </main>
      <Footer />
    </>
  );
}
