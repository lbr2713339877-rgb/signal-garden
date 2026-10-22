import type { Metadata } from "next";
import { siteOrigin } from "@/lib/edition";
import { firstSentence } from "@/lib/i18n";
import { RANKING_EN_SHORT, RANKING_ZH_SHORT } from "@/lib/site";

/**
 * Root layout sets canonical and openGraph to "/". Next.js replaces those
 * objects per segment instead of merging them, so a page that wants its own
 * URL has to send the full set again.
 */
const RSS_TYPE = { "application/rss+xml": "/feed.xml" } as const;

export function pageUrl(path: string, origin = siteOrigin()): string {
  const base = origin.replace(/\/+$/, "");
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

export function projectPath(slug: string): string {
  return `/p/${encodeURIComponent(slug)}`;
}

function clean(value: string | null | undefined): string {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim();
}

/**
 * The sentence the project page actually shows: Chinese one-liner, then the
 * English one-liner (which already includes the vendor description fallback),
 * then the project name. Never the site-wide homepage blurb.
 */
export function projectBodySummary(input: {
  name?: string | null;
  oneLinerZh?: string | null;
  oneLinerEn?: string | null;
}): string {
  const lead = [input.oneLinerZh, input.oneLinerEn].map(clean).find(Boolean);
  if (lead) return firstSentence(lead);
  const name = clean(input.name);
  return name ? `${name}，Signal Garden 项目页。` : "Signal Garden 项目页。";
}

export function pageMetadata(input: {
  title: string;
  description: string;
  path: string;
  origin?: string;
}): Metadata {
  const url = pageUrl(input.path, input.origin);
  const socialTitle = `${input.title} · Signal Garden`;
  return {
    title: input.title,
    description: input.description,
    alternates: {
      canonical: url,
      languages: { "zh-CN": url, en: url },
      types: RSS_TYPE,
    },
    openGraph: {
      type: "website",
      locale: "zh_CN",
      alternateLocale: ["en_US"],
      siteName: "Signal Garden",
      url,
      title: socialTitle,
      description: input.description,
    },
    twitter: {
      card: "summary_large_image",
      title: socialTitle,
      description: input.description,
    },
  };
}

export function projectPageMetadata(input: {
  slug: string;
  name?: string | null;
  oneLinerZh?: string | null;
  oneLinerEn?: string | null;
  origin?: string;
}): Metadata {
  const name = clean(input.name) || input.slug;
  return pageMetadata({
    title: name,
    description: projectBodySummary({ name, oneLinerZh: input.oneLinerZh, oneLinerEn: input.oneLinerEn }),
    path: projectPath(input.slug),
    origin: input.origin,
  });
}

export const TODAY_DESCRIPTION =
  `今日榜单是当天通过发布门槛的完整推荐：头条在前，其余按排名排列。${RANKING_ZH_SHORT}。`;

export function todayPageMetadata(origin?: string): Metadata {
  return pageMetadata({
    title: "今日 · Today",
    description: TODAY_DESCRIPTION,
    path: "/today",
    origin,
  });
}

/** English share card for /en. Does not replace the Chinese site defaults. */
export const EN_SHARE_TITLE = "Signal Garden — Today's signals";

export const EN_SHARE_DESCRIPTION =
  `Five minutes a day, the developer projects worth opening. ${RANKING_EN_SHORT.charAt(0).toUpperCase()}${RANKING_EN_SHORT.slice(1)}.`;

export function enShareMetadata(origin?: string): Metadata {
  const url = pageUrl("/en", origin);
  return {
    title: { absolute: EN_SHARE_TITLE },
    description: EN_SHARE_DESCRIPTION,
    alternates: {
      canonical: url,
      languages: { "zh-CN": pageUrl("/", origin), en: url },
      types: RSS_TYPE,
    },
    openGraph: {
      type: "website",
      locale: "en_US",
      siteName: "Signal Garden",
      url,
      title: EN_SHARE_TITLE,
      description: EN_SHARE_DESCRIPTION,
    },
    twitter: {
      card: "summary_large_image",
      title: EN_SHARE_TITLE,
      description: EN_SHARE_DESCRIPTION,
    },
  };
}
