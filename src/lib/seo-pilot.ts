/**
 * SEO copy pilot for /p/[slug].
 *
 * The pilot set is the 50 non-hidden projects with the most distinct
 * daily_signal days, published or not, and at least 3 days. Ties break by
 * published days, then slug, so the same database always yields the same set.
 * `isSeoPilot(slug, pilot)` is that membership check.
 *
 * Sections come from stored fields and those tracked rows. A section is left
 * out when those fields are not enough. Nothing here calls a model.
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
  momentumTitle: { zh: "追踪记录", en: "Tracked record" },
  peerKicker: { zh: "同类", en: "RELATED" },
  peerTitle: { zh: "同类项目对比", en: "Similar ranked projects" },
  audienceKicker: { zh: "读者", en: "WHO IT'S FOR" },
  audienceTitle: { zh: "适合谁用", en: "Who it's for" },
  dailyToggle: { zh: "每日记录", en: "Daily record" },
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

export type SeoPilotCount = {
  slug: string;
  /** Distinct daily_signal days, any publish state. */
  tracked: number | string;
  /** Distinct days that were on the published ranking. */
  published?: number | string | null;
};

/** Most tracked days, then published days, then slug. Under the minimum is left out. */
export function selectSeoPilotSlugs(
  rows: readonly SeoPilotCount[],
  size = SEO_PILOT_SIZE,
  minTracked = SEO_PILOT_MIN_POINTS,
): string[] {
  const bySlug = new Map<string, { tracked: number; published: number }>();
  for (const row of rows) {
    const slug = String(row.slug ?? "").trim();
    const tracked = Number(row.tracked);
    const published = Number(row.published ?? 0);
    if (!slug || !Number.isFinite(tracked)) continue;
    const next = { tracked, published: Number.isFinite(published) ? published : 0 };
    const prev = bySlug.get(slug);
    if (!prev || next.tracked > prev.tracked || (next.tracked === prev.tracked && next.published > prev.published)) {
      bySlug.set(slug, next);
    }
  }
  return [...bySlug.entries()]
    .filter(([, counts]) => counts.tracked >= minTracked)
    .sort((a, b) => b[1].tracked - a[1].tracked || b[1].published - a[1].published || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
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

function enDays(count: number, adjective?: string): string {
  const noun = count === 1 ? "day" : "days";
  return adjective ? `${count} ${adjective} ${noun}` : `${count} ${noun}`;
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
  /** Public place when the day was published. Unpublished and review rows may be 0 or null. */
  rank?: number | null;
  /** Stored 热度分. Unpublished rows have one; a missing value is skipped. */
  heatScore?: number | null;
  published?: boolean;
};

export type MomentumRow = {
  date: string;
  rank: number | null;
  published: boolean;
  heat: string;
  delta: number | null;
  lineZh: string;
  lineEn: string;
};

export type MomentumSection = {
  firstTracked: string;
  trackedDays: number;
  publishedDays: number;
  bestRank: number | null;
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
  if (delta == null) return { zh: "首次记录", en: "first tracked day" };
  const rounded = Math.round(delta * 10) / 10;
  if (rounded === 0) return { zh: "较上次记录持平", en: "unchanged vs the previous tracked day" };
  const label = formatMomentumDelta(rounded);
  return { zh: `较上次记录 ${label}`, en: `${label} vs the previous tracked day` };
}

type TrackedPoint = { date: string; heatScore: number; published: boolean; rank: number | null };

function publicRank(point: TrackedPoint): number | null {
  if (!point.published || point.rank == null || !Number.isInteger(point.rank) || point.rank < 1) return null;
  return point.rank;
}

function earliestSignalDate(points: RankingPoint[]): string | null {
  let earliest: string | null = null;
  for (const point of points) {
    const date = asIsoDay(point.date);
    if (!date) continue;
    if (!earliest || date < earliest) earliest = date;
  }
  return earliest;
}

export function buildMomentumSection(input: {
  /** Ignored. This is repo creation on the project row, not the first 热度分 snapshot. */
  firstTrackedAt?: string | Date | null;
  points: RankingPoint[];
}): MomentumSection | null {
  void input.firstTrackedAt;
  const byDate = new Map<string, TrackedPoint>();
  for (const point of input.points) {
    const date = asIsoDay(point.date);
    const heatScore = point.heatScore == null ? Number.NaN : Number(point.heatScore);
    if (!date || !Number.isFinite(heatScore)) continue;
    const published = point.published === true;
    const rankNumber = point.rank == null ? Number.NaN : Number(point.rank);
    const next: TrackedPoint = {
      date,
      heatScore,
      published,
      rank: Number.isInteger(rankNumber) ? rankNumber : null,
    };
    const prev = byDate.get(date);
    if (!prev || (next.published && !prev.published)) byDate.set(date, next);
  }
  const series = [...byDate.values()].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  if (series.length < SEO_PILOT_MIN_POINTS) return null;

  const rowsChrono: MomentumRow[] = series.map((point, index) => {
    const prev = index === 0 ? null : series[index - 1]!;
    const delta = prev ? point.heatScore - prev.heatScore : null;
    const change = changeClause(delta);
    const heat = formatMomentum(point.heatScore);
    const place = publicRank(point);
    const listedZh = point.published ? "上榜 · " : "";
    const listedEn = point.published ? "on the ranking · " : "";
    const rankZh = place == null ? "" : `名次 ${place} · `;
    const rankEn = place == null ? "" : `rank ${place} · `;
    return {
      date: point.date,
      rank: place,
      published: point.published,
      heat,
      delta,
      lineZh: `${point.date} · ${listedZh}${rankZh}热度分 ${heat} · ${change.zh}`,
      lineEn: `${point.date} · ${listedEn}${rankEn}momentum ${heat} · ${change.en}`,
    };
  });

  const publishedPlaces = series.map(publicRank).filter((rank): rank is number => rank != null);
  const bestRank = publishedPlaces.length ? Math.min(...publishedPlaces) : null;
  const bestHeatValue = Math.max(...series.map((point) => point.heatScore));
  const bestHeat = formatMomentum(bestHeatValue);
  const publishedDays = series.filter((point) => point.published).length;
  const first = series[0]!;
  const latestPoint = series[series.length - 1]!;
  const firstTracked = earliestSignalDate(input.points) ?? first.date;
  const firstHeat = formatMomentum(first.heatScore);
  const latestHeat = formatMomentum(latestPoint.heatScore);
  const net = formatMomentumDelta(latestPoint.heatScore - first.heatScore);
  const peak = series.find((point) => point.heatScore === bestHeatValue)!;
  const atRecordHigh = latestPoint.heatScore === bestHeatValue;
  const placeZh = bestRank != null ? `，记录里排到过第 ${bestRank} 名` : "";
  const placeEn = bestRank != null ? `, and published rank in this record reached ${bestRank}` : "";
  const levelZh = atRecordHigh
    ? "目前处于追踪以来的最高水平。"
    : `峰值 ${bestHeat}，出现在 ${peak.date}。`;
  const levelEn = atRecordHigh
    ? "It is currently at its highest tracked level."
    : `The peak was ${bestHeat} on ${peak.date}.`;
  const listedZh = publishedDays > 0 ? `上榜 ${publishedDays} 天${placeZh}。` : "";
  const listedEn = publishedDays > 0 ? ` On the published ranking ${enDays(publishedDays)}${placeEn}.` : "";
  const summaryZh = `自 ${firstTracked} 起追踪 ${series.length} 天。热度分从 ${firstHeat} 到 ${latestHeat}，净变化 ${net}。${levelZh}${listedZh}`;
  const summaryEn = `Tracked ${enDays(series.length)} since ${firstTracked}. Momentum went from ${firstHeat} to ${latestHeat}, a net change of ${net}. ${levelEn}${listedEn}`.replace(/ {2,}/g, " ").trim();
  const visible = rowsChrono.slice(-LIST_MAX).reverse();
  const note = series.length > visible.length
    ? {
        zh: `共 ${series.length} 天追踪记录，这里列出最近 ${visible.length} 天。`,
        en: `${enDays(series.length, "tracked")}; the latest ${enDays(visible.length)} ${visible.length === 1 ? "is" : "are"} listed.`,
      }
    : null;
  const sparkline = momentumSparkline(series.slice(-SPARKLINE_MAX).map((point) => point.heatScore));
  return {
    firstTracked,
    trackedDays: series.length,
    publishedDays,
    bestRank,
    bestHeat,
    summaryZh,
    summaryEn,
    captionZh: "折线从左到右按追踪日期排列，表示热度分。",
    captionEn: "The line reads left to right by tracked date and shows momentum.",
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

function cleanLicense(value: string | null | undefined): string | null {
  if (!value) return null;
  const text = value.trim();
  if (!text || text.length > 80 || /^(unknown|none|n\/a|noassertion|other)$/i.test(text)) return null;
  if (!/^[A-Za-z0-9.+() -]{2,80}$/.test(text)) return null;
  if (containsSeoPilotBlocked(text)) return null;
  return text;
}

export function buildAudienceSection(input: AudienceInput): { zh: string; en: string } | null {
  const language = usableLanguage(input.language);
  const topics = usableTopicList(input.topics).slice(0, 3);
  const license = cleanLicense(input.license);
  const factCount = [language, topics.length ? "topics" : null, license].filter(Boolean).length;
  if (factCount < 2) return null;

  const topicZh = topics.join("、");
  const topicEn = topics.join(", ");
  const lead = language && topics.length
    ? { zh: `适合使用 ${language}、并且关注 ${topicZh} 的人。`, en: `For people using ${language} and following ${topicEn}.` }
    : language
      ? { zh: `适合使用 ${language} 的人。`, en: `For people using ${language}.` }
      : topics.length
        ? { zh: `适合关注 ${topicZh} 的人。`, en: `For people following ${topicEn}.` }
        : null;
  const licenseZh = license
    ? input.projectKind === "product"
      ? `资料里的许可是 ${license}。`
      : `仓库许可为 ${license}。`
    : "";
  const licenseEn = license
    ? input.projectKind === "product"
      ? `The listed license is ${license}.`
      : `The repository license is ${license}.`
    : "";
  const zh = `${lead?.zh ?? ""}${licenseZh}`.trim();
  const en = `${lead?.en ?? ""}${licenseEn ? ` ${licenseEn}` : ""}`.replace(/ {2,}/g, " ").trim();
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
