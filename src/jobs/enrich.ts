/**
 * Enrich (hourly), two stages:
 *
 *   A. metadata  — one batched GraphQL pass over every project due a refresh:
 *                  stars, forks, issues, commits, licence, head commit.
 *                  Writes a repo_snapshot at most once per ~day, which is the
 *                  star history the heat score depends on.
 *   B. parse     — for projects whose head commit changed since the last
 *                  parse: fetch the tree, README, every SKILL.md and the
 *                  manifests, then classify. Unchanged repos are skipped.
 */

import { and, desc, eq, gte, inArray, isNotNull, isNull, lt, ne, notInArray, or, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { project, repoSnapshot, skill } from "@/db/schema";
import { fetchBlobs, fetchRepoMeta, type RepoMeta } from "@/collectors/github/repo";
import { analyzeTree, fetchTree, type RepoTree } from "@/collectors/github/tree";
import { analyzeRepository, planFetch, type Analysis } from "@/normalizers/analyze";
import { canonicalGithubUrl, homepageDomain } from "@/normalizers/dedupe";
import { deriveStatus } from "@/normalizers/status";
import { parseFocus } from "@/normalizers/focus-parse";
import { FOCUS_MIN } from "@/normalizers/focus";
import { refreshedDiscoveryDocuments } from '@/normalizers/discovery-policy';
import { chunk, mapLimit } from "@/lib/concurrency";
import { log, type JobResult } from "./run";

/** Hot candidates (in focus, enough traction to rank) refresh daily. */
const META_TTL_MS = 20 * 3_600_000;
/**
 * Cold repos — out of focus, or below the ranking star floor — cannot appear on
 * any surface, so refreshing their metadata every day is pure cost. They still
 * get refreshed weekly so star counts and liveness stay roughly current.
 */
const META_TTL_COLD_MS = 7 * 24 * 3_600_000;
const SNAPSHOT_GAP_MS = 20 * 3_600_000;
/** Mirrors scoring/daily.MIN_STARS_TO_RANK; kept local to avoid a cycle. */
const COLD_STAR_FLOOR = 20;

export async function enrich(opts: { limit?: number; metaOnly?: boolean; slugs?: string[] } = {}): Promise<JobResult> {
  // A targeted run refreshes and parses only the requested repositories.
  const meta = await refreshMetadata(opts.slugs);
  const parse = opts.metaOnly ? null : await deepParse(opts.limit ?? 300, opts.slugs);
  return { itemsIn: meta.checked, itemsOut: parse?.parsed ?? 0, meta: { metadata: meta, parse } };
}

/* ---------------------------------------------------------------------------
   Stage A — metadata + snapshots
   ------------------------------------------------------------------------ */

async function refreshMetadata(slugs?: string[]) {
  const { db } = await getDb();
  const cutoff = new Date(Date.now() - META_TTL_MS);
  const coldCutoff = new Date(Date.now() - META_TTL_COLD_MS);
  const hot = and(gte(project.focusScore, FOCUS_MIN), gte(project.stars, COLD_STAR_FLOOR));

  const due = await db
    .select({
      id: project.id,
      nodeId: project.githubNodeId,
      parsedHeadSha: project.parsedHeadSha,
      parseState: project.parseState,
      name: project.name,
      description: project.description,
      topics: project.topics,
      discoveryQueries: project.discoveryQueries,
      /* Snapshot of the fields applyMeta writes, so unchanged repos cost a
         comparison instead of a cross-region UPDATE. */
      stars: project.stars,
      forks: project.forks,
      openIssues: project.openIssues,
      commits7d: project.commits7d,
      contributors: project.contributors,
      defaultBranch: project.defaultBranch,
      headSha: project.headSha,
      linkStatus: project.linkStatus,
      junkReason: project.junkReason,
    })
    .from(project)
    .where(
      and(
        isNotNull(project.githubNodeId),
        eq(project.hidden, false),
        slugs?.length ? inArray(project.slug, slugs) : sql`true`,
        slugs?.length ? sql`true` : or(
          // Never fetched yet (new this run): always process.
          isNull(project.metaRefreshedAt),
          // Hot candidates: daily.
          and(hot, lt(project.metaRefreshedAt, cutoff)),
          // Cold repos: weekly.
          and(lt(project.metaRefreshedAt, coldCutoff)),
        ),
      ),
    );
  log("enrich", `metadata: ${due.length} due`);
  if (!due.length) return { checked: 0, updated: 0, gone: 0, snapshots: 0 };

  const lastSnapshot = new Map<string, number>();
  for (const ids of chunk<string>(due.map((d: any) => d.id), 500)) {
    const rows = await db
      .select({ projectId: repoSnapshot.projectId, at: sql<string>`max(${repoSnapshot.capturedAt})` })
      .from(repoSnapshot)
      .where(inArray(repoSnapshot.projectId, ids))
      .groupBy(repoSnapshot.projectId);
    for (const r of rows) lastSnapshot.set(r.projectId, new Date(r.at).getTime());
  }

  let updated = 0;
  let gone = 0;
  let snapshots = 0;
  const errors: string[] = [];
  const now = new Date();
  const pendingSnapshots: (typeof repoSnapshot.$inferInsert)[] = [];

  // Fetch and write in slices, so progress is persisted and visible as it goes.
  for (const slice of chunk<any>(due, 240)) {
    const t0 = Date.now();
    const metas = await fetchRepoMeta(slice.map((d: any) => d.nodeId), 30, errors);

    /* Unchanged repos are the common case on any run after the first. Instead
       of one UPDATE each (the previous behaviour — ~1s per 4 rows over the
       pooler), collect them and refresh their timestamp with a single
       set-based UPDATE per slice. Only rows whose metadata actually moved take
       an individual write. */
    const unchangedIds: string[] = [];
    for (const d of slice) {
      if (!metas.has(d.nodeId)) continue; // transient failure: retry next run
      const m = metas.get(d.nodeId) ?? null;
      const outcome = classify(d, m);
      if (outcome === "unchanged" && m) {
        unchangedIds.push(d.id);
        queueSnapshot(d, m, now);
      } else {
        await applyMeta(d, m);
      }
    }
    if (pendingSnapshots.length) {
      for (const part of chunk(pendingSnapshots.splice(0, pendingSnapshots.length), 500)) {
        await db.insert(repoSnapshot).values(part).onConflictDoNothing();
      }
    }
    if (unchangedIds.length) {
      for (const ids of chunk(unchangedIds, 500)) {
        await db
          .update(project)
          .set({ metaRefreshedAt: now, lastVerifiedAt: now })
          .where(inArray(project.id, ids));
      }
      updated += unchangedIds.length;
    }
    log("enrich", `metadata: ${updated + gone}/${due.length} · ${((Date.now() - t0) / 1000).toFixed(1)}s · errors ${errors.length}`);
  }

  if (errors.length) log("enrich", `metadata errors (first 3): ${errors.slice(0, 3).join(" | ")}`);
  log("enrich", `metadata: ${updated} updated · ${gone} gone · ${snapshots} snapshots`);
  return { checked: due.length, updated, gone, snapshots, errors: errors.slice(0, 20) };

  /**
   * Cheap in-memory decision for one repo: "gone" | "unchanged" | "changed".
   * Kept separate from applyMeta so the caller can batch by outcome.
   */
  function classify(d: any, m: RepoMeta | null): "gone" | "unchanged" | "changed" {
    if (m === null) return "gone";
    const headChanged = !!m.headOid && m.headOid !== d.parsedHeadSha;
    const focused = d.parseState === "parsed"
      ? null
      : parseFocus({ name: m.name, description: m.description, topics: m.topics, queries: d.discoveryQueries ?? [] });
    const unchanged =
      d.stars === m.stars &&
      d.forks === m.forks &&
      d.openIssues === m.openIssues &&
      d.commits7d === m.commits7d &&
      (d.contributors ?? 0) === (m.contributors ?? 0) &&
      d.defaultBranch === m.defaultBranch &&
      d.headSha === m.headOid &&
      !headChanged &&
      (m.isDisabled ? "dead" : "ok") === d.linkStatus &&
      !(m.isEmpty && d.junkReason !== "empty repository") &&
      !focused;
    return unchanged ? "unchanged" : "changed";
  }

  async function applyMeta(d: any, m: RepoMeta | null) {

    if (m === null) {
      await db
        .update(project)
        .set({ linkStatus: "dead", junkReason: "repository deleted or no longer public", metaRefreshedAt: now, lastVerifiedAt: now, updatedAt: now })
        .where(eq(project.id, d.id));
      gone++;
      return;
    }

    const headChanged = !!m.headOid && m.headOid !== d.parsedHeadSha;

    // Refresh the search-time focus guess with the metadata we now have.
    const focus = d.parseState === "parsed"
      ? null
      : parseFocus({ name: m.name, description: m.description, topics: m.topics, queries: d.discoveryQueries ?? [] });

    await db
      .update(project)
      .set({
        name: m.name,
        owner: m.owner,
        fullName: m.fullName,
        primaryUrl: m.url,
        description: m.description,
        homepageUrl: m.homepageUrl,
        domain: homepageDomain(m.homepageUrl),
        stars: m.stars,
        forks: m.forks,
        openIssues: m.openIssues,
        commits7d: m.commits7d,
        contributors: m.contributors,
        isArchived: m.isArchived,
        isTemplate: m.isTemplate,
        license: m.license,
        language: m.language,
        topics: m.topics,
        upstreamCreatedAt: new Date(m.createdAt),
        upstreamPushedAt: m.pushedAt ? new Date(m.pushedAt) : null,
        defaultBranch: m.defaultBranch,
        headSha: m.headOid,
        forkOf: m.isFork ? m.parentFullName : null,
        mirrorOf: m.isMirror && m.mirrorUrl ? (canonicalGithubUrl(m.mirrorUrl) ?? m.mirrorUrl) : null,
        status: deriveStatus(m),
        linkStatus: m.isDisabled ? "dead" : "ok",
        lastVerifiedAt: now,
        metaRefreshedAt: now,
        updatedAt: now,
        ...(focus ? { focusThemes: focus.themes, focusScore: focus.score, focusEvidence: focus.evidence } : {}),
        ...(m.isEmpty
          ? { junkReason: "empty repository", parseState: "failed" as const, lastError: "empty repository" }
          : headChanged && d.parseState !== "pending"
            ? { parseState: "pending" as const }
            : {}),
      })
      .where(eq(project.id, d.id));
    updated++;
    queueSnapshot(d, m, now);
  }

  /** Buffers a snapshot row; the caller flushes them in bulk. */
  function queueSnapshot(d: any, m: RepoMeta, at: Date) {
    if (at.getTime() - (lastSnapshot.get(d.id) ?? 0) < SNAPSHOT_GAP_MS) return;
    lastSnapshot.set(d.id, at.getTime());
    pendingSnapshots.push({
      projectId: d.id,
      stars: m.stars,
      forks: m.forks,
      openIssues: m.openIssues,
      watchers: m.watchers,
      commits7d: m.commits7d,
      releases30d: m.releases30d,
      capturedAt: at,
    });
    snapshots++;
  }
}

/* ---------------------------------------------------------------------------
   Stage B — deep parse
   ------------------------------------------------------------------------ */

async function deepParse(limit: number, slugs?: string[]) {
  const { db } = await getDb();

  // Parse queue: only repos that look in scope. Signal Garden covers indie
  // site building, design, motion and token saving — not every Skill on
  // GitHub. Repos outside the themes stay in the database, unparsed.
  //
  // Ordering matters because only ~300 of 4,600 in-focus repos are parsed per
  // run. The previous order put "a SKILL.md path was seen in code search"
  // first, which meant a 79-star helper repo was parsed days before React Bits
  // (48k stars), GSAP (29k) or uiverse/galaxy (13k) — all of which have no
  // SKILL.md and were therefore permanently at the back of the queue.
  // Reach and relevance now lead: stars first, then focus, with the SKILL.md
  // hint as a small tie-breaker rather than an entry requirement.
  const rows = await db
    .select({
      id: project.id,
      canonicalProjectId: project.canonicalProjectId,
      nodeId: project.githubNodeId,
      name: project.name,
      fullName: project.fullName,
      description: project.description,
      topics: project.topics,
      language: project.language,
      license: project.license,
      isTemplate: project.isTemplate,
      headSha: project.headSha,
      stars: project.stars,
      categorySource: project.categorySource,
      upstreamCreatedAt: project.upstreamCreatedAt,
      discoveryQueries: project.discoveryQueries,
    })
    .from(project)
    .where(
      and(
        eq(project.parseState, "pending"),
        eq(project.hidden, false),
        eq(project.linkStatus, "ok"),
        isNotNull(project.githubNodeId),
        isNotNull(project.headSha),
        gte(project.focusScore, FOCUS_MIN),
        slugs?.length ? inArray(project.slug, slugs) : sql`true`,
      ),
    )
    .orderBy(
      desc(project.stars),
      desc(project.focusScore),
      desc(sql`cardinality(${project.codeHitPaths}) > 0`),
    )
    .limit(slugs?.length ?? limit);

  log("enrich", `parse: ${rows.length} pending, in focus (limit ${limit})`);
  let parsed = 0;
  let failed = 0;
  let skills = 0;
  let verified = 0;

  for (const batch of chunk(rows as any[], 24)) {
    const trees = await mapLimit(batch, 6, async (r): Promise<RepoTree | null | Error> => {
      try {
        return await fetchTree(r.fullName, r.headSha);
      } catch (err) {
        return err instanceof Error ? err : new Error(String(err));
      }
    });

    const plans = batch.map((r, i) => {
      const t = trees[i];
      if (!t || t instanceof Error) return null;
      const facts = analyzeTree(t.entries, t.truncated);
      return { facts, paths: planFetch(facts) };
    });

    const blobs = await fetchBlobs(
      batch.flatMap((r, i) => (plans[i] ? [{ key: r.id, nodeId: r.nodeId, paths: plans[i]!.paths }] : [])),
    );

    for (let i = 0; i < batch.length; i++) {
      const r = batch[i];
      const t = trees[i];
      const plan = plans[i];
      try {
        if (t instanceof Error) throw t;
        if (!t || !plan) {
          await markFailed(r.id, "tree unavailable (empty or removed)");
          failed++;
          continue;
        }
        const files = blobs.get(r.id);
        if (!files) {
          await markFailed(r.id, "content fetch failed");
          failed++;
          continue;
        }

        const analysis = analyzeRepository(r, plan.facts, files);
        const duplicateOf = await resolveDuplicate(r, analysis);
        await save(r, analysis, duplicateOf);

        parsed++;
        skills += analysis.skills.length;
        if (analysis.isVerifiedSkill) verified++;
      } catch (err) {
        await markFailed(r.id, err instanceof Error ? err.message : String(err));
        failed++;
      }
    }
    log("enrich", `parse: ${parsed + failed}/${rows.length} · ${verified} verified-skill repos · ${skills} skills`);
  }

  return { pending: rows.length, parsed, failed, skills, verifiedProjects: verified };
}

/**
 * parsedHeadSha is left untouched on failure, so the next metadata refresh
 * flips the project back to pending and it is retried automatically.
 */
async function markFailed(id: string, error: string) {
  const { db } = await getDb();
  await db
    .update(project)
    .set({ parseState: "failed", lastError: error.slice(0, 1000), parsedAt: new Date(), updatedAt: new Date() })
    .where(eq(project.id, id));
}

/**
 * Identical README to another project -> the newer one is the copy.
 * Short READMEs are skipped: templates legitimately share boilerplate.
 */
async function resolveDuplicate(r: any, a: Analysis): Promise<string | null> {
  if (!a.readmeHash || (a.readmeText?.length ?? 0) < 500) return null;
  const { db } = await getDb();
  const others = await db
    .select({ id: project.id, canonicalProjectId: project.canonicalProjectId, createdAt: project.upstreamCreatedAt, duplicateOf: project.duplicateOf })
    .from(project)
    .where(and(eq(project.readmeHash, a.readmeHash), ne(project.id, r.id)))
    .limit(5);
  if (!others.length) return null;

  const time = (d: unknown) => (d ? new Date(d as string).getTime() : Infinity);
  const oldest = others.reduce((x: any, y: any) => (time(y.createdAt) < time(x.createdAt) ? y : x));
  if (time(oldest.createdAt) <= time(r.upstreamCreatedAt)) return oldest.duplicateOf ?? oldest.canonicalProjectId;

  // This repo is the original; the others are the copies.
  await db.update(project).set({ duplicateOf: r.canonicalProjectId }).where(inArray(project.id, others.map((o: any) => o.id)));
  return null;
}

async function save(r: any, a: Analysis, duplicateOf: string | null) {
  const { db } = await getDb();
  const now = new Date();

  await db.transaction(async (tx: any) => {
    await tx
      .update(project)
      .set({
        parseState: "parsed",
        parsedAt: now,
        parsedHeadSha: r.headSha,
        lastError: null,
        contentHash: a.contentHash,
        readmeText: a.readmeText,
        readmeHash: a.readmeHash,
        skillType: a.classification.skillType,
        skillConfidence: a.classification.skillConfidence,
        isVerifiedSkill: a.isVerifiedSkill,
        hasSkillMd: a.hasSkillMd,
        skillCount: a.skillCount,
        isSkillCollection: a.isSkillCollection,
        supportedAgents: a.supportedAgents,
        installCommands: a.installCommands,
        riskFlags: a.riskFlags,
        securityLevel: a.securityLevel,
        docSignals: refreshedDiscoveryDocuments(a.docSignals),
        parseEvidence: a.parseEvidence,
        tags: a.tags,
        difficulty: a.difficulty,
        requiresApiKey: a.requiresApiKey,
        requiresLocalRuntime: a.requiresLocalRuntime,
        requiresDocker: a.requiresDocker,
        junkReason: a.junkReason,
        duplicateOf,
        focusThemes: a.focusThemes,
        focusScore: a.focusScore,
        focusEvidence: a.focusEvidence,
        primaryCategory: a.primaryCategory,
        secondaryCategory: a.secondaryCategory,
        // An operator's category is never overwritten by the rules.
        ...(r.categorySource === "admin" ? {} : { category: a.category, categorySource: "rules" }),
        // GitHub's own repository card. Generated and served by GitHub, so
        // using it involves no scraping of anyone else's site.
        previewImageUrl: `https://opengraph.githubassets.com/1/${r.fullName}`,
        firstTrackedAt: r.upstreamCreatedAt ?? now,
        updatedAt: now,
      })
      .where(eq(project.id, r.id));

    for (const s of a.skills) {
      await tx
        .insert(skill)
        .values({ projectId: r.id, ...s })
        .onConflictDoUpdate({ target: [skill.projectId, skill.slug], set: { ...s, updatedAt: now } });
    }

    const keep = a.skills.map((s) => s.slug);
    await tx
      .delete(skill)
      .where(keep.length ? and(eq(skill.projectId, r.id), notInArray(skill.slug, keep)) : eq(skill.projectId, r.id));
  });
}
