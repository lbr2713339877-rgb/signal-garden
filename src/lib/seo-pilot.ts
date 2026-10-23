/**
 * SEO copy pilot for /p/[slug].
 *
 * The pilot set is the 50 non-hidden projects with the most distinct
 * daily_signal days, published or not, and at least 3 days. Ties break by
 * published days, then slug, so the same database always yields the same set.
 * `isSeoPilot(slug, pilot)` is that membership check.
 *
 * Sections come from stored fields and those tracked rows. Momentum and peer
 * sections are left out when those fields are not enough. The audience section
 * is always two scenario sentences; thin inputs stay visible and are marked
 * draft. Nothing here calls a model.
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
  audienceDraft: { zh: "草稿", en: "Draft" },
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
  dataNoteZh: string;
  dataNoteEn: string;
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

function trackedSeries(points: RankingPoint[]): TrackedPoint[] {
  const byDate = new Map<string, TrackedPoint>();
  for (const point of points) {
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
  return [...byDate.values()].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

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
  const series = trackedSeries(input.points);
  if (series.length < SEO_PILOT_MIN_POINTS) return null;

  const rowsChrono: MomentumRow[] = series.map((point, index) => {
    const prev = index === 0 ? null : series[index - 1]!;
    const delta = prev ? point.heatScore - prev.heatScore : null;
    const change = changeClause(delta);
    const heat = formatMomentum(point.heatScore);
    const place = publicRank(point);
    const listedZh = point.published ? "上榜 · " : "";
    const listedEn = point.published ? "Ranked · " : "";
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
  const dataNote = seoPilotDataNote(publishedDays);
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
    dataNoteZh: dataNote.zh,
    dataNoteEn: dataNote.en,
    rows: visible,
    sparkline,
  };
}

const DATA_NOTE_EN = "Data note: the trend uses Signal Garden\u2019s daily tracked momentum scores; only dates marked \u201cRanked\u201d appeared on the public daily list.";

export function seoPilotDataNote(publishedDays: number): { zh: string; en: string } {
  const zh = publishedDays > 0
    ? "数据说明：走势来自 Signal Garden 每日追踪的热度分；只有标注「上榜」的日期出现在公开每日榜单上。"
    : "数据说明：走势来自 Signal Garden 每日追踪的热度分；该项目尚未出现在公开每日榜单上。";
  return { zh, en: DATA_NOTE_EN };
}

export type MomentumShape = "rising" | "peak-then-fade" | "flat";

/** Rising, peak-then-fade, or flat. Same tracked days as the momentum section. */
export function momentumShapeFromPoints(points: RankingPoint[]): MomentumShape | null {
  const series = trackedSeries(points);
  if (series.length < SEO_PILOT_MIN_POINTS) return null;
  const heats = series.map((point) => point.heatScore);
  const first = heats[0]!;
  const last = heats[heats.length - 1]!;
  const max = Math.max(...heats);
  const min = Math.min(...heats);
  const band = Math.max(0.05, Math.abs(max) * 0.02);
  if (max - min <= band) return "flat";
  if (last < max - band) return "peak-then-fade";
  if (last > first + band) return "rising";
  return "flat";
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

export type AudiencePeerHint = {
  name: string;
  language?: string | null;
  topics?: string[] | null;
};

export type AudienceInput = {
  language?: string | null;
  topics?: string[] | null;
  tags?: string[] | null;
  description?: string | null;
  /** First README paragraph, already clipped. Full README text is also accepted. */
  readmeExcerpt?: string | null;
  readmeText?: string | null;
  license?: string | null;
  projectKind?: string | null;
  skillType?: string | null;
  hasSkillMd?: boolean | null;
  isTemplate?: boolean | null;
  requiresApiKey?: boolean | null;
  requiresLocalRuntime?: boolean | null;
  requiresDocker?: boolean | null;
  momentumShape?: MomentumShape | null;
  peers?: AudiencePeerHint[] | null;
};

export type AudienceSection = {
  zh: string;
  en: string;
  /** True when a problem fact and a difference fact are not both present. */
  draft: boolean;
};

function cleanLicense(value: string | null | undefined): string | null {
  if (!value) return null;
  const text = value.trim();
  if (!text || text.length > 80 || /^(unknown|none|n\/a|noassertion|other)$/i.test(text)) return null;
  if (!/^[A-Za-z0-9.+() -]{2,80}$/.test(text)) return null;
  if (containsSeoPilotBlocked(text)) return null;
  return text;
}

const AUDIENCE_NOISE = [/\bbest\b/i, /\btop\b/i, new RegExp(["最", "快"].join("")), /名次/, /\brank\b/i, /适合开发者/, /很好用/];

function audienceNoise(text: string): boolean {
  return containsSeoPilotBlocked(text) || AUDIENCE_NOISE.some((pattern) => pattern.test(text));
}

function normalizeInline(text: string): string {
  return text
    .replace(/!\[[^\]]*]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)]\([^)]*\)/g, "$1")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/[#>*_`~]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function clipSummarySentence(text: string | null | undefined): string | null {
  if (!text) return null;
  const normalized = normalizeInline(text);
  if (!normalized) return null;
  const cut = normalized.split(/[。！？]|\.(?=\s|$)|\?(?=\s|$)|\!(?=\s|$)/)[0]?.trim() ?? "";
  if (!cut) return null;
  const sentence = cut.length <= 160 ? cut : cut.slice(0, 160).replace(/\s+\S*$/, "").trim();
  if (sentence.length < 12) return null;
  const words = sentence.split(/\s+/).filter(Boolean);
  const cjk = /[\u3400-\u9fff]/.test(sentence);
  if (!cjk && words.length < 3) return null;
  if (audienceNoise(sentence)) return null;
  return sentence;
}

