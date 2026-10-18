/**
 * Refocus: recompute every project's editorial focus from stored data.
 *
 * Exists because tuning the focus patterns should not require re-crawling
 * GitHub — the README and SKILL.md texts are already in the database.
 *
 *   pnpm job refocus
 *
 * ── Performance (2026-10-03) ────────────────────────────────────────────────
 * The first live run issued one UPDATE per project (5,514 round trips over the
 * Hong Kong → Seoul pooler ≈ 5 minutes). The computation is pure CPU, so we
 * now build every row in memory and flush with a single set-based UPDATE keyed
 * on (id, focus_score, focus_themes, focus_evidence). Focus is idempotent, so
 * rewriting unchanged rows is wasted work — only rows whose values moved are
 * written, and never one round trip at a time.
 */

import { sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { project } from "@/db/schema";
import { parseFocus } from "@/normalizers/focus-parse";
import { chunk } from "@/lib/concurrency";
import { log, type JobResult } from "./run";

const UPDATE_CHUNK = 500;

export async function refocus(): Promise<JobResult> {
  const { db } = await getDb();

  const rows = await db
    .select({
      id: project.id,
      name: project.name,
      description: project.description,
      topics: project.topics,
      readmeText: project.readmeText,
      discoveryQueries: project.discoveryQueries,
      skillCount: project.skillCount,
      focusScore: project.focusScore,
      focusThemes: project.focusThemes,
    })
    .from(project);

  log("refocus", `${rows.length} projects`);

  const skillsByProject = new Map<string, string[]>();
  for (const ids of chunk(rows.map((r: any) => r.id as string), 400)) {
    const srows = await db.execute(
      sql`SELECT project_id, coalesce(name,'') || ' ' || coalesce(description,'') AS text FROM skill WHERE project_id IN ${ids}`,
    );
    for (const s of ((srows as any).rows ?? []) as any[]) {
      const list = skillsByProject.get(s.project_id) ?? [];
      list.push(s.text);
      skillsByProject.set(s.project_id, list);
    }
  }

  let inFocus = 0;
  let touched = 0;
  const perTheme: Record<string, number> = {};
  const pending: { id: string; themes: string[]; score: number; evidence: unknown }[] = [];

  for (const r of rows) {
    const f = parseFocus({
      name: r.name,
      description: r.description,
      topics: r.topics ?? [],
      readme: r.readmeText,
      skillTexts: skillsByProject.get(r.id),
      queries: r.discoveryQueries ?? [],
    });
    if (f.inFocus) {
      inFocus++;
      for (const t of f.themes) perTheme[t] = (perTheme[t] ?? 0) + 1;
    }

    const unchanged =
      r.focusScore === f.score &&
      sameArray(r.focusThemes ?? [], f.themes);
    if (unchanged) continue;

    touched++;
    pending.push({ id: r.id, themes: f.themes, score: f.score, evidence: f.evidence });
  }

  for (const part of chunk(pending, UPDATE_CHUNK)) {
    const values = part.map(
      (p) =>
        sql`(${p.id}::uuid, ${p.score}::int, ${sql.raw(`ARRAY[${p.themes.map((t) => `'${t.replace(/'/g, "''")}'`).join(",")}]::text[]`)}, ${JSON.stringify(p.evidence)}::jsonb, now())`,
    );
    await db.execute(sql`
      UPDATE project AS p
      SET focus_score = v.score,
          focus_themes = v.themes,
          focus_evidence = v.evidence,
          updated_at = v.updated_at
      FROM (VALUES ${sql.join(values, sql`, `)}) AS v(id, score, themes, evidence, updated_at)
      WHERE p.id = v.id
    `);
  }

  log("refocus", `${inFocus} in focus of ${rows.length} · ${touched} changed · ${JSON.stringify(perTheme)}`);
  return { itemsIn: rows.length, itemsOut: inFocus, meta: { perTheme, changed: touched } };
}

/** Order-insensitive array comparison; themes are stored sorted by parseFocus. */
function sameArray(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}
