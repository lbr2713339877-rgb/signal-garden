/**
 * Public size of one daily edition.
 *
 * The homepage today list, /today, the publisher, and /feed.xml all read this.
 * Another literal for "how many items are in today's selection" would split
 * the product again.
 */
export const TODAY_LIMIT = 10;

/**
 * Unpublished scoring shortlist. It stays wider than the edition so the
 * publication gates can still fill TODAY_LIMIT. It is not a second edition size.
 */
export const SCORING_SHORTLIST = TODAY_LIMIT * 3;

/**
 * Sizes that are intentionally not the daily edition:
 * - `scoreDaily` limit (function default 400, daily job 700): how many repositories enter scoring
 * - `SCORING_SHORTLIST`: how many scored rows stay private before the gates
 * - `getFeatures(6)` on /classic: the short feature strip under the headline
 * - `getFeatures(24)` on /trends and `getRising(8)`: the trend board
 * - `getArchiveEditions`: past publication dates, not today's list
 */
export function siteOrigin(raw = process.env.NEXT_PUBLIC_SITE_URL): string {
  const value = raw?.trim();
  return (value || "http://localhost:3000").replace(/\/+$/, "");
}
