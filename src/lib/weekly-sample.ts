/**
 * Public sample of the Monday weekly digest.
 *
 * Issue 1 mirrors the 2026-10-13 – 2026-10-19 edition: each day's #1, then #2s,
 * the same order as the weekly mailer. Issue 2 is the locked Top 10 from
 * 2026-10-26 00:21 SGT (window 10/20–10/26): max heat in that window, not the
 * daily #1/#2 sampler. The 2026-10-24 freeze was revised at lock: TOMC entered
 * at #3 and mcptoon dropped out. doop is the editor pick and is not in the Top 10.
 * Issue 3 is the provisional lock from 2026-11-01 10:11 SGT (window 10/27–11/02;
 * the 11/02 board was not published yet). chaojifeng-video-design is the editor
 * pick and is not in the Top 10.
 * Issue 4 is the provisional lock from 2026-11-08 09:05 SGT (window 11/03–11/09;
 * the 11/09 board was not published yet). boardui is the editor pick and is not
 * in the Top 10. Monday content may reopen if any 11/09 heat is >70.
 * This Top 10 stays until an explicit new lock.
 * Names and summaries are the locked copy. This module does not read the mailing list.
 */

export interface WeeklySampleCard {
  name: string;
  slug: string;
  zh: string;
  en: string;
}

export interface WeeklySampleItem {
  date: string;
  rank: number;
  labelZh: string;
  labelEn: string;
  name: string;
  slug: string;
  zh: string;
  en: string;
  href: string;
  /** Window max heat. Set on frozen max-heat issues. */
  heat?: number;
  /** Day that heat was recorded. */
  peakDate?: string;
  /** Star movement frozen with the issue, e.g. "504 → 1.0k stars（+102.4%）". */
  starsLine?: string;
}

export interface WeeklyEditorNote {
  /** `**phrase**` marks the words the page emphasizes. */
  zh: string;
  en: string;
}

export interface WeeklyEditorPick {
  name: string;
  slug: string;
  heat: number;
  peakDate: string;
  zh: string;
  en: string;
  starsLine: string;
  reasonZh: string;
  reasonEn: string;
  href: string;
}

export interface WeeklyIssue {
  issue: number;
  from: string;
  to: string;
  items: WeeklySampleItem[];
  editorNote?: WeeklyEditorNote;
  /** Outside the Top 10. */
  editorPick?: WeeklyEditorPick;
  /** One-line sponsorship ask. The address is CONTACT_EMAIL at render time. */
  sponsor?: boolean;
}

/** On-site project link carrying the weekly mail campaign, shared by the public issue page. */
export function weeklyCampaignPath(slug: string, campaign: string): string {
  const params = new URLSearchParams({
    utm_source: "email",
    utm_medium: "weekly",
    utm_campaign: campaign,
  });
  return `/p/${slug}?${params.toString()}`;
}

const TOP = 10;

function dayLabel(date: string, rank: number): { zh: string; en: string } {
  const [, month, day] = date.split("-");
  const md = `${Number(month)}/${Number(day)}`;
  return rank === 1
    ? { zh: `${md} 榜首`, en: `${md} #1` }
    : { zh: `${md} 第 ${rank} 名`, en: `${md} #${rank}` };
}

/** Newest day first, each day's #1, then #2s, until `top`. Displayed by date. */
export function pickWeeklySample(
  editions: { date: string; cards: WeeklySampleCard[] }[],
  top = TOP,
): WeeklySampleItem[] {
  const sorted = [...editions].sort((a, b) => (a.date < b.date ? 1 : -1));
  const picked: { date: string; rank: number; card: WeeklySampleCard }[] = [];
  const seen = new Set<string>();
  for (let rank = 1; rank <= top && picked.length < top; rank++) {
    for (const edition of sorted) {
      if (picked.length >= top) break;
      const card = edition.cards[rank - 1];
      if (!card || seen.has(card.slug)) continue;
      seen.add(card.slug);
      picked.push({ date: edition.date, rank, card });
    }
  }
  picked.sort((a, b) => (a.date === b.date ? a.rank - b.rank : a.date < b.date ? 1 : -1));
  return picked.map((row) => {
    const label = dayLabel(row.date, row.rank);
    return {
      date: row.date,
      rank: row.rank,
      labelZh: label.zh,
      labelEn: label.en,
      name: row.card.name,
      slug: row.card.slug,
      zh: row.card.zh,
      en: row.card.en,
      href: `/p/${row.card.slug}`,
    };
  });
}

