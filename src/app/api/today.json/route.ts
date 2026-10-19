import { NextResponse } from "next/server";
import { getFeedEdition } from "@/db/queries";
import { countApiRequest } from "@/lib/api-counter";
import { TODAY_LIMIT, siteOrigin } from "@/lib/edition";
import { todayJson } from "@/lib/today-json";

export const dynamic = "force-dynamic";

const HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "public, s-maxage=600",
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, OPTIONS",
};

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: HEADERS });
}

export async function GET() {
  const edition = await getFeedEdition(TODAY_LIMIT);
  const body = todayJson({ date: edition.date, cards: edition.cards, origin: siteOrigin() });
  try {
    await countApiRequest("/api/today.json");
  } catch (error) {
    console.error("[api/today.json] counter failed", error);
  }
  return NextResponse.json(body, { headers: HEADERS });
}
