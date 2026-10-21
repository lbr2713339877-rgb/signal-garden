/**
 * 分类空间（V3）—— /c/[category]
 *
 * 对应 01-art-direction-v3.md §8「分类视觉映射（6 个空间状态）」与 §7
 * 「分类切换：空间变色」。
 *
 * 这一页是服务端组件：数据在这里取，交互（离场/入场编排）在
 * CategorySpace 客户端组件里。六个空间各有自己的环境色，切换时环境光
 * 插值 800ms。
 *
 * 二级细分与排序控件是硬性要求（"不允许进入分类后只能顺序翻阅"），
 * 两者都用链接实现 —— URL 即状态，可分享、无 JS 也能用、不会和显示
 * 的内容脱节。
 *
 * V2 版本保留在 /classic 之外的原始实现里（本文件由它改写而来）。
 */

import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { V3Shell } from '@/components/v3/V3Shell';
import { CategorySpace } from '@/components/v3/category/CategorySpace';
import { categoryColor, categoryLabelEn } from '@/components/v3/category-color';
import { getByTaxonomy, getTaxonomyCounts, type SortKey } from '@/db/queries';
import { taxonomy, TAXONOMY } from '@/normalizers/taxonomy';
import { ProjectDirectory, type DirectoryGroup } from '@/components/v3/category/ProjectDirectory';
import { UI, LANG } from '@/lib/i18n';
import { T } from '@/lib/dict';

export const revalidate = 0;

const SORTS: { key: SortKey; zh: string; en: string }[] = [
  { key: 'heat', zh: UI.sortHeat.zh, en: UI.sortHeat.en },
  { key: 'growth', zh: UI.sortGrowth.zh, en: UI.sortGrowth.en },
  { key: 'newest', zh: UI.sortNewest.zh, en: UI.sortNewest.en },
];

/** 六个分类页都预生成，切换时不必等编译。 */
export function generateStaticParams() {
  return TAXONOMY.map((t) => ({ category: t.key }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string }>;
}): Promise<Metadata> {
  const { category } = await params;
  const meta = taxonomy(category);
  return { title: meta ? `${meta.label} · ${meta.en}` : '分类 · Categories' };
}

export default async function CategorySpacePage({
  params,
  searchParams,
}: {
  params: Promise<{ category: string }>;
  searchParams: Promise<{ sub?: string; sort?: string; view?: string; page?: string }>;
}) {
  const { category } = await params;
  const { sub, sort, view, page } = await searchParams;

  const meta = taxonomy(category);
  if (!meta) notFound();

  const secondary = meta.secondary.some(s => s.key === sub) ? sub : undefined;
  const interesting = view === 'interesting';
  const pageNumber = secondary && !interesting ? Math.min(1000, Math.max(1, Math.floor(Number(page) || 1))) : 1;
  const offset = (pageNumber - 1) * 180;
  const sortKey: SortKey = sort === 'growth' || sort === 'newest' ? sort : 'heat';
  const [cards, counts, subCounts] = await Promise.all([
    getByTaxonomy(category, { secondary: secondary ?? null, sort: sortKey, limit: 180, offset, interesting }),
    getTaxonomyCounts(),
    getTaxonomyCounts(category),
  ]);

  const total = interesting ? cards.length : counts.find((c) => c.k === category)?.n ?? 0;
  const accent = categoryColor(category);
  const subTotal = subCounts.find(c => c.k === secondary)?.n ?? 0;
  const pageHref = (p: number) => `/c/${category}?sub=${secondary}&sort=${sortKey}&page=${p}`;

  const groups: DirectoryGroup[] = secondary ? [{ key: secondary,
    zh: meta.secondary.find(s => s.key === secondary)!.label,
    en: meta.secondary.find(s => s.key === secondary)!.en, cards }] : meta.secondary.map(s => ({
      key: s.key, zh: s.label, en: s.en, cards: cards.filter(c => c.secondaryCategory === s.key),
      total: interesting ? undefined : subCounts.find(c => c.k === s.key)?.n,
      href: `/c/${category}?sub=${s.key}${sortKey !== 'heat' ? `&sort=${sortKey}` : ''}${interesting ? '&view=interesting' : ''}`,
    }));
  if (!secondary) groups.push({ key: 'other', zh: '其他用途', en: 'More to explore',
    cards: cards.filter(c => !meta.secondary.some(s => s.key === c.secondaryCategory)) });

  return (
    <V3Shell>
      <CategorySpace
        category={category}
        secondary={secondary}
        interesting={interesting}
        sort={sortKey}
        total={total}
        subCounts={subCounts}
        sorts={SORTS}
      >
        {cards.length ? (
          <ProjectDirectory key={`${category}-${secondary}-${sortKey}-${interesting}-${pageNumber}`} groups={groups} accent={accent} />
        ) : (
          <T k="pg.cat.empty" as="p" className="body text-[var(--ink-3)]" />
        )}
        {secondary && !interesting && (pageNumber > 1 || subTotal > 180) && <nav className="mt-10 flex items-center justify-between gap-6 border-t border-[var(--glass-1-border)] pt-6" aria-label="分页 / Pagination">
          {pageNumber > 1 ? <Link href={pageHref(pageNumber - 1)} className="data"><LANG zh="← 上一页" en="← Previous" /></Link> : <span />}
          <span className="data text-[var(--ink-3)]"><LANG zh={`第 ${pageNumber} 页`} en={`Page ${pageNumber}`} /></span>
          {offset + cards.length < subTotal ? <Link href={pageHref(pageNumber + 1)} className="data"><LANG zh="下一页 →" en="Next →" /></Link> : <span />}
        </nav>}
      </CategorySpace>
    </V3Shell>
  );
}
