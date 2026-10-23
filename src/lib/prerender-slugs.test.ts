import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { unionPrerenderSlugs } from "./prerender-slugs";

test("prerender union keeps today's edition and adds each pilot slug once", () => {
  assert.deepEqual(
    unionPrerenderSlugs(["today-a", "shared", "Bad Slug", ""], ["pilot-b", "shared", "pilot-b", " "]),
    ["today-a", "shared", "pilot-b"],
  );
  assert.deepEqual(unionPrerenderSlugs([], ["only-pilot"]), ["only-pilot"]);
  assert.deepEqual(unionPrerenderSlugs(["only-today"], []), ["only-today"]);
});

test("generateStaticParams prebuilds the live pilot set plus today's edition", () => {
  const page = readFileSync(new URL("../app/p/[slug]/page.tsx", import.meta.url), "utf8");
  const fn = page.slice(
    page.indexOf("export async function generateStaticParams"),
    page.indexOf("export async function generateMetadata"),
  );
  assert.match(page, /export const revalidate = 3600/);
  assert.match(page, /export const dynamicParams = true/);
  assert.match(fn, /publishedProjectSlugs\(signalDate\(\)\)/);
  assert.match(fn, /getSeoPilotSlugSet\(/);
  assert.match(fn, /unionPrerenderSlugs\(/);
  assert.match(fn, /if \(!process\.env\.DATABASE_URL\) return \[\]/);
  assert.doesNotMatch(fn, /remotion-dev-remotion|seo-pilot-50|signalgarden\.site\/p\//);
});
