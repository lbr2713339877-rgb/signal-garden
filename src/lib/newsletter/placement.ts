/**
 * Where a Monday-digest signup started.
 * `today` is the older today-page value and maps to the inline placement.
 */
export const SUBSCRIBE_LOCATIONS = ["home", "today_inline", "project_bottom", "footer"] as const;

export type SubscribeLocation = (typeof SUBSCRIBE_LOCATIONS)[number];

export function normalizeSubscribeLocation(value: unknown): SubscribeLocation | null {
  if (value === "today" || value === "today_inline") return "today_inline";
  if (value === "home" || value === "project_bottom" || value === "footer") return value;
  return null;
}

/** Coarser page name kept for existing Umami filters. */
export function subscribeAnalyticsPage(location: SubscribeLocation): "home" | "today" | "project" | "footer" {
  if (location === "today_inline") return "today";
  if (location === "project_bottom") return "project";
  return location;
}

export function subscribeAnalyticsProps(location: SubscribeLocation, utmSource: string): Record<string, string> {
  return {
    location,
    page: subscribeAnalyticsPage(location),
    source: utmSource,
  };
}

/**
 * `{ok:true}` without `sent` is a real send (older responses).
 * `sent:false` is a quiet no-op: recent confirm, email rate limit, or already active.
 */
export function subscribeAck(body: { sent?: unknown } | null | undefined): "sent" | "already" {
  return body?.sent === false ? "already" : "sent";
}

export function subscribeResponse(result: { ok: true; sent: boolean } | { ok: false; error: string; code?: string }): {
  status: number;
  body: { ok: true; sent: boolean } | { ok: false; error: string; code?: string };
} {
  if (!result.ok && result.error === "rate_limited") return { status: 429, body: result };
  if (!result.ok) return { status: 400, body: result };
  return { status: 200, body: { ok: true, sent: result.sent } };
}

/** Cards before which the /today inline subscribe box is inserted. */
export function todayInlineInsertIndex(cardCount: number, after = 3): number {
  if (cardCount <= 0) return 0;
  return Math.min(cardCount, after);
}

/** Public confirm redirect. Location is an allowlisted placement, never a token. */
export function confirmStatusQuery(outcome: string, location: unknown): string {
  const params = new URLSearchParams();
  params.set("status", outcome);
  const loc = normalizeSubscribeLocation(location);
  if (loc) params.set("loc", loc);
  return params.toString();
}
