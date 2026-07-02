import type { MetadataRoute } from "next";
import { articles } from "./blog/articles";

const BASE_URL = "https://terraqura.aethelred.network";

const staticRoutes: Array<{
  path: string;
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
  priority: number;
}> = [
  { path: "/", changeFrequency: "weekly", priority: 1.0 },
  { path: "/about", changeFrequency: "monthly", priority: 0.8 },
  { path: "/technology", changeFrequency: "monthly", priority: 0.9 },
  { path: "/solutions/enterprise", changeFrequency: "monthly", priority: 0.9 },
  { path: "/solutions/suppliers", changeFrequency: "monthly", priority: 0.8 },
  { path: "/buyer", changeFrequency: "monthly", priority: 0.8 },
  { path: "/operator", changeFrequency: "monthly", priority: 0.8 },
  { path: "/investor", changeFrequency: "monthly", priority: 0.7 },
  { path: "/projects", changeFrequency: "monthly", priority: 0.8 },
  { path: "/explorer", changeFrequency: "daily", priority: 0.7 },
  { path: "/developers", changeFrequency: "monthly", priority: 0.7 },
  { path: "/blog", changeFrequency: "weekly", priority: 0.7 },
  { path: "/regulatory", changeFrequency: "monthly", priority: 0.5 },
  { path: "/privacy", changeFrequency: "yearly", priority: 0.3 },
  { path: "/terms", changeFrequency: "yearly", priority: 0.3 },
  { path: "/cookies", changeFrequency: "yearly", priority: 0.3 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const staticEntries: MetadataRoute.Sitemap = staticRoutes.map((route) => ({
    url: `${BASE_URL}${route.path}`,
    lastModified: now,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));

  const blogEntries: MetadataRoute.Sitemap = articles.map((article) => ({
    url: `${BASE_URL}/blog/${article.slug}`,
    lastModified: new Date(article.date),
    changeFrequency: "yearly",
    priority: 0.6,
  }));

  return [...staticEntries, ...blogEntries];
}
