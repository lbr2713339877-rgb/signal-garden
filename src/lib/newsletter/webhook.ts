import { Resend } from "resend";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { newsletterSend, newsletterSubscriber } from "@/db/schema";
import { normalizeEmail } from "./address";
import { afterDeliveryEvent, classifyBounce, sendStatusAfterEvent, type DeliveryEvent } from "./state";

export interface NewsletterWebhookEvent {
  type: string;
  data?: {
    email_id?: string;
    to?: string[];
    bounce?: { type?: string };
  };
}

export function deliveryEventFrom(event: NewsletterWebhookEvent): DeliveryEvent | null {
  if (event.type === "email.complained") return "complaint";
  if (event.type === "email.delivered") return "delivered";
  if (event.type === "email.failed") return "failed";
  if (event.type === "email.bounced") return classifyBounce(event.data?.bounce?.type);
  return null;
}

export class WebhookSecretError extends Error {
  constructor() {
    super("RESEND_WEBHOOK_SECRET is not set");
    this.name = "WebhookSecretError";
  }
}

/** Verifies the Svix signature Resend sends. Throws if the secret or signature is bad. */
export function verifyResendWebhook(input: {
  payload: string;
  id: string | null;
  timestamp: string | null;
  signature: string | null;
  secret?: string;
}): NewsletterWebhookEvent {
  const secret = input.secret ?? process.env.RESEND_WEBHOOK_SECRET ?? "";
  if (!secret) throw new WebhookSecretError();
  if (!input.id || !input.timestamp || !input.signature) {
    throw new Error("missing webhook signature headers");
  }
  const resend = new Resend(process.env.RESEND_API_KEY || "re_webhook_verify");
  return resend.webhooks.verify({
    payload: input.payload,
    headers: { id: input.id, timestamp: input.timestamp, signature: input.signature },
    webhookSecret: secret,
  }) as NewsletterWebhookEvent;
}

export async function applyNewsletterWebhook(event: NewsletterWebhookEvent): Promise<{ updated: number }> {
  const kind = deliveryEventFrom(event);
  if (!kind) return { updated: 0 };
  const d = await db();
  let updated = 0;
  const emailId = event.data?.email_id;
  const sendStatus = sendStatusAfterEvent(kind);

  if (emailId && sendStatus) {
    const sends = await d.select().from(newsletterSend).where(eq(newsletterSend.resendMessageId, emailId));
    for (const send of sends) {
      await d.update(newsletterSend).set({ status: sendStatus }).where(eq(newsletterSend.id, send.id));
      updated += 1;
    }
  }

  if (kind === "hard_bounce" || kind === "complaint") {
    const addresses = (event.data?.to ?? []).map((value) => normalizeEmail(value)).filter((value): value is string => Boolean(value));
    const fromSend = emailId
      ? await d.select({ subscriberId: newsletterSend.subscriberId }).from(newsletterSend).where(eq(newsletterSend.resendMessageId, emailId))
      : [];
    const byEmail = addresses.length
      ? await d.select().from(newsletterSubscriber).where(inArray(newsletterSubscriber.email, addresses))
      : [];
    const ids = new Set<string>([...fromSend.map((row) => row.subscriberId), ...byEmail.map((row) => row.id)]);
    for (const id of ids) {
      const [row] = await d.select().from(newsletterSubscriber).where(eq(newsletterSubscriber.id, id)).limit(1);
      if (!row) continue;
      const next = afterDeliveryEvent(row.status, kind);
      if (next === row.status) continue;
      await d.update(newsletterSubscriber).set({ status: next }).where(eq(newsletterSubscriber.id, id));
      updated += 1;
    }
  }

  return { updated };
}
