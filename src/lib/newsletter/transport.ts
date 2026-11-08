import { Resend } from "resend";
import { CONFIRM_FROM_ADDRESS } from "./confirm-copy";

export const DEFAULT_NEWSLETTER_FROM = `Signal Garden <${CONFIRM_FROM_ADDRESS}>`;
export const DEFAULT_NEWSLETTER_REPLY_TO = CONFIRM_FROM_ADDRESS;

export interface OutboundMail {
  to: string;
  subject: string;
  html: string;
  text: string;
  headers: Record<string, string>;
  idempotencyKey: string;
}

export interface SentMail extends OutboundMail {
  id: string;
  from: string;
  replyTo: string;
}

export type DeliveryLookup =
  | { ok: true; lastEvent: string }
  | { ok: false; error: string };

export interface MailTransport {
  mode: "mock" | "live";
  send(mail: OutboundMail, options?: { signal?: AbortSignal }): Promise<{ id: string }>;
  /**
   * Live provider read. Omitted on the mock transport so a fake id cannot
   * be reported as delivered. `signal` cancels the underlying fetch.
   */
  getDelivery?(messageId: string, signal?: AbortSignal): Promise<DeliveryLookup>;
}

const outbox = globalThis as unknown as { __newsletterOutbox?: SentMail[] };

export function newsletterOutbox(): SentMail[] {
  outbox.__newsletterOutbox ??= [];
  return outbox.__newsletterOutbox;
}

export function resetNewsletterOutbox(): void {
  outbox.__newsletterOutbox = [];
}

function noLineBreak(value: string, label: string): string {
  if (/[\r\n]/.test(value)) throw new Error(`[newsletter] ${label} contains a line break`);
  return value.trim();
}

/** Display name stays Signal Garden unless NEWSLETTER_FROM already includes one. */
export function newsletterFrom(raw = process.env.NEWSLETTER_FROM): string {
  const value = noLineBreak(raw?.trim() || DEFAULT_NEWSLETTER_FROM, "from");
  if (value.includes("<")) return value;
  return `Signal Garden <${value}>`;
}

export function newsletterReplyTo(raw = process.env.NEWSLETTER_REPLY_TO): string {
  return noLineBreak(raw?.trim() || DEFAULT_NEWSLETTER_REPLY_TO, "reply-to");
}

/**
 * Live sending needs both the switch and a key. Anything else logs and returns
 * a fake id, so a missing key cannot accidentally deliver mail.
 */
export function newsletterSendMode(
  env: { mode?: string; apiKey?: string } = {
    mode: process.env.NEWSLETTER_SEND_MODE,
    apiKey: process.env.RESEND_API_KEY,
  },
): "mock" | "live" {
  return env.mode === "live" && env.apiKey ? "live" : "mock";
}

export function mockTransport(): MailTransport {
  return {
    mode: "mock",
    async send(mail) {
      const from = newsletterFrom();
      const replyTo = newsletterReplyTo();
      const existing = newsletterOutbox().find((row) => row.idempotencyKey === mail.idempotencyKey);
      if (existing) return { id: existing.id };
      const id = `mock_${mail.idempotencyKey.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80)}`;
      newsletterOutbox().push({ ...mail, id, from, replyTo });
      console.log(`[newsletter:mock] to=${mail.to} subject=${JSON.stringify(mail.subject)} id=${id}`);
      return { id };
    },
  };
}

function redactDeliveryError(value: string): string {
  const redacted = value
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted-email]")
    .replace(/\b(?:re|whsec)_[A-Za-z0-9]+/gi, "[redacted-secret]")
    .replace(/bearer\s+[A-Za-z0-9._\-]+/gi, "bearer [redacted-secret]")
    .replace(/[\r\n]+/g, " ");
  return redacted.length > 240 ? `${redacted.slice(0, 240)}…` : redacted;
}

/**
 * Resend's client resolves `{ data: null, error }` instead of throwing,
 * including when `fetch` rejects. `emails.get(id, { signal })` forwards
 * `signal` into that fetch, so aborting cancels the socket. The SDK's
 * `fetchRequest` catch then returns `{ error: { message: "Unable to fetch..." } }`
 * and does not rethrow. Callers treat `{ error }` as a failed read.
 */
export function deliveryLookupFromProvider(value: unknown): DeliveryLookup {
  if (!value || typeof value !== "object") return { ok: false, error: "delivery query returned an empty body" };
  const record = value as {
    data?: { last_event?: unknown } | null;
    error?: { message?: string } | null;
    last_event?: unknown;
  };
  if (record.error) return { ok: false, error: redactDeliveryError(record.error.message || "delivery query failed") };
  const event = record.data && typeof record.data === "object" ? record.data.last_event : record.last_event;
  if (typeof event !== "string" || !event.trim()) return { ok: false, error: "delivery query returned no last_event" };
  return { ok: true, lastEvent: event.trim() };
}

export class ProviderRejectedError extends Error {
  readonly statusCode: number | null;
  constructor(message: string, statusCode: number | null) {
    super(message);
    this.name = "ProviderRejectedError";
    this.statusCode = statusCode;
  }
}

export function liveTransport(): MailTransport {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("[newsletter] RESEND_API_KEY is required when NEWSLETTER_SEND_MODE=live");
  const resend = new Resend(apiKey);
  return {
    mode: "live",
    async send(mail, options) {
      const { data, error } = await resend.emails.send({
        from: newsletterFrom(),
        to: mail.to,
        replyTo: newsletterReplyTo(),
        subject: mail.subject,
        html: mail.html,
        text: mail.text,
        headers: mail.headers,
      }, { idempotencyKey: mail.idempotencyKey, signal: options?.signal });
      if (options?.signal?.aborted) {
        throw new ProviderRejectedError("send aborted", null);
      }
      if (error || !data?.id) {
        const statusCode = error && "statusCode" in error ? error.statusCode ?? null : null;
        throw new ProviderRejectedError(redactDeliveryError(error?.message ?? "resend send failed"), statusCode);
      }
      return { id: data.id };
    },
    async getDelivery(messageId, signal) {
      try {
        return deliveryLookupFromProvider(await resend.emails.get(messageId, { signal }));
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { ok: false, error: redactDeliveryError(message) };
      }
    },
  };
}

export function newsletterTransport(): MailTransport {
  return newsletterSendMode() === "live" ? liveTransport() : mockTransport();
}
