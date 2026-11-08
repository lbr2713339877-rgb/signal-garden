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
 * Cron uses --all. --dry-run writes nothing and does not query delivery.
 * --canary sends only the preferred canary. --all and --real send real
 * recipients only on this edition's date, and only after this edition's
 * canary delivery query returns delivered. A later day does not catch up
 * recipients who have no ledger row. Nothing rewrites a bounced or failed
 * row back to queued, and a sent row with no provider id is not released.
 *
 * Audiences are unchanged. A Resend id or a ledger row of sent is not
 * delivery. A missing canary, accept error, bounce, other non-delivery,
 * query error, timeout, or unknown claim exits nonzero and sends zero real
 * recipients. The claim is the newsletter_send row, committed before the
 * provider call. Abort does not prove the provider did not accept.
 *
 * Live sends need NEWSLETTER_WEEKLY_ENABLED=true, NEWSLETTER_SEND_MODE=live,
 * and NEWSLETTER_UNSUB_SECRET. The canary wait is
 * WEEKLY_CANARY_DELIVERY_BUDGET_MS (30s, at most 6 reads). Each read and
 * each send is aborted on its own deadline. Claim statements are bounded
 * by WEEKLY_CLAIM_TIMEOUT_MS. process.exit follows closeDb.
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
  weeklyLockSubject,
} = await import("@/lib/newsletter/weekly-lock");
const {
  WEEKLY_CANARY_DELIVERY_BUDGET_MS,
  WEEKLY_CANARY_DELIVERY_MAX_POLLS,
  WEEKLY_CANARY_DELIVERY_POLL_MS,
  WEEKLY_CANARY_DELIVERY_QUERY_TIMEOUT_MS,
  executeWeeklyGatedSend,
  maskWeeklyEmail,
  previewWeeklyCanaryGate,
  selectGateHeldRecipients,
} = await import("@/lib/newsletter/canary-gate");
const { claimAndSend, claimDbFromPglite, claimDbFromPool } = await import("@/lib/newsletter/edition-claim");
const { runWeeklySnapshot } = await import("@/lib/newsletter/weekly-run");
const { renderWeeklyLockMail } = await import("@/emails/weekly-lock");
const { db, closeDb, getDb } = await import("@/db/client");
const { and, eq, isNotNull } = await import("drizzle-orm");
const { newsletterSend, newsletterSubscriber } = await import("@/db/schema");
const { listUnsubscribeHeaders, unsubscribePageUrl } = await import("@/lib/newsletter/headers");
const { unsubTokenFor } = await import("@/lib/newsletter/tokens");
const { ProviderRejectedError, newsletterSendMode, newsletterTransport } = await import("@/lib/newsletter/transport");

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
      resendMessageId: newsletterSend.resendMessageId,
    })
    .from(newsletterSend)
    .where(eq(newsletterSend.editionDate, editionDate));
  const allPlan = planWeeklyAllSend({
    editionDate,
    today,
    eligibleIds: eligible.map((row) => row.id),
    rows: mailed,
  });
  const canary = preferredCanary(audience.canaries) ?? null;
  const gateMode = parsed.mode === "dry-run" ? "all" : parsed.mode;
  const held = gateMode === "real"
    ? audience.reals
    : [...audience.canaries.filter((row) => row.id !== canary?.id), ...audience.reals];
  const heldForPreview = selectGateHeldRecipients({
    mode: gateMode,
    canaryId: canary?.id ?? null,
    held,
    plannedIds: allPlan.action === "send" ? allPlan.subscriberIds : [],
    ledger: mailed,
  });
  const canaryGate = previewWeeklyCanaryGate({
    mode: gateMode,
    editionDate,
    canary,
    heldCount: heldForPreview.length,
    ledger: mailed,
    plan: gateMode === "all" ? allPlan.action : undefined,
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
    canary: audience.canaries.map((row) => ({ id: row.id, email: maskWeeklyEmail(row.email) })),
    real: audience.reals.map((row) => ({ id: row.id, email: maskWeeklyEmail(row.email) })),
    excluded: audience.excluded.length,
    allPlan,
    canaryGate,
    canaryGateBudget: {
      budgetMs: WEEKLY_CANARY_DELIVERY_BUDGET_MS,
      maxPolls: WEEKLY_CANARY_DELIVERY_MAX_POLLS,
      pollIntervalMs: WEEKLY_CANARY_DELIVERY_POLL_MS,
      queryTimeoutMs: WEEKLY_CANARY_DELIVERY_QUERY_TIMEOUT_MS,
    },
  });

  const outcome = await runWeeklySnapshot({
    mode: parsed.mode,
    dryRun: parsed.dryRun,
    editionDate,
    today,
    eligibleIds: eligible.map((row) => row.id),
    ledger: mailed,
    weeklyEnabled: process.env.NEWSLETTER_WEEKLY_ENABLED === "true",
    sendMode: newsletterSendMode(),
    unsubSecret: process.env.NEWSLETTER_UNSUB_SECRET,
    liveSend: async ({ mode, plannedIds, plan }) => {
      const transport = newsletterTransport();
      const handle = await getDb();
      const claims = handle.driver === "postgres" ? claimDbFromPool(handle.raw) : claimDbFromPglite(handle.raw);
      const byId = new Map(eligible.map((row) => [row.id, row]));

      async function sendOne(sub: WeeklyAudienceRow, idempotencyKey: string): Promise<
        { ok: true; id: string; skipped?: boolean } | { ok: false; error: string; id?: string; held?: boolean }
      > {
        const token = unsubTokenFor(sub.id);
        const mail = await renderWeeklyLockMail(issue!, siteUrl, unsubscribePageUrl(siteUrl, token));
        const outcome = await claimAndSend({
          db: claims,
          editionDate,
          subscriberId: sub.id,
          transport: async (signal) => {
            try {
              const res = await transport.send({
                to: sub.email,
                subject: mail.subject,
                html: mail.html,
                text: mail.text,
                headers: listUnsubscribeHeaders(siteUrl, token),
                idempotencyKey,
              }, { signal });
              return { accepted: true, id: res.id };
            } catch (err) {
              if (signal.aborted || !(err instanceof ProviderRejectedError)) {
                return { accepted: false, statusCode: null, error: err instanceof Error ? err.message : String(err) };
              }
              return { accepted: false, statusCode: err.statusCode, error: err.message };
            }
          },
        });
        if (outcome.action === "sent") {
          try {
            await database
              .update(newsletterSubscriber)
              .set({ lastSentAt: new Date() })
              .where(eq(newsletterSubscriber.id, sub.id));
          } catch {
            // The provider id is already stored. Do not clear the claim.
          }
          return { ok: true, id: outcome.providerId };
        }
        if (outcome.action === "query") return { ok: true, id: outcome.providerId, skipped: true };
        if (outcome.action === "rejected") return { ok: false, error: outcome.error };
        return {
          ok: false,
          held: true,
          id: outcome.providerId,
          error: outcome.reason === "persist-failed"
            ? "provider accepted but ledger update failed"
            : "claim-held",
        };
      }

      const result = await executeWeeklyGatedSend({
        mode,
        dryRun: false,
        issue: issue.issue,
        editionDate,
        canary,
        held,
        plannedIds,
        ledger: mailed,
        plan: mode === "all" ? plan.action : "send",
        send: async ({ subscriberId, idempotencyKey }) => {
          const sub = byId.get(subscriberId);
          if (!sub) return { ok: false, error: "unknown subscriber" };
          const sent = await sendOne(sub, idempotencyKey);
          if (transport.mode === "live" && sent.ok && !sent.skipped) {
            await new Promise((resolve) => setTimeout(resolve, WEEKLY_LIVE_SEND_GAP_MS));
          }
          return sent;
        },
        queryDelivery: async (messageId, signal) => {
          if (!transport.getDelivery) return { ok: false, error: "delivery query is not available on this transport" };
          return transport.getDelivery(messageId, signal);
        },
        markTerminal: async ({ subscriberId, status }) => {
          // Records the provider terminal event. It does not reset the row for another try.
          await database
            .update(newsletterSend)
            .set({ status })
            .where(and(
              eq(newsletterSend.editionDate, editionDate),
              eq(newsletterSend.subscriberId, subscriberId),
            ));
        },
      });
      log(result.log);
      return { exitCode: result.exitCode };
    },
  });
  if (outcome.phase === "refused") {
    log({ phase: "refused", reason: outcome.reason, sent: 0, failed: 0, realSent: 0 });
  } else if (outcome.phase === "noop") {
    log({ phase: "noop", reason: outcome.reason, issue: issue.issue, editionDate, sent: 0, failed: 0, skipped: 0, realSent: 0 });
  }
  exitCode = outcome.exitCode;
} finally {
  await closeDb();
}

process.exit(exitCode);
