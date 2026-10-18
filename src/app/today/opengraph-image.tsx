import { getFeedEdition } from "@/db/queries";
import { signalDate } from "@/lib/day";
import { renderTodayOg } from "@/lib/og/render";

export const runtime = "nodejs";
export const alt = "Signal Garden — Today";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
// Same process as the site. A build-time prerender races the PGlite lock and
// would publish an empty card, so this stays fresh with /today.
export const revalidate = 0;

export default async function Image() {
  try {
    const edition = await getFeedEdition(5);
    return renderTodayOg({
      date: String(edition.date),
      projects: edition.cards.slice(0, 5).map((card) => ({
        name: card.name,
        forks7d: card.forks7d,
      })),
    });
  } catch (error) {
    console.error("[og] today image failed", error);
    return renderTodayOg({ date: signalDate(), projects: [] });
  }
}
