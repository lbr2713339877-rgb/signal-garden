/**
 * Minimal GitHub API client: REST + GraphQL over fetch.
 *
 * Responsibilities:
 *   - auth and the required User-Agent
 *   - per-resource pacing (search: 30/min, code search: 10/min)
 *   - honouring primary and secondary rate limits instead of hammering
 *   - recording quota so jobs can report it to data_source_health
 *
 * The token is read from the environment and never logged.
 */

import { sleep } from "@/lib/concurrency";

const API = "https://api.github.com";

export class GitHubError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = "GitHubError";
  }
}

type Resource = "core" | "search" | "code_search" | "graphql";

interface Quota {
  limit: number;
  remaining: number;
  resetAt: number; // epoch ms
}

const quota = new Map<Resource, Quota>();
const lastCall = new Map<Resource, number>();
const latencies: number[] = [];

/** Minimum spacing between calls, kept just under GitHub's per-minute caps. */
const MIN_INTERVAL: Record<Resource, number> = {
  core: 0,
  graphql: 0,
  search: 2_100,
  code_search: 6_300,
};

/** Waiting longer than this for a reset fails the call instead of stalling a job. */
const MAX_RESET_WAIT_MS = 90_000;

function token(): string {
  const t = process.env.GITHUB_TOKEN;
  if (!t) throw new Error("GITHUB_TOKEN is not set (see .env.example)");
  return t;
}

function resourceFor(path: string): Resource {
  if (path.startsWith("/search/code")) return "code_search";
  if (path.startsWith("/search/")) return "search";
  if (path === "/graphql") return "graphql";
  return "core";
}

async function pace(resource: Resource) {
  const gap = MIN_INTERVAL[resource];
  const last = lastCall.get(resource) ?? 0;
  const wait = last + gap - Date.now();
  if (wait > 0) await sleep(wait);

  const q = quota.get(resource);
  if (q && q.remaining <= 0) {
    const until = q.resetAt - Date.now() + 1_000;
    if (until > MAX_RESET_WAIT_MS) {
      throw new GitHubError(
        `GitHub ${resource} quota exhausted; resets in ${Math.round(until / 1000)}s`,
        429,
      );
    }
    if (until > 0) await sleep(until);
  }
  lastCall.set(resource, Date.now());
}

function record(res: Response) {
  const r = res.headers.get("x-ratelimit-resource") as Resource | null;
  const limit = Number(res.headers.get("x-ratelimit-limit"));
  const remaining = Number(res.headers.get("x-ratelimit-remaining"));
  const reset = Number(res.headers.get("x-ratelimit-reset"));
  if (r && Number.isFinite(limit) && Number.isFinite(remaining)) {
    quota.set(r, { limit, remaining, resetAt: reset * 1000 });
  }
}

/**
 * Consecutive timeouts across all calls. Past the limit the client fails fast
 * instead of letting a stalled network turn a job into a multi-hour hang.
 */
let consecutiveTimeouts = 0;
const TIMEOUT_CIRCUIT = 5;

async function request(path: string, init: RequestInit = {}): Promise<Response> {
  const resource = resourceFor(path);
  const url = path.startsWith("http") ? path : `${API}${path}`;

  for (let attempt = 0; attempt < 4; attempt++) {
    if (consecutiveTimeouts >= TIMEOUT_CIRCUIT) {
      throw new GitHubError(`GitHub unreachable: ${consecutiveTimeouts} consecutive timeouts`, 0);
    }
    await pace(resource);
    const started = Date.now();
    let res: Response;
    try {
      res = await fetch(url, {
        ...init,
        signal: AbortSignal.timeout(30_000),
        headers: {
          Authorization: `Bearer ${token()}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          "User-Agent": "signal-garden/0.1",
          ...(init.headers ?? {}),
        },
      });
    } catch (err) {
      const timedOut = err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError");
      if (timedOut) consecutiveTimeouts++;
      // A timeout is retried once; a slow repository will not get faster.
      if (attempt === 3 || (timedOut && attempt >= 1)) throw err;
      await sleep(1_000 * 2 ** attempt);
      continue;
    }
    consecutiveTimeouts = 0;
    latencies.push(Date.now() - started);
    record(res);

    // Rate limited: primary (remaining=0) or secondary (retry-after).
    if (res.status === 403 || res.status === 429) {
      const retryAfter = Number(res.headers.get("retry-after"));
      const remaining = res.headers.get("x-ratelimit-remaining");
      if (retryAfter > 0 || remaining === "0") {
        const reset = Number(res.headers.get("x-ratelimit-reset")) * 1000;
        const wait = retryAfter > 0 ? retryAfter * 1000 : reset - Date.now() + 1_000;
        if (wait > MAX_RESET_WAIT_MS || attempt === 3) {
          throw new GitHubError(`GitHub rate limited on ${resource}`, res.status);
        }
        await sleep(Math.max(wait, 1_000));
        continue;
      }
    }

    if (res.status >= 500 && attempt < 3) {
      await sleep(1_000 * 2 ** attempt);
      continue;
    }
    return res;
  }
  throw new GitHubError(`GitHub request failed after retries: ${path}`, 0);
}

/**
 * REST GET. Returns null for "this thing is gone or empty" responses
 * (404 not found, 409 empty repo, 410 gone, 451 legal block), so callers can
 * mark the project instead of crashing the job.
 */
export async function ghGet<T>(path: string): Promise<T | null> {
  const res = await request(path);
  if ([404, 409, 410, 451].includes(res.status)) return null;
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new GitHubError(`GET ${path} -> ${res.status} ${body.slice(0, 200)}`, res.status);
  }
  return (await res.json()) as T;
}

export interface GraphqlResult<T> {
  data: T | null;
  errors: { type?: string; message: string; path?: (string | number)[] }[];
}

/** GraphQL POST. Partial errors are returned, not thrown — a batch of 40 repos
 *  with one deleted repo should still yield 39 results. */
export async function ghGraphql<T>(
  query: string,
  variables: Record<string, unknown> = {},
): Promise<GraphqlResult<T>> {
  const res = await request("/graphql", {
    method: "POST",
    body: JSON.stringify({ query, variables }),
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new GitHubError(`GraphQL -> ${res.status} ${body.slice(0, 200)}`, res.status);
  }
  const json = (await res.json()) as { data?: T; errors?: GraphqlResult<T>["errors"] };
  return { data: json.data ?? null, errors: json.errors ?? [] };
}

/** Snapshot for job_run.meta and data_source_health. */
export function quotaSnapshot() {
  const out: Record<string, { remaining: number; limit: number }> = {};
  for (const [k, v] of quota) out[k] = { remaining: v.remaining, limit: v.limit };
  const avgLatency = latencies.length
    ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
    : null;
  return { quota: out, avgLatencyMs: avgLatency, calls: latencies.length };
}
