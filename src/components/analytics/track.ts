/**
 * Umami custom events. Safe when the tracker is blocked or not loaded:
 * it retries briefly, then gives up silently. Never pass email or other PII.
 */
type EventData = Record<string, string | number>;
type UmamiWindow = Window & { umami?: { track: (name: string, data?: EventData) => void } };

export function trackEvent(name: string, data?: EventData, attempt = 0): void {
  if (typeof window === "undefined") return;
  const umami = (window as UmamiWindow).umami;
  if (umami && typeof umami.track === "function") {
    try { umami.track(name, data); } catch { /* analytics must never break the page */ }
    return;
  }
  if (attempt < 10) window.setTimeout(() => trackEvent(name, data, attempt + 1), 500);
}

/** utm_source of the current visit, or "direct". */
export function currentUtmSource(): string {
  if (typeof window === "undefined") return "direct";
  const value = new URLSearchParams(window.location.search).get("utm_source")?.trim();
  return value ? value.slice(0, 40) : "direct";
}
