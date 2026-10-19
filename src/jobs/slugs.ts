/**
 * One-shot slug repair. GitHub renames change full_name; this points project.slug
 * at toSlug(full_name) and keeps the previous slug in project_slug_alias.
 *
 * Back up the database before `--backfill`. A dry run writes nothing.
 */

import { getDb } from "@/db/client";
import { project, projectSlugAlias } from "@/db/schema";
import { chunk } from "@/lib/concurrency";
import { pingRenamedProjectSlugs } from "@/lib/indexnow";
import { ensureCurrentSlug } from "@/lib/slug-alias";
import { toSlug } from "@/lib/utils";
import { log, type JobResult } from "./run";

const BACKUP_NOTE = "Back up the database before --backfill. It rewrites project.slug and inserts project_slug_alias.";

export async function backfillSlugs(opts: { dryRun?: boolean } = {}): Promise<JobResult> {
  log("slugs", BACKUP_NOTE);
  const { db } = await getDb();
  const rows = await db
    .select({ id: project.id, slug: project.slug, fullName: project.fullName })
    .from(project);
  const mismatched = rows
    .filter((row) => {
      const want = row.fullName ? toSlug(row.fullName) : "";
      return Boolean(want) && want !== row.slug;
    })
    .sort((a, b) => a.slug.localeCompare(b.slug));

  if (opts.dryRun) {
    const slugOwner = new Map(rows.map((row) => [row.slug, row.id]));
    const aliases = await db.select({ slug: projectSlugAlias.slug, projectId: projectSlugAlias.projectId }).from(projectSlugAlias);
    const aliasOwner = new Map(aliases.map((row) => [row.slug, row.projectId]));
    let wouldChange = 0;
    for (const row of mismatched) {
      const want = toSlug(row.fullName ?? "");
      const takenBySlug = slugOwner.get(want);
      const takenByAlias = aliasOwner.get(want);
      if ((takenBySlug && takenBySlug !== row.id) || (takenByAlias && takenByAlias !== row.id)) {
        log("slugs", `keep ${row.slug} (${row.fullName}); ${want} is taken`);
        continue;
      }
      log("slugs", `would rename ${row.slug} -> ${want} (${row.fullName})`);
      wouldChange += 1;
      aliasOwner.set(row.slug, row.id);
      slugOwner.delete(row.slug);
      slugOwner.set(want, row.id);
      if (aliasOwner.get(want) === row.id) aliasOwner.delete(want);
    }
    log("slugs", `dry-run: ${wouldChange} would change · ${mismatched.length - wouldChange} kept · nothing written`);
    return { itemsIn: mismatched.length, itemsOut: 0, meta: { dryRun: true, wouldChange } };
  }

  const renamed: string[] = [];
  let kept = 0;
  for (const part of chunk(mismatched, 50)) {
    await db.transaction(async (tx) => {
      for (const row of part) {
        const result = await ensureCurrentSlug(tx, row);
        if (result.changed) renamed.push(result.slug);
        else kept += 1;
      }
    });
  }
  if (renamed.length) await pingRenamedProjectSlugs(renamed);
  log("slugs", `changed ${renamed.length} · kept ${kept}`);
  return { itemsIn: mismatched.length, itemsOut: renamed.length, meta: { kept } };
}
