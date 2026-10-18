import { NextResponse } from "next/server";
import { unsubscribeNewsletter } from "@/lib/newsletter/subscribe";
import { siteOrigin } from "@/lib/edition";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * RFC 8058 one-click target. Mail clients POST with no session.
 * The public page adds redirect=1 and is sent back to the confirmation screen.
 */
export async function POST(request: Request) {
  const url = new URL(request.url);
  let token = url.searchParams.get("t") ?? "";
  let redirect = url.searchParams.get("redirect") === "1";
  const type = request.headers.get("content-type") ?? "";
  if (!type.includes("application/json")) {
    const form = await request.clone().formData().catch(() => null);
    const formToken = form?.get("t");
    if (!token && typeof formToken === "string") token = formToken;
    if (form?.get("redirect") === "1") redirect = true;
  }
  const outcome = await unsubscribeNewsletter(token);
  if (redirect) {
    const dest = new URL("/unsubscribe", siteOrigin()); // not request.url: that is localhost behind nginx
    dest.search = "";
    dest.searchParams.set("status", outcome === "unsubscribed" || outcome === "already" || outcome === "suppressed" ? "unsubscribed" : "invalid");
    return NextResponse.redirect(dest, 303);
  }
  if (outcome === "invalid") return new NextResponse(null, { status: 400 });
  return new NextResponse(null, { status: 200 });
}
