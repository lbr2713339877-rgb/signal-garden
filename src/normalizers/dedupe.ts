/**
 * Dedupe keys, in the brief's priority order (section 八):
 *   1. GitHub repository id        -> "gh:<id>"
 *   2. GitHub canonical URL        -> "url:github.com/owner/name"
 *   3. Official website domain     -> "domain:<host>"
 *   4. Product Hunt slug           -> "ph:<slug>"            (v2)
 *   5. name + author               -> "name:<owner>/<name>"
 *   6/7. title similarity / AI     -> Phase 2
 *
 * GitHub-sourced projects always resolve at step 1, which survives renames and
 * transfers. The other keys exist for sources that have no repository id.
 */

export function canonicalId(input: {
  githubId?: number | null;
  githubUrl?: string | null;
  domain?: string | null;
  phSlug?: string | null;
  owner?: string | null;
  name?: string | null;
}): string {
  if (input.githubId) return `gh:${input.githubId}`;
  const url = input.githubUrl ? canonicalGithubUrl(input.githubUrl) : null;
  if (url) return `url:${url}`;
  if (input.domain) return `domain:${input.domain.toLowerCase()}`;
  if (input.phSlug) return `ph:${input.phSlug.toLowerCase()}`;
  return `name:${(input.owner ?? "").toLowerCase()}/${(input.name ?? "").toLowerCase()}`;
}

/** "https://GitHub.com/Foo/Bar.git#readme" -> "github.com/foo/bar" */
export function canonicalGithubUrl(url: string): string | null {
  const m = url.match(/github\.com[/:]([\w.-]+)\/([\w.-]+?)(\.git)?(?:[/?#]|$)/i);
  return m ? `github.com/${m[1].toLowerCase()}/${m[2].toLowerCase()}` : null;
}

/** Homepage host, ignoring hosts that identify GitHub rather than the project. */
export function homepageDomain(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const host = new URL(url.startsWith("http") ? url : `https://${url}`).hostname.replace(/^www\./, "").toLowerCase();
    if (!host.includes(".") || /(^|\.)github\.(com|io)$/.test(host) || host === "npmjs.com" || host === "pypi.org") return null;
    return host;
  } catch {
    return null;
  }
}
