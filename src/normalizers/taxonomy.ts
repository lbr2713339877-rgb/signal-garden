/**
 * V2 taxonomy: six primary categories, each with its own second level.
 *
 * This replaces the ten technical categories of v1. The brief's requirement is
 * that a category page is never just a long list, so every primary has a
 * second level and a sort control.
 */

export const PRIMARY = [
  "ai-tools",
  "indie-web",
  "dev-tools",
  "design",
  "skill-agent",
  "productivity",
] as const;

export type Primary = (typeof PRIMARY)[number];

export interface PrimaryMeta {
  key: Primary;
  label: string;
  en: string;
  tagline: string;
  taglineEn: string;
  /** CSS token, matching tokens.css */
  cssVar: string;
  secondary: { key: string; label: string; en: string }[];
  /** Keyword patterns used by the rule-based first pass. */
  patterns: RegExp[];
  /** Repo topics that count as strong evidence. */
  topics: string[];
}

export const TAXONOMY: PrimaryMeta[] = [
  {
    key: "ai-tools",
    label: "AI 工具",
    en: "AI Tools",
    tagline: "今天有人在用的 AI 产品。",
    taglineEn: "AI products to explore and try.",
    cssVar: "--c-agent",
    secondary: [
      { key: "chat-agent", label: "对话与 Agent", en: "Chat & Agents" },
      { key: "bots", label: "聊天机器人", en: "Chat Bots" },
      { key: "image-video", label: "图像与视频", en: "Image & Video" },
      { key: "voice-music", label: "语音与音乐", en: "Voice & Music" },
      { key: "writing", label: "写作与内容", en: "Writing" },
      { key: "model-infra", label: "模型与推理", en: "Models & Inference" },
    ],
    patterns: [/\bllm\b/i, /\bgpt\b/i, /\bai (tool|app|agent|assistant|bot|video|editor)\b/i, /\bprompt\b/i, /\b生成式\b/, /AI\s*工具|人工智能|聊天机器人|视频剪辑/, /\b(?:deepseek|chatbot|telegram bot|discord bot|video editing)\b/i],
    topics: ["ai", "llm", "gpt", "ai-tools", "generative-ai", "artificial-intelligence", "ai-bot", "telegram-bot", "discord-bot", "video-editing", "video-generation"],
  },
  {
    key: "indie-web",
    label: "独立站与出海",
    en: "Indie Web",
    tagline: "把网站做出来，并且赚到钱。",
    taglineEn: "Build, launch and grow your website.",
    cssVar: "--c-skill",
    secondary: [
      { key: "landing", label: "落地页与官网", en: "Landing Pages" },
      { key: "ecommerce", label: "跨境电商", en: "E-commerce" },
      { key: "growth", label: "增长与 SEO", en: "Growth & SEO" },
      { key: "payment", label: "支付与订阅", en: "Payments" },
      { key: "deploy", label: "部署与托管", en: "Deploy & Hosting" },
    ],
    patterns: [
      /\blanding[\s-]?pages?\b/i, /\bwebsite (builder|generator)s?\b/i,
      /\bindie[\s-]?hack/i, /\bsaas (starter|boilerplate|template|kit)s?\b/i,
      /\bSEO\b/, /\bcheckout\b/i, /\bstripe\b/i, /\bshopify\b/i,
      /独立站|出海|建站|落地页|跨境电商/,
    ],
    topics: ["landing-page", "website-builder", "indie-hacker", "saas-boilerplate", "seo", "ecommerce", "vibe-coding"],
  },
  {
    key: "dev-tools",
    label: "开发者工具",
    en: "Developer Tools",
    tagline: "写代码时真正省时间的东西。",
    taglineEn: "Tools that help you build and ship.",
    cssVar: "--c-devtool",
    secondary: [
      { key: "learning", label: "教程与学习", en: "Learning" },
      { key: "templates", label: "项目模板", en: "Project Templates" },
      { key: "coding-agent", label: "编码助手", en: "Coding Agents" },
      { key: "cli", label: "命令行工具", en: "CLI" },
      { key: "testing", label: "测试与调试", en: "Testing" },
      { key: "infra", label: "基础设施", en: "Infrastructure" },
      { key: "data", label: "数据库与数据", en: "Data" },
      { key: "security", label: "安全与合规", en: "Security" },
    ],
    patterns: [
      /\bcli\b/i, /\bdebug/i, /\blinter?\b/i, /\btesting\b/i, /\bCI\/?CD\b/i,
      /\bapi (client|gateway|proxy)\b/i, /\bgit\b/i,
      /开发工具|命令行/,
    ],
    topics: ["developer-tools", "cli", "devtools", "api", "git"],
  },
  {
    key: "design",
    label: "设计资源",
    en: "Design",
    tagline: "把界面做好看的那一套。",
    taglineEn: "Resources for better interfaces.",
    cssVar: "--c-design",
    secondary: [
      { key: "ui-kit", label: "组件与 UI 库", en: "Components" },
      { key: "motion", label: "动效与交互", en: "Motion" },
      { key: "figma", label: "Figma 与设计工具", en: "Figma" },
      { key: "icon-font", label: "图标与字体", en: "Icons & Fonts" },
      { key: "inspiration", label: "灵感与系统", en: "Systems" },
      { key: "interactive", label: "互动作品", en: "Interactive" },
    ],
    patterns: [
      /\bui\s*[/&-]?\s*ux\b/i, /\bdesign (system|tokens?|language|skill)s?\b/i,
      /\bfigma\b/i, /\bcomponent librar(y|ies)\b/i, /\btypography\b/i,
      /\banimat(ions?|ed|ing)\b/i, /\bframer[\s-]motion\b/i, /\bgsap\b/i, /\bthree\.?js\b/i,
      /设计|动效|组件库|图标/,
    ],
    topics: ["design", "design-system", "ui", "ux", "figma", "animation", "animation-library", "framer-motion", "css-animations", "css", "tailwindcss", "icon"],
  },
  {
    key: "skill-agent",
    label: "Skill 与 Agent",
    en: "Skills & Agents",
    tagline: "可以直接装进 Agent 的能力。",
    taglineEn: "Capabilities to add to your agent.",
    cssVar: "--c-browser",
    secondary: [
      { key: "claude-skill", label: "Claude Skill", en: "Claude Skills" },
      { key: "mcp-server", label: "MCP 服务", en: "MCP Servers" },
      { key: "browser", label: "浏览器自动化", en: "Browser" },
      { key: "multi-agent", label: "多 Agent 编排", en: "Orchestration" },
      { key: "collection", label: "合集与注册表", en: "Collections" },
    ],
    patterns: [
      /\bskill\.?md\b/i, /\b(claude|agent|codex|cursor)\s+skills?\b/i,
      /\bmodel context protocol\b/i, /\bmcp servers?\b/i,
      /\bbrowser[\s-](use|automation|agent|control)\b/i, /\bplaywright\b/i,
      /技能|浏览器自动化/,
    ],
    topics: ["agent-skills", "claude-skills", "claude-code", "mcp", "mcp-server", "ai-agents", "browser-automation"],
  },
  {
    key: "productivity",
    label: "效率应用",
    en: "Productivity",
    tagline: "把重复劳动从你手里拿走。",
    taglineEn: "Tools for everyday work and automation.",
    cssVar: "--c-productivity",
    secondary: [
      { key: "notes-docs", label: "笔记与文档", en: "Notes & Docs" },
      { key: "email-calendar", label: "邮件与日程", en: "Email & Calendar" },
      { key: "automation", label: "自动化流程", en: "Automation" },
      { key: "meeting", label: "会议与协作", en: "Meetings" },
      { key: "cost", label: "省 Token 与成本", en: "Cost" },
    ],
    patterns: [
      /\bnotion\b/i, /\bobsidian\b/i, /\bcalendar\b/i, /\bemail\b/i, /\bslack\b/i,
      /\bsave tokens?\b/i, /\bcontext (compression|window)\b/i, /\bcompress\b[^.\n]{0,30}\b(context|prompts?|logs)\b/i,
      /\bworkflow automations?\b/i,
      /效率|自动化|省\s*token/,
    ],
    topics: ["productivity", "automation", "notes", "workflow", "context-engineering", "token-optimization"],
  },
];

