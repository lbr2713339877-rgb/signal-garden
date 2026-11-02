import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "@/db/schema";
import type { Database, DbHandle } from "@/db/client";
import { loadStarAnchors, type StarAnchor } from "@/db/star-anchors";
import { starDelta } from "@/jobs/growth";
import { averageDailyGrowth, starsAt } from "@/scoring/daily";

const DAY = 86_400_000;

function answers(snaps: StarAnchor[], current: number, now: number) {
  return {
    day: starDelta(snaps, current, 1, now),
    week: starDelta(snaps, current, 7, now),
    atDay: starsAt(snaps, 1, now),
    atWeek: starsAt(snaps, 7, now),
    average: averageDailyGrowth(snaps),
  };
}

test("snapshot anchors match full-history star deltas", async () => {
  const raw = new PGlite();
  const d = drizzle(raw, { schema });
  for (const file of readdirSync("drizzle").filter((name) => name.endsWith(".sql")).sort()) {
    await raw.exec(readFileSync(`drizzle/${file}`, "utf8"));
  }
  const store = globalThis as typeof globalThis & { __sgDb?: DbHandle | null };
  const previous = store.__sgDb;
  store.__sgDb = { db: d as unknown as Database, driver: "pglite", raw, close: () => raw.close() };
  const now = Date.parse("2026-06-15T00:00:00Z");

  async function project(name: string) {
    const [row] = await d.insert(schema.project).values({
      canonicalProjectId: `repo:${name}`,
      slug: name,
      name,
      fullName: `test/${name}`,
      primaryUrl: `https://github.com/test/${name}`,
      stars: 100,
      parseState: "parsed",
    }).returning({ id: schema.project.id });
    return row;
  }

  try {
    const dense = await project("dense");
    const recent = await project("recent-only");
    const quiet = await project("no-history");
    const full: StarAnchor[] = [];
    for (let i = 0; i < 40; i++) {
      const capturedAt = new Date(now - (20 * DAY) + i * (DAY / 2));
      const stars = 10 + i * 3 + (i % 5 === 0 ? 40 : 0);
      full.push({ capturedAt, stars });
    }
    await d.insert(schema.repoSnapshot).values(full.map((point) => ({ projectId: dense.id, stars: point.stars, capturedAt: point.capturedAt })));
    const recentAt = new Date(now - 3 * 60 * 60 * 1000);
    await d.insert(schema.repoSnapshot).values({ projectId: recent.id, stars: 4, capturedAt: recentAt });

    const anchors = await loadStarAnchors(d, [dense.id, recent.id], now);
    assert.ok((anchors.get(dense.id)?.length ?? 0) <= 4);
    assert.ok((anchors.get(dense.id)?.length ?? 0) < full.length);
    assert.deepEqual(answers(anchors.get(dense.id) ?? [], 10 + 39 * 3, now), answers(full, 10 + 39 * 3, now));
    assert.deepEqual(
      answers(anchors.get(recent.id) ?? [], 4, now),
      answers([{ capturedAt: recentAt, stars: 4 }], 4, now),
    );
    assert.equal(anchors.has(quiet.id), false);
    assert.equal((await loadStarAnchors(d, [], now)).size, 0);
  } finally {
    store.__sgDb = previous;
    await raw.close();
  }
});
