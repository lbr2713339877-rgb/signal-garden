import { getFeedEdition } from "@/db/queries";
import { siteOrigin } from "@/lib/edition";
import { FEED_CONTENT_TYPE, renderRss, toFeedChannel } from "@/lib/feed";

export const dynamic = "force-dynamic";

/** Public RSS 2.0 feed for the current published edition. */
export async function GET() {
  const edition = await getFeedEdition();
  const xml = renderRss(toFeedChannel({
    origin: siteOrigin(),
    date: edition.date,
    publishedAt: edition.publishedAt,
    cards: edition.cards,
  }));
  return new Response(xml, {
    headers: {
      "Content-Type": FEED_CONTENT_TYPE,
      "Cache-Control": "public, max-age=300",
    },
  });
}
