/**
 * Bilingual rendering.
 *
 * Deliberately split from the switcher in components/ui/Lang.tsx:
 *
 *   - LANG (here) is a SERVER component. Bilingual text needs no JavaScript —
 *     both languages are rendered and CSS hides one. Making every text node a
 *     client component would ship the whole page's text as a client bundle for
 *     no benefit.
 *   - LangSwitch (client) owns the single piece of interaction: writing one
 *     attribute on <html>.
 *
 * Locale is not a route parameter. Switching is an attribute write, so a page
 * cannot end up half-translated and nothing refetches.
 */

export type Lang = "zh" | "en";

export const DEFAULT_LANG: Lang = "zh";

/** Renders both languages; CSS shows the active one. */
export function LANG({
  zh,
  en,
  as: Tag = "span",
  className,
  style,
  fade = false,
}: {
  zh: React.ReactNode;
  en: React.ReactNode;
  as?: "span" | "p" | "div" | "h1" | "h2" | "h3" | "dt" | "dd" | "li";
  className?: string;
  style?: React.CSSProperties;
  /**
   * 交叉淡入（220ms）而不是硬切。
   *
   * 打开时两种语言会被放进同一个 grid 单元叠放，容器高度取两者较高者，
   * 所以来回切换不会引起布局跳动。代价是这个节点不再是 inline —— 所以
   * 只用于块级文案，不要用在句子中间。
   */
  fade?: boolean;
}) {
  return (
    <Tag className={fade ? `lang-pair ${className ?? ""}` : className} style={style}>
      <span data-lang="zh" {...(fade ? { "data-fade": "" } : {})}>
        {zh}
      </span>
      <span data-lang="en" {...(fade ? { "data-fade": "" } : {})}>
        {en}
      </span>
    </Tag>
  );
}

/** Picks a value for unstyled contexts such as <title> and meta tags. */
export function pick<T>(lang: Lang, zh: T, en: T): T {
  return lang === "en" ? en : zh;
}

/**
 * Text that exists in one language only.
 *
 * Missing copy must never leak the other language into the active mode. If the
 * Chinese row is absent, Chinese readers see a short localized pending state
 * instead of the GitHub English description; if the English row is absent,
 * English readers see the equivalent pending state.
 */
/**
 * One-liners and hooks are meant to be a single sentence. When the model
 * overruns (a 1,700-character paragraph was stored in `one_liner`), rendering it
 * whole turns a card into a wall of text. Cap at the first sentence so the
 * layout stays a "one-liner" by construction.
 */
export function firstSentence(s: string | null): string {
  if (typeof s !== "string") return "";
  const t = s.trim();
  if (!t) return "";
  // Break on CJK full stop, or a Latin sentence end followed by whitespace.
  const m = t.match(/^[\s\S]*?[。！？]|^[\s\S]*?[.!?](?=\s|$)/);
  const one = (m ? m[0] : t).trim();
  return one.length > 160 ? `${one.slice(0, 157).trimEnd()}…` : one;
}

export function Fallback({
  zh,
  en,
  className,
  as,
  /* Accepted for call-site compatibility. The component no longer emits a
     "still generating" placeholder in any case. */
  marker: _marker,
}: {
  zh: string | null;
  en: string | null;
  className?: string;
  /** Block-level callers pass h3/p so margins and max-width still apply. */
  as?: "span" | "p" | "div" | "h1" | "h2" | "h3";
  marker?: boolean;
}) {
  /* A value is usable when it is non-empty. The old check also demanded Han
     characters, which mislabelled legitimate Chinese-side values that are pure
     code (an install hint such as `npm install @node-3d/core`). That produced
     "中文简介生成中" on a project whose Chinese copy was in fact complete. */
  const hasZh = typeof zh === "string" && zh.trim().length > 0;
  const hasEn = typeof en === "string" && en.trim().length > 0;

  if (!hasZh && !hasEn) return null;

  /* Never surface an internal "still generating" marker to readers. A language
     with no copy renders that language empty, so a missing Chinese row never
     leaks English (and vice versa) and never shows "中文简介生成中". */
  if (!hasZh && !hasEn) return null;

  return (
    <LANG
      as={as}
      className={className}
      zh={hasZh ? zh : ""}
      en={hasEn ? en : ""}
    />
  );
}

/** UI strings that are not attached to a project. */
export const UI = {
  todayHeadline: { zh: "今日头条", en: "Today's headline" },
  viewAll: { zh: "查看今日全部", en: "See all of today" },
  rising: { zh: "🔥 飙升上榜", en: "🔥 Rising" },
  viewDetails: { zh: "查看详情", en: "View details" },
  whoUses: { zh: "谁在用", en: "Who uses it" },
  scenarios: { zh: "适用场景", en: "In practice" },
  install: { zh: "怎么装", en: "Install" },
  riskLimits: { zh: "风险与限制", en: "Risk & limits" },
  growth: { zh: "增长", en: "Growth" },
  heat: { zh: "热度", en: "Heat" },
  quality: { zh: "质量", en: "Quality" },
  maintenance: { zh: "维护", en: "Maintenance" },
  security: { zh: "安全", en: "Security" },
  difficulty: { zh: "难度", en: "Setup" },
  sortBy: { zh: "排序", en: "Sort" },
  sortHeat: { zh: "按热度", en: "By heat" },
  sortGrowth: { zh: "按涨幅", en: "By growth" },
  sortNewest: { zh: "按上架时间", en: "By arrival" },
  noResults: { zh: "没有符合条件的内容。", en: "Nothing matches." },
  all: { zh: "全部", en: "All" },
  trackedSince: { zh: "首次追踪", en: "Tracked since" },
  aiNote: {
    zh: "以上说明由 AI 依据 README 与 GitHub 数据生成",
    en: "Generated by AI from the README and GitHub data",
  },
  sampleNote: {
    zh: "以下为示例性使用场景，不是用户评价",
    en: "Illustrative scenarios, not testimonials",
  },
} as const;