/** First readable README paragraph, clipped to one sentence. Null when it is too thin. */
export function audienceReadmeExcerpt(readmeText: string | null | undefined): string | null {
  if (!readmeText) return null;
  const head = readmeText.replace(/\r\n/g, "\n").slice(0, 5000);
  const buf: string[] = [];
  for (const line of head.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) {
      if (buf.length) break;
      continue;
    }
    if (!buf.length && (trimmed.startsWith("#") || trimmed.startsWith("<!--") || trimmed.startsWith("[![") || /^!\[[^\]]*]\(/.test(trimmed))) {
      continue;
    }
    if (trimmed.startsWith("<!--")) continue;
    buf.push(trimmed);
    if (buf.join(" ").length > 500) break;
  }
  if (!buf.length) return null;
  return clipSummarySentence(buf.join(" "));
}

function cleanPeerName(name: string): string | null {
  const text = name.replace(/\s+/g, " ").trim();
  if (!text || text.length > 80 || /[。！？.!?]/.test(text)) return null;
  if (audienceNoise(text)) return null;
  return text;
}

export function audiencePeerHints(
  section: PeerSection | null,
  candidates: readonly SeoPeerCandidate[],
): AudiencePeerHint[] {
  if (!section) return [];
  const bySlug = new Map(candidates.map((candidate) => [candidate.slug, candidate]));
  const hints: AudiencePeerHint[] = [];
  for (const peer of section.peers) {
    const candidate = bySlug.get(peer.slug);
    const name = cleanPeerName(peer.name);
    if (!candidate || !name) continue;
    hints.push({ name, language: candidate.language ?? null, topics: candidate.topics ?? null });
  }
  return hints;
}

type TopicRole = { zh: string; en: string };

