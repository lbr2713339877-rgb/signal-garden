/**
 * Star range shown on the project page: earliest snapshot to latest.
 * The same pair is what the project og:image prints.
 */
export function snapshotStarGrowth(history: { stars: number }[]): {
  pct: number;
  from: number;
  to: number;
  samples: number;
} | null {
  if (history.length < 2) return null;
  const first = history[0];
  const last = history[history.length - 1];
  if (!first?.stars || first.stars <= 0 || !last) return null;
  const pct = ((last.stars - first.stars) / first.stars) * 100;
  return { pct, from: first.stars, to: last.stars, samples: history.length };
}
