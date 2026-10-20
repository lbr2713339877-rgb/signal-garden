/**
 * Public sample of the Monday weekly digest.
 *
 * Issue 1 mirrors the 2026-10-13 – 2026-10-19 edition: each day's #1, then #2s,
 * the same order as the weekly mailer. Names and summaries are the public
 * archive copy. This module does not read the mailing list.
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

export const WEEKLY_ISSUE_1 = {
  issue: 1,
  from: "2026-10-13",
  to: "2026-10-19",
  items: pickWeeklySample(ISSUE_1_DAYS),
};
