/**
 * SEO copy pilot for /p/[slug].
 *
 * The pilot set is the 50 public projects with the most published ranking
 * days, and at least 3 days. Ties break by slug, so the same database always
 * yields the same set. `isSeoPilot(slug, pilot)` is that membership check.
 *
 * Sections come from stored fields and published ranking rows. A section is
 * left out when those fields are not enough. Nothing here calls a model.
 */

import { categoryLabelEn, categoryLabelZh } from "@/components/v3/category-color";
import { projectPath } from "@/lib/page-meta";

export const SEO_PILOT_SIZE = 50;
export const SEO_PILOT_MIN_POINTS = 3;
export const SEO_PEER_MIN = 3;
export const SEO_PEER_MAX = 6;
export const SPARK_WIDTH = 160;
export const SPARK_HEIGHT = 36;

const LIST_MAX = 24;
const SPARKLINE_MAX = 60;
const META_MAX = 220;

/** Split so the templates themselves do not contain the blocked wording. */
const BLOCKED = [new RegExp(["fo", "rk"].join(""), "i"), new RegExp(["fast", "est"].join(""), "i"), new RegExp(["涨得", "最", "快"].join(""))];

export const SEO_PILOT_COPY = {
  momentumKicker: { zh: "热度分", en: "MOMENTUM" },
  momentumTitle: { zh: "热度分走势", en: "Momentum" },
  peerKicker: { zh: "同类", en: "RELATED" },
  peerTitle: { zh: "同类项目对比", en: "Similar ranked projects" },
  audienceKicker: { zh: "读者", en: "WHO IT'S FOR" },
  audienceTitle: { zh: "适合谁用", en: "Who it's for" },
} as const;

const GENERIC_TOPICS = new Set([
  "hacktoberfest",
  "awesome",
  "awesome-list",
  "good-first-issue",
  "help-wanted",
  "github",
  "open-source",
  "opensource",
  "tool",
  "tools",
  "app",
  "apps",
  "software",
  "project",
  "misc",
  "other",
]);

const DESCRIPTION_RULES: { test: RegExp; zh: string; en: string }[] = [
  { test: /\b(?:cli|command[- ]line)\b|命令行/i, zh: "做命令行工具", en: "building a command-line tool" },
  { test: /\bmcp\b/i, zh: "接入 MCP 服务", en: "connecting an MCP server" },
  { test: /\b(?:browser extension|chrome extension|firefox extension)\b|浏览器扩展/i, zh: "做浏览器扩展", en: "building a browser extension" },
  { test: /\b(?:kubernetes|\bk8s\b)/i, zh: "处理 Kubernetes", en: "working with Kubernetes" },
  { test: /\b(?:database|postgres|sqlite|mysql)\b|数据库/i, zh: "处理数据库", en: "working with a database" },
  { test: /\b(?:compiler|interpreter)\b|编译器/i, zh: "写编译或解释器", en: "working on a compiler or interpreter" },
  { test: /\b(?:editor|ide)\b|编辑器/i, zh: "做编辑器", en: "building an editor" },
  { test: /\b(?:notebook|jupyter)\b/i, zh: "用笔记本环境", en: "using a notebook environment" },
];

export function containsSeoPilotBlocked(text: string): boolean {
  return BLOCKED.some((pattern) => pattern.test(text));
}

export function isSeoPilot(slug: string, pilot: Iterable<string>): boolean {
  if (!slug) return false;
  if (pilot instanceof Set) return pilot.has(slug);
  if (Array.isArray(pilot)) return pilot.includes(slug);
  for (const item of pilot) if (item === slug) return true;
  return false;
}

/** Highest published-day counts, then slug. Projects under the minimum are left out. */
export function selectSeoPilotSlugs(
  rows: readonly { slug: string; points: number | string }[],
  size = SEO_PILOT_SIZE,
  minPoints = SEO_PILOT_MIN_POINTS,
): string[] {
  const bySlug = new Map<string, number>();
  for (const row of rows) {
    const slug = String(row.slug ?? "").trim();
    const points = Number(row.points);
    if (!slug || !Number.isFinite(points)) continue;
    bySlug.set(slug, Math.max(bySlug.get(slug) ?? 0, points));
  }
  return [...bySlug.entries()]
    .filter(([, points]) => points >= minPoints)
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    .slice(0, Math.max(0, size))
    .map(([slug]) => slug);
}

