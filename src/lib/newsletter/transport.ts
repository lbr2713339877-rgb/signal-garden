import { Resend } from "resend";

export const DEFAULT_NEWSLETTER_FROM = "Signal Garden <hello@signalgarden.site>";
export const DEFAULT_NEWSLETTER_REPLY_TO = "hello@signalgarden.site";

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

export interface MailTransport {
  mode: "mock" | "live";
  send(mail: OutboundMail): Promise<{ id: string }>;
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

export function liveTransport(): MailTransport {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("[newsletter] RESEND_API_KEY is required when NEWSLETTER_SEND_MODE=live");
  const resend = new Resend(apiKey);
  return {
    mode: "live",
    async send(mail) {
      const { data, error } = await resend.emails.send({
        from: newsletterFrom(),
        to: mail.to,
        replyTo: newsletterReplyTo(),
        subject: mail.subject,
        html: mail.html,
        text: mail.text,
        headers: mail.headers,
      }, { idempotencyKey: mail.idempotencyKey });
      if (error || !data) throw new Error(error?.message ?? "resend send failed");
      return { id: data.id };
    },
  };
}

export function newsletterTransport(): MailTransport {
  return newsletterSendMode() === "live" ? liveTransport() : mockTransport();
}
