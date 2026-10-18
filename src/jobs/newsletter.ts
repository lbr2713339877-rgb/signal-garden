import { and, eq, isNotNull, lt, lte } from "drizzle-orm";
import { db } from "@/db/client";
import { newsletterSend, newsletterSubscriber } from "@/db/schema";
import { getFeedEdition } from "@/db/queries";
import type { JobResult } from "@/jobs/run";
import { signalDate } from "@/lib/day";
import { TODAY_LIMIT } from "@/lib/edition";
import { emailSiteUrl } from "@/lib/email-template";
import type { EmailLocale } from "@/lib/email-locale";
import { digestItems, renderDailyMail } from "@/emails/render-newsletter";
import { listUnsubscribeHeaders, unsubscribePageUrl } from "@/lib/newsletter/headers";
import { editionSendDecision } from "@/lib/newsletter/state";
import { PENDING_TTL_MS, unsubTokenFor } from "@/lib/newsletter/tokens";
import { newsletterSendMode, newsletterTransport, type MailTransport } from "@/lib/newsletter/transport";

export interface EditionInput {
  date: string;
  isPrevious: boolean;
  cards: Array<{ name: string; slug: string; oneLiner: string | null; oneLinerEn: string | null; forks7d: number | null }>;
}

async function sweep(now: Date) {
  const d = await db();
  await d.delete(newsletterSubscriber).where(and(
    eq(newsletterSubscriber.status, "pending"),
    lt(newsletterSubscriber.createdAt, new Date(now.getTime() - PENDING_TTL_MS)),
  ));
  await d.update(newsletterSubscriber).set({ email: null }).where(and(
    eq(newsletterSubscriber.status, "unsubscribed"),
    isNotNull(newsletterSubscriber.email),
    isNotNull(newsletterSubscriber.purgeEmailAt),
    lte(newsletterSubscriber.purgeEmailAt, now),
  ));
}

/**
 * Sends today's edition to active subscribers.
 * A second run the same day inserts nothing new, so it does not send again.
 * Not referenced by the daily schedule.
 */
export async function sendNewsletter(opts: {
  now?: Date;
  edition?: EditionInput;
  transport?: MailTransport;
  siteUrl?: string;
} = {}): Promise<JobResult> {
  if (process.env.NEWSLETTER_ENABLED === "false") {
    return { itemsIn: 0, itemsOut: 0, meta: { skipped: "disabled", warning: "NEWSLETTER_ENABLED=false" } };
  }
  const now = opts.now ?? new Date();
  const today = signalDate(now);
  const edition = opts.edition ?? await (async () => {
    const loaded = await getFeedEdition(TODAY_LIMIT);
    return { date: loaded.date, isPrevious: loaded.isPrevious, cards: loaded.cards };
  })();
  const decision = editionSendDecision({
    editionDate: edition.date,
    isPrevious: edition.isPrevious,
    count: edition.cards.length,
    today,
    limit: TODAY_LIMIT,
  });
  if (decision !== "ok") {
    const warning = decision === "short"
      ? `edition has ${edition.cards.length} items, need ${TODAY_LIMIT}`
      : `edition date ${edition.date} is not ${today}`;
    return { itemsIn: edition.cards.length, itemsOut: 0, meta: { skipped: decision, warning, editionDate: edition.date } };
  }

  if (newsletterSendMode() === "live" && !process.env.NEWSLETTER_UNSUB_SECRET?.trim()) {
    throw new Error("[newsletter] NEWSLETTER_UNSUB_SECRET is required when NEWSLETTER_SEND_MODE=live");
  }

  await sweep(now);
  const d = await db();
  const subscribers = await d.select().from(newsletterSubscriber).where(and(
    eq(newsletterSubscriber.status, "active"),
    isNotNull(newsletterSubscriber.email),
  ));
  const transport = opts.transport ?? newsletterTransport();
  const siteUrl = opts.siteUrl ?? emailSiteUrl(process.env.NEXT_PUBLIC_SITE_URL ?? "");
  let sent = 0;

  for (const subscriber of subscribers) {
    if (!subscriber.email) continue;
    const inserted = await d.insert(newsletterSend).values({
      editionDate: edition.date,
      subscriberId: subscriber.id,
      status: "queued",
    }).onConflictDoNothing({
      target: [newsletterSend.editionDate, newsletterSend.subscriberId],
    }).returning({ id: newsletterSend.id });

    let sendId = inserted[0]?.id;
    if (!sendId) {
      const [existing] = await d.select().from(newsletterSend).where(and(
        eq(newsletterSend.editionDate, edition.date),
        eq(newsletterSend.subscriberId, subscriber.id),
      )).limit(1);
      if (!existing || existing.status === "sent" || existing.status === "bounced") continue;
      sendId = existing.id;
    }

    const locale: EmailLocale = subscriber.locale === "en" ? "en" : "zh";
    const unsubToken = unsubTokenFor(subscriber.id);
    const mail = await renderDailyMail({
      locale,
      date: edition.date,
      items: digestItems(locale, siteUrl, edition.cards),
      unsubscribeUrl: unsubscribePageUrl(siteUrl, unsubToken),
      siteUrl,
    });
    try {
      const result = await transport.send({
        to: subscriber.email,
        subject: mail.subject,
        html: mail.html,
        text: mail.text,
        headers: listUnsubscribeHeaders(siteUrl, unsubToken),
        idempotencyKey: `newsletter/${edition.date}/${subscriber.id}`,
      });
      await d.update(newsletterSend).set({ status: "sent", resendMessageId: result.id }).where(eq(newsletterSend.id, sendId));
      await d.update(newsletterSubscriber).set({ lastSentAt: now }).where(eq(newsletterSubscriber.id, subscriber.id));
      sent += 1;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await d.update(newsletterSend).set({ status: "failed" }).where(eq(newsletterSend.id, sendId));
      console.error(`[newsletter] failed ${subscriber.id}: ${message}`);
    }
    if (transport.mode === "live") await new Promise((resolve) => setTimeout(resolve, 500));
  }

  return {
    itemsIn: subscribers.length,
    itemsOut: sent,
    meta: { editionDate: edition.date, transport: transport.mode },
  };
}
