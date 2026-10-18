/**
 * Batched GraphQL reads: repository metadata and file contents.
 *
 * Nodes are addressed by GraphQL node id rather than owner/name, so a renamed
 * or transferred repository still resolves to the same project.
 */

import { ghGraphql } from "./client";
import { chunk } from "@/lib/concurrency";

export interface RepoMeta {
  nodeId: string;
  githubId: number;
  fullName: string;
  owner: string;
  name: string;
  url: string;
  description: string | null;
  homepageUrl: string | null;
  stars: number;
  forks: number;
  watchers: number;
  contributors: number;
  openIssues: number;
  isArchived: boolean;
  isFork: boolean;
  isMirror: boolean;
  isTemplate: boolean;
  isEmpty: boolean;
  isDisabled: boolean;
  parentFullName: string | null;
  mirrorUrl: string | null;
  license: string | null;
  language: string | null;
  topics: string[];
  createdAt: string;
  pushedAt: string | null;
  defaultBranch: string | null;
  headOid: string | null;
  commits7d: number;
  releases30d: number;
}

const META_FIELDS = `
  ... on Repository {
    databaseId nameWithOwner name owner { login } url description homepageUrl
    stargazerCount forkCount watchers { totalCount } issues(states: OPEN) { totalCount }
    mentionableUsers(first: 1) { totalCount }
    isArchived isFork isMirror isTemplate isEmpty isDisabled mirrorUrl
    parent { nameWithOwner }
    licenseInfo { spdxId }
    primaryLanguage { name }
    repositoryTopics(first: 20) { nodes { topic { name } } }
    createdAt pushedAt
    releases(first: 10, orderBy: { field: CREATED_AT, direction: DESC }) { nodes { createdAt } }
    defaultBranchRef {
      name
      target { ... on Commit { oid history(since: $since) { totalCount } } }
    }
  }
`;

function toMeta(nodeId: string, n: any): RepoMeta {
  const cutoff = Date.now() - 30 * 86_400_000;
  const spdx = n.licenseInfo?.spdxId ?? null;
  return {
    nodeId,
    githubId: n.databaseId,
    fullName: n.nameWithOwner,
    owner: n.owner?.login,
    name: n.name,
    url: n.url,
    description: n.description ?? null,
    homepageUrl: n.homepageUrl || null,
    stars: n.stargazerCount ?? 0,
    forks: n.forkCount ?? 0,
    watchers: n.watchers?.totalCount ?? 0,
    /* GraphQL exposes contributor count as mentionableUsers for a repository.
       It is an approximation (users who can be mentioned), which is exactly the
       "how many people are involved" signal we need and is far cheaper than
       paginating contributors. */
    contributors: n.mentionableUsers?.totalCount ?? 0,
    openIssues: n.issues?.totalCount ?? 0,
    isArchived: !!n.isArchived,
    isFork: !!n.isFork,
    isMirror: !!n.isMirror,
    isTemplate: !!n.isTemplate,
    isEmpty: !!n.isEmpty,
    isDisabled: !!n.isDisabled,
    parentFullName: n.parent?.nameWithOwner ?? null,
    mirrorUrl: n.mirrorUrl ?? null,
    // GitHub reports "NOASSERTION" when it cannot identify the licence;
    // that is recorded as unknown, not as a licence.
    license: spdx && spdx !== "NOASSERTION" ? spdx : null,
    language: n.primaryLanguage?.name ?? null,
    topics: (n.repositoryTopics?.nodes ?? []).map((t: any) => t.topic.name),
    createdAt: n.createdAt,
    pushedAt: n.pushedAt ?? null,
    defaultBranch: n.defaultBranchRef?.name ?? null,
    headOid: n.defaultBranchRef?.target?.oid ?? null,
    commits7d: n.defaultBranchRef?.target?.history?.totalCount ?? 0,
    releases30d: (n.releases?.nodes ?? []).filter(
      (r: any) => new Date(r.createdAt).getTime() >= cutoff,
    ).length,
  };
}

