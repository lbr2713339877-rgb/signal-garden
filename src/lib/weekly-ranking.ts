/**
 * This week's heat Top 10.
 *
 * Same window and order as the Monday digest: the last 7 published daily
 * editions, each day's #1 (already ranked by that day's heat), then the #2s,
 * until 10. It does not compute a second score.
 */
import { pickWeeklySample, type WeeklySampleCard, type WeeklySampleItem } from "./weekly-sample";

export const WEEKLY_WINDOW_DAYS = 7;
export const WEEKLY_HEAT_TOP = 10;

export interface WeeklyEdition<T> {
  date: string;
  cards: T[];
}

export interface WeeklyTodayEdition<T> extends WeeklyEdition<T> {
  /** True when the feed is showing an older edition because today is unpublished. */
  isPrevious: boolean;
}

/** YYYY-MM-DD from a date column, an ISO string, or a Date. */
export function editionDay(value: unknown): string {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  const text = typeof value === "string" ? value : value == null ? "" : String(value);
  const match = text.match(/\d{4}-\d{2}-\d{2}/);
  return match ? match[0] : text;
}

/**
 * Today's published edition when it is actually today, then older published
 * editions until `days`. Yesterday shown as a feed fallback is left to the
 * archive so the same day is not counted twice.
 */
export function selectWeeklyEditions<T>(input: {
  today: WeeklyTodayEdition<T> | null;
  archive: WeeklyEdition<T>[];
  days?: number;
}): WeeklyEdition<T>[] {
  const days = input.days ?? WEEKLY_WINDOW_DAYS;
  const editions: WeeklyEdition<T>[] = [];
  if (input.today && !input.today.isPrevious && input.today.cards.length && input.today.date) {
    editions.push({ date: input.today.date, cards: input.today.cards });
  }
  for (const edition of input.archive) {
    if (editions.length >= days) break;
    if (!edition.date || editions.some((row) => row.date === edition.date)) continue;
    editions.push(edition);
  }
  return editions;
}

export interface WeeklyHeatWindow {
  from: string;
  to: string;
  editionCount: number;
  items: WeeklySampleItem[];
}

/** Each day's #1, then #2s, listed by date. `from`/`to` cover the window. */
export function weeklyHeatRanking(
  editions: { date: string; cards: WeeklySampleCard[] }[],
  top = WEEKLY_HEAT_TOP,
): WeeklyHeatWindow {
  const items = pickWeeklySample(editions, top);
  const dates = editions.map((edition) => edition.date).filter(Boolean).sort();
  return {
    from: dates[0] ?? "",
    to: dates[dates.length - 1] ?? "",
    editionCount: editions.length,
    items,
  };
}