/** Day #1 and #2 from the public archive, 13–19 Oct 2026. Two per day is enough to fill 10. */
const ISSUE_1_DAYS: { date: string; cards: WeeklySampleCard[] }[] = [
  {
    date: "2026-10-19",
    cards: [
      {
        name: "ascii",
        slug: "bas3line-ascii",
        zh: "给网页、README 和终端添加动画 ASCII 艺术，React、Astro 或一个 HTML 标签就能用。",
        en: "Add animated ASCII art to web pages, READMEs, and terminals with a single line of code.",
      },
      {
        name: "animate",
        slug: "cth9191-animate",
        zh: "给 Claude Code 用的动画生成器，用文字描述就能做出风格化的短视频。",
        en: "Create short animated videos with custom styles, music, and storyboards directly from Claude Code commands.",
      },
    ],
  },
  {
    date: "2026-10-18",
    cards: [
      {
        name: "herk-edit-kit",
        slug: "nateherkai-herk-edit-kit",
        zh: "让 Codex 或 Claude Code 替你剪视频：去口误、去停顿、做短视频的套件。",
        en: "A skill pack that lets AI edit talking-head videos: transcribe, trim silences, cut mistakes, and add motion graphics with one command.",
      },
      {
        name: "dsh-ops",
        slug: "t-auto-dsh-ops",
        zh: "DSH 的一个底层操作插件，帮你省 token、缩短任务耗时。",
        en: "A DSH plugin that cuts token use and speeds up low-level operations with one install command.",
      },
    ],
  },
  {
    date: "2026-10-17",
    cards: [
      {
        name: "filmcraft",
        slug: "storytold-filmcraft",
        zh: "视频创作者可用的开源非线性视频编辑器，用 Rust 写，能剪片、调色、加字幕。",
        en: "An open-source nonlinear video editor written in Rust for a fast, scriptable timeline.",
      },
      {
        name: "OpenCreator",
        slug: "krillinai-opencreator",
        zh: "开源 AI 创作空间，把视频翻译、配音、生成一条龙打包成对话指令。",
        en: "An open-source desktop app for creators to translate videos, add dubbing, generate images, and edit content using AI agents.",
      },
    ],
  },
  {
    date: "2026-10-16",
    cards: [
      {
        name: "tegaki",
        slug: "gkurt-tegaki",
        zh: "把任意字体变成手写动画，无需手动描边，React 等框架都能用。",
        en: "Generate animated handwriting from any font or text, no manual path editing required.",
      },
      {
        name: "Toonflow-app",
        slug: "hbai-ltd-toonflow-app",
        zh: "开源 AI 短剧和漫剧制作工具，帮你从剧本到视频一气呵成。",
        en: "An open-source canvas for making AI short dramas and motion comics.",
      },
    ],
  },
  {
    date: "2026-10-15",
    cards: [
      {
        name: "awesome-ai-motion",
        slug: "guanmo-ai-awesome-ai-motion",
        zh: "收集动效、创意视频和交互艺术的资源列表，附源码和提示词。",
        en: "A curated collection of AI-powered motion design, creative videos, and interactive art with source code and prompts.",
      },
      {
        name: "loop-engineering",
        slug: "cobusgreyling-loop-engineering",
        zh: "一套让 AI 编码代理自动处理日常开发杂务的命令行工具。",
        en: "CLI tools and patterns to make loop engineering with AI coding agents more controllable.",
      },
    ],
  },
  {
    date: "2026-10-14",
    cards: [
      {
        name: "replica-skill",
        slug: "jakeschincariol-replica-skill",
        zh: "给 Claude 的 11 个免费技能，帮你拆解、复刻、测试并改进任意应用。",
        en: "11 free Claude skills to clone any app: reverse-engineer, rebuild, test for bugs, and fix what users hate.",
      },
      {
        name: "deepagents-in-action",
        slug: "datawhalechina-deepagents-in-action",
        zh: "从零搭建生产级 AI 智能体的中文实战课程，含可运行模板与沙箱。",
        en: "A hands-on course for building production-ready AI assistants using LangChain and LangGraph.",
      },
    ],
  },
  {
    date: "2026-10-13",
    cards: [
      {
        name: "gstack",
        slug: "garrytan-gstack",
        zh: "一套给 Claude Code 装上的技能包，模拟 CEO、设计师、QA 等角色，帮你从想法一路做到发布。",
        en: "A Claude Code setup of opinionated tools that serve as CEO, designer, release manager, and QA.",
      },
      {
        name: "WrenAI",
        slug: "canner-wrenai",
        zh: "开源数据查询工具，让 AI 智能体用日常语言查询数据库，生成图表和 SQL。",
        en: "An open-source GenBI layer that turns natural-language questions into dashboards, charts, and SQL.",
      },
    ],
  },
];

