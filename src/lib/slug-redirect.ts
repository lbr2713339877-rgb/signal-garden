import { permanentRedirect } from "next/navigation";
import { resolveSlug } from "@/lib/slug-alias";

export function querySuffix(search: Record<string, string | string[] | undefined>): string {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(search)) {
    if (typeof value === "string") qs.append(key, value);
    else if (Array.isArray(value)) for (const item of value) qs.append(key, item);
  }
  const text = qs.toString();
  return text ? `?${text}` : "";
}

/** 308 to the current slug, keeping the query string. `suffix` is `/classic`. */
export function redirectAlias(
  prefix: "/p" | "/feedback",
  slug: string,
  search: Record<string, string | string[] | undefined>,
  suffix = "",
): never {
  permanentRedirect(`${prefix}/${slug}${suffix}${querySuffix(search)}`);
}

export async function redirectIfAlias(
  prefix: "/p" | "/feedback",
  slug: string,
  search: Record<string, string | string[] | undefined>,
  suffix = "",
): Promise<void> {
  const resolved = await resolveSlug(slug);
  if (resolved?.redirectTo) redirectAlias(prefix, resolved.redirectTo, search, suffix);
}
