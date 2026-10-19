import { and, eq, sql } from "drizzle-orm";
import type { Database } from "@/db/client";
import { db } from "@/db/client";
import { project, projectSlugAlias } from "@/db/schema";
import { toSlug } from "@/lib/utils";

type SlugWriter = Pick<Database, "select" | "insert" | "update" | "delete">;

export interface ResolvedSlug {
  id: string;
  slug: string;
  fullName: string | null;
  hidden: boolean;
  /** Set when `slug` was an old name. Pages redirect here. */
  redirectTo: string | null;
}

export function allocateSlug(base: string, reserved: Set<string>): string {
  if (!reserved.has(base)) return base;
  let i = 2;
  while (reserved.has(`${base}-${i}`)) i += 1;
  return `${base}-${i}`;
}

/** Current project slugs plus every alias. New rows must not take either. */
export async function loadReservedSlugs(database?: Pick<Database, "select">): Promise<Set<string>> {
  const reader = database ?? await db();
  const slugs = await reader.select({ slug: project.slug }).from(project);
  const aliases = await reader.select({ slug: projectSlugAlias.slug }).from(projectSlugAlias);
  return new Set([...slugs.map((row) => row.slug), ...aliases.map((row) => row.slug)]);
}

/**
 * Point the project at toSlug(fullName) and keep the previous slug as an alias.
 * If the wanted slug belongs to another project or alias, the current slug stays.
 */
export async function ensureCurrentSlug(
  tx: SlugWriter,
  row: { id: string; slug: string; fullName: string | null },
): Promise<{ slug: string; changed: boolean }> {
  const want = row.fullName ? toSlug(row.fullName) : "";
  if (!want || want === row.slug) return { slug: row.slug, changed: false };

  const [slugOwner] = await tx.select({ id: project.id }).from(project).where(eq(project.slug, want)).limit(1);
  if (slugOwner && slugOwner.id !== row.id) return { slug: row.slug, changed: false };

  const [aliasOwner] = await tx
    .select({ projectId: projectSlugAlias.projectId })
    .from(projectSlugAlias)
    .where(eq(projectSlugAlias.slug, want))
    .limit(1);
  if (aliasOwner && aliasOwner.projectId !== row.id) return { slug: row.slug, changed: false };

  await tx.insert(projectSlugAlias).values({ slug: row.slug, projectId: row.id }).onConflictDoNothing();
  await tx.update(project).set({ slug: want }).where(eq(project.id, row.id));
  await tx.delete(projectSlugAlias).where(and(
    eq(projectSlugAlias.slug, want),
    eq(projectSlugAlias.projectId, row.id),
  ));
  return { slug: want, changed: true };
}

export async function resolveSlug(slug: string): Promise<ResolvedSlug | null> {
  const d = await db();
  const [current] = await d
    .select({ id: project.id, slug: project.slug, fullName: project.fullName, hidden: project.hidden })
    .from(project)
    .where(eq(project.slug, slug))
    .limit(1);
  if (current) return { ...current, redirectTo: null };

  const [aliased] = await d
    .select({ id: project.id, slug: project.slug, fullName: project.fullName, hidden: project.hidden })
    .from(projectSlugAlias)
    .innerJoin(project, eq(project.id, projectSlugAlias.projectId))
    .where(eq(projectSlugAlias.slug, slug))
    .limit(1);
  if (!aliased || aliased.slug === slug) return aliased ? { ...aliased, redirectTo: null } : null;
  return { ...aliased, redirectTo: aliased.slug };
}

export async function projectIdForSlug(slug: string): Promise<string | null> {
  const resolved = await resolveSlug(slug);
  return resolved?.id ?? null;
}

/** Current slug for metadata. An unknown name is returned unchanged. */
export async function canonicalProjectSlug(slug: string): Promise<string> {
  const resolved = await resolveSlug(slug);
  if (!resolved) return slug;
  return resolved.redirectTo ?? resolved.slug;
}

/**
 * Old badge URL for a renamed repo. Null when the old GitHub name is now a
 * different tracked repository (cosscom/coss) or there is no alias.
 */
export async function badgeAliasPath(owner: string, repo: string): Promise<string | null> {
  const full = `${owner}/${repo}`.toLowerCase();
  const d = await db();
  const [owned] = await d
    .select({ id: project.id })
    .from(project)
    .where(sql`lower(${project.fullName}) = ${full}`)
    .limit(1);
  if (owned) return null;

  const resolved = await resolveSlug(toSlug(`${owner}/${repo}`));
  if (!resolved?.redirectTo || !resolved.fullName) return null;
  const [nextOwner, nextRepo, extra] = resolved.fullName.split("/");
  if (!nextOwner || !nextRepo || extra) return null;
  return `/badge/${nextOwner}/${nextRepo}.svg`;
}
