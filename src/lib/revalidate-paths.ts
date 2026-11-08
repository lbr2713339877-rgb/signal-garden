import { NextResponse } from "next/server";
import { authorizeRevalidateRequest } from "@/lib/revalidate-secret";

const PATH = /^\/p\/[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function selectProjectPaths(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((path): path is string => typeof path === "string" && PATH.test(path)))];
}

/**
 * Refuses before reading the body. A missing secret, a bad token, or a
 * non-loopback host never reaches `revalidate`. Proxy headers are ignored.
 */
export async function handleRevalidatePaths(
  request: Request,
  revalidate: (path: string) => void,
): Promise<Response> {
  if (!authorizeRevalidateRequest(request)) return NextResponse.json({ ok: false }, { status: 403 });
  const body = await request.json().catch(() => null) as { paths?: unknown } | null;
  const paths = selectProjectPaths(body?.paths);
  for (const path of paths) revalidate(path);
  return NextResponse.json({ ok: true, paths });
}
