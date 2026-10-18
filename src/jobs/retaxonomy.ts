/**
 * Taxonomy backfill.
 *
 * The V2 categories were added after the first crawl, so existing rows have
 * `primary_category = NULL` and every category page counts zero. Re-parsing
 * would mean re-fetching hundreds of READMEs; the text is already stored, so
 * this recomputes from what is on disk.
 *
 * Same shape as refocus: pure function over stored columns, batched writes.
 * It is also the cheap way to iterate on the keyword rules — tune taxonomy.ts,
 * re-run this, and see the effect in seconds.
 *
 *   pnpm job retaxonomy
 */

import { and, eq, ne, isNull, or } from "drizzle-orm";
import { db } from "@/db/client";
import { project } from "@/db/schema";
import { classifyTaxonomy } from "@/normalizers/taxonomy";
import { chunk } from "@/lib/concurrency";
import { log, type JobResult } from "./run";

export async function retaxonomy(): Promise<JobResult> {
  const d = await db();

  const rows = (await d
    .select({
      id: project.id,
      name: project.name,
      description: project.description,
      topics: project.topics,
      readmeText: project.readmeText,
      skillCount: project.skillCount,
      hasSkillMd: project.hasSkillMd,
      docSignals: project.docSignals,
      primaryCategory: project.primaryCategory,
      secondaryCategory: project.secondaryCategory,
    })
    .from(project)
    .where(and(eq(project.parseState, "parsed"), or(isNull(project.categorySource), ne(project.categorySource, "admin"))))) as any[];

  log("retaxonomy", `${rows.length} parsed projects`);

  let changed = 0;
  const perPrimary: Record<string, number> = {};
  const perSecondary: Record<string, number> = {};

  for (const r of rows) {
    const docs = (r.docSignals ?? {}) as Record<string, unknown>;
    const deps = Array.isArray(docs.dependencies) ? (docs.dependencies as string[]) : [];

    const tax = classifyTaxonomy({
      name: r.name,
      description: r.description,
      topics: r.topics ?? [],
      readme: r.readmeText ?? "",
      skillMdCount: r.skillCount ?? 0,
      // MCP evidence from what the parser recorded: either the SDK in the
      // dependency list or a Python runtime with mcp present.
      hasMcpSdk: deps.some((dep) => /modelcontextprotocol|fastmcp|^mcp$/i.test(dep)),
    });

    if (r.primaryCategory === tax.primary && r.secondaryCategory === tax.secondary) continue;

    await d
      .update(project)
      .set({
        categorySource: "rules",
        primaryCategory: tax.primary,
        secondaryCategory: tax.secondary,
        updatedAt: new Date(),
      })
      .where(eq(project.id, r.id));

    changed++;
    perPrimary[tax.primary] = (perPrimary[tax.primary] ?? 0) + 1;
    if (tax.secondary) {
      const k = `${tax.primary}:${tax.secondary}`;
      perSecondary[k] = (perSecondary[k] ?? 0) + 1;
    }
  }

  log("retaxonomy", `${changed} updated`);
  log("retaxonomy", `primary: ${JSON.stringify(perPrimary)}`);

  // Secondary is what the category page's second level displays, so an empty
  // one is worth seeing immediately rather than discovering in the UI.
  const emptySecondary = Object.entries(perPrimary).filter(([k]) => {
    const subs = Object.keys(perSecondary).filter((s) => s.startsWith(`${k}:`)).length;
    return subs === 0;
  });
  if (emptySecondary.length) {
    log("retaxonomy", `WARNING: no second level matched for ${emptySecondary.map(([k]) => k).join(", ")}`);
  }

  return { itemsIn: rows.length, itemsOut: changed, meta: { perPrimary, perSecondary } };
}
