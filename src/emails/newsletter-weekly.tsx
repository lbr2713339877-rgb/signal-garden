/**
 * Signal Garden weekly digest.
 *
 *   tsx scripts/newsletter-weekly.tsx --dry-run                 # print the ranking, send nothing
 *   tsx scripts/newsletter-weekly.tsx --sample you@example.com  # one sample to an allowlisted address, no DB writes
 *   tsx scripts/newsletter-weekly.tsx --all                     # all active subscribers (needs NEWSLETTER_WEEKLY_ENABLED=true)
 *
 * Content: the last 7 published daily editions. Each day's #1, then #2s (newest
 * day first) until 10 items, listed by date. On-site links carry utm_source=email&utm_campaign=weekly.
 */
import React from "react";
import { loadLocalEnv } from "@/lib/env";
loadLocalEnv();

const { Heading, Link, Section, Text, render } = await import("react-email");
const { NewsletterFrame } = await import("@/emails/frame");
const { db, closeDb } = await import("@/db/client");
const { and, eq, isNotNull, or, isNull, notLike } = await import("drizzle-orm");
const { newsletterSend, newsletterSubscriber } = await import("@/db/schema");
const { getArchiveEditions, getFeedEdition } = await import("@/db/queries");
const { signalDate } = await import("@/lib/day");
const { emailSiteUrl } = await import("@/lib/email-template");
const { listUnsubscribeHeaders, unsubscribePageUrl } = await import("@/lib/newsletter/headers");
const { unsubTokenFor } = await import("@/lib/newsletter/tokens");
const { newsletterSendMode, newsletterTransport } = await import("@/lib/newsletter/transport");

const SAMPLE_ALLOWLIST = new Set(["lbr2713339877@gmail.com"]);
const DAYS = 7;
const TOP = 10;

type Card = { name: string; slug: string; oneLiner: string | null; oneLinerEn: string | null };
interface WeeklyItem { date: string; dayRank: number; label: string; name: string; oneLiner: string; href: string }

function dayLabel(date: string, rank: number): string {
  const [, m, d] = date.split("-");
  const md = `${Number(m)}/${Number(d)}`;
  return rank === 1 ? `${md} 榜首` : `${md} 第 ${rank} 名`;
}

/** Each day's #1 first (newest day first), then #2s, until TOP items; shown grouped by day. */
async function weeklyRanking() {
  const editions: { date: string; cards: Card[] }[] = [];
  const today = await getFeedEdition(TOP);
  if (!today.isPrevious && today.cards.length) editions.push({ date: String(today.date), cards: today.cards });
  for (const ed of await getArchiveEditions(DAYS)) {
    if (editions.length >= DAYS) break;
    if (!editions.some((e) => e.date === String(ed.date))) editions.push({ date: String(ed.date), cards: ed.cards });
  }
  editions.sort((a, b) => (a.date < b.date ? 1 : -1));
  const picked: { date: string; rank: number; card: Card }[] = [];
  const seen = new Set<string>();
  for (let rank = 1; rank <= TOP && picked.length < TOP; rank++) {
    for (const ed of editions) {
      if (picked.length >= TOP) break;
      const card = ed.cards[rank - 1];
      if (!card || seen.has(card.slug)) continue;
      seen.add(card.slug);
      picked.push({ date: ed.date, rank, card });
    }
  }
  picked.sort((a, b) => (a.date === b.date ? a.rank - b.rank : a.date < b.date ? 1 : -1));
  const dates = editions.map((e) => e.date).sort();
  return { from: dates[0], to: dates[dates.length - 1], editions: editions.length, picked };
}

