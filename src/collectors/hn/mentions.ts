/**
 * Hacker News discussion collector.
 *
 * Uses the public Algolia HN Search API (no key, no auth). For each project we
 * query twice — once by the GitHub `owner/repo` full name and once by the
 * project's homepage domain — then store the matching stories in
 * `external_mention`.
 *
 * Dedupe is enforced by the table's unique key (project_id, source, url), so a
 * re-run is safe. Stories only, not comments: a comment thread is evidence of
 * discussion, but a submitted story is what readers can actually open.
 */

import { and, desc, eq, gte, inArray, isNotNull, isNull, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { externalMention, project } from '@/db/schema';
import { MIN_STARS_TO_RANK } from '@/scoring/daily';
import { mapLimit } from '@/lib/concurrency';
import { log, type JobResult } from '@/jobs/run';

const HN_API = 'https://hn.algolia.com/api/v1/search';

interface HnHit {
  objectID: string;
  title: string | null;
  url: string | null;
  author: string | null;
  points: number | null;
  num_comments: number | null;
  created_at: string | null;
}

interface HnResponse {
  hits?: HnHit[];
}

/** One query against Algolia. Returns [] on any failure so one bad term never
 *  sinks the run. */
async function search(query: string): Promise<HnHit[]> {
  try {
    const url = `${HN_API}?query=${encodeURIComponent(query)}&tags=story&hitsPerPage=20`;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(20_000),
      headers: { 'User-Agent': 'signal-garden/0.1' },
    });
    if (!res.ok) return [];
    const json = (await res.json()) as HnResponse;
    return json.hits ?? [];
  } catch {
    return [];
  }
}

/**
 * A hit is only kept when the project's identity really appears in it. Matching
 * on a bare domain is far too loose (a "reddit.com" query returns unrelated
 * outage posts), so we require either the `owner/name` string or the full
 * domain to appear in the title or url, case-insensitively.
 */
const GENERIC_HOSTS = new Set([
  'reddit.com', 'github.com', 'medium.com', 'youtube.com', 'twitter.com',
  'x.com', 'facebook.com', 'google.com', 'npmjs.com', 'vercel.app', 'notion.so',
]);

function isRelevant(hit: HnHit, r: any, term: string): boolean {
  const hay = `${hit.title ?? ''} ${hit.url ?? ''}`.toLowerCase();
  const needle = term.toLowerCase();
  if (!needle) return false;
  if (needle.includes('/')) return hay.includes(needle);
  // For a domain, require it to look deliberate: both the domain and a word
  // boundary, so "reddit.com" cannot match "reddit.community" by accident and
  // a bare word does not match inside a longer word.
  const esc = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^a-z0-9.-])${esc}($|[^a-z0-9.-])`, 'i').test(hay);
}

/** The canonical HN item link for a story. */
function hnUrl(objectID: string): string {
  return `https://news.ycombinator.com/item?id=${objectID}`;
}

export async function collectMentions(opts: { limit?: number; force?: boolean } = {}): Promise<JobResult> {
  const limit = opts.limit ?? 200;
  const d = await db();

  /* Candidates: published-quality projects. Mentions only matter for things
     that can actually surface, and querying the whole 5,500-row corpus every
     day would be pointless traffic. `force` re-checks everything. */
  const rows = (await d
    .select({
      id: project.id,
      fullName: project.fullName,
      domain: project.domain,
      homepageUrl: project.homepageUrl,
      stars: project.stars,
      mentionsCheckedAt: project.mentionsCheckedAt,
    })
    .from(project)
    .where(
      and(
        eq(project.parseState, 'parsed'),
        eq(project.hidden, false),
        isNull(project.junkReason),
        eq(project.isSkillCollection, false),
        isNull(project.duplicateOf),
        gte(project.stars, MIN_STARS_TO_RANK),
        opts.force ? sql`true` : isNull(project.mentionsCheckedAt),
      ),
    )
    .orderBy(desc(project.stars))
    .limit(limit)) as any[];

  log('mentions', `${rows.length} projects to check`);

  let checked = 0;
  let written = 0;

  await mapLimit(rows, 4, async (r: any) => {
    /* Query by the repo's `owner/name` and by its homepage domain. The domain
       query is broad, so every hit is relevance-checked below — without that,
       a generic domain (or a repo whose name is a common word) drags in
       unrelated front-page stories. */
    const terms = new Set<string>();
    if (r.fullName) terms.add(r.fullName);
    // Skip the domain when it is a generic host. A repo whose `homepage` field
    // is just "reddit.com" (or github.com, medium.com…) would otherwise pull in
    // every unrelated story mentioning that site.
    if (r.domain && !GENERIC_HOSTS.has(String(r.domain).toLowerCase())) terms.add(r.domain);

    const seen = new Map<string, HnHit>();
    for (const term of terms) {
      for (const hit of await search(term)) {
        if (!isRelevant(hit, r, term)) continue;
        seen.set(hnUrl(hit.objectID), hit);
      }
    }

    checked++;
    if (seen.size) {
      const values = [...seen.entries()].map(([hnLink, hit]) => ({
        projectId: r.id,
        source: 'hn_story',
        url: hit.url ?? hnLink,
        title: hit.title ?? null,
        author: hit.author ?? null,
        points: hit.points ?? 0,
        comments: hit.num_comments ?? 0,
        publishedAt: hit.created_at ? new Date(hit.created_at) : null,
      }));
      const inserted = await d
        .insert(externalMention)
        .values(values)
        .onConflictDoNothing()
        .returning({ id: externalMention.id });
      written += inserted.length;
    }

    await d.update(project).set({ mentionsCheckedAt: new Date() }).where(eq(project.id, r.id));
  });

  log('mentions', `${checked} checked · ${written} new discussions`);
  return { itemsIn: checked, itemsOut: written, meta: { checked, written } };
}