const BY_KEY = new Map(TAXONOMY.map((t) => [t.key, t]));

export function taxonomy(key: string | null | undefined): PrimaryMeta | null {
  return key ? BY_KEY.get(key as Primary) ?? null : null;
}

export function secondaryLabel(primary: string, secondary: string | null): string | null {
  if (!secondary) return null;
  return taxonomy(primary)?.secondary.find((s) => s.key === secondary)?.label ?? null;
}

/* ---------------------------------------------------------------------------
   Rule-based first pass. The AI step may refine it; category_source records
   which one decided.
   ------------------------------------------------------------------------ */

export interface ClassifyTaxonomyInput {
  name: string;
  description: string | null;
  topics: string[];
  readme: string;
  skillMdCount: number;
  hasMcpSdk: boolean;
}

export interface TaxonomyResult {
  primary: Primary;
  secondary: string | null;
  scores: Record<string, number>;
}

/**
 * Repos that are reading material, not products.
 *
 * A Java interview guide whose description happens to mention "AI 应用开发"
 * scored into AI Tools purely on that keyword, and an "awesome-*" index or a
 * course repo does the same in every category. These are useful links but they
 * are not tools, so they are excluded from the product taxonomy entirely.
 */
const NOT_A_PRODUCT = [
  /\binterview\b|面试/i,
  /\bawesome[-\s]/i,
  /\b(?:tutorial|course|guide|handbook|roadmap)\b|教程|指南|入门到精通|学习路线/i,
  /\b(?:leetcode|coding[- ]?interview|system[- ]?design[- ]?interview)\b/i,
];

