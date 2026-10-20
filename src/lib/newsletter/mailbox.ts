const MAILBOX_URL: Record<string, string> = {
  "qq.com": "https://mail.qq.com",
  "163.com": "https://mail.163.com",
  "126.com": "https://mail.126.com",
  "gmail.com": "https://mail.google.com",
  "outlook.com": "https://outlook.live.com",
  "hotmail.com": "https://outlook.live.com",
};

/** Webmail deep link for a few common domains. Every other domain returns null. */
export function mailboxUrl(email: string): string | null {
  const normalized = email.trim().toLowerCase();
  const at = normalized.lastIndexOf("@");
  if (at <= 0 || at !== normalized.indexOf("@")) return null;
  const domain = normalized.slice(at + 1);
  if (MAILBOX_URL[domain]) return MAILBOX_URL[domain];
  if (domain.endsWith(".outlook.com") || domain.endsWith(".hotmail.com")) return "https://outlook.live.com";
  return null;
}
