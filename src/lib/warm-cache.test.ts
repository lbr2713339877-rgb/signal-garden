import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  isLoopbackOrigin,
  warmCachePaths,
  warmConcurrency,
  warmExitCode,
  warmIncludeSitemap,
  warmOrigin,
  warmPaths,
} from "./warm-cache";

test("warm concurrency stays inside 2-3 and defaults to the low end", () => {
  assert.equal(warmConcurrency(undefined), 2);
  assert.equal(warmConcurrency(null), 2);
  assert.equal(warmConcurrency(""), 2);
  assert.equal(warmConcurrency("nope"), 2);
  assert.equal(warmConcurrency(1), 2);
  assert.equal(warmConcurrency("2"), 2);
  assert.equal(warmConcurrency(3), 3);
  assert.equal(warmConcurrency("3.9"), 3);
  assert.equal(warmConcurrency(8), 3);
  assert.equal(warmConcurrency("100"), 3);
});

test("warm origin is loopback and refuses a public host", () => {
  assert.equal(warmOrigin({}), "http://127.0.0.1:3000");
  assert.equal(warmOrigin({ PORT: "3000" }), "http://127.0.0.1:3000");
  assert.equal(warmOrigin({ PORT: "4000" }), "http://127.0.0.1:4000");
  assert.equal(warmOrigin({ PORT: "nope", WARM_ORIGIN: "http://127.0.0.1:3000/" }), "http://127.0.0.1:3000");
  assert.equal(isLoopbackOrigin("http://127.0.0.1:3000"), true);
  assert.equal(isLoopbackOrigin("http://localhost:3000"), true);
  assert.equal(isLoopbackOrigin("http://[::1]:3000"), true);
  assert.equal(isLoopbackOrigin("https://signalgarden.site"), false);
  assert.equal(isLoopbackOrigin("not a url"), false);
  assert.equal(warmIncludeSitemap(undefined), true);
  assert.equal(warmIncludeSitemap("0"), false);
  assert.equal(warmIncludeSitemap("false"), false);
  assert.equal(warmIncludeSitemap("1"), true);
});

test("warm paths are pilot pages, the homepage edition, shell routes, then the sitemap", () => {
  assert.deepEqual(warmCachePaths({
    pilotSlugs: ["pilot-one", "shared", "Bad Slug"],
    editionSlugs: ["shared", "today-two"],
    weeklyPaths: ["/weekly/1", "/weekly/1", "/weekly/nope"],
  }), [
    "/p/pilot-one",
    "/p/shared",
    "/p/today-two",
    "/",
    "/today",
    "/weekly/1",
    "/en",
    "/sitemap.xml",
  ]);
  assert.deepEqual(warmCachePaths({
    pilotSlugs: [],
    editionSlugs: [],
    weeklyPaths: [],
    includeSitemap: false,
  }), ["/", "/today", "/weekly/1", "/en"]);
});

test("a strict majority of warm hits exits 0", () => {
  assert.equal(warmExitCode([]), 1);
  assert.equal(warmExitCode([{ ok: false }, { ok: false }]), 1);
  assert.equal(warmExitCode([{ ok: true }, { ok: false }]), 1);
  assert.equal(warmExitCode([{ ok: true }, { ok: true }, { ok: false }]), 0);
  assert.equal(warmExitCode([{ ok: true }]), 0);
  assert.equal(warmExitCode([{ ok: true }, { ok: true }, { ok: true }], false), 1);
});

async function waitFor(ready: () => boolean): Promise<void> {
  for (let i = 0; i < 50; i++) {
    if (ready()) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  assert.fail("timed out waiting for warm requests");
}

test("warm requests overlap at the clamped concurrency and read a HIT", async () => {
  let active = 0;
  let max = 0;
  const release: (() => void)[] = [];
  const done = warmPaths(["/a", "/b", "/c", "/d"], {
    origin: "http://127.0.0.1:3000/",
    concurrency: 8,
    fetchImpl: () => {
      active += 1;
      max = Math.max(max, active);
      return new Promise((resolve) => {
        release.push(() => {
          active -= 1;
          resolve(new Response("ok", { status: 200, headers: { "x-nextjs-cache": "HIT" } }));
        });
      });
    },
  });
  await waitFor(() => release.length === 3);
  assert.equal(max, 3);
  assert.equal(active, 3);
  for (const finish of release.splice(0)) finish();
  await waitFor(() => release.length === 1);
  assert.equal(max, 3);
  for (const finish of release.splice(0)) finish();
  const hits = await done;
  assert.equal(hits.length, 4);
  assert.equal(hits.every((hit) => hit.ok && hit.cache === "HIT" && hit.status === 200), true);
});

test("warm stays on loopback when a redirect points at the public host", async () => {
  const seen: string[] = [];
  const hits = await warmPaths(["/p/pilot-one", "/en"], {
    origin: "http://127.0.0.1:3000",
    concurrency: 2,
    fetchImpl: async (input) => {
      const url = String(input);
      seen.push(url);
      if (url.endsWith("/p/pilot-one")) {
        return new Response("ok", { status: 200, headers: { "x-nextjs-cache": "HIT" } });
      }
      if (url === "http://127.0.0.1:3000/en") {
        return new Response(null, { status: 308, headers: { location: "/today" } });
      }
      if (url === "http://127.0.0.1:3000/today") {
        return new Response("today", { status: 200, headers: { "x-nextjs-cache": "HIT" } });
      }
      throw new Error(`left loopback: ${url}`);
    },
  });
  assert.deepEqual(seen, [
    "http://127.0.0.1:3000/p/pilot-one",
    "http://127.0.0.1:3000/en",
    "http://127.0.0.1:3000/today",
  ]);
  assert.equal(hits.every((hit) => hit.ok), true);

  const escaped = await warmPaths(["/"], {
    origin: "http://127.0.0.1:3000",
    fetchImpl: async () => new Response(null, {
      status: 302,
      headers: { location: "https://signalgarden.site/" },
    }),
  });
  assert.equal(escaped[0]?.ok, false);
  assert.match(escaped[0]?.error ?? "", /redirect left/);
});

test("the warm script uses the live pilot set and the homepage edition", () => {
  const source = readFileSync(new URL("../../scripts/warm-cache.ts", import.meta.url), "utf8");
  const deploy = readFileSync(new URL("../../deploy.sh", import.meta.url), "utf8");
  assert.match(source, /getSeoPilotSlugSet/);
  assert.match(source, /getFeedEdition\(TODAY_LIMIT\)/);
  assert.match(source, /publicWeeklyIssues/);
  assert.match(source, /isLoopbackOrigin/);
  assert.match(source, /closeDb/);
  assert.doesNotMatch(source, /remotion-dev-remotion|seo-pilot-50/);
  assert.match(deploy, /scripts\/warm-cache\.ts/);
  assert.match(deploy, /WARM_ORIGIN=http:\/\/127\.0\.0\.1:3000/);
  assert.match(deploy, /WARM_CONCURRENCY=2/);
});
