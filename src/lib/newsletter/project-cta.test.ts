import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "@/db/schema";
import type { Database, DbHandle } from "@/db/client";
import { requestSubscribe } from "./subscribe";
import { mockTransport, newsletterOutbox, resetNewsletterOutbox } from "./transport";

const site = "https://signalgarden.site";

test("a project_cta signup stores that source and keeps it on the confirm link", async () => {
  const raw = new PGlite();
  const d = drizzle(raw, { schema });
  for (const file of readdirSync("drizzle").filter((name) => name.endsWith(".sql")).sort()) {
    await raw.exec(readFileSync(`drizzle/${file}`, "utf8"));
  }
  const store = globalThis as typeof globalThis & { __sgDb?: DbHandle | null };
  const previous = store.__sgDb;
  store.__sgDb = { db: d as unknown as Database, driver: "pglite", raw, close: async () => { await raw.close(); } };
  resetNewsletterOutbox();
  const now = new Date("2026-10-20T03:00:00.000Z");

  try {
    const created = await requestSubscribe({
      email: "cta@example.com",
      honeypot: "",
      formStartedAt: now.getTime() - 5_000,
      turnstileToken: "",
      locale: "zh",
      source: "project_cta",
      ip: "203.0.113.40",
      userAgent: "project-cta-test",
      now,
      siteUrl: site,
      transport: mockTransport(),
    });
    assert.deepEqual(created, { ok: true, sent: true });
    const [row] = await d.select().from(schema.newsletterSubscriber);
    assert.equal(row.email, "cta@example.com");
    assert.equal(row.source, "project_cta");
    assert.match(newsletterOutbox()[0].html, /loc=project_cta/);
  } finally {
    store.__sgDb = previous;
    await raw.close();
  }
});
