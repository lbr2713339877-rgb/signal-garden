import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "@/db/schema";
import type { Database, DbHandle } from "@/db/client";
import { focusInputToken, refocus, storedFocusInput } from "./refocus";

test("focus input token ignores topic order and stores on the evidence key", () => {
  const base = {
    readmeHash: "abc",
    name: "Landing",
    description: "A next.js site",
    topics: ["seo", "nextjs"],
    queries: ["focus:web:repo"],
    skillDigest: null,
  };
  const forward = focusInputToken(base);
  assert.equal(forward, focusInputToken({ ...base, topics: ["nextjs", "seo"], queries: ["focus:web:repo"] }));
  assert.notEqual(forward, focusInputToken({ ...base, readmeHash: "def" }));
  assert.equal(storedFocusInput({ web: ["readme: 1 match"], _input: [forward] }), forward);
  assert.equal(storedFocusInput(null), null);
  assert.equal(storedFocusInput({ _input: [] }), null);
});

test("the second refocus does not read README text", async () => {
  const raw = new PGlite();
  const spans: string[] = [];
  const orig = raw.query.bind(raw);
  raw.query = (async (...args: Parameters<typeof orig>) => {
    spans.push(String(args[0]));
    return orig(...args);
  }) as typeof raw.query;
  const d = drizzle(raw, { schema });
  for (const file of readdirSync("drizzle").filter((name) => name.endsWith(".sql")).sort()) {
    await raw.exec(readFileSync(`drizzle/${file}`, "utf8"));
  }
  const store = globalThis as typeof globalThis & { __sgDb?: DbHandle | null };
  const previous = store.__sgDb;
  store.__sgDb = { db: d as unknown as Database, driver: "pglite", raw, close: () => raw.close() };

  try {
    const [row] = await d.insert(schema.project).values({
      canonicalProjectId: "repo:landing",
      slug: "landing",
      name: "Landing Kit",
      description: "Build a landing page with Next.js and Tailwind",
      primaryUrl: "https://github.com/test/landing",
      readmeText: `${"landing page for an indie website. ".repeat(400)}tailwind next.js`,
      readmeHash: "readme-hash",
      topics: ["nextjs", "tailwind"],
      parseState: "parsed",
    }).returning({ id: schema.project.id });

    spans.length = 0;
    const first = await refocus();
    assert.equal(first.itemsIn, 1);
    assert.ok(spans.some((sql) => sql.includes("readme_text")), spans.join("\n---\n"));
    const [stamped] = await d.select({ focusEvidence: schema.project.focusEvidence }).from(schema.project).where(eq(schema.project.id, row.id));
    assert.equal(typeof storedFocusInput(stamped?.focusEvidence), "string");

    spans.length = 0;
    const second = await refocus();
    assert.equal(second.meta?.readmeReads, 0);
    assert.equal(second.meta?.changed, 0);
    assert.equal(spans.some((sql) => sql.toLowerCase().includes("readme_text")), false, spans.join("\n---\n"));
  } finally {
    store.__sgDb = previous;
    await raw.close();
  }
});
