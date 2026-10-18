import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "@/db/schema";
import type { Database, DbHandle } from "@/db/client";
import { GATE } from "@/collectors/github/growth";
import { signalDate } from "@/lib/day";
import { editionDate, measureGrowth, publishedProjectIds, selectGrowthCandidates } from "./growth";

test("published editions are measured even when the focus cap would skip them", async () => {
  const raw = new PGlite();
  const d = drizzle(raw, { schema });
  for (const file of readdirSync("drizzle").filter((name) => name.endsWith(".sql")).sort()) {
    await raw.exec(readFileSync(`drizzle/${file}`, "utf8"));
  }
  const store = globalThis as typeof globalThis & { __sgDb?: DbHandle | null };
  const previous = store.__sgDb;
  store.__sgDb = { db: d as unknown as Database, driver: "pglite", raw, close: () => raw.close() };
  const today = signalDate();
  const recent = new Date(Date.now() - 60 * 60 * 1000);

  async function project(name: string, over: Partial<typeof schema.project.$inferInsert> = {}) {
    const [row] = await d.insert(schema.project).values({
      canonicalProjectId: `repo:${name}`,
      slug: name,
      name,
      fullName: `test/${name}`,
      primaryUrl: `https://github.com/test/${name}`,
      stars: 40,
      focusScore: 1,
      parseState: "parsed",
      linkStatus: "ok",
      ...over,
    }).returning();
    return row;
  }

  try {
    const never = await project("never-measured", { focusScore: 1, stars: 30 });
    const measured = await project("measured-high", { focusScore: 90, stars: 5000, growthMeasuredAt: recent });
    const quiet = await project("zero-stars", { stars: 0, focusScore: 0, growthMeasuredAt: recent });
    await d.insert(schema.dailySignal).values([
      { projectId: never.id, signalDate: today, rank: 1, heatScore: 10, breakdown: {}, isPublished: true },
      { projectId: quiet.id, signalDate: today, rank: 2, heatScore: 1, breakdown: {}, isPublished: true },
      { projectId: measured.id, signalDate: today, rank: 3, heatScore: 80, breakdown: {}, isPublished: false },
    ]);

    const ordered = await selectGrowthCandidates({ limit: 10 });
    assert.equal(ordered[0]?.id, never.id, "never-measured rows come before a higher focus score");
    assert.equal(ordered.some((row) => row.id === measured.id), false, "a row measured within 20 hours waits");
    assert.equal(ordered.some((row) => row.id === quiet.id), false, "the star floor still applies to the broad pass");

    const targeted = await selectGrowthCandidates({ ids: [measured.id, quiet.id] });
    assert.deepEqual(targeted.map((row) => row.id).sort(), [measured.id, quiet.id].sort());
    assert.deepEqual(await selectGrowthCandidates({ ids: [] }), []);
    assert.deepEqual(await measureGrowth({ ids: [] }), {
      itemsIn: 0,
      itemsOut: 0,
      meta: { qualified: 0, rising: 0, gate: GATE, failures: [] },
    });

    assert.deepEqual((await publishedProjectIds(today)).sort(), [never.id, quiet.id].sort());
    assert.deepEqual(await publishedProjectIds("2000-01-01"), []);

    const now = new Date("2026-10-18T02:00:00Z");
    assert.equal(editionDate("today", now), signalDate(now));
    assert.equal(editionDate("2026-10-17", now), "2026-10-17");
    assert.throws(() => editionDate("yesterday", now), /YYYY-MM-DD/);

    const cli = readFileSync(new URL("./cli.ts", import.meta.url), "utf8");
    assert.match(cli, /measurePublishedEdition\(editionDate\(edition\)\)/);
    const daily = cli.slice(cli.indexOf("daily: () =>"), cli.indexOf("const job = jobs"));
    assert.match(daily, /growth-published/);
    assert.ok(daily.indexOf("DAILY_STEPS") < daily.indexOf("measurePublishedEdition()"));
  } finally {
    store.__sgDb = previous;
    await raw.close();
  }
});
