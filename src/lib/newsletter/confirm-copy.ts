/**
 * Confirmation copy shared by the email and the post-submit screen.
 * Import these constants from both places so the subject and sender cannot drift.
 */
export const CONFIRM_FROM_ADDRESS = "hello@signalgarden.site";

export const CONFIRM_SUBJECT = {
  zh: "请确认订阅 Signal Garden 周刊",
  en: "Confirm your Signal Garden weekly subscription",
} as const;

export function confirmSubject(locale: "zh" | "en"): string {
  return CONFIRM_SUBJECT[locale];
}
