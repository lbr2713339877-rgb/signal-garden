/**
 * Heat score.
 *
 * The result is deliberately NOT a quality judgement and the UI must never
 * present it as one. It answers exactly one question: is this growing right
 * now? Quality, maintenance and security are computed and shown separately.
 *
 * Two departures from a naive weighted sum, both learned from the first live
 * run:
 *
 *  1. Every input is normalised against the day's p95 before weighting. A raw
 *     weighted sum lets a single 500k-star repo dominate every list.
 *  2. A repo younger than 14 days is scored on absolute growth, not growth
 *     rate. Otherwise "3 stars to 30" reads as +900% and wins everything.
 */

import type { ProjectStatus } from "@/db/schema";
import { clamp, logNormalize, percentile } from "./normalize";
import { documentationScore, freshnessScore, skillCompleteness, type DocFacts } from "./freshness";

export interface HeatInput {
  slug: string;
  stars: number;
  forks: number;
  stars24hAgo: number | null;
  stars7dAgo: number | null;
  commits7d: number;
  issuesOpened7d: number;
  externalMentions: { points: number; comments: number; publishedAt?: Date | string | null }[];
  createdAt: Date | null;
  pushedAt: Date | null;
  docs: DocFacts;
  hasSkillMd: boolean;
  validSkillMdCount: number;
  skillMdCount: number;
  hasInstallation: boolean;
  hasMaintainerCommit: boolean;
  /** Distinct contributors, when the API reported them. 0 means unknown. */
  contributors?: number;
  isFork: boolean;
  isDuplicate: boolean;
  securityLevel: string;
  linkDead: boolean;
  starsAtDiscovery: number;
}

export interface HeatCorrection {
  code: string;
  factor: number;
  note: string;
}

export interface HeatResult {
  heatScore: number;
  breakdown: {
    metrics: Record<string, number>;
    normalized: Record<string, number>;
    weighted: Record<string, number>;
    corrections: HeatCorrection[];
    window: string;
  };
  /** Chinese sentence for the card. */
  reason: string;
  status: ProjectStatus;
  qualityGrade: string;
}

/**
 * Dimension weights. They must sum to 1.0.
 *
 * The board has to change every day, and only *delta* metrics can do that.
 * `star_growth_24h` is therefore the single heaviest term: it is measured
 * against a snapshot from yesterday, so a repo that moved today outranks one
 * that merely has a large back catalogue.
 *
 * Everything else here (commits, documentation, usability) is a *stock* metric
 * — it describes what a project is, not what it did today — so their combined
 * weight is deliberately kept below the two growth terms. The previous table
 * had no 24h term at all and put 0.43 behind 7-day growth, which is zero until a
 * week of snapshots exists; the effective score collapsed onto the stock
 * metrics and the ranking was identical day after day.
 */
const WEIGHTS = {
  star_growth_24h: 0.45,
  star_growth: 0.12,
  growth_rate: 0.08,
  commit_activity: 0.06,
  external_discussion: 0.12,
  freshness: 0.04,
  documentation: 0.04,
  usability: 0.09,
} as const;

const NEW_REPO_DAYS = 14;

/**
 * Normalisation baselines, computed once for the whole candidate pool.
 *
 * This has to be a separate pass. Deriving the baseline from the item being
 * scored makes every item its own maximum: a repo gaining 3 stars and one
 * gaining 3,000 would both normalise to 100, and the ranking would be decided
 * by nothing at all.
 *
 * Floors keep small pools honest — on a quiet day "20 new stars" is still a
 * real signal, and on a two-project local run the numbers stay comparable.
 */
export interface HeatBasis {
  starGrowth7d: number;
  starGrowth24h: number;
  commits7d: number;
  external: number;
  newRepoStars: number;
}

export function heatBasis(items: HeatInput[]): HeatBasis {
  const collect = (fn: (i: HeatInput) => number) => items.map(fn).filter((v) => Number.isFinite(v) && v > 0);
  return {
    starGrowth7d: Math.max(percentile(collect(starGrowth), 95), 200),
    starGrowth24h: Math.max(percentile(collect(starGrowth24h), 95), 50),
    commits7d: Math.max(percentile(collect((i) => i.commits7d), 95), 20),
    external: Math.max(percentile(collect((i) => externalScore(i)), 95), 10),
    newRepoStars: Math.max(percentile(collect((i) => i.stars), 95), 500),
  };
}

function starGrowth(i: HeatInput): number {
  return i.stars7dAgo === null ? 0 : Math.max(0, i.stars - i.stars7dAgo);
}
function starGrowth24h(i: HeatInput): number {
  return i.stars24hAgo === null ? 0 : Math.max(0, i.stars - i.stars24hAgo);
}
/**
 * Discussion score, decayed by age.
 *
 * An unbounded total let a project coast on an old front-page post: shadcn had
 * ~95 points of mentions and stayed at the top without any movement that day.
 * A mention only counts for 14 days, halving every week, so the term tracks
 * "is this being talked about *now*" rather than "was it ever".
 */
