import { NextResponse } from "next/server";
import { featuredRepo } from "@/db/queries/featured";
import { badgeTheme, featuredBadgeSvg, isRepoSegment, repoSvgName } from "@/lib/badge";
import { badgeAliasPath } from "@/lib/slug-alias";

export const dynamic = "force-dynamic";

const HIT = "public, max-age=86400, s-maxage=86400";
const MISS = "public, max-age=300, s-maxage=300";

export async function GET(
  request: Request,
  context: { params: Promise<{ owner: string; repo: string }> },
) {
  const { owner, repo: repoFile } = await context.params;
  const repo = repoSvgName(repoFile);
  const theme = badgeTheme(new URL(request.url).searchParams.get("theme"));
  if (!repo || !isRepoSegment(owner)) {
    return new NextResponse("Not found", {
      status: 404,
      headers: { "content-type": "text/plain; charset=utf-8", "cache-control": MISS },
    });
  }
  const renamed = await badgeAliasPath(owner, repo);
  if (renamed) {
    return new NextResponse(null, {
      status: 308,
      headers: {
        location: theme === "dark" ? `${renamed}?theme=dark` : renamed,
        "cache-control": MISS,
      },
    });
  }
  if (!(await featuredRepo(owner, repo))) {
    return new NextResponse("Not found", {
      status: 404,
      headers: { "content-type": "text/plain; charset=utf-8", "cache-control": MISS },
    });
  }
  return new NextResponse(featuredBadgeSvg(theme), {
    status: 200,
    headers: {
      "content-type": "image/svg+xml; charset=utf-8",
      "cache-control": HIT,
      "x-content-type-options": "nosniff",
    },
  });
}
