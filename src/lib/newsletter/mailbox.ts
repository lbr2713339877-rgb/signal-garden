const MAILBOX_ROOTS: Array<[string, string]> = [
  ["foxmail.com", "https://mail.qq.com"],
  ["qq.com", "https://mail.qq.com"],
  ["163.com", "https://mail.163.com"],
  ["126.com", "https://mail.126.com"],
  ["googlemail.com", "https://mail.google.com"],
  ["gmail.com", "https://mail.google.com"],
  ["outlook.com", "https://outlook.live.com"],
  ["hotmail.com", "https://outlook.live.com"],
  ["live.com", "https://outlook.live.com"],
];

function matchesRoot(domain: string, root: string): boolean {
  return domain === root || domain.endsWith(`.${root}`);
}

/**
 * Webmail link for a few common providers, including subdomains.
 * `vip.qq.com` and `foxmail.com` open QQ mail. Anything else, including
 * `mail.grokbot.com`, returns null.
 */
export function mailboxUrl(email: string): string | null {
  const normalized = email.trim().toLowerCase();
  const at = normalized.lastIndexOf("@");
  if (at <= 0 || at !== normalized.indexOf("@")) return null;
  const domain = normalized.slice(at + 1).trim().replace(/\.+$/, "");
  if (!domain || !domain.includes(".") || /\s/.test(domain)) return null;
  for (const [root, url] of MAILBOX_ROOTS) {
    if (matchesRoot(domain, root)) return url;
  }
  return null;
}
