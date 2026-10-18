import { or, sql, gte } from 'drizzle-orm';
import { project } from '@/db/schema';
import { TODAY_LIMIT } from '@/lib/edition';

export interface DiscoveryReview {
  version: string;
  hash: string;
  passed: boolean;
  interesting: boolean;
  reason: string;
  quotes: string[];
  reviewedAt: string;
}

export const DISCOVERY_REVIEW_VERSION = 'discovery-v1';
export const DISCOVERY_COPY_CHANGED = 'Official product page changed; regenerate copy from the current evidence';

/** Repository commits often leave README text unchanged. Keep the proof; hash gates still invalidate changed sources. */
export function refreshedDiscoveryDocuments(fresh: object) {
  return sql`${JSON.stringify(fresh)}::jsonb || CASE WHEN ${project.docSignals} ? 'discoveryReview'
    THEN jsonb_build_object('discoveryReview', ${project.docSignals}->'discoveryReview') ELSE '{}'::jsonb END`;
}

/** Number actual source excerpts so the model cites text instead of retyping Markdown. */
export function discoveryEvidence(source: string): string[] {
  return source.split(/\n+|(?<=[.!?。！？])\s+/).flatMap(line => {
    const chunks: string[] = []; let rest = line.trim();
    while (rest.length > 220) {
      const space = rest.lastIndexOf(' ', 220);
      const at = space > 80 ? space : 220;
      chunks.push(rest.slice(0, at)); rest = rest.slice(at).trim();
    }
    if (rest) chunks.push(rest);
    return chunks.filter(s => s.length >= 12);
  });
}

export function quotedDiscoveryEvidence(indices: unknown, excerpts: string[]): string[] {
  if (!Array.isArray(indices)) return [];
  return [...new Set(indices)].filter((i): i is number => Number.isInteger(i) && i >= 1 && i <= excerpts.length)
    .slice(0, 3).map(i => excerpts[i - 1]);
}

/** A review is tied to the current source, never to a permanent whitelist. */
export function currentDiscoveryReview(docs: any, hash: string | null): DiscoveryReview | null {
  const r = docs?.discoveryReview;
  return hash && r?.version === DISCOVERY_REVIEW_VERSION && r.hash === hash ? r : null;
}

export function reviewedDiscovery() {
  return sql`(${project.docSignals}->'discoveryReview'->>'version' = ${DISCOVERY_REVIEW_VERSION}
    AND ${project.docSignals}->'discoveryReview'->>'hash' = ${project.readmeHash}
    AND ${project.docSignals}->'discoveryReview'->>'passed' = 'true')`;
}

export function interestingDiscovery() {
  return sql`(${reviewedDiscovery()} AND ${project.docSignals}->'discoveryReview'->>'interesting' = 'true')`;
}

/** Websites have no GitHub stars. Their own documented, reviewed use is the gate. */
export function discoveryTraction() {
  return or(gte(project.stars, 20), sql`(${project.projectKind} <> 'repo'
    AND ${project.linkStatus} = 'ok'
    AND ${project.docSignals}->>'hasOfficialPage' = 'true'
    AND ${reviewedDiscovery()})`)!;
}

/** Preserve the existing library floor while allowing reviewed small discoveries. */
export function catalogueTraction() {
  return sql`(${project.stars} >= 500 OR ${project.forks7d} >= 15 OR ${project.stars24h} >= 50
    OR (${interestingDiscovery()} AND ${discoveryTraction()}))`;
}

/** The reviewer must quote the source verbatim. Promoting an index or article is rejected. */
export function validateDiscoveryReview(raw: any, source: string): { passed: boolean; interesting: boolean; reason: string; quotes: string[] } {
  const quotes = Array.isArray(raw?.quotes) ? [...new Set<string>(raw.quotes.filter((q: unknown): q is string =>
    typeof q === 'string' && q.trim().length >= 12 && q.length <= 400 && source.includes(q)))].slice(0, 3) : [];
  const passed = raw?.isProduct === true && raw?.hasClearUse === true &&
    raw?.hasUsageEvidence === true && quotes.length >= 2;
  return { passed, interesting: passed && raw?.interesting === true,
    reason: typeof raw?.reason === 'string' ? raw.reason.slice(0, 240) : '缺少可核验的用途与使用证据', quotes };
}

/** Reserve two of the first edition slots for reviewed discoveries, without bypassing any gate. */
export function selectEdition<T extends { projectId: string; interesting: boolean; primaryCategory?: string | null; exposureKeys: string[]; earlySolo?: boolean }>(rows: T[], top: number): T[] {
  const selected: T[] = [];
  const keys = new Set<string>();
  const counts = new Map<string, number>();
  const novelTarget = Math.min(2, Math.floor(top / 4));
  const canAdd = (r: T) => !selected.includes(r) && !r.exposureKeys.some(k => keys.has(k)) && !(r.earlySolo && selected.length < 5);
  const add = (r: T) => {
    selected.push(r); r.exposureKeys.forEach(k => keys.add(k));
    counts.set(r.primaryCategory ?? '', (counts.get(r.primaryCategory ?? '') ?? 0) + 1);
  };
  while (selected.length < top) {
    const left = Math.min(top, TODAY_LIMIT) - selected.length;
    const novelNeeded = novelTarget - selected.slice(0, TODAY_LIMIT).filter(r => r.interesting).length;
    let next: T | undefined;
    if (left > 0 && left <= novelNeeded) next = rows.find(r => r.interesting && canAdd(r));
    // Use breadth as a tie-breaking selection preference, keeping heat order inside each pass.
    next ??= rows.find(r => canAdd(r) && (counts.get(r.primaryCategory ?? '') ?? 0) < 2);
    next ??= rows.find(canAdd);
    if (!next) break;
    add(next);
  }
  return selected;
}
