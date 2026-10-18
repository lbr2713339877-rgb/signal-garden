/**
 * Growth job: record fork timestamps and our own star snapshots, then decide
 * who clears the editorial floor.
 *
 * Heat ranking uses the snapshot star deltas. forks7d is a separate metric
 * and one input to the gate, not the order of the daily board.
 */

import { and, desc, eq, gte, inArray, isNull, lt, or, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { dailySignal, project, repoSnapshot } from "@/db/schema";
import { evaluateGate, measureForkGrowth, GATE } from "@/collectors/github/growth";
import { signalDate } from "@/lib/day";
import { MIN_STARS_TO_RANK } from "@/scoring/daily";
import { chunk, mapLimit } from "@/lib/concurrency";
import { log, type JobResult } from "./run";

/** Repos at or above this many stars need no growth proof to be considered. */
const MEASURE_LIMIT = 400;
const DAY_MS = 86_400_000;

/**
 * Star delta from our own snapshots. Returns null when no snapshot is old
 * enough to answer the question — never a guess.
 */
function starDelta(
  snaps: { capturedAt: Date; stars: number }[],
  currentStars: number,
  daysAgo: number,
  now: number,
): number | null {
  const target = now - daysAgo * DAY_MS;
  let best: { capturedAt: Date; stars: number } | null = null;
  for (const s of snaps) {
    if (new Date(s.capturedAt).getTime() > target) continue;
    if (!best || new Date(s.capturedAt).getTime() > new Date(best.capturedAt).getTime()) best = s;
  }
  return best ? Math.max(0, currentStars - best.stars) : null;
}

/** `today` or `YYYY-MM-DD`. */
export function editionDate(value: string, now = new Date()): string {
  if (value === "today") return signalDate(now);
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  throw new Error(`growth --edition expects today or YYYY-MM-DD, got ${value}`);
}

export async function publishedProjectIds(date: string): Promise<string[]> {
  const d = await db();
  const rows = await d
    .select({ id: dailySignal.projectId })
    .from(dailySignal)
    .where(and(eq(dailySignal.signalDate, date), eq(dailySignal.isPublished, true)));
  return rows.map((row) => row.id);
}

const EMPTY_GROWTH: JobResult = {
  itemsIn: 0,
  itemsOut: 0,
  meta: { qualified: 0, rising: 0, gate: GATE, failures: [] },
};

/**
 * Candidates for a growth pass.
 * Never-measured rows come first, then higher focus, then more stars.
 * An explicit id list skips the 20-hour freshness cutoff and the focus cap.
 */
export async function selectGrowthCandidates(opts: { limit?: number; force?: boolean; ids?: string[] } = {}) {
  if (opts.ids && opts.ids.length === 0) return [];
  const limit = opts.limit ?? MEASURE_LIMIT;
  const d = await db();
  const cutoff = new Date(Date.now() - 20 * 3_600_000);
  const targeted = Boolean(opts.ids);
  const query = d
    .select({
      id: project.id,
      fullName: project.fullName,
      stars: project.stars,
      forks: project.forks,
      forks7d: project.forks7d,
      isRising: project.isRising,
      firstSeenAt: project.firstSeenAt,
    })
    .from(project)
    .where(
      and(
        eq(project.parseState, "parsed"),
        eq(project.hidden, false),
        isNull(project.junkReason),
        eq(project.isSkillCollection, false),
        isNull(project.duplicateOf),
        eq(project.linkStatus, "ok"),
        targeted ? inArray(project.id, opts.ids!) : gte(project.stars, MIN_STARS_TO_RANK),
        targeted || opts.force ? sql`true` : or(isNull(project.growthMeasuredAt), lt(project.growthMeasuredAt, cutoff)),
      ),
    )
    .orderBy(sql`${project.growthMeasuredAt} IS NOT NULL`, desc(project.focusScore), desc(project.stars));
  const rows = targeted ? await query : await query.limit(limit);
  return rows;
}

export async function measurePublishedEdition(date = signalDate()): Promise<JobResult> {
  return measureGrowth({ ids: await publishedProjectIds(date) });
}

export async function measureGrowth(opts: { limit?: number; force?: boolean; ids?: string[] } = {}): Promise<JobResult> {
  if (opts.ids && opts.ids.length === 0) {
    log("growth", "0 candidates to measure");
    return EMPTY_GROWTH;
  }
  const d = await db();
  const now = Date.now();
  const rows = await selectGrowthCandidates(opts);

  log("growth", `${rows.length} candidates to measure`);

  // Star snapshots for the projects in this run.
  const snapsByProject = new Map<string, { capturedAt: Date; stars: number }[]>();
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
  }

  let measured = 0;
  let qualified = 0;
  let rising = 0;
  const failures: string[] = [];

  await mapLimit(rows, 6, async (r) => {
    const snaps = snapsByProject.get(r.id) ?? [];
    const stars24h = starDelta(snaps, r.stars, 1, now);
    const stars7d = starDelta(snaps, r.stars, 7, now);

    if (!r.fullName) {
      failures.push(`${r.id}: no repository name`);
      return;
    }
    const fork = await measureForkGrowth(r.fullName);
    if (!fork) {
      // 404 or already gone; leave the row for the next run.
      failures.push(`${r.fullName}: forks unavailable`);
      return;
    }

    const gate = evaluateGate({
      stars: r.stars,
      stars24h,
      stars7d,
      forks7d: fork.forks7d,
    });

    // A project that only now clears the floor was tracked before it qualified.
    const isRising = gate.qualified && !r.isRising && starDelta(snaps, r.stars, 1, now) !== null
      ? true
      : r.isRising;

    await d
      .update(project)
      .set({
        forks24h: fork.forks24h,
        forks7d: fork.forks7d,
        forks30d: fork.forks30d,
        stars24h,
        stars7d,
        growthMeasuredAt: new Date(now),
        isRising,
        updatedAt: new Date(now),
      })
      .where(eq(project.id, r.id));

    measured++;
    if (gate.qualified) qualified++;
    if (isRising) rising++;
    if (measured % 50 === 0) log("growth", `${measured}/${rows.length} · ${qualified} qualified`);
  });

  log(
    "growth",
    `${measured} measured · ${qualified} past the gate · ${rising} marked rising` +
      (failures.length ? ` · ${failures.length} unavailable` : ""),
  );

  return {
    itemsIn: rows.length,
    itemsOut: measured,
    meta: { qualified, rising, gate: GATE, failures: failures.slice(0, 10) },
  };
}
