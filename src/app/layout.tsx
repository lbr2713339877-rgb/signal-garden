import type { Metadata, Viewport } from "next";
import { Analytics } from "@/components/analytics/Analytics";
import { LANG_BOOTSTRAP, THEME_BOOTSTRAP } from "@/components/ui/Lang";
import "./globals.css";
import "./v3/tokens.css";

/**
 * Latin display face. Self-hosted by next/font, so there is no render-blocking
 * request to Google and no layout shift.
 */

/**
 * Every number, rank and command in this product is mono and tabular, so
 * digits never change width while a value animates.
 */

/**
 * V3 display face. Instrument Serif is a single-weight serif with a lot of
 * contrast at large sizes, which is what the display-xl scale (up to 240px)
 * needs. Self-hosted for the same reason as the Latin sans.
 */

/**
 * V3 archive mono — the "field notes" voice, used for every measured value in
 * the V3 sections.
 */

/**
 * V3 tokens are imported at the top of this file rather than in the V3 page,
 * so every V3 route has them on a cold load. It is safe to load them globally:
 * every selector in that file is scoped to `.v3-root`, so nothing reaches a V2
 * page. Importing them only from `/` would leave a direct visit to `/p/[slug]`
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
    "Signal Garden 是面向开发者的每日项目发现站：从 GitHub、Hacker News 和公开社区自动筛选新工具、AI Skill、MCP、Agent 与开发资源，帮助你快速判断哪些项目值得打开。",
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
      "每天 5 分钟，从全网噪音里筛出值得打开的开发者项目。",
  },
  openGraph: {
    type: "website",
    locale: "zh_CN",
    alternateLocale: ["en_US"],
    url: SITE_URL,
    siteName: "Signal Garden",
    title: "Signal Garden — 今日信号",
    description:
      "每天 5 分钟，从全网噪音里筛出值得打开的开发者项目。",
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
      className="sg-fonts"
      suppressHydrationWarning
    >
      <head>
        {/* Sets the stored language before first paint, so a returning visitor
            never sees the wrong language flash. */}
        <script dangerouslySetInnerHTML={{ __html: LANG_BOOTSTRAP }} />
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />

        {/* CJK faces are not self-hosted through next/font: the full Noto SC
            families are megabytes, and next/font would inline every subset.
            Google serves them pre-subsetted by unicode-range instead, so a
            Chinese page pulls a few hundred KB of woff2 and an English one
            pulls almost nothing. preconnect keeps the handshake off the
            critical path. */}
        {/* Latin fonts are self-hosted from /public/fonts so local development
            never falls back to system fonts when fonts.gstatic.com is down. */}
        <link rel="stylesheet" href="/fonts/fonts.css" />

        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400;600&family=Noto+Sans+SC:wght@400;500&display=swap"
        />
        {/* WenKai, used only for editorial pull-quotes in the V3 narrative. */}
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/npm/lxgw-wenkai-webfont@1.7.0/style.css"
        />
        <Analytics />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
