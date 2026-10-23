/**
 * Pilot membership and the rows the project page turns into sections.
 * Tracked days are every daily_signal row. Hidden projects are not eligible.
 * Unpublished rows still store heat_score (the column is required). Rank 0 is
 * a review hold, not a public place.
 */

import { cache } from "react";
import { unstable_cache } from "next/cache";
import { asc, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { dailySignal } from "@/db/schema";
import {
  SEO_PILOT_MIN_POINTS,
  audiencePeerHints,
  audienceReadmeExcerpt,
  buildAudienceSection,
  buildMomentumSection,
  buildPeerSection,
  momentumShapeFromPoints,
  selectSeoPilotSlugs,
  seoPilotMetaDescription,
  type RankingPoint,
  type SeoPeerCandidate,
  type SeoPilotView,
} from "@/lib/seo-pilot";

export type SeoProjectFields = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  license?: string | null;
  language?: string | null;
  topics?: string[] | null;
  tags?: string[] | null;
  /** Full README. Only the first-paragraph excerpt is kept on the facts key. */
  readmeText?: string | null;
  readmeExcerpt?: string | null;
  projectKind?: string | null;
  skillType?: string | null;
  hasSkillMd?: boolean | null;
  isTemplate?: boolean | null;
  requiresApiKey?: boolean | null;
  requiresLocalRuntime?: boolean | null;
  requiresDocker?: boolean | null;
  primaryCategory?: string | null;
  category?: string | null;
  firstTrackedAt?: Date | string | null;
};

function readRows(result: unknown): Record<string, unknown>[] {
  if (Array.isArray(result)) {
    return result.filter((row) => row && typeof row === "object") as Record<string, unknown>[];
  }
  if (result && typeof result === "object" && Array.isArray((result as { rows?: unknown }).rows)) {
    return (result as { rows: Record<string, unknown>[] }).rows;
  }
  return [];
}

function asTopics(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => String(item));
  if (typeof value !== "string" || value === "{}" || !value) return [];
  if (value.startsWith("{") && value.endsWith("}")) {
    return value
      .slice(1, -1)
      .split(",")
      .map((item) => item.trim().replace(/^"|"$/g, ""))
      .filter(Boolean);
  }
  return [];
}

async function querySeoPilotSlugs(): Promise<string[]> {
  const d = await db();
  const result = await d.execute(sql`
    SELECT p.slug AS slug,
           count(DISTINCT s.signal_date)::int AS tracked,
           count(DISTINCT CASE WHEN s.is_published THEN s.signal_date END)::int AS published
    FROM daily_signal s
    INNER JOIN project p ON p.id = s.project_id
    WHERE p.hidden = false
    GROUP BY p.slug
    HAVING count(DISTINCT s.signal_date) >= ${SEO_PILOT_MIN_POINTS}
  `);
  const rows = readRows(result).map((row) => ({
    slug: String(row.slug ?? ""),
    tracked: Number(row.tracked),
    published: Number(row.published),
  }));
  return selectSeoPilotSlugs(rows);
}

const loadSeoPilotSlugs = unstable_cache(querySeoPilotSlugs, ["seo-pilot-slugs"], { revalidate: 3600 });

export const getSeoPilotSlugSet = cache(async function getSeoPilotSlugSet(): Promise<Set<string>> {
  try {
    return new Set(await loadSeoPilotSlugs());
  } catch (error) {
    // The slug script and node:test have no Next incremental cache. The page
    // does, so the list is reused for an hour. React cache also collapses the
    // generateMetadata call and the page call into one read per render.
    // Callers only read the set.
    if (error instanceof Error && error.message.includes("incrementalCache missing")) {
      return new Set(await querySeoPilotSlugs());
    }
    throw error;
  }
});

/** Every stored 热度分 snapshot. Days without a finite score are dropped later. */
export async function getTrackedSignalHistory(projectId: string): Promise<RankingPoint[]> {
  const d = await db();
  const rows = await d
    .select({
      date: sql<string>`${dailySignal.signalDate}::text`,
      rank: dailySignal.rank,
      heatScore: dailySignal.heatScore,
      published: dailySignal.isPublished,
    })
    .from(dailySignal)
    .where(eq(dailySignal.projectId, projectId))
    .orderBy(asc(dailySignal.signalDate));
  return rows.map((row) => ({
    date: String(row.date),
    rank: row.rank,
    heatScore: row.heatScore,
    published: row.published,
  }));
}

