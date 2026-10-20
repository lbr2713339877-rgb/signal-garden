import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { eq } from "drizzle-orm";
import * as schema from "@/db/schema";
import type { Database, DbHandle } from "@/db/client";
import { hashEmail } from "./address";
import { POST as resendRoute } from "@/app/api/subscribe/resend/route";
import {
  requestResend,
  requestSubscribe,
  reusableConfirmToken,
} from "./subscribe";
import { EMAIL_LIMIT } from "./tokens";
import { hashToken } from "./tokens";
import { RESEND_DAILY_LIMIT, RESEND_DAY_BUCKET } from "./resend-policy";
import { mockTransport, newsletterOutbox, resetNewsletterOutbox } from "./transport";

const site = "https://signalgarden.site";

function confirms() {
  return newsletterOutbox().filter((mail) => mail.idempotencyKey.startsWith("newsletter-confirm/"));
}

function tokenIn(html: string): string {
  const match = html.match(/\/subscribe\/confirm\?t=([A-Za-z0-9_-]+)/);
  assert.ok(match, "confirm token missing");
  return match[1];
}

async function withDb(run: (d: Database) => Promise<void>) {
  const raw = new PGlite();
  const d = drizzle(raw, { schema });
  for (const file of readdirSync("drizzle").filter((name) => name.endsWith(".sql")).sort()) {
    await raw.exec(readFileSync(`drizzle/${file}`, "utf8"));
  }
  const store = globalThis as typeof globalThis & { __sgDb?: DbHandle | null };
  const previous = store.__sgDb;
  store.__sgDb = { db: d as unknown as Database, driver: "pglite", raw, close: async () => { await raw.close(); } };
  resetNewsletterOutbox();
  try {
    await run(d as unknown as Database);
  } finally {
    store.__sgDb = previous;
    await raw.close();
  }
}

function attempt(email: string, now: Date, ip: string, transport = mockTransport()) {
  return requestSubscribe({
    email,
    honeypot: "",
    formStartedAt: now.getTime() - 5_000,
    turnstileToken: "",
    locale: "zh",
    source: "home",
    ip,
    userAgent: "resend-test",
    now,
    siteUrl: site,
    transport,
  });
}

test("the resend route answers with the same shape when the body is unusable", async () => {
  const missing = await resendRoute(new Request("http://127.0.0.1/api/subscribe/resend", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{",
  }));
  assert.equal(missing.status, 200);
  assert.deepEqual(await missing.json(), { ok: true, sent: false });

  const invalid = await resendRoute(new Request("http://127.0.0.1/api/subscribe/resend", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "not-an-email" }),
  }));
  assert.equal(invalid.status, 200);
  assert.deepEqual(await invalid.json(), { ok: true, sent: false });
});

test("resend keeps a valid token, refreshes an expired one, and hides whether the address exists", async () => {
  await withDb(async (d) => {
    const transport = mockTransport();
    const t0 = new Date("2026-10-20T03:00:00.000Z");
    const created = await attempt("reader@example.com", t0, "203.0.113.10", transport);
    assert.deepEqual(created, { ok: true, sent: true });
    const [row] = await d.select().from(schema.newsletterSubscriber);
    const firstToken = tokenIn(confirms()[0].html);
    assert.equal(reusableConfirmToken(row, t0), firstToken);
    assert.equal(row.confirmTokenHash, hashToken(firstToken));

    const tooSoon = await requestResend({
      email: "reader@example.com",
      locale: "zh",
      source: "home",
      ip: "203.0.113.10",
      now: new Date(t0.getTime() + 1_000),
      siteUrl: site,
      transport,
    });
    assert.deepEqual(tooSoon, { ok: true, sent: false });
    assert.equal(confirms().length, 1);

    const again = await requestResend({
      email: "Reader@Example.com",
      locale: "en",
      source: "footer",
      ip: "203.0.113.10",
      now: new Date(t0.getTime() + 62_000),
      siteUrl: site,
      transport,
    });
    assert.deepEqual(again, { ok: true, sent: true });
    assert.equal(confirms().length, 2);
    assert.equal(tokenIn(confirms()[1].html), firstToken);
    const [kept] = await d.select().from(schema.newsletterSubscriber).where(eq(schema.newsletterSubscriber.id, row.id));
    assert.equal(kept.confirmTokenHash, row.confirmTokenHash);
    assert.match(confirms()[1].html, /loc=footer/);

    const cooled = await requestResend({
      email: "reader@example.com",
      locale: "zh",
      source: "home",
      ip: "198.51.100.8",
      now: new Date(t0.getTime() + 70_000),
      siteUrl: site,
      transport,
    });
    assert.deepEqual(cooled, { ok: true, sent: false });
    assert.equal(confirms().length, 2);

    const unknown = await requestResend({
      email: "missing@example.com",
      locale: "zh",
      source: "home",
      ip: "198.51.100.9",
      now: new Date(t0.getTime() + 61_000),
      siteUrl: site,
      transport,
    });
    assert.deepEqual(unknown, { ok: true, sent: false });
    assert.equal(confirms().length, 2);

    const active = await attempt("active@example.com", t0, "203.0.113.40", transport);
    assert.deepEqual(active, { ok: true, sent: true });
    await d.update(schema.newsletterSubscriber).set({ status: "active" }).where(eq(schema.newsletterSubscriber.email, "active@example.com"));
    const beforeActive = confirms().length;
    const hidden = await requestResend({
      email: "active@example.com",
      locale: "zh",
      source: "home",
      ip: "203.0.113.41",
      now: new Date(t0.getTime() + 120_000),
      siteUrl: site,
      transport,
    });
    assert.deepEqual(hidden, unknown);
    assert.equal(confirms().length, beforeActive);

    const expiredAt = new Date(kept.confirmExpiresAt!.getTime() + 1_000);
    const refreshed = await requestResend({
      email: "reader@example.com",
      locale: "zh",
      source: "today_inline",
      ip: "203.0.113.12",
      now: expiredAt,
      siteUrl: site,
      transport,
    });
    assert.deepEqual(refreshed, { ok: true, sent: true });
    const [rotated] = await d.select().from(schema.newsletterSubscriber).where(eq(schema.newsletterSubscriber.id, row.id));
    assert.notEqual(rotated.confirmTokenHash, row.confirmTokenHash);
    const nextToken = tokenIn(confirms().at(-1)!.html);
    assert.notEqual(nextToken, firstToken);
    assert.equal(rotated.confirmTokenHash, hashToken(nextToken));
    assert.equal(reusableConfirmToken(rotated, expiredAt), nextToken);
    assert.equal(rotated.unsubTokenHash, row.unsubTokenHash);
  });
});

