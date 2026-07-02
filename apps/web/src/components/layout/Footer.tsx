"use client";

import Link from "next/link";
import {
  ArrowRight,
  Facebook,
  Hexagon,
  Instagram,
  Linkedin,
  MessageCircle,
} from "lucide-react";

function XIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

const footerSections = [
  {
    title: "Platform",
    links: [
      { href: "/technology", label: "Technology" },
      { href: "/explorer", label: "Data sources" },
      { href: "/security", label: "Security" },
      { href: "/developers", label: "Integrations" },
    ],
  },
  {
    title: "Solutions",
    links: [
      { href: "/buyer", label: "For Buyers" },
      { href: "/operator", label: "For Operators" },
      { href: "/investor", label: "For Investors" },
      { href: "/regulatory", label: "For Regulators" },
    ],
  },
  {
    title: "Resources",
    links: [
      { href: "/developers", label: "Documentation" },
      { href: "/blog", label: "Blog" },
      { href: "/developers", label: "API" },
      { href: "/projects", label: "Projects" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "/about", label: "About" },
      { href: "/about#careers", label: "Careers" },
      { href: "/blog", label: "News" },
      { href: "/about#contact", label: "Contact" },
    ],
  },
];

const socialLinks = [
  {
    label: "LinkedIn",
    href: "https://linkedin.com/company/terraqura",
    icon: Linkedin,
  },
  { label: "X", href: "https://x.com/terraqura", icon: XIcon },
  {
    label: "YouTube",
    href: "https://youtube.com/@terraqura",
    icon: MessageCircle,
  },
  {
    label: "Instagram",
    href: "https://instagram.com/terraqura",
    icon: Instagram,
  },
  { label: "Facebook", href: "https://facebook.com/terraqura", icon: Facebook },
];

function FooterBrand() {
  return (
    <span className="inline-flex items-center gap-2.5">
      <span className="relative flex h-8 w-8 items-center justify-center text-emerald-300">
        <Hexagon className="h-8 w-8" strokeWidth={1.7} />
        <span className="absolute h-3 w-3 rounded-[2px] border border-emerald-300/70" />
      </span>
      <span className="font-display text-xl font-semibold leading-none text-white">
        TerraQura
      </span>
    </span>
  );
}

export function Footer() {
  return (
    <footer
      className="bg-[#020509] px-3 pb-4 text-white sm:px-5"
      role="contentinfo"
    >
      <div className="mx-auto max-w-[1680px] overflow-hidden rounded-lg border border-white/10 bg-[#03070b]">
        <div className="grid gap-10 border-b border-white/10 px-5 py-8 sm:px-8 lg:grid-cols-[1fr_1.55fr] lg:px-10">
          <div>
            <Link
              href="/"
              aria-label="TerraQura - Home"
              className="inline-flex"
            >
              <FooterBrand />
            </Link>
            <p className="mt-5 max-w-xs text-sm leading-relaxed text-white/[0.58]">
              The verification infrastructure for a credible carbon economy.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              {socialLinks.map((social) => (
                <a
                  key={social.label}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={social.label}
                  className="flex h-8 w-8 items-center justify-center rounded-md border border-white/10 bg-white/[0.025] text-white/[0.54] transition-all hover:border-emerald-300/[0.35] hover:text-emerald-200"
                >
                  <social.icon className="h-3.5 w-3.5" />
                </a>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
            {footerSections.map((section) => (
              <div key={section.title}>
                <h3 className="text-[12px] font-semibold text-white/90">
                  {section.title}
                </h3>
                <ul className="mt-4 space-y-2.5">
                  {section.links.map((link) => (
                    <li key={`${section.title}-${link.href}-${link.label}`}>
                      <Link
                        href={link.href}
                        className="text-[12px] leading-relaxed text-white/[0.48] transition-colors hover:text-emerald-200"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-4 border-b border-white/10 px-5 py-4 text-[12px] text-white/[0.46] sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-10">
          <p>
            &copy; {new Date().getFullYear()} TerraQura. All rights reserved.
          </p>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <Link
              href="/privacy"
              className="transition-colors hover:text-white"
            >
              Privacy
            </Link>
            <Link href="/terms" className="transition-colors hover:text-white">
              Terms
            </Link>
            <Link
              href="/security"
              className="transition-colors hover:text-white"
            >
              Security
            </Link>
            <span className="inline-flex items-center gap-2 text-emerald-200/75">
              <span className="h-1.5 w-1.5 rounded-full border border-emerald-300" />
              SOC 2 Type II
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-10">
          <p className="font-display text-lg text-white sm:text-xl">
            Infrastructure for a credible carbon economy.
          </p>
          <Link
            href="/solutions/enterprise"
            className="inline-flex items-center justify-center gap-2 rounded-md border border-emerald-400/[0.45] bg-emerald-400/[0.08] px-5 py-3 text-sm font-semibold text-emerald-100 transition-all hover:border-emerald-300 hover:bg-emerald-400/[0.14] hover:text-white"
          >
            Request access
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </footer>
  );
}