const MENTION_HALFLIFE_DAYS = 7;
const MENTION_MAX_AGE_DAYS = 14;

function externalScore(i: HeatInput, nowMs = Date.now()): number {
  let total = 0;
  for (const m of i.externalMentions) {
    const raw = m.points / 10 + m.comments / 5;
    if (!m.publishedAt) {
      // No date: count it, but at a reduced weight so undated history cannot
      // outrank a dated, recent mention.
      total += raw * 0.5;
      continue;
    }
    const ageDays = (nowMs - new Date(m.publishedAt).getTime()) / 86_400_000;
    if (!Number.isFinite(ageDays) || ageDays > MENTION_MAX_AGE_DAYS) continue;
    const decay = Math.pow(0.5, Math.max(0, ageDays) / MENTION_HALFLIFE_DAYS);
    total += raw * decay;
  }
  return total;
}

/**
 * Usability: can a developer actually put this to work?
 *
 * Deliberately evidence-based — it only rewards things we parsed:
 *   - a recognised install path (npm / pip / CDN)          → 0.45
 *   - an API / usage section in the README                 → 0.25
 *   - an examples or quickstart section                    → 0.15
 *   - a README long enough to document real behaviour      → 0.15
 *
 * A repo that only ships SKILL.md and no code earns none of this, which is the
 * point: being an AI skill is not itself a usability signal.
 */
function usabilityScore(i: HeatInput): number {
  let score = 0;
  if (i.hasInstallation) score += 0.45;
  if (i.docs.hasInstallSection) score += 0.25;
  if (i.docs.hasExamples) score += 0.15;
  if (i.docs.readmeLength >= 1500) score += 0.15;
  return clamp(score, 0, 1);
}

export function qualityGrade(docs: DocFacts, securityLevel: string): string {
  const base = documentationScore(docs);
  let score = base;
  if (securityLevel === "risk") score -= 20;
  const grade =
    score >= 90 ? "A" : score >= 75 ? "A-" : score >= 60 ? "B+" : score >= 45 ? "B" : score >= 30 ? "C+" : score >= 15 ? "C" : "D";
  return grade;
}

/** Growth status. Only called with real history, never from a single snapshot. */
export function deriveGrowthStatus(
  growth7dPct: number | null,
  commits7d: number,
  daysSincePush: number,
  current: ProjectStatus,
): ProjectStatus {
  if (current === "archived") return "archived";
  if (daysSincePush > 90) return "stale";
  if (growth7dPct === null) return current;
  if (growth7dPct >= 25 && commits7d > 0) return "surging";
  if (growth7dPct >= 3) return "steady";
  if (growth7dPct < 0 && commits7d === 0) return "slowing";
  return current;
}

export function computeHeat(input: HeatInput, basis: HeatBasis, now = new Date()): HeatResult {
  const nowMs = now.getTime();
  const days = (d: Date | null) => (d ? (nowMs - new Date(d).getTime()) / 86_400_000 : Infinity);

  const isNewRepo = days(input.createdAt) <= NEW_REPO_DAYS;

  const growth7d = starGrowth(input);
  const growth24h = starGrowth24h(input);
  const growthRate = input.stars7dAgo && input.stars7dAgo > 0 ? (growth7d / input.stars7dAgo) * 100 : 0;
  const external = externalScore(input, nowMs);
  const usable = usabilityScore(input);

  const metrics = {
    star_growth: growth7d,
    star_growth_24h: growth24h,
    growth_rate: Math.round(growthRate * 100) / 100,
    commit_activity: input.commits7d,
    issue_activity: input.issuesOpened7d,
    external_mentions: Math.round(external * 100) / 100,
    usability: Math.round(usable * 100) / 100,
  };

  const normalized = {
    star_growth_24h: logNormalize(growth24h, basis.starGrowth24h),
    star_growth: logNormalize(growth7d, basis.starGrowth7d),
    growth_rate: isNewRepo
      ? // A brand-new repo's rate is noise — 3 stars to 30 reads as +900%.
        // Fall back to absolute size on the pool's scale instead.
        logNormalize(input.stars, basis.newRepoStars)
      : clamp(growthRate * 2, 0, 100),
    commit_activity: logNormalize(input.commits7d, basis.commits7d),
    external_discussion: logNormalize(external, basis.external),
    freshness: freshnessScore(input.createdAt, now),
    documentation: documentationScore(input.docs),
    usability: usable,
  };

  const weighted: Record<string, number> = {};
  let base = 0;
  for (const [k, w] of Object.entries(WEIGHTS)) {
    const v = normalized[k as keyof typeof normalized] * w;
    weighted[k] = v;
    base += v;
  }

  const corrections: HeatCorrection[] = [];
  const add = (code: string, factor: number, note: string) => corrections.push({ code, factor, note });

  if (input.hasSkillMd && input.validSkillMdCount > 0) add("skill_md", 1.1, "SKILL.md 且 frontmatter 完整");
  if (input.hasInstallation) add("install", 1.05, "有可解析的安装说明");
  if (input.commits7d > 0) add("maintainer", 1.05, "近 7 天有提交");
  if (input.docs.hasExamples) add("examples", 1.05, "有可运行示例");

  /* A single-maintainer early project is not disqualifying, but it should not
     outrank a well-adopted library just because it happens to carry SKILL.md.
     Down-weight it, and let the reason say why. */
  if (input.contributors && input.contributors <= 1 && input.stars < 100) {
    add("early_solo", 0.85, "单人维护、早期项目");
  }
  if (days(input.pushedAt) > 90) add("stale", 0.8, "超过 90 天没有提交");
  if (input.docs.readmeLength < 300) add("thin_docs", 0.9, "README 不足 300 字");
  if (input.isDuplicate) add("duplicate", 0.8, "疑似复制品");
  if (input.isFork) add("fork", 0.8, "是 Fork，不计为独立项目");
  if (input.securityLevel === "unknown") add("risk_unknown", 0.9, "安全风险未知");
  if (input.linkDead) add("dead_link", 0.7, "链接被反馈为失效");

  const factor = clamp(corrections.reduce((a, c) => a * c.factor, 1), 0.3, 2);
  const heatScore = Math.round(clamp(base * factor, 0, 100) * 10) / 10;

  const growth7dPct = input.stars7dAgo && input.stars7dAgo > 0 ? growthRate : null;
  const status = deriveGrowthStatus(growth7dPct, input.commits7d, days(input.pushedAt), "steady");

  return {
    heatScore,
    breakdown: { metrics, normalized, weighted, corrections, window: "7d" },
    reason: buildReason(metrics, input),
    status,
    qualityGrade: qualityGrade(input.docs, input.securityLevel),
  };
}

