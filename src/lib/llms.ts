import { CONTACT_EMAIL } from "@/lib/site";
import { siteOrigin } from "@/lib/edition";

/** Plain-text briefing for agents that fetch /llms.txt. */
export function llmsTxt(origin = siteOrigin()): string {
  const base = origin.replace(/\/+$/, "");
  return `# Signal Garden

> Signal Garden (今日信号) is a daily discovery site for developers. It reads public signals and publishes a short list of tools, AI skills, MCP servers, agents, and developer resources worth opening. The site is bilingual (中文 / English). Chinese is the default.

One edition is published each day. A listing means the project was recommended here for the first time that day. It does not mean the project itself just launched. Cite the 7-day fork delta. Do not treat a lifetime star count as the signal.

## Key URLs

- [Home](${base}/): the current edition
- [Today](${base}/today): the full daily list, headline first
- [Feed](${base}/feed.xml): RSS 2.0 for the current edition
- [Project](${base}/p/{slug}): one project. Replace {slug} with the project slug
- [Sponsor](${base}/sponsor): sponsorships for the daily list and the Monday digest. No rate card

## Contact

${CONTACT_EMAIL}

## Crawling

This file and the public pages above may be fetched. robots.txt allows / and disallows /api/, /settings, and /my-garden.
`;
}
