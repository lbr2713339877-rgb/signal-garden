import { sql } from "drizzle-orm";
import type { Database } from "@/db/client";

const DAY_MS = 86_400_000;

export interface StarAnchor {
  capturedAt: Date;
  stars: number;
}

/**
 * Star history the scorers actually use.
 *
 * `starsAt` / `starDelta` keep the newest snapshot at or before 1 day and
 * 7 days. Spike detection uses only the oldest and newest snapshot. The
 * points in between never change a score, and `repo_snapshot` is large
 * enough that shipping every row through the pooler is the expensive part.
 */
export async function loadStarAnchors(
  d: Pick<Database, "execute">,
  ids: string[],
  now: number,
): Promise<Map<string, StarAnchor[]>> {
  const map = new Map<string, StarAnchor[]>();
  if (!ids.length) return map;
  const day = new Date(now - DAY_MS);
  const week = new Date(now - 7 * DAY_MS);
  const result = await d.execute(sql`
    SELECT project_id, captured_at, stars FROM (
      SELECT DISTINCT ON (project_id) project_id, captured_at, stars
      FROM repo_snapshot WHERE project_id IN ${ids}
      ORDER BY project_id, captured_at ASC, id ASC
    ) oldest
    UNION
    SELECT project_id, captured_at, stars FROM (
      SELECT DISTINCT ON (project_id) project_id, captured_at, stars
      FROM repo_snapshot WHERE project_id IN ${ids}
      ORDER BY project_id, captured_at DESC, id DESC
    ) newest
    UNION
    SELECT project_id, captured_at, stars FROM (
      SELECT DISTINCT ON (project_id) project_id, captured_at, stars
      FROM repo_snapshot WHERE project_id IN ${ids} AND captured_at <= ${day}
      ORDER BY project_id, captured_at DESC, id DESC
    ) day_ago
    UNION
    SELECT project_id, captured_at, stars FROM (
      SELECT DISTINCT ON (project_id) project_id, captured_at, stars
      FROM repo_snapshot WHERE project_id IN ${ids} AND captured_at <= ${week}
      ORDER BY project_id, captured_at DESC, id DESC
    ) week_ago
  `);
  for (const row of readRows(result)) {
    const projectId = String(row.project_id);
    const capturedAt = new Date(row.captured_at as string);
    const stars = Number(row.stars);
    const list = map.get(projectId) ?? [];
    list.push({ capturedAt, stars });
    map.set(projectId, list);
  }
  return map;
}

function readRows(result: unknown): Record<string, unknown>[] {
  if (Array.isArray(result)) return result.filter((row) => row && typeof row === "object") as Record<string, unknown>[];
  if (result && typeof result === "object" && Array.isArray((result as { rows?: unknown }).rows)) {
    return (result as { rows: Record<string, unknown>[] }).rows;
  }
  return [];
}
