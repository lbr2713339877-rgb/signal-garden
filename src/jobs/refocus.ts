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
 *
 * A later pass stopped shipping every README on every daily run. The scorer
 * only reads the first FOCUS_TEXT_BUDGET characters, and a row whose inputs
 * and focus rules are unchanged is skipped entirely. The rules token is part
 * of that key, so editing a pattern still recomputes the catalogue once.
 */

import { inArray, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { project } from "@/db/schema";
import { fingerprint } from "@/normalizers/fingerprint";
import { FOCUS_MIN, FOCUS_TEXT_BUDGET, PATTERNS, TOPICS } from "@/normalizers/focus";
import { parseFocus } from "@/normalizers/focus-parse";
import { chunk } from "@/lib/concurrency";
import { log, type JobResult } from "./run";

const UPDATE_CHUNK = 500;

/** Changes when the focus rules change, so a pattern edit is not skipped. */
export const FOCUS_RULES_TOKEN = fingerprint({
  min: FOCUS_MIN,
  topics: TOPICS,
  patterns: Object.fromEntries(
    Object.entries(PATTERNS).map(([theme, regs]) => [theme, regs.map((r) => `${r.source}/${r.flags}`)]),
  ),
});

export function focusInputToken(input: {
  readmeHash: string | null;
  name: string;
  description: string | null;
  topics: readonly string[] | null;
  queries: readonly string[] | null;
  skillDigest: string | null;
}): string {
  return fingerprint({
    rules: FOCUS_RULES_TOKEN,
    readmeHash: input.readmeHash,
    name: input.name,
    description: input.description,
    topics: [...(input.topics ?? [])].sort(),
    queries: [...(input.queries ?? [])].sort(),
    skillDigest: input.skillDigest,
  });
}

export function storedFocusInput(evidence: unknown): string | null {
  if (!evidence || typeof evidence !== "object") return null;
  const value = (evidence as Record<string, unknown>)._input;
  if (Array.isArray(value) && typeof value[0] === "string" && value[0]) return value[0];
  return null;
}

export async function refocus(): Promise<JobResult> {
  const { db } = await getDb();

  const rows = await db
    .select({
      id: project.id,
      name: project.name,
      description: project.description,
      topics: project.topics,
      readmeHash: project.readmeHash,
      discoveryQueries: project.discoveryQueries,
      focusScore: project.focusScore,
      focusThemes: project.focusThemes,
      focusEvidence: project.focusEvidence,
    })
    .from(project);

  const skillDigest = new Map<string, string>();
  const digests = await db.execute(sql`
    SELECT project_id, md5(string_agg(coalesce(name, '') || ' ' || coalesce(description, ''), '|' ORDER BY name)) AS digest
    FROM skill
    GROUP BY project_id
  `);
  for (const row of readRows(digests)) {
    if (row.project_id && row.digest) skillDigest.set(String(row.project_id), String(row.digest));
  }

  log("refocus", `${rows.length} projects`);

  const stale: typeof rows = [];
  let inFocus = 0;
  const perTheme: Record<string, number> = {};
  for (const r of rows) {
    const token = focusInputToken({
      readmeHash: r.readmeHash,
      name: r.name,
      description: r.description,
      topics: r.topics,
      queries: r.discoveryQueries,
      skillDigest: skillDigest.get(r.id) ?? null,
    });
    if (storedFocusInput(r.focusEvidence) === token) {
      if (r.focusScore >= FOCUS_MIN) {
        inFocus++;
        for (const t of r.focusThemes ?? []) perTheme[t] = (perTheme[t] ?? 0) + 1;
      }
      continue;
    }
    stale.push(r);
  }

  const readmes = new Map<string, string | null>();
  const skillsByProject = new Map<string, string[]>();
  for (const ids of chunk(stale.map((r) => r.id), 40)) {
    const loaded = await db
      .select({
        id: project.id,
        readmeText: sql<string | null>`left(${project.readmeText}, ${FOCUS_TEXT_BUDGET})`,
      })
      .from(project)
      .where(inArray(project.id, ids));
    for (const row of loaded) readmes.set(row.id, row.readmeText);
  }
  for (const ids of chunk(stale.map((r) => r.id), 400)) {
    const srows = await db.execute(
      sql`SELECT project_id, coalesce(name,'') || ' ' || coalesce(description,'') AS text FROM skill WHERE project_id IN ${ids}`,
    );
    for (const s of readRows(srows)) {
      const list = skillsByProject.get(String(s.project_id)) ?? [];
      list.push(String(s.text ?? ""));
      skillsByProject.set(String(s.project_id), list);
    }
  }

  let touched = 0;
  const pending: { id: string; themes: string[]; score: number; evidence: unknown }[] = [];
  const stamps: { id: string; token: string }[] = [];

  for (const r of stale) {
    const token = focusInputToken({
      readmeHash: r.readmeHash,
      name: r.name,
      description: r.description,
      topics: r.topics,
      queries: r.discoveryQueries,
      skillDigest: skillDigest.get(r.id) ?? null,
    });
    const f = parseFocus({
      name: r.name,
      description: r.description,
      topics: r.topics ?? [],
      readme: readmes.get(r.id),
      skillTexts: skillsByProject.get(r.id),
      queries: r.discoveryQueries ?? [],
    });
    if (f.inFocus) {
      inFocus++;
      for (const t of f.themes) perTheme[t] = (perTheme[t] ?? 0) + 1;
    }

    const evidence = { ...f.evidence, _input: [token] };
    const unchanged = r.focusScore === f.score && sameArray(r.focusThemes ?? [], f.themes);
    if (unchanged) {
      stamps.push({ id: r.id, token });
      continue;
    }

    touched++;
    pending.push({ id: r.id, themes: f.themes, score: f.score, evidence });
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

  for (const part of chunk(stamps, UPDATE_CHUNK)) {
    const values = part.map((p) => sql`(${p.id}::uuid, ${JSON.stringify([p.token])}::jsonb)`);
    await db.execute(sql`
      UPDATE project AS p
      SET focus_evidence = coalesce(p.focus_evidence, '{}'::jsonb) || jsonb_build_object('_input', v.token)
      FROM (VALUES ${sql.join(values, sql`, `)}) AS v(id, token)
      WHERE p.id = v.id
    `);
  }

  log("refocus", `${inFocus} in focus of ${rows.length} · ${touched} changed · ${stale.length} readmes · ${JSON.stringify(perTheme)}`);
  return { itemsIn: rows.length, itemsOut: inFocus, meta: { perTheme, changed: touched, readmeReads: stale.length } };
}

function readRows(result: unknown): Record<string, unknown>[] {
  if (Array.isArray(result)) return result.filter((row) => row && typeof row === "object") as Record<string, unknown>[];
  if (result && typeof result === "object" && Array.isArray((result as { rows?: unknown }).rows)) {
    return (result as { rows: Record<string, unknown>[] }).rows;
  }
  return [];
}

/** Order-insensitive array comparison; themes are stored sorted by parseFocus. */
function sameArray(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}
