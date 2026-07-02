import { describe, it, expect } from "vitest";
import {
  organizationSchema,
  websiteSchema,
  productSchema,
  blogPostingSchema,
  faqPageSchema,
  breadcrumbListSchema,
} from "./jsonld";

describe("jsonld schema builders", () => {
  it("organizationSchema declares the right shape", () => {
    const s = organizationSchema();
    expect(s["@context"]).toBe("https://schema.org");
    expect(s["@type"]).toBe("Organization");
    expect(s.name).toBe("TerraQura");
    expect(s.url).toMatch(/^https:\/\//);
  });

  it("websiteSchema does NOT include a SearchAction (no /search route)", () => {
    const s = websiteSchema();
    expect(s["@type"]).toBe("WebSite");
    expect(s).not.toHaveProperty("potentialAction");
  });

  it("productSchema does not declare a fixed validFrom date", () => {
    // The original layout.tsx had a hardcoded validFrom of 2026-07-01 that
    // would silently rot. Make sure we don't reintroduce it.
    const s = productSchema();
    expect(s["@type"]).toBe("Product");
    expect(s).not.toHaveProperty("offers");
  });

  it("blogPostingSchema includes mainEntityOfPage and a publisher logo", () => {
    const s = blogPostingSchema({
      slug: "my-post",
      title: "My Post",
      description: "A post",
      datePublished: "2026-02-27T00:00:00.000Z",
      author: "TerraQura Research",
    });
    expect(s["@type"]).toBe("BlogPosting");
    expect(s.headline).toBe("My Post");
    expect(s.mainEntityOfPage).toMatchObject({
      "@type": "WebPage",
      "@id": expect.stringContaining("/blog/my-post"),
    });
    expect(s.publisher).toMatchObject({
      logo: { "@type": "ImageObject" },
    });
  });

  it("faqPageSchema converts entries into FAQ Questions", () => {
    const s = faqPageSchema([
      { question: "Q1?", answer: "A1." },
      { question: "Q2?", answer: "A2." },
    ]);
    expect(s["@type"]).toBe("FAQPage");
    expect(s.mainEntity).toHaveLength(2);
    expect(s.mainEntity[0]).toMatchObject({
      "@type": "Question",
      name: "Q1?",
      acceptedAnswer: { "@type": "Answer", text: "A1." },
    });
  });

  it("breadcrumbListSchema produces 1-indexed positions", () => {
    const s = breadcrumbListSchema([
      { name: "Home", path: "/" },
      { name: "Blog", path: "/blog" },
      { name: "Post", path: "/blog/post" },
    ]);
    expect(s["@type"]).toBe("BreadcrumbList");
    expect(s.itemListElement).toHaveLength(3);
    expect(s.itemListElement[0]).toMatchObject({ position: 1, name: "Home" });
    expect(s.itemListElement[2]).toMatchObject({ position: 3, name: "Post" });
  });
});
