import { getProjectBySlug } from "@/db/queries";
import { renderProjectOg } from "@/lib/og/render";
import { snapshotStarGrowth } from "@/lib/star-growth";
import { canonicalProjectSlug } from "@/lib/slug-alias";

export const runtime = "nodejs";
export const alt = "Signal Garden";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const revalidate = 3600;

function ownerOf(owner: string | null, fullName: string | null): string | null {
  const direct = owner?.trim();
  if (direct) return direct;
  const fromFull = fullName?.split("/")[0]?.trim();
  return fromFull || null;
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  try {
    const data = await getProjectBySlug(await canonicalProjectSlug(slug));
    if (!data) return renderProjectOg({ name: slug, owner: null, missing: true });
    const project = data.project;
    const growth = snapshotStarGrowth(data.history);
    return renderProjectOg({
      name: project.name || slug,
      owner: ownerOf(project.owner, project.fullName),
      starsFrom: growth?.from ?? null,
      starsTo: growth?.to ?? null,
      starsRecent: growth ? null : (project.stars7d ?? project.stars24h),
      heatScore: project.heatScoreLatest,
    });
  } catch (error) {
    console.error("[og] project image failed", slug, error);
    return renderProjectOg({ name: slug, owner: null, missing: true });
  }
}
