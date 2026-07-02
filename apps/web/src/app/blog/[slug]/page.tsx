import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { JsonLd } from "@/components/shared/JsonLd";
import { blogPostingSchema, breadcrumbListSchema } from "@/lib/jsonld";
import { articles, getArticleBySlug } from "../articles";

import { Article1Content } from "./article-1-proof-of-physics";
import { Article2Content } from "./article-2-direct-air-capture";
import { Article3Content } from "./article-3-blockchain-carbon-credits";
import { Article4Content } from "./article-4-voluntary-carbon-market";
import { Article5Content } from "./article-5-aethelred-blockchain";
import { Article6Content } from "./article-6-iot-sensor-networks";
import { Article7Content } from "./article-7-enterprise-procurement";
import { Article8Content } from "./article-8-economics-carbon-removal";
import { Article9Content } from "./article-9-smart-contract-architecture";
import { Article10Content } from "./article-10-abu-dhabi-climate-tech";

const contentMap: Record<string, React.ComponentType> = {
  "what-is-proof-of-physics": Article1Content,
  "understanding-direct-air-capture": Article2Content,
  "why-blockchain-matters-for-carbon-credits": Article3Content,
  "voluntary-carbon-market-2026": Article4Content,
  "aethelred-sovereign-blockchain": Article5Content,
  "iot-sensor-networks-carbon-monitoring": Article6Content,
  "enterprise-carbon-procurement-guide": Article7Content,
  "economics-of-carbon-removal": Article8Content,
  "smart-contract-architecture-carbon-tokenization": Article9Content,
  "abu-dhabi-climate-tech-vision": Article10Content,
};

export function generateStaticParams() {
  return articles.map((article) => ({
    slug: article.slug,
  }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const article = getArticleBySlug(slug);
  if (!article) return {};

  return {
    title: `${article.title} | TerraQura Blog`,
    description: article.excerpt,
    alternates: { canonical: `/blog/${article.slug}` },
    openGraph: {
      title: article.title,
      description: article.excerpt,
      type: "article",
      url: `/blog/${article.slug}`,
      publishedTime: article.date,
      authors: [article.author],
    },
    twitter: {
      title: article.title,
      description: article.excerpt,
    },
  };
}

export default async function ArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const article = getArticleBySlug(slug);
  if (!article) notFound();

  const ContentComponent = contentMap[slug];
  if (!ContentComponent) notFound();

  return (
    <>
      <JsonLd
        id={`ld-blogposting-${article.slug}`}
        data={blogPostingSchema({
          slug: article.slug,
          title: article.title,
          description: article.excerpt,
          datePublished: new Date(article.date).toISOString(),
          author: article.author,
        })}
      />
      <JsonLd
        id={`ld-breadcrumb-${article.slug}`}
        data={breadcrumbListSchema([
          { name: "Home", path: "/" },
          { name: "Blog", path: "/blog" },
          { name: article.title, path: `/blog/${article.slug}` },
        ])}
      />
      <Navbar />
      <main id="main-content" className="min-h-screen bg-midnight-950 pt-20">
        <ContentComponent />
        {/* Tags */}
        {article.tags.length > 0 && (
          <section className="pb-16 sm:pb-20 lg:pb-24">
            <div className="container mx-auto px-6 sm:px-8 lg:px-10 max-w-4xl">
              <div className="pt-8 border-t border-white/[0.06]">
                <h3 className="text-xs font-data text-white/40 uppercase tracking-widest mb-4">Tags</h3>
                <div className="flex flex-wrap gap-2">
                  {article.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-3 py-1 rounded-lg text-xs font-data text-white/50 bg-white/[0.03] border border-white/[0.06] hover:border-white/10 transition-colors"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </section>
        )}
      </main>
      <Footer />
    </>
  );
}
