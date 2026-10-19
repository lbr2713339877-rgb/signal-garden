/**
 * Discover (every 6h): run the search matrix, write raw signals, and make sure
 * every repository has exactly one project row.
 *
 * Nothing here decides what a repository *is*. That happens in enrich, after
 * its files have been read.
 *
 * ── Performance (2026-10-03) ────────────────────────────────────────────────
 * The first live run wrote 5,514 projects row-by-row over a cross-region
 * connection (Hong Kong → Seoul pooler) and spent ~26 minutes inside the write
 * loop — the GitHub search itself took under 3 minutes. Three changes remove
 * that cost without changing what gets stored:
 *
 *   1. One batched SELECT loads every already-known canonical id before the
 *      loop, so we no longer issue a SELECT per repo.
 *   2. Unchanged repos are skipped entirely. On a daily run most results were
 *      seen yesterday; re-issuing identical UPDATEs was pure latency.
 *   3. New rows are inserted in chunks of 200 and changed rows are updated in
 *      chunked transactions, collapsing thousands of round trips into tens.
 */

import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db/client";
import { project, projectSlugAlias, sourceSignal } from "@/db/schema";
import { buildQueryMatrix, runSearchMatrix, type DiscoveredRepo } from "@/collectors/github/search";
import { fingerprint } from "@/normalizers/fingerprint";
import { canonicalId, homepageDomain } from "@/normalizers/dedupe";
import { parseFocus } from "@/normalizers/focus-parse";
import { toSlug } from "@/lib/utils";
import { allocateSlug, ensureCurrentSlug } from "@/lib/slug-alias";
import { pingRenamedProjectSlugs } from "@/lib/indexnow";
import { chunk } from "@/lib/concurrency";
import { log, type JobResult } from "./run";

const WRITE_CHUNK = 200;

