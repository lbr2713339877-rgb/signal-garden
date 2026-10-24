import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { revalidate } from "@/app/sitemap";

test("sitemap revalidates hourly and does not force a per-request render", () => {
  assert.equal(revalidate, 3600);

  const source = readFileSync(new URL("./sitemap.ts", import.meta.url), "utf8");
  assert.match(source, /export const revalidate = 3600/);
  assert.match(source, /unstable_cache\(/);
  assert.match(source, /revalidate: 3600/);
  assert.doesNotMatch(source, /export const dynamic = ['"]force-dynamic['"]/);
  assert.match(source, /eq\(project\.hidden, false\)/);
  assert.match(source, /eq\(project\.parseState, 'parsed'\)/);
  assert.match(source, /isNull\(project\.junkReason\)/);
  assert.match(source, /eq\(project\.isSkillCollection, false\)/);
  assert.match(source, /isNull\(project\.duplicateOf\)/);
  assert.match(source, /publicWeeklyIssues/);
  assert.doesNotMatch(source, /'\/weekly\/1'/);
});

test("the public feed stays dynamic and is not on the sitemap cache window", () => {
  const feed = readFileSync(new URL("./feed.xml/route.ts", import.meta.url), "utf8");
  assert.match(feed, /export const dynamic = "force-dynamic"/);
  assert.doesNotMatch(feed, /export const revalidate = 3600/);
  assert.doesNotMatch(feed, /unstable_cache\(/);
});
