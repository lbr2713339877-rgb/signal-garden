function finiteCount(value: number | null | undefined): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.trunc(value);
}

/** Fork count when measured. Otherwise a 24-hour star delta, labeled as stars. Null omits the line. */
export function projectOgStat(input: {
  forks7d: number | null;
  stars24h?: number | null;
  missing?: boolean;
}): { value: string; label: string } | null {
  if (input.missing) return null;
  const forks = finiteCount(input.forks7d);
  if (forks !== null) return { value: String(forks), label: "7-day new forks · 7 日新增 fork" };
  const stars = finiteCount(input.stars24h);
  if (stars !== null) return { value: `+${stars}`, label: "stars / 24h" };
  return null;
}

/** Empty string when the 7-day fork count was not measured. Never a dash. */
export function todayOgForkCell(forks7d: number | null): string {
  const forks = finiteCount(forks7d);
  return forks === null ? "" : String(forks);
}
