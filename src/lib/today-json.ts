import type { ProjectCard } from "@/db/queries";
import { ownerRepo } from "@/lib/badge";

export interface TodayJsonItem {
  rank: number;
  name: string;
  owner: string | null;
  repo: string | null;
  url: string;
  project_url: string;
  description: { zh: string | null; en: string | null };
  stars: number;
  stars_24h: number | null;
  stars_7d: number | null;
  heat_score: number | null;
  forks_7d: number | null;
  edition_date: string;
}

export interface TodayJson {
  edition_date: string;
  items: TodayJsonItem[];
}

/** The current edition in a stable public shape. `utm_source` is left to the caller. */
export function todayJson(input: { date: string; cards: ProjectCard[]; origin: string }): TodayJson {
  const origin = input.origin.replace(/\/+$/, "");
  const edition_date = input.date;
  return {
    edition_date,
    items: input.cards.map((card) => {
      const repo = ownerRepo(card.fullName);
      return {
        rank: card.rank ?? 0,
        name: card.name,
        owner: repo?.owner ?? card.owner ?? null,
        repo: repo?.repo ?? null,
        url: card.primaryUrl,
        project_url: `${origin}/p/${card.slug}`,
        description: {
          zh: card.oneLiner ?? card.description ?? null,
          en: card.oneLinerEn ?? null,
        },
        stars: card.stars,
        stars_24h: card.stars24h ?? null,
        stars_7d: card.stars7d ?? null,
        heat_score: card.heatScore ?? null,
        forks_7d: card.forks7d ?? null,
        edition_date,
      };
    }),
  };
}
