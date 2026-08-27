"use client";

import Link from "next/link";

import { TerraQuraLogoFull } from "@/components/ui/TerraQuraLogo";

const links = [
  { href: "/dashboard", label: "Workbench" },
  { href: "/dashboard#market", label: "Marketplace" },
  { href: "/technology", label: "Architecture" },
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
  { href: "/cookies", label: "Cookies" },
];

export function Footer() {
  return (
    <footer className="border-t border-white/[0.06] bg-[#020408]">
      <div className="mx-auto grid max-w-[1400px] gap-8 px-5 py-10 sm:px-8 lg:grid-cols-[1fr_auto] lg:items-end lg:px-10">
        <div>
          <Link href="/dashboard" aria-label="TerraQura workbench">
            <TerraQuraLogoFull imageHeight={38} />
          </Link>
          <p className="mt-4 max-w-xl text-sm leading-6 text-white/50">
            Carbon operations on Aethelred testnet: project registration,
            measured evidence, verification, issuance, exchange, and permanent
            retirement.
          </p>
        </div>
        <nav className="flex flex-wrap gap-x-5 gap-y-3" aria-label="Footer">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-xs uppercase tracking-[0.12em] text-white/45 hover:text-emerald-300"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
      <div className="border-t border-white/[0.06] px-5 py-4 text-center text-xs text-white/30">
        © {new Date().getFullYear()} TerraQura. Controlled testnet operations;
        not an environmental or investment claim.
      </div>
    </footer>
  );
}
