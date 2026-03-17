"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence, useScroll, useTransform } from "framer-motion";
import { TerraQuraLogoFull } from "@/components/ui/TerraQuraLogo";
import { ArrowRight } from "lucide-react";

const navLinks = [
  { href: "/technology", label: "Protocol" },
  { href: "/solutions/enterprise", label: "Enterprises" },
  { href: "/solutions/suppliers", label: "Operators" },
  { href: "/explorer", label: "Explorer" },
  { href: "/projects", label: "Projects" },
  { href: "/investor", label: "Investors" },
  { href: "/about", label: "About" },
];

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [, setScrolled] = useState(false);

  const { scrollY } = useScroll();
  // Navbar always has a solid dark background so content never bleeds through.
  // On scroll, it deepens slightly and gains a subtle bottom border.
  const headerBg = useTransform(scrollY, [0, 80], ["rgba(5, 8, 16, 0.95)", "rgba(5, 8, 16, 1)"]);
  const headerBlur = useTransform(scrollY, [0, 80], [12, 24]);
  const headerBorder = useTransform(scrollY, [0, 80], ["rgba(255, 255, 255, 0)", "rgba(255, 255, 255, 0.06)"]);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  return (
    <>
      <a href="#main-content" className="fixed -top-full left-4 z-[100] px-4 py-2 bg-[#047857] text-white rounded-lg text-sm font-medium transition-all focus:top-4">
        Skip to main content
      </a>

      <motion.header
        style={{
          backgroundColor: headerBg,
          backdropFilter: useTransform(headerBlur, (v) => `blur(${v}px)`),
          borderBottomColor: headerBorder,
        }}
        className="fixed top-0 left-0 right-0 z-50 border-b"
        role="banner"
      >
        <div className="mx-auto max-w-[1400px] px-5 sm:px-8 lg:px-10">
          <div className="flex items-center justify-between h-[72px] lg:h-20">
            {/* Logo */}
            <Link href="/" className="flex items-center group" aria-label="TerraQura - Home">
              <motion.div whileHover={{ scale: 1.02 }} transition={{ type: "spring", stiffness: 400, damping: 17 }}>
                <TerraQuraLogoFull imageHeight={44} />
              </motion.div>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden lg:flex items-center gap-0.5" aria-label="Primary navigation">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="relative px-4 py-2 text-[13px] font-medium text-white/60 hover:text-white transition-colors duration-200 rounded-lg hover:bg-white/[0.04] uppercase tracking-wider"
                >
                  {link.label}
                </Link>
              ))}
            </nav>

            {/* CTA + Mobile Toggle */}
            <div className="flex items-center gap-3">
              <Link
                href="/solutions/enterprise"
                className="hidden sm:inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-[#047857] hover:bg-[#065f46] rounded-xl transition-all duration-200 shadow-lg shadow-[#047857]/20 hover:shadow-[#047857]/30"
              >
                Book a Demo
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>

              <button
                onClick={() => setMobileOpen(!mobileOpen)}
                className="lg:hidden relative w-10 h-10 flex items-center justify-center rounded-xl text-white/70 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] transition-colors"
                aria-expanded={mobileOpen}
                aria-label="Toggle navigation menu"
              >
                <div className="w-5 h-4 flex flex-col justify-between">
                  <motion.span className="block h-0.5 bg-current rounded-full" animate={{ rotate: mobileOpen ? 45 : 0, y: mobileOpen ? 7 : 0 }} transition={{ duration: 0.2 }} />
                  <motion.span className="block h-0.5 bg-current rounded-full" animate={{ opacity: mobileOpen ? 0 : 1 }} transition={{ duration: 0.15 }} />
                  <motion.span className="block h-0.5 bg-current rounded-full" animate={{ rotate: mobileOpen ? -45 : 0, y: mobileOpen ? -7 : 0 }} transition={{ duration: 0.2 }} />
                </div>
              </button>
            </div>
          </div>
        </div>
      </motion.header>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={false}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 lg:hidden"
            role="dialog"
            aria-modal="true"
          >
            <div className="absolute inset-0 bg-[#050810]/98 backdrop-blur-2xl" role="button" tabIndex={0} aria-label="Close menu" onClick={() => setMobileOpen(false)} onKeyDown={(e) => { if (e.key === 'Escape' || e.key === 'Enter') setMobileOpen(false); }} />
            <nav className="relative flex flex-col items-center justify-center h-full gap-1 px-6">
              {navLinks.map((link, i) => (
                <motion.div
                  key={link.href}
                  initial={false}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 + i * 0.04, duration: 0.3 }}
                >
                  <Link
                    href={link.href}
                    onClick={() => setMobileOpen(false)}
                    className="block text-2xl font-medium text-white/70 hover:text-white py-3.5 px-6 transition-colors rounded-xl hover:bg-white/[0.04] uppercase tracking-wider"
                  >
                    {link.label}
                  </Link>
                </motion.div>
              ))}
              <motion.div
                initial={false}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 + navLinks.length * 0.04, duration: 0.3 }}
                className="mt-8"
              >
                <Link
                  href="/solutions/enterprise"
                  onClick={() => setMobileOpen(false)}
                  className="inline-flex items-center gap-2.5 px-8 py-4 text-lg font-semibold text-white bg-[#047857] rounded-xl shadow-lg shadow-[#047857]/20"
                >
                  Book a Demo
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </motion.div>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
