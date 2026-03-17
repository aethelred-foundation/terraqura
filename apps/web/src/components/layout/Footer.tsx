"use client";

import Link from "next/link";
import { TerraQuraLogoFull } from "@/components/ui/TerraQuraLogo";
import { ArrowRight, MapPin, Calendar, Mail, Linkedin, Facebook, Instagram, MessageCircle } from "lucide-react";

// Custom X (formerly Twitter) icon - Lucide doesn't ship one yet
function XIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

interface FooterLink {
  label: string;
  href: string;
  external?: boolean;
}

interface FooterSection {
  title: string;
  links: FooterLink[];
}

const footerSections: FooterSection[] = [
  {
    title: "Platform",
    links: [
      { href: "/technology", label: "Technology" },
      { href: "/explorer", label: "Network Explorer" },
      { href: "/solutions/enterprise", label: "For Enterprises" },
      { href: "/solutions/suppliers", label: "For Suppliers" },
    ],
  },
  {
    title: "Resources",
    links: [
      { href: "/developers", label: "API Documentation" },
      { href: "/about", label: "About Us" },
      { href: "/about#roadmap", label: "Roadmap" },
      { href: "/blog", label: "Blog" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/privacy", label: "Privacy Policy" },
      { href: "/terms", label: "Terms of Service" },
      { href: "/regulatory", label: "Regulatory" },
      { href: "/cookies", label: "Cookie Policy" },
    ],
  },
];

const socialLinks = [
  { label: "X", href: "https://x.com/terraqura", icon: XIcon },
  { label: "LinkedIn", href: "https://linkedin.com/company/terraqura", icon: Linkedin },
  { label: "Facebook", href: "https://facebook.com/terraqura", icon: Facebook },
  { label: "Instagram", href: "https://instagram.com/terraqura", icon: Instagram },
  { label: "Discord", href: "https://discord.gg/terraqura", icon: MessageCircle },
];

export function Footer() {
  return (
    <footer className="relative bg-[#020408] border-t border-white/[0.06]" role="contentinfo">
      {/* CTA Banner */}
      <div className="border-b border-white/[0.06]">
        <div className="mx-auto max-w-[1400px] px-5 sm:px-8 lg:px-10 py-16 lg:py-20">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-display-sm font-display text-white mb-5 tracking-tight">
              Building the future of{" "}
              <span className="text-gradient-emerald">carbon verification</span>
            </h2>
            <p className="text-body text-white/70 mb-10 max-w-3xl mx-auto font-body leading-relaxed">
              Join the pilot program for the first physics-verified carbon credit infrastructure.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link href="/solutions/enterprise" className="inline-flex items-center justify-center gap-2 px-7 py-3.5 text-[15px] font-semibold text-white bg-[#10b981] hover:bg-[#059669] rounded-xl transition-all duration-200 shadow-lg shadow-[#10b981]/20 hover:shadow-[#10b981]/30">
                Book a Demo
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link href="/explorer" className="inline-flex items-center justify-center gap-2 px-7 py-3.5 text-[15px] font-semibold text-white/80 hover:text-white border border-white/10 hover:border-white/20 bg-white/[0.02] hover:bg-white/[0.04] rounded-xl transition-all duration-200">
                Explore Architecture
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Main Footer */}
      <div className="mx-auto max-w-[1400px] px-5 sm:px-8 lg:px-10 py-12 lg:py-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16">
          {/* Brand Column */}
          <div className="lg:col-span-4">
            <Link href="/" className="inline-block mb-5">
              <TerraQuraLogoFull imageHeight={40} />
            </Link>
            <p className="text-white/70 text-[15px] leading-relaxed mb-6 max-w-xs font-body">
              Building the first verification infrastructure for physical carbon removal, powered by Proof-of-Physics.
            </p>
            <div className="flex flex-col gap-2.5 mb-5">
              <div className="inline-flex items-center gap-2.5 text-white/70 text-sm">
                <MapPin className="w-4 h-4 text-emerald-500/70" />
                <span>Abu Dhabi, UAE</span>
              </div>
              <div className="inline-flex items-center gap-2.5 text-white/70 text-sm">
                <Calendar className="w-4 h-4 text-emerald-500/70" />
                <span>Launching Q3 2026</span>
              </div>
            </div>
            <a href="mailto:hello@terraqura.com" className="inline-flex items-center gap-2 text-emerald-500/70 hover:text-emerald-400 text-sm transition-colors font-medium">
              <Mail className="w-4 h-4" />
              hello@terraqura.com
            </a>
          </div>

          {/* Links Grid */}
          <div className="lg:col-span-8">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-8 lg:gap-12">
              {footerSections.map((section) => (
                <div key={section.title}>
                  <h3 className="text-white font-semibold text-sm mb-4 uppercase tracking-wider">
                    {section.title}
                  </h3>
                  <ul className="space-y-3">
                    {section.links.map((link) => (
                      <li key={link.href}>
                        {link.external ? (
                          <a
                            href={link.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-white/45 hover:text-emerald-400 text-sm transition-colors duration-200 inline-flex items-center gap-1"
                          >
                            {link.label}
                          </a>
                        ) : (
                          <Link
                            href={link.href}
                            className="text-white/45 hover:text-emerald-400 text-sm transition-colors duration-200 inline-flex items-center gap-1"
                          >
                            {link.label}
                          </Link>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="border-t border-white/[0.06]">
        <div className="mx-auto max-w-[1400px] px-5 sm:px-8 lg:px-10 py-5">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <p className="text-white/30 text-sm">
              &copy; {new Date().getFullYear()} TerraQura. A Zhyra Holdings venture. All rights reserved.
            </p>
            <div className="flex items-center gap-2">
              {socialLinks.map((social) => (
                <a
                  key={social.label}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-9 h-9 rounded-lg bg-white/[0.03] hover:bg-emerald-500/10 border border-white/[0.06] hover:border-emerald-500/25 flex items-center justify-center text-white/55 hover:text-emerald-400 transition-all duration-200"
                  aria-label={social.label}
                >
                  <social.icon className="w-4 h-4" />
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
