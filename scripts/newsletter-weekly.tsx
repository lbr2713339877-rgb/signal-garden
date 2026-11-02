/**
 * Monday curated weekly send.
 *
 * VPS cron already points here and does not need an edit for this script to
 * be picked up on the next deploy (`/etc/cron.d/sg-newsletter-weekly`,
 * Monday 09:00 Asia/Singapore):
 *
 *   tsx scripts/newsletter-weekly.tsx --all
 *
 * Content is the latest curated issue in src/lib/weekly-sample.ts (frozen
 * Top 10, editor note, editor pick). This is not the daily #1/#2 sampler in
 * src/emails/newsletter-weekly.tsx.
 *
 *   tsx scripts/newsletter-weekly.tsx --dry-run
 *   tsx scripts/newsletter-weekly.tsx --canary [--dry-run]
 *   tsx scripts/newsletter-weekly.tsx --real [--dry-run]
 *   tsx scripts/newsletter-weekly.tsx --all [--dry-run]
 *
 * Humans: dry-run, then canary, then real. Cron uses --all.
 * --all sends only when issue.to is today's signal date, and only to
 * confirmed active subscribers who are not already sent/bounced for that
 * edition. A later Monday no-ops instead of mailing the same issue again.
 * Live sends need NEWSLETTER_WEEKLY_ENABLED=true, NEWSLETTER_SEND_MODE=live,
 * and NEWSLETTER_UNSUB_SECRET. --dry-run writes nothing.
 */
import { loadLocalEnv } from "@/lib/env";
import type { WeeklyAudienceRow } from "@/lib/newsletter/weekly-lock";

loadLocalEnv();

const { signalDate } = await import("@/lib/day");
const { emailSiteUrl } = await import("@/lib/email-template");
const {
  WEEKLY_LIVE_SEND_GAP_MS,
  isConfirmedActive,
  parseWeeklyCli,
  planWeeklyAllSend,
  preferredCanary,
  publishedWeeklyMailIssue,
  splitWeeklyAudience,
  weeklyIdempotencyKey,
  weeklyLockSubject,
  weeklySendBlocker,
} = await import("@/lib/newsletter/weekly-lock");
const { renderWeeklyLockMail } = await import("@/emails/weekly-lock");
const { db, closeDb } = await import("@/db/client");
const { and, eq, isNotNull } = await import("drizzle-orm");
const { newsletterSend, newsletterSubscriber } = await import("@/db/schema");
const { listUnsubscribeHeaders, unsubscribePageUrl } = await import("@/lib/newsletter/headers");
const { unsubTokenFor } = await import("@/lib/newsletter/tokens");
const { newsletterSendMode, newsletterTransport } = await import("@/lib/newsletter/transport");

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return "***";
  return `${local.slice(0, Math.min(3, local.length))}***@${domain}`;
}

function log(event: Record<string, unknown>) {
  console.log(JSON.stringify({ ts: new Date().toISOString(), ...event }));
}

const parsed = parseWeeklyCli(process.argv.slice(2));
if (!parsed.ok) {
  console.error(parsed.error);
  console.error("usage: tsx scripts/newsletter-weekly.tsx --dry-run | --canary | --real | --all [--dry-run]");
  process.exit(1);
}

const issue = publishedWeeklyMailIssue();
if (!issue) {
  log({
    phase: "refused",
    reason: "latest published issue is not a curated lock (frozen Top 10 + editor pick)",
  });
  process.exit(6);
}

const today = signalDate(new Date());
const siteUrl = emailSiteUrl(process.env.NEXT_PUBLIC_SITE_URL ?? "");
const editionDate = issue.to;
const subject = weeklyLockSubject(issue);

