import { unstable_cache } from "next/cache";

/**
 * Public read TTLs. Rankings are published once a day; a few minutes of
 * staleness on a board is intentional. Project HTML is also purged by the
 * daily revalidate ping, so the longer TTL is only the fallback.
 *
 * Next.js segment config (`export const revalidate`) must be a numeric
 * literal in the page file. Those literals are locked to these constants
 * by src/lib/public-cache.test.ts.
 */
export const PUBLIC_BOARD_TTL = 300;
/** Past editions change only when a new day is published. */
export const ARCHIVE_PAGE_TTL = 1800;
/** /p HTML. Daily `revalidatePath` still refreshes today's edition. */
export const PROJECT_PAGE_TTL = 6 * 60 * 60;
/** Sitemap slug list and the SEO-pilot membership query. */
export const SITEMAP_TTL = 6 * 60 * 60;

function inProductionNextServer(): boolean {
  return process.env.NODE_ENV === "production" && (process.env.NEXT_RUNTIME === "nodejs" || process.env.NEXT_RUNTIME === "edge");
}

/**
 * Cross-request data cache for public reads.
 * CLI jobs and node:test have no incremental cache, so they run the query.
 * `next dev` stays uncached so a local edit shows up on the next request.
 */
export function cachePublicRead<Args extends unknown[], T>(
  fn: (...args: Args) => Promise<T>,
  keyPrefix: string,
  revalidate: number,
): (...args: Args) => Promise<T> {
  const cached = unstable_cache(
    async (payload: string) => fn(...(JSON.parse(payload) as Args)),
    [keyPrefix],
    { revalidate },
  );
  return async (...args: Args) => {
    if (!inProductionNextServer()) return fn(...args);
    try {
      return await cached(JSON.stringify(args));
    } catch (error) {
      // A missing incremental cache must not take the page down. SQL errors still throw.
      const message = error instanceof Error ? error.message : String(error);
      if (!/incrementalCache/i.test(message)) throw error;
      return fn(...args);
    }
  };
}