const TOPIC_ROLES: { keys: readonly string[]; role: (language: string | null) => TopicRole }[] = [
  {
    keys: ["cli", "terminal", "shell", "command-line"],
    role: (language) => language
      ? { zh: `维护 ${language} 命令行流程的团队`, en: `teams maintaining ${language} command-line workflows` }
      : { zh: "维护命令行流程的团队", en: "teams maintaining command-line workflows" },
  },
  {
    keys: ["mcp"],
    role: (language) => language
      ? { zh: `把 MCP 接到 ${language} 工程里的团队`, en: `teams wiring MCP into a ${language} project` }
      : { zh: "把 MCP 接到现有工程里的团队", en: "teams wiring MCP into an existing project" },
  },
  {
    keys: ["ui", "components", "component", "design-system"],
    role: (language) => language
      ? { zh: `用 ${language} 做界面组件的团队`, en: `teams building interface components in ${language}` }
      : { zh: "做界面组件的团队", en: "teams building interface components" },
  },
  {
    keys: ["docs", "documentation", "markdown"],
    role: (language) => language
      ? { zh: `用 ${language} 写文档的团队`, en: `teams writing documentation in ${language}` }
      : { zh: "写文档的团队", en: "teams writing documentation" },
  },
  {
    keys: ["editor"],
    role: (language) => language
      ? { zh: `用 ${language} 做编辑器的团队`, en: `teams building an editor in ${language}` }
      : { zh: "做编辑器的团队", en: "teams building an editor" },
  },
  {
    keys: ["animation", "motion"],
    role: (language) => language
      ? { zh: `用 ${language} 做动画的团队`, en: `teams building animation in ${language}` }
      : { zh: "做动画的团队", en: "teams building animation" },
  },
  {
    keys: ["video"],
    role: (language) => language
      ? { zh: `用 ${language} 做视频流程的团队`, en: `teams building a video workflow in ${language}` }
      : { zh: "做视频流程的团队", en: "teams building a video workflow" },
  },
  {
    keys: ["agent", "llm", "ai"],
    role: (language) => language
      ? { zh: `用 ${language} 做智能体流程的团队`, en: `teams building an agent workflow in ${language}` }
      : { zh: "做智能体流程的团队", en: "teams building an agent workflow" },
  },
];

const SHAPE_COPY: Record<MomentumShape, { zh: string; en: string }> = {
  rising: { zh: "上升", en: "rising" },
  "peak-then-fade": { zh: "峰值回落", en: "peak-then-fade" },
  flat: { zh: "平稳", en: "flat" },
};

