import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { eq } from "drizzle-orm";
import * as schema from "@/db/schema";
import type { Database, DbHandle } from "@/db/client";
import { confirmRecentlySent, requestSubscribe } from "./subscribe";
import { CONFIRM_RESEND_AFTER_MS, CONFIRM_TTL_MS } from "./tokens";
import { mockTransport, newsletterOutbox, resetNewsletterOutbox } from "./transport";

const site = "https://signalgarden.site";

function confirms() {
  return newsletterOutbox().filter((mail) => mail.idempotencyKey.startsWith("newsletter-confirm/"));
}

test("a pending confirm stays recent until the quiet window ends", () => {
  const sent = new Date("2026-10-18T00:00:00.000Z");
  const row = { status: "pending", confirmExpiresAt: new Date(sent.getTime() + CONFIRM_TTL_MS) };
  assert.equal(confirmRecentlySent(undefined, sent), false);
  assert.equal(confirmRecentlySent({ status: "active", confirmExpiresAt: row.confirmExpiresAt }, sent), false);
  assert.equal(confirmRecentlySent({ status: "pending", confirmExpiresAt: null }, sent), false);
  assert.equal(confirmRecentlySent(row, sent), true);
  assert.equal(confirmRecentlySent(row, new Date(sent.getTime() + CONFIRM_RESEND_AFTER_MS - 1)), true);
  assert.equal(confirmRecentlySent(row, new Date(sent.getTime() + CONFIRM_RESEND_AFTER_MS)), false);
});

test("one signup sends one confirm mail until the quiet window ends", async () => {
  const raw = new PGlite();
  const d = drizzle(raw, { schema });
  for (const file of readdirSync("drizzle").filter((name) => name.endsWith(".sql")).sort()) {
    await raw.exec(readFileSync(`drizzle/${file}`, "utf8"));
  }
  const store = globalThis as typeof globalThis & { __sgDb?: DbHandle | null };
  const previous = store.__sgDb;
  store.__sgDb = { db: d as unknown as Database, driver: "pglite", raw, close: async () => { await raw.close(); } };
  resetNewsletterOutbox();
  const transport = mockTransport();
  const t0 = new Date("2026-10-18T03:00:00.000Z");

  async function attempt(email: string, now: Date, ip: string) {
    return requestSubscribe({
      email,
      honeypot: "",
      formStartedAt: now.getTime() - 5_000,
      turnstileToken: "",
      locale: "zh",
      source: "home",
      ip,
      userAgent: "dedupe-test",
      now,
      siteUrl: site,
      transport,
    });
  }

  try {
    const first = await attempt("once@example.com", t0, "203.0.113.10");
    const soon = await attempt("once@example.com", new Date(t0.getTime() + 3_000), "203.0.113.10");
    const later = await attempt("once@example.com", new Date(t0.getTime() + 11_000), "203.0.113.10");
    assert.deepEqual(first, { ok: true, sent: true });
    const [row] = await d.select().from(schema.newsletterSubscriber).where(eq(schema.newsletterSubscriber.email, "once@example.com"));
    const hash = row.confirmTokenHash;
    assert.deepEqual(soon, { ok: true, sent: false });
    assert.deepEqual(later, { ok: true, sent: false });
    const [kept] = await d.select().from(schema.newsletterSubscriber).where(eq(schema.newsletterSubscriber.email, "once@example.com"));
    assert.equal(kept.confirmTokenHash, hash);
    assert.equal(confirms().length, 1);

    const raced = await Promise.all([
      attempt("race@example.com", t0, "203.0.113.20"),
      attempt("race@example.com", t0, "203.0.113.21"),
      attempt("race@example.com", t0, "203.0.113.22"),
    ]);
    assert.equal(raced.filter((result) => result.ok && result.sent).length, 1);
    assert.equal(confirms().length, 2);

    const after = await attempt("once@example.com", new Date(t0.getTime() + CONFIRM_RESEND_AFTER_MS), "203.0.113.30");
    assert.deepEqual(after, { ok: true, sent: true });
    assert.equal(confirms().length, 3);
  } finally {
    store.__sgDb = previous;
    await raw.close();
  }
});
