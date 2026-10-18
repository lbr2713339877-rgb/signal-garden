/**
 * Read layer. Pages import only from here, never from a driver or the schema
 * directly, so swapping Postgres in later touches this one directory.
 *
 * Every query that feeds a ranked surface filters out junk, collections and
 * duplicates by default — those flags exist precisely so a display call cannot
 * forget them.
 */

import { and, asc, desc, eq, gte, isNotNull, isNull, ne, or, sql, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { aiContent, dailySignal, externalMention, project, repoSnapshot, skill, userFeedback } from "@/db/schema";
import { FOCUS_MIN, type FocusTheme } from "@/normalizers/focus";
import { signalDate } from "@/lib/day";
import { TODAY_LIMIT } from "@/lib/edition";
import { catalogueTraction, interestingDiscovery } from '@/normalizers/discovery-policy';

/** Conditions a project must meet to appear on any public ranked surface. */
export function rankable() {
  return and(
    eq(project.hidden, false),
    eq(project.parseState, "parsed"),
    isNull(project.junkReason),
    eq(project.isSkillCollection, false),
    isNull(project.duplicateOf),
  );
}

/**
 * Readability gate for every user-facing list.
 *
 * A detail page leads with a hook + one-liner and then 3–5 capability
 * statements. If those are missing the page opens blank — exactly what readers
 * reported as "什么都没有". Lists must therefore only link to projects that
 * already have Chinese copy, so a card is never a dead end.
 */
export function hasCopy() {
  return sql`EXISTS (SELECT 1 FROM ${aiContent} c
      WHERE c.project_id = ${project.id} AND c.locale = 'zh' AND c.passed_guard
        AND c.one_liner IS NOT NULL AND btrim(c.one_liner) <> '')`;
}

export interface ProjectCard {
  id: string;
  slug: string;
  name: string;
  owner: string | null;
  fullName: string | null;
  primaryUrl: string;
  description: string | null;
  category: string | null;
  tags: string[];
  skillType: string;
  skillCount: number;
  hasSkillMd: boolean;
  isVerifiedSkill: boolean;
  supportedAgents: string[];
  difficulty: string | null;
  status: string;
  securityLevel: string;
  stars: number;
  focusThemes: string[];
  focusScore: number;
  oneLiner: string | null;
  oneLinerEn: string | null;
  /** V2: the line that makes someone stop, per language. */
  hook: string | null;
  hookEn: string | null;
  hookType: string | null;
  primaryCategory: string | null;
  secondaryCategory: string | null;
  previewImageUrl: string | null;
  homepageUrl?: string | null;
  isInteresting?: boolean;
  forks7d: number | null;
  stars24h: number | null;
  isRising: boolean;
  firstTrackedAt: string | null;
  heatScore: number | null;
  capabilities?: string[];
  capabilitiesEn?: string[];
  targetUsers?: string[];
  targetUsersEn?: string[];
  installCommands?: { kind: string; command: string; source: string }[] | null;
}

const CARD_COLUMNS = {
  id: project.id,
  slug: project.slug,
  name: project.name,
  owner: project.owner,
  fullName: project.fullName,
  primaryUrl: project.primaryUrl,
  description: project.description,
  category: project.category,
  tags: project.tags,
  skillType: project.skillType,
  skillCount: project.skillCount,
  hasSkillMd: project.hasSkillMd,
  isVerifiedSkill: project.isVerifiedSkill,
  supportedAgents: project.supportedAgents,
  difficulty: project.difficulty,
  status: project.status,
  securityLevel: project.securityLevel,
  stars: project.stars,
  focusThemes: project.focusThemes,
  focusScore: project.focusScore,
  primaryCategory: project.primaryCategory,
  secondaryCategory: project.secondaryCategory,
  previewImageUrl: project.previewImageUrl,
  homepageUrl: project.homepageUrl,
  isInteresting: interestingDiscovery(),
  forks7d: project.forks7d,
  stars24h: project.stars24h,
  isRising: project.isRising,
  firstTrackedAt: sql<string | null>`${project.firstTrackedAt}::text`,
  heatScore: project.heatScoreLatest,
  installCommands: project.installCommands,
};

/** Latest AI one-liner per project, joined in when present. */
async function withOneLiners(rows: any[]): Promise<ProjectCard[]> {
  if (!rows.length) return [];
  const d = await db();
  const ids = rows.map((r) => r.id);
  const content = await d
    .select({
      projectId: aiContent.projectId,
      locale: aiContent.locale,
      oneLiner: aiContent.oneLiner,
      hook: aiContent.hook,
      hookType: aiContent.hookType,
      capabilities: aiContent.capabilities,
      targetUsers: aiContent.targetUsers,
    })
    .from(aiContent)
    .where(inArray(aiContent.projectId, ids));

  const zh = new Map<string, any>();
  const en = new Map<string, any>();
  for (const c of content as any[]) (c.locale === "en" ? en : zh).set(c.projectId, c);

  return rows.map((r) => {
    const z = zh.get(r.id);
    const e = en.get(r.id);
    return {
      ...r,
      oneLiner: z?.oneLiner ?? null,
      oneLinerEn: e?.oneLiner ?? null,
      hook: z?.hook ?? null,
      hookEn: e?.hook ?? null,
      hookType: z?.hookType ?? e?.hookType ?? null,
      capabilities: z?.capabilities ?? [],
      capabilitiesEn: e?.capabilities ?? [],
      targetUsers: z?.targetUsers ?? [],
      targetUsersEn: e?.targetUsers ?? [],
    };
  }) as ProjectCard[];
}

/** Today's published edition. Quiet days never recycle earlier editions. */
export async function getTodaysSignals(limit = TODAY_LIMIT): Promise<{ date: string; cards: ProjectCard[] }> {
  const d = await db();
  const date = signalDate();
  const rows = await d
    .select({ ...CARD_COLUMNS, rank: dailySignal.rank, heatScore: dailySignal.heatScore })
    .from(dailySignal)
    .innerJoin(project, eq(dailySignal.projectId, project.id))
    .where(and(eq(dailySignal.signalDate, date), eq(dailySignal.isPublished, true), rankable()))
    .orderBy(dailySignal.rank)
    .limit(limit);
  return { date, cards: await withOneLiners(rows) };
}

/** Historical editions use their saved publication dates, ranks and scores. */
export async function getArchiveEditions(limit = 14): Promise<{ date: string; cards: ProjectCard[] }[]> {
  const d = await db();
  const dates = await d.selectDistinct({ date: dailySignal.signalDate }).from(dailySignal)
    .innerJoin(project, eq(dailySignal.projectId, project.id))
    .where(and(eq(dailySignal.isPublished, true), eq(project.hidden, false), sql`${dailySignal.signalDate} < ${signalDate()}::date`))
    .orderBy(desc(dailySignal.signalDate)).limit(limit);
  if (!dates.length) return [];
  const rows = await d.select({ ...CARD_COLUMNS, date: dailySignal.signalDate, rank: dailySignal.rank, heatScore: dailySignal.heatScore })
    .from(dailySignal).innerJoin(project, eq(project.id, dailySignal.projectId))
    .where(and(inArray(dailySignal.signalDate, dates.map((r) => r.date)), eq(dailySignal.isPublished, true), eq(project.hidden, false)))
    .orderBy(desc(dailySignal.signalDate), dailySignal.rank);
  const cards = await withOneLiners(rows);
  return dates.map(({ date }) => ({ date, cards: cards.filter((_, i) => rows[i].date === date) }));
}

/** Keep the last published edition readable until a new one is published.
 * This is a display fallback only: it never writes old projects into today's ranking.
 */
export async function getCurrentEdition(limit = TODAY_LIMIT): Promise<{ date: string; cards: ProjectCard[]; isPrevious: boolean }> {
  const today = await getTodaysSignals(limit);
  if (today.cards.length) return { ...today, isPrevious: false };
  const previous = (await getArchiveEditions(1))[0];
  return previous
    ? { date: previous.date, cards: previous.cards.slice(0, limit), isPrevious: true }
    : { ...today, isPrevious: false };
}

/** Published edition for the homepage, /today and /feed.xml. */
export async function getFeedEdition(limit = TODAY_LIMIT): Promise<{
  date: string;
  publishedAt: Date | null;
  cards: ProjectCard[];
  isPrevious: boolean;
}> {
  const edition = await getCurrentEdition(limit);
  if (!edition.cards.length) return { ...edition, publishedAt: null };

  const d = await db();
  const [stamp] = await d
    .select({ publishedAt: sql<string | null>`max(${dailySignal.createdAt})` })
    .from(dailySignal)
    .where(and(eq(dailySignal.signalDate, edition.date), eq(dailySignal.isPublished, true)));
  const publishedAt = stamp?.publishedAt ? new Date(stamp.publishedAt) : null;
  return {
    date: String(edition.date),
    publishedAt: publishedAt && !Number.isNaN(publishedAt.getTime()) ? publishedAt : null,
    cards: edition.cards.slice(0, limit),
    isPrevious: edition.isPrevious,
  };
}

/** Batch lookup used by account pages (saved / followed) so they render names and slugs, not UUIDs. */
export async function getProjectsByIds(ids: string[]) {
  if (!ids.length) return [];
  const d = await db();
  return d
    .select({
      id: project.id,
      slug: project.slug,
      name: project.name,
      owner: project.owner,
      category: project.category,
      primaryCategory: project.primaryCategory,
      secondaryCategory: project.secondaryCategory,
      stars: project.stars,
    })
    .from(project)
    .where(and(inArray(project.id, ids), rankable()));
}

export async function getProjectBySlug(slug: string) {
  const d = await db();
  const [row] = await d.select().from(project).where(eq(project.slug, slug)).limit(1);
  if (!row || row.hidden) return null;
  const skills = await d
    .select()
    .from(skill)
    .where(eq(skill.projectId, row.id))
    .orderBy(desc(skill.isVerifiedSkill), skill.name);
  const [content] = await d.select().from(aiContent).where(eq(aiContent.projectId, row.id)).limit(1);
  const mentions = await d
    .select()
    .from(externalMention)
    .where(eq(externalMention.projectId, row.id))
    .orderBy(desc(externalMention.publishedAt))
    .limit(10);
  const history = await d
    .select({ capturedAt: repoSnapshot.capturedAt, stars: repoSnapshot.stars, forks: repoSnapshot.forks })
    .from(repoSnapshot)
    .where(eq(repoSnapshot.projectId, row.id))
    .orderBy(repoSnapshot.capturedAt)
    .limit(180);
  return { project: row, skills, content: content ?? null, mentions, history };
}

export async function getFocusCounts(): Promise<Record<string, number>> {
  const d = await db();
  // Same conditions as rankable(): the count must match the list it labels.
  const rows = await d.execute(
    sql`SELECT t AS theme, count(*)::int AS n FROM project, unnest(focus_themes) t
        WHERE parse_state = 'parsed' AND NOT hidden AND junk_reason IS NULL
          AND NOT is_skill_collection AND duplicate_of IS NULL
        GROUP BY 1 ORDER BY 2 DESC`,
  );
  const out: Record<string, number> = {};
  for (const r of ((rows as any).rows ?? []) as any[]) out[r.theme] = r.n;
  return out;
}

export async function getProjectsByTheme(theme: FocusTheme, limit = 40): Promise<ProjectCard[]> {
  const d = await db();
  const rows = await d
    .select(CARD_COLUMNS)
    .from(project)
    .where(and(rankable(), hasCopy(), sql`${theme} = ANY(${project.focusThemes})`))
    .orderBy(desc(project.focusScore), desc(project.stars))
    .limit(limit);
  return withOneLiners(rows);
}

export async function getCategoryCounts(): Promise<{ category: string; n: number }[]> {
  const d = await db();
  const rows = await d
    .select({ category: project.category, n: sql<number>`count(*)::int` })
    .from(project)
    .where(and(rankable(), hasCopy(), isNotNull(project.category)))
    .groupBy(project.category)
    .orderBy(desc(sql`count(*)`));
  return rows as any;
}

export async function getProjectsByCategory(category: string, limit = 40): Promise<ProjectCard[]> {
  const d = await db();
  const rows = await d
    .select(CARD_COLUMNS)
    .from(project)
    .where(and(rankable(), hasCopy(), eq(project.category, category as any)))
    .orderBy(desc(project.focusScore), desc(project.stars))
    .limit(limit);
  return withOneLiners(rows);
}

export async function getSkillsForProject(projectId: string) {
  const d = await db();
  return d.select().from(skill).where(eq(skill.projectId, projectId)).orderBy(skill.name);
}

export interface ProjectSearchFilters {
  cat?: string;
  difficulty?: string;
  agent?: string;
  security?: string;
  offset?: number;
}

/** All constraints apply in SQL before paging; Chinese editorial copy is searchable. */
export async function searchProjects(q: string, limit = 40, filters: ProjectSearchFilters = {}): Promise<ProjectCard[]> {
  const d = await db();
  const query = q.trim();
  const like = `%${query.replace(/[\\%_]/g, "\\$&")}%`;
  const rows = await d.select(CARD_COLUMNS).from(project).where(and(
    rankable(), hasCopy(),
    filters.cat ? eq(project.primaryCategory, filters.cat) : undefined,
    filters.difficulty ? sql`${project.difficulty}::text = ${filters.difficulty}` : undefined,
    filters.agent ? sql`${filters.agent} = ANY(${project.supportedAgents})` : undefined,
    filters.security ? sql`${project.securityLevel}::text = ${filters.security}` : undefined,
    query ? or(
      sql`${project.name} ILIKE ${like}`,
      sql`${project.fullName} ILIKE ${like}`,
      sql`${project.description} ILIKE ${like}`,
      sql`${project.readmeText} ILIKE ${like}`,
      sql`${project.topics} && ARRAY[${query.toLowerCase()}]::text[]`,
      sql`EXISTS (SELECT 1 FROM ${aiContent} c WHERE c.project_id = ${project.id}
        AND (c.one_liner ILIKE ${like} OR c.capabilities::text ILIKE ${like}))`,
    ) : undefined,
  )).orderBy(desc(project.focusScore), desc(project.stars), project.id)
    .limit(Math.min(Math.max(limit, 1), 100)).offset(Math.max(0, filters.offset ?? 0));
  return withOneLiners(rows);
}

/** Data-source health for /status. */
export async function getSourceHealth(limit = 12) {
  const d = await db();
  const { dataSourceHealth, jobRun } = await import("@/db/schema");
  const sources = await d.select().from(dataSourceHealth);
  const runs = await d.select().from(jobRun).orderBy(desc(jobRun.startedAt)).limit(limit);
  const [latestFailed] = await d
    .select()
    .from(jobRun)
    .where(eq(jobRun.status, "failed"))
    .orderBy(desc(jobRun.startedAt))
    .limit(1);
  return { sources, runs, latestFailed: latestFailed ?? null };
}

export { project, skill, dailySignal, aiContent };


/* ===========================================================================
   V2 queries
   ======================================================================== */

/**
 * A project may be shown only if it cleared the editorial floor. Rows whose
 * growth has never been measured are excluded rather than assumed good: the
 * gate exists to keep unqualified projects off every user-visible page
 * (acceptance criterion 4).
 */
export function gated() {
  return and(
    rankable(),
    hasCopy(),
    catalogueTraction(),
    sql`(${project.projectKind} = 'repo' OR ${project.linkStatus} = 'ok')`,
  );
}

/** The day's headline: the single item the homepage leads with. */
export async function getHeadline(): Promise<ProjectCard | null> {
  const { cards } = await getTodaysSignals(1);
  return cards[0] ?? null;
}

/** Feature cards follow the same published edition as the headline. */
export async function getFeatures(limit = 6, excludeId?: string): Promise<ProjectCard[]> {
  const { cards } = await getTodaysSignals(limit + (excludeId ? 1 : 0));
  return cards.filter((card) => card.id !== excludeId).slice(0, limit);
}

export type SortKey = "heat" | "growth" | "newest";

/**
 * Category listing. V2 §5 requires a second level and a sort control, so a
 * category page is never a single undifferentiated column.
 */
export async function getByTaxonomy(
  primary: string,
  opts: { secondary?: string | null; sort?: SortKey; limit?: number; offset?: number; interesting?: boolean } = {},
): Promise<ProjectCard[]> {
  const d = await db();
  const limit = opts.limit ?? 48;

  const order =
    opts.sort === "growth"
      ? [desc(sql`coalesce(${project.forks7d}, 0)`), desc(project.stars)]
      : opts.sort === "newest"
        ? [desc(project.firstTrackedAt), desc(project.stars)]
        : [desc(project.heatScoreLatest), desc(project.stars)];

  const rows = await d
    .select(CARD_COLUMNS)
    .from(project)
    .where(
      and(
        gated(),
        eq(project.primaryCategory, primary),
        opts.secondary ? eq(project.secondaryCategory, opts.secondary) : sql`true`,
        opts.interesting ? interestingDiscovery() : sql`true`,
      ),
    )
    .orderBy(...order, asc(project.id))
    .limit(limit).offset(opts.offset ?? 0);
  return withOneLiners(rows);
}

/** Counts per primary, and per second level within a primary. */
export async function getTaxonomyCounts(primary?: string) {
  const d = await db();
  const key = primary ? project.secondaryCategory : project.primaryCategory;
  return d.select({ k: sql<string>`${key}`, n: sql<number>`count(*)::int` }).from(project)
    .where(and(gated(), primary ? eq(project.primaryCategory, primary) : sql`true`))
    .groupBy(key).orderBy(desc(sql`count(*)`));
}

export async function getInterestingDiscoveries(limit = 120): Promise<ProjectCard[]> {
  const d = await db();
  const rows = await d.select(CARD_COLUMNS).from(project).where(and(gated(), interestingDiscovery()))
    .orderBy(desc(project.firstTrackedAt), desc(project.heatScoreLatest)).limit(limit);
  return withOneLiners(rows);
}

/** Projects that were tracked before they qualified (V2 §2 回溯机制). */
export async function getRising(limit = 12): Promise<ProjectCard[]> {
  const d = await db();
  const rows = await d
    .select(CARD_COLUMNS)
    .from(project)
    .where(and(gated(), eq(project.isRising, true)))
    .orderBy(desc(project.forks7d), desc(project.stars))
    .limit(limit);
  return withOneLiners(rows);
}

/** Bilingual copy for one project, used by the detail page. */
export async function getProjectCopy(projectId: string) {
  const d = await db();
  const rows = await d.select().from(aiContent).where(eq(aiContent.projectId, projectId));
  return {
    zh: (rows as any[]).find((r) => r.locale === "zh") ?? null,
    en: (rows as any[]).find((r) => r.locale === "en") ?? null,
  };
}


export type FeedbackKind =
  | "dead_link"
  | "wrong_category"
  | "inaccurate_desc"
  | "security_risk"
  | "unmaintained";

/** Queues user feedback for review. It never mutates public content directly. */
export async function createFeedback(input: {
  slug: string;
  kind: FeedbackKind;
  note?: string | null;
}) {
  const d = await db();
  const [p] = await d
    .select({ id: project.id })
    .from(project)
    .where(eq(project.slug, input.slug))
    .limit(1);
  if (!p) return null;

  const [row] = await d
    .insert(userFeedback)
    .values({
      projectId: p.id,
      kind: input.kind,
      note: input.note?.trim() ? input.note.trim().slice(0, 1200) : null,
    })
    .returning({ id: userFeedback.id, createdAt: userFeedback.createdAt });

  return row ?? null;
}

export async function getPendingFeedbackCount(): Promise<number> {
  const d = await db();
  const [row] = await d
    .select({ n: sql<number>`count(*)::int` })
    .from(userFeedback)
    .where(eq(userFeedback.status, "pending"));
  return row?.n ?? 0;
}

/**
 * 分类空间用的代表项目 owner —— 用于 GitHub 头像拼贴墙。
 *
 * 为什么用 owner 头像而不是插画：头像是这个分类下**真实存在**的项目的
 * 标志，比通用主题插画更能说明"今天有人在用的 AI 产品"。而且 GitHub 的
 * 头像地址是公开的图片 CDN，既不需要 API key，也不涉及抓取别人网站。
 *
 * 按 star 倒序取，所以墙上的都是该分类里最受关注的那批。
 */
/**
 * Published project count per primary category, using the same `gated()` rules
 * as the category page. The category space used to label itself with the size
 * of its avatar wall (capped at 12), which read as "12 representative projects"
 * forever — a number that had nothing to do with how many are actually listed.
 */
export async function getCategorySpaceCounts(): Promise<Record<string, number>> {
  const d = await db();
  const rows = await d
    .select({ category: project.primaryCategory, n: sql<number>`count(*)::int` })
    .from(project)
    .where(and(gated(), isNotNull(project.primaryCategory)))
    .groupBy(project.primaryCategory);
  const out: Record<string, number> = {};
  for (const r of rows as any[]) if (r.category) out[r.category] = r.n;
  return out;
}

export async function getCategoryOwners(
  category: string,
  limit = 12,
): Promise<{ owner: string; name: string; slug: string }[]> {
  const d = await db();
  const rows = await d
    .select({ owner: project.owner, name: project.name, slug: project.slug, stars: project.stars })
    .from(project)
    .where(and(gated(), eq(project.primaryCategory, category), isNotNull(project.owner)))
    .orderBy(desc(project.stars))
    .limit(limit * 2);

  // 同一个 owner 只出现一次
  const seen = new Set<string>();
  const out: { owner: string; name: string; slug: string }[] = [];
  for (const r of rows) {
    if (!r.owner || seen.has(r.owner)) continue;
    seen.add(r.owner);
    out.push({ owner: r.owner, name: r.name, slug: r.slug });
    if (out.length >= limit) break;
  }
  return out;
}

/**
 * 项目的外部讨论条目 —— 详情页的"真实评价"模块用。
 *
 * external_mention 表是给 Hacker News / Product Hunt 这类来源预留的。目前
 * 采集器还没有写入这张表，所以调用方必须处理空数组的情况，并如实说明
 * "还没有采集到外部讨论"，而不是填示例数据冒充真实评价。
 */
export async function getProjectMentions(projectId: string, limit = 5) {
  const d = await db();
  return d
    .select()
    .from(externalMention)
    .where(eq(externalMention.projectId, projectId))
    .orderBy(desc(externalMention.publishedAt))
    .limit(limit);
}