export function classifyTaxonomy(input: ClassifyTaxonomyInput): TaxonomyResult {
  const head = `${input.name.replace(/[-_]/g, " ")} ${input.description ?? ""}`;
  const notAProduct = NOT_A_PRODUCT.some((r) => r.test(head));
  const topics = input.topics.map((t) => t.toLowerCase());
  const readme = input.readme.slice(0, 4000);

  const scores: Record<string, number> = {};
  for (const t of TAXONOMY) {
    let s = 0;
    s += topics.filter((x) => t.topics.includes(x)).length * 3;
    s += t.patterns.filter((r) => r.test(head)).length * 2;
    s += Math.min(3, t.patterns.filter((r) => r.test(readme)).length);
    scores[t.key] = s;
  }

  // Domain wins over "it happens to be a Skill".
  //
  // The first pass gave skill-agent a flat bonus for having any SKILL.md, and
  // it absorbed 76% of the corpus — every design, motion and token Skill
  // landed in one bucket, which defeats the point of having six categories.
  // The rule now: a multi-skill collection is a Skill category, a single
  // focused Skill is categorised by what it is for.
  const DOMAINS = PRIMARY.filter((k) => k !== "skill-agent");
  const bestDomain = DOMAINS.reduce((a, b) => (scores[b] > scores[a] ? b : a), DOMAINS[0]);

  const isCollection = input.skillMdCount >= 8;
  const isSkillish = input.skillMdCount > 0 || input.hasMcpSdk;
  // An MCP SDK dependency, or a repo holding many skills, defines the project:
  // those are strong and specific, whereas a domain keyword is generic. A repo
  // that depends on the MCP SDK *is* an MCP server, whatever else it mentions.
  const strongSkill = input.hasMcpSdk || isCollection;
  let best: Primary;

  /* Reading material is not a product — but a repo that actually ships a set
     of SKILL.md files or an MCP server is a product whose name may merely look
     like a list ("awesome-agent-skills"). Only reclassify when there is no such
     hard evidence of a real artifact. */
  if (notAProduct && !isSkillish) {
    return { primary: "dev-tools", secondary: "learning", scores };
  }
  if (!strongSkill) {
    if (/\b(?:telegram|discord|wechat|slack|deepseek)\b/i.test(head) && /\b(?:bot|chatbot)\b/i.test(head)) {
      return { primary: 'ai-tools', secondary: 'bots', scores };
    }
    if (/\b(?:interactive art|creative coding|browser game|web game)\b|互动作品|网页游戏/i.test(head)) {
      return { primary: 'design', secondary: 'interactive', scores };
    }
    if (/\b(?:scheduling|booking|appointment)\b|预约|排期/.test(head.toLowerCase())) {
      return { primary: "productivity", secondary: "email-calendar", scores };
    }
    if (/\b(?:admin|dashboard|full[ -]stack|web app(?:lication)?)\b/i.test(head) && /\b(?:template|starter|boilerplate|shadcn)\b/i.test(head)) {
      return { primary: "dev-tools", secondary: "templates", scores };
    }
  }
  if (strongSkill) best = "skill-agent";
  else if (scores[bestDomain] >= 2) best = bestDomain;
  else if (isSkillish) best = "skill-agent";
  else best = "dev-tools";
  const meta = BY_KEY.get(best)!;

  // Second level: highest-scoring signal within the winning primary.
  //
  // The name weighs more than the description, because a project's own name is
  // the most specific thing it says about itself. Without that weighting,
  // "animate-ui" tied between motion and ui-kit — "components" and "tailwind"
  // (what it is built with) scored the same as "animated" (what it is).
  //
  // Topics count here too: a repo tagged token-optimization belongs in Cost
  // even if its prose never uses the phrase.
  const name = input.name.replace(/[-_]/g, " ");
  const desc = input.description ?? "";

  let secondary: string | null = null;
  let bestSub = 0;
  for (const sub of meta.secondary) {
    const key = `${best}:${sub.key}`;
    const subPatterns = SUBS[key] ?? [];
    const subTopics = SUBS_TOPICS[key] ?? [];

    let s = 0;
    s += subPatterns.filter((r) => r.test(name)).length * 3;
    s += subPatterns.filter((r) => r.test(desc)).length * 2;
    s += Math.min(2, subPatterns.filter((r) => r.test(readme)).length);
    s += topics.filter((t) => subTopics.includes(t)).length * 3;

    if (s > bestSub) {
      bestSub = s;
      secondary = sub.key;
    }
  }

  return { primary: best, secondary: bestSub > 0 ? secondary : null, scores };
}

