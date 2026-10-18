import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { newsletterSubscriber } from "@/db/schema";
import { emailSiteUrl } from "@/lib/email-template";
import { resolveEmailLocale, type EmailLocale } from "@/lib/email-locale";
import { renderConfirmMail, renderWelcomeDigest } from "@/emails/render-newsletter";
import { hashEmail, honeypotTripped, dwellOk, normalizeEmail, normalizeSource } from "./address";
import { confirmPageUrl, listUnsubscribeHeaders, unsubscribePageUrl } from "./headers";
import { allowRate } from "./rate-limit";
import { confirmOutcome, subscribeAction, unsubscribeOutcome } from "./state";
import {
  CONFIRM_TTL_MS,
  EMAIL_LIMIT,
  EMAIL_WINDOW_MS,
  hashIp,
  hashToken,
  IP_LIMIT,
  IP_WINDOW_MS,
  isTokenShape,
  newSubscriberId,
  newToken,
  PURGE_AFTER_MS,
  sha256,
  unsubTokenFor,
} from "./tokens";
import { verifyTurnstile } from "./turnstile";
import { newsletterSendMode, newsletterTransport, type MailTransport } from "./transport";

export type SubscribeResult =
  | { ok: true; sent: boolean }
  | { ok: false; error: "invalid_email" | "too_fast" | "rate_limited" }
  | { ok: false; error: "turnstile"; code: string };

export interface SubscribeInput {
  email: unknown;
  honeypot: unknown;
  formStartedAt: unknown;
  turnstileToken: unknown;
  locale: unknown;
  source: unknown;
  ip: string | null;
  userAgent: string | null;
  acceptLanguage?: string | null;
  now?: Date;
  siteUrl?: string;
  transport?: MailTransport;
  turnstileSecret?: string;
}

function siteUrlOf(given?: string): string {
  return given ?? emailSiteUrl(process.env.NEXT_PUBLIC_SITE_URL ?? "");
}

function assertLiveSecret() {
  if (newsletterSendMode() === "live" && !process.env.NEWSLETTER_UNSUB_SECRET?.trim()) {
    throw new Error("[newsletter] NEWSLETTER_UNSUB_SECRET is required when NEWSLETTER_SEND_MODE=live");
  }
}

async function sendConfirm(input: {
  email: string;
  locale: EmailLocale;
  confirmToken: string;
  unsubToken: string;
  siteUrl: string;
  subscriberId: string;
  transport: MailTransport;
}) {
  const mail = await renderConfirmMail({
    locale: input.locale,
    confirmUrl: confirmPageUrl(input.siteUrl, input.confirmToken),
    unsubscribeUrl: unsubscribePageUrl(input.siteUrl, input.unsubToken),
    siteUrl: input.siteUrl,
  });
  await input.transport.send({
    to: input.email,
    subject: mail.subject,
    html: mail.html,
    text: mail.text,
    headers: listUnsubscribeHeaders(input.siteUrl, input.unsubToken),
    idempotencyKey: `newsletter-confirm/${input.subscriberId}/${hashToken(input.confirmToken).slice(0, 16)}`,
  });
}

export async function requestSubscribe(input: SubscribeInput): Promise<SubscribeResult> {
  const now = input.now ?? new Date();
  const email = normalizeEmail(input.email);
  if (!email) return { ok: false, error: "invalid_email" };
  if (honeypotTripped(input.honeypot)) return { ok: true, sent: false };
  if (!dwellOk(input.formStartedAt, now.getTime())) return { ok: false, error: "too_fast" };

  const turnstile = await verifyTurnstile({
    token: input.turnstileToken,
    secret: input.turnstileSecret,
    ip: input.ip,
  });
  if (turnstile.status === "failed") return { ok: false, error: "turnstile", code: turnstile.code };

  const ipKey = sha256(`ip:${input.ip ?? "unknown"}`);
  const ipAllowed = await allowRate({
    bucket: "ip",
    keyHash: ipKey,
    limit: IP_LIMIT,
    windowMs: IP_WINDOW_MS,
    now,
  });
  if (!ipAllowed) return { ok: false, error: "rate_limited" };

  const d = await db();
  const emailHash = hashEmail(email);
  const [existing] = await d.select().from(newsletterSubscriber).where(eq(newsletterSubscriber.emailHash, emailHash)).limit(1);
  const action = subscribeAction(existing?.status ?? null);
  if (action === "ignore" || action === "blocked") return { ok: true, sent: false };

  const emailAllowed = await allowRate({
    bucket: "email",
    keyHash: emailHash,
    limit: EMAIL_LIMIT,
    windowMs: EMAIL_WINDOW_MS,
    now,
  });
  if (!emailAllowed) return { ok: true, sent: false };

  assertLiveSecret();
  const locale = resolveEmailLocale(input.locale, existing?.locale, input.acceptLanguage);
  const confirmToken = newToken();
  const id = existing?.id ?? newSubscriberId();
  const unsubToken = unsubTokenFor(id);
  const patch = {
    email,
    emailHash,
    locale,
    status: "pending" as const,
    confirmTokenHash: hashToken(confirmToken),
    confirmExpiresAt: new Date(now.getTime() + CONFIRM_TTL_MS),
    unsubTokenHash: hashToken(unsubToken),
    source: normalizeSource(input.source),
    consentIpHash: input.ip ? hashIp(input.ip) : null,
    consentUa: input.userAgent?.slice(0, 300) ?? null,
    unsubscribedAt: null,
    purgeEmailAt: null,
  };

  if (!existing) {
    await d.insert(newsletterSubscriber).values({ id, ...patch });
  } else {
    await d.update(newsletterSubscriber).set(patch).where(eq(newsletterSubscriber.id, existing.id));
  }

  const transport = input.transport ?? newsletterTransport();
  await sendConfirm({
    email,
    locale,
    confirmToken,
    unsubToken,
    siteUrl: siteUrlOf(input.siteUrl),
    subscriberId: id,
    transport,
  });
  return { ok: true, sent: true };
}

