import { CONTACT_EMAIL, GITHUB_REPO_URL, RANKING_ZH_SHORT } from "@/lib/site";
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
    logo: {
      "@type": "ImageObject",
      url: pageUrl("/logo-email.png", origin),
    },
    sameAs: [GITHUB_REPO_URL],
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
    description: RANKING_ZH_SHORT,
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

export function todayListName(date?: string | null): string {
  const value = typeof date === "string" ? date.slice(0, 10) : "";
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? `Signal Garden — Today ${value}` : "Signal Garden — Today";
}

export function todayItemList(
  items: { name: string; slug: string }[],
  origin = siteOrigin(),
  date?: string | null,
): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: todayListName(date),
    description: RANKING_ZH_SHORT,
    url: pageUrl("/today", origin),
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

function textOrNull(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || /^(unknown|none|n\/a|noassertion)$/i.test(trimmed)) return null;
  return trimmed;
}

export function projectJsonLd(input: {
  name: string;
  description: string;
  slug: string;
  codeRepository?: string | null;
  origin?: string;
  programmingLanguage?: string | null;
  license?: string | null;
  author?: string | null;
  forks7d?: number | null;
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
  const language = textOrNull(input.programmingLanguage);
  if (language) code.programmingLanguage = language;
  const license = textOrNull(input.license);
  if (license) code.license = license;
  const author = textOrNull(input.author);
  if (author) {
    const person: Record<string, unknown> = { "@type": "Person", name: author };
    if (/^[\w.-]+$/.test(author)) person.url = `https://github.com/${author}`;
    code.author = person;
  }
  if (typeof input.forks7d === "number" && Number.isFinite(input.forks7d)) {
    code.additionalProperty = {
      "@type": "PropertyValue",
      name: "7-day new forks",
      value: Math.trunc(input.forks7d),
    };
  }
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
