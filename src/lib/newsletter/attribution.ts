/**
 * First-touch signup attribution.
 *
 * The browser stores the landing query and referrer once per tab. The API
 * keeps campaign tags and the referrer origin plus path. It does not keep
 * the visitor IP, the user agent, or the referrer query string.
 */

export const ATTRIBUTION_STORAGE_KEY = "sg_subscribe_attribution";

export const UTM_MAX = 200;
export const REFERRER_MAX = 500;

/** Cap before URL parsing so a huge body cannot dominate the request. */
const REFERRER_PARSE_MAX = 2_000;

const UTM_FIELDS = ["utm_source", "utm_medium", "utm_campaign", "utm_content"] as const;
const STORED_FIELDS = [...UTM_FIELDS, "referrer"] as const;

export type StoredAttributionField = (typeof STORED_FIELDS)[number];

export interface SignupAttribution {
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  referrer: string | null;
}

export function emptyAttribution(): SignupAttribution {
  return {
    utmSource: null,
    utmMedium: null,
    utmCampaign: null,
    utmContent: null,
    referrer: null,
  };
}

function clip(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const chars = Array.from(trimmed);
  if (chars.length <= max) return trimmed;
  return chars.slice(0, max).join("");
}

/** Origin and path only. Query and fragment can carry addresses or tokens. */
export function referrerOriginPath(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  let url: URL;
  try {
    url = new URL(trimmed.slice(0, REFERRER_PARSE_MAX));
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (!url.hostname) return null;
  return clip(`${url.origin}${url.pathname || "/"}`, REFERRER_MAX);
}

export function parseSignupAttribution(body: Record<string, unknown> | null | undefined): SignupAttribution {
  const source = body ?? {};
  return {
    utmSource: clip(source.utm_source, UTM_MAX),
    utmMedium: clip(source.utm_medium, UTM_MAX),
    utmCampaign: clip(source.utm_campaign, UTM_MAX),
    utmContent: clip(source.utm_content, UTM_MAX),
    referrer: referrerOriginPath(source.referrer),
  };
}

/**
 * JSON to write on the first page of a tab, or null when this session already
 * stored a landing. An empty landing is still a landing: later in-app tags
 * must not replace it.
 */
export function firstTouchRecord(existing: string | null, search: string, referrer: string): string | null {
  if (existing !== null) return null;
  const params = new URLSearchParams(search);
  const record: Record<StoredAttributionField, string> = {
    utm_source: params.get("utm_source") ?? "",
    utm_medium: params.get("utm_medium") ?? "",
    utm_campaign: params.get("utm_campaign") ?? "",
    utm_content: params.get("utm_content") ?? "",
    referrer: referrer ?? "",
  };
  return JSON.stringify(record);
}

/** Fields a subscribe form may send. Unknown keys, including IP, are dropped. */
export function attributionFieldsFromStored(raw: string | null): Partial<Record<StoredAttributionField, string>> {
  if (!raw) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {};
  }
  if (!parsed || typeof parsed !== "object") return {};
  const record = parsed as Record<string, unknown>;
  const out: Partial<Record<StoredAttributionField, string>> = {};
  for (const key of STORED_FIELDS) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) out[key] = value;
  }
  return out;
}

export function readStoredAttribution(): Partial<Record<StoredAttributionField, string>> {
  if (typeof window === "undefined") return {};
  try {
    return attributionFieldsFromStored(window.sessionStorage.getItem(ATTRIBUTION_STORAGE_KEY));
  } catch {
    return {};
  }
}
