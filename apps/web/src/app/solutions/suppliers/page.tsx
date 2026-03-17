import type { Metadata } from "next";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { SuppliersContent } from "./content";

export const metadata: Metadata = {
  title: "For Suppliers | Connect Your DAC Facility",
  description:
    "Connect your Direct Air Capture or biochar facility to the TerraQura Oracle Network. IoT integration, instant verification, and 10x faster time-to-market for verified carbon credits.",
  openGraph: {
    title: "For DAC Suppliers | TerraQura",
    description: "Connect your hardware. Get verified. Access instant liquidity.",
  },
};

export default function SuppliersPage() {
  return (
    <>
      <Navbar />
      <main id="main-content" className="min-h-screen bg-midnight-950 pt-20">
        <SuppliersContent />
      </main>
      <Footer />
    </>
  );
}
