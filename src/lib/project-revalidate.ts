import { publishedProjectSlugs } from "@/db/queries";
import { signalDate } from "@/lib/day";
import type { JobResult } from "@/jobs/run";
import { redactRevalidateSecret, revalidateSecretFromEnv, trustedRevalidateOrigin } from "@/lib/revalidate-secret";

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Public project paths. Anything else is dropped so the revalidate route cannot be aimed at /login or /api. */
export function projectPagePaths(slugs: string[]): string[] {
  return [...new Set(slugs.filter((slug) => SLUG.test(slug)))].map((slug) => `/p/${slug}`);
}

/**
 * Ask the Next server to drop cached HTML for today's published project pages.
 * The token is sent only to http://127.0.0.1:3000, and a redirect is an error
 * rather than a second request. A down server throws; the daily wrapper logs
 * it and still leaves the edition published.
 */
export async function revalidatePublishedProjectPages(opts: {
  now?: Date;
  slugs?: string[];
  origin?: string;
  fetchImpl?: typeof fetch;
} = {}): Promise<JobResult> {
  const date = signalDate(opts.now);
  const slugs = opts.slugs ?? await publishedProjectSlugs(date);
  const paths = projectPagePaths(slugs);
  if (!paths.length) return { itemsIn: slugs.length, itemsOut: 0, meta: { date, paths } };
  const origin = trustedRevalidateOrigin(opts.origin ?? process.env.REVALIDATE_ORIGIN ?? "http://127.0.0.1:3000");
  if (!origin) throw new Error("revalidate origin is not allowed");
  const secret = revalidateSecretFromEnv();
  if (!secret) throw new Error("revalidate secret is not configured");
  let response: Response;
  try {
    response = await (opts.fetchImpl ?? fetch)(`${origin}/api/revalidate-paths`, {
      method: "POST",
      redirect: "error",
      headers: {
        "content-type": "application/json",
        "x-revalidate-token": secret,
      },
      body: JSON.stringify({ paths }),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`revalidate unreachable ${redactRevalidateSecret(message, secret).slice(0, 180)}`);
  }
  if (!response.ok) {
    let text = "";
    try {
      text = await response.text();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      text = message;
    }
    throw new Error(`revalidate ${response.status} ${redactRevalidateSecret(text, secret).slice(0, 180)}`);
  }
  return { itemsIn: slugs.length, itemsOut: paths.length, meta: { date, paths } };
}
