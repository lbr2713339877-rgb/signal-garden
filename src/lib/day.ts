/**
 * The canonical "today" for the daily board.
 *
 * Relying on `new Date().toISOString()` labels the board with the UTC date.
 * The nightly job runs at 06:00 Asia/Singapore (UTC+8), which is still the
 * *previous* day in UTC — so the board would be stamped one day behind the
 * calendar the readers actually live on. Compute the date in the product's
 * timezone instead.
 */
export const SITE_TIME_ZONE = 'Asia/Singapore';

const fmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: SITE_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** YYYY-MM-DD in the site timezone. */
export function signalDate(at: Date = new Date()): string {
  return fmt.format(at); // en-CA renders as YYYY-MM-DD
}