const database = await db();
let exitCode = 0;
try {
  const loaded = await database
    .select({
      id: newsletterSubscriber.id,
      email: newsletterSubscriber.email,
      status: newsletterSubscriber.status,
      source: newsletterSubscriber.source,
      confirmedAt: newsletterSubscriber.confirmedAt,
      utmSource: newsletterSubscriber.utmSource,
    })
    .from(newsletterSubscriber)
    .where(and(
      eq(newsletterSubscriber.status, "active"),
      isNotNull(newsletterSubscriber.email),
      isNotNull(newsletterSubscriber.confirmedAt),
    ));

  const confirmed: WeeklyAudienceRow[] = [];
  for (const row of loaded) {
    if (!isConfirmedActive(row.status, row.confirmedAt, row.email) || !row.email) continue;
    confirmed.push({
      id: row.id,
      email: row.email,
      source: row.source,
      utmSource: row.utmSource,
    });
  }
  const audience = splitWeeklyAudience(confirmed);
  const eligible = [...audience.canaries, ...audience.reals];
  const mailed = await database
    .select({
      subscriberId: newsletterSend.subscriberId,
      status: newsletterSend.status,
    })
    .from(newsletterSend)
    .where(eq(newsletterSend.editionDate, editionDate));
  const allPlan = planWeeklyAllSend({
    editionDate,
    today,
    eligibleIds: eligible.map((row) => row.id),
    rows: mailed,
  });

  log({
    phase: "plan",
    mode: parsed.mode,
    dryRun: parsed.dryRun,
    issue: issue.issue,
    editionDate,
    today,
    subject,
    sendMode: newsletterSendMode(),
    weeklyEnabled: process.env.NEWSLETTER_WEEKLY_ENABLED === "true",
    activeConfirmed: confirmed.length,
    canary: audience.canaries.map((row) => ({ id: row.id, email: maskEmail(row.email) })),
    real: audience.reals.map((row) => ({ id: row.id, email: maskEmail(row.email) })),
    excluded: audience.excluded.length,
    allPlan,
  });

  if (parsed.dryRun) {
    exitCode = 0;
  } else {
    const blocker = weeklySendBlocker({
      dryRun: false,
      weeklyEnabled: process.env.NEWSLETTER_WEEKLY_ENABLED === "true",
      sendMode: newsletterSendMode(),
      unsubSecret: process.env.NEWSLETTER_UNSUB_SECRET,
    });
    if (blocker) {
      log({ phase: "refused", reason: blocker, sent: 0, failed: 0 });
      exitCode = 2;
    } else if (parsed.mode === "all" && allPlan.action === "noop") {
      log({ phase: "noop", reason: allPlan.reason, issue: issue.issue, editionDate, sent: 0, failed: 0, skipped: 0 });
      exitCode = 0;
    } else {
      const transport = newsletterTransport();
      const byId = new Map(eligible.map((row) => [row.id, row]));

      async function sendOne(sub: WeeklyAudienceRow): Promise<
        { ok: true; id: string; skipped?: boolean } | { ok: false; error: string }
      > {
        const inserted = await database
          .insert(newsletterSend)
          .values({ editionDate, subscriberId: sub.id, status: "queued" })
          .onConflictDoNothing({ target: [newsletterSend.editionDate, newsletterSend.subscriberId] })
          .returning({ id: newsletterSend.id });
        let sendRowId = inserted[0]?.id;
        if (!sendRowId) {
          const [existing] = await database
            .select()
            .from(newsletterSend)
            .where(and(
              eq(newsletterSend.editionDate, editionDate),
              eq(newsletterSend.subscriberId, sub.id),
            ))
            .limit(1);
          if (!existing || existing.status === "sent" || existing.status === "bounced") {
            return { ok: true, id: existing?.resendMessageId ?? "skipped", skipped: true };
          }
          sendRowId = existing.id;
        }
        const token = unsubTokenFor(sub.id);
        const mail = await renderWeeklyLockMail(issue!, siteUrl, unsubscribePageUrl(siteUrl, token));
        try {
          const res = await transport.send({
            to: sub.email,
            subject: mail.subject,
            html: mail.html,
            text: mail.text,
            headers: listUnsubscribeHeaders(siteUrl, token),
            idempotencyKey: weeklyIdempotencyKey(issue!.issue, editionDate, sub.id),
          });
          await database
            .update(newsletterSend)
            .set({ status: "sent", resendMessageId: res.id })
            .where(eq(newsletterSend.id, sendRowId));
          await database
            .update(newsletterSubscriber)
            .set({ lastSentAt: new Date() })
            .where(eq(newsletterSubscriber.id, sub.id));
          return { ok: true, id: res.id };
        } catch (err) {
          await database.update(newsletterSend).set({ status: "failed" }).where(eq(newsletterSend.id, sendRowId));
          return { ok: false, error: err instanceof Error ? err.message : String(err) };
        }
      }

      async function sendMany(phase: string, rows: WeeklyAudienceRow[]) {
        let sent = 0;
        let failed = 0;
        let skipped = 0;
        const results: unknown[] = [];
        for (const sub of rows) {
          const res = await sendOne(sub);
          results.push({ to: maskEmail(sub.email), subscriberId: sub.id, ...res });
          if (!res.ok) failed += 1;
          else if (res.skipped) skipped += 1;
          else sent += 1;
          if (transport.mode === "live" && !("skipped" in res && res.skipped)) {
            await new Promise((resolve) => setTimeout(resolve, WEEKLY_LIVE_SEND_GAP_MS));
          }
        }
        log({ phase, sent, failed, skipped, results });
        return failed;
      }

      if (parsed.mode === "canary") {
        const canary = preferredCanary(audience.canaries);
        if (!canary) {
          log({ phase: "refused", reason: "no canary *@mail.grokbot.com active confirmed" });
          exitCode = 3;
        } else {
          const failed = await sendMany("canary", [canary]);
          exitCode = failed > 0 ? 4 : 0;
        }
      } else if (parsed.mode === "real") {
        const failed = await sendMany("real", audience.reals);
        exitCode = failed > 0 ? 5 : 0;
      } else {
        const targets = allPlan.action === "send"
          ? allPlan.subscriberIds.flatMap((id) => {
              const row = byId.get(id);
              return row ? [row] : [];
            })
          : [];
        const failed = await sendMany("all", targets);
        exitCode = failed > 0 ? 5 : 0;
      }
    }
  }
} finally {
  await closeDb();
}

process.exit(exitCode);
