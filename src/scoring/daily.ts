/**
 * Daily ranking (brief section 七).
 *
 * Two passes, because normalisation needs the whole pool:
 *   1. gather every candidate with its history, build the shared basis
 *   2. score each one against that basis, rank, write daily_signal
 *
 * Honesty rules enforced here:
 *   - a project needs history to claim growth; with one snapshot the growth
 *     terms are zero and the reason says "no growth signal" rather than
 *     inventing a percentage
 *   - a spike of >5x the 7-day average goes to needs_review and is not ranked
 *   - rows for the day are replaced, not appended to, so re-running is safe
 */

import { and, desc, eq, gte, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { dailySignal, externalMention, project, repoSnapshot } from "@/db/schema";
import { computeHeat, heatBasis, isSpike, type HeatInput } from "@/scoring/heat";
import { FOCUS_MIN } from "@/normalizers/focus";
import { chunk } from "@/lib/concurrency";
import { TODAY_LIMIT } from "@/lib/edition";
import { log, type JobResult } from "../jobs/run";
import { signalDate } from "@/lib/day";
import { notPreviouslyFeatured } from "./exposure";
import { discoveryTraction, reviewedDiscovery } from "@/normalizers/discovery-policy";

const DAY_MS = 86_400_000;

/**
 * Minimum traction to be ranked at all.
 *
 * Without it the first daily run put a 0-star and a 2-star repo in the top
 * ten: with no growth history the score leans on commit counts and docs, and
 * a brand-new repo nobody has starred can post 200 commits of scaffolding.
 * Commit activity is a maintenance signal, not a traction signal, and it
 * cannot carry a project on its own.
 */
export const MIN_STARS_TO_RANK = 20;

interface Candidate {
  id: string;
  slug: string;
  fullName: string | null;
  stars: number;
  forks: number;
  commits7d: number;
  createdAt: Date | null;
  pushedAt: Date | null;
  docs: any;
  hasSkillMd: boolean;
  validSkillMdCount: number;
  skillMdCount: number;
  hasInstallation: boolean;
  isFork: boolean;
  isDuplicate: boolean;
  securityLevel: string;
  linkDead: boolean;
  focusScore: number;
}

/** Star count closest to `daysAgo`, if a snapshot that old exists. */
function starsAt(snaps: { capturedAt: Date; stars: number }[], daysAgo: number, now: number): number | null {
  const target = now - daysAgo * DAY_MS;
  let best: { capturedAt: Date; stars: number } | null = null;
  for (const s of snaps) {
    // Only accept a snapshot at least this old; anything newer cannot answer
    // "how many stars did it have 7 days ago".
    if (new Date(s.capturedAt).getTime() > target) continue;
    if (!best || new Date(s.capturedAt).getTime() > new Date(best.capturedAt).getTime()) best = s;
  }
  return best ? best.stars : null;
}

export async function scoreDaily(opts: { limit?: number; top?: number } = {}): Promise<JobResult> {
  const d = await db();
  // `limit` is the scoring pool, not the published edition.
  const limit = opts.limit ?? 400;
  const top = opts.top ?? TODAY_LIMIT;
  const now = Date.now();
  const today = signalDate(new Date(now));

  // --- Pass 1: candidates -------------------------------------------------
  const rows = (await d
    .select({
      id: project.id,
      slug: project.slug,
      fullName: project.fullName,
      stars: project.stars,
      forks: project.forks,
      commits7d: project.commits7d,
      createdAt: project.upstreamCreatedAt,
      pushedAt: project.upstreamPushedAt,
      docs: project.docSignals,
      hasSkillMd: project.hasSkillMd,
      validSkillMdCount: sql<number>`coalesce((${project.docSignals}->>'validSkillMdCount')::int, 0)`,
      skillMdCount: project.skillCount,
      requiresApiKey: project.requiresApiKey,
      isFork: sql<boolean>`${project.forkOf} IS NOT NULL`,
      isDuplicate: sql<boolean>`${project.duplicateOf} IS NOT NULL`,
      securityLevel: project.securityLevel,
      linkStatus: project.linkStatus,
      focusScore: project.focusScore,
      installCommands: project.installCommands,
      contributors: project.contributors,
    })
    .from(project)
    .where(
      and(
        eq(project.parseState, "parsed"),
        eq(project.hidden, false),
        isNull(project.junkReason),
        eq(project.isSkillCollection, false),
        isNull(project.duplicateOf),
        gte(project.focusScore, FOCUS_MIN),
        discoveryTraction(),
        sql`(NOT ('play' = ANY(${project.focusThemes})) OR ${reviewedDiscovery()})`,
        notPreviouslyFeatured(today),
      ),
    )
    /* Candidate selection must be *movement* first, not size first.
       Ordering by total stars meant the top 400 were always the same handful of
       mega-repos, so a 1.4k-star project that gained 711 stars today never even
       reached the scorer — and the published board was near-identical every day.
       Ordering by today's delta lets genuinely rising projects compete; total
       stars remain the tie-break so a quiet day still favours established work.
       COALESCE keeps projects whose delta was never measured (NULL) in the pool
       rather than silently excluding them. */
    .orderBy(
      desc(sql`'play' = ANY(${project.focusThemes})`),
      desc(sql`coalesce(${project.stars24h}, 0)`),
      desc(sql`coalesce(${project.forks7d}, 0)`),
      desc(project.stars),
      desc(project.focusScore),
    )
    .limit(limit)) as any[];

  log("score", `${rows.length} candidates`);

  // History and mentions, fetched in slices to keep the IN lists sane.
  const snapsByProject = new Map<string, { capturedAt: Date; stars: number }[]>();
  const mentionsByProject = new Map<string, { points: number; comments: number; publishedAt: Date | null }[]>();
  for (const ids of chunk<string>(rows.map((r) => r.id), 200)) {
    const snaps = await d
      .select({ projectId: repoSnapshot.projectId, capturedAt: repoSnapshot.capturedAt, stars: repoSnapshot.stars })
      .from(repoSnapshot)
      .where(inArray(repoSnapshot.projectId, ids))
      .orderBy(repoSnapshot.capturedAt);
    for (const s of snaps) {
      const list = snapsByProject.get(s.projectId) ?? [];
      list.push({ capturedAt: s.capturedAt as Date, stars: s.stars });
      snapsByProject.set(s.projectId, list);
    }

    const mentions = await d
      .select({
        projectId: externalMention.projectId,
        points: externalMention.points,
        comments: externalMention.comments,
        publishedAt: externalMention.publishedAt,
      })
      .from(externalMention)
      .where(inArray(externalMention.projectId, ids));
    for (const m of mentions) {
      const list = mentionsByProject.get(m.projectId) ?? [];
      list.push({ points: m.points, comments: m.comments, publishedAt: m.publishedAt as Date | null });
      mentionsByProject.set(m.projectId, list);
    }
  }

  const candidates: Candidate[] = rows.map((r) => ({
    ...r,
    docs: (r.docs ?? {}) as any,
    hasInstallation: ((r.installCommands ?? []) as any[]).length > 0,
    linkDead: r.linkStatus === "dead",
  }));

  const heatInputs: HeatInput[] = candidates.map((c) => {
    const snaps = snapsByProject.get(c.id) ?? [];
    return {
      slug: c.slug,
      stars: c.stars,
      forks: c.forks,
      stars24hAgo: starsAt(snaps, 1, now),
      stars7dAgo: starsAt(snaps, 7, now),
      commits7d: c.commits7d,
      issuesOpened7d: 0, // needs an issue-history pass; not fabricated
      externalMentions: mentionsByProject.get(c.id) ?? [],
      createdAt: c.createdAt ? new Date(c.createdAt) : null,
      pushedAt: c.pushedAt ? new Date(c.pushedAt) : null,
      docs: {
        hasReadme: !!c.docs.hasReadme,
        readmeLength: Number(c.docs.readmeLength ?? 0),
        hasInstallSection: !!c.docs.hasInstallSection,
        hasInstallCommand: !!c.docs.hasInstallCommand,
        hasExamples: !!c.docs.hasExamples,
        hasLicense: !!c.docs.hasLicense,
        validSkillMdCount: c.validSkillMdCount,
      },
      hasSkillMd: c.hasSkillMd,
      validSkillMdCount: c.validSkillMdCount,
      skillMdCount: c.skillMdCount,
      hasInstallation: c.hasInstallation,
      hasMaintainerCommit: c.commits7d > 0,
      isFork: c.isFork,
      isDuplicate: c.isDuplicate,
      securityLevel: c.securityLevel,
      linkDead: c.linkDead,
      starsAtDiscovery: c.stars,
    };
  });

  // --- Pass 2: score, rank, review ---------------------------------------
  const basis = heatBasis(heatInputs);
  const scored = candidates.map((c, i) => ({ c, r: computeHeat(heatInputs[i], basis, new Date(now)) }));

  const flagged = scored.filter((s) => {
    const snaps = snapsByProject.get(s.c.id) ?? [];
    const avg7 = averageDailyGrowth(snaps);
    return isSpike(s.r.breakdown.metrics.star_growth_24h, avg7);
  });
  const eligible = scored.filter(s => !flagged.includes(s)).sort((a, b) => b.r.heatScore - a.r.heatScore);
  // Keep reviewed discoveries in the private shortlist even before star history accumulates.
  const discoveries = eligible.filter(s => s.c.docs?.discoveryReview?.passed && s.c.docs?.discoveryReview?.interesting).slice(0, Math.min(20, Math.floor(top / 4)));
  const ranked = [...new Set([...discoveries, ...eligible])].slice(0, top).sort((a, b) => b.r.heatScore - a.r.heatScore);

  log("score", `${ranked.length} ranked · ${flagged.length} held for review`);

  // Candidates are private. Keep the current edition visible until publish
  // atomically replaces it, even if scoring or AI generation fails on a rerun.
  await d.delete(dailySignal).where(and(eq(dailySignal.signalDate, today), eq(dailySignal.isPublished, false)));

  for (const [i, s] of ranked.entries()) {
    await d.insert(dailySignal).values({
      signalDate: today,
      projectId: s.c.id,
      rank: i + 1,
      heatScore: s.r.heatScore,
      breakdown: s.r.breakdown,
      reason: s.r.reason,
      window: "7d",
      isPublished: false,
    }).onConflictDoNothing();

    // Cache the headline numbers on the project, and let real history refine
    // the activity status.
    await d
      .update(project)
      .set({
        heatScoreLatest: s.r.heatScore,
        heatComputedAt: new Date(now),
        qualityGrade: s.r.qualityGrade,
        // Growth status needs 7-day history; without it, keep the activity
        // status enrich derived rather than overwriting it with a guess.
        ...(heatInputs[scored.indexOf(s)].stars7dAgo !== null ? { status: s.r.status } : {}),
      })
      .where(eq(project.id, s.c.id));
  }

  for (const f of flagged) {
    await d
      .insert(dailySignal)
      .values({
        signalDate: today,
        projectId: f.c.id,
        rank: 0,
        heatScore: f.r.heatScore,
        breakdown: f.r.breakdown,
        reason: f.r.reason,
        window: "7d",
        isPublished: false,
        needsReview: true,
      })
      .onConflictDoNothing();
  }

  const withHistory = heatInputs.filter((h) => h.stars7dAgo !== null).length;
  log("score", `${withHistory}/${heatInputs.length} had 7-day history; the rest report no growth signal`);

  return {
    itemsIn: candidates.length,
    itemsOut: ranked.length,
    meta: { date: today, flagged: flagged.length, withHistory, basis },
  };
}

function averageDailyGrowth(snaps: { capturedAt: Date; stars: number }[]): number {
  if (snaps.length < 2) return 0;
  const sorted = [...snaps].sort((a, b) => +new Date(a.capturedAt) - +new Date(b.capturedAt));
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const days = (+new Date(last.capturedAt) - +new Date(first.capturedAt)) / DAY_MS;
  if (days <= 0) return 0;
  return (last.stars - first.stars) / days;
}
