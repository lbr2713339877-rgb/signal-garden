/**
 * Category metadata. This is the single source of truth that the database
 * enum, the CSS tokens and the UI all agree on.
 *
 * `key` must exist in:
 *   - the `category` pg enum in src/db/schema.ts
 *   - the [data-category="..."] block in src/app/tokens.css
 *
 * `intents` maps the homepage's "Explore by Intent" entries onto categories —
 * the homepage deliberately does not lead with technical taxonomy.
 */

import type { Category } from "@/db/schema";

export interface CategoryMeta {
  key: Category;
  /** Latin label used as the page kicker. */
  label: string;
  /** Chinese name. */
  name: string;
  /** One human sentence, used under the category page title. */
  tagline: string;
  /** CSS token name, for reference and for the styleguide. */
  cssVar: string;
  /** Where this renders on the homepage intent section. */
  intents: string[];
}

export const CATEGORIES: CategoryMeta[] = [
  {
    key: "skill",
    label: "SKILL / MCP",
    name: "Skill 与 MCP",
    tagline: "可以直接装进 Agent 的能力。",
    cssVar: "--c-skill",
    intents: ["发现可以直接安装的 Skill", "让 Claude 替我工作"],
  },
  {
    key: "agent",
    label: "AGENT",
    name: "AI Agent",
    tagline: "会自己规划、自己执行的系统。",
    cssVar: "--c-agent",
    intents: ["让 Claude 替我工作", "找一个值得研究的开源项目"],
  },
  {
    key: "devtool",
    label: "DEV TOOLS",
    name: "开发工具",
    tagline: "写代码时真正会省时间的那几个。",
    cssVar: "--c-devtool",
    intents: ["找一个值得研究的开源项目"],
  },
  {
    key: "design",
    label: "DESIGN & UI",
    name: "设计与 UI",
    tagline: "正在变热的设计能力。",
    cssVar: "--c-design",
    intents: ["做一个更好看的网页"],
  },
  {
    key: "browser",
    label: "BROWSER AUTOMATION",
    name: "浏览器自动化",
    tagline: "让 AI 真的去点那个按钮。",
    cssVar: "--c-browser",
    intents: ["让 AI 自动操作浏览器", "自动处理重复任务"],
  },
  {
    key: "media",
    label: "CONTENT & MEDIA",
    name: "内容与媒体",
    tagline: "图片、音频、视频的处理能力。",
    cssVar: "--c-media",
    intents: ["做一个更好看的东西"],
  },
  {
    key: "data",
    label: "DATA & RESEARCH",
    name: "数据与研究",
    tagline: "把杂乱信息变成可用的结论。",
    cssVar: "--c-data",
    intents: ["找一个值得研究的开源项目"],
  },
  {
    key: "productivity",
    label: "PRODUCTIVITY",
    name: "办公与生产力",
    tagline: "把重复劳动从你手里拿走。",
    cssVar: "--c-productivity",
    intents: ["自动处理重复任务"],
  },
  {
    key: "security",
    label: "SECURITY & PRIVACY",
    name: "安全与隐私",
    tagline: "在装任何东西之前，先看这一类。",
    cssVar: "--c-security",
    intents: ["找一个值得研究的开源项目"],
  },
  {
    key: "marketing",
    label: "MARKETING & BUSINESS",
    name: "营销与商业",
    tagline: "增长、投放和商业分析的工具。",
    cssVar: "--c-marketing",
    intents: ["自动处理重复任务"],
  },
];

const BY_KEY = new Map(CATEGORIES.map((c) => [c.key, c]));

export function categoryMeta(key: string | null | undefined): CategoryMeta | null {
  if (!key) return null;
  return BY_KEY.get(key as Category) ?? null;
}

export function categoryLabel(key: string | null | undefined): string {
  return categoryMeta(key)?.label ?? "UNCATEGORISED";
}

/** Difficulty is rendered as stars, never as a word alone. */
export const DIFFICULTY_STARS: Record<string, number> = {
  one_click: 1,
  simple_config: 2,
  needs_api_key: 3,
  needs_local: 4,
  needs_dev: 4,
  expert: 5,
};

export const DIFFICULTY_LABEL: Record<string, string> = {
  one_click: "一键安装",
  simple_config: "简单配置",
  needs_api_key: "需要 API Key",
  needs_local: "需要本地环境",
  needs_dev: "需要开发经验",
  expert: "专家级",
};

export const STATUS_LABEL: Record<string, string> = {
  new: "新发布",
  surging: "快速增长",
  steady: "持续活跃",
  slowing: "增长放缓",
  unstable: "维护不稳定",
  stale: "长期未更新",
  archived: "已归档",
  unverified: "待验证",
};

export const SECURITY_LABEL: Record<string, string> = {
  safe: "未发现明显风险",
  review: "需检查",
  risk: "存在风险",
  unknown: "未知",
};

export const SECURITY_LEVEL: Record<string, "safe" | "review" | "high" | "unknown"> = {
  safe: "safe",
  review: "review",
  risk: "high",
  unknown: "unknown",
};

/** Homepage intent entries, in the order they render. */
export const INTENTS = [
  "让 Claude 替我工作",
  "做一个更好看的网页",
  "自动处理重复任务",
  "发现可以直接安装的 Skill",
  "找一个值得研究的开源项目",
  "让 AI 自动操作浏览器",
];


/** English labels for the V2 status/difficulty/security vocabularies. */
export const DIFFICULTY_LABEL_EN: Record<string, string> = {
  one_click: "One-click install",
  simple_config: "Simple setup",
  needs_api_key: "Needs an API key",
  needs_local: "Needs a local runtime",
  needs_dev: "Needs development work",
  expert: "Expert setup",
};

export const STATUS_LABEL_EN: Record<string, string> = {
  new: "New",
  surging: "Growing fast",
  steady: "Active",
  slowing: "Slowing",
  unstable: "Unstable",
  stale: "Not updated",
  archived: "Archived",
  unverified: "Unverified",
};

export const SECURITY_LABEL_EN: Record<string, string> = {
  safe: "No obvious risk found",
  review: "Needs review",
  risk: "Risk found",
  unknown: "Unknown",
};
