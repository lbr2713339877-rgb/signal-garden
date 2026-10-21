import { createHash } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { dailySignal, indexnowSubmission, project } from "@/db/schema";
import { signalDate } from "@/lib/day";
import { siteOrigin } from "@/lib/edition";
import { publicWeeklyIssues, type PublicWeeklyIssue } from "@/lib/weekly-sample";
import { log, type JobResult } from "@/jobs/run";

export const INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow";

export interface IndexNowPayload {
  host: string;
  key: string;
  keyLocation: string;
  urlList: string[];
}

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Latest public issue, plus any issue whose page went live on `date`.
 * The same number is returned once.
 */
export function weeklyIssuesForIndexNow(issues: PublicWeeklyIssue[], date: string): number[] {
  const valid = issues.filter((issue) => Number.isInteger(issue.number) && issue.number > 0);
  if (!valid.length) return [];
  const latest = Math.max(...valid.map((issue) => issue.number));
  const fresh = valid.filter((issue) => issue.publishedOn === date).map((issue) => issue.number);
  return [...new Set([latest, ...fresh])].sort((a, b) => a - b);
}

function weeklyPaths(origin: string, issues: number[]): string[] {
  return [...new Set(issues.filter((n) => Number.isInteger(n) && n > 0))]
    .sort((a, b) => a - b)
    .map((n) => `${origin}/weekly/${n}`);
}

/** host, keyLocation and the daily URL list IndexNow should fetch. */
export function buildIndexNowPayload(input: {
  key: string;
  origin: string;
  newProjectSlugs: string[];
  /** Issue numbers for /weekly/<n>. Omitted means the latest public issue. */
  weeklyIssues?: number[];
}): IndexNowPayload {
  const origin = input.origin.replace(/\/+$/, "");
  const host = new URL(origin).host;
  const projects = input.newProjectSlugs.filter((slug) => SLUG.test(slug));
  const weekly = input.weeklyIssues ?? weeklyIssuesForIndexNow(publicWeeklyIssues(), "");
  return {
    host,
    key: input.key,
    keyLocation: `${origin}/${input.key}.txt`,
    urlList: [
      `${origin}/today`,
      ...projects.map((slug) => `${origin}/p/${slug}`),
      ...weeklyPaths(origin, weekly),
      `${origin}/`,
      `${origin}/feed.xml`,
    ],
  };
}

