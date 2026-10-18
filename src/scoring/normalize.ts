/**
 * Normalisation helpers for the heat score.
 *
 * Everything is turned into 0-100 before it is weighted, because raw values are
 * not comparable: 200 new stars on a 100k-star repo and 200 new stars on a
 * 300-star repo are different events, and a linear scale lets whichever repo
 * happens to be largest dominate every list.
 */

/**
 * log-scaled share of the day's 95th percentile.
 *
 * Using p95 rather than the max means one outlier cannot compress everyone else
 * toward zero, and using log means the difference between 50 and 500 stars —
 * which matters — is not drowned by the difference between 5,000 and 50,000.
 */
export function logNormalize(value: number, p95: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  const denom = Math.log1p(Math.max(p95, 1));
  if (denom <= 0) return 0;
  return clamp((100 * Math.log1p(value)) / denom, 0, 100);
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

/** Percentile of a sample. Uses nearest-rank; samples here are small. */
export function percentile(values: number[], p: number): number {
  const xs = values.filter((v) => Number.isFinite(v) && v > 0).sort((a, b) => a - b);
  if (!xs.length) return 0;
  const idx = clamp(Math.ceil((p / 100) * xs.length) - 1, 0, xs.length - 1);
  return xs[idx];
}
