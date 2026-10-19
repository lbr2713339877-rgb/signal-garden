/** Paths that should 308 when the slug is an alias. Image routes are not included. */
export function aliasRedirectPath(pathname: string): { slug: string; prefix: "/p" | "/feedback"; suffix: string } | null {
  let match = pathname.match(/^\/p\/([^/]+)\/classic\/?$/);
  if (match) return { slug: decodeURIComponent(match[1]), prefix: "/p", suffix: "/classic" };
  match = pathname.match(/^\/p\/([^/]+)\/?$/);
  if (match) return { slug: decodeURIComponent(match[1]), prefix: "/p", suffix: "" };
  match = pathname.match(/^\/feedback\/([^/]+)\/?$/);
  if (match) return { slug: decodeURIComponent(match[1]), prefix: "/feedback", suffix: "" };
  return null;
}

export function isSlug(value: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}

/**
 * Loopback to the Node listener. A fetch built from the public request URL is
 * rewritten to https://localhost:3000 behind nginx and fails with EPROTO.
 */
export function aliasLookupUrl(slug: string): URL {
  const url = new URL("http://127.0.0.1:3000/api/slug-alias");
  url.searchParams.set("slug", slug);
  return url;
}
