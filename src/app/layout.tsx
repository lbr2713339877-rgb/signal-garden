import type { Metadata, Viewport } from "next";
import { Analytics } from "@/components/analytics/Analytics";
import { AttributionCapture } from "@/components/subscribe/AttributionCapture";
import { JsonLd } from "@/components/seo/JsonLd";
import { LANG_BOOTSTRAP, THEME_BOOTSTRAP } from "@/components/ui/Lang";
import { siteOrigin } from "@/lib/edition";
import { SEARCH_ROUTE_EXISTS, siteJsonLd } from "@/lib/jsonld";
import { RANKING_ZH_SHORT } from "@/lib/site";
import { fontVariableClassName } from "./fonts";
import "./globals.css";
import "./(site)/v3/tokens.css";

/**
 * Every face is self-hosted by next/font (see ./fonts.ts). The @font-face
 * rules are merged into the app CSS with font-display: swap. There is no
 * stylesheet request to Google Fonts or jsDelivr, and LXGW WenKai Mono is
 * not loaded.
 *
 * V3 tokens are imported here rather than in the V3 page, so every V3 route
 * has them on a cold load. It is safe to load them globally: every selector
 * in that file is scoped to `.v3-root`, so nothing reaches a V2 page.
 * Importing them only from `/` would leave a direct visit to `/p/[slug]`
 * unstyled.
 */
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Signal Garden — 今日信号",
    template: "%s · Signal Garden",
  },
  description:
    `Signal Garden 是面向开发者的每日项目发现站：从 GitHub、Hacker News 和公开社区自动筛选新工具、AI Skill、MCP、Agent 与开发资源，帮助你快速判断哪些项目值得打开。${RANKING_ZH_SHORT}。`,
  alternates: {
    canonical: "/",
    languages: {
      "zh-CN": "/",
      en: "/",
    },
    types: {
      "application/rss+xml": "/feed.xml",
    },
  },
  keywords: [
    "Signal Garden",
    "developer tools",
    "AI tools",
    "AI agents",
    "MCP",
    "developer discovery",
    "open source projects",
  ],
  twitter: {
    card: "summary_large_image",
    title: "Signal Garden",
    description:
      `每天 5 分钟，从全网噪音里筛出值得打开的开发者项目。${RANKING_ZH_SHORT}。`,
  },
  openGraph: {
    type: "website",
    locale: "zh_CN",
    alternateLocale: ["en_US"],
    url: SITE_URL,
    siteName: "Signal Garden",
    title: "Signal Garden — 今日信号",
    description:
      `每天 5 分钟，从全网噪音里筛出值得打开的开发者项目。${RANKING_ZH_SHORT}。`,
  },
};

export const viewport: Viewport = {
  themeColor: "#030303",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="zh-CN"
      data-lang="zh"
      data-theme="dark"
      className={`sg-fonts ${fontVariableClassName}`}
      suppressHydrationWarning
    >
      <head>
        {/* Sets the stored language before first paint, so a returning visitor
            never sees the wrong language flash. */}
        <script dangerouslySetInnerHTML={{ __html: LANG_BOOTSTRAP }} />
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
        <Analytics />
        <JsonLd data={siteJsonLd({ origin: siteOrigin(SITE_URL), search: SEARCH_ROUTE_EXISTS })} />
      </head>
      <body className="antialiased">
        <AttributionCapture />
        {children}
      </body>
    </html>
  );
}
