import { getArchiveEditions, getFeedEdition, type ProjectCard } from "@/db/queries";
import {
  editionDay,
  selectWeeklyEditions,
  weeklyHeatRanking,
  WEEKLY_HEAT_TOP,
  WEEKLY_WINDOW_DAYS,
  type WeeklyHeatWindow,
} from "@/lib/weekly-ranking";
import type { WeeklySampleCard } from "@/lib/weekly-sample";

function sampleCard(card: ProjectCard): WeeklySampleCard {
  return {
    name: card.name,
    slug: card.slug,
    zh: card.oneLiner || card.hook || card.description || card.name,
    en: card.oneLinerEn || card.hookEn || card.description || card.name,
  };
}

/** Live Top 10 for the homepage. Same editions the Monday mailer would send. */
export async function getThisWeekHeatTop(top = WEEKLY_HEAT_TOP): Promise<WeeklyHeatWindow> {
  const today = await getFeedEdition(top);
  const archive = await getArchiveEditions(WEEKLY_WINDOW_DAYS);
  const editions = selectWeeklyEditions({
    today: {
      date: editionDay(today.date),
      isPrevious: today.isPrevious,
      cards: today.cards,
    },
    archive: archive.map((edition) => ({
      date: editionDay(edition.date),
      cards: edition.cards,
    })),
    days: WEEKLY_WINDOW_DAYS,
  });
  return weeklyHeatRanking(
    editions.map((edition) => ({
      date: edition.date,
      cards: edition.cards.map(sampleCard),
    })),
    top,
  );
}