/**
 * Returns a map keyed by node id.
 *   - value is RepoMeta    -> fetched
 *   - value is null        -> GitHub says NOT_FOUND (deleted / private now)
 *   - key absent           -> transient failure; leave the project for next run
 */
export async function fetchRepoMeta(
  nodeIds: string[],
  batchSize = 30,
  errors: string[] = [],
): Promise<Map<string, RepoMeta | null>> {
  const out = new Map<string, RepoMeta | null>();
  const since = new Date(Date.now() - 7 * 86_400_000).toISOString();

  const run = async (ids: string[]): Promise<void> => {
    try {
      const res = await ghGraphql<{ nodes: any[] }>(
        `query($ids: [ID!]!, $since: GitTimestamp!) { nodes(ids: $ids) { id ${META_FIELDS} } }`,
        { ids, since },
      );
      if (!res.data) errors.push(`batch of ${ids.length}: ${res.errors[0]?.message ?? "no data"}`);
      const notFound = new Set(
        res.errors
          .filter((e) => e.type === "NOT_FOUND" && e.path?.[0] === "nodes")
          .map((e) => ids[Number(e.path?.[1])]),
      );
      const nodes = res.data?.nodes ?? [];
      ids.forEach((id, i) => {
        const n = nodes[i];
        if (n && n.nameWithOwner) out.set(id, toMeta(id, n));
        else if (notFound.has(id)) out.set(id, null);
      });
    } catch (err) {
      errors.push(`batch of ${ids.length}: ${err instanceof Error ? err.message : String(err)}`);
      // Heavy repos occasionally time a batch out. Split and retry so one
      // slow repository does not cost the other 29.
      if (ids.length > 1) {
        const mid = Math.ceil(ids.length / 2);
        await run(ids.slice(0, mid));
        await run(ids.slice(mid));
      }
    }
  };

  for (const ids of chunk(nodeIds, batchSize)) await run(ids);
  return out;
}

export interface BlobRequest {
  key: string; // caller's id for the repo
  nodeId: string;
  paths: string[];
}

/** Max objects per GraphQL call; keeps response size and cost predictable. */
const MAX_OBJECTS_PER_CALL = 80;
const MAX_TEXT = 200_000;

/**
 * Fetches file contents at HEAD of the default branch.
 * Result: key -> path -> text (null when binary or missing).
 * A key absent from the result means its batch failed.
 */
export async function fetchBlobs(
  requests: BlobRequest[],
): Promise<Map<string, Map<string, string | null>>> {
  const out = new Map<string, Map<string, string | null>>();

  // Pack requests into calls of at most MAX_OBJECTS_PER_CALL paths.
  const batches: BlobRequest[][] = [];
  let current: BlobRequest[] = [];
  let count = 0;
  for (const r of requests) {
    const n = Math.max(1, r.paths.length);
    if (count + n > MAX_OBJECTS_PER_CALL && current.length) {
      batches.push(current);
      current = [];
      count = 0;
    }
    current.push(r);
    count += n;
  }
  if (current.length) batches.push(current);

  for (const batch of batches) {
    const parts = batch.map((r, i) => {
      const files = r.paths
        .map(
          (p, j) =>
            `f${j}: object(expression: ${JSON.stringify(`HEAD:${p}`)}) { ... on Blob { text isBinary } }`,
        )
        .join("\n");
      return `r${i}: node(id: ${JSON.stringify(r.nodeId)}) { ... on Repository { ${files || "id"} } }`;
    });

    try {
      const res = await ghGraphql<Record<string, any>>(`query { ${parts.join("\n")} }`);
      batch.forEach((r, i) => {
        const node = res.data?.[`r${i}`];
        if (!node) return;
        const files = new Map<string, string | null>();
        r.paths.forEach((p, j) => {
          const blob = node[`f${j}`];
          files.set(p, blob && !blob.isBinary && typeof blob.text === "string" ? blob.text.slice(0, MAX_TEXT) : null);
        });
        out.set(r.key, files);
      });
    } catch {
      // Leave the batch's keys absent; the caller marks them failed.
    }
  }
  return out;
}
