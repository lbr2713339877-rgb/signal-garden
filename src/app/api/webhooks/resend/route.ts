import { NextResponse } from "next/server";
import { applyNewsletterWebhook, verifyResendWebhook, WebhookSecretError } from "@/lib/newsletter/webhook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const payload = await request.text();
  try {
    const event = verifyResendWebhook({
      payload,
      id: request.headers.get("svix-id"),
      timestamp: request.headers.get("svix-timestamp"),
      signature: request.headers.get("svix-signature"),
    });
    await applyNewsletterWebhook(event);
    return new NextResponse("OK", { status: 200 });
  } catch (err) {
    if (err instanceof WebhookSecretError) {
      return new NextResponse("webhook secret is not configured", { status: 401 });
    }
    return new NextResponse("invalid signature", { status: 400 });
  }
}
