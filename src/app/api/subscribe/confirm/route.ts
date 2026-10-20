import { NextResponse } from "next/server";
import { confirmNewsletter } from "@/lib/newsletter/subscribe";
import { confirmStatusQuery } from "@/lib/newsletter/placement";
import { siteOrigin } from "@/lib/edition";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function confirmFields(request: Request): Promise<{ token: string; location: unknown }> {
  const url = new URL(request.url);
  const type = request.headers.get("content-type") ?? "";
  if (type.includes("application/json")) {
    const body = await request.json().catch(() => null) as { t?: unknown; loc?: unknown } | null;
    const token = typeof body?.t === "string" ? body.t : (url.searchParams.get("t") ?? "");
    return { token, location: body?.loc ?? url.searchParams.get("loc") };
  }
  if (type.includes("application/x-www-form-urlencoded") || type.includes("multipart/form-data")) {
    const form = await request.formData().catch(() => null);
    const tokenValue = form?.get("t");
    const locValue = form?.get("loc");
    return {
      token: typeof tokenValue === "string" ? tokenValue : (url.searchParams.get("t") ?? ""),
      location: typeof locValue === "string" ? locValue : url.searchParams.get("loc"),
    };
  }
  return { token: url.searchParams.get("t") ?? "", location: url.searchParams.get("loc") };
}

/** The confirm page posts here. A GET of the email link never reaches this handler. */
export async function POST(request: Request) {
  const { token, location } = await confirmFields(request);
  const outcome = await confirmNewsletter(token);
  // Behind nginx request.url is http://localhost:3000; always redirect to the public origin.
  const dest = new URL("/subscribe/confirm", siteOrigin());
  dest.search = confirmStatusQuery(outcome, location);
  return NextResponse.redirect(dest, 303);
}
