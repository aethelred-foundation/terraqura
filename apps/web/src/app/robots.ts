import type { MetadataRoute } from "next";

const BASE_URL = "https://terraqura.aethelred.network";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Dapp surfaces are not useful entry points from search:
        // - /dashboard requires a wallet to mean anything
        // - /api is internal
        disallow: ["/dashboard/", "/api/"],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
    host: BASE_URL,
  };
}
