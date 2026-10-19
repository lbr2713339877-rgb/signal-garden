import { CONTACT_EMAIL, RANKING_EN_SHORT } from "@/lib/site";
import { siteOrigin } from "@/lib/edition";

/** Plain-text briefing for agents that fetch /llms.txt. */
export function llmsTxt(origin = siteOrigin()): string {
  const base = origin.replace(/\/+$/, "");
  return `# Signal Garden

> Signal Garden (今日信号) is a daily discovery site for developers. It reads public signals and publishes a short list of tools, AI skills, MCP servers, agents, and developer resources worth opening. The site is bilingual (中文 / English). Chinese is the default.

One edition is published each day. A listing means the project was recommended here for the first time that day. It does not mean the project itself just launched. The daily list is ${RANKING_EN_SHORT}. Do not treat a lifetime star count as the signal.

The email newsletter is the Monday weekly digest (每周一周刊).

## Key URLs

- [Home](${base}/): the current edition
- [Today](${base}/today): the full daily list, headline first
- [Feed](${base}/feed.xml): RSS 2.0 for the current edition
- [Today JSON](${base}/api/today.json): the current edition as JSON (rank, repository, descriptions, stars, 24-hour and 7-day star growth, heat score, 7-day new forks when present). Project links may take an optional \`utm_source\`.
- [Project](${base}/p/{slug}): one project. Replace {slug} with the project slug
- [Sponsor](${base}/sponsor): sponsorships for the daily list and the Monday weekly digest (每周一周刊). No rate card

## Contact

${CONTACT_EMAIL}

## Crawling

This file, /api/today.json, and the public pages above may be fetched. robots.txt allows / and /api/today.json, and disallows other /api/ paths, /settings, and /my-garden.
`;
}
