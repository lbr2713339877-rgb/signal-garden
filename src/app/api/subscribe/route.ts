import { NextResponse } from "next/server";
import { subscribeResponse } from "@/lib/newsletter/placement";
import { requestSubscribe } from "@/lib/newsletter/subscribe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clientIp(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  if (first) return first.slice(0, 80);
  const real = request.headers.get("x-real-ip")?.trim();
  return real ? real.slice(0, 80) : null;
}

export async function POST(request: Request) {
  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_email" }, { status: 400 });
  }
  const result = await requestSubscribe({
    email: body.email,
    honeypot: body.company ?? body.website,
    formStartedAt: body.formStartedAt,
    turnstileToken: body.turnstileToken,
    locale: body.locale,
    source: body.source,
    ip: clientIp(request),
    userAgent: request.headers.get("user-agent"),
    acceptLanguage: request.headers.get("accept-language"),
  });
  const http = subscribeResponse(result);
  return NextResponse.json(http.body, { status: http.status });
}
