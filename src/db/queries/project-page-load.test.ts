import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import * as React from "react";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "@/db/schema";
import type { Database, DbHandle } from "@/db/client";
import { getProjectBySlug, getProjectCopy } from "@/db/queries";
import { getSeoPilotSlugSet, loadSeoPilotView } from "@/db/queries/seo-pilot";

const CHILD = "PROJECT_PAGE_LOAD_CHILD";

type QueryFn = (sql: string, ...args: unknown[]) => Promise<unknown>;

function attachCounter(raw: PGlite) {
  const spans: string[] = [];
  let active = 0;
  let max = 0;
  const orig = raw.query.bind(raw) as QueryFn;
  raw.query = (async (sql: string, ...args: unknown[]) => {
    active += 1;
    max = Math.max(max, active);
    spans.push(String(sql));
    try {
      return await orig(sql, ...args);
    } finally {
      active -= 1;
    }
  }) as PGlite["query"];
  return {
    spans,
    max: () => max,
    reset() {
      spans.length = 0;
      active = 0;
      max = 0;
    },
    count(part: string) {
      const needle = part.toLowerCase();
      return spans.filter((sql) => sql.toLowerCase().includes(needle)).length;
    },
  };
}

async function withMemoryDb<T>(run: (handle: ReturnType<typeof attachCounter>, d: ReturnType<typeof drizzle>) => Promise<T>) {
  const raw = new PGlite();
  for (const file of readdirSync("drizzle").filter((name) => name.endsWith(".sql")).sort()) {
    await raw.exec(readFileSync(`drizzle/${file}`, "utf8"));
  }
  const d = drizzle(raw, { schema });
  const store = globalThis as typeof globalThis & { __sgDb?: DbHandle | null };
  const previous = store.__sgDb;
  store.__sgDb = { db: d as unknown as Database, driver: "pglite", raw, close: () => raw.close() };
  const counter = attachCounter(raw);
  try {
    return await run(counter, d);
  } finally {
    store.__sgDb = previous;
    await raw.close();
  }
}

async function project(d: ReturnType<typeof drizzle>, slug: string, over: Partial<typeof schema.project.$inferInsert> = {}) {
  const [row] = await d.insert(schema.project).values({
    canonicalProjectId: `gh:${slug}`,
    slug,
    name: slug,
    owner: "acme",
    fullName: `acme/${slug}`,
    primaryUrl: `https://github.com/acme/${slug}`,
    description: "Vendor text",
    parseState: "parsed",
    language: "Rust",
    topics: ["cli"],
    license: "MIT",
    primaryCategory: "dev-tools",
    ...over,
  }).returning();
  return row;
}

function installRequestCache() {
  const internals = (React as typeof React & {
    __SERVER_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE?: { A: unknown };
  }).__SERVER_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;
  if (!internals) throw new Error("react-server cache dispatcher is missing; run with --conditions=react-server");
  const caches = new Map<unknown, unknown>();
  internals.A = {
    getCacheForType(create: () => unknown) {
      let hit = caches.get(create);
      if (!hit) {
        hit = create();
        caches.set(create, hit);
      }
      return hit;
    },
    cacheSignal() {
      return null;
    },
  };
}

