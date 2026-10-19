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
