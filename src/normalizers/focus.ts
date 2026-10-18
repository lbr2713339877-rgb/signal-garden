/**
 * Focus themes: the product's editorial scope.
 *
 * Signal Garden does not try to cover every Skill. It covers what an AI
 * indie-site builder and designer actually reaches for:
 *
 *   web     独立站开发  landing pages, Next.js / Tailwind, SEO, SaaS starters
 *   design  设计与 UI   design systems, UI/UX, Figma, taste
 *   motion  动效       animation libraries, GSAP, Three.js, scroll effects
 *   token   省 Token   context compression, token-cost reduction
 *
 * A project is in focus when any theme scores >= FOCUS_MIN. Out-of-focus
 * projects are kept in the database but are not parsed with priority and do
 * not rank.
 *
 * Bare words such as "design", "website" or "token" are deliberately not
 * patterns: "designed to", "a list of useful websites" and "access token"
 * would all match. Each pattern needs the phrase that makes it on-topic.
 */

export const FOCUS_THEMES = ["web", "design", "motion", "token", "play"] as const;
export type FocusTheme = (typeof FOCUS_THEMES)[number];

export const FOCUS_LABEL: Record<FocusTheme, string> = {
  web: "独立站开发",
  design: "设计与 UI",
  motion: "动效",
  token: "省 Token",
  play: "有意思的应用",
};

export const FOCUS_MIN = 3;

const TOPICS: Record<FocusTheme, string[]> = {
  play: ['ai-bot', 'telegram-bot', 'discord-bot', 'ai-assistant', 'video-editing', 'video-generation', 'image-generation', 'text-to-speech', 'interactive-art', 'creative-coding', 'browser-game', 'web-game'],
  web: ["landing-page", "landing-pages", "website-builder", "nextjs", "next-js", "astro", "tailwindcss", "tailwind", "shadcn", "shadcn-ui", "saas-boilerplate", "saas-starter", "saas-template", "indie-hacker", "indiehackers", "seo", "frontend", "web-development", "webdev", "vibe-coding"],
  design: ["design", "design-system", "design-systems", "ui", "ux", "ui-design", "ux-design", "ui-ux", "uiux", "figma", "ui-components", "component-library", "design-tokens", "typography"],
  motion: ["animation", "animations", "framer-motion", "motion", "gsap", "lottie", "threejs", "three-js", "webgl", "css-animations", "scroll-animation", "micro-interactions", "remotion", "shaders", "motion-design", "smooth-scroll", "scroll", "scrolltrigger", "parallax", "transitions", "spring", "spring-animation", "cursor", "scroll-effects", "animated"],
  token: ["token-optimization", "token-saving", "token-efficiency", "context-compression", "prompt-compression", "context-engineering", "cost-optimization", "llm-cost"],
};