/**
 * The card sentence. Built from the numbers that actually drove the score, so
 * it explains the ranking instead of decorating it.
 */
/**
 * The card sentence. A library and an AI skill are explained in the vocabulary
 * that fits them: a resource is something you install or import and use for a
 * job, a skill is a capability an agent can call. Using the skill phrasing on a
 * library ("提供 X 能力，可在 Y 中使用") reads like a template.
 */
function buildReason(metrics: Record<string, number>, input: HeatInput): string {
  const parts: string[] = [];
  const isResource = !input.hasSkillMd && (input.hasInstallation || input.docs.hasInstallSection);

  if (metrics.star_growth_24h > 0) parts.push(`今天新增 ${Math.round(metrics.star_growth_24h)} Stars`);
  else if (metrics.star_growth > 0) parts.push(`最近 7 天新增 ${Math.round(metrics.star_growth)} Stars`);

  /* Commits are a stock metric; only lead with them when nothing moved today,
     otherwise every card reads "7 天内有 N 次提交" regardless of the day. */
  if (metrics.star_growth_24h === 0 && metrics.commit_activity > 0) {
    parts.push(`7 天内有 ${Math.round(metrics.commit_activity)} 次提交`);
  }
  if (metrics.external_mentions > 0) parts.push("在 Hacker News 等社区出现讨论");

  if (isResource) {
    if (input.hasInstallation) parts.push("可直接安装或引入项目");
    else if (input.docs.hasInstallSection) parts.push("文档里有明确的接入方式");
    if (input.docs.hasExamples) parts.push("附带可运行示例");
  } else if (input.hasSkillMd) {
    parts.push("提供可被 AI agent 调用的能力");
  }

  if (input.contributors && input.contributors <= 1 && input.stars < 100) {
    parts.push("单人维护、早期项目");
  }

  if (!parts.length) {
    parts.push(input.stars > 0 ? `累计 ${input.stars} Stars` : "暂无增长信号");
  }

  return parts.slice(0, 3).join("，") + "。";
}

/**
 * Spike detection: a day-over-day jump this large is usually a promotion or a
 * misunderstanding, not organic growth, so it waits for a human.
 *
 * There is also an absolute floor. A project that has been adding ~0.4 stars a
 * day and then adds 4 is technically a 10x jump, but nobody is promoting it —
 * the previous pool only contained mega-repos so this never surfaced, and once
 * smaller projects entered the pool the ratio test held back eleven of them on
 * rounding-level moves. A day has to clear a real threshold before the ratio
 * means anything.
 */
export const SPIKE_MULTIPLE = 5;
/** A move smaller than this is noise, whatever its ratio. */
export const SPIKE_MIN_ABSOLUTE = 50;

export function isSpike(today: number, previous7dAverage: number): boolean {
  if (today < SPIKE_MIN_ABSOLUTE) return false;
  if (previous7dAverage <= 0) return false;
  return today > previous7dAverage * SPIKE_MULTIPLE;
}

export { percentile };
