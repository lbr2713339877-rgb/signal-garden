import { NextResponse } from "next/server";
import { resolveSlug } from "@/lib/slug-alias";
import { isSlug } from "@/lib/slug-redirect-path";

export const dynamic = "force-dynamic";

/** Used by middleware to turn an old slug into a real HTTP 308 before the page streams. */
export async function GET(request: Request) {
  const slug = new URL(request.url).searchParams.get("slug")?.trim() ?? "";
  if (!isSlug(slug)) return NextResponse.json({ redirectTo: null });
  const resolved = await resolveSlug(slug);
  return NextResponse.json(
    { redirectTo: resolved?.redirectTo ?? null },
    { headers: { "cache-control": "no-store" } },
  );
}
