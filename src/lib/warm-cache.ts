import { mapLimit } from "@/lib/concurrency";
import { projectPagePaths } from "@/lib/project-revalidate";

/** Approved warm-up parallelism. Higher values are clamped. */
export const WARM_CONCURRENCY_MIN = 2;
export const WARM_CONCURRENCY_MAX = 3;
export const WARM_CONCURRENCY_DEFAULT = 2;

const WEEKLY_PATH = /^\/weekly\/[1-9]\d*$/;

export type WarmHit = {
  path: string;
  ok: boolean;
  status: number;
  cache: string | null;
  ms: number;
  error?: string;
};

export function warmConcurrency(raw: string | number | undefined | null): number {
  const parsed = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(parsed)) return WARM_CONCURRENCY_DEFAULT;
  return Math.min(WARM_CONCURRENCY_MAX, Math.max(WARM_CONCURRENCY_MIN, Math.floor(parsed)));
}

type WarmEnv = { WARM_ORIGIN?: string; PORT?: string; [key: string]: string | undefined };

/** Loopback origin. An explicit WARM_ORIGIN wins; otherwise PORT or 3000. */
export function warmOrigin(env: WarmEnv = process.env): string {
  const explicit = env.WARM_ORIGIN?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");
  const port = env.PORT?.trim() || "3000";
  if (!/^\d{2,5}$/.test(port)) return "http://127.0.0.1:3000";
  return `http://127.0.0.1:${port}`;
}

export function isLoopbackOrigin(origin: string): boolean {
  try {
    const host = new URL(origin).hostname;
    return host === "127.0.0.1" || host === "localhost" || host === "::1" || host === "[::1]";
  } catch {
    return false;
  }
}

export function warmIncludeSitemap(raw: string | undefined | null): boolean {
  return raw !== "0" && raw !== "false";
}

/**
 * Request order: pilot project pages, then the homepage edition, then the
 * shell routes, then the sitemap. Duplicate project slugs are requested once.
 */
export function warmCachePaths(input: {
  pilotSlugs: readonly string[];
  editionSlugs: readonly string[];
  weeklyPaths?: readonly string[];
  includeSitemap?: boolean;
}): string[] {
  const projects = projectPagePaths([...input.pilotSlugs, ...input.editionSlugs]);
  const weekly = [...new Set((input.weeklyPaths ?? []).filter((path) => WEEKLY_PATH.test(path)))];
  const shells = ["/", "/today", ...(weekly.length ? weekly : ["/weekly/1"]), "/en"];
  const sitemap = input.includeSitemap === false ? [] : ["/sitemap.xml"];
  return [...projects, ...shells, ...sitemap];
}

/**
 * Exit 0 only when the slug sources loaded and a strict majority of the
 * requests succeeded. A failed pilot or edition lookup did not warm most pages.
 */
export function warmExitCode(hits: readonly { ok: boolean }[], sourcesOk = true): number {
  if (!sourcesOk || hits.length === 0) return 1;
  const ok = hits.reduce((count, hit) => count + (hit.ok ? 1 : 0), 0);
  return ok * 2 > hits.length ? 0 : 1;
}

async function readBody(response: Response): Promise<void> {
  if (response.body) await response.arrayBuffer();
}

/**
 * GET each path on origin. Redirects stay on that origin so a warm-up from
 * the VPS loopback cannot follow a public host. The body is read to completion
 * so a cold render can finish writing the ISR files.
 */
export async function warmPaths(
  paths: readonly string[],
  opts: {
    origin: string;
    concurrency?: number;
    timeoutMs?: number;
    fetchImpl?: typeof fetch;
  },
): Promise<WarmHit[]> {
  const origin = opts.origin.replace(/\/+$/, "");
  const concurrency = warmConcurrency(opts.concurrency);
  const timeoutMs = opts.timeoutMs ?? 20_000;
  const fetchImpl = opts.fetchImpl ?? fetch;
  return mapLimit(paths, concurrency, async (path) => {
    const started = Date.now();
    const signal = AbortSignal.timeout(timeoutMs);
    let current = `${origin}${path}`;
    try {
      for (let hop = 0; hop < 4; hop++) {
        const response = await fetchImpl(current, {
          redirect: "manual",
          signal,
          headers: { accept: "text/html,application/xml;q=0.9,*/*;q=0.8" },
        });
        const location = response.headers.get("location");
        const redirected = response.status >= 300 && response.status < 400 && location;
        if (!redirected) {
          await readBody(response);
          return {
            path,
            ok: response.ok,
            status: response.status,
            cache: response.headers.get("x-nextjs-cache"),
            ms: Date.now() - started,
          };
        }
        await readBody(response);
        const next = new URL(location, current);
        if (next.origin !== new URL(origin).origin) {
          return {
            path,
            ok: false,
            status: response.status,
            cache: response.headers.get("x-nextjs-cache"),
            ms: Date.now() - started,
            error: `redirect left ${origin}`,
          };
        }
        current = next.toString();
      }
      return {
        path,
        ok: false,
        status: 0,
        cache: null,
        ms: Date.now() - started,
        error: "too many redirects",
      };
    } catch (error) {
      return {
        path,
        ok: false,
        status: 0,
        cache: null,
        ms: Date.now() - started,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });
}
