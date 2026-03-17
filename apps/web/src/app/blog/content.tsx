"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { AnimatedSection, StaggerContainer, StaggerItem } from "@/components/shared/AnimatedSection";
import { articles, categoryColors } from "./articles";

export function BlogContent() {
  return (
    <>
      {/* Hero */}
      <section className="relative py-16 sm:py-20 lg:py-24" aria-labelledby="blog-heading">
        <div className="container mx-auto px-6 sm:px-8 lg:px-10">
          <AnimatedSection className="max-w-4xl mx-auto text-center">
            <h1
              id="blog-heading"
              className="text-display-lg lg:text-display-xl text-white mb-6"
            >
              Insights &{" "}
              <span className="text-gradient-emerald">Research</span>
            </h1>
            <p className="text-lg text-white/70 max-w-3xl mx-auto font-body leading-relaxed mb-10">
              Technical deep dives, industry analysis, and original research from the
              TerraQura team on carbon verification methodology, Proof-of-Physics engineering,
              sovereign blockchain infrastructure, Direct Air Capture technology, and the
              rapidly evolving landscape of voluntary and compliance carbon markets.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="#articles"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 text-base font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl transition-all shadow-lg shadow-emerald-600/20"
              >
                Read Latest Articles
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/technology"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 text-base font-semibold text-white/80 border border-white/10 hover:border-white/20 rounded-xl transition-all"
              >
                Explore the Protocol
              </Link>
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* Category filters */}
      <section className="pb-8">
        <div className="container mx-auto px-6 sm:px-8 lg:px-10">
          <div className="flex flex-wrap gap-3 justify-center">
            {(["All", "Technology", "Research", "Industry"] as const).map((cat) => (
              <span
                key={cat}
                className={`px-4 py-1.5 rounded-full text-sm font-medium border cursor-default ${
                  cat === "All"
                    ? "bg-white/[0.06] text-white border-white/[0.1]"
                    : cat === "Technology"
                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                      : cat === "Research"
                        ? "bg-cyan-500/10 text-cyan-400 border-cyan-500/20"
                        : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                }`}
              >
                {cat}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Article Grid */}
      <section className="relative py-8 sm:py-12 lg:py-16" aria-label="Blog articles">
        <div className="container mx-auto px-6 sm:px-8 lg:px-10">
          <StaggerContainer
            className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-7xl mx-auto"
            staggerDelay={0.08}
          >
            {articles.map((article) => (
              <StaggerItem key={article.slug}>
                <Link
                  href={`/blog/${article.slug}`}
                  className="group block h-full"
                >
                  <article className="h-full p-6 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:border-emerald-500/20 transition-all duration-300 hover:bg-white/[0.04] flex flex-col">
                    {/* Category & Meta */}
                    <div className="flex items-center gap-3 mb-4">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                          categoryColors[article.category]
                        }`}
                      >
                        {article.category}
                      </span>
                      <span className="text-xs text-white/40 font-body">
                        {article.readingTime}
                      </span>
                    </div>

                    {/* Title */}
                    <h2 className="text-lg font-bold text-white mb-3 group-hover:text-emerald-400 transition-colors leading-snug">
                      {article.title}
                    </h2>

                    {/* Excerpt */}
                    <p className="text-sm text-white/60 font-body leading-relaxed mb-4 flex-1">
                      {article.excerpt}
                    </p>

                    {/* Tags */}
                    <div className="flex flex-wrap gap-1.5 mb-5">
                      {article.tags.slice(0, 4).map((tag) => (
                        <span
                          key={tag}
                          className="px-2 py-0.5 rounded text-[11px] font-data text-white/45 bg-white/[0.04] border border-white/[0.06]"
                        >
                          {tag}
                        </span>
                      ))}
                      {article.tags.length > 4 && (
                        <span className="px-2 py-0.5 rounded text-[11px] font-data text-white/30">
                          +{article.tags.length - 4}
                        </span>
                      )}
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-between pt-4 border-t border-white/[0.06]">
                      <span className="text-xs text-white/40 font-body">
                        {article.date}
                      </span>
                      <span className="text-sm text-emerald-400 group-hover:text-emerald-300 transition-colors font-medium">
                        Read more &rarr;
                      </span>
                    </div>
                  </article>
                </Link>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>
      </section>

      {/* Newsletter CTA */}
      <section className="relative py-16 sm:py-20 lg:py-24 bg-midnight-900/30">
        <div className="container mx-auto px-6 sm:px-8 lg:px-10">
          <AnimatedSection className="max-w-2xl mx-auto text-center">
            <h2 className="text-display text-white mb-4">Stay Informed</h2>
            <p className="text-white/70 font-body leading-relaxed mb-8">
              Carbon markets move fast. Get our latest research, technical
              analyses, and industry insights delivered directly to your inbox.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
              <input
                type="email"
                placeholder="your@email.com"
                className="flex-1 px-4 py-3 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white placeholder:text-white/30 font-body text-sm focus:outline-none focus:border-emerald-500/40 transition-colors"
                aria-label="Email address for newsletter"
              />
              <button
                type="button"
                className="px-6 py-3 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-midnight-950 font-semibold text-sm transition-colors"
              >
                Subscribe
              </button>
            </div>
            <p className="text-xs text-white/30 mt-3 font-body">
              No spam. Unsubscribe anytime.
            </p>
          </AnimatedSection>
        </div>
      </section>
    </>
  );
}
