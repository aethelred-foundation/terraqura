import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";
import { Providers } from "./providers";
import { CookieBanner } from "@/components/ui/CookieBanner";
import { TERRAQURA_PUBLIC_URL } from "@/lib/publicUrl";

// Enhanced SEO Metadata
export const metadata: Metadata = {
  metadataBase: new URL(TERRAQURA_PUBLIC_URL),
  title: {
    default:
      "TerraQura | Engineered Carbon Truth | Decentralized Carbon Removal Platform",
    template: "%s | TerraQura",
  },
  description:
    "Building the first verification infrastructure for physical carbon removal. Proof-of-Physics verification, on-chain transparency, sovereign blockchain. Designed for enterprise carbon credit buyers, DAC operators, and institutional investors.",
  keywords: [
    "carbon credits",
    "carbon removal",
    "direct air capture",
    "DAC",
    "blockchain carbon credits",
    "ERC-1155",
    "Aethelred",
    "sovereign blockchain",
    "proof of physics",
    "carbon verification",
    "ADGM",
    "ESG compliance",
    "carbon offset",
    "climate tech",
    "carbon marketplace",
    "sustainability",
    "net zero",
    "carbon registry",
    "voluntary carbon market",
    "carbon negative",
    "climate finance",
    "green technology",
    "Abu Dhabi",
    "UAE",
  ],
  authors: [{ name: "TerraQura", url: TERRAQURA_PUBLIC_URL }],
  creator: "TerraQura",
  publisher: "TerraQura",
  category: "Technology",
  classification: "Carbon Removal, Climate Tech, Blockchain",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: TERRAQURA_PUBLIC_URL,
    siteName: "TerraQura",
    title: "TerraQura | Engineered Carbon Truth",
    description:
      "Building the first verification infrastructure for physical carbon removal. Powered by on-chain physics, verified by math, designed for the enterprise.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "TerraQura - Engineered Carbon Truth",
        type: "image/png",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: "@terraqura",
    title: "TerraQura | Engineered Carbon Truth",
    description:
      "Building the first verification infrastructure for physical carbon removal. Proof-of-Physics verification on a sovereign blockchain.",
    creator: "@terraqura",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  alternates: {
    canonical: TERRAQURA_PUBLIC_URL,
    languages: {
      "en-US": TERRAQURA_PUBLIC_URL,
    },
  },
  manifest: "/site.webmanifest",
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
    shortcut: [{ url: "/favicon.svg" }],
  },
  other: {
    "msapplication-TileColor": "#050810",
    "msapplication-config": "/browserconfig.xml",
  },
};

// Viewport configuration
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#050810" },
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
  ],
  colorScheme: "dark",
};

// JSON-LD Structured Data
const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "TerraQura",
  url: TERRAQURA_PUBLIC_URL,
  logo: {
    "@type": "ImageObject",
    url: `${TERRAQURA_PUBLIC_URL}/logo.png`,
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

const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "TerraQura",
  url: TERRAQURA_PUBLIC_URL,
  potentialAction: {
    "@type": "SearchAction",
    target: {
      "@type": "EntryPoint",
      urlTemplate: `${TERRAQURA_PUBLIC_URL}/search?q={search_term_string}`,
    },
    "query-input": "required name=search_term_string",
  },
};

const productJsonLd = {
  "@context": "https://schema.org",
  "@type": "Product",
  name: "TerraQura Carbon Verification Platform",
  description:
    "Decentralized verification infrastructure for physical carbon removal with Proof-of-Physics validation",
  brand: {
    "@type": "Brand",
    name: "TerraQura",
  },
  manufacturer: {
    "@type": "Organization",
    name: "TerraQura",
  },
  category: "Climate Technology",
  applicationCategory: "Blockchain, Carbon Markets",
  operatingSystem: "Web-based",
  offers: {
    "@type": "Offer",
    availability: "https://schema.org/InStock",
    validFrom: "2026-07-01",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        {/* Structured Data */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(organizationJsonLd),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }}
        />

        {/* Performance hints */}
        <meta name="format-detection" content="telephone=no" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta
          name="apple-mobile-web-app-status-bar-style"
          content="black-translucent"
        />
        <meta name="apple-mobile-web-app-title" content="TerraQura" />
      </head>
      <body className="font-sans bg-midnight-950 text-white antialiased overflow-x-hidden">
        <Providers>{children}</Providers>
        <CookieBanner />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
