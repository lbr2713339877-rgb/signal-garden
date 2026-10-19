import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import nextConfig from "../../next.config";
import { GET } from "@/app/api/indexnow-key/route";

const KEY = "a".repeat(32);

test("the IndexNow key file is a next.config rewrite, not a middleware rewrite", async () => {
  const middleware = readFileSync(new URL("../middleware.ts", import.meta.url), "utf8");
  assert.doesNotMatch(middleware, /indexnow/i);
  assert.doesNotMatch(middleware, /NextResponse\.rewrite/);

  const rewrites = await nextConfig.rewrites!();
  const rules = Array.isArray(rewrites)
    ? rewrites
    : [...(rewrites.beforeFiles ?? []), ...(rewrites.afterFiles ?? []), ...(rewrites.fallback ?? [])];
  const rule = rules.find((item) => item.destination.startsWith("/api/indexnow-key"));
  assert.ok(rule);
  assert.equal(rule.source, "/:key([0-9a-f]{32}).txt");
  assert.equal(rule.destination, "/api/indexnow-key?k=:key");
});

test("the key route returns the env key only when k matches", async () => {
  const previous = process.env.INDEXNOW_KEY;
  process.env.INDEXNOW_KEY = KEY;
  try {
    const hit = await GET(new Request(`https://signalgarden.site/api/indexnow-key?k=${KEY}`));
    assert.equal(hit.status, 200);
    assert.equal(await hit.text(), KEY);
    assert.match(hit.headers.get("content-type") ?? "", /text\/plain/);

    const other = "b".repeat(32);
    const miss = await GET(new Request(`https://signalgarden.site/api/indexnow-key?k=${other}`));
    assert.equal(miss.status, 404);

    const bare = await GET(new Request("https://signalgarden.site/api/indexnow-key"));
    assert.equal(bare.status, 404);

    delete process.env.INDEXNOW_KEY;
    const unset = await GET(new Request(`https://signalgarden.site/api/indexnow-key?k=${KEY}`));
    assert.equal(unset.status, 404);
  } finally {
    if (previous === undefined) delete process.env.INDEXNOW_KEY;
    else process.env.INDEXNOW_KEY = previous;
  }
});

test("the key route accepts the key from the original .txt pathname when k is missing", async () => {
  const previous = process.env.INDEXNOW_KEY;
  process.env.INDEXNOW_KEY = KEY;
  try {
    const hit = await GET(new Request(`https://signalgarden.site/${KEY}.txt`));
    assert.equal(hit.status, 200);
    assert.equal(await hit.text(), KEY);
    assert.match(hit.headers.get("content-type") ?? "", /text\/plain/);

    const other = "b".repeat(32);
    const miss = await GET(new Request(`https://signalgarden.site/${other}.txt`));
    assert.equal(miss.status, 404);

    const shaped = await GET(new Request("https://signalgarden.site/not-a-key.txt"));
    assert.equal(shaped.status, 404);

    const queryWins = await GET(new Request(`https://signalgarden.site/${KEY}.txt?k=${other}`));
    assert.equal(queryWins.status, 404);
  } finally {
    if (previous === undefined) delete process.env.INDEXNOW_KEY;
    else process.env.INDEXNOW_KEY = previous;
  }
});
