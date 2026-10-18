import { getProjectBySlug } from "@/db/queries";
import { renderProjectOg } from "@/lib/og/render";

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
    const data = await getProjectBySlug(slug);
    if (!data) return renderProjectOg({ name: slug, owner: null, forks7d: null, missing: true });
    const project = data.project;
    return renderProjectOg({
      name: project.name || slug,
      owner: ownerOf(project.owner, project.fullName),
      forks7d: project.forks7d,
    });
  } catch (error) {
    console.error("[og] project image failed", slug, error);
    return renderProjectOg({ name: slug, owner: null, forks7d: null, missing: true });
  }
}
