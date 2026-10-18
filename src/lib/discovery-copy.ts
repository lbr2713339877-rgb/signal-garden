import type { ProjectCard } from '@/db/queries';
import { installOptions } from './install-options';

/** Editorial wording grounded in the projects' documented capabilities. */
const EDITED: Record<string, { zh: string; en: string; summaryZh?: string }> = {
  'oil-oil-oil-ui': {
    zh: '同一个页面，可以有几种气质？',
    en: 'One page. How many directions?',
    summaryZh: 'oil-ui 把几种不同的界面方案摆到一起，先选方向，再继续打磨。它是给 AI Agent 用的设计技能。',
  },
  'gtkottman-mortiflix-oss': {
    zh: 'Claude 负责制作，每一步你来点头。',
    en: 'Make videos with Claude, one approved step at a time.',
  },
  'darkroomengineering-lenis': {
    zh: '滚动，也值得好好设计。',
    en: 'Bring smooth scrolling to your website.',
  },
  '199-biotechnologies-motion-dev-animations-skill': {
    zh: '动效怎么做？先把想法告诉 Claude。',
    en: 'Ask Claude Code to build Motion.dev animations.',
  },
  'jgravelle-jcodemunch-mcp': {
    zh: '找函数，不必读完整份文件。',
    en: 'Give your coding agent the function, not the whole file.',
    summaryZh: '为代码建立索引，按函数和变量定位相关片段，减少不必要的整文件读取。',
  },
  'arhamkhnz-next-shadcn-admin-dashboard': {
    zh: '后台的基础界面，已经搭好了。',
    en: 'Start your admin interface with ready-made dashboards.',
  },
};

function readableEnglish(value: string | null | undefined) {
  // Repo descriptions sometimes append a second language. Keep the English
  // portion rather than leaking Chinese into the English interface.
  return (value ?? '').split(/[\u3400-\u9fff]/)[0].replace(/[|·\s]+$/, '').trim();
}

export function discoveryCopy(card: ProjectCard) {
  const edited = EDITED[card.slug];
  const summaryZh = edited?.summaryZh ?? card.oneLiner ?? '';
  const summaryEn = readableEnglish(card.oneLinerEn ?? card.description);
  const capability = card.capabilities?.find((c) => c.trim() && c.length <= 45
    && !/\d|九成|百分之|最强|一键/.test(c));
  return {
    headlineZh: edited?.zh ?? capability ?? summaryZh,
    headlineEn: edited?.en ?? (readableEnglish(card.capabilitiesEn?.[0]) || summaryEn || card.name),
    summaryZh,
    summaryEn,
  };
}

/** Prefer a useful, documented introduction. Heat is deliberately not an input. */
export function selectFeatured(cards: ProjectCard[]) {
  const completeness = (card: ProjectCard) =>
    (card.oneLiner ? 2 : 0) + (card.capabilities?.length ? 2 : 0)
    + (card.targetUsers?.length ? 1 : 0)
    + (installOptions(card.installCommands ?? []).length ? 2 : 0)
    + (card.difficulty && card.difficulty !== 'needs_dev' ? 1 : 0);
  return cards.reduce<ProjectCard | null>((best, card) =>
    !best || completeness(card) > completeness(best) ? card : best, null);
}