async function runDedupeChild() {
  installRequestCache();
  await withMemoryDb(async (counter, d) => {
    const row = await project(d, "pilot");
    for (const day of ["2026-01-01", "2026-01-02", "2026-01-03"]) {
      await d.insert(schema.dailySignal).values({
        projectId: row.id,
        signalDate: day,
        rank: 3,
        heatScore: 10,
        breakdown: {},
        isPublished: true,
      });
    }
    await d.insert(schema.aiContent).values({ projectId: row.id, locale: "zh", oneLiner: "一句。", passedGuard: true });
    counter.reset();

    const [first, second] = await Promise.all([getProjectBySlug("pilot"), getProjectBySlug("pilot")]);
    assert.equal(first, second);
    assert.equal(counter.count('from "project"'), 1, counter.spans.join("\n---\n"));
    assert.equal(counter.count('from "skill"'), 1, counter.spans.join("\n---\n"));
    assert.equal(counter.count('from "external_mention"'), 1);
    assert.equal(counter.count('from "repo_snapshot"'), 1);
    assert.equal(counter.count('from "ai_content"'), 1);
    assert.ok(first);

    counter.reset();
    const [copyA, copyB] = await Promise.all([getProjectCopy(first.project.id), getProjectCopy(first.project.id)]);
    assert.equal(copyA, copyB);
    assert.equal(copyA.zh?.oneLiner, "一句。");
    assert.equal(counter.count('from "ai_content"'), 1, counter.spans.join("\n---\n"));

    counter.reset();
    const [setA, setB] = await Promise.all([getSeoPilotSlugSet(), getSeoPilotSlugSet()]);
    assert.equal(setA, setB);
    assert.equal(setA.has("pilot"), true);
    assert.equal(counter.count("count(distinct"), 1, counter.spans.join("\n---\n"));

    counter.reset();
    const viewA = await loadSeoPilotView(first.project, "短句介绍。");
    const viewB = await loadSeoPilotView(first.project, "短句介绍。");
    assert.equal(viewA, viewB);
    assert.match(viewA.metaDescription ?? "", /短句介绍。/);
    assert.equal(viewA.momentum?.trackedDays, 3);
    const historyQueries = counter.count('from "daily_signal"');
    const peerQueries = counter.count("row_number()");
    assert.equal(historyQueries, 1, counter.spans.join("\n---\n"));
    assert.equal(peerQueries, 1, counter.spans.join("\n---\n"));

    const clone = { ...first.project, topics: first.project.topics ? [...first.project.topics] : null };
    const viewC = await loadSeoPilotView(clone, "另一句介绍。");
    assert.equal(counter.count('from "daily_signal"'), historyQueries);
    assert.equal(counter.count("row_number()"), peerQueries);
    assert.notEqual(viewC.metaDescription, viewA.metaDescription);
    assert.match(viewC.metaDescription ?? "", /另一句介绍。/);
    assert.equal(viewC.momentum?.trackedDays, viewA.momentum?.trackedDays);
    assert.equal(viewC.audience?.zh, viewA.audience?.zh);
  });
}

