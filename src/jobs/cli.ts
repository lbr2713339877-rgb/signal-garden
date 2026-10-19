/**
 * Job entry point. Same command locally and in scheduled CI.
 *
 *   pnpm job discover [--only topic:,code:]
 *   pnpm job enrich   [--limit 300] [--meta-only]
 *   pnpm job pipeline               # discover, then enrich
 *   pnpm job report
 *   pnpm job growth [--limit 400] [--force]
 *   pnpm job growth --edition today          # published projects for a day
 *   pnpm job newsletter          # Monday weekly digest; not part of `daily`
 *   pnpm job slugs --dry-run     # preview slug repairs; writes nothing
 *   pnpm job slugs --backfill    # apply repairs; back up the database first
 */

import { loadLocalEnv } from "@/lib/env";
import { closeDb } from "@/db/client";
import { log, runJob } from "./run";
import { discover } from "./discover";
import { enrich } from "./enrich";
import { refocus } from "./refocus";
import { report } from "./report";
import { aiCheck } from "./ai-check";
import { enrichAi } from "@/ai/enrich";
import { SCORING_SHORTLIST, TODAY_LIMIT } from "@/lib/edition";
import { scoreDaily } from "@/scoring/daily";
import { publish } from "./publish";
import { editionDate, measureGrowth, measurePublishedEdition } from "./growth";
import { collectMentions } from "@/collectors/hn/mentions";
import { retaxonomy } from "./retaxonomy";
import { discoverWeb } from "./discover-web";
import { reviewDiscoveries } from "./review-discoveries";
import { sendNewsletter } from "./newsletter";
import { submitIndexNow } from "@/lib/indexnow";
import { backfillSlugs } from "./slugs";

loadLocalEnv();

const [cmd, ...rest] = process.argv.slice(2);
const flag = (name: string) => {
  const i = rest.indexOf(`--${name}`);
  return i >= 0 ? rest[i + 1] : undefined;
};

/* Order matters: the daily board is written for today's candidates first, then
   a bounded backlog pass fills copy for the category spaces so they keep
   growing without a manual run. */
const DAILY_STEPS = [
  "discover",
  "discover-web",
  "refocus",
  "enrich",
  "review-discoveries",
  "growth",
  "mentions",
  "score",
  "enrich-ai",
  "backfill-copy",
  // Replace any templated hook the model produced again ("...凭什么"). Runs
  // before publish so a rewritten hook ships the same day.
  "rewrite-hooks",
  "publish",
] as const;

