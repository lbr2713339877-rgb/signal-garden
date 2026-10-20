/**
 * Where a Monday-digest signup started.
 * `today` is the older today-page value and maps to the inline placement.
 */
export const SUBSCRIBE_LOCATIONS = ["home", "today_inline", "project_bottom", "project_cta", "footer"] as const;

export type SubscribeLocation = (typeof SUBSCRIBE_LOCATIONS)[number];

export function normalizeSubscribeLocation(value: unknown): SubscribeLocation | null {
  if (value === "today" || value === "today_inline") return "today_inline";
  if (value === "home" || value === "project_bottom" || value === "project_cta" || value === "footer") return value;
  return null;
}

/** Coarser page name kept for existing Umami filters. */
export function subscribeAnalyticsPage(location: SubscribeLocation): "home" | "today" | "project" | "footer" {
  if (location === "today_inline") return "today";
  if (location === "project_bottom" || location === "project_cta") return "project";
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
 * `sent:false` did not call the mailer: quiet window, already active, or the
 * 3-per-24h email cap. The screen must say so instead of showing the confirm step.
 */
export function subscribeAck(body: { sent?: unknown } | null | undefined): "sent" | "limited" {
  return body?.sent === false ? "limited" : "sent";
}

/** Umami payload for an explicit resend. `location` is the signup placement. */
export function resendAnalytics(
  location: SubscribeLocation,
  utmSource: string,
  sent: boolean,
): Record<string, string> {
  return {
    ...subscribeAnalyticsProps(location, utmSource),
    outcome: sent ? "sent" : "limited",
  };
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