if (process.env[CHILD] === "dedupe") {
  try {
    await runDedupeChild();
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
  process.exit(0);
}

test("project payload reads do not wait on each other, and a miss stays one query", async () => {
  const queries = readFileSync("src/db/queries/index.ts", "utf8");
  const slugFn = queries.slice(
    queries.indexOf("export const getProjectBySlug"),
    queries.indexOf("export async function getFocusCounts"),
  );
  assert.match(slugFn, /Promise\.all\(/);
  assert.ok(slugFn.indexOf("if (!row || row.hidden) return null;") < slugFn.indexOf("Promise.all"));
  for (const table of ["skill", "aiContent", "externalMention", "repoSnapshot"]) {
    assert.match(slugFn, new RegExp(`from\\(${table}\\)`));
  }

  await withMemoryDb(async (counter, d) => {
    const row = await project(d, "widget");
    await d.insert(schema.skill).values([
      { projectId: row.id, slug: "alpha", name: "alpha", isVerifiedSkill: false },
      { projectId: row.id, slug: "beta", name: "beta", isVerifiedSkill: true },
    ]);
    await d.insert(schema.externalMention).values([
      { projectId: row.id, source: "hackernews", url: "https://news.ycombinator.com/1", title: "older", publishedAt: new Date("2026-01-01T00:00:00.000Z") },
      { projectId: row.id, source: "hackernews", url: "https://news.ycombinator.com/2", title: "newer", publishedAt: new Date("2026-02-01T00:00:00.000Z") },
    ]);
    await d.insert(schema.repoSnapshot).values([
      { projectId: row.id, stars: 1, capturedAt: new Date("2026-01-02T00:00:00.000Z") },
      { projectId: row.id, stars: 9, capturedAt: new Date("2026-01-01T00:00:00.000Z") },
    ]);
    await d.insert(schema.aiContent).values([
      { projectId: row.id, locale: "zh", oneLiner: "中文。" },
      { projectId: row.id, locale: "en", oneLiner: "English." },
    ]);
    await project(d, "secret", { hidden: true });
    counter.reset();

    const data = await getProjectBySlug("widget");
    assert.ok(data);
    assert.ok(counter.max() >= 2, counter.spans.join("\n---\n"));
    assert.deepEqual(data.skills.map((item) => item.name), ["beta", "alpha"]);
    assert.deepEqual(data.mentions.map((item) => item.title), ["newer", "older"]);
    assert.deepEqual(data.history.map((item) => item.stars), [9, 1]);
    const copy = await getProjectCopy(row.id);
    assert.equal(copy.zh?.oneLiner, "中文。");
    assert.equal(copy.en?.oneLiner, "English.");

    counter.reset();
    assert.equal(await getProjectBySlug("secret"), null);
    assert.equal(await getProjectBySlug("missing"), null);
    assert.equal(counter.count('from "skill"'), 0, counter.spans.join("\n---\n"));
    assert.equal(counter.count('from "project"'), 2);
  });
});

test("/p metadata and the page share one cached load", async () => {
  const page = readFileSync("src/app/p/[slug]/page.tsx", "utf8");
  const queries = readFileSync("src/db/queries/index.ts", "utf8");
  const seo = readFileSync("src/db/queries/seo-pilot.ts", "utf8");
  assert.match(page, /export const revalidate = 3600/);
  assert.match(page, /export const dynamicParams = true/);
  assert.match(page, /unionPrerenderSlugs\(/);
  assert.match(queries, /import \{ cache \} from "react"/);
  assert.match(queries, /export const getProjectBySlug = cache\(/);
  assert.match(queries, /export const getProjectCopy = cache\(/);
  assert.match(seo, /import \{ cache \} from "react"/);
  assert.match(seo, /export const getSeoPilotSlugSet = cache\(/);
  assert.match(seo, /export const loadSeoPilotView = cache\(/);
  assert.match(seo, /const loadSeoPilotFacts = cache\(/);
  assert.doesNotMatch(page, /cookies\(|headers\(|getCurrentUser/);

  const meta = page.slice(page.indexOf("export async function generateMetadata"), page.indexOf("const MONTHS"));
  const body = page.slice(page.indexOf("export default async function"));
  for (const source of [meta, body]) {
    assert.ok(source.indexOf("getSeoPilotSlugSet(") < source.indexOf("getProjectBySlug("));
    assert.match(source, /startSeoPilotFacts\(/);
    assert.match(source, /loadSeoPilotView\(/);
    assert.match(source, /isSeoPilot\(/);
  }
  assert.ok(body.indexOf("getProjectBySlug(slug)") < body.indexOf("redirectIfAlias("));
  assert.ok(body.indexOf("redirectIfAlias(") < body.lastIndexOf("notFound()"));
  assert.ok(body.indexOf("startSeoPilotFacts(") < body.indexOf("const copy = await copyPromise"));
  assert.equal(body.includes("await searchParams"), false);
  assert.equal(body.includes("cookies("), false);
  assert.equal(body.includes("headers("), false);

  const child = spawn(process.execPath, [
    "--conditions=react-server",
    "--import",
    "tsx",
    fileURLToPath(import.meta.url),
  ], {
    env: { ...process.env, [CHILD]: "dedupe" },
    cwd: process.cwd(),
  });
  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => { stdout += chunk; });
  child.stderr.on("data", (chunk) => { stderr += chunk; });
  const code = await new Promise<number>((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (status) => resolve(status ?? 1));
  });
  assert.equal(code, 0, `${stderr}\n${stdout}`);
});
