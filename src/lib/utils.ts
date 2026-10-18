import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formats a growth figure the way the product requires: never a bare
 * percentage. Every percentage shown to a user carries its window.
 *
 *   formatGrowth(328, "24h")  ->  "+328% / 24h"
 *   formatGrowth(-12, "7d")   ->  "−12% / 7d"
 */
export function formatGrowth(pct: number, window: string): string {
  const sign = pct > 0 ? "+" : pct < 0 ? "−" : "";
  const abs = Math.abs(pct);
  // Past 999% the exact number stops being informative; it is noise.
  const value = abs >= 1000 ? "999+" : String(Math.round(abs));
  return `${sign}${value}% / ${window}`;
}

/** Compact star counts: 1240 -> "1.2k". */
export function formatCount(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0)}k`;
  return `${(n / 1_000_000).toFixed(1)}M`;
}

/** Rank numerals are always two digits, always mono. */
export function formatRank(n: number): string {
  return String(n).padStart(2, "0");
}

export function toSlug(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/** Counts Chinese characters, which is what the AI guards constrain. */
export function chineseLength(s: string): number {
  return (s.match(/[一-鿿]/g) ?? []).length;
}