export const PATTERNS: Record<FocusTheme, RegExp[]> = {
  play: [
    /\b(?:telegram|discord|wechat|slack|deepseek)\b[^.\n]{0,55}\b(?:bot|assistant|chat)\b/i,
    /\b(?:bot|assistant)\b[^.\n]{0,55}\b(?:telegram|discord|wechat|deepseek)\b/i,
    /\b(?:AI|automatic|conversational)\s+(?:video\s+)?(?:editor|editing|animation|music|voice|image|video)\b/i,
    /\b(?:image|video|music|voice)\s+(?:generation|generator|creation|cloning)\b/i,
    /\b(?:video editing|voice cloning|text[ -]to[ -](?:music|video|image))\b/i,
    /\b(?:cinematic|product launch|promotional|explainer)[\s-]+(?:videos?|films?)\b|产品发布视频|宣传视频|讲解视频/i,
    /\b(?:interactive art|creative coding|browser game|web game|AI companion|personal AI assistant)\b/i,
    /聊天机器人|群聊助手|视频剪辑|互动作品|网页游戏|语音克隆|音乐生成/,
  ],
  web: [
    /\blanding[\s-]?pages?\b/i,
    /\bwebsite (builder|generator)s?\b/i,
    /\bdeploys?\b[^.\n]{0,25}\b(site|landing page|website|web app)s?\b/i,
    /\bbuild(ing|s)? (a |your |beautiful |modern )?(web ?)?sites?\b/i,
    /\bindie[\s-]?hack/i,
    /\bsaas (starter|boilerplate|template|kit)s?\b/i,
    /\b(next\.?js|nuxt|sveltekit|astro)\b/i,
    /\btailwind(css)?\b/i,
    /\bshadcn\b/i,
    /\bSEO\b/,
    /\bfront[\s-]?end (development|design|skill|engineer)/i,
    /\bweb (development|design|app builder)\b/i,
    /\bvibe[\s-]?coding\b/i,
    /独立站|建站|落地页|前端开发/,
  ],
  design: [
    /\bui\s*[/&-]?\s*ux\b/i,
    /\bdesign (system|tokens?|language|skill|intelligence|taste)s?\b/i,
    /\bui (design|kit|components?|library)\b/i,
    /\bweb design\b/i,
    /\bfigma\b/i,
    /\bdesigners?\b/i,
    /\bdesign tokens?\b/i,
    /\btypography\b/i,
    /\bcolou?r (palette|scheme)s?\b/i,
    /\baesthetic/i,
    /\bbeautiful (ui|interfaces?|websites?|pages?|designs?)\b/i,
    /\bcomponent librar(y|ies)\b/i,
    /设计|界面|审美|配色/,
  ],
  motion: [
    /\banimat(ion|ions|ed|ing)\b/i,
    /\bmotion\b/i,
    /\bframer[\s-]motion\b/i,
    /\bgsap\b/i,
    /\blottie\b/i,
    /\bthree\.?js\b/i,
    /\bwebgl\b/i,
    /\bscroll[\s-](driven|trigger|animation|effect|library|snap|smooth)s?/i,
    /\bsmooth[\s-]?scroll(ing)?\b/i,
    /\bscroll(ing)? (library|experience|performance|interaction)s?\b/i,
    /\bspring(\s|-)?animation?s?\b/i,
    /\btransitions?\b/i,
    /\bcustom cursor\b/i,
    /\bcursor (effects?|animation)s?\b/i,
    /\bmicro[\s-]?interactions?\b/i,
    /\bremotion\b/i,
    /\bshaders?\b/i,
    /\bparallax\b/i,
    /动效|动画|过渡效果/,
  ],
  token: [
    /\b(save|saves|saving|reduce[sd]?|reducing|cut|cuts|lower|minimi[sz]e[sd]?)\b[^.\n]{0,25}\btokens?\b/i,
    /\btokens?[\s-](saving|efficien\w*|usage|consumption|budget|cost|optimi[sz]\w*|compression)\b/i,
    /\bfew(er)? tokens?\b/i,
    /\bmany tokens?\b[^.\n]{0,30}\bfew\b/i,
    /\bcontext[\s-](compression|compaction|window (management|optimi[sz]\w*))\b/i,
    /\bprompt (compression|caching)\b/i,
    // "compress" alone would match a zip utility; require an LLM-payload noun.
    /\bcompress(es|ion|ing)?\b[^.\n]{0,40}\b(context|prompts?|tool outputs?|logs|rag chunks?|chunks|embeddings?)\b/i,
    /\b(RAG|context|prompt|tool output|log) chunks?\b[^.\n]{0,30}\b(compress|shrink|trim|prune)/i,
    // The signature phrasing of this whole category: shrink the payload before
    // it is sent. Narrow enough that ordinary text cannot match it.
    /\bbefore (they|it) reach(es)? the (model|llm|api|context)\b/i,
    /\bLLM (cost|spend)s?\b/i,
    /省\s*token|节省\s*token|token\s*(消耗|成本|用量)|上下文压缩/i,
  ],
};

export interface FocusInput {
  name: string;
  description: string | null;
  topics: string[];
  readme?: string | null;
  /** Skill names + descriptions, for repos whose README is generic. */
  skillTexts?: string[];
  /** Discovery query ids; a focus query that surfaced the repo is evidence. */
  queries?: string[];
}

export interface FocusResult {
  themes: FocusTheme[];
  score: number;
  scores: Record<FocusTheme, number>;
  evidence: Record<string, string[]>;
}

function hits(res: RegExp[], text: string): RegExp[] {
  return text ? res.filter((r) => r.test(text)) : [];
}

export function scoreFocus(input: FocusInput): FocusResult {
  const topics = input.topics.map((t) => t.toLowerCase());
  const head = `${input.name.replace(/[-_]/g, " ")} ${input.description ?? ""}`;
  const readme = (input.readme ?? "").slice(0, 6000);
  const skills = (input.skillTexts ?? []).join("\n").slice(0, 6000);

  const scores = {} as Record<FocusTheme, number>;
  const evidence: Record<string, string[]> = {};

  for (const theme of FOCUS_THEMES) {
    const ev: string[] = [];
    const topicHits = topics.filter((t) => TOPICS[theme].includes(t));
    const headHits = hits(PATTERNS[theme], head);
    const readmeHits = hits(PATTERNS[theme], readme);
    const skillHits = hits(PATTERNS[theme], skills);
    const query = (input.queries ?? []).filter((q) => q.startsWith(`focus:${theme}:`));

    let s = 0;
    s += Math.min(6, topicHits.length * 3);
    s += Math.min(6, headHits.length * 2);
    s += Math.min(3, readmeHits.length);
    s += Math.min(3, skillHits.length);
    // A code-search hit means the theme word is inside a SKILL.md — content
    // evidence. A repo-search hit is already counted through name/description.
    if (query.some((q) => q.includes(":code:"))) s += 3;
    else if (query.length) s += 2;

    if (topicHits.length) ev.push(`topics: ${topicHits.join(", ")}`);
    if (headHits.length) ev.push(`name/description: ${headHits.length} match`);
    if (readmeHits.length) ev.push(`readme: ${readmeHits.length} match`);
    if (skillHits.length) ev.push(`skills: ${skillHits.length} match`);
    if (query.length) ev.push(`query: ${query[0]}`);

    scores[theme] = s;
    if (s >= FOCUS_MIN) evidence[theme] = ev;
  }

  const themes = FOCUS_THEMES.filter((t) => scores[t] >= FOCUS_MIN).sort((a, b) => scores[b] - scores[a]);
  return { themes, score: Math.max(...Object.values(scores)), scores, evidence };
}