export const WEEKLY_ISSUE_1: WeeklyIssue = {
  issue: 1,
  from: "2026-10-13",
  to: "2026-10-19",
  items: pickWeeklySample(ISSUE_1_DAYS),
};

const WEEKLY_2_CAMPAIGN = "weekly-2";

function frozenHeatItem(
  input: {
    rank: number;
    name: string;
    slug: string;
    heat: number;
    peakDate: string;
    zh: string;
    en: string;
    starsLine: string;
  },
  campaign = WEEKLY_2_CAMPAIGN,
): WeeklySampleItem {
  return {
    date: input.peakDate,
    rank: input.rank,
    labelZh: `热度分 ${input.heat}`,
    labelEn: `Heat ${input.heat}`,
    name: input.name,
    slug: input.slug,
    zh: input.zh,
    en: input.en,
    heat: input.heat,
    peakDate: input.peakDate,
    starsLine: input.starsLine,
    href: weeklyCampaignPath(input.slug, campaign),
  };
}

/** Locked 2026-10-26 00:21 SGT. Order and numbers are the lock, not a live query. */
export const WEEKLY_ISSUE_2: WeeklyIssue = {
  issue: 2,
  from: "2026-10-20",
  to: "2026-10-26",
  sponsor: true,
  editorNote: {
    zh: "本周热度分榜上，**AI coding skills / MCP / 上下文与动效技能**扎堆：ThinkRail、TOMC、Awwwards-mcp、cinetic、blender-skills、juliobsz/skills 都在用「给助手装技能 / 压缩上下文」的方式扩能力；中间夹着一个高热度的开源音乐客户端 Convx，提醒我们日榜并不只围着 agent 转。",
    en: "This week's momentum board clustered around **AI coding skills, MCP, context compression, and motion skills**—ThinkRail, TOMC, Awwwards-mcp, cinetic, blender-skills, and juliobsz/skills all extend assistants with installable skills or leaner context. A high-momentum open-source music client (Convx) still broke into the Top 10, a reminder the board is not only agents.",
  },
  items: [
    frozenHeatItem({
      rank: 1,
      name: "thinkrail",
      slug: "jetbrains-thinkrail",
      heat: 89,
      peakDate: "2026-10-21",
      zh: "一个能根据你的工作习惯自动调整的轻量级IDE，专为AI编程助手设计。",
      en: "ThinkRail is a lightweight IDE that adapts to your workflow and helps you code with AI through natural conversation, designed for Cursor users.",
      starsLine: "504 → 1.0k stars（+102.4%）",
    }),
    frozenHeatItem({
      rank: 2,
      name: "Convx",
      slug: "cosmictaserdev-creator-convx",
      heat: 88,
      peakDate: "2026-10-22",
      zh: "面向YouTube Music用户的开源安卓播放器，带同步歌词、自动混音和一起听功能。",
      en: "An open-source Android app for playing YouTube Music with a glass-like iOS look, live lyrics, and group listening sessions.",
      starsLine: "539 → 921 stars（+70.9%）",
    }),
    frozenHeatItem({
      rank: 3,
      name: "TOMC",
      slug: "zipengwu365-tomc",
      heat: 88,
      peakDate: "2026-10-25",
      zh: "在本地压缩上下文，为编码助手保留任务记忆，跨会话保持项目状态。",
      en: "CPU context compression that keeps your project memory intact when switching AI coding assistants.",
      starsLine: "20 → 229 stars（+1045.0%）",
    }),
    frozenHeatItem({
      rank: 4,
      name: "skills",
      slug: "juliobsz-skills",
      heat: 86,
      peakDate: "2026-10-23",
      zh: "给AI一句网站描述，它自动生成创意网站源码和设计。",
      en: "An agent skill that builds award-caliber websites from one line of description.",
      starsLine: "187 → 913 stars（+388.2%）",
    }),
    frozenHeatItem({
      rank: 5,
      name: "hairline",
      slug: "lucasmarkes-hairline",
      heat: 86,
      peakDate: "2026-10-21",
      zh: "Hairline 提供六个等距线图，它们会跟随鼠标指针，可用于 React 或任何网页。",
      en: "Six isometric line figures that respond to your pointer, for React and any DOM. Zero dependencies, themeable.",
      starsLine: "317 → 2.7k stars（+761.5%）",
    }),
    frozenHeatItem({
      rank: 6,
      name: "Awwwards-mcp",
      slug: "insane0777-awwwards-mcp",
      heat: 82,
      peakDate: "2026-10-21",
      zh: "给AI编程助手提供获奖网站设计灵感，能搜截图、提取设计要素，无需密钥。",
      en: "A free MCP server that brings award-winning web design inspiration into your AI coding tools.",
      starsLine: "94 → 308 stars（+227.7%）",
    }),
    frozenHeatItem({
      rank: 7,
      name: "cinetic",
      slug: "leonxlnx-cinetic",
      heat: 82,
      peakDate: "2026-10-21",
      zh: "给编程助手装的一个技能，让它直接从代码生成电影级动效视频。",
      en: "Generate cinematic launch films and motion design by describing your vision to a coding agent.",
      starsLine: "78 → 813 stars（+942.3%）",
    }),
    frozenHeatItem({
      rank: 8,
      name: "animate-ui",
      slug: "imskyleen-animate-ui",
      heat: 80,
      peakDate: "2026-10-21",
      zh: "一个开源的React动画组件库，可用Shadcn CLI安装和修改。",
      en: "An open-source library of animated React components you can install, tweak, and use in your own projects.",
      starsLine: "4.4k → 4.6k stars（+5.5%）",
    }),
    frozenHeatItem({
      rank: 9,
      name: "axiomcodegraph",
      slug: "axiomcodeai-axiomcodegraph",
      heat: 77,
      peakDate: "2026-10-21",
      zh: "代码知识图，让AI agent准确追踪调用路径和变更影响",
      en: "A code-graph tool that helps developers and AI assistants find exact call paths and judge change impact in any repo.",
      starsLine: "61 → 270 stars（+342.6%）",
    }),
    frozenHeatItem({
      rank: 10,
      name: "blender-skills",
      slug: "el4cteo-blender-skills",
      heat: 76,
      peakDate: "2026-10-23",
      zh: "给AI编程助手装上一套Blender 5.2的专业操作流程，让它们能直接建模、烘焙、导出游戏资产。",
      en: "22 Blender 5.2 skills that let AI agents handle professional 3D tasks from modeling to export.",
      starsLine: "11 → 450 stars（+3990.9%）",
    }),
  ],
  editorPick: {
    name: "doop",
    slug: "kgoedecke-doop",
    heat: 73,
    peakDate: "2026-10-22",
    zh: "开源的多人在线设计画布，人类和AI代理能一起实时编辑。",
    en: "An open-source multiplayer design canvas where humans and AI agents collaborate in real time, with built-in MCP support.",
    starsLine: "792 → 957 stars（+20.8%）",
    reasonZh: "选它的理由：贴本周 skills / agent 主题，但是「人机共创画布」而不是又一个单机 skill 包。",
    reasonEn: "Why this pick: it fits this week's skills / agent theme, but as a canvas where people and agents create together, not another solo skill pack.",
    href: weeklyCampaignPath("kgoedecke-doop", WEEKLY_2_CAMPAIGN),
  },
};

