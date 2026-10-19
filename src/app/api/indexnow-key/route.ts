import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const TEXT = { "content-type": "text/plain; charset=utf-8" };

const KEY_PATH = /^\/([0-9a-f]{32})\.txt$/;

/**
 * Public IndexNow key file. The key is not a secret; Bing fetches it.
 * The next.config rewrite targets `?k=`, but on Next 15.5 `request.url` can
 * still be the original `/<key>.txt` path with no query. Accept either.
 * A call that does not match INDEXNOW_KEY is a 404.
 */
export function GET(request: Request) {
  const url = new URL(request.url);
  const fromQuery = url.searchParams.get("k")?.trim() ?? "";
  const fromPath = url.pathname.match(KEY_PATH)?.[1] ?? "";
  const provided = fromQuery || fromPath;
  const key = process.env.INDEXNOW_KEY?.trim() ?? "";
  if (!key || provided !== key) {
    return new NextResponse("Not found", { status: 404, headers: TEXT });
  }
  return new NextResponse(key, {
    status: 200,
    headers: { ...TEXT, "cache-control": "public, max-age=3600" },
  });
}