/** Second-level topics, keyed "<primary>:<secondary>". A repo tagged with
 *  these belongs in that subcategory even if its prose never says so. */
const SUBS_TOPICS: Record<string, string[]> = {
  'ai-tools:bots': ['ai-bot', 'telegram-bot', 'discord-bot'],
  'design:interactive': ['creative-coding', 'interactive-art', 'browser-game', 'web-game'],
  "productivity:cost": ["token-optimization", "context-engineering", "prompt-compression", "llm-cost"],
  "productivity:automation": ["automation", "workflow", "n8n"],
  "productivity:notes-docs": ["notes", "markdown", "obsidian", "notion"],
  "design:motion": ["animation", "framer-motion", "gsap", "lottie", "threejs", "webgl"],
  "design:ui-kit": ["ui-components", "component-library", "shadcn", "ui"],
  "skill-agent:mcp-server": ["mcp", "mcp-server", "model-context-protocol"],
  "skill-agent:claude-skill": ["agent-skills", "claude-skills", "claude-code"],
  "skill-agent:browser": ["browser-automation"],
  "skill-agent:collection": ["awesome-list"],
  "dev-tools:cli": ["cli"],
  "dev-tools:data": ["database", "postgres", "vector-database"],
  "dev-tools:security": [
    "security",
    "security-tools",
    "cybersecurity",
    "vulnerability",
    "penetration-testing",
    "sast",
    "secrets-management",
    "encryption",
  ],
  "ai-tools:model-infra": ["inference", "llm-ops", "quantization"],
  "ai-tools:image-video": ["image-generation", "video-generation", "diffusion"],
  "indie-web:landing": ["landing-page", "website-builder"],
  "indie-web:growth": ["seo", "growth"],
};

