import { CONTACT_EMAIL } from "@/lib/site";
import { pageUrl, projectPath } from "@/lib/page-meta";
import { siteOrigin } from "@/lib/edition";

/**
 * Public search lives at `src/app/search/page.tsx` (`?q=`).
 * SearchAction is omitted when this is false.
 */
export const SEARCH_ROUTE_EXISTS = true;

/** Serialize JSON-LD and keep `<` out of the script body (`</script>`). */
export function jsonLdHtml(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

export function organizationJsonLd(origin = siteOrigin()): Record<string, unknown> {
  return {
    "@type": "Organization",
    name: "Signal Garden",
    url: origin,
    email: CONTACT_EMAIL,
  };
}

export function websiteJsonLd(options?: {
  origin?: string;
  search?: boolean;
}): Record<string, unknown> {
  const origin = options?.origin ?? siteOrigin();
  const search = options?.search ?? SEARCH_ROUTE_EXISTS;
  const site: Record<string, unknown> = {
    "@type": "WebSite",
    name: "Signal Garden",
    url: origin,
  };
  if (search) {
    site.potentialAction = {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${origin}/search?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    };
  }
  return site;
}

/** Site-wide graph: WebSite (+ SearchAction when search exists) and Organization. */
export function siteJsonLd(options?: { origin?: string; search?: boolean }): Record<string, unknown> {
  const origin = options?.origin ?? siteOrigin();
  return {
    "@context": "https://schema.org",
    "@graph": [
      websiteJsonLd({ origin, search: options?.search }),
      organizationJsonLd(origin),
    ],
  };
}

export function todayItemList(
  items: { name: string; slug: string }[],
  origin = siteOrigin(),
): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Today",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      url: pageUrl(projectPath(item.slug), origin),
      name: item.name,
    })),
  };
}

/** GitHub repository URL for SoftwareSourceCode.codeRepository, or null. */
export function githubCodeRepository(
  primaryUrl: string | null | undefined,
  fullName?: string | null,
): string | null {
  const raw = primaryUrl?.trim() ?? "";
  if (/github\.com\//i.test(raw)) return raw;
  if (fullName && /^[\w.-]+\/[\w.-]+$/.test(fullName)) {
    return `https://github.com/${fullName}`;
  }
  return null;
}

export function projectJsonLd(input: {
  name: string;
  description: string;
  slug: string;
  codeRepository?: string | null;
  origin?: string;
}): Record<string, unknown> {
  const origin = input.origin ?? siteOrigin();
  const url = pageUrl(projectPath(input.slug), origin);
  const code: Record<string, unknown> = {
    "@type": "SoftwareSourceCode",
    name: input.name,
    description: input.description,
    url,
  };
  if (input.codeRepository) code.codeRepository = input.codeRepository;
  return {
    "@context": "https://schema.org",
    "@graph": [
      code,
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Signal Garden", item: `${origin}/` },
          { "@type": "ListItem", position: 2, name: "Today", item: pageUrl("/today", origin) },
          { "@type": "ListItem", position: 3, name: input.name, item: url },
        ],
      },
    ],
  };
}