const jobs: Record<string, () => Promise<boolean>> = {
  'discover-web': () => runJob('discover-web', () => discoverWeb({ limit: Number(flag('limit') ?? 30), seedsOnly: rest.includes('--seeds-only'), dryRun: rest.includes('--dry-run') })),
  'review-discoveries': () => runJob('review-discoveries', () => reviewDiscoveries({ limit: Number(flag('reviews') ?? flag('limit') ?? (cmd === 'daily' ? 30 : 60)), slugs: flag('slug')?.split(','), force: rest.includes('--force') })),
  discover: () => runJob("discover", () => discover({ only: flag("only")?.split(","), dryRun: rest.includes("--dry-run") })),
  enrich: () =>
    runJob("enrich", () => enrich({ limit: Number(flag("limit") ?? 300), metaOnly: rest.includes("--meta-only"), slugs: flag("slug")?.split(",").map((s) => s.trim()).filter(Boolean) })),
  refocus: () => runJob("refocus", () => refocus()),
  // Requires AI_BASE_URL / AI_API_KEY / AI_MODEL.
  "enrich-ai": () =>
    runJob("enrich-ai", () =>
      enrichAi({
        // Leave calls for reviewed website discoveries in the backlog pass.
        limit: Number(flag("candidate-copy") ?? flag("limit") ?? (cmd === 'daily' ? 20 : 40)),
        all: rest.includes("--all"),
        retryFailedToday: rest.includes("--retry-failed"),
        hooksOnly: rest.includes("--hooks-only"),
        rewriteHooks: rest.includes("--rewrite-hooks"),
        capabilitiesOnly: rest.includes("--capabilities-only"),
        englishOnly: rest.includes("--english-only"),
        rewriteExisting: rest.includes("--rewrite-existing"),
        slugs: flag("slug")?.split(",").map((s) => s.trim()).filter(Boolean),
      }),
    ),
  /* Backlog copy pass: fills the category pages with projects that are already
     parsed and in focus but had no copy yet. Bounded so a daily run stays
     predictable; the board copy above always comes first. */
  "backfill-copy": () =>
    runJob("backfill-copy", () =>
      enrichAi({
        limit: Number(flag("backfill") ?? (cmd === 'daily' ? 12 : 30)),
        all: true,
      }),
    ),
  "rewrite-hooks": () =>
    runJob("rewrite-hooks", () =>
      enrichAi({
        limit: Number(flag("hooks") ?? (cmd === 'daily' ? 6 : 20)),
        rewriteHooks: true,
      }),
    ),
  retaxonomy: () => runJob("retaxonomy", () => retaxonomy()),
  growth: () =>
    runJob("growth", () => {
      const edition = flag("edition");
      if (edition) return measurePublishedEdition(editionDate(edition));
      return measureGrowth({ limit: Number(flag("limit") ?? 400), force: rest.includes("--force") });
    }),
  mentions: () => runJob("mentions", () => collectMentions({ limit: Number(flag("limit") ?? 200), force: rest.includes("--force") })),
  // Shortlist stays wider than the edition so gates can still fill TODAY_LIMIT.
  // Publish may produce fewer than TODAY_LIMIT items; history never fills empty slots.
  score: () => runJob("score", () => scoreDaily({ limit: Number(flag("limit") ?? 700), top: Number(flag("top") ?? SCORING_SHORTLIST) })),
  publish: () => runJob("publish", () => publish({ top: Number(flag("top") ?? TODAY_LIMIT), date: flag("date") })),
  // Explicit only. Do not add this to DAILY_STEPS or a process schedule.
  newsletter: () => runJob("newsletter", () => sendNewsletter()),
  // No-op when INDEXNOW_KEY is unset. Also runs at the end of `daily`.
  indexnow: () => runJob("indexnow", () => submitIndexNow()),
  // Explicit only. Do not add this to DAILY_STEPS. Back up the database first.
  slugs: async () => {
    const backfill = rest.includes("--backfill");
    const dryRun = rest.includes("--dry-run");
    if (!backfill && !dryRun) {
      console.error("usage: pnpm job slugs --backfill [--dry-run]\nBack up the database before --backfill. This command is not part of `pnpm job daily`.");
      return true;
    }
    return runJob("slugs", () => backfillSlugs({ dryRun }));
  },
  report,
  "ai-check": aiCheck,
  pipeline: async () => (await jobs.discover()) && (await jobs.refocus()) && (await jobs.enrich()),
  /**
   * The full daily loop, in dependency order: find repositories, recompute
   * scope, parse the changed ones, score the pool, write copy for today's
   * candidates, then publish the ones that pass every gate.
   *
   * Deliberately not `a && b && c`: every step runs even after an earlier
   * failure, each failure is recorded in job_run by runJob(), and the wrapper
   * throws at the end so CI exits non-zero instead of silently skipping.
   */
  daily: () =>
    runJob("daily", async () => {
      const failed: string[] = [];
      let itemsIn = 0;
      let itemsOut = 0;

      for (const step of DAILY_STEPS) {
        const ok = await jobs[step]();
        if (!ok) failed.push(step);
      }

      // The earlier growth pass only reaches the top focus scores. Measure the
      // projects that actually published today, including a lower focus score.
      const published = await runJob("growth-published", () => measurePublishedEdition());
      if (!published) failed.push("growth-published");

      // Tell IndexNow about today's new project pages. A missed ping must not
      // roll back a published edition; `pnpm job indexnow` can retry.
      const pinged = await runJob("indexnow", () => submitIndexNow());
      if (!pinged) log("daily", "indexnow did not complete; the edition is still published");

      if (failed.length) {
        throw new Error(`daily failed steps: ${failed.join(", ")}`);
      }

      return { itemsIn, itemsOut, meta: { steps: DAILY_STEPS } };
    }),
};

const job = jobs[cmd];
if (!job) {
  console.error(`usage: pnpm job <${Object.keys(jobs).join("|")}>`);
  process.exit(2);
}

const ok = await job().catch((err) => {
  console.error(err);
  return false;
});
await closeDb();
process.exit(ok ? 0 : 1);
