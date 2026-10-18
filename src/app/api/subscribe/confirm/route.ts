import { NextResponse } from "next/server";
import { confirmNewsletter } from "@/lib/newsletter/subscribe";
import { siteOrigin } from "@/lib/edition";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function tokenFrom(request: Request): Promise<string> {
  const url = new URL(request.url);
  const query = url.searchParams.get("t");
  if (query) return query;
  const type = request.headers.get("content-type") ?? "";
  if (type.includes("application/json")) {
    const body = await request.json().catch(() => null) as { t?: unknown } | null;
    return typeof body?.t === "string" ? body.t : "";
  }
  const form = await request.formData().catch(() => null);
  const value = form?.get("t");
  return typeof value === "string" ? value : "";
}

/** The confirm page posts here. A GET of the email link never reaches this handler. */
export async function POST(request: Request) {
  const token = await tokenFrom(request);
  const outcome = await confirmNewsletter(token);
  // Behind nginx request.url is http://localhost:3000; always redirect to the public origin.
  const dest = new URL("/subscribe/confirm", siteOrigin());
  dest.search = "";
  dest.searchParams.set("status", outcome);
  return NextResponse.redirect(dest, 303);
}
