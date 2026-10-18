/**
 * Rule-based category, tags and difficulty.
 *
 * The primary category here is a first pass (category_source = "rules"). The
 * AI step in Phase 2 may refine it and an operator may override it; the source
 * is recorded so the publish gate knows how the category was decided.
 */

import type { Category, Difficulty, SkillType } from "@/db/schema";
import type { InstallKind } from "@/parsers/types";

type Domain = Exclude<Category, "skill" | "agent" | "devtool">;

const DOMAIN_KEYWORDS: Record<Domain | "agent" | "devtool", RegExp[]> = {
  browser: [/\bplaywright\b/i, /\bpuppeteer\b/i, /\bselenium\b/i, /\bbrowser[\s-](use|automation|agent|control)\b/i, /\bheadless\b/i, /\bweb[\s-]?scrap(ing|er)\b/i, /\bcrawl(er|ing)\b/i, /\bchrome devtools\b/i, /浏览器/],
  design: [/\bdesign(er|s)?\b/i, /\bui\b/i, /\bux\b/i, /\bfigma\b/i, /\btailwind\b/i, /\bshadcn\b/i, /\bcss\b/i, /\bfrontend\b/i, /\banimation\b/i, /\btypography\b/i, /设计|界面/],
  media: [/\bvideo\b/i, /\baudio\b/i, /\bimage (generation|editing)\b/i, /\bffmpeg\b/i, /\bpodcast\b/i, /\btts\b|text[\s-]to[\s-]speech/i, /\bsubtitles?\b/i, /\bmusic\b/i, /视频|音频|图片/],
  data: [/\bresearch\b/i, /\banalytics\b/i, /\bdatasets?\b/i, /\bsql\b/i, /\bpostgres\b/i, /\bscraping\b/i, /\barxiv\b/i, /\bpapers?\b/i, /\bRAG\b/, /\bvector (db|database|search)\b/i, /\bknowledge (base|graph)\b/i, /数据|研究/],
  productivity: [/\bnotion\b/i, /\bobsidian\b/i, /\bcalendar\b/i, /\bemail\b/i, /\bgmail\b/i, /\bslack\b/i, /\bspreadsheets?\b/i, /\bexcel\b/i, /\bdocx?\b/i, /\bpptx?\b/i, /\bpdf\b/i, /\bmeeting\b/i, /\btodo\b/i, /办公|效率/],
  security: [/\bsecurity\b/i, /\bpentest(ing)?\b/i, /\bvulnerab/i, /\bCVE\b/, /\bSAST\b/, /\bprivacy\b/i, /\bsecrets? (scan|detect)/i, /\bred[\s-]team\b/i, /安全|隐私/],
  marketing: [/\bSEO\b/, /\bmarketing\b/i, /\bgrowth\b/i, /\bads\b/i, /\bCRM\b/, /\bsales\b/i, /\bcopywriting\b/i, /\bsocial media\b/i, /营销|增长/],
  agent: [/\bmulti[\s-]agents?\b/i, /\bautonomous\b/i, /\bagent (framework|runtime|orchestration)\b/i, /\bagentic\b/i],
  devtool: [/\bgit\b/i, /\bCI\/?CD\b/i, /\btesting\b/i, /\bdebug/i, /\bcode review\b/i, /\blinter?\b/i, /\bIDE\b/, /\bterminal\b/i, /\bCLI\b/, /\brefactor/i],
};

export interface CategoryInput {
  name: string;
  description: string | null;
  topics: string[];
  readme: string;
  skillType: SkillType;
}

export interface CategoryResult {
  category: Category;
  scores: Record<string, number>;
}

function score(input: CategoryInput, res: RegExp[]): number {
  const fields: [string, number][] = [
    [input.topics.join(" ").replace(/-/g, " "), 3],
    [input.name.replace(/[-_]/g, " "), 3],
    [input.description ?? "", 2],
  ];
  let s = 0;
  for (const [text, w] of fields) s += res.filter((r) => r.test(text)).length * w;
  // README: distinct keywords only, capped, so one long README cannot swamp the signal.
  s += Math.min(3, res.filter((r) => r.test(input.readme.slice(0, 4000))).length);
  return s;
}