const WEEKLY_3_CAMPAIGN = "weekly-3";

/** Provisional lock 2026-11-01 10:11 SGT. Order and numbers are the lock, not a live query. */
export const WEEKLY_ISSUE_3: WeeklyIssue = {
  issue: 3,
  from: "2026-10-27",
  to: "2026-11-02",
  sponsor: true,
  editorNote: {
    zh: "本周热度分榜上，**设计/动效 skills、视频工具链、可安装 agent 技能**扎堆：design-agent、impeccable、claude-skill、reanimate、EAC-design-world、brand-identity-skill、awesome-gamedev-agent-skills 都在给助手加「设计判断 / 动画克隆 / 成片」能力；榜首 DeepSeekBot 是带长期记忆的桌面 Bot 团队，中间还插进了一个清理安卓电视的 cleanyourtv，提醒日榜并不只围着 coding agent 转。",
    en: "This week's momentum board clustered around **design/motion skills, video toolchains, and installable agent skills**—design-agent, impeccable, claude-skill, reanimate, EAC-design-world, brand-identity-skill, and awesome-gamedev-agent-skills all extend assistants with design taste, animation cloning, or shipping video. Chart-topper DeepSeekBot is a desktop Bot team with long-term memory, and cleanyourtv (Android TV cleanup) still broke into the Top 10—a reminder the board is not only coding agents.",
  },
  items: [
    frozenHeatItem({
      rank: 1,
      name: "DeepSeekBot",
      slug: "botharness-deepseekbot",
      heat: 90,
      peakDate: "2026-11-01",
      zh: "在桌面端组建有长期记忆的AI Bot团队，协作完成任务。",
      en: "An open-source alternative to GrokBot that lets you run a team of personal AI bots with memory, identities, and permissions.",
      starsLine: "21 → 460 stars（+2090.5%）",
    }, WEEKLY_3_CAMPAIGN),
    frozenHeatItem({
      rank: 2,
      name: "cleanyourtv",
      slug: "gathin23-cleanyourtv",
      heat: 83,
      peakDate: "2026-10-27",
      zh: "用编码助手通过Wi-Fi清理安卓电视的垃圾软件，换上Apple TV风格主屏。",
      en: "Android and Google TV owners can use CleanYourTV to remove bloatware over Wi-Fi and get a cleaner home screen.",
      starsLine: "1.8k → 48k stars（+2593.0%）",
    }, WEEKLY_3_CAMPAIGN),
    frozenHeatItem({
      rank: 3,
      name: "design-agent",
      slug: "langchain-ai-design-agent",
      heat: 78,
      peakDate: "2026-10-30",
      zh: "在Slack聊天里生成品牌一致的设计，从一张图到整份简报。",
      en: "A design agent that turns Slack conversations into on-brand visuals, from stills to motion graphics.",
      starsLine: "2 → 530 stars（+26400.0%）",
    }, WEEKLY_3_CAMPAIGN),
    frozenHeatItem({
      rank: 4,
      name: "reanimate",
      slug: "niazmorshed2007-reanimate",
      heat: 78,
      peakDate: "2026-11-01",
      zh: "给 Claude Code 装上这个技能，就能从录屏或网站里逐帧拆解动画，自动生成匹配的代码组件。",
      en: "Clone any animation from a website, recording, or video file into editable components with Claude Code.",
      starsLine: "116 → 434 stars（+274.1%）",
    }, WEEKLY_3_CAMPAIGN),
    frozenHeatItem({
      rank: 5,
      name: "EAC-design-world",
      slug: "ebony-vinyl-eac-design-world",
      heat: 76,
      peakDate: "2026-10-27",
      zh: "一个本地视频剪辑和设计插件，让 DeepSeek Harness 用户能多轨剪辑、套模板并导出视频。",
      en: "A local-first video production plugin for DeepSeek Harness with multi-track editing, design templates, and native preview.",
      starsLine: "22 → 353 stars（+1504.5%）",
    }, WEEKLY_3_CAMPAIGN),
    frozenHeatItem({
      rank: 6,
      name: "house-plan-designer",
      slug: "zwd11-house-plan-designer",
      heat: 74,
      peakDate: "2026-11-01",
      zh: "上传户型图，一句话让它变成可编辑的2D/3D装修设计网页。",
      en: "Hand your AI assistant a floor plan photo and it builds a living 2D/3D interior designer page—single HTML file, works offline.",
      starsLine: "50 → 265 stars（+430.0%）",
    }, WEEKLY_3_CAMPAIGN),
    frozenHeatItem({
      rank: 7,
      name: "claude-skill",
      slug: "motionsites-ai-claude-skill",
      heat: 71,
      peakDate: "2026-10-28",
      zh: "免费的Claude技能，让Claude做出电影感落地页而不是普通AI页面。",
      en: "Free Claude skill: make Claude build award-level, cinematic landing pages. By MotionSites.",
      starsLine: "120 → 1.3k stars（+965.0%）",
    }, WEEKLY_3_CAMPAIGN),
    frozenHeatItem({
      rank: 8,
      name: "brand-identity-skill",
      slug: "fatihaydost-brand-identity-skill",
      heat: 70,
      peakDate: "2026-11-01",
      zh: "给Claude装个品牌设计师技能，一句话出Logo、字体和配色。",
      en: "Create a complete brand identity system from one brief: logo, typography, color palette, and guidelines PDF.",
      starsLine: "65 → 276 stars（+324.6%）",
    }, WEEKLY_3_CAMPAIGN),
    frozenHeatItem({
      rank: 9,
      name: "awesome-gamedev-agent-skills",
      slug: "gamedev-skills-awesome-gamedev-agent-skills",
      heat: 70,
      peakDate: "2026-10-28",
      zh: "给AI编程助手装上游戏开发技能，它会按你用的引擎自动挑选对应做法。",
      en: "Game developers using AI coding assistants get engine-specific guidance for Godot, Unity, Unreal, and more.",
      starsLine: "4.8k → 6.3k stars（+31.3%）",
    }, WEEKLY_3_CAMPAIGN),
    frozenHeatItem({
      rank: 10,
      name: "impeccable",
      slug: "pbakaus-impeccable",
      heat: 70,
      peakDate: "2026-10-30",
      zh: "给编程助手装上设计判断力，让它在出代码前先挑出丑和乱。",
      en: "A design vocabulary that lets your coding agent review, critique, and polish UI before shipping.",
      starsLine: "92k → 98k stars（+6.2%）",
    }, WEEKLY_3_CAMPAIGN),
  ],
  editorPick: {
    name: "chaojifeng-video-design",
    slug: "mileson-chaojifeng-video-design",
    heat: 69,
    peakDate: "2026-10-29",
    zh: "给AI助手用的视频设计技能包：用户说需求，它做分镜、配乐、改局部，直到出片。",
    en: "A video design methodology that lets AI turn a one-sentence description into a complete video with storyboard, music, and effects.",
    starsLine: "116 → 489 stars（+321.6%）",
    reasonZh: "选它的理由：贴本周 video / design-skill 主题，但是「视频设计方法论技能包」而不是又一个单机动效库。",
    reasonEn: "Why this pick: it fits this week's video / design-skill theme, but as a video-design methodology skill pack, not another solo motion library.",
    href: weeklyCampaignPath("mileson-chaojifeng-video-design", WEEKLY_3_CAMPAIGN),
  },
};

