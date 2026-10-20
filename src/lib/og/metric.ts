import { formatCount } from "@/lib/utils";

function finiteCount(value: number | null | undefined): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.trunc(value);
}

function finiteHeat(value: number | null | undefined): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return null;
  return value;
}

function formatHeat(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

/**
 * Project share card. The big line is the same star range as the project page
 * (`592 → 924 stars`), or a recent star delta when that range does not exist.
 * The small line is the heat score. Forks are not the ranking metric.
 */
export function projectOgStat(input: {
  starsFrom?: number | null;
  starsTo?: number | null;
  starsRecent?: number | null;
  heatScore?: number | null;
  missing?: boolean;
}): { value: string; label: string } | null {
  if (input.missing) return null;
  const from = finiteCount(input.starsFrom);
  const to = finiteCount(input.starsTo);
  const recent = finiteCount(input.starsRecent);
  const heat = finiteHeat(input.heatScore);
  const heatLabel = heat !== null ? `热度分 ${formatHeat(heat)}` : "按热度分";
  if (from !== null && to !== null && from > 0) {
    return { value: `${formatCount(from)} → ${formatCount(to)} stars`, label: heatLabel };
  }
  if (recent !== null && recent !== 0) {
    const sign = recent > 0 ? "+" : "−";
    return { value: `近期 ${sign}${formatCount(Math.abs(recent))}`, label: heatLabel };
  }
  if (heat !== null) return { value: formatHeat(heat), label: "热度分" };
  return null;
}

/** Empty string when the 7-day fork count was not measured. Never a dash. */
export function todayOgForkCell(forks7d: number | null): string {
  const forks = finiteCount(forks7d);
  return forks === null ? "" : String(forks);
}
