import { normalizeSubscribeLocation } from "./placement";

export const LIST_UNSUBSCRIBE_MAILBOX = "unsubscribe@signalgarden.site";

export function confirmPageUrl(siteUrl: string, token: string, location?: unknown): string {
  const base = `${siteUrl}/subscribe/confirm?t=${encodeURIComponent(token)}`;
  const loc = normalizeSubscribeLocation(location);
  return loc ? `${base}&loc=${encodeURIComponent(loc)}` : base;
}

export function unsubscribePageUrl(siteUrl: string, token: string): string {
  return `${siteUrl}/unsubscribe?t=${encodeURIComponent(token)}`;
}

export function unsubscribeApiUrl(siteUrl: string, token: string): string {
  return `${siteUrl}/api/unsubscribe?t=${encodeURIComponent(token)}`;
}

/** RFC 2369 + RFC 8058. The HTTPS URI is the one-click POST target. */
export function listUnsubscribeHeaders(siteUrl: string, token: string): Record<string, string> {
  const https = unsubscribeApiUrl(siteUrl, token);
  return {
    "List-Unsubscribe": `<${https}>, <mailto:${LIST_UNSUBSCRIBE_MAILBOX}?subject=unsub>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
}
