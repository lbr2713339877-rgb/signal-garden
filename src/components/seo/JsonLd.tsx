import { jsonLdHtml } from "@/lib/jsonld";

/** Server-rendered JSON-LD. `<` is escaped so a value cannot close the script. */
export function JsonLd({ data }: { data: unknown }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: jsonLdHtml(data) }}
    />
  );
}
