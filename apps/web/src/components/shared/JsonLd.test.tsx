import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { JsonLd } from "./JsonLd";

describe("JsonLd", () => {
  it("renders a script tag with type=application/ld+json", () => {
    const html = renderToStaticMarkup(
      <JsonLd id="ld-test" data={{ "@type": "Organization", name: "TerraQura" }} />
    );
    expect(html).toContain('<script id="ld-test"');
    expect(html).toContain('type="application/ld+json"');
  });

  it("escapes < and > characters to avoid breaking out of the script tag", () => {
    const html = renderToStaticMarkup(
      <JsonLd
        id="ld-escape"
        data={{ description: "Has <script> and </script> tokens" }}
      />
    );
    // The literal `<script>` MUST NOT appear unescaped inside the JSON.
    // Our safeStringify should encode them as Unicode escapes.
    const inner = html.substring(html.indexOf(">") + 1, html.lastIndexOf("<"));
    expect(inner).not.toContain("<script>");
    expect(inner).not.toContain("</script>");
    expect(inner).toContain("\\u003c");
  });
});
