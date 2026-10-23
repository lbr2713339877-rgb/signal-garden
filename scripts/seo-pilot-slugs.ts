/**
 * Print the current SEO pilot slugs.
 * Same rule as the site: 50 non-hidden projects with the most tracked
 * daily_signal days, at least 3. Ties break by published days, then slug.
 * Campaign pins stay in the set when they still meet that minimum, replacing
 * the last selected slug.
 *
 *   pnpm exec tsx scripts/seo-pilot-slugs.ts
 */
import { closeDb } from "../src/db/client";
import { getSeoPilotSlugSet } from "../src/db/queries/seo-pilot";

const slugs = [...await getSeoPilotSlugSet()];
console.log(JSON.stringify({ count: slugs.length, slugs }, null, 2));
await closeDb();
