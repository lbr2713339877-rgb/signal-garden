import { MIN_DWELL_MS, sha256 } from "./tokens";

const EMAIL =
  /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/;

/** Small, obvious disposable domains. This is a brake, not a complete directory. */
const DISPOSABLE = new Set([
  "mailinator.com",
  "guerrillamail.com",
  "guerrillamail.info",
  "guerrillamail.net",
  "guerrillamail.org",
  "guerrillamailblock.com",
  "sharklasers.com",
  "grr.la",
  "yopmail.com",
  "tempmail.com",
  "temp-mail.org",
  "10minutemail.com",
  "trashmail.com",
  "trashmail.de",
  "dispostable.com",
  "getnada.com",
  "maildrop.cc",
  "fakeinbox.com",
  "throwawaymail.com",
  "mailnesia.com",
  "spam4.me",
  "tempail.com",
  "moakt.com",
  "emailondeck.com",
]);

export function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  if (email.length > 254 || !EMAIL.test(email)) return null;
  const domain = email.slice(email.lastIndexOf("@") + 1);
  if (DISPOSABLE.has(domain)) return null;
  return email;
}

export function hashEmail(email: string): string {
  return sha256(email);
}

export function dwellOk(value: unknown, now: number): boolean {
  const started = typeof value === "number"
    ? value
    : typeof value === "string" && /^\d{10,16}$/.test(value)
      ? Number(value)
      : Number.NaN;
  if (!Number.isFinite(started)) return false;
  const elapsed = now - started;
  return elapsed >= MIN_DWELL_MS && elapsed < 24 * 60 * 60 * 1000;
}

export function honeypotTripped(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

const SOURCES = new Set(["home", "today", "footer"]);

export function normalizeSource(value: unknown): "home" | "today" | "footer" | null {
  return typeof value === "string" && SOURCES.has(value) ? value as "home" | "today" | "footer" : null;
}
