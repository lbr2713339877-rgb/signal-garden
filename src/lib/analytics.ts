/**
 * Optional visitor-analytics tag. Nothing loads unless a script URL is set,
 * so local, CI, and production stay quiet until someone points this at Umami,
 * a self-hosted collector, or a later Plausible script.
 */

export type AnalyticsConfig = {
  src: string;
  /** Umami `data-website-id`. */
  websiteId: string | null;
  /** Plausible classic `data-domain`, if that script is the one in `src`. */
  dataDomain: string | null;
};

export function analyticsConfig(env: {
  scriptSrc?: string | null;
  websiteId?: string | null;
  dataDomain?: string | null;
}): AnalyticsConfig | null {
  const src = normalizeScriptSrc(env.scriptSrc);
  if (!src) return null;
  return {
    src,
    websiteId: normalizeAttribute(env.websiteId),
    dataDomain: normalizeDomain(env.dataDomain),
  };
}

function normalizeScriptSrc(raw: string | null | undefined): string | null {
  const value = raw?.trim() ?? '';
  if (!value) return null;
  if (value.startsWith('/') && !value.startsWith('//')) {
    if (value.includes('..') || /[\s<>"'`]/.test(value)) return null;
    return value;
  }
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    if (url.username || url.password) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function normalizeAttribute(raw: string | null | undefined): string | null {
  const value = raw?.trim() ?? '';
  if (!value || value.length > 128) return null;
  if (!/^[A-Za-z0-9._:-]+$/.test(value)) return null;
  return value;
}

function normalizeDomain(raw: string | null | undefined): string | null {
  const value = raw?.trim() ?? '';
  if (!value || /[\s<>"'`]/.test(value)) return null;
  try {
    const url = new URL(value.includes('://') ? value : `https://${value}`);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    if (!url.hostname || url.username || url.password) return null;
    if (!/^[a-z0-9.-]+$/i.test(url.hostname)) return null;
    return url.hostname;
  } catch {
    return null;
  }
}
