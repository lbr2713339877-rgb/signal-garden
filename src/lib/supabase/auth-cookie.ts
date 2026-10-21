/**
 * Supabase Auth session cookies are named `sb-<project-ref>-auth-token`,
 * with oversized sessions split into `sb-<project-ref>-auth-token.0` chunks.
 * A request with none of these has nothing for `auth.getUser()` to refresh.
 */
export function hasSupabaseAuthCookie(names: Iterable<string>): boolean {
  for (const name of names) {
    if (name.startsWith("sb-") && name.includes("auth-token")) return true;
  }
  return false;
}
