/**
 * Warm ISR after deploy, from the machine that serves the site.
 *
 *   WARM_ORIGIN=http://127.0.0.1:3000 WARM_CONCURRENCY=2 pnpm warm-cache
 *
 * Pages: the SEO pilot set (same query as /p), the edition shown on / and
 * /today, /, /today, each public /weekly/<n> (currently /weekly/1), /en, and
 * /sitemap.xml. Concurrency stays at 2 or 3. A few URL failures are logged and
 * the process still exits 0. It exits non-zero when most URLs fail, or when
 * the pilot or edition query itself fails.
 *
 * deploy.sh runs this over SSH after the loopback health check. It does not
 * modify the server's own /opt/signal-radar/deploy.sh.
 */
import { existsSync } from "node:fs";
import { closeDb } from "../src/db/client";
import { getFeedEdition } from "../src/db/queries";
import { getSeoPilotSlugSet } from "../src/db/queries/seo-pilot";
import { TODAY_LIMIT } from "../src/lib/edition";
import { publicWeeklyIssues } from "../src/lib/weekly-sample";
import {
  isLoopbackOrigin,
  warmCachePaths,
  warmConcurrency,
  warmExitCode,
  warmIncludeSitemap,
  warmOrigin,
  warmPaths,
} from "../src/lib/warm-cache";

/** Highest precedence first. Values already in the environment win, matching Next. */
function loadWarmEnv(): void {
  for (const file of [".env.production.local", ".env.local", ".env.production", ".env"]) {
    if (!existsSync(file)) continue;
    const before = { ...process.env };
    process.loadEnvFile(file);
    for (const [key, value] of Object.entries(before)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

async function pilotSlugs(): Promise<{ slugs: string[]; ok: boolean }> {
  try {
    return { slugs: [...await getSeoPilotSlugSet()], ok: true };
  } catch (error) {
    console.error("[warm] pilot slugs skipped", error instanceof Error ? error.message : error);
    return { slugs: [], ok: false };
  }
}

async function editionSlugs(): Promise<{ date: string; previous: boolean; slugs: string[]; ok: boolean }> {
  try {
    const edition = await getFeedEdition(TODAY_LIMIT);
    return {
      date: edition.date,
      previous: edition.isPrevious,
      slugs: edition.cards.map((card) => card.slug),
      ok: true,
    };
  } catch (error) {
    console.error("[warm] edition slugs skipped", error instanceof Error ? error.message : error);
    return { date: "", previous: false, slugs: [], ok: false };
  }
}

loadWarmEnv();

const origin = warmOrigin();
if (!isLoopbackOrigin(origin)) {
  console.error(`[warm] refusing non-loopback origin ${origin}`);
  process.exit(1);
}

try {
  const pilot = await pilotSlugs();
  const edition = await editionSlugs();
  const paths = warmCachePaths({
    pilotSlugs: pilot.slugs,
    editionSlugs: edition.slugs,
    weeklyPaths: publicWeeklyIssues().map((issue) => `/weekly/${issue.number}`),
    includeSitemap: warmIncludeSitemap(process.env.WARM_SITEMAP),
  });
  const concurrency = warmConcurrency(process.env.WARM_CONCURRENCY);
  console.log(
    `[warm] origin=${origin} concurrency=${concurrency} paths=${paths.length} pilot=${pilot.slugs.length} edition=${edition.date || "-"} previous=${edition.previous} editionPages=${edition.slugs.length}`,
  );
  const hits = await warmPaths(paths, { origin, concurrency });
  for (const hit of hits) {
    if (hit.ok) {
      console.log(`[warm] ${hit.status} ${hit.cache ?? "-"} ${hit.ms}ms ${hit.path}`);
    } else {
      console.error(`[warm] FAIL ${hit.status || "-"} ${hit.ms}ms ${hit.path}${hit.error ? ` ${hit.error}` : ""}`);
    }
  }
  const code = warmExitCode(hits, pilot.ok && edition.ok);
  const ok = hits.filter((hit) => hit.ok).length;
  console.log(`[warm] done ok=${ok} fail=${hits.length - ok} exit=${code}`);
  await closeDb();
  process.exit(code);
} catch (error) {
  console.error("[warm] failed", error instanceof Error ? error.message : error);
  await closeDb().catch(() => {});
  process.exit(1);
}
