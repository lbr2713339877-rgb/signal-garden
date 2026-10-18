export type EmailLocale = 'zh' | 'en';

export function normalizeEmailLocale(value: unknown): EmailLocale | null {
  if (typeof value !== 'string') return null;
  const tag = value.trim().toLowerCase();
  if (/^zh(?:-[a-z0-9]+)*$/.test(tag)) return 'zh';
  if (/^en(?:-[a-z0-9]+)*$/.test(tag)) return 'en';
  return null;
}

/** Current UI choice wins, then account preference, then browser language. */
export function resolveEmailLocale(
  selected: unknown,
  saved?: unknown,
  acceptLanguage?: string | null,
): EmailLocale {
  const chosen = normalizeEmailLocale(selected) ?? normalizeEmailLocale(saved);
  if (chosen) return chosen;
  const languages = (acceptLanguage ?? '').split(',').map((entry, index) => {
    const [tag, ...parameters] = entry.trim().split(';');
    const q = parameters.find((part) => /^\s*q=/i.test(part));
    return { tag: tag.trim(), weight: q ? Number(q.trim().slice(2)) : 1, index };
  }).filter(({ tag, weight }) => /^[a-z]{2,8}(?:-[a-z0-9]+)*$/i.test(tag) && weight > 0 && weight <= 1);
  languages.sort((a, b) => b.weight - a.weight || a.index - b.index);
  // The site also shows English for browser languages other than Chinese.
  return normalizeEmailLocale(languages[0]?.tag) ?? 'en';
}
