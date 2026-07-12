import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { CookieBanner } from "@/components/ui/CookieBanner";
import { JsonLd } from "@/components/shared/JsonLd";
import { organizationSchema } from "@/lib/jsonld";

// Enhanced SEO Metadata
export const metadata: Metadata = {
  metadataBase: new URL("https://terraqura.aethelred.network"),
  title: {
    default: "TerraQura | Engineered Carbon Truth | Decentralized Carbon Removal Platform",
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
  authors: [{ name: "TerraQura", url: "https://terraqura.aethelred.network" }],
  creator: "TerraQura",
  publisher: "TerraQura",
  category: "Technology",
  classification: "Carbon Removal, Climate Tech, Blockchain",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://terraqura.aethelred.network",
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
    canonical: "https://terraqura.aethelred.network",
    languages: {
      "en-US": "https://terraqura.aethelred.network",
    },
  },
  manifest: "/site.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
    shortcut: [{ url: "/favicon.svg" }],
  },
  other: {
    "msapplication-TileColor": "#050810",
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className="dark"
      suppressHydrationWarning
    >
      <head>
        {/* Performance hints */}
        <meta name="format-detection" content="telephone=no" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="TerraQura" />
      </head>
      <body className="font-sans bg-midnight-950 text-white antialiased overflow-x-hidden">
        <JsonLd id="ld-organization" data={organizationSchema()} />
        <Providers>{children}</Providers>
        <CookieBanner />
      </body>
    </html>
  );
}