const WEEKLY_4_CAMPAIGN = "weekly-4";

/** Provisional lock 2026-11-08 09:05 SGT. Order and numbers are the lock, not a live query. */
export const WEEKLY_ISSUE_4: WeeklyIssue = {
  issue: 4,
  from: "2026-11-03",
  to: "2026-11-09",
  sponsor: true,
  editorNote: {
    zh: "本周热度分榜被**视频 / 动画 / 3D 生成类 agent 技能**占了大半：wallstreet-explainer（华尔街风财经短片）、code-animation-prompts、claude-animation-skills、vibe-knowledge（带出处的知识短片）、open-3d-skills、diorama 都在让编程助手直接「出片、出动画、出 3D」；另一条线是**让 AI 按流程干活**——bops 给每个业务 Bot 配电脑、邮箱和电话，aidlc-workflows 和 dsh-mattpocock-skills-deck 把开发流程与工程技能打包，Agentic-Bug-Hunter 则把漏洞赏金从侦察做到报告。",
    en: "This week's momentum board was dominated by **video, animation, and 3D agent skills**—wallstreet-explainer (Wall Street–style finance explainers), code-animation-prompts, claude-animation-skills, vibe-knowledge (cited, narrated explainers), open-3d-skills, and diorama all let a coding assistant ship clips, motion, or 3D scenes directly. The other thread is **AI that works to a process**: bops gives each business bot its own computer, inbox, and phone number; aidlc-workflows and dsh-mattpocock-skills-deck package dev lifecycles and engineering skills; Agentic-Bug-Hunter runs bug bounties from recon to report.",
  },
  items: [
    frozenHeatItem({
      rank: 1,
      name: "wallstreet-explainer",
      slug: "heychengc-wallstreet-explainer",
      heat: 93,
      peakDate: "2026-11-07",
      zh: "给要拍财经解读视频的人用：AI 助手装上它，就能做出华尔街风格短片。",
      // Locked English one-liner is Chinese site copy. Omitted; not translated.
      en: "",
      starsLine: "414 → 617 stars（+49.0%）",
    }, WEEKLY_4_CAMPAIGN),
    frozenHeatItem({
      rank: 2,
      name: "code-animation-prompts",
      slug: "xiaoyecodes-code-animation-prompts",
      heat: 74,
      peakDate: "2026-11-04",
      zh: "给代码动画选风格的离线工具包，含341种提示词和参考图，装进Claude Code或Codex就能用。",
      en: "Offline library of 341 code animation style prompts with reference stills, a picker, and one-click import for Claude Code and Codex.",
      starsLine: "62 → 700 stars（+1029.0%）",
    }, WEEKLY_4_CAMPAIGN),
    frozenHeatItem({
      rank: 3,
      name: "bops",
      slug: "orgoai-bops",
      heat: 69,
      peakDate: "2026-11-05",
      zh: "给每个业务机器人配一台电脑、一个邮箱和电话号码，在 Mac 上替你跑日常运营。",
      en: "Bops: a team of AI bots that run your business ops, each with its own computer, email and phone number. bops.bot",
      starsLine: "259 → 495 stars（+91.1%）",
    }, WEEKLY_4_CAMPAIGN),
    frozenHeatItem({
      rank: 4,
      name: "open-3d-skills",
      slug: "moh4696-open-3d-skills",
      heat: 68,
      peakDate: "2026-11-08",
      zh: "给AI编程助手的8个三维网页制作技能包",
      en: "Eight agent skills that turn text prompts into 3D scenes, scroll films, transparent video, cursor rigs, and more.",
      starsLine: "28 → 287 stars（+925.0%）",
    }, WEEKLY_4_CAMPAIGN),
    frozenHeatItem({
      rank: 5,
      name: "claude-animation-skills",
      slug: "artemnovitckii-claude-animation-skills",
      heat: 67,
      peakDate: "2026-11-07",
      zh: "给Claude Code的动画技能，输入命令就能生成六种短视频动画。",
      en: "Six Claude Code skills that turn text prompts into animated reels—no video footage required.",
      starsLine: "47 → 442 stars（+840.4%）",
    }, WEEKLY_4_CAMPAIGN),
    frozenHeatItem({
      rank: 6,
      name: "vibe-knowledge",
      slug: "andyhuo520-vibe-knowledge",
      heat: 66,
      peakDate: "2026-11-05",
      zh: "一个Claude Code技能，输入知识点就能生成有旁白、有出处的知识短片。",
      en: "Make a citation-backed narrated video from any single knowledge point, in any of 44 styles.",
      starsLine: "408 → 546 stars（+33.8%）",
    }, WEEKLY_4_CAMPAIGN),
    frozenHeatItem({
      rank: 7,
      name: "aidlc-workflows",
      slug: "awslabs-aidlc-workflows",
      heat: 66,
      peakDate: "2026-11-07",
      zh: "一套规则，让AI编码助手按固定阶段管理开发流程。",
      en: "Adaptive rules that guide your AI coding assistant through the entire development lifecycle, stage by stage.",
      starsLine: "5.7k → 5.9k stars（+3.0%）",
    }, WEEKLY_4_CAMPAIGN),
    frozenHeatItem({
      rank: 8,
      name: "diorama",
      slug: "sloemo01-diorama",
      heat: 66,
      peakDate: "2026-11-05",
      zh: "给AI agent用的像素立体模型自动构建工具包",
      en: "A research-first playbook and code kit for building pixel-art dioramas in Three.js, with automatic palette and animation.",
      starsLine: "122 → 342 stars（+180.3%）",
    }, WEEKLY_4_CAMPAIGN),
    frozenHeatItem({
      rank: 9,
      name: "dsh-mattpocock-skills-deck",
      slug: "featherhunter-dsh-mattpocock-skills-deck",
      heat: 65,
      peakDate: "2026-11-08",
      // Conflicting skill counts were removed. The rest of each locked line stays.
      zh: "DSH 插件，一次安装获得 AI 工程技能，加速代码审查、调试和设计。",
      en: "A pre-loaded deck of engineering and productivity skills for DSH, ready to use with zero manual setup.",
      starsLine: "270 → 318 stars（+17.8%）",
    }, WEEKLY_4_CAMPAIGN),
    frozenHeatItem({
      rank: 10,
      name: "Agentic-Bug-Hunter",
      slug: "awarexone-agentic-bug-hunter",
      heat: 62,
      peakDate: "2026-11-03",
      zh: "帮漏洞赏金猎人和安全研究员自动完成侦察、挖洞、验证和写报告。",
      en: "A free AI toolkit that automates bug bounty hunting from recon to report.",
      starsLine: "5.4k → 5.6k stars（+3.6%）",
    }, WEEKLY_4_CAMPAIGN),
  ],
  editorPick: {
    name: "boardui",
    slug: "boardui-boardui",
    heat: 61,
    peakDate: "2026-11-05",
    zh: "智能体界面的 React 组件库，组件源码免费可下，自带 AI 聊天示例。",
    en: "A free React design system that gives you a working AI chat app and source-available components for agentic interfaces.",
    starsLine: "551 → 1.1k stars（+93.3%）",
    reasonZh: "选它的理由：本周榜单多是「让 agent 产出内容」的技能，boardui 则是给 agent 产品本身做界面的组件库（自带 AI 聊天示例），换个角度看同一波 agent 热；A- 质量、窗口内翻倍。",
    // Draft reason is Chinese only. Left blank rather than translated.
    reasonEn: "",
    href: weeklyCampaignPath("boardui-boardui", WEEKLY_4_CAMPAIGN),
  },
};

