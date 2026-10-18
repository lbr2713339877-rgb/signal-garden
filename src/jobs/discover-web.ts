import { and, asc, eq, inArray, isNull, or, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { aiContent, externalMention, project, sourceSignal } from '@/db/schema';
import { fetchWebsite, publicWebsiteUrl } from '@/collectors/web/page';
import { fingerprint } from '@/normalizers/fingerprint';
import { parseFocus } from '@/normalizers/focus-parse';
import { DISCOVERY_COPY_CHANGED } from '@/normalizers/discovery-policy';
import { classifyTaxonomy } from '@/normalizers/taxonomy';
import { toSlug } from '@/lib/utils';
import { mapLimit } from '@/lib/concurrency';
import { log, type JobResult } from './run';

// These are starting points, not exemptions from review. Official content is fetched every day.
const SEEDS = [{ name: 'OneTake AI', url: 'https://www.onetake.ai/' }];
const GENERIC_HOSTS = /(?:^|\.)(github\.com|youtube\.com|youtu\.be|medium\.com|reddit\.com|twitter\.com|x\.com|news\.ycombinator\.com|substack\.com)$/;

export async function discoverWeb(opts: { limit?: number; seedsOnly?: boolean; dryRun?: boolean } = {}): Promise<JobResult> {
  const d = await db();
  const limit = opts.limit ?? 30;
  const items = new Map<string, { name?: string; url: string; hit?: any }>();
  const put = (x: { name?: string; url: string; hit?: any }) => {
    const u = publicWebsiteUrl(x.url); if (!u || GENERIC_HOSTS.test(u.hostname)) return;
    const domain = u.hostname.replace(/^www\./, '').toLowerCase();
    // Discover the product root, not articles and documentation pages.
    if (u.pathname !== '/' && !x.name) return;
    items.set(domain, x);
  };
  const newItems: { url: string; hit: any }[] = [];
  if (!opts.seedsOnly) {
    const after = Math.floor(Date.now() / 1000) - 21 * 86400;
    const r = await fetch(`https://hn.algolia.com/api/v1/search?tags=show_hn&numericFilters=created_at_i>${after},points>=10,num_comments>=2&hitsPerPage=100`, { signal: AbortSignal.timeout(20000) });
    if (!r.ok) throw new Error(`Show HN discovery HTTP ${r.status}`);
    const json = await r.json();
    for (const h of json.hits ?? []) if (h.url) newItems.push({ url: h.url, hit: h });
  }
  for (const s of SEEDS) put(s);
  const refresh = await d.select({ name: project.name, url: project.primaryUrl }).from(project)
    .where(and(sql`${project.projectKind} <> 'repo'`, eq(project.hidden, false),
      or(isNull(project.lastVerifiedAt), sql`${project.lastVerifiedAt} < now() - interval '20 hours'`)))
    .orderBy(asc(project.lastVerifiedAt)).limit(Math.max(1, Math.floor(limit / 2)));
  for (const p of refresh) { const u = publicWebsiteUrl(p.url); if (u && !items.has(u.hostname.replace(/^www\./, ''))) put(p); }
  // Give existing sites a rotating refresh budget, while leaving room for new discoveries.
  for (const item of newItems) { const u = publicWebsiteUrl(item.url); if (u) {
    const domain = u.hostname.replace(/^www\./, '').toLowerCase();
    if (items.has(domain)) items.get(domain)!.hit = item.hit;
    else put(item);
  } }
  const candidates = [...items.entries()].slice(0, limit);
  const errors: { domain: string; error: string }[] = []; let saved = 0;
  await mapLimit(candidates, 3, async ([domain, item]) => {
    try {
      const page = await fetchWebsite(item.url);
      const name = item.name ?? page.title.split(/\s+[|—–]\s+/)[0].slice(0, 90);
      const focus = parseFocus({ name, description: page.description, topics: [], readme: page.text, queries: ['focus:play:repo:website'] });
      if (!focus.inFocus) return;
      const hash = fingerprint(page.text);
      const tax = classifyTaxonomy({ name, description: page.description, topics: [], readme: page.text, skillMdCount: 0, hasMcpSdk: false });
      if (opts.dryRun) { log('discover-web', `DRY RUN ${name} · ${domain} · ${tax.primary}`); saved++; return; }
      const [existing] = await d.select().from(project).where(or(eq(project.domain, domain), eq(project.canonicalProjectId, `domain:${domain}`))).limit(1);
      if (existing?.projectKind === 'repo') {
        if (item.hit) await saveMention(existing.id, item.hit); return;
      }
      const docs: any = existing?.docSignals ?? {};
      const values = {
        name, primaryUrl: page.url, homepageUrl: page.url, domain, description: page.description,
        readmeText: page.text, readmeHash: hash, contentHash: hash,
        focusScore: focus.score, focusThemes: focus.themes, focusEvidence: focus.evidence,
        primaryCategory: tax.primary, secondaryCategory: tax.secondary, categorySource: 'rules',
        category: tax.primary === 'ai-tools' ? 'agent' as const : tax.primary === 'design' ? 'design' as const : 'productivity' as const,
        previewImageUrl: page.image, parseState: 'parsed' as const, linkStatus: 'ok' as const,
        parsedAt: new Date(), lastVerifiedAt: new Date(), updatedAt: new Date(), lastError: null,
        // Hosted products have no repository code to scan. Keep this explicitly unknown.
        riskFlags: [], securityLevel: 'unknown' as const, requiresLocalRuntime: false,
        docSignals: { ...docs, hasReadme: true, hasOfficialPage: true, readmeLength: page.text.length,
          websiteEvidenceUrl: page.url, usageLinks: page.links, hasExamples: page.links.length > 0,
          ...(hash === existing?.readmeHash ? {} : { discoveryReview: null }) },
        parseEvidence: { website: { url: page.url, hash, checkedAt: new Date().toISOString() }, riskScan: 'not applicable: hosted product; server code unavailable' },
      };
      const [p] = existing
        ? await d.update(project).set(values).where(eq(project.id, existing.id)).returning({ id: project.id })
        : await d.insert(project).values({ ...values, canonicalProjectId: `domain:${domain}`, slug: `${toSlug(name)}-${domain.split('.')[0]}`,
            projectKind: 'product', sourceUrl: item.hit ? `https://news.ycombinator.com/item?id=${item.hit.objectID}` : page.url,
            discoveryQueries: ['focus:play:repo:website'] }).onConflictDoNothing().returning({ id: project.id });
      if (!p) return;
      if (existing && existing.readmeHash !== hash) {
        // A fresh review cannot make yesterday's description current. Rebuild the copy too.
        await d.update(aiContent).set({ passedGuard: false, guardFailures: [DISCOVERY_COPY_CHANGED] })
          .where(eq(aiContent.projectId, p.id));
      }
      await d.insert(sourceSignal).values({ source: item.hit ? 'hackernews' : 'community', sourceId: domain,
        sourceUrl: page.url, rawHash: hash, payload: { title: page.title, description: page.description, url: page.url, text: page.text, usageLinks: page.links }, processedAt: new Date() }).onConflictDoNothing();
      if (item.hit) await saveMention(p.id, item.hit);
      saved++; log('discover-web', `${name} · official page fetched`);
    } catch (err) {
      errors.push({ domain, error: String(err).slice(0, 180) });
      if (!opts.dryRun) await d.update(project).set({ linkStatus: 'unknown', lastVerifiedAt: new Date(), lastError: String(err).slice(0, 180) })
        .where(and(eq(project.domain, domain), sql`${project.projectKind} <> 'repo'`));
    }
  });
  if (errors.length) log('discover-web', `${errors.length} pages held for retry`);
  if (candidates.length && errors.length === candidates.length) throw new Error(`All ${errors.length} product pages failed; ${errors[0].error}`);
  return { itemsIn: candidates.length, itemsOut: saved, meta: { errors, source: 'Show HN + official product pages' } };

  async function saveMention(id: string, h: any) {
    await d.insert(externalMention).values({ projectId: id, source: 'hn_story', url: `https://news.ycombinator.com/item?id=${h.objectID}`,
      title: h.title, points: h.points ?? 0, comments: h.num_comments ?? 0, isShowHn: true,
      publishedAt: h.created_at ? new Date(h.created_at) : null }).onConflictDoUpdate({ target: [externalMention.projectId, externalMention.source, externalMention.url],
        set: { points: h.points ?? 0, comments: h.num_comments ?? 0 } });
  }
}
