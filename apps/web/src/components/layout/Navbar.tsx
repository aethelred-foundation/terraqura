"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AnimatePresence,
  motion,
  useScroll,
  useTransform,
} from "framer-motion";
import FocusTrap from "focus-trap-react";
import { ArrowRight, Hexagon, Menu, X } from "lucide-react";

const navLinks = [
  { href: "/technology", label: "Platform" },
  { href: "/solutions/enterprise", label: "Solutions" },
  { href: "/projects", label: "Projects" },
  { href: "/blog", label: "Resources" },
  { href: "/about", label: "Company" },
];

function BrandMark() {
  return (
    <span className="inline-flex items-center gap-2.5">
      <span className="relative flex h-7 w-7 items-center justify-center text-emerald-300">
        <Hexagon className="h-7 w-7" strokeWidth={1.7} />
        <span className="absolute h-2.5 w-2.5 rounded-[2px] border border-emerald-300/70" />
      </span>
      <span className="font-display text-lg font-semibold leading-none text-white">
        TerraQura
      </span>
    </span>
  );
}

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { scrollY } = useScroll();
  const headerBg = useTransform(
    scrollY,
    [0, 80],
    ["rgba(2, 5, 9, 0.94)", "rgba(2, 5, 9, 0.99)"],
  );
  const headerBorder = useTransform(
    scrollY,
    [0, 80],
    ["rgba(255, 255, 255, 0.08)", "rgba(255, 255, 255, 0.13)"],
  );

  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
      document.querySelectorAll("main, footer").forEach((el) => {
        el.setAttribute("inert", "");
      });
    } else {
      document.body.style.overflow = "";
      document.querySelectorAll("main, footer").forEach((el) => {
        el.removeAttribute("inert");
      });
    }

    return () => {
      document.body.style.overflow = "";
      document.querySelectorAll("main, footer").forEach((el) => {
        el.removeAttribute("inert");
      });
    };
  }, [mobileOpen]);

  useEffect(() => {
    if (!mobileOpen) return;

    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [mobileOpen]);

  return (
    <>
      <a
        href="#main-content"
        className="fixed -top-full left-4 z-[100] rounded-md bg-emerald-500 px-4 py-2 text-sm font-medium text-[#020408] transition-all focus:top-4"
      >
        Skip to main content
      </a>

      <motion.header
        style={{ backgroundColor: headerBg, borderBottomColor: headerBorder }}
        className="fixed inset-x-0 top-0 z-50 border-b backdrop-blur-xl"
        role="banner"
      >
        <div className="mx-auto max-w-[1680px] px-3 sm:px-5">
          <div className="flex h-16 items-center justify-between gap-4">
            <Link
              href="/"
              aria-label="TerraQura - Home"
              className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70"
            >
              <BrandMark />
            </Link>

            <nav
              className="hidden items-center gap-8 lg:flex"
              aria-label="Primary navigation"
            >
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-[12px] font-medium leading-none text-white/[0.68] transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70"
                >
                  {link.label}
                </Link>
              ))}
            </nav>

            <div className="flex items-center gap-3">
              <Link
                href="/dashboard"
                className="hidden text-[12px] font-medium text-white/70 transition-colors hover:text-white sm:inline-flex"
              >
                Sign in
              </Link>
              <Link
                href="/solutions/enterprise"
                className="hidden items-center justify-center gap-2 rounded-md border border-emerald-400/[0.45] bg-emerald-400/[0.08] px-4 py-2 text-[12px] font-semibold text-emerald-200 transition-all hover:border-emerald-300 hover:bg-emerald-400/[0.14] hover:text-white sm:inline-flex"
              >
                Request access
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>

              <button
                type="button"
                onClick={() => setMobileOpen((open) => !open)}
                className="flex h-10 w-10 items-center justify-center rounded-md border border-white/10 bg-white/[0.035] text-white/75 transition-colors hover:bg-white/[0.07] hover:text-white lg:hidden"
                aria-expanded={mobileOpen}
                aria-label="Toggle navigation menu"
              >
                <Menu className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </motion.header>

      <AnimatePresence>
        {mobileOpen ? (
          <FocusTrap
            focusTrapOptions={{
              clickOutsideDeactivates: true,
              escapeDeactivates: true,
              onDeactivate: () => setMobileOpen(false),
              initialFocus: "#mobile-nav-close",
            }}
          >
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="fixed inset-0 z-50 lg:hidden"
              role="dialog"
              aria-modal="true"
              aria-label="Mobile navigation"
            >
              <button
                type="button"
                aria-label="Close menu"
                tabIndex={-1}
                className="absolute inset-0 bg-[#020509]/98 backdrop-blur-2xl"
                onClick={() => setMobileOpen(false)}
              />

              <nav className="relative flex h-full flex-col px-5 py-5">
                <div className="flex items-center justify-between border-b border-white/10 pb-5">
                  <Link
                    href="/"
                    onClick={() => setMobileOpen(false)}
                    aria-label="TerraQura - Home"
                    className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70"
                  >
                    <BrandMark />
                  </Link>
                  <button
                    id="mobile-nav-close"
                    type="button"
                    onClick={() => setMobileOpen(false)}
                    aria-label="Close menu"
                    className="flex h-10 w-10 items-center justify-center rounded-md border border-white/10 bg-white/[0.035] text-white/75 transition-colors hover:bg-white/[0.07] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="grid flex-1 content-center gap-2">
                  {navLinks.map((link, i) => (
                    <motion.div
                      key={link.href}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.04 + i * 0.035, duration: 0.22 }}
                    >
                      <Link
                        href={link.href}
                        onClick={() => setMobileOpen(false)}
                        className="block rounded-lg border border-white/[0.08] bg-white/[0.025] px-5 py-4 text-xl font-medium text-white/[0.78] transition-colors hover:border-emerald-300/30 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70"
                      >
                        {link.label}
                      </Link>
                    </motion.div>
                  ))}
                </div>

                <div className="grid gap-3 border-t border-white/10 pt-5 sm:grid-cols-2">
                  <Link
                    href="/dashboard"
                    onClick={() => setMobileOpen(false)}
                    className="inline-flex items-center justify-center rounded-md border border-white/10 bg-white/[0.035] px-5 py-3 text-sm font-semibold text-white/[0.76]"
                  >
                    Sign in
                  </Link>
                  <Link
                    href="/solutions/enterprise"
                    onClick={() => setMobileOpen(false)}
                    className="inline-flex items-center justify-center gap-2 rounded-md border border-emerald-400/[0.45] bg-emerald-400/[0.12] px-5 py-3 text-sm font-semibold text-emerald-100"
                  >
                    Request access
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </nav>
            </motion.div>
          </FocusTrap>
        ) : null}
      </AnimatePresence>
    </>
  );
}
