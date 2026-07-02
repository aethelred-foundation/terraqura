/**
 * Centralized JSON-LD schema builders.
 * Every helper returns a plain object for use with <JsonLd data={...} />.
 */

const SITE_URL = "https://terraqura.aethelred.network";

export function organizationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "TerraQura",
    url: SITE_URL,
    logo: {
      "@type": "ImageObject",
      url: `${SITE_URL}/logo.png`,
      width: 512,
      height: 512,
    },
    description:
      "Building the first verification infrastructure for physical carbon removal. Powered by on-chain physics, verified by math, designed for the enterprise.",
    foundingDate: "2024",
    foundingLocation: {
      "@type": "Place",
      name: "Abu Dhabi, UAE",
      address: {
        "@type": "PostalAddress",
        addressLocality: "Abu Dhabi",
        addressCountry: "AE",
      },
    },
    sameAs: [
      "https://twitter.com/terraqura",
      "https://linkedin.com/company/terraqura",
      "https://github.com/terraqura",
      "https://discord.gg/terraqura",
    ],
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "sales",
      email: "hello@terraqura.com",
      availableLanguage: ["English"],
    },
    areaServed: "Worldwide",
    knowsAbout: [
      "Carbon Removal",
      "Direct Air Capture",
      "Blockchain Technology",
      "Carbon Credits",
      "ESG Compliance",
      "Climate Technology",
    ],
  };
}

export function websiteSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "TerraQura",
    url: SITE_URL,
    publisher: { "@type": "Organization", name: "TerraQura" },
    inLanguage: "en",
  };
}

export function productSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: "TerraQura Carbon Verification Platform",
    description:
      "Decentralized verification infrastructure for physical carbon removal with Proof-of-Physics validation",
    brand: { "@type": "Brand", name: "TerraQura" },
    manufacturer: { "@type": "Organization", name: "TerraQura" },
    category: "Climate Technology",
    applicationCategory: "Blockchain, Carbon Markets",
    operatingSystem: "Web-based",
  };
}

interface BlogPostInput {
  slug: string;
  title: string;
  description: string;
  datePublished: string;
  author: string;
  imagePath?: string;
}

export function blogPostingSchema(post: BlogPostInput) {
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.description,
    datePublished: post.datePublished,
    author: { "@type": "Organization", name: post.author },
    publisher: {
      "@type": "Organization",
      name: "TerraQura",
      logo: { "@type": "ImageObject", url: `${SITE_URL}/logo.png` },
    },
    image: `${SITE_URL}${post.imagePath ?? "/og-image.png"}`,
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `${SITE_URL}/blog/${post.slug}`,
    },
  };
}

interface FaqEntry {
  question: string;
  answer: string;
}

export function faqPageSchema(faqs: FaqEntry[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: { "@type": "Answer", text: f.answer },
    })),
  };
}

interface BreadcrumbItem {
  name: string;
  path: string;
}

export function breadcrumbListSchema(items: BreadcrumbItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, idx) => ({
      "@type": "ListItem",
      position: idx + 1,
      name: item.name,
      item: `${SITE_URL}${item.path}`,
    })),
  };
}
