import { NextResponse } from "next/server";

const PATH = /^\/p\/[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * The daily job calls the route on loopback after publish. A proxied public
 * request carries X-Forwarded-For or a public Host and is refused.
 */
export function isLocalRevalidateRequest(request: Request): boolean {
  if (request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip")) return false;
  let host = request.headers.get("host");
  if (!host) {
    try {
      host = new URL(request.url).host;
    } catch {
      return false;
    }
  }
  return host.startsWith("127.0.0.1") || host.startsWith("localhost") || host.startsWith("[::1]");
}

export function selectProjectPaths(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((path): path is string => typeof path === "string" && PATH.test(path)))];
}

export async function handleRevalidatePaths(
  request: Request,
  revalidate: (path: string) => void,
): Promise<Response> {
  if (!isLocalRevalidateRequest(request)) return NextResponse.json({ ok: false }, { status: 403 });
  const body = await request.json().catch(() => null) as { paths?: unknown } | null;
  const paths = selectProjectPaths(body?.paths);
  for (const path of paths) revalidate(path);
  return NextResponse.json({ ok: true, paths });
}