function WeeklyEmail(p: { from: string; to: string; items: WeeklyItem[]; siteUrl: string; unsubscribeUrl: string }) {
  return (
    <NewsletterFrame locale="zh" preview={`本周每天榜单的榜首项目（${p.from} – ${p.to}）。`} siteUrl={p.siteUrl} unsubscribeUrl={p.unsubscribeUrl}>
      <Heading as="h1" className="text-ink m-0 text-[26px] font-normal leading-8">本周信号</Heading>
      <Text className="text-muted mt-2 text-[13px]">{p.from} – {p.to} · 按日期排列的每日榜单头部项目</Text>
      {p.items.map((item) => (
        <Section key={item.href} className="border-none border-t border-solid border-line mt-4 pt-4">
          <Text className="text-dim m-0 text-[12px]">{item.label}</Text>
          <Text className="m-0 mt-1 text-[18px] leading-6"><Link href={item.href} className="text-ink no-underline">{item.name}</Link></Text>
          <Text className="text-muted m-0 mt-1 text-[14px] leading-6">{item.oneLiner}</Text>
        </Section>
      ))}
      <Section className="mt-6"><Text className="text-muted m-0 text-[13px]"><Link href={`${p.siteUrl}/today`} className="text-ink underline">看今天的榜单 →</Link></Text></Section>
    </NewsletterFrame>
  );
}

const UTM: Record<string, string> = { utm_source: "email", utm_campaign: "weekly" };
function withUtm(raw: string, origin: string): string {
  try {
    const u = new URL(raw);
    if (u.origin !== origin) return raw;
    if (u.pathname.startsWith("/unsubscribe") || u.pathname.startsWith("/api/unsubscribe")) return raw; // token only
    for (const [k, v] of Object.entries(UTM)) u.searchParams.set(k, v);
    return u.toString();
  } catch { return raw; }
}
function tagLinks(html: string, text: string, siteUrl: string) {
  const origin = new URL(siteUrl).origin;
  const esc = origin.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
  const outHtml = html.replace(new RegExp(`href="(${esc}[^"]*)"`, "g"), (_m, url: string) =>
    `href="${withUtm(url.replace(/&amp;/g, "&"), origin).replace(/&/g, "&amp;")}"`);
  const outText = text.replace(new RegExp(`${esc}[^\\s)\\]]*`, "g"), (url) => withUtm(url, origin));
  return { html: outHtml, text: outText };
}

async function renderWeekly(from: string, to: string, items: WeeklyItem[], siteUrl: string, unsubscribeUrl: string) {
  const el = <WeeklyEmail from={from} to={to} items={items} siteUrl={siteUrl} unsubscribeUrl={unsubscribeUrl} />;
  const [html, text] = await Promise.all([render(el), render(el, { plainText: true })]);
  return { subject: `Signal Garden 每周精选 · ${from} – ${to}`, ...tagLinks(html, text, siteUrl) };
}

const args = process.argv.slice(2);
const sampleTo = args.includes("--sample") ? args[args.indexOf("--sample") + 1]?.trim().toLowerCase() : undefined;
const all = args.includes("--all");
const dry = args.includes("--dry-run");

const siteUrl = emailSiteUrl(process.env.NEXT_PUBLIC_SITE_URL ?? "");
const week = await weeklyRanking();
const items: WeeklyItem[] = week.picked.map((r) => ({
  date: r.date, dayRank: r.rank, label: dayLabel(r.date, r.rank), name: r.card.name, oneLiner: r.card.oneLiner || r.card.name,
  href: `${siteUrl}/p/${encodeURIComponent(r.card.slug)}`,
}));
console.log(JSON.stringify({ from: week.from, to: week.to, editions: week.editions, items: items.map((i) => `${i.label} ${i.name}`) }));
if (args.includes("--preview")) {
  const m = await renderWeekly(week.from, week.to, items, siteUrl, unsubscribePageUrl(siteUrl, "PREVIEW_TOKEN_xxxxxxxxxxxxxxxx"));
  console.log(m.subject); console.log(m.text);
  const hrefs = [...m.html.matchAll(/href="([^"]+)"/g)].map((x) => x[1]);
  console.log(JSON.stringify({ hrefs }));
  await closeDb(); process.exit(0);
}
const stamp = () => new Date().toISOString();
if (items.length < TOP) { console.log(`${stamp()} [weekly] SKIP only ${items.length} items, need ${TOP}; sent=0 failed=0`); await closeDb(); process.exit(dry ? 0 : 2); }

if (dry && !all) { await closeDb(); process.exit(0); }
const transport = newsletterTransport();
const d = await db();

