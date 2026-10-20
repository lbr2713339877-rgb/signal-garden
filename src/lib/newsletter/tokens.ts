import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";

/** Confirm links stop working after 48 hours. Unsubscribe links do not expire. */
export const CONFIRM_TTL_MS = 48 * 60 * 60 * 1000;
/** Do not mint another confirm link until this long after the last one. */
export const CONFIRM_RESEND_AFTER_MS = 10 * 60 * 1000;
/** Pending rows that never confirm are removed on the next newsletter run. */
export const PENDING_TTL_MS = 7 * 24 * 60 * 60 * 1000;
/** The address itself is deleted this long after unsubscribe. The hash stays. */
export const PURGE_AFTER_MS = 30 * 24 * 60 * 60 * 1000;
/** A real person cannot submit the form the instant it appears. */
export const MIN_DWELL_MS = 2_000;
export const IP_LIMIT = 5;
export const IP_WINDOW_MS = 60 * 60 * 1000;
export const EMAIL_LIMIT = 3;
export const EMAIL_WINDOW_MS = 24 * 60 * 60 * 1000;

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/** Plaintext token. It is only ever placed in an email or a URL, never stored. */
export function newToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return sha256(token);
}

export function isTokenShape(token: string): boolean {
  return /^[A-Za-z0-9_-]{20,128}$/.test(token);
}

export function tokenMatches(token: string, hash: string): boolean {
  if (!isTokenShape(token) || !/^[a-f0-9]{64}$/.test(hash)) return false;
  const actual = Buffer.from(hashToken(token));
  const expected = Buffer.from(hash);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/**
 * Unsubscribe links have to be rebuilt for every later edition, and only the
 * hash is stored. The token is an HMAC of the subscriber id, so a send can
 * recompute it without keeping the plaintext.
 */
export function unsubTokenFor(subscriberId: string, secret?: string): string {
  const key = secret ?? (process.env.NEWSLETTER_UNSUB_SECRET?.trim() || "signal-garden-newsletter-unsub-dev");
  return createHmac("sha256", key).update(`unsub:${subscriberId}`).digest("base64url");
}

/**
 * Confirm links are an HMAC of the subscriber id and the expiry instant, so a
 * later resend can rebuild the same token while it is still valid. Only the
 * hash is stored. The `confirm:` prefix keeps this distinct from unsubscribe.
 */
export function confirmTokenFor(subscriberId: string, expiresAtMs: number, secret?: string): string {
  const key = secret ?? (process.env.NEWSLETTER_UNSUB_SECRET?.trim() || "signal-garden-newsletter-unsub-dev");
  return createHmac("sha256", key).update(`confirm:${subscriberId}:${expiresAtMs}`).digest("base64url");
}

/** Whole seconds, so a timestamp round-trip cannot change the HMAC input. */
export function confirmExpiry(now: Date): Date {
  return new Date(Math.floor((now.getTime() + CONFIRM_TTL_MS) / 1000) * 1000);
}

export function newSubscriberId(): string {
  return randomUUID();
}

/** Salted so a 32-bit IPv4 address cannot be walked back from the stored hash. */
export function hashIp(ip: string, salt = process.env.NEWSLETTER_IP_HASH_SALT ?? "signal-garden-newsletter"): string {
  return sha256(`${salt}:${ip}`);
}