export interface PublicWeeklyIssue {
  number: number;
  /** Day the public /weekly/<n> page went live. IndexNow treats a match as a new issue. */
  publishedOn: string;
}

/**
 * Public issue pages. Add the next frozen issue here.
 * `/weekly/[issue]`, its Open Graph card, the sitemap, and IndexNow all read this list.
 * Bare `/weekly` redirects to the highest issue number (see next.config).
 * next.config imports this module, so keep it free of server-only dependencies.
 */
const PUBLISHED_WEEKLY_ISSUES: WeeklyIssue[] = [WEEKLY_ISSUE_1, WEEKLY_ISSUE_2, WEEKLY_ISSUE_3, WEEKLY_ISSUE_4];

export function weeklyIssueByNumber(number: number): WeeklyIssue | null {
  if (!Number.isInteger(number) || number < 1) return null;
  return PUBLISHED_WEEKLY_ISSUES.find((issue) => issue.issue === number) ?? null;
}

export function publicWeeklyIssues(): PublicWeeklyIssue[] {
  return PUBLISHED_WEEKLY_ISSUES.map((issue) => ({
    number: issue.issue,
    publishedOn: issue.to,
  }));
}

/** Highest issue number in the published list. `0` when nothing is published. */
export function latestPublishedWeeklyIssue(): number {
  return PUBLISHED_WEEKLY_ISSUES.reduce((latest, issue) => Math.max(latest, issue.issue), 0);
}
