import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Hero } from "@/components/home/Hero";
import { LiveTicker } from "@/components/home/LiveTicker";
import { ProblemSolution } from "@/components/home/ProblemSolution";
import { ProofEngine } from "@/components/home/ProofEngine";
import { Features } from "@/components/home/Features";
import { Solutions } from "@/components/home/Solutions";
import { Ecosystem } from "@/components/home/Ecosystem";
import { EnterpriseMarquee } from "@/components/home/EnterpriseMarquee";
import { FAQ } from "@/components/home/FAQ";

export default function Home() {
  return (
    <>
      <Navbar />
      <main id="main-content" className="min-h-screen bg-midnight-950">
        <Hero />
        <LiveTicker />
        <ProblemSolution />
        <ProofEngine />
        <Features />
        <Solutions />
        <Ecosystem />
        <EnterpriseMarquee />
        <FAQ />
      </main>
      <Footer />
    </>
  );
}
