import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { dailySignal, project } from "@/db/schema";
import { isRepoSegment } from "@/lib/badge";

/** True when this repository has been in at least one published edition. */
export async function featuredRepo(owner: string, repo: string): Promise<boolean> {
  if (!isRepoSegment(owner) || !isRepoSegment(repo)) return false;
  const full = `${owner}/${repo}`.toLowerCase();
  const d = await db();
  const [row] = await d
    .select({ id: project.id })
    .from(project)
    .innerJoin(dailySignal, eq(dailySignal.projectId, project.id))
    .where(and(
      eq(project.hidden, false),
      eq(dailySignal.isPublished, true),
      sql`lower(${project.fullName}) = ${full}`,
    ))
    .limit(1);
  return Boolean(row);
}

export async function projectWasFeatured(projectId: string): Promise<boolean> {
  const d = await db();
  const [row] = await d
    .select({ id: dailySignal.id })
    .from(dailySignal)
    .where(and(eq(dailySignal.projectId, projectId), eq(dailySignal.isPublished, true)))
    .limit(1);
  return Boolean(row);
}
