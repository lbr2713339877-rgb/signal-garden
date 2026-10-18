/**
 * Local smoke for subscribe → confirm → unsubscribe.
 * Uses the mock transport. Refuses to run in live send mode.
 *
 *   DATABASE_URL= PGLITE_DIR=./data/newsletter-smoke pnpm db:migrate
 *   DATABASE_URL= PGLITE_DIR=./data/newsletter-smoke pnpm exec tsx scripts/newsletter-smoke.ts
 */
import { eq } from "drizzle-orm";
import { closeDb, db } from "../src/db/client";
import { newsletterSubscriber } from "../src/db/schema";
import { loadLocalEnv } from "../src/lib/env";
import { POST as subscribe } from "../src/app/api/subscribe/route";
import { POST as confirm } from "../src/app/api/subscribe/confirm/route";
import { POST as unsubscribe } from "../src/app/api/unsubscribe/route";
import { inspectConfirm } from "../src/lib/newsletter/subscribe";
import { newsletterOutbox, resetNewsletterOutbox } from "../src/lib/newsletter/transport";

process.env.NEWSLETTER_SEND_MODE = "mock";
process.env.DATABASE_URL = "";
process.env.PGLITE_DIR ||= "./data/newsletter-smoke";
process.env.NEXT_PUBLIC_SITE_URL ||= "https://signalgarden.site";
loadLocalEnv();
process.env.NEWSLETTER_SEND_MODE = "mock";
process.env.DATABASE_URL = "";

const email = `smoke-${Date.now()}@example.com`;
const started = Date.now() - 5_000;

function tokenIn(html: string, path: string): string {
  const match = html.match(new RegExp(`${path}\\?t=([A-Za-z0-9_-]+)`));
  if (!match) throw new Error(`missing token for ${path}`);
  return match[1];
}

async function main() {
  resetNewsletterOutbox();
  const subscribed = await subscribe(new Request("http://127.0.0.1/api/subscribe", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.50" },
    body: JSON.stringify({ email, company: "", locale: "zh", source: "footer", formStartedAt: started }),
  }));
  if (subscribed.status !== 200) throw new Error(`subscribe status ${subscribed.status}`);
  const confirmMail = newsletterOutbox().find((mail) => mail.to === email && mail.idempotencyKey.startsWith("newsletter-confirm/"));
  if (!confirmMail) throw new Error("mock transport did not log a confirmation");
  const token = tokenIn(confirmMail.html, "/subscribe/confirm");
  if ((await inspectConfirm(token)).state !== "pending") throw new Error("opening the link changed state");

  const confirmed = await confirm(new Request("http://127.0.0.1/api/subscribe/confirm", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ t: token }),
  }));
  if (confirmed.status !== 303) throw new Error(`confirm status ${confirmed.status}`);
  const database = await db();
  const [active] = await database.select().from(newsletterSubscriber).where(eq(newsletterSubscriber.email, email));
  if (active?.status !== "active") throw new Error(`expected active, got ${active?.status}`);

  const unsubToken = tokenIn(confirmMail.html, "/unsubscribe");
  const removed = await unsubscribe(new Request(`http://127.0.0.1/api/unsubscribe?t=${encodeURIComponent(unsubToken)}`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: "List-Unsubscribe=One-Click",
  }));
  if (removed.status !== 200) throw new Error(`unsubscribe status ${removed.status}`);
  const [done] = await database.select().from(newsletterSubscriber).where(eq(newsletterSubscriber.id, active.id));
  if (done?.status !== "unsubscribed") throw new Error(`expected unsubscribed, got ${done?.status}`);
  console.log(`[newsletter-smoke] ${email} pending → active → unsubscribed via mock transport`);
}

main()
  .then(() => closeDb())
  .catch(async (err) => {
    console.error("[newsletter-smoke] failed:", err);
    await closeDb().catch(() => {});
    process.exit(1);
  });
