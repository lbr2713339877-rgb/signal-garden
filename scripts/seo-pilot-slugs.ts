/**
 * Print the current SEO pilot slugs.
 * Same rule as the site: 50 public projects with the most published ranking
 * days, at least 3. Ties break by slug.
 *
 *   pnpm exec tsx scripts/seo-pilot-slugs.ts
 */
import { closeDb } from "../src/db/client";
import { getSeoPilotSlugSet } from "../src/db/queries/seo-pilot";

const slugs = [...await getSeoPilotSlugSet()];
console.log(JSON.stringify({ count: slugs.length, slugs }, null, 2));
await closeDb();
