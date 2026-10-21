/** Gap between explicit resend attempts, and between confirmation mails to one address. */
export const RESEND_COOLDOWN_MS = 60_000;
/** Explicit resend calls for one address inside {@link RESEND_DAILY_WINDOW_MS}. */
export const RESEND_DAILY_LIMIT = 3;
export const RESEND_DAILY_WINDOW_MS = 24 * 60 * 60 * 1000;

export const RESEND_IP_BUCKET = "resend-ip";
export const RESEND_EMAIL_BUCKET = "resend-email";
export const RESEND_DAY_BUCKET = "resend-day";

export function resendCooldownSeconds(): number {
  return RESEND_COOLDOWN_MS / 1000;
}

/** Seconds left until `deadlineMs`, from the clock rather than a decremented counter. */
export function resendCooldownRemaining(deadlineMs: number, nowMs: number): number {
  if (!Number.isFinite(deadlineMs) || !Number.isFinite(nowMs)) return 0;
  return Math.max(0, Math.ceil((deadlineMs - nowMs) / 1000));
}
