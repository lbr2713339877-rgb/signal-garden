import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { ARCHIVE_PAGE_TTL, PROJECT_PAGE_TTL, PUBLIC_BOARD_TTL, SITEMAP_TTL } from "./public-cache";

test("public read TTLs stay on the minutes-to-hours side of live rankings", () => {
  assert.equal(PUBLIC_BOARD_TTL, 300);
  assert.equal(ARCHIVE_PAGE_TTL, 1800);
  assert.equal(PROJECT_PAGE_TTL, 21600);
  assert.equal(SITEMAP_TTL, 21600);

  const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
  for (const path of [
    "../app/(site)/page.tsx",
    "../app/(site)/today/page.tsx",
    "../app/(site)/trends/page.tsx",
    "../app/(site)/discoveries/page.tsx",
    "../app/(site)/classic/page.tsx",
    "../app/(site)/c/page.tsx",
    "../app/en/page.tsx",
    "../app/today/opengraph-image.tsx",
    "../app/today/twitter-image.tsx",
  ]) {
    assert.match(read(path), /export const revalidate = 300/, path);
  }
  assert.match(read("../app/(site)/archive/page.tsx"), /export const revalidate = 1800/);
  assert.match(read("../app/p/[slug]/page.tsx"), /export const revalidate = 21600/);
  assert.match(read("../app/p/[slug]/opengraph-image.tsx"), /export const revalidate = 21600/);
  assert.match(read("../app/p/[slug]/twitter-image.tsx"), /export const revalidate = 21600/);

  const queries = read("../db/queries/index.ts");
  assert.match(queries, /cachePublicRead/);
  assert.match(queries, /"feed-edition"/);
  assert.match(queries, /"archive-editions"/);
  assert.match(queries, /"taxonomy-list"/);
  assert.match(queries, /"search-projects"/);
  assert.match(read("../db/queries/weekly-heat.ts"), /"weekly-heat-top"/);

  // Search text, sessions, and the category URL state stay dynamic.
  for (const path of [
    "../app/(site)/search/page.tsx",
    "../app/(site)/c/[category]/page.tsx",
    "../app/(site)/login/page.tsx",
    "../app/(site)/status/page.tsx",
    "../app/feedback/[slug]/page.tsx",
  ]) {
    assert.match(read(path), /export const revalidate = 0/, path);
  }
});
