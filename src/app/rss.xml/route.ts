import { NextResponse } from "next/server";
import { siteOrigin } from "@/lib/edition";

export const dynamic = "force-dynamic";

/** Older clients look for /rss.xml. The canonical feed is /feed.xml. */
export function GET() {
  return NextResponse.redirect(new URL("/feed.xml", siteOrigin()), 308);
}