test("resend rate limits never call the mailer and share the email cap", async () => {
  await withDb(async (d) => {
    const transport = mockTransport();
    const now = new Date("2026-10-20T04:00:00.000Z");
    const email = "capped@example.com";
    const created = await attempt(email, now, "203.0.113.20", transport);
    assert.deepEqual(created, { ok: true, sent: true });
    const [row] = await d.select().from(schema.newsletterSubscriber).where(eq(schema.newsletterSubscriber.email, email));

    for (let i = 0; i < EMAIL_LIMIT - 1; i += 1) {
      await d.insert(schema.newsletterRateEvent).values({
        bucket: "email",
        keyHash: row.emailHash,
        createdAt: new Date(now.getTime() - 120_000),
      });
    }
    const limited = await requestResend({
      email,
      locale: "zh",
      source: "home",
      ip: "203.0.113.21",
      now: new Date(now.getTime() + 61_000),
      siteUrl: site,
      transport,
    });
    assert.deepEqual(limited, { ok: true, sent: false });
    assert.equal(confirms().filter((mail) => mail.to === email).length, 1);

    const other = "daily@example.com";
    const otherCreated = await attempt(other, now, "203.0.113.30", transport);
    assert.deepEqual(otherCreated, { ok: true, sent: true });
    const [otherRow] = await d.select().from(schema.newsletterSubscriber).where(eq(schema.newsletterSubscriber.email, other));
    for (let i = 0; i < RESEND_DAILY_LIMIT; i += 1) {
      await d.insert(schema.newsletterRateEvent).values({
        bucket: RESEND_DAY_BUCKET,
        keyHash: otherRow.emailHash,
        createdAt: new Date(now.getTime() - 120_000),
      });
    }
    const daily = await requestResend({
      email: other,
      locale: "zh",
      source: "home",
      ip: "203.0.113.31",
      now: new Date(now.getTime() + 61_000),
      siteUrl: site,
      transport,
    });
    assert.deepEqual(daily, { ok: true, sent: false });
    assert.equal(confirms().filter((mail) => mail.to === other).length, 1);
    assert.equal(hashEmail(other), otherRow.emailHash);
  });
});

test("one IP cannot resend a second address inside the cooldown", async () => {
  await withDb(async () => {
    const transport = mockTransport();
    const t0 = new Date("2026-10-20T05:00:00.000Z");
    assert.deepEqual(await attempt("one@example.com", t0, "203.0.113.50", transport), { ok: true, sent: true });
    assert.deepEqual(await attempt("two@example.com", t0, "203.0.113.51", transport), { ok: true, sent: true });
    const first = await requestResend({
      email: "one@example.com",
      locale: "zh",
      source: "home",
      ip: "203.0.113.60",
      now: new Date(t0.getTime() + 61_000),
      siteUrl: site,
      transport,
    });
    const second = await requestResend({
      email: "two@example.com",
      locale: "zh",
      source: "home",
      ip: "203.0.113.60",
      now: new Date(t0.getTime() + 62_000),
      siteUrl: site,
      transport,
    });
    const otherIp = await requestResend({
      email: "two@example.com",
      locale: "zh",
      source: "home",
      ip: "203.0.113.61",
      now: new Date(t0.getTime() + 63_000),
      siteUrl: site,
      transport,
    });
    assert.deepEqual(first, { ok: true, sent: true });
    assert.deepEqual(second, { ok: true, sent: false });
    assert.deepEqual(otherIp, { ok: true, sent: true });
  });
});
