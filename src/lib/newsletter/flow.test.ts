import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { createHmac, randomBytes } from "node:crypto";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { eq } from "drizzle-orm";
import * as schema from "@/db/schema";
import type { Database, DbHandle } from "@/db/client";
import { signalDate } from "@/lib/day";
import { TODAY_LIMIT } from "@/lib/edition";
import { hashEmail } from "./address";
import { sendNewsletter } from "@/jobs/newsletter";
import {
  confirmNewsletter,
  inspectConfirm,
  requestSubscribe,
  unsubscribeNewsletter,
} from "./subscribe";
import { hashToken, newSubscriberId, unsubTokenFor } from "./tokens";
import { mockTransport, newsletterOutbox, resetNewsletterOutbox } from "./transport";
import { applyNewsletterWebhook, verifyResendWebhook } from "./webhook";

const site = "https://signalgarden.site";

function sign(secret: string, payload: string) {
  const id = `msg_${randomBytes(8).toString("hex")}`;
  const timestamp = String(Math.floor(Date.now() / 1000));
  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const signature = createHmac("sha256", key).update(`${id}.${timestamp}.${payload}`).digest("base64");
  return { id, timestamp, signature: `v1,${signature}` };
}

test("subscribe, confirm, digest idempotency and unsubscribe", async () => {
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
  const now = new Date("2026-10-17T02:00:00.000Z");
  const today = signalDate(now);

  try {
    const created = await requestSubscribe({
      email: "Reader@Example.com",
      honeypot: "",
      formStartedAt: now.getTime() - 5_000,
      turnstileToken: "",
      locale: "en",
      source: "footer",
      ip: "203.0.113.10",
      userAgent: "test-agent",
      now,
      siteUrl: site,
      transport,
    });
    assert.deepEqual(created, { ok: true, sent: true });
    const [row] = await d.select().from(schema.newsletterSubscriber);
    assert.equal(row.email, "reader@example.com");
    assert.equal(row.status, "pending");
    assert.equal(row.locale, "en");
    assert.equal(row.confirmTokenHash, hashToken(tokenIn(newsletterOutbox()[0].html, "/subscribe/confirm")));
    assert.notEqual(row.consentIpHash, "203.0.113.10");
    assert.equal(newsletterOutbox()[0].headers["List-Unsubscribe-Post"], "List-Unsubscribe=One-Click");

    const confirmToken = tokenIn(newsletterOutbox()[0].html, "/subscribe/confirm");
    assert.equal((await inspectConfirm(confirmToken, now)).state, "pending");
    assert.equal((await d.select().from(schema.newsletterSubscriber))[0].status, "pending");

    assert.equal(await confirmNewsletter(confirmToken, { now, siteUrl: site, transport }), "confirmed");
    assert.equal((await d.select().from(schema.newsletterSubscriber))[0].status, "active");
    assert.equal(await confirmNewsletter(confirmToken, { now, siteUrl: site, transport }), "already");
    assert.equal(newsletterOutbox().filter((mail) => mail.idempotencyKey.startsWith("newsletter-welcome/")).length, 1);

    const again = await requestSubscribe({
      email: "reader@example.com",
      honeypot: "",
      formStartedAt: now.getTime() - 5_000,
      turnstileToken: "",
      locale: "en",
      source: "home",
      ip: "203.0.113.11",
      userAgent: "test-agent",
      now,
      siteUrl: site,
      transport,
    });
    assert.deepEqual(again, { ok: true, sent: false });

    const cards = Array.from({ length: TODAY_LIMIT }, (_, index) => ({
      name: `Project ${index + 1}`,
      slug: `project-${index + 1}`,
      oneLiner: null,
      oneLinerEn: `Line ${index + 1}`,
      forks7d: index + 1,
    }));
    const short = await sendNewsletter({
      now,
      siteUrl: site,
      transport,
      edition: { date: today, isPrevious: false, cards: cards.slice(0, TODAY_LIMIT - 1) },
    });
    assert.equal(short.meta?.skipped, "short");
    assert.equal(short.itemsOut, 0);

    const wrong = await sendNewsletter({
      now,
      siteUrl: site,
      transport,
      edition: { date: "2020-01-01", isPrevious: true, cards },
    });
    assert.equal(wrong.meta?.skipped, "wrong_date");

    const firstSend = await sendNewsletter({
      now,
      siteUrl: site,
      transport,
      edition: { date: today, isPrevious: false, cards },
    });
    const secondSend = await sendNewsletter({
      now,
      siteUrl: site,
      transport,
      edition: { date: today, isPrevious: false, cards },
    });
    assert.equal(firstSend.itemsOut, 1);
    assert.equal(secondSend.itemsOut, 0);
    const sends = await d.select().from(schema.newsletterSend);
    assert.equal(sends.length, 1);
    assert.equal(sends[0].status, "sent");
    const daily = newsletterOutbox().filter((mail) => mail.idempotencyKey.startsWith("newsletter/"));
    assert.equal(daily.length, 1);
    assert.match(daily[0].headers["List-Unsubscribe"], /List-Unsubscribe=One-Click|api\/unsubscribe/);
    assert.equal(daily[0].headers["List-Unsubscribe-Post"], "List-Unsubscribe=One-Click");
    assert.match(daily[0].html, /\/p\/project-1/);
    assert.match(daily[0].text, /10 new forks in 7 days/);

    const unsubToken = tokenIn(daily[0].html, "/unsubscribe");
    assert.equal(await unsubscribeNewsletter(unsubToken, now), "unsubscribed");
    assert.equal(await unsubscribeNewsletter(unsubToken, now), "already");
    const [done] = await d.select().from(schema.newsletterSubscriber);
    assert.equal(done.status, "unsubscribed");
    assert.ok(done.purgeEmailAt);

    const honeypot = await requestSubscribe({
      email: "other@example.com",
      honeypot: "acme",
      formStartedAt: now.getTime() - 5_000,
      turnstileToken: "",
      locale: "zh",
      source: "today",
      ip: "203.0.113.12",
      userAgent: null,
      now,
      siteUrl: site,
      transport,
    });
    assert.deepEqual(honeypot, { ok: true, sent: false });
    assert.equal((await d.select().from(schema.newsletterSubscriber)).length, 1);

    const secret = `whsec_${randomBytes(24).toString("base64")}`;
    const payload = JSON.stringify({
      type: "email.bounced",
      created_at: now.toISOString(),
      data: {
        email_id: sends[0].resendMessageId,
        from: "Signal Garden <hello@signalgarden.site>",
        to: ["reader@example.com"],
        subject: "digest",
        created_at: now.toISOString(),
        bounce: { message: "no such user", subType: "General", type: "Permanent" },
      },
    });
    const signed = sign(secret, payload);
    const event = verifyResendWebhook({ payload, ...signed, secret });
    assert.equal(event.type, "email.bounced");
    await applyNewsletterWebhook(event);
    const [bounced] = await d.select().from(schema.newsletterSubscriber).where(eq(schema.newsletterSubscriber.id, row.id));
    assert.equal(bounced.status, "bounced");
    assert.equal((await d.select().from(schema.newsletterSend))[0].status, "bounced");

    const complainedId = newSubscriberId();
    await d.insert(schema.newsletterSubscriber).values({
      id: complainedId,
      email: "complained@example.com",
      emailHash: hashEmail("complained@example.com"),
      status: "active",
      locale: "zh",
      unsubTokenHash: hashToken(unsubTokenFor(complainedId)),
    });
    await applyNewsletterWebhook({
      type: "email.complained",
      data: { email_id: "missing", to: ["complained@example.com"] },
    });
    const [complained] = await d.select().from(schema.newsletterSubscriber).where(eq(schema.newsletterSubscriber.id, complainedId));
    assert.equal(complained.status, "complained");

    await assert.rejects(async () => verifyResendWebhook({
      payload,
      id: signed.id,
      timestamp: signed.timestamp,
      signature: "v1,not-a-real-signature",
      secret,
    }));
    await assert.rejects(async () => verifyResendWebhook({
      payload,
      id: signed.id,
      timestamp: signed.timestamp,
      signature: signed.signature,
      secret: "",
    }));
  } finally {
    store.__sgDb = previous;
    await raw.close();
  }
});

function tokenIn(html: string, path: string): string {
  const match = html.match(new RegExp(`${path}\\?t=([A-Za-z0-9_-]+)`));
  assert.ok(match, `token missing in ${path}`);
  return match[1];
}
