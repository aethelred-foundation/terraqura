import type { Metadata } from "next";
import { homeFaqs } from "@/components/home/faqs";
import { HomeReferencePage } from "@/components/marketing/HomeReferencePage";
import { JsonLd } from "@/components/shared/JsonLd";
import { websiteSchema, productSchema, faqPageSchema } from "@/lib/jsonld";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

export default function Home() {
  return (
    <>
      <JsonLd id="ld-website" data={websiteSchema()} />
      <JsonLd id="ld-product" data={productSchema()} />
      <JsonLd
        id="ld-faq"
        data={faqPageSchema(
          homeFaqs.map((f) => ({ question: f.q, answer: f.a })),
        )}
      />
      <HomeReferencePage />
    </>
  );
}