export async function discover(opts: { only?: string[]; dryRun?: boolean } = {}): Promise<JobResult> {
  let queries = buildQueryMatrix();
  if (opts.only?.length) queries = queries.filter((q) => opts.only!.some((o) => q.id.startsWith(o)));
  log("discover", `${queries.length} queries`);

  const { repos, failures } = await runSearchMatrix(queries, (p) =>
    log("discover", `${p.query.id.padEnd(28)} p${p.page}  ${String(p.items).padStart(3)} items  (of ${p.total})`),
  );
  for (const f of failures) log("discover", `query failed: ${f.id} — ${f.error}`);
  if (queries.length && failures.length === queries.length) {
    throw new Error(`all ${queries.length} queries failed; first: ${failures[0].error}`);
  }

  /* Dry run: report what the matrix would have found and stop before any
     write. Used to verify a query change without touching the database. */
  if (opts.dryRun) {
    const sample = [...repos.values()].slice(0, 25).map((r) => `${r.fullName} (${r.stars ?? '?'}★)`);
    log("discover", `DRY RUN — ${repos.size} repos matched, ${failures.length} query failures`);
    for (const s of sample) log("discover", `  ${s}`);
    return {
      itemsIn: repos.size,
      itemsOut: 0,
      meta: { dryRun: true, discovered: repos.size, failures, sample },
    };
  }

  const { db } = await getDb();
  const started = Date.now();

  /* ── 1. Load what we already know, in one pass ─────────────────────────── */
  const rows = [...repos.values()];
  const cids = rows.map((r) => canonicalId({ githubId: r.githubId }));
  const existingById = new Map<
    string,
    { id: string; discoveryQueries: string[] | null; codeHitPaths: string[] | null; parseState: string; rawDataHash: string | null; slug: string; fullName: string | null }
  >();
  for (const ids of chunk(cids, 500)) {
    const found = await db
      .select({
        id: project.id,
        canonicalProjectId: project.canonicalProjectId,
        discoveryQueries: project.discoveryQueries,
        codeHitPaths: project.codeHitPaths,
        parseState: project.parseState,
        rawDataHash: project.rawDataHash,
        slug: project.slug,
        fullName: project.fullName,
      })
      .from(project)
      .where(inArray(project.canonicalProjectId, ids));
    for (const f of found) existingById.set(f.canonicalProjectId, f);
  }
  log("discover", `existing loaded in ${((Date.now() - started) / 1000).toFixed(1)}s · ${existingById.size} known`);

  /* ── 2. Split into new / changed / unchanged ───────────────────────────── */
  const inserts: (typeof project.$inferInsert)[] = [];
  const updates: { id: string; values: Record<string, unknown>; previousSlug: string; nextFullName: string | null; fullNameChanged: boolean }[] = [];
  const signals: (typeof sourceSignal.$inferInsert)[] = [];
  const slugTaken = new Set([...existingById.values()].map((e) => e.slug));
  const aliases = await db.select({ slug: projectSlugAlias.slug }).from(projectSlugAlias);
  for (const alias of aliases) slugTaken.add(alias.slug);
  const otherSlugs = await db.select({ slug: project.slug }).from(project);
  for (const row of otherSlugs) slugTaken.add(row.slug);
  let newSignals = 0;
  let changed = 0;

  for (const r of rows) {
    const payload = serialize(r);
    const rawHash = fingerprint(payload);
    const cid = canonicalId({ githubId: r.githubId });
    signals.push({ source: "github", sourceId: String(r.githubId), sourceUrl: r.htmlUrl, rawHash, payload });

    const existing = existingById.get(cid);
    const queries = union(existing?.discoveryQueries ?? null, [...r.matchedQueries]);
    const codeHitPaths = union(existing?.codeHitPaths ?? null, [...r.codeHitPaths]).slice(0, 50);

    const focus = parseFocus({ name: r.name, description: r.description, topics: r.topics ?? [], queries });
    const focusFields = { focusThemes: focus.themes, focusScore: focus.score, focusEvidence: focus.evidence };

    const fields = {
      name: r.name,
      owner: r.owner,
      fullName: r.fullName,
      primaryUrl: r.htmlUrl,
      githubNodeId: r.nodeId,
      sourceUrl: r.htmlUrl,
      description: r.description,
      ...(r.stars !== undefined ? { stars: r.stars, forks: r.forks ?? 0 } : {}),
      ...(r.topics ? { topics: r.topics } : {}),
      ...(r.language !== undefined ? { language: r.language } : {}),
      ...(r.homepage !== undefined ? { homepageUrl: r.homepage || null, domain: homepageDomain(r.homepage) } : {}),
      ...(r.license !== undefined ? { license: r.license } : {}),
      ...(r.createdAt ? { upstreamCreatedAt: new Date(r.createdAt) } : {}),
      ...(r.pushedAt ? { upstreamPushedAt: new Date(r.pushedAt) } : {}),
      ...(r.archived !== undefined ? { isArchived: r.archived } : {}),
      updatedAt: new Date(),
    };

    if (!existing) {
      // Slugs must be unique inside this batch too; suffix collisions deterministically.
      const base = toSlug(r.fullName) || `repo-${r.githubId}`;
      const slug = allocateSlug(base, slugTaken);
      slugTaken.add(slug);
      inserts.push({
        ...fields,
        ...focusFields,
        canonicalProjectId: cid,
        slug,
        projectKind: "repo",
        discoveryQueries: queries,
        codeHitPaths,
        rawDataHash: rawHash,
      });
      continue;
    }

    // Only write when something actually moved. A daily search re-finds most of
    // yesterday's projects with identical payloads; skipping them is the whole
    // point of this optimisation.
    const changedRow = existing.rawDataHash !== rawHash;
    const queriesGrew = (existing.discoveryQueries?.length ?? 0) !== queries.length;
    const codeGrew = (existing.codeHitPaths?.length ?? 0) !== codeHitPaths.length;
    if (!changedRow && !queriesGrew && !codeGrew) continue;

    changed++;
    updates.push({
      id: existing.id,
      previousSlug: existing.slug,
      nextFullName: r.fullName,
      fullNameChanged: existing.fullName !== r.fullName,
      values: {
        ...fields,
        discoveryQueries: queries,
        codeHitPaths,
        ...(existing.parseState === "parsed" ? {} : focusFields),
      },
    });
  }

  /* ── 3. Persist in chunks ──────────────────────────────────────────────── */
  for (const part of chunk(signals, WRITE_CHUNK)) {
    const inserted = await db
      .insert(sourceSignal)
      .values(part)
      .onConflictDoNothing()
      .returning({ id: sourceSignal.id });
    newSignals += inserted.length;
    const ids = inserted.map((i) => i.id);
    if (ids.length) {
      await db.update(sourceSignal).set({ processedAt: new Date() }).where(inArray(sourceSignal.id, ids));
    }
  }

  for (const part of chunk(inserts, WRITE_CHUNK)) {
    await db.insert(project).values(part).onConflictDoNothing();
  }

  // Drizzle has no bulk update; issue them in one transaction per chunk so the
  // round-trip cost is a function of chunk count, not row count.
  const renamed: string[] = [];
  for (const part of chunk(updates, 50)) {
    await db.transaction(async (tx) => {
      for (const u of part) {
        await tx.update(project).set(u.values).where(eq(project.id, u.id));
        if (!u.fullNameChanged) continue;
        const result = await ensureCurrentSlug(tx, { id: u.id, slug: u.previousSlug, fullName: u.nextFullName });
        if (result.changed) {
          renamed.push(result.slug);
          slugTaken.add(result.slug);
        }
      }
    });
  }
  if (renamed.length) await pingRenamedProjectSlugs(renamed);

  log(
    "discover",
    `${rows.length} repos · ${newSignals} new signals · ${inserts.length} new projects · ${changed} updated · writes ${((Date.now() - started) / 1000).toFixed(1)}s`,
  );
  return {
    itemsIn: rows.length,
    itemsOut: inserts.length,
    meta: { queries: queries.length, failures, discovered: rows.length, newSignals, newProjects: inserts.length, updated: changed },
  };
}

function serialize(r: DiscoveredRepo) {
  return { ...r, matchedQueries: [...r.matchedQueries].sort(), codeHitPaths: [...r.codeHitPaths].sort() };
}

const union = (a: string[] | null, b: string[]) => [...new Set([...(a ?? []), ...b])].sort();
