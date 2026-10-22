import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { eq } from "drizzle-orm";
import { POST as subscribeRoute } from "@/app/api/subscribe/route";
import * as schema from "@/db/schema";
import type { Database, DbHandle } from "@/db/client";
import { confirmNewsletter, requestResend } from "./subscribe";
import {
  ATTRIBUTION_STORAGE_KEY,
  REFERRER_MAX,
  UTM_MAX,
  attributionFieldsFromStored,
  firstTouchRecord,
  parseSignupAttribution,
  referrerOriginPath,
} from "./attribution";
import { mockTransport, newsletterOutbox, resetNewsletterOutbox } from "./transport";

const MIGRATION = "0018_subscriber_attribution.sql";
const ADDED = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "referrer"] as const;

function migrationFiles(): string[] {
  return readdirSync("drizzle").filter((name) => /^\d+_[\w-]+\.sql$/.test(name)).sort();
}

test("signup attribution parsing truncates tags and keeps only the referrer origin and path", () => {
  const long = `  ${"测".repeat(UTM_MAX + 40)}  `;
  const path = "p".repeat(520);
  const parsed = parseSignupAttribution({
    utm_source: long,
    utm_medium: " email ",
    utm_campaign: "launch",
    utm_content: "   ",
    referrer: `https://user:secret@news.example/${path}?email=person@example.com&token=abc#frag`,
    ip: "203.0.113.44",
    userAgent: "Mozilla/5.0 should-not-land",
    user_agent: "also-not-stored",
  });
  assert.equal(parsed.utmSource?.length, UTM_MAX);
  assert.equal(parsed.utmSource, "测".repeat(UTM_MAX));
  assert.equal(parsed.utmMedium, "email");
  assert.equal(parsed.utmCampaign, "launch");
  assert.equal(parsed.utmContent, null);
  assert.equal(parsed.referrer?.length, REFERRER_MAX);
  assert.match(parsed.referrer ?? "", /^https:\/\/news\.example\/p+$/);
  assert.doesNotMatch(parsed.referrer ?? "", /secret|person@|token|\?|#/);
  assert.equal(JSON.stringify(parsed).includes("203.0.113.44"), false);
  assert.equal(JSON.stringify(parsed).includes("should-not-land"), false);

  assert.deepEqual(parseSignupAttribution({}), {
    utmSource: null,
    utmMedium: null,
    utmCampaign: null,
    utmContent: null,
    referrer: null,
  });
  assert.deepEqual(parseSignupAttribution(null), parseSignupAttribution({}));
  assert.equal(parseSignupAttribution({ utm_source: 12, utm_medium: ["social"], referrer: { href: "https://x.test" } }).utmSource, null);
  assert.equal(referrerOriginPath("https://ref.example/docs?utm_source=ad#hash"), "https://ref.example/docs");
  assert.equal(referrerOriginPath("https://ref.example:8443/a?b=1"), "https://ref.example:8443/a");
  assert.equal(referrerOriginPath("https://ref.example/?email=a@b.c"), "https://ref.example/");
  assert.equal(referrerOriginPath("javascript:alert(1)"), null);
  assert.equal(referrerOriginPath("not a url"), null);
  assert.equal(referrerOriginPath(""), null);
  assert.equal(referrerOriginPath("/relative"), null);
});

test("first landing in a session is kept and later params are not written over it", () => {
  const first = firstTouchRecord(
    null,
    "?utm_source=hn&utm_medium=social&utm_campaign=oct&utm_content=logo&email=person@example.com",
    "https://news.ycombinator.com/item?id=9",
  );
  assert.ok(first);
  assert.equal(firstTouchRecord(first, "?utm_source=other", "https://google.com/"), null);
  assert.equal(firstTouchRecord("", "?utm_source=other", "https://google.com/"), null);
  const stored = JSON.parse(first) as Record<string, string>;
  assert.deepEqual(stored, {
    utm_source: "hn",
    utm_medium: "social",
    utm_campaign: "oct",
    utm_content: "logo",
    referrer: "https://news.ycombinator.com/item?id=9",
  });
  assert.equal("email" in stored, false);
  assert.deepEqual(attributionFieldsFromStored(first), {
    utm_source: "hn",
    utm_medium: "social",
    utm_campaign: "oct",
    utm_content: "logo",
    referrer: "https://news.ycombinator.com/item?id=9",
  });
  const direct = firstTouchRecord(null, "", "");
  assert.deepEqual(attributionFieldsFromStored(direct), {});
  assert.deepEqual(attributionFieldsFromStored("{"), {});
  assert.deepEqual(attributionFieldsFromStored(JSON.stringify({ ip: "203.0.113.1", userAgent: "spy", utm_source: "ok" })), {
    utm_source: "ok",
  });
  assert.equal(ATTRIBUTION_STORAGE_KEY, "sg_subscribe_attribution");

  const layout = readFileSync(new URL("../../app/layout.tsx", import.meta.url), "utf8");
  const capture = readFileSync(new URL("../../components/subscribe/AttributionCapture.tsx", import.meta.url), "utf8");
  const form = readFileSync(new URL("../../components/v3/NewsletterForm.tsx", import.meta.url), "utf8");
  assert.match(layout, /<AttributionCapture \/>/);
  assert.match(capture, /"use client"/);
  assert.match(capture, /firstTouchRecord\(existing, window\.location\.search, document\.referrer\)/);
  assert.doesNotMatch(capture, /fetch\(|navigator\.userAgent|XMLHttpRequest/);
  assert.match(form, /\.\.\.readStoredAttribution\(\)/);
  assert.match(form, /source: location/);
});

test("attribution migration only adds nullable columns to newsletter subscribers", async () => {
  const files = migrationFiles();
  assert.equal(files.at(-1), MIGRATION);
  assert.equal(files.filter((name) => name.startsWith("0018_")).length, 1);
  const sql = readFileSync(`drizzle/${MIGRATION}`, "utf8");
  const added = [...sql.matchAll(/ADD COLUMN IF NOT EXISTS "([a-z_]+)" text/g)].map((match) => match[1]);
  assert.deepEqual(added, [...ADDED]);
  assert.doesNotMatch(sql, /\b(DROP|DELETE|UPDATE|TRUNCATE|RENAME|ALTER COLUMN)\b/i);
  assert.doesNotMatch(sql, /NOT NULL/i);
  const alters = sql.match(/ALTER TABLE "[^"]+"/g) ?? [];
  assert.ok(alters.length >= ADDED.length);
  for (const alter of alters) assert.equal(alter, 'ALTER TABLE "newsletter_subscriber"');
  const journal = JSON.parse(readFileSync("drizzle/meta/_journal.json", "utf8")) as {
    entries: { tag: string }[];
  };
  assert.equal(journal.entries.at(-1)?.tag, "0018_subscriber_attribution");

  const raw = new PGlite();
  const beforeFiles = files.filter((name) => name !== MIGRATION);
  for (const file of beforeFiles) await raw.exec(readFileSync(`drizzle/${file}`, "utf8"));
  const before = await columnShape(raw);
  assert.equal(ADDED.some((name) => before.has(name)), false);

  const migrationSql = readFileSync(`drizzle/${MIGRATION}`, "utf8");
  await raw.exec(migrationSql);
  await raw.exec(migrationSql);
  const after = await columnShape(raw);
  for (const [name, column] of before) {
    assert.deepEqual(after.get(name), column, name);
  }
  assert.equal(after.size, before.size + ADDED.length);
  for (const name of ADDED) {
    assert.deepEqual(after.get(name), { data_type: "text", is_nullable: "YES" });
  }

  await raw.exec(`
    INSERT INTO newsletter_subscriber (email_hash, unsub_token_hash)
    VALUES ('legacy-hash', 'legacy-unsub')
  `);
  const legacy = await raw.query(`
    SELECT utm_source, utm_medium, utm_campaign, utm_content, referrer
    FROM newsletter_subscriber
    WHERE email_hash = 'legacy-hash'
  `);
  assert.deepEqual(legacy.rows[0], {
    utm_source: null,
    utm_medium: null,
    utm_campaign: null,
    utm_content: null,
    referrer: null,
  });
  await raw.close();
});

test("POST /api/subscribe stores truncated attribution and confirm/resend leave it in place", async () => {
  const raw = new PGlite();
  const d = drizzle(raw, { schema });
  for (const file of migrationFiles()) await raw.exec(readFileSync(`drizzle/${file}`, "utf8"));
  const store = globalThis as typeof globalThis & { __sgDb?: DbHandle | null };
  const previous = store.__sgDb;
  store.__sgDb = { db: d as unknown as Database, driver: "pglite", raw, close: async () => { await raw.close(); } };
  resetNewsletterOutbox();
  const previousTurnstile = process.env.TURNSTILE_SECRET_KEY;
  const previousMode = process.env.NEWSLETTER_SEND_MODE;
  const previousSite = process.env.NEXT_PUBLIC_SITE_URL;
  delete process.env.TURNSTILE_SECRET_KEY;
  delete process.env.NEWSLETTER_SEND_MODE;
  process.env.NEXT_PUBLIC_SITE_URL = "https://signalgarden.site";
  const now = Date.now();
  const path = "p".repeat(520);
  try {
    const response = await subscribeRoute(new Request("http://127.0.0.1/api/subscribe", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": "203.0.113.44",
        "user-agent": `Agent/${"A".repeat(400)}`,
      },
      body: JSON.stringify({
        email: "attr@example.com",
        company: "",
        locale: "en",
        source: "project_cta",
        formStartedAt: now - 5_000,
        turnstileToken: "",
        utm_source: "s".repeat(UTM_MAX + 25),
        utm_medium: " cta ",
        utm_campaign: "week",
        utm_content: "  ",
        referrer: `https://user:secret@news.example/${path}?email=person@example.com`,
        ip: "198.51.100.9",
        userAgent: "should-not-land",
      }),
    }));
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true, sent: true });
    const [row] = await d.select().from(schema.newsletterSubscriber).where(eq(schema.newsletterSubscriber.email, "attr@example.com"));
    assert.equal(row.utmSource, "s".repeat(UTM_MAX));
    assert.equal(row.utmMedium, "cta");
    assert.equal(row.utmCampaign, "week");
    assert.equal(row.utmContent, null);
    assert.equal(row.referrer?.length, REFERRER_MAX);
    assert.match(row.referrer ?? "", /^https:\/\/news\.example\/p+$/);
    assert.doesNotMatch(`${row.utmSource}${row.utmMedium}${row.utmCampaign}${row.referrer}`, /203\.0\.113\.44|198\.51\.100\.9|should-not-land|person@|secret|\?/);
    assert.notEqual(row.consentIpHash, "203.0.113.44");
    assert.ok(row.consentUa && row.consentUa.length <= 300);
    assert.equal(row.consentUa.includes("A".repeat(400)), false);

    const token = tokenIn(newsletterOutbox()[0].html, "/subscribe/confirm");
    assert.equal(await confirmNewsletter(token, { now: new Date(now), siteUrl: "https://signalgarden.site", transport: mockTransport() }), "confirmed");
    const resent = await requestResend({
      email: "attr@example.com",
      locale: "en",
      source: "project_cta",
      ip: "203.0.113.44",
      now: new Date(now),
      siteUrl: "https://signalgarden.site",
      transport: mockTransport(),
    });
    assert.equal(resent.sent, false);
    const [kept] = await d.select().from(schema.newsletterSubscriber).where(eq(schema.newsletterSubscriber.id, row.id));
    assert.equal(kept.status, "active");
    assert.equal(kept.utmSource, row.utmSource);
    assert.equal(kept.utmMedium, row.utmMedium);
    assert.equal(kept.utmCampaign, row.utmCampaign);
    assert.equal(kept.utmContent, row.utmContent);
    assert.equal(kept.referrer, row.referrer);

    const plain = await subscribeRoute(new Request("http://127.0.0.1/api/subscribe", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.45" },
      body: JSON.stringify({
        email: "plain@example.com",
        company: "",
        locale: "zh",
        source: "footer",
        formStartedAt: now - 5_000,
      }),
    }));
    assert.equal(plain.status, 200);
    const [empty] = await d.select().from(schema.newsletterSubscriber).where(eq(schema.newsletterSubscriber.email, "plain@example.com"));
    assert.equal(empty.utmSource, null);
    assert.equal(empty.utmMedium, null);
    assert.equal(empty.utmCampaign, null);
    assert.equal(empty.utmContent, null);
    assert.equal(empty.referrer, null);
    assert.notEqual(empty.consentIpHash, "203.0.113.45");
  } finally {
    if (previousTurnstile === undefined) delete process.env.TURNSTILE_SECRET_KEY;
    else process.env.TURNSTILE_SECRET_KEY = previousTurnstile;
    if (previousMode === undefined) delete process.env.NEWSLETTER_SEND_MODE;
    else process.env.NEWSLETTER_SEND_MODE = previousMode;
    if (previousSite === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
    else process.env.NEXT_PUBLIC_SITE_URL = previousSite;
    store.__sgDb = previous;
    await raw.close();
  }
});

async function columnShape(raw: PGlite): Promise<Map<string, { data_type: string; is_nullable: string }>> {
  const result = await raw.query<{ column_name: string; data_type: string; is_nullable: string }>(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'newsletter_subscriber'
  `);
  return new Map(result.rows.map((row) => [row.column_name, { data_type: row.data_type, is_nullable: row.is_nullable }]));
}

function tokenIn(html: string, path: string): string {
  const match = html.match(new RegExp(`${path}\\?t=([A-Za-z0-9_-]+)`));
  assert.ok(match, `token missing in ${path}`);
  return match[1];
}