if (sampleTo) {
  if (!SAMPLE_ALLOWLIST.has(sampleTo)) throw new Error("sample address not in allowlist");
  const [row] = await d.select().from(newsletterSubscriber).where(eq(newsletterSubscriber.email, sampleTo)).limit(1);
  const token = unsubTokenFor(row?.id ?? `sample:${sampleTo}`);
  const mail = await renderWeekly(week.from, week.to, items, siteUrl, unsubscribePageUrl(siteUrl, token));
  const res = await transport.send({ to: sampleTo, subject: `[样刊] ${mail.subject}`, html: mail.html, text: mail.text,
    headers: listUnsubscribeHeaders(siteUrl, token), idempotencyKey: `newsletter-weekly-sample/${week.to}/${sampleTo}/${Date.now()}` });
  console.log(JSON.stringify({ mode: transport.mode, to: sampleTo, id: res.id, subject: `[样刊] ${mail.subject}` }));
} else if (all) {
  if (!dry && process.env.NEWSLETTER_WEEKLY_ENABLED !== "true") {
    console.log(`${stamp()} [weekly] REFUSED NEWSLETTER_WEEKLY_ENABLED is not true; sent=0 failed=0`);
    await closeDb(); process.exit(1);
  }
  // Only confirmed, active subscribers with an address; never internal test rows.
  const subs = await d.select().from(newsletterSubscriber).where(and(
    eq(newsletterSubscriber.status, "active"),
    isNotNull(newsletterSubscriber.email),
    isNotNull(newsletterSubscriber.confirmedAt),
    or(isNull(newsletterSubscriber.source), notLike(newsletterSubscriber.source, "manual-test%")),
  ));
  if (dry) {
    console.log(`${stamp()} [weekly] DRY-RUN week=${week.from}..${week.to} recipients=${subs.length} mode=${newsletterSendMode()}`);
    await closeDb(); process.exit(0);
  }
  if (subs.length === 0) {
    console.log(`${stamp()} [weekly] DONE week=${week.from}..${week.to} recipients=0 sent=0 failed=0 skipped=0 (no active subscribers)`);
    await closeDb(); process.exit(0);
  }
  if (newsletterSendMode() !== "live") console.log(`${stamp()} [weekly] WARN send mode is mock; nothing will be delivered`);
  const edition = `W${week.to}`; // idempotency key per week
  const editionDate = signalDate(new Date());
  let sent = 0, failed = 0, skipped = 0;
  for (const s of subs) {
    if (!s.email) continue;
    const ins = await d.insert(newsletterSend).values({ editionDate, subscriberId: s.id, status: "queued" })
      .onConflictDoNothing({ target: [newsletterSend.editionDate, newsletterSend.subscriberId] }).returning({ id: newsletterSend.id });
    if (!ins[0]) { skipped += 1; continue; } // already handled today
    const token = unsubTokenFor(s.id);
    const mail = await renderWeekly(week.from, week.to, items, siteUrl, unsubscribePageUrl(siteUrl, token));
    try {
      const res = await transport.send({ to: s.email, subject: mail.subject, html: mail.html, text: mail.text,
        headers: listUnsubscribeHeaders(siteUrl, token), idempotencyKey: `newsletter-weekly/${edition}/${s.id}` });
      await d.update(newsletterSend).set({ status: "sent", resendMessageId: res.id }).where(eq(newsletterSend.id, ins[0].id));
      await d.update(newsletterSubscriber).set({ lastSentAt: new Date() }).where(eq(newsletterSubscriber.id, s.id));
      sent += 1;
    } catch (err) {
      failed += 1;
      await d.update(newsletterSend).set({ status: "failed" }).where(eq(newsletterSend.id, ins[0].id));
      console.log(`${stamp()} [weekly] FAIL ${s.id}: ${err instanceof Error ? err.message : err}`);
    }
    if (transport.mode === "live") await new Promise((r) => setTimeout(r, 500));
  }
  console.log(`${stamp()} [weekly] DONE week=${week.from}..${week.to} mode=${transport.mode} recipients=${subs.length} sent=${sent} failed=${failed} skipped=${skipped}`);
  await closeDb(); process.exit(failed > 0 ? 3 : 0);
} else {
  console.log("no mode given: use --dry-run, --sample <addr>, or --all");
}
await closeDb();
