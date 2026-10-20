import { NextResponse } from "next/server";
import { requestResend } from "@/lib/newsletter/subscribe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clientIp(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  if (first) return first.slice(0, 80);
  const real = request.headers.get("x-real-ip")?.trim();
  return real ? real.slice(0, 80) : null;
}

/** Always `{ok:true, sent}`. A missing address and a rate limit share that shape. */
export async function POST(request: Request) {
  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: true, sent: false });
  }
  const result = await requestResend({
    email: body.email,
    locale: body.locale,
    source: body.source,
    ip: clientIp(request),
  });
  return NextResponse.json(result);
}
