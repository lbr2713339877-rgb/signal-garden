import { createHash } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { dailySignal, indexnowSubmission, project } from "@/db/schema";
import { signalDate } from "@/lib/day";
import { siteOrigin } from "@/lib/edition";
import { log, type JobResult } from "@/jobs/run";

export const INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow";

export interface IndexNowPayload {
  host: string;
  key: string;
  keyLocation: string;
  urlList: string[];
}

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** host, keyLocation and the daily URL list IndexNow should fetch. */
export function buildIndexNowPayload(input: { key: string; origin: string; newProjectSlugs: string[] }): IndexNowPayload {
  const origin = input.origin.replace(/\/+$/, "");
  const host = new URL(origin).host;
  const projects = input.newProjectSlugs.filter((slug) => SLUG.test(slug));
  return {
    host,
    key: input.key,
    keyLocation: `${origin}/${input.key}.txt`,
    urlList: [
      `${origin}/today`,
      ...projects.map((slug) => `${origin}/p/${slug}`),
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
 * POST the day's new project pages plus /today, / and /feed.xml.
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
  const payload = buildIndexNowPayload({ key, origin, newProjectSlugs: slugs });
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