export function categorize(input: CategoryInput): CategoryResult {
  const scores: Record<string, number> = {};
  for (const [k, res] of Object.entries(DOMAIN_KEYWORDS)) scores[k] = score(input, res);

  const domains = (Object.keys(scores) as (keyof typeof DOMAIN_KEYWORDS)[]).filter((k) => k !== "agent" && k !== "devtool");
  const best = domains.reduce((a, b) => (scores[b] > scores[a] ? b : a), domains[0]);

  // A strong domain signal wins: a frontend-design Skill belongs to Design & UI.
  if (scores[best] >= 4) return { category: best, scores };
  if (input.skillType === "skill" || input.skillType === "mcp") return { category: "skill", scores };
  if (input.skillType === "agent" || scores.agent >= 4) return { category: "agent", scores };
  if (scores[best] >= 2) return { category: best, scores };
  return { category: "devtool", scores };
}

/* ---------------------------------------------------------------------------
   Tags — the brief's curated vocabulary only
   ------------------------------------------------------------------------ */

const AGENT_TAG: Record<string, string> = {
  "claude-code": "Claude Code",
  "claude-desktop": "Claude Desktop",
  codex: "Codex",
  cursor: "Cursor",
};

export function deriveTags(opts: {
  agents: string[];
  skillType: SkillType;
  category: Category;
  language: string | null;
  topics: string[];
  dependencies: string[];
  readme: string;
  license: string | null;
  difficulty: Difficulty | null;
  docsOk: boolean;
}): string[] {
  const tags = new Set<string>();
  for (const a of opts.agents) if (AGENT_TAG[a]) tags.add(AGENT_TAG[a]);
  if (opts.skillType === "mcp" || opts.topics.some((t) => /^mcp/.test(t))) tags.add("MCP");
  if (opts.category === "browser") tags.add("Browser");

  const blob = `${opts.topics.join(" ")} ${opts.dependencies.join(" ")} ${opts.readme.slice(0, 6000)}`;
  if (/playwright/i.test(blob)) tags.add("Playwright");
  if (opts.dependencies.includes("react") || opts.topics.includes("react")) tags.add("React");
  if (opts.dependencies.includes("next") || opts.topics.includes("nextjs")) tags.add("Next.js");
  if (opts.language === "Python") tags.add("Python");
  if (opts.language === "TypeScript") tags.add("TypeScript");
  if (/\bollama\b|llama\.cpp|local[\s-](llm|model|ai)/i.test(blob)) tags.add("Local AI");
  if (/\bno[\s-]?code\b|\blow[\s-]?code\b/i.test(blob)) tags.add("No-code");
  if (/\bautomat(e|ion|ing)\b/i.test(blob)) tags.add("Automation");
  if (opts.license) tags.add("Open Source");
  if (opts.difficulty === "one_click" && opts.docsOk) tags.add("Beginner Friendly");
  return [...tags].slice(0, 8);
}

/* ---------------------------------------------------------------------------
   Difficulty
   The easiest documented install sets the baseline; requirements raise it.
   No identified install method -> null, which fails the publish gate.
   ------------------------------------------------------------------------ */

const ORDER: Difficulty[] = ["one_click", "simple_config", "needs_api_key", "needs_local", "needs_dev", "expert"];

const KIND_LEVEL: Record<InstallKind, Difficulty> = {
  "claude-plugin": "one_click",
  "claude-mcp": "one_click",
  "skills-cli": "one_click",
  npx: "one_click",
  "manual-copy": "simple_config",
  "mcp-config": "simple_config",
  npm: "simple_config",
  uv: "simple_config",
  pipx: "simple_config",
  pip: "simple_config",
  brew: "simple_config",
  "curl-pipe": "simple_config",
  docker: "needs_local",
  cargo: "needs_dev",
  go: "needs_dev",
  "git-clone": "needs_dev",
};

export function deriveDifficulty(
  kinds: InstallKind[],
  req: { apiKey: boolean; local: boolean; docker: boolean },
): Difficulty | null {
  if (kinds.length === 0) return null;
  let level = Math.min(...kinds.map((k) => ORDER.indexOf(KIND_LEVEL[k])));
  if (req.apiKey) level = Math.max(level, ORDER.indexOf("needs_api_key"));
  if (req.local || req.docker) level = Math.max(level, ORDER.indexOf("needs_local"));
  return ORDER[level];
}
