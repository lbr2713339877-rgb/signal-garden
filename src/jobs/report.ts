/**
 * Phase 1 acceptance report: what the pipeline found, and whether it meets
 * the bar (>= 200 repositories, >= 20 verified Skill repositories).
 *
 *   pnpm job report
 */

import { getDb } from "@/db/client";

export async function report(): Promise<boolean> {
  const { raw } = await getDb();
  const q = async (s: string) => (await raw.query(s)).rows as any[];

  const [t] = await q(`
    SELECT count(*)::int AS projects,
      count(*) FILTER (WHERE parse_state = 'parsed')::int  AS parsed,
      count(*) FILTER (WHERE parse_state = 'pending')::int AS pending,
      count(*) FILTER (WHERE parse_state = 'failed')::int  AS failed,
      count(*) FILTER (WHERE junk_reason IS NOT NULL)::int AS junk,
      count(*) FILTER (WHERE fork_of IS NOT NULL)::int     AS forks,
      count(*) FILTER (WHERE duplicate_of IS NOT NULL)::int AS duplicates,
      count(*) FILTER (WHERE is_skill_collection AND junk_reason IS NULL)::int AS collections,
      -- Acceptance counts only single, non-junk projects: a 20k-file corpus
      -- is not a verified Skill project.
      count(*) FILTER (WHERE is_verified_skill AND junk_reason IS NULL AND NOT is_skill_collection AND duplicate_of IS NULL)::int AS verified_projects
    FROM project`);
  const [s] = await q(`SELECT count(*)::int AS skills, count(*) FILTER (WHERE is_verified_skill)::int AS verified FROM skill`);
  const [snap] = await q(`SELECT count(*)::int AS n FROM repo_snapshot`);

  const group = (col: string) =>
    q(`SELECT coalesce(${col}::text, '—') AS k, count(*)::int AS n FROM project WHERE parse_state = 'parsed' GROUP BY 1 ORDER BY 2 DESC`);
  const line = (rows: any[]) => rows.map((r) => `${r.k} ${r.n}`).join(" · ");

  console.log("\n=== Signal Garden · Phase 1 report ===\n");
  console.log(`projects     ${t.projects}  (parsed ${t.parsed} · pending ${t.pending} · failed ${t.failed})`);
  console.log(`flagged      junk ${t.junk} · forks ${t.forks} · duplicates ${t.duplicates} · skill collections ${t.collections}`);
  console.log(`skills       ${s.skills} SKILL.md entities, ${s.verified} verified · ${t.verified_projects} verified-skill repos`);
  console.log(`snapshots    ${snap.n}`);
  console.log(`\nskill_type   ${line(await group("skill_type"))}`);
  console.log(`category     ${line(await group("category"))}`);

  // Editorial focus: the product covers indie-site building, design, motion
  // and token saving, not every Skill on GitHub.
  const focus = await q(`SELECT
      count(*)::int AS total,
      count(*) FILTER (WHERE cardinality(focus_themes) > 0)::int AS in_focus,
      count(*) FILTER (WHERE parse_state = 'pending' AND cardinality(focus_themes) > 0)::int AS in_focus_unparsed
    FROM project`);
  const f = focus[0];
  console.log(`\nfocus        ${f.in_focus} of ${f.total} projects in scope · ${f.in_focus_unparsed} awaiting parse`);
  console.log(`focus mix    ${line(await q(`SELECT t AS k, count(*)::int AS n FROM project, unnest(focus_themes) t GROUP BY 1 ORDER BY 2 DESC`))}`);

  for (const theme of ["web", "design", "motion", "token"]) {
    const top = await q(`SELECT full_name, stars, focus_themes FROM project
      WHERE '${theme}' = ANY(focus_themes) AND junk_reason IS NULL AND NOT is_skill_collection
      ORDER BY stars DESC LIMIT 5`);
    console.log(`\n  ${theme}:`);
    for (const r of top) console.log(`    ${String(r.stars).padStart(7)}★  ${r.full_name.padEnd(38)} [${r.focus_themes.join(",")}]`);
  }

  // Repos with no SKILL.md are still worth surfacing: component libraries and
  // design resources are useful to this audience without being installable
  // Skills.
  const resources = await q(`SELECT full_name, stars, category, focus_themes, difficulty
    FROM project
    WHERE cardinality(focus_themes) > 0 AND NOT has_skill_md AND junk_reason IS NULL AND NOT is_skill_collection
    ORDER BY stars DESC LIMIT 12`);
  console.log(`\nin-focus resources with no SKILL.md: ${resources.length}`);
  for (const r of resources) {
    console.log(`    ${String(r.stars).padStart(7)}★  ${r.full_name.padEnd(38)} ${(r.category ?? "—").padEnd(12)} ${r.difficulty ?? "no install"}`);
  }
  console.log(`difficulty   ${line(await group("difficulty"))}`);
  console.log(`security     ${line(await group("security_level"))}`);

  const top = await q(`
    SELECT full_name, stars, skill_count, category, difficulty, security_level, supported_agents
    FROM project WHERE is_verified_skill AND junk_reason IS NULL AND NOT is_skill_collection ORDER BY stars DESC LIMIT 12`);
  console.log("\ntop verified-skill repos:");
  for (const r of top) {
    console.log(`  ${String(r.stars).padStart(7)}★  ${r.full_name.padEnd(42)} ${String(r.skill_count).padStart(3)} skills  ${r.category ?? "—"} · ${r.difficulty ?? "no install"} · ${r.security_level} · [${(r.supported_agents ?? []).join(", ")}]`);
  }

  const nameOnly = await q(`
    SELECT full_name, skill_type, skill_confidence FROM project
    WHERE parse_state = 'parsed' AND name ILIKE '%skill%' AND NOT has_skill_md
    ORDER BY stars DESC LIMIT 6`);
  console.log("\nname contains 'skill' but no SKILL.md (must NOT be typed skill unless other strong evidence):");
  for (const r of nameOnly) console.log(`  ${r.full_name.padEnd(44)} ${r.skill_type} (${r.skill_confidence})`);

  const jobs = await q(`SELECT job, status, items_in, items_out, last_error FROM job_run ORDER BY started_at DESC LIMIT 4`);
  console.log("\nrecent jobs:");
  for (const j of jobs) console.log(`  ${j.job.padEnd(9)} ${j.status.padEnd(7)} in ${j.items_in} out ${j.items_out}${j.last_error ? ` — ${j.last_error.slice(0, 80)}` : ""}`);

  const pass = t.projects >= 200 && t.verified_projects >= 20;
  console.log(`\nacceptance  repos ${t.projects} >= 200 ${t.projects >= 200 ? "✓" : "✗"} · in-focus verified-skill repos ${t.verified_projects} >= 20 ${t.verified_projects >= 20 ? "✓" : "✗"}  => ${pass ? "PASS" : "NOT YET"}\n`);
  return true;
}
