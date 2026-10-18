/**
 * Growth measurement.
 *
 * GitHub closed star history: /stargazers returns 404 for every repository and
 * the GraphQL `stargazers` connection returns an empty edge list with
 * `totalCount: 0`. Verified against large and small repos alike. So "daily star
 * growth" cannot be read from the API at all.
 *
 * Two real sources are left:
 *
 *   1. Fork timestamps. /forks?sort=newest carries `created_at`, pages back
 *      past 30 days, and can be backfilled today. It is a genuine growth
 *      signal — people fork what they intend to use — but it is not stars.
 *   2. Daily star snapshots, which accrue forward from our own captures and
 *      become usable after a week.
 *
 * The gate therefore prefers measured star growth, falls back to fork growth,
 * and treats a project with no measurable growth as unqualified unless it
 * already clears the total-star floor. Nothing here fabricates a star delta.
 */

import { ghGet } from "./client";

const DAY_MS = 86_400_000;
/** Forks per page. GitHub's maximum. */
const PER_PAGE = 100;
/** Stop paging after this many pages; 300 forks/month is far past our range. */
const MAX_PAGES = 3;

export interface GrowthResult {
  forks24h: number;
  forks7d: number;
  forks30d: number;
  /** True when we stopped paging before covering 30 days, so the numbers are a
   *  floor rather than a total. */
  capped: boolean;
}

interface ForkItem {
  created_at: string | null;
}

/**
 * Counts forks created in the last 24h / 7d / 30d by paging newest-first and
 * stopping as soon as a page reaches past 30 days.
 */
export async function measureForkGrowth(fullName: string): Promise<GrowthResult | null> {
  const now = Date.now();
  let forks24h = 0;
  let forks7d = 0;
  let forks30d = 0;
  let capped = true;

  for (let page = 1; page <= MAX_PAGES; page++) {
    const items = await ghGet<ForkItem[]>(
      `/repos/${fullName}/forks?per_page=${PER_PAGE}&sort=newest&page=${page}`,
    );
    if (!items) return null;
    if (items.length === 0) {
      // Ran out of forks: the 30-day window is fully covered.
      capped = false;
      break;
    }

    let reachedPast = false;
    for (const f of items) {
      if (!f.created_at) continue;
      const age = now - new Date(f.created_at).getTime();
      if (age > 30 * DAY_MS) {
        reachedPast = true;
        continue;
      }
      forks30d++;
      if (age <= 7 * DAY_MS) forks7d++;
      if (age <= DAY_MS) forks24h++;
    }

    if (reachedPast) {
      capped = false;
      break;
    }
    if (items.length < PER_PAGE) {
      capped = false;
      break;
    }
  }

  return { forks24h, forks7d, forks30d, capped };
}

/* ---------------------------------------------------------------------------
   The editorial floor (V2 section 二)

   `stars24h >= 50 && stars < 500` is the brief's rule. Since stars24h is not
   obtainable, the fork threshold stands in as a documented substitution: a
   project drawing this many forks in a week is growing by any measure, and it
   lets a small project qualify without waiting for star snapshots to mature.
   ------------------------------------------------------------------------ */

export const GATE = {
  /** A project below this many stars must show growth to be shown. */
  totalStars: 500,
  /** Star growth in 24h that qualifies a small project. */
  stars24h: 50,
  /** Fork growth in 7d that qualifies a small project, in lieu of stars. */
  forks7d: 15,
} as const;

export interface GateInput {
  stars: number;
  stars24h: number | null;
  stars7d: number | null;
  forks7d: number | null;
}

export interface GateResult {
  qualified: boolean;
  /** Which condition admitted it, for the UI badge and for audit. */
  reason: "total-stars" | "star-growth" | "fork-growth" | "unqualified";
  detail: string;
}

export function evaluateGate(input: GateInput): GateResult {
  if (input.stars >= GATE.totalStars) {
    return {
      qualified: true,
      reason: "total-stars",
      detail: `${input.stars} stars，已过 ${GATE.totalStars} 总星门槛`,
    };
  }
  if (input.stars24h !== null && input.stars24h >= GATE.stars24h) {
    return {
      qualified: true,
      reason: "star-growth",
      detail: `24 小时新增 ${input.stars24h} stars`,
    };
  }
  if (input.forks7d !== null && input.forks7d >= GATE.forks7d) {
    return {
      qualified: true,
      reason: "fork-growth",
      detail: `7 天新增 ${input.forks7d} forks（star 历史不可得，用 fork 增长替代衡量）`,
    };
  }
  return {
    qualified: false,
    reason: "unqualified",
    detail: input.stars24h === null
      ? `不足 ${GATE.totalStars} stars，且 star 增长尚不可测，先留库观察`
      : `增长未达门槛（24h +${input.stars24h} stars，7d +${input.forks7d ?? 0} forks）`,
  };
}