export type TokenView =
  | { state: "pending" | "ready" | "already" | "expired" | "rejected"; locale: EmailLocale }
  | { state: "invalid" };

async function subscriberByToken(column: "confirm" | "unsub", token: string) {
  if (!isTokenShape(token)) return null;
  const d = await db();
  const hash = hashToken(token);
  const [row] = await d.select().from(newsletterSubscriber).where(
    column === "confirm"
      ? eq(newsletterSubscriber.confirmTokenHash, hash)
      : eq(newsletterSubscriber.unsubTokenHash, hash),
  ).limit(1);
  return row ?? null;
}

/** Read-only. Opening the confirm link must not activate the subscription. */
export async function inspectConfirm(token: string, now = new Date()): Promise<TokenView> {
  const row = await subscriberByToken("confirm", token);
  if (!row) return { state: "invalid" };
  const expired = !row.confirmExpiresAt || row.confirmExpiresAt.getTime() <= now.getTime();
  const outcome = confirmOutcome(row.status, expired);
  const locale: EmailLocale = row.locale === "en" ? "en" : "zh";
  if (outcome === "confirmed") return { state: "pending", locale };
  if (outcome === "already") return { state: "already", locale };
  if (outcome === "expired") return { state: "expired", locale };
  return { state: "rejected", locale };
}

export async function confirmNewsletter(token: string, opts: { now?: Date; siteUrl?: string; transport?: MailTransport } = {}) {
  const now = opts.now ?? new Date();
  const row = await subscriberByToken("confirm", token);
  if (!row) return "invalid" as const;
  const expired = !row.confirmExpiresAt || row.confirmExpiresAt.getTime() <= now.getTime();
  const outcome = confirmOutcome(row.status, expired);
  if (outcome !== "confirmed") return outcome;
  if (!row.email) return "invalid" as const;

  const d = await db();
  await d.update(newsletterSubscriber).set({
    status: "active",
    confirmedAt: now,
  }).where(eq(newsletterSubscriber.id, row.id));

  assertLiveSecret();
  const locale: EmailLocale = row.locale === "en" ? "en" : "zh";
  const siteUrl = siteUrlOf(opts.siteUrl);
  const unsubToken = unsubTokenFor(row.id);
  const transport = opts.transport ?? newsletterTransport();
  const mail = await renderWelcomeDigest({
    locale,
    todayUrl: `${siteUrl}/today`,
    unsubscribeUrl: unsubscribePageUrl(siteUrl, unsubToken),
    siteUrl,
  });
  await transport.send({
    to: row.email,
    subject: mail.subject,
    html: mail.html,
    text: mail.text,
    headers: listUnsubscribeHeaders(siteUrl, unsubToken),
    idempotencyKey: `newsletter-welcome/${row.id}/${hashToken(token).slice(0, 16)}`,
  });
  return "confirmed" as const;
}

export async function inspectUnsubscribe(token: string): Promise<TokenView> {
  const row = await subscriberByToken("unsub", token);
  if (!row) return { state: "invalid" };
  const locale: EmailLocale = row.locale === "en" ? "en" : "zh";
  const outcome = unsubscribeOutcome(row.status);
  if (outcome === "unsubscribed") return { state: "ready", locale };
  if (outcome === "already") return { state: "already", locale };
  return { state: "rejected", locale };
}

export async function unsubscribeNewsletter(token: string, now = new Date()) {
  const row = await subscriberByToken("unsub", token);
  if (!row) return "invalid" as const;
  const outcome = unsubscribeOutcome(row.status);
  if (outcome !== "unsubscribed") return outcome;
  const d = await db();
  await d.update(newsletterSubscriber).set({
    status: "unsubscribed",
    unsubscribedAt: now,
    purgeEmailAt: new Date(now.getTime() + PURGE_AFTER_MS),
  }).where(eq(newsletterSubscriber.id, row.id));
  return "unsubscribed" as const;
}
