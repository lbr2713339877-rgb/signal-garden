import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

export function publicWebsiteUrl(value: string): URL | null {
  try {
    const u = new URL(value);
    if (u.protocol !== 'https:' || u.username || u.password || (u.port && u.port !== '443')) return null;
    if (isIP(u.hostname) || !u.hostname.includes('.') || /(?:^|\.)(?:localhost|local|internal|test|invalid)$/.test(u.hostname)) return null;
    u.hash = ''; return u;
  } catch { return null; }
}

function privateAddress(ip: string): boolean {
  if (ip.includes(':')) return /^(?:\:\:|fc|fd|fe[89ab]|::ffff:)/i.test(ip);
  const [a, b] = ip.split('.').map(Number);
  return a === 0 || a === 10 || a === 127 || a >= 224 || (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
}

export function decodeHtml(s: string): string {
  return s.replace(/&#(x[0-9a-f]+|\d+);/gi, (_, n) => {
    const cp = n[0].toLowerCase() === 'x' ? parseInt(n.slice(1), 16) : Number(n);
    return cp > 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : '';
  }).replace(/&(?:amp|quot|apos|lt|gt|nbsp);/g, x => ({'&amp;':'&','&quot;':'"','&apos;':"'",'&lt;':'<','&gt;':'>','&nbsp;':' '}[x]!));
}

export function parseWebsite(html: string, url: string) {
  const meta = new Map<string, string>();
  for (const tag of html.matchAll(/<meta\b[^>]*>/gi)) {
    const attrs = new Map([...tag[0].matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)]
      .map(m => [m[1].toLowerCase(), decodeHtml(m[2] ?? m[3] ?? m[4] ?? '')]));
    const key = attrs.get('property') ?? attrs.get('name');
    if (key && attrs.get('content')) meta.set(key.toLowerCase(), attrs.get('content')!);
  }
  const title = meta.get('og:site_name') ?? decodeHtml(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '').replace(/\s+/g, ' ').trim();
  const description = meta.get('description') ?? meta.get('og:description') ?? '';
  const text = decodeHtml(html.replace(/<(script|style|svg|noscript)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim().slice(0, 16000);
  let image: string | null = null;
  try { const i = new URL(meta.get('og:image') ?? '', url); if (meta.get('og:image') && publicWebsiteUrl(i.href)) image = i.href; } catch {}
  const links = [...html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)]
    .map(m => ({ href: m[1], text: decodeHtml(m[2].replace(/<[^>]+>/g, ' ')).trim() }))
    .filter(l => /try|demo|start|sign.?up|create|play|launch|app|试用|开始|体验/i.test(`${l.href} ${l.text}`))
    .flatMap(l => { try { const u = new URL(l.href, url); return publicWebsiteUrl(u.href) ? [{ url: u.href, label: l.text.slice(0, 100) }] : []; } catch { return []; } }).slice(0, 12);
  return { title: title.slice(0, 180), description: description.slice(0, 800), text, image, links };
}

/** Fetch only public HTTPS documents, with bounded bytes, time and redirects. */
export async function fetchWebsite(value: string) {
  let u = publicWebsiteUrl(value);
  if (!u) throw new Error('not a public HTTPS website');
  const signal = AbortSignal.timeout(20000);
  for (let hop = 0; hop < 5; hop++) {
    const addresses = await lookup(u.hostname, { all: true });
    if (!addresses.length || addresses.some(a => privateAddress(a.address))) throw new Error('private destination');
    const r: Response = await fetch(u, { signal, redirect: 'manual', headers: { 'User-Agent': 'SignalGarden/1.0 (+https://signalgarden.site)', Accept: 'text/html' } });
    if (r.status >= 300 && r.status < 400) {
      const next: string | null = r.headers.get('location'); await r.body?.cancel();
      u = next ? publicWebsiteUrl(new URL(next, u).href) : null;
      if (!u) throw new Error('invalid redirect'); continue;
    }
    if (!r.ok || !r.headers.get('content-type')?.includes('text/html')) throw new Error(`website HTTP ${r.status}`);
    const reader = r.body?.getReader(); if (!reader) throw new Error('empty response');
    const chunks: Uint8Array[] = []; let bytes = 0;
    try {
      while (true) { const part = await reader.read(); if (part.done) break;
        bytes += part.value.length; if (bytes > 1500000) throw new Error('document too large'); chunks.push(part.value); }
    } finally { await reader.cancel().catch(() => {}); }
    const html = Buffer.concat(chunks).toString('utf8');
    const page = parseWebsite(html, u.href);
    if (!page.title || page.text.length < 150) throw new Error('no readable product document');
    return { ...page, url: u.href };
  }
  throw new Error('too many redirects');
}
