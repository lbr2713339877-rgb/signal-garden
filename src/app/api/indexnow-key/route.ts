import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const TEXT = { "content-type": "text/plain; charset=utf-8" };

/**
 * Public IndexNow key file. The key is not a secret; Bing fetches it.
 * `k` comes from the next.config rewrite of `/<key>.txt`. A direct call
 * without that exact key is a 404, so the route does not publish a different key.
 */
export function GET(request: Request) {
  const provided = new URL(request.url).searchParams.get("k")?.trim() ?? "";
  const key = process.env.INDEXNOW_KEY?.trim() ?? "";
  if (!key || provided !== key) {
    return new NextResponse("Not found", { status: 404, headers: TEXT });
  }
  return new NextResponse(key, {
    status: 200,
    headers: { ...TEXT, "cache-control": "public, max-age=3600" },
  });
}
