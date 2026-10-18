import { aliasedTable, sql } from "drizzle-orm";
import { dailySignal, project } from "@/db/schema";

/** Every identity matters: a website and its repository are one discovery. */
export function exposureKeys(p: typeof project = project) {
  const repo = sql`nullif(regexp_replace(substring(lower(${p.primaryUrl}) from 'github[.]com[/:]([a-z0-9_.-]+/[a-z0-9_.-]+)'), '[.]git$', ''), '')`;
  const host = sql`nullif(split_part(split_part(split_part(split_part(
    regexp_replace(lower(coalesce(nullif(${p.domain}, ''), nullif(${p.homepageUrl}, ''),
      CASE WHEN ${p.projectKind} <> 'repo' THEN ${p.primaryUrl} ELSE '' END)),
      '^([a-z][a-z0-9+.-]*://)?(www[.])?', ''), '/', 1), '?', 1), '#', 1), ':', 1), '')`;
  return sql<string[]>`array_remove(ARRAY[
    'id:' || ${p.id}::text,
    'canonical:' || nullif(lower(${p.canonicalProjectId}), ''),
    'github:' || nullif(${p.githubNodeId}, ''),
    'repo:' || ${repo},
    CASE WHEN ${host} LIKE '%.%'
      AND ${host} NOT IN ('github.com', 'github.io', 'npmjs.com', 'pypi.org', 'linkedin.com',
        'youtube.com', 'youtu.be', 'x.com', 'twitter.com', 'discord.gg', 'discord.com', 'huggingface.co')
      AND ${host} NOT LIKE '%.github.io' AND ${host} NOT LIKE '%.github.com'
      THEN 'domain:' || ${host} END
  ], NULL)`;
}

/** Only actual publications before this edition count; today's reruns are safe. */
export function notPreviouslyFeatured(date: string) {
  const previous = aliasedTable(project, "previous_feature");
  return sql<boolean>`NOT EXISTS (
    SELECT 1 FROM ${dailySignal} s
    JOIN ${project} AS ${sql.identifier("previous_feature")} ON ${previous.id} = s.project_id
    WHERE s.is_published AND s.signal_date < ${date}::date
      AND ${exposureKeys(previous)} && ${exposureKeys(project)}
  )`;
}
