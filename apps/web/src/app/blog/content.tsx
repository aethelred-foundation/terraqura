"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { OptimizedImage } from "@/components/shared/OptimizedImage";
import type { ImageKey } from "@/lib/image-manifest";
import { articles } from "./articles";

const ARTICLE_IMAGES: Record<string, ImageKey> = {
  "what-is-proof-of-physics": "proof-of-physics",
  "understanding-direct-air-capture": "carbon-removal",
  "why-blockchain-matters-for-carbon-credits": "onchain-carbon-transparency",
  "voluntary-carbon-market-2026": "high-intensity-carbon-market",
  "aethelred-sovereign-blockchain": "sovereign-carbon-ledger",
  "iot-sensor-networks-carbon-monitoring": "sensor-field-network",
  "enterprise-carbon-procurement-guide": "regulator-ready-audit-trail",
  "economics-of-carbon-removal": "institutional-climate-finance",
  "smart-contract-architecture-carbon-tokenization": "proof-cahin",
  "abu-dhabi-climate-tech-vision": "uae-climate",
};

const filters = ["AI", "Research", "Product", "Market", "Policy"];

export function BlogContent() {
  const featured = articles[0];

  if (!featured) {
    return null;
  }

  const featuredImage = ARTICLE_IMAGES[featured.slug] ?? "mrv-data-river";

  return (
    <div className="bg-[#020509] px-3 pb-4 text-white sm:px-5">
      <div className="mx-auto max-w-[1680px] overflow-hidden rounded-lg border border-white/10 bg-[#03070b]">
        <section
          className="relative grid min-h-[460px] gap-8 overflow-hidden border-b border-white/10 px-5 py-12 sm:px-8 lg:grid-cols-[0.72fr_1fr] lg:items-center lg:px-10"
          aria-labelledby="blog-heading"
        >
          <div className="absolute inset-0" aria-hidden>
            <OptimizedImage
              src="mrv-data-river"
              alt=""
              fill
              priority
              sizes="100vw"
              className="object-cover opacity-[0.42]"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-[#020509] via-[#020509]/[0.86] to-[#020509]/[0.48]" />
          </div>

          <div className="relative z-10 max-w-xl">
            <h1
              id="blog-heading"
              className="font-display text-4xl leading-tight tracking-normal text-white sm:text-5xl"
            >
              Insights
            </h1>
            <p className="mt-5 text-base leading-relaxed text-white/[0.72]">
              Data, research, and market perspectives.
            </p>
            <Link
              href="#articles"
              className="mt-8 inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-emerald-400 px-5 py-3 text-[13px] font-semibold text-[#03120d] transition-colors hover:bg-emerald-300"
            >
              View all insights
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <Link
            href={`/blog/${featured.slug}`}
            className="group relative z-10 overflow-hidden rounded-lg border border-white/10 bg-[#061017] transition-colors hover:border-emerald-300/[0.32]"
          >
            <div className="relative h-64 border-b border-white/10 sm:h-80">
              <OptimizedImage
                src={featuredImage}
                alt=""
                fill
                sizes="(min-width: 1024px) 50vw, 100vw"
                className="object-cover opacity-90 transition-transform duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#061017] to-transparent" />
            </div>
            <div className="p-5 sm:p-6">
              <div className="mb-4 flex flex-wrap items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-200/80">
                <span>{featured.category}</span>
                <span className="h-1 w-1 rounded-full bg-white/[0.35]" />
                <span>{featured.readingTime}</span>
              </div>
              <h2 className="font-display text-2xl leading-tight text-white">
                {featured.title}
              </h2>
              <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-white/[0.62]">
                {featured.excerpt}
              </p>
            </div>
          </Link>
        </section>

        <div className="flex overflow-x-auto border-b border-white/10 bg-[#03070b]">
          {filters.map((filter, index) => (
            <button
              key={filter}
              type="button"
              className={
                index === 0
                  ? "min-w-fit border-r border-white/10 bg-emerald-400/[0.12] px-7 py-3.5 text-[12px] font-semibold text-emerald-200"
                  : "min-w-fit border-r border-white/10 px-7 py-3.5 text-[12px] font-medium text-white/[0.52] transition-colors hover:bg-white/[0.025] hover:text-white"
              }
            >
              {filter}
            </button>
          ))}
        </div>

        <section id="articles" className="px-5 py-10 sm:px-8 lg:px-10 lg:py-12">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {articles.map((article) => {
              const image = ARTICLE_IMAGES[article.slug] ?? "mrv-data-river";

              return (
                <Link
                  key={article.slug}
                  href={`/blog/${article.slug}`}
                  className="group overflow-hidden rounded-lg border border-white/10 bg-[#061017] transition-colors hover:border-emerald-300/[0.32]"
                >
                  <article className="flex h-full flex-col">
                    <div className="relative h-44 border-b border-white/10">
                      <OptimizedImage
                        src={image}
                        alt=""
                        fill
                        sizes="(min-width: 1280px) 25vw, (min-width: 768px) 50vw, 100vw"
                        className="object-cover opacity-[0.88] transition-transform duration-500 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#061017] to-transparent" />
                    </div>
                    <div className="flex flex-1 flex-col p-5">
                      <div className="mb-4 flex items-center justify-between gap-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/[0.42]">
                        <span className="text-emerald-200/80">
                          {article.category}
                        </span>
                        <span>{article.date}</span>
                      </div>
                      <h2 className="font-display text-lg leading-tight text-white transition-colors group-hover:text-emerald-200">
                        {article.title}
                      </h2>
                      <p className="mt-3 line-clamp-3 flex-1 text-[13px] leading-relaxed text-white/[0.58]">
                        {article.excerpt}
                      </p>
                      <div className="mt-5 flex items-center justify-between border-t border-white/10 pt-4 text-[12px] text-white/[0.46]">
                        <span>{article.readingTime}</span>
                        <span className="inline-flex items-center gap-1 text-emerald-200">
                          Read
                          <ArrowRight className="h-3.5 w-3.5" />
                        </span>
                      </div>
                    </div>
                  </article>
                </Link>
              );
            })}
          </div>
        </section>

        <section className="relative min-h-[210px] overflow-hidden border-t border-white/10 px-5 py-10 sm:px-8 lg:px-10">
          <div className="absolute inset-0" aria-hidden>
            <OptimizedImage
              src="verified-restoration"
              alt=""
              fill
              sizes="100vw"
              className="object-cover opacity-[0.64]"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-[#020509] via-[#020509]/[0.82] to-[#020509]/[0.34]" />
          </div>
          <div className="relative z-10 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="max-w-xl font-display text-2xl leading-tight text-white sm:text-3xl">
              Infrastructure for a credible carbon economy.
            </h2>
            <Link
              href="/solutions/enterprise"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-emerald-400/[0.45] bg-emerald-400/[0.08] px-5 py-3 text-sm font-semibold text-emerald-100 transition-all hover:border-emerald-300 hover:bg-emerald-400/[0.14] hover:text-white"
            >
              Request access
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
