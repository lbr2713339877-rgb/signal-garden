/**
 * 分类 → V3 环境色 / 英文标签
 *
 * TAXONOMY 自带的 cssVar 指向 V2 的 `--c-*` 变量，在 V3 子树里没有定义
 * （V3 用的是 `--light-*` 六色）。所以 V3 组件不能直接用 taxonomy[key].cssVar。
 *
 * 之前这份映射在 TodaySignals 和 CategorySpaces 里各写了一遍，详情页会是
 * 第三遍 —— 提出来放这里。
 */

import { TAXONOMY } from '@/normalizers/taxonomy';

export const CATEGORY_COLOR: Record<string, string> = {
  'ai-tools': 'var(--light-purple)',
  'indie-web': 'var(--light-cyan)',
  'dev-tools': 'var(--light-fog)',
  design: 'var(--light-coral)',
  'skill-agent': 'var(--light-mint)',
  productivity: 'var(--light-amber)',
};

/** 分类 → 大写的英文标签，用于系统层。 */
const LABEL_EN: Record<string, string> = Object.fromEntries(
  TAXONOMY.map((t) => [t.key, t.en.toUpperCase()]),
);

const LABEL_ZH: Record<string, string> = Object.fromEntries(
  TAXONOMY.map((t) => [t.key, t.label]),
);

/** 兜底用 dev-tools 的雾蓝，它是六色里最中性的一个。 */
export function categoryColor(key: string | null | undefined): string {
  return CATEGORY_COLOR[key ?? ''] ?? 'var(--light-fog)';
}

export function categoryLabelEn(key: string | null | undefined): string {
  return LABEL_EN[key ?? ''] ?? (key ?? 'GENERAL').toUpperCase();
}

export function categoryLabelZh(key: string | null | undefined): string {
  return LABEL_ZH[key ?? ''] ?? '未分类';
}
