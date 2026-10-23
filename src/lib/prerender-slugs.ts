import { projectPagePaths } from "@/lib/project-revalidate";

/**
 * Slugs to prebuild for /p/[slug].
 * Today's published edition stays first. The SEO pilot set is added after it.
 * A slug in both lists is emitted once. Anything that is not a public slug is dropped.
 */
export function unionPrerenderSlugs(edition: readonly string[], pilot: Iterable<string>): string[] {
  return projectPagePaths([...edition, ...pilot]).map((path) => path.slice("/p/".length));
}
