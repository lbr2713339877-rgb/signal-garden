import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Public IndexNow key file. The key is not a secret; Bing fetches it. */
export function GET() {
  const key = process.env.INDEXNOW_KEY?.trim() ?? "";
  if (!key) return new NextResponse("Not found", { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } });
  return new NextResponse(key, {
    status: 200,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  });
}