export async function getSeoPeerCandidates(row: SeoProjectFields): Promise<SeoPeerCandidate[]> {
  const topics = (row.topics ?? []).map((topic) => topic.trim()).filter((topic) => topic.length >= 2 && topic.length <= 32);
  const clauses = [];
  if (row.language?.trim()) clauses.push(sql`p.language = ${row.language.trim()}`);
  if (row.primaryCategory?.trim()) clauses.push(sql`p.primary_category = ${row.primaryCategory.trim()}`);
  if (row.category?.trim()) clauses.push(sql`p.category::text = ${row.category.trim()}`);
  if (topics.length) {
    clauses.push(sql`p.topics && ARRAY[${sql.join(topics.map((topic) => sql`${topic}`), sql`, `)}]::text[]`);
  }
  if (!clauses.length) return [];

  const d = await db();
  const result = await d.execute(sql`
    SELECT slug, name, language, category, primary_category, topics, heat_score, signal_date
    FROM (
      SELECT p.slug AS slug,
             p.name AS name,
             p.language AS language,
             p.category::text AS category,
             p.primary_category AS primary_category,
             p.topics AS topics,
             s.heat_score AS heat_score,
             s.signal_date::text AS signal_date,
             row_number() OVER (PARTITION BY p.id ORDER BY s.signal_date DESC) AS rn
      FROM daily_signal s
      INNER JOIN project p ON p.id = s.project_id
      WHERE s.is_published = true
        AND p.id::text <> ${row.id}
        AND p.hidden = false
        AND p.parse_state = 'parsed'
        AND p.junk_reason IS NULL
        AND p.is_skill_collection = false
        AND p.duplicate_of IS NULL
        AND (${sql.join(clauses, sql` OR `)})
    ) ranked
    WHERE rn = 1
    LIMIT 80
  `);

  return readRows(result).map((item) => ({
    slug: String(item.slug ?? ""),
    name: item.name == null ? null : String(item.name),
    language: item.language == null ? null : String(item.language),
    category: item.category == null ? null : String(item.category),
    primaryCategory: item.primary_category == null ? null : String(item.primary_category),
    topics: asTopics(item.topics),
    heatScore: Number(item.heat_score),
    signalDate: String(item.signal_date ?? ""),
  }));
}

/**
 * Fields that change the history query, the peer query, or the section text.
 * A string key so metadata and the page share one read even when each holds
 * its own copy of the project row. The one-liner is applied later.
 */
function seoPilotFactsKey(row: SeoProjectFields): string {
  return JSON.stringify({
    id: row.id,
    slug: row.slug,
    language: row.language ?? null,
    category: row.category ?? null,
    primaryCategory: row.primaryCategory ?? null,
    topics: row.topics ?? null,
    tags: row.tags ?? null,
    license: row.license ?? null,
    projectKind: row.projectKind ?? null,
    description: row.description ?? null,
    readmeExcerpt: audienceReadmeExcerpt(row.readmeText),
  });
}

async function loadOrEmpty<T>(slug: string, label: string, run: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await run();
  } catch (error) {
    // A history or peer failure must not drop the audience block. The page
    // keeps the last good HTML when this function throws.
    console.error(`[seo-pilot] ${label} failed`, slug, error);
    return fallback;
  }
}

const loadSeoPilotFacts = cache(async function loadSeoPilotFacts(key: string) {
  const row = JSON.parse(key) as SeoProjectFields;
  const [points, candidates] = await Promise.all([
    loadOrEmpty(row.slug, "history", () => getTrackedSignalHistory(row.id), []),
    loadOrEmpty(row.slug, "peers", () => getSeoPeerCandidates(row), []),
  ]);
  const momentum = buildMomentumSection({ points });
  const peers = buildPeerSection(row, candidates);
  let audience = buildAudienceSection({});
  try {
    audience = buildAudienceSection({
      ...row,
      momentumShape: momentumShapeFromPoints(points),
      peers: audiencePeerHints(peers, candidates),
    });
  } catch (error) {
    console.error("[seo-pilot] audience failed", row.slug, error);
  }
  return { momentum, peers, audience };
});

/** Starts history + peers before the one-liner is ready. Same cache as the view. */
export function startSeoPilotFacts(row: SeoProjectFields) {
  try {
    return loadSeoPilotFacts(seoPilotFactsKey(row));
  } catch (error) {
    console.error("[seo-pilot] facts key failed", row.slug, error);
    const topics = Array.isArray(row.topics) ? row.topics : [];
    const tags = Array.isArray(row.tags) ? row.tags : [];
    return Promise.resolve({
      momentum: null,
      peers: null,
      audience: buildAudienceSection({
        language: row.language ?? null,
        topics,
        tags,
        description: row.description ?? null,
        license: row.license ?? null,
        projectKind: row.projectKind ?? null,
      }),
    });
  }
}

export const loadSeoPilotView = cache(async function loadSeoPilotView(row: SeoProjectFields, oneLinerZh?: string | null): Promise<SeoPilotView> {
  const facts = await startSeoPilotFacts(row);
  return {
    ...facts,
    metaDescription: seoPilotMetaDescription({ name: row.name, oneLiner: oneLinerZh, momentum: facts.momentum }),
  };
});
