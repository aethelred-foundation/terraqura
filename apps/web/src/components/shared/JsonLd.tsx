interface JsonLdProps {
  id: string;
  data: Record<string, unknown> | Record<string, unknown>[];
}

/**
 * Renders a JSON-LD <script> for structured data.
 *
 * Safety: `data` MUST be a static, server-side object - never user input.
 * `JSON.stringify` escapes `<`, `>`, and `&` we add manually below to
 * prevent any chance of breaking out of the <script> tag, even though
 * React renders it as a text child (not via dangerouslySetInnerHTML).
 */
function safeStringify(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
}

export function JsonLd({ id, data }: JsonLdProps) {
  return (
    <script id={id} type="application/ld+json">
      {safeStringify(data)}
    </script>
  );
}