export function indexNowPayloadHash(payload: IndexNowPayload): string {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

/** Projects whose first published edition is this date. */
export async function newlyPublishedSlugs(date: string): Promise<string[]> {
  const d = await db();
  const rows = await d
    .select({ slug: project.slug, rank: dailySignal.rank })
    .from(dailySignal)
    .innerJoin(project, eq(project.id, dailySignal.projectId))
    .where(and(
      eq(dailySignal.signalDate, date),
      eq(dailySignal.isPublished, true),
      eq(project.hidden, false),
      sql`NOT EXISTS (
        SELECT 1 FROM daily_signal earlier
        WHERE earlier.project_id = ${dailySignal.projectId}
          AND earlier.is_published = true
          AND earlier.signal_date < ${dailySignal.signalDate}
      )`,
    ))
    .orderBy(dailySignal.rank);
  return rows.map((row) => row.slug);
}

/**
 * POST the day's new project pages plus /today, /weekly/<n>, / and /feed.xml.
 * Weekly URLs are the latest issue and any issue published on this signal date.
 * A missing key is a no-op. The same payload is not sent twice that day.
 */
export async function submitIndexNow(opts: {
  key?: string;
  origin?: string;
  now?: Date;
  fetchImpl?: typeof fetch;
} = {}): Promise<JobResult> {
  const key = (opts.key ?? process.env.INDEXNOW_KEY ?? "").trim();
  if (!key) {
    log("indexnow", "INDEXNOW_KEY unset; skipping");
    return { itemsIn: 0, itemsOut: 0, meta: { skipped: "no-key" } };
  }
  const date = signalDate(opts.now);
  const origin = (opts.origin ?? siteOrigin()).replace(/\/+$/, "");
  const slugs = await newlyPublishedSlugs(date);
  const payload = buildIndexNowPayload({
    key,
    origin,
    newProjectSlugs: slugs,
    weeklyIssues: weeklyIssuesForIndexNow(publicWeeklyIssues(), date),
  });
  const hash = indexNowPayloadHash(payload);
  const d = await db();
  const [seen] = await d.select({ status: indexnowSubmission.status }).from(indexnowSubmission)
    .where(and(eq(indexnowSubmission.day, date), eq(indexnowSubmission.payloadHash, hash)))
    .limit(1);
  if (seen) {
    log("indexnow", `already submitted ${payload.urlList.length} urls (status ${seen.status})`);
    return { itemsIn: payload.urlList.length, itemsOut: 0, meta: { skipped: "duplicate", urls: payload.urlList } };
  }
  const fetchImpl = opts.fetchImpl ?? fetch;
  const response = await fetchImpl(INDEXNOW_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify(payload),
  });
  const body = await response.text();
  log("indexnow", `POST ${INDEXNOW_ENDPOINT} status=${response.status} urls=${payload.urlList.length} body=${body.slice(0, 180)}`);
  if (response.status !== 200 && response.status !== 202) {
    throw new Error(`[indexnow] ${response.status} ${body.slice(0, 180)}`);
  }
  await d.insert(indexnowSubmission).values({
    day: date,
    payloadHash: hash,
    status: response.status,
    urlCount: payload.urlList.length,
  }).onConflictDoNothing();
  return { itemsIn: payload.urlList.length, itemsOut: payload.urlList.length, meta: { status: response.status, urls: payload.urlList } };
}

/** Tell IndexNow about /p URLs whose slug just changed. No-op without a key. */
export async function pingRenamedProjectSlugs(
  slugs: string[],
  opts: { key?: string; origin?: string; fetchImpl?: typeof fetch } = {},
): Promise<void> {
  const unique = [...new Set(slugs.filter((slug) => SLUG.test(slug)))];
  if (!unique.length) return;
  const key = (opts.key ?? process.env.INDEXNOW_KEY ?? "").trim();
  if (!key) {
    log("indexnow", "INDEXNOW_KEY unset; skipping rename ping");
    return;
  }
  const origin = (opts.origin ?? siteOrigin()).replace(/\/+$/, "");
  const payload: IndexNowPayload = {
    host: new URL(origin).host,
    key,
    keyLocation: `${origin}/${key}.txt`,
    urlList: unique.map((slug) => `${origin}/p/${slug}`),
  };
  try {
    const hash = indexNowPayloadHash(payload);
    const d = await db();
    const day = signalDate();
    const [seen] = await d.select({ status: indexnowSubmission.status }).from(indexnowSubmission)
      .where(and(eq(indexnowSubmission.day, day), eq(indexnowSubmission.payloadHash, hash)))
      .limit(1);
    if (seen) {
      log("indexnow", `rename ping already submitted (${unique.length} urls)`);
      return;
    }
    const fetchImpl = opts.fetchImpl ?? fetch;
    const response = await fetchImpl(INDEXNOW_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json; charset=utf-8" },
      body: JSON.stringify(payload),
    });
    const body = await response.text();
    log("indexnow", `rename POST status=${response.status} urls=${unique.length} body=${body.slice(0, 180)}`);
    if (response.status !== 200 && response.status !== 202) return;
    await d.insert(indexnowSubmission).values({
      day,
      payloadHash: hash,
      status: response.status,
      urlCount: unique.length,
    }).onConflictDoNothing();
  } catch (error) {
    log("indexnow", `rename ping failed: ${error instanceof Error ? error.message : "unknown"}`);
  }
}
