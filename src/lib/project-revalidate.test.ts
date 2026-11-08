import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "@/db/schema";
import type { Database, DbHandle } from "@/db/client";
import { publishedProjectSlugs } from "@/db/queries";
import { signalDate } from "@/lib/day";
import { projectPagePaths, revalidatePublishedProjectPages } from "@/lib/project-revalidate";
import { handleRevalidatePaths } from "@/lib/revalidate-paths";

const REVALIDATE_SECRET = "test-revalidate-secret";

function restoreSecret(previous: string | undefined) {
  if (previous === undefined) delete process.env.REVALIDATE_SECRET;
  else process.env.REVALIDATE_SECRET = previous;
}

test("project revalidation only targets /p/<slug> and only from loopback", async () => {
  assert.deepEqual(projectPagePaths(["widget", "not a slug", "widget", "old-library"]), ["/p/widget", "/p/old-library"]);
  const previous = process.env.REVALIDATE_SECRET;
  process.env.REVALIDATE_SECRET = REVALIDATE_SECRET;
  try {
    const seen: string[] = [];
    const ok = await handleRevalidatePaths(new Request("http://127.0.0.1:3000/api/revalidate-paths", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        host: "127.0.0.1:3000",
        "x-revalidate-token": REVALIDATE_SECRET,
      },
      body: JSON.stringify({ paths: ["/p/widget", "/today", "/p/not a slug", "/p/widget", "/login"] }),
    }), (path) => seen.push(path));
    assert.equal(ok.status, 200);
    assert.deepEqual(seen, ["/p/widget"]);

    const proxied = new Request("http://127.0.0.1:3000/api/revalidate-paths", {
      method: "POST",
      headers: { "x-forwarded-for": "203.0.113.5", host: "127.0.0.1:3000" },
    });
    const denied = await handleRevalidatePaths(proxied, () => {
      throw new Error("should not revalidate");
    });
    assert.equal(denied.status, 403);
  } finally {
    restoreSecret(previous);
  }
});

test("the daily job revalidates today's published project pages", async () => {
  const previousSecret = process.env.REVALIDATE_SECRET;
  process.env.REVALIDATE_SECRET = REVALIDATE_SECRET;
  const calls: { url: string; body: { paths: string[] }; token: string | null; redirect: RequestRedirect | undefined }[] = [];
  let result;
  try {
    result = await revalidatePublishedProjectPages({
      slugs: ["widget", "Bad Slug"],
      origin: "http://127.0.0.1:3000",
      fetchImpl: async (input, init) => {
        calls.push({
          url: String(input),
          body: JSON.parse(String(init?.body)),
          token: new Headers(init?.headers).get("x-revalidate-token"),
          redirect: init?.redirect,
        });
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      },
    });
  } finally {
    restoreSecret(previousSecret);
  }
  assert.equal(result.itemsOut, 1);
  assert.deepEqual(calls[0]?.body.paths, ["/p/widget"]);
  assert.equal(calls[0]?.url, "http://127.0.0.1:3000/api/revalidate-paths");
  assert.equal(calls[0]?.token, REVALIDATE_SECRET);
  assert.equal(calls[0]?.redirect, "error");
  assert.equal(JSON.stringify(result).includes(REVALIDATE_SECRET), false);

  const raw = new PGlite();
  for (const file of readdirSync("drizzle").filter((name) => name.endsWith(".sql")).sort()) {
    await raw.exec(readFileSync(`drizzle/${file}`, "utf8"));
  }
  const d = drizzle(raw, { schema });
  const store = globalThis as typeof globalThis & { __sgDb?: DbHandle | null };
  const previous = store.__sgDb;
  store.__sgDb = { db: d as unknown as Database, driver: "pglite", raw, close: () => raw.close() };
  const today = signalDate();
  try {
    const [row] = await d.insert(schema.project).values({
      canonicalProjectId: "gh:widget",
      slug: "widget",
      name: "Widget",
      owner: "acme",
      fullName: "acme/widget",
      primaryUrl: "https://github.com/acme/widget",
      description: "Vendor text",
      parseState: "parsed",
    }).returning();
    await d.insert(schema.dailySignal).values({
      projectId: row.id,
      signalDate: today,
      rank: 1,
      heatScore: 10,
      breakdown: {},
      isPublished: true,
    });
    assert.deepEqual(await publishedProjectSlugs(today), ["widget"]);
    const empty = await revalidatePublishedProjectPages({
      now: new Date("2020-01-01T00:00:00Z"),
      origin: "http://127.0.0.1:3000",
      fetchImpl: async () => {
        throw new Error("no paths to refresh");
      },
    });
    assert.equal(empty.itemsOut, 0);
  } finally {
    store.__sgDb = previous;
    await raw.close();
  }
});
