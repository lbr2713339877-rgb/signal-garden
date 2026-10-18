import { TODAY_LIMIT } from "@/lib/edition";
import { RANKING_ZH_SHORT } from "@/lib/site";

export const FEED_CONTENT_TYPE = "application/rss+xml; charset=utf-8";

export interface FeedItemInput {
  name: string;
  slug: string;
  oneLiner?: string | null;
  hook?: string | null;
  description?: string | null;
}

export interface FeedItem {
  title: string;
  link: string;
  description: string;
  pubDate: Date;
  guid: string;
}

export interface FeedChannel {
  title: string;
  link: string;
  self: string;
  description: string;
  language: string;
  lastBuildDate: Date;
  items: FeedItem[];
}

/** Lead of the newest published edition first. Every item shares that edition's publish time. */
export function toFeedChannel(input: {
  origin: string;
  date: string | null;
  publishedAt: Date | null;
  cards: FeedItemInput[];
  now?: Date;
}): FeedChannel {
  const origin = input.origin.replace(/\/+$/, "");
  const publishedAt = input.publishedAt ?? input.now ?? new Date();
  const cards = input.cards.slice(0, TODAY_LIMIT);
  return {
    title: "Signal Garden — 今日信号",
    link: `${origin}/?utm_source=rss`,
    self: `${origin}/feed.xml`,
    description: `每天从公开信号里筛出值得打开的开发者项目。${RANKING_ZH_SHORT}。`,
    language: "zh-CN",
    lastBuildDate: publishedAt,
    items: cards.map((card) => {
      const path = `${origin}/p/${encodeURIComponent(card.slug)}`;
      return {
        title: card.name,
        link: `${path}?utm_source=rss`, // guid stays the bare path so readers keep deduping
        description: summary(card),
        pubDate: publishedAt,
        guid: input.date ? `${path}#${input.date}` : path,
      };
    }),
  };
}

export function renderRss(channel: FeedChannel): string {
  const items = channel.items.slice(0, TODAY_LIMIT).map((item) => `    <item>
      <title>${xml(item.title)}</title>
      <link>${xml(item.link)}</link>
      <guid isPermaLink="false">${xml(item.guid)}</guid>
      <pubDate>${item.pubDate.toUTCString()}</pubDate>
      <description>${xml(item.description)}</description>
    </item>`).join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${xml(channel.title)}</title>
    <link>${xml(channel.link)}</link>
    <atom:link href="${xml(channel.self)}" rel="self" type="application/rss+xml"/>
    <description>${xml(channel.description)}</description>
    <language>${xml(channel.language)}</language>
    <lastBuildDate>${channel.lastBuildDate.toUTCString()}</lastBuildDate>
${items}
  </channel>
</rss>
`;
}

function summary(card: FeedItemInput): string {
  const text = [card.oneLiner, card.hook, card.description].find((value) => value && value.trim());
  return (text ?? card.name).trim();
}

function xml(value: string): string {
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
