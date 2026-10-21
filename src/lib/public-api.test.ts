import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { eq } from "drizzle-orm";
import * as schema from "@/db/schema";
import type { Database, DbHandle } from "@/db/client";
import { signalDate } from "@/lib/day";
import { siteOrigin } from "@/lib/edition";
import { featuredBadgeSvg, readmeBadgeMarkdown } from "@/lib/badge";
import { buildIndexNowPayload, INDEXNOW_ENDPOINT, submitIndexNow, weeklyIssuesForIndexNow } from "@/lib/indexnow";
import { GET as badgeGet } from "@/app/badge/[owner]/[repo]/route";
import { GET as todayGet } from "@/app/api/today.json/route";

test("readme badge markdown and shields svg follow the public contract", () => {
  assert.equal(
    readmeBadgeMarkdown({ owner: "acme", repo: "widget", slug: "widget" }),
    "[![Featured on Signal Garden](https://signalgarden.site/badge/acme/widget.svg)](https://signalgarden.site/p/widget?utm_source=badge&utm_medium=readme&utm_campaign=featured)",
  );
  assert.match(readmeBadgeMarkdown({ owner: "acme", repo: "widget", slug: "widget", theme: "dark" }), /badge\/acme\/widget\.svg\?theme=dark/);
  const light = featuredBadgeSvg("light");
  const dark = featuredBadgeSvg("dark");
  assert.match(light, /Featured on/);
  assert.match(light, /Signal Garden/);
  assert.match(light, /#2f6f4e/);
  assert.match(dark, /#16382a/);
  assert.equal(light.includes("#16382a"), false);
});

test("IndexNow payload lists today, new project pages, weekly issues, home and the feed", () => {
  const payload = buildIndexNowPayload({
    key: "indexnow-key",
    origin: "https://signalgarden.site/",
    newProjectSlugs: ["widget", "not a slug", "old-library"],
  });
  assert.equal(payload.host, "signalgarden.site");
  assert.equal(payload.key, "indexnow-key");
  assert.equal(payload.keyLocation, "https://signalgarden.site/indexnow-key.txt");
  assert.deepEqual(payload.urlList, [
    "https://signalgarden.site/today",
    "https://signalgarden.site/p/widget",
    "https://signalgarden.site/p/old-library",
    "https://signalgarden.site/weekly/1",
    "https://signalgarden.site/",
    "https://signalgarden.site/feed.xml",
  ]);
});

test("IndexNow weekly URLs include the latest issue and one published that day", () => {
  assert.deepEqual(weeklyIssuesForIndexNow([
    { number: 1, publishedOn: "2026-10-19" },
    { number: 2, publishedOn: "2026-10-26" },
  ], "2026-10-20"), [2]);
  assert.deepEqual(weeklyIssuesForIndexNow([
    { number: 1, publishedOn: "2026-10-19" },
    { number: 2, publishedOn: "2026-10-26" },
    { number: 0, publishedOn: "2026-10-19" },
  ], "2026-10-19"), [1, 2]);
  const payload = buildIndexNowPayload({
    key: "indexnow-key",
    origin: "https://signalgarden.site",
    newProjectSlugs: [],
    weeklyIssues: [2, 1, 2, 0, -3, 1.5],
  });
  assert.deepEqual(
    payload.urlList.filter((url) => url.includes("/weekly/")),
    ["https://signalgarden.site/weekly/1", "https://signalgarden.site/weekly/2"],
  );
});

test("badge, today.json and indexnow use published editions only", async () => {
  const raw = new PGlite();
  for (const file of readdirSync("drizzle").filter((name) => name.endsWith(".sql")).sort()) {
    await raw.exec(readFileSync(`drizzle/${file}`, "utf8"));
  }
  const d = drizzle(raw, { schema });
  const store = globalThis as typeof globalThis & { __sgDb?: DbHandle | null };
  const previous = store.__sgDb;
  store.__sgDb = { db: d as unknown as Database, driver: "pglite", raw, close: () => raw.close() };
  const today = signalDate();
  const earlier = "2020-01-01";

  async function project(input: { slug: string; fullName: string; hidden?: boolean; published?: boolean; date?: string }) {
    const [row] = await d.insert(schema.project).values({
      canonicalProjectId: `gh:${input.slug}`,
      slug: input.slug,
      name: input.slug,
      owner: input.fullName.split("/")[0],
      fullName: input.fullName,
      primaryUrl: `https://github.com/${input.fullName}`,
      description: "Vendor text",
      parseState: "parsed",
      hidden: input.hidden ?? false,
      stars: 400,
      stars24h: 11,
      stars7d: 30,
      forks7d: 4,
    }).returning();
    if (input.published) {
      await d.insert(schema.dailySignal).values({
        projectId: row.id,
        signalDate: input.date ?? today,
        rank: 1,
        heatScore: 72.5,
        breakdown: {},
        isPublished: true,
      });
    }
    await d.insert(schema.aiContent).values([
      { projectId: row.id, locale: "zh", oneLiner: "中文一句。", passedGuard: true },
      { projectId: row.id, locale: "en", oneLiner: "An English line.", passedGuard: true },
    ]);
    return row;
  }

  try {
    await project({ slug: "widget", fullName: "Acme/Widget", published: true });
    await project({ slug: "quiet", fullName: "Acme/Quiet" });
    await project({ slug: "secret", fullName: "Acme/Secret", hidden: true, published: true });
    await project({ slug: "old-library", fullName: "Old/Library", published: true, date: earlier });

    const hit = await badgeGet(new Request("https://signalgarden.site/badge/acme/widget.svg"), {
      params: Promise.resolve({ owner: "acme", repo: "widget.svg" }),
    });
    assert.equal(hit.status, 200);
    assert.match(hit.headers.get("content-type") ?? "", /image\/svg\+xml/);
    assert.match(hit.headers.get("cache-control") ?? "", /s-maxage=86400/);
    assert.match(await hit.text(), /Featured on/);

    const dark = await badgeGet(new Request("https://signalgarden.site/badge/Acme/Widget.svg?theme=dark"), {
      params: Promise.resolve({ owner: "Acme", repo: "Widget.svg" }),
    });
    assert.equal(dark.status, 200);
    assert.match(await dark.text(), /#16382a/);

    for (const [owner, repo] of [["acme", "quiet.svg"], ["acme", "secret.svg"], ["nope", "missing.svg"]] as const) {
      const miss = await badgeGet(new Request(`https://signalgarden.site/badge/${owner}/${repo}`), {
        params: Promise.resolve({ owner, repo }),
      });
      assert.equal(miss.status, 404, `${owner}/${repo}`);
    }

    const response = await todayGet();
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("access-control-allow-origin"), "*");
    assert.match(response.headers.get("cache-control") ?? "", /s-maxage=600/);
    const body = await response.json() as {
      edition_date: string;
      items: Array<Record<string, unknown>>;
    };
    assert.equal(body.edition_date, today);
    const item = body.items.find((row) => row.name === "widget");
    assert.ok(item);
    assert.equal(item.rank, 1);
    assert.equal(item.owner, "Acme");
    assert.equal(item.repo, "Widget");
    assert.equal(item.url, "https://github.com/Acme/Widget");
    assert.equal(item.project_url, `${siteOrigin()}/p/widget`);
    assert.deepEqual(item.description, { zh: "中文一句。", en: "An English line." });
    assert.equal(item.stars, 400);
    assert.equal(item.stars_24h, 11);
    assert.equal(item.stars_7d, 30);
    assert.equal(item.heat_score, 72.5);
    assert.equal(item.forks_7d, 4);
    assert.equal(item.edition_date, today);
    assert.equal(body.items.some((row) => row.name === "quiet" || row.name === "secret"), false);

    await todayGet();
    const [count] = await d.select().from(schema.apiRequestDaily).where(eq(schema.apiRequestDaily.path, "/api/today.json"));
    assert.equal(count.count, 2);

    const calls: { url: string; body: { host: string; urlList: string[] } }[] = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      calls.push({ url: String(input), body: JSON.parse(String(init?.body)) });
      return new Response("accepted", { status: 202 });
    };
    const first = await submitIndexNow({ key: "indexnow-key", origin: "https://signalgarden.site", fetchImpl });
    assert.equal(first.itemsOut, 5);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, INDEXNOW_ENDPOINT);
    assert.equal(calls[0].body.host, "signalgarden.site");
    assert.deepEqual(calls[0].body.urlList, [
      "https://signalgarden.site/today",
      "https://signalgarden.site/p/widget",
      "https://signalgarden.site/weekly/1",
      "https://signalgarden.site/",
      "https://signalgarden.site/feed.xml",
    ]);
    const second = await submitIndexNow({ key: "indexnow-key", origin: "https://signalgarden.site", fetchImpl });
    assert.equal(second.itemsOut, 0);
    assert.equal(second.meta?.skipped, "duplicate");
    assert.equal(calls.length, 1);

    const skipped = await submitIndexNow({ key: "", fetchImpl });
    assert.equal(skipped.meta?.skipped, "no-key");
    assert.equal(calls.length, 1);
  } finally {
    store.__sgDb = previous;
    await raw.close();
  }
});