/** Second-level patterns, keyed "<primary>:<secondary>". */
const SUBS: Record<string, RegExp[]> = {
  'ai-tools:bots': [/\b(?:telegram|discord|wechat|chatbot|bot)\b/i, /聊天机器人|群聊助手/],
  'design:interactive': [/\b(?:interactive art|creative coding|browser game|web game)\b/i, /互动作品|网页游戏/],
  "ai-tools:chat-agent": [/\bagents?\b/i, /\bchat\b/i, /\bassistant\b/i, /\bcopilot\b/i],
  "ai-tools:image-video": [/\bimage\b/i, /\bvideo\b/i, /\bphoto\b/i, /\bstable diffusion\b/i, /\bcomfyui\b/i, /绘图|图像/],
  "ai-tools:voice-music": [/\bvoice\b/i, /\bspeech\b/i, /\btts\b/i, /\bmusic\b/i, /\baudio\b/i, /语音|音乐/],
  "ai-tools:writing": [/\bwriting\b/i, /\bcontent (generation|creation)\b/i, /\bcopywriting\b/i, /写作|文案/],
  "ai-tools:model-infra": [/\binference\b/i, /\bfine[\s-]?tun/i, /\bquantiz/i, /\bvllm\b/i, /\bollama\b/i, /\bgguf\b/i, /推理|微调/],

  "indie-web:landing": [/\blanding page/i, /\bhero (section|copy)\b/i, /\bone[\s-]page\b/i, /落地页|首屏/],
  "indie-web:ecommerce": [/\bshopify\b/i, /\becommerce\b/i, /\bproduct (page|listing)\b/i, /电商|选品/],
  "indie-web:growth": [/\bSEO\b/, /\bA\/B test/i, /\bconversion\b/i, /\banalytics\b/i, /增长|转化/],
  "indie-web:payment": [/\bstripe\b/i, /\bsubscription\b/i, /\bcheckout\b/i, /\bbilling\b/i, /支付|订阅/],
  "indie-web:deploy": [/\bdeploy/i, /\bvercel\b/i, /\bcloudflare\b/i, /\bself[\s-]host/i, /部署|托管/],

  "dev-tools:coding-agent": [/\bclaude code\b/i, /\bcodex\b/i, /\bcursor\b/i, /\bcoding agent\b/i, /编码助手/],
  "dev-tools:cli": [/\bcli\b/i, /\bcommand[\s-]line\b/i, /\bterminal\b/i, /命令行/],
  "dev-tools:testing": [/\btest(ing|s)?\b/i, /\bdebug/i, /\blint/i, /\bcoverage\b/i, /测试/],
  "dev-tools:infra": [/\bdocker\b/i, /\bkubernetes\b/i, /\bCI\b/, /\bself[\s-]host/i, /\bproxy\b/i, /基础设施/],
  "dev-tools:data": [/\bdatabase\b/i, /\bpostgres\b/i, /\bsql\b/i, /\bvector (db|store)\b/i, /\bRAG\b/, /数据库/],
  /* Security 是 dev-tools 下的第六个二级类，不是第七个顶级类。
     它必须能区分"安全工具"和"顺手带了个安全声明"：所以模式偏向
     具体的攻防/审计词汇，而不是泛泛的 secure/safe。 */
  "dev-tools:security": [
    /\bsecurity\b/i, /\bvulnerabilit/i, /\bCVE\b/, /\bpentest/i, /\bpenetration test/i,
    /\bSAST\b/i, /\bDAST\b/i, /\bsecret scan/i, /\bmalware\b/i, /\bphishing\b/i,
    /\bencryption\b/i, /\bzero[\s-]trust\b/i, /\bthreat model/i, /\baudit(ing)?\b/i,
    /安全|漏洞|渗透|加密|合规/,
  ],

  "design:ui-kit": [/\bcomponents?\b/i, /\bui kit\b/i, /\bshadcn\b/i, /\btailwind\b/i, /组件/],
  "design:motion": [/\banimat/i, /\bmotion\b/i, /\bgsap\b/i, /\btransition/i, /动效|动画/],
  "design:figma": [/\bfigma\b/i, /\bplugin\b/i, /\bdesign tool/i, /设计工具/],
  "design:icon-font": [/\bicons?\b/i, /\bfonts?\b/i, /\bsvg\b/i, /图标|字体/],
  "design:inspiration": [/\bdesign system\b/i, /\bstyle guide\b/i, /\bpalette\b/i, /设计系统|配色/],

  "skill-agent:claude-skill": [/\bskill\.?md\b/i, /\bclaude skill/i, /技能/],
  "skill-agent:mcp-server": [/\bmcp\b/i, /\bmodel context protocol\b/i],
  "skill-agent:browser": [/\bbrowser\b/i, /\bplaywright\b/i, /\bpuppeteer\b/i, /浏览器/],
  "skill-agent:multi-agent": [/\bmulti[\s-]?agent\b/i, /\borchestrat/i, /\bworkflow\b/i, /编排/],
  "skill-agent:collection": [/\bcollection\b/i, /\bregistry\b/i, /\bawesome\b/i, /\bcatalog\b/i, /合集|大全/],

  "productivity:notes-docs": [/\bnotes?\b/i, /\bdocs?\b/i, /\bmarkdown\b/i, /\bobsidian\b/i, /\bnotion\b/i, /笔记/],
  "productivity:email-calendar": [/\b(?:scheduling|booking|appointment)\b/i, /\bemail\b/i, /\bcalendar\b/i, /\bgmail\b/i, /\bmeeting\b/i, /邮件|日程/],
  "productivity:automation": [/\bautomat(e|ion|ing)\b/i, /\bworkflow\b/i, /\bn8n\b/i, /自动化/],
  "productivity:meeting": [/\bmeeting\b/i, /\btranscri/i, /\bminutes\b/i, /会议/],
  "productivity:cost": [
    /\bsave tokens?\b/i, /\btoken (usage|cost|saving|efficien)/i,
    /\bcontext (compression|window|engineering)\b/i,
    /\bcompress(es|ion|ing)?\b[^.\n]{0,40}\b(context|prompts?|tool outputs?|logs|chunks)\b/i,
    /\bprompt compress/i, /\bLLM cost/i,
    /省\s*token|上下文压缩|成本/,
  ],
};