export function formatMomentum(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  if (!Number.isFinite(rounded)) return "";
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

export function formatMomentumDelta(delta: number): string {
  const rounded = Math.round(delta * 10) / 10;
  if (!Number.isFinite(rounded) || rounded === 0) return "0";
  const abs = formatMomentum(Math.abs(rounded));
  return rounded > 0 ? `+${abs}` : `−${abs}`;
}

export function asIsoDay(value: string | Date | null | undefined): string | null {
  if (!value) return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return value.toISOString().slice(0, 10);
  }
  const text = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

export type RankingPoint = {
  date: string | Date;
  rank: number;
  heatScore: number;
};

export type MomentumRow = {
  date: string;
  rank: number;
  heat: string;
  delta: number | null;
  lineZh: string;
  lineEn: string;
};

export type MomentumSection = {
  firstTracked: string;
  appearances: number;
  bestRank: number;
  bestHeat: string;
  summaryZh: string;
  summaryEn: string;
  captionZh: string;
  captionEn: string;
  noteZh: string | null;
  noteEn: string | null;
  rows: MomentumRow[];
  sparkline: { x: number; y: number }[];
};

export function momentumSparkline(
  values: number[],
  width = SPARK_WIDTH,
  height = SPARK_HEIGHT,
): { x: number; y: number }[] {
  if (values.length < 2) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min;
  const pad = 2;
  const innerW = width - pad * 2;
  const innerH = height - pad * 2;
  return values.map((value, index) => {
    const x = pad + (index / (values.length - 1)) * innerW;
    const t = span === 0 ? 0.5 : (value - min) / span;
    const y = pad + (1 - t) * innerH;
    return { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 };
  });
}

function changeClause(delta: number | null): { zh: string; en: string } {
  if (delta == null) return { zh: "首次出现", en: "first appearance" };
  const rounded = Math.round(delta * 10) / 10;
  if (rounded === 0) return { zh: "较上次出现持平", en: "unchanged vs the previous appearance" };
  const label = formatMomentumDelta(rounded);
  return { zh: `较上次出现 ${label}`, en: `${label} vs the previous appearance` };
}

export function buildMomentumSection(input: {
  firstTrackedAt?: string | Date | null;
  points: RankingPoint[];
}): MomentumSection | null {
  const byDate = new Map<string, { date: string; rank: number; heatScore: number }>();
  for (const point of input.points) {
    const date = asIsoDay(point.date);
    const heatScore = Number(point.heatScore);
    const rank = Number(point.rank);
    if (!date || !Number.isFinite(heatScore) || !Number.isInteger(rank) || rank < 1) continue;
    byDate.set(date, { date, rank, heatScore });
  }
  const series = [...byDate.values()].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  if (series.length < SEO_PILOT_MIN_POINTS) return null;

  const rowsChrono: MomentumRow[] = series.map((point, index) => {
    const prev = index === 0 ? null : series[index - 1]!;
    const delta = prev ? point.heatScore - prev.heatScore : null;
    const change = changeClause(delta);
    const heat = formatMomentum(point.heatScore);
    return {
      date: point.date,
      rank: point.rank,
      heat,
      delta,
      lineZh: `${point.date} · 名次 ${point.rank} · 热度分 ${heat} · ${change.zh}`,
      lineEn: `${point.date} · rank ${point.rank} · momentum ${heat} · ${change.en}`,
    };
  });

  const bestRank = Math.min(...series.map((point) => point.rank));
  const bestHeat = formatMomentum(Math.max(...series.map((point) => point.heatScore)));
  const firstTracked = asIsoDay(input.firstTrackedAt) ?? series[0]!.date;
  const latest = rowsChrono[rowsChrono.length - 1]!;
  const latestChange = changeClause(latest.delta);
  const summaryZh = `首次记录 ${firstTracked}，上榜 ${series.length} 次。最近热度分 ${latest.heat}（${latestChange.zh}），记录里排到过第 ${bestRank} 名，热度分到过 ${bestHeat}。`;
  const summaryEn = `First tracked ${firstTracked}. On the ranking ${series.length} times. Latest momentum ${latest.heat} (${latestChange.en}). Rank in this record reached ${bestRank}. Momentum in this record reached ${bestHeat}.`;
  const visible = rowsChrono.slice(-LIST_MAX).reverse();
  const note = series.length > visible.length
    ? {
        zh: `共 ${series.length} 次上榜，这里列出最近 ${visible.length} 次。`,
        en: `${series.length} ranking appearances; the latest ${visible.length} are listed.`,
      }
    : null;
  const sparkline = momentumSparkline(series.slice(-SPARKLINE_MAX).map((point) => point.heatScore));
  return {
    firstTracked,
    appearances: series.length,
    bestRank,
    bestHeat,
    summaryZh,
    summaryEn,
    captionZh: "折线从左到右按上榜日期排列，表示热度分。",
    captionEn: "The line reads left to right by ranking date and shows momentum.",
    noteZh: note?.zh ?? null,
    noteEn: note?.en ?? null,
    rows: visible,
    sparkline,
  };
}

export type SeoPeerSelf = {
  slug: string;
  language?: string | null;
  category?: string | null;
  primaryCategory?: string | null;
  topics?: string[] | null;
};

export type SeoPeerCandidate = SeoPeerSelf & {
  name?: string | null;
  heatScore: number;
  signalDate: string | Date;
};

export type PeerSection = {
  introZh: string;
  introEn: string;
  peers: {
    slug: string;
    name: string;
    href: string;
    detailZh: string;
    detailEn: string;
  }[];
};

function normTopic(value: string): string {
  return value.trim().toLowerCase();
}

function usableTopicList(topics: string[] | null | undefined): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of topics ?? []) {
    const shown = String(raw ?? "").trim();
    const key = normTopic(shown);
    if (seen.has(key) || key.length < 2 || key.length > 32) continue;
    if (GENERIC_TOPICS.has(key) || !/^[\w.+#-]{2,32}$/.test(key)) continue;
    if (containsSeoPilotBlocked(shown)) continue;
    seen.add(key);
    out.push(shown);
  }
  return out;
}

function sharedTopics(self: string[] | null | undefined, other: string[] | null | undefined): string[] {
  const mine = new Set(usableTopicList(self).map(normTopic));
  return usableTopicList(other)
    .filter((topic) => mine.has(normTopic(topic)))
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

function usableLanguage(value: string | null | undefined): string | null {
  if (!value) return null;
  const text = value.trim();
  if (!text || text.length > 40 || /^(unknown|none|n\/a)$/i.test(text)) return null;
  if (containsSeoPilotBlocked(text)) return null;
  return text;
}

function sameLanguage(a: string | null | undefined, b: string | null | undefined): boolean {
  const left = usableLanguage(a);
  const right = usableLanguage(b);
  if (!left || !right) return false;
  return left.toLowerCase() === right.toLowerCase();
}

function categoryPhrase(key: string | null | undefined): { zh: string; en: string } | null {
  if (!key?.trim()) return null;
  const zhLabel = categoryLabelZh(key);
  const enLabel = categoryLabelEn(key);
  const phrase = zhLabel === "未分类" ? { zh: key.trim(), en: key.trim() } : { zh: zhLabel, en: enLabel };
  if (containsSeoPilotBlocked(phrase.zh) || containsSeoPilotBlocked(phrase.en)) return null;
  return phrase;
}

export function buildPeerSection(
  self: SeoPeerSelf,
  candidates: SeoPeerCandidate[],
  min = SEO_PEER_MIN,
  max = SEO_PEER_MAX,
): PeerSection | null {
  const unique = new Map<string, SeoPeerCandidate>();
  for (const candidate of candidates) {
    const slug = String(candidate.slug ?? "").trim();
    if (!slug || slug === self.slug || unique.has(slug)) continue;
    if (!Number.isFinite(Number(candidate.heatScore)) || !asIsoDay(candidate.signalDate)) continue;
    unique.set(slug, candidate);
  }

  const ranked = [...unique.values()].flatMap((candidate) => {
    const topics = sharedTopics(self.topics, candidate.topics);
    let score = 0;
    if (topics.length) score += Math.min(3, topics.length);
    if (sameLanguage(self.language, candidate.language)) score += 2;
    const primary = self.primaryCategory?.trim() && self.primaryCategory === candidate.primaryCategory?.trim();
    const legacy = self.category?.trim() && self.category === candidate.category?.trim();
    if (primary) score += 3;
    else if (legacy) score += 2;
    if (score <= 0) return [];

    const topicShown = topics.slice(0, 2);
    const language = usableLanguage(self.language);
    const category = categoryPhrase(primary ? self.primaryCategory : legacy ? self.category : null);
    const reason = topicShown.length
      ? { zh: `相同主题 ${topicShown.join("、")}`, en: `shared topic ${topicShown.join(", ")}` }
      : sameLanguage(self.language, candidate.language) && language
        ? { zh: `同为 ${language}`, en: `same language, ${language}` }
        : category
          ? { zh: `同属 ${category.zh}`, en: `same category, ${category.en}` }
          : null;
    if (!reason) return [];
    const heat = formatMomentum(Number(candidate.heatScore));
    const date = asIsoDay(candidate.signalDate)!;
    const name = candidate.name?.trim() || candidate.slug;
    return [{
      score,
      slug: candidate.slug,
      name,
      href: projectPath(candidate.slug),
      detailZh: `${reason.zh} · 热度分 ${heat} · ${date}`,
      detailEn: `${reason.en} · momentum ${heat} · ${date}`,
    }];
  }).sort((a, b) => b.score - a.score || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));

  if (ranked.length < min) return null;
  return {
    introZh: "下面这些项目与它有相同的语言、分类或仓库主题。热度分是各自最近一次上榜时的分数。",
    introEn: "These projects share a language, category, or repository topic. Momentum is the score from each project's latest ranking appearance.",
    peers: ranked.slice(0, max).map(({ score: _score, ...peer }) => peer),
  };
}

export type AudienceInput = {
  language?: string | null;
  topics?: string[] | null;
  description?: string | null;
  license?: string | null;
  projectKind?: string | null;
  skillType?: string | null;
  hasSkillMd?: boolean | null;
  isTemplate?: boolean | null;
  requiresApiKey?: boolean | null;
  requiresLocalRuntime?: boolean | null;
  requiresDocker?: boolean | null;
};

type Bit = { zh: string; en: string };

function cleanLicense(value: string | null | undefined): string | null {
  if (!value) return null;
  const text = value.trim();
  if (!text || text.length > 80 || /^(unknown|none|n\/a|noassertion|other)$/i.test(text)) return null;
  if (!/^[A-Za-z0-9.+() -]{2,80}$/.test(text)) return null;
  if (containsSeoPilotBlocked(text)) return null;
  return text;
}

function descriptionBit(description: string | null | undefined): Bit | null {
  if (!description?.trim()) return null;
  const rule = DESCRIPTION_RULES.find((item) => item.test.test(description));
  return rule ? { zh: rule.zh, en: rule.en } : null;
}

function typeBits(input: AudienceInput): Bit[] {
  const bits: Bit[] = [];
  const skill = input.skillType ?? "unknown";
  if (input.projectKind === "product") {
    bits.push({ zh: "在浏览器里使用这个网站产品", en: "using this website product in the browser" });
  }
  if (skill === "mcp") bits.push({ zh: "接入 MCP 服务", en: "connecting an MCP server" });
  if (skill === "agent") bits.push({ zh: "配置 agent", en: "configuring an agent" });
  if (skill === "library") bits.push({ zh: "引用代码库", en: "depending on a library" });
  if (skill === "framework") bits.push({ zh: "采用这个框架", en: "adopting this framework" });
  if (skill === "workflow") bits.push({ zh: "编排工作流", en: "running a workflow" });
  if (skill === "prompt_pack") bits.push({ zh: "使用这套提示词", en: "using this prompt pack" });
  if (skill === "template" || input.isTemplate) bits.push({ zh: "从这个模板开始", en: "starting from a template" });
  if (skill === "skill" || input.hasSkillMd) bits.push({ zh: "安装带有 SKILL.md 的技能", en: "installing a skill that includes SKILL.md" });
  return bits;
}

function requirementBit(input: AudienceInput): Bit | null {
  const zh: string[] = [];
  const en: string[] = [];
  if (input.requiresLocalRuntime) {
    zh.push("本机运行");
    en.push("a local runtime");
  }
  if (input.requiresDocker) {
    zh.push("Docker");
    en.push("Docker");
  }
  if (input.requiresApiKey) {
    zh.push("自备 API key");
    en.push("your own API key");
  }
  if (!zh.length) return null;
  return { zh: `需要${zh.join("、")}`, en: `requiring ${en.join(", ")}` };
}

export function buildAudienceSection(input: AudienceInput): { zh: string; en: string } | null {
  const bits: Bit[] = [];
  const language = usableLanguage(input.language);
  if (language) bits.push({ zh: `使用 ${language}`, en: `using ${language}` });
  for (const bit of typeBits(input)) {
    if (!bits.some((item) => item.zh === bit.zh)) bits.push(bit);
  }
  const described = descriptionBit(input.description);
  if (described && !bits.some((item) => item.zh === described.zh)) bits.push(described);
  const topics = usableTopicList(input.topics).slice(0, 3);
  if (topics.length) bits.push({ zh: `关注主题 ${topics.join("、")}`, en: `following the topics ${topics.join(", ")}` });
  const requirements = requirementBit(input);
  if (requirements) bits.push(requirements);

  const license = cleanLicense(input.license);
  if (bits.length < 1 || bits.length + (license ? 1 : 0) < 2) return null;

  const licenseZh = license
    ? input.projectKind === "product"
      ? `资料里写明的许可是 ${license}。`
      : `仓库写明的许可是 ${license}。`
    : "";
  const licenseEn = license
    ? input.projectKind === "product"
      ? ` The listed license is ${license}.`
      : ` The repository lists its license as ${license}.`
    : "";
  const zh = `适合${bits.map((bit) => bit.zh).join("、")}的人。${licenseZh}`.trim();
  const en = `For people ${bits.map((bit) => bit.en).join(", ")}.${licenseEn}`.replace(/[ \t]+\n/g, "\n").replace(/ {2,}/g, " ").trim();
  if (containsSeoPilotBlocked(zh) || containsSeoPilotBlocked(en)) return null;
  return { zh, en };
}

export function seoPilotMetaDescription(input: {
  name?: string | null;
  oneLiner?: string | null;
  momentum: MomentumSection | null;
}): string | null {
  if (!input.momentum) return null;
  const name = input.name?.replace(/\s+/g, " ").trim() || "这个项目";
  const facts = `${name} 的热度分记录：${input.momentum.summaryZh}`;
  const lead = input.oneLiner?.replace(/\s+/g, " ").trim() ?? "";
  if (!lead || containsSeoPilotBlocked(lead)) return facts;
  const combined = `${lead} ${facts}`;
  return combined.length <= META_MAX ? combined : facts;
}

export type SeoPilotView = {
  momentum: MomentumSection | null;
  peers: PeerSection | null;
  audience: { zh: string; en: string } | null;
  metaDescription: string | null;
};

export function seoPilotPlainText(view: Pick<SeoPilotView, "momentum" | "peers" | "audience" | "metaDescription">): string {
  const parts: string[] = [];
  if (view.metaDescription) parts.push(view.metaDescription);
  if (view.momentum) {
    parts.push(
      SEO_PILOT_COPY.momentumKicker.zh,
      SEO_PILOT_COPY.momentumKicker.en,
      SEO_PILOT_COPY.momentumTitle.zh,
      SEO_PILOT_COPY.momentumTitle.en,
      view.momentum.summaryZh,
      view.momentum.summaryEn,
      view.momentum.captionZh,
      view.momentum.captionEn,
    );
    if (view.momentum.noteZh) parts.push(view.momentum.noteZh);
    if (view.momentum.noteEn) parts.push(view.momentum.noteEn);
    for (const row of view.momentum.rows) parts.push(row.lineZh, row.lineEn);
  }
  if (view.peers) {
    parts.push(
      SEO_PILOT_COPY.peerKicker.zh,
      SEO_PILOT_COPY.peerKicker.en,
      SEO_PILOT_COPY.peerTitle.zh,
      SEO_PILOT_COPY.peerTitle.en,
      view.peers.introZh,
      view.peers.introEn,
    );
    for (const peer of view.peers.peers) parts.push(peer.detailZh, peer.detailEn);
  }
  if (view.audience) {
    parts.push(
      SEO_PILOT_COPY.audienceKicker.zh,
      SEO_PILOT_COPY.audienceKicker.en,
      SEO_PILOT_COPY.audienceTitle.zh,
      SEO_PILOT_COPY.audienceTitle.en,
      view.audience.zh,
      view.audience.en,
    );
  }
  return parts.join("\n");
}