function capSentence(text: string): string {
  if (!text) return text;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

type AudiencePeerDiff = {
  name: string;
  kind: "language" | "topic";
  detailZh: string;
  detailEn: string;
};

type AudienceFacts = {
  language: string | null;
  topics: string[];
  license: string | null;
  product: boolean;
  summary: string | null;
  shape: MomentumShape | null;
  peer: AudiencePeerDiff | null;
};

function topicRole(topics: string[], language: string | null): TopicRole | null {
  const keys = new Set(topics.map((topic) => topic.toLowerCase()));
  for (const entry of TOPIC_ROLES) {
    if (entry.keys.some((key) => keys.has(key))) return entry.role(language);
  }
  return null;
}

function whoPhrase(facts: AudienceFacts): TopicRole {
  const role = topicRole(facts.topics, facts.language);
  if (role) return role;
  const topicZh = facts.topics.join("、");
  const topicEn = facts.topics.join(", ");
  if (facts.topics.length && facts.language) {
    return { zh: `用 ${facts.language} 做 ${topicZh} 的团队`, en: `teams using ${facts.language} on ${topicEn}` };
  }
  if (facts.topics.length) {
    return { zh: `做 ${topicZh} 的团队`, en: `teams working on ${topicEn}` };
  }
  if (facts.summary && facts.language) {
    return { zh: `以 ${facts.language} 落地仓库说明的团队`, en: `teams using ${facts.language} for the repository summary` };
  }
  if (facts.language) {
    return { zh: `技术栈为 ${facts.language} 的团队`, en: `teams whose stack is ${facts.language}` };
  }
  if (facts.license) {
    return { zh: `需要按 ${facts.license} 许可接入的团队`, en: `teams that need a ${facts.license} license` };
  }
  return { zh: "准备把仓库接进现有工程的团队", en: "teams deciding whether to adopt the repository" };
}

function sentenceOne(facts: AudienceFacts): TopicRole {
  const who = whoPhrase(facts);
  if (facts.summary) {
    return {
      zh: `${who.zh}会用它处理这件事：${facts.summary}。`,
      en: `${capSentence(who.en)} use it for this problem: ${facts.summary}.`,
    };
  }
  if (facts.topics.length) {
    return {
      zh: `${who.zh}会在要把这项工作接进现有流程时用它。`,
      en: `${capSentence(who.en)} use it when that work has to fit an existing workflow.`,
    };
  }
  if (facts.language) {
    return {
      zh: `${who.zh}会在要把这个仓库接进现有流程时用它。`,
      en: `${capSentence(who.en)} use it when they are trying to fit the repository into an existing workflow.`,
    };
  }
  if (facts.license) {
    return {
      zh: `${who.zh}会在确认许可能否进现有工程时用它。`,
      en: `${capSentence(who.en)} use it when the question is whether that license can enter an existing project.`,
    };
  }
  return {
    zh: `${who.zh}会在只能对照公开字段时用它判断要不要继续。`,
    en: `${capSentence(who.en)} use it when the public fields are all they can check.`,
  };
}

function licenseClause(facts: AudienceFacts): TopicRole | null {
  if (!facts.license) return null;
  return facts.product
    ? { zh: `资料里的许可是 ${facts.license}`, en: `the listed license is ${facts.license}` }
    : { zh: `仓库许可为 ${facts.license}`, en: `the repository license is ${facts.license}` };
}

function shapeClause(facts: AudienceFacts): TopicRole | null {
  if (!facts.shape) return null;
  const label = SHAPE_COPY[facts.shape];
  return { zh: `热度走势为${label.zh}`, en: `the momentum shape is ${label.en}` };
}

function sentenceTwo(facts: AudienceFacts): TopicRole {
  const license = licenseClause(facts);
  const shape = shapeClause(facts);
  const extrasZh = [license?.zh, shape?.zh].filter((part): part is string => Boolean(part));
  const extrasEn = [license?.en, shape?.en].filter((part): part is string => Boolean(part));
  const extraZh = extrasZh.length ? `，${extrasZh.join("，")}` : "";
  const extraEn = extrasEn.length ? `, ${extrasEn.join(", and ")}` : "";

  if (facts.peer?.kind === "language" && facts.language) {
    return {
      zh: `需要留在 ${facts.language} 而不是站内同类 ${facts.peer.name} 所用的 ${facts.peer.detailZh} 时优先选它${extraZh}。`,
      en: `Prefer it over the in-site peer ${facts.peer.name} when the stack stays ${facts.language} rather than ${facts.peer.detailEn}${extraEn}.`,
    };
  }
  if (facts.peer?.kind === "topic") {
    const useZh = facts.topics[0] ?? facts.peer.detailZh;
    const useEn = facts.topics[0] ?? facts.peer.detailEn;
    return {
      zh: `用途要落在 ${useZh} 而不是站内同类 ${facts.peer.name} 更偏向的 ${facts.peer.detailZh} 时优先选它${extraZh}。`,
      en: `Prefer it over the in-site peer ${facts.peer.name} when the use stays on ${useEn} rather than ${facts.peer.detailEn}${extraEn}.`,
    };
  }

  const diffsZh: string[] = [];
  const diffsEn: string[] = [];
  if (facts.language) {
    diffsZh.push(`技术栈是 ${facts.language}`);
    diffsEn.push(`the stack stays ${facts.language}`);
  }
  if (facts.topics.length && !facts.language) {
    diffsZh.push(`用途集中在 ${facts.topics.join("、")}`);
    diffsEn.push(`the use stays on ${facts.topics.join(", ")}`);
  }
  if (license) {
    diffsZh.push(license.zh);
    diffsEn.push(license.en);
  }
  if (shape) {
    diffsZh.push(shape.zh);
    diffsEn.push(shape.en);
  }
  if (!diffsZh.length) {
    return {
      zh: "和站内同类相比，要等仓库原文写明语言栈、许可或用途上的差别，才谈得上优先选它。",
      en: "Prefer it over in-site peers only after the repository shows a language-stack, license, or use difference these fields do not name.",
    };
  }
  return {
    zh: `和站内同类相比，优先选它是因为${diffsZh.join("，")}。`,
    en: `Prefer it over in-site peers when ${diffsEn.join(", and ")}.`,
  };
}

function pickAudiencePeer(language: string | null, topics: string[], peers: AudiencePeerHint[] | null | undefined): AudiencePeerDiff | null {
  const hints = peers ?? [];
  for (const peer of hints) {
    const name = cleanPeerName(peer.name);
    const other = usableLanguage(peer.language);
    if (!name || !language || !other || other.toLowerCase() === language.toLowerCase()) continue;
    return { name, kind: "language", detailZh: other, detailEn: other };
  }
  const mine = new Set(topics.map((topic) => topic.toLowerCase()));
  for (const peer of hints) {
    const name = cleanPeerName(peer.name);
    if (!name) continue;
    const different = usableTopicList(peer.topics).find((topic) => !mine.has(topic.toLowerCase()));
    if (!different) continue;
    return { name, kind: "topic", detailZh: different, detailEn: different };
  }
  return null;
}

function audienceSummary(input: AudienceInput): string | null {
  return clipSummarySentence(input.readmeExcerpt) ?? audienceReadmeExcerpt(input.readmeText) ?? clipSummarySentence(input.description);
}

function draftFallback(): AudienceSection {
  return {
    zh: "准备把仓库接进现有工程的团队会在只能对照公开字段时用它判断要不要继续。和站内同类相比，要等仓库原文写明语言栈、许可或用途上的差别，才谈得上优先选它。",
    en: "Teams deciding whether to adopt the repository use it when the public fields are all they can check. Prefer it over in-site peers only after the repository shows a language-stack, license, or use difference these fields do not name.",
    draft: true,
  };
}

/**
 * Two scenario sentences for the pilot audience block.
 *
 * Draft is true unless a problem fact and a difference fact are both present.
 * A problem fact is a specific topic or tag, or a usable README or description
 * summary. A difference fact is a language, a license, a named peer with a
 * different language or topic, or a momentum shape. Thin inputs still return
 * two sentences. Skill flags are ignored. This never returns null.
 */
export function buildAudienceSection(input: AudienceInput): AudienceSection {
  const languageRaw = usableLanguage(input.language);
  const language = languageRaw && !audienceNoise(languageRaw) ? languageRaw : null;
  const topics = usableTopicList([...(input.topics ?? []), ...(input.tags ?? [])]).filter((topic) => !audienceNoise(topic)).slice(0, 3);
  const license = cleanLicense(input.license);
  const summary = audienceSummary(input);
  const shape = input.momentumShape ?? null;
  const peer = pickAudiencePeer(language, topics, input.peers);
  const facts: AudienceFacts = {
    language,
    topics,
    license,
    product: input.projectKind === "product",
    summary,
    shape,
    peer,
  };
  const problem = Boolean(summary || topics.length);
  const difference = Boolean(language || license || peer || shape);
  const first = sentenceOne(facts);
  const second = sentenceTwo(facts);
  const zh = `${first.zh}${second.zh}`;
  const en = `${first.en} ${second.en}`.replace(/ {2,}/g, " ").trim();
  if (audienceNoise(zh) || audienceNoise(en)) return draftFallback();
  return { zh, en, draft: !(problem && difference) };
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
  audience: AudienceSection | null;
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
      view.momentum.dataNoteZh,
      view.momentum.dataNoteEn,
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
    if (view.audience.draft) {
      parts.push(SEO_PILOT_COPY.audienceDraft.zh, SEO_PILOT_COPY.audienceDraft.en);
    }
  }
  return parts.join("\n");
}
