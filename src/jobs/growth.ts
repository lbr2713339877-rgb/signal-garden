/**
 * Growth job: measure how fast each candidate is actually growing, then decide
 * who clears the editorial floor.
 *
 * Runs before scoring. Star history is unavailable from GitHub, so this reads
 * fork timestamps (backfillable) and our own star snapshots (forward-only), and
 * records which of the two the decision rested on.
 */

import { and, desc, eq, gte, inArray, isNull, lt, or, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { project, repoSnapshot } from "@/db/schema";
import { evaluateGate, measureForkGrowth, GATE } from "@/collectors/github/growth";
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

export async function measureGrowth(opts: { limit?: number; force?: boolean } = {}): Promise<JobResult> {
  const limit = opts.limit ?? MEASURE_LIMIT;
  const d = await db();
  const cutoff = new Date(Date.now() - 20 * 3_600_000);
  const now = Date.now();

  // Candidates: parsed, in scope, not junk, above the ranking floor. Repos with
  // plenty of stars do not need measuring to stay visible, so they are skipped
  // once measured — this keeps the request count near the useful set.
  const rows = (await d
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
        gte(project.stars, MIN_STARS_TO_RANK),
        opts.force ? sql`true` : or(isNull(project.growthMeasuredAt), lt(project.growthMeasuredAt, cutoff)),
      ),
    )
    .orderBy(desc(project.focusScore), desc(project.stars))
    .limit(limit)) as any[];

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
